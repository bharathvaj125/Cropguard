import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Activity } from '../models/Activity.js';
import { Analysis } from '../models/Analysis.js';
import { Farm, IRRIGATION_TYPES, SOIL_TYPES } from '../models/Farm.js';
import { ApiError } from '../utils/errors.js';
import { assertId, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

export const farmSchema = z.object({
  name: z.string().trim().min(2, 'must be at least 2 characters').max(80),
  location: z
    .object({
      name: z.string().trim().max(120).default(''),
      state: z.string().trim().max(60).default(''),
      district: z.string().trim().max(60).default(''),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
    })
    .default({}),
  areaAcres: z.coerce.number().min(0).max(100000).default(0),
  soilType: z.enum(SOIL_TYPES).default('other'),
  irrigationType: z.enum(IRRIGATION_TYPES).default('other'),
  crops: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().trim().max(500).default(''),
});

router.get('/', async (req, res) => {
  const farms = await Farm.find({ owner: req.user._id }).sort({ createdAt: 1 });
  // How many scans each farm has, for the farm cards.
  const counts = await Analysis.aggregate([
    { $match: { user: req.user._id, farm: { $ne: null } } },
    { $group: { _id: '$farm', scans: { $sum: 1 }, issues: { $sum: { $cond: [{ $in: ['$outcome', ['disease', 'pest', 'disease_and_pest']] }, 1, 0] } } } },
  ]);
  const byFarm = new Map(counts.map((c) => [c._id.toString(), c]));
  res.json({
    farms: farms.map((f) => ({
      ...f.toJSON(),
      scans: byFarm.get(f.id)?.scans || 0,
      issues: byFarm.get(f.id)?.issues || 0,
    })),
  });
});

router.post('/', async (req, res) => {
  const data = parse(farmSchema, req.body);
  if ((await Farm.countDocuments({ owner: req.user._id })) >= 50) {
    throw ApiError.badRequest('You have reached the limit of 50 farms');
  }
  const farm = await Farm.create({ ...data, owner: req.user._id });
  res.status(201).json({ farm });
});

async function findOwned(req) {
  assertId(req.params.id, 'Farm');
  const farm = await Farm.findOne({ _id: req.params.id, owner: req.user._id });
  if (!farm) throw ApiError.notFound('Farm');
  return farm;
}

router.get('/:id', async (req, res) => {
  res.json({ farm: await findOwned(req) });
});

router.put('/:id', async (req, res) => {
  const data = parse(farmSchema, req.body);
  const farm = await findOwned(req);
  farm.set(data);
  await farm.save();
  res.json({ farm });
});

router.delete('/:id', async (req, res) => {
  const farm = await findOwned(req);
  // Keep the farmer's history; just detach it from the farm that no longer exists.
  await Promise.all([
    Analysis.updateMany({ farm: farm._id }, { $set: { farm: null } }),
    Activity.updateMany({ farm: farm._id }, { $set: { farm: null } }),
  ]);
  await farm.deleteOne();
  res.status(204).end();
});

export default router;
