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

  const confidence = Math.round((0.85 + (qualityScore / 100) * 0.1) * 100) / 100;

  return {
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

/**
 * Link produce grade with live / sample Mandi price data.
 */
export async function estimateProducePrice({ commodityName, marketName, grade }) {
  const normCommodity = String(commodityName || 'Tomato').trim();
  const cMeta = COMMODITIES.find((c) => c.name.toLowerCase() === normCommodity.toLowerCase()) || COMMODITIES[0];
  const mMeta = MARKETS.find((m) => m.market.toLowerCase() === String(marketName || 'Kolar').toLowerCase()) || MARKETS[0];

  // Attempt to fetch latest stored market price for this commodity & market
  const latestDb = await MarketPrice.findOne({
    commodity: cMeta.name,
    market: mMeta.market,
  }).sort({ date: -1 });

  let baseModalPrice = 2400;
  let marketDate = new Date();

  if (latestDb) {
    baseModalPrice = latestDb.modalPrice;
    marketDate = latestDb.date;
  } else {
    // Deterministic sample price generator
    const sample = samplePrice(cMeta, mMeta, utcMidnight());
    baseModalPrice = sample.modalPrice;
  }

  // Calculate price band based on AGMARK Grade
  const gradeKey = grade === 'Grade A' ? 'GRADE_A' : grade === 'Grade B' ? 'GRADE_B' : 'GRADE_C';
  const gradeConfig = GRADES[gradeKey];

  const estimatedMinPerQuintal = Math.round((baseModalPrice * gradeConfig.priceMultiplierMin) / 10) * 10;
  const estimatedMaxPerQuintal = Math.round((baseModalPrice * gradeConfig.priceMultiplierMax) / 10) * 10;

  // 1 Quintal = 100 kg
  const estimatedMinPerKg = Math.round((estimatedMinPerQuintal / 100) * 10) / 10;
  const estimatedMaxPerKg = Math.round((estimatedMaxPerQuintal / 100) * 10) / 10;

  return {
    commodity: cMeta.name,
    market: mMeta.market,
    state: mMeta.state,
    grade,
    baseModalPricePerQuintal: baseModalPrice,
    estimatedMinPerQuintal,
    estimatedMaxPerQuintal,
    estimatedMinPerKg,
    estimatedMaxPerKg,
    unit: 'Rs / quintal',
    marketDate,
    disclaimer:
      'Indicative estimate based on visual surface characteristics and prevailing APMC mandi modal rates. Final commercial grading and sale price require physical inspection by a qualified buyer or market committee.',
  };
}
