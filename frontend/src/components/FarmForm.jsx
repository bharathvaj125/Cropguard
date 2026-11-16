import { MapPin, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api.js';
import { IRRIGATION_TYPES, SOIL_TYPES, capitalise } from '../lib/format.js';
import { Alert, Button, SelectField, TextAreaField, TextField } from './ui.jsx';

const EMPTY = {
  name: '',
  location: { name: '', state: '', district: '', latitude: undefined, longitude: undefined },
  areaAcres: '',
  soilType: 'other',
  irrigationType: 'other',
  crops: [],
  notes: '',
};

/**
 * Create or edit a farm. `onSubmit(values)` does the saving so the same form serves
 * the farmer's own farms and the admin panel.
 */
export default function FarmForm({ farm, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => (farm ? { ...EMPTY, ...farm, location: { ...EMPTY.location, ...farm.location } } : EMPTY));
  const [crop, setCrop] = useState('');
  const [place, setPlace] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hasPin = form.location.latitude != null && form.location.longitude != null;

  function addCrop() {
    const value = crop.trim();
    if (value && !form.crops.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setForm({ ...form, crops: [...form.crops, capitalise(value)] });
    }
    setCrop('');
  }

  async function searchPlace() {
    if (place.trim().length < 2) return;
    setSearching(true);
    setError('');
    try {
      setResults((await api.get('/weather/geocode', { q: place.trim() })).results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError('Give the farm a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        name: form.name.trim(),
        location: form.location,
        areaAcres: Number(form.areaAcres) || 0,
        soilType: form.soilType,
        irrigationType: form.irrigationType,
        crops: form.crops,
        notes: form.notes,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error ? <Alert tone="bad">{error}</Alert> : null}

      <div className="form-grid">
        <TextField label="Farm name" placeholder="e.g. Home field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField
          label="Area (acres)"
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={form.areaAcres}
          onChange={(e) => setForm({ ...form, areaAcres: e.target.value })}
        />

        <div className="field full">
          <span className="label">Location</span>
          {hasPin ? (
            <div className="row between" style={{ padding: '9px 12px', border: '1px solid var(--line-strong)', borderRadius: 10 }}>
              <span className="row" style={{ gap: 8 }}>
                <MapPin size={16} /> {form.location.name}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, location: EMPTY.location })}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="row">
                <input
                  className="input"
                  placeholder="Search a village, town or district"
                  aria-label="Search for the farm's location"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchPlace();
                    }
                  }}
                />
                <Button variant="secondary" icon={Search} busy={searching} onClick={searchPlace}>
                  Find
                </Button>
              </div>
              {results ? (
                results.length ? (
                  <div className="suggest">
                    {results.map((r) => (
                      <button
                        key={`${r.latitude},${r.longitude}`}
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            location: { name: r.name, state: r.state, district: r.district, latitude: r.latitude, longitude: r.longitude },
                          });
                          setResults(null);
                          setPlace('');
                        }}
                      >
                        <MapPin size={15} /> {r.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="hint">No places found. Try a nearby town or the district name.</span>
                )
              ) : (
                <span className="hint">Needed for the weather forecast and regional advisories.</span>
              )}
            </>
          )}
        </div>

        <SelectField label="Soil type" value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })}>
          {SOIL_TYPES.map((s) => (
            <option key={s} value={s}>{capitalise(s)}</option>
          ))}
        </SelectField>
        <SelectField label="Irrigation" value={form.irrigationType} onChange={(e) => setForm({ ...form, irrigationType: e.target.value })}>
          {IRRIGATION_TYPES.map((s) => (
            <option key={s} value={s}>{capitalise(s)}</option>
          ))}
        </SelectField>

        <div className="field full">
          <span className="label">Crops grown</span>
          <div className="row">
            <input
              className="input"
              placeholder="e.g. Tomato"
              aria-label="Add a crop"
              maxLength={40}
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCrop();
                }
              }}
            />
            <Button variant="secondary" icon={Plus} onClick={addCrop}>
              Add
            </Button>
          </div>
          {form.crops.length ? (
            <div className="chips">
              {form.crops.map((c) => (
                <span className="chip" key={c}>
                  {c}
                  <button type="button" aria-label={`Remove ${c}`} onClick={() => setForm({ ...form, crops: form.crops.filter((x) => x !== c) })}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="hint">Market prices on your dashboard follow the crops listed here.</span>
          )}
        </div>

        <TextAreaField className="full" label="Notes" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          {farm ? 'Save changes' : 'Add farm'}
        </Button>
      </div>
    </form>
  );
}
