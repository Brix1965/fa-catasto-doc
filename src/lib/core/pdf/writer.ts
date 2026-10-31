/**
 * Writer PDF minimale ma completo per quanto serve al documento Docfa: oggetti, stream (FlateDecode),
 * tabella xref, trailer con /ID, /Info, metadati XMP (PDF/A-1b), OutputIntent con profilo ICC,
 * pagine, font TrueType incorporati (WinAnsiEncoding), immagini CCITT G4, annotazioni di testo e
 * segnalibri (outline). Funziona in Node e nel webview di Tauri: nessuna dipendenza nativa.
 *
 * La struttura prodotta ricalca quella dei PDF generati da Docfa 4 (SDIPDF): PDF 1.4, nessuna
 * cifratura, xref classica, metadati non compressi, un solo livello di /Pages.
 */
import { comprimiFlate } from './flate';
import { leggiTrueType, type MetricheFont } from './truetype';

/** Riferimento a un oggetto PDF già scritto (numero di oggetto). */
export type RifOggetto = number;

export interface FontIncorporato {
  /** numero dell'oggetto /Font */
  rif: RifOggetto;
  /** nome usato nel PDF (/BaseFont) */
  nomeBase: string;
  metriche: MetricheFont;
}

export interface AnnotazioneTesto {
  /** nome del file nascosto (/T e /NM) */
  nome: string;
  /** contenuto grezzo (/Contents, scritto come stringa esadecimale) */
  contenuto: Uint8Array;
  /** [x1 y1 x2 y2] */
  rect: [number, number, number, number];
}

export interface DescrizionePagina {
  larghezza: number;
  altezza: number;
  /** content stream (già codificato, cp1252/binario) */
  contenuto: Uint8Array;
  /** risorse: nome → oggetto */
  font?: Record<string, RifOggetto>;
  xobject?: Record<string, RifOggetto>;
  annotazioni?: AnnotazioneTesto[];
  /** mantenuto a 0 come nei PDF di Docfa per le pagine dei modelli; undefined = assente */
  rotate?: number;
  cropBox?: boolean;
}

export interface VoceOutline {
  titolo: string;
  /** indice della pagina di destinazione (0-based) */
  pagina: number;
  figli?: VoceOutline[];
  /** true = voce chiusa (figli non visibili all'apertura) */
  chiusa?: boolean;
}

export interface MetadatiDocumento {
  titolo?: string;
  autore?: string;
  producer: string;
  creator?: string;
  /** data di modifica (e di creazione, se non indicata a parte) */
  data: Date;
  /** data di creazione, se diversa da quella di modifica (Docfa scrive quella del suo modello PDF) */
  creazione?: Date;
  /** data dei metadati XMP (default: la creazione) */
  dataMetadati?: Date;
}

interface OggettoScritto { num: number; corpo: Uint8Array }

const enc = new TextEncoder();

/** Codifica una stringa per un dizionario PDF (stringa letterale, PDFDocEncoding/ASCII con escape). */
export function stringaPdf(s: string): string {
  let out = '(';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (c < 32 || c > 126) out += '\\' + (c & 0xff).toString(8).padStart(3, '0');
    else out += ch;
  }
  return out + ')';
}

/** Stringa esadecimale <...> da byte grezzi. */
export function stringaHex(b: Uint8Array): string {
  let s = '<';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0').toUpperCase();
  return s + '>';
}

/** Numero in formato PDF (al più 4 decimali, senza zeri inutili). */
export function num(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, '');
}

function dataPdf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const tz = -d.getTimezoneOffset();
  const segno = tz >= 0 ? '+' : '-';
  const h = Math.floor(Math.abs(tz) / 60);
  const m = Math.abs(tz) % 60;
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${segno}${p(h)}'${p(m)}'`;
}

function dataXmp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const tz = -d.getTimezoneOffset();
  const segno = tz >= 0 ? '+' : '-';
  const h = Math.floor(Math.abs(tz) / 60);
  const m = Math.abs(tz) % 60;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${segno}${p(h)}:${p(m)}`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function concat(parti: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parti) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parti) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Impronta a 16 byte (FNV-1a su più semi) per il trailer /ID: non deve essere crittografica, solo stabile e diversa per documenti diversi. */
function impronta(dati: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let k = 0; k < 4; k++) {
    let h = (0x811c9dc5 ^ (k * 0x9e3779b9)) >>> 0;
    for (let i = k; i < dati.length; i += 4) {
      h ^= dati[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out[k * 4] = (h >>> 24) & 0xff;
    out[k * 4 + 1] = (h >>> 16) & 0xff;
    out[k * 4 + 2] = (h >>> 8) & 0xff;
    out[k * 4 + 3] = h & 0xff;
  }
  return out;
}

export class PdfWriter {
  private oggetti: OggettoScritto[] = [];
  private prossimo = 1;
  private pagine: RifOggetto[] = [];
  private rifPages: RifOggetto;
  private outline?: VoceOutline[];
  private metadati?: MetadatiDocumento;
  private rifOutputIntent?: RifOggetto;

  constructor() {
    this.rifPages = this.riserva();
  }

  /** Riserva un numero di oggetto da scrivere in seguito. */
  riserva(): RifOggetto {
    return this.prossimo++;
  }

  /** Scrive un oggetto non-stream (il corpo è il testo fra "n 0 obj" e "endobj"). */
  scrivi(rif: RifOggetto, corpo: string): RifOggetto {
    this.oggetti.push({ num: rif, corpo: enc.encode(corpo) });
    return rif;
  }

  aggiungi(corpo: string): RifOggetto {
    return this.scrivi(this.riserva(), corpo);
  }

  /** Scrive uno stream; `dizionario` contiene le voci aggiuntive (senza /Length e /Filter). */
  async aggiungiStream(dizionario: string, dati: Uint8Array, opzioni: { comprimi?: boolean; filtro?: string; rif?: RifOggetto } = {}): Promise<RifOggetto> {
    const rif = opzioni.rif ?? this.riserva();
    let corpo = dati;
    let filtro = opzioni.filtro ? `/Filter ${opzioni.filtro}` : '';
    if (opzioni.comprimi) {
      corpo = await comprimiFlate(dati);
      filtro = '/Filter /FlateDecode';
    }
    const testa = enc.encode(`<<${dizionario} /Length ${corpo.length} ${filtro}>>\nstream\n`);
    const coda = enc.encode('\nendstream');
    this.oggetti.push({ num: rif, corpo: concat([testa, corpo, coda]) });
    return rif;
  }

  /** Incorpora un font TrueType con codifica WinAnsi (caratteri 32-255). */
  async aggiungiFontTrueType(ttf: Uint8Array, nomeBase: string): Promise<FontIncorporato> {
    const m = leggiTrueType(ttf);
    const rifFile = await this.aggiungiStream(`/Length1 ${ttf.length}`, ttf, { comprimi: true });
    const flags = 34; // serif (2) + nonsymbolic (32)
    const rifDesc = this.aggiungi(
      `<</Type /FontDescriptor /FontName /${nomeBase} /Flags ${flags} /FontBBox [${m.bbox.map(num).join(' ')}] ` +
      `/ItalicAngle ${num(m.italicAngle)} /Ascent ${m.ascent} /Descent ${m.descent} /CapHeight ${m.capHeight} ` +
      `/XHeight ${m.xHeight} /StemV ${m.stemV} /FontWeight ${m.weight} /FontFile2 ${rifFile} 0 R>>`,
    );
    const rif = this.aggiungi(
      `<</Type /Font /Subtype /TrueType /BaseFont /${nomeBase} /FirstChar 32 /LastChar 255 ` +
      `/Widths [${m.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${rifDesc} 0 R>>`,
    );
    return { rif, nomeBase, metriche: m };
  }

  /** Immagine bitonale compressa CCITT G4 (dati grezzi, come nello stream di un TIFF G4). */
  async aggiungiImmagineCCITT(g4: Uint8Array, larghezza: number, altezza: number): Promise<RifOggetto> {
    return this.aggiungiStream(
      `/Type /XObject /Subtype /Image /Width ${larghezza} /Height ${altezza} /ColorSpace /DeviceGray /BitsPerComponent 1 ` +
      `/DecodeParms <</K -1 /Columns ${larghezza} /Rows ${altezza}>>`,
      g4, { filtro: '/CCITTFaxDecode' },
    );
  }

  /** Aggiunge una pagina (in coda) e restituisce il suo indice. */
  async aggiungiPagina(p: DescrizionePagina): Promise<number> {
    const rifContenuto = await this.aggiungiStream('', p.contenuto, { comprimi: true });
    const risorse: string[] = ['/ProcSet [/PDF /Text /ImageB]'];
    if (p.font && Object.keys(p.font).length)
      risorse.push(`/Font <<${Object.entries(p.font).map(([n, r]) => `/${n} ${r} 0 R`).join(' ')}>>`);
    if (p.xobject && Object.keys(p.xobject).length)
      risorse.push(`/XObject <<${Object.entries(p.xobject).map(([n, r]) => `/${n} ${r} 0 R`).join(' ')}>>`);
    const annots: RifOggetto[] = [];
    for (const a of p.annotazioni ?? []) {
      annots.push(this.aggiungi(
        `<</Type /Annot /Subtype /Text /Name /Note /F 28 /Rect [${a.rect.map(num).join(' ')}] ` +
        `/T ${stringaPdf(a.nome)} /NM ${stringaPdf(a.nome)} /Contents ${stringaHex(a.contenuto)}>>`,
      ));
    }
    const box = `[0 0 ${num(p.larghezza)} ${num(p.altezza)}]`;
    const rif = this.aggiungi(
      `<</Type /Page /Parent ${this.rifPages} 0 R /MediaBox ${box}${p.cropBox ? ` /CropBox ${box}` : ''}` +
      `${p.rotate !== undefined ? ` /Rotate ${p.rotate}` : ''} /Resources <<${risorse.join(' ')}>> /Contents ${rifContenuto} 0 R` +
      `${annots.length ? ` /Annots [${annots.map((r) => `${r} 0 R`).join(' ')}]` : ''}>>`,
    );
    this.pagine.push(rif);
    return this.pagine.length - 1;
  }

  impostaOutline(voci: VoceOutline[]): void {
    this.outline = voci;
  }

  impostaMetadati(m: MetadatiDocumento): void {
    this.metadati = m;
  }

  /** OutputIntent PDF/A con profilo ICC sRGB (N = 3). */
  async impostaOutputIntent(icc: Uint8Array, identificatore = 'sRGB IEC61966-2.1'): Promise<void> {
    const rifIcc = await this.aggiungiStream('/N 3', icc, { comprimi: true });
    this.rifOutputIntent = this.aggiungi(
      `<</Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier ${stringaPdf(identificatore)} ` +
      `/Info ${stringaPdf(identificatore)} /RegistryName (http://www.color.org) /DestOutputProfile ${rifIcc} 0 R>>`,
    );
  }

  private scriviOutline(voci: VoceOutline[], rifPadre: RifOggetto): { primo: RifOggetto; ultimo: RifOggetto; visibili: number } {
    const rifs = voci.map(() => this.riserva());
    let visibili = 0;
    voci.forEach((v, i) => {
      const parti = [`/Title ${stringaPdf(v.titolo)} /Parent ${rifPadre} 0 R /Dest [${this.pagine[v.pagina]} 0 R /XYZ null null null]`];
      if (i > 0) parti.push(`/Prev ${rifs[i - 1]} 0 R`);
      if (i < voci.length - 1) parti.push(`/Next ${rifs[i + 1]} 0 R`);
      visibili++;
      if (v.figli?.length) {
        const f = this.scriviOutline(v.figli, rifs[i]);
        parti.push(`/First ${f.primo} 0 R /Last ${f.ultimo} 0 R /Count ${v.chiusa ? -f.visibili : f.visibili}`);
        if (!v.chiusa) visibili += f.visibili;
      }
      this.scrivi(rifs[i], `<<${parti.join(' ')}>>`);
    });
    return { primo: rifs[0], ultimo: rifs[rifs.length - 1], visibili };
  }

  private xmp(m: MetadatiDocumento): string {
    const data = dataXmp(m.data);
    const creazione = dataXmp(m.creazione ?? m.data);
    const metadati = dataXmp(m.dataMetadati ?? m.creazione ?? m.data);
    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" pdfaid:conformance="B" pdfaid:part="1" rdf:about=""/>
<rdf:Description xmlns:pdf="http://ns.adobe.com/pdf/1.3/" pdf:PDFVersion="1.4" pdf:Producer="${xmlEscape(m.producer)}" rdf:about=""/>
<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" rdf:about="" xmp:CreateDate="${creazione}" xmp:MetadataDate="${metadati}" xmp:ModifyDate="${data}"${m.creator ? ` xmp:CreatorTool="${xmlEscape(m.creator)}"` : ''}/>
<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" rdf:about="">${m.titolo ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(m.titolo)}</rdf:li></rdf:Alt></dc:title>` : ''}${m.autore ? `<dc:creator><rdf:Seq><rdf:li>${xmlEscape(m.autore)}</rdf:li></rdf:Seq></dc:creator>` : ''}</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  }

  /** Produce il file PDF completo. */
  async genera(): Promise<Uint8Array> {
    if (!this.pagine.length) throw new Error('Nessuna pagina nel documento');
    const m = this.metadati ?? { producer: 'Fa.Catasto.Doc', data: new Date() };
    // albero delle pagine
    this.scrivi(this.rifPages, `<</Type /Pages /Count ${this.pagine.length} /Kids [${this.pagine.map((r) => `${r} 0 R`).join(' ')}]>>`);
    // metadati XMP (non compressi, come richiede PDF/A-1)
    const rifMeta = await this.aggiungiStream('/Type /Metadata /Subtype /XML', enc.encode(this.xmp(m)));
    // outline
    let rifOutline: RifOggetto | undefined;
    if (this.outline?.length) {
      rifOutline = this.riserva();
      const o = this.scriviOutline(this.outline, rifOutline);
      this.scrivi(rifOutline, `<</Type /Outlines /First ${o.primo} 0 R /Last ${o.ultimo} 0 R /Count ${o.visibili}>>`);
    }
    const rifCatalogo = this.aggiungi(
      `<</Type /Catalog /Version /1.4 /Pages ${this.rifPages} 0 R /Metadata ${rifMeta} 0 R` +
      `${this.rifOutputIntent ? ` /OutputIntents [${this.rifOutputIntent} 0 R]` : ''}${rifOutline ? ` /Outlines ${rifOutline} 0 R` : ''}>>`,
    );
    const data = dataPdf(m.data);
    const rifInfo = this.aggiungi(
      `<</Producer ${stringaPdf(m.producer)}${m.creator ? ` /Creator ${stringaPdf(m.creator)}` : ''}` +
      `${m.titolo ? ` /Title ${stringaPdf(m.titolo)}` : ''}${m.autore ? ` /Author ${stringaPdf(m.autore)}` : ''}` +
      ` /CreationDate ${stringaPdf(dataPdf(m.creazione ?? m.data))} /ModDate ${stringaPdf(data)}>>`,
    );

    // serializzazione: gli oggetti vanno in ordine di numero per avere una xref ordinata
    this.oggetti.sort((a, b) => a.num - b.num);
    const parti: Uint8Array[] = [enc.encode('%PDF-1.4\n'), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
    let offset = parti[0].length + parti[1].length;
    const offsets = new Map<number, number>();
    for (const o of this.oggetti) {
      offsets.set(o.num, offset);
      const testa = enc.encode(`${o.num} 0 obj\n`);
      const coda = enc.encode('\nendobj\n');
      parti.push(testa, o.corpo, coda);
      offset += testa.length + o.corpo.length + coda.length;
    }
    const size = this.prossimo;
    const id = stringaHex(impronta(concat(this.oggetti.map((o) => o.corpo))));
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let n = 1; n < size; n++) {
      const off = offsets.get(n);
      if (off === undefined) throw new Error(`Oggetto ${n} riservato ma mai scritto`);
      xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<</Size ${size} /Root ${rifCatalogo} 0 R /Info ${rifInfo} 0 R /ID [${id} ${id}]>>\nstartxref\n${offset}\n%%EOF\n`;
    parti.push(enc.encode(xref));
    return concat(parti);
  }
}
