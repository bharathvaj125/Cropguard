import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CloudSun,
  Droplets,
  HeartPulse,
  History,
  Info,
  Megaphone,
  Minus,
  ScanLine,
  Sprout,
  TrendingUp,
  Wind,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip, Legend } from '../components/charts.jsx';
import { SERIES, axisProps, gridProps } from '../lib/chartTheme.js';
import { Alert, Badge, Card, EmptyState, ErrorAlert, Loading, PageHeader, Sparkline, StatCard } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { ACTIVITY_TYPES, formatRupees, formatShortDate, relativeDay, signed } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';
import { AnalysisRow } from './History.jsx';
import { WeatherIcon } from './Weather.jsx';

const ADVISORY_TONE = { info: 'info', warning: 'warn', critical: 'bad' };

export function Delta({ value }) {
  if (value == null) return null;
  const dir = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'flat';
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`delta ${dir}`}>
      <Icon size={15} />
      {signed(value)}
    </span>
  );
}

function WeeklyChart({ weekly }) {
  const rows = weekly.map((w) => ({ week: w.week, Healthy: w.scans - w.issues, Problems: w.issues }));
  return (
    <div className="stack-sm">
      <Legend items={[{ label: 'No problem found', color: SERIES[0] }, { label: 'Disease or pest found', color: SERIES[1] }]} />
      <div className="chart short">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="28%" margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="week" tickFormatter={formatShortDate} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgb(23 35 28 / 5%)' }} content={<ChartTip labelFormat={(v) => `Week of ${formatShortDate(v)}`} />} />
            <Bar dataKey="Healthy" name="No problem found" stackId="a" fill={SERIES[0]} stroke="var(--surface)" strokeWidth={2} maxBarSize={34} />
            <Bar dataKey="Problems" name="Disease or pest found" stackId="a" fill={SERIES[1]} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeatherCard({ weather, hasLocatedFarm }) {
  if (!weather) {
    return (
      <Card title="Weather" icon={CloudSun}>
        <EmptyState icon={CloudSun} title="No farm location yet" action={<Link className="btn btn-secondary" to="/app/farms">{hasLocatedFarm ? 'View farms' : 'Add a farm'}</Link>}>
          Add a farm with a location to see its forecast and farming advice here.
        </EmptyState>
      </Card>
    );
  }
  if (weather.unavailable) {
    return (
      <Card title="Weather" icon={CloudSun}>
        <Alert tone="warn">The weather service is not reachable right now. Try again in a few minutes.</Alert>
      </Card>
    );
  }
  const { current, today, insights, place } = weather;
  return (
    <Card title="Weather" icon={CloudSun} action={<Link className="small" to="/app/weather">Full forecast</Link>}>
      <div className="stack">
        <div className="row" style={{ gap: 14 }}>
          <WeatherIcon icon={current.icon} size={40} />
          <div>
            <div className="stat-value">{Math.round(current.temperature)}°C</div>
            <div className="small muted">{current.label} · {place}</div>
          </div>
        </div>
        <div className="row-wrap small muted">
          <span className="row" style={{ gap: 6 }}><Droplets size={15} /> {today.rainMm.toFixed(1)} mm rain today</span>
          <span className="row" style={{ gap: 6 }}><Wind size={15} /> {Math.round(current.wind)} km/h</span>
        </div>
        {insights.slice(0, 2).map((i) => (
          <div className={`insight ${i.level}`} key={i.title}>
            <div className="insight-icon">{i.level === 'good' ? <Sprout size={18} /> : i.level === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}</div>
            <div>
              <div className="strong">{i.title}</div>
              <p>{i.message}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');

  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const { stats, weekly, recentAnalyses, upcomingActivities, advisories, weather, market, hasLocatedFarm } = data;
  const firstName = user.name.split(' ')[0];
  const isNew = stats.totalScans === 0 && stats.farms === 0;

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} subtitle="Here is how your crops, weather and markets look today.">
        <Link className="btn" to="/app/scan">
          <ScanLine size={17} /> Scan a crop
        </Link>
      </PageHeader>

      <div className="stack">
        {advisories.map((a) => (
          <Alert key={a.id} tone={ADVISORY_TONE[a.severity]} title={<span className="row" style={{ gap: 6 }}><Megaphone size={15} /> {a.title}</span>}>
            {a.message}
          </Alert>
        ))}

        {isNew ? (
          <Card>
            <EmptyState
              icon={Sprout}
              title="Welcome to CropGuard"
              action={
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  <Link className="btn" to="/app/farms">Add your first farm</Link>
                  <Link className="btn btn-secondary" to="/app/scan">Scan a crop</Link>
                </div>
              }
            >
              Add a farm to get weather advice for its location, then scan a leaf to check it for disease and pests.
            </EmptyState>
          </Card>
        ) : null}

        <div className="grid grid-4">
          <StatCard icon={ScanLine} label="Scans in the last 30 days" value={stats.scans30} hint={`${stats.totalScans} in total`} />
          <StatCard icon={AlertTriangle} tone={stats.issues30 ? 'bad' : undefined} label="Problems found (30 days)" value={stats.issues30} />
          <StatCard
            icon={HeartPulse}
            tone="info"
            label="Healthy scans (30 days)"
            value={stats.healthRate30 == null ? '–' : `${stats.healthRate30}%`}
            hint={stats.healthRate30 == null ? 'No scans yet' : `${stats.healthy30} of ${stats.scans30}`}
          />
          <StatCard
            icon={CalendarCheck}
            tone={stats.overdueActivities ? 'warn' : undefined}
            label="Planned activities"
            value={stats.plannedActivities}
            hint={stats.overdueActivities ? `${stats.overdueActivities} overdue` : `${stats.doneThisMonth} done this month`}
          />
        </div>

        <div className="grid grid-main">
          <div className="stack">
            <Card title="Recent scans" icon={History} pad={false} action={<Link className="small" to="/app/history">View all</Link>}>
              {recentAnalyses.length ? (
                <ul className="list">
                  {recentAnalyses.map((a) => (
                    <AnalysisRow key={a.id} analysis={a} to={`/app/history/${a.id}`} />
                  ))}
                </ul>
              ) : (
                <EmptyState icon={ScanLine} title="No scans yet" action={<Link className="btn" to="/app/scan">Scan a crop</Link>}>
                  Your latest analysis reports will appear here.
                </EmptyState>
              )}
            </Card>

            <Card title="Crop health over the last 8 weeks" icon={HeartPulse}>
              {weekly.length ? <WeeklyChart weekly={weekly} /> : <p className="muted">Scan results will be charted here once you have some.</p>}
            </Card>

            <Card title="Market prices" icon={TrendingUp} pad={false} action={<Link className="small" to="/app/market">All markets</Link>}>
              {market.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Commodity</th>
                        <th className="right">Price / quintal</th>
                        <th className="right">7 days</th>
                        <th className="hide-sm">Last 2 weeks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.map((m) => (
                        <tr key={m.commodity}>
                          <td>
                            <Link to={`/app/market?commodity=${encodeURIComponent(m.commodity)}`} className="strong" style={{ color: 'var(--ink)' }}>
                              {m.commodity}
                            </Link>
                          </td>
                          <td className="right num strong">{formatRupees(m.latest)}</td>
                          <td className="right"><Delta value={m.change7dPct} /></td>
                          <td className="hide-sm"><Sparkline values={m.sparkline} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card-pad muted">Market data is not available right now.</div>
              )}
              {market.some((m) => m.sample) ? (
                <div className="card-pad tiny faint" style={{ paddingTop: 10, paddingBottom: 12 }}>
                  Sample prices for demonstration, averaged across markets. Not live mandi rates.
                </div>
              ) : null}
            </Card>
          </div>

          <div className="stack">
            <WeatherCard weather={weather} hasLocatedFarm={hasLocatedFarm} />

            <Card title="Coming up" icon={CalendarCheck} pad={false} action={<Link className="small" to="/app/activities">All activities</Link>}>
              {upcomingActivities.length ? (
                <ul className="list">
                  {upcomingActivities.map((a) => (
                    <li key={a.id}>
                      <div className="grow">
                        <div className="strong truncate">{a.title}</div>
                        <div className="small muted truncate">
                          {ACTIVITY_TYPES[a.type]}
                          {a.farm?.name ? ` · ${a.farm.name}` : ''}
                        </div>
                      </div>
                      <Badge tone="info">{relativeDay(a.date)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CalendarCheck} title="Nothing planned" action={<Link className="btn btn-secondary" to="/app/activities">Plan an activity <ArrowRight size={16} /></Link>}>
                  Log sowing, irrigation, spraying and harvest to keep a record of each field.
                </EmptyState>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
