const { indexSignature } = require('../../config/ragConfig');
const { getEmbeddingModelId } = require('../aiService');

// Identity of how chunks are produced and embedded. Stored on every chunk so
// retrieval can detect a course whose chunks were indexed under a different
// configuration or embedding model than the one now active.
function currentIndexVersion(config) {
  return `${indexSignature(config.indexing)}|${getEmbeddingModelId()}`;
}

module.exports = { currentIndexVersion };
