const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: (arr) => arr.length >= 2,
    },
    correctOptionIndex: { type: Number, required: true },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    title: { type: String, required: true, trim: true },
    questions: {
      type: [questionSchema],
      required: true,
      validate: (arr) => arr.length > 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
