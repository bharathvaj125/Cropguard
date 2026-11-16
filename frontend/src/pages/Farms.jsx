import { CloudSun, Droplets, Layers, MapPin, Pencil, Plus, Ruler, ScanLine, Sprout, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import FarmForm from '../components/FarmForm.jsx';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorAlert, Loading, Modal, PageHeader, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { capitalise } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

export default function Farms() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/farms');
  const [editing, setEditing] = useState(null); // null | 'new' | farm
  const [removing, setRemoving] = useState(null);

  async function save(values) {
    if (editing === 'new') await api.post('/farms', values);
    else await api.put(`/farms/${editing.id}`, values);
    toast(editing === 'new' ? 'Farm added' : 'Farm updated');
    setEditing(null);
    reload();
  }

  async function remove() {
    try {
      await api.delete(`/farms/${removing.id}`);
      toast('Farm deleted');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader title="My farms" subtitle="Your fields, their location and what you grow on them.">
        <Button icon={Plus} onClick={() => setEditing('new')}>
          Add farm
        </Button>
      </PageHeader>

      {error ? (
        <ErrorAlert error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.farms.length === 0 ? (
        <Card>
          <EmptyState icon={Sprout} title="No farms yet" action={<Button icon={Plus} onClick={() => setEditing('new')}>Add your first farm</Button>}>
            Add a farm to get a weather forecast for its location and to group your scans and field work by field.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-3">
          {data.farms.map((farm) => (
            <article className="card farm-card" key={farm.id}>
              <div className="row between">
                <h3 className="truncate">{farm.name}</h3>
                <div className="row" style={{ gap: 2 }}>
                  <Button variant="ghost" className="btn-icon" aria-label={`Edit ${farm.name}`} onClick={() => setEditing(farm)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" className="btn-icon" aria-label={`Delete ${farm.name}`} onClick={() => setRemoving(farm)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className="stack-sm small muted">
                <span className="row" style={{ gap: 8 }}>
                  <MapPin size={15} /> {farm.location?.name || 'No location set'}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <Ruler size={15} /> {farm.areaAcres ? `${farm.areaAcres} acres` : 'Area not set'}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <Layers size={15} /> {capitalise(farm.soilType)} soil
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <Droplets size={15} /> {capitalise(farm.irrigationType)} irrigation
                </span>
              </div>

              {farm.crops.length ? (
                <div className="chips">
                  {farm.crops.map((c) => (
                    <span className="chip" key={c}>{c}</span>
                  ))}
                </div>
              ) : null}

              <div className="row-wrap" style={{ marginTop: 'auto', paddingTop: 6 }}>
                <Badge icon={ScanLine}>{farm.scans} {farm.scans === 1 ? 'scan' : 'scans'}</Badge>
                {farm.issues ? <Badge tone="bad">{farm.issues} with problems</Badge> : null}
                {farm.location?.latitude != null ? (
                  <Link className="small row" style={{ gap: 5, marginLeft: 'auto' }} to="/app/weather">
                    <CloudSun size={15} /> Weather
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <Modal wide title={editing === 'new' ? 'Add a farm' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <FarmForm farm={editing === 'new' ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          message="The farm will be removed. Scans and activities linked to it are kept, but will no longer show a farm."
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
