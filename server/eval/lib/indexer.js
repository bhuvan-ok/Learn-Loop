const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Course = require('../../src/models/Course');
const Lesson = require('../../src/models/Lesson');
const LessonChunk = require('../../src/models/LessonChunk');
const { indexLesson, indexAttachmentText } = require('../../src/services/lessonIndexingService');
const { extractPages } = require('../../src/services/textExtractionService');
const { indexLessonBaseline, indexAttachmentBaseline } = require('../baseline/pipeline');
const { buildHandbookPdf } = require('../corpus/build-pdf');
const { loadLessons } = require('./corpus');
const { resetEvalDb } = require('./db');

const CACHE_DIR = path.join(__dirname, '..', '.cache');

async function pdfBuffer() {
  const file = path.join(CACHE_DIR, 'performance-handbook.pdf');
  if (!fs.existsSync(file)) await buildHandbookPdf(file);
  return fs.readFileSync(file);
}

// The original extraction path: pdf-parse's concatenated text.
async function extractTextOriginal(buffer) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

// Rebuilds the eval database from the corpus using either the frozen original
// indexing or the production indexing service under `config`. Returns what the
// runner needs to translate chunk documents back to corpus slugs.
async function buildIndexVariant({ frozen, config }) {
  await resetEvalDb();
  const started = Date.now();

  const course = await Course.create({
    title: 'Backend & JavaScript Fundamentals (eval)',
    description: 'Evaluation corpus',
    tutor: new mongoose.Types.ObjectId(),
    published: true,
  });

  const slugByLesson = new Map();
  const slugByAttachment = new Map();
  const handbook = await pdfBuffer();

  for (const spec of loadLessons()) {
    const lesson = await Lesson.create({
      course: course._id,
      title: spec.title,
      content: spec.content,
      order: spec.order,
      attachments: spec.attachments.map((att) => ({
        url: `https://example.invalid/${att.originalName}`,
        publicId: att.slug,
        resourceType: 'raw',
        originalName: att.originalName,
        mimetype: 'application/pdf',
        size: handbook.length,
      })),
    });
    slugByLesson.set(String(lesson._id), spec.slug);

    if (frozen) await indexLessonBaseline(lesson);
    else await indexLesson(lesson, config);

    for (let i = 0; i < spec.attachments.length; i += 1) {
      const att = lesson.attachments[i];
      slugByAttachment.set(String(att._id), spec.attachments[i].slug);
      if (frozen) {
        await indexAttachmentBaseline(lesson, att, await extractTextOriginal(handbook));
      } else {
        await indexAttachmentText(lesson, att, await extractPages(handbook, 'application/pdf'), config);
      }
    }
  }

  // Indexing swallows embedding failures by design (so tutors can still save
  // lessons without AI keys). In an evaluation that would silently produce an
  // empty or partial index and an all-miss "result", so verify every lesson and
  // attachment actually got chunks and abort loudly if not.
  const lessonSpecs = loadLessons();
  const expectedAttachments = lessonSpecs.reduce((n, l) => n + l.attachments.length, 0);
  const lessonsIndexed = (await LessonChunk.distinct('lesson', { course: course._id, source: 'content' })).length;
  const attachmentsIndexed = (await LessonChunk.distinct('attachmentId', { course: course._id, source: 'attachment' })).length;
  if (lessonsIndexed !== lessonSpecs.length || attachmentsIndexed !== expectedAttachments) {
    throw new Error(
      `Indexing incomplete: ${lessonsIndexed}/${lessonSpecs.length} lessons and ${attachmentsIndexed}/${expectedAttachments} attachments ` +
        'produced chunks (likely an embedding failure, e.g. an API quota). Refusing to evaluate a partial index.'
    );
  }

  const chunkCount = await LessonChunk.countDocuments({ course: course._id });
  return {
    courseId: String(course._id),
    slugByLesson,
    slugByAttachment,
    chunkCount,
    indexSeconds: (Date.now() - started) / 1000,
  };
}

function sourceSlugOf(chunk, variant) {
  if (chunk.attachmentId) return variant.slugByAttachment.get(String(chunk.attachmentId)) || 'unknown-attachment';
  return variant.slugByLesson.get(String(chunk.lesson)) || 'unknown-lesson';
}

module.exports = { buildIndexVariant, sourceSlugOf };
