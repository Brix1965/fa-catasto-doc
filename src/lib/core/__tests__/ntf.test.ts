import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generaNtf, leggiNtf, dxfToNtf, areaDaNtf } from '../ntf';
import { decode1252 } from '../bytes';

const ROOT = join(process.cwd(), 'fixtures-private');

describe('NTF', () => {
  it('rilegge i file reali con lo stesso numero di poligoni e aree coerenti', () => {
    for (const f of ['NCV002/N0000007.001', 'NCV059/N0000135.001', 'NCV081/N0000199.001']) {
      const p = join(ROOT, f);
      if (!existsSync(p)) continue;
      const ntf = leggiNtf(new Uint8Array(readFileSync(p)));
      expect(ntf.poligoni.length).toBeGreaterThan(0);
      for (const pg of ntf.poligoni) {
        const area = areaDaNtf(pg.punti, 200);
        // l'area scritta da Docfa è calcolata dalle stesse coordinate intere
        expect(Math.abs(area * 100 - pg.areaCent)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('rigenera N0000007.001 dal DXF di NCV002 (coordinate entro 2 unità, struttura identica)', () => {
    const p = join(ROOT, 'NCV002/N0000007.001');
    const dxfPath = join(ROOT, 'NCV002/planimetria.dxf');
    if (!existsSync(p) || !existsSync(dxfPath)) return;
    const orig = new Uint8Array(readFileSync(p));
    const dxf = readFileSync(dxfPath, 'latin1');
    // vertici della LWPOLYLINE sul layer DOCFA_POLIGONI (parser minimale per il test)
    const lines = dxf.split(/\r?\n/);
    const i = lines.indexOf('LWPOLYLINE');
    const vertici: [number, number][] = [];
    let x: number | null = null;
    for (let k = i + 1; k < lines.length - 1; k += 2) {
      const code = lines[k].trim();
      if (code === '0') break;
      if (code === '10') x = Number(lines[k + 1]);
      if (code === '20' && x !== null) { vertici.push([x, Number(lines[k + 1])]); x = null; }
    }
    expect(vertici.length).toBe(14);
    const originale = leggiNtf(orig);
    const nostro = leggiNtf(generaNtf(7, 1, { formato: 'A4', scala: 200 }, [{ tipo: 'A', vertici: vertici.slice(0, 13), altezzaValida: true }]));
    expect(nostro.poligoni.length).toBe(1);
    expect(nostro.poligoni[0].punti.length).toBe(originale.poligoni[0].punti.length);
    for (let k = 0; k < originale.poligoni[0].punti.length; k++) {
      const [ox, oy] = originale.poligoni[0].punti[k];
      const [nx, ny] = nostro.poligoni[0].punti[k];
      expect(Math.abs(ox - nx), `x vertice ${k}`).toBeLessThanOrEqual(2);
      expect(Math.abs(oy - ny), `y vertice ${k}`).toBeLessThanOrEqual(2);
    }
    expect(Math.abs(nostro.poligoni[0].areaCent - originale.poligoni[0].areaCent)).toBeLessThanOrEqual(10);
    // struttura: stesse righe, a meno delle cifre delle coordinate/aree
    const norm = (b: Uint8Array) => decode1252(b).replace(/\d/g, '#');
    expect(norm(generaNtf(7, 1, { formato: 'A4', scala: 200 }, [{ tipo: 'A', vertici: vertici.slice(0, 13), altezzaValida: true }]))).toBe(norm(orig));
  });

  it('trasformazione DXF→NTF', () => {
    expect(dxfToNtf(0, 0, { formato: 'A4', scala: 200 })).toEqual([9, 151]);
  });
});
