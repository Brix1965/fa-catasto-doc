/**
 * Costruttore del content stream di una pagina: testo (Times/Liberation Serif regolare "R" e
 * grassetto "B"), righe, caselle di spunta e immagini, con le stesse primitive usate da Docfa
 * (tratto 1 pt per i bordi, hairline 0 per le righe sottili, caselle da 3 mm con ombra).
 */
import { encode1252 } from '../bytes';

export type Font = 'R' | 'B';

/** Nomi delle risorse font nelle pagine generate. */
export const NOME_FONT: Record<Font, string> = { R: 'F0', B: 'F1' };

/** 1 mm in punti tipografici. */
export const MM = 72 / 25.4;

/** Lato delle caselle di spunta (3 mm). */
export const LATO_CASELLA = 8.504;

function n(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(3).replace(/\.?0+$/, '');
}

function escapeTesto(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (ch === '\r') out += '\\r';
    else if (ch === '\n') out += '\\n';
    else out += ch;
  }
  return out;
}

export class Pagina {
  private ops: string[] = [];
  readonly larghezza: number;
  readonly altezza: number;
  private xobjectUsati = new Set<string>();

  constructor(larghezza: number, altezza: number) {
    this.larghezza = larghezza;
    this.altezza = altezza;
  }

  /** Testo con origine alla linea di base (x, y) in punti. */
  testo(x: number, y: number, font: Font, dimensione: number, s: string): void {
    if (s === '') return;
    this.ops.push(`BT\n/${NOME_FONT[font]} ${n(dimensione)} Tf\n${n(x)} ${n(y)} Td\n(${escapeTesto(s)}) Tj\nET`);
  }

  /** Segmento con spessore `w` (0 = hairline). */
  linea(x1: number, y1: number, x2: number, y2: number, w = 1): void {
    this.ops.push(`${n(w)} w\n${n(x1)} ${n(y1)} m\n${n(x2)} ${n(y2)} l\nS`);
  }

  /** Rettangolo (bordo) con angolo in basso a sinistra (x, y). */
  rettangolo(x: number, y: number, larghezza: number, altezza: number, w = 1): void {
    this.ops.push(`${n(w)} w\n${n(x)} ${n(y)} ${n(larghezza)} ${n(altezza)} re\nS`);
  }

  /** Casella di spunta come la disegna Docfa: quadrato hairline con ombra (tratto 1) in basso a destra. */
  casella(x: number, y: number): void {
    const l = LATO_CASELLA;
    this.rettangolo(x, y, l, l, 0);
    this.linea(x + 0.85, y - 0.85, x + l + 0.85, y - 0.85, 1);
    this.linea(x + l + 0.85, y - 0.85, x + l + 0.85, y + l - 0.85, 1);
  }

  /** "X" nella casella con angolo in basso a sinistra (x, y). */
  spunta(x: number, y: number): void {
    this.testo(x + 0.567, y + 1.417, 'B', 9, 'X');
  }

  /** Immagine XObject che riempie l'area (larghezza × altezza) a partire da (x, y). */
  immagine(nome: string, x: number, y: number, larghezza: number, altezza: number): void {
    this.xobjectUsati.add(nome);
    this.ops.push(`q\n${n(larghezza)} 0 0 ${n(altezza)} ${n(x)} ${n(y)} cm\n/${nome} Do\nQ`);
  }

  get xobject(): string[] {
    return [...this.xobjectUsati];
  }

  /** Content stream codificato (Windows-1252: coincide con WinAnsiEncoding per i caratteri usati). */
  bytes(): Uint8Array {
    return encode1252(this.ops.join('\n') + '\n');
  }
}
