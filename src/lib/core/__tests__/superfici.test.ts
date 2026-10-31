import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decompilaDocumento } from '../decompile';
import { leggiNtf } from '../ntf';
import { ambientiDaPoligoni, superficiLorde, sincronizzaDaPoligoni } from '../superfici';
import type { Poligono } from '../model';

const ROOT = join(process.cwd(), 'fixtures-private');
const CASI = ['NCV002', 'NCV059', 'NCV065'].filter((c) => existsSync(join(ROOT, c, `${c}.DAT`)));

/** Poligoni (in metri) ricostruiti dal file NTF di Docfa. */
function poligoniDaNtf(dir: string, scala: number): Poligono[] {
  const f = readdirSync(dir).find((x) => /^N\d{7}\.001$/.test(x))!;
  const n = leggiNtf(new Uint8Array(readFileSync(join(dir, f))));
  const k = scala / 10000;
  return n.poligoni.map((p) => ({ tipo: p.tipo, vertici: p.punti.map(([x, y]) => [x * k, y * k] as [number, number]), altezzaValida: p.altezza !== '149' }));
}

describe.skipIf(!CASI.length)('superfici dai poligoni come Docfa', () => {
  for (const caso of CASI) {
    it(caso, () => {
      const dir = join(ROOT, caso);
      const { pratica } = decompilaDocumento(new Uint8Array(readFileSync(join(dir, `${caso}.DAT`))), new Uint8Array(readFileSync(join(dir, `NMV${caso.slice(3)}.DAT`))));
      const u = pratica.unita.find((x) => x.mod1NParteII)!;
      const pol = poligoniDaNtf(dir, 200);
      // dati metrici identici a quelli di Docfa
      expect(ambientiDaPoligoni(pol)).toEqual(u.ambienti);
      // superfici lorde del 1N parte II identiche
      const l = superficiLorde(pol);
      const m = u.mod1NParteII!;
      expect([l.principali, l.accessoriIndiretti, l.balconi, l.pertinenze]).toEqual([m.superficieLorda, m.accessoriIndirettiSup, m.balconiSup, m.pertinenzeScoperteSup]);
      // la sincronizzazione non cambia nulla su un documento già coerente
      u.planimetria!.poligoni = pol;
      expect(sincronizzaDaPoligoni(u)).toBe(false);
    });
  }
});

describe('superficie catastale (DPR 138/98)', () => {
  it('coincide con quella dichiarata nei documenti reali', async () => {
    const { superficieCatastale } = await import('../superfici');
    // ambienti e superfici catastali di NCV002, NCV059, NCV065, NCV081 (R1, R2 con giardino, R1 con h<1,50, T1 con A2, P4, T2)
    const casi: [string, [string, number, boolean?][], number][] = [
      ['R1', [['A', 47]], 47],
      ['R2', [['A', 222], ['F', 197], ['D', 9]], 225],
      ['R1', [['A', 92], ['D', 5], ['B', 41], ['B', 6, true]], 114],
      ['T1', [['H', 135], ['A', 115]], 183],
      ['P4', [['A', 7001], ['F', 425], ['D', 419]], 7043],
      ['T2', [['A', 140]], 140],
    ];
    for (const [tip, amb, atteso] of casi) {
      const ambienti = amb.map(([tipo, superficie, bassa]) => ({ tipo: tipo as 'A', superficie, altezzaMin: bassa ? 149 : 150, altezzaMax: 0 }));
      expect(superficieCatastale(ambienti, tip)).toBe(atteso);
    }
  });
});

