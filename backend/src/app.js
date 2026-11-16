import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import activityRoutes from './routes/activities.js';
import adminRoutes from './routes/admin.js';
import analysisRoutes from './routes/analyses.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import farmRoutes from './routes/farms.js';
import knowledgeRoutes from './routes/knowledge.js';
import marketRoutes from './routes/market.js';
import soilRoutes from './routes/soil.js';
import weatherRoutes from './routes/weather.js';
import { mlStatus } from './services/mlClient.js';

export function createApp() {
  const app = express();

  // Behind nginx (and CloudFront on AWS), so req.ip and rate limits use the real client address.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Uploaded images are loaded by the frontend from another origin in development.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (config.env !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.get('/api/health', async (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    const ml = await mlStatus();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      database: db ? 'connected' : 'disconnected',
      mlService: ml.online ? 'online' : 'offline',
      time: new Date().toISOString(),
    });
  });

  // General ceiling on API use per client. Auth routes have their own, stricter limit.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 240,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => config.env === 'test',
      message: { error: { message: 'Too many requests. Please slow down.' } },
    }),
  );

  if (config.storage.driver === 'local') {
    app.use(
      '/uploads',
      express.static(config.storage.localDir, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }),
    );
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/farms', farmRoutes);
  app.use('/api/analyses', analysisRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/weather', weatherRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/soil', soilRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
