// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, expect, it } from 'vitest';
import { preparaDxf } from '../dxf-correzioni';
import { componiPlanimetria, type Cartiglio } from '../planimetria';
import { ampiezzaArco, ritagliaSegmento } from '../bitmap';

/** DXF minimo: riquadro A4 1:200 (39×47 m) e le entità date (codice → valore, in ordine). */
function dxf(entita: [string, [number, string][]][]): string {
  const r: string[] = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', 'RIQUADRO', '90', '4', '70', '1'];
  for (const [x, y] of [[0, 0], [39, 0], [39, 47], [0, 47]]) r.push('10', String(x), '20', String(y));
  for (const [tipo, g] of entita) { r.push('0', tipo); for (const [c, v] of g) r.push(String(c), v); }
  r.push('0', 'ENDSEC', '0', 'EOF');
  return r.join('\n');
}
const cartiglio = { ufficio: '', comune: '', via: '', civico: '', foglio: '1', particella: '1', compilatore: '', albo: '', provincia: '', numeroAlbo: '', scheda: 1, scala: 200 } as unknown as Cartiglio;

describe('DXF guasti: niente blocchi del programma', () => {
  it('angoli e ritaglio', () => {
    expect(ampiezzaArco(0, 90)).toBe(90);
    expect(ampiezzaArco(350, 10)).toBe(20);
    expect(ampiezzaArco(30, 30)).toBe(360);
    expect(ampiezzaArco(1e17, 0)).toBeGreaterThan(0);
    expect(ritagliaSegmento(-1e9, 5, 10, 5, 0, 0, 100, 100)).toEqual([0, 5, 10, 5]);
    expect(ritagliaSegmento(-10, -10, -5, -5, 0, 0, 100, 100)).toBeNull();
  });

  it('coordinate non numeriche, archi con angoli enormi, linee lunghissime', async () => {
    const testo = dxf([
      ['LWPOLYLINE', [[8, '0'], [90, '3'], [70, '0'], [10, '1,5'], [20, '2'], [10, '5'], [20, '5'], [10, '8'], [20, '5']]],
      ['ARC', [[8, '0'], [10, '10'], [20, '10'], [40, '2'], [50, '1e17'], [51, '0']]],
      ['ARC', [[8, '0'], [10, '20'], [20, '20'], [40, '1e9'], [50, '0'], [51, '90']]],
      ['LINE', [[8, '0'], [10, '-1e9'], [20, '5'], [11, '10'], [21, '5']]],
    ]);
    const t0 = Date.now();
    const p = preparaDxf(testo);
    const poli = p.letto.entita.find((e) => e.tipo === 'polilinea');
    expect(poli && poli.tipo === 'polilinea' ? poli.punti.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) : true).toBe(true);
    await componiPlanimetria({ dxf: p.letto, foglio: { formato: 'A4', scala: 200 }, cartiglio });
    expect(Date.now() - t0).toBeLessThan(15000);
  }, 30000);
});

describe('DXF: casi particolari letti bene', () => {
  it('MTEXT con sottolineato: il testo resta', async () => {
    const { righeMtext } = await import('../dxf');
    expect(righeMtext('\\LCamera\\l \\C1;letto')).toEqual(['Camera letto']);
  });
  it('blocco ruotato dentro un blocco specchiato', async () => {
    const { leggiDxf } = await import('../dxf');
    const t = ['0', 'SECTION', '2', 'BLOCKS',
      '0', 'BLOCK', '2', 'INNER', '10', '0', '20', '0', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1', '21', '0', '0', 'ENDBLK',
      '0', 'BLOCK', '2', 'OUTER', '10', '0', '20', '0', '0', 'INSERT', '8', '0', '2', 'INNER', '10', '0', '20', '0', '50', '90', '0', 'ENDBLK',
      '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'INSERT', '8', '0', '2', 'OUTER', '10', '10', '20', '10', '41', '-1', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const l = leggiDxf(t).entita[0];
    expect(l.tipo).toBe('linea');
    if (l.tipo === 'linea') {
      expect(l.p1[0]).toBeCloseTo(10); expect(l.p1[1]).toBeCloseTo(10);
      expect(l.p2[0]).toBeCloseTo(10); expect(l.p2[1]).toBeCloseTo(11);
    }
  });
});

describe('DXF: estrusione verso il basso', () => {
  it('ARC con 230 = −1: X rovesciata come in AutoCAD', async () => {
    const { leggiDxf } = await import('../dxf');
    const t = ['0', 'SECTION', '2', 'ENTITIES', '0', 'ARC', '8', '0', '10', '-5', '20', '3', '40', '1', '50', '0', '51', '90', '230', '-1', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const a = leggiDxf(t).entita[0];
    expect(a.tipo).toBe('arco');
    if (a.tipo === 'arco') {
      expect(a.centro[0]).toBeCloseTo(5); expect(a.centro[1]).toBeCloseTo(3);
      // da 0°-90° nell'OCS a 90°-180° nel disegno
      expect(((a.inizio % 360) + 360) % 360).toBeCloseTo(90); expect(((a.fine % 360) + 360) % 360).toBeCloseTo(180);
    }
  });
});
