// Checks the evaluation dataset against the corpus: every gold span must exist
// verbatim in the lesson it names, ids must be unique, and the category / split
// mix is printed so imbalances are visible. Run: npm run eval:validate
const { loadDataset, validateDataset, loadLessons } = require('./lib/corpus');

const dataset = loadDataset();
const problems = validateDataset(dataset);

const lessons = loadLessons();
const words = lessons.reduce((n, l) => n + l.content.split(/\s+/).length, 0);
console.log(`Corpus: ${lessons.length} lessons (~${words} words) + ${lessons.reduce((n, l) => n + l.attachments.length, 0)} PDF attachment(s)`);

const table = {};
for (const q of dataset) {
  table[q.category] = table[q.category] || { dev: 0, test: 0 };
  table[q.category][q.split] += 1;
}
console.log(`Dataset: ${dataset.length} questions`);
console.table(table);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('OK: every gold span exists verbatim in its source lesson.');
