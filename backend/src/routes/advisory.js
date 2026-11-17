import { Router } from 'express';
import { z } from 'zod';
import { INDIAN_CROPS } from '../data/cropCalendar.js';
import { requireAuth } from '../middleware/auth.js';
import { AdvisoryChat } from '../models/AdvisoryChat.js';
import { Farm } from '../models/Farm.js';
import { audit } from '../services/audit.js';
import { generateCropAdvisory, SUPPORTED_LANGUAGES } from '../services/advisory.js';
import { generateLlmAdvisory } from '../services/claudeAdvisor.js';
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

const HISTORY_WINDOW_MS = 2 * 60 * 60 * 1000;

router.post('/ask', async (req, res) => {
  const input = parse(askSchema, req.body);

  let farm = null;
  const context = { ...input.context };
  if (input.farmId) {
    farm = await Farm.findOne({ _id: input.farmId, owner: req.user._id });
    if (!farm) throw ApiError.badRequest('That farm does not exist');
    context.location ||= [farm.location?.district, farm.location?.state].filter(Boolean).join(', ') || farm.location?.name || '';
    context.state ||= farm.location?.state || '';
    if (!context.soilType && farm.soilType && farm.soilType !== 'other') context.soilType = farm.soilType;
    if (!context.irrigation && farm.irrigationType && farm.irrigationType !== 'other') context.irrigation = farm.irrigationType;
    if (!context.crop && farm.crops?.length) context.crop = farm.crops.join(', ');
    if (farm.areaAcres) context.areaAcres = farm.areaAcres;
  }

  // 1. Claude, with the last few turns of this conversation so it remembers the answers to its
  //    own follow-up questions. Returns null when it is not configured or cannot answer.
  const recent = await AdvisoryChat.find({ user: req.user._id, createdAt: { $gte: new Date(Date.now() - HISTORY_WINDOW_MS) } })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  const history = recent.reverse().flatMap((c) => [
    { role: 'user', content: c.query },
    { role: 'assistant', content: c.response.body },
  ]);
  const ai = await generateLlmAdvisory({
    query: input.query,
    language: input.language,
    context: { ...context, farmLocation: context.location },
    history,
  });

  // 2. Offline almanac rules.
  const rules = generateCropAdvisory({ query: input.query, language: input.language, context });
  const advisory = ai
    ? { ...rules, title: ai.title, body: ai.body, voiceSummary: ai.voiceSummary, keyActions: ai.keyActions, missingContextQuestions: ai.missingContextQuestions }
    : rules;
  const source = ai ? 'claude' : 'rules';

  const chatDoc = await AdvisoryChat.create({
    user: req.user._id,
    farm: farm?._id || null,
    query: input.query,
    language: input.language,
    crop: advisory.crop,
    detectedTopic: advisory.topic,
    source,
    model: ai?.model || '',
    response: {
      title: advisory.title,
      body: advisory.body,
      voiceSummary: advisory.voiceSummary,
      keyActions: advisory.keyActions,
      missingContextQuestions: advisory.missingContextQuestions,
    },
    contextProvided: {
      crop: context.crop || '',
      location: context.location || '',
      soilType: context.soilType || '',
      season: context.season || '',
      irrigation: context.irrigation || '',
    },
  });

  await audit(req, 'advisory.query', {
    targetType: 'AdvisoryChat',
    targetId: chatDoc._id,
    summary: `${source}: ${advisory.crop} / ${advisory.topic}`,
  });

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
    source,
    createdAt: chatDoc.createdAt,
  });
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
      source: i.source || 'rules',
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
