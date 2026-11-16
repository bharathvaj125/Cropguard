/**
 * Shared chart pieces (Recharts).
 *
 * Conventions used by every chart in the app:
 *  - one y-axis per chart; two measures with different units get two charts
 *  - series colours come from --series-1..3 in a fixed order
 *  - grid and axes are light so the data stands out; text stays in ink colours
 *  - every chart has a hover tooltip, and a legend when there is more than one series
 */

/** Tooltip body. `format` turns a raw value into display text. */
export function ChartTip({ active, payload, label, labelFormat = (v) => v, format = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="tip-title">{labelFormat(label)}</div>
      {payload
        .filter((p) => p.value != null && p.name)
        .map((p) => (
          <div className="tip-row" key={p.dataKey}>
            <span className="swatch" style={{ background: p.color || p.stroke || p.fill }} />
            {p.name}
            <b>{Array.isArray(p.value) ? p.value.map((v) => format(v)).join(' – ') : format(p.value, p.dataKey)}</b>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}>
          <span
            className="swatch"
            style={{ background: item.color, opacity: item.faint ? 0.35 : 1, ...(item.line ? { height: 3, width: 14, borderRadius: 2 } : {}) }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
