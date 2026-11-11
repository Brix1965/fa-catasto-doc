// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/** Prove dei difetti trovati nel controllo QA del 03/11/2026 (perché non tornino). */
import { describe, expect, it } from 'vitest';
import { superficieCatastale } from '../superfici';
import { compilaDocumento, compilaDatiMetrici, tipologiaUnita } from '../compile';
import { decode1252, splitCRLF } from '../bytes';
import { nuovaPratica, nuovaUnita, tecnicoVuoto } from '../../stato/pratica-file';
import { calcolaCodiceFiscale } from '../codice-fiscale';
import type { Pratica, UnitaImmobiliare } from '../model';

const amb = (tipo: 'A' | 'H', superficie: number) => ({ tipo, superficie, altezzaMin: 0, altezzaMax: 0 });

function pratica(...unita: UnitaImmobiliare[]): Pratica {
  const p = nuovaPratica(tecnicoVuoto(), 'variazione', 7);
  p.comune = { codice: 'D612', codiceAmministrativo: 'I1AA', nome: 'FIRENZE', provincia: 'FI' };
  p.unita = unita;
  return p;
}
const record3 = (p: Pratica) => splitCRLF(compilaDocumento(p).ncv.dati).map(decode1252).filter((r) => r.charAt(16) === '3');

describe('controllo QA: correzioni', () => {
  it('R/4 (box): vani principali per intero, accessori diretti al 50%', () => {
    expect(superficieCatastale([amb('A', 18)], 'R4')).toBe(18);
    expect(superficieCatastale([amb('A', 18), amb('H', 4)], 'R4')).toBe(20);
  });

  it('u.i.u. soppressa con i dati di prima: categoria « 00», niente classamento né 1N', () => {
    const v = nuovaUnita('V');
    v.identificativo = { foglio: '1', numero: '2', subalterno: '3' };
    v.classamento = { zonaCensuaria: '1', categoria: 'A03', classe: '02', consistenza: '5', superficieCatastale: 90, rendita: 500, classamentoAutomatico: false };
    v.operazione = 'S';
    const p = pratica(v);
    const r = record3(p)[0];
    expect(r.slice(155, 159)).toBe('0000');
    expect(r.slice(162, 165)).toBe(' 00');
    expect(r.slice(165, 174).trim()).toBe('');
    expect(r.slice(179, 189)).toBe('0000000000');
    expect(splitCRLF(compilaDocumento(p).ncv.dati).map(decode1252).some((x) => x.charAt(7) === 'U' && x.charAt(16) === 'H')).toBe(false);
    expect(compilaDatiMetrici(p).length).toBe(0);
  });

  it('dati metrici con campi svuotati (null) o con decimali: record sempre di 313 byte', () => {
    const v = nuovaUnita('V');
    v.identificativo = { foglio: '1', numero: '2', subalterno: '3' };
    v.classamento = { zonaCensuaria: '1', categoria: 'A03', classe: '02', consistenza: '5', superficieCatastale: 90, rendita: 500, classamentoAutomatico: false };
    v.ambienti = [{ tipo: 'A', superficie: null as unknown as number, altezzaMin: 270.5, altezzaMax: -5 }];
    const righe = splitCRLF(compilaDatiMetrici(pratica(v)));
    expect(righe.length).toBe(2);
    for (const r of righe) expect(r.length).toBe(313);
    expect(decode1252(righe[0]).slice(19, 33)).toBe('A0000002710000');
  });

  it('codice tabella 6 importato: non vale più se la categoria cambia gruppo', () => {
    const v = nuovaUnita('V');
    v.classamento = { zonaCensuaria: '1', categoria: 'C02', classe: '01', consistenza: '30', superficieCatastale: 0, rendita: 0, classamentoAutomatico: false };
    v.tipologiaMetrica = 'R1';
    expect(tipologiaUnita(v)).toBe('T2');
    v.classamento.categoria = 'A07';
    v.tipologiaMetrica = 'R1';
    expect(tipologiaUnita(v)).toBe('R1');
  });

  it('codice fiscale: data impossibile = errore chiaro, non «undefined» nel codice', () => {
    expect(() => calcolaCodiceFiscale('ROSSI', 'MARIO', 'M', { gg: 1, mm: 13, aaaa: 1980 }, 'H501')).toThrow(/Data di nascita/);
    expect(calcolaCodiceFiscale('ROSSI', 'MARIO', 'M', { gg: 1, mm: 1, aaaa: 1980 }, 'H501')).toMatch(/^RSSMRA80A01H501.$/);
  });
});
