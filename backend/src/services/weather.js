import { ApiError } from '../utils/errors.js';

/**
 * Weather from Open-Meteo (https://open-meteo.com): free, no API key, global coverage.
 *
 * Two calls are used: the forecast API for a latitude/longitude, and the geocoding
 * API to turn a place name into coordinates. Responses are cached in memory so a
 * dashboard refresh does not hit the upstream API every time.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();

async function cachedJson(url) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ApiError(503, 'The weather service is not reachable right now. Please try again shortly.');
  }
  if (!response.ok) throw new ApiError(502, 'The weather service returned an error');
  const data = await response.json();

  cache.set(url, { data, expires: Date.now() + CACHE_TTL_MS });
  if (cache.size > 500) cache.delete(cache.keys().next().value); // oldest entry
  return data;
}

// WMO weather interpretation codes used by Open-Meteo.
const WMO = {
  0: ['Clear sky', 'clear'],
  1: ['Mainly clear', 'clear'],
  2: ['Partly cloudy', 'cloudy'],
  3: ['Overcast', 'cloudy'],
  45: ['Fog', 'fog'],
  48: ['Rime fog', 'fog'],
  51: ['Light drizzle', 'rain'],
  53: ['Drizzle', 'rain'],
  55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'],
  57: ['Freezing drizzle', 'rain'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'],
  81: ['Showers', 'rain'],
  82: ['Violent showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Thunderstorm with hail', 'storm'],
};

function describe(code) {
  const [label, icon] = WMO[code] || ['Unknown', 'cloudy'];
  return { label, icon };
}

export async function geocode(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const data = await cachedJson(url);
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin2, r.admin1, r.country].filter((v, i, all) => v && all.indexOf(v) === i).join(', '),
    place: r.name,
    district: r.admin2 || '',
    state: r.admin1 || '',
    country: r.country || '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export async function getForecast(latitude, longitude) {
  // Round so nearby requests share a cache entry (about 1 km precision).
  const lat = Number(latitude).toFixed(2);
  const lon = Number(longitude).toFixed(2);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'relative_humidity_2m_mean',
      'et0_fao_evapotranspiration',
      'uv_index_max',
    ].join(','),
  });
  const raw = await cachedJson(`${FORECAST_URL}?${params}`);
  if (!raw.daily?.time?.length) throw new ApiError(502, 'The weather service returned no forecast');

  const d = raw.daily;
  const daily = d.time.map((date, i) => ({
    date,
    ...describe(d.weather_code[i]),
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    rainMm: d.precipitation_sum[i] ?? 0,
    rainChance: d.precipitation_probability_max[i] ?? null,
    windMax: d.wind_speed_10m_max[i],
    humidity: d.relative_humidity_2m_mean[i],
    et0: d.et0_fao_evapotranspiration[i] ?? 0,
    uvMax: d.uv_index_max[i] ?? null,
  }));

  const c = raw.current || {};
  const forecast = {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    fetchedAt: new Date().toISOString(),
    source: 'Open-Meteo',
    current: {
      ...describe(c.weather_code),
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      rainMm: c.precipitation ?? 0,
      wind: c.wind_speed_10m,
    },
    daily,
  };
  return { ...forecast, insights: buildInsights(forecast) };
}

const dayName = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Turn the forecast into plain-language farm advice.
 *
 * These are simple, transparent rules of thumb (documented in docs/ARCHITECTURE.md),
 * not a crop model. Each insight carries a level so the UI can colour it:
 *   good     conditions are favourable for the activity
 *   info     worth knowing
 *   warning  act or plan around it
 *   danger   risk of crop loss
 */
export function buildInsights(forecast) {
  const days = forecast.daily;
  const insights = [];
  const next3 = days.slice(0, 3);
  const rain3 = sum(next3.map((d) => d.rainMm));
  const et3 = sum(next3.map((d) => d.et0));

  // Irrigation: compare expected rain with what the crop will lose to evapotranspiration.
  if (rain3 >= Math.max(15, et3)) {
    insights.push({
      type: 'irrigation',
      level: 'good',
      title: 'Hold irrigation',
      message: `About ${rain3.toFixed(0)} mm of rain is expected over the next 3 days, more than the ${et3.toFixed(0)} mm the crop is likely to use. Skip irrigation and check field drainage.`,
    });
  } else if (rain3 < 5 && et3 > 10) {
    insights.push({
      type: 'irrigation',
      level: 'warning',
      title: 'Irrigation needed',
      message: `Little rain (${rain3.toFixed(1)} mm) is expected in the next 3 days while crops will lose about ${et3.toFixed(0)} mm of water. Irrigate, preferably early morning or evening.`,
    });
  } else {
    insights.push({
      type: 'irrigation',
      level: 'info',
      title: 'Irrigate lightly if the soil is dry',
      message: `Expected rain (${rain3.toFixed(0)} mm) partly covers crop water use (${et3.toFixed(0)} mm) over the next 3 days. Check soil moisture before irrigating.`,
    });
  }

  // Heavy rain.
  const heavy = days.find((d) => d.rainMm >= 50);
  if (heavy) {
    insights.push({
      type: 'rain',
      level: 'danger',
      title: `Heavy rain on ${dayName(heavy.date)}`,
      message: `${heavy.rainMm.toFixed(0)} mm of rain is forecast. Clear drainage channels, postpone fertiliser and spraying, and harvest mature produce beforehand if you can.`,
    });
  }

  // Spraying window: dry, light wind, today or tomorrow.
  const sprayDay = days.slice(0, 3).find((d, i) => d.rainMm < 1 && d.windMax < 15 && (days[i + 1]?.rainMm ?? 0) < 5);
  if (sprayDay) {
    insights.push({
      type: 'spraying',
      level: 'good',
      title: `Good spraying conditions on ${dayName(sprayDay.date)}`,
      message: `Dry with light wind (up to ${sprayDay.windMax.toFixed(0)} km/h) and no significant rain the following day, so sprays will not drift or wash off.`,
    });
  } else {
    insights.push({
      type: 'spraying',
      level: 'warning',
      title: 'Avoid spraying for now',
      message: 'Rain or wind above 15 km/h is expected over the next 3 days. Sprays are likely to drift or wash off, so wait for a calm, dry day.',
    });
  }

  // Fungal disease pressure: warm and humid for several days.
  const humidDays = days.slice(0, 5).filter((d) => d.humidity >= 80 && d.tempMax >= 18 && d.tempMin <= 30);
  if (humidDays.length >= 3) {
    insights.push({
      type: 'disease',
      level: 'warning',
      title: 'High fungal disease risk',
      message: `Humidity stays above 80% on ${humidDays.length} of the next 5 days. Conditions favour blights, mildews and leaf spots. Scout the crop and scan any suspicious leaves.`,
    });
  }

  // Heat stress.
  const hot = days.find((d) => d.tempMax >= 40);
  if (hot) {
    insights.push({
      type: 'heat',
      level: 'danger',
      title: `Heat stress on ${dayName(hot.date)}`,
      message: `Temperature may reach ${hot.tempMax.toFixed(0)} °C. Irrigate in the evening, mulch where possible and avoid transplanting or spraying in the afternoon.`,
    });
  } else if (days.some((d) => d.tempMax >= 36)) {
    insights.push({
      type: 'heat',
      level: 'info',
      title: 'Hot afternoons ahead',
      message: 'Daytime temperatures above 36 °C are forecast. Schedule field work and irrigation for early morning or evening.',
    });
  }

  // Frost.
  const frost = days.find((d) => d.tempMin <= 2);
  if (frost) {
    insights.push({
      type: 'frost',
      level: 'danger',
      title: `Frost risk on ${dayName(frost.date)}`,
      message: `Minimum temperature may fall to ${frost.tempMin.toFixed(0)} °C. A light irrigation the evening before and covering nurseries reduces frost injury.`,
    });
  }

  // Harvest window: three dry days in a row.
  for (let i = 0; i + 2 < days.length; i += 1) {
    const window = days.slice(i, i + 3);
    if (window.every((d) => d.rainMm < 1 && (d.rainChance ?? 0) <= 40)) {
      insights.push({
        type: 'harvest',
        level: 'good',
        title: 'Dry window for harvest and drying',
        message: `${dayName(window[0].date)} to ${dayName(window[2].date)} look dry. A good time to harvest, thresh and sun-dry produce.`,
      });
      break;
    }
  }

  return insights;
}
