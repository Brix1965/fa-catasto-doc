/**
 * Modelli (template) delle planimetrie e degli elaborati planimetrici: i TIFF A4.mod, A3.mod,
 * EP2_A4.mod, EP2_A3.mod della cartella PGM di Docfa 4, con il cartiglio già stampato.
 *
 * I dati sono incorporati in modelli-dati.ts (stream G4 in base64, generati da
 * tools/genera-modelli.py) e decodificati dal nostro decoder G4: funziona identico in Node e
 * nel webview, senza zlib né DecompressionStream.
 */
import { Bitmap } from './bitmap';
import { decodificaG4 } from './g4';
import { MODELLI_DATI } from './modelli-dati';

export type FormatoModello = 'A4' | 'A3';
export type TipoModello = 'planimetria' | 'elaborato';

/** Area del disegno (riquadro interno) nei modelli, in pixel, estremi inclusi; Docfa la sbianca prima di disegnare. */
export const AREA_DISEGNO: Record<FormatoModello, { x0: number; y0: number; x1: number; y1: number }> = {
  // A4.mod: bordo del riquadro a x 7..9 / 1542..1544 e y 372..374 / 2222..2224; Docfa sbianca
  // da x 9 e y 374 (compresa l'ultima riga/colonna del bordo) fino a x 1541 / y 2221
  A4: { x0: 9, y0: 374, x1: 1541, y1: 2221 },
  // A3.mod: bordo a x 236..238 / 2283..2285 e y 74..76 / 3239..3241
  A3: { x0: 238, y0: 76, x1: 2282, y1: 3238 },
};

/** Decodifica base64 → byte, con l'API disponibile (atob nel browser e in Node ≥ 16). */
function daBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const cache = new Map<string, Bitmap>();

/**
 * Restituisce una copia della bitmap del modello richiesto (la decodifica viene fatta una volta
 * sola e messa in cache). È asincrona per lasciare libertà di caricare i modelli da file in futuro.
 */
export async function caricaModello(formato: FormatoModello, tipo: TipoModello): Promise<Bitmap> {
  const chiave = `${formato}_${tipo}`;
  let bm = cache.get(chiave);
  if (!bm) {
    const m = MODELLI_DATI[chiave];
    if (!m) throw new Error(`Modello ${chiave} non disponibile`);
    bm = decodificaG4(daBase64(m.g4), m.width, m.height);
    cache.set(chiave, bm);
  }
  return bm.clona();
}

/** Dimensioni in pixel dei modelli, senza decodificarli. */
export function dimensioniModello(formato: FormatoModello, tipo: TipoModello = 'planimetria'): { width: number; height: number } {
  const m = MODELLI_DATI[`${formato}_${tipo}`];
  if (!m) throw new Error(`Modello ${formato}_${tipo} non disponibile`);
  return { width: m.width, height: m.height };
}
