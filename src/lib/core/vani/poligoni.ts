/**
 * Poligoni DOCFA_POLIGONI generati dai vani riconosciuti (SPERIMENTALE): il tecnico li controlla e li corregge.
 * - A: vani principali, bagni e accessori diretti; B: accessori indiretti comunicanti; C: locali staccati
 *   dall'abitazione (ripostiglio in giardino); D: balconi, terrazze, logge, portici; F: giardini, corti, resedi, aie.
 * - Gli spazi a comune o di altre unità (vano scale a comune, resede a comune, androne…) non entrano mai.
 * - I muri che delimitano all'esterno balconi, terrazze e giardini vanno con questi (vademecum Docfa).
 * - Ogni poligono comprende i muri che toccano i suoi vani, fino a `spessoreMax` (60 cm): muri interni e
 *   perimetrali per intero, i muri in comune con altre unità per intero (il DPR 138/98 ne conta metà: da ritoccare).
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
function muriAttorno(R: G, linee: [XY, XY][], spessoreMax: number): G[] {
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
    W.push(f);
  }
  return W;
}

const unisciVani = (vs: VanoPerPoligoni[]): G | null => {
  const r = vs.flatMap((v) => v.contorni.filter((c) => c.length >= 3).map((c) => poligono(c)));
  return r.length ? unione(r) : null;
};

export function generaPoligoni(vani: VanoPerPoligoni[], linee: [XY, XY][], spessoreMax = 0.6): PoligoniGenerati {
  const avvisi: string[] = [];
  const impronta = (tipo: TipoAmbientePoligono): G | null => {
    const R = unisciVani(vani.filter((v) => tipologiaPoligono(v) === tipo));
    if (!R) return null;
    // chiusura: riempie le fessure fra vani e muri più strette di 30 cm (tramezzi non chiusi nel disegno)
    return buffer(buffer(unione([R, ...muriAttorno(R, linee, spessoreMax)]), 0.15, true), -0.15, true);
  };
  // in ordine di precedenza: un muro fra un vano e il giardino va al vano, fra terrazza e giardino alla terrazza
  const ordine: TipoAmbientePoligono[] = ['A', 'B', 'C', 'D', 'F'];
  const prese: G[] = [];
  const gruppi: [TipoAmbientePoligono, G | null][] = [];
  for (const t of ordine) {
    let g = impronta(t);
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
