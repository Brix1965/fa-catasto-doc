/**
 * NZCT04 di Docfa 4: classe dell'unità.
 * Parte dalla classe "ordinaria" della microzona (tabella L58 di NZCT01) e la sposta nella tabella
 * delle classi presenti in TARIFFE (comune + zona + categoria) secondo le caratteristiche dell'unità:
 * gruppo A (FUN_e09), B (FUN_20dc), C (FUN_22fb).
 */
import { nv, val, ncu002, mod, div, ErroreDocfa } from './comune';

/** Differenza fra classi come _mF7804: due cifre, con il segno sull'ultima (p…y se negativa). */
function m7804(a: string, b: string): string {
  const d = nv(a) - nv(b);
  const s = String(Math.abs(d)).padStart(2, '0').slice(-2);
  return s[0] + (d < 0 ? String.fromCharCode(s.charCodeAt(1) + 0x40) : s[1]);
}

/** passi di classe da un campo di 2 cifre (0 se non maggiore di '00') */
function num(s: string): number {
  if (s <= '00') return 0;
  return (s.charCodeAt(0) & 0xf) * 10 + (s.charCodeAt(1) & 0xf);
}

/** confronto di '00'+x3 con t5 (byte per byte, come i numeri) */
function rel(x3: string, t5: string): number {
  const a = '00' + x3;
  return a > t5 ? 1 : a < t5 ? -1 : 0;
}

/** piano come numero con segno (T e vuoto = 0, S1 = -1, 2 = 2) */
function piano(p: string): number {
  let w = p;
  let w5c8 = '0000';
  if (w[0] >= '0' && w[0] <= '9') { w = ncu002(4, w).slice(0, 4); w5c8 = w; }
  if (w === '    ') w5c8 = '0000';
  if (w[0] === 'T') w5c8 = '0000';
  if (w[0] === 'S') {
    const r3 = ncu002(3, w.slice(1, 4)).slice(0, 3);
    return -mod(val(r3), 10000);
  }
  return val(w5c8);
}

class Fine extends Error {}

/** Docfa (COBOL con controllo degli indici) si ferma con l'errore runtime 153 "subscript out of range". */
export class ErroreRTS153 extends ErroreDocfa {
  constructor() { super('RTS153'); }
}

export class N4 {
  r: string[];
  cat: string;
  tab: [string, string][];
  w59d = '  ';
  w59b = '  ';
  w5a1 = '00';
  l44: Record<number, string> = {};
  e58 = '';

  /**
   * rec: record NCLAS1; v8: prospetto V8 della sezione; l58: tabella categorie di NZCT01 (voci da 7);
   * l4c: area dei dati in atti (da 0x3ea0); tar: classi presenti in TARIFFE nell'ordine del file; v7: record V7 (C).
   */
  constructor(rec: string, public v8: string, public l58: string, public l4c: string, tar: string[], public v7 = '') {
    this.r = rec.split('');
    this.cat = rec.slice(0x96, 0x99);
    this.tab = tar.slice(0, 100).map((c) => [this.cat, c] as [string, string]);
  }

  R(a: number, b: number): string { return this.r.slice(a, b).join(''); }
  W(a: number, s: string): void { for (let i = 0; i < s.length; i++) this.r[a + i] = s[i]; }
  L4(off: number, n = 1): string { return this.l4c.slice(off - 0x3ea0, off - 0x3ea0 + n).padEnd(n, ' '); }

  ent(k: number): [string, string] { return k >= 0 && k < this.tab.length ? this.tab[k] : ['   ', '  ']; }
  entChk(k: number): [string, string] {
    if (!(k >= 0 && k <= 99)) throw new ErroreRTS153();
    return this.ent(k);
  }

  cerca(): number {
    for (let k = 0; k < 100; k++) { const e = this.ent(k); if (e[0] === this.cat && e[1] === this.w59d) return k; }
    return 100;
  }

  /** FUN_4c22: sposta la classe di 'passi' voci della tabella tariffe; '1' in su, '0' in giù */
  sposta(passi: number, verso: string): void {
    if (passi <= 0) return;
    const k = this.cerca();
    let s: number;
    let k2: number;
    if (verso === '0') {
      s = passi > k ? k % 100 : passi;
      k2 = k - s;
      while (s !== 0 && this.entChk(k2)[0] !== this.cat) { s--; k2++; }
    } else {
      s = passi; k2 = k + s;
      while (s !== 0 && this.entChk(k2)[0] !== this.cat) { s--; k2--; }
    }
    if (k2 < 0 || k2 > 99) { this.W(0xb4, '04'); throw new Fine(); }
    this.w59d = this.ent(k2)[1];
  }

  adj(verso: string, campo?: number, inv = false, passi = 1): void {
    const old = this.w59d;
    this.sposta(passi, verso);
    if (campo !== undefined) {
      const su = (verso === '1') !== inv;
      this.l44[campo] = su ? m7804(this.w59d, old) : m7804(old, this.w59d);
    }
  }

  // ---- gruppo A (FUN_e09)
  classeA(): void {
    const R = (a: number, b: number) => this.R(a, b);
    const v8 = this.v8;
    if (this.cerca() === 100) this.w59b = '09';
    if (this.w59b === '09') this.sposta(1, '0');
    const c2 = R(0x97, 0x99);
    const svano = '0' + R(0x133, 0x136);
    let i: number;
    let tb: [number, number, number];
    let lf: number;
    if (R(0xe1, 0xe4) > '002') {
      i = ({ '01': 1, '02': 2, '03': 3, '04': 4, '07': 5 } as Record<string, number>)[c2] ?? 0;
      tb = [0x1c9, 0x1d8, 0x1ec]; lf = 0x106;
    } else {
      i = ({ '02': 1, '03': 2, '04': 3, '07': 4, '08': 5 } as Record<string, number>)[c2] ?? 0;
      tb = [0x200, 0x20f, 0x223]; lf = 0x108;
    }
    if (i) {
      const t = nv(v8.slice(tb[0] + 3 * (i - 1), tb[0] + 3 * i));
      const p = nv(v8.slice(tb[1] + 4 * (i - 1), tb[1] + 4 * i));
      const q = nv(v8.slice(tb[2] + 4 * (i - 1), tb[2] + 4 * i));
      const hi = String(mod(div(t * 10000 + t * p + 5000, 10000), 10000)).padStart(4, '0');
      const lo = String(mod(div(Math.abs(t * 10000 - t * q) + 5000, 10000), 10000)).padStart(4, '0');
      if (hi !== '0000' && hi < svano) this.adj('1', lf, lf === 0x108);
      if (lo !== '0000' && lo > svano) this.adj('0', lf, lf === 0x108);
    }
    i = ({ '01': 1, '02': 2, '03': 3, '04': 4, '07': 5, '08': 6, '10': 7 } as Record<string, number>)[c2] ?? 0;
    if (i && v8[0x237 + i - 1] <= R(0x136, 0x137)) this.adj('1', 0x10a);
    if (i) {
      const tipo = R(0x69, 0x6d);
      const off = tipo === 'T   ' ? 0x23e : tipo === 'S1  ' ? 0x24c : null;
      if (off !== null && '0' + v8.slice(off + 2 * (i - 1), off + 2 * i) <= R(0xc1, 0xc4)) this.adj('0', 0x10c);
    }
    if (i) {
      if (v8.slice(0x25a + 3 * (i - 1), 0x25a + 3 * i) > R(0x126, 0x129)) this.adj('0', 0x10e);
      else if (v8.slice(0x26f + 3 * (i - 1), 0x26f + 3 * i) < R(0x126, 0x129)) this.adj('1', 0x10e);
    }
    const tot = nv(R(0xfb, 0x100)) + nv(R(0x102, 0x107)) + nv(R(0x109, 0x10e));
    if (i) {
      const x = tot ? mod(div(nv(R(0x129, 0x12e)), tot), 10000) : 0;
      if (!(nv(v8.slice(0x2ae + 3 * (i - 1), 0x2ae + 3 * i)) > x * 100)) this.adj('0', 0x110);
    }
    const x = tot ? mod(div(nv(R(0x117, 0x11c)), tot), 10000) : 0;
    if (!(nv(v8.slice(0x2ce, 0x2d2)) > x * 100)) { this.adj('1', 0x112); this.W(0x182, 'F3'); }
  }

  // ---- gruppo B (FUN_20dc)
  classeB(): void {
    if (this.w59d !== '  ') return;
    const n = this.tab.length;
    if (n <= 4) { this.w59d = n ? this.tab[n - 1][1] : '  '; return; }
    const m = (n === 100 ? 99 : n % 100) - 4;
    const x = m * 5;
    this.w59d = String(div(x, 10) + (x % 10 ? 1 : 0) + 4).padStart(2, '0');
  }

  // ---- gruppo C (FUN_22fb)
  classeC(): void {
    const R = (a: number, b: number) => this.R(a, b);
    const s = mod(val(R(0xff, 0x104)) + val(R(0x10c, 0x111)), 1e7);
    const S = String(s).padStart(7, '0');
    this.l44[0x6b] = S.slice(1);
    const n = R(0x97, 0x99);
    const k = ({ '01': 0, '02': 1, '03': 2, '04': 9, '05': 9, '06': 3, '07': 8 } as Record<string, number>)[n] ?? 0;
    if (this.w59d === '  ') { this.W(0xb4, '03'); return; }
    if (k === 8) return;
    const V = k !== 9 ? this.v7.slice(k * 170, (k + 1) * 170) : '';
    if (this.cerca() === 100) this.w59b = '09';
    if (this.w59b === '09') this.sposta(1, '0');
    if (k === 9) return;
    const x = R(0x14a, 0x14d);
    const soglie = (val5: string, log: number, diretto = false) => {
      const ok = diretto ? (t: string) => val5 <= t : (t: string) => S <= '00' + t;
      if (ok(V.slice(7, 12))) return;
      if (ok(V.slice(12, 17))) this.adj('0', log, false, 1);
      else if (ok(V.slice(17, 22))) this.adj('0', log, false, 2);
      else if (ok(V.slice(22, 27))) this.adj('0', log, false, 3);
      else if (ok(V.slice(0x1d, 0x22))) this.adj('0', log, false, num(V.slice(0x1b, 0x1d)));
      else this.adj('0', log, false, num(V.slice(0x22, 0x24)));
    };
    const sali = (t1: string, t2: string, t3: string, log: number) => {
      if (rel(x, t1) >= 0 && rel(x, t2) <= 0) this.adj('1', log, false, 1);
      if (rel(x, t2) > 0 && rel(x, t3) <= 0) this.adj('1', log, false, 2);
    };
    if (k === 0) {
      soglie(S, 0x90);
      sali(V.slice(0x83, 0x88), V.slice(0x88, 0x8d), V.slice(0x8d, 0x92), 0x92);
    } else if (k === 1) {
      soglie(S, 0x94);
      if (rel(x, V.slice(0x29, 0x2e)) < 0) this.adj('0', 0x96, false, 1);
      sali(V.slice(0x2e, 0x33), V.slice(0x33, 0x38), V.slice(0x38, 0x3d), 0x96);
      this.l44[0x67] = R(0x69, 0x6d); this.l44[0xb6] = V.slice(0x3f, 0x43); this.l44[0xba] = V.slice(0x45, 0x49);
      const u = piano(R(0x69, 0x6d)); const p2 = piano(V.slice(0x3f, 0x43)); const p3 = piano(V.slice(0x45, 0x49));
      if (!(p2 > u)) this.adj('0', 0x98, false, num(V.slice(0x3d, 0x3f)));
      if (!(p3 < u)) this.adj('0', 0x9a, false, num(V.slice(0x43, 0x45)));
      if (R(0x149, 0x14a) === '0') this.adj('0', 0x9c, false, num(V.slice(0x49, 0x4b)));
    } else if (k === 2) {
      soglie(S, 0x9e);
      sali(V.slice(0x29, 0x2e), V.slice(0x2e, 0x33), V.slice(0x33, 0x38), 0xa0);
      this.l44[0x67] = R(0x69, 0x6d);
      const u = piano(R(0x69, 0x6d)); const p = piano(V.slice(0x3a, 0x3e));
      if (!(p < u)) this.adj('0', 0xa2, false, num(V.slice(0x38, 0x3a)));
      if (R(0x149, 0x14a) === '0') this.adj('0', 0xa4, false, num(V.slice(0x3e, 0x40)));
    } else if (k === 3) {
      soglie(R(0x157, 0x15c), 0xa6, true);
      const f6 = R(0xf6, 0xf7);
      if (f6 !== '2') {
        sali(V.slice(0x29, 0x2e), V.slice(0x2e, 0x33), V.slice(0x33, 0x38), 0xa8);
        const u = piano(R(0x69, 0x6d));
        this.l44[0x67] = R(0x69, 0x6d);
        if (u < 0) this.adj('0', 0xaa, false, num(V.slice(0x38, 0x3a)));
      }
      if (f6 === '1') this.adj('0', 0xac, false, num(V.slice(0x3a, 0x3c)));
      if (f6 === '2') this.adj('0', 0xae, false, num(V.slice(0x3c, 0x3e)));
    }
  }

  /** Esegue NZCT04 e restituisce il record NCLAS1 aggiornato (classe in 0x99, esito in 0xb4). */
  esegui(): string {
    try {
      this.main();
    } catch (e) {
      if (!(e instanceof Fine)) throw e;
    }
    this.l44[0x55] = this.w59d;
    this.l44[0x4e] = this.R(0xb5, 0xb6);
    this.l44[0x64] = this.w5a1;
    if (this.R(0x182, 0x184) === 'F3') this.l44[0x63] = '1';
    return this.r.join('');
  }

  private main(): void {
    const R = (a: number, b: number) => this.R(a, b);
    this.W(0x99, '  ');
    if (!this.tab.length) { this.W(0xb4, '02'); throw new Fine(); }
    let j = 0;
    let e: string;
    for (;;) {
      e = this.l58.slice(7 * j, 7 * j + 7); j++;
      if (e[0] === R(0x96, 0x97) && e.slice(1, 3) === R(0x97, 0x99)) break;
      if (7 * j > this.l58.length) throw new ErroreRTS153();
    }
    this.e58 = e;
    this.w59d = e.slice(3, 5);
    const w5bd = e.slice(3, 5);
    const caus = R(0xb1, 0xb4);
    const fl4 = this.L4(0x3ec2);
    let calc = false;
    if (caus === 'NC ' || fl4 === '1' || fl4 === '2') {
      calc = true;
    } else {
      if (caus !== 'RST' && (fl4 === '3' || fl4 === '4')) {
        if (caus === 'AF2' && this.cat[0] === 'A') {
          if (this.L4(0x3ec6, 2) !== '  ') this.w59d = this.L4(0x3ec6, 2);
        } else if (this.cat[0] === 'A') {
          this.w59d = this.L4(0x3ec0, 2) !== '  ' ? this.L4(0x3ec0, 2) : this.L4(0x3ec6, 2);
        } else if (this.cat[0] === 'C') {
          const n = nv(this.cat.slice(1, 3));
          this.w59d = this.L4(0x3eae + 2 * (n - 1), 2);
        }
      } else {
        if (this.cat[0] === 'A') this.w59d = this.L4(0x3ec0, 2) !== '  ' ? this.L4(0x3ec0, 2) : this.L4(0x3ec6, 2);
        if (this.w59d === '  ') calc = true;
        else {
          const i = ({ '01': 1, '02': 2, '03': 3, '04': 4, '07': 5, '08': 6, '10': 7 } as Record<string, number>)[R(0x97, 0x99)] ?? 0;
          if (i && this.v8[0x237 + i - 1] <= R(0x136, 0x137)) this.sposta(1, '1');
        }
      }
      if (!calc) {
        if (this.w59d === '  ') {
          if (w5bd === '  ') calc = true;
          else this.w59d = w5bd;
        }
        if (!calc) {
          if (this.cerca() === 100) this.sposta(1, '0');
          this.W(0x99, this.w59d);
          return;
        }
      }
    }
    // 0x834
    const fl = e[6];
    if (fl === '2') { this.W(0x99, this.w59d); return; }
    if (e[0] !== 'B') {
      if (fl === '0') { this.W(0xb4, '03'); throw new Fine(); }
      if (fl === '3') { this.W(0xb4, '02'); throw new Fine(); }
    }
    if (this.cat[0] === 'A') this.classeA();
    if (this.cat[0] === 'B') this.classeB();
    if (this.cat[0] === 'C') this.classeC();
    const es = R(0xb4, 0xb6);
    if (es === '02' || es === '03') throw new Fine();
    if (this.w59d === 'U ' || e.slice(3, 5) === 'U ') { this.W(0x99, this.w59d); return; }
    const ref = e.slice(3, 5) !== '  ' ? e.slice(3, 5) : '00';
    if (e.slice(3, 5) === '  ') { const j0 = 7 * (j - 1); this.l58 = this.l58.slice(0, j0 + 3) + '00' + this.l58.slice(j0 + 5); }
    this.w5a1 = m7804(this.w59d, ref);
    if (ref === this.w59d) this.l44[0x61] = '2';
    else if (ref > this.w59d) this.l44[0x61] = '1';
    else this.l44[0x61] = '3';
    this.W(0x99, this.w59d);
  }
}
