# Architecture

## Overview

```
                         ┌──────────────────────────────┐
  Browser (React SPA) ──▶│ nginx  (web container)       │
                         │  /          static React app │
                         │  /api/*  ─────────┐          │
                         └───────────────────┼──────────┘
                                             ▼
                         ┌──────────────────────────────┐      ┌─────────────────────┐
                         │ Node.js / Express API        │─────▶│ MongoDB             │
                         │  auth, farms, analyses,      │      │ users, farms,       │
                         │  activities, weather,        │      │ analyses, prices,   │
                         │  market, dashboard, admin    │      │ advisories, audit   │
                         └──┬──────────┬─────────┬──────┘      └─────────────────────┘
                            │          │         │
              multipart     │          │ HTTPS   │ S3 API (AWS) or disk (local)
              image         ▼          ▼         ▼
             ┌───────────────────┐  ┌───────────────┐  ┌──────────────────────┐
             │ Python ML service │  │ Open-Meteo    │  │ Photo storage        │
             │ FastAPI + ONNX    │  │ data.gov.in   │  │ (S3 bucket / volume) │
             │ disease + pest    │  └───────────────┘  └──────────────────────┘
             └───────────────────┘
```

Three services, each with one job:

| Service | Responsibility | Holds state? |
|---|---|---|
| **frontend** | User interface. Talks only to `/api` on its own origin. | No (JWT in `localStorage`) |
| **backend** | Business rules, authentication, authorisation, persistence, calls to external APIs, interpreting model output. | Yes (MongoDB, photos) |
| **ml-service** | Image in, class probabilities out. No users, no database, no business rules. | No |

Keeping the ML service stateless and rule-free means a model can be retrained and swapped without touching
the API, and the API's decision rules (thresholds, crop filtering, severity) can be unit-tested without a model.

## Request flow: a scan

1. The browser posts `multipart/form-data` (photo, mode, optional crop and farm) to `POST /api/analyses`.
2. `multer` holds the file in memory (8 MB limit). `sharp` decodes the actual bytes, rejecting anything that is
   not a real JPEG/PNG/WebP whatever its extension, applies EXIF rotation, strips metadata (including GPS),
   resizes to at most 1280 px and re-encodes as JPEG.
3. The API sends the clean image to the ML service `POST /analyze`.
4. The ML service checks quality (brightness, blur, resolution), centre-crops to 224×224 exactly as in training,
   runs the requested ONNX model(s), applies the calibrated temperature and returns every class's
   probability. For the disease model it also computes an occlusion heatmap.
5. The API's `services/diagnosis.js` interprets the probabilities:
   - if the farmer named the crop, classes for other crops are removed and the rest renormalised;
   - below the confidence threshold (0.60 disease, 0.55 pest) the result is **uncertain**, not a diagnosis;
   - the two results are combined into one `outcome` (healthy, disease, pest, disease_and_pest, inconclusive)
     and a `severity` from the knowledge base.
6. The photo (and heatmap) are written to storage under an unguessable key, the analysis is saved, and an audit
   entry is written. The response includes the knowledge-base entry (symptoms, treatment, prevention).

If the ML service is down or slow (30 s timeout) the user gets a clear 503 and nothing is stored.

## Data model (MongoDB)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | name, email (unique), passwordHash (never selected by default), role (`farmer`/`admin`), isActive, location, passwordChangedAt | Tokens issued before `passwordChangedAt` are rejected |
| `farms` | owner → users, name, location {name, state, district, lat, lon}, areaAcres, soilType, irrigationType, crops[] | Coordinates drive the weather forecast |
| `analyses` | user, farm, mode, cropHint, image {key, heatmapKey}, quality, disease {status, label, confidence, top[]}, pest {…}, outcome, severity, models, review {status, note, reviewedBy} | Indexed by (user, createdAt) and outcome |
| `activities` | user, farm, type, title, date, status (`planned`/`done`), cost | Field log |
| `marketprices` | commodity, market, state, date, min/max/modal price, source (`sample`/`agmarknet`/`manual`) | Unique on (commodity, market, date) |
| `advisories` | title, message, severity, state (empty = everyone), active, expiresAt | Shown on farmer dashboards |
| `auditlogs` | actor, action, target, summary, ip | Append-only |

Deleting a farm keeps its scans and activities but unlinks them. Deleting a user removes all their records
and stored photos.

## Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt, cost 12; 8+ characters with a letter and a digit; max 72 (bcrypt limit) |
| Sessions | JWT (HS256, 7 days). Production refuses to start without `JWT_SECRET`. Password change invalidates older tokens. Deactivated accounts are blocked on every request, not just at login |
| Brute force | 20 auth attempts per 15 min per IP; 240 API requests per minute per IP. `TRUST_PROXY` makes limits see the real client IP behind nginx / CloudFront |
| Account enumeration | Login gives the same message for unknown email and wrong password |
| Mass assignment | Every body is parsed with a zod schema; unknown fields (e.g. `role` at sign-up) are dropped |
| Access control | Every farmer query is scoped by owner; other users' records return 404, not 403. Admin routes require the `admin` role. The last active admin cannot be demoted, deactivated or deleted |
| Uploads | Size limit, content decoded by `sharp` (not trusted from extension or MIME type), metadata stripped, random storage keys, path-traversal guard for local storage |
| Regex injection | Admin search terms are escaped before building a RegExp |
| HTTP headers | `helmet` on the API; nginx adds `nosniff`, `X-Frame-Options`, referrer policy |
| Secrets | Never in the repo. `.env` is git-ignored; on AWS secrets are generated by Secrets Manager |
| AWS | S3 bucket private and encrypted, TLS-only policy, IAM role limited to `uploads/*`, IMDSv2 required, no SSH port (Session Manager) |

## Weather insights

`services/weather.js` turns the Open-Meteo forecast into advice with transparent rules of thumb:

| Insight | Rule |
|---|---|
| Hold irrigation | Rain over the next 3 days ≥ max(15 mm, 3-day reference evapotranspiration) |
| Irrigation needed | 3-day rain < 5 mm and evapotranspiration > 10 mm |
| Spraying window | A day in the next 3 with < 1 mm rain, wind < 15 km/h, and < 5 mm rain the day after |
| Fungal disease risk | ≥ 3 of the next 5 days with mean humidity ≥ 80% and temperatures 18–30 °C |
| Heat stress | Max ≥ 40 °C (danger) or ≥ 36 °C (info) |
| Frost | Min ≤ 2 °C |
| Heavy rain | ≥ 50 mm in a day |
| Harvest window | Three consecutive days with < 1 mm rain and ≤ 40% rain chance |

Forecasts are cached for 20 minutes per location (rounded to about 1 km).

## Market analysis

`services/market.js`:

- **Trend**: least-squares slope over the last 14 prices, expressed as % per week; > +1.5% rising, < −1.5% falling.
- **Outlook**: that line extended 7 days and damped to 60%, with a band of ±σ√h (σ = residual standard
  deviation, h = days ahead). Presented as an indication, never as a prediction.
- **Volatility**: root-mean-square of daily returns over 30 days.
- **Recommendation**: rising + storable → hold; rising + perishable → sell in batches; falling → sell now;
  flat but ≥ 3% above the 30-day average → sell now; otherwise no strong signal.

Without a `DATA_GOV_API_KEY` the API generates a deterministic **sample** series (seasonal wave + cycles +
noise per commodity and market) and the UI labels it clearly as sample data. With a key it pulls Agmarknet
daily mandi prices every 6 hours.

## Key decisions

| Decision | Why |
|---|---|
| Node API + separate Python ML service | The brief allows Node or Python. Node suits the I/O-heavy API; Python is where the ML ecosystem is. A narrow HTTP contract keeps them independent. |
| ONNX Runtime for serving | Train in PyTorch, serve without it: the serving container needs only onnxruntime, numpy and Pillow instead of the multi-gigabyte PyTorch stack. The export is checked numerically against PyTorch (max difference < 1e-5). |
| MobileNetV3-Large | Fine-tuned to 99% on PlantVillage while staying small (17 MB) and fast on a CPU: a full analysis including the 49-pass heatmap measured 320–460 ms on a laptop CPU, so no GPU is needed in production. |
| MongoDB | The brief offers MongoDB or MySQL. Analysis results are nested documents (top-3 lists, quality, review), which map naturally to documents. |
| Temperature scaling | Label smoothing during training makes raw scores under-confident. One fitted parameter makes the displayed confidence trustworthy. |
| "Uncertain" instead of a forced answer | A wrong confident diagnosis can cost a farmer a crop. Below the threshold the app says so and explains how to take a better photo. |
| Same-origin deployment | nginx serves the app and proxies `/api`, so no CORS is needed in production and cookies/tokens never cross origins. |
