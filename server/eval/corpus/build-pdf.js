// Renders corpus/attachments/performance-handbook.md to a real PDF so the
// evaluation exercises the same PDF text-extraction path a tutor's upload
// takes (including hard line wraps and page breaks). Output goes to the
// eval cache directory; it is rebuilt on demand and not committed.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function buildHandbookPdf(outPath) {
  const source = fs.readFileSync(path.join(__dirname, 'attachments', 'performance-handbook.md'), 'utf8');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 64 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    for (const block of source.split(/\n\s*\n/)) {
      const text = block.trim();
      if (!text) continue;

      if (text.startsWith('# ')) {
        doc.font('Helvetica-Bold').fontSize(22).text(text.slice(2), { paragraphGap: 14 });
      } else if (text.startsWith('## ')) {
        doc.moveDown(0.6).font('Helvetica-Bold').fontSize(15).text(text.slice(3), { paragraphGap: 6 });
      } else {
        doc.font('Helvetica').fontSize(11).text(text.replace(/\n/g, ' '), { align: 'left', paragraphGap: 8, lineGap: 2 });
      }
    }

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

module.exports = { buildHandbookPdf };
