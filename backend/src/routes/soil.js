import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { normaliseDocument, uploadImage } from '../middleware/upload.js';
import { Farm } from '../models/Farm.js';
import { SoilAnalysis } from '../models/SoilAnalysis.js';
import { audit } from '../services/audit.js';
import { readSoilHealthCard, visionAvailable } from '../services/claudeVision.js';
import {
  DEFAULT_UNITS,
  generateSoilAdvisory,
  parseSoilText,
  sanitiseSoilValues,
  SOIL_FIELDS,
  SOIL_LIMITS,
} from '../services/soil.js';
import { storage } from '../services/storage.js';
import { ApiError } from '../utils/errors.js';
import { assertId, objectId, paged, pagination, parse } from '../utils/validate.js';

/**
 * Soil Doctor (SRS 5.3).
 *
 *   POST /api/soil/extract   photo or PDF of a Soil Health Card -> values for the farmer to review
 *   POST /api/soil/analyze   reviewed values (and optionally the card) -> ratings + fertiliser plan
 *   GET  /api/soil           history;  GET/DELETE /api/soil/:id
 *
 * Values come from, in order of trust: what the farmer typed or confirmed, Claude reading the
 * card, then pasted OCR text. Missing or implausible values are reported, never guessed.
 */
const router = Router();
router.use(requireAuth);

const perUser = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  skip: () => config.env === 'test',
  message: { error: { message: 'Too many soil card uploads. Please wait a minute.' } },
});

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
    documentType: s.image?.key?.endsWith('.pdf') ? 'pdf' : s.image?.key ? 'image' : null,
    valueSource: s.valueSource || 'manual',
    parameters: s.parameters,
    unreadableFields: s.unreadableFields || [],
    fertilizerPlan: s.fertilizerPlan,
    recommendations: s.recommendations || [],
    notes: s.notes,
    farm: s.farm && s.farm._id ? { id: s.farm._id.toString(), name: s.farm.name } : s.farm ? { id: s.farm.toString() } : null,
  };
}

async function readCard(file) {
  const doc = await normaliseDocument(file);
  if (!visionAvailable()) return { doc, reading: null };
  return { doc, reading: await readSoilHealthCard(doc.buffer, doc.mediaType) };
}

// Values typed by the farmer must be physically possible; anything else is a typo.
const manualNumber = (key) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .min(SOIL_LIMITS[key][0], `must be at least ${SOIL_LIMITS[key][0]}`)
      .max(SOIL_LIMITS[key][1], `must be at most ${SOIL_LIMITS[key][1]}`)
      .optional(),
  );

const analyzeSchema = z.object({
  crop: z.string().trim().max(40).default('general'),
  farmAreaAcre: z.coerce.number().min(0.1).max(1000).default(1),
  farmId: objectId.optional().or(z.literal('')),
  sampleId: z.string().trim().max(40).default(''),
  ocrText: z.string().trim().max(10000).default(''),
  notes: z.string().trim().max(1000).default(''),
  ...Object.fromEntries(SOIL_FIELDS.map((k) => [k, manualNumber(k)])),
});

router.post('/extract', perUser, uploadImage, async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please attach a photo or PDF of the Soil Health Card');
  const { reading } = await readCard(req.file);
  if (!reading) {
    throw new ApiError(
      503,
      visionAvailable()
        ? 'The card could not be read automatically right now. Please type the values from the card.'
        : 'Automatic card reading is not set up on this server. Please type the values from the card.',
      { fallback: 'manual' },
    );
  }
  if (!reading.isSoilHealthCard) {
    throw new ApiError(422, 'This does not look like a soil test report. Upload a clear photo of the Soil Health Card.');
  }
  const { values, rejected } = sanitiseSoilValues(reading.values);
  res.json({
    sampleId: reading.sampleId,
    values: Object.fromEntries(SOIL_FIELDS.map((k) => [k, values[k] ?? null])),
    units: DEFAULT_UNITS,
    unreadableFields: SOIL_FIELDS.filter((k) => values[k] === undefined),
    rejected,
    notes: reading.notes,
    source: 'claude',
  });
});

router.post('/analyze', perUser, uploadImage, async (req, res) => {
  const input = parse(analyzeSchema, req.body);

  let farm = null;
  if (input.farmId) {
    farm = await Farm.findOne({ _id: input.farmId, owner: req.user._id });
    if (!farm) throw ApiError.badRequest('That farm does not exist');
  }

  const manual = Object.fromEntries(SOIL_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  let valueSource = Object.keys(manual).length ? 'manual' : 'none';
  let resolved = { ...manual };
  let sampleId = input.sampleId;
  const extraNotes = [];

  let imageInfo = { key: '', width: 0, height: 0, bytes: 0 };
  if (req.file) {
    const { doc, reading } = Object.keys(manual).length
      ? { doc: await normaliseDocument(req.file), reading: null } // farmer already reviewed the values
      : await readCard(req.file);
    const key = `soil/${req.user._id}/${crypto.randomBytes(12).toString('hex')}.${doc.ext}`;
    await storage.save(key, doc.buffer, doc.mediaType);
    imageInfo = { key, width: doc.width || 0, height: doc.height || 0, bytes: doc.bytes };

    if (reading?.isSoilHealthCard) {
      const { values, rejected } = sanitiseSoilValues(reading.values);
      resolved = values;
      valueSource = 'claude';
      sampleId ||= reading.sampleId;
      for (const r of rejected) extraNotes.push(`The card value for ${r.field} (${r.value}) is not possible and was ignored.`);
    }
  }

  if (valueSource === 'none' && input.ocrText) {
    const ocr = parseSoilText(input.ocrText);
    const { values, rejected } = sanitiseSoilValues(ocr.values);
    resolved = values;
    valueSource = 'text';
    sampleId ||= ocr.sampleId;
    for (const r of rejected) extraNotes.push(`The pasted value for ${r.field} (${r.value}) is not possible and was ignored.`);
  }

  if (!Object.keys(resolved).length) {
    throw ApiError.badRequest(
      req.file && !visionAvailable()
        ? 'Automatic card reading is not set up. Please type the values from your Soil Health Card.'
        : 'No soil test values were found. Please type the values from your Soil Health Card.',
    );
  }

  const advisory = generateSoilAdvisory({ values: resolved, crop: input.crop, farmAreaAcre: input.farmAreaAcre });

  const doc = await SoilAnalysis.create({
    user: req.user._id,
    farm: farm?._id || null,
    sampleId: sampleId || `SHC-${Date.now().toString().slice(-6)}`,
    crop: input.crop,
    farmAreaAcre: input.farmAreaAcre,
    image: imageInfo,
    valueSource,
    parameters: advisory.parameters,
    unreadableFields: advisory.unreadableFields,
    overallHealth: advisory.overallHealth,
    fertilizerPlan: advisory.fertilizerPlan,
    recommendations: [...extraNotes, ...advisory.recommendations],
    notes: input.notes,
  });

  await audit(req, 'soil.analyze', { targetType: 'SoilAnalysis', targetId: doc._id, summary: `${doc.crop} / ${doc.overallHealth}` });
  await doc.populate('farm', 'name');
  res.status(201).json({ soil: await serializeSoil(doc), message: 'Soil analysis and fertiliser plan ready' });
});

router.get('/', async (req, res) => {
  const { page, limit } = parse(pagination, req.query);
  const filter = { user: req.user._id };
  if (req.query.farmId) filter.farm = assertId(String(req.query.farmId), 'Farm');

  const [items, total] = await Promise.all([
    SoilAnalysis.find(filter).populate('farm', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    SoilAnalysis.countDocuments(filter),
  ]);
  res.json(paged(await Promise.all(items.map((i) => serializeSoil(i))), total, { page, limit }));
});

router.get('/:id', async (req, res) => {
  assertId(req.params.id, 'Soil analysis');
  const doc = await SoilAnalysis.findOne({ _id: req.params.id, user: req.user._id }).populate('farm', 'name');
  if (!doc) throw ApiError.notFound('Soil analysis');
  res.json({ soil: await serializeSoil(doc) });
});

router.delete('/:id', async (req, res) => {
  assertId(req.params.id, 'Soil analysis');
  const doc = await SoilAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!doc) throw ApiError.notFound('Soil analysis');
  if (doc.image?.key) await storage.remove(doc.image.key);
  await audit(req, 'soil.delete', { targetType: 'SoilAnalysis', targetId: doc._id });
  res.status(204).end();
});

export default router;
