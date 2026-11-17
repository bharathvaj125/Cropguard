import crypto from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';
import { LANGUAGES, normaliseLanguage } from './languages.js';
import { storage } from './storage.js';

/**
 * Cloud speech for the voice assistant.
 *
 *   Text-to-speech   Amazon Polly. Only Hindi and Indian English have Polly voices; for the
 *                    other languages the frontend keeps using the browser's own voices.
 *   Speech-to-text   Amazon Transcribe. All ten supported Indian languages.
 *                      - WAV (16-bit PCM), Ogg-Opus and FLAC stream in real time (no S3).
 *                      - WebM, MP3, MP4/M4A (what most browsers record) go through a batch job,
 *                        which needs the S3 storage driver.
 *
 * Credentials come from the default AWS chain (EC2 instance role in production).
 */

// ---------------------------------------------------------------------------
// Clients (lazy, injectable for tests)
// ---------------------------------------------------------------------------

const clients = {};
const overrides = {};

export function _setSpeechClientsForTest(fakes) {
  Object.assign(overrides, fakes);
  for (const key of Object.keys(clients)) delete clients[key];
}

async function polly() {
  if (overrides.polly) return overrides.polly;
  if (!clients.polly) {
    const { PollyClient } = await import('@aws-sdk/client-polly');
    clients.polly = new PollyClient({ region: config.speech.pollyRegion });
  }
  return clients.polly;
}

async function transcribeStreaming() {
  if (overrides.streaming) return overrides.streaming;
  if (!clients.streaming) {
    const { TranscribeStreamingClient } = await import('@aws-sdk/client-transcribe-streaming');
    clients.streaming = new TranscribeStreamingClient({ region: config.speech.transcribeRegion });
  }
  return clients.streaming;
}

async function transcribeBatch() {
  if (overrides.batch) return overrides.batch;
  if (!clients.batch) {
    const { TranscribeClient } = await import('@aws-sdk/client-transcribe');
    clients.batch = new TranscribeClient({ region: config.speech.transcribeRegion });
  }
  return clients.batch;
}

// ---------------------------------------------------------------------------
// Text-to-speech (Polly)
// ---------------------------------------------------------------------------

/**
 * Polly voices for Indian languages (docs.aws.amazon.com/polly/latest/dg/available-voices.html).
 * Kajal is a bilingual Hindi / Indian English neural voice.
 */
export const POLLY_VOICES = {
  hi: { VoiceId: 'Kajal', Engine: 'neural', LanguageCode: 'hi-IN' },
  en: { VoiceId: 'Kajal', Engine: 'neural', LanguageCode: 'en-IN' },
};

export function pollyVoiceFor(language) {
  return POLLY_VOICES[normaliseLanguage(language)] || null;
}

/** Turn markdown into something a voice can read. */
export function toSpeakableText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_TTS_CHARS = 1500;

/**
 * Synthesize `text` with Polly and store the MP3. The same text in the same voice is
 * synthesized once and served from storage after that.
 * @returns {Promise<{audioUrl: string, voice: string, cached: boolean}>}
 */
export async function synthesizeSpeechWithPolly(text, language) {
  if (!config.speech.pollyEnabled) {
    throw new ApiError(503, 'Cloud voice is turned off. Use the browser voice instead.', { fallback: 'browser' });
  }
  const voice = pollyVoiceFor(language);
  if (!voice) {
    const lang = LANGUAGES[normaliseLanguage(language)]?.name || language;
    throw new ApiError(422, `Amazon Polly has no ${lang} voice. Use the browser voice for this language.`, {
      fallback: 'browser',
    });
  }
  const speakable = toSpeakableText(text).slice(0, MAX_TTS_CHARS);
  if (!speakable) throw ApiError.badRequest('There is no text to read aloud');

  const hash = crypto
    .createHash('sha256')
    .update(`${voice.Engine}|${voice.VoiceId}|${voice.LanguageCode}|${speakable}`)
    .digest('hex')
    .slice(0, 40);
  const key = `tts/${hash}.mp3`;

  if (await storage.exists(key)) {
    return { audioUrl: await storage.url(key), voice: voice.VoiceId, cached: true };
  }

  const { SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
  let result;
  try {
    result = await (await polly()).send(
      new SynthesizeSpeechCommand({ ...voice, Text: speakable, TextType: 'text', OutputFormat: 'mp3' }),
    );
  } catch (err) {
    console.error(`polly failed: ${err.name}: ${err.message}`);
    throw new ApiError(502, 'The cloud voice service failed. Use the browser voice instead.', { fallback: 'browser' });
  }
  const audio = Buffer.from(await result.AudioStream.transformToByteArray());
  await storage.save(key, audio, 'audio/mpeg');
  return { audioUrl: await storage.url(key), voice: voice.VoiceId, cached: false };
}

// ---------------------------------------------------------------------------
// Speech-to-text (Transcribe)
// ---------------------------------------------------------------------------

const MAX_STREAM_SECONDS = 120;

/**
 * Identify the audio container from its first bytes (never from the file name or MIME type).
 * @returns {{format: string, streaming?: {encoding: string, sampleRate: number}, batchFormat?: string, pcm?: Buffer} }
 */
export function detectAudio(buffer) {
  const b = buffer;
  const ascii = (start, end) => b.subarray(start, end).toString('latin1');
  if (b.length < 16) return { format: 'unknown' };

  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') {
    const wav = parseWav(b);
    if (wav) return { format: 'wav', streaming: { encoding: 'pcm', sampleRate: wav.sampleRate }, pcm: wav.pcm, seconds: wav.seconds };
    return { format: 'wav', batchFormat: 'wav' }; // compressed WAV: let batch handle it
  }
  if (ascii(0, 4) === 'OggS') {
    if (ascii(0, 128).includes('OpusHead')) return { format: 'ogg-opus', streaming: { encoding: 'ogg-opus', sampleRate: 48000 } };
    return { format: 'ogg', batchFormat: 'ogg' };
  }
  if (ascii(0, 4) === 'fLaC') {
    const sampleRate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4);
    return { format: 'flac', streaming: { encoding: 'flac', sampleRate } };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { format: 'webm', batchFormat: 'webm' };
  // MP3: an ID3 tag, or an MPEG frame sync with a real layer (AAC/ADTS uses layer bits 00).
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && ((b[1] >> 1) & 0x03) !== 0)) {
    return { format: 'mp3', batchFormat: 'mp3' };
  }
  if (ascii(4, 8) === 'ftyp') return { format: 'mp4', batchFormat: 'mp4' };
  return { format: 'unknown' };
}

/** Read a WAV file. Returns 16-bit mono PCM (stereo is down-mixed), or null if not 16-bit PCM. */
export function parseWav(b) {
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= b.length) {
    const id = b.subarray(offset, offset + 4).toString('latin1');
    const size = b.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: b.readUInt16LE(body),
        channels: b.readUInt16LE(body + 2),
        sampleRate: b.readUInt32LE(body + 4),
        bitsPerSample: b.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = b.subarray(body, Math.min(body + size, b.length));
      break;
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data || fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16 || fmt.channels < 1) return null;

  let pcm = data;
  if (fmt.channels > 1) {
    const frames = Math.floor(data.length / (2 * fmt.channels));
    pcm = Buffer.alloc(frames * 2);
    for (let i = 0; i < frames; i += 1) {
      let sum = 0;
      for (let c = 0; c < fmt.channels; c += 1) sum += data.readInt16LE((i * fmt.channels + c) * 2);
      pcm.writeInt16LE(Math.round(sum / fmt.channels), i * 2);
    }
  }
  return { sampleRate: fmt.sampleRate, pcm, seconds: pcm.length / 2 / fmt.sampleRate };
}

async function* audioChunks(buffer, chunkBytes) {
  for (let i = 0; i < buffer.length; i += chunkBytes) {
    yield { AudioEvent: { AudioChunk: buffer.subarray(i, i + chunkBytes) } };
  }
}

async function transcribeStream(buffer, audio, locale) {
  const { StartStreamTranscriptionCommand } = await import('@aws-sdk/client-transcribe-streaming');
  const { encoding, sampleRate } = audio.streaming;
  if (sampleRate < 8000 || sampleRate > 48000) {
    throw ApiError.badRequest('Audio sample rate must be between 8 and 48 kHz');
  }
  const body = audio.pcm || buffer;
  // ~100 ms of audio per event for PCM; compressed formats in 8 KB pieces.
  const chunkBytes = encoding === 'pcm' ? Math.max(1024, Math.round(sampleRate * 2 * 0.1)) : 8192;

  const response = await (await transcribeStreaming()).send(
    new StartStreamTranscriptionCommand({
      LanguageCode: locale,
      MediaEncoding: encoding,
      MediaSampleRateHertz: sampleRate,
      AudioStream: audioChunks(body, chunkBytes),
    }),
  );

  const parts = [];
  for await (const event of response.TranscriptResultStream) {
    for (const result of event.TranscriptEvent?.Transcript?.Results || []) {
      if (!result.IsPartial && result.Alternatives?.[0]?.Transcript) parts.push(result.Alternatives[0].Transcript);
    }
  }
  return parts.join(' ').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function transcribeWithJob(buffer, audio, locale) {
  const id = crypto.randomUUID();
  const key = `stt/${id}.${audio.batchFormat}`;
  await storage.save(key, buffer, 'application/octet-stream');
  const mediaUri = await storage.s3Uri(key);
  if (!mediaUri) {
    await storage.remove(key);
    throw new ApiError(
      422,
      `${audio.format.toUpperCase()} audio needs S3 storage for transcription. Record as WAV or Ogg-Opus, or set STORAGE_DRIVER=s3.`,
    );
  }

  const { StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } = await import(
    '@aws-sdk/client-transcribe'
  );
  const client = await transcribeBatch();
  const TranscriptionJobName = `cropguard-${id}`;
  try {
    await client.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName,
        LanguageCode: locale,
        MediaFormat: audio.batchFormat,
        Media: { MediaFileUri: mediaUri },
      }),
    );
    // Short voice notes usually finish in 5-15 seconds.
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const { TranscriptionJob: job } = await client.send(new GetTranscriptionJobCommand({ TranscriptionJobName }));
      if (job.TranscriptionJobStatus === 'COMPLETED') {
        const res = await fetch(job.Transcript.TranscriptFileUri, { signal: AbortSignal.timeout(10000) });
        const json = await res.json();
        return (json.results?.transcripts || []).map((t) => t.transcript).join(' ').trim();
      }
      if (job.TranscriptionJobStatus === 'FAILED') {
        console.error(`transcribe job failed: ${job.FailureReason}`);
        throw new ApiError(422, 'The recording could not be processed. Please try again.');
      }
      await sleep(config.env === 'test' ? 1 : 1500);
    }
    throw new ApiError(504, 'Speech recognition took too long. Please try a shorter recording.');
  } finally {
    await storage.remove(key);
    await client.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName })).catch(() => {});
  }
}

/**
 * Transcribe a short recording.
 * @returns {Promise<{transcript: string, language: string, mode: 'streaming'|'batch'}>}
 */
export async function transcribeAudio(buffer, language) {
  if (!config.speech.transcribeEnabled) {
    throw new ApiError(503, 'Cloud speech recognition is turned off. Use the browser microphone input instead.', {
      fallback: 'browser',
    });
  }
  const code = normaliseLanguage(language);
  if (!code) throw ApiError.badRequest(`Unsupported language. Use one of: ${Object.keys(LANGUAGES).join(', ')}`);
  if (!buffer?.length) throw ApiError.badRequest('Please attach a voice recording');

  const audio = detectAudio(buffer);
  if (audio.format === 'unknown') {
    throw new ApiError(415, 'Unsupported audio. Send WAV, WebM, Ogg, MP3, MP4/M4A or FLAC.');
  }
  if (audio.seconds && audio.seconds > MAX_STREAM_SECONDS) {
    throw ApiError.badRequest(`Recordings can be at most ${MAX_STREAM_SECONDS / 60} minutes long`);
  }

  const locale = LANGUAGES[code].locale;
  let transcript;
  let mode;
  try {
    if (audio.streaming) {
      mode = 'streaming';
      transcript = await transcribeStream(buffer, audio, locale);
    } else {
      mode = 'batch';
      transcript = await transcribeWithJob(buffer, audio, locale);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error(`transcribe failed: ${err.name}: ${err.message}`);
    throw new ApiError(502, 'The speech recognition service failed. Please type your question instead.', {
      fallback: 'text',
    });
  }

  if (!transcript) {
    throw new ApiError(422, 'We could not hear any words. Speak close to the phone in a quiet place and try again.');
  }
  return { transcript, language: code, mode };
}

/** What the frontend can use, so it picks cloud or browser speech without trial and error. */
export async function speechStatus() {
  return {
    tts: {
      enabled: config.speech.pollyEnabled,
      engine: 'amazon-polly',
      languages: config.speech.pollyEnabled ? Object.keys(POLLY_VOICES) : [],
    },
    stt: {
      enabled: config.speech.transcribeEnabled,
      engine: 'amazon-transcribe',
      languages: config.speech.transcribeEnabled ? Object.keys(LANGUAGES) : [],
      streamingFormats: ['wav (16-bit PCM)', 'ogg-opus', 'flac'],
      batchFormats: (await storage.driverName()) === 's3' ? ['webm', 'mp3', 'mp4', 'm4a', 'ogg'] : [],
    },
  };
}
