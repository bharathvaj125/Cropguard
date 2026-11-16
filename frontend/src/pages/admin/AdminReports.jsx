import { Activity } from 'lucide-react';
import { useState } from 'react';
import { Card, EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '../../components/ui.jsx';
import { OUTCOMES } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { AnalysisRow } from '../History.jsx';

const REVIEW = { pending: 'Awaiting review', confirmed: 'Confirmed', corrected: 'Corrected' };

export default function AdminReports() {
  const [outcome, setOutcome] = useState('');
  const [review, setReview] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/admin/analyses', { outcome, review, page, limit: 12 });

  const change = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="AI reports" subtitle="Monitor every analysis on the platform and review the results." />

      <Card
        pad={false}
        title="Analysis reports"
        icon={Activity}
        action={
          <div className="filters">
            <select className="select" aria-label="Filter by result" value={outcome} onChange={change(setOutcome)}>
              <option value="">All results</option>
              {Object.entries(OUTCOMES).map(([value, o]) => (
                <option key={value} value={value}>{o.label}</option>
              ))}
            </select>
            <select className="select" aria-label="Filter by review status" value={review} onChange={change(setReview)}>
              <option value="">Any review status</option>
              {Object.entries(REVIEW).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        }
      >
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Activity} title="No reports match">
            {outcome || review ? 'Try clearing the filters.' : 'Reports appear here as farmers scan their crops.'}
          </EmptyState>
        ) : (
          <>
            <ul className="list">
              {data.items.map((a) => (
                <AnalysisRow key={a.id} analysis={a} to={`/app/admin/reports/${a.id}`} showUser />
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
