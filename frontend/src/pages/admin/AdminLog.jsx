import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';

// Human wording for the action codes written by the API (services/audit.js).
const ACTIONS = {
  'auth.register': ['Signed up', 'good'],
  'auth.login': ['Signed in', undefined],
  'auth.password_change': ['Changed password', 'info'],
  'auth.account_delete': ['Deleted own account', 'warn'],
  'analysis.create': ['Ran an analysis', 'info'],
  'admin.user.update': ['Updated a user', 'warn'],
  'admin.user.delete': ['Deleted a user', 'bad'],
  'admin.farm.update': ['Edited a farm', 'warn'],
  'admin.farm.delete': ['Deleted a farm', 'bad'],
  'admin.analysis.review': ['Reviewed a report', 'good'],
  'admin.analysis.delete': ['Deleted a report', 'bad'],
  'admin.advisory.create': ['Published an advisory', 'good'],
  'admin.advisory.update': ['Edited an advisory', 'warn'],
  'admin.advisory.delete': ['Deleted an advisory', 'bad'],
  'admin.market.price': ['Entered a market price', 'info'],
  'admin.market.sync': ['Synced market prices', 'info'],
};

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'auth', label: 'Accounts and sign-ins' },
  { value: 'analysis', label: 'Analyses' },
  { value: 'admin', label: 'Admin actions' },
];

export default function AdminLog() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/admin/activity', { action, page, limit: 25 });

  return (
    <>
      <PageHeader title="Activity log" subtitle="A record of sign-ins, analyses and administrative actions on the platform." />

      <Card
        pad={false}
        title="Platform activity"
        icon={ScrollText}
        action={
          <select
            className="select"
            style={{ width: 'auto' }}
            aria-label="Filter activity"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        }
      >
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing logged yet" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const [label, tone] = ACTIONS[row.action] || [row.action, undefined];
                    return (
                      <tr key={row.id}>
                        <td className="nowrap small">{formatDateTime(row.createdAt)}</td>
                        <td>{row.actorEmail || <span className="faint">System</span>}</td>
                        <td><Badge tone={tone}>{label}</Badge></td>
                        <td className="small muted">{row.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
