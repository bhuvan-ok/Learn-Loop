# Retrieval evaluation results

Held-out **test split**: 51 questions (42 answerable, 9 unanswerable). Retrieval quality is measured over the answerable questions; abstention over all. Thresholds were tuned on the separate dev split. Values are percentages.

## Ablation (test split)

| Pipeline | Recall@3 | Recall@5 | MRR | nDCG@5 | Hit@1 | Hit@3 | Precision@5 | False-answer (unanswerable) | False-refusal | LLM calls/q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Basic RAG (frozen original) | 95.2 | 97.6 | 88.3 | 87.9 | 81.0 | 95.2 | 25.7 | 100.0 | 0.0 | 0.00 |
| Basic + tuned abstention threshold | 95.2 | 97.6 | 88.3 | 87.9 | 81.0 | 95.2 | 25.7 | 11.1 | 31.0 | 0.00 |
| Basic via new pipeline (parity check) | 95.2 | 97.6 | 88.3 | 87.9 | 81.0 | 95.2 | 25.7 | 100.0 | 0.0 | 0.00 |
| + structure-aware chunking | 95.2 | 97.6 | 93.5 | 92.7 | 90.5 | 95.2 | 22.4 | 22.2 | 21.4 | 0.00 |
| + contextual header | 97.6 | 100.0 | 93.5 | 93.1 | 88.1 | 97.6 | 22.9 | 22.2 | 11.9 | 0.00 |
| + query/document task types | 95.2 | 100.0 | 94.0 | 93.7 | 90.5 | 95.2 | 22.9 | 22.2 | 2.4 | 0.00 |
| + hybrid BM25 + dense (RRF) | 95.2 | 97.6 | 88.2 | 88.9 | 81.0 | 95.2 | 22.4 | 22.2 | 2.4 | 0.00 |
| + hybrid, BM25 weight 0.5 | 95.2 | 97.6 | 91.1 | 90.7 | 85.7 | 95.2 | 22.4 | 22.2 | 2.4 | 0.00 |
| + hybrid, BM25 weight 0.25 | 95.2 | 97.6 | 91.9 | 91.5 | 88.1 | 95.2 | 22.4 | 22.2 | 2.4 | 0.00 |
| Diagnostic: BM25 alone | 84.5 | 88.1 | 76.8 | 78.1 | 69.0 | 85.7 | 20.5 | 22.2 | 7.1 | 0.00 |
| + conversational query rewrite | 95.2 | 97.6 | 89.4 | 89.8 | 83.3 | 95.2 | 22.4 | 22.2 | 2.4 | 0.12 |
| + LLM rerank + MMR (from rewrite) | 100.0 | 100.0 | 96.0 | 95.4 | 92.9 | 100.0 | 22.9 | 0.0 | 0.0 | 1.12 |
| Rerank on dense-only candidates (no BM25) | 98.8 | 98.8 | 97.2 | 95.2 | 95.2 | 100.0 | 22.4 | 0.0 | 0.0 | 1.12 |
| Production default (advanced) | 100.0 | 100.0 | 96.0 | 95.4 | 92.9 | 100.0 | 22.9 | 0.0 | 0.0 | 1.12 |

## Improvement over the frozen baseline (test split, paired bootstrap 95% CI)

| Pipeline | Recall@3 | Recall@5 | MRR | nDCG@5 | Hit@1 | Precision@5 |
| --- | --- | --- | --- | --- | --- | --- |
| Basic + tuned abstention threshold | 95.2 → 95.2 (+0.0%; CI +0.0% to +0.0%) | 97.6 → 97.6 (+0.0%; CI +0.0% to +0.0%) | 88.3 → 88.3 (+0.0%; CI +0.0% to +0.0%) | 87.9 → 87.9 (+0.0%; CI +0.0% to +0.0%) | 81.0 → 81.0 (+0.0%; CI +0.0% to +0.0%) | 25.7 → 25.7 (+0.0%; CI +0.0% to +0.0%) |
| + structure-aware chunking | 95.2 → 95.2 (+0.0%; CI -9.8% to +10.8%) | 97.6 → 97.6 (+0.0%; CI -7.1% to +7.7%) | 88.3 → 93.5 (+5.8%; CI -3.2% to +15.7%) | 87.9 → 92.7 (+5.4%; CI -3.0% to +14.4%) | 81.0 → 90.5 (+11.8%; CI -2.8% to +31.0%) | 25.7 → 22.4 (-13.0%; CI -24.1% to +0.0%) |
| + contextual header | 95.2 → 97.6 (+2.5%; CI -4.9% to +10.8%) | 97.6 → 100.0 (+2.4%; CI +0.0% to +7.7%) | 88.3 → 93.5 (+5.8%; CI -2.6% to +15.3%) | 87.9 → 93.1 (+5.9%; CI -0.9% to +14.1%) | 81.0 → 88.1 (+8.8%; CI -5.6% to +26.7%) | 25.7 → 22.9 (-11.1%; CI -21.3% to +2.1%) |
| + query/document task types | 95.2 → 95.2 (+0.0%; CI -7.3% to +7.9%) | 97.6 → 100.0 (+2.4%; CI +0.0% to +7.7%) | 88.3 → 94.0 (+6.5%; CI -2.2% to +17.8%) | 87.9 → 93.7 (+6.6%; CI -0.9% to +16.5%) | 81.0 → 90.5 (+11.8%; CI -2.9% to +32.3%) | 25.7 → 22.9 (-11.1%; CI -21.3% to +2.1%) |
| + hybrid BM25 + dense (RRF) | 95.2 → 95.2 (+0.0%; CI -9.8% to +10.5%) | 97.6 → 97.6 (+0.0%; CI -7.1% to +7.7%) | 88.3 → 88.2 (-0.1%; CI -11.3% to +12.4%) | 87.9 → 88.9 (+1.1%; CI -8.5% to +12.6%) | 81.0 → 81.0 (+0.0%; CI -18.4% to +21.9%) | 25.7 → 22.4 (-13.0%; CI -23.3% to +0.0%) |
| + hybrid, BM25 weight 0.5 | 95.2 → 95.2 (+0.0%; CI -9.8% to +10.5%) | 97.6 → 97.6 (+0.0%; CI -7.1% to +7.7%) | 88.3 → 91.1 (+3.1%; CI -7.2% to +15.9%) | 87.9 → 90.7 (+3.2%; CI -6.1% to +14.7%) | 81.0 → 85.7 (+5.9%; CI -10.5% to +27.6%) | 25.7 → 22.4 (-13.0%; CI -23.3% to +0.0%) |
| + hybrid, BM25 weight 0.25 | 95.2 → 95.2 (+0.0%; CI -9.8% to +10.5%) | 97.6 → 97.6 (+0.0%; CI -7.1% to +7.7%) | 88.3 → 91.9 (+4.0%; CI -6.3% to +16.2%) | 87.9 → 91.5 (+4.0%; CI -5.3% to +15.2%) | 81.0 → 88.1 (+8.8%; CI -7.7% to +30.0%) | 25.7 → 22.4 (-13.0%; CI -23.3% to +0.0%) |
| Diagnostic: BM25 alone | 95.2 → 84.5 (-11.2%; CI -22.2% to -2.5%) | 97.6 → 88.1 (-9.8%; CI -19.5% to -2.4%) | 88.3 → 76.8 (-13.0%; CI -25.7% to -0.9%) | 87.9 → 78.1 (-11.1%; CI -22.7% to -0.6%) | 81.0 → 69.0 (-14.7%; CI -33.3% to +6.7%) | 25.7 → 20.5 (-20.4%; CI -32.7% to -6.8%) |
| + conversational query rewrite | 95.2 → 95.2 (+0.0%; CI -9.8% to +10.5%) | 97.6 → 97.6 (+0.0%; CI -7.1% to +7.7%) | 88.3 → 89.4 (+1.2%; CI -9.7% to +13.5%) | 87.9 → 89.8 (+2.1%; CI -7.4% to +13.2%) | 81.0 → 83.3 (+2.9%; CI -14.3% to +24.1%) | 25.7 → 22.4 (-13.0%; CI -23.3% to +0.0%) |
| + LLM rerank + MMR (from rewrite) | 95.2 → 100.0 (+5.0%; CI +0.0% to +13.5%) | 97.6 → 100.0 (+2.4%; CI +0.0% to +7.7%) | 88.3 → 96.0 (+8.8%; CI -0.4% to +20.3%) | 87.9 → 95.4 (+8.5%; CI +0.7% to +18.6%) | 81.0 → 92.9 (+14.7%; CI +0.0% to +35.7%) | 25.7 → 22.9 (-11.1%; CI -21.3% to +2.1%) |
| Rerank on dense-only candidates (no BM25) | 95.2 → 98.8 (+3.8%; CI -2.4% to +13.5%) | 97.6 → 98.8 (+1.2%; CI -3.6% to +7.7%) | 88.3 → 97.2 (+10.1%; CI +1.2% to +21.4%) | 87.9 → 95.2 (+8.2%; CI +0.5% to +18.4%) | 81.0 → 95.2 (+17.6%; CI +2.6% to +37.9%) | 25.7 → 22.4 (-13.0%; CI -25.4% to +2.0%) |
| Production default (advanced) | 95.2 → 100.0 (+5.0%; CI +0.0% to +13.5%) | 97.6 → 100.0 (+2.4%; CI +0.0% to +7.7%) | 88.3 → 96.0 (+8.8%; CI -0.4% to +20.3%) | 87.9 → 95.4 (+8.5%; CI +0.7% to +18.6%) | 81.0 → 92.9 (+14.7%; CI +0.0% to +35.7%) | 25.7 → 22.9 (-11.1%; CI -21.3% to +2.1%) |

## Per-category (test split): baseline vs production default

| Category | n | Recall@5 | MRR | Hit@1 |
| --- | --- | --- | --- | --- |
| direct | 12 | 100.0 → 100.0 | 95.8 → 100.0 | 91.7 → 100.0 |
| paraphrase | 12 | 100.0 → 100.0 | 89.6 → 94.4 | 83.3 → 91.7 |
| keyword | 6 | 100.0 → 100.0 | 83.3 → 100.0 | 66.7 → 100.0 |
| multi | 6 | 100.0 → 100.0 | 100.0 → 91.7 | 100.0 → 83.3 |
| followup | 6 | 83.3 → 100.0 | 63.9 → 91.7 | 50.0 → 83.3 |

## Context handed to the model (test split)

| Pipeline | Context recall | Context precision | Avg chunks | Answer/refuse accuracy |
| --- | --- | --- | --- | --- |
| Basic RAG (frozen original) | 97.6 | 25.7 | 5.00 | 82.4 |
| Basic + tuned abstention threshold | 69.0 | 60.9 | 1.76 | 72.5 |
| Basic via new pipeline (parity check) | 97.6 | 25.7 | 5.00 | 82.4 |
| + structure-aware chunking | 76.2 | 65.1 | 1.69 | 78.4 |
| + contextual header | 82.1 | 57.6 | 2.02 | 86.3 |
| + query/document task types | 97.6 | 52.2 | 2.74 | 94.1 |
| + hybrid BM25 + dense (RRF) | 95.2 | 57.8 | 2.31 | 94.1 |
| + hybrid, BM25 weight 0.5 | 95.2 | 57.7 | 2.33 | 94.1 |
| + hybrid, BM25 weight 0.25 | 95.2 | 57.7 | 2.33 | 94.1 |
| Diagnostic: BM25 alone | 88.1 | 65.4 | 1.86 | 90.2 |
| + conversational query rewrite | 95.2 | 60.0 | 2.21 | 94.1 |
| + LLM rerank + MMR (from rewrite) | 100.0 | 79.8 | 1.67 | 100.0 |
| Rerank on dense-only candidates (no BM25) | 98.8 | 75.9 | 1.79 | 100.0 |
| Production default (advanced) | 100.0 | 79.8 | 1.67 | 100.0 |

## Dev vs test (Recall@5 / False-answer)

| Pipeline | Dev | Test |
| --- | --- | --- |
| Basic RAG (frozen original) | 96.9 / 100.0 | 97.6 / 100.0 |
| Basic + tuned abstention threshold | 96.9 / 0.0 | 97.6 / 11.1 |
| Basic via new pipeline (parity check) | 96.9 / 100.0 | 97.6 / 100.0 |
| + structure-aware chunking | 100.0 / 0.0 | 97.6 / 22.2 |
| + contextual header | 100.0 / 0.0 | 100.0 / 22.2 |
| + query/document task types | 100.0 / 0.0 | 100.0 / 22.2 |
| + hybrid BM25 + dense (RRF) | 100.0 / 0.0 | 97.6 / 22.2 |
| + hybrid, BM25 weight 0.5 | 100.0 / 0.0 | 97.6 / 22.2 |
| + hybrid, BM25 weight 0.25 | 100.0 / 0.0 | 97.6 / 22.2 |
| Diagnostic: BM25 alone | 100.0 / 0.0 | 88.1 / 22.2 |
| + conversational query rewrite | 100.0 / 0.0 | 97.6 / 22.2 |
| + LLM rerank + MMR (from rewrite) | 100.0 / 0.0 | 100.0 / 0.0 |
| Rerank on dense-only candidates (no BM25) | 100.0 / 0.0 | 98.8 / 0.0 |
| Production default (advanced) | 100.0 / 0.0 | 100.0 / 0.0 |

## Regression check

The new pipeline code run with the basic preset returns the same top-5 chunks as the frozen original for 90/90 questions.

## Implemented but not evaluated yet

These are built, unit-tested and runnable, but have no valid result yet: each needs fresh embedding or LLM calls and the free-tier daily quotas (embeddings 1,000/day, generation 20-500/day per model) ran out before they could finish. The harness refuses to save a run that hit errors, so nothing partial is reported. Stages in this list stay **off** in the production default until measured.

- `multiquery` — + multi-query expansion
- `hyde` — + HyDE (gated)
- `contextual` — + LLM contextual chunk notes
- `npm run eval:e2e` — end-to-end answers graded by an LLM judge (faithfulness, correctness, hallucination)
- `npm run eval:latency` — real uncached latency and LLM calls per question

Resume after the quota resets: `npm run eval -- --exp multiquery,hyde,contextual`, then `npm run eval:tune` and `npm run eval:report`.

