import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Farm } from '../models/Farm.js';
import { geocode, getForecast } from '../services/weather.js';
import { ApiError } from '../utils/errors.js';
import { objectId, parse } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

router.get('/geocode', async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(2, 'type at least 2 letters').max(80) }), req.query);
  res.json({ results: await geocode(q) });
});

const forecastSchema = z
  .object({
    farmId: objectId.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => v.farmId || (v.lat !== undefined && v.lon !== undefined), {
    message: 'Provide a farmId, or both lat and lon',
  });

router.get('/forecast', async (req, res) => {
  const q = parse(forecastSchema, req.query);
  let { lat, lon } = q;
  let place = '';

  if (q.farmId) {
    const farm = await Farm.findOne({ _id: q.farmId, owner: req.user._id });
    if (!farm) throw ApiError.notFound('Farm');
    if (farm.location.latitude == null || farm.location.longitude == null) {
      throw ApiError.badRequest('This farm has no map location yet. Edit the farm and pick a location.');
    }
    lat = farm.location.latitude;
    lon = farm.location.longitude;
    place = farm.location.name || farm.name;
  }

  res.json({ place, ...(await getForecast(lat, lon)) });
});

export default router;
