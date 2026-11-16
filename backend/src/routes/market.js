import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { analyseSeries, compareMarkets, getSeries, listCommodities, listMarkets, overview } from '../services/market.js';
import { ApiError } from '../utils/errors.js';
import { parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

const name = z.string().trim().min(1).max(60);

router.get('/commodities', async (_req, res) => {
  res.json({ commodities: await listCommodities() });
});

router.get('/markets', async (req, res) => {
  const { commodity } = parse(z.object({ commodity: name }), req.query);
  res.json({ markets: await listMarkets(commodity) });
});

router.get('/overview', async (req, res) => {
  const q = parse(z.object({ market: name.optional(), state: name.optional() }), req.query);
  res.json({ rows: await overview(q) });
});

router.get('/series', async (req, res) => {
  const q = parse(
    z.object({ commodity: name, market: name, days: z.coerce.number().int().min(7).max(365).default(90) }),
    req.query,
  );
  const [series, markets] = await Promise.all([getSeries(q.commodity, q.market, q.days), compareMarkets(q.commodity)]);
  if (series.length === 0) throw ApiError.notFound('Price data for that commodity and market');

  res.json({
    commodity: q.commodity,
    market: q.market,
    unit: 'Rs per quintal',
    // True when any point comes from the bundled demo series rather than real mandi data.
    sample: series.some((p) => p.source === 'sample'),
    series,
    insights: analyseSeries(series, q.commodity),
    markets,
  });
});

export default router;
