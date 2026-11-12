import { useMemo } from 'react';

/** Radial burst of shards + expanding rings. Pure CSS animation. */
export function Celebration() {
  const shards = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        a: (360 / 36) * i + (i % 2 ? 4 : -4),
        d: 120 + ((i * 53) % 110),
        delay: (i % 6) * 30,
        lime: i % 3 !== 0,
        len: 10 + ((i * 7) % 16),
      })),
    [],
  );
  return (
    <div className="celebration" aria-hidden="true">
      <span className="ring ring-1" />
      <span className="ring ring-2" />
      <span className="ring ring-3" />
      {shards.map((s, i) => (
        <span
          key={i}
          className={`shard${s.lime ? ' shard--lime' : ''}`}
          style={{
            ['--a' as string]: `${s.a}deg`,
            ['--dist' as string]: `${s.d}px`,
            ['--delay' as string]: `${s.delay}ms`,
            ['--len' as string]: `${s.len}px`,
          }}
        />
      ))}
    </div>
  );
}
