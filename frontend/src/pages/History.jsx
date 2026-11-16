import { ChevronRight, History as HistoryIcon, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '../components/ui.jsx';
import { OUTCOMES, analysisTitle, formatDateTime } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

/** One row of a scan list. Shared by the history page, the dashboard and the admin reports. */
export function AnalysisRow({ analysis: a, to, showUser }) {
  const outcome = OUTCOMES[a.outcome];
  const score = a.disease?.confidence ?? a.pest?.confidence;
  return (
    <li>
      <img className="thumb" src={a.imageUrl} alt="" loading="lazy" />
      <div className="grow">
        <Link to={to} className="strong truncate" style={{ display: 'block', color: 'var(--ink)' }}>
          {analysisTitle(a)}
        </Link>
        <div className="small muted truncate">
          {formatDateTime(a.createdAt)}
          {a.farm?.name ? ` · ${a.farm.name}` : ''}
          {showUser && a.user ? ` · ${a.user.name}` : ''}
        </div>
      </div>
      {score != null ? <span className="small muted num hide-sm">{Math.round(score * 100)}%</span> : null}
      <Badge tone={outcome.tone}>{outcome.label}</Badge>
      <Link to={to} className="btn btn-ghost btn-icon hide-sm" aria-label="Open report">
        <ChevronRight size={18} />
      </Link>
    </li>
  );
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState('');
  const [farmId, setFarmId] = useState('');
  const farms = useApi('/farms');
  const { data, loading, error, reload } = useApi('/analyses', { page, limit: 10, outcome, farmId });

  const filtered = Boolean(outcome || farmId);

  return (
    <>
      <PageHeader title="Scan history" subtitle="Every analysis you have run, newest first.">
        <Link className="btn" to="/app/scan">
          <ScanLine size={17} /> New scan
        </Link>
      </PageHeader>

      <Card
        pad={false}
        title="Reports"
        icon={HistoryIcon}
        action={
          <div className="filters">
            <select
              className="select"
              aria-label="Filter by result"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All results</option>
              {Object.entries(OUTCOMES).map(([value, o]) => (
                <option key={value} value={value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Filter by farm"
              value={farmId}
              onChange={(e) => {
                setFarmId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All farms</option>
              {(farms.data?.farms || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {error ? (
          <div className="card-pad">
            <ErrorAlert error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title={filtered ? 'No scans match these filters' : 'No scans yet'}
            action={
              filtered ? null : (
                <Link className="btn" to="/app/scan">
                  Scan your first crop
                </Link>
              )
            }
          >
            {filtered ? 'Try clearing the filters.' : 'Upload a photo of a leaf and your reports will be kept here.'}
          </EmptyState>
        ) : (
          <>
            <ul className="list">
              {data.items.map((a) => (
                <AnalysisRow key={a.id} analysis={a} to={`/app/history/${a.id}`} />
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
