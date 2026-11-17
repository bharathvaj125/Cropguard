import './helpers.js';

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { AdvisoryChat } from '../src/models/AdvisoryChat.js';
import { detectCrop, detectTopic, generateCropAdvisory, SUPPORTED_LANGUAGES } from '../src/services/advisory.js';

let app;
let farmerToken;

before(async () => {
  await connectDb({ ephemeral: true });
  app = createApp();

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Voice Farmer', email: 'voicefarmer@test.com', password: 'Password123!' });
  farmerToken = reg.body.token;
});

after(async () => {
  await disconnectDb();
});

describe('advisory service: crop intelligence & context awareness', () => {
  test('detectCrop accurately identifies crops and vernacular aliases', () => {
    assert.equal(detectCrop('When should I sow wheat?').id, 'wheat');
    assert.equal(detectCrop('धान की फसल में पानी कब दें?').id, 'paddy');
    assert.equal(detectCrop('பருத்தி பூச்சி தாக்குதல்').id, 'cotton');
    assert.equal(detectCrop('How to plant tomato?').id, 'tomato');
    assert.equal(detectCrop('What is the weather today?'), null);
  });

  test('detectTopic categorizes farming intents', () => {
    assert.equal(detectTopic('When is the best sowing time?'), 'sowing');
    assert.equal(detectTopic('How often to water my crops?'), 'irrigation');
    assert.equal(detectTopic('How much urea and dap fertilizer should I apply?'), 'nutrient');
    assert.equal(detectTopic('How to control bollworm insects and fungal blight?'), 'protection');
    assert.equal(detectTopic('When is the harvest time?'), 'harvest');
  });

  test('generateCropAdvisory asks for missing context when location is absent (SRS 5.4)', () => {
    const advWithoutLoc = generateCropAdvisory({
      query: 'When should I sow wheat?',
      language: 'en',
      context: {},
    });

    assert.ok(advWithoutLoc.missingContextQuestions.some((q) => q.includes('state or district')));
    assert.ok(advWithoutLoc.voiceSummary.length > 0);

    // With location supplied, missing question should not be present
    const advWithLoc = generateCropAdvisory({
      query: 'When should I sow wheat?',
      language: 'en',
      context: { location: 'Punjab' },
    });

    assert.equal(advWithLoc.missingContextQuestions.length, 0);
    assert.ok(advWithLoc.body.includes('Nov 1 - Nov 25'));
  });

  test('provides localized voice summary for Indian languages (SRS 5.1)', () => {
    const hi = generateCropAdvisory({
      query: 'गेहूं की बोआई का समय',
      language: 'hi',
      context: { location: 'Uttar Pradesh' },
    });

    assert.ok(hi.voiceSummary.includes('किसान भाई') || hi.voiceSummary.includes('बोआई'));
  });
});

describe('advisory API endpoints', () => {
  test('POST /api/advisory/ask handles questions and returns advice with voice summary', async () => {
    const res = await request(app)
      .post('/api/advisory/ask')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        query: 'What is the critical irrigation schedule for wheat?',
        language: 'en',
        context: {
          location: 'Haryana',
          irrigation: 'Borewell',
        },
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.id);
    assert.equal(res.body.crop, 'wheat');
    assert.equal(res.body.topic, 'irrigation');
    assert.ok(res.body.body.includes('Crown Root Initiation'));
    assert.ok(res.body.voiceSummary.length > 0);
    assert.ok(res.body.disclaimer.includes('Krishi Vigyan Kendra'));
  });

  test('GET /api/advisory/crops returns Indian crop almanac', async () => {
    const res = await request(app)
      .get('/api/advisory/crops')
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.crops.length >= 5);
    const wheat = res.body.crops.find((c) => c.id === 'wheat');
    assert.ok(wheat.criticalIrrigationStages.length >= 3);
  });

  test('GET /api/advisory/languages returns 8 supported Indian languages', async () => {
    const res = await request(app)
      .get('/api/advisory/languages')
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.languages.length, 8);
    assert.ok(res.body.languages.some((l) => l.code === 'hi'));
    assert.ok(res.body.languages.some((l) => l.code === 'ta'));
    assert.ok(res.body.languages.some((l) => l.code === 'te'));
  });

  test('GET /api/advisory/history returns past chat interactions', async () => {
    const res = await request(app)
      .get('/api/advisory/history')
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.ok(res.body.items[0].query.includes('irrigation schedule'));
  });
});
