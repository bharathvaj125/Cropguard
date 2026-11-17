import { AlertTriangle, BadgeCheck, Bot, Cpu, History, Info, Palette, Scale, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, ConfidenceBar, ConfirmDialog, EmptyState, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatRupees } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

const GRADE_TONE = { 'Grade A': 'good', 'Grade B': 'warn', 'Grade C': 'bad' };
const METHOD = {
  model: { label: 'Trained quality model', icon: Cpu, tone: 'info', text: 'Graded by a neural network trained on Indian fruit photos (FruitNet).' },
  claude: { label: 'Claude AI vision', icon: Bot, tone: 'info', text: 'Graded by Claude against AGMARK grade descriptions.' },
  basic: { label: 'Basic colour check', icon: Palette, tone: 'warn', text: 'Only overall colour was checked. Use it as a rough guide.' },
};

export default function ProduceGrader() {
  const toast = useToast();
  const methods = useApi('/produce/methods');
  const commodities = useApi('/market/commodities');
  const farms = useApi('/farms');
  const history = useApi('/produce', { limit: 9 });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [commodity, setCommodity] = useState('Apple');
  const [market, setMarket] = useState('');
  const [variety, setVariety] = useState('');
  const [farmId, setFarmId] = useState('');
  const [notes, setNotes] = useState('');
  const markets = useApi(commodity ? '/market/markets' : null, { commodity });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [advice, setAdvice] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [removing, setRemoving] = useState(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const modelFruits = methods.data?.model?.commodities || [];
  const names = [...new Set([...(commodities.data?.commodities || []).map((c) => c.commodity), ...modelFruits])].sort();
  const usesModel = methods.data?.model?.available && modelFruits.some((f) => f.toLowerCase() === commodity.toLowerCase());
  const plannedMethod = usesModel ? 'model' : methods.data?.claude?.available ? 'claude' : 'basic';

  function chooseFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  }

  async function grade(e) {
    e.preventDefault();
    if (!file) {
      setError('Please add a clear photo of the produce lot.');
      return;
    }
    setLoading(true);
    setError('');
    const form = new FormData();
    form.append('image', file);
    form.append('commodity', commodity);
    if (market) form.append('market', market);
    if (variety) form.append('variety', variety);
    if (farmId) form.append('farmId', farmId);
    if (notes) form.append('notes', notes);
    try {
      const res = await api.post('/produce/grade', form);
      setResult(res.produce);
      setAdvice(res.advice || '');
      setPriceNote(res.priceUnavailable || '');
      history.reload();
      setTimeout(() => document.getElementById('produce-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/produce/${removing.id}`);
      toast('Grading deleted');
      if (result?.id === removing.id) setResult(null);
      history.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  const m = result ? METHOD[result.method] || METHOD.basic : null;
  const price = result?.priceEstimate;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>Produce Grader</h1>
          <p>Photograph a lot of fruit or vegetables to get an indicative AGMARK grade and the price range it can fetch at the mandi.</p>
        </div>
      </header>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className="grid grid-main">
        <form className="card card-pad stack" onSubmit={grade}>
          <h2 className="row-center gap-xs">
            <Scale size={18} /> Grade a lot
          </h2>
          <label
            className="dropzone"
            style={{ minHeight: 190 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              chooseFile(e.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              <img src={preview} alt="Produce lot" style={{ maxHeight: 220, borderRadius: 8, objectFit: 'contain' }} />
            ) : (
              <div className="stack-xs align-center">
                <Upload size={30} style={{ color: 'var(--green-600)' }} />
                <strong>Take or upload a photo of the lot</strong>
                <span className="tiny faint">Daylight, the whole heap or crate in view. JPG, PNG or WebP.</span>
              </div>
            )}
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} />
          </label>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="pg-commodity">Commodity</label>
              <select
                id="pg-commodity"
                className="select"
                value={commodity}
                onChange={(e) => {
                  setCommodity(e.target.value);
                  setMarket('');
                }}
              >
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {methods.data?.model?.available && modelFruits.includes(n) ? ' ★' : ''}
                  </option>
                ))}
              </select>
              {methods.data?.model?.available ? <span className="hint">★ graded by the trained quality model</span> : null}
            </div>
            <div className="field">
              <label htmlFor="pg-market">Mandi</label>
              <select id="pg-market" className="select" value={market} onChange={(e) => setMarket(e.target.value)}>
                <option value="">Best available price data</option>
                {(markets.data?.markets || []).map((mk) => (
                  <option key={mk.market} value={mk.market}>
                    {mk.market}, {mk.state}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pg-variety">Variety</label>
              <input id="pg-variety" className="input" maxLength={40} placeholder="Optional" value={variety} onChange={(e) => setVariety(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pg-farm">Farm</label>
              <select id="pg-farm" className="select" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
                <option value="">No farm</option>
                {(farms.data?.farms || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="pg-notes">Notes</label>
              <input id="pg-notes" className="input" maxLength={500} placeholder="e.g. 20 crates, second picking" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {methods.data ? (
            <p className="tiny muted row-center gap-xs">
              {(() => {
                const Icon = METHOD[plannedMethod].icon;
                return <Icon size={14} />;
              })()}
              Will be graded by: <strong>{METHOD[plannedMethod].label}</strong>
            </p>
          ) : null}

          <Button type="submit" size="lg" icon={BadgeCheck} busy={loading} disabled={!file}>
            {loading ? 'Grading…' : 'Grade and estimate price'}
          </Button>
        </form>

        <section className="card card-pad stack">
          <h2 className="row-center gap-xs">
            <Info size={18} /> AGMARK grades
          </h2>
          <div className="stack-sm small">
            <div>
              <Badge tone="good">Grade A</Badge> Uniform size and colour, firm, no visible damage. Fetches 5–18% above the modal rate.
            </div>
            <div>
              <Badge tone="warn">Grade B</Badge> Fair average quality: some variation and minor marks, no rot. Trades near the modal rate.
            </div>
            <div>
              <Badge tone="bad">Grade C</Badge> Rot, bruising, pest damage or very mixed maturity. Sort it, or sell to processors.
            </div>
          </div>
          <p className="tiny faint">A photo cannot show weight, taste or internal defects. The grade is indicative; the buyer's inspection decides the final grade.</p>
        </section>
      </div>

      {result ? (
        <section id="produce-result" className="card card-pad stack" style={{ border: '2px solid var(--green-600)' }}>
          <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
            <div className="stack-xs">
              <div className="row-center gap-sm wrap">
                <span className={`badge badge-${GRADE_TONE[result.grade]}`} style={{ fontSize: '1.05rem', padding: '5px 12px' }}>
                  {result.grade}
                </span>
                <strong>{result.gradeLabel}</strong>
              </div>
              <div className="row-center gap-xs wrap">
                <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>
                <span className="small muted">
                  {result.commodity}
                  {result.variety ? ` (${result.variety})` : ''}
                </span>
              </div>
            </div>
            <div style={{ minWidth: 220 }}>
              <ConfidenceBar label="Confidence" value={result.confidence} primary warn={result.confidence < 0.6} />
            </div>
          </div>

          {result.warnings?.map((w) => (
            <Alert key={w} tone="warn">{w}</Alert>
          ))}
          {result.summary ? <p>{result.summary}</p> : null}

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="stack">
              {price ? (
                <div style={{ background: 'var(--green-50)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--green-200)' }}>
                  <div className="row between wrap">
                    <strong style={{ color: 'var(--green-900)' }}>Estimated price at {price.market}</strong>
                    <span className="tiny muted">{formatDate(price.marketDate)}</span>
                  </div>
                  <div className="grid grid-2 text-center" style={{ marginTop: 10 }}>
                    <div className="card card-pad" style={{ boxShadow: 'none' }}>
                      <div className="tiny muted">Per kg</div>
                      <div className="stat-value" style={{ color: 'var(--green-800)' }}>
                        ₹{price.estimatedMinPerKg}–{price.estimatedMaxPerKg}
                      </div>
                    </div>
                    <div className="card card-pad" style={{ boxShadow: 'none' }}>
                      <div className="tiny muted">Per quintal</div>
                      <div className="stat-value" style={{ color: 'var(--green-800)', fontSize: '1.3rem' }}>
                        {formatRupees(price.estimatedMinPerQuintal)}–{formatRupees(price.estimatedMaxPerQuintal)}
                      </div>
                    </div>
                  </div>
                  <p className="tiny muted" style={{ marginTop: 8 }}>
                    Modal rate {formatRupees(price.baseModalPricePerQuintal)}/quintal in {price.market}, {price.state}.
                    {price.marketNote ? ` ${price.marketNote}` : ''}
                    {price.sample ? ' Sample market data, not live mandi rates.' : ''}
                  </p>
                </div>
              ) : (
                <Alert tone="info">{priceNote || `No mandi price data for ${result.commodity} yet.`}</Alert>
              )}
              {advice ? (
                <div>
                  <h3>Selling advice</h3>
                  <p className="small muted" style={{ marginTop: 4 }}>{advice}</p>
                </div>
              ) : null}
            </div>

            <div className="stack">
              {result.qualityProbabilities ? (
                <div className="stack-sm">
                  <h3>What the model saw</h3>
                  <ConfidenceBar label="Good (Grade A)" value={result.qualityProbabilities.good} />
                  <ConfidenceBar label="Mixed (Grade B)" value={result.qualityProbabilities.mixed} />
                  <ConfidenceBar label="Bad (Grade C)" value={result.qualityProbabilities.bad} />
                </div>
              ) : null}
              {result.defectsDetected?.length ? (
                <div className="stack-xs">
                  <h3>Defects seen</h3>
                  {result.defectsDetected.map((d) => (
                    <div key={d.type + d.description} className="row-center gap-xs small">
                      <AlertTriangle size={15} style={{ color: d.severity === 'severe' ? 'var(--bad)' : 'var(--warn)', flex: 'none' }} />
                      <span>{d.description}</span>
                    </div>
                  ))}
                </div>
              ) : result.method === 'basic' ? (
                <p className="small muted">The basic check cannot see individual defects.</p>
              ) : (
                <p className="small muted">No defects were visible in the photo.</p>
              )}
              <p className="tiny faint">{m.text}</p>
            </div>
          </div>

          <Alert tone="warn">{result.disclaimer}</Alert>
        </section>
      ) : null}

      <section className="card card-pad stack">
        <h2 className="row-center gap-xs">
          <History size={18} /> Your graded lots
        </h2>
        {history.data?.items?.length ? (
          <div className="grid grid-3">
            {history.data.items.map((item) => (
              <div key={item.id} className="card card-pad stack-xs" style={{ boxShadow: 'none' }}>
                <div className="row between">
                  <button type="button" className="btn btn-ghost btn-sm strong" style={{ paddingLeft: 0 }} onClick={() => setResult(item)}>
                    {item.commodity}
                  </button>
                  <Button variant="ghost" className="btn-icon" aria-label={`Delete ${item.commodity} grading`} onClick={() => setRemoving(item)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
                <img src={item.imageUrl} alt="" loading="lazy" style={{ height: 90, objectFit: 'cover', borderRadius: 8 }} />
                <div className="row-center gap-xs wrap">
                  <Badge tone={GRADE_TONE[item.grade]}>{item.grade}</Badge>
                  <span className="tiny muted">{METHOD[item.method]?.label}</span>
                </div>
                <div className="tiny">
                  {item.priceEstimate ? `₹${item.priceEstimate.estimatedMinPerKg}–${item.priceEstimate.estimatedMaxPerKg}/kg at ${item.priceEstimate.market}` : 'No price data'} · {formatDate(item.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : history.loading ? (
          <p className="muted small">Loading…</p>
        ) : (
          <EmptyState icon={Scale} title="No lots graded yet">Grade your first lot above to see its grade and price band.</EmptyState>
        )}
      </section>

      {removing ? (
        <ConfirmDialog title={`Delete this ${removing.commodity} grading?`} message="The grading and its photo will be removed." onConfirm={remove} onCancel={() => setRemoving(null)} />
      ) : null}
    </div>
  );
}
