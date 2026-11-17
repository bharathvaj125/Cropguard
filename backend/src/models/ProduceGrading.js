import mongoose from 'mongoose';

const defectSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['none', 'mild', 'moderate', 'severe'], default: 'mild' },
    description: { type: String, default: '' },
  },
  { _id: false },
);

const produceGradingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    commodity: { type: String, required: true, trim: true, index: true },
    variety: { type: String, trim: true, default: '' },

    grade: {
      type: String,
      enum: ['Grade A', 'Grade B', 'Grade C'],
      required: true,
      index: true,
    },
    gradeLabel: { type: String, default: 'Fair Average Quality' },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    qualityScore: { type: Number, min: 0, max: 100 },
    // How the grade was produced: the trained FruitNet model, Claude vision, or the basic
    // colour check (weak, shown with low confidence).
    method: { type: String, enum: ['model', 'claude', 'basic'], default: 'basic' },
    detectedCommodity: { type: String, default: '' },
    qualityProbabilities: { good: Number, mixed: Number, bad: Number },
    warnings: [{ type: String }],
    summary: { type: String, default: '' },

    image: {
      key: { type: String, required: true },
      width: Number,
      height: Number,
      bytes: Number,
    },

    metrics: {
      uniformity: { type: Number, min: 0, max: 100 },
      colorRipeness: { type: Number, min: 0, max: 100 },
      surfaceCleanliness: { type: Number, min: 0, max: 100 },
      defectAreaPercent: { type: Number, min: 0, max: 100 },
    },

    defectsDetected: [defectSchema],

    priceEstimate: {
      commodity: String,
      market: String,
      state: String,
      grade: String,
      baseModalPricePerQuintal: Number,
      estimatedMinPerQuintal: Number,
      estimatedMaxPerQuintal: Number,
      estimatedMinPerKg: Number,
      estimatedMaxPerKg: Number,
      unit: { type: String, default: 'Rs / quintal' },
      marketDate: { type: Date, default: Date.now },
      marketNote: { type: String, default: '' },
      sample: { type: Boolean, default: false },
    },

    disclaimer: {
      type: String,
      default:
        'Indicative estimate based on visual surface characteristics and prevailing APMC mandi modal rates. Final commercial grading and sale price require physical inspection by a qualified buyer or market committee.',
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

produceGradingSchema.index({ user: 1, createdAt: -1 });

export const ProduceGrading = mongoose.model('ProduceGrading', produceGradingSchema);
