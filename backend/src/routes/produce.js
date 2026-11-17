import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { normaliseImage, uploadImage } from '../middleware/upload.js';
import { Farm } from '../models/Farm.js';
import { ProduceGrading } from '../models/ProduceGrading.js';
import { audit } from '../services/audit.js';
import { gradeProduceWithClaude, visionAvailable } from '../services/claudeVision.js';
import { analyzeImage, mlStatus } from '../services/mlClient.js';
import {
  estimateProducePrice,
  gradeFromClaude,
  gradeFromModel,
  inspectProduceImage,
  isModelFruit,
  MODEL_FRUITS,
} from '../services/produce.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, escapeRegex, objectId, paged, pagination, parse } from '../utils/validate.js';

/**
 * Produce Grader (SRS 5.2).
 *
 *   POST /api/produce/grade   photo of a lot -> Grade A/B/C, defects, mandi price range
 *   GET  /api/produce/methods which grading methods are available for which commodities
 *   GET  /api/produce, GET/DELETE /api/produce/:id
 *
 * Grading, best method first:
 *   1. the FruitNet model (apple, banana, guava, lemon, lime, orange, pomegranate)
 *   2. Claude vision, for any produce, when configured
 *   3. a basic colour check, labelled as such and reported with low confidence
 */
const router = Router();
router.use(requireAuth);

const perUser = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  skip: () => config.env === 'test',
  message: { error: { message: 'Too many grading requests. Please wait a minute.' } },
});

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
    method: p.method || 'basic',
    detectedCommodity: p.detectedCommodity || '',
    qualityProbabilities: p.qualityProbabilities,
    warnings: p.warnings || [],
    summary: p.summary || '',
    imageUrl: await storage.url(p.image?.key),
    metrics: p.metrics,
    defectsDetected: p.defectsDetected || [],
    priceEstimate: p.priceEstimate?.commodity ? p.priceEstimate : null,
    disclaimer: p.disclaimer,
    notes: p.notes,
    farm: p.farm && p.farm._id ? { id: p.farm._id.toString(), name: p.farm.name } : p.farm ? { id: p.farm.toString() } : null,
  };
}

const gradeInputSchema = z.object({
  commodity: z.string().trim().min(2).max(40),
  market: z.string().trim().max(50).default(''),
  variety: z.string().trim().max(40).default(''),
  farmId: objectId.optional().or(z.literal('')),
  notes: z.string().trim().max(500).default(''),
});

async function modelAvailable() {
  const status = await mlStatus();
  return status.online && status.models.some((m) => m.name === 'produce');
}

router.get('/methods', async (_req, res) => {
  res.json({
    model: { available: await modelAvailable(), commodities: MODEL_FRUITS },
    claude: { available: visionAvailable() },
    basic: { available: true },
  });
});

router.post('/grade', perUser, uploadImage, async (req, res) => {
  const input = parse(gradeInputSchema, req.body);
  if (!req.file) throw ApiError.badRequest('Please upload a clear photograph of the produce lot to be graded.');
  const image = await normaliseImage(req.file);

  let farm = null;
  if (input.farmId) {
    farm = await Farm.findOne({ _id: input.farmId, owner: req.user._id });
    if (!farm) throw ApiError.badRequest('That farm does not exist');
  }

  // 1. Trained model, for the fruits it knows.
  let inspection = null;
  if (isModelFruit(input.commodity)) {
    try {
      const ml = await analyzeImage(image.buffer, { mode: 'produce', explain: false });
      if (ml.produce) inspection = gradeFromModel(ml.produce.predictions, input.commodity);
    } catch (err) {
      console.warn(`produce model unavailable: ${err.message}`);
    }
  }
  // 2. Claude vision.
  if (!inspection && visionAvailable()) {
    const claude = await gradeProduceWithClaude(image.buffer, input.commodity);
    if (claude && !claude.isProduce) {
      throw new ApiError(422, 'This photo does not look like fruit, vegetables or grain. Photograph the produce lot itself.');
    }
    if (claude) inspection = gradeFromClaude(claude, input.commodity);
  }
  // 3. Basic colour check.
  if (!inspection) {
    inspection = await inspectProduceImage(image.buffer);
    inspection.warnings = [
      'Basic image check only: it looks at overall colour, not individual defects. Treat this grade as a rough guide.',
    ];
  }

  const key = `produce/${req.user._id}/${crypto.randomBytes(12).toString('hex')}.jpg`;
  await storage.save(key, image.buffer, 'image/jpeg');

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
    method: inspection.method,
    detectedCommodity: inspection.detectedCommodity || '',
    qualityProbabilities: inspection.qualityProbabilities,
    warnings: inspection.warnings || [],
    summary: inspection.summary || '',
    image: { key, width: image.width, height: image.height, bytes: image.bytes },
    metrics: inspection.metrics,
    defectsDetected: inspection.defectsDetected,
    priceEstimate: priceEstimate || undefined,
    notes: input.notes,
  });

  await audit(req, 'produce.grade', {
    targetType: 'ProduceGrading',
    targetId: doc._id,
    summary: `${doc.commodity}: ${doc.grade} (${doc.method})`,
  });
  await doc.populate('farm', 'name');

  res.status(201).json({
    produce: await serializeProduce(doc),
    advice: inspection.agronomicAdvice,
    priceUnavailable: priceEstimate ? null : `No mandi price data for ${input.commodity} yet.`,
    message: `Produce evaluated as ${inspection.grade} (${inspection.gradeLabel})`,
  });
});

router.get('/', async (req, res) => {
  const q = parse(
    pagination.extend({
      commodity: z.string().trim().max(40).optional(),
      grade: z.enum(['Grade A', 'Grade B', 'Grade C']).optional(),
    }),
    req.query,
  );
  const filter = { user: req.user._id };
  if (q.commodity) filter.commodity = new RegExp(`^${escapeRegex(q.commodity)}$`, 'i');
  if (q.grade) filter.grade = q.grade;

  const [items, total] = await Promise.all([
    ProduceGrading.find(filter).populate('farm', 'name').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    ProduceGrading.countDocuments(filter),
  ]);
  res.json(paged(await Promise.all(items.map((i) => serializeProduce(i))), total, q));
});

router.get('/:id', async (req, res) => {
  assertId(req.params.id, 'Produce grading');
  const doc = await ProduceGrading.findOne({ _id: req.params.id, user: req.user._id }).populate('farm', 'name');
  if (!doc) throw ApiError.notFound('Produce grading');
  res.json({ produce: await serializeProduce(doc) });
});

router.delete('/:id', async (req, res) => {
  assertId(req.params.id, 'Produce grading');
  const doc = await ProduceGrading.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!doc) throw ApiError.notFound('Produce grading');
  if (doc.image?.key) await storage.remove(doc.image.key);
  await audit(req, 'produce.delete', { targetType: 'ProduceGrading', targetId: doc._id });
  res.status(204).end();
});

export default router;
