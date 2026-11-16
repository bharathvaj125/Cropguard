import mongoose from 'mongoose';

/** Append-only record of things that happened on the platform, shown in the admin panel. */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, default: '' },
    action: { type: String, required: true, index: true }, // e.g. "auth.login", "admin.user.update"
    targetType: { type: String, default: '' },
    targetId: { type: String, default: '' },
    summary: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

auditLogSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
