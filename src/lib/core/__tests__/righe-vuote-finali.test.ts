import { describe, expect, it } from 'vitest';
import { righe } from '$lib/core/classamento/nzct01';

describe('prospetti con righe vuote finali', () => {
  it('ignora le righe vuote in fondo al file (es. Nclrnv3.dat di Rimini)', () => {
    const testo = 'H3A          00000000000000000000001000\r\nK4A          10000100000000000000000000\r\n\r\n';
    const r = righe(new TextEncoder().encode(testo), 39)!;
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.trim() !== '')).toBe(true);
  });
});
