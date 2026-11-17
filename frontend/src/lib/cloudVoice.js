/**
 * Cloud voice helpers for the voice assistant (Track B).
 *
 *   const rec = await startRecording();         // asks for the microphone
 *   const blob = await rec.stop();
 *   const { transcript } = await transcribe(blob, 'hi');
 *   ...
 *   await speak(answer.voiceSummary, 'hi');     // Polly when available, browser voice otherwise
 *
 * Every function degrades gracefully: when the server has Polly or Transcribe switched off,
 * or a language has no cloud voice, it falls back to the browser's own speech features.
 */
import { api } from './api.js';

const LOCALES = {
  hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN',
  mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN', ml: 'ml-IN',
};
const short = (language) => String(language || 'en').toLowerCase().split(/[-_]/)[0];

let statusPromise = null;

/** What the server offers. Cached for the session; never rejects. */
export function getCloudStatus() {
  if (!statusPromise) {
    statusPromise = api.get('/advisory/cloud-status').catch(() => ({
      llm: { enabled: false },
      tts: { enabled: false, languages: [] },
      stt: { enabled: false, languages: [] },
    }));
  }
  return statusPromise;
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

let currentAudio = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

function speakInBrowser(text, language) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth) return Promise.resolve({ engine: 'none' });
  const locale = LOCALES[short(language)] || 'en-IN';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voice = synth.getVoices().find((v) => v.lang === locale) || synth.getVoices().find((v) => v.lang.startsWith(short(language)));
  if (voice) utterance.voice = voice;
  return new Promise((resolve) => {
    utterance.onend = () => resolve({ engine: 'browser', voice: voice?.name || null });
    utterance.onerror = () => resolve({ engine: 'browser', voice: voice?.name || null, error: true });
    synth.speak(utterance);
  });
}

/**
 * Read `text` aloud. Uses Amazon Polly for languages it has a voice for (Hindi, English),
 * otherwise the browser voice. Resolves when playback ends.
 * @returns {Promise<{engine: 'polly'|'browser'|'none', voice?: string}>}
 */
export async function speak(text, language) {
  stopSpeaking();
  const lang = short(language);
  const status = await getCloudStatus();
  if (status.tts?.enabled && status.tts.languages.includes(lang)) {
    try {
      const { audioUrl, voice } = await api.post('/advisory/tts', { text, language: lang });
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      await audio.play();
      await new Promise((resolve) => {
        audio.onended = resolve;
        audio.onerror = resolve;
      });
      return { engine: 'polly', voice };
    } catch {
      // Network error, autoplay blocked or Polly failure: use the browser voice instead.
    }
  }
  return speakInBrowser(text, lang);
}

// ---------------------------------------------------------------------------
// Recording and transcription
// ---------------------------------------------------------------------------

/**
 * Start recording from the microphone.
 * @returns {Promise<{stop: () => Promise<Blob>, cancel: () => void}>}
 */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Voice recording is not supported in this browser. Please type your question.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true } });
  return recordStream(stream, { stopTracks: true });
}

/** Record any audio MediaStream (used by startRecording, and by tests with a synthetic stream). */
export function recordStream(stream, { stopTracks = false } = {}) {
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();
  const release = () => stopTracks && stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      recorder.stop();
    },
  };
}

/**
 * Convert any recording the browser can decode (WebM, Ogg, MP4, ...) to 16 kHz mono 16-bit WAV.
 * WAV goes to Amazon Transcribe's real-time API directly, so no S3 upload or batch job is needed.
 */
export async function toWav(blob, sampleRate = 16000) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close();
  }
  const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination); // multi-channel input is down-mixed to mono
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Send a recording to Amazon Transcribe.
 * @returns {Promise<{transcript: string, language: string, mode: string}>}
 * Throws an ApiError with `details.fallback === 'browser'` when cloud recognition is off,
 * so the caller can switch to the Web Speech API or the text box.
 */
export async function transcribe(blob, language) {
  let upload = blob;
  let name = 'question.webm';
  try {
    upload = await toWav(blob);
    name = 'question.wav';
  } catch {
    // The browser cannot decode its own recording (rare): send the original file.
  }
  const form = new FormData();
  form.append('language', short(language));
  form.append('audio', upload, name);
  return api.post('/advisory/stt', form);
}
