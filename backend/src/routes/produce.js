import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { normaliseImage, uploadImage } from '../middleware/upload.js';
import { Farm } from '../models/Farm.js';
import { ProduceGrading } from '../models/ProduceGrading.js';
import { audit } from '../services/audit.js';
import { estimateProducePrice, inspectProduceImage } from '../services/produce.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, objectId, paged, pagination, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

export async function serializeProduce(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  return {
    id: p._id.toString(),
    createdAt: p.createdAt,
    commodity: p.commodity,
    variety: p.variety,
    grade: p.grade,
    gradeLabel: p.gradeLabel,
    confidence: p.confidence,
    qualityScore: p.qualityScore,
    imageUrl: await storage.url(p.image?.key),
    metrics: p.metrics,
    defectsDetected: p.defectsDetected || [],
    priceEstimate: p.priceEstimate,
    disclaimer: p.disclaimer,
    notes: p.notes,
    farm: p.farm && p.farm._id ? { id: p.farm._id.toString(), name: p.farm.name } : p.farm ? { id: p.farm.toString() } : null,
  };
}

const gradeInputSchema = z.object({
  commodity: z.string().trim().min(2).max(40).default('Tomato'),
  market: z.string().trim().max(50).default('Kolar'),
  variety: z.string().trim().max(40).default(''),
  farmId: objectId.optional().or(z.literal('')),
  notes: z.string().trim().max(500).default(''),
});

router.post('/grade', uploadImage, async (req, res, next) => {
  try {
    const input = parse(gradeInputSchema, req.body);

    if (!req.file) {
      throw ApiError.badRequest('Please upload a clear photograph of the produce lot to be graded.');
    }

    const normalised = await normaliseImage(req.file);

    let farm = null;
    if (input.farmId) {
      farm = await Farm.findOne({ _id: input.farmId, user: req.user._id });
      if (!farm) throw ApiError.badRequest('Farm not found');
    }

    const key = `produce/${req.user._id}/${crypto.randomBytes(12).toString('hex')}.jpg`;
    await storage.save(key, normalised.buffer, 'image/jpeg');

    // Run computer vision inspection & grading
    const inspection = await inspectProduceImage(normalised.buffer);

    // Link with APMC Mandi market rates
    const priceEstimate = await estimateProducePrice({
      commodityName: input.commodity,
      marketName: input.market,
      grade: inspection.grade,
    });

    const doc = await ProduceGrading.create({
      user: req.user._id,
      farm: farm?._id || null,
      commodity: input.commodity,
      variety: input.variety,
      grade: inspection.grade,
      gradeLabel: inspection.gradeLabel,
      confidence: inspection.confidence,
      qualityScore: inspection.qualityScore,
      image: {
        key,
        width: normalised.width,
        height: normalised.height,
        bytes: normalised.bytes,
      },
      metrics: inspection.metrics,
      defectsDetected: inspection.defectsDetected,
      priceEstimate,
      notes: input.notes,
    });

    await audit(req, 'produce.grade', { produceId: doc._id, grade: doc.grade, commodity: doc.commodity });

    res.status(201).json({
      produce: await serializeProduce(doc),
      advice: inspection.agronomicAdvice,
      message: `Produce evaluated as ${inspection.grade} (${inspection.gradeLabel})`,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = parse(pagination, req.query);
    const filter = { user: req.user._id };
    if (req.query.commodity) filter.commodity = new RegExp(req.query.commodity, 'i');
    if (req.query.grade) filter.grade = req.query.grade;

    const [items, total] = await Promise.all([
      ProduceGrading.find(filter)
        .populate('farm', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ProduceGrading.countDocuments(filter),
    ]);

    res.json(paged(await Promise.all(items.map((i) => serializeProduce(i))), total, { page, limit }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    const doc = await ProduceGrading.findOne({ _id: req.params.id, user: req.user._id }).populate('farm', 'name');
    if (!doc) throw ApiError.notFound('Produce grading record not found');
    res.json({ produce: await serializeProduce(doc) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    const doc = await ProduceGrading.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) throw ApiError.notFound('Produce grading record not found');
    if (doc.image?.key) await storage.remove(doc.image.key);
    await audit(req, 'produce.delete', { produceId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
