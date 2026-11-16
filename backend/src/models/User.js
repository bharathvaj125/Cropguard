import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Excluded from every query unless explicitly selected.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['farmer', 'admin'], default: 'farmer', index: true },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    location: {
      state: { type: String, trim: true, default: '' },
      district: { type: String, trim: true, default: '' },
      village: { type: String, trim: true, default: '' },
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
