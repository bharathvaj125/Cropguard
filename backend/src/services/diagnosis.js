import { config } from '../config.js';
import { diseaseInfo, labelsForCrop } from '../data/diseases.js';
import { pestInfo } from '../data/pests.js';

/**
 * Turn raw model probabilities into the result stored on an Analysis.
 * Pure functions, no I/O, so the decision rules are easy to unit-test.
 */

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * If the farmer told us the crop, discard classes for other crops and renormalise.
 * A tomato leaf cannot have apple scab, so this removes a whole family of mistakes.
 */
export function restrictToCrop(predictions, crop) {
  const allowed = new Set(labelsForCrop(crop));
  if (allowed.size === 0) return { predictions, filtered: false };
  const kept = predictions.filter((p) => allowed.has(p.label));
  const total = kept.reduce((sum, p) => sum + p.confidence, 0);
  if (kept.length === 0 || total <= 0) return { predictions, filtered: false };
  return {
    predictions: kept.map((p) => ({ label: p.label, confidence: p.confidence / total })),
    filtered: true,
  };
}

export function interpretDisease(predictions, cropHint) {
  const { predictions: ranked, filtered } = restrictToCrop(predictions, cropHint);
  const sorted = [...ranked].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const info = diseaseInfo(best.label);
  return {
    status: best.confidence >= config.thresholds.disease ? 'confident' : 'uncertain',
    label: best.label,
    name: info?.name || best.label,
    crop: info?.crop || '',
    isHealthy: info?.type === 'healthy',
    confidence: round(best.confidence),
    cropFiltered: filtered,
    top: sorted.slice(0, 3).map((p) => {
      const i = diseaseInfo(p.label);
      return { label: p.label, name: i ? `${i.crop}: ${i.name}` : p.label, confidence: round(p.confidence) };
    }),
  };
}

export function interpretPest(predictions) {
  const sorted = [...predictions].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  let status;
  if (best.label === 'no_pest') status = best.confidence >= config.thresholds.pest ? 'none' : 'uncertain';
  else status = best.confidence >= config.thresholds.pest ? 'detected' : 'uncertain';
  return {
    status,
    label: best.label,
    name: pestInfo(best.label)?.name || best.label,
    confidence: round(best.confidence),
    top: sorted.slice(0, 3).map((p) => ({
      label: p.label,
      name: pestInfo(p.label)?.name || p.label,
      confidence: round(p.confidence),
    })),
  };
}

const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };

/** Collapse the two model results into one outcome and one severity for lists and charts. */
export function summarise(disease, pest) {
  const hasDisease = disease?.status === 'confident' && !disease.isHealthy;
  const hasPest = pest?.status === 'detected';
  const diseaseClear = !disease || (disease.status === 'confident' && disease.isHealthy);
  const pestClear = !pest || pest.status === 'none';

  let outcome;
  if (hasDisease && hasPest) outcome = 'disease_and_pest';
  else if (hasDisease) outcome = 'disease';
  else if (hasPest) outcome = 'pest';
  else if (diseaseClear && pestClear) outcome = 'healthy';
  else outcome = 'inconclusive';

  const levels = [];
  if (hasDisease) levels.push(diseaseInfo(disease.label)?.severity || 'medium');
  if (hasPest) levels.push(pestInfo(pest.label)?.severity || 'medium');
  const severity = levels.sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a])[0] || 'none';

  return { outcome, severity };
}
