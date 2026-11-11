// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Modifiche a mano della forma dei vani (finestra «Vani dalla planimetria»): dividere un vano con un segmento,
 * unire due vani, superficie e centro dei contorni. I contorni sono anelli esterni in coordinate del DXF (metri).
 */
import { anello, dividi, linea, parti, poligono, unione, type XY } from './geo';

/** superficie di un anello (formula dell'area di Gauss) */
export function areaAnello(c: XY[]): number {
  let s = 0;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) s += (c[j][0] + c[i][0]) * (c[j][1] - c[i][1]);
  return Math.abs(s) / 2;
}
export const areaContorni = (cs: XY[][]): number => cs.reduce((a, c) => a + areaAnello(c), 0);

/** centro per l'etichetta: baricentro dei vertici dell'anello più grande */
export function centroContorni(cs: XY[][]): XY {
  const c = cs.reduce((m, x) => (areaAnello(x) > areaAnello(m) ? x : m), cs[0]);
  return [c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length];
}

const anelli = (g: any): XY[][] => parti(g).filter((x: any) => x.getGeometryType() === 'Polygon').map((x: any) => {
  const r = anello(x);
  // l'anello di JSTS ripete il primo punto in fondo: nei contorni dei vani no
  return r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
});

/**
 * Divide un vano con il segmento a-b (di solito da un lato all'altro del vano): il segmento si prolunga di 5 cm
 * per parte, così taglia il contorno anche se i punti sono appena dentro. Restituisce i pezzi (ognuno con i suoi
 * contorni, dal più grande), oppure null se il segmento non divide il vano.
 */
export function dividiVano(cs: XY[][], a: XY, b: XY): XY[][][] | null {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 0.05) return null;
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const taglio = linea([a[0] - ux * 0.05, a[1] - uy * 0.05], [b[0] + ux * 0.05, b[1] + uy * 0.05]);
  // i pezzi del contorno tagliato diventano vani; gli altri contorni (non toccati) restano col pezzo più grande
  const tagliati = cs.map((c) => { const f = poligono(c); return f.intersects(taglio) && dividi(f, taglio).filter((g: any) => g.getArea() > 0.01).length > 1; });
  const pezzi: XY[][][] = [];
  const resto: XY[][] = [];
  cs.forEach((c, i) => {
    const f = poligono(c);
    const pz = tagliati[i] ? dividi(f, taglio).filter((g: any) => g.getArea() > 0.01) : [f];
    for (const g of pz) { const r = anelli(g); if (tagliati[i]) pezzi.push(r); else resto.push(...r); }
  });
  if (pezzi.length < 2) return null;
  pezzi.sort((x, y) => areaContorni(y) - areaContorni(x));
  if (resto.length) pezzi[0] = [...pezzi[0], ...resto];
  return pezzi;
}

/** Unisce i contorni di due vani: le parti che si toccano diventano un contorno solo. */
export function unisciVani(a: XY[][], b: XY[][]): XY[][] {
  const u = unione([...a, ...b].map((c) => poligono(c)));
  const r = anelli(u);
  return r.length ? r : [...a, ...b];
}
