/**
 * Fill a fresh database with demo content:  npm run seed
 *
 * Creates the admin and demo farmer from SEED_* variables, gives the demo farmer two
 * farms and a few activities, adds one advisory and makes sure the sample market
 * series is present. Safe to run more than once.
 */
import { connectDb, disconnectDb } from '../db.js';
import { Activity } from '../models/Activity.js';
import { Advisory } from '../models/Advisory.js';
import { Farm } from '../models/Farm.js';
import { ensureSampleData } from '../services/market.js';
import { ensureSeedUsers } from './seedUsers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS);

async function main() {
  await connectDb();
  const { admin, farmer } = await ensureSeedUsers();

  if (farmer && !(await Farm.exists({ owner: farmer._id }))) {
    const [home, river] = await Farm.create([
      {
        owner: farmer._id,
        name: 'Home field',
        location: { name: 'Thanjavur, Tamil Nadu', state: 'Tamil Nadu', district: 'Thanjavur', latitude: 10.787, longitude: 79.1378 },
        areaAcres: 4.5,
        soilType: 'alluvial',
        irrigationType: 'canal',
        crops: ['Paddy', 'Tomato'],
      },
      {
        owner: farmer._id,
        name: 'Riverside plot',
        location: { name: 'Kumbakonam, Tamil Nadu', state: 'Tamil Nadu', district: 'Thanjavur', latitude: 10.9617, longitude: 79.3881 },
        areaAcres: 2,
        soilType: 'loamy',
        irrigationType: 'drip',
        crops: ['Potato', 'Maize'],
      },
    ]);
    await Activity.create([
      { user: farmer._id, farm: home._id, type: 'sowing', title: 'Transplanted tomato seedlings', date: inDays(-21), status: 'done' },
      { user: farmer._id, farm: home._id, type: 'fertilizer', title: 'First top dressing', date: inDays(-7), status: 'done', cost: 1800 },
      { user: farmer._id, farm: home._id, type: 'scouting', title: 'Check lower leaves for blight', date: inDays(1), status: 'planned' },
      { user: farmer._id, farm: river._id, type: 'irrigation', title: 'Drip irrigation, 2 hours', date: inDays(2), status: 'planned' },
      { user: farmer._id, farm: river._id, type: 'spraying', title: 'Preventive copper spray', date: inDays(4), status: 'planned', cost: 950 },
    ]);
    console.log('seed: created 2 farms and 5 activities for the demo farmer');
  }

  if (admin && !(await Advisory.exists({}))) {
    await Advisory.create({
      title: 'Late blight watch for tomato and potato',
      message:
        'Cool, humid weather is forecast across the delta districts this week. Scout tomato and potato fields every two days and scan any leaf with dark, water-soaked patches.',
      severity: 'warning',
      state: '',
      createdBy: admin._id,
      expiresAt: inDays(14),
    });
    console.log('seed: created 1 advisory');
  }

  const rows = await ensureSampleData();
  console.log(`seed: market sample data ready (${rows} rows added)`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
