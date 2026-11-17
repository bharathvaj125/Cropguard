import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { Farm } from '../models/Farm.js';
import { SoilAnalysis } from '../models/SoilAnalysis.js';
import { audit } from '../services/audit.js';
import { generateSoilAdvisory, parseSoilText } from '../services/soil.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, objectId, paged, pagination, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

export async function serializeSoil(doc) {
  const s = doc.toObject ? doc.toObject() : doc;
  return {
    id: s._id.toString(),
    createdAt: s.createdAt,
    sampleId: s.sampleId,
    crop: s.crop,
    farmAreaAcre: s.farmAreaAcre,
    overallHealth: s.overallHealth,
    imageUrl: await storage.url(s.image?.key),
    parameters: s.parameters,
    unreadableFields: s.unreadableFields || [],
    fertilizerPlan: s.fertilizerPlan,
    recommendations: s.recommendations || [],
    notes: s.notes,
    farm: s.farm && s.farm._id ? { id: s.farm._id.toString(), name: s.farm.name } : s.farm ? { id: s.farm.toString() } : null,
  };
}

const analyzeSchema = z.object({
  crop: z.string().trim().max(40).default('general'),
  farmAreaAcre: z.coerce.number().min(0.1).max(1000).default(1),
  farmId: objectId.optional().or(z.literal('')),
  sampleId: z.string().trim().max(40).default(''),
  ocrText: z.string().trim().max(10000).default(''),
  notes: z.string().trim().max(1000).default(''),
  // Direct parameter overrides (e.g. if entered or confirmed manually)
  nitrogen: z.coerce.number().nullable().optional(),
  phosphorus: z.coerce.number().nullable().optional(),
  potassium: z.coerce.number().nullable().optional(),
  ph: z.coerce.number().nullable().optional(),
  ec: z.coerce.number().nullable().optional(),
  organicCarbon: z.coerce.number().nullable().optional(),
  zinc: z.coerce.number().nullable().optional(),
  iron: z.coerce.number().nullable().optional(),
  sulphur: z.coerce.number().nullable().optional(),
  boron: z.coerce.number().nullable().optional(),
});

router.post('/analyze', uploadImage, async (req, res, next) => {
  try {
    const input = parse(analyzeSchema, req.body);

    let farm = null;
    if (input.farmId) {
      farm = await Farm.findOne({ _id: input.farmId, user: req.user._id });
      if (!farm) throw ApiError.badRequest('Farm not found');
    }

    let imageInfo = { key: '', width: 0, height: 0, bytes: 0 };
    if (req.file) {
      const key = `soil/${req.user._id}/${crypto.randomBytes(12).toString('hex')}.jpg`;
      await storage.save(key, req.file.buffer, 'image/jpeg');
      imageInfo = { key, width: 800, height: 600, bytes: req.file.size };
    }

    // Determine parameter values:
    // First, start with values extracted from OCR text if available
    const ocrParsed = parseSoilText(input.ocrText);
    const resolvedValues = { ...ocrParsed.values };

    // Explicit user inputs take precedence if provided
    const manualKeys = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'ec', 'organicCarbon', 'zinc', 'iron', 'sulphur', 'boron'];
    for (const k of manualKeys) {
      if (input[k] !== undefined && input[k] !== null && !Number.isNaN(input[k])) {
        resolvedValues[k] = input[k];
      }
    }

    const sampleId = input.sampleId || ocrParsed.sampleId || `SHC-${Date.now().toString().slice(-6)}`;

    // Generate agronomic recommendations and fertilizer bags
    const advisory = generateSoilAdvisory({
      values: resolvedValues,
      crop: input.crop,
      farmAreaAcre: input.farmAreaAcre,
    });

    const doc = await SoilAnalysis.create({
      user: req.user._id,
      farm: farm?._id || null,
      sampleId,
      crop: input.crop,
      farmAreaAcre: input.farmAreaAcre,
      image: imageInfo,
      parameters: advisory.parameters,
      unreadableFields: advisory.unreadableFields,
      overallHealth: advisory.overallHealth,
      fertilizerPlan: advisory.fertilizerPlan,
      recommendations: advisory.recommendations,
      notes: input.notes,
    });

    await audit(req, 'soil.analyze', { soilId: doc._id, crop: doc.crop });

    res.status(201).json({
      soil: await serializeSoil(doc),
      message: 'Soil analysis and fertilizer schedule generated successfully',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = parse(pagination, req.query);
    const filter = { user: req.user._id };
    if (req.query.farmId) filter.farm = req.query.farmId;

    const [items, total] = await Promise.all([
      SoilAnalysis.find(filter)
        .populate('farm', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SoilAnalysis.countDocuments(filter),
    ]);

    res.json(paged(await Promise.all(items.map((i) => serializeSoil(i))), total, { page, limit }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    const doc = await SoilAnalysis.findOne({ _id: req.params.id, user: req.user._id }).populate('farm', 'name');
    if (!doc) throw ApiError.notFound('Soil analysis record not found');
    res.json({ soil: await serializeSoil(doc) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    const doc = await SoilAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) throw ApiError.notFound('Soil analysis record not found');
    if (doc.image?.key) await storage.remove(doc.image.key);
    await audit(req, 'soil.delete', { soilId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
