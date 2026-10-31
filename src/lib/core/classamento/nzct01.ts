/**
 * NZCT01 di Docfa 4: regia del classamento automatico.
 * Riceve i record NCLAS1 scritti da NZCT02 (402 caratteri), l'area L4c dei "dati in atti" (da 0x3ea0,
 * 64 caratteri), il codice di ritorno di NZCT02 (W434e: '00', 'X0'…) e i prospetti provinciali (V1…V8A,
 * TARIFFE); per ogni unità chiama NZCT03 (categoria), NZCT04 (classe) e NZCT05 (consistenza), poi
 * NZCT06 riporta rendite ed esito nel record 3 del documento.
 */
import { categoria as categoria03, nuovoStato03, type Stato03 } from './nzct03';
import { N4, ErroreRTS153 } from './nzct04';
import { N5 } from './nzct05';
import { nzct06, ESITI } from './nzct06';
import { ErroreDocfa, nv } from './comune';

export { ErroreDocfa } from './comune';
export { ESITI } from './nzct06';

/** lunghezza dei record dei prospetti */
const LUNG: Record<string, number> = { V1: 18, V2: 22, V3: 39, V4: 62, V5: 63, V6: 77, V6A: 67, V7: 170, V8: 780, V8A: 14, TAR: 20 };
const CATEGORIE = [
  ...Array.from({ length: 11 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
];
const COMPAT = new Set(['C2|C4', 'C4|C2', 'K4|H3', 'H3|K4', 'D2|F6', 'F6|D2']);

export interface Prospetti {
  V1: string[] | null; V2: string[] | null; V3: string[] | null; V4: string[] | null; V5: string[] | null;
  V6: string[] | null; V6A: string[] | null; V7: string[] | null; V8: string[] | null; V8A: string[] | null;
  /** TARIFFE (20 caratteri: comune 5, zona 3, categoria 3, classe 2, tariffa in lire 7) */
  TAR: string[] | null;
}

/** file a righe (line sequential) come lo legge il runtime: record riempiti a destra di spazi */
export function righe(data: Uint8Array | undefined | null, lunghezza: number): string[] | null {
  if (!data) return null;
  let s = '';
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
  const d = s.split('\r\n');
  if (d.length && d[d.length - 1] === '') d.pop();
  return d.map((x) => x.slice(0, lunghezza).padEnd(lunghezza, ' '));
}

/** Prospetti dai file (chiavi 'V1'…'V8A', 'TAR' → contenuto del file). */
export function leggiProspetti(file: Record<string, Uint8Array | undefined>): Prospetti {
  const p = {} as Prospetti;
  for (const k of Object.keys(LUNG) as (keyof Prospetti)[]) p[k] = righe(file[k], LUNG[k]);
  return p;
}

function compatibile(a: string, b: string): boolean {
  return a.slice(0, 2) === b.slice(0, 2) || COMPAT.has(`${a.slice(0, 2)}|${b.slice(0, 2)}`);
}

const V8_INIZIALE = '                      000000000000000000000000000000000000    000000000000000000000000000000                 00000000    0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000      00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 00 000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000                      ';
const V8A_INIZIALE = '    0000000000';
/** rec[0x93:0xb1] quando il classamento automatico non dà risultato */
const AUTO_VUOTO = '   ' + ' 00' + '  ' + '       ' + '00000' + '0000000000';

const pad = (n: number) => ' '.repeat(n);

export class Regia {
  private chiave: string | null = null;
  v3 = pad(39); v4 = pad(62); v5 = pad(63); v6a = pad(67);
  v8 = V8_INIZIALE; v8a = V8A_INIZIALE; v7: string[] = Array(5).fill(pad(170));
  lettera = '  '; microzona = '    ';
  l58 = '';
  f8490 = '0';
  /** working storage che Docfa conserva fra le unità */
  st03: Stato03 = nuovoStato03();
  n5 = new N5();

  constructor(private P: Prospetti) {}

  // ---------------------------------------------------------------- prospetti (paragrafo 0x38a7)
  carica(comune: string, sezione: string, foglio: string, zona: string): void {
    const P = this.P;
    this.v3 = pad(39); this.v4 = pad(62); this.v5 = pad(63); this.v6a = pad(67);
    this.v8 = V8_INIZIALE; this.v8a = V8A_INIZIALE;
    // V1: lettera del foglio (prima senza sezione, poi con la sezione)
    this.lettera = '  ';
    let trovato = false;
    let passo = 1;
    for (passo = 1; passo <= 2; passo++) {
      const k = comune + (passo === 1 ? '   ' : sezione);
      const v1 = P.V1;
      if (v1 === null) throw new ErroreDocfa('10');
      for (const r of v1) {
        if (!compatibile(comune, r.slice(0, 5))) throw new ErroreDocfa('12');
        if (r.slice(0, 8) !== k) continue;
        if (r.slice(8, 12) !== '    ' && (r.slice(8, 12) > foglio || r.slice(12, 16) < foglio)) continue;
        this.lettera = r.slice(16, 18); trovato = true; break;
      }
      if (trovato) break;
      if (passo === 2 && this.lettera === '  ') throw new ErroreDocfa('13');
    }
    const sezV1 = passo === 1 ? '   ' : sezione;
    // V2: microzona del foglio
    this.microzona = '    ';
    const v2 = P.V2;
    if (v2 !== null) {
      let s = sezV1;
      if (s === '   ' && sezione !== '   ') s = sezione;
      const k = this.lettera + comune + s;
      for (const r of v2) {
        if (!compatibile(comune, r.slice(2, 7))) throw new ErroreDocfa('15');
        if (r.slice(0, 10) !== k) continue;
        this.microzona = 'M000';
        if (r.slice(10, 14) > foglio || r.slice(14, 18) < foglio) continue;
        this.microzona = r.slice(18, 22); break;
      }
    }
    // V3: categorie scartate (comune+microzona, poi solo comune, poi generico)
    const v3 = P.V3;
    this.f8490 = '0';
    if (v3 !== null) {
      for (let ps = 1; ps <= 3; ps++) {
        const mz = ps === 1 ? this.microzona : '    ';
        const cm = ps < 3 ? comune : '     ';
        const k = comune.slice(0, 2) + this.lettera + cm + mz;
        let ok = false;
        for (const r of v3) {
          if (!compatibile(comune, r.slice(0, 2))) throw new ErroreDocfa('18');
          this.v3 = r;
          if (r.slice(0, 13) === k) { ok = true; break; }
        }
        if (ok) { this.f8490 = '1'; break; }
      }
    }
    // V6/V6A (microzone per indirizzo) non gestiti, come nella ricostruzione di riferimento
    if (this.microzona !== '    ') {
      const v5 = P.V5;
      if (v5 !== null) {
        const k = this.lettera + comune + this.microzona;
        let ok = false;
        for (const r of v5) {
          if (!compatibile(comune, r.slice(2, 7))) throw new ErroreDocfa('19');
          this.v5 = r;
          if (r.slice(0, 11) === k) { ok = true; break; }
        }
        // microzona assente in V5: Docfa rilegge il file chiuso e si ferma con errore
        if (!ok) throw new ErroreDocfa('18-V5');
      }
    } else {
      const v4 = P.V4;
      if (v4 !== null) {
        for (let ps = 1; ps <= 2; ps++) {
          const k = this.lettera + comune + (ps === 1 ? zona : '   ');
          let ok = false;
          for (const r of v4) {
            if (!compatibile(comune, r.slice(2, 7))) throw new ErroreDocfa('20');
            this.v4 = r;
            if (r.slice(0, 10) === k) { ok = true; break; }
          }
          if (ok) break;
        }
      }
    }
    // V8 e V8A della lettera (resta l'ultimo letto se la lettera non c'è)
    const k8 = comune.slice(0, 2) + this.lettera;
    for (const nome of ['V8', 'V8A'] as const) {
      const t = P[nome];
      if (t === null) continue;
      for (const r of t) {
        if (nome === 'V8') this.v8 = r; else this.v8a = r;
        if (r.slice(0, 4) === k8) break;
      }
    }
    // V7 per C01, C02, C03, C06, C07
    const t7 = P.V7;
    if (t7 !== null) {
      ['C01', 'C02', 'C03', 'C06', 'C07'].forEach((c, i) => {
        const kk = comune.slice(0, 2) + this.lettera + c;
        for (const r of t7) if (r.slice(0, 7) === kk) { const v = [...this.v7]; v[i] = r; this.v7 = v; break; }
      });
    }
  }

  // ---------------------------------------------------------------- tabella L58 (paragrafo 0x65be)
  tabella(comune: string, zona: string): void {
    const e = CATEGORIE.map((c) => [c, '  ', '0', '0']);
    for (let k = 0; k < 26; k++) if (this.v3[13 + k] === '1') e[k][2] = '3';
    for (let k = 0; k < 26; k++) { const c = this.v4.slice(10 + 2 * k, 12 + 2 * k); if (c !== '  ') { e[k][1] = c; e[k][2] = '4'; } }
    for (let k = 0; k < 26; k++) { const c = this.v5.slice(11 + 2 * k, 13 + 2 * k); if (c !== '  ') { e[k][1] = c; e[k][2] = '5'; } }
    for (let k = 0; k < 26; k++) { const c = this.v6a.slice(0xf + 2 * k, 0x11 + 2 * k); if (c !== '  ') { e[k][1] = c; e[k][2] = '6'; } }
    const tar = this.P.TAR ?? [];
    for (let k = 0; k < 26; k++) {
      e[k][3] = '0';
      if ((e[k][1] === '  ' && e[k][2] !== '3') || e[k][2] === '3') continue;
      const chiave = comune + zona + e[k][0] + e[k][1];
      let flag = '3';
      for (const r of tar) {
        if (r.slice(0, 5) === comune && r.slice(5, 8) === zona && r.slice(8, 11) === e[k][0] && r.slice(11, 13) === 'U ') { flag = '2'; e[k][1] = 'U '; break; }
        if (r.slice(0, 13) === chiave) { flag = '1'; break; }
      }
      e[k][3] = flag;
    }
    this.l58 = e.map((x) => x.join('')).join('');
  }

  // ---------------------------------------------------------------- dati in atti (paragrafo 0x62ae)
  flagVariazione(rec: string, l4c: string, w434e: string): [string, boolean] {
    const cp = rec.slice(0x78, 0x7b);
    const caus = rec.slice(0xb1, 0xb4);
    let fl: string;
    let esito06 = false;
    const zeri = [0xe4, 0xe9, 0xeb, 0xf0, 0xf2, 0xf4].every((a) => rec.slice(a, a + 2) === '00');
    if (cp === 'A10' || cp[0] === 'C') {
      fl = '2';
      if (caus === 'DEP') { if (w434e === 'X0') esito06 = true; else fl = '3'; }
      if (caus === 'VDE') fl = '1';
    } else {
      fl = '1';
      if (w434e === 'X0') esito06 = true;
      else if (caus === 'FRZ' || caus === 'DIV') fl = rec.slice(0xe1, 0xe4) === '001' && zeri ? '1' : '3';
      else if (caus === 'FUS' || caus === 'AMP') fl = rec.slice(0xe1, 0xe4) < '003' && zeri ? '1' : '3';
      else if (caus === 'DEP') fl = '3';
      else if (caus === 'VSI' || caus === 'RST') fl = '4';
      else if (caus === 'VDE') fl = '1';
      else if (caus === 'AF1') fl = '1';
      else if (caus === 'AF2') fl = '3';
    }
    return [l4c.slice(0, 0x22) + fl + l4c.slice(0x23), esito06];
  }

  // ---------------------------------------------------------------- NZCT03 completo (preludio + calcolo)
  nzct03(rec: string, l4c: string): [string, string] {
    const r = rec.split('');
    const R = (a: number, b: number) => r.slice(a, b).join('');
    const W = (a: number, s: string) => { for (let i = 0; i < s.length; i++) r[a + i] = s[i]; };
    const L = (o: number, n = 1) => l4c.slice(o - 0x3ea0, o - 0x3ea0 + n);
    W(0x97, '00');
    const caus = R(0xb1, 0xb4);
    let calcola = false;
    let dato = false;
    if (caus === 'NC ' || L(0x3ec2) === '1') calcola = true;
    else if (caus === 'AF2') {
      W(0x96, L(0x3ec3, 3));
      if (R(0x96, 0x97) !== ' ') dato = true; else calcola = true;
    } else {
      W(0x96, L(0x3ebd) !== ' ' ? L(0x3ebd, 3) : L(0x3ec3, 3));
      if (R(0x96, 0x99) === 'A08' && (caus === 'DIV' || caus === 'FRZ')) {
        l4c = l4c.slice(0, 0x22) + '1' + l4c.slice(0x23);
        calcola = true;
      } else if (R(0x96, 0x97) !== ' ') dato = true;
      else calcola = true;
    }
    if (calcola) {
      const c = categoria03(r.join(''), this.v8, this.v3, this.st03);
      if (c.stato !== '2') W(0x96, c.categoria);
      else { W(0x96, '   '); W(0xb4, '04'); }
    } else if (dato) {
      const c = R(0x96, 0x99);
      if (c.slice(0, 2) === 'A0' && c[2] >= '1' && c[2] <= '9') {
        const n = parseInt(c[2], 10);
        if (this.v3[0xd + n - 1] === '1') {
          W(0xb4, '01');
          if (n !== 1) W(0x96, '   ');
        }
      }
    }
    return [r.join(''), l4c];
  }

  // ---------------------------------------------------------------- ciclo sulle unità
  esegui(recs: string[], l4c: string, w434e = '00'): [string[], string] {
    const out: string[] = [];
    for (const rec of recs) {
      let r = rec;
      const chiave = [r.slice(0x19, 0x1e), r.slice(0x1e, 0x21), r.slice(0x21, 0x25), r.slice(0x75, 0x78), r.slice(0x37, 0x69)];
      const ch = chiave.join('|');
      if (ch !== this.chiave) {
        const [comune, sezione, foglio, zona] = chiave;
        this.carica(comune, sezione, foglio, zona);
        this.chiave = ch;
        this.tabella(comune, zona);
      }
      const cp = r.slice(0x78, 0x7b);
      if (!'ABCDE'.includes(cp[0]) || cp[0] === undefined) throw new ErroreDocfa('64');
      if (cp[0] === 'D' || cp[0] === 'E') { out.push(r); continue; }
      [r, l4c] = this.unita(r, l4c, w434e);
      out.push(r);
    }
    return [out, l4c];
  }

  private unita(rec: string, l4c: string, w434e: string): [string, string] {
    let r = rec.split('');
    const R = (a: number, b: number) => r.slice(a, b).join('');
    const W = (a: number, s: string) => { for (let i = 0; i < s.length; i++) r[a + i] = s[i]; };
    const cp = R(0x78, 0x7b);
    W(0x93, R(0x75, 0x78));
    if (cp[0] === 'A') W(0x96, 'A');
    const fuoriA = cp === 'A10' || cp[0] === 'B' || cp[0] === 'C';
    if (fuoriA) {
      W(0x96, cp);
      const base = ({ A: 0xd, B: 0x18, C: 0x20 } as Record<string, number>)[cp[0]];
      if (this.v3[base + nv(cp.slice(1)) - 1] === '1') {
        W(0xb4, '01');
        return [r.join(''), l4c];
      }
    }
    if (R(0xb1, 0xb4) !== 'NC ') {
      const [l, e06] = this.flagVariazione(r.join(''), l4c, w434e);
      l4c = l;
      if (e06) W(0xb4, '06');
    }
    if (!fuoriA) {
      const [s, l] = this.nzct03(r.join(''), l4c);
      l4c = l;
      r = s.split('');
      if (R(0x97, 0x99) === '00') { W(0x93, AUTO_VUOTO); return [r.join(''), l4c]; }
    }
    // categoria scartata nella tabella L58
    for (let k = 0; k < 26; k++) {
      const e = this.l58.slice(7 * k, 7 * k + 7);
      if (e.slice(0, 3) === R(0x96, 0x99) && e[5] === '3') { W(0xb4, '01'); return [r.join(''), l4c]; }
    }
    // NZCT04: classe
    const tar = (this.P.TAR ?? []).filter((x) => x.slice(0, 5) === R(0x19, 0x1e) && x.slice(5, 8) === R(0x93, 0x96) && x.slice(8, 11) === R(0x96, 0x99)).map((x) => x.slice(11, 13));
    const n4 = new N4(r.join(''), this.v8, this.l58, l4c.slice(0, 0x40), tar, this.v7.join(''));
    let s: string;
    try {
      s = n4.esegui();
    } catch (e) {
      if (e instanceof ErroreRTS153) throw new ErroreDocfa('RTS153 (NZCT04: spostamento di classe fuori tabella)');
      throw e;
    }
    this.l58 = n4.l58;
    r = s.split('');
    if (R(0x99, 0x9b) === '  ') { W(0x93, AUTO_VUOTO); return [r.join(''), l4c]; }
    // NZCT05: consistenza
    r = this.n5.esegui(r.join(''), this.v8, this.v7[0], this.v8a).split('');
    if (R(0x9b, 0xa2) === 'NO     ') W(0x93, AUTO_VUOTO);
    return [r.join(''), l4c];
  }
}

/** Contenuto delle posizioni 273-334 del record 3 scritto da NZCT06 (codice + 60 caratteri). */
export function testoEsito(es: string): string {
  return es + (ESITI[es] ?? '').padEnd(60, ' ').slice(0, 60);
}

export interface RisultatoClassamento {
  /** record NCLAS1 finali */
  nclas: string[];
  /** [chiave (17), esito (2), testo delle posizioni 273-334] per le unità non D/E */
  esiti: [string, string, string][];
  l4c: string;
  /** record del documento aggiornati da NZCT06 (se passato il documento) */
  doc?: string[];
  errore06?: string | null;
}

/**
 * Classamento automatico (NZCT01 + NZCT06 se si passa il documento).
 * Solleva ErroreDocfa quando Docfa si fermerebbe (prospetto mancante, errore runtime 153…).
 */
export function classamento(nclas: string[], p: Prospetti, opts: { doc?: string[]; l4c?: string; w434e?: string; regia?: Regia } = {}): RisultatoClassamento {
  const g = opts.regia ?? new Regia(p);
  const [out, l4c] = g.esegui([...nclas], opts.l4c ?? ' '.repeat(64), opts.w434e ?? '00');
  const ris: RisultatoClassamento = {
    nclas: out,
    l4c,
    esiti: out.filter((r) => r[0x78] !== 'D' && r[0x78] !== 'E').map((r) => [r.slice(0, 17), r.slice(0xb4, 0xb6), testoEsito(r.slice(0xb4, 0xb6))]),
  };
  if (opts.doc) {
    const d = nzct06(out, [...opts.doc], p.TAR ?? []);
    ris.doc = d.doc;
    ris.errore06 = d.errore;
  }
  return ris;
}
