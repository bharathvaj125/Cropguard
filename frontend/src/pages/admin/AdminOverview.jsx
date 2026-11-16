import { Activity, Bug, ClipboardList, Cpu, Database, Microscope, ScanLine, Server, Sprout, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip } from '../../components/charts.jsx';
import { SERIES, axisProps, gridProps } from '../../lib/chartTheme.js';
import { Alert, Badge, Card, ErrorAlert, Loading, PageHeader, StatCard } from '../../components/ui.jsx';
import { OUTCOMES, formatNumber, formatPercent, formatShortDate } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';

function DailyChart({ data, dataKey, name, color }) {
  return (
    <div className="chart short">
      <ResponsiveContainer>
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={28} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgb(23 35 28 / 5%)' }} content={<ChartTip labelFormat={formatShortDate} />} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked horizontal bars: label and count on top, bar underneath. */
function Ranked({ rows, empty }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="stack-sm">
      {rows.map((r) => (
        <div className="hbar" key={r.name}>
          <span className="truncate">{r.name}</span>
          <span className="num strong">{r.count}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModelCard({ model }) {
  const t = model.test || {};
  return (
    <div className="card card-pad stack-sm" style={{ boxShadow: 'none' }}>
      <div className="row between">
        <h3 className="row" style={{ gap: 8 }}>
          {model.name === 'disease' ? <Microscope size={17} /> : <Bug size={17} />}
          {model.name === 'disease' ? 'Disease model' : 'Pest model'}
        </h3>
        <Badge tone="good">Loaded</Badge>
      </div>
      <dl className="kv small">
        <dt>Architecture</dt>
        <dd>{model.architecture}</dd>
        <dt>Dataset</dt>
        <dd>{model.dataset}</dd>
        <dt>Classes</dt>
        <dd className="num">{model.num_classes}</dd>
        <dt>Test accuracy</dt>
        <dd className="num">
          <b>{formatPercent(t.accuracy, 1)}</b> top-1 · {formatPercent(t.top3_accuracy, 1)} top-3 on {formatNumber(t.samples)} held-out images
        </dd>
        <dt>Macro F1</dt>
        <dd className="num">{formatPercent(t.macro_f1, 1)}</dd>
        <dt>Version</dt>
        <dd>{model.version}</dd>
      </dl>
    </div>
  );
}

export default function AdminOverview() {
  const { data, loading, error, reload } = useApi('/admin/stats');
  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const { totals, outcomes, topDiseases, topPests, daily, averages, system } = data;
  const outcomeRows = Object.entries(OUTCOMES)
    .map(([key, o]) => ({ name: o.label, count: outcomes[key] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader title="Admin overview" subtitle="Platform usage, AI results and system status." />

      <div className="stack">
        {!system.ml.online ? (
          <Alert tone="bad" title="The AI service is offline">
            Farmers cannot run scans until the ML service is back. Check that it is running and that ML_SERVICE_URL is correct.
          </Alert>
        ) : null}

        <div className="grid grid-4">
          <StatCard icon={Users} label="Registered users" value={formatNumber(totals.users)} hint={`${totals.newUsers30} new in 30 days · ${totals.activeUsers} active`} />
          <StatCard icon={Sprout} tone="info" label="Farms" value={formatNumber(totals.farms)} hint={`${formatNumber(totals.acres)} acres in total`} />
          <StatCard icon={ScanLine} label="AI analyses" value={formatNumber(totals.analyses)} hint={`${totals.analyses30} in the last 30 days`} />
          <StatCard icon={ClipboardList} tone={totals.pendingReviews ? 'warn' : undefined} label="Reports awaiting review" value={formatNumber(totals.pendingReviews)} hint="Non-healthy results not yet reviewed" />
        </div>

        <div className="grid grid-2">
          <Card title="Analyses per day (last 30 days)" icon={Activity}>
            <DailyChart data={daily} dataKey="scans" name="Analyses" color={SERIES[0]} />
          </Card>
          <Card title="New sign-ups per day (last 30 days)" icon={Users}>
            <DailyChart data={daily} dataKey="signups" name="Sign-ups" color={SERIES[2]} />
          </Card>
        </div>

        <div className="grid grid-3">
          <Card title="Results" icon={ScanLine} action={<Link className="small" to="/app/admin/reports">All reports</Link>}>
            <Ranked rows={outcomeRows} empty="No analyses yet." />
          </Card>
          <Card title="Most detected diseases" icon={Microscope}>
            <Ranked rows={topDiseases} empty="No diseases detected yet." />
          </Card>
          <Card title="Most detected pests" icon={Bug}>
            <Ranked rows={topPests} empty="No pests detected yet." />
          </Card>
        </div>

        <Card title="AI models" icon={Cpu}>
          {system.ml.online && system.ml.models.length ? (
            <div className="stack">
              <div className="grid grid-2">
                {system.ml.models.map((m) => (
                  <ModelCard key={m.name} model={m} />
                ))}
              </div>
              <p className="small muted">
                Accuracy is measured on images from the same datasets the models were trained on. Photos taken in real
                fields are harder, so expect lower accuracy in practice. Results below {formatPercent(system.thresholds.disease)}{' '}
                (disease) or {formatPercent(system.thresholds.pest)} (pest) confidence are reported to farmers as uncertain.
              </p>
            </div>
          ) : (
            <p className="muted">Model details are unavailable while the AI service is offline.</p>
          )}
        </Card>

        <Card title="System" icon={Server}>
          <dl className="kv">
            <dt>AI service</dt>
            <dd><Badge tone={system.ml.online ? 'good' : 'bad'}>{system.ml.online ? 'Online' : 'Offline'}</Badge></dd>
            <dt>Average analysis time</dt>
            <dd className="num">{averages.inferenceMs != null ? `${averages.inferenceMs} ms` : 'No data yet'}</dd>
            <dt>Average confidence</dt>
            <dd className="num">
              {averages.diseaseConfidence != null ? `Disease ${formatPercent(averages.diseaseConfidence)}` : 'Disease: no data'}
              {' · '}
              {averages.pestConfidence != null ? `Pest ${formatPercent(averages.pestConfidence)}` : 'Pest: no data'}
            </dd>
            <dt>Image storage</dt>
            <dd className="row" style={{ gap: 6 }}><Database size={15} /> {system.storage === 's3' ? 'Amazon S3' : 'Local disk'}</dd>
            <dt>Market data</dt>
            <dd>{system.marketSource === 'agmarknet' ? 'Live: Agmarknet via data.gov.in' : 'Sample series (no data.gov.in key configured)'}</dd>
          </dl>
        </Card>
      </div>
    </>
  );
}
