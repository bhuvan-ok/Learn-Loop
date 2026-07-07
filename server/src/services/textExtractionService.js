const { EXTRACTABLE_MIMETYPES } = require('../config/upload');

function isExtractable(mimetype) {
  return EXTRACTABLE_MIMETYPES.has(mimetype);
}

// Turns an uploaded file into plain text so it can be chunked and embedded
// the same way lesson content is. Returns '' for file types we don't know
// how to extract from (images, slides, etc.) — those are still stored and
// downloadable, they just don't feed the AI tutor.
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
    return buffer.toString('utf8');
  }

  return '';
}

module.exports = { extractText, isExtractable };
