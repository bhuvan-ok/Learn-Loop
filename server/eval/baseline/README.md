# Frozen baseline

This folder is a verbatim snapshot of the original ("basic") RAG pipeline from the
initial commit, kept so the evaluation always compares against the same thing no
matter how the production code evolves:

- `chunkText.js` — byte-for-byte copy of `src/utils/chunkText.js` at the initial commit
  (800-character paragraph packing, 150-character raw tail overlap).
- `pipeline.js` — the original indexing (plain `embedBatch`, no task types, no
  header) and retrieval (embed question, brute-force cosine over every chunk of the
  course, top 5, keep scores >= 0.15).

Do not edit these to "improve" the baseline. Improvements belong in `src/`.
