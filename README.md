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
| Embeddings | OpenAI `text-embedding-3-small`, or Google Gemini `text-embedding-004` |
| Chat generation | Anthropic Claude (default), OpenAI, or Google Gemini — switchable via env var |
| Vector retrieval | MongoDB Atlas Vector Search, with an in-memory cosine-similarity fallback that works on any MongoDB instance |

## How the RAG pipeline works

1. **Indexing lesson content** — When a tutor creates or edits a lesson, its text is split into ~800-character overlapping chunks (`server/src/utils/chunkText.js`), each embedded via the OpenAI embeddings API, and stored in the `LessonChunk` collection (`server/src/services/lessonIndexingService.js`).
2. **Indexing uploaded files** — When a tutor uploads a PDF or text/markdown file to a lesson, the text is extracted (`server/src/services/textExtractionService.js`), chunked, and embedded the same way — tagged with `source: 'attachment'` and the original filename, so the tutor can add reference material beyond hand-typed lesson text. Other file types (images, slides) are stored and downloadable but not indexed.
3. **Retrieval** — When a student asks the AI tutor a question, the question is embedded the same way, then the top-k most similar chunks *within that course* are retrieved (`server/src/services/retrievalService.js`) — across both lesson content and attachments. This runs against MongoDB Atlas Vector Search in production, or a brute-force cosine-similarity scan in local/dev environments — controlled by `VECTOR_SEARCH_MODE`, with no code changes required to switch.
4. **Grounded generation** — The retrieved chunks are passed to the LLM with an explicit instruction to answer only from the provided excerpts and to cite which excerpt(s) support the answer (`server/src/services/ragService.js`). If nothing relevant is found, the tutor says so instead of guessing.
5. **Transparency** — Every Q&A pair is stored in `ChatMessage` along with exactly which chunks were cited (including whether they came from a lesson or an uploaded file), so answers are auditable and retrieval quality can be evaluated later.

## Project structure

```
server/
  src/
    config/        MongoDB connection, multer + Cloudinary upload config
    models/        Mongoose schemas (User, Course, Lesson, LessonChunk, Enrollment, Quiz, QuizAttempt,
                   ChatMessage, Certificate, DiscussionPost)
    middleware/     JWT auth, role guard, express-validator error handling, error handling
    validators/     express-validator chains per resource
    services/       aiService (embeddings/streaming chat), retrievalService, ragService,
                    lessonIndexingService, textExtractionService, courseService, certificateService
    controllers/    route handlers per resource (incl. adminController, certificateController, discussionController)
    routes/         Express routers
    seed.js         demo data loader
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

The app degrades gracefully: courses, lessons, enrollment, progress tracking, quizzes, and file uploads all work with no AI keys set. Only the AI Tutor chat feature requires `GEMINI_API_KEY` — lesson/attachment creation won't fail without it, indexing is just skipped (with a logged warning) until the key is added, and the chat endpoint returns a clean "temporarily unavailable" message rather than leaking provider errors to students.

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
