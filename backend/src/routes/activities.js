import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ACTIVITY_TYPES, Activity } from '../models/Activity.js';
import { Farm } from '../models/Farm.js';
import { ApiError } from '../utils/errors.js';
import { assertId, objectId, paged, pagination, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(2, 'must be at least 2 characters').max(120),
  date: z.coerce.date(),
  status: z.enum(['planned', 'done']).default('planned'),
  farmId: objectId.nullish().or(z.literal('')),
  notes: z.string().trim().max(500).default(''),
  cost: z.coerce.number().min(0).max(1e8).default(0),
});

async function resolveFarm(userId, farmId) {
  if (!farmId) return null;
  const farm = await Farm.findOne({ _id: farmId, owner: userId }).select('_id');
  if (!farm) throw ApiError.badRequest('That farm does not exist');
  return farm._id;
}

const listSchema = pagination.extend({
  status: z.enum(['planned', 'done']).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  farmId: objectId.optional(),
});

router.get('/', async (req, res) => {
  const q = parse(listSchema, req.query);
  const filter = { user: req.user._id };
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.farmId) filter.farm = q.farmId;
  const [items, total] = await Promise.all([
    Activity.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('farm', 'name'),
    Activity.countDocuments(filter),
  ]);
  res.json(paged(items, total, q));
});

router.post('/', async (req, res) => {
  const { farmId, ...data } = parse(activitySchema, req.body);
  const activity = await Activity.create({
    ...data,
    user: req.user._id,
    farm: await resolveFarm(req.user._id, farmId),
  });
  await activity.populate('farm', 'name');
  res.status(201).json({ activity });
});

async function findOwned(req) {
  assertId(req.params.id, 'Activity');
  const activity = await Activity.findOne({ _id: req.params.id, user: req.user._id });
  if (!activity) throw ApiError.notFound('Activity');
  return activity;
}

router.put('/:id', async (req, res) => {
  const { farmId, ...data } = parse(activitySchema, req.body);
  const activity = await findOwned(req);
  activity.set({ ...data, farm: await resolveFarm(req.user._id, farmId) });
  await activity.save();
  await activity.populate('farm', 'name');
  res.json({ activity });
});

// Quick toggle from the list: planned <-> done.
router.patch('/:id/status', async (req, res) => {
  const data = parse(z.object({ status: z.enum(['planned', 'done']) }), req.body);
  const activity = await findOwned(req);
  activity.status = data.status;
  await activity.save();
  await activity.populate('farm', 'name');
  res.json({ activity });
});

router.delete('/:id', async (req, res) => {
  const activity = await findOwned(req);
  await activity.deleteOne();
  res.status(204).end();
});

export default router;
