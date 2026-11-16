const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const numberFmt = new Intl.NumberFormat('en-IN');

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '');
export const formatShortDate = (d) => (d ? shortFmt.format(new Date(d)) : '');
export const formatDateTime = (d) => (d ? timeFmt.format(new Date(d)) : '');
export const formatWeekday = (d) => (d ? weekdayFmt.format(new Date(d)) : '');
export const formatNumber = (n) => (n == null ? '' : numberFmt.format(n));
export const formatRupees = (n) => (n == null ? '' : `₹${numberFmt.format(Math.round(n))}`);
export const formatPercent = (fraction, digits = 0) =>
  fraction == null ? '' : `${(fraction * 100).toFixed(digits)}%`;
export const signed = (n, digits = 1) => `${n > 0 ? '+' : ''}${Number(n).toFixed(digits)}%`;

/** Value for an <input type="date"> in the user's local time zone. */
export function toDateInput(d) {
  const date = d ? new Date(d) : new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function relativeDay(d) {
  const day = 24 * 60 * 60 * 1000;
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date(d)) - start(new Date())) / day);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatShortDate(d);
}

export const OUTCOMES = {
  healthy: { label: 'Healthy', tone: 'good' },
  disease: { label: 'Disease found', tone: 'bad' },
  pest: { label: 'Pest found', tone: 'bad' },
  disease_and_pest: { label: 'Disease and pest', tone: 'bad' },
  inconclusive: { label: 'Inconclusive', tone: 'warn' },
};

export const SEVERITY = {
  none: { label: 'No action needed', tone: 'good' },
  low: { label: 'Low severity', tone: 'info' },
  medium: { label: 'Medium severity', tone: 'warn' },
  high: { label: 'High severity', tone: 'bad' },
};

export const ACTIVITY_TYPES = {
  sowing: 'Sowing / planting',
  irrigation: 'Irrigation',
  fertilizer: 'Fertiliser',
  spraying: 'Spraying',
  weeding: 'Weeding',
  scouting: 'Scouting',
  harvest: 'Harvest',
  other: 'Other',
};

export const SOIL_TYPES = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'loamy', 'clay', 'other'];
export const IRRIGATION_TYPES = ['rainfed', 'canal', 'borewell', 'drip', 'sprinkler', 'other'];

export const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** A short title for an analysis, used in lists. */
export function analysisTitle(a) {
  const parts = [];
  if (a.disease && a.disease.status === 'confident') {
    parts.push(a.disease.isHealthy ? `${a.disease.crop}: healthy` : `${a.disease.crop}: ${a.disease.name}`);
  }
  if (a.pest && a.pest.status === 'detected') parts.push(a.pest.name);
  if (parts.length) return parts.join(' + ');
  if (a.outcome === 'healthy') return 'No problems found';
  return 'Could not identify';
}
