import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { preparaDxf, tipoDaColoreAci } from '../dxf-correzioni';
import { FIXTURES, esiste } from './util';

function dxf(entities: string[], extra: { tables?: string[]; eof?: boolean } = {}): string {
  const r: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032', '0', 'ENDSEC'];
  if (extra.tables) r.push('0', 'SECTION', '2', 'TABLES', ...extra.tables, '0', 'ENDSEC');
  r.push('0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC');
  if (extra.eof !== false) r.push('0', 'EOF');
  return r.join('\r\n');
}
const rett = (layer: string, x0: number, y0: number, w: number, h: number, colore?: number) => ['0', 'LWPOLYLINE', '8', layer, ...(colore ? ['62', String(colore)] : []), '90', '4', '70', '1', '10', String(x0), '20', String(y0), '10', String(x0 + w), '20', String(y0), '10', String(x0 + w), '20', String(y0 + h), '10', String(x0), '20', String(y0 + h)];
const linea = (layer: string, a: [number, number], b: [number, number], colore = 1) => ['0', 'LINE', '8', layer, '62', String(colore), '10', String(a[0]), '20', String(a[1]), '11', String(b[0]), '21', String(b[1])];

describe('correzione automatica dei DXF', () => {
  it('disegno in centimetri, fuori origine, riquadro su un altro layer', () => {
    // riquadro A4 1:200 (39×47 m) disegnato in centimetri a partire da (1000, 2000), su layer "CORNICE"
    const d = preparaDxf(dxf([...rett('CORNICE', 1000, 2000, 3900, 4700), ...linea('MURI', [1100, 2100], [1500, 2100]), ...rett('DOCFA_POLIGONI', 1100, 2100, 400, 300, 1)]));
    expect(d.foglio).toMatchObject({ formato: 'A4', scala: 200, origineInZero: true });
    expect(d.correzioni.join(' ')).toMatch(/Riquadro trovato sul layer «CORNICE»/);
    expect(d.correzioni.join(' ')).toMatch(/centimetri/);
    expect(d.correzioni.join(' ')).toMatch(/vertice in \(0,0\)/);
    const l = d.letto.entita.find((e) => e.tipo === 'linea');
    expect(l && l.tipo === 'linea' ? l.p1 : null).toEqual([1, 1]);
    expect(d.letto.poligoni[0].vertici[0]).toEqual([1, 1]);
  });

  it('oggetti fuori dal riquadro, residui e layer', () => {
    const d = preparaDxf(dxf([...rett('RIQUADRO', 0, 0, 39, 47), ...linea('0', [1, 1], [2, 1]), ...linea('0', [100, 100], [120, 100]), '0', 'HATCH', '8', '0', '0', 'HATCH', '8', '0', '0', 'ACAD_PROXY_ENTITY', '8', '0', ...linea('ARREDI', [3, 3], [4, 4])]));
    expect(d.letto.entita.length).toBe(2);
    const t = d.correzioni.join(' | ');
    expect(t).toMatch(/1 oggetto fuori dal riquadro/);
    expect(t).toMatch(/2 tratteggi/);
    expect(t).toMatch(/oggetti proxy/);
    expect(t).toMatch(/ARREDI/);
  });

  it('poligoni fatti di linee, aperti, doppi e con colori sbagliati', () => {
    const P = 'DOCFA_POLIGONI';
    const d = preparaDxf(dxf([
      ...rett('RIQUADRO', 0, 0, 39, 47),
      // quadrato fatto di 4 linee, colore 12 (rosso scuro) → A
      ...linea(P, [1, 1], [5, 1], 12), ...linea(P, [5, 1], [5, 5], 12), ...linea(P, [1, 5], [5, 5], 12), ...linea(P, [1, 5], [1, 1], 12),
      // polilinea aperta (B)
      '0', 'LWPOLYLINE', '8', P, '62', '2', '90', '3', '70', '0', '10', '10', '20', '10', '10', '14', '20', '10', '10', '14', '20', '14',
      // doppione del poligono C
      ...rett(P, 20, 20, 3, 3, 3), ...rett(P, 20, 20, 3, 3, 3),
    ]));
    expect(d.letto.poligoni.map((p) => p.tipo).sort()).toEqual(['A', 'B', 'C']);
    expect(d.correzioni.join(' ')).toMatch(/ricostruito unendo linee/);
    expect(d.correzioni.join(' ')).toMatch(/aperto chiuso/);
    expect(d.correzioni.join(' ')).toMatch(/doppio eliminato/);
    expect(d.problemi.join(' ')).toMatch(/colore 12 → A/);
  });

  it('file interrotto e BOM', () => {
    const d = preparaDxf('﻿' + dxf([...rett('RIQUADRO', 0, 0, 39, 47), ...linea('0', [1, 1], [2, 2])], { eof: false }));
    expect(d.correzioni.join(' ')).toMatch(/BOM/);
    expect(d.correzioni.join(' ')).toMatch(/incompleto/);
    expect(d.letto.entita.length).toBe(1);
  });

  it('DXF binario: messaggio chiaro', () => {
    expect(() => preparaDxf('AutoCAD Binary DXF\r\n\u001a\u0000')).toThrow(/binario/);
  });

  it('colori AutoCAD per tinta', () => {
    expect(tipoDaColoreAci(1)).toBe('A');
    expect(tipoDaColoreAci(50)).toBe('B'); // giallo
    expect(tipoDaColoreAci(90)).toBe('C'); // verde
    expect(tipoDaColoreAci(130)).toBe('D'); // ciano
    expect(tipoDaColoreAci(170)).toBe('E'); // blu
    expect(tipoDaColoreAci(210)).toBe('F'); // magenta
    expect(tipoDaColoreAci(253)).toBe('H');
  });

  const p = join(FIXTURES, 'NCV002/planimetria.dxf');
  it.skipIf(!esiste(p))('il DXF accettato da Docfa resta invariato', () => {
    const d = preparaDxf(readFileSync(p, 'latin1'));
    expect(d.problemi).toEqual([]);
    expect(d.letto.poligoni.length).toBe(1);
    expect(d.letto.entita.filter((e) => e.spessore > 0).length).toBe(119);
  });
});
