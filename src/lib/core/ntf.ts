/**
 * Poligoni delle planimetrie nel formato "NTF" di Docfa (file Nnnnnnnn.sss, un record da 80 byte
 * terminato da CR). Ricavato dal tracciato "DettaglioPoligoniNTF" e dai file reali.
 *
 * Coordinate: decimi di millimetro sul foglio, origine nell'angolo in basso a sinistra del
 * riquadro disegnato nel modello TIFF (A4.mod / A3.mod), asse Y verso l'alto.
 * Un metro reale alla scala 1:s vale 10000/s unità (1:200 → 50 unità).
 */
import { encode1252, decode1252 } from './bytes';
import type { Poligono, TipoAmbientePoligono } from './model';

export interface FoglioPlanimetria {
  formato: 'A4' | 'A3';
  scala: number;
}

/** Posizione (in pixel a 200 dpi) dell'origine del riquadro nei modelli TIFF dell'Agenzia e dimensioni del foglio in cm. */
export const FOGLI: Record<'A4' | 'A3', { originePx: [number, number]; origineImmaginePx: [number, number]; larghezzaPx: number; altezzaPx: number; cm: [number, number] }> = {
  // A4.mod: riquadro interno x 10..1541, y 375..2221 (pixel, origine in alto a sinistra); Docfa usa x0 ≈ 7,2 px, y0 = 2221
  // (verificato su NCV002 sia per il file NTF sia per l'immagine)
  A4: { originePx: [7.2, 2221], origineImmaginePx: [7.2, 2221], larghezzaPx: 1654, altezzaPx: 2340, cm: [21, 30] },
  // A3.mod: riquadro interno x 239..2282, y 77..3238. Misurato su NCV081 (13 schede A3 con i DXF originali):
  // nell'immagine il riquadro (40,5 cm = 3189 px) parte dal bordo alto, quindi lo zero del DXF cade a y 3262,7
  // e gli ultimi 25 px escono dal riquadro del modello; nel file NTF lo zero è a y 3251,5 (347 vertici, scarto medio < 0,5 unità)
  A3: { originePx: [236.45, 3251.5], origineImmaginePx: [236.45, 3262.7], larghezzaPx: 2340, altezzaPx: 3310, cm: [30, 42] },
};

const DPI = 200;
const UNITA_PER_PX = (25.4 / DPI) * 10; // decimi di mm per pixel → 1,27

/** Converte un punto del DXF (metri) in coordinate NTF intere. */
export function dxfToNtf(x: number, y: number, foglio: FoglioPlanimetria): [number, number] {
  const f = FOGLI[foglio.formato];
  const pxPerM = (1000 / foglio.scala) * (DPI / 25.4);
  const px = f.originePx[0] + x * pxPerM;
  const pyFromBottom = f.altezzaPx - f.originePx[1] + y * pxPerM;
  return [Math.round(px * UNITA_PER_PX), Math.round(pyFromBottom * UNITA_PER_PX)];
}

/** Converte un punto del DXF (metri) in pixel dell'immagine TIFF (origine in alto a sinistra). */
export function dxfToPx(x: number, y: number, foglio: FoglioPlanimetria): [number, number] {
  const f = FOGLI[foglio.formato];
  const pxPerM = (1000 / foglio.scala) * (DPI / 25.4);
  return [f.origineImmaginePx[0] + x * pxPerM, f.origineImmaginePx[1] - y * pxPerM];
}

function n(v: number, len: number): string {
  return String(Math.max(0, Math.round(v))).padStart(len, '0');
}

function riga(s: string, flagContinuazione: 0 | 1): string {
  return s.padEnd(78, ' ').slice(0, 78) + String(flagContinuazione) + '\r';
}

/** Area (m²) di un poligono con la formula di Gauss, dalle coordinate NTF (1 unità = 0,1 mm → scala/10000 m). */
export function areaDaNtf(punti: [number, number][], scala: number): number {
  let a = 0;
  for (let i = 0; i < punti.length; i++) {
    const [x1, y1] = punti[i];
    const [x2, y2] = punti[(i + 1) % punti.length];
    a += x1 * y2 - x2 * y1;
  }
  const mPerUnita = scala / 10000;
  return Math.abs(a) / 2 * mPerUnita * mPerUnita;
}

export function altezzaNtf(tipo: TipoAmbientePoligono, altezzaValida: boolean): string {
  if (tipo === 'A' || tipo === 'B' || tipo === 'C' || tipo === 'H') return altezzaValida ? '150' : '149';
  return '000';
}

/**
 * Genera il file NTF di una scheda di planimetria.
 * @param progressivo numero immagine (7 cifre), @param scheda numero scheda (1..)
 */
export function generaNtf(progressivo: number, scheda: number, foglio: FoglioPlanimetria, poligoni: Poligono[]): Uint8Array {
  const f = FOGLI[foglio.formato];
  const out: string[] = [];
  out.push(riga(`07${n(progressivo, 7)}${n(scheda, 3)}21000062${n(10, 10)}`, 1));
  out.push(riga(`00${n(0, 10)}${n(f.cm[0], 10)}${n(0, 10)}${n(f.cm[1], 10)}`, 1));
  out.push(riga('00', 0));
  poligoni.forEach((p, i) => {
    const k = i + 1;
    const pts = p.vertici.map(([x, y]) => dxfToNtf(x, y, foglio));
    // chiusura esplicita: l'ultimo vertice ripete il primo
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
    const area = areaDaNtf(pts.slice(0, -1), foglio.scala);
    out.push(riga(`23${n(k, 6)}`, 0));
    // geometria 2 = spezzata, 5 vertici per riga
    const celle = pts.map(([x, y]) => `${n(x, 6)}${n(y, 6)} `);
    const righe: string[][] = [];
    for (let j = 0; j < celle.length; j += 5) righe.push(celle.slice(j, j + 5));
    righe.forEach((r, j) => {
      while (r.length < 5) r.push(`${n(0, 6)}${n(0, 6)} `);
      const ultimo = j === righe.length - 1;
      const prefix = j === 0 ? `21${n(k, 6)}2${n(pts.length, 4)}` : '00';
      out.push(riga(prefix + r.join(''), ultimo ? 0 : 1));
    });
    out.push(riga(`14${n(k, 6)}LNR`, 0));
    out.push(riga(`15${n(k, 6)}`, 0));
    out.push(riga(`21${n(k, 6)}1${n(1, 4)}${`${n(0, 6)}${n(0, 6)} `.repeat(5)}`, 0));
    const cent = n(area * 100, 7);
    out.push(riga(`14${n(k, 6)}AR${p.tipo} 0${n(0, 7)}${cent}${n(0, 10)}${n(foglio.scala, 3)}${cent}${altezzaNtf(p.tipo, p.altezzaValida)}`, 0));
  });
  return encode1252(out.join(''));
}

export interface PoligonoNtf {
  tipo: TipoAmbientePoligono;
  /** vertici in unità NTF (senza il vertice di chiusura) */
  punti: [number, number][];
  areaCent: number;
  altezza: string;
}

/** Legge un file NTF (per importare documenti esistenti e per i test). */
export function leggiNtf(data: Uint8Array): { progressivo: number; scheda: number; cm: [number, number]; poligoni: PoligonoNtf[] } {
  const righe = decode1252(data).split('\r').filter((r) => r.length);
  const testata = righe[0];
  const cont = righe[1];
  const poligoni: PoligonoNtf[] = [];
  let corrente: PoligonoNtf | null = null;
  let inSpezzata = false;
  for (const r of righe.slice(3)) {
    const tipo = r.slice(0, 2);
    if (tipo === '23') { corrente = { tipo: 'A', punti: [], areaCent: 0, altezza: '150' }; poligoni.push(corrente); inSpezzata = true; }
    else if (tipo === '21' && corrente && inSpezzata && r.charAt(8) === '2') leggiVertici(r.slice(13), corrente.punti);
    else if (tipo === '00' && corrente && inSpezzata) leggiVertici(r.slice(2), corrente.punti);
    else if (tipo === '15') inSpezzata = false;
    else if (tipo === '14' && r.slice(8, 10) === 'AR' && corrente) {
      corrente.tipo = r.charAt(10) as TipoAmbientePoligono;
      corrente.areaCent = Number(r.slice(20, 27));
      corrente.altezza = r.slice(47, 50);
    }
  }
  for (const p of poligoni) {
    const f = p.punti[0], l = p.punti[p.punti.length - 1];
    if (p.punti.length > 1 && f[0] === l[0] && f[1] === l[1]) p.punti.pop();
  }
  return { progressivo: Number(testata.slice(2, 9)), scheda: Number(testata.slice(9, 12)), cm: [Number(cont.slice(12, 22)), Number(cont.slice(32, 42))], poligoni };
}

function leggiVertici(s: string, out: [number, number][]): void {
  for (let k = 0; k < 5; k++) {
    const cella = s.slice(k * 13, k * 13 + 12);
    if (cella.length < 12 || !cella.trim()) continue;
    const x = Number(cella.slice(0, 6)), y = Number(cella.slice(6, 12));
    if (x === 0 && y === 0) continue;
    out.push([x, y]);
  }
}
