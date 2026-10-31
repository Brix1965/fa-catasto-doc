/**
 * Lettura minimale di un font TrueType per ricavare i dati richiesti dal PDF
 * (FontDescriptor e Widths con codifica WinAnsi): tabelle head, hhea, maxp, OS/2, post, cmap, hmtx.
 * Il programma font viene incorporato così com'è (FontFile2).
 */

export interface MetricheFont {
  /** nome PostScript (tabella name, id 6) o nome di ripiego */
  nomePostScript: string;
  unitsPerEm: number;
  /** [xMin, yMin, xMax, yMax] in millesimi di em */
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  italicAngle: number;
  stemV: number;
  weight: number;
  /** larghezze (millesimi di em) dei codici WinAnsi 32..255, 224 valori */
  widths: number[];
}

interface Tabella { offset: number; length: number }

/** Corrispondenza fra i codici 0x80-0x9F di Windows-1252 e Unicode (gli altri coincidono con Latin-1). */
const CP1252_ALTI: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** Unicode del codice WinAnsi `c` (il PDF usa WinAnsiEncoding, che coincide con Windows-1252 salvo i codici non definiti). */
export function unicodeWinAnsi(c: number): number {
  if (c >= 0x80 && c <= 0x9f) return CP1252_ALTI[c] ?? 0x2022; // i codici non definiti sono "bullet" in WinAnsi
  if (c === 0xa0) return 0x20; // in WinAnsiEncoding 240 è "space"
  if (c === 0xad) return 0x2d; // 255 (soft hyphen) è "hyphen"
  return c;
}

export function leggiTrueType(dati: Uint8Array): MetricheFont {
  const dv = new DataView(dati.buffer, dati.byteOffset, dati.byteLength);
  const numTables = dv.getUint16(4);
  const tabelle = new Map<string, Tabella>();
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(dati[o], dati[o + 1], dati[o + 2], dati[o + 3]);
    tabelle.set(tag, { offset: dv.getUint32(o + 8), length: dv.getUint32(o + 12) });
  }
  const t = (nome: string): Tabella => {
    const tb = tabelle.get(nome);
    if (!tb) throw new Error(`Font TrueType senza tabella ${nome}`);
    return tb;
  };

  // head: unitsPerEm (18), bbox (36..42)
  const head = t('head');
  const unitsPerEm = dv.getUint16(head.offset + 18);
  const scala = (v: number) => Math.round((v * 1000) / unitsPerEm);
  const bbox: [number, number, number, number] = [
    scala(dv.getInt16(head.offset + 36)), scala(dv.getInt16(head.offset + 38)),
    scala(dv.getInt16(head.offset + 40)), scala(dv.getInt16(head.offset + 42)),
  ];

  // hhea: ascender (4), descender (6), numberOfHMetrics (34)
  const hhea = t('hhea');
  const ascent = scala(dv.getInt16(hhea.offset + 4));
  const descent = scala(dv.getInt16(hhea.offset + 6));
  const numHMetrics = dv.getUint16(hhea.offset + 34);

  // OS/2: usWeightClass (4), sxHeight (86), sCapHeight (88) se versione >= 2
  let weight = 400;
  let capHeight = 0;
  let xHeight = 0;
  const os2 = tabelle.get('OS/2');
  if (os2) {
    const versione = dv.getUint16(os2.offset);
    weight = dv.getUint16(os2.offset + 4);
    if (versione >= 2 && os2.length >= 90) {
      xHeight = scala(dv.getInt16(os2.offset + 86));
      capHeight = scala(dv.getInt16(os2.offset + 88));
    }
  }

  // post: italicAngle (4, Fixed 16.16)
  let italicAngle = 0;
  const post = tabelle.get('post');
  if (post) italicAngle = dv.getInt32(post.offset + 4) / 65536;

  // name: nome PostScript (nameID 6), piattaforma Windows (3) o Macintosh (1)
  let nomePostScript = '';
  const name = tabelle.get('name');
  if (name) {
    const count = dv.getUint16(name.offset + 2);
    const stringOffset = dv.getUint16(name.offset + 4);
    for (let i = 0; i < count; i++) {
      const r = name.offset + 6 + i * 12;
      const platform = dv.getUint16(r);
      const nameId = dv.getUint16(r + 6);
      if (nameId !== 6) continue;
      const len = dv.getUint16(r + 8);
      const off = name.offset + stringOffset + dv.getUint16(r + 10);
      if (platform === 3) {
        let s = '';
        for (let k = 0; k < len; k += 2) s += String.fromCharCode(dv.getUint16(off + k));
        nomePostScript = s;
        break;
      }
      if (platform === 1 && !nomePostScript) {
        let s = '';
        for (let k = 0; k < len; k++) s += String.fromCharCode(dati[off + k]);
        nomePostScript = s;
      }
    }
  }

  // cmap: sottotabella (3,1) formato 4, oppure (0,x) formato 4
  const cmap = t('cmap');
  const nSub = dv.getUint16(cmap.offset + 2);
  let subOffset = -1;
  let subFallback = -1;
  for (let i = 0; i < nSub; i++) {
    const r = cmap.offset + 4 + i * 8;
    const platform = dv.getUint16(r);
    const encoding = dv.getUint16(r + 2);
    const off = dv.getUint32(r + 4);
    if (platform === 3 && encoding === 1) subOffset = cmap.offset + off;
    else if (platform === 0 && subFallback < 0) subFallback = cmap.offset + off;
  }
  if (subOffset < 0) subOffset = subFallback;
  if (subOffset < 0) throw new Error('Font TrueType senza cmap Unicode (3,1)');
  const glifoDi = creaCmapFormato4(dv, subOffset);

  // hmtx: advance width per glifo
  const hmtx = t('hmtx');
  const larghezzaGlifo = (g: number): number => {
    const i = Math.min(g, numHMetrics - 1);
    return dv.getUint16(hmtx.offset + i * 4);
  };
  const widths: number[] = [];
  for (let c = 32; c <= 255; c++) {
    const g = glifoDi(unicodeWinAnsi(c));
    widths.push(scala(larghezzaGlifo(g)));
  }
  if (!capHeight) capHeight = scala(Math.round(unitsPerEm * 0.66));
  const stemV = Math.round(50 + Math.pow(weight / 65, 2));
  return { nomePostScript, unitsPerEm, bbox, ascent, descent, capHeight, xHeight, italicAngle, stemV, weight, widths };
}

/** Restituisce una funzione unicode → indice glifo per una sottotabella cmap di formato 4. */
function creaCmapFormato4(dv: DataView, off: number): (u: number) => number {
  const formato = dv.getUint16(off);
  if (formato !== 4) throw new Error(`cmap formato ${formato} non supportato (serve il formato 4)`);
  const segCountX2 = dv.getUint16(off + 6);
  const segCount = segCountX2 / 2;
  const endOff = off + 14;
  const startOff = endOff + segCountX2 + 2;
  const deltaOff = startOff + segCountX2;
  const rangeOff = deltaOff + segCountX2;
  return (u: number): number => {
    for (let s = 0; s < segCount; s++) {
      const end = dv.getUint16(endOff + s * 2);
      if (u > end) continue;
      const start = dv.getUint16(startOff + s * 2);
      if (u < start) return 0;
      const delta = dv.getInt16(deltaOff + s * 2);
      const rangeOffset = dv.getUint16(rangeOff + s * 2);
      if (rangeOffset === 0) return (u + delta) & 0xffff;
      const gi = rangeOff + s * 2 + rangeOffset + (u - start) * 2;
      const g = dv.getUint16(gi);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
}
