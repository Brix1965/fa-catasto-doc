// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Tipi di linea del DXF nella planimetria: grafica uniforme, indipendente dalla scala del disegno e dal
 * fattore di scala dei tipi di linea ($LTSCALE) usato da chi ha preparato il DXF (decisione di Fabrizio, 10/11/2026).
 *
 * - continua: CONTINUOUS e simili;
 * - tratteggio: qualunque linea a tratti (NASCOSTA, HIDDEN, DASHED, TRATTEGGIATA…) → tratti di 1,5 mm, spazi di 0,75 mm;
 * - tratto e punto: linee con punti o tratti di lunghezza diversa (DASHDOT, TRATTOPUNTO, CENTER…), usate per il
 *   confine del fabbricato o del lotto → tratti di 5 mm, spazi di 1,5 mm, punto di 0,3 mm.
 *
 * Le misure sono sul foglio, quindi restano leggibili a 1:100, 1:200 o 1:500. Prima ogni linea si disegnava
 * continua; Docfa usa lo schema del DXF così com'è, e uno schema pensato per i millimetri (HIDDEN, tratti di
 * 6,35 unità) in un disegno in metri diventa una linea continua.
 */
export type StileLinea = 'continua' | 'tratteggio' | 'trattopunto';

export const CONTINUE = new Set(['', 'CONTINUOUS', 'CONTINUA', 'BYLAYER', 'BYBLOCK']);

const RE_TRATTOPUNTO = /PUNTO|DOT|CENTER|CENTRO|ASSE|PHANTOM|DIVIDE|BORDER|CONFINE|MIST/;

/** Schemi sul foglio in millimetri: tratto (> 0) e spazio (< 0), alternati, iniziando con un tratto. */
export const SCHEMA_MM: Record<Exclude<StileLinea, 'continua'>, number[]> = {
  tratteggio: [1.5, -0.75],
  trattopunto: [5, -1.5, 0.3, -1.5],
};

/**
 * Stile di un tipo di linea, dal suo schema nella tabella LTYPE del DXF (gruppi 49) o, se manca, dal nome.
 * `schemi`: nome in maiuscolo → elementi dello schema.
 */
export function stileLinea(nome: string | undefined, schemi?: Record<string, number[]>): StileLinea {
  const n = (nome ?? '').trim().toUpperCase();
  if (CONTINUE.has(n)) return 'continua';
  const s = schemi?.[n];
  if (s && s.length) {
    if (!s.some((x) => x < 0)) return 'continua';
    const tratti = s.filter((x) => x >= 0);
    if (tratti.some((x) => x === 0)) return 'trattopunto';
    if (tratti.length >= 2 && Math.min(...tratti) < 0.5 * Math.max(...tratti)) return 'trattopunto';
    return 'tratteggio';
  }
  return RE_TRATTOPUNTO.test(n) ? 'trattopunto' : 'tratteggio';
}

type P = [number, number];

/**
 * Divide un percorso (in pixel) nei tratti dello schema (in pixel). Lo schema si allunga o si accorcia di poco
 * perché il percorso aperto cominci e finisca con un tratto pieno (gli angoli restano disegnati) e quello chiuso
 * contenga un numero intero di ripetizioni. Percorsi troppo corti per lo schema restano continui.
 */
export function tratteggiaPercorso(punti: P[], chiuso: boolean, schemaPx: number[]): P[][] {
  const pts = chiuso && punti.length > 2 ? [...punti, punti[0]] : punti;
  if (pts.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L <= 0) return [];
  const periodo = schemaPx.reduce((a, x) => a + Math.abs(x), 0);
  const primo = schemaPx[0];
  let f: number;
  if (chiuso) f = L / (Math.max(2, Math.round(L / periodo)) * periodo);
  else f = L / (Math.max(1, Math.round((L - primo) / periodo)) * periodo + primo);
  if (f < 0.4) return [pts];
  const punto = (s: number): P => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const d = cum[i] - cum[i - 1];
    const t = d > 0 ? (s - cum[i - 1]) / d : 0;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
  const tratto = (a: number, b: number): P[] => {
    const out: P[] = [punto(a)];
    for (let i = 1; i < cum.length - 1; i++) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
    out.push(punto(b));
    return out;
  };
  const out: P[][] = [];
  let s = 0;
  for (let k = 0; s < L - 1e-6; k = (k + 1) % schemaPx.length) {
    const lung = Math.abs(schemaPx[k]) * f;
    if (schemaPx[k] > 0) out.push(tratto(s, Math.min(L, s + lung)));
    s += lung;
  }
  return out;
}
