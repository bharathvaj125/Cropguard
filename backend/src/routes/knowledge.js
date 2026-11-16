import { Router } from 'express';
import { DISEASES, SUPPORTED_CROPS } from '../data/diseases.js';
import { PESTS } from '../data/pests.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** What the models can recognise, for the crop selector and the reference library page. */
router.get('/', (_req, res) => {
  res.json({
    crops: SUPPORTED_CROPS,
    diseases: Object.entries(DISEASES)
      .filter(([, d]) => d.type !== 'healthy')
      .map(([label, d]) => ({ label, ...d })),
    pests: Object.entries(PESTS)
      .filter(([label]) => label !== 'no_pest')
      .map(([label, p]) => ({ label, ...p })),
  });
});

export default router;
