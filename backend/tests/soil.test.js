import './helpers.js';

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { SoilAnalysis } from '../src/models/SoilAnalysis.js';
import { generateSoilAdvisory, parseSoilText, rateParameter } from '../src/services/soil.js';

let app;
let farmerToken;

before(async () => {
  await connectDb({ ephemeral: true });
  app = createApp();

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Soil Farmer', email: 'soilfarmer@test.com', password: 'Password123!' });
  farmerToken = reg.body.token;
});

after(async () => {
  await disconnectDb();
});

describe('soil service: agronomic rules & fertilizer math', () => {
  test('rates parameters accurately against ICAR benchmarks', () => {
    assert.equal(rateParameter('nitrogen', 150).rating, 'low');
    assert.equal(rateParameter('nitrogen', 350).rating, 'medium');
    assert.equal(rateParameter('nitrogen', 600).rating, 'high');
    assert.equal(rateParameter('nitrogen', null).unreadable, true);

    assert.equal(rateParameter('ph', 5.0).rating, 'strongly_acidic');
    assert.equal(rateParameter('ph', 6.0).rating, 'acidic');
    assert.equal(rateParameter('ph', 7.0).rating, 'neutral');
    assert.equal(rateParameter('ph', 8.0).rating, 'alkaline');
    assert.equal(rateParameter('ph', 9.0).rating, 'strongly_alkaline');

    assert.equal(rateParameter('ec', 0.5).rating, 'normal');
    assert.equal(rateParameter('ec', 2.5).rating, 'injurious');

    assert.equal(rateParameter('organicCarbon', 0.3).rating, 'low');
    assert.equal(rateParameter('organicCarbon', 0.9).rating, 'high');
  });

  test('parses soil text and detects unreadable fields without hallucination', () => {
    const sampleOcr = `
      GOVERNMENT OF INDIA - SOIL HEALTH CARD
      Sample ID: SHC-KA-2026-9812
      Farmer: Basavaraj
      Nitrogen (N): 210 kg/ha
      Phosphorus (P): 14.5 kg/ha
      Potassium (K): 180 kg/ha
      Soil pH: 8.2
      Electrical Conductivity (EC): 0.45 dS/m
      Organic Carbon: 0.42 %
      Zinc: 0.4 ppm
    `;

    const parsed = parseSoilText(sampleOcr);
    assert.equal(parsed.sampleId, 'SHC-KA-2026-9812');
    assert.equal(parsed.values.nitrogen, 210);
    assert.equal(parsed.values.phosphorus, 14.5);
    assert.equal(parsed.values.potassium, 180);
    assert.equal(parsed.values.ph, 8.2);
    assert.equal(parsed.values.ec, 0.45);
    assert.equal(parsed.values.organicCarbon, 0.42);
    assert.equal(parsed.values.zinc, 0.4);

    // Missing fields should be marked in unreadableFields
    assert.ok(parsed.unreadableFields.includes('iron'));
    assert.ok(parsed.unreadableFields.includes('boron'));
    assert.ok(parsed.unreadableFields.includes('sulphur'));
  });

  test('calculates correct fertilizer bag recommendations and split applications', () => {
    const advisory = generateSoilAdvisory({
      values: {
        nitrogen: 200, // low -> +25%
        phosphorus: 12, // medium -> 100%
        potassium: 300, // high -> -25%
        ph: 5.2, // strongly acidic
        organicCarbon: 0.35, // low
        zinc: 0.4, // deficient
      },
      crop: 'paddy',
      farmAreaAcre: 2,
    });

    assert.equal(advisory.cropName, 'Paddy / Rice');
    assert.equal(advisory.farmAreaAcre, 2);
    assert.ok(advisory.fertilizerPlan.ureaBags > 0);
    assert.ok(advisory.fertilizerPlan.dapBags > 0);
    assert.ok(advisory.fertilizerPlan.mopBags >= 0);
    // Lime recommended for strongly acidic soil
    assert.ok(advisory.fertilizerPlan.limeKg > 0);
    // FYM recommended for low organic carbon
    assert.ok(advisory.fertilizerPlan.fymTonnes > 0);
    // Split schedule should have 3 stages for paddy
    assert.equal(advisory.fertilizerPlan.schedule.length, 3);
    assert.ok(advisory.recommendations.some((r) => r.includes('Acidic')));
    assert.ok(advisory.recommendations.some((r) => r.includes('Zinc')));
  });
});

describe('soil API endpoints', () => {
  let createdSoilId;

  test('POST /api/soil/analyze creates a full soil advisory record', async () => {
    const res = await request(app)
      .post('/api/soil/analyze')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        crop: 'wheat',
        farmAreaAcre: 1.5,
        ocrText: 'Sample ID: TEST-SHC-101\nNitrogen: 240 kg/ha\nPhosphorus: 18 kg/ha\nPotassium: 220 kg/ha\npH: 7.2\nOrganic Carbon: 0.65%',
        notes: 'Field near northern canal',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.soil.id);
    assert.equal(res.body.soil.sampleId, 'TEST-SHC-101');
    assert.equal(res.body.soil.crop, 'wheat');
    assert.equal(res.body.soil.parameters.nitrogen.value, 240);
    assert.equal(res.body.soil.parameters.nitrogen.rating, 'low');
    assert.equal(res.body.soil.parameters.ph.rating, 'neutral');
    assert.ok(res.body.soil.fertilizerPlan.ureaBags > 0);
    assert.ok(res.body.soil.recommendations.length > 0);

    createdSoilId = res.body.soil.id;
  });

  test('GET /api/soil lists analyses for the farmer', async () => {
    const res = await request(app)
      .get('/api/soil')
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].id, createdSoilId);
  });

  test('GET /api/soil/:id retrieves analysis details', async () => {
    const res = await request(app)
      .get(`/api/soil/${createdSoilId}`)
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.soil.sampleId, 'TEST-SHC-101');
  });

  test('DELETE /api/soil/:id removes the analysis', async () => {
    const res = await request(app)
      .delete(`/api/soil/${createdSoilId}`)
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 204);

    const check = await SoilAnalysis.findById(createdSoilId);
    assert.equal(check, null);
  });
});
