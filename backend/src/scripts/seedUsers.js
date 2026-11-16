import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User } from '../models/User.js';

async function ensureUser({ email, password, name, role, location }) {
  if (!password) return null;
  const existing = await User.findOne({ email });
  if (existing) return existing;
  const user = await User.create({
    name,
    email,
    role,
    location,
    passwordHash: await bcrypt.hash(password, 12),
  });
  console.log(`seed: created ${role} account ${email}`);
  return user;
}

/**
 * Create the first admin (and an optional demo farmer) from environment variables.
 * Passwords are never hard-coded: nothing is created unless SEED_*_PASSWORD is set.
 * Existing accounts are left untouched, so this is safe to run on every start.
 */
export async function ensureSeedUsers() {
  const { adminEmail, adminPassword, farmerEmail, farmerPassword } = config.seed;

  const admin = await ensureUser({
    email: adminEmail,
    password: adminPassword,
    name: 'CropGuard Admin',
    role: 'admin',
    location: { state: 'Tamil Nadu' },
  });
  const farmer = await ensureUser({
    email: farmerEmail,
    password: farmerPassword,
    name: 'Demo Farmer',
    role: 'farmer',
    location: { state: 'Tamil Nadu', district: 'Thanjavur' },
  });

  if (!(await User.exists({ role: 'admin' }))) {
    console.warn('seed: no admin account exists. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, then restart.');
  }
  return { admin, farmer };
}
