// Structure-aware chunker. Compared with the original fixed-size paragraph
// packer in chunkText.js it:
//   - tracks the heading hierarchy (markdown "#" headings, plus optional
//     detection of plain-text headings for extracted PDFs) and never packs
//     across a section boundary, so each chunk has one coherent topic and a
//     heading path that can be prepended as retrieval context;
//   - packs whole sentences (abbreviation-aware) instead of slicing at a raw
//     character offset, and keeps fenced code blocks intact;
//   - makes overlap sentence-aligned (the next chunk repeats whole trailing
//     sentences of the previous one) and records how long that duplicated
//     prefix is (overlapLen), so adjacent chunks can be stitched back together
//     without repeating text when expanding context at answer time;
//   - records the source page for paged documents.
const DEFAULTS = {
  targetChars: 650,
  maxChars: 900,
  minChars: 120,
  overlapChars: 140,
  plainHeadings: false,
};

const ABBREVIATION_END = /\b(?:e\.g|i\.e|vs|etc|approx|fig|no|dr|mr|ms|inc|cf)\.$/i;
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*```/;

function normalize(text) {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/ /g, ' ');
}

function splitSentences(paragraph) {
  const pieces = paragraph
    .split(/(?<=[.!?]["')\]]?)\s+(?=["'(\[`$A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = [];
  for (const piece of pieces) {
    const previous = merged[merged.length - 1];
    if (previous && ABBREVIATION_END.test(previous)) {
      merged[merged.length - 1] = `${previous} ${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged;
}

function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff;
}

// A conservative detector for headings in text that has no markdown markup
// (PDF extraction): a short, unpunctuated line that is either numbered
// ("2.1 Cursor pagination") or Title Case, and is followed by body text.
function looksLikePlainHeading(line, nextLine) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80 || /[.,;:!?]$/.test(trimmed)) return false;
  if (!nextLine || !nextLine.trim() || /^\s*[-*•]\s+/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 10) return false;
  // "1. Pagination" / "2.1 Cursor pagination": a short numbered title (a
  // numbered list item would normally be a longer sentence).
  if (/^\d+(\.\d+)*[.)]?\s+[A-Z]/.test(trimmed)) return words.length <= 7;
  const significant = words.filter((w) => w.length > 3);
  if (!significant.length) return false;
  const capitalised = significant.filter((w) => /^[A-Z0-9]/.test(w)).length;
  return words.length <= 8 && capitalised / significant.length >= 0.75;
}

// Splits text into sections, each with a heading path and a flat list of
// units (sentence / list item / code block) in reading order.
function parseSections(pages, { plainHeadings }) {
  const sections = [];
  const headingStack = [];
  let current = { headingPath: [], units: [] };
  sections.push(current);

  const multiPage = pages.length > 1;

  const startSection = (level, title) => {
    while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
      headingStack.pop();
    }
    headingStack.push({ level, title });
    current = { headingPath: headingStack.map((h) => h.title), units: [] };
    sections.push(current);
  };

  pages.forEach((pageText, pageIndex) => {
    const page = multiPage ? pageIndex + 1 : null;
    const lines = normalize(pageText).split('\n');
    let paragraph = [];
    let code = null;

    const pushUnit = (text, sep, isCode = false) => {
      if (!text) return;
      current.units.push({ text, sep: current.units.length ? sep : '', isCode, page });
    };

    const flushParagraph = () => {
      if (!paragraph.length) return;
      const lines = paragraph;
      paragraph = [];

      if (lines.every((l) => LIST_ITEM.test(l))) {
        lines.forEach((l, i) => pushUnit(l.trim(), i === 0 ? '\n\n' : '\n'));
        return;
      }

      const text = lines.map((l) => l.trim()).join(' ');
      splitSentences(text).forEach((sentence, i) => pushUnit(sentence, i === 0 ? '\n\n' : ' '));
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (code) {
        code.push(line);
        if (FENCE.test(line)) {
          pushUnit(code.join('\n'), '\n\n', true);
          code = null;
        }
        continue;
      }

      if (FENCE.test(line)) {
        flushParagraph();
        code = [line];
        continue;
      }

      const heading = line.match(HEADING);
      if (heading) {
        flushParagraph();
        startSection(heading[1].length, heading[2].trim());
        continue;
      }

      if (plainHeadings && looksLikePlainHeading(line, lines[i + 1])) {
        flushParagraph();
        // "2.1 Cursor pagination" nests under "2. Pagination"; unnumbered
        // headings are treated as top level.
        const numbered = line.trim().match(/^(\d+(?:\.\d+)*)[.)]?\s/);
        startSection(numbered ? numbered[1].split('.').length : 1, line.trim());
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        continue;
      }

      paragraph.push(line);
    }

    if (code) pushUnit(code.join('\n'), '\n\n', true);
    flushParagraph();
  });

  return sections.filter((s) => s.units.length);
}

// Guarantees no unit exceeds maxChars: code blocks split on line boundaries,
// prose on word boundaries (a single over-long token is hard-sliced without
// splitting a surrogate pair).
function splitLongUnit(unit, maxChars) {
  if (unit.text.length <= maxChars) return [unit];

  const parts = [];
  const pushPart = (text, sep) => parts.push({ ...unit, text, sep });

  if (unit.isCode) {
    let buffer = '';
    for (const line of unit.text.split('\n')) {
      if (buffer && buffer.length + 1 + line.length > maxChars) {
        pushPart(buffer, parts.length ? '\n' : unit.sep);
        buffer = line;
      } else {
        buffer = buffer ? `${buffer}\n${line}` : line;
      }
    }
    if (buffer) pushPart(buffer, parts.length ? '\n' : unit.sep);
    return parts.flatMap((p) => (p.text.length > maxChars ? hardSlice(p, maxChars) : [p]));
  }

  let buffer = '';
  for (const word of unit.text.split(/\s+/)) {
    if (word.length > maxChars) {
      if (buffer) {
        pushPart(buffer, parts.length ? ' ' : unit.sep);
        buffer = '';
      }
      hardSlice({ ...unit, text: word, sep: parts.length ? ' ' : unit.sep }, maxChars).forEach((p) =>
        parts.push(p)
      );
      continue;
    }
    if (buffer && buffer.length + 1 + word.length > maxChars) {
      pushPart(buffer, parts.length ? ' ' : unit.sep);
      buffer = word;
    } else {
      buffer = buffer ? `${buffer} ${word}` : word;
    }
  }
  if (buffer) pushPart(buffer, parts.length ? ' ' : unit.sep);
  return parts;
}

function hardSlice(unit, maxChars) {
  const slices = [];
  let start = 0;
  while (start < unit.text.length) {
    let end = Math.min(start + maxChars, unit.text.length);
    if (end < unit.text.length && isHighSurrogate(unit.text.charCodeAt(end - 1))) end -= 1;
    slices.push({ ...unit, text: unit.text.slice(start, end), sep: slices.length ? '' : unit.sep });
    start = end;
  }
  return slices;
}

function joinUnits(units) {
  return units.map((u, i) => (i === 0 ? u.text : u.sep + u.text)).join('');
}

function packSection(rawUnits, opts) {
  const { targetChars, maxChars, minChars, overlapChars } = opts;
  const units = rawUnits.flatMap((u) => splitLongUnit(u, maxChars));
  const chunks = [];

  let carry = [];
  let own = [];

  const trailingOverlap = (ownUnits) => {
    const picked = [];
    for (let i = ownUnits.length - 1; i >= 0; i -= 1) {
      const candidate = [ownUnits[i], ...picked];
      if (ownUnits[i].isCode || joinUnits(candidate).length > overlapChars) break;
      picked.unshift(ownUnits[i]);
    }
    return picked;
  };

  const flush = () => {
    const ownText = joinUnits(own);
    const carryText = joinUnits(carry);
    const text = carry.length ? carryText + own[0].sep + ownText : ownText;
    chunks.push({
      text,
      overlapLen: carry.length ? carryText.length + own[0].sep.length : 0,
      ownText,
      ownSep: own[0].sep,
      page: own[0].page,
    });
    carry = trailingOverlap(own);
    own = [];
  };

  for (const unit of units) {
    const fullUnits = [...carry, ...own];
    const sepLen = fullUnits.length ? unit.sep.length : 0;
    const newLen = joinUnits(fullUnits).length + sepLen + unit.text.length;
    const ownLen = joinUnits(own).length;

    if (own.length && (newLen > maxChars || (newLen > targetChars && ownLen >= minChars))) {
      flush();
    }

    const carriedLen = joinUnits(carry).length;
    if (carry.length && carriedLen + unit.sep.length + unit.text.length > maxChars) {
      carry = [];
    }

    own.push(unit);
  }
  if (own.length) flush();

  // Fold a tiny trailing chunk into its predecessor when it fits, so a section
  // doesn't end in a sliver too short to be useful on its own.
  const last = chunks[chunks.length - 1];
  const previous = chunks[chunks.length - 2];
  if (
    last &&
    previous &&
    last.ownText.length < minChars &&
    previous.text.length + last.ownSep.length + last.ownText.length <= maxChars
  ) {
    previous.text = previous.text + last.ownSep + last.ownText;
    chunks.pop();
  }

  return chunks.map(({ text, overlapLen, page }) => ({ text, overlapLen, page }));
}

function buildContextHeader({ lessonTitle, sourceLabel, headingPath = [] }) {
  const root = sourceLabel ? `${lessonTitle} (${sourceLabel})` : lessonTitle;
  // A lesson's own "# Title" heading usually repeats the lesson title; don't
  // spend embedding context saying it twice.
  const path = headingPath.filter((h) => h.trim().toLowerCase() !== lessonTitle.trim().toLowerCase());
  return [root, ...path].filter(Boolean).join(' > ');
}

// `input` is either a string or an array of page strings. Returns
// [{ text, headingPath, contextHeader, overlapLen, page, chunkIndex }].
function chunkDocument(input, { lessonTitle = '', sourceLabel = '', ...options } = {}) {
  const opts = { ...DEFAULTS, ...options };
  const pages = Array.isArray(input) ? input : [input];
  const sections = parseSections(pages, opts);

  const chunks = [];
  for (const section of sections) {
    for (const piece of packSection(section.units, opts)) {
      chunks.push({
        text: piece.text,
        headingPath: section.headingPath,
        contextHeader: buildContextHeader({ lessonTitle, sourceLabel, headingPath: section.headingPath }),
        overlapLen: piece.overlapLen,
        page: piece.page,
        chunkIndex: chunks.length,
      });
    }
  }

  if (!chunks.length) {
    const fallback = pages.join('\n').trim();
    if (fallback) {
      chunks.push({
        text: fallback,
        headingPath: [],
        contextHeader: buildContextHeader({ lessonTitle, sourceLabel }),
        overlapLen: 0,
        page: null,
        chunkIndex: 0,
      });
    }
  }
  return chunks;
}

// Text actually embedded for a chunk: the context header (and optional
// LLM-written note) is prepended so a passage like "This is why .then() always
// runs first" still carries its subject, while `text` stays the clean passage
// shown to students and cited.
function buildEmbedText({ contextHeader = '', contextNote = '', text }) {
  return [contextHeader, contextNote, text].filter(Boolean).join('\n\n');
}

// Joins neighbouring chunks of one document back into a continuous passage,
// dropping each chunk's duplicated overlap prefix. `chunks` must be consecutive
// and ordered by chunkIndex.
function stitchChunks(chunks) {
  if (!chunks.length) return '';
  return chunks.reduce((acc, chunk, i) => {
    if (i === 0) return chunk.text;
    const overlapLen = chunk.overlapLen || 0;
    return `${acc}${overlapLen ? ' ' : '\n\n'}${chunk.text.slice(overlapLen).trimStart()}`;
  }, '');
}

module.exports = {
  chunkDocument,
  buildContextHeader,
  buildEmbedText,
  stitchChunks,
  splitSentences,
  DEFAULTS,
};
