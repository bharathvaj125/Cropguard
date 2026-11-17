import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { ensureSeedUsers } from './scripts/seedUsers.js';
import { llmStatus } from './services/claudeAdvisor.js';
import { ensureSampleData, syncAgmarknet } from './services/market.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function refreshMarketData() {
  try {
    if (config.dataGovApiKey) {
      const n = await syncAgmarknet();
      console.log(`market: synced ${n} mandi price records from data.gov.in`);
    } else {
      const n = await ensureSampleData();
      if (n) console.log(`market: added ${n} sample price rows (no DATA_GOV_API_KEY set)`);
    }
  } catch (err) {
    console.error('market: refresh failed:', err.message);
  }
}

async function main() {
  await connectDb();
  console.log(`database: connected (${config.mongoUri === 'memory' ? 'local mongod via mongodb-memory-server' : 'MONGO_URI'})`);

  await ensureSeedUsers();

  const llm = llmStatus();
  console.log(llm.enabled ? `advisory: Claude via ${llm.provider} (${llm.model})` : 'advisory: Claude not configured, rule-based answers only');
  if (llm.warning) console.warn(`advisory: ${llm.warning}`);
  console.log(`speech: Polly ${config.speech.pollyEnabled ? 'on' : 'off'}, Transcribe ${config.speech.transcribeEnabled ? 'on' : 'off'}`);
  await refreshMarketData();
  setInterval(refreshMarketData, SIX_HOURS).unref();

  const server = createApp().listen(config.port, () => {
    console.log(`api: listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
