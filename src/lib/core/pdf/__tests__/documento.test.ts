/**
 * Test del documento completo sui PDF reali in fixtures-private (saltati se mancano):
 *  (a) struttura e requisiti PDF/A-1b verificabili (qpdf, XMP, OutputIntent, font incorporati, /ID);
 *  (b) le annotazioni contengono esattamente i byte dei file dati;
 *  (c) l'immagine CCITT viene decodificata da pypdfium2;
 *  (d) il testo di pdftotext -layout delle pagine D1 e dati metrici coincide con l'originale
 *      (a meno di piè di pagina e logo); salva rigenerato.pdf e i confronti visivi in fixtures-private/NCV002/.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderDocumento } from '../documento';
import { bytesEqual } from '../../bytes';
import { immagineDaTiff } from '../tiff';
import { caricaCaso, casoDisponibile, immagineDaPdf, normalizzaTesto, pdftotext, pythonJson, strumentoDisponibile } from './helpers';

const TMP = join(tmpdir(), 'fa-catasto-doc-pdf-test');
mkdirSync(TMP, { recursive: true });
const PYTHON_OK = strumentoDisponibile('python3', ['-c', 'import pikepdf, pypdfium2, PIL']);
const DATA_ORA = new Date(2026, 9, 27, 16, 44, 27);

interface Verifica {
  errori: string[]; qpdf: boolean | null; pagine: number; cifrato: boolean; id: boolean; versione: string; header: string; eof: boolean;
  xmp: { part: boolean; conformance: boolean; filtrato: boolean; producer_coerente: boolean } | null;
  outputIntent: { S: string; N: number; icc_bytes: number } | null;
  font: string[]; fontNonIncorporati: string[];
  annotazioni: { pagina: number; nome: string; subtype: string; F: number; rect: number[]; bytes: number }[];
  outline: [number, string][]; dimensioni: number[][];
}

describe.skipIf(!casoDisponibile('NCV002') || !PYTHON_OK)('documento NCV002 rigenerato', async () => {
  if (!casoDisponibile('NCV002') || !PYTHON_OK) return;
  const caso = caricaCaso('NCV002');
  const ntf = new Uint8Array(readFileSync(join(caso.dir, 'N0000007.001')));
  const immagine = immagineDaPdf(caso.pdfOriginale, 7, TMP, '0000007.001', { dati: ntf, nome: 'N0000007.001' });
  const pdf = await renderDocumento(caso.pratica, caso.compilato, [immagine], { dataOra: DATA_ORA, ufficioProvinciale: 'FIRENZE' });
  const file = join(caso.dir, 'rigenerato.pdf');
  writeFileSync(file, pdf);
  const v = pythonJson<Verifica>('verifica', file);

  it('(a) si apre con qpdf/pikepdf ed è conforme ai requisiti PDF/A-1b verificabili', () => {
    expect(v.errori).toEqual([]);
    expect(v.qpdf).not.toBe(false);
    expect(v.header).toBe('%PDF-1.4');
    expect(v.eof).toBe(true);
    expect(v.versione).toBe('1.4');
    expect(v.cifrato).toBe(false);
    expect(v.id).toBe(true);
    expect(v.xmp).toEqual({ part: true, conformance: true, filtrato: false, producer_coerente: true });
    expect(v.outputIntent?.S).toBe('/GTS_PDFA1');
    expect(v.outputIntent?.N).toBe(3);
    expect(v.fontNonIncorporati).toEqual([]);
    expect(v.font).toEqual(['/LiberationSerif', '/LiberationSerif-Bold']);
    expect(v.pagine).toBe(7);
    expect(v.outline).toEqual([
      [0, 'Modello unico informatico degli atti catastali'], [1, 'Modello D1'], [1, 'Modelli 1N 2N'], [1, 'Dati metrici'],
      [1, 'Elaborati grafici'], [2, '0000007.001'],
    ]);
    // formati pagina come nel PDF di Docfa
    expect(v.dimensioni[0].map((x) => Math.round(x * 100) / 100)).toEqual([0, 0, 595.44, 842.4]);
    expect(v.dimensioni[1]).toEqual([0, 0, 595, 836]);
    expect(v.dimensioni[6].map((x) => Math.round(x * 1000) / 1000)).toEqual([0, 0, 595.516, 842.507]);
  });

  it('(b) le annotazioni contengono esattamente i byte dei file dati', () => {
    const dir = join(TMP, 'annot-NCV002');
    pythonJson('annotazioni', file, dir);
    const attesi = [caso.compilato.ncv, caso.compilato.att, caso.compilato.nmv, { nome: 'N0000007.001', dati: ntf }];
    for (const a of attesi) {
      const letto = new Uint8Array(readFileSync(join(dir, a.nome)));
      expect(letto.length, a.nome).toBe(a.dati.length);
      expect(bytesEqual(letto, a.dati), a.nome).toBe(true);
    }
    // l'indice allegati e i dati metrici coincidono anche con i file originali presentati all'Agenzia
    // (il NCV no: il record I contiene zone di memoria non inizializzata, vedi roundtrip.test.ts)
    for (const nome of ['NCV002.ATT', 'NMV002.DAT']) {
      expect(bytesEqual(new Uint8Array(readFileSync(join(dir, nome))), new Uint8Array(readFileSync(join(caso.dir, nome)))), nome).toBe(true);
    }
    expect(v.annotazioni.map((a) => [a.pagina, a.nome, a.F, a.rect])).toEqual([
      [6, 'NCV002.DAT', 28, [40, 30, 60, 50]], [6, 'NCV002.ATT', 28, [60, 30, 80, 50]], [6, 'NMV002.DAT', 28, [80, 30, 100, 50]],
      [7, 'N0000007.001', 28, [20, 20, 40, 40]],
    ]);
  });

  it('(c) la planimetria CCITT viene decodificata da pypdfium2', () => {
    const png = join(TMP, 'NCV002-p7.png');
    const r = pythonJson<{ width: number; height: number; frazioneScuri: number }>('render', file, '7', png, '0.5');
    expect(existsSync(png)).toBe(true);
    expect(r.width).toBeGreaterThan(200);
    // la planimetria disegnata: una frazione piccola ma non nulla di pixel neri, come nell'originale
    const orig = pythonJson<{ frazioneScuri: number }>('render', caso.pdfOriginale, '7', join(TMP, 'NCV002-orig-p7.png'), '0.5');
    expect(r.frazioneScuri).toBeGreaterThan(0.001);
    expect(Math.abs(r.frazioneScuri - orig.frazioneScuri)).toBeLessThan(0.002);
  });

  it.skipIf(!strumentoDisponibile('pdftotext', ['-v']))('(d) il testo delle pagine D1 e dati metrici coincide con l\'originale', () => {
    for (const pagina of [1, 6]) {
      const originale = normalizzaTesto(pdftotext(caso.pdfOriginale, pagina));
      const nostro = normalizzaTesto(pdftotext(file, pagina));
      expect(nostro, `pagina ${pagina}`).toEqual(originale);
    }
    const prefisso = join(caso.dir, 'confronto_pdf_');
    const png = pythonJson<string[]>('confronto-visivo', caso.pdfOriginale, file, prefisso, '1.0');
    expect(png).toHaveLength(7);
    expect(existsSync(`${prefisso}1.png`)).toBe(true);
  });
});

describe.skipIf(!casoDisponibile('NCV002') || !PYTHON_OK)('planimetria TIFF', () => {
  it('la strip G4 del TIFF di Docfa coincide con lo stream CCITT del PDF originale', () => {
    const caso = caricaCaso('NCV002');
    const tiff = new Uint8Array(readFileSync(join(caso.dir, '0000007.001')));
    const im = immagineDaTiff('0000007.001', tiff);
    const dalPdf = immagineDaPdf(caso.pdfOriginale, 7, TMP, 'p7');
    expect([im.width, im.height, im.formato]).toEqual([1654, 2340, 'A4']);
    expect(bytesEqual(im.g4, dalPdf.g4)).toBe(true);
  });
});
