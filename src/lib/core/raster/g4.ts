/**
 * Codifica e decodifica CCITT Group 4 (ITU-T T.6, codifica bidimensionale pura).
 *
 * È il formato usato dai TIFF di Docfa (Compression = 4) e dal filtro /CCITTFaxDecode dei PDF
 * con K = -1: lo stream prodotto qui è "puro", senza EOL tra le righe, chiuso dal codice EOFB
 * (due EOL consecutivi) e allineato al byte, come fa libtiff.
 *
 * Convenzioni: la Bitmap ha 1 = nero; nel T.6 le righe iniziano con un "pixel immaginario"
 * bianco e gli elementi di cambiamento sono le posizioni dove il colore cambia rispetto al
 * pixel precedente.
 */
import { Bitmap } from './bitmap';

// ---------------------------------------------------------------------------------------------
// Tabelle dei codici di lunghezza di corsa (T.4), condivise fra encoder e decoder
// ---------------------------------------------------------------------------------------------

/** Codici terminali bianchi, indice = lunghezza di corsa 0..63. */
const BIANCHI_TERM: readonly string[] = [
  '00110101', '000111', '0111', '1000', '1011', '1100', '1110', '1111', '10011', '10100',
  '00111', '01000', '001000', '000011', '110100', '110101', '101010', '101011', '0100111', '0001100',
  '0001000', '0010111', '0000011', '0000100', '0101000', '0101011', '0010011', '0100100', '0011000', '00000010',
  '00000011', '00011010', '00011011', '00010010', '00010011', '00010100', '00010101', '00010110', '00010111', '00101000',
  '00101001', '00101010', '00101011', '00101100', '00101101', '00000100', '00000101', '00001010', '00001011', '01010010',
  '01010011', '01010100', '01010101', '00100100', '00100101', '01011000', '01011001', '01011010', '01011011', '01001010',
  '01001011', '00110010', '00110011', '00110100',
];

/** Codici di "make-up" bianchi, indice k = lunghezza 64·(k+1), da 64 a 1728. */
const BIANCHI_MAKEUP: readonly string[] = [
  '11011', '10010', '010111', '0110111', '00110110', '00110111', '01100100', '01100101', '01101000', '01100111',
  '011001100', '011001101', '011010010', '011010011', '011010100', '011010101', '011010110', '011010111', '011011000', '011011001',
  '011011010', '011011011', '010011000', '010011001', '010011010', '011000', '010011011',
];

/** Codici terminali neri, indice = lunghezza di corsa 0..63. */
const NERI_TERM: readonly string[] = [
  '0000110111', '010', '11', '10', '011', '0011', '0010', '00011', '000101', '000100',
  '0000100', '0000101', '0000111', '00000100', '00000111', '000011000', '0000010111', '0000011000', '0000001000', '00001100111',
  '00001101000', '00001101100', '00000110111', '00000101000', '00000010111', '00000011000', '000011001010', '000011001011', '000011001100', '000011001101',
  '000001101000', '000001101001', '000001101010', '000001101011', '000011010010', '000011010011', '000011010100', '000011010101', '000011010110', '000011010111',
  '000001101100', '000001101101', '000011011010', '000011011011', '000001010100', '000001010101', '000001010110', '000001010111', '000001100100', '000001100101',
  '000001010010', '000001010011', '000000100100', '000000110111', '000000111000', '000000100111', '000000101000', '000001011000', '000001011001', '000000101011',
  '000000101100', '000001011010', '000001100110', '000001100111',
];

/** Codici di "make-up" neri, indice k = lunghezza 64·(k+1), da 64 a 1728. */
const NERI_MAKEUP: readonly string[] = [
  '0000001111', '000011001000', '000011001001', '000001011011', '000000110011', '000000110100', '000000110101', '0000001101100', '0000001101101', '0000001001010',
  '0000001001011', '0000001001100', '0000001001101', '0000001110010', '0000001110011', '0000001110100', '0000001110101', '0000001110110', '0000001110111', '0000001010010',
  '0000001010011', '0000001010100', '0000001010101', '0000001011010', '0000001011011', '0000001100100', '0000001100101',
];

/** Codici di make-up estesi (comuni ai due colori), indice k = lunghezza 1792 + 64·k, fino a 2560. */
const MAKEUP_ESTESI: readonly string[] = [
  '00000001000', '00000001100', '00000001101', '000000010010', '000000010011', '000000010100', '000000010101', '000000010110', '000000010111', '000000011100',
  '000000011101', '000000011110', '000000011111',
];

interface Codice { len: number; bits: number }

function parseCodice(s: string): Codice {
  return { len: s.length, bits: parseInt(s, 2) };
}

const TERM: [Codice[], Codice[]] = [BIANCHI_TERM.map(parseCodice), NERI_TERM.map(parseCodice)];
const MAKEUP: [Codice[], Codice[]] = [BIANCHI_MAKEUP.map(parseCodice), NERI_MAKEUP.map(parseCodice)];
const ESTESI: Codice[] = MAKEUP_ESTESI.map(parseCodice);

/** Tabella di decodifica per colore: chiave = len * 65536 + bits → lunghezza di corsa. */
function tabellaDecodifica(colore: 0 | 1): Map<number, number> {
  const m = new Map<number, number>();
  TERM[colore].forEach((c, run) => m.set(c.len * 65536 + c.bits, run));
  MAKEUP[colore].forEach((c, k) => m.set(c.len * 65536 + c.bits, 64 * (k + 1)));
  ESTESI.forEach((c, k) => m.set(c.len * 65536 + c.bits, 1792 + 64 * k));
  return m;
}
const DECODIFICA: [Map<number, number>, Map<number, number>] = [tabellaDecodifica(0), tabellaDecodifica(1)];
/** Lunghezza massima di un codice di corsa (make-up neri: 13 bit). */
const MAX_LEN_CODICE = 14;

// ---------------------------------------------------------------------------------------------
// Scrittura e lettura di bit
// ---------------------------------------------------------------------------------------------

class ScrittoreBit {
  private buf = new Uint8Array(4096);
  private pos = 0; // byte corrente
  private nbit = 0; // bit già scritti nel byte corrente (0..7)

  scrivi(bits: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) {
      if (this.pos >= this.buf.length) {
        const n = new Uint8Array(this.buf.length * 2);
        n.set(this.buf);
        this.buf = n;
      }
      if ((bits >>> i) & 1) this.buf[this.pos] |= 0x80 >> this.nbit;
      this.nbit++;
      if (this.nbit === 8) { this.nbit = 0; this.pos++; }
    }
  }

  scriviCodice(c: Codice): void { this.scrivi(c.bits, c.len); }

  /** Chiude l'ultimo byte (riempimento a zero) e restituisce lo stream. */
  fine(): Uint8Array {
    const n = this.nbit ? this.pos + 1 : this.pos;
    return this.buf.slice(0, n);
  }
}

class LettoreBit {
  private pos = 0;
  constructor(private readonly dati: Uint8Array) {}

  get finito(): boolean { return this.pos >= this.dati.length * 8; }

  leggiBit(): number {
    const i = this.pos >> 3;
    if (i >= this.dati.length) throw new Error('Stream G4 troncato');
    const b = (this.dati[i] >> (7 - (this.pos & 7))) & 1;
    this.pos++;
    return b;
  }

  /** Legge n bit senza consumarli (oltre la fine valgono 0). */
  sbircia(n: number): number {
    let v = 0;
    for (let k = 0; k < n; k++) {
      const p = this.pos + k;
      const i = p >> 3;
      const b = i < this.dati.length ? (this.dati[i] >> (7 - (p & 7))) & 1 : 0;
      v = (v << 1) | b;
    }
    return v;
  }
}

// ---------------------------------------------------------------------------------------------
// Elementi di cambiamento
// ---------------------------------------------------------------------------------------------

/**
 * Calcola gli elementi di cambiamento della riga y (posizioni in cui il colore differisce dal
 * pixel precedente, con pixel -1 bianco) in `out`, seguiti da due sentinelle pari alla larghezza.
 * Restituisce il numero di elementi reali.
 */
function elementiDiCambiamento(bm: Bitmap, y: number, out: Int32Array): number {
  const base = y * bm.rowBytes;
  const w = bm.width;
  let n = 0;
  let colore = 0;
  for (let x = 0; x < w; x++) {
    const p = (bm.data[base + (x >> 3)] >> (7 - (x & 7))) & 1;
    if (p !== colore) { out[n++] = x; colore = p; }
  }
  out[n] = w;
  out[n + 1] = w;
  return n;
}

/** Scrive la lunghezza di corsa `run` nel colore indicato (make-up + terminale). */
function scriviCorsa(w: ScrittoreBit, run: number, colore: 0 | 1): void {
  let r = run;
  while (r >= 2560) { w.scriviCodice(ESTESI[ESTESI.length - 1]); r -= 2560; }
  if (r >= 1792) { const k = Math.floor((r - 1792) / 64); w.scriviCodice(ESTESI[k]); r -= 1792 + 64 * k; }
  else if (r >= 64) { const k = Math.floor(r / 64); w.scriviCodice(MAKEUP[colore][k - 1]); r -= 64 * k; }
  w.scriviCodice(TERM[colore][r]);
}

/**
 * Trova b1 (primo elemento di cambiamento della riga di riferimento a destra di a0 e di colore
 * opposto a `colore`) partendo dall'indice `ib`, che viene corretto all'indietro se necessario.
 * Gli indici pari sono transizioni verso il nero (colore del pixel = nero), i dispari verso il bianco.
 */
function trovaB1(ref: Int32Array, nref: number, ib: number, a0: number, colore: number): number {
  while (ib > 0 && ref[ib - 1] > a0) ib--;
  while (ib < nref && ref[ib] <= a0) ib++;
  if ((ib & 1) !== colore) ib++;
  return ib;
}

// ---------------------------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------------------------

/** Codici dei modi verticali, indice = a1 - b1 + 3 (VL3..VR3). */
const VERTICALI: Codice[] = ['0000010', '000010', '010', '1', '011', '000011', '0000011'].map(parseCodice);
const PASS = parseCodice('0001');
const ORIZZONTALE = parseCodice('001');
const EOL = parseCodice('000000000001');

/**
 * Codifica la bitmap in uno stream G4 puro (T.6), chiuso da EOFB e allineato al byte.
 */
export function codificaG4(bm: Bitmap): Uint8Array {
  const w = new ScrittoreBit();
  const width = bm.width;
  let ref = new Int32Array(width + 3);
  let cod = new Int32Array(width + 3);
  let nref = 0;
  ref[0] = width; ref[1] = width; // riga immaginaria bianca sopra la prima
  for (let y = 0; y < bm.height; y++) {
    const ncod = elementiDiCambiamento(bm, y, cod);
    let a0 = -1;
    let colore: 0 | 1 = 0;
    let ia = 0;
    let ib = 0;
    while (a0 < width) {
      // a1: primo cambiamento della riga corrente a destra di a0, di colore opposto a `colore`
      while (ia > 0 && cod[ia - 1] > a0) ia--;
      while (ia < ncod && cod[ia] <= a0) ia++;
      if ((ia & 1) !== colore) ia++;
      const a1 = ia < ncod ? cod[ia] : width;
      ib = trovaB1(ref, nref, ib, a0, colore);
      const b1 = ib < nref ? ref[ib] : width;
      const b2 = ib + 1 < nref ? ref[ib + 1] : width;
      if (b2 < a1) {
        // modo "pass": la riga di riferimento ha una coppia di cambiamenti tutta prima di a1
        w.scriviCodice(PASS);
        a0 = b2;
      } else if (Math.abs(a1 - b1) <= 3) {
        // modo verticale
        w.scriviCodice(VERTICALI[a1 - b1 + 3]);
        a0 = a1;
        colore = colore ? 0 : 1;
      } else {
        // modo orizzontale: due corse esplicite
        const a2 = ia + 1 < ncod ? cod[ia + 1] : width;
        const inizio = a0 < 0 ? 0 : a0;
        w.scriviCodice(ORIZZONTALE);
        scriviCorsa(w, a1 - inizio, colore);
        scriviCorsa(w, a2 - a1, colore ? 0 : 1);
        a0 = a2;
      }
    }
    // la riga codificata diventa riferimento per la successiva
    const t = ref; ref = cod; cod = t; nref = ncod;
  }
  w.scriviCodice(EOL);
  w.scriviCodice(EOL);
  return w.fine();
}

// ---------------------------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------------------------

type Modo = { tipo: 'P' } | { tipo: 'H' } | { tipo: 'V'; d: number } | { tipo: 'EOL' };

function leggiModo(r: LettoreBit): Modo {
  if (r.leggiBit()) return { tipo: 'V', d: 0 };
  if (r.leggiBit()) return { tipo: 'V', d: r.leggiBit() ? 1 : -1 }; // 011 VR1, 010 VL1
  if (r.leggiBit()) return { tipo: 'H' }; // 001
  if (r.leggiBit()) return { tipo: 'P' }; // 0001
  if (r.leggiBit()) return { tipo: 'V', d: r.leggiBit() ? 2 : -2 }; // 00001x
  if (r.leggiBit()) return { tipo: 'V', d: r.leggiBit() ? 3 : -3 }; // 000001x
  // 0000000...: EOL (000000000001) o dati corrotti
  for (let k = 0; k < 5; k++) if (r.leggiBit()) throw new Error('Codice G4 non valido');
  if (!r.leggiBit()) throw new Error('Codice G4 non valido');
  return { tipo: 'EOL' };
}

function leggiCorsa(r: LettoreBit, colore: 0 | 1): number {
  let totale = 0;
  for (;;) {
    let len = 0, bits = 0;
    let run = -1;
    while (len < MAX_LEN_CODICE) {
      bits = (bits << 1) | r.leggiBit();
      len++;
      const v = DECODIFICA[colore].get(len * 65536 + bits);
      if (v !== undefined) { run = v; break; }
    }
    if (run < 0) throw new Error('Codice di corsa G4 non valido');
    totale += run;
    if (run < 64) return totale; // codice terminale
    // make-up: segue sempre un altro codice (eventualmente un terminale di lunghezza 0)
  }
}

/**
 * Decodifica uno stream G4 puro in una Bitmap di dimensioni note. Si ferma a EOFB o alla fine
 * dei dati; le righe mancanti restano bianche.
 */
export function decodificaG4(dati: Uint8Array, width: number, height: number): Bitmap {
  const bm = new Bitmap(width, height);
  const r = new LettoreBit(dati);
  let ref = new Int32Array(width + 8);
  let cod = new Int32Array(width + 8);
  let nref = 0;
  ref[0] = width; ref[1] = width;
  // annerisce i pixel [da, a) della riga y (nessun effetto se l'intervallo è vuoto)
  const annerisci = (da: number, a: number, y: number): void => { if (a > da) bm.rettangolo(da, y, a - 1, y, true); };
  for (let y = 0; y < height; y++) {
    if (r.finito) break;
    // EOFB prima della fine dell'immagine
    if (r.sbircia(24) === 0x001001) break;
    let a0 = -1;
    let colore: 0 | 1 = 0;
    let ncod = 0;
    let ib = 0;
    while (a0 < width) {
      ib = trovaB1(ref, nref, ib, a0, colore);
      const b1 = ib < nref ? ref[ib] : width;
      const b2 = ib + 1 < nref ? ref[ib + 1] : width;
      const inizio = a0 < 0 ? 0 : a0;
      const modo = leggiModo(r);
      if (modo.tipo === 'P') {
        if (colore) annerisci(inizio, b2, y);
        a0 = b2;
      } else if (modo.tipo === 'H') {
        const r1 = leggiCorsa(r, colore);
        const r2 = leggiCorsa(r, colore ? 0 : 1);
        const a1 = Math.min(width, inizio + r1);
        const a2 = Math.min(width, a1 + r2);
        if (colore) annerisci(inizio, a1, y);
        else annerisci(a1, a2, y);
        cod[ncod++] = a1;
        cod[ncod++] = a2;
        a0 = a2;
      } else if (modo.tipo === 'V') {
        const a1 = Math.max(inizio, Math.min(width, b1 + modo.d));
        if (colore) annerisci(inizio, a1, y);
        cod[ncod++] = a1;
        a0 = a1;
        colore = colore ? 0 : 1;
      } else {
        return bm; // EOL/EOFB: fine dei dati
      }
    }
    cod[ncod] = width; cod[ncod + 1] = width;
    const t = ref; ref = cod; cod = t; nref = ncod;
  }
  return bm;
}
