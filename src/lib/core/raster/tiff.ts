/**
 * Scrittura e lettura (minimale) di TIFF bilivello compressi CCITT G4, nel formato che Docfa
 * produce per le planimetrie (file nnnnnnn.sss) e che usa per i modelli (A4.mod, A3.mod...).
 *
 * Scrittura: little-endian, una sola strip, i tag del file originale di Docfa (ImageGear).
 * Lettura: solo quanto serve per i .mod e per i file di Docfa (una o più strip G4, 1 bit/pixel).
 */
import { Bitmap } from './bitmap';
import { codificaG4, decodificaG4 } from './g4';

export interface OpzioniTiff {
  /** data/ora da scrivere nel tag DateTime (default: adesso) */
  data?: Date;
  /** valore del tag Software */
  software?: string;
  /** risoluzione in dpi (default 200) */
  dpi?: number;
}

const TAG = {
  NewSubfileType: 254, ImageWidth: 256, ImageLength: 257, BitsPerSample: 258, Compression: 259,
  Photometric: 262, FillOrder: 266, StripOffsets: 273, Orientation: 274, SamplesPerPixel: 277,
  RowsPerStrip: 278, StripByteCounts: 279, XResolution: 282, YResolution: 283, PlanarConfig: 284,
  ResolutionUnit: 296, PageNumber: 297, Software: 305, DateTime: 306,
} as const;

const TIPO = { SHORT: 3, LONG: 4, RATIONAL: 5, ASCII: 2 } as const;

interface Voce { tag: number; tipo: number; count: number; /** valore inline (SHORT/LONG) oppure dati esterni */ valore?: number; dati?: Uint8Array }

/** Formatta la data come richiede il TIFF: "YYYY:MM:DD HH:MM:SS" (ora locale). */
export function dataTiff(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Scrive un TIFF G4 a strip unica dalla bitmap. Se `g4` è già disponibile (stesso contenuto
 * della bitmap) viene riusato senza ricodificare.
 */
export function scriviTiffG4(bm: Bitmap, opzioni: OpzioniTiff = {}, g4?: Uint8Array): Uint8Array {
  const strip = g4 ?? codificaG4(bm);
  const dpi = opzioni.dpi ?? 200;
  const software = opzioni.software ?? 'Fa.Catasto.Doc';
  const data = dataTiff(opzioni.data ?? new Date());
  const ascii = (s: string): Uint8Array => {
    const b = new Uint8Array(s.length + 1);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0x7f;
    return b;
  };
  const rational = (n: number): Uint8Array => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setUint32(0, n, true);
    new DataView(b.buffer).setUint32(4, 1, true);
    return b;
  };
  const shorts = (vals: number[]): Uint8Array => {
    const b = new Uint8Array(vals.length * 2);
    const dv = new DataView(b.buffer);
    vals.forEach((v, i) => dv.setUint16(i * 2, v, true));
    return b;
  };

  // Layout: header (8) + strip + IFD + dati esterni. L'offset della strip è quindi 8.
  const stripOffset = 8;
  const voci: Voce[] = [
    { tag: TAG.NewSubfileType, tipo: TIPO.LONG, count: 1, valore: 2 },
    { tag: TAG.ImageWidth, tipo: TIPO.LONG, count: 1, valore: bm.width },
    { tag: TAG.ImageLength, tipo: TIPO.LONG, count: 1, valore: bm.height },
    { tag: TAG.BitsPerSample, tipo: TIPO.SHORT, count: 1, valore: 1 },
    { tag: TAG.Compression, tipo: TIPO.SHORT, count: 1, valore: 4 },
    { tag: TAG.Photometric, tipo: TIPO.SHORT, count: 1, valore: 0 },
    { tag: TAG.FillOrder, tipo: TIPO.SHORT, count: 1, valore: 1 },
    { tag: TAG.StripOffsets, tipo: TIPO.LONG, count: 1, valore: stripOffset },
    { tag: TAG.Orientation, tipo: TIPO.SHORT, count: 1, valore: 1 },
    { tag: TAG.SamplesPerPixel, tipo: TIPO.SHORT, count: 1, valore: 1 },
    { tag: TAG.RowsPerStrip, tipo: TIPO.LONG, count: 1, valore: bm.height },
    { tag: TAG.StripByteCounts, tipo: TIPO.LONG, count: 1, valore: strip.length },
    { tag: TAG.XResolution, tipo: TIPO.RATIONAL, count: 1, dati: rational(dpi) },
    { tag: TAG.YResolution, tipo: TIPO.RATIONAL, count: 1, dati: rational(dpi) },
    { tag: TAG.PlanarConfig, tipo: TIPO.SHORT, count: 1, valore: 1 },
    { tag: TAG.ResolutionUnit, tipo: TIPO.SHORT, count: 1, valore: 2 },
    { tag: TAG.PageNumber, tipo: TIPO.SHORT, count: 2, dati: shorts([0, 1]) },
    { tag: TAG.Software, tipo: TIPO.ASCII, count: software.length + 1, dati: ascii(software) },
    { tag: TAG.DateTime, tipo: TIPO.ASCII, count: data.length + 1, dati: ascii(data) },
  ];

  // l'IFD inizia su offset pari (requisito TIFF)
  let ifdOffset = stripOffset + strip.length;
  if (ifdOffset & 1) ifdOffset++;
  const ifdLen = 2 + voci.length * 12 + 4;
  let esternoOffset = ifdOffset + ifdLen;
  // assegna gli offset dei dati esterni (più lunghi di 4 byte)
  const esterni: { voce: Voce; offset: number }[] = [];
  for (const v of voci) {
    if (v.dati && v.dati.length > 4) {
      if (esternoOffset & 1) esternoOffset++;
      esterni.push({ voce: v, offset: esternoOffset });
      esternoOffset += v.dati.length;
    }
  }
  const out = new Uint8Array(esternoOffset);
  const dv = new DataView(out.buffer);
  // header: "II", 42, offset primo IFD
  out[0] = 0x49; out[1] = 0x49;
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);
  out.set(strip, stripOffset);
  dv.setUint16(ifdOffset, voci.length, true);
  let p = ifdOffset + 2;
  for (const v of voci) {
    dv.setUint16(p, v.tag, true);
    dv.setUint16(p + 2, v.tipo, true);
    dv.setUint32(p + 4, v.count, true);
    if (v.dati) {
      if (v.dati.length > 4) {
        const e = esterni.find((x) => x.voce === v);
        if (!e) throw new Error('offset dati esterni mancante');
        dv.setUint32(p + 8, e.offset, true);
        out.set(v.dati, e.offset);
      } else {
        out.set(v.dati, p + 8); // dati brevi inline, allineati a sinistra
      }
    } else if (v.tipo === TIPO.SHORT) {
      dv.setUint16(p + 8, v.valore ?? 0, true);
    } else {
      dv.setUint32(p + 8, v.valore ?? 0, true);
    }
    p += 12;
  }
  dv.setUint32(p, 0, true); // nessun altro IFD
  return out;
}

export interface TiffLetto {
  width: number;
  height: number;
  compression: number;
  photometric: number;
  fillOrder: number;
  /** strip concatenate (per G4 a strip unica è lo stream puro) */
  strips: Uint8Array[];
  rowsPerStrip: number;
  /** tag ASCII letti (Software, DateTime...) */
  testi: Record<number, string>;
  bitmap: Bitmap;
}

/**
 * Legge un TIFF bilivello (1 bit/pixel, compressione 4 = G4 oppure 1 = nessuna). Gestisce
 * entrambi gli ordini di byte e più strip; non gestisce FillOrder 2 né altre compressioni.
 */
export function leggiTiff(dati: Uint8Array): TiffLetto {
  const dv = new DataView(dati.buffer, dati.byteOffset, dati.byteLength);
  const le = dati[0] === 0x49 && dati[1] === 0x49;
  if (!le && !(dati[0] === 0x4d && dati[1] === 0x4d)) throw new Error('Non è un file TIFF');
  if (dv.getUint16(2, le) !== 42) throw new Error('Non è un file TIFF');
  const ifd = dv.getUint32(4, le);
  const n = dv.getUint16(ifd, le);
  const dimTipo: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8 };
  const tags = new Map<number, number[]>();
  const testi: Record<number, string> = {};
  for (let i = 0; i < n; i++) {
    const p = ifd + 2 + i * 12;
    const tag = dv.getUint16(p, le);
    const tipo = dv.getUint16(p + 2, le);
    const count = dv.getUint32(p + 4, le);
    const dim = (dimTipo[tipo] ?? 1) * count;
    const off = dim <= 4 ? p + 8 : dv.getUint32(p + 8, le);
    if (tipo === TIPO.ASCII) {
      let s = '';
      for (let k = 0; k < count && dati[off + k]; k++) s += String.fromCharCode(dati[off + k]);
      testi[tag] = s;
      continue;
    }
    const vals: number[] = [];
    for (let k = 0; k < count; k++) {
      if (tipo === TIPO.SHORT) vals.push(dv.getUint16(off + k * 2, le));
      else if (tipo === TIPO.LONG) vals.push(dv.getUint32(off + k * 4, le));
      else if (tipo === TIPO.RATIONAL) vals.push(dv.getUint32(off + k * 8, le) / (dv.getUint32(off + k * 8 + 4, le) || 1));
      else if (tipo === 1 || tipo === 7) vals.push(dati[off + k]);
    }
    tags.set(tag, vals);
  }
  const uno = (tag: number, def: number): number => tags.get(tag)?.[0] ?? def;
  const width = uno(TAG.ImageWidth, 0);
  const height = uno(TAG.ImageLength, 0);
  const compression = uno(TAG.Compression, 1);
  const photometric = uno(TAG.Photometric, 0);
  const fillOrder = uno(TAG.FillOrder, 1);
  const bits = uno(TAG.BitsPerSample, 1);
  if (bits !== 1) throw new Error(`TIFF a ${bits} bit/pixel non supportato`);
  if (fillOrder !== 1) throw new Error('TIFF con FillOrder 2 non supportato');
  const offsets = tags.get(TAG.StripOffsets) ?? [];
  const counts = tags.get(TAG.StripByteCounts) ?? [];
  const rowsPerStrip = uno(TAG.RowsPerStrip, height);
  const strips = offsets.map((o, i) => dati.subarray(o, o + (counts[i] ?? dati.length - o)));
  const bitmap = new Bitmap(width, height);
  let y0 = 0;
  for (const s of strips) {
    const righe = Math.min(rowsPerStrip, height - y0);
    if (righe <= 0) break;
    if (compression === 4) {
      const parte = decodificaG4(s, width, righe);
      bitmap.data.set(parte.data, y0 * bitmap.rowBytes);
    } else if (compression === 1) {
      bitmap.data.set(s.subarray(0, righe * bitmap.rowBytes), y0 * bitmap.rowBytes);
    } else {
      throw new Error(`Compressione TIFF ${compression} non supportata`);
    }
    y0 += righe;
  }
  // Photometric 1 (BlackIsZero): nel file 1 = bianco, invertiamo per avere 1 = nero
  if (photometric === 1) for (let i = 0; i < bitmap.data.length; i++) bitmap.data[i] = ~bitmap.data[i] & 0xff;
  return { width, height, compression, photometric, fillOrder, strips, rowsPerStrip, testi, bitmap };
}
