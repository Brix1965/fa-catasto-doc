// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, it, expect } from 'vitest';
import { stileLinea, tratteggiaPercorso, SCHEMA_MM } from '../tipi-linea';
import { leggiDxf } from '../dxf';
import { disegnaEntita } from '../planimetria';
import { Bitmap } from '../bitmap';
import { dxfToPx } from '../../ntf';

describe('tipi di linea', () => {
  it('riconosce lo stile dallo schema LTYPE o dal nome', () => {
    const schemi = { NASCOSTA: [0.25, -0.125], HIDDEN: [6.35, -3.175], DASHDOT: [0.5, -0.25, 0, -0.25], CENTER: [31.75, -6.35, 6.35, -6.35], STRANA: [1, 2] };
    expect(stileLinea('CONTINUOUS', schemi)).toBe('continua');
    expect(stileLinea('ByLayer', schemi)).toBe('continua');
    expect(stileLinea('nascosta', schemi)).toBe('tratteggio');
    expect(stileLinea('HIDDEN', schemi)).toBe('tratteggio');
    expect(stileLinea('DASHDOT', schemi)).toBe('trattopunto');
    expect(stileLinea('CENTER', schemi)).toBe('trattopunto');
    expect(stileLinea('STRANA', schemi)).toBe('continua');
    // senza tabella: dal nome
    expect(stileLinea('TRATTOPUNTOX2')).toBe('trattopunto');
    expect(stileLinea('TRATTEGGIO')).toBe('tratteggio');
  });

  it('il percorso aperto comincia e finisce con un tratto pieno', () => {
    const s = [12, -6];
    const t = tratteggiaPercorso([[0, 0], [100, 0]], false, s);
    expect(t[0][0]).toEqual([0, 0]);
    expect(t[t.length - 1][t[t.length - 1].length - 1][0]).toBeCloseTo(100, 6);
    // 100 = n × 18 × f + 12 × f, n = 5 → f ≈ 0,98
    expect(t.length).toBe(6);
    // un tratto a cavallo di un angolo conserva il vertice
    const a = tratteggiaPercorso([[0, 0], [10, 0], [10, 50]], false, s);
    expect(a[0]).toContainEqual([10, 0]);
    // troppo corto: continuo
    expect(tratteggiaPercorso([[0, 0], [5, 0]], false, s)).toEqual([[[0, 0], [5, 0]]]);
  });

  it('nella planimetria i tratti hanno misure uniformi sul foglio, qualunque sia lo schema del DXF', () => {
    // HIDDEN con tratti di 6,35 m in un disegno in metri: prima diventava una linea continua
    const dxf = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'HIDDEN', '70', '0', '3', '', '72', '65', '73', '2', '40', '9.525', '49', '6.35', '49', '-3.175', '0', 'ENDTAB', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', '0', '6', 'HIDDEN', '10', '2', '20', '10', '11', '12', '21', '10', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const l = leggiDxf(dxf);
    expect(l.tipiLinea?.HIDDEN).toEqual([6.35, -3.175]);
    const foglio = { formato: 'A4' as const, scala: 200 };
    const bm = new Bitmap(1654, 2340);
    disegnaEntita(bm, l.entita, foglio, l.tipiLinea);
    const [x0, y] = dxfToPx(2, 10, foglio).map(Math.round), [x1] = dxfToPx(12, 10, foglio).map(Math.round);
    const runs: [boolean, number][] = [];
    for (let x = x0; x <= x1; x++) { const n = bm.getPixel(x, y); if (runs.length && runs[runs.length - 1][0] === n) runs[runs.length - 1][1]++; else runs.push([n, 1]); }
    const pieni = runs.filter((r) => r[0]).map((r) => r[1]), vuoti = runs.filter((r) => !r[0]).map((r) => r[1]);
    const mm = 200 / 25.4;
    expect(pieni.length).toBeGreaterThan(20);
    for (const p of pieni) expect(Math.abs(p - SCHEMA_MM.tratteggio[0] * mm)).toBeLessThanOrEqual(2);
    for (const v of vuoti) expect(Math.abs(v + SCHEMA_MM.tratteggio[1] * mm)).toBeLessThanOrEqual(2);
  });
});
