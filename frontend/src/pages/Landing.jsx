import {
  ArrowRight,
  Bug,
  Check,
  CloudSun,
  Eye,
  FlaskConical,
  Languages,
  Leaf,
  MessagesSquare,
  Mic,
  MoveHorizontal,
  Scale,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui.jsx';
import { CountUp } from '../components/brand.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useReveal } from '../lib/useReveal.js';

const FEATURES = [
  { icon: Mic, title: 'Voice assistant', text: 'Ask by voice or text in Hindi, Tamil, Telugu, Kannada and more. Claude AI answers and reads the summary aloud.', tint: '#e3f6d3', ink: '#145f1d', tag: 'New' },
  { icon: ScanLine, title: 'Leaf disease scan', text: 'One photo of a leaf: 26 diseases on 14 crops, a confidence score, and a heatmap of where the AI looked.', tint: '#e0f0ff', ink: '#1d5fae' },
  { icon: Bug, title: 'Pest identification', text: 'Recognises 25 groups of insect and mite pests and explains cultural, biological and chemical control.', tint: '#fde8e6', ink: '#b42318' },
  { icon: FlaskConical, title: 'Soil Doctor', text: 'Photograph your Soil Health Card. Values are read, checked by you, and turned into bags of Urea, DAP and MOP.', tint: '#fbf1d6', ink: '#8a5a00', tag: 'New' },
  { icon: Scale, title: 'Produce grader', text: 'A trained quality model grades your lot A, B or C and shows the price range it can fetch at the mandi.', tint: '#efe6ff', ink: '#5b3fb5', tag: 'New' },
  { icon: CloudSun, title: 'Weather advice', text: 'A 7-day forecast for each farm, turned into plain advice on irrigation, spraying, disease risk and harvest.', tint: '#e0f7f4', ink: '#0f766e' },
  { icon: TrendingUp, title: 'Mandi prices', text: 'Price trends, a short-term outlook and the best nearby market, so you know when and where to sell.', tint: '#fff0e0', ink: '#b45309' },
  { icon: ShieldCheck, title: 'Expert oversight', text: 'Agronomists review AI reports, correct them, and send advisories to farmers in a region.', tint: '#e8eef7', ink: '#334e7a' },
];

const LANGUAGES = [
  ['हिन्दी', 'Hindi'],
  ['தமிழ்', 'Tamil'],
  ['తెలుగు', 'Telugu'],
  ['ಕನ್ನಡ', 'Kannada'],
  ['मराठी', 'Marathi'],
  ['বাংলা', 'Bengali'],
  ['ਪੰਜਾਬੀ', 'Punjabi'],
  ['English', 'India'],
];

const DEMO_TABS = [
  { id: 'leaf', label: 'Leaf scan', icon: ScanLine },
  { id: 'soil', label: 'Soil card', icon: FlaskConical },
  { id: 'produce', label: 'Grade lot', icon: Scale },
  { id: 'voice', label: 'Ask by voice', icon: Mic },
];
const DEMO_MS = 6500;

/** Runs `steps` timeouts after mount: [[delayMs, value], ...] -> current value. */
function useSequence(steps) {
  const [value, setValue] = useState(steps[0][1]);
  useEffect(() => {
    const timers = steps.slice(1).map(([delay, v]) => setTimeout(() => setValue(v), delay));
    return () => timers.forEach(clearTimeout);
    // The sequence is fixed for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

function Corners() {
  return (
    <>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
    </>
  );
}

function LeafDemo() {
  const done = useSequence([[0, false], [1700, true]]);
  const [heat, setHeat] = useState(false);
  return (
    <div className="demo-pane">
      <div className="demo-photo">
        <img src="/showcase/leaf-early-blight.jpg" alt="Tomato leaf with early blight" />
        <img src="/showcase/leaf-early-blight-heatmap.jpg" alt="Heatmap of where the AI looked" style={{ opacity: heat ? 1 : 0 }} />
        <Corners />
        {!done ? <span className="scan" /> : null}
        {done ? (
          <>
            <span className="demo-chip">
              <Badge tone="bad">Disease found</Badge>
            </span>
            <button type="button" className="btn btn-secondary btn-sm demo-toggle" onClick={() => setHeat((h) => !h)}>
              <Eye size={14} /> {heat ? 'Show photo' : 'Where the AI looked'}
            </button>
          </>
        ) : null}
      </div>
      {done ? (
        <div className="demo-result">
          <div className="stat-icon bad">
            <Leaf size={20} />
          </div>
          <div className="grow">
            <strong>Tomato · Early blight</strong>
            <div className="small muted">Remove lower leaves, mulch, copper or mancozeb spray</div>
          </div>
          <Badge tone="good">100% sure</Badge>
        </div>
      ) : (
        <div className="demo-result small muted">
          <span className="spinner sm" /> Checking 38 crop conditions…
        </div>
      )}
    </div>
  );
}

const SOIL = [
  ['Nitrogen (N)', '215 kg/ha', 'bad', 'Low'],
  ['Phosphorus (P)', '12.8 kg/ha', 'warn', 'Medium'],
  ['Potassium (K)', '290 kg/ha', 'good', 'High'],
  ['pH', '5.8', 'warn', 'Acidic'],
  ['Boron (B)', 'smudged', '', 'Not guessed'],
];

function SoilDemo() {
  const done = useSequence([[0, false], [1900, true]]);
  return (
    <div className="demo-pane">
      <div className="soil-card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <strong className="small">Soil Health Card · SHC-KA-9812</strong>
          <Badge tone="info" icon={Sparkles}>Read by AI</Badge>
        </div>
        {SOIL.map(([name, value, tone, rating], i) => (
          <div key={name} className="soil-row" style={{ animationDelay: `${i * 220}ms` }}>
            <span>{name}</span>
            <strong className="num" style={{ color: tone ? undefined : 'var(--ink-3)' }}>{value}</strong>
            <Badge tone={tone || undefined}>{rating}</Badge>
          </div>
        ))}
      </div>
      {done ? (
        <div className="bags">
          {[
            ['2.9', 'Urea 45 kg'],
            ['1.8', 'DAP 50 kg'],
            ['1', 'MOP 50 kg'],
          ].map(([n, label], i) => (
            <div key={label} className="bag" style={{ animationDelay: `${i * 120}ms` }}>
              <b>{n}</b>
              bags · {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProduceDemo() {
  const done = useSequence([[0, false], [1700, true]]);
  return (
    <div className="demo-pane">
      <div className="demo-photo">
        <img src="/showcase/produce-apple-good.jpg" alt="Lot of apples" />
        <Corners />
        {!done ? <span className="scan" /> : null}
        {done ? (
          <span className="demo-chip">
            <Badge tone="good">Grade A · Premium</Badge>
          </span>
        ) : null}
      </div>
      {done ? (
        <div className="demo-result">
          <div className="stat-icon">
            <Scale size={20} />
          </div>
          <div className="grow">
            <strong>Apple · ₹77–86 per kg</strong>
            <div className="small muted">Estimated at Azadpur mandi for a Grade A lot</div>
          </div>
          <Badge tone="info">Trained model</Badge>
        </div>
      ) : (
        <div className="demo-result small muted">
          <span className="spinner sm" /> Checking colour, uniformity and blemishes…
        </div>
      )}
    </div>
  );
}

function VoiceDemo() {
  const phase = useSequence([[0, 0], [1300, 1], [2600, 2]]);
  return (
    <div className="demo-pane chat" style={{ minHeight: 330 }}>
      <div className="row-center gap-xs small muted" style={{ color: 'var(--green-700)' }}>
        <span className="waveform" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        Listening in Hindi…
      </div>
      <div className="bubble me">गेहूं कब बोएं? मेरा खेत पंजाब में है, नहर से सिंचाई है।</div>
      {phase === 1 ? (
        <div className="bubble ai typing" aria-label="Typing">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {phase === 2 ? (
        <>
          <div className="bubble ai">
            <strong>पंजाब में गेहूं की बुवाई</strong>
            <br />1 से 20 नवंबर के बीच बोएं। 40 किलो प्रमाणित बीज प्रति एकड़, बुवाई से पहले बीज उपचार करें।
          </div>
          <div className="row-center gap-xs tiny muted">
            <Volume2 size={14} /> Read aloud in Hindi · Answered by Claude AI
          </div>
        </>
      ) : null}
    </div>
  );
}

const PANES = { leaf: LeafDemo, soil: SoilDemo, produce: ProduceDemo, voice: VoiceDemo };

function LiveDemo() {
  const [tab, setTab] = useState('leaf');
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const t = setTimeout(() => {
      const i = DEMO_TABS.findIndex((d) => d.id === tab);
      setTab(DEMO_TABS[(i + 1) % DEMO_TABS.length].id);
      setRound((r) => r + 1);
    }, DEMO_MS);
    return () => clearTimeout(t);
  }, [tab, paused, round]);

  const Pane = PANES[tab];
  return (
    <div className="demo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="demo-tabs" role="tablist" aria-label="Try CropGuard">
        {DEMO_TABS.map((d) => {
          const Icon = d.icon;
          const active = d.id === tab;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`demo-tab${active ? ' active' : ''}`}
              onClick={() => {
                setTab(d.id);
                setRound((r) => r + 1);
              }}
            >
              <Icon size={17} />
              {d.label}
              {active && !paused ? <span key={round} className="progress" style={{ '--dur': `${DEMO_MS}ms` }} /> : null}
            </button>
          );
        })}
      </div>
      <div className="demo-stage">
        <Pane key={`${tab}-${round}`} />
      </div>
    </div>
  );
}

function CompareSlider() {
  const [pos, setPos] = useState(55);
  return (
    <div className="compare-slider" style={{ '--pos': `${pos}%` }}>
      <img src="/showcase/leaf-late-blight-heatmap.jpg" alt="Heatmap: the areas the model relied on" />
      <img className="top" src="/showcase/leaf-late-blight.jpg" alt="Potato leaf with late blight" />
      <span className="compare-label" style={{ left: 14 }}>Photo</span>
      <span className="compare-label" style={{ right: 14 }}>Where the AI looked</span>
      <span className="handle">
        <span className="knob">
          <MoveHorizontal size={20} />
        </span>
      </span>
      <input type="range" min="0" max="100" value={pos} aria-label="Compare the photo with the AI heatmap" onChange={(e) => setPos(Number(e.target.value))} />
    </div>
  );
}

function Fields() {
  return (
    <svg className="lp-fields" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70 C 240 30 420 40 720 70 C 1000 98 1220 60 1440 40 V150 H0 Z" fill="#d8efc4" />
      <path d="M0 95 C 300 60 520 72 760 92 C 1040 116 1260 90 1440 76 V150 H0 Z" fill="#a9db7f" />
      <path d="M820 98 C 1000 84 1220 80 1440 70 V96 C 1240 104 1040 108 860 112 Z" fill="#f0cf6a" opacity="0.85" />
      <path d="M0 118 C 260 96 560 104 820 116 C 1080 128 1280 112 1440 104 V150 H0 Z" fill="#5fae32" />
      <path d="M0 136 C 360 120 720 128 1440 126 V150 H0 Z" fill="#2f8a12" />
    </svg>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? '/app' : '/register';
  const root = useReveal();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lp" ref={root}>
      <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo" aria-label="CropGuard home">
            <img className="mark" src="/brand/logo-mark.webp" alt="" />
            <img className="word" src="/brand/logo-wordmark.webp" alt="CropGuard" />
          </Link>
          <nav className="lp-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#results">Real results</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="row">
            {user ? (
              <Link className="btn" to="/app">
                Open dashboard <ArrowRight size={17} className="arrow" />
              </Link>
            ) : (
              <>
                <Link className="btn btn-ghost hide-sm" to="/login">
                  Sign in
                </Link>
                <Link className="btn" to="/register">
                  Get started <ArrowRight size={17} className="arrow" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <span className="lp-blob a" />
        <span className="lp-blob b" />
        <span className="lp-blob c" />
        <div className="lp-hero-inner">
          <div>
            <span className="lp-eyebrow">
              <span className="dot" />
              Kisan Mitra AI · built for Indian farmers
            </span>
            <h1>
              Know what your crop needs. <span className="text-gradient">In your own language.</span>
            </h1>
            <p className="lp-lede">
              Photograph a leaf, a Soil Health Card or a crate of fruit, or simply ask out loud. CropGuard finds the problem,
              tells you what to do, and shows what your harvest will fetch at the mandi.
            </p>
            <div className="row-wrap lp-actions">
              <Link className="btn btn-lg" to={cta}>
                {user ? 'Open dashboard' : 'Start free'} <ArrowRight size={18} className="arrow" />
              </Link>
              <a className="btn btn-lg btn-secondary" href="#results">
                <Eye size={18} /> See real results
              </a>
            </div>
            <div className="lp-trust">
              <span><Check size={15} /> 14 crops · 26 diseases</span>
              <span><Check size={15} /> 25 pest groups</span>
              <span><Languages size={15} /> 8 Indian languages</span>
            </div>
          </div>
          <LiveDemo />
        </div>
        <Fields />
      </section>

      <div className="lp-stats">
        {[
          [<CountUp key="a" value={99.1} decimals={1} suffix="%" />, 'disease accuracy on unseen photos'],
          [<CountUp key="b" value={99.8} decimals={1} suffix="%" />, 'fruit grading accuracy'],
          [<CountUp key="c" value={26} />, 'crop diseases recognised'],
          [<CountUp key="d" value={25} />, 'pest groups identified'],
          [<CountUp key="e" value={8} />, 'Indian languages'],
        ].map(([value, label], i) => (
          <div key={label} className="lp-stat reveal" style={{ '--delay': `${i * 80}ms` }}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <section className="lp-section" id="features">
        <div className="lp-title reveal">
          <span className="lp-kicker">Everything in one app</span>
          <h2>From the first leaf spot to the mandi gate</h2>
          <p>Farmers lose yield and money when problems are found late. CropGuard puts diagnosis, soil, weather and prices in one place.</p>
        </div>
        <div className="grid grid-4">
          {FEATURES.map(({ icon: Icon, title, text, tint, ink, tag }, i) => (
            <article key={title} className="lp-feature hover-lift reveal" style={{ '--tint': tint, '--tint-ink': ink, '--delay': `${(i % 4) * 90}ms` }}>
              <div className="icon">
                <Icon size={23} />
              </div>
              {tag ? (
                <span className="tag">
                  <Badge tone="good">{tag}</Badge>
                </span>
              ) : null}
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="results" style={{ paddingTop: 24 }}>
        <div className="lp-title reveal">
          <span className="lp-kicker">Real results, not mock-ups</span>
          <h2>See exactly what the AI sees</h2>
          <p>
            Every image here is a test photo the models never saw while training. Drag the slider to compare a potato leaf with
            the regions the disease model relied on.
          </p>
        </div>
        <div className="grid grid-2" style={{ alignItems: 'center' }}>
          <div className="reveal">
            <CompareSlider />
          </div>
          <div className="stack reveal" style={{ '--delay': '120ms' }}>
            <div className="card card-pad stack-sm">
              <div className="row between wrap">
                <strong>Potato · Late blight</strong>
                <Badge tone="bad">99% sure</Badge>
              </div>
              <p className="small muted">
                The most destructive potato disease. CropGuard flags it as high severity and tells the farmer to act within a day:
                remove infected plants and protect the rest before the next wet spell.
              </p>
            </div>
            <div className="grid grid-3">
              {[
                ['produce-apple-good', 'Apple', 'Grade A', 'good'],
                ['produce-banana-mixed', 'Banana', 'Grade B', 'warn'],
                ['produce-orange-bad', 'Orange', 'Grade C', 'bad'],
              ].map(([img, name, grade, tone]) => (
                <div key={img} className="fruit-card hover-lift">
                  <div className="photo">
                    <img src={`/showcase/${img}.jpg`} alt={`${name} lot graded ${grade}`} loading="lazy" />
                  </div>
                  <div className="meta">
                    <strong>{name}</strong>
                    <Badge tone={tone}>{grade}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="tiny faint">
              Grades from the produce quality model, each correct and over 99% confident. Accuracy on real field photos will be
              lower than on these test sets; every result says how sure it is.
            </p>
          </div>
        </div>
      </section>

      <div className="marquee" aria-label="Supported languages">
        <div className="marquee-track">
          {[...LANGUAGES, ...LANGUAGES].map(([native, name], i) => (
            <span key={i} aria-hidden={i >= LANGUAGES.length}>
              {native}
              <small>{name}</small>
            </span>
          ))}
        </div>
      </div>

      <section className="lp-section" id="how">
        <div className="lp-title reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
          <span className="lp-kicker">How it works</span>
          <h2>Three steps, a few seconds</h2>
        </div>
        <div className="lp-steps">
          {[
            [ScanLine, 'Snap or speak', 'Photograph a leaf, a soil card or your harvest, or ask a question in your own language.'],
            [Sparkles, 'AI checks it', 'Trained models and Claude AI analyse it and say how sure they are. Unclear photos are flagged, never guessed.'],
            [MessagesSquare, 'Act on the advice', 'Get clear steps, fertiliser bags and the price to expect. Everything is saved to your history.'],
          ].map(([Icon, title, text], i) => (
            <div key={title} className="lp-step reveal" style={{ '--delay': `${i * 140}ms` }}>
              <div className="num">
                <Icon size={24} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-cta reveal">
          <div>
            <h2>Protect your next harvest</h2>
            <p style={{ margin: '10px 0 22px', maxWidth: '52ch' }}>
              Create a free account, add your farm, and run your first scan in under two minutes.
            </p>
            <div className="row-wrap">
              <Link className="btn btn-lg" to={cta} style={{ background: 'var(--lime)', color: 'var(--green-950)' }}>
                {user ? 'Open dashboard' : 'Get started free'} <ArrowRight size={18} className="arrow" />
              </Link>
              {!user ? (
                <Link className="btn btn-lg btn-secondary" to="/login">
                  I have an account
                </Link>
              ) : null}
            </div>
          </div>
          <img className="mark" src="/brand/logo-mark.webp" alt="" />
        </div>
      </section>

      <footer className="lp-footer">
        <div className="stack-sm">
          <Link to="/" className="lp-logo">
            <img className="mark" src="/brand/logo-mark.webp" alt="" style={{ height: 36 }} />
            <img className="word" src="/brand/logo-wordmark.webp" alt="CropGuard" style={{ height: 24 }} />
          </Link>
          <span>AI-powered smart agriculture for Indian farmers.</span>
        </div>
        <div className="stack-sm">
          <span>
            CropGuard is decision support. AI results can be wrong: confirm important decisions with your Krishi Vigyan Kendra or
            agriculture officer.
          </span>
          <span>
            Showcase photos: PlantVillage (Hughes &amp; Salathé, CC BY-SA 3.0) and FruitNet (Meshram &amp; Patil, CC BY 4.0).
            Weather: Open-Meteo. Prices: Agmarknet / data.gov.in or sample data.
          </span>
        </div>
      </footer>
    </div>
  );
}
