import { glyphCount, hasGlyph, RichText } from './Glyph';

/** A word (letters, longer than 3 chars) gets a smaller type size than numbers/short codes. */
function isWord(text: string): boolean {
  return !hasGlyph(text) && text.length > 3 && /\p{L}/u.test(text);
}

function Cell({ text, wordRow }: { text: string; wordRow: boolean }) {
  if (text === '?') {
    return (
      <span className="vcell vcell--missing" aria-label="falta">
        ?
      </span>
    );
  }
  let cls: string;
  if (!hasGlyph(text)) cls = wordRow ? 'vcell--word' : 'vcell--text';
  else if (text.includes('{g-')) cls = 'vcell--grid';
  else {
    const n = glyphCount(text);
    cls = n > 3 ? 'vcell--many' : n > 1 ? 'vcell--few' : 'vcell--one';
  }
  return (
    <span className={`vcell ${cls}`}>
      <RichText text={text} />
    </span>
  );
}

function rowClass(raw: string, cells: number): string {
  let cls = 'visual-row';
  if (raw.replace(/\{[^}]*\}/g, 'x').length > 20) cls += ' visual-row--dense';
  if (cells > 6) cls += ' visual-row--long';
  return cls;
}

/** Renders a question's visual rows. Multi-row blocks align as a matrix. */
export function VisualBlock({ rows }: { rows: string[] }) {
  const cells = rows.map((r) => r.trim().split(/\s+/));
  const isMatrix = rows.length > 1 && cells.every((c) => c.length === cells[0].length);
  if (isMatrix) {
    const wordGrid = cells.flat().some(isWord);
    return (
      <div className="visual visual--matrix" style={{ gridTemplateColumns: `repeat(${cells[0].length}, auto)` }}>
        {cells.flat().map((c, i) => (
          <Cell key={i} text={c} wordRow={wordGrid} />
        ))}
      </div>
    );
  }
  return (
    <div className="visual">
      {cells.map((row, r) => {
        const wordRow = row.some(isWord);
        return (
          <div className={rowClass(rows[r], row.length)} key={r}>
            {row.map((c, i) => (
              <Cell key={i} text={c} wordRow={wordRow} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
