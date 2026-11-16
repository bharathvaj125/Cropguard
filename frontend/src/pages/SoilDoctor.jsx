import {
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  History,
  Layers,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, EmptyState } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const SAMPLE_OCR_CARD = `GOVERNMENT OF INDIA - SOIL HEALTH CARD
Ministry of Agriculture & Farmers Welfare
Sample ID: SHC-KA-2026-9812
Date of Sampling: 12-Nov-2026
Farmer: Basavaraj Patil | District: Dharwad

TEST RESULTS:
1. Soil Reaction (pH): 5.8 (Moderately Acidic)
2. Electrical Conductivity (EC): 0.35 dS/m (Normal)
3. Organic Carbon (OC): 0.42 % (Low)
4. Available Nitrogen (N): 215 kg/ha (Low)
5. Available Phosphorus (P): 12.8 kg/ha (Medium)
6. Available Potassium (K): 290 kg/ha (High)
7. Available Zinc (Zn): 0.42 ppm (Deficient)
8. Available Iron (Fe): 5.1 ppm (Sufficient)
9. Available Sulphur (S): 8.4 ppm (Deficient)
10. Boron (B): [Unreadable / Smudged]`;

export default function SoilDoctor() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [crop, setCrop] = useState('paddy');
  const [farmAreaAcre, setFarmAreaAcre] = useState(1);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Manual adjustments toggler
  const [showManual, setShowManual] = useState(false);
  const [manualValues, setManualValues] = useState({
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    ph: '',
    ec: '',
    organicCarbon: '',
    zinc: '',
    iron: '',
  });

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/soil');
      setHistory(res.items || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const handleUseSample = () => {
    setOcrText(SAMPLE_OCR_CARD);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !ocrText && !manualValues.nitrogen) {
      setError('Please attach a photograph or provide Soil Health Card data.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      if (file) formData.append('image', file);
      formData.append('crop', crop);
      formData.append('farmAreaAcre', farmAreaAcre);
      formData.append('ocrText', ocrText);
      formData.append('notes', notes);

      // Append manual values if filled
      Object.entries(manualValues).forEach(([k, v]) => {
        if (v !== '') formData.append(k, v);
      });

      const res = await api.post('/soil/analyze', formData);
      setResult(res.soil);
      loadHistory();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to analyze soil health card');
    } finally {
      setLoading(false);
    }
  };

  const getRatingBadge = (rating) => {
    switch (rating) {
      case 'low':
      case 'deficient':
      case 'strongly_acidic':
      case 'strongly_alkaline':
      case 'injurious':
        return <span className="badge badge-bad">{rating.toUpperCase()}</span>;
      case 'medium':
      case 'acidic':
      case 'alkaline':
      case 'critical':
        return <span className="badge badge-warn">{rating.toUpperCase()}</span>;
      case 'high':
      case 'sufficient':
      case 'neutral':
      case 'normal':
        return <span className="badge badge-good">{rating.toUpperCase()}</span>;
      default:
        return <span className="badge badge-ghost">UNSPECIFIED</span>;
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <div className="row-center gap-xs" style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: '0.9rem' }}>
            <FlaskConical size={18} />
            ICAR-Calibrated Agronomic Soil Doctor
          </div>
          <h1 style={{ marginTop: 4 }}>Soil Health Card & Fertilizer Engine</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Upload your Soil Health Card (SHC) or soil test report. Our engine extracts parameters, checks fertility status, and generates exact commercial fertilizer bag requirements (Urea, DAP, MOP) tailored to your farm area and target crop.
          </p>
        </div>
      </div>

      {error ? <Alert tone="bad" title="Error">{error}</Alert> : null}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Form Card */}
        <div className="card card-pad stack">
          <div className="card-head" style={{ padding: 0 }}>
            <h2>Input Soil Health Data</h2>
          </div>

          <form onSubmit={handleSubmit} className="stack">
            {/* File upload */}
            <div className="form-group">
              <label className="label">Upload Soil Health Card (Photo or Scan)</label>
              <div
                style={{
                  border: '2px dashed var(--line-strong)',
                  borderRadius: 'var(--radius)',
                  padding: 20,
                  textAlign: 'center',
                  background: preview ? 'var(--surface)' : 'var(--surface-2)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('soil-card-input').click()}
              >
                {preview ? (
                  <div className="stack-xs align-center">
                    <img
                      src={preview}
                      alt="Soil Card Preview"
                      style={{ maxHeight: 180, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                    />
                    <div className="tiny subtle">Click to choose a different card image</div>
                  </div>
                ) : (
                  <div className="stack-xs align-center">
                    <Upload size={32} style={{ color: 'var(--green-600)', margin: '0 auto' }} />
                    <div className="strong">Take a photo or upload card</div>
                    <div className="tiny subtle">JPG, PNG, WebP up to 10 MB</div>
                  </div>
                )}
                <input
                  id="soil-card-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* OCR Text Box */}
            <div className="form-group">
              <div className="row-center between">
                <label className="label">Soil Report Text / Extracted OCR</label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--green-700)', padding: '2px 8px', fontSize: '0.8rem' }}
                  onClick={handleUseSample}
                >
                  <Sparkles size={14} />
                  Load Sample Govt SHC
                </button>
              </div>
              <textarea
                className="input"
                rows={5}
                placeholder="Paste OCR text from your soil health card or click 'Load Sample Govt SHC' above..."
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
            </div>

            {/* Crop & Area */}
            <div className="grid grid-2">
              <div className="form-group">
                <label className="label">Target Crop</label>
                <select className="select" value={crop} onChange={(e) => setCrop(e.target.value)}>
                  <option value="paddy">Paddy / Rice (धान)</option>
                  <option value="wheat">Wheat (गेहूं)</option>
                  <option value="cotton">Cotton (कपास)</option>
                  <option value="tomato">Tomato (टमाटर)</option>
                  <option value="potato">Potato (आलू)</option>
                  <option value="onion">Onion (प्याज)</option>
                  <option value="maize">Maize (मक्का)</option>
                  <option value="sugarcane">Sugarcane (गन्ना)</option>
                  <option value="chilli">Chilli (मिर्च)</option>
                  <option value="groundnut">Groundnut (मूंगफली)</option>
                  <option value="soybean">Soybean (सोयाबीन)</option>
                  <option value="pulses">Pulses (दालें)</option>
                  <option value="general">General Field Crop</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Farm Area (in Acres)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="500"
                  className="input"
                  value={farmAreaAcre}
                  onChange={(e) => setFarmAreaAcre(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Plot Notes / Field Name (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. North Acre near canal, Red soil block"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Manual Toggler */}
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManual(!showManual)}
                style={{ fontSize: '0.85rem' }}
              >
                {showManual ? 'Hide Manual Parameter Adjustments' : '+ Manually Enter / Override Measurements'}
              </button>
            </div>

            {showManual ? (
              <div className="card-pad stack-xs" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                <div className="tiny strong subtle">Direct Lab Values Override:</div>
                <div className="grid grid-3">
                  <div>
                    <label className="tiny">N (kg/ha)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 210"
                      value={manualValues.nitrogen}
                      onChange={(e) => setManualValues({ ...manualValues, nitrogen: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="tiny">P (kg/ha)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 14"
                      value={manualValues.phosphorus}
                      onChange={(e) => setManualValues({ ...manualValues, phosphorus: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="tiny">K (kg/ha)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 280"
                      value={manualValues.potassium}
                      onChange={(e) => setManualValues({ ...manualValues, potassium: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="tiny">Soil pH</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      placeholder="e.g. 7.2"
                      value={manualValues.ph}
                      onChange={(e) => setManualValues({ ...manualValues, ph: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="tiny">EC (dS/m)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      placeholder="e.g. 0.4"
                      value={manualValues.ec}
                      onChange={(e) => setManualValues({ ...manualValues, ec: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="tiny">OC (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      className="input"
                      placeholder="e.g. 0.5"
                      value={manualValues.organicCarbon}
                      onChange={(e) => setManualValues({ ...manualValues, organicCarbon: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Analyzing Soil & Computing Bags...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Calculate Fertilizer Dose & Health Report
                </>
              )}
            </button>
          </form>
        </div>

        {/* Informational Guidance */}
        <div className="stack">
          <div className="card card-pad stack">
            <div className="row-center gap-xs">
              <Layers size={20} style={{ color: 'var(--green-700)' }} />
              <h2>How Soil Health Card Analysis Works</h2>
            </div>
            <ul className="list-styled tiny subtle stack-xs" style={{ paddingLeft: 18 }}>
              <li>
                <strong>ICAR Standards:</strong> Parameters are rated strictly against Govt of India Soil Health Card scheme benchmarks.
              </li>
              <li>
                <strong>Missing Value Policy (SRS 5.3):</strong> If a metric is unreadable or absent from your card, the system flags it as missing rather than inventing false numbers.
              </li>
              <li>
                <strong>Bags per Acre:</strong> Converts pure N-P-K nutrient recommendations directly into standard commercial Indian fertilizer bags (45 kg Urea, 50 kg DAP, 50 kg MOP).
              </li>
              <li>
                <strong>Soil Amendment:</strong> Automatically calculates Agricultural Lime for acidic soils and Gypsum for alkaline/sodic soils.
              </li>
            </ul>
          </div>

          {result ? (
            <div className="card card-pad stack" style={{ border: '2px solid var(--green-600)' }}>
              <div className="row-center between">
                <div className="row-center gap-xs">
                  <CheckCircle2 size={22} style={{ color: 'var(--green-600)' }} />
                  <h2>Analysis Result: {result.sampleId}</h2>
                </div>
                <span className="badge badge-good" style={{ textTransform: 'uppercase' }}>
                  {result.overallHealth} Soil Health
                </span>
              </div>

              <div className="tiny subtle">
                Target Crop: <strong>{result.crop?.toUpperCase()}</strong> | Farm Area: <strong>{result.farmAreaAcre} Acre(s)</strong>
              </div>

              {/* Fertilizer Bags Highlight */}
              <div style={{ background: 'var(--green-50)', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--green-200)' }}>
                <div className="strong" style={{ color: 'var(--green-900)', marginBottom: 8 }}>
                  🌾 Fertilizer Requirement for {result.farmAreaAcre} Acre(s):
                </div>
                <div className="grid grid-3" style={{ textAlign: 'center' }}>
                  <div className="card-pad" style={{ background: '#fff', borderRadius: 8 }}>
                    <div className="tiny subtle">Neem Coated Urea</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-800)' }}>
                      {result.fertilizerPlan?.ureaBags}
                    </div>
                    <div className="tiny subtle">Bags (45 kg)</div>
                  </div>
                  <div className="card-pad" style={{ background: '#fff', borderRadius: 8 }}>
                    <div className="tiny subtle">DAP (18:46:0)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-800)' }}>
                      {result.fertilizerPlan?.dapBags}
                    </div>
                    <div className="tiny subtle">Bags (50 kg)</div>
                  </div>
                  <div className="card-pad" style={{ background: '#fff', borderRadius: 8 }}>
                    <div className="tiny subtle">MOP Potash (60%)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-800)' }}>
                      {result.fertilizerPlan?.mopBags}
                    </div>
                    <div className="tiny subtle">Bags (50 kg)</div>
                  </div>
                </div>

                {result.fertilizerPlan?.limeKg > 0 ? (
                  <div className="tiny alert" style={{ marginTop: 8 }}>
                    🚨 Lime needed: Apply <strong>{result.fertilizerPlan.limeKg} kg</strong> Agricultural Lime to neutralize soil acidity.
                  </div>
                ) : null}
                {result.fertilizerPlan?.gypsumKg > 0 ? (
                  <div className="tiny alert" style={{ marginTop: 8 }}>
                    🚨 Gypsum needed: Apply <strong>{result.fertilizerPlan.gypsumKg} kg</strong> Gypsum to remediate sodic alkalinity.
                  </div>
                ) : null}
                {result.fertilizerPlan?.fymTonnes > 0 ? (
                  <div className="tiny subtle" style={{ marginTop: 8 }}>
                    🍂 Organic matter: Incorporate ~<strong>{result.fertilizerPlan.fymTonnes} tonnes</strong> of Farm Yard Manure (FYM).
                  </div>
                ) : null}
              </div>

              {/* Extracted Parameters Table */}
              <div>
                <h3 style={{ marginBottom: 6 }}>Extracted Soil Indicators</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Measured</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.parameters || {}).map(([k, p]) => (
                        <tr key={k}>
                          <td style={{ textTransform: 'capitalize' }}>{k}</td>
                          <td>
                            {p.unreadable ? (
                              <span className="subtle italic">Unreadable / Missing</span>
                            ) : (
                              <strong>
                                {p.value} {p.unit}
                              </strong>
                            )}
                          </td>
                          <td>{getRatingBadge(p.rating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Missing Fields Note */}
              {result.unreadableFields?.length > 0 ? (
                <div className="card-pad row-center gap-xs" style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <HelpCircle size={18} style={{ color: 'var(--warn)' }} />
                  <div className="tiny">
                    <strong>Missing on card:</strong> {result.unreadableFields.join(', ')}. (SRS 5.3: Values are flagged and never invented).
                  </div>
                </div>
              ) : null}

              {/* Split Application Schedule */}
              {result.fertilizerPlan?.schedule?.length > 0 ? (
                <div className="stack-xs">
                  <h3>Application Timing Schedule</h3>
                  <div className="stack-xs">
                    {result.fertilizerPlan.schedule.map((stg, i) => (
                      <div key={i} className="card-pad stack-xs" style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                        <div className="row-center between">
                          <strong>{stg.stage}</strong>
                          <span className="tiny subtle">{stg.timing}</span>
                        </div>
                        <div className="tiny">
                          Dose: <strong>{stg.ureaBags} Urea</strong> | <strong>{stg.dapBags} DAP</strong> | <strong>{stg.mopBags} MOP</strong> bags.
                        </div>
                        <div className="tiny subtle">{stg.notes}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Agronomic Recommendations */}
              {result.recommendations?.length > 0 ? (
                <div className="stack-xs">
                  <h3>Agronomic Action Items</h3>
                  <ul className="list-styled tiny stack-xs" style={{ paddingLeft: 16 }}>
                    {result.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* History */}
      <div className="card card-pad stack">
        <div className="row-center gap-xs">
          <History size={18} style={{ color: 'var(--green-700)' }} />
          <h2>Recent Soil Health Cards</h2>
        </div>

        {loadingHistory ? (
          <div className="subtle tiny">Loading history...</div>
        ) : history.length === 0 ? (
          <EmptyState title="No soil tests saved yet">Upload your first soil card above to track your soil fertility over time.</EmptyState>
        ) : (
          <div className="grid grid-3">
            {history.map((item) => (
              <div key={item.id} className="card-pad stack-xs" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                <div className="row-center between">
                  <strong>{item.sampleId}</strong>
                  <span className="badge badge-good">{item.overallHealth}</span>
                </div>
                <div className="tiny subtle">
                  Crop: {item.crop?.toUpperCase()} | Area: {item.farmAreaAcre} ac
                </div>
                <div className="tiny">
                  Urea: {item.fertilizerPlan?.ureaBags} bags | DAP: {item.fertilizerPlan?.dapBags} bags
                </div>
                <div className="tiny subtle">{new Date(item.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
