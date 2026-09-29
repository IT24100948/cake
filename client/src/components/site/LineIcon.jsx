/* Fine line icons for the storefront (1.4px strokes, rounded, 24px grid). */
const P = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></>,
  bag: <><path d="M5.5 8.5h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" /></>,
  arrow: <><path d="M4.5 12h15" /><path d="m13.5 6 6 6-6 6" /></>,
  menu: <><path d="M4 8h16" /><path d="M4 16h16" /></>,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  whisk: <><path d="M12 13.5V21" /><path d="M12 13.5c-3.2 0-5-3.4-5-6.3C7 4.6 9.2 3 12 3s5 1.6 5 4.2c0 2.9-1.8 6.3-5 6.3z" /><path d="M12 13.5c-1.3 0-2.1-3.3-2.1-6S10.7 3 12 3s2.1 1.8 2.1 4.5-.8 6-2.1 6z" /></>,
  truck: <><path d="M3 6.5h10.5v9H3z" /><path d="M13.5 9.5h3.8l2.7 3v3h-6.5" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="16.8" cy="17.5" r="1.8" /></>,
  shield: <><path d="M12 3.2 5 5.8v5.6c0 4.5 3 7.8 7 9.4 4-1.6 7-4.9 7-9.4V5.8z" /><path d="m9 12 2.2 2.2L15.3 10" /></>,
  heart: <path d="M12 19.5s-7-4.3-7-9.3A3.9 3.9 0 0 1 12 7.8a3.9 3.9 0 0 1 7 2.4c0 5-7 9.3-7 9.3z" />,
  cake: <><path d="M5 20.5h14" /><path d="M6 20.5v-6.8h12v6.8" /><path d="M8 13.7v-3.9h8v3.9" /><path d="M6 16.3c1 .9 2 .9 3 0s2-.9 3 0 2 .9 3 0 2-.9 3 0" /><path d="M12 9.8V7.3" /><path d="M12 5.2c.7-.7.7-1.4 0-2.2-.7.8-.7 1.5 0 2.2z" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16" /><path d="M8.5 3.5v3.5" /><path d="M15.5 3.5v3.5" /></>,
  drag: <><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="M4 12h16" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  minus: <path d="M6 12h12" />,
  plus: <><path d="M12 6v12" /><path d="M6 12h12" /></>,
  slice: <><path d="M4 18.5 12 5l8 13.5z" /><path d="M6.3 14.6h11.4" /><path d="M8.5 10.9h7" /></>,
  pin: <><path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  instagram: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="0.6" fill="currentColor" /></>,
};

export default function LineIcon({ name, size = 22, stroke = 1.4, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {P[name]}
    </svg>
  );
}

/** Stacked-cake logo mark with a small heart, drawn as a single fine line. */
export function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 9.6c-1.5-1.9-4.6-1.2-4.6 1.2 0 2.2 3 3.8 4.6 5 1.6-1.2 4.6-2.8 4.6-5 0-2.4-3.1-3.1-4.6-1.2z" fill="#E83E78" />
      <g stroke="#C92F63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 27.5v-6.2c0-1.4 1-2.3 2.3-2.3h12.4c1.3 0 2.3.9 2.3 2.3v6.2" />
        <path d="M15.5 23.2c1.4 1.3 2.9 1.3 4.3 0s2.8-1.3 4.2 0 2.8 1.3 4.2 0 2.9-1.3 4.3 0" />
        <path d="M10.5 38.5v-8.7c0-1.3 1-2.3 2.3-2.3h22.4c1.3 0 2.3 1 2.3 2.3v8.7" />
        <path d="M10.5 32.3c1.6 1.4 3.3 1.4 4.9 0s3.3-1.4 4.9 0 3.3 1.4 4.9 0 3.3-1.4 4.9 0 3.3 1.4 4.9 0" />
        <path d="M7 38.5h34" />
        <path d="M13 41.5h22" />
      </g>
    </svg>
  );
}
