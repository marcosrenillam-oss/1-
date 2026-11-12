/** The 1% wordmark. `size` is the font size in px. */
export function Logo({ size = 120, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div className={`logo${animate ? ' logo--animate' : ''}`} style={{ fontSize: size }} aria-label="1%" role="img">
      <span className="logo-glow" aria-hidden="true" />
      <span className="logo-one" aria-hidden="true">1</span>
      <span className="logo-pct" aria-hidden="true">%</span>
    </div>
  );
}
