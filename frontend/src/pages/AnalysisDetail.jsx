import { ArrowLeft, ClipboardCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AnalysisResult from '../components/AnalysisResult.jsx';
import { Button, Card, ConfirmDialog, ErrorAlert, Loading, PageHeader, SelectField, TextAreaField, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

/** A farmer's own note on a report. */
function Notes({ analysis, onSaved }) {
  const toast = useToast();
  const [notes, setNotes] = useState(analysis.notes || '');
  const [busy, setBusy] = useState(false);
  const dirty = notes !== (analysis.notes || '');

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/analyses/${analysis.id}`, { notes });
      toast('Notes saved');
      onSaved();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your notes">
      <div className="stack-sm">
        <TextAreaField
          label="Notes"
          hint="What you did about it, and whether it worked."
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="form-actions">
          <Button busy={busy} disabled={!dirty} onClick={save}>
            Save notes
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Admin only: confirm the AI result or record that it was wrong. */
function Review({ analysis, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(analysis.review?.status || 'pending');
  const [note, setNote] = useState(analysis.review?.note || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/admin/analyses/${analysis.id}/review`, { status, note });
      toast('Review saved');
      onSaved();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Expert review" icon={ClipboardCheck}>
      <div className="stack">
        <p className="small muted">
          Submitted by {analysis.user?.name} ({analysis.user?.email}). The farmer sees your verdict and note on their report.
        </p>
        <div className="form-grid">
          <SelectField label="Verdict" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending review</option>
            <option value="confirmed">Confirmed: the AI result is correct</option>
            <option value="corrected">Corrected: the AI result is wrong</option>
          </SelectField>
          <TextAreaField
            className="full"
            label="Note to the farmer"
            hint="For a correction, say what the problem actually is."
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <Button busy={busy} onClick={save}>
            Save review
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AnalysisDetail({ admin = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const base = admin ? '/admin/analyses' : '/analyses';
  const back = admin ? '/app/admin/reports' : '/app/history';
  const { data, loading, error, reload } = useApi(`${base}/${id}`);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    try {
      await api.delete(`${base}/${id}`);
      toast('Report deleted');
      navigate(back, { replace: true });
    } catch (err) {
      toast(err.message, 'bad');
      setConfirming(false);
    }
  }

  return (
    <>
      <PageHeader title="Analysis report" subtitle={admin ? 'Review this AI report.' : 'Full result and recommended actions.'}>
        <Link className="btn btn-secondary" to={back}>
          <ArrowLeft size={17} /> Back
        </Link>
        {data ? (
          <Button variant="secondary" icon={Trash2} onClick={() => setConfirming(true)}>
            Delete
          </Button>
        ) : null}
      </PageHeader>

      {error ? (
        <ErrorAlert error={error} onRetry={error.status === 404 ? undefined : reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <div className="stack">
          <AnalysisResult analysis={data.analysis} />
          {admin ? <Review key={data.analysis.review?.reviewedAt || 'new'} analysis={data.analysis} onSaved={reload} /> : <Notes analysis={data.analysis} onSaved={reload} />}
        </div>
      )}

      {confirming ? (
        <ConfirmDialog
          title="Delete this report?"
          message="The photo and its result will be permanently removed. This cannot be undone."
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
