import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nzct02 } from '../classamento/nzct02';
import { nzuu01 } from '../classamento/nzuu01';

interface Caso { seme: number; doc: string[]; nclas02: string[]; l54: string; l4c: string; out2: string[] }

const qui = join(__dirname, 'dati', 'classamento', 'vettori.json');
const locale = join(__dirname, '..', '..', '..', '..', 'fixtures-private', 'ricerca-classamento', 'vettori.json');

function verifica(casi: Caso[]) {
  for (const c of casi) {
    const r = nzct02(c.doc);
    expect(r.nclas, `seme ${c.seme}`).toEqual(c.nclas02);
    expect(r.l54, `seme ${c.seme} L54`).toBe(c.l54);
    expect(r.l4c, `seme ${c.seme} L4c`).toBe(c.l4c);
    expect(r.out2, `seme ${c.seme} WorkFile2`).toEqual(c.out2);
  }
}

describe('NZCT02 (dal documento ai record NCLAS1 del classamento automatico)', () => {
  it('riproduce Docfa sui vettori di prova', () => {
    const casi = JSON.parse(readFileSync(qui, 'latin1')) as Caso[];
    expect(casi.length).toBeGreaterThan(10);
    verifica(casi);
  });

  it.skipIf(!existsSync(locale))('riproduce Docfa sui 300 documenti casuali (vettori locali)', () => {
    verifica(JSON.parse(readFileSync(locale, 'latin1')) as Caso[]);
  });

  it('NZUU01YN divide i piani sul trattino', () => {
    const r = nzuu01(('1' + '1-3 T   S1  ').padEnd(0x26, ' '));
    expect(r.slice(0x0d, 0x0e)).toBe('0');
    expect(r.slice(0x0e, 0x0e + 16)).toBe('1   3   T   S1  ');
    expect(nzuu01(('1' + '1-2-3       ').padEnd(0x26, ' ')).slice(0x0d, 0x0e)).toBe('1');
  });
});
