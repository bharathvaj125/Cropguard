/**
 * Catalogue behind the bundled SAMPLE market series.
 *
 * These are not real quotes. `base` is a plausible modal price in Rs per quintal and
 * the other numbers shape a synthetic series (seasonal swing, day-to-day noise) so the
 * charts and trend logic have something realistic to work on without an API key.
 * Real mandi prices replace this when DATA_GOV_API_KEY is configured.
 */
export const COMMODITIES = [
  { name: 'Tomato', base: 2200, seasonal: 0.32, noise: 0.05, perishable: true },
  { name: 'Onion', base: 2400, seasonal: 0.28, noise: 0.035, perishable: false },
  { name: 'Potato', base: 1600, seasonal: 0.16, noise: 0.02, perishable: false },
  { name: 'Green Chilli', base: 3600, seasonal: 0.26, noise: 0.045, perishable: true },
  { name: 'Paddy', base: 2320, seasonal: 0.04, noise: 0.006, perishable: false },
  { name: 'Wheat', base: 2550, seasonal: 0.05, noise: 0.006, perishable: false },
  { name: 'Maize', base: 2250, seasonal: 0.07, noise: 0.01, perishable: false },
  { name: 'Soybean', base: 4650, seasonal: 0.08, noise: 0.01, perishable: false },
  { name: 'Cotton', base: 7300, seasonal: 0.06, noise: 0.008, perishable: false },
  { name: 'Groundnut', base: 6300, seasonal: 0.06, noise: 0.009, perishable: false },
  { name: 'Bengal Gram', base: 5900, seasonal: 0.05, noise: 0.008, perishable: false },
  { name: 'Apple', base: 8600, seasonal: 0.2, noise: 0.018, perishable: true },
  { name: 'Grapes', base: 6200, seasonal: 0.24, noise: 0.025, perishable: true },
  { name: 'Orange', base: 4300, seasonal: 0.2, noise: 0.022, perishable: true },
  { name: 'Banana', base: 1900, seasonal: 0.15, noise: 0.02, perishable: true },
  { name: 'Guava', base: 2900, seasonal: 0.25, noise: 0.03, perishable: true },
  { name: 'Pomegranate', base: 9200, seasonal: 0.18, noise: 0.02, perishable: true },
  { name: 'Lemon', base: 4600, seasonal: 0.3, noise: 0.035, perishable: true },
];

/** `factor` nudges a market above or below the national level. */
export const MARKETS = [
  { market: 'Azadpur', district: 'North Delhi', state: 'Delhi', factor: 1.08 },
  { market: 'Lasalgaon', district: 'Nashik', state: 'Maharashtra', factor: 0.95 },
  { market: 'Pune', district: 'Pune', state: 'Maharashtra', factor: 1.03 },
  { market: 'Koyambedu', district: 'Chennai', state: 'Tamil Nadu', factor: 1.06 },
  { market: 'Kolar', district: 'Kolar', state: 'Karnataka', factor: 0.97 },
  { market: 'Bowenpally', district: 'Hyderabad', state: 'Telangana', factor: 1.02 },
  { market: 'Indore', district: 'Indore', state: 'Madhya Pradesh', factor: 0.96 },
  { market: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', factor: 1.0 },
  { market: 'Kolkata', district: 'Kolkata', state: 'West Bengal', factor: 1.04 },
  { market: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', factor: 0.98 },
  { market: 'Khanna', district: 'Ludhiana', state: 'Punjab', factor: 0.99 },
  { market: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', factor: 1.01 },
];

export function isPerishable(commodity) {
  return COMMODITIES.find((c) => c.name.toLowerCase() === String(commodity).toLowerCase())?.perishable ?? false;
}
