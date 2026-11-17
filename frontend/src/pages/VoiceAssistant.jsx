import {
  Check,
  HelpCircle,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const QUICK_PROMPTS = [
  'When is the optimal sowing window for wheat in Punjab?',
  'What is the critical irrigation schedule for paddy?',
  'How much Urea and DAP fertilizer for 2 acres of tomato?',
  'Preventive pest management for cotton pink bollworm',
  'When should I harvest maize and how to check moisture?',
];

export default function VoiceAssistant() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [languages, setLanguages] = useState([]);
  const [locationContext, setLocationContext] = useState('');
  const [irrigationContext, setIrrigationContext] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]);

  const recognitionRef = useRef(null);
  const sendQueryRef = useRef(null);

  useEffect(() => {
    // Load supported languages
    api.get('/advisory/languages')
      .then((res) => setLanguages(res.languages || []))
      .catch(() => {});

    // Load past conversations
    api.get('/advisory/history')
      .then((res) => {
        if (res.items?.length) {
          setConversation(res.items);
        }
      })
      .catch(() => {});

    // Setup Web Speech API for voice recording
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
        setError('Microphone audio was unclear or permission was denied. You can type your query in the box below.');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setQuery(transcript);
          // Auto submit query
          sendQueryRef.current?.(transcript);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      setError('Voice recognition is not supported in this browser. Please use the text input below.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setError('');
      try {
        const selLang = languages.find((l) => l.code === language);
        if (recognitionRef.current && selLang) {
          recognitionRef.current.lang = selLang.ttsLang || 'en-IN';
        }
        recognitionRef.current?.start();
      } catch {
        recognitionRef.current?.stop();
      }
    }
  };

  const handleSpeak = (text, id) => {
    if (!window.speechSynthesis) {
      setError('Text-to-speech audio playback is not supported on this device.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selLang = languages.find((l) => l.code === language);
    if (selLang) utterance.lang = selLang.ttsLang;
    utterance.rate = 0.95; // comfortable cadence for farmers

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendQuery = async (userQuery) => {
    const q = userQuery || query;
    if (!q.trim()) return;

    try {
      setLoading(true);
      setError('');

      const res = await api.post('/advisory/ask', {
        query: q,
        language,
        context: {
          location: locationContext,
          irrigation: irrigationContext,
        },
      });

      setConversation((prev) => [res, ...prev]);
      setQuery('');

      // Auto-play voice response if voice-initiated
      if (res.voiceSummary) {
        handleSpeak(res.voiceSummary, res.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to process voice query');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sendQueryRef.current = handleSendQuery;
  });

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <div className="row-center gap-xs" style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: '0.9rem' }}>
            <Mic size={18} />
            Voice-First Multilingual Agricultural Assistant (SRS 5.1 & 5.4)
          </div>
          <h1 style={{ marginTop: 4 }}>Kisan Mitra Voice Advisor</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Speak or type agricultural questions in your preferred Indian language. Receive real-time cultivation advice, sowing schedules, irrigation alerts, and fertilizer calculations with spoken audio playback.
          </p>
        </div>
      </div>

      {error ? <Alert tone="bad" title="Voice Error">{error}</Alert> : null}

      {/* Main Voice Center Card */}
      <div className="card card-pad stack align-center" style={{ textAlign: 'center', padding: '36px 20px', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
        {/* Language Selector */}
        <div className="row-center gap-sm" style={{ marginBottom: 12 }}>
          <Languages size={18} style={{ color: 'var(--green-700)' }} />
          <span className="tiny strong">Choose Language:</span>
          <select
            className="select"
            style={{ width: 'auto', padding: '4px 10px', fontSize: '0.9rem' }}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName} ({l.name})
              </option>
            ))}
          </select>
        </div>

        {/* Big Mic Button */}
        <div style={{ position: 'relative', margin: '14px auto' }}>
          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleListening}
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: isListening ? 'var(--bad)' : 'var(--green-600)',
              color: '#fff',
              boxShadow: isListening
                ? '0 0 0 12px rgba(220, 38, 38, 0.25), 0 0 0 24px rgba(220, 38, 38, 0.12)'
                : '0 8px 24px rgba(22, 163, 74, 0.35)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isListening ? 'Click to stop listening' : 'Click to speak'}
          >
            {isListening ? <MicOff size={38} /> : <Mic size={38} />}
          </button>
        </div>

        <div className="strong" style={{ fontSize: '1.05rem', color: isListening ? 'var(--bad)' : 'var(--ink)' }}>
          {isListening ? 'Listening... Speak your agricultural question now' : 'Tap the microphone to ask by voice'}
        </div>
        <div className="tiny subtle" style={{ marginTop: 2 }}>
          Supported across Indian languages: Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Punjabi, English.
        </div>

        {/* Text Input Fallback (SRS 5.1 Mandate) */}
        <div style={{ width: '100%', maxWidth: 640, marginTop: 20 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="row-center gap-xs"
          >
            <input
              type="text"
              className="input"
              placeholder="Or type your farming question here..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>

        {/* Context Strip */}
        <div className="row-center gap-sm wrap justify-center" style={{ marginTop: 14 }}>
          <span className="tiny subtle">Active Context:</span>
          <input
            type="text"
            className="input"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '0.8rem' }}
            placeholder="Farm State / District"
            value={locationContext}
            onChange={(e) => setLocationContext(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '0.8rem' }}
            value={irrigationContext}
            onChange={(e) => setIrrigationContext(e.target.value)}
          >
            <option value="">Irrigation: Any</option>
            <option value="Borewell">Borewell</option>
            <option value="Canal">Canal</option>
            <option value="Drip">Drip Irrigation</option>
            <option value="Rainfed">Rainfed / Dryland</option>
          </select>
        </div>

        {/* Quick Prompts */}
        <div className="row-center gap-xs wrap justify-center" style={{ marginTop: 16 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.8rem', background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              onClick={() => handleSendQuery(p)}
            >
              <Sparkles size={13} style={{ color: 'var(--green-700)' }} />
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Answers Stream */}
      <div className="stack">
        <h2>Advisory Conversation</h2>
        {conversation.length === 0 ? (
          <div className="card card-pad subtle tiny text-center">
            No questions asked yet. Speak through the microphone or type above to receive personalized crop guidance.
          </div>
        ) : (
          conversation.map((item) => (
            <div key={item.id} className="card card-pad stack" style={{ borderLeft: '4px solid var(--green-600)' }}>
              {/* Question */}
              <div className="row-center between">
                <div className="row-center gap-xs">
                  <span className="badge badge-good" style={{ textTransform: 'capitalize' }}>
                    {item.crop || 'Farming'} • {item.topic}
                  </span>
                  <strong>{item.query}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleSpeak(item.voiceSummary || item.body, item.id)}
                  title="Listen to spoken audio"
                >
                  {speakingId === item.id ? <VolumeX size={18} style={{ color: 'var(--bad)' }} /> : <Volume2 size={18} style={{ color: 'var(--green-700)' }} />}
                  <span className="tiny">{speakingId === item.id ? 'Stop Audio' : 'Listen'}</span>
                </button>
              </div>

              {/* Voice Summary Banner */}
              {item.voiceSummary ? (
                <div style={{ background: 'var(--green-50)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--green-200)' }}>
                  <div className="tiny strong" style={{ color: 'var(--green-900)' }}>
                    🔊 Spoken Summary ({item.language?.toUpperCase()}):
                  </div>
                  <div className="tiny" style={{ marginTop: 2, color: 'var(--green-950)' }}>
                    {item.voiceSummary}
                  </div>
                </div>
              ) : null}

              {/* Detailed Markdown Body */}
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.92rem', lineHeight: 1.6 }}>
                {item.body}
              </div>

              {/* Missing Context Prompts (SRS 5.4) */}
              {item.missingContextQuestions?.length > 0 ? (
                <div className="card-pad row-center gap-xs" style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <HelpCircle size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                  <div className="tiny">
                    <strong>Additional Context Needed (SRS 5.4):</strong>
                    <ul className="list-styled" style={{ marginTop: 4, paddingLeft: 16 }}>
                      {item.missingContextQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {/* Key Action Checkpoints */}
              {item.keyActions?.length > 0 ? (
                <div className="stack-xs">
                  <div className="tiny strong subtle">Key Action Steps:</div>
                  <div className="row-center gap-xs wrap">
                    {item.keyActions.map((act, idx) => (
                      <span key={idx} className="badge badge-ghost" style={{ fontSize: '0.8rem' }}>
                        <Check size={12} style={{ color: 'var(--green-700)', marginRight: 4 }} />
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="tiny subtle" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                {item.disclaimer}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
