# LearnLoop — LMS with a RAG-Powered AI Tutor

A full-stack Learning Management System (courses, lessons, enrollments, progress tracking, quizzes) with three roles (admin, tutor, student) and an AI tutor chat feature grounded in each course's own content — including uploaded files — using Retrieval-Augmented Generation (RAG). The tutor only answers from indexed material and cites exactly where it pulled from, instead of relying on the LLM's general knowledge, and streams its answer back token-by-token over Server-Sent Events instead of making students wait for the full response. Students also earn a downloadable PDF certificate on course completion and can discuss each lesson with peers and tutors in a per-lesson Q&A thread.

## Why this project exists

Most student LMS projects are pure CRUD. Most "AI chatbot" projects are a thin UI wrapper around an LLM with no real backend behind it. This project pairs a genuinely relational domain model (courses → lessons → enrollments → progress, quizzes → attempts → scoring), role-based access control across three distinct user types, file upload handling, and a properly engineered retrieval pipeline (chunking → embeddings → similarity search → grounded generation → citations) — demonstrating full-stack fundamentals and applied RAG in one system.

## Roles

| Role | Capabilities |
|---|---|
| **Student** | Browse/enroll in courses, track progress, take quizzes, ask the AI tutor questions, discuss lessons with peers/tutors, download a certificate on course completion |
| **Tutor** | Everything a student's course page needs to exist: create/edit/publish courses, add lessons and quizzes, upload lesson attachments (PDF/text/images), answer/moderate lesson discussions |
| **Admin** | Everything a tutor can do on their own courses, plus platform-wide oversight: view stats, manage any user's role, publish/unpublish or delete *any* course regardless of author |

Admin accounts cannot be created through public registration (`POST /api/auth/register` only allows `student`/`tutor`) — the first admin must be promoted directly in the database (see `server/src/seed.js`) or by an existing admin via the Admin Panel's role dropdown. This keeps privilege escalation out of the public API surface.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 (Vite), React Router, Tailwind CSS, Axios |
| Backend | Node.js, Express, express-validator |
| Database | MongoDB (Mongoose) |
| File uploads | Multer (in-memory) → Cloudinary, `pdf-parse` for PDF text extraction |
| Auth | JWT + bcrypt, role-based access control (admin / tutor / student) |
| Embeddings | Google Gemini `gemini-embedding-001` (default), or OpenAI `text-embedding-3-small` |
| Chat generation | Anthropic Claude (default), OpenAI, or Google Gemini — switchable via env var |
| Retrieval | Hybrid dense + BM25 candidate generation fused with Reciprocal Rank Fusion, LLM reranking, MMR; dense search runs on MongoDB Atlas Vector Search or exact in-process cosine (works on any MongoDB) |

## How the RAG pipeline works

The pipeline is configured by a named preset (`RAG_PIPELINE`, see `server/src/config/ragConfig.js`). `advanced` is the default; `basic` is the original dense-only pipeline, kept as a kill switch and as the frozen baseline the evaluation compares against.

**Indexing** (when a lesson is saved or a file is uploaded — `lessonIndexingService.js`)
1. **Structure-aware chunking** (`utils/structuredChunker.js`) — text is split on markdown headings and on sentence boundaries (abbreviation-aware), code blocks stay whole, overlap is whole sentences, and chunks never straddle a section. PDFs are extracted page by page, so chunks carry a page number and plain-text headings (`1. Pagination`) are detected.
2. **Contextual headers** — the text that is embedded (and BM25-indexed) is prefixed with `Lesson > Section`, so a passage like "This is why `.then()` always runs first" still carries its subject. The stored/cited passage stays clean.
3. **Asymmetric embeddings** — chunks are embedded as `RETRIEVAL_DOCUMENT` and questions as `RETRIEVAL_QUERY` (Gemini task types).
4. **Safe re-indexing** — new chunks are embedded first and inserted before the old ones are deleted, so a failed embedding never leaves a lesson with no index. Chunks are tagged with an `indexVersion`; retrieval warns when a course mixes versions, and `npm run reindex` rebuilds them.

**Answering a question** (`services/rag/pipeline.js`, `ragService.js`)
1. **Query rewrite** — a follow-up like "what about PATCH?" is rewritten into a standalone question using the last three turns (skipped when there is no history).
2. **Hybrid candidates** — dense similarity (Atlas `$vectorSearch` or exact local cosine) and an in-process BM25 index (Porter-stemmed, cached per course) each return 20 candidates, merged with Reciprocal Rank Fusion.
3. **LLM rerank + MMR** — one listwise LLM call scores every candidate 0–10 for the question; near-duplicates are removed with Maximal Marginal Relevance.
4. **Calibrated abstention** — the reranker's score decides whether the course covers the question at all (and drops weak chunks), replacing the original fixed cosine cut-off of 0.15, which never refused anything. Thresholds are tuned on a held-out dev split.
5. **Small-to-big context** — each hit is expanded with its neighbouring chunks (overlap removed) before generation.
6. **Grounded generation with real citations** — excerpts are labelled `[E1]…`; the model tags the claims they support and the server saves only the excerpts the answer actually cited (with page and snippet) instead of recording every retrieved chunk. If the client disconnects, generation is cancelled upstream.
7. **Transparency** — each `ChatMessage` stores the cited passages plus retrieval metadata (standalone question, number of LLM calls, latency, whether it abstained).

Optional stages that are implemented and unit-tested but **not enabled by default** because they have not been measured yet: multi-query expansion, HyDE (gated on a weak first pass), and LLM-written context notes per chunk ("contextual retrieval"). See the evaluation notes below.

## Evaluating retrieval quality

`server/eval/` measures the pipeline against a **frozen copy of the original RAG** on a hand-labelled set of 90 questions over a 39-lesson corpus (plus a PDF), with a held-out test split, paired-bootstrap confidence intervals and a cumulative ablation. Run `npm run eval:validate`, `npm run eval`, `npm run eval:report` in `server/`; methodology and caveats are in [`server/eval/README.md`](server/eval/README.md), full tables in [`server/eval/results/RESULTS.md`](server/eval/results/RESULTS.md).

Held-out test split (51 questions: 42 answerable, 9 not covered by the course), original RAG → current default:

| Metric | Original | Current | Change (95% CI) |
|---|---|---|---|
| MRR | 88.3 | 96.0 | +8.8% (−0.4% to +20.3%) |
| nDCG@5 | 87.9 | 95.4 | +8.5% (+0.7% to +18.6%) |
| Hit@1 | 81.0 | 92.9 | +14.7% (0.0% to +35.7%) |
| Recall@5 | 97.6 | 100.0 | +2.4% (0.0% to +7.7%) |
| Precision of the context given to the LLM | 25.7 | 79.8 | — |
| Chunks kept as context per question (before neighbour expansion) | 5.0 | 1.7 | — |
| Out-of-scope questions answered anyway | 100% | 0% | — |
| In-scope questions wrongly refused | 0% | 0% | — |

Honest reading of these numbers:
- **Follow-up questions improved most** (MRR 63.9 → 91.7 on the test split) because the original embedded "what about PATCH?" with no context.
- **The original already scored ~98% Recall@5** on this small corpus, so there is little recall to win; gains are in *ranking*, in sending the model less noise, and in refusing questions the course doesn't cover. A baseline that merely tuned its cut-off to refuse unanswerable questions would have wrongly refused 31% of answerable ones.
- **Hybrid (BM25) retrieval did not help here.** Dense embeddings already solve the keyword-style queries in this corpus, and BM25 alone is much weaker (MRR 76.8); with equal-weight fusion it *lowered* MRR (94.0 → 88.2). It is kept only in combination with the reranker, where it is neutral on this data, and as a lexical safety net for identifier-heavy real content. This is a property of this corpus and embedding model, not a general claim about hybrid search.
- **Confidence intervals are wide** (42 answerable test questions); several individual stage gains include zero. One `multi`-passage question and one caching paraphrase got worse.
- The corpus is synthetic and the LLM-driven stages were evaluated with `gemini-3.1-flash-lite`.

## Project structure

```
server/
  src/
    config/        MongoDB connection, multer + Cloudinary upload config
    models/        Mongoose schemas (User, Course, Lesson, LessonChunk, Enrollment, Quiz, QuizAttempt,
                   ChatMessage, Certificate, DiscussionPost)
    middleware/     JWT auth, role guard, express-validator error handling, error handling
    validators/     express-validator chains per resource
    services/       aiService (embeddings/streaming chat/utility LLM calls, retries, optional response cache),
                    ragService (prompting, citations), retrievalService (dense search),
                    rag/ (pipeline, BM25, rank fusion + MMR, query rewrite, reranker, thresholds, citations,
                    per-course index cache), lessonIndexingService, textExtractionService, courseService,
                    certificateService
    scripts/        reindex.js (rebuild the RAG index under the active pipeline settings)
    controllers/    route handlers per resource (incl. adminController, certificateController, discussionController)
    routes/         Express routers
    seed.js         demo data loader
  tests/           node:test unit tests (npm test) — chunker, BM25, fusion, citations, pipeline stages, eval metrics
  eval/            RAG evaluation harness: corpus, labelled dataset, frozen baseline, runner, report
  atlas/           Atlas Vector Search index definition
client/
  src/
    context/       AuthContext (JWT session state)
    api/           axios client
    components/    Navbar, role-based route guards, AITutorChat, LessonDiscussion
    pages/         Login, Register, CourseCatalog, CourseDetail, LessonViewer, QuizAttemptPage,
                   StudentDashboard, TutorDashboard, TutorCourseEditor, AdminDashboard
```

## Setup

### Prerequisites
- Node.js 18+
- A MongoDB instance (local `mongod`, or a free MongoDB Atlas cluster)
- A Google Gemini API key (free, no billing required — https://aistudio.google.com/apikey), required for the AI tutor (embeddings + chat). OpenAI and Anthropic are also supported via `LLM_PROVIDER` — see `server/src/services/aiService.js`.

### Backend

```bash
cd server
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, GEMINI_API_KEY
npm run seed           # creates demo admin/tutor/student accounts + a sample course
npm run dev
```

Demo accounts created by `npm run seed`:
- Admin: `admin@demo.com` / `password123`
- Tutor: `tutor@demo.com` / `password123`
- Student: `student@demo.com` / `password123`

### Frontend

```bash
cd client
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:5000/api
npm run dev
```

Visit `http://localhost:5173`.

### Running without AI keys configured

The app degrades gracefully: courses, lessons, enrollment, progress tracking, quizzes, and file uploads all work with no AI keys set. Only the AI Tutor feature requires an embeddings key — lesson/attachment creation won't fail without it, indexing is just skipped (loudly logged, since with no chunks indexed the tutor has nothing to answer from) until a key is added, and the chat endpoint returns a clean "temporarily unavailable" message rather than leaking provider errors to students.

**Embeddings specifically require `GEMINI_API_KEY` or `OPENAI_API_KEY`, regardless of `LLM_PROVIDER`.** `LLM_PROVIDER` only selects which model generates the tutor's chat *answers* (Anthropic/OpenAI/Gemini); embeddings (used for indexing lesson/attachment content and for retrieval when a student asks a question) are only available from OpenAI or Google Gemini — **Anthropic has no embeddings API**. So `LLM_PROVIDER=anthropic` (the default when unset) with only `ANTHROPIC_API_KEY` set will index nothing and the AI tutor will never find any content. Set `GEMINI_API_KEY` (free, no billing — https://aistudio.google.com/apikey) or `OPENAI_API_KEY` in addition to whichever key `LLM_PROVIDER` needs for chat. The server logs a warning at startup if neither is set, and `aiService.js` throws a clear error at indexing time explaining the same thing.

## Notable engineering decisions

- **Pluggable vector retrieval backend** — `VECTOR_SEARCH_MODE=local` lets the whole project run on a free/local MongoDB with no Atlas account, while `atlas` switches to a real `$vectorSearch` aggregation for production-scale retrieval, with automatic fallback if the Atlas index isn't configured.
- **Provider-agnostic LLM calls** — `aiService.js` abstracts chat completion behind one function so switching between Anthropic and OpenAI is a single env var, not a code change.
- **Independent content vs. attachment indexing** — editing a lesson's text only re-chunks/re-embeds its own content (`source: 'content'`); it never wipes out chunks derived from uploaded files (`source: 'attachment'`), so tutors can freely edit lesson text without losing a file's indexed knowledge.
- **Storage-agnostic uploads** — attachments are streamed to Cloudinary via `server/src/config/upload.js`; everything downstream (metadata, RAG indexing, cascade delete) works against that abstraction, not the storage engine directly, so swapping providers again would only touch that one file.
- **Centralized authorization** — `canManageCourse()` (`server/src/utils/permissions.js`) is the single source of truth for "can this user touch this course," used identically by course, lesson, quiz, and attachment endpoints — admins bypass ownership, tutors are restricted to courses they authored.
- **No public admin escalation** — registration is hard-restricted to `student`/`tutor` at the validator level; admin role changes require an existing admin and cannot target yourself (prevents accidental self-lockout).
- **Grounded, citable answers** — the system prompt forces the model to refuse to answer when retrieval comes back empty or low-relevance, rather than falling back to hallucinated general knowledge, and every citation states whether it came from lesson text or a specific uploaded file.
- **Cascade-safe deletes** — deleting a course or lesson also removes its RAG chunks, quiz attempts, enrollments, chat history, and any uploaded files from Cloudinary — no orphaned data or dangling files.
- **Streaming tutor responses** — the chat endpoint streams the answer as Server-Sent Events (`text/event-stream`) as it's generated by the LLM, rather than blocking until the full response is ready; the frontend renders tokens as they arrive and attaches citations once the stream completes.
- **Certificates issued idempotently** — a `Certificate` is upserted the moment a student's `progressPercent` hits 100, generated on demand as a PDF (via PDFKit, no disk storage) rather than pre-rendered and stored.
- **Discussion permissions reuse `canManageCourse`** — the same rule that lets a course's tutor (or any admin) manage the course also lets them moderate its lesson discussions, alongside each post's own author; the server computes a `canDelete` flag per post so the client never re-implements authorization logic.
