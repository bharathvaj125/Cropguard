import mongoose from 'mongoose';

export const ACTIVITY_TYPES = [
  'sowing',
  'irrigation',
  'fertilizer',
  'spraying',
  'weeding',
  'scouting',
  'harvest',
  'other',
];

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    status: { type: String, enum: ['planned', 'done'], default: 'planned' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    cost: { type: Number, min: 0, default: 0 }, // rupees, optional
  },
  { timestamps: true },
);

activitySchema.index({ user: 1, date: -1 });

activitySchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Activity = mongoose.model('Activity', activitySchema);
