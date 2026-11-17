# API reference

Base path: `/api`. JSON in and out, except scan uploads (`multipart/form-data`).

**Authentication:** send `Authorization: Bearer <token>` (from register / login) on every route except
`/health`, `/auth/register` and `/auth/login`.

**Errors** always look like:

```json
{ "error": { "message": "email: must be a valid email address", "details": [{ "field": "email", "message": "…" }] } }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`details` lists the fields) |
| 401 | Missing, invalid or expired token, or wrong credentials |
| 403 | Signed in but not allowed (not an admin, or account deactivated) |
| 404 | Not found, including records that belong to someone else |
| 409 | Duplicate (e.g. email already registered) |
| 429 | Rate limit reached |
| 502 / 503 | ML service or an external API failed or is unreachable |

**Paged lists** accept `page` (default 1) and `limit` (default 20, max 100) and return
`{ items, total, page, limit, pages }`.

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status, database, mlService, time }`. 503 if the database is down. |

## Auth and profile

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password, phone?, location?: { state, district, village } }` | 201 `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | | `{ user }` |
| PATCH | `/auth/me` | `{ name?, phone?, location? }` | `{ user }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | `{ token, user }` (older tokens stop working) |
| DELETE | `/auth/me` | `{ password }` | 204; deletes the account and all its data |

Password rule: 8–72 characters with at least one letter and one digit.

## Crop analyses

### `POST /analyses` (multipart)

| Field | Required | Notes |
|---|---|---|
| `image` | yes | JPG, PNG or WebP, max 8 MB, min 64×64 |
| `mode` | no | `both` (default), `disease`, `pest` |
| `cropHint` | no | One of the supported crops; restricts disease classes to that crop |
| `farmId` | no | One of your farms |
| `notes` | no | Up to 500 characters |

Response `201 { analysis }`:

```json
{
  "id": "…", "createdAt": "…", "mode": "both",
  "outcome": "disease",              // healthy | disease | pest | disease_and_pest | inconclusive
  "severity": "high",                // none | low | medium | high
  "imageUrl": "/uploads/…jpg",       // presigned S3 URL on AWS
  "heatmapUrl": "/uploads/…-heatmap.png",
  "disease": {
    "status": "confident",           // confident | uncertain
    "label": "Tomato___Late_blight", "name": "Late blight", "crop": "Tomato",
    "isHealthy": false, "confidence": 0.93, "cropFiltered": false,
    "top": [{ "label": "…", "name": "Tomato: Late blight", "confidence": 0.93 }, …]
  },
  "pest": { "status": "none", "label": "no_pest", "name": "No pest visible", "confidence": 0.97, "top": […] },
  "diseaseInfo": { "summary", "pathogen", "symptoms", "treatment": { "cultural", "organic", "chemical" }, "prevention", … },
  "pestInfo": { "summary", "damage", "management": { "cultural", "biological", "chemical" }, "monitoring", … },
  "quality": { "brightness": 0.45, "sharpness": 812.3, "warnings": [] },
  "review": { "status": "pending", "note": "" },
  "farm": { "id": "…", "name": "Home field" },
  "models": { "disease": "disease-2026-11-16", "pest": "pest-2026-11-16" },
  "inferenceMs": 340
}
```

| Method | Path | Description |
|---|---|---|
| GET | `/analyses` | Paged. Filters: `outcome`, `farmId`, `from`, `to` |
| GET | `/analyses/:id` | Full report with advice |
| PATCH | `/analyses/:id` | `{ notes }` |
| DELETE | `/analyses/:id` | Deletes the report and its stored images |

## Farms

| Method | Path | Description |
|---|---|---|
| GET | `/farms` | `{ farms }`, each with `scans` and `issues` counts |
| POST | `/farms` | `{ name, location?: { name, state, district, latitude, longitude }, areaAcres?, soilType?, irrigationType?, crops?, notes? }` |
| GET | `/farms/:id` | |
| PUT | `/farms/:id` | Same body as POST |
| DELETE | `/farms/:id` | Linked scans and activities are kept and unlinked |

`soilType`: alluvial, black, red, laterite, sandy, loamy, clay, other.
`irrigationType`: rainfed, canal, borewell, drip, sprinkler, other.

## Activities

| Method | Path | Description |
|---|---|---|
| GET | `/activities` | Paged. Filters: `status`, `type`, `farmId` |
| POST | `/activities` | `{ type, title, date, status?, farmId?, notes?, cost? }` |
| PUT | `/activities/:id` | Same body |
| PATCH | `/activities/:id/status` | `{ status: "planned" \| "done" }` |
| DELETE | `/activities/:id` | |

`type`: sowing, irrigation, fertilizer, spraying, weeding, scouting, harvest, other.

## Weather

| Method | Path | Description |
|---|---|---|
| GET | `/weather/geocode?q=Thanjavur` | `{ results: [{ name, state, district, country, latitude, longitude }] }` |
| GET | `/weather/forecast?farmId=…` or `?lat=…&lon=…` | `{ place, current, daily[7], insights[] }` |

Each insight is `{ type, level: good | info | warning | danger, title, message }`.

## Market

| Method | Path | Description |
|---|---|---|
| GET | `/market/commodities` | `{ commodities: [{ commodity, markets, latest }] }` |
| GET | `/market/markets?commodity=Tomato` | `{ markets: [{ market, state, district, latest }] }` |
| GET | `/market/overview?market=&state=` | One row per commodity: `latest`, `change7dPct`, `sparkline`, `sample` |
| GET | `/market/series?commodity=&market=&days=90` | `{ series, insights, markets, sample, unit }` |

`insights`: latest, change1dPct / 7d / 30d, average7, average30, high30, low30, volatilityPct, trend,
weeklyTrendPct, outlook[7] `{ date, expected, low, high }`, action (`hold`, `sell_now`, `sell_in_batches`,
`wait`), advice. Prices are rupees per quintal.

## Dashboard and knowledge base

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Stats, weekly chart data, recent scans, upcoming activities, advisories, weather, market rows |
| GET | `/knowledge` | `{ crops, diseases, pests }`: everything the models can recognise, with advice |

## Advisory chat (voice assistant)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/advisory/ask` | `{ query, language, farmId?, context?: { location, soilType, season, irrigation, crop } }` | `{ id, title, body (markdown), voiceSummary, keyActions[], missingContextQuestions[], crop, topic, source: "claude" \| "rules", disclaimer }` |
| GET | `/advisory/history` | | Paged past questions and answers |
| GET | `/advisory/crops` | | Crop almanac: seasons, sowing windows, irrigation stages |
| GET | `/advisory/languages` | | Supported languages |

Claude answers when configured, with the farm's details and the last few turns (2 hours) as context; otherwise, or
if Claude fails, the offline almanac rules answer. A farm that belongs to someone else is a 400.

## Soil Doctor

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/soil/extract` | multipart `image` (JPG, PNG, WebP or PDF) | `{ sampleId, values: { nitrogen…boron: number \| null }, unreadableFields[], rejected[], notes[], source: "claude" }`. 503 with `fallback: "manual"` when Claude is not configured; 422 when the document is not a soil report |
| POST | `/soil/analyze` | multipart or JSON: `crop`, `farmAreaAcre`, `farmId?`, `sampleId?`, `notes?`, any of `nitrogen, phosphorus, potassium, ph, ec, organicCarbon, zinc, iron, sulphur, boron`, optional `image`, optional `ocrText` | 201 `{ soil: { parameters (value, unit, rating), unreadableFields, overallHealth, fertilizerPlan: { ureaBags, dapBags, mopBags, limeKg, gypsumKg, fymTonnes, schedule[] }, recommendations[], valueSource } }` |
| GET | `/soil` | | Paged history |
| GET / DELETE | `/soil/:id` | | One analysis / 204 |

Values typed by the farmer must be physically possible (for example pH 2-11) or the request is a 400. Values read by
Claude or parsed from text that are impossible are dropped and reported, never used.

## Produce Grader

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/produce/methods` | | `{ model: { available, commodities }, claude: { available }, basic: { available } }` |
| POST | `/produce/grade` | multipart `image`, `commodity`, `market?`, `variety?`, `farmId?`, `notes?` | 201 `{ produce: { grade, gradeLabel, confidence, qualityScore, method: "model" \| "claude" \| "basic", detectedCommodity, qualityProbabilities?, defectsDetected[], warnings[], priceEstimate \| null }, advice, priceUnavailable }`. 422 when Claude sees no produce |
| GET | `/produce?commodity=&grade=` | | Paged history |
| GET / DELETE | `/produce/:id` | | One grading / 204 |

`priceEstimate` is `{ commodity, market, state, baseModalPricePerQuintal, estimatedMin/MaxPerQuintal, estimatedMin/MaxPerKg, marketDate, marketNote, sample }`, or `null` when there is no price data for the commodity.

## Voice and AI advisory (Track B)

See [TRACK_B.md](TRACK_B.md) for setup. Every route needs sign-in; `tts`, `stt` and `llm` are rate-limited per user.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/advisory/cloud-status` | | `{ llm: { enabled, provider, model }, tts: { enabled, languages }, stt: { enabled, languages, streamingFormats, batchFormats } }` |
| POST | `/advisory/tts` | `{ text, language }` | `{ audioUrl, voice, cached }`. 503 when Polly is off, 422 for a language Polly has no voice for; both with `details.fallback: "browser"` |
| POST | `/advisory/stt` | multipart `audio` (WAV, Ogg-Opus, FLAC; WebM, MP3, MP4 with S3 storage), `language` | `{ transcript, language, mode: "streaming" \| "batch" }`. 415 unknown audio, 422 no speech heard, 503 when Transcribe is off |
| POST | `/advisory/llm` | `{ query, language, context?, history? }` | `{ body, voiceSummary, missingContextQuestions, language, source: "claude", model, usage, disclaimer }`. 503 when Claude is not configured, 502 when it cannot answer; both with `details.fallback: "rules"` |

`language` accepts `hi`, `en`, `ta`, `te`, `kn`, `mr`, `bn`, `pa`, `gu`, `ml`, or locale forms such as `kn-IN`.

## Admin (role `admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Totals, outcome counts, top diseases and pests, 30-day daily series, model info, system status |
| GET | `/admin/users` | Paged. `q` (name / email / phone), `role`, `status` |
| PATCH | `/admin/users/:id` | `{ role?, isActive? }`. Cannot change yourself or remove the last active admin |
| DELETE | `/admin/users/:id` | Deletes the user and all their data |
| GET | `/admin/farms` | Paged. `q` |
| PUT / DELETE | `/admin/farms/:id` | Edit or delete any farm |
| GET | `/admin/analyses` | Paged. `outcome`, `review`, `userId` |
| GET | `/admin/analyses/:id` | Full report including the submitting user |
| PATCH | `/admin/analyses/:id/review` | `{ status: pending \| confirmed \| corrected, note }` |
| DELETE | `/admin/analyses/:id` | |
| GET | `/admin/activity` | Paged audit log. `action` prefix filter (`auth`, `analysis`, `admin`) |
| GET / POST | `/admin/advisories` | List / create `{ title, message, severity, state, active, expiresAt }` |
| PUT / DELETE | `/admin/advisories/:id` | |
| POST | `/admin/market/prices` | Manual price entry; `minPrice ≤ modalPrice ≤ maxPrice` |
| POST | `/admin/market/sync` | Pull today's Agmarknet prices (needs `DATA_GOV_API_KEY`) |

## ML service (internal, port 8000)

Not exposed publicly; only the API calls it.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status, models }` |
| GET | `/models` | Model cards: architecture, dataset, labels, temperature, test metrics, per-class results |
| POST | `/analyze` | multipart `file`, `mode`, `explain` → `{ quality, disease?, pest?, inference_ms }`; each model gives every class's probability, sorted |
