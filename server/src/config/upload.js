const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const ApiError = require('../utils/ApiError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const EXTRACTABLE_MIMETYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

// Lesson attachments are meant to be PDF/text/images (per the README) and are
// served back statically from /uploads — allowing arbitrary file types (e.g.
// .html or .svg, which can carry a <script>) would let a tutor upload a file
// that executes stored XSS in a student's browser when opened.
const ALLOWED_MIMETYPES = new Set([
  ...EXTRACTABLE_MIMETYPES,
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

// Files are held in memory just long enough to stream to Cloudinary and (for
// PDFs/text) extract RAG text from that same buffer — nothing touches disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'learnloop/lesson-attachments', resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function deleteFromCloudinary(publicId, resourceType) {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
}

module.exports = {
  upload,
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  MAX_FILE_SIZE_BYTES,
  EXTRACTABLE_MIMETYPES,
};
