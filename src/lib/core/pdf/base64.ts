/** Decodifica base64 → byte, senza dipendere da Buffer (serve anche nel webview di Tauri). */
export function decodificaBase64(b64: string): Uint8Array {
  const pulita = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (typeof atob === 'function') {
    const bin = atob(pulita);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const valori = new Int16Array(128).fill(-1);
  for (let i = 0; i < alfabeto.length; i++) valori[alfabeto.charCodeAt(i)] = i;
  const senzaPad = pulita.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((senzaPad.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < senzaPad.length; i++) {
    acc = (acc << 6) | valori[senzaPad.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
