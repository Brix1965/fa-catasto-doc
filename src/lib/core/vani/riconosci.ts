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
 * - superfici al m² intero, vano per vano (da 0,5 per eccesso), totali = somma dei vani arrotondati;
 * - superficie misurata fra i muri: sguinci delle finestre, stipiti, soglie, archi e nicchie nello spessore dei muri
 *   non contano (si taglia lungo il filo del muro).
 * Il risultato è una PROPOSTA: il tecnico cambia il tipo di ogni vano, lo esclude, e corregge i totali.
 */
import type { Entita } from '../raster/dxf';
import { ampiezzaArco } from '../raster/bitmap';
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
  /** zone di altezza diversa (pezzi del vano divisi dai tratteggi) con l'altezza scritta, se c'è */
  zone?: { superficie: number; altezza: number | null }[];
  /** contorni (uno o più) in coordinate del DXF, per l'anteprima */
  contorni: XY[][];
  centro: XY;
  /** scala interna (contata intera al piano dell'unità) */
  scala?: boolean;
  /** motivo per cui va controllato */
  nota?: string;
  /** area esterna dell'unità: D = balcone, terrazza, loggia, portico; F = giardino, corte, resede, aia… */
  scoperto?: 'D' | 'F';
  /** spazio a comune o di altre unità: non conta né nei vani né nei poligoni */
  comune?: boolean;
  /** locale staccato dall'abitazione (es. ripostiglio in giardino): accessorio non comunicante, poligono C */
  staccato?: boolean;
  /** contorni prima di togliere sguinci, soglie e nicchie (per i poligoni, che comprendono i muri) */
  contorniLordi?: XY[][];
  /** forma corretta a mano dal tecnico nella finestra dei vani */
  forma?: boolean;
  /** il vano proposto dal programma, prima delle correzioni della forma */
  originale?: { superficie: number; centro: XY; contorni: XY[][] };
}

export interface OpzioniVani {
  /** vertici del riquadro del disegno: se il DXF non ha poligoni, i vani si cercano qui dentro */
  riquadro?: XY[] | null;
}

export interface RisultatoVani {
  /** il DXF non aveva poligoni: i vani sono stati cercati in tutto il riquadro */
  senzaPoligoni?: boolean;
  vani: VanoRiconosciuto[];
  /** facce sottili dei muri (contorni), per generare i poligoni DOCFA_POLIGONI e gli spessori */
  muri: XY[][];
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
  // spazi che non sono vani: balconi e terrazzi (poligoni D/E), parti comuni e altre proprietà
  ['escluso', ['balcone', 'terrazzo', 'terrazza', 'lastrico', 'portico', 'corte', 'cortile', 'resede', 'giardino', 'scale a comune', 'scale comuni', 'scala comune', 'scala condominiale', 'vano scala comune', 'pianerottolo', 'androne', 'ballatoio comune', 'parti comuni', 'comune', 'b.c.n.c', 'bcnc', 'altra proprietà', 'altra proprieta', 'altra u.i.u', 'altra uiu', 'altra ditta', 'proprietà di terzi', 'vuoto', 'cavedio', 'chiostrina']],
  ['indiretto', ['soffitta', 'cantina', 'sottotetto', 'soffitte', 'locale tecnico', 'centrale termica', 'lavatoio', 'sgombero', 'deposito', 'garage', 'autorimessa', 'magazzino']],
];

/** Sigle che valgono solo da sole (per «k» un confronto con l'inizio della parola sarebbe sbagliato). */
const SIGLE: Record<string, TipoVano> = { k: 'principale', cuc: 'principale', 'k-pranzo': 'principale', 'w.c': 'bagno', rip: 'diretto', disimp: 'diretto', ingr: 'diretto', corr: 'diretto', ripost: 'diretto', lav: 'diretto' };

/**
 * Spazi a comune o di altre unità (vano scala a comune, resede a comune, androne, altra u.i.…): non sono
 * dell'unità, qualunque sia il tipo. Si applica a tutti i testi del locale insieme («vano scale» + «a comune»).
 */
export const RE_COMUNE = /(^|[\s(])(a\s+comune|comun[ei]\b|condomin|parti\s+comuni|b\.?\s*c\.?\s*n\.?\s*c|altr[ae]\s*u\.?\s*i|altr[ae]\s+propriet|altra\s+ditta|di\s+terzi|androne)/i;

/** Aree esterne dell'unità dal nome: D = balconi, terrazzi, logge, portici; F = giardini, corti, resedi, aie, orti. */
export function scopertoDaTesto(t0: string): 'D' | 'F' | null {
  const t = t0.toLowerCase().trim();
  if (/^(balcon|terrazz|loggia(?!\s+chiusa)|portic|lastric|pergolat)/.test(t)) return 'D';
  if (/^(giardin|corte\b|corti\b|cortil|cortiletto|resede|resed|aia\b|aie\b|orto|orti\b|area\s+scopert|spazio\s+scopert|piazzal|parchegg|post[oi]\s+auto)/.test(t)) return 'F';
  return null;
}

/** Tipo di vano dal testo (null se il testo non è un nome di vano, es. «h260»). */
export function tipoDaTesto(t0: string): TipoVano | null {
  let t = t0.toLowerCase().trim();
  if (t.endsWith('.')) t = t.slice(0, -1);
  if (SIGLE[t]) return SIGLE[t];
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
  const sweep = (ampiezzaArco(a0, a1) * Math.PI) / 180;
  const passo = r > 0.01 ? 2 * Math.acos(Math.max(-1, 1 - 0.01 / r)) : sweep;
  const n = Math.min(2000, Math.max(2, Math.ceil(sweep / Math.max(passo, 1e-3))));
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 % 360) * Math.PI) / 180 + (sweep * i) / n;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

function rettangoloEntita(entita: Entita[]): XY[] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const p = ([x, y]: XY) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const e of entita) {
    if (e.tipo === 'linea') { p(e.p1); p(e.p2); } else if (e.tipo === 'polilinea') e.punti.forEach(p);
  }
  if (!Number.isFinite(x0)) return null;
  return [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1]];
}

const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const versore2 = (a: XY, b: XY): XY => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
/** distanza del punto p dal segmento ab */
function distSeg(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** i segmenti pq e ab si incrociano (estremi compresi) */
/** punto dentro un quadrilatero convesso (vertici in ordine) */
function dentroQuad(p: XY, q: XY[]): boolean {
  let segno = 0;
  for (let k = 0; k < q.length; k++) {
    const a = q[k], b = q[(k + 1) % q.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-12) continue;
    if (segno === 0) segno = Math.sign(c);
    else if (Math.sign(c) !== segno) return false;
  }
  return true;
}
function intersecaSeg(p: XY, q: XY, a: XY, b: XY): boolean {
  const o = (u: XY, v: XY, w: XY) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  const d1 = o(a, b, p), d2 = o(a, b, q), d3 = o(p, q, a), d4 = o(p, q, b);
  return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
}
/** distanza alla quale la semiretta da p in direzione u (lunga al più maxL) incontra il segmento ab, o null */
function raggio(p: XY, u: XY, a: XY, b: XY, maxL: number): number | null {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = u[0] * ey - u[1] * ex;
  if (Math.abs(den) < 1e-12) return null; // parallelo
  const wx = a[0] - p[0], wy = a[1] - p[1];
  const t = (wx * ey - wy * ex) / den; // lungo la semiretta
  const s2 = (wx * u[1] - wy * u[0]) / den; // lungo il segmento
  if (t <= 1e-3 || t > maxL || s2 < -1e-6 || s2 > 1 + 1e-6) return null;
  return t;
}
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
export function riconosciVani(entita: Entita[], poligoni: Poligono[], opzioni: OpzioniVani = {}): RisultatoVani {
  const avvisi: string[] = [];
  let pol = poligoni.filter((p) => p.vertici.length >= 3).map((p) => ({ tipo: p.tipo, g: poligono(p.vertici) })).filter((p) => !p.g.isEmpty() && p.g.getArea() > 1e-6);
  const storti = pol.filter((p) => !p.g.isValid()).length;
  if (storti) avvisi.push(`${storti} ${storti === 1 ? 'poligono si incrocia' : 'poligoni si incrociano'} (contorno «a farfalla»): le superfici e i vani dentro possono risultare sbagliati, correggili.`);
  // senza poligoni dell'unità (DXF appena disegnato, o solo balconi e aree D/E/F): si cerca in tutto il riquadro
  const senzaPoligoni = !pol.some((p) => 'ABCH'.includes(p.tipo));
  if (senzaPoligoni) {
    const zona = opzioni.riquadro && opzioni.riquadro.length >= 3 ? opzioni.riquadro : rettangoloEntita(entita);
    if (!zona) return { vani: [], linee: [], limiti: { x0: 0, y0: 0, x1: 1, y1: 1 }, avvisi: ['Il DXF non contiene linee.'], senzaPoligoni, muri: [] };
    pol = [...pol.filter((p) => !'ABCH'.includes(p.tipo)), { tipo: 'A', g: poligono(zona) }];
    avvisi.push('Il DXF non ha poligoni DOCFA_POLIGONI: i vani sono cercati in tutto il riquadro (controlla che non ci siano locali di altre unità).');
  }
  const di = (tipi: string) => pol.filter((p) => tipi.includes(p.tipo)).map((p) => p.g);

  // ---- segmenti continui e tratteggiati, testi, archi
  let cont: G[] = [];
  let tratt: G[] = [];
  const archi: G[] = [];
  const testi: { t: string; p: G; xy: XY }[] = [];
  // segmenti per entità: servono per riconoscere i simboli staccati dal disegno
  const perEntita: { segs: [XY, XY][]; tr: boolean; chiusa: boolean; arco: boolean }[] = [];
  for (const e of entita) {
    const segs: [XY, XY][] = [];
    if (e.tipo === 'linea') segs.push([e.p1, e.p2]);
    else if (e.tipo === 'polilinea') {
      const p = e.punti;
      for (let i = 0; i + 1 < p.length; i++) segs.push([p[i], p[i + 1]]);
      if (e.chiusa && p.length > 2) segs.push([p[p.length - 1], p[0]]);
    } else if (e.tipo === 'arco') {
      const pts = puntiArco(e.centro, e.raggio, e.inizio, e.fine);
      archi.push(spezzata(pts));
      for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
    } else if (e.tipo === 'testo') { testi.push({ t: e.testo.trim(), p: punto(e.punto), xy: e.punto }); continue; }
    else continue;
    perEntita.push({ segs: segs.filter(([a, b]) => dist(a, b) > 1e-6), tr: tratteggiata(e), chiusa: e.tipo === 'polilinea' && e.chiusa, arco: e.tipo === 'arco' });
  }
  // simboli staccati dal disegno, che non sono muri: frecce d'ingresso (ognuno le disegna a modo suo), croci sulle
  // finestre e sulle soglie, segni del nord. Sono le entità piccole (meno di 1,2 m) che non toccano nessun'altra
  // linea con i loro estremi o vertici: un muro, una soglia, un gradino sono sempre attaccati a qualcosa.
  const simboli = new Set<number>();
  {
    const tutti = perEntita.flatMap((x, i) => x.segs.map((sg) => ({ i, sg })));
    const vicinoAltri = (p: XY, i: number) => tutti.some(({ i: j, sg: [a, b] }) => j !== i && distSeg(p, a, b) < 0.002);
    perEntita.forEach((x, i) => {
      if (!x.segs.length || x.arco) return;
      const pts = x.segs.flatMap(([a, b]) => [a, b]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 1.2) return;
      const estremiLiberi = x.chiusa ? pts : [x.segs[0][0], x.segs[x.segs.length - 1][1]];
      if (estremiLiberi.every((q) => !vicinoAltri(q, i))) simboli.add(i);
    });
  }
  // linee doppie (lo stesso tratto disegnato due volte, frequente nei DXF esportati dai programmi BIM): una sola
  const giaVisti = new Set<string>();
  const k3 = (p: XY) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  perEntita.forEach((x, i) => {
    if (simboli.has(i)) return;
    for (const [a, b] of x.segs) {
      const k = [k3(a), k3(b)].sort().join('|') + (x.tr ? 't' : 'c');
      if (giaVisti.has(k)) continue;
      giaVisti.add(k);
      (x.tr ? tratt : cont).push(linea(a, b));
    }
  });
  if (simboli.size) avvisi.push(`${simboli.size} simboli staccati dal disegno (frecce, croci, segni) non considerati come muri.`);

  // zona dell'unità: i suoi poligoni (anche D, E, F); se fuori ci sono terrazze o giardini con il nome (non «a comune»)
  // si guarda tutto il riquadro, così si possono proporre anche i loro poligoni D/F
  const fuoriNominati = !senzaPoligoni && testi.some((x) => scopertoDaTesto(x.t) && !RE_COMUNE.test(x.t) && !buffer(unione(di('ABCDEFGH')), 0.02).contains(x.p));
  const zonaRiq = opzioni.riquadro && opzioni.riquadro.length >= 3 ? opzioni.riquadro : rettangoloEntita(entita);
  const unita = fuoriNominati && zonaRiq ? poligono(zonaRiq) : buffer(unione(di('ABCDEFGH')), 0.6);
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
  const aperture: { w: number; striscia: G; da?: 'spalle' | 'testa'; lati?: [XY, XY] }[] = [];
  const usate = new Set<number>();
  for (const c of candidati.sort((x, y) => x.d - y.d)) {
    if (usate.has(c.i) || usate.has(c.j)) continue;
    usate.add(c.i); usate.add(c.j);
    const [pa0, pa1] = estremi(corti[c.i]); let [pb0, pb1] = estremi(corti[c.j]);
    if (dist(pa0, pb0) + dist(pa1, pb1) > dist(pa0, pb1) + dist(pa1, pb0)) [pb0, pb1] = [pb1, pb0];
    chiusure.push(linea(pa0, pb0), linea(pa1, pb1));
    const cm: XY = [(pa0[0] + pa1[0] + pb0[0] + pb1[0]) / 4, (pa0[1] + pa1[1] + pb0[1] + pb1[1]) / 4], dj = versore2(pa0, pa1), mj = dist(pa0, pa1) / 2 + 0.12;
    aperture.push({ w: Math.min(dist(pa0, pb0), dist(pa1, pb1)), striscia: poligono([pa0, pb0, pb1, pa1]).convexHull(), da: 'spalle', lati: [[cm[0] + dj[0] * mj, cm[1] + dj[1] * mj], [cm[0] - dj[0] * mj, cm[1] - dj[1] * mj]] });
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

  // aperture viste dalla testa del muro: la fine di un muro (tratto corto con i due lati del muro attaccati dalla
  // stessa parte) si prolunga in avanti finché incontra un'altra linea entro 2,6 m: l'altra spalla, oppure il
  // fianco di un muro quando la porta è vicina a uno spigolo. Copre i disegni con spalle di lunghezza diversa e le
  // porte ad angolo, che le coppie di spalle non riconoscono.
  {
    const segs = cont.map((l) => estremi(l));
    const indice = new Map<string, number[]>();
    segs.forEach(([a, b], i) => { for (const q of [a, b]) indice.set(chiave(q), [...(indice.get(chiave(q)) ?? []), i]); });
    const versore = (a: XY, b: XY): XY => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
    // i lati del muro attaccati alla testa, perpendicolari
    const lati = (p: XY, i: number, d: XY): XY[] => (indice.get(chiave(p)) ?? []).filter((j) => j !== i).map((j) => {
      const [a, b] = segs[j];
      return dist(a, p) < dist(b, p) ? versore(a, b) : versore(b, a);
    }).filter((v) => Math.abs(v[0] * d[0] + v[1] * d[1]) < 0.2);
    // primo incontro della semiretta: distanza e se cade su un'altra testa di muro (tratto corto) o su uno spigolo,
    // oppure a metà del fianco di un muro (porta vicino a uno spigolo)
    const primo = (p: XY, r: XY): { t: number; testa: boolean } | null => {
      let m: { t: number; testa: boolean } | null = null;
      for (const [a, b] of segs) {
        if (distSeg(p, a, b) < 1e-4) continue; // le linee che partono dal punto stesso
        const t = raggio(p, r, a, b, 2.6);
        if (t === null || (m && t >= m.t)) continue;
        const h: XY = [p[0] + r[0] * t, p[1] + r[1] * t];
        m = { t, testa: dist(a, b) <= 0.65 || Math.min(dist(h, a), dist(h, b)) < 0.03 };
      }
      return m;
    };
    const lungoLinee = (p: XY, q: XY): boolean => {
      const L = dist(p, q), d = versore(p, q);
      let sopra = 0;
      for (const [a, b] of segs) {
        const e = versore(a, b);
        if (Math.abs(d[0] * e[1] - d[1] * e[0]) > 0.02 || distSeg(a, p, q) > 0.002 && distSeg(b, p, q) > 0.002 && distSeg(p, a, b) > 0.002) continue;
        if (Math.abs((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) > 0.002) continue; // non sulla stessa retta
        const t0 = (a[0] - p[0]) * d[0] + (a[1] - p[1]) * d[1], t1 = (b[0] - p[0]) * d[0] + (b[1] - p[1]) * d[1];
        sopra += Math.max(0, Math.min(L, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)));
      }
      return sopra > 0.2 * L;
    };
    segs.forEach(([a, b], i) => {
      const L = dist(a, b);
      if (L < 0.05 || L > 0.65) return;
      const d = versore(a, b);
      // un tratto che prosegue dritto in un'altra linea è un pezzo di un lato del muro (es. il vetro di una finestra
      // fra due spalle), non la testa di un muro
      const prosegue = (p: XY) => (indice.get(chiave(p)) ?? []).some((j) => {
        if (j === i) return false;
        const [c0, c1] = segs[j], e = versore(c0, c1), altro = dist(c0, p) < dist(c1, p) ? c1 : c0;
        // dritto e dall'altra parte del punto (non sovrapposto al tratto stesso)
        return Math.abs(e[0] * d[1] - e[1] * d[0]) < 0.05 && distSeg(altro, a, b) > 0.002;
      });
      if (prosegue(a) || prosegue(b)) return;
      const va = lati(a, i, d), vb = lati(b, i, d);
      let u: XY | null = null;
      for (const x of va) for (const y of vb) if (x[0] * y[0] + x[1] * y[1] > 0.95) u = [(x[0] + y[0]) / 2, (x[1] + y[1]) / 2];
      if (!u) return;
      const r: XY = [-u[0], -u[1]];
      const pa = primo(a, r), pb = primo(b, r);
      if (!pa || !pb) return;
      const ta = pa.t, tb = pb.t;
      if (Math.min(ta, tb) < 0.45 || Math.abs(ta - tb) > 0.35) return;
      // contro il fianco di un muro (non contro un'altra testa) solo quanto una porta: oltre è uno spazio aperto
      if (!(pa.testa || pb.testa) && Math.max(ta, tb) > 1.0) return;
      const ha: XY = [a[0] + r[0] * ta, a[1] + r[1] * ta], hb: XY = [b[0] + r[0] * tb, b[1] + r[1] * tb];
      // il raggio corre lungo una linea esistente: siamo dentro lo spessore di un muro (fra due finestre), non in un vano
      if (lungoLinee(a, ha) || lungoLinee(b, hb)) return;
      // nel vano dell'apertura c'è una linea parallela (il vetro di una finestra, il davanzale): è una finestra, non
      // una porta. Lo sguincio non è superficie del locale (regola catastale: si misura fra i muri, esclusi sguinci,
      // stipiti e soglie): si chiude sul filo dei due lati del muro, come una porta, ma non unisce mai due locali
      const cm0: XY = [(a[0] + b[0] + ha[0] + hb[0]) / 4, (a[1] + b[1] + ha[1] + hb[1]) / 4];
      const dentro = (q: XY) => segs.some(([s0, s1]) => intersecaSeg(cm0, q, s0, s1));
      if (dentro([cm0[0] + d[0] * (L / 2 + 0.1), cm0[1] + d[1] * (L / 2 + 0.1)]) || dentro([cm0[0] - d[0] * (L / 2 + 0.1), cm0[1] - d[1] * (L / 2 + 0.1)])) {
        // finestra vera: il vetro (o il davanzale) sta tutto nel vano dell'apertura, da una spalla all'altra, e i due
        // raggi finiscono sull'altra spalla. Una linea che attraversa soltanto (il muro di un locale) non è un vetro:
        // quella «apertura» è il locale stesso e non si chiude
        const w = Math.min(ta, tb);
        const quad = [a, ha, hb, b];
        const nelVano = (q: XY) => quad.some((x, k) => distSeg(q, x, quad[(k + 1) % 4]) < 0.03) || dentroQuad(q, quad);
        const vetro = segs.some(([s0, s1]) => {
          const e = versore(s0, s1);
          return Math.abs(e[0] * r[1] - e[1] * r[0]) < 0.05 && dist(s0, s1) >= 0.6 * w && nelVano(s0) && nelVano(s1);
        });
        if (vetro && pa.testa && pb.testa && w <= 2.6) chiusure.push(linea(a, ha), linea(b, hb));
        return;
      }
      chiusure.push(linea(a, ha), linea(b, hb));
      const cm: XY = [(a[0] + b[0] + ha[0] + hb[0]) / 4, (a[1] + b[1] + ha[1] + hb[1]) / 4], mj = L / 2 + 0.12;
      aperture.push({ w: Math.min(ta, tb), striscia: poligono([a, ha, hb, b]).convexHull(), da: 'testa', lati: [[cm[0] + d[0] * mj, cm[1] + d[1] * mj], [cm[0] - d[0] * mj, cm[1] - d[1] * mj]] });
    });
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
  // il contorno dei poligoni chiude i muri esterni interrotti; senza poligoni non c'è (il riquadro non è un muro)
  const bordi = senzaPoligoni ? [] : di('ABCH').map((p) => p.getExteriorRing());
  const reteLinee = rete([...cont, ...chiusure, ...bordi]);
  const tutteFacce = faccePoligonizzate(reteLinee);
  const faccePrime = tutteFacce.filter((f) => f.getArea() > 0.05);
  // categoria di un testo: V vano, D balcone/terrazza, F area scoperta, X a comune o di altri; null altrimenti
  const categoria = (t: string): 'V' | 'D' | 'F' | 'X' | null => (RE_COMUNE.test(t) ? 'X' : scopertoDaTesto(t) ?? (tipoDaTesto(t) && tipoDaTesto(t) !== 'escluso' ? 'V' : null));
  const categorieIn = (g: G): Set<string> => {
    const c = new Set(testi.filter((x) => g.contains(x.p)).map((x) => categoria(x.t)).filter((x): x is 'V' | 'D' | 'F' | 'X' => !!x));
    return c.has('X') ? new Set(['X']) : c; // «vano scale» + «a comune»: è tutto a comune
  };
  // uno spazio che contiene nomi di categorie diverse (terrazza e giardino, separati solo da una linea tratteggiata)
  // si divide lungo i tratteggi che lo attraversano; i pezzi senza nome vanno al vicino col confine più lungo
  const facce: G[] = [];
  for (const f of faccePrime) {
    const cat = categorieIn(f);
    const tr = cat.size >= 2 ? tratt.filter((t) => t.intersects(f)) : [];
    if (!tr.length) { facce.push(f); continue; }
    const allunga = (l: G): G => { const [a, b] = estremi(l); const d = direzione(l); return linea([a[0] - d[0] * 0.15, a[1] - d[1] * 0.15], [b[0] + d[0] * 0.15, b[1] + d[1] * 0.15]); };
    const pz = faccePoligonizzate(rete([f.getBoundary(), ...tr.map(allunga)])).filter((g) => g.getArea() > 0.01 && f.contains(puntoInterno(g)));
    const con = pz.filter((g) => categorieIn(g).size), senza = pz.filter((g) => !categorieIn(g).size);
    if (con.length < 2) { facce.push(f); continue; }
    for (const g of senza) {
      const i = con.map((c, k) => [k, intersezione(c.getBoundary(), g.getBoundary()).getLength()] as const).sort((x, y) => y[1] - x[1])[0][0];
      con[i] = unione([con[i], g]);
    }
    facce.push(...con);
  }

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
  // l'unità: i suoi poligoni, compresi balconi, terrazze e aree scoperte (D, E, F) già disegnati
  const DENTRO = buffer(unione(di('ABCDEFH')), 0.02);
  // con i poligoni del tecnico, terrazze e giardini con il loro nome restano dell'unità anche se fuori dai poligoni
  // (tipicamente: poligoni A disegnati o proposti prima, senza D/F); ciò che è «a comune» mai
  const scopertoNominato = (f: G): boolean => { const c = categorieIn(f); return !senzaPoligoni && (c.has('D') || c.has('F')) && !c.has('V') && !c.has('X'); };
  const eMuro = (f: G) => { const o = buffer(f, -0.3, true); return o.isEmpty() || o.getArea() < 0.05; };
  // senza poligoni: lo spazio fra il disegno e il riquadro (tocca il bordo della zona) è l'esterno, non un vano
  const bordoZona = senzaPoligoni ? buffer(unione(di('A')).getBoundary(), 0.05) : null;
  let validi = facce.filter((f) => { const rp = puntoInterno(f); return !Gz.contains(rp) && !eMuro(f) && (DENTRO.contains(rp) || scopertoNominato(f)) && f.getArea() >= 0.3 && !(bordoZona && f.intersects(bordoZona)); });

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
  const facceAperte = facce.filter((f) => f.getArea() >= 0.3 && !eMuro(f));
  const apertoIn = (q: XY): boolean => { const P = punto(q); return facceAperte.some((f) => f.contains(P)); };
  const altezzeIn = (g: G) => testi.filter((x) => g.contains(x.p)).map((x) => altezzaDaTesto(x.t)).filter((h): h is number => h !== null);
  // aperture con superficie > 4 m² (larghezza × altezza del vano più basso, 2,40 m se manca): un vano solo
  const unitePer: G[] = [];
  for (let giro = 0; giro < 50; giro++) {
    const geo = new Map<number, G>();
    validi.forEach((f, i) => geo.set(radice(i), unione([geo.get(radice(i)) ?? vuoto(), f])));
    let unito = false;
    for (const { w, striscia, lati } of aperture) {
      // un'apertura vera ha un locale da tutte e due le parti; fra due finestre (pilastro nel muro) da una parte c'è il muro
      if (lati && !lati.every((q) => apertoIn(q))) continue;
      const s = buffer(striscia, 0.03);
      const vicini = [...geo.entries()].filter(([, g]) => g.intersects(s) && intersezione(g, s).getArea() > 0.001).map(([k]) => k);
      if (vicini.length !== 2) continue;
      // un'apertura larga unisce due locali, non un locale con la terrazza, il giardino o le parti comuni
      const ca = [...categorieIn(geo.get(vicini[0]))].filter((c) => c !== 'V'), cb = [...categorieIn(geo.get(vicini[1]))].filter((c) => c !== 'V');
      if (ca.join() !== cb.join()) continue;
      const hs = vicini.map((k) => Math.min(...(altezzeIn(geo.get(k)).length ? altezzeIn(geo.get(k)) : [2.4])));
      if (w * Math.min(...hs) > 4 && radice(vicini[0]) !== radice(vicini[1])) { padre[radice(vicini[1])] = radice(vicini[0]); unito = true; break; }
    }
    if (!unito) break;
  }
  // le chiusure trovate prolungando la testa di un muro sono meno sicure delle coppie di spalle: se staccano un pezzo
  // senza nessun testo (né nome né altezza), il pezzo torna al locale da cui è stato staccato (nicchie, rientranze
  // di un corridoio)
  for (let giro = 0; giro < 50; giro++) {
    const geo = new Map<number, G>();
    validi.forEach((f, i) => geo.set(radice(i), unione([geo.get(radice(i)) ?? vuoto(), f])));
    const conTesto = (g: G) => testi.some((x) => g.contains(x.p));
    // il pezzo senza testo torna al vicino da cui l'ha staccato il taglio più lungo
    let meglio: { senza: number; con: number; w: number; striscia: G } | null = null;
    for (const { w, striscia, da } of aperture) {
      if (da !== 'testa') continue;
      const s = buffer(striscia, 0.03);
      const vicini = [...geo.entries()].filter(([, g]) => g.intersects(s) && intersezione(g, s).getArea() > 0.001).map(([k]) => k);
      if (vicini.length !== 2 || radice(vicini[0]) === radice(vicini[1])) continue;
      const [a, b] = vicini.map((k) => conTesto(geo.get(k)));
      if (a && b) continue;
      if (!meglio || w > meglio.w) meglio = { senza: vicini[a ? 1 : 0], con: vicini[a ? 0 : 1], w, striscia };
    }
    if (!meglio) break;
    padre[radice(meglio.senza)] = radice(meglio.con);
    unitePer.push(meglio.striscia);
  }

  // la striscia di una chiusura falsa (testa di muro in uno spazio aperto: nicchia, rientranza di un corridoio) è
  // pavimento del locale: si aggiunge. La striscia di un'apertura larga vera fra due locali (arco) è nello spessore
  // del muro e resta fuori, come le soglie delle porte (decisione di Fabrizio, 10/11/2026)
  for (const st of unitePer) {
    const sb = buffer(st, 0.01);
    for (const f of facce) {
      if (validi.includes(f) || !eMuro(f) || !f.within(sb)) continue;
      const vicino = validi.findIndex((g) => g.distance(f) < 0.01);
      if (vicino < 0) continue;
      validi.push(f); padre.push(radice(vicino));
    }
  }
  // testi rimasti fuori dalle facce dei vani (dentro una soglia o una finestra): vanno al vano più vicino entro 60 cm
  for (const x of testi) {
    if (validi.some((g) => g.contains(x.p))) continue;
    const vicini = validi.map((g) => [g, g.distance(x.p)] as const).filter(([, d]) => d < 0.6).sort((a, b) => a[1] - b[1]);
    if (vicini.length) x.p = puntoInterno(vicini[0][0]);
  }

  // ---- sguinci, stipiti, soglie, nicchie: la superficie del vano si misura fra i muri (regola catastale). Dove il
  // filo di un muro si interrompe e riprende sulla stessa retta (finestra, porta, arco, nicchia) il vano si taglia
  // lungo quel filo: il pezzo staccato, se è basso quanto lo spessore di un muro, piccolo e senza testi, è nello
  // spessore del muro e non conta (decisione di Fabrizio, 10/11/2026)
  const fili: [XY, XY][] = [];
  {
    type S = { a: XY; b: XY; t0: number; t1: number };
    const gruppiFilo = new Map<string, { d: XY; s: S[] }>();
    for (const l of cont) {
      let [a, b] = estremi(l);
      if (dist(a, b) < 0.02) continue;
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang < 0) ang += Math.PI;
      if (ang >= Math.PI - 1e-9) ang -= Math.PI;
      const d: XY = [Math.cos(ang), Math.sin(ang)];
      const off = a[0] * -d[1] + a[1] * d[0];
      const chiave = `${Math.round(ang * 2000)}|${Math.round(off * 500)}`;
      let t0 = a[0] * d[0] + a[1] * d[1], t1 = b[0] * d[0] + b[1] * d[1];
      if (t0 > t1) { [t0, t1] = [t1, t0]; [a, b] = [b, a]; }
      const g = gruppiFilo.get(chiave) ?? { d, s: [] };
      g.s.push({ a, b, t0, t1 });
      gruppiFilo.set(chiave, g);
    }
    for (const { s: ss } of gruppiFilo.values()) {
      ss.sort((x, y) => x.t0 - y.t0);
      let fine = ss[0];
      for (const x of ss.slice(1)) {
        const gap = x.t0 - fine.t1;
        if (gap >= 0.3 && gap <= 3.0) fili.push([fine.b, x.a]);
        if (x.t1 > fine.t1) fine = x;
      }
    }
  }
  // anche i fili disegnati per intero: un pezzo attaccato al vano lungo una linea di muro (rimasto unito da una
  // chiusura) si toglie con le stesse regole
  for (const l of cont) if (l.getLength() >= 0.3) fili.push(estremi(l));
  const ritagli = (g: G, conTesti: G[]): { g: G; tolto: number } => {
    // vano fatto di più pezzi (o raccolta di geometrie): si ritaglia pezzo per pezzo
    if (g.getGeometryType() !== 'Polygon') {
      const ps = parti(g).filter((x) => x.getGeometryType() === 'Polygon' || x.getGeometryType() === 'MultiPolygon');
      if (!ps.length) return { g, tolto: 0 };
      const rs = ps.map((x) => ritagli(x, conTesti));
      return { g: rs.length === 1 ? rs[0].g : unione(rs.map((r) => r.g)), tolto: rs.reduce((a, r) => a + r.tolto, 0) };
    }
    try { return ritagliPoligono(g, conTesti); } catch { return { g, tolto: 0 }; }
  };
  const ritagliPoligono = (g: G, conTesti: G[]): { g: G; tolto: number } => {
    let f = g, tolto = 0;
    const env = buffer(g, 0.01).getEnvelopeInternal();
    for (const [p, q] of fili) {
      if (Math.max(p[0], q[0]) < env.getMinX() || Math.min(p[0], q[0]) > env.getMaxX() || Math.max(p[1], q[1]) < env.getMinY() || Math.min(p[1], q[1]) > env.getMaxY()) continue;
      const L = linea(p, q);
      if (!buffer(f, 0.005).contains(L) || f.getBoundary().distance(punto(p)) > 0.005 || f.getBoundary().distance(punto(q)) > 0.005) continue;
      // gli estremi cadono sul contorno solo a meno di qualche centesimo di millimetro: si portano esattamente sul
      // vertice più vicino (entro 2 mm) o sul contorno, altrimenti il taglio non si chiude
      const bordo = f.getBoundary(), vs = coordinate(bordo);
      const aggancia = (x: XY): XY => {
        const v = vs.reduce((m, y) => (dist(y, x) < dist(m, x) ? y : m), vs[0]);
        return dist(v, x) < 0.002 ? v : proiezione(parti(bordo).reduce((m, b) => (b.distance(punto(x)) < m.distance(punto(x)) ? b : m)), x);
      };
      const pezzi = dividi(f, linea(aggancia(p), aggancia(q)));
      if (pezzi.length !== 2) continue;
      pezzi.sort((x, y) => y.getArea() - x.getArea());
      const [grande, piccolo] = pezzi;
      if (piccolo.getArea() > 2.0 || piccolo.getArea() > 0.25 * grande.getArea()) continue;
      if (!buffer(piccolo, -0.4, true).isEmpty()) continue; // più profondo di un muro: è parte del locale
      if (conTesti.some((x) => piccolo.contains(x))) continue;
      tolto += piccolo.getArea();
      f = grande;
    }
    return { g: f, tolto };
  };

  // ---- vani
  /** g0: il vano prima di togliere sguinci e soglie (per sapere quali locali si toccano attraverso un'apertura) */
  type V = { tipo: TipoVano; g: G; g0?: G; testi: string[]; nota?: string; scala?: boolean; zone?: { superficie: number; altezza: number | null }[]; scoperto?: 'D' | 'F'; comune?: boolean; staccato?: boolean };
  const gruppi = new Map<number, G[]>();
  validi.forEach((f, i) => { const r = radice(i); gruppi.set(r, [...(gruppi.get(r) ?? []), f]); });
  const apri = (g: G, r = 0.3): G => { const o = buffer(buffer(g, -r, true), r, true); return o.isEmpty() ? o : intersezione(o, g); };
  let vani: V[] = [];
  for (const fs of gruppi.values()) {
    const u0 = unione(fs);
    const u1 = apri(u0);
    if (u1.isEmpty() || u1.getArea() < 0.3) continue;
    const { g: u, tolto: sguinci } = ritagli(u1, testi.filter((x) => u0.contains(x.p)).map((x) => x.p));
    const tt = testi.filter((x) => u0.contains(x.p)).map((x) => x.t);
    // zone senza testo fatte di triangoli (X dei vuoti): non sono vani
    if (!tt.length && parti(u).every((g) => (g.getGeometryType() === 'Polygon' ? anello(semplifica(g, 0.05)).length <= 4 : true))) continue;
    const tipi = tt.map(tipoDaTesto).filter((x): x is TipoVano => !!x);
    const nomi = tipi.filter((x) => x !== 'escluso');
    const comune = tt.some((t) => RE_COMUNE.test(t)) || RE_COMUNE.test(tt.join(' '));
    const scoperto = tt.map(scopertoDaTesto).find((x): x is 'D' | 'F' => !!x);
    // un pezzo grande e raccolto senza nome, unito a un locale con nome da un'apertura larga (soggiorno con veranda,
    // cucina-soggiorno con ingresso): il vano è principale
    const pezzoPrincipale = fs.some((f) => f.getArea() >= 8 && f.getArea() / f.getLength() ** 2 > 0.035 && !testi.some((x) => f.contains(x.p) && tipoDaTesto(x.t)));
    let tipo: TipoVano = nomi.includes('principale') || (pezzoPrincipale && !nomi.includes('bagno')) ? 'principale' : nomi[0] ?? (tipi.length ? 'escluso' : u.getArea() >= 4 ? 'principale' : 'verificare');
    let nota: string | undefined;
    if (comune) { tipo = 'escluso'; nota = 'spazio a comune o di altre unità: non conta né nei vani né nei poligoni'; }
    else if (scoperto && !nomi.length) { tipo = 'escluso'; nota = scoperto === 'D' ? 'balcone, terrazza o loggia: non è un vano, poligono D' : 'area scoperta dell\'unità (giardino, corte, resede…): non è un vano, poligono F'; }
    else if (!nomi.length && tipi.length) { tipo = 'escluso'; nota = 'il nome indica uno spazio che non è un vano'; }
    else if (PBC.contains(puntoInterno(u)) && tipo !== 'verificare') tipo = 'indiretto';
    // locale grande con il nome di un accessorio e più altezze scritte che nomi (es. soggiorno aperto sulla veranda:
    // la parte senza nome ha la sua altezza): è un vano solo, principale
    else if (nomi.length && !nomi.includes('principale') && !nomi.includes('bagno') && u.getArea() >= 12
      && new Set(tt.map(altezzaDaTesto).filter((h) => h !== null)).size > tt.filter((t) => tipoDaTesto(t)).length) {
      tipo = 'principale';
      nota = `locale con «${tt.find((t) => tipoDaTesto(t))}» e una parte senza nome, unite da un'apertura larga: proposto come vano principale, da verificare`;
    }
    else if (!nomi.length && tipo === 'principale' && senzaPoligoni) nota = 'locale senza nome: proposto come vano principale, da verificare';
    // zone di altezza: ogni pezzo del vano (diviso dai tratteggi) con la sua altezza scritta; i pezzi senza
    // altezza prendono quella del vano se è una sola
    const hVano = [...new Set(tt.map(altezzaDaTesto).filter((h): h is number => h !== null))];
    // i pezzi: le facce del vano divise anche dalle linee tratteggiate che lo attraversano
    const trattDentro = tratt.filter((t) => t.intersects(u0));
    const pezziVano = trattDentro.length ? faccePoligonizzate(rete([u0.getBoundary(), ...trattDentro])).filter((f) => f.getArea() > 0.05 && u0.contains(puntoInterno(f))) : fs;
    const zone = (pezziVano.length ? pezziVano : fs).map((f) => {
      const hs = testi.filter((x) => f.contains(x.p)).map((x) => altezzaDaTesto(x.t)).filter((h): h is number => h !== null);
      const h = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : hVano.length === 1 ? hVano[0] : null;
      return { superficie: sguinci > 0 ? intersezione(f, u).getArea() : f.getArea(), altezza: h };
    });
    if (sguinci >= 0.05 && tipo !== 'escluso') {
      const n = `esclusi ${sguinci.toLocaleString('it-IT', { maximumFractionDigits: 2 })} m² di sguinci, soglie o nicchie nello spessore dei muri`;
      nota = nota ? `${nota}; ${n}` : n;
    }
    vani.push({ tipo, g: u, g0: u1, testi: tt, nota, zone, scoperto: comune ? undefined : scoperto && !nomi.length ? scoperto : undefined, comune: comune || undefined });
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
      for (const v of residui) if (buffer(v.g0 ?? v.g, 0.05).intersects(g)) g = unione([g, v.g]);
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
  // senza poligoni non si sa qual è il piano dell'unità: la scala si conta una volta sola, quella più grande
  // (al piano di partenza comprende l'inizio della rampa); le altre sono l'arrivo ai piani superiori
  const piuGrande = scale.reduce<G | null>((m, c) => (!m || c.getArea() > m.getArea() ? c : m), null);
  const COMUNI = vani.filter((v) => v.comune).map((v) => buffer(v.g0 ?? v.g, 0.1));
  for (const c of scale) {
    if (COMUNI.some((x) => x.intersects(c))) { vani.push({ tipo: 'escluso', g: c, testi: ['scala'], scala: true, comune: true, nota: 'scala nelle parti comuni: non conta' }); continue; }
    if (senzaPoligoni && c !== piuGrande) vani.push({ tipo: 'escluso', g: c, testi: ['scala'], scala: true, nota: 'arrivo della scala a un piano superiore: la scala si conta una volta, al piano di partenza' });
    else if (PA.contains(puntoInterno(c))) vani.push({ tipo: 'diretto', g: c, testi: ['scala'], scala: true, nota: 'scala interna: contata intera a questo piano' });
    else avvisi.push(`Scala di ${c.getArea().toFixed(2).replace('.', ',')} m² non contata: è l'arrivo al piano superiore (la scala si conta una volta, al piano dell'unità).`);
  }
  // locali piccoli senza nome attaccati solo a parti comuni (pianerottolo, sottoscala): a comune anche loro
  for (const v of vani) {
    if (v.tipo !== 'verificare') continue;
    const tocca = (w: V) => w !== v && (w.g0 ?? w.g).distance(v.g0 ?? v.g) < 0.05;
    if (vani.some((w) => w.comune && tocca(w)) && !vani.some((w) => !w.comune && w.tipo !== 'escluso' && tocca(w))) {
      v.tipo = 'escluso'; v.comune = true; v.nota = 'locale senza nome attaccato alle parti comuni: considerato a comune, da verificare';
    }
  }
  // vani senza nome rimasti: accessorio diretto da verificare (es. cabina armadi senza testo)
  vani = vani.filter((v) => v.tipo !== 'verificare' || v.g.getArea() >= 1.0);
  for (const v of vani) if (v.tipo === 'verificare') v.nota = 'locale senza nome nel DXF: proposto come accessorio diretto, da verificare';

  // ---- locali staccati dall'abitazione (ripostiglio in giardino, cantina esterna): non comunicano con i vani
  // principali, quindi sono accessori indiretti non comunicanti (poligono C). L'abitazione è il gruppo di locali
  // vicini (muro di mezzo fino a 70 cm) con più superficie di vani principali.
  {
    const interni = vani.filter((v) => v.tipo !== 'escluso');
    const gruppo = interni.map((_, i) => i);
    const rad = (i: number): number => { while (gruppo[i] !== i) i = gruppo[i]; return i; };
    for (let i = 0; i < interni.length; i++) for (let j = i + 1; j < interni.length; j++) if (interni[i].g.distance(interni[j].g) <= 0.7) gruppo[rad(j)] = rad(i);
    // un gruppo con vani principali, bagni o una scala è abitazione (anche se è un altro piano disegnato a parte)
    const abitati = new Set(interni.filter((v) => v.tipo === 'principale' || v.tipo === 'bagno' || v.scala).map((v) => rad(interni.indexOf(v))));
    if (abitati.size) interni.forEach((v, i) => {
      if (abitati.has(rad(i))) return;
      v.staccato = true;
      if (v.tipo !== 'indiretto') { v.tipo = 'indiretto'; }
      v.nota = 'locale staccato dall\'abitazione (es. ripostiglio in giardino): accessorio indiretto non comunicante, poligono C';
    });
  }

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
        zone: v.zone?.map((z) => ({ superficie: Math.round(z.superficie * 100) / 100, altezza: z.altezza })),
        contorni: parti(v.g).filter((g) => g.getGeometryType() === 'Polygon').map(anello),
        // con sguinci e soglie: servono ai poligoni (superficie lorda, muri compresi), non ai vani
        contorniLordi: v.g0 && Math.abs(v.g0.getArea() - v.g.getArea()) > 1e-6 ? parti(v.g0).filter((g) => g.getGeometryType() === 'Polygon').map(anello) : undefined,
        centro: c,
        scala: v.scala,
        nota: v.nota ?? (tipo === 'verificare' ? 'da verificare' : undefined),
        scoperto: v.scoperto,
        comune: v.comune,
        staccato: v.staccato,
      };
    });
  if (porte) avvisi.push(`${porte} porte disegnate con linea tratteggiata riconosciute.`);
  const muri = tutteFacce.filter((f) => f.getArea() > 1e-4 && eMuro(f) && DENTRO.contains(puntoInterno(f)) && !Gz.contains(puntoInterno(f))).map(anello);
  return { vani: risultato, muri, linee: lineeAnteprima, limiti, avvisi, senzaPoligoni };
}

export { totaliVani, type TotaliVani } from './totali';

/**
 * Altezze per il modello 1N parte II (dati metrici): altezza media utile in cm (media pesata sulla superficie
 * delle zone con l'altezza scritta) e superficie con altezza inferiore a 2,30 m (m² interi). Vani esclusi e
 * scale non contano. null se nessun vano ha l'altezza.
 */
export function altezzeUnita(vani: VanoRiconosciuto[]): { altezzaMediaCm: number; supInferiore230: number; conAltezza: number; senzaAltezza: number } | null {
  let s = 0, sh = 0, basse = 0, con = 0, senza = 0;
  for (const v of vani) {
    if (v.tipo === 'escluso' || v.scala) continue;
    const zone = v.zone?.length ? v.zone : [{ superficie: v.superficie, altezza: v.altezze.length ? v.altezze.reduce((a, b) => a + b, 0) / v.altezze.length : null }];
    // la superficie corretta dal tecnico (m²) si ripartisce sulle zone in proporzione
    const tot = zone.reduce((a, z) => a + z.superficie, 0) || 1;
    let conH = false;
    for (const z of zone) {
      if (z.altezza === null) continue;
      conH = true;
      const a = (z.superficie / tot) * v.m2;
      s += a; sh += a * z.altezza;
      if (z.altezza < 2.3) basse += a;
    }
    if (conH) con++; else senza++;
  }
  if (!s) return null;
  return { altezzaMediaCm: Math.round((sh / s) * 100), supInferiore230: m2Intero(basse), conAltezza: con, senzaAltezza: senza };
}
