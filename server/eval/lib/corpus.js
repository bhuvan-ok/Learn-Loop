const fs = require('fs');
const path = require('path');
const { coverage } = require('./spanMatch');

const CORPUS_DIR = path.join(__dirname, '..', 'corpus');
const DATASET_PATH = path.join(__dirname, '..', 'dataset.jsonl');

// Which attachments are uploaded to which lesson (the PDF is rendered from the
// markdown source by corpus/build-pdf.js and goes through real PDF extraction).
const ATTACHMENTS = {
  'performance-handbook-intro': [
    { slug: 'performance-handbook', sourceFile: 'performance-handbook.md', originalName: 'performance-handbook.pdf' },
  ],
};

function loadLessons() {
  const dir = path.join(CORPUS_DIR, 'lessons');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file, order) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const slug = file.replace(/\.md$/, '');
      const [firstLine, ...rest] = raw.split('\n');
      const title = firstLine.replace(/^#\s*/, '').trim();
      // The "# Title" line is the lesson title (a separate field in the product),
      // so the lesson body starts after it.
      return { slug, title, content: rest.join('\n').trim(), order, attachments: ATTACHMENTS[slug] || [] };
    });
}

function readAttachmentSource(att) {
  return fs.readFileSync(path.join(CORPUS_DIR, 'attachments', att.sourceFile), 'utf8').replace(/\r\n/g, '\n');
}

// slug -> full source text, used to validate that gold spans really exist.
function sourceTexts() {
  const texts = new Map();
  for (const lesson of loadLessons()) {
    texts.set(lesson.slug, lesson.content);
    for (const att of lesson.attachments) texts.set(att.slug, readAttachmentSource(att));
  }
  return texts;
}

// Dev/test split, deterministic and stratified: within each category, the first
// two of every five questions are the "dev" split (thresholds are tuned there),
// the rest are the held-out "test" split (headline numbers come from there).
function loadDataset() {
  const rows = fs
    .readFileSync(DATASET_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`dataset.jsonl line ${i + 1} is not valid JSON: ${err.message}`);
      }
    });

  const counters = {};
  return rows.map((row) => {
    const i = counters[row.category] || 0;
    counters[row.category] = i + 1;
    return {
      answerable: row.answerable !== false,
      history: [],
      ...row,
      split: i % 5 < 2 ? 'dev' : 'test',
    };
  });
}

// Returns a list of problems; empty means the dataset is consistent.
function validateDataset(dataset = loadDataset()) {
  const problems = [];
  const texts = sourceTexts();
  const ids = new Set();

  for (const q of dataset) {
    if (ids.has(q.id)) problems.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    if (!q.question || !q.question.trim()) problems.push(`${q.id}: empty question`);
    if (q.answerable && !q.gold.length) problems.push(`${q.id}: answerable question has no gold spans`);
    if (!q.answerable && q.gold.length) problems.push(`${q.id}: unanswerable question must not have gold spans`);
    if (q.category === 'followup' && !(q.history || []).length) problems.push(`${q.id}: follow-up has no history`);

    for (const g of q.gold) {
      const source = texts.get(g.lesson);
      if (!source) {
        problems.push(`${q.id}: unknown lesson "${g.lesson}"`);
      } else if (coverage(g.span, source) < 1) {
        problems.push(`${q.id}: gold span not found verbatim in ${g.lesson}: "${g.span.slice(0, 70)}..."`);
      }
    }
  }
  return problems;
}

module.exports = { loadLessons, loadDataset, validateDataset, sourceTexts, readAttachmentSource, CORPUS_DIR };
