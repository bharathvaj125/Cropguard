import { BookOpen, Bug, ChevronRight, Microscope, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Card, EmptyState, ErrorAlert, Loading, PageHeader, Tabs } from '../components/ui.jsx';
import { SEVERITY, capitalise } from '../lib/format.js';
import { useApi } from '../lib/useApi.js';

function Section({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="label" style={{ marginTop: 12 }}>{title}</div>
      <ul className="bullets small">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function DiseaseItem({ d }) {
  return (
    <details className="lib-item">
      <summary>
        <ChevronRight className="chev" size={18} />
        <div className="grow">
          <div className="strong">{d.name}</div>
          <div className="small muted">{d.crop} · {capitalise(d.type)}</div>
        </div>
        <Badge tone={SEVERITY[d.severity].tone}>{SEVERITY[d.severity].label}</Badge>
      </summary>
      <div style={{ padding: '10px 0 4px 30px' }}>
        <p>{d.summary}</p>
        <p className="small muted" style={{ marginTop: 6 }}>
          Cause: <i>{d.pathogen}</i>. {d.conditions}
        </p>
        <Section title="Symptoms" items={d.symptoms} />
        <Section title="Field practices" items={d.treatment.cultural} />
        <Section title="Organic options" items={d.treatment.organic} />
        <Section title="Chemical options" items={d.treatment.chemical} />
        <Section title="Prevention" items={d.prevention} />
      </div>
    </details>
  );
}

function PestItem({ p }) {
  return (
    <details className="lib-item">
      <summary>
        <ChevronRight className="chev" size={18} />
        <div className="grow">
          <div className="strong">{p.name}</div>
          <div className="small muted truncate"><i>{p.scientific}</i></div>
        </div>
        <Badge tone={SEVERITY[p.severity].tone}>{SEVERITY[p.severity].label}</Badge>
      </summary>
      <div style={{ padding: '10px 0 4px 30px' }}>
        <p>{p.summary}</p>
        <p className="small muted" style={{ marginTop: 6 }}>Common on: {p.crops.join(', ')}.</p>
        <Section title="Damage" items={p.damage} />
        <Section title="Field practices" items={p.management.cultural} />
        <Section title="Biological control" items={p.management.biological} />
        <Section title="Chemical options" items={p.management.chemical} />
        <p className="small" style={{ marginTop: 12 }}><b>Monitoring:</b> {p.monitoring}</p>
      </div>
    </details>
  );
}

export default function Library() {
  const { data, loading, error, reload } = useApi('/knowledge');
  const [tab, setTab] = useState('diseases');
  const [q, setQ] = useState('');
  const [crop, setCrop] = useState('');

  const items = useMemo(() => {
    if (!data) return [];
    const text = q.trim().toLowerCase();
    if (tab === 'diseases') {
      return data.diseases.filter(
        (d) => (!crop || d.crop === crop) && (!text || `${d.name} ${d.crop} ${d.pathogen} ${d.summary}`.toLowerCase().includes(text)),
      );
    }
    return data.pests.filter((p) => !text || `${p.name} ${p.scientific} ${p.crops.join(' ')} ${p.summary}`.toLowerCase().includes(text));
  }, [data, tab, q, crop]);

  if (error) return <ErrorAlert error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Disease & pest guide"
        subtitle={`Everything the AI can recognise: ${data.diseases.length} diseases on ${data.crops.length} crops and ${data.pests.length} pest groups.`}
      />

      <Card
        pad={false}
        title={tab === 'diseases' ? 'Diseases' : 'Pests'}
        icon={tab === 'diseases' ? Microscope : Bug}
        action={
          <Tabs
            tabs={[
              { value: 'diseases', label: `Diseases (${data.diseases.length})` },
              { value: 'pests', label: `Pests (${data.pests.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        <div className="card-pad filters" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search by name, crop or symptom" aria-label="Search the guide" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {tab === 'diseases' ? (
            <select className="select" aria-label="Filter by crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
              <option value="">All crops</option>
              {data.crops.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nothing matches">Try a different word or clear the filters.</EmptyState>
        ) : tab === 'diseases' ? (
          items.map((d) => <DiseaseItem key={d.label} d={d} />)
        ) : (
          items.map((p) => <PestItem key={p.label} p={p} />)
        )}
      </Card>
    </>
  );
}
