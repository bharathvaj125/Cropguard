import sharp from 'sharp';
import { COMMODITIES, MARKETS } from '../data/marketCatalogue.js';
import { MarketPrice } from '../models/MarketPrice.js';
import { samplePrice, utcMidnight } from './market.js';

/**
 * Standard AGMARK Produce Grading Rules & Benchmarks
 */
export const GRADES = {
  GRADE_A: {
    grade: 'Grade A',
    label: 'Super / Premium Class',
    minScore: 80,
    priceMultiplierMin: 1.05,
    priceMultiplierMax: 1.18,
    advice: 'Premium quality lot with excellent visual appeal and minimal blemishes. Best suited for high-value retail markets, exports, or direct-to-consumer sales to capture maximum premium.',
  },
  GRADE_B: {
    grade: 'Grade B',
    label: 'FAQ (Fair Average Quality)',
    minScore: 55,
    priceMultiplierMin: 0.95,
    priceMultiplierMax: 1.02,
    advice: 'Standard commercial grade meeting typical wholesale APMC mandi specifications. Suitable for mainstream daily auction or mandi commission agents at standard modal rates.',
  },
  GRADE_C: {
    grade: 'Grade C',
    label: 'Undergrade / Processing Class',
    minScore: 0,
    priceMultiplierMin: 0.65,
    priceMultiplierMax: 0.85,
    advice: 'Lot displays visible skin defects, uneven maturity, or surface blemishes. Recommended to sort and grade before transport, or sell directly to local food processing / canning units to avoid mandi transport losses.',
  },
};

/**
 * Visual inspection of crop produce using sharp image statistical analysis.
 */
export async function inspectProduceImage(imageBuffer) {
  let stats;
  try {
    stats = await sharp(imageBuffer).stats();
  } catch {
    throw new Error('Unable to analyze image bytes for produce grading');
  }

  // Channel statistics
  const channels = stats.channels; // [r, g, b]
  const rMean = channels[0]?.mean || 128;
  const gMean = channels[1]?.mean || 128;
  const bMean = channels[2]?.mean || 128;

  const rStdev = channels[0]?.stdev || 25;
  const gStdev = channels[1]?.stdev || 25;
  const bStdev = channels[2]?.stdev || 25;

  const avgStdev = (rStdev + gStdev + bStdev) / 3;

  // Visual uniformity is inversely correlated with high local color variance / harsh spotty patches
  const uniformity = Math.max(20, Math.min(98, Math.round(100 - avgStdev * 0.9)));

  // Defect area heuristic: excessive dark patches or extreme local pixel deviations
  const defectAreaPercent = Math.max(1, Math.min(45, Math.round((avgStdev / 75) * 20)));

  // Cleanliness score
  const surfaceCleanliness = Math.max(30, Math.min(99, 100 - defectAreaPercent * 2));

  // Overall quality score on 0-100 scale
  const qualityScore = Math.max(15, Math.min(96, Math.round(uniformity * 0.45 + surfaceCleanliness * 0.55)));

  // Classify Grade
  let gradeObj = GRADES.GRADE_C;
  if (qualityScore >= GRADES.GRADE_A.minScore) {
    gradeObj = GRADES.GRADE_A;
  } else if (qualityScore >= GRADES.GRADE_B.minScore) {
    gradeObj = GRADES.GRADE_B;
  }

  // Detect specific visual characteristics / defects
  const defectsDetected = [];
  if (defectAreaPercent > 18) {
    defectsDetected.push({
      type: 'surface_blemish',
      severity: 'moderate',
      description: 'Superficial skin spots or pigmentation variation detected on produce surface.',
    });
  }
  if (uniformity < 50) {
    defectsDetected.push({
      type: 'size_or_color_irregularity',
      severity: 'mild',
      description: 'Variation in produce size or maturity coloring within the photographed lot.',
    });
  }
  if (qualityScore < 50) {
    defectsDetected.push({
      type: 'substandard_appearance',
      severity: 'moderate',
      description: 'Lot shows signs of potential moisture loss, minor scuffs, or overripeness.',
    });
  }

  // Whole-image colour statistics cannot see individual defects, so this is a weak signal:
  // its confidence is capped well below the trained model's and the UI labels it as basic.
  const confidence = Math.round((0.25 + (qualityScore / 100) * 0.15) * 100) / 100;

  return {
    method: 'basic',
    grade: gradeObj.grade,
    gradeLabel: gradeObj.label,
    qualityScore,
    confidence,
    metrics: {
      uniformity,
      colorRipeness: Math.min(98, Math.max(40, Math.round((rMean / (gMean + 1)) * 40))),
      surfaceCleanliness,
      defectAreaPercent,
    },
    defectsDetected,
    agronomicAdvice: gradeObj.advice,
  };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Link a produce grade with mandi prices (latest stored price for the commodity and market).
 * Returns null when there is no price data for the commodity: never another commodity's price.
 */
export async function estimateProducePrice({ commodityName, marketName, grade }) {
  const wanted = String(commodityName || '').trim();
  if (!wanted) return null;
  const cMeta = COMMODITIES.find((c) => c.name.toLowerCase() === wanted.toLowerCase());
  const stored = await MarketPrice.find({ commodity: new RegExp(`^${escapeRegex(wanted)}$`, 'i') })
    .sort({ date: -1 })
    .limit(200)
    .lean();
  if (!cMeta && !stored.length) return null;

  // The farmer's market if we have it, otherwise the market with the freshest price.
  const wantedMarket = String(marketName || '').trim().toLowerCase();
  let latest = stored.find((r) => r.market.toLowerCase() === wantedMarket) || null;
  let marketNote = '';
  if (!latest && stored.length) {
    latest = stored[0];
    if (wantedMarket) marketNote = `No ${latest.commodity} price for ${marketName}; using ${latest.market}.`;
  }

  let base;
  let market;
  let state;
  let marketDate;
  if (latest) {
    base = latest.modalPrice;
    market = latest.market;
    state = latest.state;
    marketDate = latest.date;
  } else {
    const mMeta = MARKETS.find((m) => m.market.toLowerCase() === wantedMarket) || MARKETS[0];
    base = samplePrice(cMeta, mMeta, utcMidnight()).modalPrice;
    market = mMeta.market;
    state = mMeta.state;
    marketDate = utcMidnight();
  }

  const gradeKey = grade === 'Grade A' ? 'GRADE_A' : grade === 'Grade B' ? 'GRADE_B' : 'GRADE_C';
  const g = GRADES[gradeKey];
  const minQ = Math.round((base * g.priceMultiplierMin) / 10) * 10;
  const maxQ = Math.round((base * g.priceMultiplierMax) / 10) * 10;
  return {
    commodity: cMeta?.name || stored[0].commodity,
    market,
    state,
    grade,
    baseModalPricePerQuintal: base,
    estimatedMinPerQuintal: minQ,
    estimatedMaxPerQuintal: maxQ,
    estimatedMinPerKg: Math.round(minQ / 10) / 10,
    estimatedMaxPerKg: Math.round(maxQ / 10) / 10,
    unit: 'Rs / quintal',
    marketDate,
    marketNote,
    sample: latest ? latest.source === 'sample' : true,
    disclaimer:
      'Indicative estimate based on visual surface characteristics and prevailing APMC mandi modal rates. Final commercial grading and sale price require physical inspection by a qualified buyer or market committee.',
  };
}

// ---------------------------------------------------------------------------
// Grading from the trained FruitNet model and from Claude
// ---------------------------------------------------------------------------

/** Fruits the on-device produce model was trained on (FruitNet). */
export const MODEL_FRUITS = ['Apple', 'Banana', 'Guava', 'Lemon', 'Lime', 'Orange', 'Pomegranate'];
const QUALITY_TO_GRADE = { Good: 'GRADE_A', Mixed: 'GRADE_B', Bad: 'GRADE_C' };

export const isModelFruit = (commodity) => MODEL_FRUITS.some((f) => f.toLowerCase() === String(commodity || '').toLowerCase());

/**
 * Interpret the produce model's output. Labels are "<Fruit>__<Good|Mixed|Bad>".
 * The grade comes from the quality probabilities summed over all fruits; the fruit from the
 * fruit probabilities summed over all qualities.
 */
export function gradeFromModel(predictions, claimedCommodity) {
  const quality = { Good: 0, Mixed: 0, Bad: 0 };
  const fruit = {};
  for (const p of predictions) {
    const [f, q] = p.label.split('__');
    quality[q] = (quality[q] || 0) + p.confidence;
    fruit[f] = (fruit[f] || 0) + p.confidence;
  }
  const [bestQuality, qp] = Object.entries(quality).sort((a, b) => b[1] - a[1])[0];
  const [bestFruit, fp] = Object.entries(fruit).sort((a, b) => b[1] - a[1])[0];
  const g = GRADES[QUALITY_TO_GRADE[bestQuality]];
  const qualityScore = Math.round(100 * quality.Good + 60 * quality.Mixed + 15 * quality.Bad);

  const warnings = [];
  // The model has one class for lemon and lime (they look alike in photos).
  const claimed = String(claimedCommodity || '').toLowerCase().replace(/^lime$/, 'lemon');
  if (fp >= 0.7 && claimed && bestFruit.toLowerCase() !== claimed) {
    warnings.push(
      `This photo looks like ${bestFruit.toLowerCase()} (${Math.round(fp * 100)}% sure), not ${claimed}. Check the commodity before selling.`,
    );
  }
  const defectsDetected = [];
  if (quality.Bad >= 0.3) {
    defectsDetected.push({
      type: 'spoiled_or_damaged',
      severity: quality.Bad >= 0.6 ? 'severe' : 'moderate',
      description: 'Rot, bruising or damaged pieces are visible in the lot.',
    });
  }
  if (quality.Mixed >= 0.3) {
    defectsDetected.push({
      type: 'mixed_quality',
      severity: 'mild',
      description: 'The lot mixes good pieces with blemished or over-ripe ones; sorting would raise its grade.',
    });
  }
  return {
    method: 'model',
    grade: g.grade,
    gradeLabel: g.label,
    qualityScore,
    confidence: Math.round(qp * 100) / 100,
    detectedCommodity: bestFruit,
    qualityProbabilities: { good: +quality.Good.toFixed(3), mixed: +quality.Mixed.toFixed(3), bad: +quality.Bad.toFixed(3) },
    defectsDetected,
    warnings,
    agronomicAdvice: g.advice,
  };
}

const CERTAINTY = { high: 0.8, medium: 0.65, low: 0.45 };

/** Interpret Claude's AGMARK grading. */
export function gradeFromClaude(c, claimedCommodity) {
  const g = GRADES[`GRADE_${c.grade}`];
  const warnings = [];
  if (!c.matchesClaimedCommodity) {
    warnings.push(
      `This photo looks like ${c.commodityDetected.toLowerCase()}, not ${String(claimedCommodity).toLowerCase()}. Check the commodity before selling.`,
    );
  }
  if (c.certainty === 'low') warnings.push('The photo makes grading uncertain. Retake it in daylight with the whole lot in view.');
  return {
    method: 'claude',
    grade: g.grade,
    gradeLabel: g.label,
    qualityScore: { A: 85, B: 65, C: 35 }[c.grade],
    confidence: CERTAINTY[c.certainty],
    detectedCommodity: c.commodityDetected,
    defectsDetected: c.defects.map((d) => ({ type: d.type, severity: d.severity, description: d.description })),
    warnings,
    summary: c.summary,
    agronomicAdvice: g.advice,
  };
}
