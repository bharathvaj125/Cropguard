# Track B: Claude advisory and AWS speech

This branch (`track-b-cloud-ai`) adds the cloud pieces of the voice assistant and crop advisory:

| Task | What was built | Where |
|---|---|---|
| 1. Claude advisory | `generateLlmAdvisory()`: Claude through **Amazon Bedrock** or the **Claude API**, structured output `{ body, voiceSummary, missingContextQuestions }`, returns `null` so the caller falls back to the rule-based almanac | `backend/src/services/claudeAdvisor.js` |
| 2. Polly text-to-speech | `synthesizeSpeechWithPolly(text, language)`, MP3 stored and cached; `POST /api/advisory/tts` | `backend/src/services/speech.js`, `backend/src/routes/speech.js` |
| 3. Transcribe speech-to-text | `transcribeAudio(buffer, language)`: real-time streaming for WAV / Ogg-Opus / FLAC, batch job via S3 for WebM / MP3 / MP4; `POST /api/advisory/stt` | same files |
| Frontend helper | `speak()`, `startRecording()`, `transcribe()`, `toWav()` with automatic browser fallbacks | `frontend/src/lib/cloudVoice.js` |
| Deployment | IAM permissions, CloudFormation parameters, Docker env, `.env.example` | `infra/aws/cropguard.yaml`, `docker-compose.yml` |
| Tests | 25 tests with fake AWS / Claude clients (65 backend tests in total) | `backend/tests/trackb.test.js` |

Merged with Lingesh's `lingesh` branch (soil, produce and advisory modules) into `main`.

## Differences from the task sheet, and why

| Task sheet | What this branch does | Reason |
|---|---|---|
| `BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0` | Default `anthropic.claude-sonnet-5-5` (Claude API: `claude-sonnet-5-5`) | Claude 3.5 Sonnet was **retired on 28 Oct 2025** and no longer answers. Sonnet 5.5 is the current Sonnet. The server logs a warning if a retired ID is configured. |
| `@aws-sdk/client-bedrock-runtime` | `@anthropic-ai/bedrock-sdk` (`AnthropicBedrockMantle`) | Anthropic's Bedrock client speaks the same Messages API as the Claude API, so one code path serves both, including structured outputs. It signs requests with the normal AWS credential chain (the EC2 role). |
| Polly voices for "Indian languages" | Hindi and Indian English only (voice **Kajal**, neural) | Amazon Polly has **no Tamil, Telugu, Kannada, Marathi, Bengali or Punjabi voice** ([voice list](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)). For those, `/tts` returns 422 with `fallback: "browser"` and the frontend helper uses the browser voice. |
| Transcribe `hi-IN`, `ta-IN`, `te-IN`, `en-IN` | All ten: hi, en, ta, te, kn, mr, bn, pa, gu, ml | Transcribe supports all of them, batch and streaming ([language list](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)). |
| Accept `.wav`, `.webm`, `.mp3` | WAV, Ogg-Opus, FLAC stream in real time; WebM, MP3, MP4/M4A, Ogg-Vorbis use a batch job | Transcribe's real-time API only takes PCM, FLAC and Ogg-Opus. The frontend helper converts every recording to 16 kHz WAV in the browser, so in practice everything takes the fast streaming path and no S3 is needed. |
| Two endpoints | Also `GET /api/advisory/cloud-status` and `POST /api/advisory/llm` | `cloud-status` tells the UI which cloud features are on, so it does not have to guess. `llm` lets the Claude path be tried on its own; the chat endpoint will call `generateLlmAdvisory` directly. |

## How it is connected (merged with the `lingesh` branch)

| Feature | Claude / AWS piece | Fallback when it is off or fails |
|---|---|---|
| Voice assistant answers (`POST /api/advisory/ask`) | `generateLlmAdvisory()` with the farm's state, soil, irrigation and crops, plus the last few turns of the conversation, so Claude remembers the answers to its own follow-up questions | Lingesh's crop almanac rules (`services/advisory.js`) |
| Voice input (`VoiceAssistant.jsx`) | `startRecording()` + `transcribe()` -> Amazon Transcribe | The browser's Web Speech API, then the text box |
| Spoken answers | `speak()` -> Amazon Polly (Hindi, English) | Browser speech synthesis (all languages) |
| Soil Health Card reading (`POST /api/soil/extract`) | Claude vision reads the photo or PDF; impossible values are dropped; the farmer reviews every value | The farmer types the values into the same review table |
| Produce grading (`POST /api/produce/grade`) | Claude vision grades produce the trained model does not know | The trained FruitNet model first; a clearly labelled basic colour check last |

Each answer records which engine produced it (`source: "claude" | "rules"`, `method: "model" | "claude" | "basic"`,
`valueSource: "claude" | "manual" | "text"`), and the UI shows it, so a farmer always knows how much to trust a result.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BEDROCK_MODEL_ID` | empty | e.g. `anthropic.claude-sonnet-5-5`. Turns on Claude through Bedrock |
| `BEDROCK_REGION` | `AWS_REGION` or `ap-south-1` | Mumbai is served through Bedrock's global endpoint |
| `ANTHROPIC_API_KEY` | empty | Claude API instead of Bedrock (used when `BEDROCK_MODEL_ID` is empty) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for the Claude API path |
| `LLM_PROVIDER` | auto | `bedrock`, `anthropic` or `off` to force a choice |
| `LLM_EFFORT` | `medium` | `low` / `medium` / `high`: how much Claude reasons before answering |
| `LLM_REFUSAL_FALLBACK` | on | Set `off` to stop retrying declined requests on another model |
| `POLLY_ENABLED` | `false` | Amazon Polly voices |
| `TRANSCRIBE_ENABLED` | `false` | Amazon Transcribe |
| `STT_MAX_MB` | `8` | Largest recording accepted (nginx allows 10 MB bodies) |

On AWS the CloudFormation stack sets these from its `BedrockModelId` and `EnableVoice` parameters and grants
the instance role `bedrock-mantle:CreateInference`, `polly:SynthesizeSpeech` and the Transcribe actions.

### Before the first deploy

1. In the AWS console, open **Amazon Bedrock -> Model access** in your region and enable **Claude Sonnet 5.5**
   (or pick a model your account has, such as `anthropic.claude-sonnet-5`, which is open to all accounts, and
   pass it as `BedrockModelId`).
2. Deploy as usual: `./infra/aws/deploy.sh`, or `./infra/aws/deploy.sh BedrockModelId=` to keep Claude off.

## How Claude is used

- **Structured output.** The response is constrained to a JSON schema, so `body`, `voiceSummary` and
  `missingContextQuestions` are always present and typed. No parsing of free text.
- **Prompt.** The system prompt (in `claudeAdvisor.js`) follows the task sheet: ICAR packages of practices,
  fertiliser converted to bags of Urea (45 kg), DAP (50 kg) and MOP (50 kg) per acre with the DAP-first
  calculation, asking for state and irrigation before conclusive sowing advice, answers in the farmer's
  language, a one-or-two-sentence spoken summary, no banned pesticides, and referral to the KVK / Kisan Call
  Centre for serious problems. It contains no dates or per-request data, so it stays cacheable; today's date,
  season and the farm context go in the user message.
- **Missing context.** The user message lists what the app knows and what it does not ("Not provided:
  irrigation"), and Claude returns follow-up questions in the farmer's language.
- **Refusals.** On the Claude API the request uses server-side `fallbacks: "default"`; on Bedrock, where that
  is not available, the SDK's client-side fallback middleware retries on Claude Sonnet 5. If every model
  declines, `generateLlmAdvisory` returns `null` and the rule-based answer is used.
- **Failure handling.** Timeouts (45 s), network errors, API errors, truncated or unparseable output all return
  `null`. Errors are logged without the prompt or credentials.
- **Cost.** At Claude API list prices for Claude Sonnet 5.5 ($2 per million input tokens, $10 per million output
  tokens), a typical question of ~1,500 input and ~1,500 output tokens (including reasoning) costs about
  US$0.02. Bedrock sets its own prices. Each call is rate-limited per user (20 a minute).

## What was verified, and what was not

| Check | Result |
|---|---|
| Unit and API tests with fake clients (prompt, schema, fallbacks, caching, audio detection, WAV decoding, batch job clean-up, errors) | 25 / 25 pass; 65 / 65 backend tests in total |
| Real Anthropic SDK and real Bedrock client against a local stand-in server | Correct request: `/v1/messages`, structured-output and fallback betas, SigV4-signed for `ap-south-1` on Bedrock, no `fallbacks` field sent to Bedrock; answer parsed |
| Frontend helper in a real browser | MediaRecorder (WebM/Opus) -> 16 kHz mono 16-bit WAV; `/stt` takes the streaming path; Polly failure falls back to the browser voice |
| Real AWS calls | **Not run:** no AWS credentials on the development machine. Both Polly and Transcribe calls reached the AWS SDK and stopped only at "could not load credentials" |
| Integration with `lingesh` | Done: merged into `main`, with integration tests for the chat, soil reading and produce grading paths |
