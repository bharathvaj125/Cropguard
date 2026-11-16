import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Eye,
  FlaskConical,
  HelpCircle,
  Leaf,
  Microscope,
  ShieldCheck,
  Sprout,
  Tractor,
} from 'lucide-react';
import { OUTCOMES, SEVERITY, capitalise, formatDateTime } from '../lib/format.js';
import { Alert, Badge, Card, ConfidenceBar } from './ui.jsx';

const VERDICT_ICON = { good: CheckCircle2, bad: AlertTriangle, warn: HelpCircle };

function headline(a) {
  const d = a.disease;
  const p = a.pest;
  switch (a.outcome) {
    case 'healthy':
      return {
        title: d ? `This ${d.crop.toLowerCase()} leaf looks healthy` : 'No pest found',
        text: 'No sign of disease or pests was found in this photo. Keep scouting regularly.',
      };
    case 'disease':
      return { title: `${d.name} detected`, text: `${d.crop} · ${Math.round(d.confidence * 100)}% confidence` };
    case 'pest':
      return { title: `${p.name} detected`, text: `Pest · ${Math.round(p.confidence * 100)}% confidence` };
    case 'disease_and_pest':
      return { title: `${d.name} and ${p.name.toLowerCase()} detected`, text: `${d.crop} · both a disease and a pest were found` };
    default:
      return {
        title: 'The AI is not sure about this photo',
        text: 'No result was confident enough to report. The closest matches are listed below as a starting point only.',
      };
  }
}

function Bullets({ icon: Icon, title, items }) {
  if (!items?.length) return null;
  return (
    <div className="advice">
      <h4>
        <Icon size={16} /> {title}
      </h4>
      <ul className="bullets">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Predictions({ result, uncertain }) {
  return (
    <div className="stack-sm">
      {result.top.map((p, i) => (
        <ConfidenceBar key={p.label} label={p.name} value={p.confidence} primary={i === 0} warn={uncertain} />
      ))}
    </div>
  );
}

function DiseaseSection({ a }) {
  const d = a.disease;
  const info = a.diseaseInfo;
  const uncertain = d.status === 'uncertain';
  return (
    <Card
      title="Disease analysis"
      icon={Microscope}
      action={<Badge tone={uncertain ? 'warn' : d.isHealthy ? 'good' : 'bad'}>{uncertain ? 'Uncertain' : d.isHealthy ? 'Healthy' : 'Detected'}</Badge>}
    >
      <div className="stack">
        <Predictions result={d} uncertain={uncertain} />
        {d.cropFiltered ? (
          <p className="tiny faint">Results limited to {d.crop.toLowerCase()} because you selected that crop.</p>
        ) : null}

        {uncertain ? (
          <Alert tone="warn" title="Not confident enough to diagnose">
            The top score is below the reporting threshold. Retake the photo with one leaf filling the frame, in daylight,
            and choose the crop before scanning.
          </Alert>
        ) : info && !d.isHealthy ? (
          <>
            <p>{info.summary}</p>
            <dl className="kv">
              <dt>Cause</dt>
              <dd>
                {capitalise(info.type)}: <i>{info.pathogen}</i>
              </dd>
              {info.conditions ? (
                <>
                  <dt>Favoured by</dt>
                  <dd>{info.conditions}</dd>
                </>
              ) : null}
            </dl>
            <Bullets icon={Eye} title="Check for these symptoms" items={info.symptoms} />
            <div className="grid grid-3">
              <Bullets icon={Tractor} title="Field practices" items={info.treatment.cultural} />
              <Bullets icon={Leaf} title="Organic options" items={info.treatment.organic} />
              <Bullets icon={FlaskConical} title="Chemical options" items={info.treatment.chemical} />
            </div>
            <Bullets icon={ShieldCheck} title="Prevent it next season" items={info.prevention} />
          </>
        ) : info ? (
          <>
            <Bullets icon={Sprout} title="Keep it healthy" items={info.treatment.cultural} />
            <Bullets icon={ShieldCheck} title="Stay ahead" items={info.prevention} />
          </>
        ) : null}
      </div>
    </Card>
  );
}

function PestSection({ a }) {
  const p = a.pest;
  const info = a.pestInfo;
  const tone = p.status === 'detected' ? 'bad' : p.status === 'none' ? 'good' : 'warn';
  const label = p.status === 'detected' ? 'Detected' : p.status === 'none' ? 'None found' : 'Uncertain';
  return (
    <Card title="Pest analysis" icon={Bug} action={<Badge tone={tone}>{label}</Badge>}>
      <div className="stack">
        <Predictions result={p} uncertain={p.status === 'uncertain'} />
        {p.status === 'uncertain' ? (
          <Alert tone="warn" title="Not confident enough to name a pest">
            Photograph the insect itself, as close and sharp as you can, and scan again.
          </Alert>
        ) : p.status === 'none' ? (
          <p className="muted">{info?.monitoring}</p>
        ) : info ? (
          <>
            <p>{info.summary}</p>
            <dl className="kv">
              {info.scientific ? (
                <>
                  <dt>Group</dt>
                  <dd><i>{info.scientific}</i></dd>
                </>
              ) : null}
              {info.crops?.length ? (
                <>
                  <dt>Common on</dt>
                  <dd>{info.crops.join(', ')}</dd>
                </>
              ) : null}
            </dl>
            <Bullets icon={Eye} title="Damage to look for" items={info.damage} />
            <div className="grid grid-3">
              <Bullets icon={Tractor} title="Field practices" items={info.management.cultural} />
              <Bullets icon={Leaf} title="Biological control" items={info.management.biological} />
              <Bullets icon={FlaskConical} title="Chemical options" items={info.management.chemical} />
            </div>
            <Alert tone="info" title="How to monitor">
              {info.monitoring}
            </Alert>
          </>
        ) : null}
      </div>
    </Card>
  );
}

/** Full report for one analysis: verdict, photo, both model results and the advice. */
export default function AnalysisResult({ analysis: a }) {
  const outcome = OUTCOMES[a.outcome];
  const VerdictIcon = VERDICT_ICON[outcome.tone];
  const { title, text } = headline(a);
  const severity = SEVERITY[a.severity];
  const acted = ['disease', 'pest', 'disease_and_pest'].includes(a.outcome);

  return (
    <div className="stack">
      <div className={`verdict ${outcome.tone}`}>
        <div className="verdict-icon">
          <VerdictIcon size={26} />
        </div>
        <div className="grow">
          <h2>{title}</h2>
          <p style={{ marginTop: 2 }}>{text}</p>
          <div className="row-wrap" style={{ marginTop: 10 }}>
            {acted ? <Badge tone={severity.tone}>{severity.label}</Badge> : null}
            {a.farm?.name ? <Badge icon={Sprout}>{a.farm.name}</Badge> : null}
            <span className="small muted">{formatDateTime(a.createdAt)}</span>
          </div>
        </div>
      </div>

      {a.quality?.warnings?.length ? (
        <Alert tone="warn" title="Photo quality may affect this result">
          {a.quality.warnings.join(' ')}
        </Alert>
      ) : null}

      <div className="grid grid-main">
        <div className="stack">
          {a.disease ? <DiseaseSection a={a} /> : null}
          {a.pest ? <PestSection a={a} /> : null}
        </div>

        <div className="stack">
          <Card title="Photo" icon={Eye}>
            {a.heatmapUrl ? (
              <div className="stack-sm">
                <div className="compare">
                  <figure>
                    <img src={a.imageUrl} alt="Uploaded crop" />
                    <figcaption>Your photo</figcaption>
                  </figure>
                  <figure>
                    <img src={a.heatmapUrl} alt="Heatmap of the regions the model relied on" />
                    <figcaption>Where the AI looked</figcaption>
                  </figure>
                </div>
                <p className="tiny faint">
                  Highlighted areas are the parts of the photo that mattered most to the disease result. If they are not on
                  the damaged tissue, treat the result with caution.
                </p>
              </div>
            ) : (
              <img src={a.imageUrl} alt="Uploaded crop" style={{ width: '100%', borderRadius: 12 }} />
            )}
          </Card>

          {a.review?.status && a.review.status !== 'pending' ? (
            <Alert tone={a.review.status === 'confirmed' ? 'good' : 'warn'} title={a.review.status === 'confirmed' ? 'Confirmed by an expert' : 'Corrected by an expert'}>
              {a.review.note || 'An agronomist has reviewed this report.'}
            </Alert>
          ) : null}

          <p className="tiny faint">
            AI results are decision support, not a laboratory diagnosis. Product names are common active ingredients, not
            endorsements. Always follow the product label and your local agricultural extension officer&apos;s advice.
          </p>
        </div>
      </div>
    </div>
  );
}
