import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { estraiContenutoPdf, importaPdfDocfa, bitmapDaImmagine, DocumentoPdf } from '../importa';
import { compilaDocumento } from '../../compile';
import { leggiTiff } from '../../raster/tiff';
import { leggiNtf } from '../../ntf';

const FIXTURES = join(process.cwd(), 'fixtures-private');
const PDF = join(FIXTURES, 'NCV002.PDF');
const ok = existsSync(PDF) && existsSync(join(FIXTURES, 'NCV002', 'NCV002.DAT'));

describe.skipIf(!ok)('importazione PDF Docfa (NCV002)', () => {
  if (!ok) return;
  const bytes = new Uint8Array(readFileSync(PDF));

  it('legge pagine, segnalibri e oggetti', async () => {
    const doc = await DocumentoPdf.leggi(bytes);
    expect(doc.pagine().length).toBe(7);
    const titoli = doc.segnalibri().map((s) => s.titolo);
    expect(titoli).toContain('Modello D1');
    expect(titoli).toContain('0000007.001');
  });

  it('estrae i file nascosti identici a quelli di Docfa e la planimetria G4', async () => {
    const c = await estraiContenutoPdf(bytes);
    expect(c.file.map((f) => f.nome)).toEqual(['NCV002.DAT', 'NCV002.ATT', 'NMV002.DAT', 'N0000007.001']);
    for (const f of c.file) {
      const orig = readFileSync(join(FIXTURES, 'NCV002', f.nome));
      expect(Buffer.from(f.dati).equals(orig), f.nome).toBe(true);
    }
    expect(c.immagini.length).toBe(1);
    const im = c.immagini[0];
    expect(im).toMatchObject({ nome: '0000007.001', width: 1654, height: 2340 });
    // il TIFF ricostruito si rilegge e ha gli stessi pixel del TIFF originale di Docfa
    const letto = leggiTiff(im.tiff);
    expect(letto.width).toBe(1654);
    const origTiff = join(FIXTURES, 'NCV002', '0000007.001');
    if (existsSync(origTiff)) {
      const orig = leggiTiff(new Uint8Array(readFileSync(origTiff)));
      expect(Buffer.from(letto.bitmap.data).equals(Buffer.from(orig.bitmap.data))).toBe(true);
    }
    const bm = bitmapDaImmagine(im);
    expect(bm.contaNeri()).toBeGreaterThan(1000);
  });

  it('crea la pratica con planimetria (TIFF + NTF) e ricompila gli stessi record', async () => {
    const r = await importaPdfDocfa(bytes);
    expect(r.avvisi).toEqual([]);
    expect(r.pratica.progressivo).toBe(2);
    expect(r.pratica.unita.length).toBeGreaterThan(0);
    const u = r.pratica.unita.find((x) => x.planimetria);
    expect(u?.planimetria?.tiff?.length).toBeGreaterThan(100);
    expect(u?.planimetria?.ntf?.length).toBeGreaterThan(0);
    const ntf = leggiNtf(u!.planimetria!.ntf!);
    expect(ntf.progressivo).toBe(7);
    const out = compilaDocumento(r.pratica);
    const orig = readFileSync(join(FIXTURES, 'NCV002', 'NCV002.ATT'));
    expect(Buffer.from(out.att.dati).equals(orig)).toBe(true);
  });
});

describe('parser PDF: casi sintetici', () => {
  const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

  it('legge stringhe letterali con escape, esadecimali e riferimenti', async () => {
    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] /Annots [4 0 R] >>
endobj
4 0 obj
<< /Type /Annot /Subtype /Text /T (A\\(B\\).DAT) /Contents <41424320> >>
endobj
5 0 obj
<< /Type /Outlines /First 6 0 R >>
endobj
6 0 obj
<< /Title (0000001.001) /Dest [3 0 R /XYZ null null null] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
    const c = await estraiContenutoPdf(enc(pdf));
    expect(c.pagine).toBe(1);
    expect(c.file).toHaveLength(1);
    expect(c.file[0].nome).toBe('A(B).DAT');
    expect([...c.file[0].dati]).toEqual([0x41, 0x42, 0x43, 0x20]);
    const doc = await DocumentoPdf.leggi(enc(pdf));
    expect(doc.segnalibri()).toEqual([{ titolo: '0000001.001', pagina: 3 }]);
  });

  it('rifiuta file che non sono PDF', async () => {
    await expect(estraiContenutoPdf(enc('ciao'))).rejects.toThrow(/non è un PDF/);
  });
});
