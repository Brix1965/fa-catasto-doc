// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Geometria semplice per l'editor del disegno: distanze per la selezione, punti di aggancio (estremi, punti
 * medi, centri, vertici dei poligoni, punto più vicino su una linea), aree e limiti. Coordinate del DXF (metri).
 */
import type { Entita, Punto2 } from '../raster/dxf';
import type { Poligono } from '../model';
import { ampiezzaArco } from '../raster/bitmap';

export type P = Punto2;

export const dist = (a: P, b: P): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Punto del segmento a-b più vicino a p. */
export function proietta(p: P, a: P, b: P): P {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (!L2) return a;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return [a[0] + t * dx, a[1] + t * dy];
}
export const distSegmento = (p: P, a: P, b: P): number => dist(p, proietta(p, a, b));

/** Punti di un arco (gradi antiorari), per disegnarlo e selezionarlo. */
export function puntiArco(c: P, r: number, inizio: number, fine: number, n = 24): P[] {
  const a0 = Number.isFinite(inizio) ? inizio % 360 : 0, amp = ampiezzaArco(a0, fine);
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (amp * i) / n) * Math.PI) / 180;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** Segmenti di un'entità (testi esclusi). */
export function segmentiEntita(e: Entita): [P, P][] {
  const s: [P, P][] = [];
  const catena = (pts: P[], chiusa: boolean) => {
    for (let i = 0; i + 1 < pts.length; i++) s.push([pts[i], pts[i + 1]]);
    if (chiusa && pts.length > 2) s.push([pts[pts.length - 1], pts[0]]);
  };
  if (e.tipo === 'linea') s.push([e.p1, e.p2]);
  else if (e.tipo === 'polilinea') catena(e.punti, e.chiusa);
  else if (e.tipo === 'arco') catena(puntiArco(e.centro, e.raggio, e.inizio, e.fine), false);
  else if (e.tipo === 'cerchio') catena(puntiArco(e.centro, e.raggio, 0, 360, 36), false);
  return s;
}

/** Distanza di un punto da un'entità (per i testi: dal punto di inserimento, entro un riquadro approssimato). */
export function distanzaEntita(e: Entita, p: P): number {
  if (e.tipo === 'testo') {
    const w = e.testo.length * e.altezza * 0.8, h = e.altezza;
    const x0 = e.allineamentoH === 'centro' ? e.punto[0] - w / 2 : e.allineamentoH === 'destra' ? e.punto[0] - w : e.punto[0];
    const y0 = e.allineamentoV === 'medio' ? e.punto[1] - h / 2 : e.allineamentoV === 'alto' ? e.punto[1] - h : e.punto[1];
    const dx = Math.max(x0 - p[0], 0, p[0] - (x0 + w)), dy = Math.max(y0 - p[1], 0, p[1] - (y0 + h));
    return Math.hypot(dx, dy);
  }
  let d = Infinity;
  for (const [a, b] of segmentiEntita(e)) d = Math.min(d, distSegmento(p, a, b));
  return d;
}

/** Punto dentro un poligono (pari-dispari). */
export function dentro(p: P, v: P[]): boolean {
  let ok = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i], [xj, yj] = v[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

export function area(v: P[]): number {
  let s = 0;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) s += (v[j][0] + v[i][0]) * (v[j][1] - v[i][1]);
  return Math.abs(s) / 2;
}

export type TipoAggancio = 'estremo' | 'medio' | 'centro' | 'vertice' | 'linea' | 'ortogonale';
export interface Aggancio { p: P; tipo: TipoAggancio }

/** Indice dei punti di aggancio: estremi, punti medi e centri delle entità, vertici dei poligoni. */
export function puntiAggancio(entita: Entita[], poligoni: Poligono[]): Aggancio[] {
  const out: Aggancio[] = [];
  for (const e of entita) {
    if (e.tipo === 'linea') { out.push({ p: e.p1, tipo: 'estremo' }, { p: e.p2, tipo: 'estremo' }, { p: [(e.p1[0] + e.p2[0]) / 2, (e.p1[1] + e.p2[1]) / 2], tipo: 'medio' }); }
    else if (e.tipo === 'polilinea') {
      e.punti.forEach((p) => out.push({ p, tipo: 'estremo' }));
      for (const [a, b] of segmentiEntita(e)) out.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tipo: 'medio' });
    } else if (e.tipo === 'arco') {
      const pts = puntiArco(e.centro, e.raggio, e.inizio, e.fine, 2);
      out.push({ p: pts[0], tipo: 'estremo' }, { p: pts[2], tipo: 'estremo' }, { p: e.centro, tipo: 'centro' });
    } else if (e.tipo === 'cerchio') out.push({ p: e.centro, tipo: 'centro' });
  }
  for (const pg of poligoni) pg.vertici.forEach((p) => out.push({ p, tipo: 'vertice' }));
  return out;
}

/**
 * Aggancio del cursore: il punto notevole più vicino entro `tol`, altrimenti il punto più vicino su una linea
 * entro `tol`; con `da` e `ortogonale` il punto si allinea in orizzontale o verticale al punto precedente.
 */
export function aggancia(p: P, punti: Aggancio[], entita: Entita[], tol: number, opz: { da?: P | null; ortogonale?: boolean; escludi?: P | null; angolo?: number } = {}): Aggancio | null {
  let q = p;
  let ortho = false;
  // ortogonale nel riferimento dell'edificio (angolo dei muri principali), non solo orizzontale/verticale
  const ang = opz.angolo ?? 0;
  if (opz.da && opz.ortogonale) {
    q = ortogonaleDa(p, opz.da, ang);
    ortho = true;
  }
  let migliore: Aggancio | null = null, dm = tol;
  for (const a of punti) {
    // il punto che si sta trascinando non aggancia se stesso (confronto per coordinate: l'oggetto cambia a ogni mossa)
    if (opz.escludi && a.p[0] === opz.escludi[0] && a.p[1] === opz.escludi[1]) continue;
    const d = dist(q, a.p);
    if (d < dm) { dm = d; migliore = a; }
  }
  if (migliore) {
    // con l'ortogonale si tiene l'allineamento: il punto notevole dà solo la coordinata libera
    if (ortho && opz.da) {
      // la coordinata libera dal punto notevole, quella vincolata dal punto di partenza
      const da = ruota(opz.da, -ang), m = ruota(migliore.p, -ang), r = ruota(q, -ang);
      const lungoX = Math.abs(r[1] - da[1]) < 1e-9;
      return { p: ruota(lungoX ? [m[0], da[1]] : [da[0], m[1]], ang), tipo: migliore.tipo };
    }
    return migliore;
  }
  if (ortho) return { p: q, tipo: 'ortogonale' };
  let sl: P | null = null; dm = tol;
  for (const e of entita) {
    if (e.tipo === 'testo') continue;
    for (const [a, b] of segmentiEntita(e)) {
      const pr = proietta(p, a, b);
      const d = dist(p, pr);
      if (d < dm) { dm = d; sl = pr; }
    }
  }
  return sl ? { p: sl, tipo: 'linea' } : null;
}

export function limiti(entita: Entita[], poligoni: Poligono[], riquadro?: P[] | null): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = ([x, y]: P) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  if (riquadro?.length) riquadro.forEach(add);
  else {
    for (const e of entita) {
      if (e.tipo === 'testo') add(e.punto);
      else for (const [a, b] of segmentiEntita(e)) { add(a); add(b); }
    }
    for (const p of poligoni) p.vertici.forEach(add);
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 10 };
  return { x0, y0, x1, y1 };
}

// ---- strumenti per i poligoni (squadra, semplifica, allineamento dei vertici)

/** Rotazione di un punto attorno all'origine (radianti). */
export function ruota(p: P, a: number): P {
  if (!a) return p;
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Punto allineato a `da` lungo uno dei due assi del riferimento ruotato di `angolo` (il più vicino a p). */
export function ortogonaleDa(p: P, da: P, angolo = 0): P {
  const r = ruota(p, -angolo), d = ruota(da, -angolo);
  const q: P = Math.abs(r[0] - d[0]) >= Math.abs(r[1] - d[1]) ? [r[0], d[1]] : [d[0], r[1]];
  return ruota(q, angolo);
}

/**
 * Direzione principale (radianti, fra 0 e π/2) di un insieme di segmenti: l'angolo, modulo 90°, che raccoglie più
 * lunghezza. È l'orientamento dei muri di un edificio «regolare», anche se il disegno è ruotato.
 */
export function direzionePrincipale(segmenti: [P, P][]): number {
  const passi = 180; // mezzo grado
  const peso = new Array(passi).fill(0);
  for (const [a, b] of segmenti) {
    const L = dist(a, b);
    if (L < 1e-6) continue;
    let t = Math.atan2(b[1] - a[1], b[0] - a[0]) % (Math.PI / 2);
    if (t < 0) t += Math.PI / 2;
    peso[Math.round((t / (Math.PI / 2)) * passi) % passi] += L;
  }
  // finestra di ±2 passi (1°) per tollerare i disegni imprecisi
  let mi = 0, mv = -1;
  for (let i = 0; i < passi; i++) {
    let v = 0;
    for (let k = -2; k <= 2; k++) v += peso[(i + k + passi) % passi];
    if (v > mv) { mv = v; mi = i; }
  }
  // angolo medio pesato dentro la finestra
  let sw = 0, sa = 0;
  for (let k = -2; k <= 2; k++) { const i = (mi + k + passi) % passi; sw += peso[i]; sa += peso[i] * (mi + k); }
  const a = ((sw ? sa / sw : mi) / passi) * (Math.PI / 2);
  return Math.abs(a - Math.PI / 2) < 1e-9 ? 0 : a;
}

/** Lati di un poligono chiuso. */
export const latiPoligono = (v: P[]): [P, P][] => v.map((p, i) => [p, v[(i + 1) % v.length]] as [P, P]);

/**
 * Toglie i vertici inutili: doppi (più vicini di `tol`) o allineati (scostamento dalla retta dei vicini < `tol`).
 * Restituisce un poligono con almeno 3 vertici.
 */
export function semplificaVertici(v: P[], tol = 0.01): P[] {
  let out = v.slice();
  let cambiato = true;
  while (cambiato && out.length > 3) {
    cambiato = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i - 1 + out.length) % out.length], p = out[i], b = out[(i + 1) % out.length];
      if (dist(a, p) < tol || distSegmento(p, a, b) < tol) { out.splice(i, 1); cambiato = true; i--; }
    }
  }
  return out;
}

/**
 * «Squadra» un poligono: i lati quasi paralleli agli assi dell'edificio (entro `tolGradi`) diventano esattamente
 * paralleli o perpendicolari; i lati obliqui restano obliqui. Ogni lato squadrato si porta sulla sua retta media
 * (pesata sugli estremi), ogni vertice fra due lati squadrati diventa il loro incrocio. I vertici allineati che
 * restano si tolgono.
 */
export function squadraPoligono(v: P[], angolo?: number, tolGradi = 10): P[] {
  if (v.length < 3) return v;
  const ang = angolo ?? direzionePrincipale(latiPoligono(v));
  const r = v.map((p) => ruota(p, -ang));
  const tol = (tolGradi * Math.PI) / 180;
  // classe dei lati: 'h' orizzontale (y costante), 'v' verticale (x costante), null obliquo
  const classe = latiPoligono(r).map(([a, b]) => {
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const m = ((t % Math.PI) + Math.PI) % Math.PI; // 0..π
    if (Math.min(m, Math.PI - m) <= tol) return 'h' as const;
    if (Math.abs(m - Math.PI / 2) <= tol) return 'v' as const;
    return null;
  });
  const n = r.length;
  // valore della retta per ogni lato squadrato: media delle coordinate dei due estremi
  const retta = classe.map((c, i) => { const a = r[i], b = r[(i + 1) % n]; return c === 'h' ? (a[1] + b[1]) / 2 : c === 'v' ? (a[0] + b[0]) / 2 : 0; });
  const nuovi: P[] = r.map((p, i) => {
    const prima = (i - 1 + n) % n, dopo = i; // lato che arriva nel vertice i e lato che parte
    let x = p[0], y = p[1];
    for (const k of [prima, dopo]) {
      if (classe[k] === 'h') y = retta[k];
      else if (classe[k] === 'v') x = retta[k];
    }
    // due lati della stessa classe di seguito (vertice allineato): media delle due rette
    if (classe[prima] && classe[prima] === classe[dopo]) {
      if (classe[prima] === 'h') y = (retta[prima] + retta[dopo]) / 2; else x = (retta[prima] + retta[dopo]) / 2;
    }
    return [x, y];
  });
  return semplificaVertici(nuovi.map((p) => ruota(p, ang)), 1e-4);
}

/**
 * Allinea un vertice che si sta spostando ai vertici vicini (prima e dopo) lungo gli assi dell'edificio: ogni
 * coordinata si aggancia a quella di un vicino se ci arriva entro `tol` (come il «puntamento» dei CAD).
 */
export function allineaAiVicini(p: P, vicini: P[], angolo: number, tol: number): { p: P; allineato: boolean } {
  const r = ruota(p, -angolo);
  let x = r[0], y = r[1], dx = tol, dy = tol, ok = false;
  for (const q of vicini) {
    const s = ruota(q, -angolo);
    if (Math.abs(s[0] - r[0]) < dx) { dx = Math.abs(s[0] - r[0]); x = s[0]; ok = true; }
    if (Math.abs(s[1] - r[1]) < dy) { dy = Math.abs(s[1] - r[1]); y = s[1]; ok = true; }
  }
  return { p: ruota([x, y], angolo), allineato: ok };
}
