import { ml } from './helpers.js';

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { _setClientForTest } from '../src/services/claudeAdvisor.js';
import { ensureSampleData } from '../src/services/market.js';
import { estimateProducePrice, gradeFromClaude, gradeFromModel } from '../src/services/produce.js';
import { sanitiseSoilValues } from '../src/services/soil.js';

/**
 * The merged Track A + Track B features: Claude reading Soil Health Cards, the produce grading
 * pipeline (model -> Claude -> basic), Claude in the advisory chat, and the farm-ownership fix.
 */

const savedLlm = { ...config.llm };

/** A fake Claude client that answers according to which structured output was requested. */
function fakeClaude(answers) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async parse(params) {
          calls.push(params);
          const fields = params.output_config.format.schema.required.join(',');
          const kind = fields.includes('isSoilHealthCard') ? 'soil' : fields.includes('isProduce') ? 'produce' : 'advisory';
          const output = answers[kind];
          if (output instanceof Error) throw output;
          return { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', parsed_output: output, usage: {} };
        },
      },
    },
  };
}

const CARD = {
  isSoilHealthCard: true,
  sampleId: 'SHC-KA-2026-9812',
  values: { nitrogen: 215, phosphorus: 12.8, potassium: 290, ph: 5.8, ec: 0.35, organicCarbon: 0.42, zinc: 0.42, iron: 5.1, sulphur: 8.4, boron: null },
  notes: ['Boron is smudged on the card.'],
};

const model = (good, mixed, bad, fruit = 'Apple') => [
  { label: `${fruit}__Good`, confidence: good },
  { label: `${fruit}__Mixed`, confidence: mixed },
  { label: `${fruit}__Bad`, confidence: bad },
];

let api;
let token;
let otherToken;
let farmId;
let photo;
const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  await connectDb({ ephemeral: true });
  await ensureSampleData();
  api = request(createApp());
  token = (await api.post('/api/auth/register').send({ name: 'Integration Farmer', email: 'int@example.com', password: 'harvest2026' })).body.token;
  otherToken = (await api.post('/api/auth/register').send({ name: 'Other Farmer', email: 'other-int@example.com', password: 'harvest2026' })).body.token;
  const farm = await api
    .post('/api/farms')
    .set(auth())
    .send({ name: 'Dharwad plot', location: { name: 'Dharwad', state: 'Karnataka', district: 'Dharwad' }, soilType: 'black', irrigationType: 'borewell', crops: ['Wheat'], areaAcres: 3 });
  farmId = farm.body.farm.id;
  photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
});

after(async () => {
  Object.assign(config.llm, savedLlm);
  _setClientForTest(null);
  await disconnectDb();
});

beforeEach(() => {
  Object.assign(config.llm, savedLlm);
  _setClientForTest(null);
});

describe('soil: values, plausibility and Claude reading', () => {
  test('impossible values are rejected instead of being used', () => {
    const { values, rejected } = sanitiseSoilValues({ nitrogen: 215, ph: 40, potassium: -5, boron: null, zinc: '0.5' });
    assert.deepEqual(values, { nitrogen: 215, zinc: 0.5 });
    assert.deepEqual(rejected.map((r) => r.field), ['potassium', 'ph']);
  });

  test('typed values outside the possible range get a clear 400', async () => {
    const res = await api.post('/api/soil/analyze').set(auth()).send({ crop: 'wheat', ph: 40 });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /ph: must be at most 11/);
  });

  test('extract needs Claude; without it the farmer is told to type the values', async () => {
    const res = await api.post('/api/soil/extract').set(auth()).attach('image', photo, 'card.jpg');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.details.fallback, 'manual');
  });

  test('Claude reads the card; unreadable values stay empty, never guessed', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    const fake = fakeClaude({ soil: { ...CARD, values: { ...CARD.values, ph: 58 } } }); // 58 = misread decimal point
    _setClientForTest(fake);
    const res = await api.post('/api/soil/extract').set(auth()).attach('image', photo, 'card.jpg');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.sampleId, 'SHC-KA-2026-9812');
    assert.equal(res.body.values.nitrogen, 215);
    assert.equal(res.body.values.boron, null);
    assert.equal(res.body.values.ph, null, 'an impossible reading is dropped');
    assert.deepEqual(res.body.unreadableFields.sort(), ['boron', 'ph']);
    assert.equal(res.body.rejected[0].field, 'ph');
    // The card was sent to Claude as an image block.
    assert.equal(fake.calls[0].messages[0].content[0].type, 'image');
  });

  test('PDF cards are sent to Claude as documents', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    const fake = fakeClaude({ soil: CARD });
    _setClientForTest(fake);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF');
    const res = await api.post('/api/soil/extract').set(auth()).attach('image', pdf, { filename: 'card.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(fake.calls[0].messages[0].content[0].type, 'document');
    assert.equal(fake.calls[0].messages[0].content[0].source.media_type, 'application/pdf');
  });

  test('a photo that is not a soil report is refused', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    _setClientForTest(fakeClaude({ soil: { ...CARD, isSoilHealthCard: false } }));
    const res = await api.post('/api/soil/extract').set(auth()).attach('image', photo, 'cat.jpg');
    assert.equal(res.status, 422);
  });

  test('analyze with reviewed values, linked to the farmer\'s own farm only', async () => {
    const body = { crop: 'wheat', farmAreaAcre: 2, farmId, nitrogen: 215, phosphorus: 12.8, potassium: 290, ph: 5.8, organicCarbon: 0.42 };
    const res = await api.post('/api/soil/analyze').set(auth()).send(body);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.soil.farm.name, 'Dharwad plot');
    assert.equal(res.body.soil.valueSource, 'manual');
    assert.ok(res.body.soil.fertilizerPlan.ureaBags > 0);
    assert.ok(res.body.soil.unreadableFields.includes('boron'));

    const stolen = await api.post('/api/soil/analyze').set(auth(otherToken)).send(body);
    assert.equal(stolen.status, 400);
  });
});

describe('produce: grading pipeline and prices', () => {
  test('model output: grade from quality, fruit from fruit probabilities', () => {
    const g = gradeFromModel(model(0.8, 0.15, 0.05), 'Apple');
    assert.equal(g.method, 'model');
    assert.equal(g.grade, 'Grade A');
    assert.equal(g.confidence, 0.8);
    assert.equal(g.detectedCommodity, 'Apple');
    assert.deepEqual(g.warnings, []);

    const bad = gradeFromModel(model(0.1, 0.2, 0.7, 'Orange'), 'Apple');
    assert.equal(bad.grade, 'Grade C');
    assert.match(bad.warnings[0], /looks like orange/);
    assert.equal(bad.defectsDetected[0].severity, 'severe');

    assert.deepEqual(gradeFromModel(model(0.9, 0.05, 0.05, 'Lemon'), 'Lime').warnings, [], 'lime and lemon share a class');
  });

  test('Claude output is mapped to a grade with a coarse confidence', () => {
    const g = gradeFromClaude(
      { isProduce: true, commodityDetected: 'Tomato', matchesClaimedCommodity: true, grade: 'B', certainty: 'medium', uniformity: 'mostly_uniform', defects: [{ type: 'bruise', severity: 'mild', description: 'A few bruised tomatoes.' }], summary: 'Fair lot.' },
      'Tomato',
    );
    assert.equal(g.grade, 'Grade B');
    assert.equal(g.confidence, 0.65);
    assert.equal(g.defectsDetected.length, 1);
  });

  test('prices: never another commodity\'s price, falls back to a market that has data', async () => {
    assert.equal(await estimateProducePrice({ commodityName: 'Dragonfruit', marketName: 'Pune', grade: 'Grade A' }), null);
    const p = await estimateProducePrice({ commodityName: 'pomegranate', marketName: 'Nowhere Mandi', grade: 'Grade B' });
    assert.equal(p.commodity, 'Pomegranate');
    assert.match(p.marketNote, /No Pomegranate price for Nowhere Mandi/);
    assert.ok(p.estimatedMinPerKg > 0);
  });

  test('a known fruit is graded by the trained model', async () => {
    ml.response = { quality: {}, produce: { model: 'produce', version: 't', predictions: model(0.12, 0.18, 0.7) }, inference_ms: 30 };
    const res = await api.post('/api/produce/grade').set(auth()).attach('image', photo, 'apples.jpg').field('commodity', 'Apple').field('farmId', farmId);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.produce.method, 'model');
    assert.equal(res.body.produce.grade, 'Grade C');
    assert.equal(res.body.produce.farm.name, 'Dharwad plot');
    assert.equal(res.body.produce.qualityProbabilities.bad, 0.7);
    assert.ok(res.body.produce.priceEstimate.estimatedMaxPerKg > 0);
  });

  test('other produce uses Claude, which refuses photos that are not produce', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    _setClientForTest(fakeClaude({ produce: { isProduce: false, commodityDetected: 'shoe', matchesClaimedCommodity: false, grade: 'C', certainty: 'low', uniformity: 'varied', defects: [], summary: '' } }));
    const res = await api.post('/api/produce/grade').set(auth()).attach('image', photo, 'shoe.jpg').field('commodity', 'Onion');
    assert.equal(res.status, 422);
    assert.match(res.body.error.message, /does not look like/);
  });

  test('without the model or Claude, the basic check is labelled and low-confidence', async () => {
    const res = await api.post('/api/produce/grade').set(auth()).attach('image', photo, 'onion.jpg').field('commodity', 'Onion');
    assert.equal(res.status, 201);
    assert.equal(res.body.produce.method, 'basic');
    assert.ok(res.body.produce.confidence <= 0.4);
    assert.match(res.body.produce.warnings[0], /Basic image check/);
  });

  test('an unknown commodity is graded but gets no made-up price', async () => {
    const res = await api.post('/api/produce/grade').set(auth()).attach('image', photo, 'x.jpg').field('commodity', 'Dragonfruit');
    assert.equal(res.status, 201);
    assert.equal(res.body.produce.priceEstimate, null);
    assert.match(res.body.priceUnavailable, /No mandi price data for Dragonfruit/);
  });

  test('history filter does not accept regular expressions from the user', async () => {
    const evil = await api.get('/api/produce').query({ commodity: '(a+)+$' }).set(auth());
    assert.equal(evil.status, 200);
    assert.equal(evil.body.total, 0);
    const exact = await api.get('/api/produce').query({ commodity: 'apple' }).set(auth());
    assert.equal(exact.body.total, 1);
  });
});

describe('advisory chat: Claude first, almanac rules as backup', () => {
  test('without Claude the almanac answers and the farm fills in the context', async () => {
    const res = await api.post('/api/advisory/ask').set(auth()).send({ query: 'When should I sow wheat?', language: 'en', farmId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.source, 'rules');
    assert.equal(res.body.crop, 'wheat');
    assert.deepEqual(res.body.missingContextQuestions, [], 'the farm supplied the location');
  });

  test('with Claude: farm context and earlier turns are sent, the answer is stored', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    const fake = fakeClaude({
      advisory: {
        title: 'ಗೋಧಿ ಬಿತ್ತನೆ',
        body: '## Sowing\n- 1-20 November',
        voiceSummary: 'ನವೆಂಬರ್ ಮೊದಲ ಮೂರು ವಾರಗಳಲ್ಲಿ ಬಿತ್ತಿರಿ.',
        keyActions: ['Treat the seed'],
        missingContextQuestions: [],
      },
    });
    _setClientForTest(fake);
    const res = await api.post('/api/advisory/ask').set(auth()).send({ query: 'Gehun kab boyen?', language: 'kn', farmId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.source, 'claude');
    assert.equal(res.body.title, 'ಗೋಧಿ ಬಿತ್ತನೆ');
    assert.deepEqual(res.body.keyActions, ['Treat the seed']);

    const sent = fake.calls[0].messages;
    assert.deepEqual(sent.map((m) => m.role), ['user', 'assistant', 'user'], 'the previous turn is included');
    assert.match(sent.at(-1).content, /State: Karnataka/);
    assert.match(sent.at(-1).content, /Irrigation: borewell/);
    assert.match(sent.at(-1).content, /Kannada/);

    const hist = await api.get('/api/advisory/history').set(auth());
    assert.equal(hist.body.items[0].source, 'claude');
  });

  test('when Claude fails the almanac still answers', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    _setClientForTest(fakeClaude({ advisory: new Error('timeout') }));
    const res = await api.post('/api/advisory/ask').set(auth()).send({ query: 'Irrigation schedule for paddy?', language: 'hi' });
    assert.equal(res.status, 200);
    assert.equal(res.body.source, 'rules');
    assert.equal(res.body.crop, 'paddy');
  });

  test('another farmer\'s farm cannot be used as context', async () => {
    const res = await api.post('/api/advisory/ask').set(auth(otherToken)).send({ query: 'When should I sow wheat?', farmId });
    assert.equal(res.status, 400);
  });
});
