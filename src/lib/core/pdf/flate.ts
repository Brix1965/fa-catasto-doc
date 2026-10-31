/**
 * Compressione zlib/deflate per gli stream PDF (filtro /FlateDecode), senza dipendenze.
 *
 * Usa l'API standard `CompressionStream('deflate')` (Node 18+, Chromium, WebKit e quindi il webview
 * di Tauri). Dove non è disponibile ricade su uno stream zlib con blocchi "stored" (non compressi ma
 * formalmente validi), così il PDF resta corretto anche se più grande.
 */

/** Comprime `dati` in formato zlib (RFC 1950). */
export async function comprimiFlate(dati: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate');
      const writer = cs.writable.getWriter();
      // copia su un ArrayBuffer "puro" (il tipo BufferSource non accetta SharedArrayBuffer)
      const copia = new Uint8Array(new ArrayBuffer(dati.length));
      copia.set(dati);
      void writer.write(copia);
      void writer.close();
      return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    } catch {
      // fallback sotto
    }
  }
  return zlibStored(dati);
}

/** Adler-32 (checksum in coda allo stream zlib). */
function adler32(dati: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < dati.length; i++) {
    a = (a + dati[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Stream zlib composto da soli blocchi "stored" (nessuna compressione). */
export function zlibStored(dati: Uint8Array): Uint8Array {
  const MAX = 65535;
  const nBlocchi = Math.max(1, Math.ceil(dati.length / MAX));
  const out = new Uint8Array(2 + dati.length + nBlocchi * 5 + 4);
  let o = 0;
  out[o++] = 0x78; // CM = 8 (deflate), CINFO = 7
  out[o++] = 0x01; // FCHECK senza dizionario, livello 0
  for (let i = 0; i < nBlocchi; i++) {
    const inizio = i * MAX;
    const fine = Math.min(dati.length, inizio + MAX);
    const len = fine - inizio;
    out[o++] = i === nBlocchi - 1 ? 1 : 0; // BFINAL, BTYPE = 00
    out[o++] = len & 0xff;
    out[o++] = (len >> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >> 8) & 0xff;
    out.set(dati.subarray(inizio, fine), o);
    o += len;
  }
  const a = adler32(dati);
  out[o++] = (a >>> 24) & 0xff;
  out[o++] = (a >>> 16) & 0xff;
  out[o++] = (a >>> 8) & 0xff;
  out[o++] = a & 0xff;
  return out.subarray(0, o);
}
