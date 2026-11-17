import { Bot, BookOpen, Check, HelpCircle, Languages, Loader2, Mic, Send, Sparkles, Square, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Alert, Badge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { getCloudStatus, speak, startRecording, stopSpeaking, transcribe } from '../lib/cloudVoice.js';
import { formatDateTime } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

const QUICK_PROMPTS = [
  'When is the best sowing window for wheat in Punjab?',
  'What is the critical irrigation schedule for paddy?',
  'How much Urea and DAP for 2 acres of tomato?',
  'How do I manage pink bollworm in cotton?',
  'When should I harvest maize and how do I check moisture?',
];

const LOCALES = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN' };
const BrowserRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** How the microphone works on this device: cloud (Amazon Transcribe), browser, or not at all. */
function micMode(status) {
  const cloud = status?.stt?.enabled && typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia;
  if (cloud) return 'cloud';
  if (BrowserRecognition) return 'browser';
  return 'none';
}

export default function VoiceAssistant() {
  const languages = useApi('/advisory/languages');
  const farms = useApi('/farms');
  const [cloud, setCloud] = useState(null);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [farmId, setFarmId] = useState('');
  const [location, setLocation] = useState('');
  const [irrigation, setIrrigation] = useState('');

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]);

  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    getCloudStatus().then(setCloud);
    api
      .get('/advisory/history')
      .then((res) => setConversation(res.items || []))
      .catch(() => {});
    return () => {
      stopSpeaking();
      recorderRef.current?.cancel();
      recognitionRef.current?.abort?.();
    };
  }, []);

  const mode = micMode(cloud);

  async function ask(text) {
    const q = (text ?? query).trim();
    if (q.length < 2) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/advisory/ask', {
        query: q,
        language,
        farmId: farmId || undefined,
        context: { location, irrigation },
      });
      setConversation((prev) => [res, ...prev]);
      setQuery('');
      if (res.voiceSummary) playAnswer(res);
    } catch (err) {
      setError(err.message || 'Could not get an answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function playAnswer(item) {
    if (speakingId === item.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(item.id);
    try {
      await speak(item.voiceSummary || item.body, item.language || language);
    } finally {
      setSpeakingId((current) => (current === item.id ? null : current));
    }
  }

  // --- microphone -----------------------------------------------------------

  async function startCloud() {
    try {
      recorderRef.current = await startRecording();
      setListening(true);
    } catch {
      setError('Microphone permission was denied. Allow the microphone, or type your question below.');
    }
  }

  async function stopCloud() {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setListening(false);
    if (!rec) return;
    setTranscribing(true);
    try {
      const blob = await rec.stop();
      const { transcript } = await transcribe(blob, language);
      setQuery(transcript);
      await ask(transcript);
    } catch (err) {
      setError(err.message || 'We could not understand the recording. Please try again or type your question.');
      inputRef.current?.focus();
    } finally {
      setTranscribing(false);
    }
  }

  function startBrowser() {
    const recognition = new BrowserRecognition();
    recognition.lang = LOCALES[language] || 'en-IN';
    recognition.interimResults = false;
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError('The microphone audio was unclear or permission was denied. You can type your question below.');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuery(transcript);
        ask(transcript);
      }
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function toggleMic() {
    setError('');
    stopSpeaking();
    if (mode === 'none') {
      setError('Voice input is not supported in this browser. Please type your question below.');
      inputRef.current?.focus();
      return;
    }
    if (listening) {
      if (mode === 'cloud') stopCloud();
      else recognitionRef.current?.stop();
    } else if (mode === 'cloud') {
      startCloud();
    } else {
      startBrowser();
    }
  }

  const busy = loading || transcribing;
  const status = transcribing
    ? 'Understanding your voice…'
    : loading
      ? 'Preparing your answer…'
      : listening
        ? mode === 'cloud'
          ? 'Listening… tap again when you finish speaking'
          : 'Listening… speak your question now'
        : 'Tap the microphone to ask by voice';

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>Kisan Mitra voice advisor</h1>
          <p>Ask farming questions by voice or text in your language. Answers come with spoken summaries.</p>
        </div>
      </header>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <section className="card card-pad stack align-center text-center" style={{ padding: '32px 20px' }}>
        <div className="row-center gap-sm wrap justify-center">
          <Languages size={18} style={{ color: 'var(--green-700)' }} />
          <label className="tiny strong" htmlFor="va-language">Language</label>
          <select id="va-language" className="select" style={{ width: 'auto' }} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {(languages.data?.languages || [{ code: 'en', name: 'English', nativeName: 'English' }]).map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName} ({l.name})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={`mic-btn${listening ? ' recording' : ''}`}
          style={{ margin: '18px auto 6px' }}
          onClick={toggleMic}
          disabled={busy}
          aria-label={listening ? 'Stop recording' : 'Start voice question'}
          aria-pressed={listening}
        >
          {busy ? <Loader2 size={34} className="spin" /> : listening ? <Square size={30} /> : <Mic size={36} />}
        </button>
        <div className="strong" aria-live="polite" style={{ color: listening ? 'var(--bad)' : 'var(--ink)' }}>
          {status}
        </div>
        <div className="tiny faint">
          {mode === 'cloud'
            ? 'Speech recognition by Amazon Transcribe'
            : mode === 'browser'
              ? 'Speech recognition by your browser'
              : 'Voice input is not available in this browser'}
          {cloud?.llm?.enabled ? ' · Answers by Claude AI with an offline backup' : ' · Answers from the offline crop almanac'}
        </div>

        <form
          className="row-center gap-xs"
          style={{ width: '100%', maxWidth: 640, marginTop: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            ref={inputRef}
            className="input"
            placeholder="Or type your farming question here…"
            aria-label="Your question"
            value={query}
            maxLength={1000}
            onChange={(e) => setQuery(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn" disabled={busy || query.trim().length < 2} aria-label="Ask">
            {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </form>

        <div className="row-center gap-sm wrap justify-center" style={{ marginTop: 6 }}>
          <span className="tiny subtle">Your farm:</span>
          {farms.data?.farms?.length ? (
            <select className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.84rem' }} aria-label="Farm" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">No farm selected</option>
              {farms.data.farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : null}
          {!farmId ? (
            <>
              <input
                className="input"
                style={{ width: 180, padding: '4px 8px', fontSize: '0.84rem' }}
                placeholder="State or district"
                aria-label="State or district"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <select className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.84rem' }} aria-label="Irrigation" value={irrigation} onChange={(e) => setIrrigation(e.target.value)}>
                <option value="">Irrigation: not set</option>
                <option value="Borewell">Borewell</option>
                <option value="Canal">Canal</option>
                <option value="Drip">Drip</option>
                <option value="Rainfed">Rainfed</option>
              </select>
            </>
          ) : (
            <span className="tiny faint">Location, soil and irrigation are taken from the farm.</span>
          )}
        </div>

        <div className="row-center gap-xs wrap justify-center" style={{ marginTop: 14 }}>
          {QUICK_PROMPTS.map((p) => (
            <button key={p} type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => ask(p)}>
              <Sparkles size={13} style={{ color: 'var(--green-700)' }} />
              {p}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Conversation</h2>
        {conversation.length === 0 ? (
          <div className="card card-pad subtle text-center">No questions yet. Speak or type above to get crop guidance.</div>
        ) : (
          conversation.map((item) => (
            <article key={item.id} className="card card-pad stack" style={{ borderLeft: `4px solid ${item.source === 'claude' ? 'var(--info)' : 'var(--green-600)'}` }}>
              <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                <div className="stack-xs grow">
                  <div className="row-center gap-xs wrap">
                    {item.source === 'claude' ? (
                      <Badge tone="info" icon={Bot}>Claude AI</Badge>
                    ) : (
                      <Badge icon={BookOpen}>Offline almanac</Badge>
                    )}
                    {item.crop && item.crop !== 'general' ? <Badge tone="good">{item.crop} · {item.topic}</Badge> : null}
                    <span className="tiny faint">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <strong>{item.query}</strong>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => playAnswer(item)} aria-label={speakingId === item.id ? 'Stop audio' : 'Listen to the answer'}>
                  {speakingId === item.id ? <VolumeX size={18} style={{ color: 'var(--bad)' }} /> : <Volume2 size={18} style={{ color: 'var(--green-700)' }} />}
                  <span className="tiny">{speakingId === item.id ? 'Stop' : 'Listen'}</span>
                </button>
              </div>

              {item.title ? <h3>{item.title}</h3> : null}

              {item.voiceSummary ? (
                <div style={{ background: 'var(--green-50)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--green-200)' }}>
                  <div className="tiny strong" style={{ color: 'var(--green-900)' }}>In short</div>
                  <div style={{ marginTop: 2 }}>{item.voiceSummary}</div>
                </div>
              ) : null}

              <div className="markdown" style={{ fontSize: '0.94rem', lineHeight: 1.6 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
              </div>

              {item.missingContextQuestions?.length ? (
                <div className="alert warn">
                  <HelpCircle size={18} />
                  <div className="stack-xs">
                    <div className="alert-title">To give exact advice, please tell me:</div>
                    {item.missingContextQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                        onClick={() => {
                          setQuery('');
                          inputRef.current?.focus();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        • {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.keyActions?.length ? (
                <div className="stack-xs">
                  <div className="tiny strong subtle">Next steps</div>
                  <div className="row-center gap-xs wrap">
                    {item.keyActions.map((a) => (
                      <span key={a} className="badge badge-ghost">
                        <Check size={12} style={{ color: 'var(--green-700)' }} /> {a}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="tiny faint" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                {item.disclaimer ||
                  'Guidance is based on standard packages of practices. Confirm pesticide and disease decisions with your Krishi Vigyan Kendra or extension officer.'}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
