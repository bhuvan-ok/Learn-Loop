// Splits lesson content into overlapping chunks sized for embedding + retrieval.
// Splitting on paragraph boundaries first (falling back to sentences) keeps each
// chunk semantically coherent instead of cutting text at an arbitrary offset.
const MAX_CHUNK_CHARS = 800;
const OVERLAP_CHARS = 150;

function splitIntoParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff;
}

// Nudges a slice boundary off a UTF-16 surrogate-pair split (emoji, many
// astral-plane/CJK-extension characters) so hard-slicing long paragraphs
// never corrupts a multi-byte character into two invalid halves.
function safeStart(text, start) {
  if (start > 0 && start < text.length && isHighSurrogate(text.charCodeAt(start - 1))) {
    return start - 1;
  }
  return start;
}

function safeEnd(text, end) {
  if (end > 0 && end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) {
    return end - 1;
  }
  return end;
}

function chunkText(text) {
  const paragraphs = splitIntoParagraphs(text);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length <= MAX_CHUNK_CHARS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) {
      chunks.push(current);
      const overlapStart = safeStart(current, Math.max(0, current.length - OVERLAP_CHARS));
      current = current.slice(overlapStart);
    }

    if (paragraph.length > MAX_CHUNK_CHARS) {
      const step = MAX_CHUNK_CHARS - OVERLAP_CHARS;
      let i = 0;
      while (i < paragraph.length) {
        const end = safeEnd(paragraph, Math.min(i + MAX_CHUNK_CHARS, paragraph.length));
        chunks.push(paragraph.slice(i, end));
        if (end >= paragraph.length) break;
        i = safeStart(paragraph, i + step);
      }
      current = '';
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [text.trim()];
}

module.exports = chunkText;
