/**
 * Funzioni comuni ai moduli del classamento automatico (ricostruzione di NZCT01…NZCT06 di Docfa 4).
 * Le stringhe sono "latin1": un carattere per byte, come nei record di Docfa.
 */

/** Errore bloccante: Docfa mostra il messaggio e interrompe il classamento (codice come in NZCT01). */
export class ErroreDocfa extends Error {
  codice: string;
  constructor(codice: string) {
    super(codice);
    this.codice = codice;
    this.name = 'ErroreDocfa';
  }
}

/** Valore di un campo numerico come lo legge il runtime COBOL: ogni carattere vale (codice & 0x0f). */
export function nv(s: string): number {
  let v = 0;
  for (let i = 0; i < s.length; i++) v = v * 10 + (s.charCodeAt(i) & 0xf);
  return v;
}

/** Come nv, ma con il segno "overpunch" sull'ultima cifra (p…y = negativo). */
export function val(s: string): number {
  const v = nv(s);
  if (!s.length) return v;
  const u = s.charCodeAt(s.length - 1);
  return u & 0x40 && (u & 0xf0) === 0x70 ? -v : v;
}

/** Numero allineato a destra con zeri su k cifre (modulo 10^k). */
export function f(n: number, k: number): string {
  const m = 10 ** k;
  return String(((n % m) + m) % m).padStart(k, '0');
}

/** Divisione intera verso il basso (come // in Python). */
export function div(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Resto sempre positivo (come % in Python). */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Sostituisce i caratteri da `a` con `s` in un array di caratteri. */
export function scrivi(r: string[], a: number, s: string): void {
  for (let i = 0; i < s.length; i++) r[a + i] = s[i];
}

export function cifra(c: string): boolean {
  return c >= '0' && c <= '9';
}

// ---------------------------------------------------------------- NCU002 / NCU003 (utilità di Docfa)

/** NCU003: toglie gli spazi iniziali e riduce a uno gli spazi interni (area di 400 caratteri). */
export function ncu003(buf: string, n: number): string {
  if (buf.replace(/ /g, '') === '') return buf;
  const out: string[] = [];
  let i = 0;
  let flag = false;
  while (i < n && buf[i] === ' ') i++;
  while (i < n) {
    const c = buf[i];
    if (c === ' ') {
      if (flag) { i++; continue; }
      flag = true;
    } else flag = false;
    out.push(c);
    i++;
  }
  return out.join('').padEnd(400, ' ');
}

/** NCU002(lunghezza, area): se il contenuto è tutto cifre lo allinea a destra con zeri, altrimenti lo compatta a sinistra. */
export function ncu002(n: number, buf: string): string {
  if (n === 0 || n > 400) return buf;
  let w = buf.slice(0, n).padEnd(400, ' ');
  if (w.replace(/ /g, '') === '') return buf;
  w = ncu003(w.slice(0, n).padEnd(400, ' '), n);
  const comp = w.slice(0, n).replace(/ /g, '').padEnd(400, ' ');
  if (w !== comp) return w.slice(0, n) + buf.slice(n);
  let i = 0;
  while (i < n && w[i] !== ' ') {
    if (!cifra(w[i])) return w.slice(0, n) + buf.slice(n);
    i++;
  }
  const digs = w.slice(0, n).replace(/ /g, '');
  return ('0'.repeat(n - digs.length) + digs).slice(-n) + buf.slice(n);
}

// ---------------------------------------------------------------- NZUU08 (lire / euro)

/**
 * NZUU08: tariffa in lire → euro con 5 decimali (come intero), arrotondato a metà in su.
 * Esempio: 315000 lire → 16268392 (162,68392 €).
 */
export function lireInEuro5(lire: number): number {
  // euro5 = lire × 10^5 / 1936,27 = lire × 10^7 / 193627, arrotondato
  const num = BigInt(lire) * 10000000n;
  const d = 193627n;
  return Number((num * 2n + d) / (2n * d));
}
