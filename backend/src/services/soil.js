/**
 * Soil Health Analysis and Agronomic Recommendation Service.
 *
 * Implements standard ICAR (Indian Council of Agricultural Research) &
 * Ministry of Agriculture and Farmers Welfare (Soil Health Card Scheme) criteria:
 * - Macro-nutrients (N, P, K) in kg/ha
 * - Soil Reaction (pH) and Salinity (EC in dS/m)
 * - Soil Organic Carbon (OC in %)
 * - Micronutrients (Zn, Fe, Cu, Mn, B, S in ppm / mg/kg)
 *
 * Calculates practical, farmer-centric recommendations:
 * - Commercial fertilizer requirements in standard Indian bag units:
 *     - Urea: 45 kg bag (46% N)
 *     - DAP: 50 kg bag (18% N, 46% P2O5)
 *     - MOP: 50 kg bag (60% K2O)
 * - pH amendments (Agricultural Lime for acidic soils, Gypsum for alkaline/sodic soils)
 * - Basal and split-application schedule for crop stages
 * - Strict adherence to SRS 5.3: flags unreadable/missing values without fabricating data.
 */

export const CROP_RDF = {
  paddy: { name: 'Paddy / Rice', n: 120, p: 60, k: 40, splits: 3 },
  rice: { name: 'Paddy / Rice', n: 120, p: 60, k: 40, splits: 3 },
  wheat: { name: 'Wheat', n: 120, p: 60, k: 40, splits: 2 },
  maize: { name: 'Maize / Corn', n: 150, p: 75, k: 40, splits: 3 },
  cotton: { name: 'Cotton', n: 120, p: 60, k: 60, splits: 3 },
  sugarcane: { name: 'Sugarcane', n: 250, p: 100, k: 120, splits: 4 },
  tomato: { name: 'Tomato', n: 150, p: 100, k: 100, splits: 3 },
  potato: { name: 'Potato', n: 180, p: 100, k: 150, splits: 2 },
  onion: { name: 'Onion', n: 100, p: 50, k: 50, splits: 2 },
  chilli: { name: 'Chilli', n: 120, p: 60, k: 60, splits: 3 },
  groundnut: { name: 'Groundnut / Peanut', n: 25, p: 50, k: 75, splits: 1 },
  soybean: { name: 'Soybean', n: 30, p: 60, k: 40, splits: 1 },
  pulses: { name: 'Pulses (Gram / Lentil / Arhar)', n: 20, p: 40, k: 20, splits: 1 },
  general: { name: 'General Field Crop', n: 100, p: 50, k: 50, splits: 2 },
};

/**
 * Classify a soil parameter based on ICAR benchmarks.
 */
export function rateParameter(name, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { rating: 'unspecified', unreadable: true };
  }

  const v = Number(value);

  switch (name) {
    case 'nitrogen':
      // kg/ha
      if (v < 280) return { rating: 'low', unreadable: false, label: 'Low (< 280 kg/ha)' };
      if (v <= 560) return { rating: 'medium', unreadable: false, label: 'Medium (280 - 560 kg/ha)' };
      return { rating: 'high', unreadable: false, label: 'High (> 560 kg/ha)' };

    case 'phosphorus':
      // kg/ha
      if (v < 10) return { rating: 'low', unreadable: false, label: 'Low (< 10 kg/ha)' };
      if (v <= 25) return { rating: 'medium', unreadable: false, label: 'Medium (10 - 25 kg/ha)' };
      return { rating: 'high', unreadable: false, label: 'High (> 25 kg/ha)' };

    case 'potassium':
      // kg/ha
      if (v < 108) return { rating: 'low', unreadable: false, label: 'Low (< 108 kg/ha)' };
      if (v <= 280) return { rating: 'medium', unreadable: false, label: 'Medium (108 - 280 kg/ha)' };
      return { rating: 'high', unreadable: false, label: 'High (> 280 kg/ha)' };

    case 'ph':
      if (v < 5.5) return { rating: 'strongly_acidic', unreadable: false, label: 'Strongly Acidic (< 5.5)' };
      if (v < 6.5) return { rating: 'acidic', unreadable: false, label: 'Moderately Acidic (5.5 - 6.5)' };
      if (v <= 7.5) return { rating: 'neutral', unreadable: false, label: 'Neutral / Ideal (6.5 - 7.5)' };
      if (v <= 8.5) return { rating: 'alkaline', unreadable: false, label: 'Moderately Alkaline (7.5 - 8.5)' };
      return { rating: 'strongly_alkaline', unreadable: false, label: 'Strongly Sodic / Alkaline (> 8.5)' };

    case 'ec':
      // dS/m
      if (v < 1.0) return { rating: 'normal', unreadable: false, label: 'Normal / Non-saline (< 1.0 dS/m)' };
      if (v <= 2.0) return { rating: 'critical', unreadable: false, label: 'Critical for germination (1.0 - 2.0 dS/m)' };
      return { rating: 'injurious', unreadable: false, label: 'Injurious / Saline (> 2.0 dS/m)' };

    case 'organicCarbon':
      // %
      if (v < 0.5) return { rating: 'low', unreadable: false, label: 'Low (< 0.50%)' };
      if (v <= 0.75) return { rating: 'medium', unreadable: false, label: 'Medium (0.50 - 0.75%)' };
      return { rating: 'high', unreadable: false, label: 'High (> 0.75%)' };

    case 'zinc':
      // ppm
      return v < 0.6
        ? { rating: 'deficient', unreadable: false, label: 'Deficient (< 0.6 ppm)' }
        : { rating: 'sufficient', unreadable: false, label: 'Sufficient (>= 0.6 ppm)' };

    case 'iron':
      // ppm
      return v < 4.5
        ? { rating: 'deficient', unreadable: false, label: 'Deficient (< 4.5 ppm)' }
        : { rating: 'sufficient', unreadable: false, label: 'Sufficient (>= 4.5 ppm)' };

    case 'sulphur':
      // ppm
      return v < 10.0
        ? { rating: 'deficient', unreadable: false, label: 'Deficient (< 10 ppm)' }
        : { rating: 'sufficient', unreadable: false, label: 'Sufficient (>= 10 ppm)' };

    case 'boron':
      // ppm
      return v < 0.5
        ? { rating: 'deficient', unreadable: false, label: 'Deficient (< 0.5 ppm)' }
        : { rating: 'sufficient', unreadable: false, label: 'Sufficient (>= 0.5 ppm)' };

    default:
      return { rating: 'unspecified', unreadable: false, label: String(v) };
  }
}

/**
 * Standard units for parameters.
 */
export const DEFAULT_UNITS = {
  nitrogen: 'kg/ha',
  phosphorus: 'kg/ha',
  potassium: 'kg/ha',
  ph: '',
  ec: 'dS/m',
  organicCarbon: '%',
  zinc: 'ppm',
  iron: 'ppm',
  sulphur: 'ppm',
  boron: 'ppm',
};

/**
 * Physically plausible ranges. A value outside these is a misread or a typo, never a
 * real soil result, so it is treated as unreadable instead of being used for fertiliser maths.
 */
export const SOIL_LIMITS = {
  nitrogen: [0, 2000],
  phosphorus: [0, 500],
  potassium: [0, 3000],
  ph: [2, 11],
  ec: [0, 20],
  organicCarbon: [0, 10],
  zinc: [0, 50],
  iron: [0, 500],
  sulphur: [0, 500],
  boron: [0, 20],
};

export const SOIL_FIELDS = Object.keys(DEFAULT_UNITS);

/** Keep plausible numbers; report the rest. */
export function sanitiseSoilValues(values = {}) {
  const clean = {};
  const rejected = [];
  for (const key of SOIL_FIELDS) {
    const raw = values[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const v = Number(raw);
    const [min, max] = SOIL_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      rejected.push({ field: key, value: raw, reason: `outside the possible range ${min}-${max}` });
      continue;
    }
    clean[key] = v;
  }
  return { values: clean, rejected };
}

/**
 * Extract numerical soil values from raw OCR text using regex heuristics.
 * Adheres to SRS: if a parameter is not detectable, it remains unreadable.
 */
export function parseSoilText(text) {
  if (!text || typeof text !== 'string') {
    return {
      values: {},
      unreadableFields: Object.keys(DEFAULT_UNITS),
      sampleId: '',
    };
  }

  const clean = text.replace(/[\r\n]+/g, ' ');
  const values = {};
  const unreadableFields = [];

  // Sample ID
  const sampleMatch = clean.match(/(?:sample\s*(?:id|no|#)|card\s*no\.?)\s*[:=-]?\s*([A-Za-z0-9\-_/]+)/i);
  const sampleId = sampleMatch ? sampleMatch[1].trim() : '';

  // Patterns for each parameter
  const patterns = {
    nitrogen: /(?:available\s*)?(?:nitrogen|nitrate|\bN\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    phosphorus: /(?:available\s*)?(?:phosphorus|phosphate|\bP\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    potassium: /(?:available\s*)?(?:potassium|potash|\bK\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    ph: /(?:soil\s*)?pH\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    ec: /(?:electrical\s*conductivity|\bEC\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    organicCarbon: /(?:organic\s*carbon|\bOC\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    zinc: /(?:available\s*)?(?:zinc|\bZn\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    iron: /(?:available\s*)?(?:iron|\bFe\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    sulphur: /(?:available\s*)?(?:sulphur|sulfur|\bS\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    boron: /(?:available\s*)?(?:boron|\bB\b)(?:\s*\([A-Za-z0-9]+\))?\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i,
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      if (!Number.isNaN(val)) {
        values[key] = val;
        continue;
      }
    }
    unreadableFields.push(key);
  }

  return { values, unreadableFields, sampleId };
}

/**
 * Generate comprehensive agronomic advisory and bag-by-bag fertilizer calculations.
 */
export function generateSoilAdvisory({ values = {}, crop = 'general', farmAreaAcre = 1 }) {
  const normCrop = crop.toLowerCase().trim();
  const rdf = CROP_RDF[normCrop] || CROP_RDF.general;
  const area = Math.max(0.1, Number(farmAreaAcre) || 1);

  const rated = {};
  const unreadable = [];

  for (const key of Object.keys(DEFAULT_UNITS)) {
    const rawVal = values[key];
    const { rating, unreadable: isUnreadable, label } = rateParameter(key, rawVal);
    if (isUnreadable) {
      unreadable.push(key);
      rated[key] = { value: null, unit: DEFAULT_UNITS[key], rating: 'unspecified', unreadable: true };
    } else {
      rated[key] = { value: Number(rawVal), unit: DEFAULT_UNITS[key], rating, unreadable: false, label };
    }
  }

  // Factor adjustments based on soil rating (ICAR standard adjustment formula)
  // Low: +25% nutrient requirement; Medium: 100%; High: -25%
  const factorN = rated.nitrogen.rating === 'low' ? 1.25 : rated.nitrogen.rating === 'high' ? 0.75 : 1.0;
  const factorP = rated.phosphorus.rating === 'low' ? 1.25 : rated.phosphorus.rating === 'high' ? 0.75 : 1.0;
  const factorK = rated.potassium.rating === 'low' ? 1.25 : rated.potassium.rating === 'high' ? 0.75 : 1.0;

  // Conversion: 1 hectare = 2.471 acres.
  // RDF values in RDF table are per hectare. Convert per acre:
  const nRequiredKgPerAcre = (rdf.n * factorN) / 2.471 * area;
  const pRequiredKgPerAcre = (rdf.p * factorP) / 2.471 * area;
  const kRequiredKgPerAcre = (rdf.k * factorK) / 2.471 * area;

  // Commercial Fertilizers:
  // 1. DAP (18% N, 46% P2O5) - 50 kg bag supplies 9 kg N and 23 kg P2O5
  const dapBags = Math.max(0, Math.round((pRequiredKgPerAcre / 23) * 10) / 10);
  const nSuppliedByDap = dapBags * 9;

  // 2. Urea (46% N) - 45 kg bag supplies 20.7 kg N
  const remainingN = Math.max(0, nRequiredKgPerAcre - nSuppliedByDap);
  const ureaBags = Math.max(0, Math.round((remainingN / 20.7) * 10) / 10);

  // 3. MOP (60% K2O) - 50 kg bag supplies 30 kg K2O
  const mopBags = Math.max(0, Math.round((kRequiredKgPerAcre / 30) * 10) / 10);

  // Soil amendments
  let gypsumKg = 0;
  let limeKg = 0;
  let fymTonnes = 0;

  const recommendations = [];

  // pH checks
  if (rated.ph.rating === 'strongly_acidic') {
    limeKg = Math.round(500 * area);
    recommendations.push(
      `🚨 Highly Acidic Soil (pH ${rated.ph.value}): Nutrient uptake is severely locked. Apply ~${limeKg} kg Agricultural Lime / Dolomite per ${area} acre(s) 3 weeks before sowing.`,
    );
  } else if (rated.ph.rating === 'acidic') {
    limeKg = Math.round(250 * area);
    recommendations.push(
      `⚠️ Moderately Acidic Soil (pH ${rated.ph.value}): Apply ~${limeKg} kg Agricultural Lime or wood ash to bring pH to optimal range (6.5 - 7.5).`,
    );
  } else if (rated.ph.rating === 'alkaline') {
    recommendations.push(
      `ℹ️ Moderately Alkaline Soil (pH ${rated.ph.value}): Avoid alkaline fertilizers. Prefer Single Super Phosphate (SSP) over DAP and use Ammonium Sulphate to release locked phosphorus.`,
    );
  } else if (rated.ph.rating === 'strongly_alkaline') {
    gypsumKg = Math.round(1000 * area);
    recommendations.push(
      `🚨 Sodic / Strongly Alkaline Soil (pH ${rated.ph.value}): High exchangeable sodium. Broadcast ~${gypsumKg} kg Gypsum per ${area} acre(s) followed by light irrigation, and sow green manure (Sesbania/Dhaincha).`,
    );
  } else if (!rated.ph.unreadable) {
    recommendations.push(`✅ Soil pH (${rated.ph.value}) is in the optimal neutral range for maximum nutrient uptake.`);
  }

  // Organic Carbon checks
  if (rated.organicCarbon.rating === 'low') {
    fymTonnes = Math.round(4 * area);
    recommendations.push(
      `🍂 Low Organic Carbon (${rated.organicCarbon.value}%): Incorporate ~${fymTonnes} tonnes of well-rotted Farm Yard Manure (FYM) or compost per ${area} acre(s) to boost water retention and soil biology.`,
    );
  } else if (rated.organicCarbon.rating === 'medium') {
    fymTonnes = Math.round(2 * area);
    recommendations.push(
      `🌱 Moderate Organic Carbon (${rated.organicCarbon.value}%): Add ~${fymTonnes} tonnes of organic compost during field preparation.`,
    );
  }

  // Electrical Conductivity (Salinity)
  if (rated.ec.rating === 'injurious') {
    recommendations.push(
      `⚠️ Elevated Salinity (EC ${rated.ec.value} dS/m): Provide adequate drainage to leach out excess salts. Avoid brackish borewell water for germination.`,
    );
  }

  // Micronutrients
  if (rated.zinc.rating === 'deficient') {
    recommendations.push(`⚡ Zinc Deficiency: Apply 10 kg Zinc Sulphate (ZnSO4 21%) per acre at basal sowing or spray 0.5% chelated zinc on foliage.`);
  }
  if (rated.iron.rating === 'deficient') {
    recommendations.push(`⚡ Iron Deficiency: Foliar spray of 0.5% Ferrous Sulphate (FeSO4) + 0.1% citric acid during vegetative growth.`);
  }
  if (rated.boron.rating === 'deficient') {
    recommendations.push(`⚡ Boron Deficiency: Apply 4 kg Borax per acre to prevent flower drop and hollow stems.`);
  }

  // Flag missing values as required by SRS
  if (unreadable.length > 0) {
    recommendations.push(
      `ℹ️ Note: Measurements for ${unreadable.join(', ')} were not detected or are missing from the card. We do not guess missing values; consult your local Krishi Vigyan Kendra (KVK) for an updated test.`,
    );
  }

  // Split Application Schedule
  const schedule = [];
  if (rdf.splits === 1) {
    schedule.push({
      stage: 'Basal (At Sowing / Planting)',
      timing: 'Day of sowing or final ploughing',
      ureaBags,
      dapBags,
      mopBags,
      notes: 'Broadcast full DAP and MOP along with urea and incorporate into the top 10 cm soil.',
    });
  } else if (rdf.splits === 2) {
    schedule.push({
      stage: 'Basal Application',
      timing: 'At sowing or transplanting',
      ureaBags: Math.round(ureaBags * 0.5 * 10) / 10,
      dapBags,
      mopBags: Math.round(mopBags * 0.75 * 10) / 10,
      notes: 'Apply all DAP, 75% MOP, and 50% Urea as basal placement.',
    });
    schedule.push({
      stage: 'Top Dressing (Vegetative / Tillering)',
      timing: '25-35 days after sowing',
      ureaBags: Math.round(ureaBags * 0.5 * 10) / 10,
      dapBags: 0,
      mopBags: Math.round(mopBags * 0.25 * 10) / 10,
      notes: 'Top dress remaining Urea and MOP under moist soil condition.',
    });
  } else {
    schedule.push({
      stage: 'Basal Application',
      timing: 'At transplanting / field preparation',
      ureaBags: Math.round(ureaBags * 0.33 * 10) / 10,
      dapBags,
      mopBags: Math.round(mopBags * 0.5 * 10) / 10,
      notes: 'Place full DAP and half of MOP 5 cm below and beside the seed row.',
    });
    schedule.push({
      stage: 'First Top Dressing (Tillering / Active Vegetative)',
      timing: '20-25 days after sowing/transplanting',
      ureaBags: Math.round(ureaBags * 0.33 * 10) / 10,
      dapBags: 0,
      mopBags: 0,
      notes: 'Broadcast after weeding when foliage is dry to avoid leaf scorching.',
    });
    schedule.push({
      stage: 'Second Top Dressing (Panicle / Flowering)',
      timing: '45-55 days after sowing/transplanting',
      ureaBags: Math.round((ureaBags - Math.round(ureaBags * 0.33 * 10) / 10 * 2) * 10) / 10,
      dapBags: 0,
      mopBags: Math.round(mopBags * 0.5 * 10) / 10,
      notes: 'Crucial for grain/fruit development and seed setting.',
    });
  }

  // Overall Health Assessment
  let healthScore = 100;
  if (rated.nitrogen.rating === 'low') healthScore -= 15;
  if (rated.phosphorus.rating === 'low') healthScore -= 15;
  if (rated.potassium.rating === 'low') healthScore -= 10;
  if (['strongly_acidic', 'strongly_alkaline'].includes(rated.ph.rating)) healthScore -= 25;
  if (['acidic', 'alkaline'].includes(rated.ph.rating)) healthScore -= 10;
  if (rated.organicCarbon.rating === 'low') healthScore -= 20;
  if (rated.ec.rating === 'injurious') healthScore -= 20;

  const overallHealth =
    healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'moderate' : 'degraded';

  return {
    cropName: rdf.name,
    farmAreaAcre: area,
    overallHealth,
    parameters: rated,
    unreadableFields: unreadable,
    fertilizerPlan: {
      ureaBags,
      dapBags,
      mopBags,
      gypsumKg,
      limeKg,
      fymTonnes,
      schedule,
    },
    recommendations,
  };
}
