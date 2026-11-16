import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  Loading,
  Modal,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { formatDate, toDateInput } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';

const SEVERITY = {
  info: { label: 'Information', tone: 'info' },
  warning: { label: 'Warning', tone: 'warn' },
  critical: { label: 'Critical', tone: 'bad' },
};

function AdvisoryForm({ advisory, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: advisory?.title || '',
    message: advisory?.message || '',
    severity: advisory?.severity || 'info',
    state: advisory?.state || '',
    active: advisory?.active ?? true,
    expiresAt: advisory?.expiresAt ? toDateInput(advisory.expiresAt) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...form, expiresAt: form.expiresAt || null };
    try {
      if (advisory) await api.put(`/admin/advisories/${advisory.id}`, body);
      else await api.post('/admin/advisories', body);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <div className="form-grid">
        <TextField className="full" label="Title" maxLength={120} placeholder="e.g. Late blight watch for potato growers" value={form.title} onChange={set('title')} />
        <TextAreaField className="full" label="Message" maxLength={1000} hint="Say what is happening and what farmers should do." value={form.message} onChange={set('message')} />
        <SelectField label="Severity" value={form.severity} onChange={set('severity')}>
          {Object.entries(SEVERITY).map(([value, s]) => (
            <option key={value} value={value}>{s.label}</option>
          ))}
        </SelectField>
        <TextField label="State" hint="Leave empty to show it to every farmer." value={form.state} onChange={set('state')} />
        <TextField label="Expires on" type="date" hint="Optional. Hidden from farmers after this date." value={form.expiresAt} onChange={set('expiresAt')} />
        <SelectField label="Status" value={form.active ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, active: e.target.value === 'yes' })}>
          <option value="yes">Published</option>
          <option value="no">Hidden</option>
        </SelectField>
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" busy={busy}>{advisory ? 'Save changes' : 'Publish advisory'}</Button>
      </div>
    </form>
  );
}

export default function AdminAdvisories() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/advisories');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [now] = useState(() => Date.now());

  async function remove() {
    try {
      await api.delete(`/admin/advisories/${removing.id}`);
      toast('Advisory deleted');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader title="Advisories" subtitle="Broadcast alerts to farmers. They appear at the top of the farmer dashboard.">
        <Button icon={Plus} onClick={() => setEditing('new')}>
          New advisory
        </Button>
      </PageHeader>

      <Card pad={false} title="Published and past advisories" icon={Megaphone}>
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.advisories.length === 0 ? (
          <EmptyState icon={Megaphone} title="No advisories yet" action={<Button icon={Plus} onClick={() => setEditing('new')}>Write the first one</Button>}>
            Use advisories for outbreak warnings, weather alerts and scheme announcements.
          </EmptyState>
        ) : (
          <ul className="list">
            {data.advisories.map((a) => {
              const expired = a.expiresAt && new Date(a.expiresAt).getTime() < now;
              const live = a.active && !expired;
              return (
                <li key={a.id} style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="row-wrap" style={{ gap: 8 }}>
                      <span className="strong">{a.title}</span>
                      <Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge>
                      <Badge tone={live ? 'good' : undefined}>{live ? 'Live' : expired ? 'Expired' : 'Hidden'}</Badge>
                    </div>
                    <p className="muted small" style={{ marginTop: 4 }}>{a.message}</p>
                    <div className="tiny faint" style={{ marginTop: 6 }}>
                      {a.state ? `Farmers in ${a.state}` : 'All farmers'} · published {formatDate(a.createdAt)}
                      {a.expiresAt ? ` · expires ${formatDate(a.expiresAt)}` : ''}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <Button variant="ghost" className="btn-icon" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}>
                      <Pencil size={16} />
                    </Button>
                    <Button variant="ghost" className="btn-icon" aria-label={`Delete ${a.title}`} onClick={() => setRemoving(a)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing ? (
        <Modal wide title={editing === 'new' ? 'New advisory' : 'Edit advisory'} onClose={() => setEditing(null)}>
          <AdvisoryForm
            advisory={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast(editing === 'new' ? 'Advisory published' : 'Advisory updated');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog title="Delete this advisory?" message={`"${removing.title}" will be removed for all farmers.`} onConfirm={remove} onCancel={() => setRemoving(null)} />
      ) : null}
    </>
  );
}
