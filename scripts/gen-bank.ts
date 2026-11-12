// Regenerates src/data/questions/generated.json (deterministic).
import { writeFileSync } from 'node:fs';
import { generateAll } from '../src/data/gen';

const qs = generateAll();
writeFileSync(new URL('../src/data/questions/generated.json', import.meta.url), JSON.stringify(qs, null, 0).replace(/\},\{/g, '},\n{') + '\n');
const by: Record<string, number> = {};
for (const q of qs) by[q.mode] = (by[q.mode] ?? 0) + 1;
console.log('generated', qs.length, by);
