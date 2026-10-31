import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { classamento, leggiProspetti, ErroreDocfa, Regia, type Prospetti } from '../classamento/nzct01';
import { N4, ErroreRTS153 } from '../classamento/nzct04';
import { N5 } from '../classamento/nzct05';

const DATI = join(__dirname, 'dati', 'classamento');
const PRIVATI = join(__dirname, '..', '..', '..', '..', 'fixtures-private', 'ricerca-classamento');
const LOCALI = join(PRIVATI, 'vettori.json');
const LOCALI01 = join(PRIVATI, 'vettori01.json');

interface Caso {
  seme: number; doc: string[]; nclas02: string[]; l54: string; l4c: string;
  finale?: string[]; docfinale?: string[]; esiti?: [string, string, string][]; errore06?: string | null; erroreDocfa?: string;
}

function prospetti() {
  const f = (n: string) => (existsSync(join(DATI, n)) ? new Uint8Array(readFileSync(join(DATI, n))) : undefined);
  return leggiProspetti({
    V1: f('NCLPRV1.DAT'), V2: f('NCLPRV2.DAT'), V3: f('NCLPRV3.DAT'), V4: f('NCLPRV4.DAT'), V5: f('NCLPRV5.DAT'),
    V6: f('NCLPRV6.DAT'), V6A: f('NCLPRV6A.DAT'), V7: f('NCLPRV7.DAT'), V8: f('NCLPRV8.DAT'), V8A: f('NCLPRV8A.DAT'), TAR: f('Fi-tar.dat'),
  });
}

function verifica(casi: Caso[]) {
  const p = prospetti();
  let n = 0;
  for (const c of casi) {
    const w434e = c.l54.slice(6, 8);
    if (w434e !== '00' && w434e !== 'X0') continue;
    n++;
    if (c.erroreDocfa !== undefined) {
      let err: unknown = null;
      try { classamento(c.nclas02, p, { doc: c.doc, l4c: c.l4c, w434e }); } catch (e) { err = e; }
      expect(err, `seme ${c.seme}`).toBeInstanceOf(ErroreDocfa);
      expect((err as ErroreDocfa).codice, `seme ${c.seme}`).toBe(c.erroreDocfa);
      continue;
    }
    const r = classamento(c.nclas02, p, { doc: c.doc, l4c: c.l4c, w434e });
    expect(r.nclas, `seme ${c.seme}`).toEqual(c.finale);
    expect(r.doc, `seme ${c.seme}`).toEqual(c.docfinale);
    expect(r.esiti, `seme ${c.seme}`).toEqual(c.esiti);
    expect(r.errore06 ?? null, `seme ${c.seme}`).toBe(c.errore06 ?? null);
  }
  return n;
}

describe('classamento automatico: regia NZCT01 + NZCT03/04/05/06', () => {
  it('riproduce i vettori di prova', () => {
    const casi = JSON.parse(readFileSync(join(DATI, 'vettori.json'), 'latin1')) as Caso[];
    expect(verifica(casi)).toBeGreaterThan(10);
  });
  it.skipIf(!existsSync(LOCALI))('riproduce i vettori locali (fixtures-private)', () => {
    const casi = JSON.parse(readFileSync(LOCALI, 'latin1')) as Caso[];
    expect(verifica(casi)).toBeGreaterThan(100);
  });
});

interface Caso01 { seme: number; recs: string[]; l4c: string; w434e: string; V3?: string[]; V4?: string[]; V5?: string[]; out?: string[]; l4cout?: string; err?: string }

function verifica01(casi: Caso01[]) {
  const base = prospetti();
  for (const c of casi) {
    const p: Prospetti = { ...base, V3: c.V3 ?? base.V3, V4: c.V4 ?? base.V4, V5: c.V5 ?? base.V5 };
    const g = new Regia(p);
    if (c.err !== undefined) {
      expect(() => g.esegui(c.recs, c.l4c, c.w434e), `seme ${c.seme}`).toThrow(ErroreDocfa);
      continue;
    }
    const [out, l4c] = g.esegui(c.recs, c.l4c, c.w434e);
    expect(out, `seme ${c.seme}`).toEqual(c.out);
    expect(l4c, `seme ${c.seme}`).toBe(c.l4cout);
  }
  return casi.length;
}

describe('classamento automatico: unità casuali (categorie A/B/C/D/E, variazioni, dati in atti)', () => {
  it('riproduce i vettori di prova', () => {
    const casi = JSON.parse(readFileSync(join(DATI, 'vettori01.json'), 'latin1')) as Caso01[];
    expect(verifica01(casi)).toBeGreaterThan(100);
  });
  it.skipIf(!existsSync(LOCALI01))('riproduce i vettori locali con prospetti modificati (fixtures-private)', () => {
    const casi = JSON.parse(readFileSync(LOCALI01, 'latin1')) as Caso01[];
    expect(verifica01(casi)).toBeGreaterThan(1000);
  });
});


interface Vett45 {
  n4: { rec: string; v8: string; l58: string; l4c: string; tar: string[]; v7: string; out?: string; l58out?: string; l44?: Record<string, string>; err?: string }[];
  n5: { rec: string; v8: string; v7: string; tb: string; out: string; l44: Record<string, string> }[];
}

function verifica45(d: Vett45) {
  for (const [i, c] of d.n4.entries()) {
    const n = new N4(c.rec, c.v8, c.l58, c.l4c, c.tar, c.v7);
    if (c.err) { expect(() => n.esegui(), `n4 ${i}`).toThrow(ErroreRTS153); continue; }
    expect(n.esegui(), `n4 ${i}`).toBe(c.out);
    expect(n.l58, `n4 ${i}`).toBe(c.l58out);
    expect(Object.fromEntries(Object.entries(n.l44).map(([k, v]) => [k, v])), `n4 ${i}`).toEqual(c.l44);
  }
  // NZCT05 conserva la working storage fra le unità: stessa istanza per tutta la sequenza
  const n5 = new N5();
  for (const [i, c] of d.n5.entries()) {
    expect(n5.esegui(c.rec, c.v8, c.v7, c.tb), `n5 ${i}`).toBe(c.out);
    expect(Object.fromEntries(Object.entries(n5.l44)), `n5 ${i}`).toEqual(c.l44);
  }
}

describe('classamento automatico: classe (NZCT04) e consistenza (NZCT05)', () => {
  it('riproduce i vettori di prova', () => {
    verifica45(JSON.parse(readFileSync(join(DATI, 'vettori45.json'), 'latin1')) as Vett45);
  });
  it.skipIf(!existsSync(join(PRIVATI, 'vettori45.json')))('riproduce i vettori locali (fixtures-private)', () => {
    verifica45(JSON.parse(readFileSync(join(PRIVATI, 'vettori45.json'), 'latin1')) as Vett45);
  });
});
