# Atlas Vector Search index

Only needed when `VECTOR_SEARCH_MODE=atlas`. In local mode (the default) the app does
exact cosine search in-process and needs no index.

Create a **Vector Search** index on the `lessonchunks` collection using
[`vector_index.json`](vector_index.json) (Atlas UI: *Search & Vector Search → Create
Search Index → Vector Search → JSON editor*; or `atlas clusters search indexes create`).

- `numDimensions` must match the embedding model: **3072** for Gemini
  `gemini-embedding-001` (default here), **1536** for OpenAI `text-embedding-3-small`.
- `course` is indexed as a filter so each query only searches one course.

Only the dense stage can run inside Atlas. BM25, rank fusion, reranking and MMR run
in the application over a cached per-course copy of the chunk text, so no Atlas Search
(`$search`) index is required.

> The Atlas path is code-complete but was **not** exercised by the evaluation, which ran
> against a local `mongod`. Atlas uses approximate nearest-neighbour search, so ranks can
> differ slightly from the exact local results reported in `eval/results/RESULTS.md`.
