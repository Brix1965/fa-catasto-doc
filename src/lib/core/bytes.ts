/**
 * Utilità per i file a lunghezza fissa di Docfa.
 *
 * Docfa è un programma COBOL per Windows: i file sono testo in codepage
 * Windows-1252, con record a lunghezza fissa. Alcune posizioni "riservate"
 * contengono il byte 0xFF (HIGH-VALUES in COBOL), che in Windows-1252 è "ÿ".
 * Lavoriamo quindi sempre a livello di byte, mai di stringhe Unicode, per
 * riprodurre i file dell'originale byte per byte.
 */

const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const CP1252_HIGH_REV: Record<number, number> = Object.fromEntries(
  Object.entries(CP1252_HIGH).map(([u, b]) => [b, Number(u)]),
);

/** Codifica una stringa JS in Windows-1252. I caratteri non rappresentabili diventano "?". */
export function encode1252(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out[i] = c;
    else if (CP1252_HIGH[c] !== undefined) out[i] = CP1252_HIGH[c];
    else out[i] = 0x3f;
  }
  return out;
}

/** Decodifica Windows-1252 → stringa JS (0xFF resta "ÿ", U+00FF). */
export function decode1252(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c >= 0x80 && c <= 0x9f) s += String.fromCharCode(CP1252_HIGH_REV[c] ?? 0xfffd);
    else s += String.fromCharCode(c);
  }
  return s;
}

export const CR = 0x0d;
export const LF = 0x0a;
export const HIGH = 0xff;

export function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Prima differenza fra due buffer, utile nei test e nel confronto con i file originali. */
export function firstDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/** Divide un file in record separati da CRLF (ultimo record può non avere terminatore). */
export function splitCRLF(data: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === CR && data[i + 1] === LF) {
      out.push(data.subarray(start, i));
      start = i + 2;
      i++;
    }
  }
  if (start < data.length) out.push(data.subarray(start));
  return out;
}

export function joinCRLF(records: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const r of records) parts.push(r, new Uint8Array([CR, LF]));
  return concat(parts);
}
