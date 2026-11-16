import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { Activity } from '../models/Activity.js';
import { Analysis } from '../models/Analysis.js';
import { Farm } from '../models/Farm.js';
import { User } from '../models/User.js';
import { audit } from '../services/audit.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { parse } from '../utils/validate.js';

const router = Router();

// Slow down password guessing. Disabled in tests, which log in many times.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

const password = z
  .string()
  .min(8, 'must be at least 8 characters')
  .max(72, 'must be at most 72 characters') // bcrypt ignores anything past 72 bytes
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'must contain a letter and a number');

const locationSchema = z
  .object({
    state: z.string().trim().max(60).default(''),
    district: z.string().trim().max(60).default(''),
    village: z.string().trim().max(60).default(''),
  })
  .partial();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('must be a valid email address'),
  password,
  phone: z.string().trim().max(20).optional(),
  location: locationSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('must be a valid email address'),
  password: z.string().min(1, 'is required'),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  location: locationSchema.optional(),
});

router.post('/register', authLimiter, async (req, res) => {
  const data = parse(registerSchema, req.body);
  if (await User.exists({ email: data.email })) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    phone: data.phone || '',
    location: data.location || {},
    lastLoginAt: new Date(),
  });
  await audit(req, 'auth.register', { actor: user, targetType: 'User', targetId: user._id, summary: user.email });
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', authLimiter, async (req, res) => {
  const data = parse(loginSchema, req.body);
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  // Same message for "no such user" and "wrong password" so emails cannot be enumerated.
  const ok = user && (await bcrypt.compare(data.password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Incorrect email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact support.');

  user.lastLoginAt = new Date();
  await user.save();
  await audit(req, 'auth.login', { actor: user, targetType: 'User', targetId: user._id });
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/me', requireAuth, async (req, res) => {
  const data = parse(profileSchema, req.body);
  if (data.name !== undefined) req.user.name = data.name;
  if (data.phone !== undefined) req.user.phone = data.phone;
  if (data.location) {
    req.user.location = { ...req.user.location.toObject(), ...data.location };
  }
  await req.user.save();
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const data = parse(z.object({ currentPassword: z.string().min(1), newPassword: password }), req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(data.newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await audit(req, 'auth.password_change', { targetType: 'User', targetId: user._id });
  // Old tokens stop working, so hand back a fresh one.
  res.json({ token: signToken(user), user });
});

router.delete('/me', requireAuth, async (req, res) => {
  const data = parse(z.object({ password: z.string().min(1, 'is required') }), req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(data.password, user.passwordHash))) {
    throw ApiError.badRequest('Password is incorrect');
  }
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', isActive: true })) <= 1) {
    throw ApiError.badRequest('You are the only admin. Promote another admin before deleting this account.');
  }
  await deleteUserData(user._id);
  await user.deleteOne();
  await audit(req, 'auth.account_delete', { targetType: 'User', targetId: user._id, summary: user.email });
  res.status(204).end();
});

/** Remove everything a user owns, including stored images. Shared with the admin routes. */
export async function deleteUserData(userId) {
  const analyses = await Analysis.find({ user: userId }).select('image');
  await Promise.all(
    analyses.flatMap((a) => [storage.remove(a.image.key), a.image.heatmapKey && storage.remove(a.image.heatmapKey)]),
  );
  await Promise.all([
    Analysis.deleteMany({ user: userId }),
    Farm.deleteMany({ owner: userId }),
    Activity.deleteMany({ user: userId }),
  ]);
}

export default router;
