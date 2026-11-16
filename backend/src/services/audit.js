import { AuditLog } from '../models/AuditLog.js';

/**
 * Record a platform event. Logging must never break the request it describes,
 * so failures are swallowed after being printed.
 */
export async function audit(req, action, { targetType = '', targetId = '', summary = '', actor } = {}) {
  try {
    const user = actor || req?.user;
    await AuditLog.create({
      actor: user?._id || null,
      actorEmail: user?.email || '',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      summary,
      ip: req?.ip || '',
    });
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}
