import { config } from '../config.js';
import { COMMODITIES, MARKETS, isPerishable } from '../data/marketCatalogue.js';
import { MarketPrice } from '../models/MarketPrice.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE_HISTORY_DAYS = 150;

export const utcMidnight = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

/** Small deterministic string hash (FNV-1a) mapped to 0..1. */
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Synthetic price for one commodity, market and day.
 *
 * The value is a pure function of its inputs (no stored random state), so missing
 * days can be filled in at any time and always come out the same. It combines a
 * yearly seasonal wave, two shorter cycles with a per-series phase, and a little
 * daily noise.
 */
export function samplePrice(commodity, market, date) {
  const day = Math.floor(date.getTime() / DAY_MS);
  const key = `${commodity.name}|${market.market}`;
  const phase = hash01(key) * Math.PI * 2;
  const seasonal = commodity.seasonal * Math.sin((2 * Math.PI * day) / 365 + hash01(commodity.name) * Math.PI * 2);
  const medium = commodity.seasonal * 0.35 * Math.sin((2 * Math.PI * day) / 47 + phase);
  const short = commodity.seasonal * 0.15 * Math.sin((2 * Math.PI * day) / 13 + phase * 1.7);
  const noise = (hash01(`${key}|${day}`) - 0.5) * 2 * commodity.noise;

  const modal = commodity.base * market.factor * (1 + seasonal + medium + short) * (1 + noise);
  const spread = 0.06 + hash01(`${key}|spread|${day}`) * 0.06;
  const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);
  return {
    modalPrice: round10(modal),
    minPrice: round10(modal * (1 - spread)),
    maxPrice: round10(modal * (1 + spread)),
  };
}

/**
 * Make sure the sample series run up to today. Called at start-up, so a demo that
 * has been switched off for a month does not show stale charts. Returns rows added.
 */
export async function ensureSampleData(today = utcMidnight()) {
  const latest = await MarketPrice.findOne({ source: 'sample' }).sort({ date: -1 }).select('date');
  const earliest = new Date(today.getTime() - (SAMPLE_HISTORY_DAYS - 1) * DAY_MS);
  let start = earliest;
  if (latest) start = new Date(Math.max(earliest.getTime(), latest.date.getTime() + DAY_MS));
  if (start > today) return 0;

  const docs = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const date = new Date(t);
    for (const commodity of COMMODITIES) {
      for (const market of MARKETS) {
        docs.push({
          commodity: commodity.name,
          state: market.state,
          district: market.district,
          market: market.market,
          date,
          source: 'sample',
          ...samplePrice(commodity, market, date),
        });
      }
    }
  }
  try {
    await MarketPrice.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors) throw err; // duplicates are fine
  }
  return docs.length;
}

// ---------------------------------------------------------------------------
// Live data: Government of India open data (Agmarknet daily mandi prices)
// ---------------------------------------------------------------------------

const AGMARKNET_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';

function parseIndianDate(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text || '').trim());
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

/**
 * Pull today's mandi prices from data.gov.in and upsert them. The feed only carries the
 * current day, so history builds up as this runs daily. Needs DATA_GOV_API_KEY.
 */
export async function syncAgmarknet({ maxRecords = 5000 } = {}) {
  if (!config.dataGovApiKey) throw new Error('DATA_GOV_API_KEY is not configured');
  let offset = 0;
  let upserted = 0;
  const pageSize = 1000;

  while (offset < maxRecords) {
    const params = new URLSearchParams({
      'api-key': config.dataGovApiKey,
      format: 'json',
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`https://api.data.gov.in/resource/${AGMARKNET_RESOURCE}?${params}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`data.gov.in responded with HTTP ${response.status}`);
    const body = await response.json();
    const records = body.records || [];
    if (records.length === 0) break;

    const ops = [];
    for (const r of records) {
      const date = parseIndianDate(r.arrival_date);
      const modalPrice = Number(r.modal_price);
      if (!date || !r.commodity || !r.market || !Number.isFinite(modalPrice) || modalPrice <= 0) continue;
      ops.push({
        updateOne: {
          filter: { commodity: r.commodity.trim(), market: r.market.trim(), date },
          update: {
            $set: {
              variety: (r.variety || '').trim(),
              state: (r.state || '').trim(),
              district: (r.district || '').trim(),
              minPrice: Number(r.min_price) || modalPrice,
              maxPrice: Number(r.max_price) || modalPrice,
              modalPrice,
              source: 'agmarknet',
            },
          },
          upsert: true,
        },
      });
    }
    if (ops.length) {
      const result = await MarketPrice.bulkWrite(ops, { ordered: false });
      upserted += result.upsertedCount + result.modifiedCount;
    }
    if (records.length < pageSize) break;
    offset += pageSize;
  }
  return upserted;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (now, then) => (then ? ((now - then) / then) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

/** Least-squares line through equally spaced points. Returns slope, intercept, residual std-dev. */
export function linearFit(ys) {
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const residuals = ys.map((y, x) => y - (intercept + slope * x));
  const sd = Math.sqrt(mean(residuals.map((r) => r * r)));
  return { slope, intercept, sd };
}

/**
 * Describe a price series (oldest first) in numbers and one plain-language recommendation.
 *
 * Trend     slope of a straight line through the last 14 prices, as % per week.
 * Outlook   that line extended 7 days, damped by 40% because short trends rarely
 *           continue at full speed. It is an indication, not a prediction.
 */
export function analyseSeries(series, commodity) {
  if (series.length < 2) return null;
  const prices = series.map((p) => p.modalPrice);
  const latest = prices.at(-1);
  const back = (days) => prices[Math.max(0, prices.length - 1 - days)];
  const last30 = prices.slice(-30);
  const last14 = prices.slice(-14);

  const fit = linearFit(last14);
  const weeklyTrendPct = (fit.slope * 7 * 100) / mean(last14);
  const trend = weeklyTrendPct > 1.5 ? 'rising' : weeklyTrendPct < -1.5 ? 'falling' : 'stable';

  const returns = last30.slice(1).map((p, i) => (p - last30[i]) / last30[i]);
  const volatilityPct = returns.length ? Math.sqrt(mean(returns.map((r) => r * r))) * 100 : 0;

  const lastDate = new Date(series.at(-1).date);
  const outlook = Array.from({ length: 7 }, (_, i) => {
    const expected = latest + fit.slope * (i + 1) * 0.6;
    const band = fit.sd * Math.sqrt(i + 1);
    return {
      date: new Date(lastDate.getTime() + (i + 1) * DAY_MS).toISOString().slice(0, 10),
      expected: Math.max(0, Math.round(expected)),
      low: Math.max(0, Math.round(expected - band)),
      high: Math.round(expected + band),
    };
  });

  const high30 = Math.max(...last30);
  const low30 = Math.min(...last30);
  const ma30 = mean(last30);
  const perishable = isPerishable(commodity);

  let action;
  let advice;
  if (trend === 'rising') {
    if (perishable) {
      action = 'sell_in_batches';
      advice = `Prices have been rising about ${Math.abs(weeklyTrendPct).toFixed(1)}% a week. ${commodity} does not store well, so sell in batches over the coming days rather than holding everything back.`;
    } else {
      action = 'hold';
      advice = `Prices have been rising about ${Math.abs(weeklyTrendPct).toFixed(1)}% a week. If you have safe storage, holding part of the stock for a week or two may fetch a better price.`;
    }
  } else if (trend === 'falling') {
    action = 'sell_now';
    advice = `Prices have been falling about ${Math.abs(weeklyTrendPct).toFixed(1)}% a week. Selling sooner is likely to be better than waiting, unless you can store until the market recovers.`;
  } else if (latest >= ma30 * 1.03) {
    action = 'sell_now';
    advice = `Prices are steady and about ${pct(latest, ma30).toFixed(0)}% above the 30-day average. This is a reasonable time to sell.`;
  } else {
    action = 'wait';
    advice = 'Prices are steady with no clear direction. Sell when it suits you and compare nearby markets below for a better rate.';
  }

  return {
    latest,
    latestDate: series.at(-1).date,
    change1dPct: round1(pct(latest, back(1))),
    change7dPct: round1(pct(latest, back(7))),
    change30dPct: round1(pct(latest, back(30))),
    average7: Math.round(mean(prices.slice(-7))),
    average30: Math.round(ma30),
    high30,
    low30,
    volatilityPct: round1(volatilityPct),
    trend,
    weeklyTrendPct: round1(weeklyTrendPct),
    outlook,
    action,
    advice,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listCommodities() {
  const rows = await MarketPrice.aggregate([
    { $group: { _id: '$commodity', markets: { $addToSet: '$market' }, latest: { $max: '$date' } } },
    { $project: { _id: 0, commodity: '$_id', markets: { $size: '$markets' }, latest: 1 } },
    { $sort: { commodity: 1 } },
  ]);
  return rows;
}

export async function listMarkets(commodity) {
  const rows = await MarketPrice.aggregate([
    { $match: { commodity } },
    { $group: { _id: '$market', state: { $first: '$state' }, district: { $first: '$district' }, latest: { $max: '$date' } } },
    { $project: { _id: 0, market: '$_id', state: 1, district: 1, latest: 1 } },
    { $sort: { state: 1, market: 1 } },
  ]);
  return rows;
}

export async function getSeries(commodity, market, days) {
  const since = new Date(utcMidnight().getTime() - (days - 1) * DAY_MS);
  const docs = await MarketPrice.find({ commodity, market, date: { $gte: since } })
    .sort({ date: 1 })
    .select('date minPrice maxPrice modalPrice source -_id')
    .lean();
  return docs.map((d) => ({ ...d, date: d.date.toISOString().slice(0, 10) }));
}

/** Latest price of one commodity in every market, best first. */
export async function compareMarkets(commodity) {
  const rows = await MarketPrice.aggregate([
    { $match: { commodity } },
    { $sort: { date: -1 } },
    { $group: { _id: '$market', state: { $first: '$state' }, date: { $first: '$date' }, modalPrice: { $first: '$modalPrice' } } },
    { $project: { _id: 0, market: '$_id', state: 1, date: 1, modalPrice: 1 } },
    { $sort: { modalPrice: -1 } },
  ]);
  // Ignore quotes more than a week older than the freshest one.
  const newest = Math.max(...rows.map((r) => r.date.getTime()), 0);
  return rows.filter((r) => newest - r.date.getTime() <= 7 * DAY_MS);
}

/**
 * One row per commodity for the overview table: latest price, weekly change and a
 * 14-point sparkline. With `market` it is that market's price, otherwise the average
 * across markets.
 */
export async function overview({ market, state, commodities } = {}) {
  const since = new Date(utcMidnight().getTime() - 20 * DAY_MS);
  const match = { date: { $gte: since } };
  if (market) match.market = market;
  if (state) match.state = state;
  if (commodities?.length) match.commodity = { $in: commodities };

  const rows = await MarketPrice.aggregate([
    { $match: match },
    { $group: { _id: { commodity: '$commodity', date: '$date' }, price: { $avg: '$modalPrice' }, sources: { $addToSet: '$source' } } },
    { $sort: { '_id.date': 1 } },
    { $group: { _id: '$_id.commodity', points: { $push: { date: '$_id.date', price: '$price' } }, sources: { $addToSet: '$sources' } } },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => {
    const prices = r.points.map((p) => Math.round(p.price));
    const latest = prices.at(-1);
    const weekAgo = prices[Math.max(0, prices.length - 8)];
    return {
      commodity: r._id,
      latest,
      latestDate: r.points.at(-1).date,
      change7dPct: round1(pct(latest, weekAgo)),
      sparkline: prices.slice(-14),
      perishable: isPerishable(r._id),
      sample: r.sources.flat().includes('sample'),
    };
  });
}
