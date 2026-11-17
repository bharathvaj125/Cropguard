import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { generateLlmAdvisory, llmStatus } from '../services/claudeAdvisor.js';
import { LANGUAGES, normaliseLanguage } from '../services/languages.js';
import { speechStatus, synthesizeSpeechWithPolly, transcribeAudio } from '../services/speech.js';
import { ApiError } from '../utils/errors.js';
import { parse } from '../utils/validate.js';

/**
 * Track B cloud endpoints, mounted at /api/advisory next to the advisory chat routes:
 *
 *   GET  /api/advisory/cloud-status   which cloud services are on, so the UI can choose
 *   POST /api/advisory/tts            { text, language }        -> { audioUrl, voice, cached }
 *   POST /api/advisory/stt            multipart audio, language -> { transcript, language, mode }
 *   POST /api/advisory/llm            { query, language, context, history } -> Claude's answer
 *
 * Each call can cost money, so they are rate-limited per signed-in user.
 */
const router = Router();
router.use(requireAuth);

const perUser = (limit) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.id}`,
    skip: () => config.env === 'test',
    message: { error: { message: 'Too many voice requests. Please wait a minute and try again.' } },
  });

const language = z
  .string()
  .trim()
  .refine((v) => normaliseLanguage(v), { message: `must be one of ${Object.keys(LANGUAGES).join(', ')}` });

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.speech.maxAudioBytes, files: 1 },
}).single('audio');

router.get('/cloud-status', async (_req, res) => {
  res.json({ llm: llmStatus(), ...(await speechStatus()) });
});

router.post('/tts', perUser(30), async (req, res) => {
  const data = parse(z.object({ text: z.string().trim().min(1, 'is required').max(5000), language }), req.body);
  res.json(await synthesizeSpeechWithPolly(data.text, data.language));
});

router.post('/stt', perUser(20), audioUpload, async (req, res) => {
  const data = parse(z.object({ language }), req.body);
  res.json(await transcribeAudio(req.file?.buffer, data.language));
});

const contextSchema = z
  .object({
    state: z.string().trim().max(60),
    district: z.string().trim().max(60),
    farmLocation: z.string().trim().max(120),
    crop: z.string().trim().max(60),
    soilType: z.string().trim().max(60),
    irrigation: z.string().trim().max(60),
    areaAcres: z.coerce.number().min(0).max(100000),
    season: z.string().trim().max(40),
  })
  .partial();

router.post('/llm', perUser(20), async (req, res) => {
  const data = parse(
    z.object({
      query: z.string().trim().min(2, 'is required').max(2000),
      language: language.default('en'),
      context: contextSchema.default({}),
      history: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
        .max(20)
        .default([]),
    }),
    req.body,
  );
  if (!llmStatus().enabled) {
    throw new ApiError(503, 'Claude is not configured on this server. Set BEDROCK_MODEL_ID or ANTHROPIC_API_KEY.', {
      fallback: 'rules',
    });
  }
  const answer = await generateLlmAdvisory(data);
  if (!answer) {
    throw new ApiError(502, 'The AI advisor could not answer right now. The offline advisory can be used instead.', {
      fallback: 'rules',
    });
  }
  res.json({
    ...answer,
    disclaimer:
      'AI guidance based on standard agronomic practices. Confirm doses and timings with your local Krishi Vigyan Kendra or agriculture officer.',
  });
});

export default router;
