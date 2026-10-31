import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PdfWriter } from '../writer';
import { comprimiFlate, zlibStored } from '../flate';
import { leggiTrueType } from '../truetype';
import { decodificaBase64 } from '../base64';
import { LIBERATION_SERIF_BOLD_B64, LIBERATION_SERIF_REGULAR_B64 } from '../assets/fonts.generated';
import { SRGB_ICC_B64 } from '../assets/icc.generated';
import { Pagina } from '../pagina';
import { aCapo, aDestra, decimali, intero, migliaia } from '../formato';
import { pythonJson, strumentoDisponibile } from './helpers';

const TMP = join(tmpdir(), 'fa-catasto-doc-pdf-test');
mkdirSync(TMP, { recursive: true });

describe('flate', () => {
  it('comprime in formato zlib decodificabile', async () => {
    const dati = new TextEncoder().encode('BT /F0 9 Tf 10 10 Td (ciao) Tj ET\n'.repeat(50));
    const z = await comprimiFlate(dati);
    expect(z.length).toBeLessThan(dati.length);
    expect(new Uint8Array(inflateSync(z))).toEqual(dati);
  });
  it('il fallback "stored" è uno stream zlib valido', () => {
    const dati = new Uint8Array(70000).map((_, i) => i % 251);
    const z = zlibStored(dati);
    expect(new Uint8Array(inflateSync(z))).toEqual(dati);
  });
});

describe('truetype', () => {
  it('legge le metriche di Liberation Serif (compatibili con Times New Roman)', () => {
    const m = leggiTrueType(decodificaBase64(LIBERATION_SERIF_REGULAR_B64));
    expect(m.nomePostScript).toBe('LiberationSerif');
    expect(m.unitsPerEm).toBe(2048);
    expect(m.widths).toHaveLength(224);
    expect(m.widths[0]).toBe(250); // spazio
    expect(m.widths['0'.charCodeAt(0) - 32]).toBe(500); // cifre
    expect(m.widths[0x80 - 32]).toBe(500); // euro (WinAnsi 128)
    expect(m.ascent).toBe(891);
    expect(m.descent).toBe(-216);
    const b = leggiTrueType(decodificaBase64(LIBERATION_SERIF_BOLD_B64));
    expect(b.nomePostScript).toBe('LiberationSerif-Bold');
    expect(b.weight).toBe(700);
  });
});

describe('formato', () => {
  it('formatta come Docfa', () => {
    expect(aDestra('13', 3)).toBe(' 13');
    expect(intero('00000')).toBe('');
    expect(intero('00047')).toBe('47');
    expect(migliaia(4935)).toBe('4.935');
    expect(migliaia(4086000)).toBe('4.086.000');
    expect(decimali(73208, 2)).toBe('732,08');
    expect(decimali(270572, 2)).toBe('2.705,72');
    expect(aCapo('BENE COMUNE NON CENSIBILE - RAMPA E PERCORSI INTERNI A COMUNE DEI SUB 503-504-505-508-509-512-513-514', 25)).toEqual([
      'BENE COMUNE NON CENSIBILE', '- RAMPA E PERCORSI', 'INTERNI A COMUNE DEI SUB', '503-504-505-508-509-512', '513-514',
    ]);
  });
});

describe('writer', () => {
  it('produce un PDF minimo con font incorporato, annotazione, immagine e segnalibri', async () => {
    const w = new PdfWriter();
    w.impostaMetadati({ producer: 'test', titolo: 'Prova', data: new Date(2026, 0, 2, 3, 4, 5) });
    await w.impostaOutputIntent(decodificaBase64(SRGB_ICC_B64));
    const f = await w.aggiungiFontTrueType(decodificaBase64(LIBERATION_SERIF_REGULAR_B64), 'LiberationSerif');
    const p = new Pagina(595, 836);
    p.testo(50, 700, 'R', 9, 'Prova di scrittura (con parentesi) e accenti: è à ² €');
    p.linea(10, 10, 100, 10, 1);
    p.casella(100, 100);
    p.spunta(100, 100);
    const annot = new Uint8Array([0x41, 0x42, 0xff, 0x0d, 0x0a, 0x00, 0x28, 0x29]);
    const idx = await w.aggiungiPagina({
      larghezza: 595, altezza: 836, contenuto: p.bytes(), font: { F0: f.rif, F1: f.rif },
      annotazioni: [{ nome: 'PROVA.DAT', contenuto: annot, rect: [40, 30, 60, 50] }],
    });
    // immagine CCITT G4 1×1 bianca (EOFB)
    const g4 = new Uint8Array([0x00, 0x10, 0x01]);
    const im = await w.aggiungiImmagineCCITT(g4, 8, 1);
    const p2 = new Pagina(595.5156, 842.507);
    p2.immagine('Im0', 0, 0, 595.5156, 842.507);
    const idx2 = await w.aggiungiPagina({ larghezza: 595.5156, altezza: 842.507, contenuto: p2.bytes(), xobject: { Im0: im } });
    w.impostaOutline([{ titolo: 'Radice', pagina: idx, figli: [{ titolo: 'Figlio', pagina: idx2 }], chiusa: true }]);
    const pdf = await w.genera();
    const testa = new TextDecoder('latin1').decode(pdf.subarray(0, 8));
    expect(testa).toBe('%PDF-1.4');
    expect(new TextDecoder('latin1').decode(pdf.subarray(pdf.length - 6))).toBe('%%EOF\n');
    const file = join(TMP, 'minimo.pdf');
    writeFileSync(file, pdf);
    if (!strumentoDisponibile('python3', ['-c', 'import pikepdf'])) return;
    const v = pythonJson<{
      qpdf: boolean | null; pagine: number; cifrato: boolean; id: boolean; errori: string[];
      xmp: { part: boolean; conformance: boolean; filtrato: boolean; producer_coerente: boolean };
      outputIntent: { S: string; N: number; icc_bytes: number };
      fontNonIncorporati: string[]; annotazioni: { nome: string; bytes: number; F: number }[]; outline: [number, string][];
    }>('verifica', file);
    expect(v.errori).toEqual([]);
    expect(v.qpdf).not.toBe(false);
    expect(v.pagine).toBe(2);
    expect(v.cifrato).toBe(false);
    expect(v.id).toBe(true);
    expect(v.xmp).toEqual({ part: true, conformance: true, filtrato: false, producer_coerente: true });
    expect(v.outputIntent.S).toBe('/GTS_PDFA1');
    expect(v.outputIntent.N).toBe(3);
    expect(v.outputIntent.icc_bytes).toBe(3048);
    expect(v.fontNonIncorporati).toEqual([]);
    expect(v.annotazioni).toEqual([{ pagina: 1, nome: 'PROVA.DAT', subtype: '/Text', F: 28, rect: [40, 30, 60, 50], bytes: annot.length }]);
    expect(v.outline).toEqual([[0, 'Radice'], [1, 'Figlio']]);
  });
});
