/**
 * Riconoscimento automatico dei vani da una planimetria DXF (SPERIMENTALE).
 *
 * Porting del prototipo prototipo-vani/vani.py (provato su tre planimetrie reali, non pubblicate).
 * Regole concordate con il geometra che segue il progetto:
 * - muri = linee continue; porte = interruzioni del muro fra due spalle, oppure segmento tratteggiato allineato
 *   al muro nel vuoto del tramezzo; ogni spalla appartiene a una sola apertura (le più vicine);
 * - tratteggi di traverso = zone di altezza diversa dello stesso vano (non dividono);
 * - apertura più grande di 4 m² (larghezza × altezza del vano più basso) = un vano solo;
 * - tipo dal testo nel vano (camera, bagno, ingresso, dis. …); dentro i poligoni B/C = accessorio indiretto;
 * - G e croci (X) = nessun vano; scala interna contata una volta, intera, al piano dell'unità;
 * - locale chiuso senza nome > 1 m² = accessorio diretto «da verificare»;
 * - superfici al m² intero, vano per vano (da 0,5 per eccesso), totali = somma dei vani arrotondati.
 * Il risultato è una PROPOSTA: il tecnico cambia il tipo di ogni vano, lo esclude, e corregge i totali.
 */
import type { Entita } from '../raster/dxf';
import type { Poligono } from '../model';
import {
  anello, buffer, centro, coordinate, dividi, facce as faccePoligonizzate, intersezione, linea, parti,
  poligono, posizione, proiezione, punto, puntoInterno, rete, semplifica, spezzata, unione, vuoto, type G, type XY,
} from './geo';

export type TipoVano = 'principale' | 'bagno' | 'diretto' | 'indiretto' | 'verificare' | 'escluso';

export interface VanoRiconosciuto {
  id: number;
  tipo: TipoVano;
  /** tipo proposto dal programma (per segnalare le modifiche del tecnico) */
  tipoProposto: TipoVano;
  /** superficie netta esatta (m²) */
  superficie: number;
  /** superficie al m² intero, come la vuole Docfa */
  m2: number;
  testi: string[];
  /** altezze lette dai testi «h260», «h=2,40» (m) */
  altezze: number[];
  /** contorni (uno o più) in coordinate del DXF, per l'anteprima */
  contorni: XY[][];
  centro: XY;
  /** scala interna (contata intera al piano dell'unità) */
  scala?: boolean;
  /** motivo per cui va controllato */
  nota?: string;
}

export interface RisultatoVani {
  vani: VanoRiconosciuto[];
  /** linee del disegno (per l'anteprima) */
  linee: { a: XY; b: XY; tratteggiata: boolean }[];
  limiti: { x0: number; y0: number; x1: number; y1: number };
  avvisi: string[];
}

const CONTINUE = new Set(['', 'CONTINUOUS', 'CONTINUA', 'BYLAYER', 'BYBLOCK']);
const tratteggiata = (e: Entita) => !CONTINUE.has((e.tipoLinea ?? '').toUpperCase());

const NOMI: [TipoVano, string[]][] = [
  ['principale', ['camera', 'letto', 'soggiorno', 'pranzo', 'studio', 'sala', 'salotto', 'cucina', 'tinello', 'vano', 'stanza']],
  ['bagno', ['bagno', 'wc', 'w.c.', 'servizio', 'doccia']],
  ['diretto', ['ingresso', 'corridoio', 'disimpegno', 'disimp', 'dis.', 'dis', 'rip', 'ripostiglio', 'guardaroba', 'cottura', 'lavanderia', 'dispensa', 'cabina armadio', 'cabina armadi', 'cab. armadi', 'antibagno', 'anti', 'veranda', 'loggia chiusa', 'scala', 'vano scala']],
  ['indiretto', ['soffitta', 'cantina', 'sottotetto', 'soffitte', 'locale tecnico', 'centrale termica', 'lavatoio', 'sgombero', 'deposito', 'garage', 'autorimessa', 'magazzino']],
];

/** Tipo di vano dal testo (null se il testo non è un nome di vano, es. «h260»). */
export function tipoDaTesto(t0: string): TipoVano | null {
  let t = t0.toLowerCase().trim();
  if (t.endsWith('.')) t = t.slice(0, -1);
  // vince la parola più lunga: «vano scala» è una scala, non un vano principale
  let meglio: TipoVano | null = null, lung = 0;
  for (const [k, v] of NOMI) for (const w of v) if ((t === w || t.startsWith(w)) && w.length > lung) { meglio = k; lung = w.length; }
  return meglio;
}

/** Altezza da un testo «h260», «h=2,40», «hmin 220», «H: 3.05» (in metri), altrimenti null. */
export function altezzaDaTesto(t: string): number | null {
  const m = /^\s*h(?:min|max|media)?\s*[=:]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m)?\s*$/i.exec(t);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return v > 20 ? v / 100 : v;
}

/** m² interi come Docfa: da 0,5 per eccesso, sotto per difetto. */
export const m2Intero = (a: number): number => Math.floor(a + 0.5);

/** Archi spezzati in segmenti (freccia massima 1 cm, come `flattening(0.01)` di ezdxf). */
function puntiArco(c: XY, r: number, a0: number, a1: number): XY[] {
  let fine = a1;
  while (fine <= a0) fine += 360;
  const sweep = ((fine - a0) * Math.PI) / 180;
  const passo = r > 0.01 ? 2 * Math.acos(Math.max(-1, 1 - 0.01 / r)) : sweep;
  const n = Math.max(2, Math.ceil(sweep / Math.max(passo, 1e-3)));
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 * Math.PI) / 180 + (sweep * i) / n;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/**
 * Tratto che unisce un estremo libero alla linea vicina, prolungato di 2 mm oltre il punto d'arrivo: così
 * l'unione delle linee crea sicuramente il nodo (in virgola mobile il punto proiettato non cade mai
 * esattamente sulla linea). Il pezzetto in più resta un «ramo morto» che il polygonize scarta.
 */
function cucitura(e: XY, q: XY): G {
  const L = dist(e, q) || 1;
  return linea(e, [q[0] + ((q[0] - e[0]) / L) * 0.002, q[1] + ((q[1] - e[1]) / L) * 0.002]);
}
const estremi = (l: G): [XY, XY] => { const c = coordinate(l); return [c[0], c[c.length - 1]]; };
function direzione(l: G): XY {
  const [a, b] = estremi(l); const L = dist(a, b) || 1;
  return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
}
function paralleli(a: G, b: G, tol = 0.05): boolean {
  const da = direzione(a), db = direzione(b);
  return Math.abs(da[0] * db[1] - da[1] * db[0]) < tol;
}

/**
 * Riconosce i vani di una planimetria. `entita`: entità del DXF (senza il riquadro, già esplose);
 * `poligoni`: poligoni DOCFA_POLIGONI dell'unità (servono per sapere dov'è l'unità e cosa è B/C/G).
 */
export function riconosciVani(entita: Entita[], poligoni: Poligono[]): RisultatoVani {
  const avvisi: string[] = [];
  const pol = poligoni.filter((p) => p.vertici.length >= 3).map((p) => ({ tipo: p.tipo, g: poligono(p.vertici) }));
  if (!pol.length) return { vani: [], linee: [], limiti: { x0: 0, y0: 0, x1: 1, y1: 1 }, avvisi: ['Nel DXF non ci sono poligoni DOCFA_POLIGONI: servono per sapere dove sta l\'unità.'] };
  const di = (tipi: string) => pol.filter((p) => tipi.includes(p.tipo)).map((p) => p.g);

  // ---- segmenti continui e tratteggiati, testi, archi
  let cont: G[] = [];
  let tratt: G[] = [];
  const archi: G[] = [];
  const testi: { t: string; p: G; xy: XY }[] = [];
  const aggiungi = (a: XY, b: XY, tr: boolean) => { if (dist(a, b) > 1e-6) (tr ? tratt : cont).push(linea(a, b)); };
  for (const e of entita) {
    if (e.tipo === 'linea') aggiungi(e.p1, e.p2, tratteggiata(e));
    else if (e.tipo === 'polilinea') {
      const p = e.punti;
      for (let i = 0; i + 1 < p.length; i++) aggiungi(p[i], p[i + 1], tratteggiata(e));
      if (e.chiusa && p.length > 2) aggiungi(p[p.length - 1], p[0], tratteggiata(e));
    } else if (e.tipo === 'arco') {
      const pts = puntiArco(e.centro, e.raggio, e.inizio, e.fine);
      archi.push(spezzata(pts));
      for (let i = 0; i + 1 < pts.length; i++) aggiungi(pts[i], pts[i + 1], tratteggiata(e));
    } else if (e.tipo === 'testo') testi.push({ t: e.testo.trim(), p: punto(e.punto), xy: e.punto });
  }

  const unita = buffer(unione(di('ABCGH')), 0.6);
  cont = cont.filter((s) => s.intersects(unita));
  tratt = tratt.filter((s) => s.intersects(unita));
  const lineeAnteprima = [...cont.map((s) => ({ s, tr: false })), ...tratt.map((s) => ({ s, tr: true }))]
    .map(({ s, tr }) => { const [a, b] = estremi(s); return { a, b, tratteggiata: tr }; });

  // ---- piccole interruzioni del disegno (< 20 cm): l'estremo libero si unisce alla linea più vicina
  const chiave = (p: XY) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const conta = new Map<string, number>();
  for (const l of cont) for (const e of estremi(l)) conta.set(chiave(e), (conta.get(chiave(e)) ?? 0) + 1);
  const cuciture: G[] = [];
  for (const l of cont) {
    for (const e of estremi(l)) {
      if ((conta.get(chiave(e)) ?? 0) > 1) continue;
      const P = punto(e);
      const altre = cont.filter((m) => m !== l && m.distance(P) < 0.2);
      if (!altre.length || altre.some((m) => m.distance(P) < 1e-6)) continue;
      const m = altre.reduce((a, b) => (a.distance(P) <= b.distance(P) ? a : b));
      const q = proiezione(m, e);
      if (dist(e, q) > 1e-6) cuciture.push(cucitura(e, q));
    }
  }
  cont = cont.concat(cuciture);

  // ---- aperture: coppie di spalle (tratti corti) parallele e affacciate; ogni spalla in una sola apertura
  const corti = cont.filter((s) => s.getLength() >= 0.05 && s.getLength() <= 0.65);
  const candidati: { d: number; i: number; j: number }[] = [];
  for (let i = 0; i < corti.length; i++) {
    const a = corti[i], da = direzione(a), ma = centro(a);
    for (let j = i + 1; j < corti.length; j++) {
      const b = corti[j];
      if (!paralleli(a, b)) continue;
      const mb = centro(b), v: XY = [mb[0] - ma[0], mb[1] - ma[1]], d = Math.hypot(v[0], v[1]);
      if (!(d >= 0.5 && d <= 2.6)) continue;
      if (Math.abs((v[0] * da[0] + v[1] * da[1]) / d) > 0.1) continue;
      if (Math.abs(a.getLength() - b.getLength()) > 0.08) continue;
      const [pa0, pa1] = estremi(a); let [pb0, pb1] = estremi(b);
      if (dist(pa0, pb0) + dist(pa1, pb1) > dist(pa0, pb1) + dist(pa1, pb0)) [pb0, pb1] = [pb1, pb0];
      const lati = [linea(pa0, pb0), linea(pa1, pb1)];
      // i lati coincidono con linee esistenti: è un tratto di muro, non un'apertura
      if (lati.some((L) => cont.some((s) => s !== a && s !== b && intersezione(buffer(s, 0.02), L).getLength() > 0.5 * L.getLength()))) continue;
      const mid = linea(ma, mb);
      if (cont.some((s) => s !== a && s !== b && (mid.crosses(s) || (mid.intersects(s) && intersezione(mid, s).getLength() === 0 && !s.touches(mid))))) continue;
      candidati.push({ d, i, j });
    }
  }
  const chiusure: G[] = [];
  const aperture: { w: number; striscia: G }[] = [];
  const usate = new Set<number>();
  for (const c of candidati.sort((x, y) => x.d - y.d)) {
    if (usate.has(c.i) || usate.has(c.j)) continue;
    usate.add(c.i); usate.add(c.j);
    const [pa0, pa1] = estremi(corti[c.i]); let [pb0, pb1] = estremi(corti[c.j]);
    if (dist(pa0, pb0) + dist(pa1, pb1) > dist(pa0, pb1) + dist(pa1, pb0)) [pb0, pb1] = [pb1, pb0];
    chiusure.push(linea(pa0, pb0), linea(pa1, pb1));
    aperture.push({ w: Math.min(dist(pa0, pb0), dist(pa1, pb1)), striscia: poligono([pa0, pb0, pb1, pa1]).convexHull() });
  }
  // porte disegnate come segmento tratteggiato nel vuoto del muro, allineato a un muro a ciascun estremo
  let porte = 0;
  for (const s of tratt) {
    if (s.getLength() < 0.5 || s.getLength() > 1.8) continue;
    let ok = 0;
    for (const e of estremi(s)) {
      const P = punto(e);
      if (cont.some((c) => paralleli(s, c) && Math.min(...estremi(c).map((x) => punto(x).distance(P))) < 0.03)) ok++;
    }
    if (ok === 2) { chiusure.push(s); porte++; }
  }

  // estremi delle chiusure (soglie e porte tratteggiate) a meno di 3 cm da un muro senza toccarlo: si agganciano
  // (caso-2: la porta tratteggiata della camera finisce a 0,9 mm dallo spigolo, dentro il risvolto del muro)
  for (const c of chiusure.slice()) {
    for (const e of estremi(c)) {
      const P = punto(e);
      const vicine = cont.filter((m) => m.distance(P) < 0.03);
      if (!vicine.length || vicine.some((m) => estremi(m).some((x) => dist(x, e) < 1e-9))) continue;
      const m = vicine.reduce((x, y) => (x.distance(P) <= y.distance(P) ? x : y));
      const q = proiezione(m, e);
      if (dist(e, q) > 1e-4) chiusure.push(cucitura(e, q));
      else { // già praticamente sulla linea: un trattino di 4 mm attraverso la linea crea il nodo
        const [dx, dy] = direzione(m);
        // due pezzi che partono proprio dall'estremo (vertice in comune con la chiusura), uno per parte
        chiusure.push(linea(e, [e[0] - dy * 0.002, e[1] + dx * 0.002]), linea(e, [e[0] + dy * 0.002, e[1] - dx * 0.002]));
      }
    }
  }

  // ---- facce: muri continui + chiusure + contorno dei poligoni dell'unità (chiude i muri esterni interrotti)
  const bordi = di('ABCH').map((p) => p.getExteriorRing());
  const reteLinee = rete([...cont, ...chiusure, ...bordi]);
  const facce = faccePoligonizzate(reteLinee).filter((f) => f.getArea() > 0.05);

  // ---- croci (X) e G: nessun vano
  const croci: G[] = [];
  const lunghe = cont.filter((l) => l.getLength() >= 1.0);
  for (let i = 0; i < lunghe.length; i++) {
    for (let j = i + 1; j < lunghe.length; j++) {
      const a = lunghe[i], b = lunghe[j];
      if (!a.crosses(b)) continue;
      const x = intersezione(a, b);
      if (x.getGeometryType() !== 'Point') continue;
      const ta = posizione(a, x), tb = posizione(b, x);
      if (ta > 0.3 && ta < 0.7 && tb > 0.3 && tb < 0.7) croci.push(buffer(unione([a, b]).convexHull(), 0.05));
    }
  }
  const Gz = buffer(unione([...di('G'), ...croci]), 0.02);
  const DENTRO = buffer(unione(di('ABCH')), 0.02);
  const eMuro = (f: G) => { const o = buffer(f, -0.3, true); return o.isEmpty() || o.getArea() < 0.05; };
  let validi = facce.filter((f) => { const rp = puntoInterno(f); return !Gz.contains(rp) && !eMuro(f) && DENTRO.contains(rp) && f.getArea() >= 0.3; });

  // ---- muri isolati attaccati alle facce: si tolgono le strisce sottili tagliando lungo il muro
  const taglia = (f0: G): G => {
    let f = f0;
    for (const l of cont) {
      if (l.getLength() < 1.0 || !buffer(f, 1e-6).contains(l)) continue;
      if (f.getExteriorRing().distance(l) > 0.6) continue;
      const [a, b] = estremi(l); const L = dist(a, b); const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
      const pezzi = dividi(f, linea([a[0] - dx * 2, a[1] - dy * 2], [b[0] + dx * 2, b[1] + dy * 2]));
      if (pezzi.length < 2) continue;
      pezzi.sort((x, y) => y.getArea() - x.getArea());
      if (pezzi.slice(1).every((p) => p.getArea() / p.getLength() ** 2 < 0.03)) f = pezzi[0];
    }
    return f;
  };
  validi = validi.map(taglia);

  // ---- parti dello stesso vano divise da tratteggi (zone di altezza diversa): si uniscono
  const T = buffer(unione(tratt), 0.02);
  const PBC = buffer(unione(di('BC')), 0.05);
  const nomiIn = (g: G) => testi.filter((x) => g.contains(x.p) && tipoDaTesto(x.t));
  const padre = validi.map((_, i) => i);
  const radice = (i: number): number => { while (padre[i] !== i) i = padre[i]; return i; };
  for (let i = 0; i < validi.length; i++) {
    for (let j = i + 1; j < validi.length; j++) {
      const a = validi[i], b = validi[j];
      const conf = intersezione(a.getBoundary(), b.getBoundary());
      if (conf.getLength() < 0.3) continue;
      if (intersezione(conf, T).getLength() >= 0.6 * conf.getLength()) {
        if (nomiIn(a).length && nomiIn(b).length) continue; // due vani con nome, separati da tratteggio (porta)
        padre[radice(j)] = radice(i);
      }
    }
  }
  const altezzeIn = (g: G) => testi.filter((x) => g.contains(x.p)).map((x) => altezzaDaTesto(x.t)).filter((h): h is number => h !== null);
  // aperture con superficie > 4 m² (larghezza × altezza del vano più basso, 2,40 m se manca): un vano solo
  for (let giro = 0; giro < 50; giro++) {
    const geo = new Map<number, G>();
    validi.forEach((f, i) => geo.set(radice(i), unione([geo.get(radice(i)) ?? vuoto(), f])));
    let unito = false;
    for (const { w, striscia } of aperture) {
      const s = buffer(striscia, 0.03);
      const vicini = [...geo.entries()].filter(([, g]) => g.intersects(s) && intersezione(g, s).getArea() > 0.001).map(([k]) => k);
      if (vicini.length !== 2) continue;
      const hs = vicini.map((k) => Math.min(...(altezzeIn(geo.get(k)).length ? altezzeIn(geo.get(k)) : [2.4])));
      if (w * Math.min(...hs) > 4 && radice(vicini[0]) !== radice(vicini[1])) { padre[radice(vicini[1])] = radice(vicini[0]); unito = true; break; }
    }
    if (!unito) break;
  }

  // ---- vani
  type V = { tipo: TipoVano; g: G; testi: string[]; nota?: string; scala?: boolean };
  const gruppi = new Map<number, G[]>();
  validi.forEach((f, i) => { const r = radice(i); gruppi.set(r, [...(gruppi.get(r) ?? []), f]); });
  const apri = (g: G, r = 0.3): G => { const o = buffer(buffer(g, -r, true), r, true); return o.isEmpty() ? o : intersezione(o, g); };
  let vani: V[] = [];
  for (const fs of gruppi.values()) {
    const u0 = unione(fs);
    const u = apri(u0);
    if (u.isEmpty() || u.getArea() < 0.3) continue;
    const tt = testi.filter((x) => u0.contains(x.p)).map((x) => x.t);
    // zone senza testo fatte di triangoli (X dei vuoti): non sono vani
    if (!tt.length && parti(u).every((g) => (g.getGeometryType() === 'Polygon' ? anello(semplifica(g, 0.05)).length <= 4 : true))) continue;
    const tipi = tt.map(tipoDaTesto).filter((x): x is TipoVano => !!x);
    let tipo: TipoVano = tipi.includes('principale') ? 'principale' : tipi[0] ?? (u.getArea() >= 4 ? 'principale' : 'verificare');
    if (PBC.contains(puntoInterno(u)) && tipo !== 'verificare') tipo = 'indiretto';
    vani.push({ tipo, g: u, testi: tt });
  }

  // ---- scale: gradini (almeno 8 pezzi quasi uguali) e vani senza nome che li contengono, contate una volta
  const nomiG = buffer(unione(vani.filter((v) => v.tipo !== 'verificare').map((v) => v.g)), -0.02);
  const pezzi = facce.filter((f) => !Gz.contains(puntoInterno(f)) && f.getArea() < 2.5
    && !vani.some((v) => v.tipo !== 'verificare' && buffer(v.g, -0.02).intersects(puntoInterno(f)))
    && f.getArea() / f.getLength() ** 2 >= 0.01);
  let cl: G[] = [];
  for (const f of pezzi) {
    const vicini = cl.filter((c) => buffer(c, 0.02).intersects(f));
    cl = cl.filter((c) => !vicini.includes(c)).concat([unione([f, ...vicini])]);
  }
  const ARCHI = archi.length ? unione(archi) : null;
  const residui = vani.filter((v) => v.tipo === 'verificare');
  const scale: G[] = [];
  for (const c of cl) {
    const cb = buffer(c, 0.01);
    const pz = pezzi.filter((f) => f.within(cb) && f.getArea() <= 0.3).map((f) => f.getArea()).sort((a, b) => a - b);
    if (!pz.length || Math.max(...pz.map((a) => pz.filter((b) => Math.abs(b - a) <= 0.1 * a + 0.005).length)) < 8) continue;
    let g = c;
    for (let k = 0; k < 3; k++) {
      for (const v of residui) if (buffer(v.g, 0.05).intersects(g)) g = unione([g, v.g]);
      if (ARCHI) {
        for (const f of facce) {
          const a = f.getArea();
          if (a > 0.3 && a < 4 && !eMuro(f) && buffer(f, 0.02).intersects(ARCHI) && buffer(f, 0.05).intersects(g)
            && DENTRO.contains(puntoInterno(f)) && !nomiG.contains(puntoInterno(f))) g = unione([g, f]);
        }
      }
    }
    if (!g.isEmpty() && g.getArea() >= 2) scale.push(g);
  }
  const usati = residui.filter((v) => scale.some((c) => buffer(v.g, -0.02).intersects(c)));
  const PA = buffer(unione(di('AH')), 0.05);
  vani = vani.filter((v) => !usati.includes(v));
  for (const c of scale) {
    if (PA.contains(puntoInterno(c))) vani.push({ tipo: 'diretto', g: c, testi: ['scala'], scala: true, nota: 'scala interna: contata intera a questo piano' });
    else avvisi.push(`Scala di ${c.getArea().toFixed(2).replace('.', ',')} m² non contata: è l'arrivo al piano superiore (la scala si conta una volta, al piano dell'unità).`);
  }
  // vani senza nome rimasti: accessorio diretto da verificare (es. cabina armadi senza testo)
  vani = vani.filter((v) => v.tipo !== 'verificare' || v.g.getArea() >= 1.0);
  for (const v of vani) if (v.tipo === 'verificare') v.nota = 'locale senza nome nel DXF: proposto come accessorio diretto, da verificare';

  // ---- risultato
  const xs = lineeAnteprima.flatMap((l) => [l.a[0], l.b[0]]), ys = lineeAnteprima.flatMap((l) => [l.a[1], l.b[1]]);
  const env = unita.getEnvelopeInternal();
  const limiti = xs.length
    ? { x0: Math.max(Math.min(...xs), env.getMinX()), y0: Math.max(Math.min(...ys), env.getMinY()), x1: Math.min(Math.max(...xs), env.getMaxX()), y1: Math.min(Math.max(...ys), env.getMaxY()) }
    : { x0: env.getMinX(), y0: env.getMinY(), x1: env.getMaxX(), y1: env.getMaxY() };
  const risultato = vani
    .map((v) => ({ v, c: centro(v.g) }))
    .sort((a, b) => a.c[0] - b.c[0] || b.c[1] - a.c[1])
    .map(({ v, c }, i): VanoRiconosciuto => {
      const tipo = v.tipo;
      return {
        id: i + 1,
        tipo: tipo === 'verificare' ? 'diretto' : tipo,
        tipoProposto: tipo === 'verificare' ? 'diretto' : tipo,
        superficie: Math.round(v.g.getArea() * 100) / 100,
        m2: m2Intero(v.g.getArea()),
        testi: v.testi.filter((t) => altezzaDaTesto(t) === null),
        altezze: v.testi.map(altezzaDaTesto).filter((h): h is number => h !== null),
        contorni: parti(v.g).filter((g) => g.getGeometryType() === 'Polygon').map(anello),
        centro: c,
        scala: v.scala,
        nota: v.nota ?? (tipo === 'verificare' ? 'da verificare' : undefined),
      };
    });
  if (porte) avvisi.push(`${porte} porte disegnate con linea tratteggiata riconosciute.`);
  return { vani: risultato, linee: lineeAnteprima, limiti, avvisi };
}

export interface TotaliVani {
  principaliN: number; principaliSup: number;
  bagniN: number; bagniSup: number;
  direttiN: number; direttiSup: number;
  indirettiN: number; indirettiSup: number;
}

/** Totali del quadro C (1N parte II): numero e somma dei m² interi per tipo; i vani esclusi non contano. */
export function totaliVani(vani: VanoRiconosciuto[]): TotaliVani {
  const t: TotaliVani = { principaliN: 0, principaliSup: 0, bagniN: 0, bagniSup: 0, direttiN: 0, direttiSup: 0, indirettiN: 0, indirettiSup: 0 };
  for (const v of vani) {
    if (v.tipo === 'principale') { t.principaliN++; t.principaliSup += v.m2; }
    else if (v.tipo === 'bagno') { t.bagniN++; t.bagniSup += v.m2; }
    else if (v.tipo === 'diretto' || v.tipo === 'verificare') { t.direttiN++; t.direttiSup += v.m2; }
    else if (v.tipo === 'indiretto') { t.indirettiN++; t.indirettiSup += v.m2; }
  }
  return t;
}
