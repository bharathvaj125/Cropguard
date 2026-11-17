import { uploadDir } from './helpers.js';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import {
  _setClientForTest,
  buildUserMessage,
  generateLlmAdvisory,
  isRetiredModel,
  llmStatus,
  seasonFor,
  SYSTEM_PROMPT,
} from '../src/services/claudeAdvisor.js';
import { normaliseLanguage } from '../src/services/languages.js';
import {
  _setSpeechClientsForTest,
  detectAudio,
  parseWav,
  pollyVoiceFor,
  toSpeakableText,
} from '../src/services/speech.js';
import { storage } from '../src/services/storage.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const ANSWER = {
  body: '## गेहूं की बुवाई\n- समय: 1 से 20 नवंबर\n- यूरिया: 2.5 बैग प्रति एकड़',
  voiceSummary: 'गेहूं की बुवाई 1 से 20 नवंबर के बीच करें।',
  missingContextQuestions: ['क्या आपके खेत में सिंचाई की सुविधा है?'],
};

function fakeClaude(behaviour = {}) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async parse(params) {
          calls.push(params);
          if (behaviour.throws) throw behaviour.throws;
          return {
            model: params.model,
            stop_reason: behaviour.stopReason || 'end_turn',
            stop_details: behaviour.stopReason === 'refusal' ? { category: 'general_harms' } : null,
            parsed_output: behaviour.output === undefined ? ANSWER : behaviour.output,
            usage: { input_tokens: 900, output_tokens: 250 },
          };
        },
      },
    },
  };
}

function fakePolly() {
  const calls = [];
  return {
    calls,
    async send(command) {
      calls.push(command.input);
      return { AudioStream: { transformToByteArray: async () => new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 1, 2, 3]) } };
    },
  };
}

function fakeStreaming(text = 'गेहूं कब बोना चाहिए') {
  const calls = [];
  return {
    calls,
    async send(command) {
      let bytes = 0;
      let chunks = 0;
      for await (const event of command.input.AudioStream) {
        bytes += event.AudioEvent.AudioChunk.length;
        chunks += 1;
      }
      calls.push({ ...command.input, AudioStream: undefined, bytes, chunks });
      return {
        TranscriptResultStream: (async function* stream() {
          yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: true, Alternatives: [{ Transcript: 'गेहूं' }] }] } } };
          yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: text }] }] } } };
        })(),
      };
    },
  };
}

/** A 16-bit PCM WAV with a sine tone. */
function makeWav({ seconds = 0.5, sampleRate = 16000, channels = 2 } = {}) {
  const frames = Math.round(seconds * sampleRate);
  const data = Buffer.alloc(frames * channels * 2);
  for (let i = 0; i < frames; i += 1) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
    for (let c = 0; c < channels; c += 1) data.writeInt16LE(c === 0 ? v : -v / 2, (i * channels + c) * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 1)]);

const saved = JSON.parse(JSON.stringify({ llm: config.llm, speech: config.speech }));
function resetConfig() {
  Object.assign(config.llm, saved.llm);
  Object.assign(config.speech, saved.speech);
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('Track B: helpers', () => {
  test('language codes are normalised', () => {
    assert.equal(normaliseLanguage('kn-IN'), 'kn');
    assert.equal(normaliseLanguage('HI'), 'hi');
    assert.equal(normaliseLanguage('Tamil'), 'ta');
    assert.equal(normaliseLanguage('fr-FR'), null);
    assert.equal(normaliseLanguage(''), null);
  });

  test('cropping seasons', () => {
    assert.match(seasonFor(7), /Kharif/);
    assert.match(seasonFor(11), /Rabi/);
    assert.match(seasonFor(1), /Rabi/);
    assert.match(seasonFor(4), /Zaid/);
  });

  test('retired Claude models are flagged, current ones are not', () => {
    assert.ok(isRetiredModel('anthropic.claude-3-5-sonnet-20241022-v2:0'));
    assert.ok(isRetiredModel('claude-sonnet-4-20250514'));
    assert.ok(isRetiredModel('claude-sonnet-4-5'));
    assert.equal(isRetiredModel('anthropic.claude-sonnet-5-5'), false);
    assert.equal(isRetiredModel('claude-opus-4-5'), false);
  });

  test('the prompt asks for bags of Urea, DAP and MOP and for missing context', () => {
    assert.match(SYSTEM_PROMPT, /Urea 45 kg/);
    assert.match(SYSTEM_PROMPT, /DAP 50 kg/);
    assert.match(SYSTEM_PROMPT, /MOP 50 kg/);
    assert.match(SYSTEM_PROMPT, /missingContextQuestions/);
    assert.doesNotMatch(SYSTEM_PROMPT, /\d{4}-\d{2}-\d{2}/, 'no dates: the system prompt must stay cacheable');
  });

  test('the user message carries date, language, known and missing context', () => {
    const msg = buildUserMessage({
      query: 'When should I sow wheat?',
      language: 'kn',
      context: { district: 'Dharwad', soilType: 'Black soil' },
      now: new Date('2026-11-17T06:00:00Z'),
    });
    assert.match(msg, /2026-11-17 \(Rabi/);
    assert.match(msg, /Kannada \(kn-IN\)/);
    assert.match(msg, /District: Dharwad/);
    assert.match(msg, /Soil type: Black soil/);
    assert.match(msg, /Not provided: irrigation/);
    assert.doesNotMatch(msg, /state or district/);
    assert.match(msg, /<question>\nWhen should I sow wheat\?\n<\/question>/);
  });

  test('Polly voices exist only for Hindi and Indian English', () => {
    assert.deepEqual(pollyVoiceFor('hi-IN'), { VoiceId: 'Kajal', Engine: 'neural', LanguageCode: 'hi-IN' });
    assert.equal(pollyVoiceFor('en').LanguageCode, 'en-IN');
    for (const lang of ['ta', 'te', 'kn', 'mr', 'bn', 'pa']) assert.equal(pollyVoiceFor(lang), null, lang);
  });

  test('markdown is made speakable', () => {
    assert.equal(
      toSpeakableText('## Dose\n- **Urea**: 2 bags\n| a | b |\n[KVK](https://kvk.in)'),
      'Dose Urea : 2 bags a b KVK',
    );
  });

  test('audio formats are identified from their bytes', () => {
    assert.equal(detectAudio(makeWav()).format, 'wav');
    assert.equal(detectAudio(makeWav()).streaming.encoding, 'pcm');
    assert.equal(detectAudio(WEBM).batchFormat, 'webm');
    assert.equal(detectAudio(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40)])).format, 'mp3');
    assert.equal(detectAudio(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(40)])).format, 'mp4');
    const opus = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24), Buffer.from('OpusHead'), Buffer.alloc(40)]);
    assert.deepEqual(detectAudio(opus).streaming, { encoding: 'ogg-opus', sampleRate: 48000 });
    assert.equal(detectAudio(Buffer.from('#!/bin/sh echo not audio at all')).format, 'unknown');
    // AAC/ADTS has an MP3-like sync word but is not MP3
    assert.equal(detectAudio(Buffer.concat([Buffer.from([0xff, 0xf1]), Buffer.alloc(40)])).format, 'unknown');
  });

  test('stereo WAV is down-mixed to mono 16-bit PCM', () => {
    const wav = parseWav(makeWav({ seconds: 0.25, sampleRate: 16000, channels: 2 }));
    assert.equal(wav.sampleRate, 16000);
    assert.equal(wav.pcm.length, 4000 * 2);
    assert.ok(Math.abs(wav.seconds - 0.25) < 1e-9);
  });
});

describe('Track B: Claude advisory service', () => {
  beforeEach(() => {
    resetConfig();
    _setClientForTest(null);
  });

  test('returns null when no provider is configured, so the caller uses the rules', async () => {
    config.llm.bedrockModelId = '';
    config.llm.anthropicApiKey = '';
    assert.equal(llmStatus().enabled, false);
    assert.equal(await generateLlmAdvisory({ query: 'When to sow wheat?', language: 'hi' }), null);
  });

  test('Bedrock is preferred when BEDROCK_MODEL_ID is set', () => {
    config.llm.bedrockModelId = 'anthropic.claude-sonnet-5-5';
    config.llm.anthropicApiKey = 'sk-test';
    assert.deepEqual(
      { provider: llmStatus().provider, model: llmStatus().model, warning: llmStatus().warning },
      { provider: 'bedrock', model: 'anthropic.claude-sonnet-5-5', warning: null },
    );
    config.llm.bedrockModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    assert.match(llmStatus().warning, /retired/);
  });

  test('a structured answer comes back in the requested language shape', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    const fake = fakeClaude();
    _setClientForTest(fake);
    const out = await generateLlmAdvisory({
      query: 'गेहूं कब बोएं?',
      language: 'hi-IN',
      context: { state: 'Uttar Pradesh' },
      history: [
        { role: 'assistant', content: 'dropped: history must start with the farmer' },
        { role: 'user', content: 'Mera khet UP mein hai' },
        { role: 'assistant', content: 'Aapki fasal kaun si hai?' },
        { role: 'user', content: 'dropped: the new question is sent separately' },
      ],
    });
    assert.equal(out.body, ANSWER.body);
    assert.equal(out.voiceSummary, ANSWER.voiceSummary);
    assert.deepEqual(out.missingContextQuestions, ANSWER.missingContextQuestions);
    assert.equal(out.language, 'hi');
    assert.equal(out.source, 'claude');

    const params = fake.calls[0];
    assert.equal(params.model, 'claude-sonnet-5-5');
    assert.equal(params.system, SYSTEM_PROMPT);
    assert.equal(params.output_config.format.type, 'json_schema');
    assert.deepEqual(params.output_config.format.schema.required, ['body', 'voiceSummary', 'missingContextQuestions']);
    assert.equal(params.output_config.effort, 'medium');
    assert.equal(params.fallbacks, 'default');
    assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
    assert.deepEqual(params.messages.map((m) => m.role), ['user', 'assistant', 'user']);
    assert.match(params.messages.at(-1).content, /Hindi \(hi-IN\)/);
    assert.match(params.messages.at(-1).content, /State: Uttar Pradesh/);
  });

  test('refusals, truncation, bad output and API errors all return null', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    for (const behaviour of [
      { stopReason: 'refusal' },
      { stopReason: 'max_tokens' },
      { output: null },
      { throws: new Error('network down') },
    ]) {
      _setClientForTest(fakeClaude(behaviour));
      assert.equal(await generateLlmAdvisory({ query: 'Sow wheat?', language: 'en' }), null, JSON.stringify(behaviour));
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------

describe('Track B: /api/advisory cloud routes', () => {
  let api;
  let token;
  let transcriptServer;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  before(async () => {
    await connectDb({ ephemeral: true });
    api = request(createApp());
    const res = await api.post('/api/auth/register').send({ name: 'Voice Farmer', email: 'voice@example.com', password: 'harvest2026' });
    token = res.body.token;
    transcriptServer = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ results: { transcripts: [{ transcript: 'நெல் எப்போது விதைக்க வேண்டும்' }] } }));
    });
    await new Promise((r) => transcriptServer.listen(0, '127.0.0.1', r));
  });

  after(async () => {
    resetConfig();
    _setClientForTest(null);
    transcriptServer.close();
    await disconnectDb();
  });

  beforeEach(() => {
    resetConfig();
    _setClientForTest(null);
  });

  test('all routes need a signed-in user', async () => {
    assert.equal((await api.get('/api/advisory/cloud-status')).status, 401);
    assert.equal((await api.post('/api/advisory/tts').send({ text: 'hi', language: 'hi' })).status, 401);
  });

  test('cloud-status reports what is switched on', async () => {
    config.speech.pollyEnabled = true;
    const res = await api.get('/api/advisory/cloud-status').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.llm.enabled, false);
    assert.deepEqual(res.body.tts.languages, ['hi', 'en']);
    assert.equal(res.body.stt.enabled, false);
    assert.deepEqual(res.body.stt.batchFormats, []); // local storage: no batch jobs
  });

  test('TTS: off -> 503 with a browser fallback hint', async () => {
    const res = await api.post('/api/advisory/tts').set(auth()).send({ text: 'नमस्ते', language: 'hi' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.details.fallback, 'browser');
  });

  test('TTS: Hindi is synthesized once and then served from cache', async () => {
    config.speech.pollyEnabled = true;
    const polly = fakePolly();
    _setSpeechClientsForTest({ polly });
    const body = { text: '## गेहूं\n- **यूरिया** 2 बैग', language: 'hi-IN' };

    const first = await api.post('/api/advisory/tts').set(auth()).send(body);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.match(first.body.audioUrl, /^\/uploads\/tts\/[0-9a-f]{40}\.mp3$/);
    assert.equal(first.body.voice, 'Kajal');
    assert.equal(first.body.cached, false);
    assert.deepEqual(polly.calls[0], {
      VoiceId: 'Kajal',
      Engine: 'neural',
      LanguageCode: 'hi-IN',
      Text: 'गेहूं यूरिया 2 बैग',
      TextType: 'text',
      OutputFormat: 'mp3',
    });
    assert.ok(fs.existsSync(path.join(uploadDir, first.body.audioUrl.replace('/uploads/', ''))));

    const second = await api.post('/api/advisory/tts').set(auth()).send(body);
    assert.equal(second.body.cached, true);
    assert.equal(second.body.audioUrl, first.body.audioUrl);
    assert.equal(polly.calls.length, 1);
  });

  test('TTS: languages without a Polly voice get 422 and a browser fallback', async () => {
    config.speech.pollyEnabled = true;
    _setSpeechClientsForTest({ polly: fakePolly() });
    const res = await api.post('/api/advisory/tts').set(auth()).send({ text: 'வணக்கம்', language: 'ta' });
    assert.equal(res.status, 422);
    assert.match(res.body.error.message, /no Tamil voice/);
    assert.equal(res.body.error.details.fallback, 'browser');
    assert.equal((await api.post('/api/advisory/tts').set(auth()).send({ text: 'x', language: 'klingon' })).status, 400);
  });

  test('STT: off -> 503', async () => {
    const res = await api.post('/api/advisory/stt').set(auth()).field('language', 'hi').attach('audio', makeWav(), 'q.wav');
    assert.equal(res.status, 503);
  });

  test('STT: a WAV recording streams to Transcribe as mono PCM', async () => {
    config.speech.transcribeEnabled = true;
    const streaming = fakeStreaming();
    _setSpeechClientsForTest({ streaming });
    const res = await api
      .post('/api/advisory/stt')
      .set(auth())
      .field('language', 'hi-IN')
      .attach('audio', makeWav({ seconds: 0.5, sampleRate: 16000, channels: 2 }), 'question.wav');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { transcript: 'गेहूं कब बोना चाहिए', language: 'hi', mode: 'streaming' });
    const call = streaming.calls[0];
    assert.equal(call.LanguageCode, 'hi-IN');
    assert.equal(call.MediaEncoding, 'pcm');
    assert.equal(call.MediaSampleRateHertz, 16000);
    assert.equal(call.bytes, 8000 * 2); // 0.5 s mono, stereo down-mixed
    assert.equal(call.chunks, 5); // 100 ms per event
  });

  test('STT: browser WebM needs S3; without it the user gets a clear 422', async () => {
    config.speech.transcribeEnabled = true;
    const res = await api.post('/api/advisory/stt').set(auth()).field('language', 'ta').attach('audio', WEBM, 'q.webm');
    assert.equal(res.status, 422);
    assert.match(res.body.error.message, /needs S3 storage/);
  });

  test('STT: WebM runs as a Transcribe batch job when S3 is available, and cleans up', async () => {
    config.speech.transcribeEnabled = true;
    const sent = [];
    _setSpeechClientsForTest({
      batch: {
        async send(command) {
          sent.push([command.constructor.name, command.input]);
          if (command.constructor.name === 'GetTranscriptionJobCommand') {
            const done = sent.filter(([n]) => n === 'GetTranscriptionJobCommand').length > 1;
            return {
              TranscriptionJob: done
                ? { TranscriptionJobStatus: 'COMPLETED', Transcript: { TranscriptFileUri: `http://127.0.0.1:${transcriptServer.address().port}/t.json` } }
                : { TranscriptionJobStatus: 'IN_PROGRESS' },
            };
          }
          return {};
        },
      },
    });
    const realS3Uri = storage.s3Uri;
    storage.s3Uri = async (key) => `s3://test-bucket/uploads/${key}`;
    try {
      const res = await api.post('/api/advisory/stt').set(auth()).field('language', 'ta-IN').attach('audio', WEBM, 'q.webm');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, { transcript: 'நெல் எப்போது விதைக்க வேண்டும்', language: 'ta', mode: 'batch' });
    } finally {
      storage.s3Uri = realS3Uri;
    }
    const start = sent.find(([n]) => n === 'StartTranscriptionJobCommand')[1];
    assert.equal(start.LanguageCode, 'ta-IN');
    assert.equal(start.MediaFormat, 'webm');
    assert.match(start.Media.MediaFileUri, /^s3:\/\/test-bucket\/uploads\/stt\/.+\.webm$/);
    assert.ok(sent.some(([n]) => n === 'DeleteTranscriptionJobCommand'), 'job is deleted afterwards');
    assert.equal(fs.readdirSync(path.join(uploadDir, 'stt')).length, 0, 'uploaded audio is removed');
  });

  test('STT: silence, garbage and missing files are rejected clearly', async () => {
    config.speech.transcribeEnabled = true;
    _setSpeechClientsForTest({ streaming: fakeStreaming('') });
    const silent = await api.post('/api/advisory/stt').set(auth()).field('language', 'en').attach('audio', makeWav(), 'q.wav');
    assert.equal(silent.status, 422);
    assert.match(silent.body.error.message, /could not hear/);

    const junk = await api
      .post('/api/advisory/stt')
      .set(auth())
      .field('language', 'en')
      .attach('audio', Buffer.from('this is not audio, just some text bytes'), 'q.wav');
    assert.equal(junk.status, 415);
    assert.equal((await api.post('/api/advisory/stt').set(auth()).field('language', 'en')).status, 400);
  });

  test('LLM route: 503 when Claude is not configured', async () => {
    const res = await api.post('/api/advisory/llm').set(auth()).send({ query: 'When to sow wheat?', language: 'hi' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.details.fallback, 'rules');
  });

  test('LLM route: Claude answer with disclaimer; 502 when Claude cannot answer', async () => {
    config.llm.anthropicApiKey = 'sk-test';
    _setClientForTest(fakeClaude());
    const ok = await api
      .post('/api/advisory/llm')
      .set(auth())
      .send({ query: 'When to sow wheat?', language: 'kn-IN', context: { district: 'Dharwad', soilType: 'Black soil' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.source, 'claude');
    assert.equal(ok.body.language, 'kn');
    assert.ok(ok.body.voiceSummary.length > 5);
    assert.match(ok.body.disclaimer, /Krishi Vigyan Kendra/);

    _setClientForTest(fakeClaude({ stopReason: 'refusal' }));
    const declined = await api.post('/api/advisory/llm').set(auth()).send({ query: 'When to sow wheat?' });
    assert.equal(declined.status, 502);
    assert.equal(declined.body.error.details.fallback, 'rules');
  });
});
