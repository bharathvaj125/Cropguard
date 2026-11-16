import { Search, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorAlert, Loading, PageHeader, Pagination, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { formatDate } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';

/** Returns `value` after it has stopped changing for `delay` ms, so typing does not fire a request per key. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi('/admin/users', { q: search, role, status, page, limit: 15 });
  const [removing, setRemoving] = useState(null);

  async function update(user, patch, message) {
    try {
      await api.patch(`/admin/users/${user.id}`, patch);
      toast(message);
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  async function remove() {
    try {
      await api.delete(`/admin/users/${removing.id}`);
      toast('User and all their data deleted');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Search, activate or deactivate accounts, and manage administrator access." />

      <Card
        pad={false}
        title="Registered users"
        icon={Users}
        action={
          <div className="filters">
            <div className="search">
              <Search size={16} />
              <input className="input" placeholder="Search name, email or phone" aria-label="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <select className="select" aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">All roles</option>
              <option value="farmer">Farmers</option>
              <option value="admin">Admins</option>
            </select>
            <select className="select" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </div>
        }
      >
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Users} title="No users match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="right">Farms</th>
                    <th className="right">Scans</th>
                    <th>Joined</th>
                    <th>Last sign-in</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => {
                    const self = u.id === me.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="strong">{u.name} {self ? <span className="faint small">(you)</span> : null}</div>
                          <div className="small muted">{u.email}</div>
                        </td>
                        <td><Badge tone={u.role === 'admin' ? 'info' : undefined}>{u.role === 'admin' ? 'Admin' : 'Farmer'}</Badge></td>
                        <td><Badge tone={u.isActive ? 'good' : 'bad'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                        <td className="right num">{u.farms}</td>
                        <td className="right num">{u.scans}</td>
                        <td className="nowrap small">{formatDate(u.createdAt)}</td>
                        <td className="nowrap small">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                        <td className="right">
                          <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              className="btn-icon"
                              disabled={self}
                              title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                              aria-label={u.isActive ? `Deactivate ${u.name}` : `Reactivate ${u.name}`}
                              onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? `${u.name} can no longer sign in` : `${u.name} reactivated`)}
                            >
                              {u.isActive ? <UserX size={17} /> : <UserCheck size={17} />}
                            </Button>
                            <Button
                              variant="ghost"
                              className="btn-icon"
                              disabled={self}
                              title={u.role === 'admin' ? 'Remove admin access' : 'Make admin'}
                              aria-label={u.role === 'admin' ? `Remove admin access from ${u.name}` : `Make ${u.name} an admin`}
                              onClick={() =>
                                update(u, { role: u.role === 'admin' ? 'farmer' : 'admin' }, u.role === 'admin' ? `${u.name} is now a farmer` : `${u.name} is now an admin`)
                              }
                            >
                              {u.role === 'admin' ? <ShieldOff size={17} /> : <ShieldCheck size={17} />}
                            </Button>
                            <Button variant="ghost" className="btn-icon" disabled={self} title="Delete user" aria-label={`Delete ${u.name}`} onClick={() => setRemoving(u)}>
                              <Trash2 size={17} />
                            </Button>
                          </div>
                        </td>
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

      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          message={`This permanently deletes the account ${removing.email} together with its ${removing.farms} farms, ${removing.scans} scan reports and uploaded photos. To block access without losing data, deactivate the account instead.`}
          confirmLabel="Delete user and data"
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
