import { Camera, ImagePlus, RotateCcw, ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AnalysisResult from '../components/AnalysisResult.jsx';
import { Alert, Button, Card, PageHeader, SelectField, TextAreaField } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

const MODES = [
  { value: 'both', label: 'Disease + pest', hint: 'Check for everything' },
  { value: 'disease', label: 'Disease only', hint: 'A leaf with spots or mould' },
  { value: 'pest', label: 'Pest only', hint: 'A close-up of an insect' },
];

export default function Scan() {
  const farms = useApi('/farms');
  const knowledge = useApi('/knowledge');
  const input = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ mode: 'both', cropHint: '', farmId: '', notes: '' });
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Object URLs must be released or the browser keeps the image in memory.
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function choose(candidate) {
    setError('');
    if (!candidate) return;
    if (!ACCEPT.includes(candidate.type)) {
      setError('Please choose a JPG, PNG or WebP photo.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError('That photo is larger than 8 MB. Choose a smaller one.');
      return;
    }
    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
  }

  function clear() {
    setFile(null);
    setPreview('');
    setError('');
    if (input.current) input.current.value = '';
  }

  async function submit() {
    setBusy(true);
    setError('');
    const body = new FormData();
    body.append('image', file);
    body.append('mode', form.mode);
    if (form.cropHint) body.append('cropHint', form.cropHint);
    if (form.farmId) body.append('farmId', form.farmId);
    if (form.notes) body.append('notes', form.notes);
    try {
      const data = await api.post('/analyses', body);
      setResult(data.analysis);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <>
        <PageHeader title="Scan result" subtitle="Saved to your scan history.">
          <Link className="btn btn-secondary" to="/app/history">
            View history
          </Link>
          <Button
            icon={RotateCcw}
            onClick={() => {
              setResult(null);
              clear();
            }}
          >
            Scan another
          </Button>
        </PageHeader>
        <AnalysisResult analysis={result} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Scan a crop" subtitle="Upload a photo and the AI will check it for diseases and pests." />

      <div className="grid grid-main">
        <div className="stack">
          {error ? <Alert tone="bad">{error}</Alert> : null}

          {preview ? (
            <div className="preview">
              <img src={preview} alt="Selected crop" />
              {busy ? (
                <div className="scanning" role="status">
                  Analysing your photo…
                </div>
              ) : (
                <Button variant="secondary" size="sm" icon={X} onClick={clear}>
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <label
              className={`dropzone${over ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                choose(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="empty-icon">
                <ImagePlus size={26} />
              </div>
              <h3>Drop a photo here, or tap to choose</h3>
              <p className="muted small">JPG, PNG or WebP, up to 8 MB</p>
              <input
                ref={input}
                className="sr-only"
                type="file"
                accept={ACCEPT.join(',')}
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </label>
          )}

          <Card title="What should the AI look for?" icon={ScanLine}>
            <div className="stack">
              <div className="segmented" role="radiogroup" aria-label="Analysis type">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === m.value}
                    className={`segment${form.mode === m.value ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, mode: m.value })}
                  >
                    <b>{m.label}</b>
                    <span>{m.hint}</span>
                  </button>
                ))}
              </div>

              <div className="form-grid">
                <SelectField
                  label="Crop"
                  hint="Choosing the crop makes the disease result more accurate."
                  value={form.cropHint}
                  onChange={(e) => setForm({ ...form, cropHint: e.target.value })}
                  disabled={form.mode === 'pest'}
                >
                  <option value="">Not sure / other</option>
                  {(knowledge.data?.crops || []).map((crop) => (
                    <option key={crop}>{crop}</option>
                  ))}
                </SelectField>
                <SelectField label="Farm" hint="Optional. Links the scan to a farm." value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
                  <option value="">No farm</option>
                  {(farms.data?.farms || []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </SelectField>
                <TextAreaField
                  className="full"
                  label="Notes"
                  hint="Optional. For example, which part of the field this came from."
                  maxLength={500}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <Button size="lg" icon={ScanLine} busy={busy} disabled={!file} onClick={submit}>
                {busy ? 'Analysing…' : 'Analyse photo'}
              </Button>
            </div>
          </Card>
        </div>

        <Card title="Tips for a reliable result" icon={Camera}>
          <ul className="bullets">
            <li style={{ marginTop: 0 }}>Photograph <b>one leaf</b> so it fills most of the frame.</li>
            <li>Use daylight. Avoid flash, deep shade and strong backlight.</li>
            <li>Hold steady and tap the screen to focus.</li>
            <li>Use a plain background if you can, such as soil, paper or your hand.</li>
            <li>For pests, get as close to the insect as your camera can focus.</li>
          </ul>
          <Alert tone="info" title="What the AI knows">
            The disease model covers 14 crops (apple, corn, grape, potato, tomato and more). Other crops will give
            unreliable results. See the <Link to="/app/library">disease &amp; pest guide</Link> for the full list.
          </Alert>
        </Card>
      </div>
    </>
  );
}
