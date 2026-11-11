// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/** Totali del quadro C e consistenza dai vani (senza dipendenze geometriche: si usa anche nei controlli). */
import type { TipoVano } from './riconosci';

export interface TotaliVani {
  principaliN: number; principaliSup: number;
  bagniN: number; bagniSup: number;
  direttiN: number; direttiSup: number;
  indirettiN: number; indirettiSup: number;
}

/** Totali del quadro C (1N parte II): numero e somma dei m² interi per tipo; i vani esclusi non contano. */
export function totaliVani(vani: { tipo: TipoVano | string; m2: number }[]): TotaliVani {
  const t: TotaliVani = { principaliN: 0, principaliSup: 0, bagniN: 0, bagniSup: 0, direttiN: 0, direttiSup: 0, indirettiN: 0, indirettiSup: 0 };
  for (const v of vani) {
    if (v.tipo === 'principale') { t.principaliN++; t.principaliSup += v.m2; }
    else if (v.tipo === 'bagno') { t.bagniN++; t.bagniSup += v.m2; }
    else if (v.tipo === 'diretto' || v.tipo === 'verificare') { t.direttiN++; t.direttiSup += v.m2; }
    else if (v.tipo === 'indiretto') { t.indirettiN++; t.indirettiSup += v.m2; }
  }
  return t;
}

/**
 * Consistenza del gruppo A (vademecum Docfa § 1.3.2): vani principali + accessori diretti (bagni compresi) 1/3
 * + accessori indiretti 1/4, al mezzo vano (decimali < 0,25 → 0; < 0,75 → 0,5; altrimenti 1).
 */
export function consistenzaVani(t: { principaliN: number; bagniN: number; direttiN: number; indirettiN: number }): number {
  const v = t.principaliN + (t.bagniN + t.direttiN) / 3 + t.indirettiN / 4;
  const intera = Math.floor(v), d = v - intera;
  return d < 0.25 ? intera : d < 0.75 ? intera + 0.5 : intera + 1;
}
