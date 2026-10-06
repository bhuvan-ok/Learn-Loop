// End-to-end answer-quality evaluation: baseline vs production default.
//   node eval/e2e.js            test split
//   node eval/e2e.js --split all
//
// For every question each pipeline retrieves, generates an answer with its OWN
// prompt (the baseline keeps the original prompt), and an LLM judge scores:
//   - faithfulness: is every claim in the answer supported by the context the
//     model was given? (1 = fully supported, 0.5 = partly, 0 = not)
//   - correctness: does the answer convey the gold evidence? (same scale; only
//     for answerable questions)
//   - refused: did the answer decline / say the course doesn't cover it?
// Unanswerable questions should be refused; a substantive answer to one is a
// hallucination. The judge is an LLM from the same provider as the generator,
// so treat the absolute values as indicative and the baseline-vs-new
// difference as the signal. Results: eval/results/e2e.json
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
process.env.AI_CACHE_DIR = process.env.AI_CACHE_DIR || path.join(__dirname, '.cache', 'ai');
// Same model for generating answers and for the utility calls (rewrite, rerank,
// judge): the main Gemini chat model's free tier allows ~20 requests/day, far
// too few for ~200 generations, so a "lite" model is used (override with
// E2E_MODEL). Paced under its per-minute limit.
process.env.GEMINI_CHAT_MODEL = process.env.E2E_MODEL || 'gemini-3.1-flash-lite';
process.env.GEMINI_UTILITY_MODEL = process.env.E2E_MODEL || 'gemini-3.1-flash-lite';
process.env.AI_MIN_INTERVAL_MS = process.env.AI_MIN_INTERVAL_MS || '4300';
const GENERATION_GAP_MS = Number(process.env.E2E_GENERATION_GAP_MS || 4300);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mongoose = require('mongoose');
const { connectEvalDb } = require('./lib/db');
const { loadDataset } = require('./lib/corpus');
const { EXPERIMENTS, configOf } = require('./lib/experiments');
const { buildIndexVariant } = require('./lib/indexer');
const { loadTuned, thresholdsFor } = require('./lib/thresholds');
const { retrieveBaseline } = require('./baseline/pipeline');
const { retrieve } = require('../src/services/rag/pipeline');
const { applyThreshold } = require('../src/services/rag/thresholds');
const { generateAnswer } = require('../src/services/ragService');
const { streamChatCompletion, generateJSON } = require('../src/services/aiService');
const { mean, pairedBootstrap } = require('./lib/stats');

const ORIGINAL_SYSTEM_PROMPT = `You are an AI tutor embedded inside an online course.
Answer the student's question using ONLY the numbered course excerpts provided below.
Rules:
- If the excerpts do not contain enough information to answer, say so plainly instead of guessing.
- Never use outside knowledge beyond what is in the excerpts.
- Reference which excerpt number(s) support each part of your answer, e.g. "(Excerpt 2)".
- Keep the answer concise and directly address the question.`;

const NOT_FOUND = "I couldn't find anything in this course's material that answers that question.";

async function pool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next;
        next += 1;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

async function baselineAnswer(variant, q) {
  const result = await retrieveBaseline({ courseId: variant.courseId, question: q.question });
  if (result.abstain) return { answer: NOT_FOUND, context: [] };

  const excerpts = result.context.map((c, i) => `Excerpt ${i + 1}:\n${c.chunk.text}`).join('\n\n');
  await sleep(GENERATION_GAP_MS);
  let answer = '';
  for await (const token of streamChatCompletion({
    systemPrompt: ORIGINAL_SYSTEM_PROMPT,
    userPrompt: `Course excerpts:\n${excerpts}\n\nStudent question: ${q.question}`,
  })) {
    answer += token;
  }
  return { answer, context: result.context.map((c) => c.chunk.text) };
}

async function advancedAnswer(variant, q, thresholds) {
  const config = configOf(EXPERIMENTS.find((e) => e.name === 'advanced'));
  const result = await retrieve({ courseId: variant.courseId, question: q.question, history: q.history, config });
  // Use the dev-tuned thresholds the report uses (identical to production's by construction).
  const t = thresholds[result.signalKind] || thresholds.dense;
  const decision = applyThreshold(result.ranked, t);
  if (decision.abstain) return { answer: NOT_FOUND, context: [] };

  await sleep(GENERATION_GAP_MS);
  const { answer } = await generateAnswer({ question: q.question, passages: result.passages, history: q.history });
  return { answer, context: result.passages.map((p) => p.text) };
}

const JUDGE_SYSTEM =
  'You are a strict, impartial grader of a course tutor chatbot. You are given the context the tutor was allowed to use, ' +
  "the student's question, the tutor's answer, and (when the question is answerable) the reference evidence from the course.\n" +
  'Return JSON only: {"faithfulness": 0|0.5|1, "correctness": 0|0.5|1, "refused": true|false}.\n' +
  '- faithfulness: 1 if every factual claim in the answer is supported by the context; 0.5 if some are unsupported; 0 if most are. ' +
  'A refusal ("not covered") is fully faithful (1).\n' +
  '- correctness: 1 if the answer conveys the key point of the reference evidence; 0.5 if partially; 0 if wrong, off-topic or a refusal. ' +
  'If there is no reference evidence, set correctness to 0.\n' +
  '- refused: true if the answer declines or says the course material does not cover the question.';

async function judge(q, run) {
  const evidence = q.gold.length ? q.gold.map((g) => `- ${g.span}`).join('\n') : '(none: the course does not cover this question)';
  const context = run.context.length ? run.context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n') : '(no context was provided)';
  const parsed = await generateJSON({
    system: JUDGE_SYSTEM,
    prompt: `Context given to the tutor:\n${context}\n\nQuestion: ${q.question}\n\nTutor answer:\n${run.answer}\n\nReference evidence:\n${evidence}`,
    maxTokens: 120,
  });
  if (!parsed || typeof parsed.faithfulness !== 'number') return null;
  return { faithfulness: parsed.faithfulness, correctness: Number(parsed.correctness) || 0, refused: Boolean(parsed.refused) };
}

async function runPipeline(name, variant, dataset, answerFn, concurrency) {
  console.log(`-- ${name}: generating + judging ${dataset.length} questions`);
  return pool(dataset, concurrency, async (q) => {
    try {
      const run = await answerFn(variant, q);
      const scores = await judge(q, run);
      return { id: q.id, category: q.category, answerable: q.answerable, answer: run.answer, contextChunks: run.context.length, ...(scores || { judgeFailed: true }) };
    } catch (err) {
      console.log(`  ! ${q.id}: ${err.message}`);
      return { id: q.id, category: q.category, answerable: q.answerable, error: err.message };
    }
  });
}

function summarise(results) {
  const ok = results.filter((r) => !r.error && !r.judgeFailed);
  const answerable = ok.filter((r) => r.answerable);
  const unanswerable = ok.filter((r) => !r.answerable);
  return {
    n: results.length,
    judged: ok.length,
    faithfulness: mean(ok.map((r) => r.faithfulness)),
    correctnessAnswerable: mean(answerable.map((r) => r.correctness)),
    refusedOnAnswerable: answerable.length ? answerable.filter((r) => r.refused).length / answerable.length : null,
    hallucinatedOnUnanswerable: unanswerable.length ? unanswerable.filter((r) => !r.refused).length / unanswerable.length : null,
  };
}

async function main() {
  const split = process.argv.includes('--split') ? process.argv[process.argv.indexOf('--split') + 1] : 'test';
  const concurrency = Number(process.env.EVAL_CONCURRENCY || 2);
  const dataset = loadDataset().filter((q) => split === 'all' || q.split === split);

  await connectEvalDb();
  console.log(`Evaluation database: ${mongoose.connection.host}/${mongoose.connection.name}; ${dataset.length} questions (${split})`);

  const frozen = await buildIndexVariant({ frozen: true, config: null });
  const base = await runPipeline('basic', frozen, dataset, baselineAnswer, concurrency);

  const advancedExp = EXPERIMENTS.find((e) => e.name === 'advanced');
  const adv = await buildIndexVariant({ frozen: false, config: configOf(advancedExp) });
  const thresholds = thresholdsFor('advanced', loadTuned());
  const advanced = await runPipeline('advanced', adv, dataset, (v, q) => advancedAnswer(v, q, thresholds), concurrency);

  const summary = { basic: summarise(base), advanced: summarise(advanced) };

  // Paired comparison on the questions both pipelines were judged on.
  const paired = {};
  const advById = new Map(advanced.map((r) => [r.id, r]));
  const both = base.filter((b) => !b.error && !b.judgeFailed && advById.get(b.id) && !advById.get(b.id).error && !advById.get(b.id).judgeFailed);
  for (const [key, filter] of [
    ['faithfulness', () => true],
    ['correctness', (r) => r.answerable],
  ]) {
    const rows = both.filter(filter);
    paired[key] = pairedBootstrap(rows.map((r) => r[key]), rows.map((r) => advById.get(r.id)[key]));
  }
  const unans = both.filter((r) => !r.answerable);
  paired.hallucination = pairedBootstrap(unans.map((r) => (r.refused ? 0 : 1)), unans.map((r) => (advById.get(r.id).refused ? 0 : 1)));

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'results', 'e2e.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), split, summary, paired, basic: base, advanced }, null, 2)
  );

  const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  console.log('\n                          basic     advanced');
  console.log(`faithfulness            ${pct(summary.basic.faithfulness).padStart(8)}  ${pct(summary.advanced.faithfulness).padStart(8)}`);
  console.log(`correctness (answerable)${pct(summary.basic.correctnessAnswerable).padStart(8)}  ${pct(summary.advanced.correctnessAnswerable).padStart(8)}`);
  console.log(`wrongly refused         ${pct(summary.basic.refusedOnAnswerable).padStart(8)}  ${pct(summary.advanced.refusedOnAnswerable).padStart(8)}`);
  console.log(`hallucinated (unanswer.)${pct(summary.basic.hallucinatedOnUnanswerable).padStart(8)}  ${pct(summary.advanced.hallucinatedOnUnanswerable).padStart(8)}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('E2E evaluation failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
