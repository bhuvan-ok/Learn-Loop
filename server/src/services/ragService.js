const { embedText, streamChatCompletion } = require('./aiService');
const { retrieveRelevantChunks } = require('./retrievalService');
const ChatMessage = require('../models/ChatMessage');

const MIN_RELEVANCE_SCORE = 0.15;
const TOP_K = 5;

const SYSTEM_PROMPT = `You are an AI tutor embedded inside an online course.
Answer the student's question using ONLY the numbered course excerpts provided below.
Rules:
- If the excerpts do not contain enough information to answer, say so plainly instead of guessing.
- Never use outside knowledge beyond what is in the excerpts.
- Reference which excerpt number(s) support each part of your answer, e.g. "(Excerpt 2)".
- Keep the answer concise and directly address the question.`;

function describeSource(chunk) {
  const lessonTitle = chunk.lesson?.title || 'Unknown lesson';
  if (chunk.source === 'attachment' && chunk.sourceLabel) {
    return `file "${chunk.sourceLabel}" attached to lesson "${lessonTitle}"`;
  }
  return `lesson "${lessonTitle}"`;
}

function buildUserPrompt(question, chunks) {
  const excerpts = chunks
    .map((c, i) => `Excerpt ${i + 1} (from ${describeSource(c.chunk)}):\n${c.chunk.text}`)
    .join('\n\n');

  return `Course excerpts:\n${excerpts}\n\nStudent question: ${question}`;
}

async function askTutor({ courseId, studentId, question, onToken = () => {} }) {
  const questionEmbedding = await embedText(question);
  const retrieved = await retrieveRelevantChunks(courseId, questionEmbedding, TOP_K);
  const relevant = retrieved.filter((r) => r.score >= MIN_RELEVANCE_SCORE);

  if (!relevant.length) {
    const answer =
      "I couldn't find anything in this course's material that answers that question. Try rephrasing, or ask about a topic covered in the lessons.";
    onToken(answer);
    const saved = await ChatMessage.create({
      course: courseId,
      student: studentId,
      question,
      answer,
      citedChunks: [],
    });
    return { answer, citations: [], chatMessageId: saved._id };
  }

  const userPrompt = buildUserPrompt(question, relevant);
  let answer = '';
  try {
    for await (const token of streamChatCompletion({ systemPrompt: SYSTEM_PROMPT, userPrompt })) {
      answer += token;
      onToken(token);
    }
  } catch (err) {
    // If nothing streamed yet, there's nothing worth keeping — let the
    // caller's catch block handle it exactly as before (clean error, no
    // ChatMessage saved). If some tokens already reached the student, save
    // what they saw rather than silently discarding it and leaving a gap in
    // their chat history.
    if (!answer) throw err;
    const note = '\n\n[The response was interrupted before it finished.]';
    answer += note;
    onToken(note);
  }

  if (!answer) {
    answer =
      "I wasn't able to generate an answer for that question. Please try again shortly.";
    onToken(answer);
  }

  const citedChunks = relevant.map((r) => ({
    lesson: r.chunk.lesson?._id || r.chunk.lesson,
    lessonTitle: r.chunk.lesson?.title || 'Unknown',
    chunkIndex: r.chunk.chunkIndex,
    text: r.chunk.text,
    score: r.score,
    source: r.chunk.source || 'content',
    sourceLabel: r.chunk.sourceLabel || '',
  }));

  const saved = await ChatMessage.create({
    course: courseId,
    student: studentId,
    question,
    answer,
    citedChunks,
  });

  return { answer, citations: citedChunks, chatMessageId: saved._id };
}

module.exports = { askTutor };
