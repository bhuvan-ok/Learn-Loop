const { streamChatCompletion } = require('./aiService');
const { retrieve } = require('./rag/pipeline');
const { extractCitedExcerpts, looksLikeRefusal } = require('./rag/citations');
const { getRagConfig } = require('../config/ragConfig');
const ChatMessage = require('../models/ChatMessage');

const SYSTEM_PROMPT = `You are an AI tutor embedded inside an online course.
Answer the student's question using ONLY the numbered course excerpts provided below.
Rules:
- If the excerpts do not contain enough information to answer, say so plainly instead of guessing.
- Never use outside knowledge beyond what is in the excerpts. The earlier conversation, if shown, is only for understanding what the student is referring to — never a source of facts.
- After each claim, cite the supporting excerpt(s) with bracketed tags like [E1] or [E2][E3].
- Keep the answer concise and directly address the question.`;

const NOT_FOUND_ANSWER =
  "I couldn't find anything in this course's material that answers that question. Try rephrasing, or ask about a topic covered in the lessons.";

const HISTORY_TURNS = 3;
const HISTORY_ANSWER_CHARS = 300;
const SNIPPET_CHARS = 600;

function describeSource(passage) {
  // contextHeader is "Lesson > Section > Subsection"; everything after the
  // first segment is the section path within the document.
  const sectionPath = (passage.contextHeader || '').split(' > ').slice(1).join(' > ');
  const section = sectionPath ? `, section "${sectionPath}"` : '';
  const page = passage.page ? `, page ${passage.page}` : '';

  if (passage.source === 'attachment' && passage.sourceLabel) {
    return `file "${passage.sourceLabel}" attached to lesson "${passage.lessonTitle}"${section}${page}`;
  }
  return `lesson "${passage.lessonTitle}"${section}`;
}

function buildUserPrompt({ question, passages, history = [] }) {
  const excerpts = passages
    .map((p, i) => `Excerpt E${i + 1} (from ${describeSource(p)}):\n${p.text}`)
    .join('\n\n');

  const conversation = history.length
    ? `Earlier conversation (for context only):\n${history
        .slice(-HISTORY_TURNS)
        .map((t) => `Student: ${t.question}\nTutor: ${String(t.answer || '').slice(0, HISTORY_ANSWER_CHARS)}`)
        .join('\n\n')}\n\n`
    : '';

  return `Course excerpts:\n${excerpts}\n\n${conversation}Student question: ${question}`;
}

// Streams the model's answer for the given passages. If some tokens already
// reached the student when the stream fails (or the student disconnects), the
// partial answer is kept with a note rather than discarded; if nothing was
// produced the error propagates.
async function generateAnswer({ question, passages, history = [], onToken = () => {}, signal }) {
  const userPrompt = buildUserPrompt({ question, passages, history });
  let answer = '';
  let interrupted = false;

  try {
    for await (const token of streamChatCompletion({ systemPrompt: SYSTEM_PROMPT, userPrompt, signal })) {
      answer += token;
      onToken(token);
    }
  } catch (err) {
    if (!answer) throw err;
    interrupted = true;
    const note = '\n\n[The response was interrupted before it finished.]';
    answer += note;
    onToken(note);
  }

  if (!answer) {
    answer = "I wasn't able to generate an answer for that question. Please try again shortly.";
    onToken(answer);
  }
  return { answer, interrupted };
}

function toCitation(passage, excerpt, inferred = false) {
  return {
    lesson: passage.lessonId,
    lessonTitle: passage.lessonTitle,
    chunkIndex: passage.chunkIndex,
    text: passage.text.slice(0, SNIPPET_CHARS),
    score: passage.score,
    source: passage.source,
    sourceLabel: passage.sourceLabel,
    excerpt,
    contextHeader: passage.contextHeader,
    page: passage.page,
    inferred,
  };
}

// Only passages the answer actually tagged are recorded as sources. If the
// model answered but forgot to tag anything, the single closest passage is
// attached and flagged `inferred` so the UI can say so; a refusal gets no
// source at all.
function buildCitations(answer, passages, interrupted) {
  const cited = extractCitedExcerpts(answer, passages.length);
  if (cited.length) return cited.map((n) => toCitation(passages[n - 1], n));
  if (interrupted || looksLikeRefusal(answer) || !passages.length) return [];
  return [toCitation(passages[0], 1, true)];
}

async function askTutor({
  courseId,
  studentId,
  question,
  history = [],
  onToken = () => {},
  signal,
  config = getRagConfig(),
}) {
  const retrieval = await retrieve({ courseId, question, history, config });
  const meta = {
    pipeline: config.name,
    standaloneQuestion: retrieval.trace.standaloneQuestion,
    retrievedCount: retrieval.ranked.length,
    abstained: retrieval.abstain,
    llmCalls: retrieval.trace.llmCalls,
    latencyMs: retrieval.trace.timingsMs.total,
  };

  if (retrieval.abstain) {
    onToken(NOT_FOUND_ANSWER);
    const saved = await ChatMessage.create({
      course: courseId,
      student: studentId,
      question,
      answer: NOT_FOUND_ANSWER,
      citedChunks: [],
      retrieval: meta,
    });
    return { answer: NOT_FOUND_ANSWER, citations: [], chatMessageId: saved._id };
  }

  const { answer, interrupted } = await generateAnswer({
    question,
    passages: retrieval.passages,
    history,
    onToken,
    signal,
  });

  const citations = buildCitations(answer, retrieval.passages, interrupted);
  const saved = await ChatMessage.create({
    course: courseId,
    student: studentId,
    question,
    answer,
    citedChunks: citations,
    retrieval: meta,
  });

  return { answer, citations, chatMessageId: saved._id };
}

module.exports = { askTutor, generateAnswer, buildUserPrompt, buildCitations, SYSTEM_PROMPT, NOT_FOUND_ANSWER };
