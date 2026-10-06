# RAG evaluation harness

Measures the retrieval pipeline against a frozen copy of the original ("basic") RAG, so
improvements are numbers with confidence intervals instead of impressions. Results are in
[`results/RESULTS.md`](results/RESULTS.md).

```bash
npm test                 # unit tests (no network, no database)
npm run eval:validate    # check every gold span exists verbatim in the corpus
npm run eval             # run all experiments (skips ones already done; --force to redo)
npm run eval:tune        # tune abstention thresholds on the DEV split
npm run eval:report      # write results/RESULTS.md + results.json
npm run eval:e2e         # end-to-end answers judged by an LLM (baseline vs production default)
npm run eval:latency     # real, uncached latency / LLM calls per question
```

## What is measured

**Corpus** (`corpus/`): 39 original lessons (~12k words) across JavaScript, HTTP/REST,
Node/Express and MongoDB, plus one lesson with a real PDF attachment (rendered from
`attachments/performance-handbook.md`, so it goes through the same `pdf-parse` extraction a
tutor's upload does). About a third of the lessons are deliberately adjacent to the
questions' topics (PUT vs PATCH, 401 vs 403, `var` vs `let`, HTTP caching vs Redis caching,
`explain` plans in two places) so retrieval has to discriminate, not just find the topic.
The corpus is synthetic: written for this evaluation.

**Dataset** (`dataset.jsonl`): 90 questions in six categories — `direct` (20, worded like the
source), `paraphrase` (20, deliberately different vocabulary), `keyword` (12, bare identifiers
and header names), `multi` (10, need two separate passages), `followup` (12, only make sense
with the preceding turn) and `unanswerable` (16, plausible but not covered; several sit next
to covered topics).

**Labels are evidence spans, not chunk IDs.** Each answerable question lists verbatim
sentences from the corpus. A retrieved chunk is a hit if it comes from the right lesson and
contains ≥80% of the span's word 3-grams. Because matching is by text, labels stay valid
however a pipeline chunks the documents. `npm run eval:validate` fails if any span is not
found verbatim.

**Splits.** Within each category, 2 of every 5 questions are `dev` (39 questions), the rest
`test` (51; 42 answerable). Abstention thresholds and weights are tuned on `dev` only;
headline numbers are reported on `test`.

**Metrics** (answerable questions unless noted; `ranked` = the final top-5 before any refusal
threshold): Recall@3/5 (fraction of evidence spans covered), MRR, nDCG@5 (one gain per
evidence span, so it cannot exceed 1), Hit@1/3, Precision@5. *Precision@5 is capped by the
number of evidence passages (a question with one gold span can score at most 0.2) so it is
reported but not used as a headline.* Abstention: false-answer rate (answered an unanswerable
question) and false-refusal rate (refused an answerable one). Context recall/precision are
measured on what is actually handed to the model after thresholding.

**Comparison.** Every row differs from the one above by a single change (cumulative
ablation). The baseline row runs the **frozen** original code in `baseline/`; a second row
runs the new pipeline code with the `basic` preset and must match it exactly (regression
check). Improvements come with a paired bootstrap 95% confidence interval over the same
questions.

## Reproducibility and integrity

- Runs in an isolated database: `EVAL_MONGO_URI` (default `mongodb://127.0.0.1:27017/lms_eval`).
  `eval/lib/db.js` refuses to run against anything that is not a local `lms_eval*` database,
  whatever `MONGO_URI` says, because every index variant drops and rebuilds it.
- Embeddings and LLM responses are cached on disk (`eval/.cache`, git-ignored), keyed by model,
  inputs and `AI_CACHE_SALT`, so reruns are fast and exactly reproducible. Delete the folder
  for a from-scratch run.
- **A run that had any error or silent LLM-stage fallback is not saved.** Rewrite, multi-query,
  HyDE and rerank all fall back to the plain pipeline if their LLM call fails (so a flaky
  provider can't break the tutor). In an evaluation that would quietly measure the fallback,
  so the runner counts fallbacks and discards the run instead of reporting it. This was
  added after exactly that happened once during development (free-tier quota errors).
- Abstention decisions are made offline from recorded scores using the production
  `applyThreshold`, so thresholds can be tuned and swept without re-running the LLM.

## Known limitations (read before quoting a number)

- **Small sample.** 42 answerable / 9 unanswerable test questions. Many individual
  improvements have confidence intervals that include zero; the intervals are in the report
  and are the honest measure of certainty.
- **Synthetic, fairly easy corpus.** 39 lessons / ~170 chunks, one author. The basic pipeline
  already reaches ~98% Recall@5, so there is little headroom there; gains show up in ranking
  (MRR, Hit@1), abstention and follow-ups. Larger or messier real courses may behave
  differently.
- **Hybrid (BM25) did not help here** — see the report. Dense embeddings already solve the
  keyword-style queries in this corpus, so BM25 only adds noise on paraphrased questions.
  This is a property of this corpus and embedding model, not a general claim.
- **LLM-driven stages depend on the utility model.** The evaluation used
  `gemini-3.1-flash-lite` (recorded in each raw result) because the main Gemini free-tier chat
  model allows only ~20 requests per day. Different models may rank differently.
- **The LLM judge in `eval:e2e` is from the same provider as the generator**, so absolute
  faithfulness/correctness numbers are indicative; the baseline-vs-new difference is the
  signal.
- **Not yet run:** `eval:e2e` (LLM-judged answer quality), `eval:latency` (uncached timings) and the
  `multiquery`, `hyde` and `contextual` experiments. All are implemented and runnable, but the Gemini
  free-tier daily quotas for this API key (embeddings 1,000/day; generation 20-500/day per model) were used
  up before they could finish, and the harness deliberately saves nothing from an errored run. Resume
  after the quota resets: `npm run eval -- --exp multiquery,hyde,contextual`, `npm run eval:tune`,
  `npm run eval:report`, then `npm run eval:e2e` and `npm run eval:latency`.
- Latency in the main report is not meaningful (responses are cached); use `eval:latency`.
- The Atlas Vector Search path is not exercised here (local `mongod`, exact search).
