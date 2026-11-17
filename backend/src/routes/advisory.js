import { Router } from 'express';
import { z } from 'zod';
import { INDIAN_CROPS } from '../data/cropCalendar.js';
import { requireAuth } from '../middleware/auth.js';
import { AdvisoryChat } from '../models/AdvisoryChat.js';
import { Farm } from '../models/Farm.js';
import { audit } from '../services/audit.js';
import { generateCropAdvisory, SUPPORTED_LANGUAGES } from '../services/advisory.js';
import { ApiError } from '../utils/errors.js';
import { objectId, paged, pagination, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

const askSchema = z.object({
  query: z.string().trim().min(2).max(1000),
  language: z.string().trim().max(10).default('en'),
  farmId: objectId.optional().or(z.literal('')),
  context: z
    .object({
      location: z.string().trim().max(100).optional().default(''),
      soilType: z.string().trim().max(100).optional().default(''),
      season: z.string().trim().max(50).optional().default(''),
      irrigation: z.string().trim().max(50).optional().default(''),
      crop: z.string().trim().max(50).optional().default(''),
    })
    .default({}),
});

router.post('/ask', async (req, res, next) => {
  try {
    const input = parse(askSchema, req.body);

    let farm = null;
    let autoContext = { ...input.context };

    if (input.farmId) {
      farm = await Farm.findOne({ _id: input.farmId, user: req.user._id });
      if (farm) {
        if (!autoContext.location && farm.location?.state) autoContext.location = farm.location.state;
        if (!autoContext.soilType && farm.soilType) autoContext.soilType = farm.soilType;
        if (!autoContext.crop && farm.crop) autoContext.crop = farm.crop;
      }
    }

    const advisory = generateCropAdvisory({
      query: input.query,
      language: input.language,
      context: autoContext,
    });

    const chatDoc = await AdvisoryChat.create({
      user: req.user._id,
      farm: farm?._id || null,
      query: input.query,
      language: input.language,
      crop: advisory.crop,
      detectedTopic: advisory.topic,
      response: {
        title: advisory.title,
        body: advisory.body,
        voiceSummary: advisory.voiceSummary,
        keyActions: advisory.keyActions,
        missingContextQuestions: advisory.missingContextQuestions,
      },
      contextProvided: autoContext,
    });

    await audit(req, 'advisory.query', { crop: advisory.crop, topic: advisory.topic });

    res.json({
      id: chatDoc._id.toString(),
      query: input.query,
      language: input.language,
      crop: advisory.crop,
      cropName: advisory.cropName,
      topic: advisory.topic,
      title: advisory.title,
      body: advisory.body,
      voiceSummary: advisory.voiceSummary,
      keyActions: advisory.keyActions,
      missingContextQuestions: advisory.missingContextQuestions,
      disclaimer: advisory.disclaimer,
      createdAt: chatDoc.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/crops', (_req, res) => {
  res.json({
    crops: Object.values(INDIAN_CROPS).map((c) => ({
      id: c.id,
      name: c.name,
      season: c.season,
      soilTypes: c.soilTypes,
      idealPh: c.idealPh,
      seedRateKgPerAcre: c.seedRateKgPerAcre,
      seedTreatment: c.seedTreatment,
      criticalIrrigationStages: c.criticalIrrigationStages,
      nutrientManagement: c.nutrientManagement,
      commonRisks: c.commonRisks,
      harvestIndicator: c.harvestIndicator,
    })),
  });
});

router.get('/languages', (_req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

router.get('/history', async (req, res, next) => {
  try {
    const { page, limit } = parse(pagination, req.query);
    const filter = { user: req.user._id };

    const [items, total] = await Promise.all([
      AdvisoryChat.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AdvisoryChat.countDocuments(filter),
    ]);

    const serialized = items.map((i) => ({
      id: i._id.toString(),
      query: i.query,
      language: i.language,
      crop: i.crop,
      topic: i.detectedTopic,
      title: i.response.title,
      body: i.response.body,
      voiceSummary: i.response.voiceSummary,
      keyActions: i.response.keyActions,
      missingContextQuestions: i.response.missingContextQuestions,
      createdAt: i.createdAt,
    }));

    res.json(paged(serialized, total, { page, limit }));
  } catch (err) {
    next(err);
  }
});

export default router;
