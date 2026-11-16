import { Pencil, Search, Sprout, Trash2 } from 'lucide-react';
import { useState } from 'react';
import FarmForm from '../../components/FarmForm.jsx';
import { Button, Card, ConfirmDialog, EmptyState, ErrorAlert, Loading, Modal, PageHeader, Pagination, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { capitalise, formatDate } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { useDebounced } from './AdminUsers.jsx';

export default function AdminFarms() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi('/admin/farms', { q: search, page, limit: 15 });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  async function save(values) {
    await api.put(`/admin/farms/${editing.id}`, values);
    toast('Farm updated');
    setEditing(null);
    reload();
  }

  async function remove() {
    try {
      await api.delete(`/admin/farms/${removing.id}`);
      toast('Farm deleted');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader title="Farms" subtitle="Every farm registered on the platform." />

      <Card
        pad={false}
        title="Farm records"
        icon={Sprout}
        action={
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search name, place or crop" aria-label="Search farms" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        }
      >
        {error ? (
          <div className="card-pad"><ErrorAlert error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Sprout} title={search ? 'No farms match' : 'No farms registered yet'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Farm</th>
                    <th>Owner</th>
                    <th>Location</th>
                    <th className="right">Acres</th>
                    <th>Soil / irrigation</th>
                    <th>Crops</th>
                    <th>Added</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((f) => (
                    <tr key={f.id}>
                      <td className="strong">{f.name}</td>
                      <td>
                        <div>{f.owner?.name || 'Deleted user'}</div>
                        <div className="small muted">{f.owner?.email}</div>
                      </td>
                      <td>{f.location?.name || <span className="faint">Not set</span>}</td>
                      <td className="right num">{f.areaAcres || '–'}</td>
                      <td className="small">{capitalise(f.soilType)} / {capitalise(f.irrigationType)}</td>
                      <td className="small">{f.crops.join(', ') || <span className="faint">None listed</span>}</td>
                      <td className="nowrap small">{formatDate(f.createdAt)}</td>
                      <td className="right">
                        <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                          <Button variant="ghost" className="btn-icon" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" className="btn-icon" aria-label={`Delete ${f.name}`} onClick={() => setRemoving(f)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>

      {editing ? (
        <Modal wide title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <FarmForm farm={editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          message={`This removes the farm owned by ${removing.owner?.name || 'a deleted user'}. Their scans and activities are kept but will no longer be linked to a farm.`}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
