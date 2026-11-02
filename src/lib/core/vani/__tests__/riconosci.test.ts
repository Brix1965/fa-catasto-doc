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
  ['caso-1.dxf', { principaliN: 10, principaliSup: 144, bagniN: 9, bagniSup: 29, direttiN: 3, direttiSup: 26 }],
  ['caso-2.dxf', { principaliN: 10, principaliSup: 139, bagniN: 7, bagniSup: 25, direttiN: 5, direttiSup: 30 }],
  ['caso-3.dxf', { principaliN: 3, principaliSup: 43, bagniN: 1, bagniSup: 7, direttiN: 2, direttiSup: 13, indirettiN: 2, indirettiSup: 18 }],
];
describe.skipIf(!existsSync(DIR))('vani: disegni reali', () => {
  for (const [f, atteso] of CASI)
    it(f, () => {
      const d = leggiDxf(readFileSync(`${DIR}/${f}`, 'latin1'));
      expect(totaliVani(riconosciVani(d.entita, d.poligoni).vani)).toMatchObject(atteso);
    }, 120000);
});
