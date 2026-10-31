import { describe, it, expect } from 'vitest';
import { normalizzaIndirizzo, CARATTERI_INDIRIZZO, allineaZona, allineaClasse } from '../regole-docfa';

describe('regole Docfa verificate sul controllo formale', () => {
  it('indirizzo del dichiarante (W0708)', () => {
    expect(normalizzaIndirizzo('Via dell’Agnolo')).toBe("VIA DELL'AGNOLO");
    expect(normalizzaIndirizzo('Via dell’Àrco n° 2/B-C')).toBe("VIA DELL'A'RCO N. 2/B-C");
    expect(normalizzaIndirizzo('Via Roma, 12 (int 3)')).toBe('VIA ROMA, 12 (INT 3)');
    expect(CARATTERI_INDIRIZZO.test("VIA DELL'ARCO N.2/B-C")).toBe(true);
    expect(CARATTERI_INDIRIZZO.test('VIA DELL’AGNOLO')).toBe(false);
  });
  it('zona e classe allineate (W0534, W0535)', () => {
    expect(allineaZona('2')).toBe('002');
    expect(allineaZona('U')).toBe('U');
    expect(allineaClasse('3')).toBe('03');
    expect(allineaClasse('U')).toBe('U');
  });
});
