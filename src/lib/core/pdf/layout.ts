/**
 * Layout dei modelli 1N e 2N estratti dai PDF di Docfa (tools/pdf_layout_extract.py) e loro
 * riempimento con i valori dei record del documento.
 *
 * Un layout contiene:
 *   - "fissi": il modulo stampato (testi, righe, caselle) uguale per tutti i documenti;
 *   - "campi": dove Docfa stampa ogni valore (testo in grassetto 9 pt oppure "X" nelle caselle).
 * I valori vengono letti direttamente dai record a lunghezza fissa (B, C, H, I, L, M, N, O, P, Q, R)
 * con gli id dei campi di tracciati/schema.ts, così da stampare esattamente ciò che finisce nel file.
 */
import type { FixedRecord } from '../tracciati/record';
import { REC_H_GRUPPO_C_FIELDS } from '../tracciati/schema';
import type { FieldDef } from '../tracciati/types';
import { decode1252 } from '../bytes';
import { Pagina, type Font } from './pagina';
import { aCapo, aDestra, decimali, intero, migliaia } from './formato';

export type Fisso =
  | ['T', number, number, Font, number, string]
  | ['L', number, number, number, number, number]
  | ['C', number, number];

export interface ColonnaTabella { id: string; x: number; len?: number; fmt?: string }

export interface CampoLayout {
  id: string;
  tipo: 'T' | 'F' | 'tabella' | 'testoLibero';
  rec: string;
  x?: number;
  y?: number;
  len?: number;
  fmt?: string;
  /** flag: X se il campo numerico vale `uguale` (default 1) */
  uguale?: number;
  /** flag: X se il campo numerico è > 0 */
  positivo?: boolean;
  /** flag: X se il campo alfanumerico non è vuoto */
  nonVuoto?: boolean;
  gruppo?: 'AB' | 'C';
  /** fmt "anno": ascissa a cui stampare "antec. 1942" */
  xAntec?: number;
  /** fmt "densita"/"saggio": id del campo con la parte decimale */
  decimali?: string;
  /** testi su più righe */
  righe?: number;
  passo?: number;
  larghezza?: number;
  xRighe?: number;
  /** tabelle (record O): ordinata della prima riga */
  y0?: number;
  colonne?: ColonnaTabella[];
}

export interface Layout {
  nome: string;
  larghezza: number;
  altezza: number;
  fissi: Fisso[];
  campi: CampoLayout[];
}

/** Record disponibili per riempire una pagina. */
export interface ContestoModulo {
  /** record singoli per tipo (B, C, H, I, M, N, P, Q, R); per L si passa il testo unito in `testi` */
  records: Partial<Record<string, FixedRecord>>;
  /** testi liberi già ricomposti da più record (es. osservazioni dei record L, altro tipo di stima dei record O) */
  testi?: Partial<Record<string, string>>;
  /** record O di stima comparativa (tipo_stima 0), in ordine */
  recordsO?: FixedRecord[];
  /** gruppo della u.i.u. per il modello 1N parte II */
  gruppo?: 'AB' | 'C';
}

/** Campi non presenti nello schema dei record ma necessari alla stampa. */
const CAMPI_EXTRA: Record<string, FieldDef[]> = {
  H: REC_H_GRUPPO_C_FIELDS,
};

/** Legge il valore grezzo di un campo (schema o CAMPI_EXTRA). */
export function valoreGrezzo(rec: FixedRecord, id: string): { testo: string; kind: 'N' | 'AN' | 'A' } | undefined {
  const extra = CAMPI_EXTRA[rec.schema.type]?.find((f) => f.id === id);
  const f = extra ?? rec.schema.fields.find((x) => x.id === id);
  if (!f) return undefined;
  return { testo: decode1252(rec.buf.subarray(f.start - 1, f.end)), kind: f.kind };
}

function numero(rec: FixedRecord, id: string): number {
  const v = valoreGrezzo(rec, id);
  if (!v) return 0;
  const n = Number(v.testo.trim());
  return Number.isFinite(n) ? n : 0;
}

/** Formatta il valore di un campo secondo `fmt` e `len`. */
export function formattaValore(rec: FixedRecord, c: { id: string; fmt?: string; len?: number; decimali?: string }): string {
  const v = valoreGrezzo(rec, c.id);
  if (!v) return '';
  const fmt = c.fmt ?? (v.kind === 'N' ? 'int' : 'an');
  let s: string;
  switch (fmt) {
    case 'an':
      s = v.testo.trimEnd();
      if (c.len !== undefined) s = aDestra(s.trim(), c.len);
      return s;
    case 'int':
      s = intero(v.testo);
      break;
    case 'id':
      // identificativo catastale (campo alfanumerico): zeri iniziali tolti, come stampa Docfa
      s = v.testo.trim().replace(/^0+(?=.)/, '');
      break;
    case 'migliaia':
      s = migliaia(numero(rec, c.id));
      break;
    case 'dec1':
      s = decimali(numero(rec, c.id), 1);
      break;
    case 'dec2':
      s = decimali(numero(rec, c.id), 2);
      break;
    case 'cent1':
      // centesimi mostrati con una sola cifra decimale (troncata), come "4.323.000,0" nel 2N
      s = decimali(Math.floor(numero(rec, c.id) / 10), 1);
      break;
    case 'densita': {
      const i = numero(rec, c.id);
      const d = c.decimali ? numero(rec, c.decimali) : 0;
      s = i || d ? `${i},${String(d).padStart(2, '0')}` : '';
      break;
    }
    case 'saggio': {
      const i = numero(rec, c.id);
      const d = c.decimali ? valoreGrezzo(rec, c.decimali)?.testo.trim() ?? '' : '';
      s = i || Number(d) ? `${i},${d.padStart(4, '0')}` : '';
      break;
    }
    case 'anno': {
      const a = numero(rec, c.id);
      s = a ? (a <= 1900 ? 'antec. 1942' : String(a)) : '';
      return s;
    }
    default:
      s = v.testo.trim();
  }
  return c.len !== undefined && s ? aDestra(s, c.len) : s;
}

/** Disegna il modulo (parte fissa) di un layout. */
export function disegnaFissi(p: Pagina, layout: Layout): void {
  for (const f of layout.fissi) {
    if (f[0] === 'T') p.testo(f[1], f[2], f[3], f[4], f[5]);
    else if (f[0] === 'L') p.linea(f[1], f[2], f[3], f[4], f[5]);
    else p.casella(f[1], f[2]);
  }
}

/** Stampa i valori dei campi del layout. */
export function disegnaCampi(p: Pagina, layout: Layout, ctx: ContestoModulo): void {
  for (const c of layout.campi) {
    if (c.gruppo && ctx.gruppo && c.gruppo !== ctx.gruppo) continue;
    if (c.tipo === 'tabella') {
      disegnaTabella(p, c, ctx.recordsO ?? []);
      continue;
    }
    if (c.tipo === 'testoLibero') {
      const testo = ctx.testi?.[c.id] ?? '';
      disegnaRighe(p, c.x ?? 0, c.y0 ?? 0, c.passo ?? 14.173, c.righe ?? 1, aCapo(testo, c.larghezza ?? 100));
      continue;
    }
    const rec = ctx.records[c.rec];
    const testoLibero = ctx.testi?.[c.id];
    if (!rec && testoLibero === undefined) continue;
    const x = c.x ?? 0;
    const y = c.y ?? 0;
    if (c.tipo === 'F') {
      if (!rec) continue;
      const v = valoreGrezzo(rec, c.id);
      if (!v) continue;
      let acceso: boolean;
      if (c.nonVuoto) acceso = v.testo.trim() !== '';
      else if (c.positivo) acceso = numero(rec, c.id) > 0;
      else acceso = numero(rec, c.id) === (c.uguale ?? 1) && v.testo.trim() !== '';
      if (acceso) p.testo(x, y, 'B', 9, 'X');
      continue;
    }
    // testo
    if (c.righe !== undefined) {
      const testo = testoLibero ?? (rec ? formattaValore(rec, { id: c.id, fmt: 'an' }) : '');
      const righe = aCapo(testo.trim(), c.larghezza ?? 50);
      disegnaRighe(p, x, y, c.passo ?? 14.173, c.righe, righe, c.xRighe);
      continue;
    }
    if (!rec) continue;
    const s = formattaValore(rec, c);
    if (!s) continue;
    if (c.fmt === 'anno' && s.startsWith('antec') && c.xAntec !== undefined) p.testo(c.xAntec, y, 'B', 9, s);
    else p.testo(x, y, 'B', 9, s);
  }
}

function disegnaRighe(p: Pagina, x: number, y: number, passo: number, max: number, righe: string[], xSuccessive?: number): void {
  righe.slice(0, max).forEach((r, i) => p.testo(i === 0 ? x : xSuccessive ?? x, y - i * passo, 'B', 9, r));
}

/** Tabella della stima comparativa (2N parte I): una riga per ogni blocco valorizzato dei record O. */
function disegnaTabella(p: Pagina, c: CampoLayout, recordsO: FixedRecord[]): void {
  let riga = 0;
  const passo = c.passo ?? 14.173;
  const max = c.righe ?? 17;
  for (const rec of recordsO) {
    for (let b = 1; b <= 6; b++) {
      const corpo = valoreGrezzo(rec, `stima${b}_corpo`)?.testo.trim() ?? '';
      const dest = valoreGrezzo(rec, `stima${b}_destinazione`)?.testo.trim() ?? '';
      if (!corpo && !dest) continue;
      if (riga >= max) return;
      const y = (c.y0 ?? 0) - riga * passo;
      for (const col of c.colonne ?? []) {
        const id = col.id === 'valore' ? `stima${b}_valore` : col.id === 'valore_unitario' ? `stima${b}_valore_unitario` : `stima${b}_${col.id}`;
        const s = formattaValore(rec, { id, fmt: col.fmt, len: col.len });
        if (s) p.testo(col.x, y, 'B', 9, s);
      }
      riga++;
    }
  }
}
