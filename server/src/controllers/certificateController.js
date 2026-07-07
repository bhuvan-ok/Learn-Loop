const Certificate = require('../models/Certificate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { renderCertificatePdf } = require('../services/certificateService');

const getMyCertificateForCourse = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findOne({
    student: req.user._id,
    course: req.params.courseId,
  })
    .populate('student', 'name')
    .populate('course', 'title');

  if (!certificate) {
    throw new ApiError(404, "You haven't earned a certificate for this course yet");
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="certificate.pdf"');

  await renderCertificatePdf({
    studentName: certificate.student.name,
    courseTitle: certificate.course.title,
    issuedAt: certificate.createdAt,
    certificateId: certificate._id.toString(),
    res,
  });
});

module.exports = { getMyCertificateForCourse };
