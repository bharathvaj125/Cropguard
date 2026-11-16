import {
  AlertCircle,
  BadgeCheck,
  History,
  Info,
  Loader2,
  Scale,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, EmptyState } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function ProduceGrader() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [commodity, setCommodity] = useState('Tomato');
  const [market, setMarket] = useState('Kolar');
  const [variety, setVariety] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [advice, setAdvice] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/produce');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload or capture a photo of the produce lot to evaluate.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('image', file);
      formData.append('commodity', commodity);
      formData.append('market', market);
      formData.append('variety', variety);
      formData.append('notes', notes);

      const res = await api.post('/produce/grade', formData);
      setResult(res.produce);
      setAdvice(res.advice);
      loadHistory();
      window.scrollTo({ top: 380, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to grade produce lot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <div className="row-center gap-xs" style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: '0.9rem' }}>
            <BadgeCheck size={18} />
            AGMARK Standard Produce Quality Grading & Pricing
          </div>
          <h1 style={{ marginTop: 4 }}>Crop Quality Grader & Mandi Price Estimator</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Photograph harvested crops, fruits, or vegetables. Our computer vision engine assesses surface uniformity, color maturity, and defects to classify Grade A, B, or C, and correlates with live APMC Mandi price trends.
          </p>
        </div>
      </div>

      {error ? <Alert tone="bad" title="Error">{error}</Alert> : null}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Upload Form */}
        <div className="card card-pad stack">
          <div className="card-head" style={{ padding: 0 }}>
            <h2>Photograph Harvest Lot</h2>
          </div>

          <form onSubmit={handleSubmit} className="stack">
            <div className="form-group">
              <label className="label">Produce Photo (Heap or Crates)</label>
              <div
                style={{
                  border: '2px dashed var(--line-strong)',
                  borderRadius: 'var(--radius)',
                  padding: 24,
                  textAlign: 'center',
                  background: preview ? 'var(--surface)' : 'var(--surface-2)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('produce-input').click()}
              >
                {preview ? (
                  <div className="stack-xs align-center">
                    <img
                      src={preview}
                      alt="Produce Preview"
                      style={{ maxHeight: 200, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                    />
                    <div className="tiny subtle">Click to choose a different photo</div>
                  </div>
                ) : (
                  <div className="stack-xs align-center">
                    <Upload size={32} style={{ color: 'var(--green-600)', margin: '0 auto' }} />
                    <div className="strong">Upload or Take Photo of Produce</div>
                    <div className="tiny subtle">JPG, PNG, WebP — Good lighting gives highest grading accuracy</div>
                  </div>
                )}
                <input id="produce-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="label">Commodity</label>
                <select className="select" value={commodity} onChange={(e) => setCommodity(e.target.value)}>
                  <option value="Tomato">Tomato (टमाटर)</option>
                  <option value="Potato">Potato (आलू)</option>
                  <option value="Onion">Onion (प्याज)</option>
                  <option value="Green Chilli">Green Chilli (हरी मिर्च)</option>
                  <option value="Apple">Apple (सेब)</option>
                  <option value="Grapes">Grapes (अंगूर)</option>
                  <option value="Orange">Orange (संतरा)</option>
                  <option value="Paddy">Paddy / Rice (धान)</option>
                  <option value="Wheat">Wheat (गेहूं)</option>
                  <option value="Maize">Maize (मक्का)</option>
                  <option value="Soybean">Soybean (सोयाबीन)</option>
                  <option value="Cotton">Cotton (कपास)</option>
                  <option value="Groundnut">Groundnut (मूंगफली)</option>
                  <option value="Bengal Gram">Bengal Gram / Chana (चना)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Target APMC Mandi</label>
                <select className="select" value={market} onChange={(e) => setMarket(e.target.value)}>
                  <option value="Kolar">Kolar (Karnataka)</option>
                  <option value="Azadpur">Azadpur (Delhi)</option>
                  <option value="Lasalgaon">Lasalgaon (Maharashtra)</option>
                  <option value="Pune">Pune (Maharashtra)</option>
                  <option value="Koyambedu">Koyambedu (Tamil Nadu)</option>
                  <option value="Bowenpally">Bowenpally (Telangana)</option>
                  <option value="Indore">Indore (Madhya Pradesh)</option>
                  <option value="Ahmedabad">Ahmedabad (Gujarat)</option>
                  <option value="Kolkata">Kolkata (West Bengal)</option>
                  <option value="Lucknow">Lucknow (Uttar Pradesh)</option>
                  <option value="Khanna">Khanna (Punjab)</option>
                  <option value="Jaipur">Jaipur (Rajasthan)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="label">Variety / Hybrid (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Vaishnavi, Pusa, Desi..."
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label">Notes / Lot Size</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 20 crates, 50 quintals"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Grading Produce & Fetching Mandi Quotes...
                </>
              ) : (
                <>
                  <Scale size={18} />
                  Evaluate Quality Grade & Price Band
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results & Guidelines */}
        <div className="stack">
          {result ? (
            <div className="card card-pad stack" style={{ border: '2px solid var(--green-600)' }}>
              <div className="row-center between">
                <div>
                  <span className="badge badge-good" style={{ fontSize: '1rem', padding: '4px 10px' }}>
                    {result.grade}
                  </span>
                  <div className="tiny subtle" style={{ marginTop: 4 }}>
                    {result.gradeLabel} (Confidence: {Math.round(result.confidence * 100)}%)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green-700)' }}>
                    {result.qualityScore} / 100
                  </div>
                  <div className="tiny subtle">Quality Score</div>
                </div>
              </div>

              {/* Mandi Price Range Card */}
              <div style={{ background: 'var(--green-50)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--green-200)' }}>
                <div className="row-center between" style={{ marginBottom: 6 }}>
                  <div className="strong" style={{ color: 'var(--green-900)' }}>
                    💰 Estimated Mandi Price Range ({result.priceEstimate?.market} Mandi):
                  </div>
                  <span className="tiny subtle">
                    {new Date(result.priceEstimate?.marketDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-2" style={{ textAlign: 'center', marginTop: 10 }}>
                  <div className="card-pad" style={{ background: '#fff', borderRadius: 8 }}>
                    <div className="tiny subtle">Price per Kilogram</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--green-800)' }}>
                      ₹{result.priceEstimate?.estimatedMinPerKg} – ₹{result.priceEstimate?.estimatedMaxPerKg}
                    </div>
                    <div className="tiny subtle">₹ / kg</div>
                  </div>

                  <div className="card-pad" style={{ background: '#fff', borderRadius: 8 }}>
                    <div className="tiny subtle">Wholesale Lot (1 Quintal = 100 kg)</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--green-800)' }}>
                      ₹{result.priceEstimate?.estimatedMinPerQuintal} – ₹{result.priceEstimate?.estimatedMaxPerQuintal}
                    </div>
                    <div className="tiny subtle">₹ / quintal</div>
                  </div>
                </div>

                <div className="tiny subtle" style={{ marginTop: 8 }}>
                  Base Market Modal Rate: <strong>₹{result.priceEstimate?.baseModalPricePerQuintal} / quintal</strong> in {result.priceEstimate?.market} ({result.priceEstimate?.state}).
                </div>
              </div>

              {/* Visual Metrics */}
              <div>
                <h3 style={{ marginBottom: 6 }}>Visual Inspection Metrics</h3>
                <div className="grid grid-3" style={{ fontSize: '0.85rem' }}>
                  <div className="card-pad" style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div className="tiny subtle">Uniformity</div>
                    <strong>{result.metrics?.uniformity}%</strong>
                  </div>
                  <div className="card-pad" style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div className="tiny subtle">Surface Cleanliness</div>
                    <strong>{result.metrics?.surfaceCleanliness}%</strong>
                  </div>
                  <div className="card-pad" style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div className="tiny subtle">Defect Area</div>
                    <strong>{result.metrics?.defectAreaPercent}%</strong>
                  </div>
                </div>
              </div>

              {/* Advice */}
              {advice ? (
                <div className="card-pad" style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                  <div className="strong" style={{ marginBottom: 4 }}>Selling & Handling Advice:</div>
                  <p className="tiny">{advice}</p>
                </div>
              ) : null}

              {/* Disclaimer strictly adhering to SRS 5.2 */}
              <div className="card-pad row-center gap-xs" style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-sm)' }}>
                <AlertCircle size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                <div className="tiny">
                  <strong>Notice (SRS 5.2):</strong> {result.disclaimer}
                </div>
              </div>
            </div>
          ) : (
            <div className="card card-pad stack">
              <div className="row-center gap-xs">
                <Info size={20} style={{ color: 'var(--green-700)' }} />
                <h2>AGMARK Quality Grading Tiers</h2>
              </div>
              <div className="stack-xs tiny subtle">
                <div>
                  <strong style={{ color: 'var(--good)' }}>Grade A (Super / Premium):</strong>
                  <p>Uniform size and shape, vibrant color, surface blemishes below 5%. Commands 5-18% premium over mandi modal rates.</p>
                </div>
                <div>
                  <strong style={{ color: 'var(--warn)' }}>Grade B (FAQ - Fair Average Quality):</strong>
                  <p>Standard commercial lot with minor surface markings (5-15% area). Trades at prevailing mandi modal rates.</p>
                </div>
                <div>
                  <strong style={{ color: 'var(--bad)' }}>Grade C (Undergrade / Processing):</strong>
                  <p>Noticeable defects, irregular shape, or overripeness (&gt;15% area). Discounted 15-35%; recommended for local processing / juice / sauce pulp units.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card card-pad stack">
        <div className="row-center gap-xs">
          <History size={18} style={{ color: 'var(--green-700)' }} />
          <h2>Recent Graded Lots</h2>
        </div>

        {loadingHistory ? (
          <div className="subtle tiny">Loading history...</div>
        ) : history.length === 0 ? (
          <EmptyState title="No produce graded yet">Upload a photograph of your harvest above to obtain an AGMARK grade and mandi price band.</EmptyState>
        ) : (
          <div className="grid grid-3">
            {history.map((item) => (
              <div key={item.id} className="card-pad stack-xs" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                <div className="row-center between">
                  <strong>{item.commodity}</strong>
                  <span className="badge badge-good">{item.grade}</span>
                </div>
                <div className="tiny subtle">
                  {item.priceEstimate?.market} Mandi | Score: {item.qualityScore}
                </div>
                <div className="strong" style={{ color: 'var(--green-800)' }}>
                  ₹{item.priceEstimate?.estimatedMinPerKg} – ₹{item.priceEstimate?.estimatedMaxPerKg} / kg
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
