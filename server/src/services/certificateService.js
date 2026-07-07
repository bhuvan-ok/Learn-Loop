const PDFDocument = require('pdfkit');

// Returns a promise so the caller can `await` completion and catch failures
// through the normal asyncHandler path — a bare `doc.pipe(res)` with no
// error handling means a client aborting the download mid-stream (EPIPE/
// ECONNRESET) fires an unhandled 'error' event, which crashes the whole
// Node process rather than just failing this one request.
function renderCertificatePdf({ studentName, courseTitle, issuedAt, certificateId, res }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });

    doc.on('error', reject);
    res.on('error', reject);
    res.on('close', () => resolve());
    doc.pipe(res);
    doc.on('end', resolve);

    drawCertificate(doc, { studentName, courseTitle, issuedAt, certificateId });
    doc.end();
  });
}

function drawCertificate(doc, { studentName, courseTitle, issuedAt, certificateId }) {
  const { width, height } = doc.page;

  doc
    .lineWidth(3)
    .strokeColor('#4338ca')
    .rect(30, 30, width - 60, height - 60)
    .stroke();
  doc
    .lineWidth(1)
    .strokeColor('#a5b4fc')
    .rect(40, 40, width - 80, height - 80)
    .stroke();

  doc
    .fillColor('#1e1b4b')
    .fontSize(14)
    .font('Helvetica')
    .text('LEARNLOOP', 0, 90, { align: 'center' });

  doc
    .fillColor('#312e81')
    .fontSize(36)
    .font('Helvetica-Bold')
    .text('Certificate of Completion', 0, 130, { align: 'center' });

  doc
    .fillColor('#475569')
    .fontSize(14)
    .font('Helvetica')
    .text('This certifies that', 0, 210, { align: 'center' });

  doc
    .fillColor('#0f172a')
    .fontSize(28)
    .font('Helvetica-Bold')
    .text(studentName, 0, 240, { align: 'center' });

  doc
    .fillColor('#475569')
    .fontSize(14)
    .font('Helvetica')
    .text('has successfully completed the course', 0, 285, { align: 'center' });

  doc
    .fillColor('#0f172a')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(courseTitle, 0, 315, { align: 'center' });

  const issuedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  doc
    .fillColor('#64748b')
    .fontSize(11)
    .font('Helvetica')
    .text(`Issued ${issuedDate}`, 0, height - 90, { align: 'center' });

  doc
    .fillColor('#94a3b8')
    .fontSize(9)
    .text(`Certificate ID: ${certificateId}`, 0, height - 72, { align: 'center' });
}

module.exports = { renderCertificatePdf };
