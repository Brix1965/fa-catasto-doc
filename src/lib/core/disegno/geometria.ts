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
export function aggancia(p: P, punti: Aggancio[], entita: Entita[], tol: number, opz: { da?: P | null; ortogonale?: boolean; escludi?: P | null } = {}): Aggancio | null {
  let q = p;
  let ortho = false;
  if (opz.da && opz.ortogonale) {
    const dx = Math.abs(p[0] - opz.da[0]), dy = Math.abs(p[1] - opz.da[1]);
    q = dx >= dy ? [p[0], opz.da[1]] : [opz.da[0], p[1]];
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
      const dx = Math.abs(q[0] - opz.da[0]), dy = Math.abs(q[1] - opz.da[1]);
      return { p: dx >= dy ? [migliore.p[0], opz.da[1]] : [opz.da[0], migliore.p[1]], tipo: migliore.tipo };
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
