// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Geometria per il riconoscimento dei vani: un sottile strato sopra JSTS (porting di JTS, lo stesso motore di
 * shapely/GEOS usato dal prototipo Python), con le sole operazioni che servono.
 * Precisione piena (come shapely): arrotondare al millimetro staccava dai muri le porte tratteggiate che
 * finiscono a meno di 1 mm dallo spigolo (caso-2).
 */
// @ts-nocheck — JSTS non ha tipi per i moduli ES
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js';
import PrecisionModel from 'jsts/org/locationtech/jts/geom/PrecisionModel.js';
import Coordinate from 'jsts/org/locationtech/jts/geom/Coordinate.js';
import Polygonizer from 'jsts/org/locationtech/jts/operation/polygonize/Polygonizer.js';
import UnaryUnionOp from 'jsts/org/locationtech/jts/operation/union/UnaryUnionOp.js';
import BufferOp from 'jsts/org/locationtech/jts/operation/buffer/BufferOp.js';
import BufferParameters from 'jsts/org/locationtech/jts/operation/buffer/BufferParameters.js';
import LengthIndexedLine from 'jsts/org/locationtech/jts/linearref/LengthIndexedLine.js';
import DouglasPeuckerSimplifier from 'jsts/org/locationtech/jts/simplify/DouglasPeuckerSimplifier.js';
import 'jsts/org/locationtech/jts/monkey.js';

export type G = any;
export type XY = [number, number];

const gf = new GeometryFactory(new PrecisionModel());
// micrometro: unisce gli estremi «uguali» che differiscono per errori di arrotondamento (1e-14) senza spostare nulla
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const C = (p: XY) => new Coordinate(r6(p[0]), r6(p[1]));

export const linea = (a: XY, b: XY): G => gf.createLineString([C(a), C(b)]);
export const spezzata = (pts: XY[]): G => gf.createLineString(pts.map(C));
export const punto = (p: XY): G => gf.createPoint(C(p));
export function poligono(pts: XY[]): G {
  // senza doppioni consecutivi e senza la chiusura ripetuta: con meno di 3 punti distinti (es. [a, b, a] da un
  // vertice trascinato sopra un altro) JSTS lancia un'eccezione che bloccava tutto il riconoscimento
  const c = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(C).filter((x, i, a) => i === 0 || !x.equals2D(a[i - 1]));
  while (c.length > 1 && c[0].equals2D(c[c.length - 1])) c.pop();
  if (c.length < 3) return gf.createPolygon();
  c.push(c[0].copy());
  return gf.createPolygon(gf.createLinearRing(c));
}

/** Differenza a − b; in caso di errore topologico riprova con un buffer nullo, poi restituisce a. */
export function differenza(a: G, b: G): G {
  try { return a.difference(b); } catch { try { return a.buffer(0).difference(b.buffer(0)); } catch { return a; } }
}
export const vuoto = (): G => gf.createGeometryCollection([]);
export const collezione = (gs: G[]): G => gf.createGeometryCollection(gs);

/** Unione di più geometrie; in caso di errore topologico riprova con un buffer nullo dei poligoni. */
export function unione(gs: G[]): G {
  const v = gs.filter((g) => g && !g.isEmpty());
  if (!v.length) return vuoto();
  try { return UnaryUnionOp.union(collezione(v)); }
  catch {
    try { return UnaryUnionOp.union(collezione(v.map((g) => (g.getDimension() === 2 ? g.buffer(0) : g)))); }
    catch { return v.reduce((a, b) => { try { return a.union(b); } catch { return a; } }); }
  }
}

const PARAMETRI: Record<string, any> = {};
/** Buffer; `spigoli` = giunzioni a spigolo vivo (join_style=2 di shapely). */
export function buffer(g: G, d: number, spigoli = false): G {
  try {
    if (!spigoli) return g.buffer(d);
    const k = String(d);
    const p = PARAMETRI[k] ?? (PARAMETRI[k] = new BufferParameters(8, BufferParameters.CAP_ROUND, BufferParameters.JOIN_MITRE, 5));
    return BufferOp.bufferOp(g, d, p);
  } catch { return vuoto(); }
}

export function intersezione(a: G, b: G): G {
  try { return a.intersection(b); } catch { try { return a.buffer(0).intersection(b.buffer(0)); } catch { return vuoto(); } }
}

/** Facce chiuse delimitate da una rete di linee (polygonize di shapely). */
export function facce(rete: G): G[] {
  // l'unione di JSTS lascia doppi i tratti di linee sovrapposte (caso-2: 771 m di linee contro 708): con i lati
  // doppi il polygonize sbaglia le facce. Si spezza la rete in segmenti e si tengono quelli distinti.
  const visti = new Set<string>();
  const segmenti: G[] = [];
  for (const g of parti(rete)) {
    const c = g.getCoordinates();
    for (let i = 0; i + 1 < c.length; i++) {
      const a = c[i], b = c[i + 1];
      if (a.equals2D(b)) continue;
      const ka = `${r6(a.x)},${r6(a.y)}`, kb = `${r6(b.x)},${r6(b.y)}`;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (visti.has(k)) continue;
      visti.add(k);
      segmenti.push(gf.createLineString([new Coordinate(a.x, a.y), new Coordinate(b.x, b.y)]));
    }
  }
  const p = new Polygonizer();
  p.add(gf.createMultiLineString(segmenti));
  return p.getPolygons().toArray();
}

export const parti = (g: G): G[] => {
  if (!g || g.isEmpty()) return [];
  const n = g.getNumGeometries();
  const out: G[] = [];
  for (let i = 0; i < n; i++) out.push(g.getGeometryN(i));
  return out;
};

export const coordinate = (g: G): XY[] => g.getCoordinates().map((c: any) => [c.x, c.y] as XY);
export const anello = (p: G): XY[] => coordinate(p.getExteriorRing());
export const centro = (g: G): XY => { const c = g.getCentroid(); return [c.getX(), c.getY()]; };
export const puntoInterno = (g: G): G => g.getInteriorPoint();

/** Punto della linea più vicino a p (project + interpolate). */
export function proiezione(l: G, p: XY): XY {
  const li = new LengthIndexedLine(l);
  const c = li.extractPoint(li.project(C(p)));
  return [c.x, c.y];
}
/** Posizione relativa (0-1) del punto lungo la linea. */
export function posizione(l: G, p: G): number {
  const li = new LengthIndexedLine(l);
  return li.project(p.getCoordinate()) / l.getLength();
}

export const semplifica = (g: G, t: number): G => DouglasPeuckerSimplifier.simplify(g, t);

/** Divide il poligono con una linea (split di shapely): facce del contorno unito alla linea, dentro il poligono. */
export function dividi(f: G, l: G): G[] {
  try {
    return facce(rete([f.getBoundary(), l])).filter((x) => f.contains(x.getInteriorPoint()));
  } catch { return [f]; }
}

/**
 * Nodatura robusta di una rete di segmenti: ogni segmento si spezza dove ne incrocia un altro e dove un altro
 * finisce sopra di lui (entro `eps`, 0,01 mm). L'unione di JSTS non trova i nodi «a T» quando l'estremo cade a
 * 1e-12 dalla linea (caso-2: muri lunghi non spezzati, facce unite); GEOS/shapely sì. Gli estremi vicini
 * (< eps) diventano lo stesso vertice. Restituisce la rete come MultiLineString di segmenti distinti.
 */
export function rete(gs: G[], eps = 1e-5): G {
  const seg: [XY, XY][] = [];
  for (const g of gs) for (const p of parti(g)) {
    const c = p.getCoordinates();
    for (let i = 0; i + 1 < c.length; i++) if (!c[i].equals2D(c[i + 1])) seg.push([[c[i].x, c[i].y], [c[i + 1].x, c[i + 1].y]]);
  }
  const n = seg.length;
  const tagli: number[][] = seg.map(() => []);
  const box = seg.map(([a, b]) => [Math.min(a[0], b[0]) - eps, Math.min(a[1], b[1]) - eps, Math.max(a[0], b[0]) + eps, Math.max(a[1], b[1]) + eps]);
  // parametro t del punto p proiettato su a-b, se p dista meno di eps dal segmento (interno)
  const sopra = (a: XY, b: XY, p: XY): number | null => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    if (L2 === 0) return null;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
    if (t <= 0 || t >= 1) return null;
    const qx = a[0] + t * dx - p[0], qy = a[1] + t * dy - p[1];
    return qx * qx + qy * qy <= eps * eps ? t : null;
  };
  for (let i = 0; i < n; i++) {
    const [a, b] = seg[i], bi = box[i];
    for (let j = i + 1; j < n; j++) {
      const bj = box[j];
      if (bj[0] > bi[2] || bj[2] < bi[0] || bj[1] > bi[3] || bj[3] < bi[1]) continue;
      const [c, d] = seg[j];
      // estremi di uno sopra l'altro (nodi a T e sovrapposizioni)
      for (const p of [c, d]) { const t = sopra(a, b, p); if (t !== null) tagli[i].push(t); }
      for (const p of [a, b]) { const t = sopra(c, d, p); if (t !== null) tagli[j].push(t); }
      // incrocio proprio
      const r: XY = [b[0] - a[0], b[1] - a[1]], s2: XY = [d[0] - c[0], d[1] - c[1]];
      const den = r[0] * s2[1] - r[1] * s2[0];
      if (Math.abs(den) < 1e-14) continue;
      const qp: XY = [c[0] - a[0], c[1] - a[1]];
      const t = (qp[0] * s2[1] - qp[1] * s2[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
      if (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9) { tagli[i].push(t); tagli[j].push(u); }
    }
  }
  // vertici canonici: punti a meno di eps diventano lo stesso (griglia di eps con i vicini)
  const vertici = new Map<string, XY>();
  const cella = (v: number) => Math.round(v / eps);
  const canonico = (p: XY): XY => {
    const cx = cella(p[0]), cy = cella(p[1]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const q = vertici.get(`${cx + dx},${cy + dy}`);
      if (q && Math.abs(q[0] - p[0]) <= eps && Math.abs(q[1] - p[1]) <= eps) return q;
    }
    vertici.set(`${cx},${cy}`, p);
    return p;
  };
  const visti = new Set<string>();
  const out: G[] = [];
  const k = (p: XY) => `${p[0]},${p[1]}`;
  for (let i = 0; i < n; i++) {
    const [a, b] = seg[i];
    const ts = [0, ...tagli[i].sort((x, y) => x - y), 1];
    let prec = canonico(a);
    for (let m = 1; m < ts.length; m++) {
      const t = ts[m];
      const p = canonico(m === ts.length - 1 ? b : [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      if (p !== prec) {
        const key = k(prec) < k(p) ? `${k(prec)}|${k(p)}` : `${k(p)}|${k(prec)}`;
        if (!visti.has(key)) { visti.add(key); out.push(gf.createLineString([new Coordinate(prec[0], prec[1]), new Coordinate(p[0], p[1])])); }
      }
      prec = p;
    }
  }
  return gf.createMultiLineString(out);
}

