import { describe, expect, it } from 'vitest';
import { areaContorni, centroContorni, dividiVano, unisciVani } from '../forme';
import type { XY } from '../geo';

const rett = (x0: number, y0: number, x1: number, y1: number): XY[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

describe('forma dei vani a mano', () => {
  it('dividi: un segmento da lato a lato fa due vani', () => {
    const r = dividiVano([rett(0, 0, 6, 4)], [2, 0], [2, 4]);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(2);
    expect(areaContorni(r![0])).toBeCloseTo(16, 6);
    expect(areaContorni(r![1])).toBeCloseTo(8, 6);
  });
  it('dividi: punti appena dentro il vano bastano', () => {
    const r = dividiVano([rett(0, 0, 6, 4)], [2, 0.03], [2, 3.97]);
    expect(r?.length).toBe(2);
  });
  it('dividi: un segmento che non attraversa non divide', () => {
    expect(dividiVano([rett(0, 0, 6, 4)], [1, 1], [2, 2])).toBeNull();
  });
  it('unisci: due vani attaccati diventano un contorno, staccati restano due', () => {
    expect(unisciVani([rett(0, 0, 2, 2)], [rett(2, 0, 4, 2)]).length).toBe(1);
    const u = unisciVani([rett(0, 0, 2, 2)], [rett(2.1, 0, 4, 2)]);
    expect(u.length).toBe(2);
    expect(areaContorni(u)).toBeCloseTo(7.8, 6);
  });
  it('centro dell\'anello più grande', () => {
    const c = centroContorni([rett(0, 0, 1, 1), rett(10, 10, 14, 14)]);
    expect(c[0]).toBeCloseTo(12); expect(c[1]).toBeCloseTo(12);
  });
});
