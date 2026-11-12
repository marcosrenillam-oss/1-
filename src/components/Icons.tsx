type P = { className?: string };

export const IconClose = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const IconArrow = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path className="draw" d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
  </svg>
);

export const IconCross = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path className="draw" d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" pathLength={1} />
  </svg>
);

export const IconRetry = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
