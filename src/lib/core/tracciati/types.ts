// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/** Descrizione di un campo a posizione fissa (posizioni 1-based, estremi inclusi, come nei tracciati dell'Agenzia). */
export interface FieldDef {
  id: string;
  start: number;
  end: number;
  /** N = numerico (zero-filled a destra allineato), AN/A = alfanumerico (spazi a destra) */
  kind: 'N' | 'AN' | 'A';
  note?: string;
}

export interface RecordSchema {
  /** tipo-record (posizione 17) */
  type: string;
  title: string;
  fields: FieldDef[];
}
