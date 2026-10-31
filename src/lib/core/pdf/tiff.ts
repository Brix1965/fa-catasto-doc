/**
 * Lettura dei TIFF delle planimetrie (una sola strip compressa CCITT G4, come li produce Docfa e
 * come richiede l'Agenzia) per incorporarli nel PDF senza ricodificarli: lo stream /CCITTFaxDecode
 * del PDF è esattamente la strip del TIFF.
 */
import type { ImmagineDocumento } from './documento';

export interface DatiTiffG4 {
  g4: Uint8Array;
  width: number;
  height: number;
}

/** Estrae la strip G4 da un TIFF bitonale a strip singola (compressione 4). */
export function g4DaTiff(tiff: Uint8Array): DatiTiffG4 {
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) throw new Error('Non è un file TIFF');
  const u16 = (o: number) => dv.getUint16(o, little);
  const u32 = (o: number) => dv.getUint32(o, little);
  if (u16(2) !== 42) throw new Error('Non è un file TIFF (magic 42 assente)');
  const ifd = u32(4);
  const n = u16(ifd);
  const tag: Record<number, number[]> = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const id = u16(e);
    const tipo = u16(e + 2);
    const count = u32(e + 4);
    const dim = tipo === 3 ? 2 : tipo === 4 ? 4 : 1;
    const inline = count * dim <= 4;
    const base = inline ? e + 8 : u32(e + 8);
    const valori: number[] = [];
    for (let k = 0; k < Math.min(count, 64); k++) {
      const o = base + k * dim;
      valori.push(tipo === 3 ? u16(o) : tipo === 4 ? u32(o) : tiff[o]);
    }
    tag[id] = valori;
  }
  const width = tag[256]?.[0];
  const height = tag[257]?.[0];
  const compressione = tag[259]?.[0];
  const offsets = tag[273];
  const counts = tag[279];
  if (!width || !height || !offsets || !counts) throw new Error('TIFF senza dimensioni o strip');
  if (compressione !== 4) throw new Error(`TIFF con compressione ${compressione}: serve CCITT G4 (4)`);
  if (offsets.length !== 1) throw new Error(`TIFF con ${offsets.length} strip: serve una strip sola`);
  if ((tag[258]?.[0] ?? 1) !== 1) throw new Error('TIFF non bitonale');
  return { g4: tiff.slice(offsets[0], offsets[0] + counts[0]), width, height };
}

/** Prepara una planimetria TIFF per renderDocumento; il formato si deduce dalla larghezza (A4 = 1654 px a 200 dpi). */
export function immagineDaTiff(nome: string, tiff: Uint8Array, ntf?: { dati: Uint8Array; nome: string }): ImmagineDocumento {
  const d = g4DaTiff(tiff);
  return { nome, g4: d.g4, width: d.width, height: d.height, ntf: ntf?.dati, nomeNtf: ntf?.nome, formato: d.width > 2000 ? 'A3' : 'A4' };
}
