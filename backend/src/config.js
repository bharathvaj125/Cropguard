import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
// Always read backend/.env, whichever folder the process was started from.
// Real environment variables (Docker, CI) take precedence over the file.
dotenv.config({ path: path.resolve(here, '../.env'), quiet: true });
const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT || 5000),
  // Number of proxies in front of the API (nginx = 1, CloudFront + nginx = 2), so
  // req.ip and the rate limits see the real client address.
  trustProxy: Number(env.TRUST_PROXY || 1),

  // "memory" starts a local mongod through mongodb-memory-server, so the project
  // runs on a laptop with nothing installed. Use a real URI in production.
  mongoUri: env.MONGO_URI || 'memory',
  mongoMemoryDir: env.MONGO_MEMORY_DIR || path.resolve(here, '../.data/mongo'),

  // Never fall back to a known secret in production.
  jwtSecret: isProd ? required('JWT_SECRET') : env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',

  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mlServiceUrl: (env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  mlTimeoutMs: Number(env.ML_TIMEOUT_MS || 30000),

  upload: {
    maxBytes: Number(env.UPLOAD_MAX_MB || 8) * 1024 * 1024,
    // Longest side of the stored image. Phone photos are far larger than the model needs.
    maxDimension: 1280,
  },

  storage: {
    driver: env.STORAGE_DRIVER || 'local', // 'local' | 's3'
    localDir: env.UPLOAD_DIR || path.resolve(here, '../uploads'),
    s3Bucket: env.S3_BUCKET || '',
    s3Region: env.AWS_REGION || 'ap-south-1',
    s3Prefix: env.S3_PREFIX || 'uploads/',
    s3UrlTtlSeconds: Number(env.S3_URL_TTL_SECONDS || 3600),
  },

  // Below these scores a prediction is reported as "uncertain" instead of a diagnosis.
  thresholds: {
    disease: Number(env.DISEASE_CONFIDENCE_THRESHOLD || 0.6),
    pest: Number(env.PEST_CONFIDENCE_THRESHOLD || 0.55),
  },

  // Optional. Without a key the market module serves the bundled sample series.
  dataGovApiKey: env.DATA_GOV_API_KEY || '',

  // Claude for the crop advisory. Off unless configured; the rule-based almanac answers otherwise.
  //   LLM_PROVIDER    "bedrock" | "anthropic" | "off". When unset: Bedrock if BEDROCK_MODEL_ID is
  //                   set, else the Claude API if ANTHROPIC_API_KEY is set, else off.
  llm: {
    provider: (env.LLM_PROVIDER || '').toLowerCase(),
    bedrockModelId: env.BEDROCK_MODEL_ID || '',
    bedrockRegion: env.BEDROCK_REGION || env.AWS_REGION || 'ap-south-1',
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    effort: env.LLM_EFFORT || 'medium',
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 45000),
    // Retry on another Claude model when the first one declines a request.
    refusalFallback: env.LLM_REFUSAL_FALLBACK !== 'off',
  },

  // AWS speech services. Both are off by default so local development needs no AWS account.
  speech: {
    pollyEnabled: env.POLLY_ENABLED === 'true',
    pollyRegion: env.POLLY_REGION || env.AWS_REGION || 'ap-south-1',
    transcribeEnabled: env.TRANSCRIBE_ENABLED === 'true',
    transcribeRegion: env.TRANSCRIBE_REGION || env.AWS_REGION || 'ap-south-1',
    // Below nginx's 10 MB body limit, leaving room for the multipart envelope.
    maxAudioBytes: Number(env.STT_MAX_MB || 8) * 1024 * 1024,
  },

  seed: {
    adminEmail: env.SEED_ADMIN_EMAIL || 'admin@cropguard.local',
    adminPassword: env.SEED_ADMIN_PASSWORD || '',
    farmerEmail: env.SEED_FARMER_EMAIL || 'farmer@cropguard.local',
    farmerPassword: env.SEED_FARMER_PASSWORD || '',
  },
};
