/**
 * NZCT03 di Docfa 4: categoria dell'unità del gruppo A (A01, A02, A03, A04, A07, A08).
 * 80 condizioni sul vettore dell'unità (record NCLAS1 di NZCT02) e sul prospetto V8 della sezione,
 * matrice categoria/condizione, conteggio delle mancanze e spareggi.
 */
import { cifra, div, mod } from './comune';

const CATS = ['A01', 'A02', 'A03', 'A04', 'A07', 'A08'];
const DEFAULT: Record<string, number[]> = {
  A01: [3, 9, 16, 20, 24, 34, 41, 43, 49, 56, 66],
  A02: [4, 10, 16, 20, 24, 35, 39, 40, 44, 50, 56, 63, 67],
  A03: [5, 11, 17, 21, 25, 31, 32, 36, 39, 40, 45, 51, 56, 64, 68, 74],
  A04: [6, 12, 18, 22, 26, 28, 31, 32, 39, 40, 46, 52, 56, 69, 75],
  A07: [7, 13, 19, 23, 27, 29, 37, 40, 47, 53, 65, 70, 76],
  A08: [8, 14, 19, 30, 42, 48, 54, 71],
};

/** Stato della working storage che Docfa non reinizializza fra le unità (valori dell'unità precedente). */
export interface Stato03 { w428: number; w430: number; w458: number }

export function nuovoStato03(): Stato03 {
  return { w428: 0, w430: 0, w458: 0 };
}

/** Valore numerico di un campo (le cifre; altri caratteri valgono zero). */
function N(s: string): number {
  const t = s.trim();
  if (t !== '' && [...t].every(cifra)) return parseInt(t, 10);
  let v = 0;
  for (const c of s) v = v * 10 + (cifra(c) ? c.charCodeAt(0) - 48 : 0);
  return v;
}

function intero(s: string): number {
  return N(s);
}

type Matrice = Record<string, string[]>;

function matrice(v8: string, v3: string): Matrice {
  const m: Matrice = {};
  for (const c of CATS) m[c] = Array(80).fill('0');
  for (const c of CATS) for (const i of DEFAULT[c]) m[c][i] = '1';
  for (let g = 0; g < 3; g++) CATS.forEach((c, j) => { if (v8[4 + g * 6 + j] === '1') m[c][g] = '1'; });
  ['A01', 'A04', 'A07', 'A08'].forEach((c, k) => { if (v8[58 + k] === '1') m[c][15] = '1'; });
  ([[0, 31], [1, 32]] as const).forEach(([g, idx]) => CATS.forEach((c, j) => { if (v8[92 + g * 6 + j] === '1') m[c][idx] = '1'; }));
  ['A01', 'A02', 'A03', 'A07', 'A08'].forEach((c, k) => { if (v8[104 + k] === '1') m[c][33] = '1'; });
  for (const p of [217, 219, 221, 223, 225]) {
    const cod = v8.slice(p, p + 2);
    CATS.forEach((c, k) => { if (cod === c.slice(1)) m[c][57 + k] = '1'; });
  }
  [13, 14, 15, 16, 19, 20].forEach((off, k) => { if (v3[off] === '1') m[CATS[k]][78] = '1'; });
  return m;
}

function condizioni(rec: string, v8: string, st: Stato03): string[] {
  const c: string[] = Array(80).fill('0');
  const R = (a: number, b: number) => rec.slice(a, b);
  const pos = rec[0x13b];
  if (pos === '1' || pos === '0') { c[0] = '1'; c[1] = '1'; }
  else if (pos === '2') c[1] = '1';
  else c[0] = '1';
  if (rec[0x13c] === '0') c[2] = '1';
  if (pos === '3') {
    for (let i = 3; i < 15; i++) c[i] = '1';
  } else {
    const n = N(R(0xe1, 0xe4));
    for (let k = 0; k < 12; k++) {
      const t = N(v8.slice(0x16 + 3 * k, 0x19 + 3 * k));
      if ((k < 6 && t <= n) || (k >= 6 && t >= n)) c[3 + k] = '1';
    }
  }
  if (rec[0x181] === '0') c[15] = '1';
  const s = N(R(0x13d, 0x140));
  for (let k = 0; k < 4; k++) if (N(v8.slice(0x3e + 2 * k, 0x40 + 2 * k)) >= s) c[16 + k] = '1';
  // W420 resta '0000' (mai impostato in questo percorso)
  for (let i = 20; i < 28; i++) c[i] = '1';
  const piani = R(0xc1, 0xc4);
  if (piani === '000') {
    for (const i of [28, 29, 30]) c[i] = '1';
  } else {
    const a = N(R(0x17a, 0x17e));
    for (let k = 0; k < 3; k++) if (N(v8.slice(0x56 + 2 * k, 0x58 + 2 * k)) * 10 >= a) c[28 + k] = '1';
  }
  if (rec[0x145] === '0') c[31] = '1';
  if (rec[0x146] === '0') c[32] = '1';
  if (rec[0x147] === '1') c[33] = '1';
  if (piani === '000') {
    for (const i of [34, 35, 36, 37]) c[i] = '1';
  } else {
    for (let k = 0; k < 4; k++) {
      if (R(0x148, 0x14c) > '0000' || N(v8.slice(0x6d + 2 * k, 0x6f + 2 * k)) >= N(piani)) c[34 + k] = '1';
    }
  }
  if (piani === '000' || R(0x13d, 0x140) === '000') c[38] = '1';
  else if (R(0x148, 0x14c) < '0002') c[38] = '1';
  else if (piani < '008') { /* nulla */ }
  else if (R(0x17e, 0x181) < '240') { /* nulla */ }
  else c[38] = '1';
  const v = N(R(0x14c, 0x151));
  for (let k = 0; k < 4; k++) {
    const t = N(v8.slice(0x79 + 3 * k, 0x7c + 3 * k)) * 10;
    if ((k < 2 && t >= v) || (k >= 2 && t <= v)) c[39 + k] = '1';
  }
  const s5 = R(0x140, 0x145);
  for (let k = 0; k < 6; k++) {
    if (s5 >= v8.slice(0x85 + 5 * k, 0x8a + 5 * k)) c[43 + k] = '1';
    if (s5 <= v8.slice(0xa3 + 5 * k, 0xa8 + 5 * k)) c[49 + k] = '1';
  }
  if (N(v8.slice(0xc1, 0xc6)) * 10 <= N(R(0x175, 0x17a))) c[55] = '1';
  c[56] = c56(rec, v8, st);
  c57_62(rec, v8, st).forEach((x, i) => { c[57 + i] = x; });
  const anno = N(R(0x137, 0x13b));
  [0xe3, 0xe5, 0xe7].forEach((p, k) => {
    const yy = v8.slice(p, p + 2);
    const thr = parseInt('19' + (yy.length && [...yy].every(cifra) ? yy : '00'), 10);
    if (thr <= anno) c[63 + k] = '1';
  });
  const b = N(R(0x15b, 0x15e));
  for (let k = 0; k < 6; k++) {
    if (N(v8[0xe9 + k]) * 10 <= b) c[66 + k] = '1';
    if (N(v8[0xef + k]) * 10 >= b) c[72 + k] = '1';
  }
  return c;
}

/** soglia con il segno: '9999y' (cifra negativa 'y' = -9) vale -99999 */
function valore(t: string): number {
  return t.endsWith('y') ? -intero(t.slice(0, -1) + '9') : intero(t);
}

function c56(rec: string, v8: string, st: Stato03): string {
  const t1 = rec.slice(0xd3, 0xd9) === '000000' || v8.slice(0xc6, 0xcb) === '99999' ? '9999y' : v8.slice(0xc6, 0xcb);
  const t2 = v8.slice(0xcb, 0xcf) === '9999' ? '999y' : v8.slice(0xcb, 0xcf);
  const t3 = v8.slice(0xcf, 0xd4) === '99999' ? '9999y' : v8.slice(0xcf, 0xd4);
  if (t1 === '9999y' && t2 === '999y' && t3 === '9999y') return '1';
  const A = N(rec.slice(0xd3, 0xd9));
  const B5 = N(rec.slice(0x175, 0x17a));
  const D = N(rec.slice(0x14c, 0x151));
  if (D) {
    st.w428 = mod(div(div(A * B5 * 1000, D) + 5, 10), 1e8);
    st.w430 = mod(div(div(B5 * 10000, D) + 5, 10), 1e8);
  }
  const w438 = B5 * 100;
  if (st.w428 < valore(t1) * 10 || st.w430 < valore(t2) * 10 || w438 < valore(t3) * 100) return '1';
  return '0';
}

function c57_62(rec: string, v8: string, st: Stato03): string[] {
  const t = v8.slice(0xd4, 0xd9);
  if (t === '00000') return Array(6).fill('1');
  const F = N(rec.slice(0x14c, 0x151));
  if (F) st.w458 = mod(div(div(N(rec.slice(0x170, 0x175)) * 100, F) + 5, 10), 1e5);
  return Array(6).fill(N(t) > st.w458 * 10 ? '1' : '0');
}

const PRIO: Record<string, string> = { A01: '56', A02: '33', A03: '22', A04: '11', A07: '44', A08: '65' };
const PUNTI: Record<string, number> = { '1': 8, '2': 4, '3': 2 };
const pt = (c: string) => PUNTI[c] ?? 1;

function coppie(v8: string): [string, string][] {
  const codici = ['A02A03', 'A03A04', 'A07A04', 'A07A03', 'A07A02'];
  const t: [string, string][] = codici.map((cod, k) => [cod, v8.slice(0xf5 + 16 * k, 0x105 + 16 * k)]);
  t.push([v8.slice(0x145, 0x14b), v8.slice(0x14b, 0x15b)]);
  return t;
}

/** Spareggio fra X e Y con più di 2 abitazioni (FUN_374d). Restituisce [vincitore, finito]. */
function spareggioGt2(X: string, Y: string, rec: string, v8: string, st: Stato03): [string, boolean] {
  const tab = coppie(v8);
  let key: [string, string, string] | null = null;
  for (const [a, b] of [[Y, X], [X, Y]]) {
    for (const [cod, thr] of tab) if (cod === a + b) { key = [a, b, thr]; break; }
    if (key) break;
  }
  if (!key) return [X, true];
  const [first, second, thr] = key;
  const T = [thr.slice(0, 4), thr.slice(4, 8), thr.slice(8, 12), thr.slice(12, 16)];
  if (T.every((t) => t.slice(0, 3) === '999')) return [X, true];
  let d0 = 0;
  let d8 = 0;
  const qSup = () => {
    const D = N(rec.slice(0x151, 0x156));
    if (D) st.w428 = mod(div(div(N(rec.slice(0x156, 0x15b)) * 10000, D) + 5, 10), 1e8);
    return st.w428;
  };
  const qAcc = () => {
    const D = N(rec.slice(0x14c, 0x151));
    if (D) st.w428 = mod(div(div((N(rec.slice(0x15e, 0x163)) + N(rec.slice(0x168, 0x16d))) * 10000, D) + 5, 10), 1e8);
    return st.w428;
  };
  const lohi = (s6: string): [number, number] => {
    const t = intero(s6);
    return [mod(div(t * 9 + 5, 10), 1e6), mod(div(t * 11 + 5, 10), 1e6)];
  };
  const Q = qSup();
  if (T[0].slice(0, 3) !== '999') {
    const p = pt(T[0][3]); const [lo, hi] = lohi(T[0].slice(0, 3) + '000');
    if (Q <= lo) d0 += p;
    if (Q >= hi) d8 += p;
  }
  if (T[1].slice(0, 3) !== '999') {
    const p = pt(T[1][3]); const [lo, hi] = lohi(T[1].slice(0, 3) + '000'); const V = N(rec.slice(0x14c, 0x151)) * 100;
    if (lo >= V) d0 += p;
    if (hi <= V) d8 += p;
  }
  if (T[2].slice(0, 3) !== '999') {
    const p = pt(T[2][3]); const [lo, hi] = lohi('0' + T[2].slice(0, 3) + '00'); const V = N(rec.slice(0x15e, 0x163)) * 100;
    if (lo >= V) d0 += p;
    if (hi <= V) d8 += p;
  }
  const Q2 = qAcc();
  if (T[3].slice(0, 3) !== '999') {
    const p = pt(T[3][3]); const [lo, hi] = lohi('00' + T[3].slice(0, 3) + '0');
    if (Q2 <= lo) d0 += p;
    if (Q2 >= hi) d8 += p;
  }
  if (d8 > d0) return [first, false];
  if (d0 > d8) return [second, false];
  d0 = 0; d8 = 0;
  if (T[0].slice(0, 3) !== '999') {
    const q = qSup(); const p = pt(T[0][3]);
    if (N(T[0].slice(0, 3)) * 1000 >= q) d0 += p; else d8 += p;
  }
  if (T[1].slice(0, 3) !== '999') {
    const p = pt(T[1][3]);
    if (N(T[1].slice(0, 3)) * 10 >= N(rec.slice(0x14c, 0x151))) d0 += p; else d8 += p;
  }
  if (T[2].slice(0, 3) !== '999') {
    const p = pt(T[2][3]);
    if (N(rec.slice(0x15e, 0x163)) <= N(T[2].slice(0, 3))) d0 += p; else d8 += p;
  }
  if (T[3].slice(0, 3) !== '999') {
    const q2 = qAcc(); const p = pt(T[3][3]);
    if (N(T[3].slice(0, 3)) * 10 >= q2) d0 += p; else d8 += p;
  }
  return [d8 > d0 ? first : second, false];
}

const CAT_LE2 = ['A04', 'A03', 'A02', 'A07', 'A08'];

interface VoceLe2 { cat: string; S5: string; T1: string; T2: string; T3: string; T4: string; p: string[] }

function tabellaLe2(v8: string): VoceLe2[] {
  const t: VoceLe2[] = [];
  for (let k = 0; k < 5; k++) {
    const d = v8.slice(0x15b + 22 * k, 0x15b + 22 * (k + 1)).split('');
    for (const i of [5, 9, 13, 17, 21]) if (d[i] === '9') d[i] = '0';
    const s = d.join('');
    t.push({ cat: CAT_LE2[k], S5: s.slice(0, 5), T1: s.slice(6, 9), T2: s.slice(10, 13), T3: s.slice(14, 17), T4: s.slice(18, 21), p: [s[5], s[9], s[13], s[17], s[21]] });
  }
  return t;
}

/** Spareggio con al più 2 abitazioni (FUN_4870). Restituisce [vincitore, finito]. */
function spareggioLe2(X: string, Y: string, stato: string, rec: string, v8: string, st: Stato03): [string, boolean] {
  const tab = tabellaLe2(v8);
  let ix: number;
  let iy: number;
  if (stato === '5' && X === 'A03') { ix = 2; iy = 4; }
  else if (stato === '5' && X === 'A04') { ix = 1; iy = 4; }
  else {
    const fx = tab.findIndex((e) => e.cat === X);
    const fy = tab.findIndex((e) => e.cat === Y);
    if (fx < 0 || fy < 0) {
      if (fx < 0 && fy < 0) return [X, true];
      if (fx < 0) return [Y, true];
      return [X, true];
    }
    ix = fx + 1; iy = fy + 1;
  }
  const E = (k: number) => tab[k - 1];
  const vuota = (e: VoceLe2) => e.S5 === '00000' && e.T1 === '000' && e.T2 === '000' && e.T3 === '000' && e.T4 === '000';
  if (vuota(E(ix)) && vuota(E(iy))) return [X, true];
  if (iy < ix) [ix, iy] = [iy, ix];
  const voti: Record<number, number> = { [ix]: 0, [iy]: 0 };
  if (stato === '5') {
    const a = E(ix).T3; const b = E(iy).T3;
    if (!(a === '000' && b === '000') && N(b) > N(a)) {
      const w418 = mod((N(a) + N(b)) * 5, 1e4);
      const V = N(rec.slice(0x15e, 0x163)) * 10;
      if (w418 >= V && E(ix).cat === 'A03') return [E(ix).cat, false];
      if (w418 >= V && E(ix).cat === 'A04') return [E(ix).cat, false];
    }
  }
  const uguali = [ix, iy].every((k) => [1, 2, 3, 4].every((j) => E(k).p[0] === E(k).p[j]));
  type Campo = 'S5' | 'T1' | 'T2' | 'T3' | 'T4';
  const ordina = (fld: Campo, numerico = true): [number, number] => {
    const a = E(ix)[fld]; const b = E(iy)[fld];
    const lowFirst = numerico ? !(N(b) < N(a)) : !(a > b);
    return lowFirst ? [ix, iy] : [iy, ix];
  };
  const qRatio = () => {
    const D = N(rec.slice(0x14c, 0x151));
    if (D) st.w428 = mod(div(div(N(rec.slice(0x175, 0x17a)) * 10000, D) + 5, 10), 1e8);
    return st.w428;
  };
  const qAcc = () => {
    const D = N(rec.slice(0x156, 0x15b));
    if (D) st.w428 = mod(div(div((N(rec.slice(0x15e, 0x163)) + N(rec.slice(0x168, 0x16d))) * 10000, D) + 5, 10), 1e8);
    return st.w428;
  };
  type Esito = [number, number, boolean, number] | null;
  const crit: (() => Esito)[] = [
    () => {
      if (E(ix).S5 === '00000' && E(iy).S5 === '00000') return null;
      const [lo, hi] = ordina('S5', false);
      const V = N(rec.slice(0x175, 0x17a));
      return [lo, hi, N(E(lo).S5) * 10 > V || N(E(hi).S5) * 10 > V, 0];
    },
    () => {
      if (E(ix).T1 === '000' && E(iy).T1 === '000') return null;
      const [lo, hi] = ordina('T1');
      const V = N(rec.slice(0x14c, 0x151));
      return [lo, hi, N(E(lo).T1) * 10 > V || N(E(hi).T1) * 10 > V, 1];
    },
    () => {
      const Q = qRatio();
      if (E(ix).T2 === '000' && E(iy).T2 === '000') return null;
      const [lo, hi] = ordina('T2');
      return [lo, hi, N(E(lo).T2) * 100 > Q || N(E(hi).T2) * 100 > Q, 2];
    },
    () => {
      if (E(ix).T3 === '000' && E(iy).T3 === '000') return null;
      const [lo, hi] = ordina('T3');
      const v = rec.slice(0x15e, 0x163);
      const minore = (t: string) => (v[0] !== '0' || v[1] !== '0' ? false : v.slice(2, 5) < t);
      return [lo, hi, minore(E(lo).T3) || minore(E(hi).T3), 3];
    },
    () => {
      const Q = qAcc();
      if (E(ix).T4 === '000' && E(iy).T4 === '000') return null;
      const [lo, hi] = ordina('T4');
      return [lo, hi, N(E(lo).T4) * 10 > Q || N(E(hi).T4) * 10 > Q, 4];
    },
  ];
  for (const fn of crit) {
    const r = fn();
    if (!r) continue;
    const [lo, hi, sotto, kp] = r;
    if (uguali) voti[sotto ? hi : lo] += 1;
    else {
      const tgt = sotto ? lo : hi;
      voti[tgt] += intero(E(tgt).p[kp]);
    }
  }
  const win = uguali ? (voti[iy] < voti[ix] ? iy : ix) : voti[ix] >= voti[iy] ? ix : iy;
  return [E(win).cat, false];
}

export interface Categoria03 {
  /** categoria (3 caratteri, spazi se non determinata) */
  categoria: string;
  /** stato finale (W380): 1 unica senza mancanze, 2 migliore con mancanze, 3 pari merito, … */
  stato: string;
  /** '04' se l'unità non è classabile automaticamente */
  esito: string | null;
  condizioni: string[];
}

/** Categoria del gruppo A per il record NCLAS1 (rec) con il prospetto V8 della sezione e il V3 (categorie scartate). */
export function categoria(rec: string, v8: string, v3: string, st: Stato03 = nuovoStato03()): Categoria03 {
  const m = matrice(v8, v3);
  const c = condizioni(rec, v8, st);
  const ent: [string, number, string][] = CATS.map((cat) => [cat, 0, PRIO[cat]]);
  for (let k = 0; k < 79; k++) {
    if (c[k] !== '1') for (const e of ent) if (m[e[0]][k] === '1') e[1] += 1;
  }
  // ordinamento a scambi (FUN_3443)
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 6; j++) if (ent[j][1] < ent[i][1]) [ent[i], ent[j]] = [ent[j], ent[i]];
  let W6b8 = ent[0][0];
  let stato: string;
  let n = 0;
  if (ent[1][1] !== ent[0][1]) stato = ent[0][1] === 0 ? '1' : '2';
  else if (ent[0][1] !== 0) stato = '2';
  else {
    stato = '3';
    while (n < 6 && ent[n][1] === ent[0][1]) n++;
  }
  if (stato !== '1') {
    const sc: Record<string, boolean> = {};
    for (const e of CATS) sc[e] = m[e][78] === '1';
    const piuDiDue = N(rec.slice(0xe1, 0xe4)) > 2;
    const prima = piuDiDue ? 'A02' : 'A07';
    const spareggio = (X: string, Y: string) => (piuDiDue ? spareggioGt2(X, Y, rec, v8, st) : spareggioLe2(X, Y, stato, rec, v8, st));
    if (stato === '2') {
      const a = sc[prima]; const b = sc.A03; const d = sc.A04;
      if (a && b && d) W6b8 = '   ';
      else if (a && b && !d) { stato = '7'; W6b8 = 'A04'; }
      else if (a && !b) { stato = '7'; W6b8 = 'A03'; }
      else if (!a && b && d) { stato = '7'; W6b8 = prima; }
      else {
        stato = '5';
        const [X, Y] = !a && b && !d ? ['A04', prima] : ['A03', prima];
        const [w, fin] = spareggio(X, Y);
        W6b8 = w;
        if (fin) stato = '4';
        if (stato === '4') stato = '6';
      }
    } else {
      const ip = piuDiDue ? 0 : 1;
      const tie = ent.slice(0, n);
      for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) if (tie[j][2][ip] < tie[i][2][ip]) [tie[i], tie[j]] = [tie[j], tie[i]];
      for (let i = 0; i < n; i++) ent[i] = tie[i];
      let i = 0;
      let j = 1;
      for (;;) {
        const X = ent[i][0]; const Y = ent[j][0];
        const [w, fin] = spareggio(X, Y);
        W6b8 = w;
        if (fin) { stato = '4'; break; }
        if (W6b8 === X) break;
        if (n <= j + 1) break;
        i++; j++;
      }
    }
  }
  if (stato === '2') return { categoria: '   ', stato, esito: '04', condizioni: c };
  return { categoria: W6b8, stato, esito: null, condizioni: c };
}
