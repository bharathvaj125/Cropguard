# CropGuard

**AI-powered smart agriculture platform.** A farmer photographs a leaf; CropGuard identifies crop diseases
and pests with deep-learning models, explains what it found and how to treat it, and puts weather advice
and market price trends on the same dashboard. An admin panel lets agronomists manage users and farms,
review AI reports and broadcast advisories.

| | |
|---|---|
| **Frontend** | React 19, React Router, Recharts, Vite |
| **Backend** | Node.js 22, Express 5, MongoDB (Mongoose), JWT auth |
| **AI / ML** | PyTorch (training) → ONNX Runtime (serving), FastAPI |
| **Models** | MobileNetV3-Large fine-tuned on PlantVillage (38 classes) and IP102 (26 pest classes) |
| **Weather** | Open-Meteo forecast and geocoding APIs |
| **Market** | Agmarknet mandi prices via data.gov.in (bundled sample series without a key) |
| **Deployment** | Docker Compose; AWS CloudFormation (EC2, S3, IAM, Secrets Manager, CloudFront) |
| **CI** | GitHub Actions: tests, lint, template lint, Docker build and smoke test |

## Features

Each feature is mapped to the module in the client brief.

| Module | What is built |
|---|---|
| 1. User authentication | Registration and login with bcrypt-hashed passwords and JWT; profile editing; password change (signs out other devices); account deletion that removes all data; rate-limited auth endpoints |
| 2. AI disease detection | Photo upload (JPG/PNG/WebP, validated by decoding, EXIF/GPS stripped); 38-class classifier covering 26 diseases on 14 crops; calibrated confidence scores; top-3 alternatives; optional crop hint that removes impossible classes; occlusion heatmap showing where the model looked; photo-quality warnings |
| 3. Pest detection | 26-class pest classifier (25 pest groups + "no pest"); pest description, damage signs, cultural / biological / chemical management and monitoring advice |
| 4. Weather intelligence | 7-day forecast for each farm or any searched place; temperature and rainfall charts; rule-based advice on irrigation, spraying windows, fungal-disease risk, heat, frost, heavy rain and harvest windows |
| 5. Market trends | Price history with min–max band, trend (rising / falling / stable), 7-day outlook range, volatility, best-market comparison, and a selling recommendation that accounts for perishability |
| 6. Farmer dashboard | Scan stats, 8-week crop-health chart, recent scans, upcoming field activities, weather and market cards, admin advisories; full scan history with filters; farm records; activity log (sowing, irrigation, spraying, harvest, with costs) |
| 7. Admin dashboard | Platform statistics and charts; user management (search, activate/deactivate, promote, delete with data); farm management; AI report monitoring with expert review (confirm / correct, visible to the farmer); advisory broadcasting by state; audit log of sign-ins and admin actions; model accuracy and system health |

Also included: a disease and pest reference library, responsive layout (phone to desktop), keyboard
navigation and screen-reader labels, and honest "uncertain" results instead of forced guesses.

## Model results

Measured once on held-out test images the models never saw during training or model selection.

| Model | Classes | Test images | Top-1 accuracy | Top-3 accuracy | Macro F1 |
|---|---|---|---|---|---|
| Disease (PlantVillage) | 38 | 10,709 | **99.1%** | 99.95% | 0.991 |
| Pest (IP102, regrouped) | 26 | 20,343 | **82.2%** | 92.7% | 0.814 |

Temperature scaling cut the expected calibration error from 11.2% to 0.3% (disease) and 9.2% to 0.9% (pest), so a
"90% confident" result is right about 90% of the time. See [docs/ML_MODEL.md](docs/ML_MODEL.md) for
the training method, per-class results and **known limitations**. Accuracy on real field photos will
be lower than these benchmark figures.

## Quick start (local, no Docker)

Requirements: Node.js 20+, Python 3.11+. MongoDB is **not** required locally: the API starts a private
`mongod` automatically through `mongodb-memory-server` and keeps its data in `backend/.data/`.

```bash
# 1. ML service (port 8000)
cd ml-service
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2. API (port 5000), in a second terminal
cd backend
npm install
cp .env.example .env            # set JWT_SECRET and the SEED_* passwords
npm run seed                    # optional: demo farms, activities, advisory, market data
npm run dev

# 3. Web app (port 5173), in a third terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the `SEED_*` accounts from `backend/.env`, or register.

## Run with Docker

```bash
cp .env.example .env            # set JWT_SECRET and SEED_ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost. Four containers start: `web` (nginx + React build), `api`, `ml` and `mongo`. Only
port 80 is published.

## Deploy to AWS

```bash
./infra/aws/deploy.sh                       # creates the whole stack in ap-south-1 (Mumbai)
```

One command creates an EC2 server running the Docker stack, a private encrypted S3 bucket for photos,
an IAM role (no access keys in the app), generated secrets in Secrets Manager and a CloudFront HTTPS
endpoint. Updates are pushed with `./infra/aws/update.sh`. Full guide, architecture diagram and cost
estimate: [docs/DEPLOYMENT_AWS.md](docs/DEPLOYMENT_AWS.md).

## Tests

```bash
cd backend && npm test          # 40 API and unit tests (auth, access control, scans, market, admin)
cd ml-service && pytest         # preprocessing and inference API tests
cd frontend && npm run lint && npm run build
```

GitHub Actions runs all of the above, lints the CloudFormation template, builds the Docker images and
smoke-tests the running stack on every push.

## Project structure

```
backend/          Express API
  src/routes/       auth, farms, analyses, activities, weather, market, dashboard, admin
  src/services/     diagnosis rules, ML client, weather insights, market analysis, storage (disk / S3)
  src/data/         disease and pest knowledge base (symptoms, treatment, prevention)
  tests/            node:test + supertest
ml-service/       FastAPI inference service
  app/              preprocessing, ONNX inference, heatmaps
  models/           exported models with labels and test metrics
  training/         data preparation and training scripts (PyTorch)
frontend/         React app (pages, components, nginx config)
infra/aws/        CloudFormation template and deploy / update scripts
docs/             architecture, API, ML and deployment documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): components, data model, request flow, security, design decisions
- [API reference](docs/API.md): every endpoint with request and response shapes
- [ML models](docs/ML_MODEL.md): datasets, training, evaluation, calibration, limitations, retraining
- [AWS deployment](docs/DEPLOYMENT_AWS.md): infrastructure, step-by-step deploy, operations, costs

## Disclaimer

CropGuard is a decision-support tool. AI results can be wrong, and product names in the advice are common
active ingredients, not recommendations for a specific product. Farmers should follow product labels and
confirm important decisions with their local agricultural extension officer.

## Data credits

- PlantVillage dataset: Hughes & Salathé (2015), Mohanty, Hughes & Salathé (2016). CC BY-SA 3.0.
- IP102 insect pest dataset: Wu et al. (2019), CVPR, as packaged by Project AgML. CC BY 4.0.
- Weather data: Open-Meteo.com (CC BY 4.0). Market data: Agmarknet / data.gov.in (Government Open Data License – India).
