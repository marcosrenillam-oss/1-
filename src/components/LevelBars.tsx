export function LevelBars({ level }: { level: number }) {
  return (
    <span className="level-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'on' : ''} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}
