/**
 * Utilità condivise dai test del modulo raster: percorsi dei campioni, confronto con Pillow,
 * scrittura di PNG (senza dipendenze native).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { Bitmap } from '../bitmap';

export const FIXTURES = join(process.cwd(), 'fixtures-private');

/**
 * Dati reali dei cartigli dei documenti di prova (tecnico, indirizzi, identificativi): stanno in
 * fixtures-private/cartigli.json, non nel repository. Senza quel file valori fittizi (i test che li usano
 * vengono comunque saltati, perché mancano anche le immagini di Docfa).
 */
export interface DatiCartigli {
  tecnico: { compilatore: string; numeroAlbo: string };
  NCV002: { via: string; civico: string; foglio: string; particella: string; subalterno: string };
  NCV065: { foglio: string; particella: string };
  NCV081: { foglio: string; particella: string; via: string; civico: string };
}
export const CARTIGLI: DatiCartigli = existsSync(join(FIXTURES, 'cartigli.json'))
  ? JSON.parse(readFileSync(join(FIXTURES, 'cartigli.json'), 'utf8'))
  : {
      tecnico: { compilatore: 'Rossi Mario', numeroAlbo: '1234' },
      NCV002: { via: 'Via Roma', civico: '1', foglio: '1', particella: '1', subalterno: '1' },
      NCV065: { foglio: '1', particella: '1' },
      NCV081: { foglio: '1', particella: '1', via: 'Via Roma', civico: '1' },
    };
/** cartella PGM di un'installazione Docfa (solo per i test locali: fuori dal repository) */
export const PGM = process.env.DOCFA_PGM ?? join(process.cwd(), 'fixtures-private', 'PGM');

export function esiste(p: string): boolean { return existsSync(p); }

export function leggi(p: string): Uint8Array { return new Uint8Array(readFileSync(p)); }

/** true se python3 con Pillow è disponibile. */
export function pillowDisponibile(): boolean {
  try {
    execFileSync('python3', ['-I', '-c', 'from PIL import Image'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Decodifica un TIFF con Pillow e restituisce i pixel come Bitmap (1 = nero).
 * Pillow restituisce l'immagine in modo "1" con 1 = bianco: viene invertita.
 */
export function decodificaConPillow(tiff: Uint8Array): Bitmap {
  const dir = mkdtempSync(join(tmpdir(), 'g4-'));
  const p = join(dir, 'in.tif');
  writeFileSync(p, tiff);
  const out = execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('1')
w, h = im.size
sys.stdout.buffer.write(w.to_bytes(4, 'little') + h.to_bytes(4, 'little') + im.tobytes())
`, p], { maxBuffer: 64 * 1024 * 1024 });
  const w = out.readUInt32LE(0), h = out.readUInt32LE(4);
  const data = new Uint8Array(out.subarray(8));
  for (let i = 0; i < data.length; i++) data[i] = ~data[i] & 0xff;
  const bm = new Bitmap(w, h, data);
  // azzera i bit di riempimento oltre la larghezza (dopo l'inversione sarebbero a 1)
  const resto = w & 7;
  if (resto) {
    const maschera = (0xff << (8 - resto)) & 0xff;
    for (let y = 0; y < h; y++) bm.data[y * bm.rowBytes + bm.rowBytes - 1] &= maschera;
  }
  return bm;
}

/** Confronta due bitmap pixel per pixel; restituisce il numero di pixel diversi. */
export function pixelDiversi(a: Bitmap, b: Bitmap): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error('dimensioni diverse');
  let n = 0;
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) if (a.getPixel(x, y) !== b.getPixel(x, y)) n++;
  return n;
}

/** Intersezione su unione dei pixel neri di due bitmap. */
export function iou(a: Bitmap, b: Bitmap): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i], y = b.data[i];
    inter += popcount(x & y);
    uni += popcount(x | y);
  }
  return uni ? inter / uni : 1;
}

function popcount(v: number): number {
  let c = 0;
  while (v) { v &= v - 1; c++; }
  return c;
}

/** Scrive un PNG RGB (senza compressione sofisticata) dai tre canali forniti come funzione per pixel. */
export function scriviPng(path: string, width: number, height: number, colore: (x: number, y: number) => [number, number, number]): void {
  const raw = new Uint8Array(height * (width * 3 + 1));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filtro "none"
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colore(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  const chunk = (tipo: string, dati: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + dati.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, dati.length);
    for (let i = 0; i < 4; i++) out[4 + i] = tipo.charCodeAt(i);
    out.set(dati, 8);
    dv.setUint32(8 + dati.length, crc32(out.subarray(4, 8 + dati.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parti = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const tot = parti.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(tot);
  let o = 0;
  for (const x of parti) { out.set(x, o); o += x.length; }
  writeFileSync(path, out);
}

let tabellaCrc: Uint32Array | null = null;
function crc32(d: Uint8Array): number {
  if (!tabellaCrc) {
    tabellaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabellaCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = tabellaCrc[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
