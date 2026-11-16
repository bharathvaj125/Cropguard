import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

/* ---------- small building blocks ---------- */

export function Spinner({ small, light }) {
  return <span className={`spinner${small ? ' sm' : ''}${light ? ' light' : ''}`} role="status" aria-label="Loading" />;
}

export function Loading() {
  return (
    <div className="loading">
      <Spinner />
    </div>
  );
}

export function Button({ variant = 'primary', size, block, busy, icon: Icon, children, className = '', ...props }) {
  const classes = ['btn'];
  if (variant !== 'primary') classes.push(`btn-${variant}`);
  if (size) classes.push(`btn-${size}`);
  if (block) classes.push('btn-block');
  if (className) classes.push(className);
  return (
    <button type="button" className={classes.join(' ')} disabled={busy || props.disabled} {...props}>
      {busy ? <Spinner small light={variant === 'primary' || variant === 'danger'} /> : Icon ? <Icon size={17} /> : null}
      {children}
    </button>
  );
}

export function Badge({ tone, icon: Icon, children }) {
  return (
    <span className={`badge${tone ? ` ${tone}` : ''}`}>
      {Icon ? <Icon size={13} /> : null}
      {children}
    </span>
  );
}

const ALERT_ICONS = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info };

export function Alert({ tone = 'info', title, children }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div>
        {title ? <div className="alert-title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

/** Shows an API error, or nothing when there is none. */
export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  return (
    <Alert tone="bad">
      {error.message}{' '}
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry} style={{ marginLeft: 8 }}>
          Try again
        </button>
      ) : null}
    </Alert>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ? <div className="row-wrap">{children}</div> : null}
    </header>
  );
}

export function Card({ title, icon: Icon, action, children, pad = true, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="card-head">
          <h2>
            {Icon ? <Icon size={18} /> : null}
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {pad ? <div className="card-pad">{children}</div> : children}
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="card stat">
      <div className={`stat-icon${tone ? ` ${tone}` : ''}`}>
        <Icon size={21} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint ? <div className="tiny faint">{hint}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon ? (
        <div className="empty-icon">
          <Icon size={26} />
        </div>
      ) : null}
      <h3>{title}</h3>
      {children ? <p style={{ maxWidth: '46ch' }}>{children}</p> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

/* ---------- forms ---------- */

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className="input" {...props} />}
    </Field>
  );
}

export function SelectField({ label, hint, error, className, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <select id={id} className="select" {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, hint, error, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <textarea id={id} className="textarea" {...props} />}
    </Field>
  );
}

/* ---------- overlays ---------- */

export function Modal({ title, onClose, wide, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="stack">
        <p className="muted">{message}</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- toasts ---------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'good') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'bad' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast('Saved'); toast(err.message, 'bad'); */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

/* ---------- data display ---------- */

export function Pagination({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="pagination">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="row">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

/** A labelled 0..1 score with a bar. `primary` marks the top prediction. */
export function ConfidenceBar({ label, value, primary, warn }) {
  const pct = Math.round(value * 100);
  return (
    <div className={`meter${primary ? ' primary' : ''}${warn ? ' warn' : ''}`}>
      <span className={primary ? 'strong' : 'muted'}>{label}</span>
      <span className="num strong">{pct}%</span>
      <div className="meter-track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} confidence`}>
        <div className="meter-fill" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`tab${value === t.value ? ' active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Tiny inline trend line for tables. Decorative: the number beside it carries the value. */
export function Sparkline({ values, width = 96, height = 28 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
