import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Lector mínimo de los textos legales (apps/web/content/legal/*.md, exportados del Word que
 * entregó asesoría jurídica). Solo entiende lo que esos documentos usan: títulos, párrafos,
 * listas, notas, tablas, negritas, enlaces y correos. No interpreta HTML: el texto se escapa.
 */
export type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p' | 'note'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; rows: string[][]; header: boolean };

export function parseLegal(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r/g, '').split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: (['h1', 'h2', 'h3'] as const)[heading[1].length - 1], text: heading[2] });
    } else if (line.startsWith('>')) {
      flush();
      blocks.push({ kind: 'note', text: line.replace(/^>\s*/, '') });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const text = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else if (line.startsWith('|')) {
      flush();
      if (/^\|[\s|:-]+\|$/.test(line)) {
        // Separador: si la fila anterior trae texto, es el encabezado de la tabla.
        if (last?.kind === 'table' && last.rows.length === 1) last.header = true;
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      if (cells.every((cell) => !cell)) continue; // encabezado vacío del Word
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells], header: false });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<([^>\s]+@[^>\s]+)>/g;

/** Negritas, enlaces y correos; el resto es texto plano. */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = match.index;
    if (match[1]) parts.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2]) {
      const href = match[3];
      parts.push(
        href.startsWith('/') ? (
          <Link key={key} href={href} className="font-bold text-brand underline">
            {match[2]}
          </Link>
        ) : (
          <a
            key={key}
            href={href}
            className="font-bold text-brand underline"
            rel="noopener noreferrer"
          >
            {match[2]}
          </a>
        ),
      );
    } else if (match[4])
      parts.push(
        <a key={key} href={`mailto:${match[4]}`} className="font-bold text-brand underline">
          {match[4]}
        </a>,
      );
    last = key + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function LegalDocument({ markdown }: { markdown: string }) {
  return (
    <article className="flex flex-col gap-4 text-[15px] leading-relaxed">
      {parseLegal(markdown).map((block, index) => {
        switch (block.kind) {
          case 'h1':
            return (
              <h1 key={index} className="font-display text-3xl leading-tight font-bold">
                <Inline text={block.text} />
              </h1>
            );
          case 'h2':
            return (
              <h2 key={index} className="mt-4 font-display text-xl font-bold">
                <Inline text={block.text} />
              </h2>
            );
          case 'h3':
            return (
              <h3 key={index} className="mt-2 font-bold">
                <Inline text={block.text} />
              </h3>
            );
          case 'note':
            return (
              <p
                key={index}
                role="note"
                className="rounded-field bg-warn-bg px-3.5 py-3 text-warn-ink"
              >
                <Inline text={block.text} />
              </p>
            );
          case 'ul':
          case 'ol': {
            const List = block.kind;
            return (
              <List
                key={index}
                className={`flex flex-col gap-2 pl-6 ${block.kind === 'ul' ? 'list-disc' : 'list-decimal'}`}
              >
                {block.items.map((item, i) => (
                  <li key={i}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case 'table':
            return (
              <div key={index} className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm [overflow-wrap:anywhere]">
                  {block.header ? (
                    <thead>
                      <tr className="border-b border-line">
                        {block.rows[0].map((cell, j) => (
                          <th key={j} scope="col" className="py-2 pr-3 font-bold">
                            <Inline text={cell} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {block.rows.slice(block.header ? 1 : 0).map((row, i) => (
                      <tr key={i} className="border-b border-line align-top">
                        {row.map((cell, j) =>
                          j === 0 && !block.header ? (
                            <th key={j} scope="row" className="w-2/5 py-2 pr-3 font-bold">
                              <Inline text={cell} />
                            </th>
                          ) : (
                            <td key={j} className="py-2 pr-3">
                              <Inline text={cell} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={index}>
                <Inline text={block.text} />
              </p>
            );
        }
      })}
    </article>
  );
}
