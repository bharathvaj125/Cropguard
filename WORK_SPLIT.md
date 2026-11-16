# Kisan Mitra AI (CropGuard) — Project Work Split & Roadmap

**Client SRS:** Kisan Mitra AI — Client Project Brief & Software Requirements Specification (v1.0)  
**Target Completion:** End of Internship Term  
**Baseline Repository:** `L:\Cropguard`

---

## 1. Project Current Status Overview

Our base repository currently contains the authentication, dashboard foundation, weather forecasting (Open-Meteo), mandi price trends (Agmarknet), and leaf disease/pest classification.

To meet 100% of the client's SRS requirements, we are splitting the remaining **~63% of deliverables** equally between us.

```
Total Project Deliverables (100%)
├── ✅ Platform Foundation, Auth & Weather/Mandi   --> Already Completed (~37%)
├── 👤 Developer 1 (Track A): Soil & Quality Grade --> Assigned (~31.5%)
└── 👤 Developer 2 (Track B): Voice & Crop Advisory --> Assigned (~31.5%)
```

---

## 2. Work Allocation

### 👤 Developer 1 (Track A: Soil Health & Produce Quality Grading)

| Feature | SRS Reference | Deliverables |
|---|---|---|
| **Soil Health Card OCR & Extraction** | Section 5.3 | • File/photo upload component for Soil Health Cards (PDF/JPG/PNG)<br>• OCR pipeline to extract $N$, $P$, $K$, $pH$, $EC$, $OC$, and micronutrients<br>• Validation logic: flag unreadable/missing fields without hallucinating values |
| **Soil Advisory & Interpretation** | Section 5.3 | • Plain-language interpretation of soil indicators (Low, Optimal, High)<br>• Fertilizer and soil conditioning recommendations based on crop and soil deficiency<br>• Export/save soil test results to the farmer's profile |
| **Produce Quality Grading** | Section 5.2 | • Produce image upload (fruits, vegetables, grains)<br>• Visual quality assessment pipeline (Grade A, B, C based on color, size uniformity, blemishes, defects)<br>• Mandatory disclaimer: "Results are indicative and require buyer inspection" |
| **Grade-to-Market Price Estimation** | Section 5.2 | • Link produce quality grade with live Mandi price engine<br>• Return estimated price range with commodity, market, date/time, and unit ($₹/\text{quintal}$ or $₹/\text{kg}$) |

#### Key Technical Stack for Track A:
- **Backend:** Node.js / Python OCR service (Tesseract / AWS Textract / Vision API)
- **Frontend:** React file uploader with drag-and-drop, camera capture, and extracted value review table

---

### 👤 Developer 2 (Track B: Multilingual Voice Assistant & Crop Advisory)

| Feature | SRS Reference | Deliverables |
|---|---|---|
| **Voice Assistant Interface** | Section 5.1 | • Floating / prominent microphone button with active recording animation<br>• Language selector for supported Indian languages (Hindi, Tamil, Telugu, English, etc.)<br>• Clean text-input alternative fallback |
| **Speech-to-Text (STT) & TTS** | Section 5.1 | • Audio capture and STT integration (Web Speech API / Whisper / AWS Transcribe)<br>• Natural Text-to-Speech audio playback (Web Speech Synthesis / AWS Polly)<br>• Error handling for noisy audio or speech recognition failure |
| **Conversational Crop Advisory Engine** | Section 5.4 | • AI reasoning service (Claude via Bedrock / Gemini API / OpenAI)<br>• Structured prompt engineering for agricultural domain expertise<br>• Interactive context gathering: automatically ask farmer for missing details (location, season, soil type) before prescribing advice |
| **Cultivation Guidance Modules** | Section 5.4 | • Guidance on sowing windows, irrigation schedules, nutrient management, and preventive care<br>• Clear guidance disclaimers directing farmers to local extension officers when necessary |

#### Key Technical Stack for Track B:
- **Frontend:** Audio recording hooks, Web Speech API / TTS player, language dropdown
- **Backend:** AI orchestration endpoint with streaming / JSON response format

---

## 3. Shared Responsibilities & Integration

| Task | Description |
|---|---|
| **Navigation & Layout Update** | Ensure the main navigation exposes the 4 core tabs: **Voice Assistant**, **Soil Doctor**, **Produce Grader**, and **Market & Weather**. |
| **Shared API Schema** | Agree on consistent JSON response structures for both tracks (see Section 4 below). |
| **Mobile Responsiveness** | Verify all modals, camera uploads, and audio controls render cleanly on mobile viewports. |
| **Deployment & CI/CD** | Update existing Docker Compose and CloudFormation scripts to package any new microservice/dependencies. |

---

## 4. API Interface Agreements

To work independently without blocking each other, we will adhere to these API contracts:

### Track A: Soil & Produce Endpoints
```http
POST /api/soil/analyze
Content-Type: multipart/form-data
Response:
{
  "extractedValues": {
    "nitrogen": { "value": 240, "unit": "kg/ha", "status": "Low" },
    "phosphorus": { "value": 18, "unit": "kg/ha", "status": "Medium" },
    "potassium": { "value": 310, "unit": "kg/ha", "status": "High" },
    "ph": { "value": 6.8, "status": "Neutral" },
    "organicCarbon": { "value": 0.55, "unit": "%", "status": "Medium" }
  },
  "unreadableFields": ["zinc", "boron"],
  "recommendations": [
    "Apply urea in split doses to address nitrogen deficiency.",
    "Soil pH is optimal for most cereals and pulses."
  ]
}
```

```http
POST /api/produce/grade
Content-Type: multipart/form-data
Response:
{
  "commodity": "Tomato",
  "grade": "Grade A",
  "confidence": 0.92,
  "defectsDetected": [],
  "estimatedPriceRange": {
    "min": 28,
    "max": 34,
    "unit": "Rs/kg",
    "market": "Kolar Mandi",
    "updatedAt": "2026-11-16T10:00:00Z"
  },
  "disclaimer": "Indicative estimate based on visual parameters. Final prices depend on physical buyer inspection."
}
```

### Track B: Voice & Advisory Endpoints
```http
POST /api/assistant/query
Content-Type: application/json
{
  "query": "When should I sow wheat in northern Karnataka?",
  "language": "kn-IN",
  "context": {
    "farmLocation": "Dharwad",
    "soilType": "Black soil"
  }
}
Response:
{
  "responseText": "In northern Karnataka, the ideal sowing window for wheat is between late October and mid-November...",
  "audioUrl": "/api/assistant/audio/cache-key.mp3",
  "missingContextQuestions": [
    "Do you have assured irrigation or is this rainfed?"
  ],
  "disclaimer": "Guidance based on standard agronomic practices."
}
```

---

## 5. Timeline & Milestones

- **Milestone 1 (Days 1–3):** Setup endpoints, mock responses, and complete frontend wireframes.
- **Milestone 2 (Days 4–7):** Core integration (Track A OCR & grading models; Track B Voice STT/TTS & LLM advisory).
- **Milestone 3 (Days 8–10):** End-to-end testing, error handling (unclear speech, unreadable soil cards), and demo prep.
