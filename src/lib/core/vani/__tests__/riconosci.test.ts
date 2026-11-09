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
  ['caso-1.dxf', { principaliN: 10, principaliSup: 144, bagniN: 9, bagniSup: 29, direttiN: 4, direttiSup: 26 }],
  ['caso-2.dxf', { principaliN: 10, principaliSup: 139, bagniN: 7, bagniSup: 25, direttiN: 5, direttiSup: 30 }],
  ['caso-3.dxf', { principaliN: 3, principaliSup: 43, bagniN: 1, bagniSup: 7, direttiN: 2, direttiSup: 13, indirettiN: 2, indirettiSup: 18 }],
];
// planimetria di un altro professionista (DXF da programma BIM, senza poligoni): cucina «K», camere senza nome,
// freccia d'ingresso diversa, vano scale e resede «a comune», terrazza, giardino, corte e ripostiglio in giardino
const ALTRI: [string, object, string][] = [
  ['altri-1.dxf', { principaliN: 6, principaliSup: 88, bagniN: 1, bagniSup: 4, direttiN: 1, direttiSup: 12, indirettiN: 1, indirettiSup: 3 }, 'ACDF'],
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
