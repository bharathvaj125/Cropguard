import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

let memoryServer = null;

/**
 * Connect to MongoDB. With MONGO_URI=memory a real mongod is started locally through
 * mongodb-memory-server and its files are kept on disk, so data survives restarts.
 */
export async function connectDb({ ephemeral = false } = {}) {
  mongoose.set('strictQuery', true);
  let uri = config.mongoUri;

  if (uri === 'memory') {
    // Keep the downloaded mongod binary inside backend/node_modules, whatever folder
    // the process was started from, so it is downloaded once and reused.
    process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(here, '../node_modules/.cache/mongodb-memory-server');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const instance = { storageEngine: 'wiredTiger' };
    if (!ephemeral) {
      fs.mkdirSync(config.mongoMemoryDir, { recursive: true });
      instance.dbPath = config.mongoMemoryDir;
    }
    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri('cropguard');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Tests start from an empty database, but only ever wipe a throw-away or *_test database.
  if (ephemeral && (memoryServer || mongoose.connection.name.endsWith('_test'))) {
    await mongoose.connection.dropDatabase().catch(() => {});
  }
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    // doCleanup:false keeps the on-disk data directory between runs.
    await memoryServer.stop({ doCleanup: false });
    memoryServer = null;
  }
}
