import { useId, useMemo, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { mulberry32 } from '../three/random';

const W = 1440;

/** Glaze poured over an edge: a flat lip with drips of varied length ending in round bulbs. */
function dripPath(seed, base, maxLen) {
  const rnd = mulberry32(seed);
  let d = `M0,0 L0,${base}`;
  const highlights = [];
  let x = 20 + rnd() * 40;
  while (x < W - 60) {
    const w = 22 + rnd() * 22;
    const long = rnd();
    const len = long > 0.72 ? maxLen * (0.75 + rnd() * 0.25) : long > 0.35 ? maxLen * (0.35 + rnd() * 0.3) : maxLen * (0.12 + rnd() * 0.15);
    const r = w / 2;
    const f = w * 0.42;
    const xl = x;
    const xr = x + w;
    const bottom = base + len;
    d += ` L${(xl - f).toFixed(1)},${base} Q${xl},${base} ${xl},${(base + f).toFixed(1)}`;
    d += ` L${(xl - 1.2).toFixed(1)},${(bottom - r).toFixed(1)}`;
    d += ` A${(r + 1.2).toFixed(1)},${(r + 1.5).toFixed(1)} 0 0 0 ${(xr + 1.2).toFixed(1)},${(bottom - r).toFixed(1)}`;
    d += ` L${xr},${(base + f).toFixed(1)} Q${xr},${base} ${(xr + f).toFixed(1)},${base}`;
    if (len > maxLen * 0.45) highlights.push(`M${xl + 5},${base + f + 4} L${xl + 4},${bottom - r - 2}`);
    x = xr + f * 2 + 18 + rnd() * 70;
  }
  d += ` L${W},${base} L${W},0 Z`;
  return { d, highlights };
}

/** Soft whipped-cream wave. */
function wavePath(seed, base, amp) {
  const rnd = mulberry32(seed);
  const n = 7;
  const step = W / n;
  let d = `M0,0 L0,${base}`;
  for (let i = 0; i < n; i++) {
    const x0 = i * step;
    const a = amp * (0.55 + rnd() * 0.45) * (i % 2 ? -1 : 1);
    d += ` C${(x0 + step * 0.35).toFixed(1)},${(base + a).toFixed(1)} ${(x0 + step * 0.65).toFixed(1)},${(base + a).toFixed(1)} ${(x0 + step).toFixed(1)},${base}`;
  }
  return `${d} L${W},0 Z`;
}

/** Piped shell border: leaning teardrops with fine piping grooves. */
function shellPath(base, size) {
  const n = Math.round(W / size);
  const w = W / n;
  let d = `M0,0 L0,${base}`;
  const grooves = [];
  for (let i = 0; i < n; i++) {
    const x = i * w;
    d += ` C${(x + w * 0.05).toFixed(1)},${(base + size * 0.62).toFixed(1)} ${(x + w * 0.7).toFixed(1)},${(base + size * 0.66).toFixed(1)} ${(x + w).toFixed(1)},${(base + 2).toFixed(1)}`;
    [0.25, 0.45, 0.65].forEach((t) => {
      grooves.push(`M${(x + w * 0.92).toFixed(1)},${base + 2} Q${(x + w * (t + 0.05)).toFixed(1)},${(base + size * 0.5 * (0.6 + t)).toFixed(1)} ${(x + w * (t - 0.12)).toFixed(1)},${(base + size * 0.2 * (1 + t)).toFixed(1)}`);
    });
  }
  return { d: `${d} L${W},0 Z`, grooves };
}

/**
 * Art-directed icing edge between two sections.
 * `from` is the colour of the section above (the icing), `to` the section below.
 */
export default function IcingDivider({ variant = 'drip-down', from = 'var(--blush)', to = 'var(--cream)', seed = 4, height = 120, flip = false, className = '' }) {
  const reduced = useReducedMotion();
  const clip = useId().replace(/:/g, '');
  // Observe the visible wrapper: elements inside <clipPath> are never "in view" themselves.
  const wrap = useRef(null);
  const inView = useInView(wrap, { once: true, margin: '0px 0px -8% 0px' });
  const pour = !reduced && variant === 'drip-down';
  const shape = useMemo(() => {
    if (variant === 'cream-wave') return { d: wavePath(seed, height * 0.45, height * 0.32), back: wavePath(seed + 9, height * 0.62, height * 0.28) };
    if (variant === 'piped-edge') return shellPath(height * 0.28, height * 0.62);
    return dripPath(seed, height * 0.18, height * 0.8);
  }, [variant, seed, height]);

  return (
    <div ref={wrap} className={`icing icing-${variant} ${className}`} style={{ background: to, transform: flip ? 'scaleY(-1)' : undefined }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMin slice" width="100%" height={height}>
        <defs>
          <clipPath id={clip}>
            <motion.rect
              x="0" y="0" width={W}
              initial={{ height: pour ? height * 0.2 : height }}
              animate={{ height: !pour || inView ? height : height * 0.2 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </clipPath>
        </defs>
        {variant === 'cream-wave' && <path d={shape.back} fill={from} opacity="0.45" />}
        <g clipPath={`url(#${clip})`}>
          <path d={shape.d} fill={from} />
          {shape.highlights?.map((h, i) => <path key={i} d={h} stroke="#fff" strokeOpacity="0.38" strokeWidth="2.2" strokeLinecap="round" fill="none" />)}
          {shape.grooves?.map((g, i) => <path key={i} d={g} stroke="#fff" strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round" fill="none" />)}
        </g>
      </svg>
    </div>
  );
}
