import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS } from './documents';
import { LegalDocument, parseLegal } from './markdown';

const read = (file: string) =>
  readFileSync(path.join(__dirname, '..', '..', 'content', 'legal', file), 'utf8');

describe('HU-017 Textos legales', () => {
  it('interpreta títulos, notas, listas, tablas, negritas, enlaces y correos sin HTML', () => {
    const blocks = parseLegal(
      [
        '# Título',
        '> Versión provisional.',
        '## 1. Sección',
        'Texto con **negrita** y <hola@correo.co>.',
        '- uno',
        '- dos',
        '',
        '1.  primero',
        '',
        '2.  segundo',
        '| Dato | Tiempo |',
        '| --- | --- |',
        '| Cuenta | 30 días |',
        '<script>alert(1)</script>',
      ].join('\n'),
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      'h1',
      'note',
      'h2',
      'p',
      'ul',
      'ol',
      'table',
      'p',
    ]);
    expect(blocks[5]).toEqual({ kind: 'ol', items: ['primero', 'segundo'] });
    expect(blocks[6]).toEqual({
      kind: 'table',
      header: true,
      rows: [
        ['Dato', 'Tiempo'],
        ['Cuenta', '30 días'],
      ],
    });
    const { container } = render(<LegalDocument markdown={'Hola <script>x</script> **ya**'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('ya').tagName).toBe('STRONG');
  });

  it.each(Object.entries(LEGAL_DOCUMENTS))(
    'el documento %s existe, tiene título, versión y enlaces internos válidos',
    (slug, document) => {
      const markdown = read(document.file);
      render(<LegalDocument markdown={markdown} />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(markdown).toMatch(/Versión 0\.1\.0/);
      for (const [, href] of markdown.matchAll(/\]\((\/[^)]+)\)/g)) {
        expect(Object.keys(LEGAL_DOCUMENTS).map((key) => `/legal/${key}`)).toContain(href);
      }
      expect(slug).toMatch(/^[a-z-]+$/);
    },
  );

  it('la política de privacidad muestra sus tablas (responsable, encargados y plazos)', () => {
    render(<LegalDocument markdown={read('privacidad.md')} />);
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(3);
    expect(within(tables[0]).getByText('NIT 901.845.372-1')).toBeInTheDocument();
  });
});
