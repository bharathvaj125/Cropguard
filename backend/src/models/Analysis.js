import mongoose from 'mongoose';

const prediction = new mongoose.Schema(
  { label: String, name: String, confidence: Number },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    mode: { type: String, enum: ['disease', 'pest', 'both'], default: 'both' },
    cropHint: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },

    image: {
      key: { type: String, required: true },
      heatmapKey: { type: String, default: '' },
      width: Number,
      height: Number,
      bytes: Number,
    },
    quality: {
      brightness: Number,
      sharpness: Number,
      warnings: [String],
    },

    // Present when mode is 'disease' or 'both'.
    disease: {
      status: { type: String, enum: ['confident', 'uncertain'] },
      label: String, // PlantVillage class id, e.g. Tomato___Late_blight
      name: String, // "Late blight"
      crop: String,
      isHealthy: Boolean,
      confidence: Number,
      cropFiltered: Boolean, // true when predictions were restricted to cropHint
      top: [prediction],
    },

    // Present when mode is 'pest' or 'both'.
    pest: {
      status: { type: String, enum: ['detected', 'none', 'uncertain'] },
      label: String,
      name: String,
      confidence: Number,
      top: [prediction],
    },

    // One word for lists, filters and charts.
    outcome: {
      type: String,
      enum: ['healthy', 'disease', 'pest', 'disease_and_pest', 'inconclusive'],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },

    models: {
      disease: String,
      pest: String,
    },
    inferenceMs: Number,

    // Filled in by an admin / agronomist from the admin panel.
    review: {
      status: { type: String, enum: ['pending', 'confirmed', 'corrected'], default: 'pending', index: true },
      note: { type: String, trim: true, maxlength: 500, default: '' },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
    },
  },
  { timestamps: true },
);

analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ createdAt: -1 });

export const Analysis = mongoose.model('Analysis', analysisSchema);
