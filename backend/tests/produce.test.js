import './helpers.js';

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { ProduceGrading } from '../src/models/ProduceGrading.js';
import { estimateProducePrice, inspectProduceImage } from '../src/services/produce.js';

let app;
let farmerToken;
let sampleProduceImage;

before(async () => {
  await connectDb({ ephemeral: true });
  app = createApp();

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Produce Farmer', email: 'producefarmer@test.com', password: 'Password123!' });
  farmerToken = reg.body.token;

  // Create a clean synthetic image resembling a red tomato lot
  sampleProduceImage = await sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 215, g: 45, b: 35 },
    },
  })
    .jpeg()
    .toBuffer();
});

after(async () => {
  await disconnectDb();
});

describe('produce grading service: quality inspection & price linkage', () => {
  test('inspectProduceImage grades visual characteristics and assigns AGMARK tier', async () => {
    const inspection = await inspectProduceImage(sampleProduceImage);

    assert.ok(['Grade A', 'Grade B', 'Grade C'].includes(inspection.grade));
    // The basic colour check is a weak signal and must say so through a low confidence.
    assert.equal(inspection.method, 'basic');
    assert.ok(inspection.confidence > 0 && inspection.confidence <= 0.4);
    assert.ok(inspection.qualityScore >= 0 && inspection.qualityScore <= 100);
    assert.ok(inspection.metrics.uniformity > 0);
    assert.ok(inspection.agronomicAdvice.length > 0);
  });

  test('estimateProducePrice returns accurate mandi price range and required disclaimer', async () => {
    const priceA = await estimateProducePrice({
      commodityName: 'Tomato',
      marketName: 'Kolar',
      grade: 'Grade A',
    });

    assert.equal(priceA.commodity, 'Tomato');
    assert.equal(priceA.market, 'Kolar');
    assert.ok(priceA.baseModalPricePerQuintal > 0);
    assert.ok(priceA.estimatedMinPerQuintal >= priceA.baseModalPricePerQuintal);
    assert.ok(priceA.estimatedMaxPerQuintal > priceA.estimatedMinPerQuintal);
    assert.ok(priceA.estimatedMinPerKg > 0);
    assert.ok(priceA.estimatedMaxPerKg >= priceA.estimatedMinPerKg);
    assert.ok(priceA.disclaimer.includes('Indicative estimate'));

    // Grade C should receive a discounted range
    const priceC = await estimateProducePrice({
      commodityName: 'Tomato',
      marketName: 'Kolar',
      grade: 'Grade C',
    });

    assert.ok(priceC.estimatedMaxPerQuintal < priceA.estimatedMinPerQuintal);
  });
});

describe('produce grading API endpoints', () => {
  let createdGradingId;

  test('POST /api/produce/grade evaluates uploaded produce image and returns price estimate', async () => {
    const res = await request(app)
      .post('/api/produce/grade')
      .set('Authorization', `Bearer ${farmerToken}`)
      .attach('image', sampleProduceImage, 'tomato_harvest.jpg')
      .field('commodity', 'Tomato')
      .field('market', 'Kolar')
      .field('variety', 'Vaishnavi')
      .field('notes', 'First picking from polyhouse');

    assert.equal(res.status, 201);
    assert.ok(res.body.produce.id);
    assert.equal(res.body.produce.commodity, 'Tomato');
    assert.ok(['Grade A', 'Grade B', 'Grade C'].includes(res.body.produce.grade));
    assert.ok(res.body.produce.priceEstimate.estimatedMinPerKg > 0);
    assert.ok(res.body.produce.disclaimer.includes('physical inspection'));
    assert.ok(res.body.advice.length > 0);

    createdGradingId = res.body.produce.id;
  });

  test('GET /api/produce lists gradings with pagination', async () => {
    const res = await request(app)
      .get('/api/produce')
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].id, createdGradingId);
    assert.equal(res.body.items[0].commodity, 'Tomato');
  });

  test('GET /api/produce/:id returns full detail', async () => {
    const res = await request(app)
      .get(`/api/produce/${createdGradingId}`)
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.produce.id, createdGradingId);
    assert.ok(res.body.produce.qualityScore >= 0);
  });

  test('DELETE /api/produce/:id deletes the record', async () => {
    const res = await request(app)
      .delete(`/api/produce/${createdGradingId}`)
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 204);

    const check = await ProduceGrading.findById(createdGradingId);
    assert.equal(check, null);
  });
});
