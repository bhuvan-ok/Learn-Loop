const mongoose = require('mongoose');

// The evaluation wipes and rebuilds its own database for every index variant.
// It must therefore never be pointed at real data, so this refuses anything that
// isn't a local database whose name starts with "lms_eval" — regardless of what
// MONGO_URI in .env says.
const DEFAULT_URI = 'mongodb://127.0.0.1:27017/lms_eval';

function resolveEvalUri() {
  return process.env.EVAL_MONGO_URI || DEFAULT_URI;
}

async function connectEvalDb() {
  const uri = resolveEvalUri();
  const parsed = new URL(uri);
  const dbName = parsed.pathname.replace(/^\//, '');
  const isLocal = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);

  if (!isLocal || !dbName.startsWith('lms_eval') || parsed.protocol === 'mongodb+srv:') {
    throw new Error(
      `Refusing to run the evaluation against "${parsed.hostname}/${dbName}". ` +
        'EVAL_MONGO_URI must be a local mongod and the database name must start with "lms_eval".'
    );
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  if (!mongoose.connection.name.startsWith('lms_eval')) {
    await mongoose.disconnect();
    throw new Error('Connected database name does not start with "lms_eval"; aborting.');
  }
  return mongoose.connection;
}

async function resetEvalDb() {
  if (!mongoose.connection.name.startsWith('lms_eval')) throw new Error('not an eval database');
  await mongoose.connection.dropDatabase();
}

module.exports = { connectEvalDb, resetEvalDb };
