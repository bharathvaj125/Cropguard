import { closeMl, ml, mlResult, uploadDir } from './helpers.js';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { User } from '../src/models/User.js';
import { COMMODITIES } from '../src/data/marketCatalogue.js';
import { ensureSampleData } from '../src/services/market.js';

const PASSWORD = 'harvest2026';
let api;
let leafJpeg;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function register(email, name = 'Test Farmer') {
  const res = await api.post('/api/auth/register').send({ name, email, password: PASSWORD });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

before(async () => {
  await connectDb({ ephemeral: true });
  api = request(createApp());
  leafJpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 40, g: 140, b: 60 } } })
    .jpeg()
    .toBuffer();
});

after(async () => {
  await disconnectDb();
  closeMl();
});

describe('auth', () => {
  test('register returns a token and never the password hash', async () => {
    const { token, user } = await register('asha@example.com', 'Asha');
    assert.ok(token);
    assert.equal(user.email, 'asha@example.com');
    assert.equal(user.role, 'farmer');
    assert.equal(user.passwordHash, undefined);
  });

  test('rejects a duplicate email and a weak password', async () => {
    const dup = await api.post('/api/auth/register').send({ name: 'Asha', email: 'ASHA@example.com', password: PASSWORD });
    assert.equal(dup.status, 409);
    const weak = await api.post('/api/auth/register').send({ name: 'Bo', email: 'bo@example.com', password: 'short' });
    assert.equal(weak.status, 400);
    assert.match(weak.body.error.message, /password/);
  });

  test('a client cannot make itself an admin at sign-up', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@example.com', password: PASSWORD, role: 'admin', isActive: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'farmer');
  });

  test('login works and wrong credentials give one generic message', async () => {
    const ok = await api.post('/api/auth/login').send({ email: 'asha@example.com', password: PASSWORD });
    assert.equal(ok.status, 200);
    const wrong = await api.post('/api/auth/login').send({ email: 'asha@example.com', password: 'nope12345' });
    const missing = await api.post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    assert.equal(wrong.body.error.message, missing.body.error.message);
  });

  test('protected routes need a valid token', async () => {
    assert.equal((await api.get('/api/auth/me')).status, 401);
    assert.equal((await api.get('/api/auth/me').set(auth('garbage'))).status, 401);
  });

  test('profile update and password change; the old token stops working', async () => {
    const { token } = await register('ravi@example.com', 'Ravi');
    const upd = await api.patch('/api/auth/me').set(auth(token)).send({ phone: '9876543210', location: { state: 'Kerala' } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.user.location.state, 'Kerala');

    // The token's issued-at time has one-second resolution.
    await new Promise((r) => setTimeout(r, 2100));
    const change = await api
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'monsoon2027' });
    assert.equal(change.status, 200);
    assert.equal((await api.get('/api/auth/me').set(auth(token))).status, 401);
    assert.equal((await api.get('/api/auth/me').set(auth(change.body.token))).status, 200);
  });
});

describe('farms and activities', () => {
  let a;
  let b;
  let farmId;

  before(async () => {
    a = (await register('farm-a@example.com')).token;
    b = (await register('farm-b@example.com')).token;
  });

  test('create, list, update', async () => {
    const created = await api
      .post('/api/farms')
      .set(auth(a))
      .send({ name: 'North field', areaAcres: 3, crops: ['Tomato'], location: { name: 'Pune', latitude: 18.52, longitude: 73.85 } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    farmId = created.body.farm.id;

    const list = await api.get('/api/farms').set(auth(a));
    assert.equal(list.body.farms.length, 1);
    assert.equal(list.body.farms[0].scans, 0);

    const upd = await api.put(`/api/farms/${farmId}`).set(auth(a)).send({ name: 'North field', areaAcres: 5, soilType: 'black' });
    assert.equal(upd.body.farm.areaAcres, 5);
  });

  test('validation errors are 400 with a readable message', async () => {
    const res = await api.post('/api/farms').set(auth(a)).send({ name: 'X', soilType: 'moon dust' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.length >= 1);
  });

  test("one farmer cannot read, change or delete another farmer's farm", async () => {
    assert.equal((await api.get(`/api/farms/${farmId}`).set(auth(b))).status, 404);
    assert.equal((await api.put(`/api/farms/${farmId}`).set(auth(b)).send({ name: 'Mine now' })).status, 404);
    assert.equal((await api.delete(`/api/farms/${farmId}`).set(auth(b))).status, 404);
    assert.equal((await api.get('/api/farms').set(auth(b))).body.farms.length, 0);
  });

  test('activities: create against own farm only, toggle status, list', async () => {
    const body = { type: 'irrigation', title: 'Evening irrigation', date: '2026-11-20', farmId };
    assert.equal((await api.post('/api/activities').set(auth(b)).send(body)).status, 400);

    const created = await api.post('/api/activities').set(auth(a)).send(body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.activity.farm.name, 'North field');

    const done = await api.patch(`/api/activities/${created.body.activity.id}/status`).set(auth(a)).send({ status: 'done' });
    assert.equal(done.body.activity.status, 'done');

    const list = await api.get('/api/activities?status=done').set(auth(a));
    assert.equal(list.body.total, 1);
  });
});

describe('crop analysis', () => {
  let token;
  let other;
  let analysisId;

  before(async () => {
    token = (await register('scan@example.com')).token;
    other = (await register('scan-other@example.com')).token;
  });

  test('a confident disease result is stored with advice attached', async () => {
    ml.response = mlResult({
      disease: [
        { label: 'Tomato___Late_blight', confidence: 0.93 },
        { label: 'Tomato___Early_blight', confidence: 0.05 },
        { label: 'Potato___Late_blight', confidence: 0.02 },
      ],
      pest: [
        { label: 'no_pest', confidence: 0.97 },
        { label: 'aphids', confidence: 0.03 },
      ],
    });
    const res = await api.post('/api/analyses').set(auth(token)).field('mode', 'both').attach('image', leafJpeg, 'leaf.jpg');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body.analysis;
    analysisId = a.id;
    assert.equal(a.outcome, 'disease');
    assert.equal(a.severity, 'high');
    assert.equal(a.disease.name, 'Late blight');
    assert.equal(a.disease.status, 'confident');
    assert.equal(a.pest.status, 'none');
    assert.equal(a.diseaseInfo.pathogen, 'Phytophthora infestans');
    assert.ok(a.diseaseInfo.treatment.chemical.length > 0);

    // The stored file exists and is a normalised JPEG.
    const stored = path.join(uploadDir, a.imageUrl.replace('/uploads/', ''));
    assert.ok(fs.existsSync(stored));
    assert.equal((await sharp(stored).metadata()).format, 'jpeg');
  });

  test('naming the crop removes impossible classes', async () => {
    ml.response = mlResult({
      disease: [
        { label: 'Apple___Apple_scab', confidence: 0.5 },
        { label: 'Potato___Early_blight', confidence: 0.3 },
        { label: 'Potato___healthy', confidence: 0.2 },
      ],
    });
    const res = await api
      .post('/api/analyses')
      .set(auth(token))
      .field('mode', 'disease')
      .field('cropHint', 'Potato')
      .attach('image', leafJpeg, 'leaf.jpg');
    assert.equal(res.status, 201);
    assert.equal(res.body.analysis.disease.label, 'Potato___Early_blight');
    assert.equal(res.body.analysis.disease.cropFiltered, true);
    assert.equal(res.body.analysis.disease.confidence, 0.6);
    assert.equal(res.body.analysis.pest, null);
  });

  test('a low score is reported as inconclusive, not as a diagnosis', async () => {
    ml.response = mlResult({
      disease: [
        { label: 'Tomato___Target_Spot', confidence: 0.34 },
        { label: 'Tomato___healthy', confidence: 0.33 },
        { label: 'Tomato___Leaf_Mold', confidence: 0.33 },
      ],
    });
    const res = await api.post('/api/analyses').set(auth(token)).field('mode', 'disease').attach('image', leafJpeg, 'leaf.jpg');
    assert.equal(res.body.analysis.outcome, 'inconclusive');
    assert.equal(res.body.analysis.disease.status, 'uncertain');
  });

  test('a detected pest', async () => {
    ml.response = mlResult({
      pest: [
        { label: 'armyworms', confidence: 0.88 },
        { label: 'cutworms', confidence: 0.1 },
        { label: 'no_pest', confidence: 0.02 },
      ],
    });
    const res = await api.post('/api/analyses').set(auth(token)).field('mode', 'pest').attach('image', leafJpeg, 'bug.jpg');
    assert.equal(res.body.analysis.outcome, 'pest');
    assert.equal(res.body.analysis.pest.name, 'Armyworms');
    assert.ok(res.body.analysis.pestInfo.management.biological.length > 0);
  });

  test('files that are not images are rejected before the model is called', async () => {
    const before = ml.calls;
    const res = await api
      .post('/api/analyses')
      .set(auth(token))
      .attach('image', Buffer.from('#!/bin/sh\necho not an image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    assert.equal(res.status, 400);
    assert.equal(ml.calls, before);
    assert.equal((await api.post('/api/analyses').set(auth(token)).field('mode', 'both')).status, 400);
  });

  test('when the ML service is down the user gets a clear 502/503 and nothing is saved', async () => {
    ml.online = false;
    const before = (await api.get('/api/analyses').set(auth(token))).body.total;
    const res = await api.post('/api/analyses').set(auth(token)).attach('image', leafJpeg, 'leaf.jpg');
    ml.online = true;
    assert.ok([502, 503].includes(res.status));
    assert.equal((await api.get('/api/analyses').set(auth(token))).body.total, before);
  });

  test('history: list, filter, detail; private to its owner; delete removes the file', async () => {
    const list = await api.get('/api/analyses').set(auth(token));
    assert.equal(list.body.total, 4);
    const diseased = await api.get('/api/analyses?outcome=disease').set(auth(token));
    assert.equal(diseased.body.total, 2);

    assert.equal((await api.get(`/api/analyses/${analysisId}`).set(auth(token))).status, 200);
    assert.equal((await api.get(`/api/analyses/${analysisId}`).set(auth(other))).status, 404);
    assert.equal((await api.delete(`/api/analyses/${analysisId}`).set(auth(other))).status, 404);

    const detail = (await api.get(`/api/analyses/${analysisId}`).set(auth(token))).body.analysis;
    const stored = path.join(uploadDir, detail.imageUrl.replace('/uploads/', ''));
    assert.equal((await api.delete(`/api/analyses/${analysisId}`).set(auth(token))).status, 204);
    assert.equal(fs.existsSync(stored), false);
  });

  test('dashboard summarises the farmer\'s own data', async () => {
    const res = await api.get('/api/dashboard').set(auth(token));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.stats.totalScans, 3);
    assert.equal(res.body.recentAnalyses.length, 3);
    assert.equal(res.body.weather, null); // no farm with coordinates
  });
});

describe('market', () => {
  let token;

  before(async () => {
    token = (await register('market@example.com')).token;
    const added = await ensureSampleData();
    assert.ok(added > 0);
    assert.equal(await ensureSampleData(), 0, 'running it again adds nothing');
  });

  test('commodities, markets, series with insights', async () => {
    const commodities = (await api.get('/api/market/commodities').set(auth(token))).body.commodities;
    assert.ok(commodities.some((c) => c.commodity === 'Tomato'));

    const markets = (await api.get('/api/market/markets?commodity=Tomato').set(auth(token))).body.markets;
    assert.ok(markets.length >= 10);

    const res = await api.get('/api/market/series?commodity=Tomato&market=Pune&days=60').set(auth(token));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.series.length, 60);
    assert.equal(res.body.sample, true);
    assert.ok(['rising', 'falling', 'stable'].includes(res.body.insights.trend));
    assert.equal(res.body.insights.outlook.length, 7);
    assert.ok(res.body.insights.advice.length > 20);
    assert.ok(res.body.markets[0].modalPrice >= res.body.markets.at(-1).modalPrice);
  });

  test('unknown series is a 404 and overview has one row per commodity', async () => {
    assert.equal((await api.get('/api/market/series?commodity=Unobtainium&market=Pune').set(auth(token))).status, 404);
    const rows = (await api.get('/api/market/overview').set(auth(token))).body.rows;
    assert.equal(rows.length, COMMODITIES.length);
    assert.ok(rows[0].sparkline.length > 5);
  });
});

describe('admin', () => {
  let admin;
  let farmer;
  let farmerId;

  before(async () => {
    const created = await User.create({
      name: 'Root',
      email: 'root@example.com',
      role: 'admin',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });
    assert.ok(created);
    admin = (await api.post('/api/auth/login').send({ email: 'root@example.com', password: PASSWORD })).body.token;
    const f = await register('managed@example.com', 'Managed Farmer');
    farmer = f.token;
    farmerId = f.user.id;
  });

  test('farmers are refused on every admin route', async () => {
    for (const route of ['/api/admin/stats', '/api/admin/users', '/api/admin/farms', '/api/admin/analyses', '/api/admin/activity']) {
      assert.equal((await api.get(route).set(auth(farmer))).status, 403, route);
    }
  });

  test('stats, user search and report listing', async () => {
    const stats = await api.get('/api/admin/stats').set(auth(admin));
    assert.equal(stats.status, 200, JSON.stringify(stats.body));
    assert.ok(stats.body.totals.users >= 5);
    assert.equal(stats.body.daily.length, 30);
    assert.equal(stats.body.system.ml.online, true);

    const users = await api.get('/api/admin/users?q=managed').set(auth(admin));
    assert.equal(users.body.total, 1);
    assert.equal(users.body.items[0].passwordHash, undefined);

    const reports = await api.get('/api/admin/analyses').set(auth(admin));
    assert.ok(reports.body.total >= 3);
    assert.ok(reports.body.items[0].user.email);
  });

  test('review an analysis report', async () => {
    const reports = await api.get('/api/admin/analyses?outcome=pest').set(auth(admin));
    const id = reports.body.items[0].id;
    const res = await api.patch(`/api/admin/analyses/${id}/review`).set(auth(admin)).send({ status: 'confirmed', note: 'Matches field visit' });
    assert.equal(res.body.analysis.review.status, 'confirmed');
  });

  test('deactivating a user blocks their existing token and new logins', async () => {
    const res = await api.patch(`/api/admin/users/${farmerId}`).set(auth(admin)).send({ isActive: false });
    assert.equal(res.body.user.isActive, false);
    assert.equal((await api.get('/api/auth/me').set(auth(farmer))).status, 403);
    assert.equal((await api.post('/api/auth/login').send({ email: 'managed@example.com', password: PASSWORD })).status, 403);
  });

  test('the last admin cannot lock themselves out', async () => {
    const me = (await api.get('/api/auth/me').set(auth(admin))).body.user;
    assert.equal((await api.patch(`/api/admin/users/${me.id}`).set(auth(admin)).send({ role: 'farmer' })).status, 400);
    assert.equal((await api.delete(`/api/admin/users/${me.id}`).set(auth(admin))).status, 400);
  });

  test('advisories reach farmers, deleting a user removes their data, and actions are logged', async () => {
    const adv = await api.post('/api/admin/advisories').set(auth(admin)).send({ title: 'Locust alert', message: 'Swarms reported nearby.', severity: 'critical' });
    assert.equal(adv.status, 201);
    const viewer = (await register('viewer@example.com')).token;
    const dash = await api.get('/api/dashboard').set(auth(viewer));
    assert.equal(dash.body.advisories[0].title, 'Locust alert');

    assert.equal((await api.delete(`/api/admin/users/${farmerId}`).set(auth(admin))).status, 204);
    assert.equal((await api.get(`/api/admin/users?q=managed`).set(auth(admin))).body.total, 0);

    const log = await api.get('/api/admin/activity').set(auth(admin));
    const actions = log.body.items.map((i) => i.action);
    assert.ok(actions.includes('admin.user.delete'));
    assert.ok(actions.includes('admin.advisory.create'));
  });

  test('manual market price entry is validated', async () => {
    const bad = await api.post('/api/admin/market/prices').set(auth(admin)).send({
      commodity: 'Tomato', market: 'Pune', state: 'Maharashtra', date: '2026-11-10', minPrice: 3000, maxPrice: 2000, modalPrice: 2500,
    });
    assert.equal(bad.status, 400);
    assert.equal((await api.post('/api/admin/market/sync').set(auth(admin))).status, 400); // no API key in tests
  });
});

test('health endpoint and unknown routes', async () => {
  const health = await api.get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.database, 'connected');
  assert.equal((await api.get('/api/nope')).status, 404);
});
