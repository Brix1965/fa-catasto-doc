// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Modello 2N senza corpi di fabbrica: Docfa (NZST40) va in errore 163 in esportazione/stampa se mancano
 * le 3 righe «altro tipo di stima» (record O tipo 1). Verificato il 02/11/2026 in Docfa 4.00.5.
 */
import { describe, it, expect } from 'vitest';
import { compilaDocumento } from '../compile';
import { nuovaPratica, nuovaUnita } from '$lib/stato/pratica-file';
import type { Pratica } from '../model';

const TECNICO = { cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: 'RSSMRA70A01D612X', albo: '03', numeroIscrizione: '1234', provinciaAlbo: 'FI' };

function conMod2N(corpi: number): Pratica {
  const p = nuovaPratica(TECNICO, 'variazione', 7);
  p.comune = { codice: 'D612', codiceAmministrativo: 'I1AA', nome: 'FIRENZE', provincia: 'FI' };
  const u = nuovaUnita('V');
  u.identificativo = { foglio: '12', numero: '345', subalterno: '1' };
  u.classamento = { zonaCensuaria: '1', categoria: 'D05', classe: '', consistenza: '', superficieCatastale: 0, rendita: 2452, classamentoAutomatico: false };
  u.mod1NParteII = undefined;
  u.mod2N = { recordM: {}, recordN: {}, stimaComparativa: [], corpi: Array.from({ length: corpi }, () => ({ recordP: {}, recordQ: {}, recordR: {} })) };
  p.unita = [u];
  return p;
}

const tipiO = (p: Pratica) =>
  compilaDocumento(p).records.map((r) => new TextDecoder('latin1').decode(r.bytes())).filter((s) => s[16] === 'O').map((s) => s[17]);

describe('2N: righe «altro tipo di stima»', () => {
  it('senza corpi di fabbrica scrive anche le 3 righe di tipo 1 vuote', () => {
    expect(tipiO(conMod2N(0))).toEqual(['0', '0', '0', '1', '1', '1']);
  });
  it('con i corpi di fabbrica e senza testo resta come NCV081 (solo tipo 0)', () => {
    expect(tipiO(conMod2N(1))).toEqual(['0', '0', '0']);
  });
});
