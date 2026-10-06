const fs = require('fs');
const path = require('path');
const { retrieve } = require('../../src/services/rag/pipeline');
const { retrieveBaseline } = require('../baseline/pipeline');
const { configOf } = require('./experiments');
const { sourceSlugOf } = require('./indexer');

const RAW_DIR = path.join(__dirname, '..', 'results', 'raw');

async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

function toRankedRecord(item, variant) {
  return {
    id: item.id,
    sourceSlug: sourceSlugOf(item.chunk, variant),
    text: item.chunk.text,
    signal: typeof item.signal === 'number' ? item.signal : null,
    scores: item.scores,
  };
}

// Runs every dataset question through one experiment's pipeline and records the
// raw outcome (ranked chunks with all their scores, plus the trace). No
// threshold is applied here: abstention decisions are made offline from the
// recorded scores (see evaluate.js), so thresholds can be tuned and swept
// without paying for the LLM calls again.
async function runExperiment({ exp, variant, dataset, concurrency = 2, log = () => {} }) {
  const config = configOf(exp);
  let done = 0;

  const records = await pool(dataset, concurrency, async (q) => {
    let result;
    try {
      result = exp.frozen
        ? await retrieveBaseline({ courseId: variant.courseId, question: q.question })
        : await retrieve({ courseId: variant.courseId, question: q.question, history: q.history, config });
    } catch (err) {
      log(`  ! ${q.id} failed: ${err.message}`);
      return { id: q.id, error: err.message, ranked: [], signalKind: 'dense', trace: { llmCalls: 0, timingsMs: {} } };
    }
    done += 1;
    if (done % 15 === 0) log(`  ${done}/${dataset.length}`);

    return {
      id: q.id,
      signalKind: result.signalKind,
      ranked: result.ranked.map((r) => toRankedRecord(r, variant)),
      trace: {
        llmCalls: result.trace.llmCalls || 0,
        llmFailures: result.trace.llmFailures || 0,
        standaloneQuestion: result.trace.standaloneQuestion,
        hyde: Boolean(result.trace.hyde),
        rerankFailed: Boolean(result.trace.rerankFailed),
        timingsMs: result.trace.timingsMs || {},
      },
    };
  });

  const questionErrors = records.filter((r) => r.error).length;
  const llmFailures = records.reduce((sum, r) => sum + (r.trace.llmFailures || 0), 0);

  const raw = {
    experiment: exp.name,
    label: exp.label,
    generatedAt: new Date().toISOString(),
    utilityModel: process.env.GEMINI_UTILITY_MODEL || process.env.GEMINI_CHAT_MODEL || null,
    chunkCount: variant.chunkCount,
    questionErrors,
    llmFailures,
    records,
  };

  // A run in which a stage errored or silently fell back (rate limit, bad JSON,
  // outage) measures the fallback, not the pipeline. Refuse to keep it, so it can
  // never reach the report; cached work is reused, so re-running is cheap.
  raw.invalid = questionErrors > 0 || llmFailures > 0;
  if (raw.invalid) return raw;

  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, `${exp.name}.json`), JSON.stringify(raw));
  return raw;
}

function loadRaw(name) {
  const file = path.join(RAW_DIR, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

module.exports = { runExperiment, loadRaw, RAW_DIR };
