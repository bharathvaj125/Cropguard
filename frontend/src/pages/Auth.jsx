import { Check, Leaf, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const POINTS = [
  'Disease and pest detection from a single photo',
  'Soil Health Card read into exact fertiliser bags',
  'Ask by voice in Hindi, Tamil, Telugu and more',
  'Weather advice and mandi prices for your crops',
];

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Leaf className="leaf-float" size={120} style={{ top: '14%', right: '-18px', animationDelay: '-2s' }} aria-hidden="true" />
        <Sprout className="leaf-float" size={90} style={{ bottom: '18%', right: '22%', animationDelay: '-5s' }} aria-hidden="true" />
        <Leaf className="leaf-float" size={64} style={{ bottom: '6%', left: '-10px', transform: 'rotate(140deg)' }} aria-hidden="true" />
        <Link to="/" aria-label="CropGuard home">
          <img className="auth-logo" src="/brand/logo-full.webp" alt="CropGuard" />
        </Link>
        <div>
          <h2>Healthy crops start with early answers.</h2>
          <ul className="stagger">
            {POINTS.map((p) => (
              <li key={p}>
                <Check size={18} /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="tiny" style={{ opacity: 0.7 }}>
          Decision support only. Confirm important decisions with a local expert.
        </p>
      </aside>
      <main className="auth-form">
        <div className="stack">
          <Link to="/" className="auth-mobile-logo" aria-label="CropGuard home">
            <img src="/brand/logo-mark.webp" alt="" />
            <img src="/brand/logo-wordmark.webp" alt="CropGuard" />
          </Link>
          <div>
            <h1>{title}</h1>
            <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>
          </div>
          {children}
          <p className="muted small center">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your CropGuard account."
      footer={<>New to CropGuard? <Link to="/register">Create an account</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" size="lg" block busy={busy}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', state: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function validate() {
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) found.email = 'Enter a valid email address';
    if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      found.password = 'Use at least 8 characters with a letter and a number';
    }
    if (form.confirm !== form.password) found.confirm = 'Passwords do not match';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError('');
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        location: { state: form.state.trim() },
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free for farmers. It takes less than a minute."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <TextField label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextField
          label="State"
          hint="Optional. Used to show advisories for your region."
          autoComplete="address-level1"
          value={form.state}
          onChange={set('state')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" block busy={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
