import { Info, Lightbulb, Store, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTip, Legend } from '../components/charts.jsx';
import { SERIES, axisProps, gridProps } from '../lib/chartTheme.js';
import { Alert, Badge, Card, ErrorAlert, Loading, PageHeader, Sparkline, Tabs } from '../components/ui.jsx';
import { formatDate, formatNumber, formatRupees, formatShortDate } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';
import { Delta } from './Dashboard.jsx';

const TREND = {
  rising: { label: 'Rising', tone: 'good', icon: TrendingUp },
  falling: { label: 'Falling', tone: 'bad', icon: TrendingDown },
  stable: { label: 'Stable', tone: 'info', icon: Minus },
};

const ACTION = {
  hold: 'Consider holding',
  sell_now: 'Consider selling now',
  sell_in_batches: 'Sell in batches',
  wait: 'No strong signal',
};

const RANGES = [
  { value: 30, label: '1 month' },
  { value: 90, label: '3 months' },
  { value: 150, label: '5 months' },
];

function PriceChart({ series, outlook }) {
  const rows = useMemo(() => {
    const past = series.map((p) => ({ date: p.date, price: p.modalPrice, range: [p.minPrice, p.maxPrice] }));
    if (!past.length) return [];
    // Start the outlook from the last real price so the two lines join.
    past[past.length - 1].outlook = past[past.length - 1].price;
    const future = outlook.map((o) => ({ date: o.date, outlook: o.expected, outlookRange: [o.low, o.high] }));
    return [...past, ...future];
  }, [series, outlook]);

  return (
    <div className="stack-sm">
      <Legend
        items={[
          { label: 'Modal price', color: SERIES[0], line: true },
          { label: 'Day’s min–max', color: SERIES[0], faint: true },
          { label: '7-day outlook', color: SERIES[1], line: true },
        ]}
      />
      <div className="chart">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={36} {...axisProps} />
            <YAxis
              width={56}
              domain={[(min) => Math.floor((min * 0.96) / 100) * 100, (max) => Math.ceil((max * 1.03) / 100) * 100]}
              tickFormatter={(v) => formatNumber(v)}
              {...axisProps}
              axisLine={false}
            />
            <Tooltip content={<ChartTip labelFormat={formatDate} format={(v) => formatRupees(v)} />} />
            <Area dataKey="range" name="Min–max" stroke="none" fill={SERIES[0]} fillOpacity={0.14} isAnimationActive={false} />
            <Area dataKey="outlookRange" name="Outlook range" stroke="none" fill={SERIES[1]} fillOpacity={0.14} isAnimationActive={false} />
            <Line dataKey="price" name="Modal price" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line dataKey="outlook" name="Outlook" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Market() {
  const [params, setParams] = useSearchParams();
  const commodities = useApi('/market/commodities');
  const overview = useApi('/market/overview');
  const [days, setDays] = useState(90);

  const names = (commodities.data?.commodities || []).map((c) => c.commodity);
  const requested = params.get('commodity');
  const commodity = names.includes(requested) ? requested : names[0] || '';
  const markets = useApi(commodity ? '/market/markets' : null, { commodity });
  const marketNames = (markets.data?.markets || []).map((m) => m.market);
  const market = marketNames.includes(params.get('market')) ? params.get('market') : marketNames[0] || '';

  const detail = useApi(commodity && market ? '/market/series' : null, { commodity, market, days });

  // Keep the URL in step with the selection so the page can be shared or reloaded.
  useEffect(() => {
    if (commodity && market && (params.get('commodity') !== commodity || params.get('market') !== market)) {
      setParams({ commodity, market }, { replace: true });
    }
  }, [commodity, market, params, setParams]);

  if (commodities.error) return <ErrorAlert error={commodities.error} onRetry={commodities.reload} />;
  if (commodities.loading && !commodities.data) return <Loading />;

  const insights = detail.data?.insights;
  const trend = insights ? TREND[insights.trend] : null;

  return (
    <>
      <PageHeader title="Market prices" subtitle="Mandi price trends to help you decide when and where to sell.">
        <select className="select" style={{ width: 'auto', minWidth: 160 }} aria-label="Commodity" value={commodity} onChange={(e) => setParams({ commodity: e.target.value })}>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select className="select" style={{ width: 'auto', minWidth: 160 }} aria-label="Market" value={market} onChange={(e) => setParams({ commodity, market: e.target.value })}>
          {(markets.data?.markets || []).map((m) => (
            <option key={m.market} value={m.market}>
              {m.market}, {m.state}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="stack">
        {detail.data?.sample ? (
          <Alert tone="info" title="Sample data">
            These prices are a generated demonstration series, not live mandi rates. Connect a data.gov.in API key on the
            server to load real Agmarknet prices.
          </Alert>
        ) : null}

        {detail.error ? (
          <ErrorAlert error={detail.error} onRetry={detail.reload} />
        ) : !detail.data ? (
          <Loading />
        ) : (
          <>
            <div className="grid grid-main">
              <Card
                title={`${commodity} at ${market}`}
                icon={TrendingUp}
                action={<Tabs tabs={RANGES} value={days} onChange={setDays} />}
              >
                <div className="stack">
                  <div className="row-wrap" style={{ gap: '8px 28px', alignItems: 'flex-end' }}>
                    <div>
                      <div className="price-big">{formatRupees(insights.latest)}</div>
                      <div className="small muted">per quintal · {formatDate(insights.latestDate)}</div>
                    </div>
                    <div className="small"><div className="faint">1 day</div><Delta value={insights.change1dPct} /></div>
                    <div className="small"><div className="faint">7 days</div><Delta value={insights.change7dPct} /></div>
                    <div className="small"><div className="faint">30 days</div><Delta value={insights.change30dPct} /></div>
                    <Badge tone={trend.tone} icon={trend.icon}>{trend.label}</Badge>
                  </div>
                  <PriceChart series={detail.data.series} outlook={insights.outlook} />
                </div>
              </Card>

              <div className="stack">
                <Card title="What this means for selling" icon={Lightbulb}>
                  <div className="stack">
                    <div>
                      <div className="strong" style={{ fontSize: '1.1rem' }}>{ACTION[insights.action]}</div>
                      <p className="muted" style={{ marginTop: 4 }}>{insights.advice}</p>
                    </div>
                    <dl className="kv">
                      <dt>30-day average</dt>
                      <dd className="num">{formatRupees(insights.average30)}</dd>
                      <dt>30-day range</dt>
                      <dd className="num">{formatRupees(insights.low30)} – {formatRupees(insights.high30)}</dd>
                      <dt>Weekly trend</dt>
                      <dd><Delta value={insights.weeklyTrendPct} /></dd>
                      <dt>Daily swing</dt>
                      <dd className="num">±{insights.volatilityPct}%</dd>
                      <dt>Outlook in 7 days</dt>
                      <dd className="num">
                        {formatRupees(insights.outlook[6].low)} – {formatRupees(insights.outlook[6].high)}
                      </dd>
                    </dl>
                    <p className="tiny faint">
                      <Info size={12} style={{ verticalAlign: '-2px' }} /> The outlook extends the last two weeks&apos; trend.
                      It is an indication, not a guarantee. Prices can change quickly with arrivals and weather.
                    </p>
                  </div>
                </Card>
              </div>
            </div>

            <Card title={`${commodity}: where is the price best?`} icon={Store} pad={false}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>State</th>
                      <th className="right">Price / quintal</th>
                      <th className="right">vs {market}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.markets.map((m, i) => {
                      const diff = m.modalPrice - insights.latest;
                      return (
                        <tr key={m.market}>
                          <td className="strong">
                            {m.market} {i === 0 ? <Badge tone="good">Highest</Badge> : null}
                            {m.market === market ? <Badge>Selected</Badge> : null}
                          </td>
                          <td className="muted">{m.state}</td>
                          <td className="right num strong">{formatRupees(m.modalPrice)}</td>
                          <td className={`right num ${diff > 0 ? 'delta up' : diff < 0 ? 'delta down' : 'faint'}`} style={{ display: 'table-cell' }}>
                            {m.market === market ? '–' : `${diff > 0 ? '+' : '−'}${formatRupees(Math.abs(diff))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="card-pad tiny faint" style={{ paddingTop: 10, paddingBottom: 12 }}>
                A higher price elsewhere only helps if it covers transport and handling. Compare the difference with your cost per quintal.
              </div>
            </Card>
          </>
        )}

        <Card title="All commodities" icon={TrendingUp} pad={false}>
          {overview.data ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th className="right">Average price / quintal</th>
                    <th className="right">7 days</th>
                    <th>Last 2 weeks</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.rows.map((r) => (
                    <tr key={r.commodity}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm strong"
                          style={{ paddingLeft: 0, color: 'var(--green-700)' }}
                          onClick={() => {
                            setParams({ commodity: r.commodity });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {r.commodity}
                        </button>
                      </td>
                      <td className="right num strong">{formatRupees(r.latest)}</td>
                      <td className="right"><Delta value={r.change7dPct} /></td>
                      <td><Sparkline values={r.sparkline} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : overview.error ? (
            <div className="card-pad"><ErrorAlert error={overview.error} onRetry={overview.reload} /></div>
          ) : (
            <Loading />
          )}
        </Card>
      </div>
    </>
  );
}
