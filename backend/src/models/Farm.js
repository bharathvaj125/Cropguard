import mongoose from 'mongoose';

export const SOIL_TYPES = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'loamy', 'clay', 'other'];
export const IRRIGATION_TYPES = ['rainfed', 'canal', 'borewell', 'drip', 'sprinkler', 'other'];

const farmSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    location: {
      name: { type: String, trim: true, default: '' }, // e.g. "Thanjavur, Tamil Nadu"
      state: { type: String, trim: true, default: '' },
      district: { type: String, trim: true, default: '' },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    areaAcres: { type: Number, min: 0, default: 0 },
    soilType: { type: String, enum: SOIL_TYPES, default: 'other' },
    irrigationType: { type: String, enum: IRRIGATION_TYPES, default: 'other' },
    crops: [{ type: String, trim: true, maxlength: 40 }],
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

farmSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Farm = mongoose.model('Farm', farmSchema);
