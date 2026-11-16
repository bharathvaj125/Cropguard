import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { diseaseInfo } from '../data/diseases.js';
import { pestInfo } from '../data/pests.js';
import { requireAuth } from '../middleware/auth.js';
import { normaliseImage, uploadImage } from '../middleware/upload.js';
import { Analysis } from '../models/Analysis.js';
import { Farm } from '../models/Farm.js';
import { audit } from '../services/audit.js';
import { interpretDisease, interpretPest, summarise } from '../services/diagnosis.js';
import { analyzeImage } from '../services/mlClient.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, objectId, paged, pagination, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

const OUTCOMES = ['healthy', 'disease', 'pest', 'disease_and_pest', 'inconclusive'];

/**
 * Shape an Analysis for the client: resolve image URLs and, for the detail view,
 * attach the knowledge-base entries for whatever was found.
 */
export async function serialize(doc, { detail = false } = {}) {
  const a = doc.toObject ? doc.toObject() : doc;
  const out = {
    id: a._id.toString(),
    createdAt: a.createdAt,
    mode: a.mode,
    cropHint: a.cropHint,
    notes: a.notes,
    outcome: a.outcome,
    severity: a.severity,
    imageUrl: await storage.url(a.image?.key),
    disease: a.disease?.label ? a.disease : null,
    pest: a.pest?.label ? a.pest : null,
    review: a.review,
    farm: a.farm && a.farm._id ? { id: a.farm._id.toString(), name: a.farm.name } : a.farm ? { id: a.farm.toString() } : null,
    user: a.user && a.user._id ? { id: a.user._id.toString(), name: a.user.name, email: a.user.email } : undefined,
  };
  if (detail) {
    out.heatmapUrl = await storage.url(a.image?.heatmapKey);
    out.image = { width: a.image?.width, height: a.image?.height };
    out.quality = a.quality;
    out.models = a.models;
    out.inferenceMs = a.inferenceMs;
    out.diseaseInfo = out.disease ? diseaseInfo(out.disease.label) : null;
    out.pestInfo = out.pest ? pestInfo(out.pest.label) : null;
  }
  return out;
}

const createSchema = z.object({
  mode: z.enum(['disease', 'pest', 'both']).default('both'),
  farmId: objectId.optional().or(z.literal('')),
  cropHint: z.string().trim().max(40).default(''),
  notes: z.string().trim().max(500).default(''),
});

router.post('/', uploadImage, async (req, res) => {
  const data = parse(createSchema, req.body);

  let farm = null;
  if (data.farmId) {
    farm = await Farm.findOne({ _id: data.farmId, owner: req.user._id });
    if (!farm) throw ApiError.badRequest('That farm does not exist');
  }

  const image = await normaliseImage(req.file);
  const ml = await analyzeImage(image.buffer, { mode: data.mode, explain: data.mode !== 'pest' });

  const disease = ml.disease ? interpretDisease(ml.disease.predictions, data.cropHint) : undefined;
  const pest = ml.pest ? interpretPest(ml.pest.predictions) : undefined;
  const { outcome, severity } = summarise(disease, pest);

  // Random, unguessable object names. Grouped by user so one user's data is easy to remove.
  const id = crypto.randomUUID();
  const key = `${req.user._id}/${id}.jpg`;
  await storage.save(key, image.buffer, 'image/jpeg');

  let heatmapKey = '';
  const heatmap = ml.disease?.heatmap_png_base64;
  if (heatmap && disease && !disease.isHealthy) {
    heatmapKey = `${req.user._id}/${id}-heatmap.png`;
    await storage.save(heatmapKey, Buffer.from(heatmap, 'base64'), 'image/png');
  }

  const analysis = await Analysis.create({
    user: req.user._id,
    farm: farm?._id || null,
    mode: data.mode,
    cropHint: data.cropHint,
    notes: data.notes,
    image: { key, heatmapKey, width: image.width, height: image.height, bytes: image.bytes },
    quality: ml.quality,
    disease,
    pest,
    outcome,
    severity,
    models: { disease: ml.disease?.version || '', pest: ml.pest?.version || '' },
    inferenceMs: ml.inference_ms,
  });

  await audit(req, 'analysis.create', {
    targetType: 'Analysis',
    targetId: analysis._id,
    summary: [outcome, disease?.name, pest?.status === 'detected' ? pest.name : ''].filter(Boolean).join(' / '),
  });

  await analysis.populate('farm', 'name');
  res.status(201).json({ analysis: await serialize(analysis, { detail: true }) });
});

const listSchema = pagination.extend({
  outcome: z.enum(OUTCOMES).optional(),
  farmId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get('/', async (req, res) => {
  const q = parse(listSchema, req.query);
  const filter = { user: req.user._id };
  if (q.outcome) filter.outcome = q.outcome;
  if (q.farmId) filter.farm = q.farmId;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = q.from;
    if (q.to) filter.createdAt.$lte = q.to;
  }
  const [docs, total] = await Promise.all([
    Analysis.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('farm', 'name'),
    Analysis.countDocuments(filter),
  ]);
  res.json(paged(await Promise.all(docs.map((d) => serialize(d))), total, q));
});

async function findOwned(req) {
  assertId(req.params.id, 'Analysis');
  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.user._id }).populate('farm', 'name');
  if (!analysis) throw ApiError.notFound('Analysis');
  return analysis;
}

router.get('/:id', async (req, res) => {
  res.json({ analysis: await serialize(await findOwned(req), { detail: true }) });
});

router.patch('/:id', async (req, res) => {
  const data = parse(z.object({ notes: z.string().trim().max(500) }), req.body);
  const analysis = await findOwned(req);
  analysis.notes = data.notes;
  await analysis.save();
  res.json({ analysis: await serialize(analysis, { detail: true }) });
});

router.delete('/:id', async (req, res) => {
  const analysis = await findOwned(req);
  await Promise.all([storage.remove(analysis.image.key), storage.remove(analysis.image.heatmapKey)]);
  await analysis.deleteOne();
  res.status(204).end();
});

export default router;
