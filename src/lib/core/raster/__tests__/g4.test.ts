import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Bitmap } from '../bitmap';
import { codificaG4, decodificaG4 } from '../g4';
import { scriviTiffG4, leggiTiff } from '../tiff';
import { FIXTURES, PGM, esiste, leggi, pillowDisponibile, decodificaConPillow, pixelDiversi } from './util';

/** Bitmap pseudo-casuale riproducibile (LCG). */
function bitmapCasuale(w: number, h: number, seme: number, densita = 0.3): Bitmap {
  const bm = new Bitmap(w, h);
  let s = seme >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 0; y < h; y++) {
    // mescola corse lunghe e pixel sparsi
    let x = 0;
    while (x < w) {
      const len = 1 + Math.floor(rnd() * (rnd() < 0.2 ? 300 : 12));
      const nero = rnd() < densita;
      if (nero) bm.rettangolo(x, y, Math.min(w - 1, x + len - 1), y, true);
      x += len;
    }
  }
  return bm;
}

/** Bitmap che contiene tutte le lunghezze di corsa da 0 a 2600, sia bianche che nere. */
function bitmapTutteLeCorse(): Bitmap {
  const w = 2700, h = 2 * 2601;
  const bm = new Bitmap(w, h);
  for (let run = 0; run <= 2600; run++) {
    // riga pari: corsa nera di `run` pixel preceduta da 0 bianchi, poi bianco
    const y = run * 2;
    if (run > 0) bm.rettangolo(0, y, run - 1, y, true);
    // riga dispari: corsa bianca di `run` pixel e poi nero fino in fondo
    bm.rettangolo(run, y + 1, w - 1, y + 1, true);
  }
  return bm;
}

describe('G4: encoder/decoder interni', () => {
  it('round trip su bitmap casuali', () => {
    for (const [w, h, seme] of [[1, 1, 1], [7, 3, 2], [8, 8, 3], [1654, 40, 4], [2341, 17, 5], [333, 200, 6]] as const) {
      const bm = bitmapCasuale(w, h, seme);
      const g4 = codificaG4(bm);
      const dec = decodificaG4(g4, w, h);
      expect(pixelDiversi(bm, dec), `${w}x${h}`).toBe(0);
    }
  });

  it('round trip con tutte le lunghezze di corsa (codici terminali, make-up ed estesi)', () => {
    const bm = bitmapTutteLeCorse();
    const dec = decodificaG4(codificaG4(bm), bm.width, bm.height);
    expect(pixelDiversi(bm, dec)).toBe(0);
  });

  it('una bitmap bianca si codifica in pochi byte', () => {
    const bm = new Bitmap(1654, 2340);
    const g4 = codificaG4(bm);
    expect(g4.length).toBeLessThan(400);
    expect(decodificaG4(g4, 1654, 2340).contaNeri()).toBe(0);
  });
});

describe('G4: decoder sui file di Docfa', () => {
  const file = [
    join(PGM, 'A4.mod'), join(PGM, 'A3.mod'), join(PGM, 'EP2_A4.mod'), join(PGM, 'EP2_A3.mod'),
    join(FIXTURES, 'NCV002/0000007.001'),
  ].filter(esiste);

  it.skipIf(!file.length || !pillowDisponibile())('decodifica i .mod e 0000007.001 come Pillow', () => {
    for (const f of file) {
      const dati = leggi(f);
      const t = leggiTiff(dati);
      expect(t.compression).toBe(4);
      const rif = decodificaConPillow(dati);
      expect(t.bitmap.width).toBe(rif.width);
      expect(t.bitmap.height).toBe(rif.height);
      expect(pixelDiversi(t.bitmap, rif), f).toBe(0);
      expect(t.bitmap.contaNeri()).toBeGreaterThan(1000);
    }
  });
});

describe('TIFF: scrittura verificata con Pillow', () => {
  it.skipIf(!pillowDisponibile())('Pillow rilegge i pixel di partenza', () => {
    for (const [w, h, seme] of [[1654, 300, 11], [2340, 100, 12], [100, 100, 13]] as const) {
      const bm = bitmapCasuale(w, h, seme, 0.4);
      bm.testo(20, 60, 'Prova TIFF 123', { altezza: 30 });
      const tiff = scriviTiffG4(bm, { data: new Date(2026, 0, 2, 3, 4, 5) });
      const rif = decodificaConPillow(tiff);
      expect(pixelDiversi(bm, rif), `${w}x${h}`).toBe(0);
    }
  });

  it('round trip con il lettore interno e tag come Docfa', () => {
    const bm = bitmapCasuale(1654, 50, 21);
    const tiff = scriviTiffG4(bm, { data: new Date(2026, 9, 27, 15, 59, 14) });
    const t = leggiTiff(tiff);
    expect(t.width).toBe(1654);
    expect(t.height).toBe(50);
    expect(t.compression).toBe(4);
    expect(t.photometric).toBe(0);
    expect(t.fillOrder).toBe(1);
    expect(t.rowsPerStrip).toBe(50);
    expect(t.strips.length).toBe(1);
    expect(t.testi[305]).toBe('Fa.Catasto.Doc');
    expect(t.testi[306]).toBe('2026:10:27 15:59:14');
    expect(pixelDiversi(bm, t.bitmap)).toBe(0);
  });

  it.skipIf(!pillowDisponibile())('Pillow legge i tag come nel file originale di Docfa', () => {
    const bm = new Bitmap(1654, 2340);
    bm.linea(10, 10, 1000, 2000, 3);
    const tiff = scriviTiffG4(bm);
    // confronto di struttura con Pillow (tag presenti e valori)
    const dir = mkdtempSync(join(tmpdir(), 'tiff-'));
    writeFileSync(join(dir, 'a.tif'), tiff);
    const out = execFileSync('python3', ['-I', '-c', `
import sys, json
from PIL import Image
im = Image.open(sys.argv[1])
t = {str(k): (list(v) if isinstance(v, tuple) else (float(v) if hasattr(v, "numerator") else v)) for k, v in im.tag_v2.items() if k not in (273, 279, 306)}
print(json.dumps({'size': im.size, 'tags': t, 'comp': im.info.get('compression')}))
`, join(dir, 'a.tif')]).toString();
    const r = JSON.parse(out) as { size: [number, number]; tags: Record<string, unknown>; comp: string };
    expect(r.size).toEqual([1654, 2340]);
    expect(r.comp).toBe('group4');
    expect(r.tags['254']).toBe(2);
    expect(r.tags['258']).toEqual([1]);
    expect(r.tags['259']).toBe(4);
    expect(r.tags['262']).toBe(0);
    expect(r.tags['266']).toBe(1);
    expect(r.tags['274']).toBe(1);
    expect(r.tags['277']).toBe(1);
    expect(r.tags['278']).toBe(2340);
    expect(r.tags['282']).toBe(200);
    expect(r.tags['283']).toBe(200);
    expect(r.tags['284']).toBe(1);
    expect(r.tags['296']).toBe(2);
    expect(r.tags['297']).toEqual([0, 1]);
    expect(r.tags['305']).toBe('Fa.Catasto.Doc');
  });
});
