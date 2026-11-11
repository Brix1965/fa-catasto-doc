// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Pratica BPM (variazione D/5, 2N senza corpi, elenco subalterni di 262 righe) esportata da Docfa 4.00.5 il
 * 02/11/2026: decompilata e ricompilata deve dare NCV, ATT ed EPV identici byte per byte. Il campione è reale e
 * resta in fixtures-private/BPM (non nel repository): senza, il test si salta.
 */
import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { decompilaDocumento } from '../decompile';
import { compilaDocumento, compilaElencoSubalterni } from '../compile';
import { splitCRLF, decode1252 } from '../bytes';
const D = 'fixtures-private/BPM';
it.skipIf(!existsSync(`${D}/NCV001.DAT`))('BPM: Docfa → app → identico', () => {
  const ncv = new Uint8Array(readFileSync(`${D}/NCV001.DAT`));
  const att = new Uint8Array(readFileSync(`${D}/NCV001.ATT`));
  const epv = new Uint8Array(readFileSync(`${D}/EPV001.DAT`));
  const p = decompilaDocumento(ncv, undefined, att, epv).pratica;
  const c = compilaDocumento(p);
  const a = splitCRLF(ncv).filter((l) => l.length).map(decode1252);
  const b = splitCRLF(c.ncv.dati).filter((l) => l.length).map(decode1252);
  const diff: string[] = [];
  a.forEach((x, i) => { if (x !== b[i]) { let k = 0; while (x[k] === b[i]?.[k]) k++; diff.push(`${x.slice(0, 17)} pos ${k + 1}: ${JSON.stringify(x.slice(k, k + 20))} vs ${JSON.stringify(b[i]?.slice(k, k + 20))}`); } });
  if (b.length !== a.length) diff.push(`record ${a.length} vs ${b.length}`);
  expect(diff).toEqual([]);
  expect(decode1252(c.att.dati)).toBe(decode1252(att));
  const e = compilaElencoSubalterni(p);
  const ea = decode1252(epv).split('\r\n'), eb = decode1252(e).split('\r\n');
  const de = ea.map((x, i) => (x === eb[i] ? '' : `${i} ${JSON.stringify(x.slice(0, 30))} vs ${JSON.stringify(eb[i]?.slice(0, 30))}`)).filter(Boolean);
  expect(de).toEqual([]);
});
