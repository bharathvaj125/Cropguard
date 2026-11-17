import { ArrowRight, Bug, Check, CloudSun, FlaskConical, LayoutDashboard, Mic, Microscope, Scale, ShieldCheck, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Layout.jsx';
import { Badge, ConfidenceBar } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice assistant',
    text: 'Ask by voice or text in Hindi, Tamil, Telugu, Kannada and more. Claude AI answers with sowing, irrigation and fertiliser advice, and reads the summary aloud.',
  },
  {
    icon: FlaskConical,
    title: 'Soil Doctor',
    text: 'Photograph your Soil Health Card. The values are read, checked by you, and turned into the exact bags of Urea, DAP and MOP for your field.',
  },
  {
    icon: Scale,
    title: 'Produce grader',
    text: 'Photograph a lot to get an indicative AGMARK grade from a trained quality model, and the price range it can fetch at your mandi.',
  },
  {
    icon: Microscope,
    title: 'Disease detection',
    text: 'Upload a leaf photo and a deep-learning model checks it against 26 diseases across 14 crops, with a confidence score for every result.',
  },
  {
    icon: Bug,
    title: 'Pest identification',
    text: 'A second model recognises 25 groups of insect and mite pests, from aphids to stem borers, and suggests how to manage them.',
  },
  {
    icon: CloudSun,
    title: 'Weather advice',
    text: 'A 7-day forecast for each farm, turned into plain advice: when to irrigate, when to spray, and when disease risk is high.',
  },
  {
    icon: TrendingUp,
    title: 'Market prices',
    text: 'Mandi price trends for your crops, a short-term outlook, and a comparison of markets so you know where and when to sell.',
  },
  {
    icon: LayoutDashboard,
    title: 'One dashboard',
    text: 'Scan history, farm records, planned field work, weather and prices together, so nothing is missed.',
  },
  {
    icon: ShieldCheck,
    title: 'Expert oversight',
    text: 'Agronomists review AI reports from an admin panel, confirm or correct them, and send advisories to farmers.',
  },
];

function LeafArt() {
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label="Illustration of a leaf with disease spots">
      <defs>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7a0" />
          <stop offset="1" stopColor="#22a35a" />
        </linearGradient>
      </defs>
      <path d="M70 230 C 90 90, 250 30, 420 50 C 410 190, 300 280, 130 262 Z" fill="url(#leaf)" />
      <path d="M92 240 C 190 190, 300 130, 410 60" stroke="#0f6a39" strokeWidth="5" fill="none" strokeLinecap="round" />
      <g stroke="#0f6a39" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M170 205 C 180 160, 200 130, 230 105" />
        <path d="M240 165 C 255 130, 280 105, 315 85" />
        <path d="M200 190 C 240 205, 280 205, 320 195" />
        <path d="M270 150 C 310 160, 345 152, 375 138" />
      </g>
      <g fill="#7a4a1c">
        <ellipse cx="205" cy="150" rx="20" ry="14" opacity="0.85" />
        <ellipse cx="300" cy="170" rx="15" ry="11" opacity="0.8" />
        <ellipse cx="335" cy="108" rx="12" ry="9" opacity="0.75" />
      </g>
      <g fill="none" stroke="#fde68a" strokeWidth="2.5" strokeDasharray="6 6">
        <circle cx="205" cy="150" r="36" />
        <circle cx="300" cy="170" r="28" />
      </g>
    </svg>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? '/app' : '/register';

  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav className="row">
          {user ? (
            <Link className="btn" to="/app">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Sign in
              </Link>
              <Link className="btn" to="/register">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="eyebrow">
              <Microscope size={15} /> AI-powered smart agriculture
            </span>
            <h1>
              Spot crop disease early. <em>Protect your harvest.</em>
            </h1>
            <p className="lede">
              Take a photo of a leaf and CropGuard tells you what is wrong, how sure it is, and what to do next. Weather
              advice and market prices sit beside it, in one place.
            </p>
            <div className="row-wrap">
              <Link className="btn btn-lg" to={cta}>
                {user ? 'Open dashboard' : 'Create a free account'} <ArrowRight size={18} />
              </Link>
              {!user ? (
                <Link className="btn btn-lg btn-secondary" to="/login">
                  I already have an account
                </Link>
              ) : null}
            </div>
            <div className="hero-points">
              <span><Check size={16} /> 14 crops, 26 diseases</span>
              <span><Check size={16} /> 25 pest groups</span>
              <span><Check size={16} /> 8 Indian languages</span>
            </div>
          </div>

          <div className="mock" aria-hidden="true">
            <div className="mock-photo">
              <LeafArt />
              <span className="mock-tag">
                <Badge tone="bad">Disease found</Badge>
              </span>
            </div>
            <div className="stack-sm" style={{ padding: '16px 4px 4px' }}>
              <div className="row between">
                <h3>Tomato: Early blight</h3>
                <Badge tone="warn">Medium severity</Badge>
              </div>
              <ConfidenceBar label="Early blight" value={0.94} primary />
              <ConfidenceBar label="Septoria leaf spot" value={0.04} />
              <ConfidenceBar label="Target spot" value={0.02} />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Everything a farmer needs to decide, in one place</h2>
          <p>Farmers lose time and yield when problems are found late. CropGuard brings diagnosis, weather and prices together.</p>
        </div>
        <div className="grid grid-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article className="card feature" key={title}>
              <div className="stat-icon">
                <Icon size={21} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="section">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps from a worrying leaf to a plan of action.</p>
          </div>
          <div className="grid grid-3 steps">
            <article className="card step" style={{ color: 'var(--ink)' }}>
              <h3>Take a photo</h3>
              <p>Photograph one affected leaf, or the insect itself, in daylight. Upload it from your phone or computer.</p>
            </article>
            <article className="card step" style={{ color: 'var(--ink)' }}>
              <h3>The AI analyses it</h3>
              <p>Two neural networks check for diseases and pests and report how confident they are. Unclear photos are flagged, not guessed.</p>
            </article>
            <article className="card step" style={{ color: 'var(--ink)' }}>
              <h3>Act on the advice</h3>
              <p>Read the symptoms to confirm, then follow the cultural, organic and chemical options. Every scan is saved to your history.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section center">
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Ready to check your crop?</h2>
        <p className="muted" style={{ margin: '10px auto 22px', maxWidth: '50ch' }}>
          Create an account, add your farm, and run your first scan in under two minutes.
        </p>
        <Link className="btn btn-lg" to={cta}>
          {user ? 'Open dashboard' : 'Get started'} <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="footer">
        CropGuard is a decision-support tool. AI results can be wrong: confirm important decisions with your local agricultural
        extension officer.
      </footer>
    </div>
  );
}
