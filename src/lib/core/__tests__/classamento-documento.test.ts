import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classamentoAutomaticoDocumento, leggiProspetti } from '../classamento-automatico';
import { compilaDocumento } from '../compile';
import { decompilaDocumento } from '../decompile';

const DIR = join(__dirname, 'dati', 'classamento');
const leggi = (n: string) => new Uint8Array(readFileSync(join(DIR, n)));
const prospetti = () => leggiProspetti({
  V1: leggi('NCLPRV1.DAT'), V2: leggi('NCLPRV2.DAT'), V3: leggi('NCLPRV3.DAT'), V4: leggi('NCLPRV4.DAT'), V5: leggi('NCLPRV5.DAT'),
  V6: leggi('NCLPRV6.DAT'), V6A: leggi('NCLPRV6A.DAT'), V7: leggi('NCLPRV7.DAT'), V8: leggi('NCLPRV8.DAT'), V8A: leggi('NCLPRV8A.DAT'), TAR: leggi('Fi-tar.dat'),
});

/** accatastamento n. 23 importato in Docfa: classamento automatico A/4 classe 4, 4,5 vani */
const pratica23 = () => decompilaDocumento(leggi('NCA023.DAT')).pratica;

describe('classamento automatico del documento', () => {
  it('accatastamento di prova: come il vero Docfa (A/4 classe 4, 4,5 vani, € 790,18)', () => {
    const p = pratica23();
    const r = classamentoAutomaticoDocumento(p, prospetti());
    expect(r.errore).toBeUndefined();
    const a = r.unita.get(0)!;
    expect(a).toMatchObject({ eseguito: true, codice: '00', zonaCensuaria: '001', categoria: 'A04', classe: '04', consistenza: '4,5', rendita: 790.18 });
  });
  it("l'esito va nelle posizioni 273-334 del record 3", () => {
    const p = pratica23();
    p.unita[0].classamento!.esitoAutomatico = '00';
    const d = compilaDocumento(p).ncv.dati;
    const s = Array.from(d, (b) => String.fromCharCode(b)).join('');
    const r3 = s.split('\r\n').find((x) => x[16] === '3' && x[7] === 'C')!;
    expect(r3.slice(272, 334)).toBe('00 Classamento automatico eseguito'.padEnd(62, ' '));
  });
  it('senza prospetti: messaggio', () => {
    expect(classamentoAutomaticoDocumento(pratica23(), null).errore).toMatch(/Prospetti/);
  });
});

/**
 * Variazione (VSI, A/3) con i dati delle due finestre "in atti" di Docfa (NZCT60): risultati letti sul vero Docfa
 * 4.00.5 (NCLAS1.DAT identico byte per byte, record di classamento compreso).
 */
describe('classamento automatico in variazione con i dati in atti', () => {
  const variazione = () => decompilaDocumento(leggi('NCV018.DAT')).pratica;
  const casi: [string, { categoria: string; classe: string } | null, { categoria: string; classe: string }[], string][] = [
    ['in atti A/3 cl. 2, fabbricato A/3 cl. 3', { categoria: 'A03', classe: '02' }, [{ categoria: 'A03', classe: '03' }], 'A03 02'],
    ['in atti A/2 cl. 5, fabbricato A/2 6, A/3 3, C/6 4', { categoria: 'A02', classe: '05' }, [{ categoria: 'A02', classe: '06' }, { categoria: 'A03', classe: '03' }, { categoria: 'C06', classe: '04' }], 'A02 05'],
    ['solo fabbricato A/4 cl. 2 e A/3 cl. 4', null, [{ categoria: 'A04', classe: '02' }, { categoria: 'A03', classe: '04' }], 'A03 04'],
    ['in atti A/3 cl. 1, fabbricato A/2 cl. 6', { categoria: 'A03', classe: '01' }, [{ categoria: 'A02', classe: '06' }], 'A03 01'],
  ];
  for (const [nome, ua, fab, atteso] of casi) {
    it(`${nome} → ${atteso}, 4,5 vani`, () => {
      const p = variazione();
      if (ua) p.unita[0].inAtti = { ...ua, consistenza: '4,5' };
      p.classiFabbricato = fab;
      const a = classamentoAutomaticoDocumento(p, prospetti()).unita.get(0)!;
      expect(a.codice).toBe('00');
      expect(`${a.categoria} ${a.classe}`).toBe(atteso);
      expect(a.consistenza).toBe('4,5');
    });
  }
  it('senza dati: esito 06 come Docfa', () => {
    expect(classamentoAutomaticoDocumento(variazione(), prospetti()).unita.get(0)?.codice).toBe('06');
  });
});
