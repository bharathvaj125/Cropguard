import { Bot, CheckCircle2, FileText, FlaskConical, HelpCircle, History, Keyboard, Layers, ScanText, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

const FIELDS = [
  { key: 'nitrogen', label: 'Nitrogen (N)', unit: 'kg/ha', step: '1', example: '240' },
  { key: 'phosphorus', label: 'Phosphorus (P)', unit: 'kg/ha', step: '0.1', example: '14' },
  { key: 'potassium', label: 'Potassium (K)', unit: 'kg/ha', step: '1', example: '280' },
  { key: 'ph', label: 'pH', unit: '', step: '0.1', example: '7.2' },
  { key: 'ec', label: 'Electrical conductivity (EC)', unit: 'dS/m', step: '0.01', example: '0.4' },
  { key: 'organicCarbon', label: 'Organic carbon (OC)', unit: '%', step: '0.01', example: '0.5' },
  { key: 'zinc', label: 'Zinc (Zn)', unit: 'ppm', step: '0.01', example: '0.6' },
  { key: 'iron', label: 'Iron (Fe)', unit: 'ppm', step: '0.1', example: '4.5' },
  { key: 'sulphur', label: 'Sulphur (S)', unit: 'ppm', step: '0.1', example: '10' },
  { key: 'boron', label: 'Boron (B)', unit: 'ppm', step: '0.01', example: '0.5' },
];
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.key, '']));

// A typical Soil Health Card from Dharwad, Karnataka, for trying the tool without a card.
const SAMPLE = {
  sampleId: 'SHC-KA-2026-9812',
  values: { nitrogen: '215', phosphorus: '12.8', potassium: '290', ph: '5.8', ec: '0.35', organicCarbon: '0.42', zinc: '0.42', iron: '5.1', sulphur: '8.4', boron: '' },
};

const CROPS = [
  ['paddy', 'Paddy / Rice (धान)'],
  ['wheat', 'Wheat (गेहूं)'],
  ['cotton', 'Cotton (कपास)'],
  ['tomato', 'Tomato (टमाटर)'],
  ['potato', 'Potato (आलू)'],
  ['onion', 'Onion (प्याज)'],
  ['maize', 'Maize (मक्का)'],
  ['sugarcane', 'Sugarcane (गन्ना)'],
  ['chilli', 'Chilli (मिर्च)'],
  ['groundnut', 'Groundnut (मूंगफली)'],
  ['soybean', 'Soybean (सोयाबीन)'],
  ['pulses', 'Pulses (दालें)'],
  ['general', 'Other field crop'],
];

const HEALTH_TONE = { excellent: 'good', good: 'good', moderate: 'warn', degraded: 'bad' };
const SOURCE_LABEL = { claude: 'Read by Claude AI, checked by you', manual: 'Entered by you', text: 'From pasted text' };

function ratingBadge(rating) {
  const bad = ['low', 'deficient', 'strongly_acidic', 'strongly_alkaline', 'injurious'];
  const warn = ['medium', 'acidic', 'alkaline', 'critical'];
  const good = ['high', 'sufficient', 'neutral', 'normal'];
  const text = (rating || 'not given').replace(/_/g, ' ');
  if (bad.includes(rating)) return <Badge tone="bad">{text}</Badge>;
  if (warn.includes(rating)) return <Badge tone="warn">{text}</Badge>;
  if (good.includes(rating)) return <Badge tone="good">{text}</Badge>;
  return <Badge>not given</Badge>;
}

export default function SoilDoctor() {
  const toast = useToast();
  const farms = useApi('/farms');
  const history = useApi('/soil', { limit: 9 });
  const cloud = useApi('/advisory/cloud-status');

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [values, setValues] = useState(EMPTY);
  const [sampleId, setSampleId] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [readInfo, setReadInfo] = useState(null); // { source, unreadable, notes, rejected }
  const [crop, setCrop] = useState('paddy');
  const [area, setArea] = useState('1');
  const [farmId, setFarmId] = useState('');
  const [notes, setNotes] = useState('');

  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [removing, setRemoving] = useState(null);

  const aiReady = Boolean(cloud.data?.llm?.enabled);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function chooseFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(f.type === 'application/pdf' ? '' : URL.createObjectURL(f));
    setReadInfo(null);
    setError('');
  }

  async function readCard() {
    if (!file) return;
    setReading(true);
    setError('');
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await api.post('/soil/extract', form);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, res.values[f.key] ?? ''].map(String)).map(([k, v]) => [k, v === 'null' ? '' : v])));
      setSampleId(res.sampleId || '');
      setReadInfo({ source: 'claude', unreadable: res.unreadableFields, notes: res.notes, rejected: res.rejected });
      setReviewing(true);
    } catch (err) {
      setError(err.message);
      if (err.details?.fallback === 'manual') setReviewing(true);
    } finally {
      setReading(false);
    }
  }

  function useSample() {
    setValues(SAMPLE.values);
    setSampleId(SAMPLE.sampleId);
    setReadInfo({ source: 'sample', unreadable: ['boron'], notes: ['Sample card: boron is smudged on this card, so it is left empty.'] });
    setReviewing(true);
  }

  async function analyse(e) {
    e.preventDefault();
    const filled = FIELDS.filter((f) => values[f.key] !== '');
    if (!filled.length) {
      setError('Enter at least one value from the Soil Health Card.');
      return;
    }
    setLoading(true);
    setError('');
    const form = new FormData();
    if (file) form.append('image', file);
    form.append('crop', crop);
    form.append('farmAreaAcre', area);
    if (farmId) form.append('farmId', farmId);
    if (sampleId) form.append('sampleId', sampleId);
    form.append('notes', notes);
    for (const f of filled) form.append(f.key, values[f.key]);
    try {
      const res = await api.post('/soil/analyze', form);
      setResult(res.soil);
      history.reload();
      setTimeout(() => document.getElementById('soil-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/soil/${removing.id}`);
      toast('Soil test deleted');
      if (result?.id === removing.id) setResult(null);
      history.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>Soil Doctor</h1>
          <p>Read your Soil Health Card, check each value, and get the exact bags of Urea, DAP and MOP for your field.</p>
        </div>
      </header>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className="grid grid-main">
        <div className="stack">
          {/* Step 1: the card */}
          <section className="card card-pad stack">
            <h2 className="row-center gap-xs">
              <ScanText size={18} /> 1. Your Soil Health Card
            </h2>
            <label
              className="dropzone"
              style={{ minHeight: 170 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                chooseFile(e.dataTransfer.files?.[0]);
              }}
            >
              {preview ? (
                <img src={preview} alt="Soil Health Card" style={{ maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
              ) : file ? (
                <div className="stack-xs align-center">
                  <FileText size={34} style={{ color: 'var(--green-700)' }} />
                  <strong>{file.name}</strong>
                </div>
              ) : (
                <div className="stack-xs align-center">
                  <Upload size={30} style={{ color: 'var(--green-600)' }} />
                  <strong>Take a photo or upload the card</strong>
                  <span className="tiny faint">JPG, PNG, WebP or PDF, up to 8 MB</span>
                </div>
              )}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => chooseFile(e.target.files?.[0])} />
            </label>

            <div className="row-wrap">
              <Button icon={Bot} busy={reading} disabled={!file || !aiReady} onClick={readCard}>
                {reading ? 'Reading the card…' : 'Read the card with AI'}
              </Button>
              <Button variant="secondary" icon={Keyboard} onClick={() => setReviewing(true)}>
                Type the values
              </Button>
              <Button variant="ghost" icon={Sparkles} onClick={useSample}>
                Try a sample card
              </Button>
            </div>
            {!aiReady ? (
              <p className="tiny faint">
                Automatic card reading needs Claude, which is not set up on this server. Type the values from your card instead.
              </p>
            ) : null}
          </section>

          {/* Step 2: review */}
          {reviewing ? (
            <form className="card card-pad stack" onSubmit={analyse}>
              <h2 className="row-center gap-xs">
                <CheckCircle2 size={18} /> 2. Check the values
              </h2>
              {readInfo?.source === 'claude' ? (
                <Alert tone="info" title="Read by AI: please check every number against your card">
                  Empty boxes could not be read clearly{readInfo.unreadable?.length ? ` (${readInfo.unreadable.length} of ${FIELDS.length})` : ''}. We never guess a
                  missing value: type it in if you can read it, or leave it empty.
                  {readInfo.notes?.length ? (
                    <ul className="list-styled" style={{ marginTop: 6, paddingLeft: 18 }}>
                      {readInfo.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : null}
                </Alert>
              ) : readInfo?.source === 'sample' ? (
                <Alert tone="info">Sample card loaded. Boron was smudged on this card, so it is left empty.</Alert>
              ) : (
                <p className="small muted">Copy the test values from your card. Leave a box empty if it is missing or unreadable.</p>
              )}

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Value on the card</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map((f) => {
                      const missing = values[f.key] === '';
                      return (
                        <tr key={f.key} style={missing && readInfo ? { background: 'var(--warn-bg)' } : undefined}>
                          <td>
                            <label htmlFor={`soil-${f.key}`}>{f.label}</label>
                          </td>
                          <td>
                            <input
                              id={`soil-${f.key}`}
                              className="input"
                              style={{ maxWidth: 140, padding: '6px 9px' }}
                              type="number"
                              inputMode="decimal"
                              step={f.step}
                              min="0"
                              placeholder={missing && readInfo ? 'not readable' : `e.g. ${f.example}`}
                              value={values[f.key]}
                              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                            />
                          </td>
                          <td className="muted small">{f.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="soil-crop">Crop you will grow</label>
                  <select id="soil-crop" className="select" value={crop} onChange={(e) => setCrop(e.target.value)}>
                    {CROPS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="soil-area">Field size (acres)</label>
                  <input id="soil-area" className="input" type="number" min="0.1" max="1000" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="soil-farm">Farm</label>
                  <select id="soil-farm" className="select" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
                    <option value="">No farm</option>
                    {(farms.data?.farms || []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="soil-sample">Sample / card number</label>
                  <input id="soil-sample" className="input" maxLength={40} value={sampleId} onChange={(e) => setSampleId(e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="soil-notes">Notes</label>
                  <input id="soil-notes" className="input" maxLength={1000} placeholder="e.g. north field near the canal" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <Button type="submit" size="lg" icon={FlaskConical} busy={loading}>
                3. Calculate fertiliser plan
              </Button>
            </form>
          ) : null}
        </div>

        <section className="card card-pad stack">
          <h2 className="row-center gap-xs">
            <Layers size={18} /> How it works
          </h2>
          <ul className="bullets small">
            <li style={{ marginTop: 0 }}>Values are rated against the Government of India Soil Health Card scheme ranges.</li>
            <li>Missing or unreadable values are shown as missing; they are never invented. Impossible values (for example pH 40) are rejected.</li>
            <li>Nutrient needs are converted into bags: Urea 45 kg, DAP 50 kg and MOP 50 kg, using DAP first for phosphorus.</li>
            <li>Lime is suggested for acidic soil, gypsum for sodic soil, and farmyard manure when organic carbon is low.</li>
          </ul>
        </section>
      </div>

      {result ? (
        <section id="soil-result" className="card card-pad stack" style={{ border: '2px solid var(--green-600)' }}>
          <div className="row between wrap">
            <h2 className="row-center gap-xs">
              <CheckCircle2 size={22} style={{ color: 'var(--green-600)' }} /> Result for {result.sampleId}
            </h2>
            <div className="row-center gap-xs wrap">
              <Badge tone={HEALTH_TONE[result.overallHealth]}>{result.overallHealth} soil health</Badge>
              <Badge icon={result.valueSource === 'claude' ? Bot : Keyboard}>{SOURCE_LABEL[result.valueSource] || 'Entered by you'}</Badge>
            </div>
          </div>
          <div className="small muted">
            Crop: <strong>{CROPS.find(([v]) => v === result.crop)?.[1] || result.crop}</strong> · Field: <strong>{result.farmAreaAcre} acre(s)</strong>
            {result.farm?.name ? <> · Farm: <strong>{result.farm.name}</strong></> : null}
          </div>

          <div style={{ background: 'var(--green-50)', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--green-200)' }}>
            <div className="strong" style={{ color: 'var(--green-900)', marginBottom: 8 }}>
              Fertiliser for {result.farmAreaAcre} acre(s)
            </div>
            <div className="grid grid-3 text-center">
              {[
                ['Neem-coated Urea', result.fertilizerPlan?.ureaBags, '45 kg bags'],
                ['DAP (18:46:0)', result.fertilizerPlan?.dapBags, '50 kg bags'],
                ['MOP (potash 60%)', result.fertilizerPlan?.mopBags, '50 kg bags'],
              ].map(([name, bags, unit]) => (
                <div key={name} className="card card-pad" style={{ boxShadow: 'none' }}>
                  <div className="tiny muted">{name}</div>
                  <div className="stat-value" style={{ color: 'var(--green-800)' }}>{bags}</div>
                  <div className="tiny muted">{unit}</div>
                </div>
              ))}
            </div>
            {result.fertilizerPlan?.limeKg > 0 ? <p className="small" style={{ marginTop: 8 }}>Apply <strong>{result.fertilizerPlan.limeKg} kg</strong> agricultural lime to correct acidity.</p> : null}
            {result.fertilizerPlan?.gypsumKg > 0 ? <p className="small" style={{ marginTop: 8 }}>Apply <strong>{result.fertilizerPlan.gypsumKg} kg</strong> gypsum to correct sodic soil.</p> : null}
            {result.fertilizerPlan?.fymTonnes > 0 ? <p className="small" style={{ marginTop: 8 }}>Mix in about <strong>{result.fertilizerPlan.fymTonnes} tonnes</strong> of farmyard manure.</p> : null}
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => {
                    const p = result.parameters?.[f.key] || {};
                    return (
                      <tr key={f.key}>
                        <td>{f.label}</td>
                        <td>{p.unreadable ? <span className="muted italic">missing</span> : <strong>{p.value} {p.unit}</strong>}</td>
                        <td>{ratingBadge(p.unreadable ? null : p.rating)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="stack">
              {result.fertilizerPlan?.schedule?.length ? (
                <div className="stack-xs">
                  <h3>When to apply</h3>
                  {result.fertilizerPlan.schedule.map((s) => (
                    <div key={s.stage} className="card card-pad stack-xs" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                      <div className="row between wrap">
                        <strong>{s.stage}</strong>
                        <span className="tiny muted">{s.timing}</span>
                      </div>
                      <div className="small">
                        <strong>{s.ureaBags}</strong> Urea · <strong>{s.dapBags}</strong> DAP · <strong>{s.mopBags}</strong> MOP bags
                      </div>
                      <div className="tiny muted">{s.notes}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {result.unreadableFields?.length ? (
                <Alert tone="warn" title="Missing from the card">
                  {result.unreadableFields.join(', ')}. These were not guessed; ask your Krishi Vigyan Kendra for a fresh test if they matter for your crop.
                </Alert>
              ) : null}
            </div>
          </div>

          {result.recommendations?.length ? (
            <div className="stack-xs">
              <h3>What to do</h3>
              <ul className="bullets">
                {result.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card card-pad stack">
        <h2 className="row-center gap-xs">
          <History size={18} /> Your soil tests
        </h2>
        {history.data?.items?.length ? (
          <div className="grid grid-3">
            {history.data.items.map((item) => (
              <div key={item.id} className="card card-pad stack-xs" style={{ boxShadow: 'none' }}>
                <div className="row between">
                  <button type="button" className="btn btn-ghost btn-sm strong" style={{ paddingLeft: 0 }} onClick={() => setResult(item)}>
                    {item.sampleId}
                  </button>
                  <Button variant="ghost" className="btn-icon" aria-label={`Delete ${item.sampleId}`} onClick={() => setRemoving(item)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
                <div className="row-center gap-xs wrap">
                  <Badge tone={HEALTH_TONE[item.overallHealth]}>{item.overallHealth}</Badge>
                  <span className="tiny muted">{formatDate(item.createdAt)}</span>
                </div>
                <div className="tiny">
                  {item.crop} · {item.farmAreaAcre} ac · Urea {item.fertilizerPlan?.ureaBags} · DAP {item.fertilizerPlan?.dapBags} · MOP {item.fertilizerPlan?.mopBags}
                </div>
              </div>
            ))}
          </div>
        ) : history.loading ? (
          <p className="muted small">Loading…</p>
        ) : (
          <EmptyState icon={HelpCircle} title="No soil tests yet">
            Upload your Soil Health Card above to track soil fertility over the seasons.
          </EmptyState>
        )}
      </section>

      {removing ? (
        <ConfirmDialog title={`Delete ${removing.sampleId}?`} message="This soil test and its card image will be removed." onConfirm={remove} onCancel={() => setRemoving(null)} />
      ) : null}
    </div>
  );
}
