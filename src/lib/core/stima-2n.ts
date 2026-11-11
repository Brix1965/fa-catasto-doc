// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Modello 2N parte I, quadro H: stima e rendita catastale proposta (u.i.u. delle categorie D ed E).
 *
 * Unità dei record, verificate sul documento NCV081 presentato in Agenzia:
 * - record O (prospetto di stima, 6 righe per record, 3 record): consistenza in m²/m³ interi, valore unitario
 *   in centesimi di euro, valore complessivo della riga in euro interi (4.086.000 + 237.000 = 4.323.000);
 * - record N: valore della stima comparativa, della stima sommaria, valutazione attribuita, rendita e rendita in
 *   cifra tonda in centesimi di euro (432300000 = 4.323.000,00 €; 8646000 = 86.460,00 €); saggio in due campi,
 *   parte intera (1 cifra) e decimale (4 cifre): 0 + 0200 = 0,0200 = 2%.
 * - Rendita = valutazione attribuita × saggio (4.323.000 × 0,02 = 86.460).
 *
 * Qui si lavora in euro; la conversione nelle unità dei record avviene solo in lettura/scrittura.
 */
import type { Campi, Mod2N } from './model';

/** Righe del prospetto: 3 record O × 6 righe. */
export const RIGHE_STIMA = 18;
const PER_RECORD = 6;

export interface RigaStima {
  /** riferimento planimetrico (3 caratteri) */
  rif: string;
  /** natura: S suolo, C costruzioni, E elementi strutturalmente connessi */
  natura: string;
  /** descrizione / destinazione (20 caratteri) */
  descrizione: string;
  /** consistenza in m² o m³ (intera) */
  consistenza: number;
  /** valore unitario in euro (2 decimali) */
  unitario: number;
  /** valore complessivo della riga in euro (intero) */
  valore: number;
}

const num = (v: Campi[string] | undefined): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) return Number(v.trim()) || 0;
  return 0;
};
const txt = (v: Campi[string] | undefined): string => (typeof v === 'string' ? v.trim() : v === undefined ? '' : String(v));

/** Riga vuota? */
export const rigaVuota = (r: RigaStima): boolean => !r.rif && !r.natura && !r.descrizione && !r.consistenza && !r.unitario && !r.valore;

/** Legge le 18 righe del prospetto dai record O. */
export function leggiRighe(d: Mod2N): RigaStima[] {
  const out: RigaStima[] = [];
  for (let i = 0; i < RIGHE_STIMA; i++) {
    const c = d.stimaComparativa[Math.floor(i / PER_RECORD)] ?? {};
    const k = (i % PER_RECORD) + 1;
    out.push({
      rif: txt(c[`stima${k}_corpo`]),
      natura: txt(c[`stima${k}_tipologia`]),
      descrizione: txt(c[`stima${k}_destinazione`]),
      consistenza: num(c[`stima${k}_consistenza`]),
      unitario: num(c[`stima${k}_valore_unitario`]) / 100,
      valore: num(c[`stima${k}_valore`]),
    });
  }
  return out;
}

/** Scrive una riga del prospetto nei record O (crea i record mancanti). */
export function scriviRiga(d: Mod2N, i: number, r: RigaStima): void {
  const n = Math.floor(i / PER_RECORD);
  while (d.stimaComparativa.length <= n) d.stimaComparativa.push({});
  const c = d.stimaComparativa[n];
  const k = (i % PER_RECORD) + 1;
  const imposta = (id: string, v: string | number) => {
    if (v === '' || v === 0) delete c[`stima${k}_${id}`];
    else c[`stima${k}_${id}`] = v;
  };
  imposta('corpo', r.rif.slice(0, 3));
  imposta('tipologia', r.natura.toUpperCase().slice(0, 8));
  imposta('destinazione', r.descrizione.slice(0, 20));
  imposta('consistenza', Math.max(0, Math.min(999999, Math.round(r.consistenza || 0))));
  imposta('valore_unitario', Math.max(0, Math.min(9999999, Math.round((r.unitario || 0) * 100))));
  imposta('valore', Math.max(0, Math.min(99999999, Math.round(r.valore || 0))));
}

/** Valore della riga = consistenza × valore unitario, in euro interi. */
export const valoreRiga = (consistenza: number, unitario: number): number => Math.round((consistenza || 0) * (unitario || 0));

/** Saggio di fruttuosità come frazione (0,02 = 2%). */
export function leggiSaggio(n: Campi): number {
  return num(n.saggio_intero) + num(n.saggio_decimale) / 10000;
}
/** Imposta il saggio (frazione, 4 decimali). */
export function scriviSaggio(n: Campi, r: number): void {
  const t = Math.round(Math.max(0, Math.min(9.9999, r || 0)) * 10000);
  n.saggio_intero = Math.floor(t / 10000);
  n.saggio_decimale = t % 10000;
}

export interface Stima2N {
  /** totale del prospetto (somma delle righe), € */
  comparativa: number;
  /** valore con metodologie diverse (punto 2), € */
  sommaria: number;
  /** valore complessivo attribuito Va, € */
  attribuita: number;
  /** saggio come frazione */
  saggio: number;
  /** rendita = Va × r, € (2 decimali) */
  rendita: number;
}

/** Valori del quadro H letti dai record (in euro). */
export function leggiStima(d: Mod2N): Stima2N {
  const n = d.recordN;
  return {
    comparativa: num(n.valore_stima_comparativa) / 100,
    sommaria: num(n.valore_stima_sommaria) / 100,
    attribuita: num(n.valutazione_attribuita) / 100,
    saggio: leggiSaggio(n),
    rendita: num(n.rendita_catastale) / 100,
  };
}

/** Rendita in centesimi = valutazione attribuita (centesimi) × saggio. */
export const renditaCentesimi = (attribuitaCent: number, saggio: number): number => Math.round(attribuitaCent * saggio);

/**
 * Ricalcola il quadro H: totale del prospetto dalle righe, rendita e rendita in cifra tonda da
 * valutazione attribuita × saggio. La valutazione attribuita la sceglie il tecnico (di norma il totale
 * del prospetto o il valore della stima sommaria): qui si cambia solo se `attribuitaDaTotale`.
 * Restituisce true se qualcosa è cambiato.
 */
export function ricalcola2N(d: Mod2N, opz: { attribuitaDaTotale?: boolean } = {}): boolean {
  const n = d.recordN;
  let cambiato = false;
  // si scrive solo se il valore cambia (nell'interfaccia ogni scrittura riattiva gli effetti)
  const imposta = (id: string, v: number) => {
    if (n[id] === v) return;
    n[id] = v;
    cambiato = true;
  };
  const righe = leggiRighe(d);
  const totale = righe.reduce((s, r) => s + (r.valore || 0), 0);
  if (righe.some((r) => !rigaVuota(r)) || num(n.valore_stima_comparativa)) imposta('valore_stima_comparativa', totale * 100);
  if (opz.attribuitaDaTotale) {
    const base = totale || num(n.valore_stima_sommaria) / 100;
    imposta('valutazione_attribuita', Math.round(base * 100));
  }
  const rc = renditaCentesimi(num(n.valutazione_attribuita), leggiSaggio(n));
  imposta('rendita_catastale', rc);
  // «c.t.» = cifra tonda: nell'unico campione reale (NCV081) coincide con la rendita
  imposta('rendita_catastale_tonda', rc);
  // l'anno di riferimento all'epoca censuaria Docfa lo scrive sempre 0000 (NCV081, pratica BPM)
  if (Object.prototype.hasOwnProperty.call(n, 'anno_epoca_censuaria')) { delete n.anno_epoca_censuaria; cambiato = true; }
  return cambiato;
}

/** Controlli di coerenza del quadro H (messaggi per il controllo formale). */
export function controlli2N(d: Mod2N, renditaQuadroU?: number): string[] {
  const out: string[] = [];
  const s = leggiStima(d);
  const totale = leggiRighe(d).reduce((t, r) => t + (r.valore || 0), 0);
  if (totale && Math.abs(totale - s.comparativa) >= 1) out.push(`valore della stima comparativa (${euro(s.comparativa)}) diverso dalla somma del prospetto (${euro(totale)})`);
  if (!s.saggio) out.push('saggio di fruttuosità non indicato');
  if (!s.attribuita) out.push('valore complessivo attribuito (Va) non indicato');
  const atteso = renditaCentesimi(Math.round(s.attribuita * 100), s.saggio) / 100;
  if (Math.abs(atteso - s.rendita) >= 0.01) out.push(`rendita del 2N (${euro(s.rendita)}) diversa da Va × saggio (${euro(atteso)})`);
  if (renditaQuadroU !== undefined && s.rendita && Math.abs(renditaQuadroU - s.rendita) >= 0.01)
    out.push(`rendita del quadro U (${euro(renditaQuadroU)}) diversa da quella del 2N (${euro(s.rendita)})`);
  return out;
}

/**
 * Numero scritto all'italiana: «730.000», «1.190,86», «2,5»; un solo punto seguito da 1-2 cifre è un
 * decimale («1190.86»), altrimenti i punti separano le migliaia.
 */
export function numeroItaliano(s: string): number {
  let t = s.trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^\d*\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const euro = (v: number): string => `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
