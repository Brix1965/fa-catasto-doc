// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { leggiDxf } from '../../raster/dxf';
import { altezzaDaTesto, m2Intero, riconosciVani, tipoDaTesto, totaliVani, type VanoRiconosciuto } from '../riconosci';

describe('vani: regole', () => {
  it('m² interi come Docfa (da 0,5 per eccesso)', () => {
    expect(m2Intero(11.39)).toBe(11);
    expect(m2Intero(11.5)).toBe(12);
    expect(m2Intero(0.49)).toBe(0);
  });
  it('parti a comune, aree esterne, sigle', async () => {
    const { RE_COMUNE, scopertoDaTesto } = await import('../riconosci');
    expect(tipoDaTesto('K')).toBe('principale');
    expect(tipoDaTesto('ingr.')).toBe('diretto');
    expect(RE_COMUNE.test('vano scale a comune')).toBe(true);
    expect(RE_COMUNE.test('resede a comune')).toBe(true);
    expect(RE_COMUNE.test('altra u.i.')).toBe(true);
    expect(RE_COMUNE.test('camera')).toBe(false);
    expect(scopertoDaTesto('terrazza')).toBe('D');
    expect(scopertoDaTesto('giardino')).toBe('F');
    expect(scopertoDaTesto('Corte')).toBe('F');
    expect(scopertoDaTesto('corridoio')).toBeNull();
  });
  it('tipo dal nome del vano', () => {
    expect(tipoDaTesto('Camera')).toBe('principale');
    expect(tipoDaTesto('SOGGIORNO')).toBe('principale');
    expect(tipoDaTesto('wc')).toBe('bagno');
    expect(tipoDaTesto('Disimp.')).toBe('diretto');
    expect(tipoDaTesto('cabina armadi')).toBe('diretto');
    expect(tipoDaTesto('vano scala')).toBe('diretto');
    expect(tipoDaTesto('cantina')).toBe('indiretto');
    expect(tipoDaTesto('h260')).toBeNull();
  });
  it('altezze', () => {
    expect(altezzaDaTesto('h260')).toBe(2.6);
    expect(altezzaDaTesto('h=2,40')).toBe(2.4);
    expect(altezzaDaTesto('Hmin 220')).toBe(2.2);
    expect(altezzaDaTesto('camera')).toBeNull();
  });
  it('totali: somma dei m² interi, i «da verificare» contano tra i diretti, gli esclusi no', () => {
    const v = (tipo: VanoRiconosciuto['tipo'], m2: number) => ({ tipo, m2 }) as VanoRiconosciuto;
    const t = totaliVani([v('principale', 14), v('principale', 11), v('bagno', 5), v('verificare', 2), v('diretto', 6), v('escluso', 30)]);
    expect(t).toMatchObject({ principaliN: 2, principaliSup: 25, bagniN: 1, bagniSup: 5, direttiN: 2, direttiSup: 8, indirettiN: 0 });
  });
});

// disegni reali (non pubblicati): la prova gira solo dove ci sono
const DIR = 'fixtures-private/vani';
const CASI: [string, object][] = [
  ['caso-1.dxf', { principaliN: 10, principaliSup: 143, bagniN: 9, bagniSup: 29, direttiN: 4, direttiSup: 26 }],
  ['caso-2.dxf', { principaliN: 10, principaliSup: 139, bagniN: 7, bagniSup: 25, direttiN: 5, direttiSup: 30 }],
  ['caso-3.dxf', { principaliN: 3, principaliSup: 43, bagniN: 1, bagniSup: 7, direttiN: 2, direttiSup: 13, indirettiN: 2, indirettiSup: 18 }],
];
// planimetria di un altro professionista (DXF da programma BIM, senza poligoni): cucina «K», camere senza nome,
// freccia d'ingresso diversa, vano scale e resede «a comune», terrazza, giardino, corte e ripostiglio in giardino
const ALTRI: [string, object, string][] = [
  ['altri-1.dxf', { principaliN: 6, principaliSup: 88, bagniN: 1, bagniSup: 4, direttiN: 1, direttiSup: 11, indirettiN: 1, indirettiSup: 3 }, 'ACDF'],
];
describe.skipIf(!existsSync(DIR))('vani: disegni reali', () => {
  for (const [f, atteso] of CASI)
    it(f, () => {
      const d = leggiDxf(readFileSync(`${DIR}/${f}`, 'latin1'));
      expect(totaliVani(riconosciVani(d.entita, d.poligoni).vani)).toMatchObject(atteso);
    }, 120000);
});

describe.skipIf(!existsSync(DIR))('vani: disegni di altri professionisti', async () => {
  const { preparaDxf } = await import('../../raster/dxf-correzioni');
  const { calcolaDisegno } = await import('../worker');
  for (const [f, atteso, tipi] of ALTRI)
    it.skipIf(!existsSync(`${DIR}/${f}`))(f, () => {
      const { letto } = preparaDxf(readFileSync(`${DIR}/${f}`, 'latin1'));
      const r = calcolaDisegno({ op: 'disegno', entita: letto.entita, poligoni: letto.poligoni, usaPoligoni: letto.poligoni.length > 0, riquadro: letto.riquadro });
      expect(totaliVani(r.vani.vani)).toMatchObject(atteso);
      // le parti a comune non entrano in nessun vano né poligono
      expect(r.vani.vani.filter((v) => v.comune).every((v) => v.tipo === 'escluso')).toBe(true);
      expect([...new Set(r.generati.poligoni.map((p) => p.tipo))].sort().join('')).toBe(tipi);
    }, 120000);
  // la scheda ha già solo i poligoni A (proposti o disegnati prima): rifacendo il riconoscimento «solo dentro i
  // poligoni attuali» la terrazza e il giardino con il loro nome si propongono lo stesso (D, F); ciò che è a comune no
  it.skipIf(!existsSync(`${DIR}/altri-1.dxf`))('altri-1.dxf con i soli poligoni A: propone anche D e F', () => {
    const { letto } = preparaDxf(readFileSync(`${DIR}/altri-1.dxf`, 'latin1'));
    const primo = calcolaDisegno({ op: 'disegno', entita: letto.entita, poligoni: [], usaPoligoni: false, riquadro: letto.riquadro });
    const soloA = primo.generati.poligoni.filter((p) => p.tipo === 'A');
    const r = calcolaDisegno({ op: 'disegno', entita: letto.entita, poligoni: soloA, usaPoligoni: true, riquadro: letto.riquadro });
    const tipi = new Set(r.generati.poligoni.map((p) => p.tipo));
    expect(tipi.has('D') && tipi.has('F')).toBe(true);
    expect(r.vani.vani.filter((v) => v.comune).every((v) => v.tipo === 'escluso')).toBe(true);
  }, 120000);
});

describe('consistenza dai vani', () => {
  it('principali + accessori diretti ⅓ + indiretti ¼, al mezzo vano', async () => {
    const { consistenzaVani } = await import('../totali');
    expect(consistenzaVani({ principaliN: 10, bagniN: 9, direttiN: 3, indirettiN: 0 })).toBe(14);
    expect(consistenzaVani({ principaliN: 3, bagniN: 1, direttiN: 2, indirettiN: 2 })).toBe(4.5);
    expect(consistenzaVani({ principaliN: 2, bagniN: 1, direttiN: 1, indirettiN: 1 })).toBe(3);
  });
});

describe.skipIf(!existsSync(DIR))('disegni reali: poligoni, spessori, altezze, senza poligoni', async () => {
  const { preparaDxf } = await import('../../raster/dxf-correzioni');
  const { generaPoligoni, lineeDiMuro } = await import('../poligoni');
  const { poligono, unione, intersezione } = await import('../geo');
  const { altezzeUnita } = await import('../riconosci');
  const CONT = new Set(['', 'CONTINUOUS', 'CONTINUA', 'BYLAYER', 'BYBLOCK']);
  const carica = (f: string) => preparaDxf(readFileSync(`${DIR}/${f}`, 'latin1')).letto;
  const iou = (a: { vertici: [number, number][] }[], b: { vertici: [number, number][] }[]) => {
    const A = unione(a.map((p) => poligono(p.vertici))), B = unione(b.map((p) => poligono(p.vertici)));
    return intersezione(A, B).getArea() / unione([A, B]).getArea();
  };

  it('caso-2 senza poligoni: stessi totali che con i poligoni', () => {
    const d = carica('caso-2.dxf');
    const r = riconosciVani(d.entita, [], { riquadro: d.riquadro });
    expect(r.senzaPoligoni).toBe(true);
    expect(totaliVani(r.vani)).toMatchObject({ principaliN: 10, principaliSup: 139, bagniN: 7, bagniSup: 25, direttiN: 5, direttiSup: 30 });
  }, 120000);

  for (const f of ['caso-1.dxf', 'caso-2.dxf', 'caso-3.dxf'])
    it(`${f}: poligoni A generati vicini a quelli disegnati`, () => {
      const d = carica(f);
      const r = riconosciVani(d.entita, d.poligoni, { riquadro: d.riquadro });
      const linee = r.linee.filter((l) => !l.tratteggiata).map((l) => [l.a, l.b] as [[number, number], [number, number]]);
      const g = generaPoligoni(r.vani, linee);
      expect(iou(g.poligoni.filter((p) => p.tipo === 'A'), d.poligoni.filter((p) => p.tipo === 'A'))).toBeGreaterThan(0.9);
    }, 120000);

  it('caso-1: muri sezionati proposti (almeno 3 su 4 giusti, 3 su 4 trovati)', () => {
    const d = carica('caso-1.dxf');
    const r = riconosciVani(d.entita, d.poligoni, { riquadro: d.riquadro });
    const linee = r.linee.filter((l) => !l.tratteggiata).map((l) => [l.a, l.b] as [[number, number], [number, number]]);
    const sel = new Set(lineeDiMuro(d.entita.map((e) => ({ ...e, tratteggiata: !CONT.has((e.tipoLinea ?? '').toUpperCase()) })), r.vani, linee));
    const veri = new Set(d.entita.flatMap((e, i) => (e.spessore > 0 && (e.tipo === 'linea' || e.tipo === 'polilinea') ? [i] : [])));
    const giusti = [...sel].filter((i) => veri.has(i)).length;
    expect(giusti / sel.size).toBeGreaterThan(0.75);
    expect(giusti / veri.size).toBeGreaterThan(0.75);
  }, 120000);

  it('altezza media dai testi «h…»', () => {
    for (const f of ['caso-1.dxf', 'caso-2.dxf']) {
      const d = carica(f);
      const h = altezzeUnita(riconosciVani(d.entita, d.poligoni, { riquadro: d.riquadro }).vani);
      expect(h!.altezzaMediaCm).toBeGreaterThan(280);
      expect(h!.altezzaMediaCm).toBeLessThan(320);
    }
  }, 120000);
});

describe('superficie fra i muri: sguinci delle finestre esclusi', () => {
  // camera 4 × 3 m con muri di 50 cm (edificio esistente); finestra strombata nel muro in alto: sguinci obliqui dal
  // filo interno (1,60 m) al vetro (1,20 m, a 40 cm), poi la mazzetta dritta fino al filo esterno
  const L = (a: [number, number], b: [number, number]) => ({ tipo: 'linea' as const, layer: '0', colore: 7, spessore: 0, tipoLinea: 'CONTINUOUS', p1: a, p2: b });
  const T = (t: string, p: [number, number]) => ({ tipo: 'testo' as const, layer: '0', colore: 7, spessore: 0, testo: t, punto: p, altezza: 0.2, rotazione: 0, allineamentoH: 'centro' as const, allineamentoV: 'medio' as const, larghezza: 1 });
  const entita = [
    // interno
    L([0, 0], [4, 0]), L([4, 0], [4, 3]), L([0, 3], [0, 0]),
    L([0, 3], [1.2, 3]), L([2.8, 3], [4, 3]),
    // esterno
    L([-0.5, -0.5], [4.5, -0.5]), L([4.5, -0.5], [4.5, 3.5]), L([-0.5, 3.5], [-0.5, -0.5]),
    L([-0.5, 3.5], [1.4, 3.5]), L([2.6, 3.5], [4.5, 3.5]),
    // spalle della finestra e vetro
    L([1.2, 3], [1.4, 3.4]), L([2.8, 3], [2.6, 3.4]), L([1.4, 3.4], [1.4, 3.5]), L([2.6, 3.4], [2.6, 3.5]), L([1.4, 3.4], [2.6, 3.4]),
    T('camera', [2, 1.5]),
  ];
  const poligoni = [{ tipo: 'A' as const, vertici: [[-0.5, -0.5], [4.5, -0.5], [4.5, 3.5], [-0.5, 3.5]] as [number, number][], altezzaValida: true }];
  it('la camera misura 12 m² (lo sguincio fino al vetro non conta)', () => {
    // senza la regola: 12 + (1,6 + 1,2) / 2 × 0,4 = 12,56 m², 13 al m² intero
    const r = riconosciVani(entita as never, poligoni);
    const cam = r.vani.find((v) => v.testi.includes('camera'))!;
    expect(cam.superficie).toBeCloseTo(12, 2);
    expect(cam.m2).toBe(12);
    expect(cam.nota).toContain('sguinci');
  });
});

describe('poligoni: muri di confine alla mezzeria, muri esterni per intero', () => {
  // camera 4 × 3 m con muri di 30 cm; a destra, oltre il muro, il vano scale a comune (2 × 3 m)
  const L = (a: [number, number], b: [number, number]) => ({ tipo: 'linea' as const, layer: '0', colore: 7, spessore: 0, tipoLinea: 'CONTINUOUS', p1: a, p2: b });
  const T = (t: string, p: [number, number]) => ({ tipo: 'testo' as const, layer: '0', colore: 7, spessore: 0, testo: t, punto: p, altezza: 0.2, rotazione: 0, allineamentoH: 'centro' as const, allineamentoV: 'medio' as const, larghezza: 1 });
  const rett = (x0: number, y0: number, x1: number, y1: number) => [L([x0, y0], [x1, y0]), L([x1, y0], [x1, y1]), L([x1, y1], [x0, y1]), L([x0, y1], [x0, y0])];
  const entita = [
    ...rett(-0.3, -0.3, 6.6, 3.3), // filo esterno
    ...rett(0, 0, 4, 3), // camera
    ...rett(4.3, 0, 6.3, 3), // scale
    T('camera', [2, 1.5]), T('vano scale a comune', [5.3, 1.5]),
  ];
  it('il poligono A arriva a metà del muro verso le scale e al filo esterno sugli altri lati', async () => {
    const { calcolaDisegno } = await import('../worker');
    const r = calcolaDisegno({ op: 'disegno', entita: entita as never, poligoni: [], usaPoligoni: false, riquadro: [[-2, -2], [9, -2], [9, 5], [-2, 5]] });
    const A = r.generati.poligoni.filter((p) => p.tipo === 'A');
    expect(A.length).toBe(1);
    const xs = A[0].vertici.map((v) => v[0]), ys = A[0].vertici.map((v) => v[1]);
    expect(Math.min(...xs)).toBeCloseTo(-0.3, 2); // muro esterno per intero
    expect(Math.max(...xs)).toBeCloseTo(4.15, 2); // muro verso le scale: mezzeria
    expect(Math.min(...ys)).toBeCloseTo(-0.3, 2);
    expect(Math.max(...ys)).toBeCloseTo(3.3, 2);
  });
  it('a norma del DPR 138/98: muro di confine di 80 cm → 25 cm; muro esterno di 55 cm → 50 cm', async () => {
    const { calcolaDisegno } = await import('../worker');
    // camera 4 × 3; muri esterni di 55 cm; muro verso le scale a comune di 80 cm
    const e = [
      ...rett(-0.55, -0.55, 7.35, 3.55),
      ...rett(0, 0, 4, 3),
      ...rett(4.8, 0, 6.8, 3),
      T('camera', [2, 1.5]), T('vano scale a comune', [5.8, 1.5]),
    ];
    const r = calcolaDisegno({ op: 'disegno', entita: e as never, poligoni: [], usaPoligoni: false, riquadro: [[-2, -2], [9, -2], [9, 5], [-2, 5]] });
    const A = r.generati.poligoni.filter((p) => p.tipo === 'A');
    expect(A.length).toBe(1);
    const xs = A[0].vertici.map((v) => v[0]), ys = A[0].vertici.map((v) => v[1]);
    expect(Math.min(...xs)).toBeCloseTo(-0.5, 2); // esterno: 50 cm su 55
    expect(Math.max(...xs)).toBeCloseTo(4.25, 2); // comunione: 25 cm su 80
    expect(Math.min(...ys)).toBeCloseTo(-0.5, 2);
    expect(Math.max(...ys)).toBeCloseTo(3.5, 2);
  });
  it('lordo con finestre aperte verso la terrazza e muri lasciati aperti nel disegno (DXF «ssPane»)', async () => {
    const { calcolaDisegno } = await import('../worker');
    const { poligono } = await import('../geo');
    // camera 4 × 3, muri di 30 cm; finestra larga 1,5 m nel muro verso la terrazza: il filo esterno è interrotto e lo
    // spazio della terrazza entra nel vano della finestra fino al filo interno
    const e = [
      ...rett(0, 0, 4, 3),
      L([-0.3, 3.3], [4.3, 3.3]), L([4.3, 3.3], [4.3, -0.3]), L([-0.3, -0.3], [-0.3, 3.3]),
      L([-0.3, -0.3], [1, -0.3]), L([1, -0.3], [1, 0]), L([2.5, -0.3], [2.5, 0]), L([2.5, -0.3], [4.3, -0.3]),
      L([-0.3, -0.3], [-0.3, -2.3]), L([-0.3, -2.3], [4.3, -2.3]), L([4.3, -2.3], [4.3, -0.3]),
      T('camera', [2, 1.5]), T('terrazza', [2, -1.3]),
    ];
    const r = calcolaDisegno({ op: 'disegno', entita: e as never, poligoni: [], usaPoligoni: false, riquadro: [[-2, -4], [9, -4], [9, 5], [-2, 5]] });
    const area = (t: string) => r.generati.poligoni.filter((p) => p.tipo === t).reduce((s, p) => s + poligono(p.vertici).getArea(), 0);
    expect(area('A')).toBeCloseTo(4.6 * 3.6, 1); // muri per intero, finestra compresa
    expect(area('D')).toBeCloseTo(4.6 * 2, 1); // la terrazza si ferma al filo esterno del muro
  });
  it('estremi dei muri lasciati aperti: si chiudono di traverso', async () => {
    const { chiudiEstremiAperti } = await import('../poligoni');
    // muro di 30 cm che prosegue verso un'altra unità non disegnata: le due linee finiscono senza chiusura
    const linee: [[number, number], [number, number]][] = [[[0, 0], [5, 0]], [[0, 0.3], [5, 0.3]], [[5, 0], [5, 0.3]]];
    const n = chiudiEstremiAperti(linee).slice(linee.length);
    expect(n).toEqual([[[0, 0], [0, 0.3]]]);
    // linee non parallele o lontane: niente
    expect(chiudiEstremiAperti([[[0, 0], [5, 0]], [[0, 0.3], [3, 3]]]).length).toBe(2);
    expect(chiudiEstremiAperti([[[0, 0], [5, 0]], [[0, 0.9], [5, 0.9]]]).length).toBe(2);
  });
});
