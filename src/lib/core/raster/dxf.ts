/**
 * Parser DXF ASCII (R12 e 2000+) limitato a quanto serve per le planimetrie catastali:
 * LINE, LWPOLYLINE (con bulge), POLYLINE/VERTEX 2D, CIRCLE, ARC, ELLIPSE, SPLINE, SOLID/TRACE, TEXT,
 * MTEXT (testo semplice), ATTRIB visibili, DIMENSION (blocco della quota), INSERT con esplosione dei blocchi; colore (62), layer (8), thickness (39) e larghezza costante (43).
 *
 * Restituisce le entità disegnabili (escludendo i layer RIQUADRO e DOCFA_POLIGONI e i layer
 * spenti o congelati) e i poligoni Docfa ricavati dal layer DOCFA_POLIGONI, dove il colore
 * dell'entità indica il tipo di ambiente: 1=A rosso, 2=B giallo, 3=C verde, 4=D ciano, 5=E blu,
 * 6=F magenta, 7=G bianco, 8=A2 grigio (accessori diretti di C/1 e C/6, lettera H nel file NTF).
 * L'altezza < 1,50 m non si esprime nel DXF: si indica sul singolo poligono nel programma.
 */
import type { Poligono, TipoAmbientePoligono } from '../model';
import type { FoglioPlanimetria } from '../ntf';
import type { AllineamentoH, AllineamentoV } from './bitmap';

export type Punto2 = [number, number];

export const LAYER_RIQUADRO = 'RIQUADRO';
export const LAYER_POLIGONI = 'DOCFA_POLIGONI';

interface EntitaBase {
  layer: string;
  /** colore risolto (ACI); 256 = BYLAYER non risolvibile, 0 = BYBLOCK non risolvibile */
  colore: number;
  /** spessore di penna in unità del disegno (thickness 39 o larghezza costante 43); 0 = linea sottile */
  spessore: number;
}

export type Entita =
  | (EntitaBase & { tipo: 'linea'; p1: Punto2; p2: Punto2 })
  | (EntitaBase & { tipo: 'polilinea'; punti: Punto2[]; chiusa: boolean })
  | (EntitaBase & { tipo: 'cerchio'; centro: Punto2; raggio: number })
  | (EntitaBase & { tipo: 'arco'; centro: Punto2; raggio: number; /** gradi, antiorari */ inizio: number; fine: number })
  | (EntitaBase & {
      tipo: 'testo';
      testo: string;
      punto: Punto2;
      /** altezza delle maiuscole in unità del disegno */
      altezza: number;
      /** gradi, antiorari */
      rotazione: number;
      allineamentoH: AllineamentoH;
      allineamentoV: AllineamentoV;
      /** fattore di larghezza (41) */
      larghezza: number;
    });

export interface LayerDxf {
  nome: string;
  colore: number;
  spento: boolean;
  congelato: boolean;
}

export interface DxfLetto {
  /** entità disegnabili, già esplose e filtrate */
  entita: Entita[];
  /** poligoni Docfa dal layer DOCFA_POLIGONI */
  poligoni: Poligono[];
  /** vertici del riquadro (layer RIQUADRO), se presente */
  riquadro: Punto2[] | null;
  layers: Record<string, LayerDxf>;
  /** $ACADVER dell'header (es. AC1015) */
  versione: string;
  /** entità grezze del layer DOCFA_POLIGONI (per le correzioni: colori, linee da unire) */
  grezzePoligoni: Entita[];
  /** statistiche per il resoconto dell'importazione */
  statistiche: {
    /** oggetti scartati perché su layer spenti o congelati */
    suLayerNascosti: number;
    /** tipi di oggetto non disegnabili e ignorati (HATCH, IMAGE, proxy…), con il numero */
    nonGestiti: Record<string, number>;
    /** layer usati dal disegno (diversi da 0, RIQUADRO e DOCFA_POLIGONI) */
    altriLayer: string[];
  };
}

// ---------------------------------------------------------------------------------------------
// Tokenizzazione
// ---------------------------------------------------------------------------------------------

interface Gruppo { codice: number; valore: string }

/** Entità "grezza": tipo e gruppi nell'ordine del file (i codici possono ripetersi). */
interface EntitaGrezza {
  tipo: string;
  gruppi: Gruppo[];
  /** per POLYLINE: i VERTEX che seguono */
  vertici?: EntitaGrezza[];
}

function tokenizza(testo: string): Gruppo[] {
  const righe = testo.split(/\r?\n/);
  const out: Gruppo[] = [];
  for (let i = 0; i + 1 < righe.length; i += 2) {
    const codice = Number.parseInt(righe[i].trim(), 10);
    if (Number.isNaN(codice)) continue;
    out.push({ codice, valore: righe[i + 1].replace(/\r$/, '') });
  }
  return out;
}

/** Legge una sequenza di entità (sezione ENTITIES o corpo di un BLOCK) fino a `fine` (ENDSEC/ENDBLK). */
function leggiEntita(gruppi: Gruppo[], i: number, fine: string): { entita: EntitaGrezza[]; i: number } {
  const entita: EntitaGrezza[] = [];
  let corrente: EntitaGrezza | null = null;
  let polilinea: EntitaGrezza | null = null;
  for (; i < gruppi.length; i++) {
    const g = gruppi[i];
    if (g.codice === 0) {
      if (g.valore === fine) { i++; break; }
      corrente = { tipo: g.valore, gruppi: [] };
      if (g.valore === 'VERTEX' && polilinea) { polilinea.vertici?.push(corrente); continue; }
      if (g.valore === 'SEQEND') { polilinea = null; continue; }
      if (g.valore === 'POLYLINE') { corrente.vertici = []; polilinea = corrente; }
      entita.push(corrente);
    } else if (corrente) {
      corrente.gruppi.push(g);
    }
  }
  return { entita, i };
}

/** Primo valore del codice richiesto, come stringa o numero. */
function val(e: EntitaGrezza, codice: number): string | undefined {
  const g = e.gruppi.find((x) => x.codice === codice);
  return g?.valore.trim();
}
function num(e: EntitaGrezza, codice: number, def = 0): number {
  const v = val(e, codice);
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// ---------------------------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------------------------

/** Trasformazione affine 2D usata per esplodere i blocchi: p' = origine + R·S·(p − base). */
interface Trasformazione {
  tx: number; ty: number; sx: number; sy: number; /** radianti */ rot: number;
}

function applica(t: Trasformazione | null, p: Punto2): Punto2 {
  if (!t) return p;
  const x = p[0] * t.sx, y = p[1] * t.sy;
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  return [t.tx + x * c - y * s, t.ty + x * s + y * c];
}

/** Fattore di scala medio (per spessori, raggi e altezze dei testi). */
function scalaMedia(t: Trasformazione | null): number {
  return t ? Math.sqrt(Math.abs(t.sx * t.sy)) : 1;
}

/**
 * Espande un segmento con bulge in una sequenza di punti lungo l'arco (il punto finale incluso,
 * quello iniziale escluso). bulge = tan(θ/4), positivo = arco antiorario.
 */
export function puntiBulge(p1: Punto2, p2: Punto2, bulge: number, segmentiMinimi = 8): Punto2[] {
  if (!bulge || Math.abs(bulge) < 1e-9) return [p2];
  const theta = 4 * Math.atan(bulge);
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const c = Math.hypot(dx, dy);
  if (c < 1e-12) return [p2];
  const d = (c / 2) / Math.tan(theta / 2); // distanza (con segno) del centro dalla corda
  const cx = (p1[0] + p2[0]) / 2 - (dy / c) * d;
  const cy = (p1[1] + p2[1]) / 2 + (dx / c) * d;
  const r = Math.hypot(p1[0] - cx, p1[1] - cy);
  const a0 = Math.atan2(p1[1] - cy, p1[0] - cx);
  const n = Math.max(segmentiMinimi, Math.ceil((Math.abs(theta) / (2 * Math.PI)) * 64));
  const out: Punto2[] = [];
  for (let k = 1; k <= n; k++) {
    const a = a0 + (theta * k) / n;
    out.push(k === n ? p2 : [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Vertici (10/20) con relativi bulge (42) di una LWPOLYLINE, nell'ordine del file. */
function verticiLw(e: EntitaGrezza): { p: Punto2; bulge: number }[] {
  const out: { p: Punto2; bulge: number }[] = [];
  let x: number | null = null;
  for (const g of e.gruppi) {
    if (g.codice === 10) x = Number(g.valore);
    else if (g.codice === 20 && x !== null) { out.push({ p: [x, Number(g.valore)], bulge: 0 }); x = null; }
    else if (g.codice === 42 && out.length) out[out.length - 1].bulge = Number(g.valore);
  }
  return out;
}

/** Spezzata (con archi espansi) da una lista di vertici con bulge. */
function spezzata(v: { p: Punto2; bulge: number }[], chiusa: boolean): Punto2[] {
  if (!v.length) return [];
  const punti: Punto2[] = [v[0].p];
  for (let i = 1; i < v.length; i++) punti.push(...puntiBulge(v[i - 1].p, v[i].p, v[i - 1].bulge));
  if (chiusa && v.length > 1 && v[v.length - 1].bulge) {
    // arco di chiusura: aggiunge i punti intermedi fino al primo vertice (escluso)
    const arco = puntiBulge(v[v.length - 1].p, v[0].p, v[v.length - 1].bulge);
    punti.push(...arco.slice(0, -1));
  }
  return punti;
}

// ---------------------------------------------------------------------------------------------
// Testo
// ---------------------------------------------------------------------------------------------

/** Sostituzioni dei codici speciali %%c %%d %%p e dei caratteri non ASCII più comuni. */
function pulisciTesto(s: string): string {
  return s
    .replace(/%%c/gi, 'O')
    .replace(/%%d/gi, '°')
    .replace(/%%p/gi, '+/-')
    .replace(/%%%/g, '%')
    .replace(/%%[ou]/gi, '')
    .replace(/%%(\d{3})/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Rimuove i codici di formattazione dell'MTEXT e restituisce le righe. */
export function righeMtext(s: string): string[] {
  let t = s
    .replace(/\\\\/g, '\u0001') // backslash letterale
    .replace(/\\\{/g, '\u0002').replace(/\\\}/g, '\u0003')
    .replace(/\\P/g, '\n')
    .replace(/\\~/g, ' ')
    .replace(/\\S([^;^]*)[/^#]([^;]*);/g, '$1/$2') // frazioni impilate
    .replace(/\\[fF][^;]*;/g, '')
    .replace(/\\[HhWwQqAaCcTtLlOoKkpX][^;]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/[{}]/g, '');
  t = t.replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}');
  return pulisciTesto(t).split('\n');
}

function allineamentoText(h: number, v: number): { allineamentoH: AllineamentoH; allineamentoV: AllineamentoV } {
  let allineamentoH: AllineamentoH = 'sinistra';
  let allineamentoV: AllineamentoV = 'base';
  if (h === 1 || h === 3 || h === 4 || h === 5) allineamentoH = 'centro';
  else if (h === 2) allineamentoH = 'destra';
  if (v === 1) allineamentoV = 'basso';
  else if (v === 2) allineamentoV = 'medio';
  else if (v === 3) allineamentoV = 'alto';
  if (h === 4) allineamentoV = 'medio'; // "middle"
  return { allineamentoH, allineamentoV };
}

// ---------------------------------------------------------------------------------------------
// Interpretazione delle entità
// ---------------------------------------------------------------------------------------------

interface Contesto {
  blocchi: Map<string, { base: Punto2; entita: EntitaGrezza[] }>;
  layers: Record<string, LayerDxf>;
  /** layer e colore ereditati dall'INSERT per le entità sul layer 0 / BYBLOCK */
  layerPadre?: string;
  colorePadre?: number;
  profondita: number;
  nonGestiti: Record<string, number>;
}

function risolviColore(e: EntitaGrezza, layer: string, ctx: Contesto): number {
  const c = num(e, 62, 256);
  if (c === 0) return ctx.colorePadre ?? 0;
  if (c === 256) return ctx.layers[layer]?.colore ?? 256;
  return c;
}

/** Converte un'entità grezza (eventualmente trasformata) in entità disegnabili. */
function interpreta(e: EntitaGrezza, t: Trasformazione | null, ctx: Contesto, out: Entita[]): void {
  let layer = val(e, 8) ?? '0';
  if (layer === '0' && ctx.layerPadre) layer = ctx.layerPadre;
  if (num(e, 67, 0) === 1) return; // spazio carta
  const colore = risolviColore(e, layer, ctx);
  const k = scalaMedia(t);
  const base: EntitaBase = { layer, colore, spessore: Math.abs(num(e, 39, 0)) * k };
  const P = (cx: number, cy: number): Punto2 => applica(t, [num(e, cx), num(e, cy)]);
  const rotazione = (gradi: number): number => gradi + (t ? (t.rot * 180) / Math.PI : 0);
  switch (e.tipo) {
    case 'LINE':
      out.push({ ...base, tipo: 'linea', p1: P(10, 20), p2: P(11, 21) });
      break;
    case 'LWPOLYLINE': {
      const chiusa = (num(e, 70, 0) & 1) === 1;
      const larghezza = Math.abs(num(e, 43, 0)) * k;
      const punti = spezzata(verticiLw(e), chiusa).map((p) => applica(t, p));
      if (punti.length) out.push({ ...base, spessore: Math.max(base.spessore, larghezza), tipo: 'polilinea', punti, chiusa });
      break;
    }
    case 'POLYLINE': {
      const flag = num(e, 70, 0);
      if (flag & (8 | 16 | 64)) break; // 3D, mesh, polyface: non gestite
      const chiusa = (flag & 1) === 1;
      const v = (e.vertici ?? [])
        .filter((x) => (num(x, 70, 0) & (16 | 128)) === 0) // ignora i punti di controllo spline e le facce
        .map((x) => ({ p: [num(x, 10), num(x, 20)] as Punto2, bulge: num(x, 42, 0) }));
      const larghezza = Math.max(Math.abs(num(e, 40, 0)), Math.abs(num(e, 41, 0))) * k;
      const punti = spezzata(v, chiusa).map((p) => applica(t, p));
      if (punti.length) out.push({ ...base, spessore: Math.max(base.spessore, larghezza), tipo: 'polilinea', punti, chiusa });
      break;
    }
    case 'CIRCLE':
      out.push({ ...base, tipo: 'cerchio', centro: P(10, 20), raggio: num(e, 40) * k });
      break;
    case 'ARC': {
      // con scala negativa (specchiatura) l'arco andrebbe invertito: caso raro, approssimato
      out.push({ ...base, tipo: 'arco', centro: P(10, 20), raggio: num(e, 40) * k, inizio: rotazione(num(e, 50, 0)), fine: rotazione(num(e, 51, 360)) });
      break;
    }
    case 'TEXT': {
      const h = num(e, 72, 0), v = num(e, 73, 0);
      const usaSecondo = (h !== 0 || v !== 0) && val(e, 11) !== undefined;
      const punto = usaSecondo ? P(11, 21) : P(10, 20);
      const testo = pulisciTesto(val(e, 1) ?? '');
      if (!testo.trim()) break;
      out.push({ ...base, tipo: 'testo', testo, punto, altezza: num(e, 40, 1) * k, rotazione: rotazione(num(e, 50, 0)), larghezza: num(e, 41, 1) || 1, ...allineamentoText(h, v) });
      break;
    }
    case 'MTEXT': {
      // il testo è nei gruppi 3 (pezzi da 250 caratteri) seguiti dal gruppo 1
      const pezzi = e.gruppi.filter((g) => g.codice === 3).map((g) => g.valore);
      const grezzo = pezzi.join('') + (e.gruppi.find((g) => g.codice === 1)?.valore ?? '');
      const righe = righeMtext(grezzo);
      const altezza = num(e, 40, 1) * k;
      let rot = num(e, 50, 0);
      if (val(e, 50) === undefined && val(e, 11) !== undefined) rot = (Math.atan2(num(e, 21), num(e, 11)) * 180) / Math.PI;
      rot = rotazione(rot);
      const att = num(e, 71, 1);
      const allineamentoH: AllineamentoH = att % 3 === 1 ? 'sinistra' : att % 3 === 2 ? 'centro' : 'destra';
      const interlinea = altezza * (5 / 3) * (num(e, 44, 1) || 1);
      const altezzaBlocco = altezza + interlinea * (righe.length - 1);
      // posizione della linea di base della prima riga rispetto al punto di inserimento (verso l'alto)
      let base0: number;
      if (att <= 3) base0 = -altezza; // in alto: la cima delle maiuscole della prima riga è sul punto
      else if (att <= 6) base0 = altezzaBlocco / 2 - altezza; // centrato
      else base0 = altezzaBlocco - altezza; // in basso: l'ultima riga è sul punto
      const p0 = P(10, 20);
      const r = (rot * Math.PI) / 180;
      righe.forEach((riga, i) => {
        if (!riga.trim()) return;
        const dv = base0 - interlinea * i; // spostamento lungo la "verticale" del testo
        const punto: Punto2 = [p0[0] - dv * Math.sin(r), p0[1] + dv * Math.cos(r)];
        out.push({ ...base, tipo: 'testo', testo: riga, punto, altezza, rotazione: rot, larghezza: 1, allineamentoH, allineamentoV: 'base' });
      });
      break;
    }
    case 'INSERT': {
      const nome = val(e, 2) ?? '';
      const blocco = ctx.blocchi.get(nome);
      if (!blocco) { ctx.nonGestiti['BLOCCO MANCANTE'] = (ctx.nonGestiti['BLOCCO MANCANTE'] ?? 0) + 1; break; }
      if (ctx.profondita > 8) break;
      const sx = num(e, 41, 1) || 1, sy = num(e, 42, 1) || 1;
      const rot = (num(e, 50, 0) * Math.PI) / 180;
      const ins: Punto2 = [num(e, 10), num(e, 20)];
      // trasformazione locale del blocco: p' = ins + R(rot)·S·(p − base)
      const locale: Trasformazione = { tx: ins[0], ty: ins[1], sx, sy, rot };
      const colonne = Math.max(1, num(e, 70, 1)), righe = Math.max(1, num(e, 71, 1));
      const dc = num(e, 44, 0), dr = num(e, 45, 0);
      for (let ri = 0; ri < righe; ri++) {
        for (let ci = 0; ci < colonne; ci++) {
          const l2: Trasformazione = { ...locale, tx: locale.tx + ci * dc * Math.cos(rot) - ri * dr * Math.sin(rot), ty: locale.ty + ci * dc * Math.sin(rot) + ri * dr * Math.cos(rot) };
          const comp = componi(t, l2, blocco.base);
          const sotto: Contesto = { ...ctx, layerPadre: layer, colorePadre: colore, profondita: ctx.profondita + 1 };
          for (const be of blocco.entita) interpreta(be, comp, sotto, out);
        }
      }
      break;
    }
    case 'ATTRIB': {
      if (num(e, 70, 0) & 1) break; // attributo invisibile
      const h = num(e, 72, 0), v = num(e, 74, 0);
      const usaSecondo = (h !== 0 || v !== 0) && val(e, 11) !== undefined;
      const testo = pulisciTesto(val(e, 1) ?? '');
      if (!testo.trim()) break;
      out.push({ ...base, tipo: 'testo', testo, punto: usaSecondo ? P(11, 21) : P(10, 20), altezza: num(e, 40, 1) * k, rotazione: rotazione(num(e, 50, 0)), larghezza: num(e, 41, 1) || 1, ...allineamentoText(h, v) });
      break;
    }
    case 'ELLIPSE': {
      const c: Punto2 = [num(e, 10), num(e, 20)];
      const ax = num(e, 11), ay = num(e, 21), ratio = num(e, 40, 1);
      let a0 = num(e, 41, 0), a1 = num(e, 42, 2 * Math.PI);
      if (a1 <= a0) a1 += 2 * Math.PI;
      const n = Math.max(16, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 96));
      const punti: Punto2[] = [];
      for (let j = 0; j <= n; j++) {
        const t2 = a0 + ((a1 - a0) * j) / n;
        // punto = centro + asse maggiore·cos t + asse minore·sin t (asse minore = maggiore ruotato di 90° × ratio)
        punti.push(applica(t, [c[0] + ax * Math.cos(t2) - ay * ratio * Math.sin(t2), c[1] + ay * Math.cos(t2) + ax * ratio * Math.sin(t2)]));
      }
      const chiusa = Math.abs(a1 - a0 - 2 * Math.PI) < 1e-6;
      out.push({ ...base, tipo: 'polilinea', punti: chiusa ? punti.slice(0, -1) : punti, chiusa });
      break;
    }
    case 'SPLINE': {
      const punti = puntiSpline(e).map((p) => applica(t, p));
      if (punti.length > 1) out.push({ ...base, tipo: 'polilinea', punti, chiusa: (num(e, 70, 0) & 1) === 1 });
      break;
    }
    case 'SOLID':
    case 'TRACE': {
      // vertici 1-2-4-3 (ordine del DXF): se ne disegna il contorno
      const v = [P(10, 20), P(11, 21), P(13, 23), P(12, 22)];
      out.push({ ...base, tipo: 'polilinea', punti: v, chiusa: true });
      break;
    }
    case 'DIMENSION': {
      // la quota è disegnata nel blocco anonimo indicato dal gruppo 2, già in coordinate del disegno
      const blocco = ctx.blocchi.get(val(e, 2) ?? '');
      if (!blocco || ctx.profondita > 8) break;
      const sotto: Contesto = { ...ctx, layerPadre: layer, colorePadre: colore, profondita: ctx.profondita + 1 };
      for (const be of blocco.entita) interpreta(be, t, sotto, out);
      break;
    }
    case 'ATTDEF': case 'SEQEND': case 'VERTEX': case 'POINT': case 'VIEWPORT':
      break;
    default:
      ctx.nonGestiti[e.tipo] = (ctx.nonGestiti[e.tipo] ?? 0) + 1;
      break;
  }
}

/** Punti di una SPLINE: curva B-spline valutata dai punti di controllo e dai nodi (o i punti di passaggio). */
function puntiSpline(e: EntitaGrezza): Punto2[] {
  const grado = num(e, 71, 3);
  const nodi = e.gruppi.filter((g) => g.codice === 40).map((g) => Number(g.valore));
  const coppie = (cx: number, cy: number): Punto2[] => {
    const out: Punto2[] = [];
    let x: number | null = null;
    for (const g of e.gruppi) {
      if (g.codice === cx) x = Number(g.valore);
      else if (g.codice === cy && x !== null) { out.push([x, Number(g.valore)]); x = null; }
    }
    return out;
  };
  const ctrl = coppie(10, 20);
  const pesi = e.gruppi.filter((g) => g.codice === 41).map((g) => Number(g.valore));
  if (ctrl.length >= grado + 1 && nodi.length === ctrl.length + grado + 1) {
    const out: Punto2[] = [];
    const t0 = nodi[grado], t1 = nodi[nodi.length - grado - 1];
    const n = Math.max(16, ctrl.length * 8);
    for (let j = 0; j <= n; j++) out.push(deBoor(t0 + ((t1 - t0) * j) / n, grado, nodi, ctrl, pesi));
    return out;
  }
  const fit = coppie(11, 21);
  return fit.length > 1 ? fit : ctrl;
}

/** Algoritmo di de Boor (B-spline razionale se ci sono i pesi). */
function deBoor(u: number, p: number, nodi: number[], ctrl: Punto2[], pesi: number[]): Punto2 {
  let k = p;
  while (k < ctrl.length - 1 && u >= nodi[k + 1]) k++;
  const w = (i: number) => (pesi.length === ctrl.length ? pesi[i] : 1);
  const d: [number, number, number][] = [];
  for (let j = 0; j <= p; j++) { const i = j + k - p; d.push([ctrl[i][0] * w(i), ctrl[i][1] * w(i), w(i)]); }
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = j + k - p;
      const den = nodi[i + p - r + 1] - nodi[i];
      const a = den === 0 ? 0 : (u - nodi[i]) / den;
      d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]];
    }
  }
  const q = d[p];
  return [q[0] / (q[2] || 1), q[1] / (q[2] || 1)];
}

/**
 * Compone la trasformazione esterna `t` con quella locale `l` del blocco (che sottrae il punto
 * base). Il risultato è una trasformazione "rotazione uniforme + scale sugli assi" solo se le
 * scale sono uguali; per blocchi con scale diverse e rotazioni annidate il risultato è approssimato
 * (caso praticamente assente nelle planimetrie catastali).
 */
function componi(t: Trasformazione | null, l: Trasformazione, base: Punto2): Trasformazione {
  // prima: p1 = ins + R(rot)·S·(p − base)  →  tx' = ins − R·S·base
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  const bx = base[0] * l.sx, by = base[1] * l.sy;
  const loc: Trasformazione = { tx: l.tx - (bx * c - by * s), ty: l.ty - (bx * s + by * c), sx: l.sx, sy: l.sy, rot: l.rot };
  if (!t) return loc;
  // poi t: p2 = T + R(t.rot)·S_t·p1
  const o = applica(t, [loc.tx, loc.ty]);
  return { tx: o[0], ty: o[1], sx: loc.sx * t.sx, sy: loc.sy * t.sy, rot: loc.rot + t.rot };
}

// ---------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------

const TIPO_DA_COLORE: Record<number, { tipo: TipoAmbientePoligono; altezzaValida: boolean }> = {
  1: { tipo: 'A', altezzaValida: true },
  2: { tipo: 'B', altezzaValida: true },
  3: { tipo: 'C', altezzaValida: true },
  4: { tipo: 'D', altezzaValida: true },
  5: { tipo: 'E', altezzaValida: true },
  6: { tipo: 'F', altezzaValida: true },
  7: { tipo: 'G', altezzaValida: true },
  // colore 8 = A2 (accessori diretti di C/1 e C/6): nel file NTF di Docfa compare con la lettera H
  8: { tipo: 'H', altezzaValida: true },
};

function nomeLayerNormalizzato(s: string): string { return s.trim().toUpperCase(); }

/** Legge un DXF ASCII e restituisce entità disegnabili, poligoni Docfa, riquadro e layer. */
export function leggiDxf(testo: string): DxfLetto {
  const gruppi = tokenizza(testo);
  const layers: Record<string, LayerDxf> = {};
  const blocchi = new Map<string, { base: Punto2; entita: EntitaGrezza[] }>();
  let grezze: EntitaGrezza[] = [];
  let versione = '';
  let i = 0;
  while (i < gruppi.length) {
    const g = gruppi[i];
    if (g.codice === 0 && g.valore === 'SECTION') {
      const nome = gruppi[i + 1]?.valore.trim();
      i += 2;
      if (nome === 'HEADER') {
        for (; i < gruppi.length && !(gruppi[i].codice === 0 && gruppi[i].valore === 'ENDSEC'); i++) {
          if (gruppi[i].codice === 9 && gruppi[i].valore.trim() === '$ACADVER') versione = gruppi[i + 1]?.valore.trim() ?? '';
        }
      } else if (nome === 'TABLES') {
        let corrente: LayerDxf | null = null;
        let inLayer = false;
        for (; i < gruppi.length && !(gruppi[i].codice === 0 && gruppi[i].valore === 'ENDSEC'); i++) {
          const x = gruppi[i];
          if (x.codice === 0 && x.valore === 'TABLE') { inLayer = gruppi[i + 1]?.valore.trim() === 'LAYER'; corrente = null; continue; }
          if (x.codice === 0 && x.valore === 'ENDTAB') { inLayer = false; corrente = null; continue; }
          if (!inLayer) continue;
          if (x.codice === 0 && x.valore === 'LAYER') { corrente = { nome: '', colore: 7, spento: false, congelato: false }; continue; }
          if (!corrente) continue;
          if (x.codice === 2) { corrente.nome = x.valore.trim(); layers[corrente.nome] = corrente; }
          else if (x.codice === 70) corrente.congelato = (Number(x.valore) & 1) === 1;
          else if (x.codice === 62) { const c = Number(x.valore); corrente.spento = c < 0; corrente.colore = Math.abs(c); }
        }
      } else if (nome === 'BLOCKS') {
        for (; i < gruppi.length && !(gruppi[i].codice === 0 && gruppi[i].valore === 'ENDSEC'); ) {
          if (gruppi[i].codice === 0 && gruppi[i].valore === 'BLOCK') {
            // intestazione del blocco fino alla prima entità o ENDBLK
            const testa: EntitaGrezza = { tipo: 'BLOCK', gruppi: [] };
            i++;
            for (; i < gruppi.length && gruppi[i].codice !== 0; i++) testa.gruppi.push(gruppi[i]);
            const r = leggiEntita(gruppi, i, 'ENDBLK');
            i = r.i;
            const nomeBlocco = val(testa, 2) ?? '';
            blocchi.set(nomeBlocco, { base: [num(testa, 10), num(testa, 20)], entita: r.entita });
          } else {
            i++;
          }
        }
      } else if (nome === 'ENTITIES') {
        const r = leggiEntita(gruppi, i, 'ENDSEC');
        grezze = r.entita;
        i = r.i;
        continue;
      }
      // salta fino a ENDSEC
      while (i < gruppi.length && !(gruppi[i].codice === 0 && gruppi[i].valore === 'ENDSEC')) i++;
      i++;
    } else {
      i++;
    }
  }

  const nonGestiti: Record<string, number> = {};
  const ctx: Contesto = { blocchi, layers, profondita: 0, nonGestiti };
  const tutte: Entita[] = [];
  for (const e of grezze) interpreta(e, null, ctx, tutte);

  const entita: Entita[] = [];
  const poligoni: Poligono[] = [];
  const grezzePoligoni: Entita[] = [];
  const altriLayer = new Set<string>();
  let suLayerNascosti = 0;
  let riquadro: Punto2[] | null = null;
  const suRiquadro: Entita[] = [];
  for (const x of tutte) {
    const ln = nomeLayerNormalizzato(x.layer);
    // i layer speciali vengono letti anche se spenti (il DOCFA_POLIGONI di solito lo è)
    if (ln === LAYER_POLIGONI) {
      grezzePoligoni.push(x);
      if (x.tipo === 'polilinea') {
        const vertici = x.punti.slice();
        const f = vertici[0], l = vertici[vertici.length - 1];
        if (vertici.length > 1 && Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) vertici.pop();
        const def = TIPO_DA_COLORE[x.colore] ?? TIPO_DA_COLORE[1];
        if (vertici.length >= 3) poligoni.push({ tipo: def.tipo, vertici, altezzaValida: def.altezzaValida });
      }
      continue;
    }
    if (ln === LAYER_RIQUADRO) {
      // sul layer RIQUADRO c'è il rettangolo del riquadro, ma molti disegnano lì anche la planimetria:
      // Docfa la stampa comunque (NCV081), quindi si tengono tutti gli oggetti e si sceglie poi il riquadro
      suRiquadro.push(x);
      continue;
    }
    const ldef = layers[x.layer];
    if (ldef && (ldef.spento || ldef.congelato)) { suLayerNascosti++; continue; }
    if (ln !== '0') altriLayer.add(x.layer);
    entita.push(x);
  }
  // riquadro: la polilinea del layer RIQUADRO con le misure di un foglio Docfa (preferibilmente con vertice in 0,0),
  // altrimenti la polilinea più grande; senza polilinee, gli estremi delle linee (riquadro fatto con 4 LINE)
  const polilinee = suRiquadro.filter((x): x is Extract<Entita, { tipo: 'polilinea' }> => x.tipo === 'polilinea' && x.punti.length >= 4);
  if (polilinee.length) {
    const info = polilinee.map((x) => {
      const b = limitiPunti(x.punti);
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      return { x, area: w * h, misura: foglioDaMisure(w, h) !== null, inZero: Math.abs(b.x0) < 1e-6 && Math.abs(b.y0) < 1e-6 };
    });
    info.sort((a, b) => Number(b.misura) - Number(a.misura) || Number(b.inZero) - Number(a.inZero) || b.area - a.area);
    const scelto = info[0].x;
    riquadro = scelto.punti.slice();
    for (const x of suRiquadro) if (x !== scelto) entita.push(x);
  } else {
    const linee = suRiquadro.filter((x): x is Extract<Entita, { tipo: 'linea' }> => x.tipo === 'linea');
    if (linee.length) {
      riquadro = linee.flatMap((x) => [x.p1, x.p2]);
      // con molte linee il riquadro è solo una parte: le linee si disegnano (quelle sul bordo coincidono col modello)
      if (linee.length > 4) entita.push(...linee);
    }
    for (const x of suRiquadro) if (x.tipo !== 'linea') entita.push(x);
  }
  return { entita, poligoni, riquadro, layers, versione, grezzePoligoni, statistiche: { suLayerNascosti, nonGestiti, altriLayer: [...altriLayer].sort() } };
}

/** Dimensioni del riquadro del disegno in centimetri sul foglio, per formato. */
export const RIQUADRO_CM: Record<'A4' | 'A3', [number, number]> = {
  A4: [19.5, 23.5],
  A3: [26, 40.5],
};

const SCALE_AMMESSE = [50, 100, 200, 500, 1000, 2000];

/** Formato e scala di Docfa che corrispondono alle misure di un riquadro (tolleranza 2%), o null. */
export function foglioDaMisure(larghezza: number, altezza: number): { formato: 'A4' | 'A3'; scala: number; errore: number } | null {
  let migliore: { formato: 'A4' | 'A3'; scala: number; errore: number } | null = null;
  for (const formato of ['A4', 'A3'] as const) {
    const [wcm, hcm] = RIQUADRO_CM[formato];
    for (const scala of SCALE_AMMESSE) {
      const w = (wcm / 100) * scala, h = (hcm / 100) * scala;
      const errore = Math.max(Math.abs(larghezza - w) / w, Math.abs(altezza - h) / h);
      if (errore < 0.02 && (!migliore || errore < migliore.errore)) migliore = { formato, scala, errore };
    }
  }
  return migliore;
}

function limitiPunti(punti: Punto2[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of punti) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

export interface FoglioRilevato extends FoglioPlanimetria {
  /** larghezza e altezza del riquadro in unità del disegno (metri) */
  larghezza: number;
  altezza: number;
  /** vertice in basso a sinistra del riquadro */
  origine: Punto2;
  /** true se il riquadro ha il vertice in (0, 0) come richiede Docfa */
  origineInZero: boolean;
}

/**
 * Deduce formato e scala dal riquadro (layer RIQUADRO): Docfa richiede un rettangolo con vertice
 * in (0,0) e dimensioni pari al riquadro del modello alla scala scelta, es. 39×47 m (A4 1:200),
 * 19,5×23,5 (A4 1:100), 97,5×117,5 (A4 1:500), 52×81 (A3 1:200).
 */
export function rilevaFoglio(dxf: DxfLetto | string): FoglioRilevato {
  const letto = typeof dxf === 'string' ? leggiDxf(dxf) : dxf;
  if (!letto.riquadro || letto.riquadro.length < 2) throw new Error('Riquadro non trovato: manca il layer RIQUADRO');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of letto.riquadro) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const larghezza = x1 - x0, altezza = y1 - y0;
  const migliore = foglioDaMisure(larghezza, altezza);
  if (!migliore) {
    throw new Error(`Riquadro di ${larghezza.toFixed(2)}×${altezza.toFixed(2)} non corrisponde a nessun formato/scala di Docfa`);
  }
  return {
    formato: migliore.formato,
    scala: migliore.scala,
    larghezza,
    altezza,
    origine: [x0, y0],
    origineInZero: Math.abs(x0) < 1e-6 && Math.abs(y0) < 1e-6,
  };
}
