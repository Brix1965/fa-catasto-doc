/**
 * NZCT02 di Docfa 4: dal documento (record D3 da 350 caratteri) ai record NCLAS1 (402 caratteri) per il
 * classamento automatico, con i dati del fabbricato (modello 1N parte I), il vettore delle caratteristiche
 * di ogni unità (1N parte II) e gli aggregati di fabbricato.
 *
 * Traduzione fedele del riferimento ricostruito dal codice di Docfa: le variabili sono indicate con l'offset
 * della working storage del programma (W[x]); il record letto è copiato in W1700, il record NCLAS1 si
 * costruisce in W1868. Percorso considerato: Docfa locale (nessun collegamento di rete).
 * Le stringhe sono latin1 (un carattere per byte).
 */
import { nzuu01 } from './nzuu01';
import { W0, T1868, T0AF0, TA_B57, type Corse } from './nzct02-dati.generated';

export interface EsitoNzct02 {
  /** record NCLAS1 scritti (402 caratteri) */
  nclas: string[];
  /** area di stato L54 (primi 0x50 caratteri): [0:2]='02', [2:6] codice, [6:8] stato, [9:79] messaggio */
  l54: string;
  /** area dei "dati in atti" della variazione (L58 da 0x3ea0, 64 caratteri) */
  l4c: string;
  /** record del WorkFile 2 (954 caratteri) */
  out2: string[];
}

function decodifica(c: Corse): Uint8Array {
  const out: number[] = [];
  for (const x of c) {
    if (typeof x === 'string') for (let i = 0; i < x.length; i++) out.push(x.charCodeAt(i) & 0xff);
    else for (let i = 0; i < x[1]; i++) out.push(x[0]);
  }
  return Uint8Array.from(out);
}

let modelli: { w0: Uint8Array; t1868: Uint8Array; t0af0: Uint8Array; ta: Uint8Array; tc: Uint8Array } | null = null;
function datiModelli() {
  if (!modelli) {
    const tc = new Uint8Array(0xc9a - 0xb57).fill(0x20);
    const put = (a: number, s: string) => { for (let i = 0; i < s.length; i++) tc[a - 0xb57 + i] = s.charCodeAt(i); };
    put(0xb5b, '000000'); put(0xb64, '0'.repeat(9)); put(0xb70, '0'.repeat(16)); put(0xb80, '0'.repeat(38));
    modelli = { w0: decodifica(W0), t1868: decodifica(T1868), t0af0: decodifica(T0AF0), ta: decodifica(TA_B57), tc };
  }
  return modelli;
}

const daStringa = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
const aStringa = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; };
/** valore di un campo numerico come lo legge il runtime Micro Focus (cifra = byte & 0xf) */
function dig(b: Uint8Array): number { let v = 0; for (let i = 0; i < b.length; i++) v = v * 10 + (b[i] & 0xf); return v; }
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** file indicizzato del documento: chiave = primi 16 caratteri */
class FileDoc {
  recs: string[];
  pos = 0;
  constructor(recs: string[]) { this.recs = [...recs].sort((a, b) => (a.slice(0, 16) < b.slice(0, 16) ? -1 : a.slice(0, 16) > b.slice(0, 16) ? 1 : 0)); }
  apri() { this.pos = 0; }
  next(): string | null { return this.pos < this.recs.length ? this.recs[this.pos++] : null; }
  key(k: string): string | null {
    for (let i = 0; i < this.recs.length; i++) if (this.recs[i].slice(0, 16) === k) { this.pos = i + 1; return this.recs[i]; }
    return null;
  }
}

class Fine extends Error {}

/**
 * Dati che in variazione Docfa chiede nelle due finestre di NZCT60 quando l'archivio dell'Ufficio non è
 * accessibile: classamento in atti delle u.i.u. variate/soppresse e categorie presenti nel fabbricato con la
 * classe più elevata. Categorie come nel record 3 ("A03"), classi di due cifre ("02").
 */
export interface DatiInAtti {
  unita: { categoria: string; classe: string }[];
  fabbricato: { categoria: string; classe: string }[];
  /** righe di TARIFFE (comune 5, zona 3, categoria 3, classe 2, tariffa 7) */
  tar: string[];
}

class N2 {
  W: Uint8Array;
  L58 = new Uint8Array(0x4000).fill(0x20);
  L54 = new Uint8Array(0x100).fill(0x20);
  L4c = new Uint8Array(0x40).fill(0x20);
  L48 = '=';
  out: string[] = [];
  out2: string[] = [];
  st = '00';
  doc!: FileDoc;
  private m = datiModelli();
  inAtti?: DatiInAtti;

  constructor() {
    this.W = this.m.w0.slice();
    this.L4c.set(daStringa('UTENTE'));
  }

  // ---- accesso alla working storage
  /** byte della working storage (senza restringimento di tipo) */
  b(x: number): number { return this.W[x]; }
  g(x: number, n = 1): string { return aStringa(this.W.subarray(x, x + n)); }
  s(x: number, b: string | Uint8Array) { this.W.set(typeof b === 'string' ? daStringa(b) : b, x); }
  cp(d: number, sx: number, n: number) { this.W.copyWithin(d, sx, sx + n); }
  fill(x: number, n: number, c: number) { this.W.fill(c, x, x + n); }
  d(x: number, n: number) { return dig(this.W.subarray(x, x + n)); }
  /** caricamento con puntatore di fine campo (_mF51xx) */
  de(end: number, n: number) { return dig(this.W.subarray(end - n, end)); }
  pd(x: number, n: number, v: number) { this.s(x, String(mod(v, 10 ** n)).padStart(n, '0')); }
  pde(end: number, n: number, v: number) { this.pd(end - n, n, v); }
  /** incremento di un contatore numerico di n cifre */
  inc(x: number, n: number) { this.pd(x, n, this.d(x, n) + 1); }
  /** incremento di una cifra con giro 9 → 0 */
  incw(x: number) { let c = this.W[x] + 1; if (c >= 0x3a) c -= 0xa; this.W[x] = c; }
  private L58s(a: number, s: string) { this.L58.set(daStringa(s), a); }
  private L58g(a: number, n: number) { return aStringa(this.L58.subarray(a, a + n)); }

  // ---- record corrente
  leggi(r: string | null, spazi = true): boolean {
    if (r === null) { this.st = '10'; return false; }
    this.st = '00';
    this.s(0x988, r);
    this.cp(0x1700, 0x988, 350);
    if (spazi) this.fill(0x185e, 7, 0x20);
    return true;
  }

  errore(codice: string | null, stato: string | null, msg: string): never {
    if (codice !== null) this.L54.set(daStringa(codice), 2);
    if (stato !== null) this.L54.set(daStringa(stato), 6);
    this.L54.set(daStringa(msg.padEnd(70, ' ').slice(0, 70)), 9);
    throw new Fine();
  }

  // ===================================================================== main
  esegui(recs: string[]): string[] {
    const W = this.W;
    this.doc = new FileDoc(recs);
    try {
      this.main();
    } catch (e) {
      if (!(e instanceof Fine)) throw e;
    }
    // chiusure; variazione → dati in atti
    if (aStringa(this.L54.subarray(6, 8)) === '00' && W[0x2530] !== 0x30) this.p5e16();
    if (this.g(0x1af0, 6) !== '      ') this.L4c.set(this.W.subarray(0x1af0, 0x1af6), 0);
    return this.out;
  }

  private main() {
    const W = this.W;
    const L54 = this.L54;
    L54.fill(0x20, 0, 8); L54.fill(0x20, 9, 9 + 70);
    this.fill(0x1bc8, 20, 0x30); this.fill(0x1be0, 20, 0x30);
    W[0x3118] = 0x30;
    if (this.L48[0] === '=') W[0x3118] = 0x31;
    L54.set(daStringa('02  '), 0); L54.set(daStringa('    '), 4); L54.set(daStringa('00'), 6);
    W[0x25e0] = 0x20; W[0x25e1] = 0; W[0x25e2] = 0;
    this.doc.apri();
    // prima lettura (testata)
    this.fill(0x988, 16, 0);
    if (!this.leggi(this.doc.next())) this.errore('3   ', '10', 'Lettura File Documento Fallita. Procedura Interrotta');
    this.cp(0x1b90, 0x988, 16);
    this.s(0x2528, '   ');
    if (this.g(0x1719, 3) === 'NC ') {
      this.s(0x2528, 'NC '); W[0x2530] = 0x30;
    } else {
      // Docfa locale: rete non attiva (L4c = UTENTE)
      if (aStringa(this.L4c.subarray(0, 6)) !== 'UTENTE') {
        this.s(0x1af0, this.L4c.slice(0, 6)); this.L4c.set(daStringa('UTENTE'), 0);
      }
      this.p37fa();
      if (this.g(0x22f0, 3) === '000') this.errore('29  ', 'V1', 'Non Esistono Uiu Derivate. Classamento Interotto');
      if (this.g(0x1719, 3) === 'VAR') {
        this.p366c();
        if (this.g(0x2528, 3) === '   ' && this.g(0x1767, 4) > '0000') this.cp(0x2528, 0x1719, 3);
      } else {
        this.cp(0x2528, 0x1719, 3);
      }
      const c = this.g(0x2528, 3);
      if (c === 'DET') this.errore(null, 'V1', 'Classamento Automatico Non Richiesto Per La Variazione');
      if (c === 'VTO') this.errore(null, 'V2', 'Classamento Automatico Non Richiesto Per La Variazione');
      if (c === 'VAR' && this.g(0x1767, 4) === '0000') this.errore(null, 'V3', 'Classamento Automatico Non Applicabile Per La Variazione');
      if (c === 'FRF') this.s(0x2528, 'FRZ');
      if (this.g(0x2528, 3) === 'AFF') this.s(0x2528, W[0x1748] === 0x31 ? 'AF2' : 'AF1');
      W[0x2530] = this.g(0x2528, 3) === 'AF2' ? 0x31 : 0x32;
      this.s(0x1bb0, '000');
      this.L58s(0, '    '); this.L58[4] = 0x20; this.L58s(5, '  '); this.L58[7] = 0x20;
      this.L58s(8, '    '); this.L58s(0xc, '    '); this.L58[0x10] = 0x20;
      this.L58s(0x11, '0000000');
      for (let i = 0; i < 0x3e70; i += 0x10) {
        this.L58s(0x18 + i, '    '); this.L58[0x1c + i] = 0x20;
        this.L58s(0x1d + i, '00'); this.L58s(0x1f + i, '  ');
        this.L58s(0x21 + i, '       ');
      }
      for (let i = 0; i < 0x16; i += 2) this.L58s(0x3e88 + i, '  ');
      for (let i = 0; i < 0x10; i += 2) this.L58s(0x3e9e + i, '  ');
      for (let i = 0; i < 0xe; i += 2) this.L58s(0x3eae + i, '  ');
      this.L58[0x3ebc] = 0x30; this.L58[0x3ebd] = 0x20; this.L58s(0x3ebe, '00');
      this.L58s(0x3ec0, '  '); this.L58[0x3ec2] = 0x30; this.L58[0x3ec3] = 0x20;
      this.L58s(0x3ec4, '00'); this.L58s(0x3ec6, '     ');
    }
    // ---- record del modello 1N parte I (B e C, trascinato 0)
    for (;;) {
      if (!this.leggi(this.doc.next())) this.errore(null, 'NP', 'Non Esiste MOD. 1NB - Parte I. Procedura Interrotta');
      if (this.g(0x170b, 5) === '00000' && this.b(0x1710) === 0x42) break;
    }
    this.cp(0x1bf8, 0x1700, 350);
    if (!this.leggi(this.doc.next())) this.errore(null, this.st, '');
    if (!(this.g(0x170b, 5) === '00000' && this.b(0x1710) === 0x43)) this.errore(null, null, '');
    this.cp(0x1d58, 0x1700, 350);
    this.p3cfb();
    for (let i = 1; i <= 0x2c; i += 0xb) { this.fill(0x24df + i, 7, 0x30); this.s(0x24e6 + i, '0000'); }
    for (let i = 1; i <= 0x18; i += 6) this.s(0x250f + i, '000000');
    for (let i = 1; i <= 0x78; i += 6) { this.s(0x23e7 + i, '00'); this.s(0x23e9 + i, '0000'); }
    this.fill(0x1ec0, 350, 0x20); this.fill(0x2020, 350, 0x20);
    // ---- per ogni unità del modello 1N parte II (H trascinato 0 + I trascinato 1)
    for (;;) {
      if (!this.leggi(this.doc.next())) break;
      if (!(this.g(0x170b, 5) === '00000' && this.b(0x1710) === 0x48)) continue;
      this.cp(0x1ec0, 0x1700, 350);
      if (!this.leggi(this.doc.next())) this.errore(null, this.st, '');
      if (!(this.g(0x170b, 5) === '00001' && this.b(0x1710) === 0x49)) this.errore(null, null, '');
      this.cp(0x2020, 0x1700, 350);
      this.cp(0x1ba0, 0x1700, 16);
      this.cp(0x1700, 0x1ec0, 350);
      if (W[0x184b] === 0x41 && this.g(0x17f6, 3) !== 'A10') {
        if (W[0x1eb8] === 0x30) this.p4146();
        this.p45e6();
      }
      if (this.g(0x17f6, 3) === 'C06') {
        this.cp(0x1700, 0x2020, 350);
        this.p57a0();
      }
    }
    if (this.g(0x2388, 4) !== '0000') { this.p4b71(); this.p5d9f(); }
    if (W[0x24c0] === 0x31) this.p5bf0();
    this.cp(0x988, 0x1b90, 16);
    if (!this.leggi(this.doc.key(this.g(0x988, 16)))) this.errore(null, this.st, '');
    // ---- per ogni unità (record 3, lettera C)
    for (;;) {
      const r = this.doc.next();
      if (r === null) break;
      this.leggi(r, false);
      this.cp(0x1b80, 0x1700, 16);
      if (!(W[0x1b87] === 0x43 && this.g(0x170b, 5) === '00000' && this.b(0x1710) === 0x33)) continue;
      this.unita();
    }
    if (this.g(0x22f8, 9) === '000000000') this.errore(null, 'NS', 'Non Esistono MOD. 1NB - Parte II. Procedura Interrotta');
  }

  // ===================================================================== unità
  private unita() {
    const W = this.W;
    const L58 = this.L58;
    this.cp(0x2180, 0x1700, 350);
    L58.set(W.subarray(0x184e, 0x1852), 0); L58[4] = W[0x1852];
    const op = W[0x1718];
    const dati58 = () => {
      L58.set(W.subarray(0x1719, 0x171c), 5); L58.set(W.subarray(0x171c, 0x1720), 8);
      L58.set(W.subarray(0x1720, 0x1724), 0xc); L58[0x10] = W[0x1724];
      L58.set(W.subarray(0x1725, 0x1729), 0x11);
      L58.set(W.subarray(0x22e0, 0x22e3), 0x3ec8);
    };
    if (op === 0x53 || op === 0x56) dati58();
    if (op === 0x43 && (this.g(0x2528, 3) === 'AF2' || this.g(0x2528, 3) === 'AF1')) dati58();
    if (W[0x2530] === 0x31) this.L58s(0x15, '000');
    if (W[0x2530] === 0x32 && (op === 0x53 || op === 0x56)) {
      const n = dig(L58.subarray(0x15, 0x18)) + 1;
      this.L58s(0x15, String(n % 1000).padStart(3, '0'));
      if (n <= 100) L58.set(W.subarray(0x1729, 0x172d), 0x18 + (n - 1) * 0x10);
    }
    if (op === 0x53) return;
    this.s(0x1868, this.m.t1868); // record NCLAS1 vuoto
    const k1 = this.W.slice(0xaf2, 0xaf5);
    let k2 = this.W.slice(0xc04, 0xc08);
    this.s(0xaf0, this.m.t0af0); // record WorkFile2 vuoto (0xaf2-0xaf4 e 0xc04-0xc07 restano)
    this.s(0xaf2, k1); this.s(0xc04, k2);
    this.cp(0x1868, 0x1700, 16);
    W[0x1878] = W[0x1710];
    this.cp(0x1879, 0x1711, 7);
    W[0x1880] = W[0x1718];
    this.cp(0x1881, 0x184e, 5);
    this.cp(0x1886, 0x1719, 20);
    this.cp(0x189f, 0x172d, 50);
    // piani: NZUU01YN divide i tre piani sul trattino, poi ordinamento per tipo
    const buf = nzuu01(('1' + this.g(0x1771, 12)).padEnd(0x26, ' '));
    this.s(0x30f0, buf);
    for (let i = 1; i <= 0x1e; i += 5) { W[0x2337 + i] = 0x30; W[0x2338 + i] = 0x20; this.s(0x2339 + i, '   '); }
    for (let k = 0; k < 6; k++) this.s(0x2339 + 5 * k, this.g(0x30fe + 4 * k, 4));
    for (let k = 0; k < 6; k++) {
      const p = 0x2339 + 5 * k;
      if (W[p] >= 0x30 && W[p] <= 0x39) W[p - 1] = 0x33;
      if (W[p] === 0x54) W[p - 1] = 0x32;
      if (W[p] === 0x53) W[p - 1] = 0x31;
    }
    // shell sort per rango (decrescente): numerici, T, S, altri
    let h = 1;
    while (h < 6) h = 3 * h + 1;
    while (h !== 1) {
      h = Math.floor(h / 3);
      for (let i = h + 1; i < 7; i++) {
        const key = this.W.slice(0x2338 + 5 * (i - 1), 0x2338 + 5 * (i - 1) + 5);
        let j = i;
        while (j > h) {
          const prev = 0x2338 + 5 * (j - h - 1);
          if (!(key[0] > W[prev])) break;
          this.cp(0x2338 + 5 * (j - 1), prev, 5);
          j -= h;
        }
        this.s(0x2338 + 5 * (j - 1), key);
      }
    }
    this.cp(0x18d1, 0x2339, 4); this.cp(0x18d5, 0x233e, 4); this.cp(0x18d9, 0x2343, 4);
    this.cp(0x18dd, 0x179f, 30);
    if (this.g(0x18dd, 3) === 'U  ') this.s(0x18dd, '   ');
    if (this.g(0x18fb, 3) === 'U  ') this.s(0x18fb, '   ');
    this.cp(0x1919, 0x2528, 3);
    this.cp(0x1929, 0x2540, 53);
    // WorkFile2
    this.cp(0xc9a, 0x2552, 2); this.cp(0xc9c, 0x2554, 4);
    this.cp(0xca0, 0x2540, 3); W[0xca3] = W[0x2543]; this.cp(0xca4, 0x2544, 2);
    this.cp(0xca6, 0x2546, 2); W[0xca8] = W[0x2548]; W[0xca9] = W[0x2549];
    this.cp(0xcaa, 0x254a, 2); this.cp(0xcac, 0x254c, 2); W[0xcae] = W[0x254e];
    this.cp(0xca6, 0x254f, 2); W[0xca8] = W[0x2551];
    const c = W[0x17a2];
    if (c === 0x41) { k2 = this.W.slice(0xc04, 0xc08); this.s(0xb57, this.m.ta); this.s(0xc04, k2); }
    if (c === 0x42) { W[0xb57] = 0x30; this.s(0xb58, '0000'); W[0xb5c] = 0x30; this.fill(0xb5d, 3 + 0x4e * 4 + 2, 0x20); }
    if (c === 0x43) this.s(0xb57, this.m.tc);
    if (c === 0x41) {
      this.cp(0x199f, 0x2590, 75);
      this.cp(0xc4c, 0x2592, 3); this.cp(0xc52, 0x2597, 2); this.cp(0xc54, 0x2599, 5);
      W[0xc59] = W[0x259f]; W[0xc5a] = W[0x259e]; W[0xc5b] = W[0x25a0];
      W[0xc5f] = W[0x25da]; this.cp(0xc60, 0x25a5, 5); this.cp(0xc65, 0x25aa, 5);
      W[0xc6a] = W[0x25af]; this.cp(0xc6b, 0x25b0, 4); this.cp(0xc6f, 0x25b4, 3);
      W[0xc72] = W[0x25b7]; this.cp(0xc73, 0x25b8, 4); this.cp(0xc77, 0x25be, 3);
      this.cp(0xc7a, 0x25c1, 5); this.cp(0xc7f, 0x25c6, 3); this.cp(0xc82, 0x25c9, 5);
      W[0xc87] = W[0x25ce]; this.cp(0xc88, 0x25cf, 4); this.cp(0xc8c, 0x25d4, 3);
      W[0xc8f] = W[0x25d7]; this.cp(0xc90, 0x25d8, 2); this.cp(0xc92, 0x25a3, 2);
      W[0xc94] = 0x30;
      if (this.g(0x2528, 3) === 'NC ') this.cp(0xc95, 0x2560, 3);
      else { W[0xc95] = W[0x2581]; this.cp(0xc96, 0x2582, 2); }
    }
    // ---- record 1N parte II (H) dell'unità
    W[0x1b87] = 0x55;
    this.cp(0x988, 0x1b80, 16);
    if (!this.leggi(this.doc.key(this.g(0x988, 16)))) {
      this.cp(0x988, 0x2180, 350);
      if (!this.leggi(this.doc.key(this.g(0x988, 16)), false)) this.errore(null, this.st, '');
      return;
    }
    if (W[0x18e0] === 0x44 || W[0x18e0] === 0x45) {
      this.s(0x191c, '05');
    } else {
      this.cp(0x1ec0, 0x1700, 350);
      if (!this.leggi(this.doc.next())) this.errore(null, this.st, '');
      this.cp(0x2020, 0x1700, 350);
      this.cp(0x1700, 0x1ec0, 350);
      const cat = W[0x18e0];
      if (cat === 0x41) this.vettoreA();
      if (cat === 0x42) this.vettoreB();
      if (cat === 0x43) this.vettoreC();
    }
    // ---- scrittura
    this.cp(0xeb0, 0x1868, 402);
    this.out.push(this.g(0xeb0, 402));
    this.inc(0x22f8, 9);
    this.cp(0xaf0, 0x1881, 5); this.cp(0xaf5, 0x1886, 20);
    this.cp(0x1700, 0x2020, 350);
    this.cp(0xb09, 0x17c6, 50);
    W[0xb3b] = W[0x1919]; this.cp(0xb3c, 0x191a, 2); W[0xb3e] = W[0x191d];
    W[0xb3f] = W[0x18dd]; this.cp(0xb40, 0x18de, 2);
    if (W[0x3118] === 0x30) this.out2.push(this.g(0xaf0, 954));
    this.cp(0x988, 0x2180, 350);
    if (!this.leggi(this.doc.key(this.g(0x988, 16)), false)) this.errore(null, this.st, '');
  }

  // ===================================================================== vettori
  private vettoreA() {
    const W = this.W;
    W[0x2368] = 0x30;
    this.cp(0x195e, 0x176a, 5); W[0x1963] = W[0x176f]; this.cp(0x1964, 0x1770, 4);
    this.cp(0x1968, 0x1774, 2); this.cp(0x196a, 0x1776, 4); W[0x196e] = W[0x177a];
    this.cp(0x196f, 0x177b, 2); this.cp(0x1971, 0x177d, 4); W[0x1975] = W[0x1781];
    this.cp(0x1976, 0x1787, 4); W[0x197a] = W[0x178b]; this.cp(0x197b, 0x178c, 4);
    this.cp(0x197f, 0x1790, 4); W[0x1983] = W[0x1794]; this.cp(0x1984, 0x1795, 4);
    W[0x1988] = W[0x1799]; this.cp(0x1989, 0x179a, 4); W[0x198d] = W[0x179e];
    this.cp(0x198e, 0x17bd, 2); W[0x1990] = W[0x17bf]; this.cp(0x1991, 0x17c0, 4);
    W[0x1995] = W[0x17c4];
    // superficie per vano: S / (vani + (bagni + accessori diretti)/3), arrotondata
    const S = this.de(0x1968, 5) + this.de(0x196f, 5) + this.de(0x1976, 5);
    const T = this.d(0x1968, 2) + this.d(0x196f, 2);
    const den3 = 3 * this.de(0x1963, 5) + T; // denominatore × 3
    if (den3 !== 0) this.pde(0x199e, 3, Math.floor((6 * S + den3) / (2 * den3)));
    this.flag20(0x1827, 7);
    if (W[0x1bc8] === 0x31 && W[0x1be0] === 0x31) { this.incw(0x2368); W[0xc98] = 0x31; }
    this.cp(0x1700, 0x2020, 350);
    this.fill(0x1bc8, 20, 0x30);
    this.s(0x1bc8, this.g(0x1730, 4) + ' '.repeat(16));
    if (W[0x1bc8] === 0x31 && W[0x1be0] === 0x31) { this.incw(0x2368); W[0xc99] = 0x31; }
    W[0x199e] = 0x30 + (((W[0x2370] & 0xf) + (W[0x2368] & 0xf)) % 10);
    this.s(0x19ea, '--'); this.s(0x19ec, '.'.repeat(14));
  }

  private flag20(src: number, n: number) {
    this.fill(0x1bc8, 20, 0x30);
    this.s(0x1bc8, this.g(src, n) + ' '.repeat(20 - n));
  }

  private vettoreB() {
    const W = this.W;
    this.cp(0x195e, 0x17c9, 2); this.cp(0x1960, 0x17cb, 4); this.cp(0x1964, 0x17cf, 2);
    this.cp(0x1966, 0x17d1, 2); this.cp(0x1968, 0x17d3, 4); this.cp(0x196c, 0x17d7, 2);
    this.cp(0x196e, 0x179a, 4); W[0x1972] = W[0x179e];
    this.fill(0x1973, 1 + 0x21 * 4, 0x2e);
  }

  private vettoreC() {
    const W = this.W;
    this.cp(0x195f, 0x1769, 13); this.cp(0x196c, 0x1776, 13); this.cp(0x1979, 0x1783, 13);
    this.cp(0x1986, 0x1790, 13); this.cp(0x1993, 0x179d, 13); this.cp(0x19a0, 0x17aa, 13);
    this.cp(0x19c4, 0x17b7, 5); this.cp(0x19c9, 0x17bc, 5);
    this.cp(0x19ad, 0x17da, 4); W[0x19b1] = W[0x17e4]; this.cp(0x19b2, 0x17e6, 3);
    this.cp(0x19b5, 0x17e9, 4); W[0x19b9] = W[0x17ed];
    this.fill(0x19ce, 2 + 9 * 4 + 2 + 1, 0x2e);
    this.cp(0x1700, 0x2020, 350);
    if (W[0x24c0] !== 0x31) return;
    W[0x195e] = 0x30;
    this.pd(0x19bf, 5, (this.d(0x1967, 5) + this.d(0x1974, 5)) % 10 ** 5);
    const cat = this.g(0x17c6, 50);
    const tipo = (t: string) => cat === t.padEnd(50, ' ');
    if (tipo('POSTO AUTO COPERTO')) {
      W[0x19bf] = 0x30; this.s(0x19c0, '0000'); W[0x195e] = 0x31;
      W[0x19bf] = W[0x24e1]; this.cp(0x19c0, 0x24e2, 4); this.cp(0x19b2, 0x2513, 3);
    }
    if (tipo('POSTO AUTO SCOPERTO')) {
      W[0x19bf] = 0x30; this.s(0x19c0, '0000'); W[0x195e] = 0x32;
      this.cp(0x19bf, 0x24ec, 5); this.s(0x19b2, '000');
    }
    if (tipo('BOX')) {
      W[0x19bf] = 0x30; this.s(0x19c0, '0000'); W[0x195e] = 0x33;
      W[0x19bf] = W[0x24f7]; this.cp(0x19c0, 0x24f8, 4); this.cp(0x19b2, 0x251f, 3);
    }
    if (tipo('AUTORIMESSA COLLETTIVA')) {
      W[0x19bf] = 0x30; this.s(0x19c0, '0000'); W[0x195e] = 0x34;
      W[0x19bf] = W[0x2502]; this.cp(0x19c0, 0x2503, 4); this.cp(0x19b2, 0x2525, 3);
    }
  }

  // ===================================================================== paragrafi
  /** causale della variazione dalle caselle del quadro B (testata) */
  private p366c() {
    const W = this.W;
    const c = (x: number) => W[x] === 0x31;
    if (c(0x1743)) return this.s(0x2528, 'VDE');
    if (c(0x1740)) return this.s(0x2528, 'FRF');
    if (c(0x1739)) return this.s(0x2528, 'FRZ');
    if (c(0x1738)) return this.s(0x2528, 'DIV');
    if (c(0x173a)) return this.s(0x2528, 'FUS');
    if (c(0x1744) && this.g(0x1767, 4) !== '0000') return this.s(0x2528, 'VAR');
    if (c(0x173b)) return this.s(0x2528, 'AMP');
    if (c(0x173f)) return this.s(0x2528, 'RST');
    if (c(0x173d)) return this.s(0x2528, 'DEP');
    if (c(0x173c)) return this.s(0x2528, 'DET');
    if (c(0x1742)) return this.s(0x2528, 'UFU');
    if (c(0x173e)) return this.s(0x2528, 'VSI');
  }

  /** prima scansione: conta le unità A/B/C, controlla la zona censuaria, conta A e A10 */
  private p37fa() {
    const W = this.W;
    this.s(0x2308, '     '); W[0x230d] = 0x20; this.s(0x230e, '  ');
    this.s(0x2310, '        '); W[0x2318] = 0x20; this.s(0x2319, '0000');
    this.s(0x2320, '     '); W[0x2325] = 0x20; this.s(0x2326, '  ');
    this.s(0x2328, '        '); W[0x2330] = 0x20; this.s(0x2331, '0000');
    for (;;) {
      const r = this.doc.next();
      if (r === null) break;
      this.leggi(r, false);
      this.cp(0x1b80, 0x1700, 16);
      if (!(W[0x1b87] === 0x43 && this.g(0x170b, 5) === '00000' && this.b(0x1710) === 0x33)) continue;
      if (W[0x1718] !== 0x43) {
        if (this.g(0x2308, 5) === '     ') {
          this.cp(0x2308, 0x184e, 5); W[0x230d] = W[0x1719]; this.cp(0x230e, 0x171a, 2);
          this.cp(0x2310, 0x171c, 8); W[0x2318] = W[0x1724]; this.cp(0x2319, 0x1725, 4);
        }
        this.cp(0x2320, 0x184e, 5); W[0x2325] = W[0x1719]; this.cp(0x2326, 0x171a, 2);
        this.cp(0x2328, 0x171c, 8); W[0x2330] = W[0x1724]; this.cp(0x2331, 0x1725, 4);
        if (W[0x1718] === 0x53) continue;
      }
      if (W[0x17a2] !== 0x41 && W[0x17a2] !== 0x42 && W[0x17a2] !== 0x43) continue;
      this.inc(0x22f0, 3);
      this.cp(0x22e0, 0x179f, 3);
      if (this.g(0x22e0, 3) === 'U  ') this.s(0x22e0, '   ');
      if (this.g(0x22f0, 3) === '001') this.cp(0x22e8, 0x22e0, 3);
      if (this.g(0x22f0, 3) > '001' && this.g(0x22e8, 3) !== this.g(0x22e0, 3))
        this.errore('20  ', '20', "Documento Su Piu' Zone Censuarie. Procedura Interrotta");
      if (W[0x17a2] === 0x41) this.inc(0x2580, 4);
      if (this.g(0x17a2, 3) === 'A10') this.inc(0x2588, 4);
      this.pd(0x2578, 4, this.d(0x2580, 4) + this.d(0x2588, 4));
    }
    this.cp(0x988, 0x1b90, 16);
    if (!this.leggi(this.doc.key(this.g(0x988, 16)))) this.errore(null, this.st, '');
  }

  /** dati del fabbricato dal modello 1N parte I (record B) */
  private p3cfb() {
    this.cp(0x1700, 0x1bf8, 350);
    this.cp(0x2540, 0x176b, 18);
    const tot = this.d(0x1751, 3) + this.d(0x1754, 2) + this.d(0x1756, 3) + this.d(0x1759, 2) + this.d(0x175b, 2)
      + this.d(0x175d, 3) + this.d(0x1760, 2) + this.d(0x1762, 2) + this.d(0x1764, 2);
    this.pd(0x2380, 4, tot);
    const z = (x: number, n: number) => this.g(x, n) === '0'.repeat(n);
    if (z(0x176b, 3) && z(0x1771, 3) && z(0x176e, 3) && this.g(0x2380, 4) === '0001') {
      this.s(0x2552, '000010');
    } else {
      if (z(0x176b, 3)) this.pd(0x2552, 6, ((this.d(0x1771, 3) + this.d(0x176e, 3)) * 5) & 0xffff);
      else this.s(0x2552, '00' + this.g(0x176b, 3) + '0');
      if (this.g(0x2552, 6) === '000000') this.s(0x2552, '000010');
      if ('000020' <= this.g(0x2552, 6)) {
        if (!z(0x1754, 2)) {
          this.pd(0x2552, 6, Math.abs(this.d(0x2552, 6) - 10));
        } else {
          const tutti = !(z(0x1756, 3) || z(0x1759, 2) || z(0x175b, 2) || z(0x175d, 3) || z(0x1760, 2) || z(0x1762, 2) || z(0x1764, 2));
          if (!tutti && z(0x1774, 3) && z(0x177a, 3)) this.pd(0x2552, 6, Math.abs(this.d(0x2552, 6) - 10));
          if (this.g(0x2552, 6) === '000000') this.s(0x2552, '000010');
        }
      }
    }
    this.cp(0x2558, 0x17c5, 8);
    this.cp(0x2560, 0x1751, 21);
    this.pd(0x2388, 4, this.d(0x2560, 3) + this.d(0x256a, 2));
  }

  /** prima unità A: dati del fabbricato dai record B e C del modello 1N parte I */
  private p4146() {
    const W = this.W;
    W[0x1eb8] = 0x31;
    this.cp(0x1700, 0x1bf8, 350);
    if (this.g(0x1747, 4) !== '0000') this.cp(0x2590, 0x1747, 4);
    else this.cp(0x2590, 0x1743, 4);
    W[0x2594] = W[0x174b]; W[0x2595] = W[0x174c];
    this.cp(0xc4f, 0x174e, 3);
    this.cp(0x2596, 0x1767, 3);
    this.cp(0x1bb8, 0x177d, 4); this.cp(0x1bc0, 0x1781, 4);
    this.pd(0x2599, 5, this.d(0x1bb8, 4) + this.d(0x1bc0, 4));
    this.flag20(0x1795, 8);
    if (W[0x1bce] === 0x31) W[0x259e] = 0x31;
    this.flag20(0x17ba, 7);
    if (W[0x1bcc] === 0x31) W[0x259f] = 0x31;
    if (W[0x1bcd] === 0x31) W[0x259e] = 0x31;
    this.pd(0x2498, 7, (this.d(0x17c5, 4) + this.d(0x17c9, 4)) * 10);
    this.cp(0x1700, 0x1d58, 350);
    this.flag20(0x173c, 15);
    if (W[0x1bcd] === 0x31) W[0x25a0] = 0x31;
    if (W[0x1bd3] === 0x31) this.s(0x25a1, '00' + this.g(0x174b, 2));
    if (W[0x1bd4] === 0x31) this.pd(0x25a1, 4, this.d(0x25a1, 4) + this.d(0x2596, 3));
    if (this.g(0x2596, 3) !== '000') {
      const num = this.d(0x25a1, 4) * 10;
      const den = this.d(0x2596, 3);
      if (den) this.pd(0x25a1, 4, Math.floor((Math.floor(num / den) + 5) / 10));
    }
    const coppia = (a: number, na: number, b: number, nb: number) => {
      this.fill(0x1bc8, 20, 0x30); this.fill(0x1be0, 20, 0x30);
      this.s(0x1bc8, this.g(a, na) + ' '.repeat(20 - na)); this.s(0x1be0, this.g(b, nb) + ' '.repeat(20 - nb));
    };
    coppia(0x176b, 8, 0x1773, 8);
    if ((W[0x1bca] === 0x31 && W[0x1be2] === 0x31) || (W[0x1bca] === 0x31 && W[0x1be3] === 0x31)
      || (W[0x1bcb] === 0x31 && W[0x1be2] === 0x31) || (W[0x1bcb] === 0x31 && W[0x1be3] === 0x31)) {
      this.incw(0x2370); W[0xc5c] = 0x31;
    }
    coppia(0x17b3, 6, 0x17b9, 6);
    if (W[0x1bc8] === 0x31 && W[0x1be0] === 0x31) { this.incw(0x2370); W[0xc5d] = 0x31; }
    coppia(0x17ce, 7, 0x17d5, 7);
    if (W[0x1bcd] === 0x31 && W[0x1be5] === 0x31) { this.incw(0x2370); W[0xc5e] = 0x31; }
  }

  /** aggregati delle unità A (dal record H del modello 1N parte II) */
  private p45e6() {
    const W = this.W;
    this.cp(0x1700, 0x1ec0, 350);
    this.inc(0x2538, 3);
    this.flag20(0x17f9, 9);
    if (W[0x1bc8] === 0x31) this.inc(0x2358, 4);
    this.pde(0x239f, 7, this.de(0x239f, 7) + (this.de(0x1774, 5) + this.de(0x177b, 5) + this.de(0x1782, 5)) * 10);
    this.pd(0x23a0, 5, this.d(0x23a0, 5) + this.d(0x176a, 5));
    this.pd(0x23a8, 7, this.d(0x23a8, 7) + this.d(0x176f, 5) * 10);
    if (this.g(0x1774, 2) > '00') this.p49d0();
    this.pd(0x23b8, 7, this.d(0x23b8, 7) + this.d(0x1776, 5) * 10);
    if (this.g(0x177b, 2) !== '00') {
      this.inc(0x2460, 5);
      this.pd(0x2468, 5, this.d(0x2468, 5) + this.d(0x177b, 2));
      this.pd(0x2470, 7, this.d(0x2470, 7) + this.d(0x177d, 5) * 10);
    }
    if (this.g(0x1787, 4) !== '0000') {
      this.inc(0x2478, 5);
      this.pd(0x2480, 5, this.d(0x2480, 5) + this.d(0x1787, 4));
      this.pd(0x2488, 7, this.d(0x2488, 7) + this.d(0x178b, 5) * 10);
    }
    this.pd(0x2490, 7, this.d(0x2490, 7) + this.d(0x179a, 5) * 10);
  }

  /** tabella delle frequenze del campo H 0x74 (al più 20 valori) */
  private p49d0() {
    let i = 1;
    for (;;) {
      this.pd(0x23c0, 2, i);
      const e = 0x23e8 + 6 * (i - 1);
      if (this.g(e, 6) === '000000') {
        this.inc(0x23d0, 2);
        const n = this.d(0x23d0, 2);
        this.cp(0x23e8 + 6 * (n - 1), 0x1774, 2);
        this.s(0x23ea + 6 * (n - 1), '0001');
        return;
      }
      if (this.g(e, 2) === this.g(0x1774, 2)) { this.inc(e + 2, 4); return; }
      i++;
      if (i > 20) throw new Error('NZCT02: tabella 0x23e8 piena (errore di Docfa)');
    }
  }

  /** medie di fabbricato delle unità A */
  private p4b71() {
    const W = this.W;
    const nc = this.g(0x2528, 3) === 'NC ';
    const div = (num: number, denX: number, denN: number, dstEnd: number, n: number, rnd = true) => {
      const den = this.de(denX, denN);
      if (den) {
        const q = Math.floor(num / den);
        this.pde(dstEnd, n, rnd ? Math.floor((q + 5) / 10) : q);
      }
    };
    div(this.de(0x235c, 4) * 100, 0x253b, 3, 0x2364, 4, false);
    if (W[0x25a0] === 0x30 && this.g(0x2360, 4) > '0050') W[0x25a0] = 0x31;
    const dn: [number, number] = nc ? [0x253b, 3] : [0x2584, 4];
    div(this.de(0x239f, 7) * 10, dn[0], dn[1], 0x25aa, 5);
    div(this.de(0x23a5, 5) * 100, dn[0], dn[1], 0x25af, 5);
    div(this.de(0x23af, 7) * 10, dn[0], dn[1], 0x25b4, 5);
    div(this.de(0x23bf, 7) * 10, dn[0], dn[1], 0x25bc, 5);
    if (this.g(0x2460, 5) !== '00000') {
      div(this.de(0x246d, 5) * 100, 0x2465, 5, 0x25c1, 5);
      div(this.de(0x2477, 7) * 10, 0x2465, 5, 0x25c6, 5);
    }
    if (this.g(0x2478, 5) !== '00000') {
      div(this.de(0x2485, 5) * 100, 0x247d, 5, 0x25c9, 3);
      div(this.de(0x248f, 7) * 10, 0x247d, 5, 0x25ce, 5);
    }
    div((this.de(0x249f, 7) + this.de(0x2497, 7)) * 10, dn[0], dn[1], 0x25d3, 5);
    if (this.g(0x2552, 6) === '000000') this.s(0x2390, '000010');
    else this.cp(0x2390, 0x2552, 6);
    if (this.g(0x2596, 3) === '000') {
      div(this.de(0x238c, 4) * 1000, 0x2396, 6, 0x25d7, 4);
      this.s(0x25d7, this.g(0x238a, 2) + '0');
    } else {
      const den = this.de(0x2396, 6) * this.de(0x2599, 3);
      if (den) this.pde(0x25d7, 4, Math.floor((Math.floor((this.de(0x238c, 4) * 1000) / den) + 5) / 10));
      div(this.de(0x238c, 4) * 100, 0x2599, 3, 0x25da, 3);
    }
    this.p5226();
  }

  /** valore più frequente nella tabella 0x23e8 (a pari frequenza il codice minore) */
  private p5226() {
    const W = this.W;
    const n = this.d(0x23d0, 2);
    if (n === 0) { this.s(0x25b4, '010'); return; }
    if (n === 1) { this.cp(0x25b4, 0x23e8, 2); W[0x25b6] = 0x30; return; }
    const E = (i: number) => 0x23e8 + 6 * (i - 1);
    const scambia = (i: number, j: number) => { const a = this.g(E(i), 6); const b = this.g(E(j), 6); this.s(E(i), b); this.s(E(j), a); };
    for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) if (this.g(E(j) + 2, 4) > this.g(E(i) + 2, 4)) scambia(i, j);
    if (this.g(E(2) + 2, 4) !== this.g(E(1) + 2, 4)) { this.cp(0x25b4, 0x23e8, 2); W[0x25b6] = 0x30; return; }
    let k = 3;
    while (k <= n && this.g(E(k) + 2, 4) === this.g(E(1) + 2, 4)) k++;
    const m = k - 1;
    for (let i = 1; i <= m; i++) for (let j = i + 1; j <= m; j++) if (this.g(E(j), 2) < this.g(E(i), 2)) scambia(i, j);
    this.cp(0x25b4, 0x23e8, 2); W[0x25b6] = 0x30;
  }

  /** C06: somme e conteggi per tipo di posto auto (record I) */
  private p57a0() {
    const W = this.W;
    W[0x24c0] = 0x31;
    const cat = this.g(0x17c6, 50);
    const tipi: [string, number, number, number][] = [
      ['POSTO AUTO COPERTO', 0x24e7, 0x24e7, 0x2510],
      ['POSTO AUTO SCOPERTO', 0x24f2, 0x24f2, 0x2516],
      ['BOX', 0x24fd, 0x24fd, 0x251c],
      ['AUTORIMESSA COLLETTIVA', 0x2508, 0x2508, 0x2522],
    ];
    for (const [nome, cnt, som, som2] of tipi) {
      if (cat !== nome.padEnd(50, ' ')) continue;
      W[0x24c0] = 0x31;
      this.inc(cnt, 4);
      this.cp(0x1700, 0x1ec0, 350);
      this.pde(som, 7, this.de(som, 7) + (this.de(0x1776, 5) + this.de(0x1783, 5)) * 10);
      this.pd(som2, 6, this.d(som2, 6) + this.d(0x17e6, 3));
      this.cp(0x1700, 0x2020, 350);
    }
  }

  /** C06: medie per tipo di posto auto */
  private p5bf0() {
    const W = this.W;
    W[0x24d0] = 0x30;
    for (;;) {
      this.incw(0x24d0);
      const k = W[0x24d0] & 0xf;
      const o = 11 * k - 11;
      const cnt = this.de(0x24eb + o, 4);
      if (cnt) this.pde(0x24cf, 7, Math.floor(this.de(0x24e7 + o, 7) / cnt));
      this.cp(0x24e0 + o, 0x24c8, 7);
      const o2 = 6 * k - 6;
      if (cnt) this.pde(0x24cf, 7, Math.floor((this.de(0x2516 + o2, 6) * 10) / cnt));
      this.cp(0x2510 + o2, 0x24c8, 6);
      if (!(W[0x24d8] > W[0x24d0])) break;
    }
  }

  private p5d9f() {
    const W = this.W;
    if (W[0x25da] === 0x31) return;
    this.cp(0x1700, 0x1bf8, 350);
    W[0x25da] = [0x1754, 0x1759, 0x175b, 0x1760, 0x1762, 0x1764].every((x) => this.g(x, 2) === '00') ? 0x30 : 0x31;
  }

  /**
   * variazione: dati in atti (NZCT60). Senza l'archivio dell'Ufficio Docfa chiede i dati in due finestre; se non
   * ci sono risponde "1" (→ X0, esito 06 "Dati della uiu in atti non disponibili").
   * Con i dati (ricostruito dal codice di NZCT60, paragrafi 0x167a-0x1bb7, 0x1cad-0x2a56, 0x2e32-0x31e7):
   *  - tra le u.i.u. in atti di categoria A/1…A/9 presenti in TARIFFE (comune, zona della u.i.u.) quella con la
   *    tariffa più alta dà categoria e classe in 0x3ebd/0x3ec0; lo stesso per le categorie del fabbricato in 0x3ec3/0x3ec6;
   *  - per ogni categoria del fabbricato la classe più elevata: A01-A11 da 0x3e88, B01-B08 da 0x3e9e, C01-C07 da 0x3eae;
   *  - il flag 0x3ebc resta "0" se c'è almeno un dato, altrimenti "1".
   */
  private p5e16() {
    const d = this.inAtti;
    this.L58[0x3ebc] = 0x31;
    if (d) {
      const comune = this.L58g(0, 5);
      const zona = this.L58g(0x3ec8, 3) === 'U  ' ? '   ' : this.L58g(0x3ec8, 3);
      const tariffa = (cat: string, cl: string) => d.tar.find((x) => x.slice(0, 5) === comune && x.slice(5, 8) === zona && x.slice(8, 11) === cat && x.slice(11, 13) === cl)?.slice(13, 20);
      const piuAlta = (lista: { categoria: string; classe: string }[]): [string, string] => {
        let m: [string, string, string] | null = null;
        for (const x of lista) {
          if (x.categoria[0] !== 'A' || x.categoria.slice(1, 3) >= '10') continue;
          const t = tariffa(x.categoria, x.classe);
          if (t !== undefined && (!m || t > m[2])) m = [x.categoria, x.classe, t];
        }
        return m ? [m[0], m[1]] : ['   ', '  '];
      };
      const [ca, cla] = piuAlta(d.unita);
      this.L58s(0x3ebd, ca); this.L58s(0x3ec0, cla);
      const [cf, clf] = piuAlta(d.fabbricato);
      this.L58s(0x3ec3, cf); this.L58s(0x3ec6, clf);
      const BASE: Record<string, [number, number]> = { A: [0x3e88, 11], B: [0x3e9e, 8], C: [0x3eae, 7] };
      for (const x of d.fabbricato) {
        const b = BASE[x.categoria[0]];
        const n = Number(x.categoria.slice(1, 3));
        if (!b || !(n >= 1 && n <= b[1])) continue;
        const a = b[0] + 2 * (n - 1);
        if (this.L58g(a, 2) < x.classe) this.L58s(a, x.classe);
      }
      const conInAtti = d.unita.some((x) => x.categoria.trim());
      const conFabbricato = this.L58g(0x3e88, 52).trim() !== '';
      if (conInAtti || conFabbricato) this.L58[0x3ebc] = 0x30;
    }
    if (this.L58[0x3ebc] === 0x31) this.L54.set(daStringa('X0'), 6);
    else if (this.L58[0x3ebc] === 0x39) {
      this.L54.set(daStringa('BB'), 6);
      this.L54.set(daStringa('Classamento Automatico Annullato'.padEnd(70, ' ')), 9);
    }
  }

  risultato(): EsitoNzct02 {
    return { nclas: this.out, l54: aStringa(this.L54.subarray(0, 0x50)), l4c: this.L58g(0x3ea0, 0x40), out2: this.out2 };
  }
}

/**
 * Esegue NZCT02 sui record D3 del documento (350 caratteri latin1, in qualunque ordine).
 * Restituisce i record NCLAS1, l'area di stato L54, i dati della variazione (L58 da 0x3ea0) e il WorkFile 2.
 */
export function nzct02(doc: string[], inAtti?: DatiInAtti): EsitoNzct02 {
  const n = new N2();
  n.inAtti = inAtti;
  n.esegui(doc);
  return n.risultato();
}
