import { CalendarCheck, Check, Pencil, Plus, Trash2 } from 'lucide-react';
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
  Pagination,
  SelectField,
  Tabs,
  TextAreaField,
  TextField,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ACTIVITY_TYPES, formatDate, formatRupees, relativeDay, toDateInput } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
];

function ActivityForm({ activity, farms, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    type: activity?.type || 'irrigation',
    title: activity?.title || '',
    date: toDateInput(activity?.date),
    status: activity?.status || 'planned',
    farmId: activity?.farm?._id || activity?.farm?.id || '',
    notes: activity?.notes || '',
    cost: activity?.cost || '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.title.trim().length < 2) {
      setError('Describe the activity in a few words.');
      return;
    }
    setBusy(true);
    setError('');
    const body = { ...form, title: form.title.trim(), cost: Number(form.cost) || 0, farmId: form.farmId || null };
    try {
      if (activity) await api.put(`/activities/${activity.id}`, body);
      else await api.post('/activities', body);
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
        <SelectField label="Type" value={form.type} onChange={set('type')}>
          {Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
        <TextField label="Date" type="date" value={form.date} onChange={set('date')} />
        <TextField className="full" label="What was done or is planned" placeholder="e.g. Drip irrigation, 2 hours" maxLength={120} value={form.title} onChange={set('title')} />
        <SelectField label="Farm" value={form.farmId} onChange={set('farmId')}>
          <option value="">No farm</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </SelectField>
        <SelectField label="Status" value={form.status} onChange={set('status')}>
          <option value="planned">Planned</option>
          <option value="done">Done</option>
        </SelectField>
        <TextField label="Cost (₹)" hint="Optional" type="number" min="0" inputMode="decimal" value={form.cost} onChange={set('cost')} />
        <TextAreaField className="full" label="Notes" maxLength={500} value={form.notes} onChange={set('notes')} />
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" busy={busy}>{activity ? 'Save changes' : 'Add activity'}</Button>
      </div>
    </form>
  );
}

export default function Activities() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const farms = useApi('/farms');
  const { data, loading, error, reload } = useApi('/activities', { status, page, limit: 12 });
  const [editing, setEditing] = useState(null); // null | 'new' | activity
  const [removing, setRemoving] = useState(null);
  const [yesterday] = useState(() => Date.now() - 24 * 60 * 60 * 1000);

  async function toggle(activity) {
    try {
      await api.patch(`/activities/${activity.id}/status`, { status: activity.status === 'done' ? 'planned' : 'done' });
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  async function remove() {
    try {
      await api.delete(`/activities/${removing.id}`);
      toast('Activity deleted');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader title="Activities" subtitle="Plan field work and keep a record of what was done on each farm.">
        <Button icon={Plus} onClick={() => setEditing('new')}>
          Add activity
        </Button>
      </PageHeader>

      <Card
        pad={false}
        title="Field log"
        icon={CalendarCheck}
        action={
          <Tabs
            tabs={FILTERS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        }
      >
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={status ? `No ${status} activities` : 'No activities yet'} action={<Button icon={Plus} onClick={() => setEditing('new')}>Add activity</Button>}>
            Record sowing, irrigation, fertiliser, spraying and harvest. Planned work shows up on your dashboard.
          </EmptyState>
        ) : (
          <>
            <ul className="list">
              {data.items.map((a) => {
                const done = a.status === 'done';
                const overdue = !done && new Date(a.date).getTime() < yesterday;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`check${done ? ' done' : ''}`}
                      aria-label={done ? `Mark "${a.title}" as planned` : `Mark "${a.title}" as done`}
                      aria-pressed={done}
                      onClick={() => toggle(a)}
                    >
                      {done ? <Check size={15} /> : null}
                    </button>
                    <div className="grow">
                      <div className={`strong truncate${done ? ' done-text' : ''}`}>{a.title}</div>
                      <div className="small muted truncate">
                        {ACTIVITY_TYPES[a.type]}
                        {a.farm?.name ? ` · ${a.farm.name}` : ''}
                        {a.cost ? ` · ${formatRupees(a.cost)}` : ''}
                        {a.notes ? ` · ${a.notes}` : ''}
                      </div>
                    </div>
                    <span className="small muted nowrap hide-sm">{formatDate(a.date)}</span>
                    <Badge tone={done ? 'good' : overdue ? 'warn' : 'info'}>{done ? 'Done' : overdue ? 'Overdue' : relativeDay(a.date)}</Badge>
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
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>

      {editing ? (
        <Modal wide title={editing === 'new' ? 'Add an activity' : 'Edit activity'} onClose={() => setEditing(null)}>
          <ActivityForm
            activity={editing === 'new' ? null : editing}
            farms={farms.data?.farms || []}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast(editing === 'new' ? 'Activity added' : 'Activity updated');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog title="Delete this activity?" message={`"${removing.title}" will be removed from your field log.`} onConfirm={remove} onCancel={() => setRemoving(null)} />
      ) : null}
    </>
  );
}
