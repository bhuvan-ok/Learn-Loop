// Builds the comparison tables from raw experiment results.
//   node eval/report.js          print tables and write eval/results/RESULTS.md
//
// Headline numbers use the held-out TEST split only (thresholds were tuned on
// DEV). Improvements over the frozen baseline come with paired-bootstrap 95%
// confidence intervals over the same questions.
const fs = require('fs');
const path = require('path');
const { loadDataset } = require('./lib/corpus');
const { EXPERIMENTS } = require('./lib/experiments');
const { loadRaw } = require('./lib/runner');
const { evaluate, summarize } = require('./lib/evaluate');
const { thresholdsFor, loadTuned } = require('./lib/thresholds');
const { pairedBootstrap } = require('./lib/stats');

const RESULTS_DIR = path.join(__dirname, 'results');
const pct = (v) => (v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}`);
const signed = (v) => (v === null || v === undefined ? 'n/a' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

function mdTable(headers, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

const untuned = [];

function scoreAll(dataset, tuned) {
  const scored = new Map();
  const rows = [...EXPERIMENTS, { name: 'basic+thr', label: 'Basic + tuned abstention threshold', source: 'basic' }];

  for (const exp of rows) {
    const raw = loadRaw(exp.source || exp.name);
    if (!raw) continue;
    const needsTuning = !['basic', 'basic-prod'].includes(exp.name);
    if (needsTuning && !tuned[exp.name]) untuned.push(exp.name);
    const thresholds = exp.name === 'basic+thr' ? thresholdsFor('basic+thr', tuned) : thresholdsFor(exp.name, tuned);
    scored.set(exp.name, { exp, rows: evaluate(raw, dataset, thresholds), raw });
  }
  return scored;
}

function main() {
  const dataset = loadDataset();
  const tuned = loadTuned();
  const scored = scoreAll(dataset, tuned);

  if (!scored.has('basic')) {
    console.error('No baseline results yet. Run: node eval/run.js --exp basic');
    process.exit(1);
  }

  if (untuned.length) {
    console.error(`
ERROR: no tuned thresholds for: ${untuned.join(', ')}. Run \`npm run eval:tune\` first; refusing to report with placeholder thresholds.`);
    process.exit(1);
  }

  const order = ['basic', 'basic+thr', ...EXPERIMENTS.filter((e) => e.name !== 'basic').map((e) => e.name)];
  const present = order.filter((n) => scored.has(n));
  const isTest = (r) => r.split === 'test';

  const out = [];
  const log = (s = '') => {
    console.log(s);
    out.push(s);
  };

  const testSummary = (name) => summarize(scored.get(name).rows, isTest);
  const baseSummary = testSummary('basic');
  const nAns = baseSummary.nAnswerable;

  log('# Retrieval evaluation results');
  log();
  log(
    `Held-out **test split**: ${baseSummary.n} questions (${nAns} answerable, ${baseSummary.nUnanswerable} unanswerable). ` +
      `Retrieval quality is measured over the answerable questions; abstention over all. ` +
      `Thresholds were tuned on the separate dev split. Values are percentages.`
  );
  log();

  // ---- Main ablation table
  log('## Ablation (test split)');
  log();
  const ablationRows = present.map((name) => {
    const s = testSummary(name);
    return [
      `${scored.get(name).exp.label}`,
      pct(s.recall3),
      pct(s.recall5),
      pct(s.mrr),
      pct(s.ndcg5),
      pct(s.hit1),
      pct(s.hit3),
      pct(s.precision5),
      pct(s.falseAnswer),
      pct(s.falseRefusal),
      s.avgLlmCalls.toFixed(2),
    ];
  });
  log(
    mdTable(
      ['Pipeline', 'Recall@3', 'Recall@5', 'MRR', 'nDCG@5', 'Hit@1', 'Hit@3', 'Precision@5', 'False-answer (unanswerable)', 'False-refusal', 'LLM calls/q'],
      ablationRows
    )
  );
  log();

  // ---- Paired comparison vs the frozen baseline
  log('## Improvement over the frozen baseline (test split, paired bootstrap 95% CI)');
  log();
  const metricDefs = [
    ['recall3', 'Recall@3'],
    ['recall5', 'Recall@5'],
    ['mrr', 'MRR'],
    ['ndcg5', 'nDCG@5'],
    ['hit1', 'Hit@1'],
    ['precision5', 'Precision@5'],
  ];
  const baseAnswerable = scored.get('basic').rows.filter((r) => isTest(r) && r.answerable);
  const baseById = new Map(baseAnswerable.map((r) => [r.id, r]));

  const compareRows = [];
  const comparisons = {};
  for (const name of present.filter((n) => n !== 'basic' && n !== 'basic-prod')) {
    const rows = scored.get(name).rows.filter((r) => isTest(r) && r.answerable);
    const cells = [scored.get(name).exp.label];
    comparisons[name] = {};
    for (const [key] of metricDefs) {
      const a = rows.map((r) => baseById.get(r.id)[key]);
      const b = rows.map((r) => r[key]);
      const res = pairedBootstrap(a, b);
      comparisons[name][key] = res;
      cells.push(
        res.rel === null
          ? 'n/a'
          : `${pct(res.meanA)} → ${pct(res.meanB)} (${signed(res.rel)}; CI ${signed(res.relLo)} to ${signed(res.relHi)})`
      );
    }
    compareRows.push(cells);
  }
  log(mdTable(['Pipeline', ...metricDefs.map((m) => m[1])], compareRows));
  log();

  // ---- Per-category breakdown, baseline vs production default
  const focus = ['basic', 'advanced'].filter((n) => scored.has(n));
  if (focus.length === 2) {
    log('## Per-category (test split): baseline vs production default');
    log();
    const categories = ['direct', 'paraphrase', 'keyword', 'multi', 'followup'];
    const catRows = categories.map((cat) => {
      const f = (name) => summarize(scored.get(name).rows, (r) => isTest(r) && r.category === cat);
      const a = f('basic');
      const b = f('advanced');
      return [cat, a.nAnswerable, `${pct(a.recall5)} → ${pct(b.recall5)}`, `${pct(a.mrr)} → ${pct(b.mrr)}`, `${pct(a.hit1)} → ${pct(b.hit1)}`];
    });
    log(mdTable(['Category', 'n', 'Recall@5', 'MRR', 'Hit@1'], catRows));
    log();
  }

  // ---- Context quality (what the LLM actually sees)
  log('## Context handed to the model (test split)');
  log();
  const ctxRows = present.map((name) => {
    const s = testSummary(name);
    return [scored.get(name).exp.label, pct(s.contextRecall), pct(s.contextPrecision), s.avgContextSize.toFixed(2), pct(s.decisionAccuracy)];
  });
  log(mdTable(['Pipeline', 'Context recall', 'Context precision', 'Avg chunks', 'Answer/refuse accuracy'], ctxRows));
  log();

  // ---- Dev vs test, to expose any tuning overfit
  log('## Dev vs test (Recall@5 / False-answer)');
  log();
  const devRows = present.map((name) => {
    const dev = summarize(scored.get(name).rows, (r) => r.split === 'dev');
    const test = testSummary(name);
    return [scored.get(name).exp.label, `${pct(dev.recall5)} / ${pct(dev.falseAnswer)}`, `${pct(test.recall5)} / ${pct(test.falseAnswer)}`];
  });
  log(mdTable(['Pipeline', 'Dev', 'Test'], devRows));
  log();

  // ---- Parity check
  if (scored.has('basic-prod')) {
    const a = scored.get('basic').raw.records;
    const bMap = new Map(scored.get('basic-prod').raw.records.map((r) => [r.id, r]));
    let same = 0;
    for (const rec of a) {
      const other = bMap.get(rec.id);
      const idsA = rec.ranked.map((r) => r.text).join('|');
      const idsB = other ? other.ranked.map((r) => r.text).join('|') : '';
      if (idsA === idsB) same += 1;
    }
    log('## Regression check');
    log();
    log(`The new pipeline code run with the basic preset returns the same top-5 chunks as the frozen original for ${same}/${a.length} questions.`);
    log();
  }

  // ---- Experiments with no valid result
  const missing = EXPERIMENTS.filter((e) => !scored.has(e.name));
  const pendingRuns = [];
  if (!fs.existsSync(path.join(RESULTS_DIR, 'e2e.json'))) {
    pendingRuns.push('`npm run eval:e2e` — end-to-end answers graded by an LLM judge (faithfulness, correctness, hallucination)');
  }
  if (!fs.existsSync(path.join(RESULTS_DIR, 'latency.json'))) {
    pendingRuns.push('`npm run eval:latency` — real uncached latency and LLM calls per question');
  }

  if (missing.length || pendingRuns.length) {
    log('## Implemented but not evaluated yet');
    log();
    log(
      'These are built, unit-tested and runnable, but have no valid result yet: each needs fresh embedding or LLM calls and ' +
        'the free-tier daily quotas (embeddings 1,000/day, generation 20-500/day per model) ran out before they could finish. ' +
        'The harness refuses to save a run that hit errors, so nothing partial is reported. Stages in this list stay **off** in ' +
        'the production default until measured.'
    );
    log();
    missing.forEach((e) => log(`- \`${e.name}\` — ${e.label}`));
    pendingRuns.forEach((r) => log(`- ${r}`));
    if (missing.length) {
      log();
      log('Resume after the quota resets: `npm run eval -- --exp ' + missing.map((e) => e.name).join(',') + '`, then `npm run eval:tune` and `npm run eval:report`.');
    }
    log();
  }

  // ---- End-to-end answer quality (LLM judge)
  const e2ePath = path.join(RESULTS_DIR, 'e2e.json');
  if (fs.existsSync(e2ePath)) {
    const e2e = JSON.parse(fs.readFileSync(e2ePath, 'utf8'));
    const b = e2e.summary.basic;
    const a = e2e.summary.advanced;
    log('## End-to-end answers (LLM judge, test split)');
    log();
    log(
      `Both pipelines retrieve, generate with their own prompt and are graded by an LLM judge (same provider as the generator, so ` +
        `read the **difference**, not the absolute values). ${e2e.summary.basic.n} questions.`
    );
    log();
    log(
      mdTable(
        ['Metric', 'Basic', 'Production default'],
        [
          ['Faithfulness (claims supported by the context given)', pct(b.faithfulness), pct(a.faithfulness)],
          ['Correctness on answerable questions', pct(b.correctnessAnswerable), pct(a.correctnessAnswerable)],
          ['Wrongly refused an answerable question', pct(b.refusedOnAnswerable), pct(a.refusedOnAnswerable)],
          ['Answered an unanswerable question (hallucination)', pct(b.hallucinatedOnUnanswerable), pct(a.hallucinatedOnUnanswerable)],
        ]
      )
    );
    log();
  }

  // ---- Latency / cost
  const latencyPath = path.join(RESULTS_DIR, 'latency.json');
  if (fs.existsSync(latencyPath)) {
    const latency = JSON.parse(fs.readFileSync(latencyPath, 'utf8'));
    log('## Retrieval latency and LLM cost (uncached, live providers)');
    log();
    log(
      mdTable(
        ['Pipeline', 'Questions', 'p50 ms', 'p95 ms', 'LLM calls / question'],
        latency.rows.map((r) => [r.label, r.n, Math.round(r.p50), Math.round(r.p95), r.llmCalls.toFixed(2)])
      )
    );
    log();
  }

  // ---- Failed questions
  const failed = [...scored.values()].filter((s) => s.rows.some((r) => r.failed));
  if (failed.length) {
    log('## Warnings');
    log();
    failed.forEach((s) => log(`- ${s.exp.name}: ${s.rows.filter((r) => r.failed).length} question(s) errored and were scored as misses.`));
    log();
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'RESULTS.md'), `${out.join('\n')}\n`);
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'results.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tuned,
        summaries: Object.fromEntries(present.map((n) => [n, { test: testSummary(n), all: summarize(scored.get(n).rows) }])),
        comparisons,
      },
      null,
      2
    )
  );
}

main();
