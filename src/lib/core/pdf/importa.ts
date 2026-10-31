/**
 * Importazione di un documento Docfa esistente (NCAnnn.PDF o NCVnnn.PDF).
 *
 * Il PDF prodotto da Docfa (PDF 1.4, senza object stream) nasconde i file dati nelle annotazioni
 * di testo: NCVnnn.DAT, NCVnnn.ATT, NMVnnn.DAT, EPVnnn.DAT sull'ultima pagina dei modelli e, su ogni
 * pagina di planimetria, il file dei poligoni Nnnnnnnn.sss. Le planimetrie sono XObject immagine
 * CCITT G4 (una per pagina, /Im0); il nome dell'immagine (nnnnnnn.sss) si legge dai segnalibri.
 *
 * Il parser PDF qui sotto è volutamente minimale: legge gli oggetti "n g obj", i dizionari, gli
 * array, le stringhe (letterali ed esadecimali), i riferimenti e gli stream (anche gli object
 * stream compressi Flate, per i PDF rimaneggiati da altri programmi). Non gestisce cifratura.
 */
import { decompilaDocumento, type Decompilato } from '../decompile';
import type { DisegnoElaborato, Pratica, SchedaGrafica } from '../model';
import { Bitmap } from '../raster/bitmap';
import { decodificaG4 } from '../raster/g4';
import { scriviTiffG4 } from '../raster/tiff';

// ---------------------------------------------------------------------------------------------
// Modello degli oggetti PDF
// ---------------------------------------------------------------------------------------------

export type PdfValore =
  | { t: 'num'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'str'; v: Uint8Array }
  | { t: 'name'; v: string }
  | { t: 'arr'; v: PdfValore[] }
  | { t: 'dict'; v: Map<string, PdfValore> }
  | { t: 'ref'; num: number; gen: number }
  | { t: 'stream'; dict: Map<string, PdfValore>; dati: Uint8Array }
  | { t: 'op'; v: string };

type Dizionario = Map<string, PdfValore>;

const SPAZI = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/** Lettore di token/oggetti PDF su un buffer di byte. */
class Lettore {
  pos = 0;
  constructor(readonly b: Uint8Array, pos = 0) {
    this.pos = pos;
  }

  saltaSpazi(): void {
    while (this.pos < this.b.length) {
      const c = this.b[this.pos];
      if (SPAZI.has(c)) this.pos++;
      else if (c === 0x25) { // commento
        while (this.pos < this.b.length && this.b[this.pos] !== 0x0a && this.b[this.pos] !== 0x0d) this.pos++;
      } else break;
    }
  }

  /** Legge una parola (numero, parola chiave) fino al prossimo spazio o delimitatore. */
  parola(): string {
    const inizio = this.pos;
    while (this.pos < this.b.length && !SPAZI.has(this.b[this.pos]) && !DELIM.has(this.b[this.pos])) this.pos++;
    return latin1(this.b.subarray(inizio, this.pos));
  }

  leggi(): PdfValore {
    this.saltaSpazi();
    if (this.pos >= this.b.length) throw new Error('Fine inattesa del PDF');
    const c = this.b[this.pos];
    if (c === 0x2f) { // /Nome
      this.pos++;
      const inizio = this.pos;
      while (this.pos < this.b.length && !SPAZI.has(this.b[this.pos]) && !DELIM.has(this.b[this.pos])) this.pos++;
      return { t: 'name', v: decodificaNome(latin1(this.b.subarray(inizio, this.pos))) };
    }
    if (c === 0x28) return { t: 'str', v: this.stringaLetterale() };
    if (c === 0x3c) {
      if (this.b[this.pos + 1] === 0x3c) return this.dizionarioOStream();
      return { t: 'str', v: this.stringaEsadecimale() };
    }
    if (c === 0x5b) {
      this.pos++;
      const v: PdfValore[] = [];
      for (;;) {
        this.saltaSpazi();
        if (this.b[this.pos] === 0x5d) { this.pos++; break; }
        if (this.pos >= this.b.length) throw new Error('Array non chiuso');
        v.push(this.leggi());
      }
      return { t: 'arr', v };
    }
    if (c === 0x5d || c === 0x3e || c === 0x29 || c === 0x7b || c === 0x7d) {
      this.pos++;
      return { t: 'op', v: String.fromCharCode(c) };
    }
    const w = this.parola();
    if (w === '') { this.pos++; return { t: 'op', v: String.fromCharCode(c) }; }
    if (w === 'true') return { t: 'bool', v: true };
    if (w === 'false') return { t: 'bool', v: false };
    if (w === 'null') return { t: 'null' };
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      // possibile riferimento "n g R"
      if (/^\d+$/.test(w)) {
        const salva = this.pos;
        this.saltaSpazi();
        const w2 = this.parola();
        if (/^\d+$/.test(w2)) {
          this.saltaSpazi();
          const w3 = this.parola();
          if (w3 === 'R') return { t: 'ref', num: Number(w), gen: Number(w2) };
        }
        this.pos = salva;
      }
      return { t: 'num', v: Number(w) };
    }
    return { t: 'op', v: w };
  }

  private dizionarioOStream(): PdfValore {
    this.pos += 2;
    const v: Dizionario = new Map();
    for (;;) {
      this.saltaSpazi();
      if (this.b[this.pos] === 0x3e && this.b[this.pos + 1] === 0x3e) { this.pos += 2; break; }
      if (this.pos >= this.b.length) throw new Error('Dizionario non chiuso');
      const chiave = this.leggi();
      if (chiave.t !== 'name') continue; // tollerante: salta spazzatura
      const valore = this.leggi();
      v.set(chiave.v, valore);
    }
    // stream?
    const salva = this.pos;
    this.saltaSpazi();
    if (latin1(this.b.subarray(this.pos, this.pos + 6)) === 'stream') {
      this.pos += 6;
      if (this.b[this.pos] === 0x0d) this.pos++;
      if (this.b[this.pos] === 0x0a) this.pos++;
      return { t: 'stream', dict: v, dati: this.b.subarray(this.pos) };
    }
    this.pos = salva;
    return { t: 'dict', v };
  }

  private stringaLetterale(): Uint8Array {
    this.pos++; // (
    const out: number[] = [];
    let livello = 1;
    while (this.pos < this.b.length) {
      const c = this.b[this.pos++];
      if (c === 0x5c) { // backslash
        const e = this.b[this.pos++];
        switch (e) {
          case 0x6e: out.push(0x0a); break; // n
          case 0x72: out.push(0x0d); break; // r
          case 0x74: out.push(0x09); break; // t
          case 0x62: out.push(0x08); break; // b
          case 0x66: out.push(0x0c); break; // f
          case 0x0d: if (this.b[this.pos] === 0x0a) this.pos++; break; // continuazione di riga
          case 0x0a: break;
          default:
            if (e >= 0x30 && e <= 0x37) { // ottale
              let n = e - 0x30;
              for (let k = 0; k < 2 && this.b[this.pos] >= 0x30 && this.b[this.pos] <= 0x37; k++) n = n * 8 + (this.b[this.pos++] - 0x30);
              out.push(n & 0xff);
            } else out.push(e);
        }
      } else if (c === 0x28) { livello++; out.push(c); }
      else if (c === 0x29) { livello--; if (livello === 0) break; out.push(c); }
      else out.push(c);
    }
    return new Uint8Array(out);
  }

  private stringaEsadecimale(): Uint8Array {
    this.pos++; // <
    const out: number[] = [];
    let acc = -1;
    while (this.pos < this.b.length) {
      const c = this.b[this.pos++];
      if (c === 0x3e) break;
      const d = valoreEsadecimale(c);
      if (d < 0) continue;
      if (acc < 0) acc = d;
      else { out.push(acc * 16 + d); acc = -1; }
    }
    if (acc >= 0) out.push(acc * 16);
    return new Uint8Array(out);
  }
}

function valoreEsadecimale(c: number): number {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  return -1;
}

function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

function decodificaNome(s: string): string {
  return s.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Cerca una sequenza di byte a partire da una posizione. */
function trova(b: Uint8Array, testo: string, da = 0): number {
  const n = testo.length;
  const primo = testo.charCodeAt(0);
  for (let i = da; i <= b.length - n; i++) {
    if (b[i] !== primo) continue;
    let ok = true;
    for (let k = 1; k < n; k++) if (b[i + k] !== testo.charCodeAt(k)) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

/** Decomprime uno stream zlib/deflate con l'API standard del browser/Node (se disponibile). */
async function inflate(dati: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream non disponibile: object stream non leggibili');
  const copia = new Uint8Array(new ArrayBuffer(dati.length));
  copia.set(dati);
  const ds = new DecompressionStream('deflate');
  const w = ds.writable.getWriter();
  void w.write(copia);
  void w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// ---------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------

/** Documento PDF letto: oggetti per numero, con risoluzione dei riferimenti. */
export class DocumentoPdf {
  readonly oggetti = new Map<number, PdfValore>();
  /** numeri degli oggetti nell'ordine in cui compaiono nel file */
  readonly ordine: number[] = [];
  trailer: Dizionario = new Map();

  private constructor(readonly bytes: Uint8Array) {}

  static async leggi(bytes: Uint8Array): Promise<DocumentoPdf> {
    const doc = new DocumentoPdf(bytes);
    doc.scansionaOggetti();
    doc.leggiTrailer();
    await doc.espandiObjectStream();
    return doc;
  }

  /** posizione (subito dopo "obj") di ogni oggetto trovato nel file */
  private readonly posizioni = new Map<number, number>();

  /** Scansione lineare di tutti gli "n g obj" (ignora le tabelle xref: più robusto sui PDF di Docfa). */
  private scansionaOggetti(): void {
    const b = this.bytes;
    let i = 0;
    while ((i = trova(b, 'obj', i)) >= 0) {
      const num = this.numeroOggettoPrima(i);
      const dopo = b[i + 3];
      if (num < 0 || (dopo !== undefined && !SPAZI.has(dopo) && !DELIM.has(dopo))) { i += 3; continue; }
      if (this.posizioni.has(num)) { i += 3; continue; }
      this.posizioni.set(num, i + 3);
      this.ordine.push(num);
      // legge subito l'oggetto: se è uno stream salta i suoi dati binari (dove "obj" può comparire per caso)
      const v = this.oggetto(num);
      if (v?.t === 'stream') i = v.dati.byteOffset - b.byteOffset + v.dati.length;
      else i += 3;
    }
  }

  /** Numero dell'oggetto leggendo all'indietro "num gen" prima di "obj"; -1 se non è un'intestazione. */
  private numeroOggettoPrima(i: number): number {
    const b = this.bytes;
    let p = i - 1;
    while (p >= 0 && SPAZI.has(b[p])) p--;
    const fineGen = p + 1;
    while (p >= 0 && b[p] >= 0x30 && b[p] <= 0x39) p--;
    if (p + 1 === fineGen || p < 0 || !SPAZI.has(b[p])) return -1;
    while (p >= 0 && SPAZI.has(b[p])) p--;
    const fineNum = p + 1;
    while (p >= 0 && b[p] >= 0x30 && b[p] <= 0x39) p--;
    const inizioNum = p + 1;
    if (inizioNum === fineNum || (p >= 0 && !SPAZI.has(b[p]) && !DELIM.has(b[p]))) return -1;
    return Number(latin1(b.subarray(inizioNum, fineNum)));
  }

  /** Oggetto per numero, letto (e memorizzato) alla prima richiesta. */
  private oggetto(num: number): PdfValore | undefined {
    const gia = this.oggetti.get(num);
    if (gia) return gia;
    const pos = this.posizioni.get(num);
    if (pos === undefined) return undefined;
    try {
      const l = new Lettore(this.bytes, pos);
      let v = l.leggi();
      if (v.t === 'stream') v = this.chiudiStream(v, l.pos);
      this.oggetti.set(num, v);
      return v;
    } catch {
      return undefined;
    }
  }

  /** Delimita i dati dello stream con /Length (anche indiretto) o cercando "endstream". */
  private chiudiStream(s: Extract<PdfValore, { t: 'stream' }>, inizio: number): PdfValore {
    const lunghezza = s.dict.get('Length');
    let n = -1;
    if (lunghezza?.t === 'num') n = lunghezza.v;
    else if (lunghezza?.t === 'ref') {
      const ris = this.oggetto(lunghezza.num);
      if (ris?.t === 'num') n = ris.v;
    }
    const b = this.bytes;
    if (n >= 0 && inizio + n <= b.length) {
      const fine = trova(b, 'endstream', inizio + n);
      if (fine >= 0 && fine - (inizio + n) <= 4) return { t: 'stream', dict: s.dict, dati: b.subarray(inizio, inizio + n) };
    }
    const fine = trova(b, 'endstream', inizio);
    if (fine < 0) throw new Error('Stream non terminato');
    let f = fine;
    if (b[f - 1] === 0x0a) f--;
    if (b[f - 1] === 0x0d) f--;
    return { t: 'stream', dict: s.dict, dati: b.subarray(inizio, f) };
  }

  private leggiTrailer(): void {
    const b = this.bytes;
    let i = 0;
    while ((i = trova(b, 'trailer', i)) >= 0) {
      try {
        const v = new Lettore(b, i + 7).leggi();
        if (v.t === 'dict') for (const [k, x] of v.v) this.trailer.set(k, x);
      } catch { /* ignora */ }
      i += 7;
    }
    // xref stream (PDF 1.5+)
    for (const num of this.ordine) {
      const o = this.oggetti.get(num);
      if (o?.t === 'stream' && nome(o.dict.get('Type')) === 'XRef') for (const [k, x] of o.dict) if (!this.trailer.has(k)) this.trailer.set(k, x);
    }
  }

  /** Espande gli object stream (/Type /ObjStm), se presenti. */
  private async espandiObjectStream(): Promise<void> {
    for (const num of [...this.ordine]) {
      const o = this.oggetti.get(num);
      if (o?.t !== 'stream' || nome(o.dict.get('Type')) !== 'ObjStm') continue;
      const filtro = nome(o.dict.get('Filter'));
      let dati = o.dati;
      if (filtro === 'FlateDecode') dati = await inflate(dati);
      else if (filtro) continue;
      const n = numero(this.risolvi(o.dict.get('N')));
      const first = numero(this.risolvi(o.dict.get('First')));
      const testa = new Lettore(dati, 0);
      const coppie: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        testa.saltaSpazi();
        const a = Number(testa.parola());
        testa.saltaSpazi();
        const off = Number(testa.parola());
        coppie.push([a, off]);
      }
      for (const [onum, off] of coppie) {
        if (this.oggetti.has(onum)) continue;
        try {
          this.oggetti.set(onum, new Lettore(dati, first + off).leggi());
          this.ordine.push(onum);
        } catch { /* oggetto illeggibile */ }
      }
    }
  }

  risolvi(v: PdfValore | undefined): PdfValore | undefined {
    let x = v;
    for (let k = 0; k < 32 && x?.t === 'ref'; k++) x = this.oggetto(x.num);
    return x;
  }

  dizionario(v: PdfValore | undefined): Dizionario | undefined {
    const x = this.risolvi(v);
    if (x?.t === 'dict') return x.v;
    if (x?.t === 'stream') return x.dict;
    return undefined;
  }

  /** Dizionario del catalogo (Root). */
  radice(): Dizionario | undefined {
    const r = this.dizionario(this.trailer.get('Root'));
    if (r) return r;
    for (const num of this.ordine) {
      const d = this.dizionario(this.oggetti.get(num));
      if (d && nome(d.get('Type')) === 'Catalog') return d;
    }
    return undefined;
  }

  /** Pagine nell'ordine di lettura (albero /Pages, con ripiego sull'ordine nel file). */
  pagine(): { num: number; dict: Dizionario }[] {
    const out: { num: number; dict: Dizionario }[] = [];
    const visti = new Set<number>();
    const visita = (ref: PdfValore | undefined, profondita: number): void => {
      if (profondita > 64) return;
      const num = ref?.t === 'ref' ? ref.num : -1;
      if (num >= 0 && visti.has(num)) return;
      if (num >= 0) visti.add(num);
      const d = this.dizionario(ref);
      if (!d) return;
      const tipo = nome(d.get('Type'));
      const kids = this.risolvi(d.get('Kids'));
      if (tipo === 'Pages' || (kids?.t === 'arr' && tipo !== 'Page')) {
        if (kids?.t === 'arr') for (const k of kids.v) visita(k, profondita + 1);
      } else if (tipo === 'Page' || d.has('Contents') || d.has('MediaBox')) out.push({ num, dict: d });
    };
    visita(this.radice()?.get('Pages'), 0);
    if (out.length) return out;
    for (const num of this.ordine) {
      const d = this.dizionario(this.oggetti.get(num));
      if (d && nome(d.get('Type')) === 'Page') out.push({ num, dict: d });
    }
    return out;
  }

  /** Segnalibri (titolo e numero dell'oggetto pagina di destinazione), in ordine di lettura. */
  segnalibri(): { titolo: string; pagina: number }[] {
    const out: { titolo: string; pagina: number }[] = [];
    const visti = new Set<number>();
    const visita = (ref: PdfValore | undefined, profondita: number): void => {
      let cur = ref;
      for (let k = 0; k < 10000 && cur; k++) {
        const num = cur.t === 'ref' ? cur.num : -1;
        if (num >= 0) { if (visti.has(num)) return; visti.add(num); }
        const d = this.dizionario(cur);
        if (!d) return;
        const titolo = this.risolvi(d.get('Title'));
        let dest = this.risolvi(d.get('Dest'));
        if (!dest) {
          const a = this.dizionario(d.get('A'));
          if (a) dest = this.risolvi(a.get('D'));
        }
        let pagina = -1;
        if (dest?.t === 'arr' && dest.v[0]?.t === 'ref') pagina = dest.v[0].num;
        if (titolo?.t === 'str') out.push({ titolo: testoPdf(titolo.v), pagina });
        if (d.has('First') && profondita < 16) visita(d.get('First'), profondita + 1);
        cur = d.get('Next');
      }
    };
    const outlines = this.dizionario(this.radice()?.get('Outlines'));
    if (outlines) visita(outlines.get('First'), 0);
    return out;
  }
}

function nome(v: PdfValore | undefined): string | undefined {
  return v?.t === 'name' ? v.v : undefined;
}
function numero(v: PdfValore | undefined): number {
  return v?.t === 'num' ? v.v : 0;
}

/** Stringa PDF → testo (UTF-16BE con BOM oppure PDFDocEncoding ≈ Latin-1). */
export function testoPdf(b: Uint8Array): string {
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
    return s;
  }
  return latin1(b);
}

// ---------------------------------------------------------------------------------------------
// Estrazione dei contenuti Docfa
// ---------------------------------------------------------------------------------------------

export interface FileEstratto {
  nome: string;
  dati: Uint8Array;
  /** indice della pagina (0-based) in cui era nascosto */
  pagina: number;
}

export interface ImmagineEstratta {
  /** nome dell'immagine (nnnnnnn.sss), se ricavabile dai segnalibri o dal file NTF sulla stessa pagina */
  nome?: string;
  pagina: number;
  width: number;
  height: number;
  /** stream CCITT G4 grezzo */
  g4: Uint8Array;
  /** TIFF a strip unica ricostruito (lo stesso formato dei file nnnnnnn.sss di Docfa) */
  tiff: Uint8Array;
  /** 1 = nero nel flusso G4 è il valore standard (BlackIs1 false): true se il PDF dichiara BlackIs1 */
  blackIs1: boolean;
}

export interface ContenutoPdfDocfa {
  file: FileEstratto[];
  immagini: ImmagineEstratta[];
  avvisi: string[];
  /** numero di pagine del PDF */
  pagine: number;
}

/** Estrae file nascosti e planimetrie da un PDF Docfa, senza interpretarli. */
export async function estraiContenutoPdf(bytes: Uint8Array): Promise<ContenutoPdfDocfa> {
  if (latin1(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Il file non è un PDF');
  const doc = await DocumentoPdf.leggi(bytes);
  const pagine = doc.pagine();
  const avvisi: string[] = [];
  const file: FileEstratto[] = [];
  const immagini: ImmagineEstratta[] = [];
  const segnalibri = doc.segnalibri().filter((s) => /^\d{7}\.\d{3}$/.test(s.titolo));
  const nomePerPagina = new Map<number, string>();
  for (const s of segnalibri) if (s.pagina >= 0 && !nomePerPagina.has(s.pagina)) nomePerPagina.set(s.pagina, s.titolo);

  pagine.forEach((p, idx) => {
    // annotazioni di testo con /T = nome del file e /Contents = contenuto
    const annots = doc.risolvi(p.dict.get('Annots'));
    if (annots?.t === 'arr') {
      for (const a of annots.v) {
        const d = doc.dizionario(a);
        if (!d || nome(d.get('Subtype')) !== 'Text') continue;
        const t = doc.risolvi(d.get('T'));
        const c = doc.risolvi(d.get('Contents'));
        if (t?.t !== 'str' || c?.t !== 'str') continue;
        file.push({ nome: testoPdf(t.v).trim(), dati: c.v, pagina: idx });
      }
    }
    // immagini CCITT fra gli XObject
    const risorse = doc.dizionario(p.dict.get('Resources'));
    const xobj = doc.dizionario(risorse?.get('XObject'));
    if (!xobj) return;
    for (const [, rif] of xobj) {
      const x = doc.risolvi(rif);
      if (x?.t !== 'stream' || nome(x.dict.get('Subtype')) !== 'Image') continue;
      const filtro = doc.risolvi(x.dict.get('Filter'));
      const filtri = filtro?.t === 'arr' ? filtro.v.map((f) => nome(doc.risolvi(f))) : [nome(filtro)];
      if (filtri.length !== 1 || filtri[0] !== 'CCITTFaxDecode') {
        if (filtri[0] && filtri[0] !== 'DCTDecode') avvisi.push(`Pagina ${idx + 1}: immagine con filtro ${filtri.join('+')} non supportato`);
        continue;
      }
      const width = numero(doc.risolvi(x.dict.get('Width')));
      const height = numero(doc.risolvi(x.dict.get('Height')));
      const dp0 = doc.risolvi(x.dict.get('DecodeParms'));
      const dp = dp0?.t === 'arr' ? doc.dizionario(dp0.v[0]) : doc.dizionario(dp0);
      const k = numero(doc.risolvi(dp?.get('K')));
      const blackIs1 = doc.risolvi(dp?.get('BlackIs1'))?.t === 'bool' && (doc.risolvi(dp?.get('BlackIs1')) as { v: boolean }).v;
      if (k >= 0) { avvisi.push(`Pagina ${idx + 1}: immagine CCITT con K=${k} (non G4), saltata`); continue; }
      if (!width || !height) { avvisi.push(`Pagina ${idx + 1}: immagine senza dimensioni`); continue; }
      const g4 = x.dati.slice();
      // lo stream del PDF è esattamente la strip del TIFF: lo reincapsuliamo senza ricodificare
      const tiff = scriviTiffG4(new Bitmap(width, height), {}, g4);
      const ntf = file.find((f) => f.pagina === idx && /^N\d{7}\.\d{3}$/i.test(f.nome));
      immagini.push({ nome: nomePerPagina.get(p.num) ?? (ntf ? ntf.nome.slice(1) : undefined), pagina: idx, width, height, g4, tiff, blackIs1 });
    }
  });
  if (!file.length) avvisi.push('Nessun file dati trovato nelle annotazioni: non è un PDF prodotto da Docfa?');
  return { file, immagini, avvisi, pagine: pagine.length };
}

/** Decodifica l'immagine G4 estratta in una Bitmap (per l'anteprima o i controlli). */
export function bitmapDaImmagine(im: ImmagineEstratta): Bitmap {
  const bm = decodificaG4(im.g4, im.width, im.height);
  if (im.blackIs1) for (let i = 0; i < bm.data.length; i++) bm.data[i] = ~bm.data[i] & 0xff;
  return bm;
}

export interface ImportazioneDocfa {
  pratica: Pratica;
  decompilato: Decompilato;
  contenuto: ContenutoPdfDocfa;
  avvisi: string[];
  /** nomi dei file dati trovati */
  fileDati: string[];
}

/**
 * Importa un PDF Docfa: estrae i file dati, li decompila nella pratica e aggancia alle u.i.u. le
 * planimetrie (TIFF ricostruito + NTF) e all'elaborato planimetrico le sue schede.
 */
export async function importaPdfDocfa(bytes: Uint8Array): Promise<ImportazioneDocfa> {
  const contenuto = await estraiContenutoPdf(bytes);
  const avvisi = [...contenuto.avvisi];
  const trovaFile = (re: RegExp) => contenuto.file.find((f) => re.test(f.nome));
  const ncv = trovaFile(/^NC[AV]\d{3}\.DAT$/i);   // NCA = accatastamento, NCV = variazione
  if (!ncv) throw new Error('Nel PDF non c\'è il file NCAnnn.DAT o NCVnnn.DAT: non è un documento Docfa');
  const nmv = trovaFile(/^NM[AV]\d{3}\.DAT$/i);
  const att = trovaFile(/^NC[AV]\d{3}\.ATT$/i);
  const epv = trovaFile(/^EP[AV]\d{3}\.DAT$/i);
  if (!att) avvisi.push('Indice allegati (NCxnnn.ATT) assente: formato e scala delle planimetrie non noti');
  const decompilato = decompilaDocumento(ncv.dati, nmv?.dati, att?.dati, epv?.dati);
  const pratica = decompilato.pratica;
  if (decompilato.nonInterpretati.length) avvisi.push(`Record non interpretati: ${[...new Set(decompilato.nonInterpretati)].join(', ')}`);

  // file NTF per nome
  const ntfPerNome = new Map<string, Uint8Array>();
  for (const f of contenuto.file) if (/^N\d{7}\.\d{3}$/i.test(f.nome)) ntfPerNome.set(f.nome.slice(1).toUpperCase(), f.dati);

  // immagini: prima per nome, poi le anonime in ordine di stampa (elaborato planimetrico, poi u.i.u.)
  const attese: string[] = [];
  const ep = pratica.elaboratoPlanimetrico;
  if (ep) for (const s of ep.schede ?? [{ progressivo: ep.progressivoImmagine, scheda: 1 }]) attese.push(`${String(s.progressivo).padStart(7, '0')}.${String(s.scheda).padStart(3, '0')}`);
  for (const u of pratica.unita) {
    const pl = u.planimetria;
    if (!pl) continue;
    const n = pl.schede?.length ?? 1;
    for (let k = 1; k <= n; k++) attese.push(`${String(pl.progressivo).padStart(7, '0')}.${String(k).padStart(3, '0')}`);
  }
  const conNome = new Set(contenuto.immagini.map((i) => i.nome).filter((n): n is string => !!n));
  const senzaNome = attese.filter((n) => !conNome.has(n));
  for (const im of contenuto.immagini) if (!im.nome) im.nome = senzaNome.shift();

  const immaginePerNome = new Map<string, ImmagineEstratta>();
  for (const im of contenuto.immagini) if (im.nome) immaginePerNome.set(im.nome.toUpperCase(), im);

  const nomeImmagine = (progressivo: number, scheda: number) => `${String(progressivo).padStart(7, '0')}.${String(scheda).padStart(3, '0')}`;
  for (const u of pratica.unita) {
    const pl = u.planimetria;
    if (!pl) continue;
    const descr = `u.i.u. fg. ${u.identificativo.foglio} part. ${u.identificativo.numero}${u.identificativo.subalterno ? ` sub ${u.identificativo.subalterno}` : ''}`;
    const schede = pl.schede ?? [{ formato: pl.formato, scala: pl.scala, poligoni: !!pl.ntf }];
    const altre: SchedaGrafica[] = [];
    schede.forEach((sc, k) => {
      const nome = nomeImmagine(pl.progressivo, k + 1);
      const im = immaginePerNome.get(nome);
      if (!im) avvisi.push(`Planimetria ${nome} (${descr}): immagine non trovata nel PDF`);
      const ntf = ntfPerNome.get(nome);
      if (sc.poligoni && !ntf) avvisi.push(`Planimetria ${nome}: l'indice allegati indica poligoni ma il file NTF non c'è`);
      if (k === 0) {
        if (im) {
          pl.tiff = im.tiff;
          if (im.width > 2000 && pl.formato === 'A4' && !att) pl.formato = 'A3';
        }
        pl.ntf = ntf;
      } else {
        altre.push({ formato: sc.formato, scala: sc.scala, poligoni: [], tiff: im?.tiff, ntf });
      }
    });
    if (altre.length) pl.altreSchede = altre;
  }
  if (ep) {
    const schede = ep.schede ?? [{ progressivo: ep.progressivoImmagine, scheda: 1, formato: 'A4' as const, scala: 200 as const }];
    const disegni: DisegnoElaborato[] = [];
    for (const s of schede) {
      const im = immaginePerNome.get(nomeImmagine(s.progressivo, s.scheda));
      if (!im) { avvisi.push(`Elaborato planimetrico, scheda ${s.scheda}: immagine non trovata nel PDF (andrà rigenerata dal DXF)`); continue; }
      disegni.push({ formato: s.formato, scala: s.scala, tiff: im.tiff });
    }
    if (disegni.length === schede.length) ep.disegni = disegni;
  }
  return { pratica, decompilato, contenuto, avvisi, fileDati: contenuto.file.map((f) => f.nome) };
}
