// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Poligoni DOCFA_POLIGONI generati dai vani riconosciuti (SPERIMENTALE): il tecnico li controlla e li corregge.
 * - A: vani principali, bagni e accessori diretti; B: accessori indiretti comunicanti; C: locali staccati
 *   dall'abitazione (ripostiglio in giardino); D: balconi, terrazze, logge, portici; F: giardini, corti, resedi, aie.
 * - Gli spazi a comune o di altre unità (vano scale a comune, resede a comune, androne…) non entrano mai.
 * - I muri che delimitano all'esterno balconi, terrazze e giardini vanno con questi (vademecum Docfa).
 * - Ogni poligono comprende i muri che toccano i suoi vani (riconosciuti fino a `spessoreMax`, 1 m: i muri degli
 *   edifici esistenti possono essere spessi): muri interni e
 *   perimetrali esterni per intero fino a 50 cm di spessore; i muri di confine con altre unità o con spazi a comune
 *   (vano scale, androne, resede a comune, «altra u.i.») fino alla mezzeria, al massimo 25 cm (DPR 138/98, allegato C:
 *   muri interni e perimetrali per intero fino a 50 cm, muri in comunione al 50% fino a 25 cm; regola confermata da
 *   Fabrizio il 10/11/2026). Le altre unità si riconoscono dai testi nel DXF («altra u.i.», «altra proprietà», «… a
 *   comune»). Una striscia stretta con scritto «altra u.i.» lungo i propri muri (l'unità vicina non è disegnata, il
 *   testo sta nello spessore del muro) è il muro di confine: entra fino a metà.
 * - Un muro fra un vano A e uno B va al poligono A.
 */
import type { Poligono, TipoAmbientePoligono } from '../model';
import type { TipoVano } from './riconosci';
import { anello, buffer, differenza, facce, intersezione, linea, parti, poligono, punto, puntoInterno, rete, semplifica, unione, type G, type XY } from './geo';

export interface VanoPerPoligoni { tipo: TipoVano; contorni: XY[][]; testi?: string[]; scoperto?: 'D' | 'F'; comune?: boolean; staccato?: boolean }

export interface PoligoniGenerati {
  poligoni: Poligono[];
  avvisi: string[];
}

const GRUPPO: Partial<Record<TipoVano, TipoAmbientePoligono>> = { principale: 'A', bagno: 'A', diretto: 'A', verificare: 'A', indiretto: 'B' };

/** Tipologia di poligono di un vano riconosciuto (null: non entra in nessun poligono). */
export function tipologiaPoligono(v: VanoPerPoligoni): TipoAmbientePoligono | null {
  if (v.comune) return null;
  if (v.tipo === 'escluso') {
    if (v.scoperto) return v.scoperto;
    // risultati senza il campo `scoperto` (versioni precedenti): dal nome
    return v.testi?.some((t) => /^(balcon|terrazz|loggia(?! chiusa)|portic)/i.test(t.trim())) ? 'D' : null;
  }
  if (v.staccato) return 'C';
  return GRUPPO[v.tipo] ?? null;
}

/**
 * Muri attorno ai vani di un gruppo. `linee`: le linee continue del disegno. Alla rete delle linee si aggiunge il
 * contorno della fascia di `spessoreMax` attorno ai vani, che chiude anche le strisce dei muri esterni (verso
 * l'esterno non c'è nulla che le chiuda); sono muri le facce sottili dentro la fascia che toccano i vani e che non
 * stanno lungo il contorno della fascia (quella è la striscia oltre la facciata).
 */
function muriAttorno(R: G, linee: [XY, XY][], spessoreMax: number, oltre: G | null = null): G[] {
  const fascia = buffer(R, spessoreMax, true);
  const bordoFascia = fascia.getBoundary();
  const vicino = buffer(R, 0.03);
  const dentro = buffer(fascia, 0.01);
  const segmenti = linee.map(([a, b]) => linea(a, b)).filter((l) => l.intersects(dentro));
  const W: G[] = [];
  for (const f of facce(rete([...segmenti, bordoFascia]))) {
    if (f.getArea() < 1e-4 || !fascia.contains(puntoInterno(f)) || R.contains(puntoInterno(f))) continue;
    const o = buffer(f, -spessoreMax / 2, true);
    if (!(o.isEmpty() || o.getArea() < 0.02)) continue; // non è sottile: non è un muro
    if (!f.intersects(vicino)) continue;
    if (intersezione(buffer(bordoFascia, 0.005), f.getBoundary()).getLength() > 0.35 * f.getLength()) continue;
    W.push(oltre && f.intersects(oltre) ? differenza(f, oltre) : f);
  }
  return W.filter((w) => !w.isEmpty() && w.getArea() > 1e-4);
}

/**
 * Muri di confine con un'altra unità o con uno spazio a comune: si tiene solo la parte più vicina ai propri vani
 * che allo spazio confinante, cioè fino alla mezzeria. Anche il muro esterno che prosegue davanti allo spazio
 * confinante si ferma sulla stessa mezzeria. La zona «più vicina al confine» si costruisce a passi di 1 cm:
 * unione di (fascia di d attorno al confine) meno (fascia di d attorno ai vani), per d fino a `fino`.
 */
function piuVicinoAlConfine(R: G, X: G, fino: number): G {
  const passo = 0.01;
  const pezzi: G[] = [];
  // si lavora solo vicino ai vani: il resto del confine non conta
  const Xv = intersezione(X, buffer(R, fino + 0.05));
  if (Xv.isEmpty()) return Xv;
  for (let d = passo; d <= fino + 1e-9; d += passo) {
    const z = differenza(buffer(Xv, d), buffer(R, d));
    if (!z.isEmpty()) pezzi.push(z);
  }
  // i passi lasciano un contorno a dentini di 1-2 cm: si raddrizza entro 2 cm (0,1 mm sul foglio a 1:200)
  return pezzi.length ? buffer(semplifica(unione(pezzi), 0.02), 0) : Xv;
}

/** DPR 138/98, allegato C: muri per intero fino a 50 cm, muri in comunione al 50% fino a 25 cm */
export const MURO_INTERO_MAX = 0.5;
export const MURO_COMUNE_MAX = 0.25;

/**
 * Muri in comunione più spessi di 50 cm: per ogni lato del contorno dei vani e ogni lato dello spazio confinante
 * paralleli, affacciati e a distanza di uno spessore di muro (≤ `max`), la parte del muro fra i due oltre i 25 cm dal
 * filo dei vani, nel tratto in cui si sovrappongono e per 50 cm oltre i capi (il muro esterno che passa davanti).
 */
function fasceDiConfine(R: G, X: G, max: number): G[] {
  const lati = (g: G): [XY, XY][] => {
    const out: [XY, XY][] = [];
    for (const p of parti(g)) {
      if (p.getGeometryType() !== 'Polygon') continue;
      const anelli = [p.getExteriorRing(), ...Array.from({ length: p.getNumInteriorRing() }, (_, i) => p.getInteriorRingN(i))];
      for (const a of anelli) {
        const c = a.getCoordinates();
        for (let i = 0; i + 1 < c.length; i++) if (Math.hypot(c[i + 1].x - c[i].x, c[i + 1].y - c[i].y) > 0.05) out.push([[c[i].x, c[i].y], [c[i + 1].x, c[i + 1].y]]);
      }
    }
    return out;
  };
  const Xv = intersezione(X, buffer(R, max + 0.05));
  if (Xv.isEmpty()) return [];
  const lr = lati(R), lx = lati(Xv);
  const fasce: G[] = [];
  for (const [a1, a2] of lr) {
    const L = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
    const u: XY = [(a2[0] - a1[0]) / L, (a2[1] - a1[1]) / L];
    for (const [b1, b2] of lx) {
      const M = Math.hypot(b2[0] - b1[0], b2[1] - b1[1]);
      const v: XY = [(b2[0] - b1[0]) / M, (b2[1] - b1[1]) / M];
      if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.09) continue; // non paralleli (> 5°)
      const d = u[0] * (b1[1] - a1[1]) - u[1] * (b1[0] - a1[0]); // distanza con segno dalla retta di a
      if (Math.abs(d) < 0.02 || Math.abs(d) > max) continue;
      const t1 = (b1[0] - a1[0]) * u[0] + (b1[1] - a1[1]) * u[1], t2 = (b2[0] - a1[0]) * u[0] + (b2[1] - a1[1]) * u[1];
      const t0 = Math.max(0, Math.min(t1, t2)), t3 = Math.min(L, Math.max(t1, t2));
      if (t3 - t0 < 0.05) continue;
      const n: XY = [-u[1] * Math.sign(d), u[0] * Math.sign(d)];
      const m: XY = [a1[0] + u[0] * (t0 + t3) / 2, a1[1] + u[1] * (t0 + t3) / 2];
      // affacciati: fra i due lati non ci sono né i vani né lo spazio confinante
      const q: XY = [m[0] + n[0] * Math.abs(d) / 2, m[1] + n[1] * Math.abs(d) / 2];
      if (R.contains(punto(q)) || Xv.contains(punto(q)) || R.contains(punto([m[0] + n[0] * 0.01, m[1] + n[1] * 0.01]))) continue;
      const P = (t: number, k: number): XY => [a1[0] + u[0] * t + n[0] * k, a1[1] + u[1] * t + n[1] * k];
      // la fascia prosegue di 50 cm oltre i due capi (spessore del muro esterno che le passa davanti), così il limite
      // dei 25 cm resta una linea dritta fino al filo esterno
      const e0 = t0 <= 1e-6 ? 0.5 : 0, e3 = t3 >= L - 1e-6 ? 0.5 : 0;
      // solo la parte oltre i 25 cm dal filo dei vani (misurati perpendicolarmente al muro)
      if (Math.abs(d) <= 2 * MURO_COMUNE_MAX) continue;
      fasce.push(poligono([P(t0 - e0, MURO_COMUNE_MAX), P(t3 + e3, MURO_COMUNE_MAX), P(t3 + e3, Math.abs(d)), P(t0 - e0, Math.abs(d))]));
    }
  }
  return fasce;
}

/** testo di un'altra unità («altra u.i.», «altra proprietà»): la striscia che lo contiene può essere il muro di confine */
const RE_ALTRA = /(^|[\s(])altr[ae]\s*(u\.?\s*i|propriet|ditta)/i;

const unisciVani = (vs: VanoPerPoligoni[]): G | null => {
  const r = vs.flatMap((v) => v.contorni.filter((c) => c.length >= 3).map((c) => poligono(c)));
  return r.length ? unione(r) : null;
};

export function generaPoligoni(vani: VanoPerPoligoni[], linee: [XY, XY][], spessoreMax = 1.0): PoligoniGenerati {
  const avvisi: string[] = [];
  // strisce strette con «altra u.i.» (≤ 1,2 m): sono il muro di confine, l'unità vicina non è disegnata
  const strisce: { g: G; spessore: number }[] = [];
  const altriSpazi: VanoPerPoligoni[] = [];
  for (const v of vani.filter((x) => x.comune)) {
    const g = unisciVani([v]);
    if (!g) continue;
    const spessore = (2 * g.getArea()) / g.getLength();
    if ((v.testi ?? []).some((t) => RE_ALTRA.test(t)) && spessore <= 1.2) strisce.push({ g, spessore });
    else altriSpazi.push(v);
  }
  // spazi di altre unità e a comune: i muri verso di loro si fermano alla mezzeria
  const confine = unisciVani(altriSpazi);
  const impronta = (tipo: TipoAmbientePoligono, Rprec: G | null): G | null => {
    const R = unisciVani(vani.filter((v) => tipologiaPoligono(v) === tipo));
    if (!R) return null;
    // la parte dei muri più vicina agli spazi confinanti che ai propri vani non è dell'unità (mezzeria)
    let oltre = confine && confine.distance(R) <= spessoreMax ? piuVicinoAlConfine(R, confine, spessoreMax) : null;
    // muri in comunione oltre 50 cm: si conta al massimo 25 cm dalla parte dell'unità
    if (oltre && confine) {
      const fasce = fasceDiConfine(R, confine, spessoreMax);
      if (fasce.length) oltre = unione([oltre, differenza(unione(fasce), R)]);
    }
    // un muro che tocca i vani di un gruppo precedente (es. fra camera e balcone) è di quel gruppo, con le sue
    // aperture: qui non si prende
    const bordoPrec = Rprec ? buffer(Rprec, 0.02) : null;
    const muri = muriAttorno(R, linee, spessoreMax, oltre)
      .filter((f) => !bordoPrec || intersezione(bordoPrec, f.getBoundary()).getLength() <= 0.3)
      .map((f) => (strisce.length ? differenza(f, unione(strisce.map((x) => x.g))) : f))
      .filter((f) => !f.isEmpty());
    // metà della striscia di confine verso i propri vani
    for (const { g, spessore } of strisce) {
      if (g.distance(R) > 0.6) continue;
      const meta = intersezione(g, buffer(R, R.distance(g) + Math.min(spessore / 2, MURO_COMUNE_MAX), true));
      if (!meta.isEmpty()) muri.push(meta);
    }
    // chiusura: riempie le fessure fra vani e muri più strette di 30 cm (tramezzi non chiusi nel disegno); verso gli
    // spazi confinanti la chiusura non deve riempire di nuovo la metà di muro tolta
    // muri per intero al massimo 50 cm dai vani
    const chiuso = intersezione(buffer(buffer(unione([R, ...muri]), 0.15, true), -0.15, true), buffer(R, MURO_INTERO_MAX, true));
    const vietato = [...(oltre ? [oltre] : []), ...strisce.map((x) => x.g)];
    return vietato.length ? differenza(chiuso, differenza(unione(vietato), unione([R, ...muri]))) : chiuso;
  };
  // in ordine di precedenza: un muro fra un vano e il giardino va al vano, fra terrazza e giardino alla terrazza
  const ordine: TipoAmbientePoligono[] = ['A', 'B', 'C', 'D', 'F'];
  const prese: G[] = [];
  const gruppi: [TipoAmbientePoligono, G | null][] = [];
  const vaniPrec: G[] = [];
  for (const t of ordine) {
    let g = impronta(t, vaniPrec.length ? unione(vaniPrec) : null);
    const Rt = unisciVani(vani.filter((v) => tipologiaPoligono(v) === t));
    if (Rt) vaniPrec.push(Rt);
    if (g && prese.length) g = differenza(g, unione(prese));
    if (g && !g.isEmpty()) prese.push(g);
    gruppi.push([t, g]);
  }
  const out: Poligono[] = [];
  for (const [tipo, g] of gruppi) {
    if (!g || g.isEmpty()) continue;
    for (const p of parti(g)) {
      if (p.getGeometryType() !== 'Polygon' || p.getArea() < 0.5) continue;
      // i buchi sottili sono muri non riconosciuti: si riempiono; gli altri (cavedi, vuoti) si segnalano
      let area = 0;
      for (let i = 0; i < p.getNumInteriorRing(); i++) {
        const h = poligono(anello(p.getFactory().createPolygon(p.getInteriorRingN(i))));
        const o = buffer(h, -spessoreMax / 2, true);
        if (!(o.isEmpty() || o.getArea() < 0.02)) area += h.getArea();
      }
      if (area > 0.3) avvisi.push(`Il poligono ${tipo} di ${p.getArea().toFixed(2).replace('.', ',')} m² racchiude ${area.toFixed(2).replace('.', ',')} m² che non sono dell'unità (cavedio, vuoto…): il poligono generato li comprende, va corretto.`);
      const v = anello(semplifica(p, 0.005));
      v.pop(); // l'ultimo vertice ripete il primo
      const tondo = (w: XY[]): [number, number][] => w.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
      if (v.length < 3) continue;
      // un contorno che tocca se stesso (due parti unite in un punto) non è valido per Docfa («a farfalla»):
      // si divide nelle sue parti
      const pv = poligono(tondo(v));
      if (pv.isValid()) { out.push({ tipo, vertici: tondo(v), altezzaValida: true }); continue; }
      for (const q of parti(buffer(pv, 0))) {
        if (q.getGeometryType() !== 'Polygon' || q.getArea() < 0.5) continue;
        const w = anello(q); w.pop();
        if (w.length >= 3) out.push({ tipo, vertici: tondo(w), altezzaValida: true });
      }
    }
  }
  if (!out.length) avvisi.push('Nessun poligono generato: non ci sono vani inclusi.');
  return { poligoni: out, avvisi };
}

/**
 * Spessore dei muri sezionati (sperimentale): le linee continue che separano un muro da un vano o dall'esterno.
 * Restano sottili le linee dentro i muri (infissi), i gradini e tutto ciò che non tocca i muri dei vani.
 * Restituisce gli indici delle entità (linee e polilinee) da ingrossare: almeno il 60% della lunghezza deve
 * stare sul contorno dei muri.
 */
export function lineeDiMuro(entita: { tipo: string; p1?: XY; p2?: XY; punti?: XY[]; chiusa?: boolean; tratteggiata?: boolean }[], vani: VanoPerPoligoni[], linee: [XY, XY][], spessoreMax = 0.6): number[] {
  const R = unisciVani(vani.filter((v) => v.tipo !== 'escluso'));
  if (!R) return [];
  const W = unione(muriAttorno(R, linee, spessoreMax));
  if (W.isEmpty()) return [];
  const bordo = buffer(W.getBoundary(), 0.004);
  const nelMuro = buffer(W, -0.004);
  const out: number[] = [];
  entita.forEach((e, i) => {
    if (e.tratteggiata) return;
    const pts: XY[] = e.tipo === 'linea' && e.p1 && e.p2 ? [e.p1, e.p2] : e.tipo === 'polilinea' && e.punti ? (e.chiusa ? [...e.punti, e.punti[0]] : e.punti) : [];
    if (pts.length < 2) return;
    let tot = 0, ok = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const s = linea(pts[k], pts[k + 1]);
      const L = s.getLength();
      if (L < 1e-6) continue;
      tot += L;
      // sul contorno del muro, ma non con il muro da entrambe le parti (linea interna al muro)
      const sopra = intersezione(s, bordo).getLength();
      if (sopra < 0.5 * L) continue;
      const m: XY = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2];
      const n: XY = [-(pts[k + 1][1] - pts[k][1]) / L, (pts[k + 1][0] - pts[k][0]) / L];
      const lato = (d: number) => W.contains(punto([m[0] + n[0] * d, m[1] + n[1] * d]));
      if (lato(0.02) && lato(-0.02)) continue;
      if (nelMuro.contains(punto(m))) continue;
      ok += sopra;
    }
    if (tot > 0 && ok >= 0.6 * tot) out.push(i);
  });
  return out;
}

/** Spessore di penna dei muri sezionati: 0,07 a 1:200 (0,35 mm sul foglio), proporzionale alla scala. */
export const spessoreMuroPerScala = (scala: number): number => Math.round(0.07 * (scala / 200) * 10000) / 10000;
