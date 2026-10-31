import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { codiceRiscontro, codificaRiscontro, sommaRiscontro } from '../riscontro';

describe('codice di riscontro', () => {
  it('codifica le cifre dispari con la tabella AP1N33GA5E77LX9', () => {
    expect(codificaRiscontro(0)).toBe('000000000');
    expect(codificaRiscontro(126675)).toBe('000A2667A');
    expect(codificaRiscontro(135797531)).toBe('ANGEL7A3P');
    expect(codificaRiscontro(1_000_000_002)).toBe('000000002');
  });

  it('somma solo i primi 250 caratteri di ogni record', () => {
    const r = new Uint8Array(352).fill(1);
    r[350] = 0x0d; r[351] = 0x0a;
    const due = new Uint8Array([...r, ...r]);
    expect(sommaRiscontro(due)).toBe(500);
  });

  const ROOT = join(process.cwd(), 'fixtures-private');
  const casi: [string, string][] = [['NCV002', '000A2667A'], ['NCV059', '000A08606'], ['NCV065', '000A42P62'], ['NCV081', '00A0N8646']];
  for (const [nome, atteso] of casi) {
    const dat = join(ROOT, nome, `${nome}.DAT`);
    const nmv = join(ROOT, nome, `${nome.replace('NCV', 'NMV')}.DAT`);
    it.skipIf(!existsSync(dat) || !existsSync(nmv))(`${nome}: ${atteso} come stampato da Docfa`, () => {
      expect(codiceRiscontro(readFileSync(dat), readFileSync(nmv))).toBe(atteso);
    });
  }
});
