import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Chip } from '../components/Chip';
import type { CoreState } from '../engine/core';

/** Your chip from «Tu Núcleo», as an image the game boards can draw. */
const cache = new Map<string, Promise<HTMLImageElement>>();
export function chipImage(core: CoreState): Promise<HTMLImageElement> {
  const key = JSON.stringify([core.chip, core.slots, core.color, core.material, core.pins]);
  let p = cache.get(key);
  if (!p) {
    p = new Promise((resolve, reject) => {
      // Render off-screen with the client renderer (no server bundle needed).
      // Deferred so flushSync never runs inside a React effect.
      setTimeout(() => {
        const host = document.createElement('div');
        const root = createRoot(host);
        flushSync(() => root.render(createElement(Chip, { core, className: '' })));
        let svg = host.innerHTML;
        root.unmount();
        if (!svg.startsWith('<svg')) return reject(new Error('chip image: empty render'));
        if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('chip image: load failed'));
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      }, 0);
    });
    cache.set(key, p);
  }
  return p;
}
