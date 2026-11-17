import mongoose from 'mongoose';

const advisoryChatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    query: { type: String, required: true, trim: true, maxlength: 1000 },
    language: { type: String, default: 'en', maxlength: 10 },
    crop: { type: String, default: '', trim: true },
    detectedTopic: { type: String, default: 'general' },

    response: {
      title: { type: String, default: '' },
      body: { type: String, required: true },
      voiceSummary: { type: String, default: '' },
      keyActions: [{ type: String }],
      missingContextQuestions: [{ type: String }],
    },

    // Which engine answered: Claude, or the offline almanac rules.
    source: { type: String, enum: ['claude', 'rules'], default: 'rules' },
    model: { type: String, default: '' },

    contextProvided: {
      crop: { type: String, default: '' },
      location: { type: String, default: '' },
      soilType: { type: String, default: '' },
      season: { type: String, default: '' },
      irrigation: { type: String, default: '' },
    },

    disclaimer: {
      type: String,
      default:
        'Guidance is formulated from standard agronomic packages of practices. Always cross-verify critical pesticide/disease decisions with your district Krishi Vigyan Kendra (KVK) or extension officer.',
    },
  },
  { timestamps: true },
);

advisoryChatSchema.index({ user: 1, createdAt: -1 });

export const AdvisoryChat = mongoose.model('AdvisoryChat', advisoryChatSchema);
