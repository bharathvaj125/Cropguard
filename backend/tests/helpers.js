/**
 * Test environment. Import this file BEFORE anything from src/, because src/config.js
 * reads process.env when it is first loaded.
 *
 * - MongoDB: a throw-away in-memory instance
 * - ML service: a tiny HTTP server in this process that returns whatever
 *   `ml.response` is set to, so the real HTTP client code is exercised
 * - uploads: a temporary folder
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cropguard-test-'));

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cropguard_test';
process.env.JWT_SECRET = 'test-secret';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = uploadDir;
process.env.DATA_GOV_API_KEY = '';
process.env.SEED_ADMIN_PASSWORD = '';
process.env.SEED_FARMER_PASSWORD = '';

export const ml = {
  online: true,
  calls: 0,
  response: null,
};

export function mlResult({ disease, pest } = {}) {
  const wrap = (predictions) => ({ model: 'test', version: 'test-1', predictions });
  return {
    quality: { brightness: 0.5, sharpness: 120, warnings: [] },
    ...(disease ? { disease: wrap(disease) } : {}),
    ...(pest ? { pest: wrap(pest) } : {}),
    inference_ms: 12,
  };
}

const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    if (!ml.online) {
      res.writeHead(500).end();
      return;
    }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/models') {
      res.end(JSON.stringify({ models: [{ name: 'disease', num_classes: 38 }] }));
    } else if (req.url === '/analyze') {
      ml.calls += 1;
      res.end(JSON.stringify(ml.response));
    } else {
      res.writeHead(404).end('{}');
    }
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
server.unref();

// A module with top-level await does not hold up its siblings, so src/config.js may
// already have been loaded by now. Everything above was set synchronously and is safe;
// the port is only known here, so it is written onto the config object directly.
const { config } = await import('../src/config.js');
config.mlServiceUrl = `http://127.0.0.1:${server.address().port}`;

export function closeMl() {
  server.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
}
