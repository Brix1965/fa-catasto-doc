/**
 * NZCT05 di Docfa 4: consistenza dell'unità (vani per il gruppo A, m³ per il B, m² per il C),
 * scritta nel record NCLAS1 alle posizioni 0x9b-0xa1 (7 caratteri, es. "    4,5").
 */
import { nv, f, div } from './comune';

/** divisione per 10 arrotondata (come _mF7912 con 1 cifra) */
const arr10 = (x: number) => div(x + 5, 10);

export class N5 {
  /** working storage che resta da un'unità all'altra (valori iniziali del programma) */
  w: Record<number, string> = {
    0x270: '00000', 0x258: '0000000', 0x2b8: '000000', 0x2f8: '0000000', 0x290: '00000',
    0x248: '000000', 0x250: '000000', 0x2e8: '0000000', 0x280: '00000',
  };
  l44: Record<number, string> = {};
  private r: string[] = [];
  private v8 = '';
  private v7 = '';
  private tb = '';

  /** rec: record NCLAS1; v8: prospetto V8; v7c01: record V7 della C01; tb: tabella del gruppo B (V8A) */
  esegui(rec: string, v8: string, v7c01: string, tb: string): string {
    this.r = rec.split(''); this.v8 = v8; this.v7 = v7c01; this.tb = tb;
    this.l44 = { 0x62: '1', 0x57: '0000000' };
    this.W(0x9b, '0000000');
    const c = rec[0x96];
    if (c === 'A') this.consA();
    if (c === 'B') this.consB();
    if (c === 'C') this.consC();
    return this.r.join('');
  }

  private R(a: number, b: number): string { return this.r.slice(a, b).join(''); }
  private W(a: number, s: string): void { for (let i = 0; i < s.length; i++) this.r[a + i] = s[i]; }

  // ---------------- gruppo A: vani
  private consA(): void {
    const R = (a: number, b: number) => this.R(a, b);
    const { v8, w, l44: L } = this;
    const cat = R(0x96, 0x99);
    const k = ({ A01: 1, A02: 2, A03: 3, A04: 4, A07: 5, A08: 6, A10: 7, A05: 9, A06: 9, A09: 9 } as Record<string, number>)[cat] ?? 0;
    let w260 = '00000';
    const w2c0 = f(nv(v8.slice(0x2c3, 0x2c6)) * 2, 3);
    const stot = nv(R(0xfb, 0x100)) + nv(R(0x102, 0x107)) + nv(R(0x109, 0x10e));
    const w240 = f(stot * 100, 8);
    let w2a8 = '0' + (R(0x100, 0x102) === '00' ? R(0x15b, 0x15d) : R(0x100, 0x102));
    let w2e0 = R(0x165, 0x168);
    if (w2e0.slice(0, 2) === '00') w2e0 = '01' + w2e0[2];
    if (R(0x109, 0x10e) === '00000' || R(0x107, 0x109) !== '00') w2a8 = f(nv(w2a8) + nv(R(0x107, 0x109)), 3);
    else w2a8 = f(nv(w2a8) + nv(w2e0.slice(0, 2)), 3);
    w2e0 = R(0x16d, 0x170);
    if (w2e0.slice(0, 2) === '00') w2e0 = '01' + w2e0[2];
    const w2b0 = R(0x112, 0x117) !== '00000' && R(0x10e, 0x112) === '0000' ? '0' + w2e0.slice(0, 2) : R(0x10f, 0x112);
    if (k !== 9) {
      const vm = v8.slice(0x284 + 3 * (k - 1), 0x287 + 3 * (k - 1));
      if (vm === '999') {
        this.W(0x9b, 'NO     '); this.W(0xb4, '04'); L[0x4e] = '4'; L[0x62] = '2';
        return;
      }
      const d = nv(vm);
      if (d) w[0x2b8] = f(div(div(nv(R(0xfb, 0x100)) * 1000, d) + 5, 10), 6);
      if (nv(R(0xf6, 0xfb)) * 100 >= nv(w[0x2b8])) { L[0x158] = '000'; w[0x270] = '00000'; }
      else { w[0x270] = f(nv(w[0x2b8]) - nv(R(0xf6, 0xfb)) * 100, 5); L[0x158] = vm; }
      L[0x15b] = '0';
    }
    const x = (nv(R(0xf6, 0xfb)) * 100 + nv(w[0x270])) * 10 + div(nv(w2a8) * 1000, 3) + ((nv(w2b0) * 25) & 0xffff) * 10;
    w[0x2e8] = f(div(x + 5, 10), 7);
    L[0x118] = w240.slice(3, 6);
    L[0x11b] = R(0xfd, 0x100) + '0';
    L[0x11f] = R(0x114, 0x117) + '0';
    L[0x123] = R(0x119, 0x11c) + '0';
    L[0x127] = R(0x122, 0x126) + '0';
    L[0x12c] = R(0xf6, 0xfb);
    L[0x131] = w2a8; L[0x134] = w2b0; L[0x137] = w[0x270]; L[0x13c] = w[0x2e8].slice(2, 7);
    if (k !== 9) {
      L[0x141] = '00000'; L[0x146] = '00';
      if (w2b0 !== '000') {
        const d = nv(w2b0);
        if (d) w[0x258] = f(div(div(nv(R(0x112, 0x117)) * 10000, d) + 5, 10), 7);
        L[0x141] = w[0x258].slice(1, 6);
        const t = v8.slice(0x2c3, 0x2c6);
        if (t !== '999') {
          const v = nv(w[0x258]);
          if (!(nv(w2c0) * 1000 > v)) { w260 = '01000'; L[0x146] = '10'; }
          else if (!(nv(t) * 1000 > v)) { w260 = '00500'; L[0x146] = '05'; }
        }
      }
      L[0x148] = '00000'; L[0x14d] = '00';
      const d = nv(w240);
      if (d) w[0x258] = f(div(div(nv(R(0x117, 0x11c)) * 1e6, d) + 5, 10), 7);
      L[0x148] = w[0x258].slice(2, 7);
      if (R(0x182, 0x184) !== 'F3') {
        const v = nv(w[0x258]); const t1 = v8.slice(0x2ca, 0x2ce); const t2 = v8.slice(0x2c6, 0x2ca);
        let fatto = false;
        if (t1 !== '9999' && !(nv(t1) * 10 > v)) { w260 = f(nv(w260) + 1000, 5); L[0x14d] = '10'; fatto = true; }
        if (!fatto && t2 !== '9999' && !(nv(t2) * 10 > v)) { w260 = f(nv(w260) + 500, 5); L[0x14d] = '05'; }
      }
      L[0x14f] = '00000'; L[0x154] = '00';
      if (d) w[0x258] = f(div(div(nv(R(0x121, 0x126)) * 1e6, d) + 5, 10), 7);
      L[0x14f] = w[0x258].slice(2, 7);
      const tab: Record<string, [number, number]> = { A01: [0x2d2, 0x2e6], A02: [0x2d6, 0x2ea], A03: [0x2da, 0x2ee], A04: [0x2de, 0x2f2] };
      let w2c8: string;
      let w2d0: string;
      if (tab[cat]) { const [a, b] = tab[cat]; w2c8 = v8.slice(a, a + 3); w2d0 = v8.slice(b, b + 3); }
      else if (cat === 'A07') { w2c8 = v8.slice(0x2e2, 0x2e5); w2d0 = '999'; }
      else { w2c8 = '999'; w2d0 = '999'; }
      const v = nv(w[0x258]);
      let fatto = false;
      if (w2d0 !== '999' && !(nv(w2d0) * 100 > v)) { w260 = f(nv(w260) + 1000, 5); L[0x154] = '10'; fatto = true; }
      if (!fatto && w2c8 !== '999' && !(nv(w2c8) * 100 > v)) { w260 = f(nv(w260) + 500, 5); L[0x154] = '05'; }
    }
    if (w260 > '01000') w260 = '01000';
    L[0x156] = w260.slice(1, 3);
    const base = w[0x2e8];
    // moltiplicazione a 32 bit come in Docfa (il riporto oltre 2^32 si perde)
    const inc = div(((nv(base) * nv(w260)) % 4294967296) + 5000, 10000) % 10000;
    const tot = f(nv(base) + inc, 7);
    let ip = tot.slice(0, 5);
    let dec = tot.slice(5, 7);
    if ('00' <= dec && dec < '25') dec = '00';
    else if ('25' <= dec && dec < '75') dec = '50';
    else { dec = '00'; ip = f(nv(ip) + 1, 5); }
    if (ip === '00000') { ip = '00001'; dec = '00'; }
    w[0x2e8] = ip + dec;
    const out = Array(7).fill(' ');
    const s = ip.replace(/^0+/, '');
    if (dec[0] === '5') {
      for (let i = 0; i < s.length; i++) out[5 - s.length + i] = s[i];
      out[5] = ','; out[6] = '5';
    } else {
      for (let i = 0; i < s.length; i++) out[7 - s.length + i] = s[i];
    }
    const res = out.join('');
    this.W(0x9b, res); L[0x57] = res;
  }

  // ---------------- gruppo B: metri cubi
  private consB(): void {
    const R = (a: number, b: number) => this.R(a, b);
    const { w, l44: L } = this;
    if (R(0x106, 0x10b) === '00000' || R(0xf6, 0xf8) === '00' || R(0xf8, 0xfe) === '000000') {
      w[0x270] = '00000';
    } else {
      const q = nv(R(0x106, 0x10b)) * nv(R(0xf6, 0xf8)) * 1000;
      const d = nv(R(0xf8, 0xfe));
      if (d) w[0x270] = f(div(div(q, d) + 5, 10), 5);
      L[0x68] = w[0x270];
      const ta = this.tb.slice(4, 9); const tb = this.tb.slice(9, 14);
      const [w310, w308] = tb > ta ? [tb, ta] : [ta, tb];
      if (w[0x270] >= w310) { L[0x67] = '1'; w[0x270] = f((nv(R(0xf8, 0xfe)) + nv(R(0x100, 0x106))) * 10, 5); }
      else if (w[0x270] >= w308) { L[0x67] = '2'; w[0x270] = f((nv(R(0xf8, 0xfe)) + nv(R(0x100, 0x106))) * 5, 5); }
      else w[0x270] = '00000';
    }
    // volume = (sup1 + sup2) × altezza (2 decimali), aritmetica decimale del runtime
    const v = (nv(R(0xf8, 0xfe)) + nv(R(0x100, 0x106))) * 100 - nv(w[0x270]);
    w[0x2f8] = f(div(Math.abs(v) + 50, 100), 7);
    this.formatta();
  }

  // ---------------- gruppo C: metri quadri
  private consC(): void {
    const R = (a: number, b: number) => this.R(a, b);
    const { w, l44: L, v7: V } = this;
    L[0x71] = R(0x111, 0x114) !== '   ' ? R(0x111, 0x114) : R(0x11e, 0x121);
    L[0x74] = f(nv(R(0x119, 0x11e)) + nv(R(0x126, 0x12b)), 6);
    L[0x7d] = R(0x12b, 0x12e) !== '   ' ? R(0x12b, 0x12e) : R(0x138, 0x13b);
    L[0x80] = f(nv(R(0x133, 0x138)) + nv(R(0x140, 0x145)), 6);
    L[0x89] = f(nv(R(0x15c, 0x161)) + nv(R(0x161, 0x166)), 6);
    if (R(0x96, 0x99) !== 'C01') {
      w[0x2f8] = f([0xff, 0x10c, 0x119, 0x126, 0x133, 0x140].reduce((t, a) => t + nv(R(a, a + 5)), 0), 7);
    } else {
      w[0x248] = '000000'; w[0x250] = '000000';
      if (!(R(0x119, 0x11e) === '00000' && R(0x126, 0x12b) === '00000')) {
        const p = R(0x111, 0x114) !== '   ' ? R(0x111, 0x114) : R(0x11e, 0x121);
        const coef = R(0x69, 0x6d) === p + ' ' ? V.slice(0x92, 0x95) : V.slice(0x95, 0x98);
        L[0x7a] = coef;
        w[0x248] = f(div((nv(R(0x119, 0x11e)) + nv(R(0x126, 0x12b))) * nv(coef) + 5, 10), 6);
      }
      if (!(R(0x133, 0x138) === '00000' && R(0x140, 0x145) === '00000')) {
        const p = R(0x12b, 0x12e) !== '   ' ? R(0x12b, 0x12e) : R(0x138, 0x13b);
        const coef = R(0x69, 0x6d) === p + ' ' ? V.slice(0x92, 0x95) : V.slice(0x95, 0x98);
        L[0x86] = coef;
        w[0x250] = f(div((nv(R(0x133, 0x138)) + nv(R(0x140, 0x145))) * nv(coef) + 5, 10), 6);
      }
      const s = (nv(R(0xff, 0x104)) + nv(R(0x10c, 0x111))) * 10 + nv(w[0x248]) + nv(w[0x250]);
      w[0x2f8] = f(arr10(s), 7);
    }
    const w288 = f(nv(R(0xff, 0x104)) + nv(R(0x10c, 0x111)), 6);
    L[0x67] = R(0xf7, 0xfa) + ' ';
    L[0x6b] = w288;
    const q = (nv(R(0x15c, 0x161)) + nv(R(0x161, 0x166))) * 10000;
    const d = nv(w288);
    if (d) w[0x290] = f(div(div(q, d) + 5, 10), 5);
    if ('00250' > w[0x290]) { L[0x8f] = '0'; w[0x280] = '00000'; }
    else {
      L[0x8f] = '1';
      w[0x280] = f(arr10(nv(w[0x2f8])), 5);
      w[0x2f8] = f(nv(w[0x2f8]) + nv(w[0x280]), 7);
    }
    this.formatta();
  }

  /** zeri iniziali sostituiti da spazi */
  private formatta(): void {
    const s = this.w[0x2f8].split('');
    for (let i = 0; i < 7; i++) { if (s[i] === '0') s[i] = ' '; else break; }
    const res = s.join('');
    this.W(0x9b, res); this.l44[0x57] = res;
  }
}
