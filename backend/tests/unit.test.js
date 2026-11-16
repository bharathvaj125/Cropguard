import './helpers.js';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DISEASES, SUPPORTED_CROPS, labelsForCrop } from '../src/data/diseases.js';
import { PESTS } from '../src/data/pests.js';
import { interpretDisease, interpretPest, restrictToCrop, summarise } from '../src/services/diagnosis.js';
import { analyseSeries, linearFit, samplePrice } from '../src/services/market.js';
import { buildInsights } from '../src/services/weather.js';

describe('knowledge base', () => {
  test('covers all 38 disease classes with complete entries', () => {
    assert.equal(Object.keys(DISEASES).length, 38);
    for (const [label, d] of Object.entries(DISEASES)) {
      assert.ok(d.crop && d.name && d.summary, label);
      if (d.type !== 'healthy') {
        assert.ok(d.symptoms.length >= 2, `${label} symptoms`);
        assert.ok(d.treatment.cultural.length >= 1, `${label} cultural treatment`);
        assert.ok(d.prevention.length >= 1, `${label} prevention`);
        assert.ok(['low', 'medium', 'high'].includes(d.severity), `${label} severity`);
      }
    }
    assert.equal(SUPPORTED_CROPS.length, 14);
    assert.equal(labelsForCrop('tomato').length, 10);
  });

  test('covers all pest groups', () => {
    assert.equal(Object.keys(PESTS).length, 26); // 25 groups + no_pest
    for (const [label, p] of Object.entries(PESTS)) {
      assert.ok(p.name && p.summary && p.monitoring, label);
      if (label !== 'no_pest') assert.ok(p.management.cultural.length >= 1, label);
    }
  });
});

describe('diagnosis rules', () => {
  const preds = [
    { label: 'Apple___Apple_scab', confidence: 0.5 },
    { label: 'Tomato___Late_blight', confidence: 0.3 },
    { label: 'Tomato___healthy', confidence: 0.2 },
  ];

  test('restrictToCrop renormalises within the crop and ignores unknown crops', () => {
    const { predictions, filtered } = restrictToCrop(preds, 'Tomato');
    assert.equal(filtered, true);
    assert.equal(predictions.length, 2);
    assert.ok(Math.abs(predictions.reduce((s, p) => s + p.confidence, 0) - 1) < 1e-9);
    assert.equal(restrictToCrop(preds, 'Banana').filtered, false);
    assert.equal(restrictToCrop(preds, '').filtered, false);
  });

  test('disease below the threshold is uncertain', () => {
    assert.equal(interpretDisease(preds, '').status, 'uncertain');
    const confident = interpretDisease(preds, 'Tomato');
    assert.equal(confident.status, 'confident');
    assert.equal(confident.name, 'Late blight');
  });

  test('pest statuses', () => {
    assert.equal(interpretPest([{ label: 'no_pest', confidence: 0.9 }, { label: 'thrips', confidence: 0.1 }]).status, 'none');
    assert.equal(interpretPest([{ label: 'thrips', confidence: 0.9 }, { label: 'no_pest', confidence: 0.1 }]).status, 'detected');
    assert.equal(interpretPest([{ label: 'thrips', confidence: 0.4 }, { label: 'aphids', confidence: 0.35 }]).status, 'uncertain');
  });

  test('summarise combines both models', () => {
    const sick = { status: 'confident', isHealthy: false, label: 'Potato___Late_blight' };
    const well = { status: 'confident', isHealthy: true, label: 'Potato___healthy' };
    const unsure = { status: 'uncertain', isHealthy: false, label: 'Potato___Early_blight' };
    const bug = { status: 'detected', label: 'aphids' };
    const clear = { status: 'none', label: 'no_pest' };

    assert.deepEqual(summarise(sick, bug), { outcome: 'disease_and_pest', severity: 'high' });
    assert.deepEqual(summarise(sick, clear), { outcome: 'disease', severity: 'high' });
    assert.deepEqual(summarise(well, bug), { outcome: 'pest', severity: 'medium' });
    assert.deepEqual(summarise(well, clear), { outcome: 'healthy', severity: 'none' });
    assert.deepEqual(summarise(well, undefined), { outcome: 'healthy', severity: 'none' });
    assert.equal(summarise(unsure, clear).outcome, 'inconclusive');
    assert.equal(summarise(well, { status: 'uncertain', label: 'thrips' }).outcome, 'inconclusive');
  });
});

describe('market analysis', () => {
  const series = (prices) =>
    prices.map((modalPrice, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), modalPrice }));

  test('linearFit recovers a straight line', () => {
    const fit = linearFit([10, 12, 14, 16, 18]);
    assert.ok(Math.abs(fit.slope - 2) < 1e-9);
    assert.ok(Math.abs(fit.intercept - 10) < 1e-9);
    assert.ok(fit.sd < 1e-9);
  });

  test('rising, falling and flat series are classified and advised differently', () => {
    const rising = analyseSeries(series(Array.from({ length: 40 }, (_, i) => 2000 + i * 25)), 'Wheat');
    assert.equal(rising.trend, 'rising');
    assert.equal(rising.action, 'hold');
    assert.ok(rising.outlook[6].expected > rising.latest);

    const risingPerishable = analyseSeries(series(Array.from({ length: 40 }, (_, i) => 2000 + i * 25)), 'Tomato');
    assert.equal(risingPerishable.action, 'sell_in_batches');

    const falling = analyseSeries(series(Array.from({ length: 40 }, (_, i) => 3000 - i * 25)), 'Onion');
    assert.equal(falling.trend, 'falling');
    assert.equal(falling.action, 'sell_now');

    const flat = analyseSeries(series(Array(40).fill(2500)), 'Maize');
    assert.equal(flat.trend, 'stable');
    assert.equal(flat.change7dPct, 0);
    assert.equal(flat.volatilityPct, 0);
  });

  test('the sample generator is deterministic and keeps min <= modal <= max', () => {
    const commodity = { name: 'Tomato', base: 2200, seasonal: 0.32, noise: 0.05 };
    const market = { market: 'Pune', factor: 1.03 };
    const day = new Date(Date.UTC(2026, 10, 1));
    const a = samplePrice(commodity, market, day);
    assert.deepEqual(a, samplePrice(commodity, market, day));
    assert.ok(a.minPrice <= a.modalPrice && a.modalPrice <= a.maxPrice);
    assert.ok(a.modalPrice > 500 && a.modalPrice < 5000);
  });
});

describe('weather insights', () => {
  const day = (i, o = {}) => ({
    date: new Date(Date.UTC(2026, 10, 16 + i)).toISOString().slice(0, 10),
    tempMax: 30, tempMin: 22, rainMm: 0, rainChance: 10, windMax: 8, humidity: 60, et0: 4.5, ...o,
  });
  const types = (daily) => Object.fromEntries(buildInsights({ daily }).map((i) => [i.type, i]));

  test('dry week: irrigate, spray window, harvest window', () => {
    const t = types(Array.from({ length: 7 }, (_, i) => day(i)));
    assert.equal(t.irrigation.level, 'warning');
    assert.equal(t.spraying.level, 'good');
    assert.equal(t.harvest.level, 'good');
    assert.equal(t.disease, undefined);
  });

  test('wet, humid week: hold irrigation, no spraying, disease and heavy rain warnings', () => {
    const t = types(Array.from({ length: 7 }, (_, i) => day(i, { rainMm: i === 1 ? 70 : 12, rainChance: 90, humidity: 90, windMax: 20 })));
    assert.equal(t.irrigation.level, 'good');
    assert.equal(t.spraying.level, 'warning');
    assert.equal(t.disease.level, 'warning');
    assert.equal(t.rain.level, 'danger');
    assert.equal(t.harvest, undefined);
  });

  test('heat and frost', () => {
    assert.equal(types(Array.from({ length: 7 }, (_, i) => day(i, { tempMax: 42 }))).heat.level, 'danger');
    assert.equal(types(Array.from({ length: 7 }, (_, i) => day(i, { tempMax: 12, tempMin: 0 }))).frost.level, 'danger');
  });
});
