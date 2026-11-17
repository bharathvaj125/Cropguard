import { useEffect, useRef, useState } from 'react';

/**
 * CropGuard brand pieces and small motion helpers.
 * Logo images live in /public/brand (cut from the original logo artwork).
 */

export function LogoMark({ size = 40, className = '', alt = 'CropGuard' }) {
  return <img src="/brand/logo-mark.webp" alt={alt} height={size} style={{ height: size, width: 'auto' }} className={className} />;
}

export function LogoWordmark({ height = 28, className = '' }) {
  return <img src="/brand/logo-wordmark.webp" alt="CropGuard" style={{ height, width: 'auto' }} className={className} />;
}

/** Full-page loader: the shield gently bobbing above a shimmering bar. */
export function BrandLoader({ label = 'Loading' }) {
  return (
    <div className="brand-loader" role="status" aria-label={label}>
      <img src="/brand/logo-mark.webp" alt="" />
      <span className="bar" />
    </div>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts up to `value` when it scrolls into view.
 *   <CountUp value={99.1} decimals={1} suffix="%" />
 */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', duration = 1100 }) {
  const ref = useRef(null);
  const still = prefersReducedMotion() || typeof value !== 'number';
  const [animated, setShown] = useState(0);
  const shown = still ? value : animated;

  useEffect(() => {
    if (still) return undefined;
    let frame;
    const node = ref.current;
    const run = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        setShown(value * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (!node || typeof IntersectionObserver === 'undefined') {
      run();
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, still]);

  const text = typeof shown === 'number' ? shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : shown;
  return (
    <span ref={ref}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
