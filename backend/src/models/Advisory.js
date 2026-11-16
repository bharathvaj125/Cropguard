import mongoose from 'mongoose';

/** A notice an admin broadcasts to farmers, e.g. a regional pest outbreak warning. */
const advisorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    // Empty means "everyone"; otherwise only farmers whose profile or farm is in this state.
    state: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

advisorySchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Advisory = mongoose.model('Advisory', advisorySchema);
