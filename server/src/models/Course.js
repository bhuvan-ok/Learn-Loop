const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, default: 'General', trim: true },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    thumbnailUrl: { type: String, default: '' },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courseSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Course', courseSchema);
