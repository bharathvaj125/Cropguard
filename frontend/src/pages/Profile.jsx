import { KeyRound, ShieldAlert, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Modal, PageHeader, TextField, useToast } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { formatDate } from '../lib/format.js';

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    state: user.location?.state || '',
    district: user.location?.district || '',
    village: user.location?.village || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: { state: form.state.trim(), district: form.district.trim(), village: form.village.trim() },
      });
      toast('Profile updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your details" icon={UserRound} action={<Badge tone={user.role === 'admin' ? 'info' : 'good'}>{user.role === 'admin' ? 'Administrator' : 'Farmer'}</Badge>}>
      <form className="stack" onSubmit={submit} noValidate>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <div className="form-grid">
          <TextField label="Full name" autoComplete="name" value={form.name} onChange={set('name')} />
          <TextField label="Email" value={user.email} disabled hint="Your email is your sign-in name and cannot be changed." />
          <TextField label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          <TextField label="State" autoComplete="address-level1" value={form.state} onChange={set('state')} hint="Used to show advisories for your region." />
          <TextField label="District" value={form.district} onChange={set('district')} />
          <TextField label="Village / town" value={form.village} onChange={set('village')} />
        </div>
        <div className="row between">
          <span className="small faint">Member since {formatDate(user.createdAt)}</span>
          <Button type="submit" busy={busy}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.next.length < 8 || !/[a-zA-Z]/.test(form.next) || !/\d/.test(form.next)) {
      setError('Use at least 8 characters with a letter and a number.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password" icon={KeyRound}>
      <form className="stack" onSubmit={submit} noValidate>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} />
        <div className="form-grid">
          <TextField label="New password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number." value={form.next} onChange={set('next')} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </div>
        <div className="form-actions">
          <Button type="submit" busy={busy} disabled={!form.current || !form.next}>Change password</Button>
        </div>
      </form>
    </Card>
  );
}

function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password); // on success the app returns to the sign-in page
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Card title="Delete account" icon={ShieldAlert}>
      <div className="row-wrap between">
        <p className="muted" style={{ maxWidth: '60ch' }}>
          Permanently removes your account, farms, activities, scan reports and uploaded photos. This cannot be undone.
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete my account</Button>
      </div>
      {open ? (
        <Modal title="Delete your account?" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={confirm}>
            <p className="muted">All your data will be erased immediately. Enter your password to confirm.</p>
            {error ? <Alert tone="bad">{error}</Alert> : null}
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="danger" busy={busy} disabled={!password}>Delete everything</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}

export default function Profile() {
  return (
    <>
      <PageHeader title="Profile & security" subtitle="Manage your details, password and account." />
      <div className="stack" style={{ maxWidth: 820 }}>
        <ProfileForm />
        <PasswordForm />
        <DeleteAccount />
      </div>
    </>
  );
}
