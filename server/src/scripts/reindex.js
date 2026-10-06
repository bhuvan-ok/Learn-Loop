// Rebuilds the RAG index for existing courses under the active pipeline's
// indexing settings (chunker, contextual header, embedding task types).
//
//   npm run reindex                      all courses
//   npm run reindex -- --course <id>     one course
//   npm run reindex -- --skip-attachments
//
// Needed once after upgrading from the original chunker, and again whenever
// RAG_PIPELINE / indexing settings or the embedding model change — retrieval
// logs a warning when it finds chunks indexed under different settings.
//
// Lesson text is re-chunked from the database. Attachments are re-downloaded
// from their stored URL and re-extracted, because the original uploaded buffer
// is not kept. A failure on one lesson or attachment is reported and skipped;
// existing chunks are only replaced after the new ones were embedded
// successfully, so a failed run never leaves a lesson without an index.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const { indexLesson, indexAttachmentText } = require('../services/lessonIndexingService');
const { extractPages, isExtractable } = require('../services/textExtractionService');
const { getRagConfig } = require('../config/ragConfig');

function parseArgs(argv) {
  const args = { course: null, skipAttachments: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--course') args.course = argv[++i];
    else if (argv[i] === '--skip-attachments') args.skipAttachments = true;
  }
  return args;
}

async function reindexAttachment(lesson, attachment, config) {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const pages = await extractPages(buffer, attachment.mimetype);
  if (!pages.some((page) => page.trim())) return 0;
  return indexAttachmentText(lesson, attachment, pages, config);
}

async function main() {
  const args = parseArgs(process.argv);
  const config = getRagConfig();
  console.log(`Re-indexing with pipeline "${config.name}" (chunker: ${config.indexing.chunker}, header: ${config.indexing.header}, task types: ${config.indexing.taskTypes}, llm context: ${config.indexing.llmContext})`);

  await connectDB();
  const courses = args.course ? await Course.find({ _id: args.course }) : await Course.find();
  if (!courses.length) console.log('No matching courses.');

  let lessons = 0;
  let chunks = 0;
  let failures = 0;

  for (const course of courses) {
    console.log(`\nCourse "${course.title}" (${course._id})`);
    for (const lesson of await Lesson.find({ course: course._id }).sort({ order: 1 })) {
      lessons += 1;
      const count = await indexLesson(lesson, config);
      chunks += count;
      if (!count) failures += 1;
      console.log(`  ${count ? 'ok  ' : 'FAIL'} "${lesson.title}": ${count} chunks`);

      if (args.skipAttachments) continue;
      for (const attachment of lesson.attachments) {
        if (!isExtractable(attachment.mimetype)) continue;
        try {
          const n = await reindexAttachment(lesson, attachment, config);
          chunks += n;
          console.log(`  ${n ? 'ok  ' : 'skip'} attachment "${attachment.originalName}": ${n} chunks`);
        } catch (err) {
          failures += 1;
          console.log(`  FAIL attachment "${attachment.originalName}": ${err.message}`);
        }
      }
    }
  }

  console.log(`\nDone: ${lessons} lessons, ${chunks} chunks written, ${failures} failure(s).`);
  await mongoose.disconnect();
  if (failures) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error('Reindex failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
