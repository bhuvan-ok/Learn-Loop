const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ quiz: 1, student: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
