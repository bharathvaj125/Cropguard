# Track B: Cloud AI & Speech Integration Tasks (For Claude Code)

**Project:** Kisan Mitra AI (CropGuard)  
**Branch:** `lingesh`  
**Base Repository Path:** `L:\Cropguard`  
**Target Goal:** Upgrade the functional MVP voice & crop advisory service into an enterprise production cloud service using **Amazon Bedrock (Claude 3.5)** and **AWS Speech Services (Transcribe & Polly)**.

---

## 1. Context & What Is Already Done

The repository on branch `lingesh` already contains:
1. **Frontend Voice UI (`frontend/src/pages/VoiceAssistant.jsx`):**
   - Active microphone button with audio recording animation.
   - Language selector (Hindi, Tamil, Telugu, Kannada, Marathi, Bengali, Punjabi, English).
   - Text fallback input.
   - Speech synthesis audio playback.
2. **Backend Advisory Architecture (`backend/src/services/advisory.js` & `backend/src/routes/advisory.js`):**
   - Indian crop almanac and ICAR package of practices (sowing, irrigation, fertilizer, IPM).
   - Context detection (flags missing location/irrigation as per SRS 5.4).
   - MongoDB chat model (`AdvisoryChat`).
   - 61/61 automated tests passing.

---

## 2. Your Tasks (Track B Scope of Work)

### Task 1: Amazon Bedrock (Claude 3.5 Sonnet) Integration
**File to modify:** `backend/src/services/advisory.js`

Currently, `generateCropAdvisory()` generates answers from local rules and almanac data. You need to add an optional LLM reasoning pipeline using `@aws-sdk/client-bedrock-runtime` or Anthropic SDK:

1. Check if `process.env.BEDROCK_MODEL_ID` (or `ANTHROPIC_API_KEY`) is configured.
2. If configured, send a structured prompt to Claude:
   ```javascript
   System: "You are Kisan Mitra AI, an expert agricultural advisor trained on ICAR packages of practices.
   Provide practical, actionable advice to Indian farmers. Always calculate fertilizers in bags of Urea (45kg),
   DAP (50kg), and MOP (50kg) per acre. If the farmer did not state their state/location or irrigation method,
   explicitly ask for it before giving conclusive sowing advice. Provide a concise 2-sentence summary in
   the farmer's language for audio playback."
   ```
3. Return:
   - `body`: Detailed formatted markdown.
   - `voiceSummary`: 1-2 sentence spoken summary in the requested language (`hi`, `ta`, `te`, `kn`, `en`).
   - `missingContextQuestions`: Array of strings if essential context is missing.
4. Keep the existing rule-based almanac as a fallback when offline or when no API key is provided.

### Task 2: Cloud Speech Synthesis via Amazon Polly
**Files to modify:** `backend/src/services/advisory.js` & `backend/src/routes/advisory.js`

Currently, TTS audio is synthesized in the browser via `window.speechSynthesis`. To support browsers/mobile devices without native Indian voices:

1. Install `@aws-sdk/client-polly` in `backend/`:
   ```bash
   cd backend && npm install @aws-sdk/client-polly
   ```
2. In `backend/src/services/advisory.js`, create a helper `synthesizeSpeechWithPolly(text, language)`:
   - Map Indian languages to Amazon Polly Neural voices:
     - `hi` / `hi-IN`: Voice `Kajal` (Neural) or `Aditi`
     - `en` / `en-IN`: Voice `Kajal` (Bilingual Indian English)
   - Synthesize to MP3 audio stream and save via `storage.save(...)` or return audio buffer.
3. Add route `POST /api/advisory/tts`:
   - Body: `{ text: string, language: string }`
   - Returns: `{ audioUrl: string }`

### Task 3: Server-Side Speech-to-Text via Amazon Transcribe (Optional Enhancement)
**Files to modify:** `backend/src/routes/advisory.js`

1. Install `@aws-sdk/client-transcribe-streaming` (or standard Transcribe client).
2. Add route `POST /api/advisory/stt`:
   - Accepts multipart audio upload (`.wav`, `.webm`, `.mp3`).
   - Calls Amazon Transcribe with `LanguageCode` (e.g. `hi-IN`, `ta-IN`, `te-IN`, `en-IN`).
   - Returns: `{ transcript: string }`

---

## 3. Environment Variables Configuration

Add these to `backend/.env.example` and your local `backend/.env`:
```env
# Track B AWS Cloud Services
AWS_REGION=ap-south-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
# Or direct Anthropic API key if using Bedrock alternative:
ANTHROPIC_API_KEY=

# AWS Polly Voice Configuration
POLLY_ENABLED=false
```

---

## 4. Verification & Testing

Before submitting, verify that all backend tests and frontend builds pass cleanly:
```bash
# In backend:
cd backend
npm test

# In frontend:
cd frontend
npm run lint
npm run build
```

Commit your changes to the `lingesh` branch (or create your feature branch from `lingesh`).
