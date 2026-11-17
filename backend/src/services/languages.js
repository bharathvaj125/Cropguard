/**
 * Languages the voice assistant supports, keyed by short code.
 *
 * `code` is what the API stores and the frontend sends ("hi", "ta", ...). Locale
 * variants ("hi-IN", "HI", "hindi") are normalised with `normaliseLanguage`.
 */
export const LANGUAGES = {
  hi: { name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  en: { name: 'English', native: 'English', locale: 'en-IN' },
  ta: { name: 'Tamil', native: 'தமிழ்', locale: 'ta-IN' },
  te: { name: 'Telugu', native: 'తెలుగు', locale: 'te-IN' },
  kn: { name: 'Kannada', native: 'ಕನ್ನಡ', locale: 'kn-IN' },
  mr: { name: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
  bn: { name: 'Bengali', native: 'বাংলা', locale: 'bn-IN' },
  pa: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', locale: 'pa-IN' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN' },
  ml: { name: 'Malayalam', native: 'മലയാളം', locale: 'ml-IN' },
};

const BY_NAME = Object.fromEntries(Object.entries(LANGUAGES).map(([code, l]) => [l.name.toLowerCase(), code]));

/** "hi-IN" | "HI" | "hindi" -> "hi". Returns null for anything unsupported. */
export function normaliseLanguage(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  const short = text.split(/[-_]/)[0];
  if (LANGUAGES[short]) return short;
  return BY_NAME[text] || null;
}
