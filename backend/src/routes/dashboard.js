import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Activity } from '../models/Activity.js';
import { Advisory } from '../models/Advisory.js';
import { Analysis } from '../models/Analysis.js';
import { Farm } from '../models/Farm.js';
import { overview } from '../services/market.js';
import { getForecast } from '../services/weather.js';
import { serialize } from './analyses.js';

const router = Router();
router.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;
const ISSUE_OUTCOMES = ['disease', 'pest', 'disease_and_pest'];

/**
 * Everything the farmer's home screen needs, in one request.
 * Weather and market are best-effort: if an upstream call fails the rest still loads.
 */
router.get('/', async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since8w = new Date(now.getTime() - 56 * DAY_MS);

  const [farms, totalScans, outcomeCounts, recent, weekly, upcoming, overdue, doneThisMonth, advisories] =
    await Promise.all([
      Farm.find({ owner: userId }).sort({ createdAt: 1 }),
      Analysis.countDocuments({ user: userId }),
      Analysis.aggregate([
        { $match: { user: userId, createdAt: { $gte: since30 } } },
        { $group: { _id: '$outcome', count: { $sum: 1 } } },
      ]),
      Analysis.find({ user: userId }).sort({ createdAt: -1 }).limit(5).populate('farm', 'name'),
      Analysis.aggregate([
        { $match: { user: userId, createdAt: { $gte: since8w } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: 'week', startOfWeek: 'monday' } },
            scans: { $sum: 1 },
            issues: { $sum: { $cond: [{ $in: ['$outcome', ISSUE_OUTCOMES] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Activity.find({ user: userId, status: 'planned', date: { $gte: new Date(now.getTime() - DAY_MS) } })
        .sort({ date: 1 })
        .limit(5)
        .populate('farm', 'name'),
      Activity.countDocuments({ user: userId, status: 'planned', date: { $lt: new Date(now.getTime() - DAY_MS) } }),
      Activity.countDocuments({
        user: userId,
        status: 'done',
        date: { $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) },
      }),
      Advisory.find({
        active: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

  const last30 = Object.fromEntries(outcomeCounts.map((o) => [o._id, o.count]));
  const scans30 = Object.values(last30).reduce((a, b) => a + b, 0);
  const issues30 = ISSUE_OUTCOMES.reduce((n, k) => n + (last30[k] || 0), 0);

  // Advisories are either for everyone or for one state.
  const states = new Set([req.user.location?.state, ...farms.map((f) => f.location?.state)].filter(Boolean).map((s) => s.toLowerCase()));
  const visibleAdvisories = advisories.filter((a) => !a.state || states.has(a.state.toLowerCase())).slice(0, 4);

  // Weather for the first farm that has coordinates.
  const located = farms.find((f) => f.location?.latitude != null && f.location?.longitude != null);
  let weather = null;
  if (located) {
    try {
      const f = await getForecast(located.location.latitude, located.location.longitude);
      weather = {
        farm: { id: located.id, name: located.name },
        place: located.location.name || located.name,
        current: f.current,
        today: f.daily[0],
        daily: f.daily.slice(0, 5),
        insights: f.insights.slice(0, 3),
      };
    } catch {
      weather = { farm: { id: located.id, name: located.name }, unavailable: true };
    }
  }

  // Market rows for the crops the farmer grows, or a default basket if none match.
  const grown = [...new Set(farms.flatMap((f) => f.crops))];
  let market = [];
  try {
    const all = await overview();
    const wanted = new Set(grown.map((c) => c.toLowerCase()));
    const mine = all.filter((r) => wanted.has(r.commodity.toLowerCase()));
    market = (mine.length ? mine : all).slice(0, 5);
  } catch {
    market = [];
  }

  res.json({
    stats: {
      farms: farms.length,
      totalScans,
      scans30,
      issues30,
      healthy30: last30.healthy || 0,
      healthRate30: scans30 ? Math.round(((last30.healthy || 0) / scans30) * 100) : null,
      plannedActivities: upcoming.length,
      overdueActivities: overdue,
      doneThisMonth,
    },
    weekly: weekly.map((w) => ({ week: w._id, scans: w.scans, issues: w.issues })),
    recentAnalyses: await Promise.all(recent.map((a) => serialize(a))),
    upcomingActivities: upcoming,
    advisories: visibleAdvisories,
    weather,
    market,
    hasLocatedFarm: Boolean(located),
  });
});

export default router;
