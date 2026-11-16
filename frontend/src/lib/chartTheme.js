/** Shared chart styling. See components/charts.jsx for the conventions. */

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

export const axisProps = {
  tick: { fontSize: 12, fill: 'var(--ink-3)' },
  tickLine: false,
  axisLine: { stroke: 'var(--line-strong)' },
};

export const gridProps = { stroke: 'var(--grid)', vertical: false };
