import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { leggiDxf, rilevaFoglio, puntiBulge, righeMtext } from '../dxf';
import { FIXTURES, esiste } from './util';

/** Costruisce un DXF minimo (coppie codice/valore) con sezioni opzionali. */
function dxf(parti: { tables?: string[]; blocks?: string[]; entities: string[] }): string {
  const r: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC'];
  if (parti.tables) r.push('0', 'SECTION', '2', 'TABLES', ...parti.tables, '0', 'ENDSEC');
  if (parti.blocks) r.push('0', 'SECTION', '2', 'BLOCKS', ...parti.blocks, '0', 'ENDSEC');
  r.push('0', 'SECTION', '2', 'ENTITIES', ...parti.entities, '0', 'ENDSEC', '0', 'EOF');
  return r.join('\r\n');
}

const RIQUADRO_A4_200 = ['0', 'LWPOLYLINE', '8', 'RIQUADRO', '90', '4', '70', '1', '10', '0', '20', '0', '10', '39', '20', '0', '10', '39', '20', '47', '10', '0', '20', '47'];

describe('DXF: campione NCV002', () => {
  const p = join(FIXTURES, 'NCV002/planimetria.dxf');
  it.skipIf(!esiste(p))('legge entità, poligono e riquadro', () => {
    const d = leggiDxf(readFileSync(p, 'latin1'));
    expect(d.versione).toBe('AC1015');
    const tipi = d.entita.reduce<Record<string, number>>((acc, e) => { acc[e.tipo] = (acc[e.tipo] ?? 0) + 1; return acc; }, {});
    expect(tipi).toEqual({ linea: 174, testo: 8, cerchio: 1 });
    expect(d.entita.filter((e) => e.spessore > 0).length).toBe(119);
    const piano = d.entita.find((e) => e.tipo === 'testo' && e.testo === 'PIANO PRIMO');
    expect(piano?.tipo === 'testo' ? piano.altezza : null).toBe(0.5);
    expect(d.riquadro?.length).toBe(4);
    expect(d.poligoni.length).toBe(1);
    expect(d.poligoni[0].tipo).toBe('A');
    expect(d.poligoni[0].altezzaValida).toBe(true);
    expect(d.poligoni[0].vertici.length).toBe(13);
    expect(d.layers['DOCFA_POLIGONI'].spento).toBe(true);
    const f = rilevaFoglio(d);
    expect(f).toMatchObject({ formato: 'A4', scala: 200, larghezza: 39, altezza: 47, origineInZero: true });
  });
});

describe('DXF: entità sintetiche', () => {
  it('rileva formato e scala dal riquadro', () => {
    const casi: [number, number, string, number][] = [[39, 47, 'A4', 200], [19.5, 23.5, 'A4', 100], [97.5, 117.5, 'A4', 500], [52, 81, 'A3', 200], [26, 40.5, 'A3', 100], [130, 202.5, 'A3', 500]];
    for (const [w, h, formato, scala] of casi) {
      const d = dxf({ entities: ['0', 'LINE', '8', 'RIQUADRO', '10', '0', '20', '0', '11', String(w), '21', '0', '0', 'LINE', '8', 'riquadro', '10', String(w), '20', '0', '11', String(w), '21', String(h), '0', 'LINE', '8', 'RIQUADRO', '10', String(w), '20', String(h), '11', '0', '21', String(h)] });
      expect(rilevaFoglio(d), `${w}x${h}`).toMatchObject({ formato, scala });
    }
    expect(() => rilevaFoglio(dxf({ entities: ['0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1', '21', '1'] }))).toThrow(/RIQUADRO/);
    expect(() => rilevaFoglio(dxf({ entities: ['0', 'LINE', '8', 'RIQUADRO', '10', '0', '20', '0', '11', '10', '21', '10'] }))).toThrow(/non corrisponde/);
  });

  it('poligoni: tipo dal colore, chiusura, vertice doppio', () => {
    const pol = (colore: string, chiusa: boolean) => ['0', 'LWPOLYLINE', '8', 'DOCFA_POLIGONI', '62', colore, '90', '4', '70', chiusa ? '1' : '0', '10', '0', '20', '0', '10', '4', '20', '0', '10', '4', '20', '3', '10', '0', '20', '0'];
    const d = leggiDxf(dxf({ entities: [...RIQUADRO_A4_200, ...pol('3', true), ...pol('8', false)] }));
    expect(d.poligoni.length).toBe(2);
    expect(d.poligoni[0]).toEqual({ tipo: 'C', vertici: [[0, 0], [4, 0], [4, 3]], altezzaValida: true });
    // colore 8 = A2, lettera H nel file NTF di Docfa
    expect(d.poligoni[1]).toEqual({ tipo: 'H', vertici: [[0, 0], [4, 0], [4, 3]], altezzaValida: true });
    expect(d.entita.length).toBe(0);
  });

  it('layer spenti o congelati, spazio carta e thickness/larghezza', () => {
    const tables = ['0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'SPENTO', '70', '0', '62', '-7', '0', 'LAYER', '2', 'GELO', '70', '1', '62', '7', '0', 'LAYER', '2', 'MURI', '70', '0', '62', '3', '0', 'ENDTAB'];
    const entities = [
      '0', 'LINE', '8', 'SPENTO', '10', '0', '20', '0', '11', '1', '21', '1',
      '0', 'LINE', '8', 'GELO', '10', '0', '20', '0', '11', '1', '21', '1',
      '0', 'LINE', '8', 'MURI', '67', '1', '10', '0', '20', '0', '11', '1', '21', '1',
      '0', 'LINE', '8', 'MURI', '39', '0.07', '10', '0', '20', '0', '11', '1', '21', '1',
      '0', 'LWPOLYLINE', '8', 'MURI', '90', '2', '70', '0', '43', '0.1', '10', '0', '20', '0', '10', '1', '20', '1',
    ];
    const d = leggiDxf(dxf({ tables, entities }));
    expect(d.entita.length).toBe(2);
    expect(d.entita[0]).toMatchObject({ tipo: 'linea', layer: 'MURI', colore: 3, spessore: 0.07 });
    expect(d.entita[1]).toMatchObject({ tipo: 'polilinea', spessore: 0.1, chiusa: false });
  });

  it('bulge: un semicerchio diventa un arco di punti', () => {
    // bulge 1 = 180° antiorari: da (0,0) a (2,0) l'arco passa sotto la corda (y < 0)
    const pts = puntiBulge([0, 0], [2, 0], 1);
    expect(pts[pts.length - 1]).toEqual([2, 0]);
    for (const p of pts) expect(Math.abs(Math.hypot(p[0] - 1, p[1]) - 1)).toBeLessThan(1e-9);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(-1, 3);
    const neg = puntiBulge([0, 0], [2, 0], -1);
    expect(Math.max(...neg.map((p) => p[1]))).toBeCloseTo(1, 3);
    // bulge piccolo: arco di 90° (tan(22,5°)) con centro fuori dalla corda
    const q = puntiBulge([0, 0], [2, 0], Math.tan(Math.PI / 8));
    for (const p of q) expect(Math.abs(Math.hypot(p[0] - 1, p[1] - 1) - Math.SQRT2)).toBeLessThan(1e-9);
    expect(puntiBulge([0, 0], [2, 0], 0)).toEqual([[2, 0]]);
    const d = leggiDxf(dxf({ entities: ['0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0', '10', '0', '20', '0', '42', '1', '10', '2', '20', '0'] }));
    expect(d.entita[0].tipo).toBe('polilinea');
    if (d.entita[0].tipo === 'polilinea') expect(d.entita[0].punti.length).toBeGreaterThan(8);
  });

  it('POLYLINE/VERTEX, CIRCLE, ARC, TEXT con allineamento', () => {
    const entities = [
      '0', 'POLYLINE', '8', '0', '66', '1', '70', '1', '0', 'VERTEX', '8', '0', '10', '0', '20', '0', '0', 'VERTEX', '8', '0', '10', '1', '20', '0', '0', 'VERTEX', '8', '0', '10', '1', '20', '1', '0', 'SEQEND',
      '0', 'CIRCLE', '8', '0', '10', '5', '20', '5', '40', '2',
      '0', 'ARC', '8', '0', '10', '5', '20', '5', '40', '2', '50', '30', '51', '120',
      '0', 'TEXT', '8', '0', '10', '1', '20', '1', '40', '0.3', '1', 'rip.', '50', '90',
      '0', 'TEXT', '8', '0', '10', '1', '20', '1', '11', '2', '21', '2', '40', '0.3', '1', 'centro', '72', '1', '73', '2',
    ];
    const d = leggiDxf(dxf({ entities }));
    expect(d.entita.map((e) => e.tipo)).toEqual(['polilinea', 'cerchio', 'arco', 'testo', 'testo']);
    expect(d.entita[0]).toMatchObject({ punti: [[0, 0], [1, 0], [1, 1]], chiusa: true });
    expect(d.entita[1]).toMatchObject({ centro: [5, 5], raggio: 2 });
    expect(d.entita[2]).toMatchObject({ inizio: 30, fine: 120 });
    expect(d.entita[3]).toMatchObject({ testo: 'rip.', punto: [1, 1], altezza: 0.3, rotazione: 90, allineamentoH: 'sinistra', allineamentoV: 'base' });
    expect(d.entita[4]).toMatchObject({ testo: 'centro', punto: [2, 2], allineamentoH: 'centro', allineamentoV: 'medio' });
  });

  it('MTEXT: righe, codici di formattazione e attacco', () => {
    expect(righeMtext('{\\fArial|b1;PIANO}\\PTERRA \\H2x;h %%d 270')).toEqual(['PIANO', 'TERRA h ° 270']);
    const entities = ['0', 'MTEXT', '8', '0', '10', '10', '20', '20', '40', '0.5', '71', '1', '1', 'A\\PB'];
    const d = leggiDxf(dxf({ entities }));
    expect(d.entita.length).toBe(2);
    expect(d.entita[0]).toMatchObject({ tipo: 'testo', testo: 'A', altezza: 0.5, allineamentoH: 'sinistra', allineamentoV: 'base' });
    if (d.entita[0].tipo === 'testo' && d.entita[1].tipo === 'testo') {
      // prima riga: la cima delle maiuscole sta sul punto di inserimento → base a 20 − 0,5
      expect(d.entita[0].punto[1]).toBeCloseTo(19.5, 6);
      expect(d.entita[1].punto[1]).toBeLessThan(19.5);
      expect(d.entita[1].testo).toBe('B');
    }
  });

  it('INSERT: esplode i blocchi con traslazione, scala e rotazione', () => {
    const blocks = ['0', 'BLOCK', '8', '0', '2', 'PORTA', '10', '1', '20', '1', '0', 'LINE', '8', '0', '62', '0', '10', '1', '20', '1', '11', '3', '21', '1', '0', 'LINE', '8', 'INFISSI', '10', '1', '20', '1', '11', '1', '20', '2', '0', 'ENDBLK'];
    const entities = ['0', 'INSERT', '8', 'MURI', '62', '5', '2', 'PORTA', '10', '10', '20', '10', '41', '2', '42', '2', '50', '90'];
    const d = leggiDxf(dxf({ blocks, entities }));
    expect(d.entita.length).toBe(2);
    const l = d.entita[0];
    expect(l.tipo).toBe('linea');
    if (l.tipo === 'linea') {
      // il punto base (1,1) va in (10,10); (3,1) → scala 2 → (4,0) relativo → ruotato 90° → (0,4) → (10,14)
      expect(l.p1[0]).toBeCloseTo(10, 9);
      expect(l.p1[1]).toBeCloseTo(10, 9);
      expect(l.p2[0]).toBeCloseTo(10, 9);
      expect(l.p2[1]).toBeCloseTo(14, 9);
      expect(l.layer).toBe('MURI'); // layer 0 nel blocco → layer dell'INSERT
      expect(l.colore).toBe(5); // BYBLOCK → colore dell'INSERT
    }
    expect(d.entita[1].layer).toBe('INFISSI');
    // blocco inesistente: nessuna entità
    expect(leggiDxf(dxf({ entities: ['0', 'INSERT', '8', '0', '2', 'NIENTE', '10', '0', '20', '0'] })).entita.length).toBe(0);
  });
});
