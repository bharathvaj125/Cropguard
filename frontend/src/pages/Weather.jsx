import {
  AlertTriangle,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Info,
  MapPin,
  Search,
  Sprout,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip, Legend } from '../components/charts.jsx';
import { SERIES, axisProps, gridProps } from '../lib/chartTheme.js';
import { Alert, Button, Card, EmptyState, ErrorAlert, Loading, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatShortDate, formatWeekday } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

const ICONS = { clear: Sun, cloudy: Cloud, fog: CloudFog, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };

export function WeatherIcon({ icon, size = 22 }) {
  const Icon = ICONS[icon] || CloudSun;
  return <Icon size={size} />;
}

const INSIGHT_ICON = { good: Sprout, info: Info, warning: AlertTriangle, danger: AlertTriangle };

export function InsightList({ insights }) {
  return (
    <div className="stack-sm">
      {insights.map((i) => {
        const Icon = INSIGHT_ICON[i.level];
        return (
          <div className={`insight ${i.level}`} key={i.title}>
            <div className="insight-icon">
              <Icon size={18} />
            </div>
            <div>
              <div className="strong">{i.title}</div>
              <p>{i.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Search any place by name (Open-Meteo geocoding through our API). */
function PlaceSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search(e) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      setResults((await api.get('/weather/geocode', { q: q.trim() })).results);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-sm">
      <form className="row" onSubmit={search}>
        <div className="search grow">
          <Search size={16} />
          <input className="input" style={{ width: '100%' }} placeholder="Search a village, town or district" aria-label="Search a place" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" busy={busy}>
          Search
        </Button>
      </form>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {results ? (
        results.length ? (
          <div className="suggest">
            {results.map((r) => (
              <button
                key={`${r.latitude},${r.longitude}`}
                type="button"
                onClick={() => {
                  onPick(r);
                  setResults(null);
                  setQ('');
                }}
              >
                <MapPin size={15} /> {r.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">No places found. Try a nearby town or the district name.</p>
        )
      ) : null}
    </div>
  );
}

function Forecast({ query, place }) {
  const { data, loading, error, reload } = useApi('/weather/forecast', query);
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const { current, daily, insights } = data;
  const rows = daily.map((d) => ({ ...d, range: [d.tempMin, d.tempMax] }));
  const totalRain = daily.reduce((s, d) => s + d.rainMm, 0);

  return (
    <div className="stack">
      <div className="wx-now">
        <WeatherIcon icon={current.icon} size={54} />
        <div>
          <div className="wx-temp">{Math.round(current.temperature)}°C</div>
          <div style={{ marginTop: 6 }}>
            {current.label} · feels like {Math.round(current.feelsLike)}°C
          </div>
          <div className="small" style={{ opacity: 0.85 }}>
            <MapPin size={13} style={{ verticalAlign: '-2px' }} /> {data.place || place}
          </div>
        </div>
        <div className="wx-meta">
          <span><Droplets size={16} /> Humidity {current.humidity}%</span>
          <span><Wind size={16} /> Wind {Math.round(current.wind)} km/h</span>
          <span><CloudRain size={16} /> {totalRain.toFixed(0)} mm rain this week</span>
        </div>
      </div>

      <div className="grid grid-main">
        <div className="stack">
          <Card title="7-day forecast" icon={CloudSun}>
            <div className="wx-days">
              {daily.map((d, i) => (
                <div className="card wx-day" key={d.date}>
                  <div className="strong small">{i === 0 ? 'Today' : formatWeekday(d.date)}</div>
                  <div className="tiny faint">{formatShortDate(d.date)}</div>
                  <WeatherIcon icon={d.icon} size={26} />
                  <div className="tiny muted">{d.label}</div>
                  <div className="num">
                    <b>{Math.round(d.tempMax)}°</b> <span className="faint">{Math.round(d.tempMin)}°</span>
                  </div>
                  <div className="tiny muted num">
                    {d.rainMm.toFixed(1)} mm{d.rainChance != null ? ` · ${d.rainChance}%` : ''}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-2">
            <Card title="Temperature (°C)" icon={Thermometer}>
              <div className="stack-sm">
                <Legend items={[{ label: 'Daily high', color: SERIES[1], line: true }, { label: 'Daily low', color: SERIES[0], line: true }]} />
                <div className="chart short">
                  <ResponsiveContainer>
                    <LineChart data={rows} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="date" tickFormatter={formatWeekday} {...axisProps} />
                      <YAxis domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => Math.round(v)} {...axisProps} axisLine={false} />
                      <Tooltip content={<ChartTip labelFormat={formatShortDate} format={(v) => `${Math.round(v)}°C`} />} />
                      <Line type="monotone" dataKey="tempMax" name="High" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: SERIES[1] }} />
                      <Line type="monotone" dataKey="tempMin" name="Low" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: SERIES[0] }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <Card title="Rainfall (mm per day)" icon={CloudRain}>
              <p className="small muted" style={{ minHeight: 18 }}>
                {totalRain < 0.1 ? 'No rain is forecast for the next 7 days.' : `${totalRain.toFixed(1)} mm expected over 7 days.`}
              </p>
              <div className="chart short" style={{ marginTop: 8 }}>
                <ResponsiveContainer>
                  <BarChart data={rows} barCategoryGap="30%" margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="date" tickFormatter={formatWeekday} {...axisProps} />
                    <YAxis {...axisProps} axisLine={false} domain={[0, (max) => Math.max(5, Math.ceil(max))]} />
                    <Tooltip cursor={{ fill: 'rgb(23 35 28 / 5%)' }} content={<ChartTip labelFormat={formatShortDate} format={(v) => `${Number(v).toFixed(1)} mm`} />} />
                    <Bar dataKey="rainMm" name="Rain" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <Card title="Advice for this week" icon={Sprout}>
          <div className="stack">
            <InsightList insights={insights} />
            <p className="tiny faint">
              Advice is generated from the forecast with simple rules of thumb. Forecast by Open-Meteo. Local conditions can
              differ, so check your own field before acting.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Weather() {
  const farms = useApi('/farms');
  const located = (farms.data?.farms || []).filter((f) => f.location?.latitude != null && f.location?.longitude != null);
  const [target, setTarget] = useState(null); // { farmId } or { lat, lon, name }

  // Default to the first farm that has a location.
  useEffect(() => {
    if (!target && located.length) setTarget({ farmId: located[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms.data]);

  if (farms.error) return <ErrorAlert error={farms.error} onRetry={farms.reload} />;
  if (farms.loading && !farms.data) return <Loading />;

  const query = target?.farmId ? { farmId: target.farmId } : target ? { lat: target.lat, lon: target.lon } : null;

  return (
    <>
      <PageHeader title="Weather" subtitle="Forecast and farming advice for your farms, or any place you search.">
        {located.length ? (
          <select
            className="select"
            style={{ width: 'auto', minWidth: 180 }}
            aria-label="Choose a farm"
            value={target?.farmId || ''}
            onChange={(e) => e.target.value && setTarget({ farmId: e.target.value })}
          >
            {!target?.farmId ? <option value="">Searched place</option> : null}
            {located.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        ) : null}
      </PageHeader>

      <div className="stack">
        <Card>
          <PlaceSearch onPick={(r) => setTarget({ lat: r.latitude, lon: r.longitude, name: r.name })} />
        </Card>

        {query ? (
          <Forecast query={query} place={target.name} />
        ) : (
          <Card>
            <EmptyState icon={CloudSun} title="Choose a location" action={<Link className="btn" to="/app/farms">Add a farm</Link>}>
              Search for a place above, or add a farm with a location to see its forecast every time you open this page.
            </EmptyState>
          </Card>
        )}
      </div>
    </>
  );
}
