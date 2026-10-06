const { generateText, generateJSON } = require('../aiService');

// Query-side transformations. Every function degrades to a safe fallback
// (original question / no extra queries) if the LLM call fails or returns
// junk, so a flaky provider can lower retrieval quality but never break the
// tutor. `trace.llmCalls` counts model calls for cost/latency reporting and
// `trace.llmFailures` counts the times a stage fell back, so the evaluation
// harness can refuse to report numbers from a run where stages silently failed.
const HISTORY_TURNS = 3;
const ANSWER_CHARS = 300;

function recordFailure(trace) {
  trace.llmFailures = (trace.llmFailures || 0) + 1;
}

function formatHistory(history) {
  return history
    .slice(-HISTORY_TURNS)
    .map((turn) => `Student: ${turn.question}\nTutor: ${String(turn.answer || '').slice(0, ANSWER_CHARS)}`)
    .join('\n\n');
}

function cleanSingleLine(text, maxLen = 400) {
  const line = String(text || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ');
  return line && line.length <= maxLen ? line : '';
}

// Follow-ups like "what about the second one?" retrieve nothing useful when
// embedded raw. Rewrite them into a self-contained question using the recent
// conversation. Skipped entirely when there is no history.
async function rewriteQuery(question, history, trace) {
  if (!history.length) return question;

  try {
    trace.llmCalls += 1;
    const text = await generateText({
      system:
        "You rewrite a student's follow-up question into a single standalone question that can be used to search course notes. " +
        'Use the conversation to resolve pronouns and omitted subjects (e.g. "it", "the second one", "what about PATCH?"). ' +
        'Keep technical terms exactly. If the question is already self-contained, return it unchanged. ' +
        'Output only the question, with no preamble or quotes.',
      prompt: `Conversation so far:\n${formatHistory(history)}\n\nFollow-up question: ${question}\n\nStandalone question:`,
      maxTokens: 150,
    });
    const rewritten = cleanSingleLine(text);
    if (!rewritten) recordFailure(trace);
    return rewritten || question;
  } catch {
    recordFailure(trace);
    return question;
  }
}

// Paraphrases using different vocabulary, so a question phrased unlike the
// lesson text still has a variant that matches it.
async function expandQueries(question, trace, count = 3) {
  try {
    trace.llmCalls += 1;
    const parsed = await generateJSON({
      system:
        'You help a search engine over course notes. Rewrite the student question in different ways, each using different wording ' +
        'and likely textbook terminology, while keeping the same meaning. Do not answer the question. ' +
        `Return JSON: {"queries": [${count} strings]}.`,
      prompt: `Question: ${question}`,
      maxTokens: 300,
    });
    const list = Array.isArray(parsed) ? parsed : parsed?.queries;
    if (!Array.isArray(list)) {
      recordFailure(trace);
      return [];
    }
    return [...new Set(list.map((q) => cleanSingleLine(q)).filter((q) => q && q !== question))].slice(0, count);
  } catch {
    recordFailure(trace);
    return [];
  }
}

// HyDE (Gao et al. 2022): embed a short hypothetical answer instead of the
// question. An answer-shaped passage sits closer to the real passage in
// embedding space than a short question does. Only used when the first
// retrieval pass looked weak, since it costs an extra LLM call.
async function hypotheticalPassage(question, trace) {
  try {
    trace.llmCalls += 1;
    const text = await generateText({
      system:
        'Write a short passage (2-3 sentences) in the style of a textbook or course lesson that directly answers the question. ' +
        'State it plainly as fact, with no hedging, preamble or mention of the question.',
      prompt: `Question: ${question}`,
      maxTokens: 200,
    });
    const passage = String(text || '').trim();
    if (passage.length < 20) {
      recordFailure(trace);
      return '';
    }
    return passage.slice(0, 800);
  } catch {
    recordFailure(trace);
    return '';
  }
}

module.exports = { rewriteQuery, expandQueries, hypotheticalPassage };
