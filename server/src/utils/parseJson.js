// LLMs asked for JSON frequently wrap it in a ```json fence or add a sentence
// before/after it. This extracts the first balanced JSON object/array from such
// text instead of failing on a strict JSON.parse. Returns null when nothing
// parseable is found, so callers can fall back to a safe default.
function stripFences(text) {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
}

function findBalanced(text, open, close) {
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonLoose(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = stripFences(text.trim());

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to extraction
  }

  const firstObject = cleaned.indexOf('{');
  const firstArray = cleaned.indexOf('[');
  const tryObjectFirst = firstArray === -1 || (firstObject !== -1 && firstObject < firstArray);
  const candidates = tryObjectFirst
    ? [findBalanced(cleaned, '{', '}'), findBalanced(cleaned, '[', ']')]
    : [findBalanced(cleaned, '[', ']'), findBalanced(cleaned, '{', '}')];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

module.exports = { parseJsonLoose };
