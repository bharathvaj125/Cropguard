import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Activity } from '../models/Activity.js';
import { Advisory } from '../models/Advisory.js';
import { Analysis } from '../models/Analysis.js';
import { AuditLog } from '../models/AuditLog.js';
import { Farm } from '../models/Farm.js';
import { MarketPrice } from '../models/MarketPrice.js';
import { User } from '../models/User.js';
import { audit } from '../services/audit.js';
import { syncAgmarknet, utcMidnight } from '../services/market.js';
import { mlStatus } from '../services/mlClient.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, escapeRegex, objectId, paged, pagination, parse } from '../utils/validate.js';
import { serialize } from './analyses.js';
import { deleteUserData } from './auth.js';
import { farmSchema } from './farms.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const DAY_MS = 24 * 60 * 60 * 1000;
const search = z.string().trim().max(80).optional();

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

router.get('/stats', async (_req, res) => {
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const byDay = (field = '$createdAt') => ({ $dateToString: { format: '%Y-%m-%d', date: field } });

  const [users, activeUsers, admins, newUsers30, farms, area, analyses, analyses30, pendingReviews, outcomes, topDiseases, topPests, scansByDay, signupsByDay, confidence, activities, ml] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ createdAt: { $gte: since30 } }),
      Farm.countDocuments(),
      Farm.aggregate([{ $group: { _id: null, acres: { $sum: '$areaAcres' } } }]),
      Analysis.countDocuments(),
      Analysis.countDocuments({ createdAt: { $gte: since30 } }),
      Analysis.countDocuments({ 'review.status': 'pending', outcome: { $ne: 'healthy' } }),
      Analysis.aggregate([{ $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      Analysis.aggregate([
        { $match: { 'disease.status': 'confident', 'disease.isHealthy': false } },
        { $group: { _id: { crop: '$disease.crop', name: '$disease.name' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Analysis.aggregate([
        { $match: { 'pest.status': 'detected' } },
        { $group: { _id: '$pest.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Analysis.aggregate([
        { $match: { createdAt: { $gte: since30 } } },
        { $group: { _id: byDay(), scans: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since30 } } },
        { $group: { _id: byDay(), signups: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Analysis.aggregate([
        { $group: { _id: null, disease: { $avg: '$disease.confidence' }, pest: { $avg: '$pest.confidence' }, ms: { $avg: '$inferenceMs' } } },
      ]),
      Activity.countDocuments(),
      mlStatus(),
    ]);

  // Fill every day of the last 30 so the chart has no gaps.
  const scans = new Map(scansByDay.map((d) => [d._id, d.scans]));
  const signups = new Map(signupsByDay.map((d) => [d._id, d.signups]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(utcMidnight().getTime() - (29 - i) * DAY_MS).toISOString().slice(0, 10);
    return { date, scans: scans.get(date) || 0, signups: signups.get(date) || 0 };
  });

  res.json({
    totals: {
      users,
      activeUsers,
      admins,
      newUsers30,
      farms,
      acres: Math.round(area[0]?.acres || 0),
      analyses,
      analyses30,
      pendingReviews,
      activities,
    },
    outcomes: Object.fromEntries(outcomes.map((o) => [o._id, o.count])),
    topDiseases: topDiseases.map((d) => ({ name: `${d._id.crop}: ${d._id.name}`, count: d.count })),
    topPests: topPests.map((p) => ({ name: p._id, count: p.count })),
    daily,
    averages: {
      diseaseConfidence: confidence[0]?.disease ?? null,
      pestConfidence: confidence[0]?.pest ?? null,
      inferenceMs: confidence[0]?.ms ? Math.round(confidence[0].ms) : null,
    },
    system: {
      ml,
      storage: await storage.driverName(),
      marketSource: config.dataGovApiKey ? 'agmarknet' : 'sample',
      thresholds: config.thresholds,
    },
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

router.get('/users', async (req, res) => {
  const q = parse(
    pagination.extend({ q: search, role: z.enum(['farmer', 'admin']).optional(), status: z.enum(['active', 'inactive']).optional() }),
    req.query,
  );
  const filter = {};
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (q.role) filter.role = q.role;
  if (q.status) filter.isActive = q.status === 'active';

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const [farmCounts, scanCounts] = await Promise.all([
    Farm.aggregate([{ $match: { owner: { $in: ids } } }, { $group: { _id: '$owner', n: { $sum: 1 } } }]),
    Analysis.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
  ]);
  const farms = new Map(farmCounts.map((c) => [c._id.toString(), c.n]));
  const scans = new Map(scanCounts.map((c) => [c._id.toString(), c.n]));
  res.json(
    paged(
      users.map((u) => ({ ...u.toJSON(), farms: farms.get(u.id) || 0, scans: scans.get(u.id) || 0 })),
      total,
      q,
    ),
  );
});

async function assertNotLastAdmin(user) {
  if (user.role !== 'admin' || !user.isActive) return;
  if ((await User.countDocuments({ role: 'admin', isActive: true })) <= 1) {
    throw ApiError.badRequest('This is the only active admin. Promote another admin first.');
  }
}

router.patch('/users/:id', async (req, res) => {
  assertId(req.params.id, 'User');
  const data = parse(z.object({ role: z.enum(['farmer', 'admin']).optional(), isActive: z.boolean().optional() }), req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User');

  const demoting = data.role === 'farmer' && user.role === 'admin';
  const deactivating = data.isActive === false && user.isActive;
  if (demoting || deactivating) {
    if (user._id.equals(req.user._id)) throw ApiError.badRequest('You cannot demote or deactivate your own account');
    await assertNotLastAdmin(user);
  }

  const changes = [];
  if (data.role && data.role !== user.role) {
    changes.push(`role ${user.role} -> ${data.role}`);
    user.role = data.role;
  }
  if (data.isActive !== undefined && data.isActive !== user.isActive) {
    changes.push(data.isActive ? 'activated' : 'deactivated');
    user.isActive = data.isActive;
  }
  await user.save();
  if (changes.length) {
    await audit(req, 'admin.user.update', { targetType: 'User', targetId: user._id, summary: `${user.email}: ${changes.join(', ')}` });
  }
  res.json({ user });
});

router.delete('/users/:id', async (req, res) => {
  assertId(req.params.id, 'User');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User');
  if (user._id.equals(req.user._id)) throw ApiError.badRequest('Use the profile page to delete your own account');
  await assertNotLastAdmin(user);
  await deleteUserData(user._id);
  await user.deleteOne();
  await audit(req, 'admin.user.delete', { targetType: 'User', targetId: user._id, summary: user.email });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Farms
// ---------------------------------------------------------------------------

router.get('/farms', async (req, res) => {
  const q = parse(pagination.extend({ q: search }), req.query);
  const filter = {};
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { 'location.name': rx }, { 'location.state': rx }, { crops: rx }];
  }
  const [farms, total] = await Promise.all([
    Farm.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('owner', 'name email'),
    Farm.countDocuments(filter),
  ]);
  res.json(paged(farms, total, q));
});

router.put('/farms/:id', async (req, res) => {
  assertId(req.params.id, 'Farm');
  const data = parse(farmSchema, req.body);
  const farm = await Farm.findById(req.params.id);
  if (!farm) throw ApiError.notFound('Farm');
  farm.set(data);
  await farm.save();
  await farm.populate('owner', 'name email');
  await audit(req, 'admin.farm.update', { targetType: 'Farm', targetId: farm._id, summary: farm.name });
  res.json({ farm });
});

router.delete('/farms/:id', async (req, res) => {
  assertId(req.params.id, 'Farm');
  const farm = await Farm.findById(req.params.id);
  if (!farm) throw ApiError.notFound('Farm');
  await Promise.all([
    Analysis.updateMany({ farm: farm._id }, { $set: { farm: null } }),
    Activity.updateMany({ farm: farm._id }, { $set: { farm: null } }),
  ]);
  await farm.deleteOne();
  await audit(req, 'admin.farm.delete', { targetType: 'Farm', targetId: farm._id, summary: farm.name });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Analysis reports
// ---------------------------------------------------------------------------

router.get('/analyses', async (req, res) => {
  const q = parse(
    pagination.extend({
      outcome: z.enum(['healthy', 'disease', 'pest', 'disease_and_pest', 'inconclusive']).optional(),
      review: z.enum(['pending', 'confirmed', 'corrected']).optional(),
      userId: objectId.optional(),
    }),
    req.query,
  );
  const filter = {};
  if (q.outcome) filter.outcome = q.outcome;
  if (q.review) filter['review.status'] = q.review;
  if (q.userId) filter.user = q.userId;
  const [docs, total] = await Promise.all([
    Analysis.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('farm', 'name')
      .populate('user', 'name email'),
    Analysis.countDocuments(filter),
  ]);
  res.json(paged(await Promise.all(docs.map((d) => serialize(d))), total, q));
});

router.get('/analyses/:id', async (req, res) => {
  assertId(req.params.id, 'Analysis');
  const doc = await Analysis.findById(req.params.id).populate('farm', 'name').populate('user', 'name email');
  if (!doc) throw ApiError.notFound('Analysis');
  res.json({ analysis: await serialize(doc, { detail: true }) });
});

// An agronomist confirms the AI result or records that it was wrong.
router.patch('/analyses/:id/review', async (req, res) => {
  assertId(req.params.id, 'Analysis');
  const data = parse(
    z.object({ status: z.enum(['pending', 'confirmed', 'corrected']), note: z.string().trim().max(500).default('') }),
    req.body,
  );
  const doc = await Analysis.findById(req.params.id).populate('farm', 'name').populate('user', 'name email');
  if (!doc) throw ApiError.notFound('Analysis');
  doc.review = { status: data.status, note: data.note, reviewedBy: req.user._id, reviewedAt: new Date() };
  await doc.save();
  await audit(req, 'admin.analysis.review', { targetType: 'Analysis', targetId: doc._id, summary: data.status });
  res.json({ analysis: await serialize(doc, { detail: true }) });
});

router.delete('/analyses/:id', async (req, res) => {
  assertId(req.params.id, 'Analysis');
  const doc = await Analysis.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Analysis');
  await Promise.all([storage.remove(doc.image.key), storage.remove(doc.image.heatmapKey)]);
  await doc.deleteOne();
  await audit(req, 'admin.analysis.delete', { targetType: 'Analysis', targetId: doc._id });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Platform activity log
// ---------------------------------------------------------------------------

router.get('/activity', async (req, res) => {
  const q = parse(pagination.extend({ action: z.string().trim().max(40).optional() }), req.query);
  const filter = q.action ? { action: new RegExp(`^${escapeRegex(q.action)}`) } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json(paged(items, total, q));
});

// ---------------------------------------------------------------------------
// Advisories broadcast to farmers
// ---------------------------------------------------------------------------

const advisorySchema = z.object({
  title: z.string().trim().min(3, 'must be at least 3 characters').max(120),
  message: z.string().trim().min(5, 'must be at least 5 characters').max(1000),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  state: z.string().trim().max(60).default(''),
  active: z.boolean().default(true),
  expiresAt: z.coerce.date().nullish(),
});

router.get('/advisories', async (_req, res) => {
  res.json({ advisories: await Advisory.find().sort({ createdAt: -1 }).limit(100) });
});

router.post('/advisories', async (req, res) => {
  const data = parse(advisorySchema, req.body);
  const advisory = await Advisory.create({ ...data, expiresAt: data.expiresAt || null, createdBy: req.user._id });
  await audit(req, 'admin.advisory.create', { targetType: 'Advisory', targetId: advisory._id, summary: advisory.title });
  res.status(201).json({ advisory });
});

router.put('/advisories/:id', async (req, res) => {
  assertId(req.params.id, 'Advisory');
  const data = parse(advisorySchema, req.body);
  const advisory = await Advisory.findById(req.params.id);
  if (!advisory) throw ApiError.notFound('Advisory');
  advisory.set({ ...data, expiresAt: data.expiresAt || null });
  await advisory.save();
  await audit(req, 'admin.advisory.update', { targetType: 'Advisory', targetId: advisory._id, summary: advisory.title });
  res.json({ advisory });
});

router.delete('/advisories/:id', async (req, res) => {
  assertId(req.params.id, 'Advisory');
  const advisory = await Advisory.findByIdAndDelete(req.params.id);
  if (!advisory) throw ApiError.notFound('Advisory');
  await audit(req, 'admin.advisory.delete', { targetType: 'Advisory', targetId: advisory._id, summary: advisory.title });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

router.post('/market/prices', async (req, res) => {
  const data = parse(
    z
      .object({
        commodity: z.string().trim().min(2).max(60),
        market: z.string().trim().min(2).max(60),
        state: z.string().trim().min(2).max(60),
        district: z.string().trim().max(60).default(''),
        date: z.coerce.date(),
        minPrice: z.coerce.number().positive(),
        maxPrice: z.coerce.number().positive(),
        modalPrice: z.coerce.number().positive(),
      })
      .refine((v) => v.minPrice <= v.modalPrice && v.modalPrice <= v.maxPrice, {
        message: 'Prices must satisfy min <= modal <= max',
      }),
    req.body,
  );
  const date = utcMidnight(data.date);
  const price = await MarketPrice.findOneAndUpdate(
    { commodity: data.commodity, market: data.market, date },
    { $set: { ...data, date, source: 'manual' } },
    { upsert: true, new: true, runValidators: true },
  );
  await audit(req, 'admin.market.price', {
    targetType: 'MarketPrice',
    targetId: price._id,
    summary: `${data.commodity} @ ${data.market}: Rs ${data.modalPrice}`,
  });
  res.status(201).json({ price });
});

router.post('/market/sync', async (req, res) => {
  if (!config.dataGovApiKey) {
    throw ApiError.badRequest('Live mandi prices are not configured. Set DATA_GOV_API_KEY on the server to enable the sync.');
  }
  let updated;
  try {
    updated = await syncAgmarknet();
  } catch (err) {
    throw new ApiError(502, `Sync failed: ${err.message}`);
  }
  await audit(req, 'admin.market.sync', { summary: `${updated} records` });
  res.json({ updated });
});

export default router;
