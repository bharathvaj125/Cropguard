import mongoose from 'mongoose';

const soilParamSchema = new mongoose.Schema(
  {
    value: { type: Number, default: null },
    unit: { type: String, default: '' },
    rating: { type: String, enum: ['low', 'medium', 'high', 'deficient', 'sufficient', 'strongly_acidic', 'acidic', 'neutral', 'alkaline', 'strongly_alkaline', 'normal', 'critical', 'injurious', 'unspecified'], default: 'unspecified' },
    unreadable: { type: Boolean, default: false },
  },
  { _id: false },
);

const applicationStageSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    timing: { type: String, required: true },
    ureaBags: { type: Number, default: 0 },
    dapBags: { type: Number, default: 0 },
    mopBags: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false },
);

const soilAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    sampleId: { type: String, trim: true, default: '' },
    crop: { type: String, trim: true, default: 'General' },
    farmAreaAcre: { type: Number, default: 1, min: 0.1, max: 1000 },

    image: {
      key: { type: String, default: '' },
      width: Number,
      height: Number,
      bytes: Number,
    },

    parameters: {
      nitrogen: soilParamSchema,
      phosphorus: soilParamSchema,
      potassium: soilParamSchema,
      ph: soilParamSchema,
      ec: soilParamSchema,
      organicCarbon: soilParamSchema,
      zinc: soilParamSchema,
      iron: soilParamSchema,
      sulphur: soilParamSchema,
      boron: soilParamSchema,
    },

    unreadableFields: [{ type: String }],
    overallHealth: {
      type: String,
      enum: ['excellent', 'good', 'moderate', 'degraded'],
      default: 'moderate',
    },

    fertilizerPlan: {
      ureaBags: { type: Number, default: 0 },
      dapBags: { type: Number, default: 0 },
      mopBags: { type: Number, default: 0 },
      gypsumKg: { type: Number, default: 0 },
      limeKg: { type: Number, default: 0 },
      fymTonnes: { type: Number, default: 0 },
      schedule: [applicationStageSchema],
    },

    recommendations: [{ type: String }],
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);

soilAnalysisSchema.index({ user: 1, createdAt: -1 });

export const SoilAnalysis = mongoose.model('SoilAnalysis', soilAnalysisSchema);
