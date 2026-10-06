const { generateJSON } = require('../aiService');

// Second-stage reranking. First-stage retrieval (dense + BM25) is cheap but
// scores query and passage independently; a reranker reads the question and
// each candidate together and judges relevance directly. Done here as a single
// listwise LLM call that returns a 0-10 relevance score per candidate:
//   - one round trip regardless of candidate count (low latency/cost);
//   - the scores are absolute, not just an ordering, so the same number also
//     drives calibrated abstention ("nothing here is relevant enough").
// Behind a small interface so a dedicated cross-encoder (Cohere Rerank, a
// local bge-reranker) could replace it without touching the pipeline.
const SYSTEM_PROMPT =
  'You are a strict relevance judge for a retrieval system serving an online course. ' +
  "For each numbered passage, score how well it helps answer the student's question, using only the passage text.\n" +
  'Scale: 0 = unrelated; 1-3 = same general topic but does not contain the answer; ' +
  '4-6 = contains part of the answer or closely relevant background; ' +
  '7-10 = directly and explicitly answers the question (10 = complete answer).\n' +
  'Be strict: a passage that merely mentions the same words or a neighbouring concept scores 3 or lower.\n' +
  'Return JSON only: {"scores":[{"id":<passage number>,"score":<0-10>}, ...]} covering every passage.';

function formatPassage(candidate, number, passageChars) {
  const header = candidate.chunk.contextHeader ? ` (${candidate.chunk.contextHeader})` : '';
  const text = candidate.chunk.text.length > passageChars
    ? `${candidate.chunk.text.slice(0, passageChars)}...`
    : candidate.chunk.text;
  return `[${number}]${header}\n${text}`;
}

// Returns Map(candidate.id -> score 0..10), or null if the call failed or the
// response couldn't be trusted (so the caller falls back to first-stage order).
async function rerankCandidates(question, candidates, { passageChars = 700 } = {}, trace) {
  if (!candidates.length) return new Map();

  const fail = () => {
    if (trace) trace.llmFailures = (trace.llmFailures || 0) + 1;
    return null;
  };

  try {
    if (trace) trace.llmCalls += 1;
    const parsed = await generateJSON({
      system: SYSTEM_PROMPT,
      prompt:
        `Student question: ${question}\n\nPassages:\n\n` +
        candidates.map((c, i) => formatPassage(c, i + 1, passageChars)).join('\n\n'),
      maxTokens: Math.max(400, candidates.length * 24),
    });

    const list = Array.isArray(parsed) ? parsed : parsed?.scores;
    if (!Array.isArray(list)) return fail();

    const scores = new Map();
    for (const item of list) {
      const number = Number(item?.id);
      const score = Number(item?.score);
      if (Number.isInteger(number) && number >= 1 && number <= candidates.length && Number.isFinite(score)) {
        scores.set(candidates[number - 1].id, Math.min(10, Math.max(0, score)));
      }
    }

    // A judge that scored fewer than half the passages isn't trustworthy.
    if (scores.size < Math.ceil(candidates.length / 2)) return fail();

    // Passages it skipped are treated as irrelevant rather than unknown.
    for (const candidate of candidates) {
      if (!scores.has(candidate.id)) scores.set(candidate.id, 0);
    }
    return scores;
  } catch {
    return fail();
  }
}

module.exports = { rerankCandidates };
