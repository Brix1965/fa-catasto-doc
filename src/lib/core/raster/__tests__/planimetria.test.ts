import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { componiPlanimetria, type Cartiglio } from '../planimetria';
import { leggiDxf, rilevaFoglio } from '../dxf';
import { leggiTiff } from '../tiff';
import { caricaModello } from '../modelli';
import { Bitmap } from '../bitmap';
import { FIXTURES, CARTIGLI, esiste, leggi, iou, scriviPng } from './util';

const DXF = join(FIXTURES, 'NCV002/planimetria.dxf');
const TIFF = join(FIXTURES, 'NCV002/0000007.001');

const CARTIGLIO_NCV002: Cartiglio = {
  ufficio: 'Firenze',
  comune: 'Firenze',
  via: CARTIGLI.NCV002.via,
  civico: CARTIGLI.NCV002.civico,
  sezione: '',
  foglio: CARTIGLI.NCV002.foglio,
  particella: CARTIGLI.NCV002.particella,
  subalterno: CARTIGLI.NCV002.subalterno,
  compilatore: CARTIGLI.tecnico.compilatore,
  albo: 'Geometri',
  provincia: 'Firenze',
  numeroAlbo: CARTIGLI.tecnico.numeroAlbo,
  protocollo: '',
  data: '',
  scheda: 1,
  scala: 200,
};

describe('planimetria NCV002', () => {
  it.skipIf(!esiste(DXF) || !esiste(TIFF))('rigenera il TIFF di Docfa: IoU > 0,85 dopo dilatazione di 2 px e disegno entro 4 px', async () => {
    const dxf = readFileSync(DXF, 'latin1');
    const letto = leggiDxf(dxf);
    const foglio = rilevaFoglio(letto);
    expect(foglio.formato).toBe('A4');
    expect(foglio.scala).toBe(200);
    expect(foglio.origineInZero).toBe(true);
    expect(letto.poligoni.length).toBe(1);
    expect(letto.poligoni[0].tipo).toBe('A');
    expect(letto.poligoni[0].vertici.length).toBe(13);

    const r = await componiPlanimetria({ dxf: letto, cartiglio: CARTIGLIO_NCV002, data: new Date(2026, 9, 27, 15, 59, 14) });
    expect(r.width).toBe(1654);
    expect(r.height).toBe(2340);
    expect(r.poligoni.length).toBe(1);

    const orig = leggiTiff(leggi(TIFF)).bitmap;
    // il TIFF scritto si rilegge identico alla bitmap
    const riletto = leggiTiff(r.tiff);
    expect(riletto.width).toBe(1654);
    expect(riletto.bitmap.data).toEqual(r.bitmap.data);

    // PNG di confronto: originale in rosso, nostro in blu (nero dove coincidono)
    scriviPng(join(FIXTURES, 'NCV002/confronto_tiff.png'), orig.width, orig.height, (x, y) => {
      const a = orig.getPixel(x, y), b = r.bitmap.getPixel(x, y);
      if (a && b) return [0, 0, 0];
      if (a) return [220, 0, 0];
      if (b) return [0, 0, 220];
      return [255, 255, 255];
    });
    writeFileSync(join(FIXTURES, 'NCV002/rigenerato.tif'), r.tiff);

    // posizione del disegno (sotto il cartiglio) entro 4 px
    const bo = orig.bboxNeri(380);
    const bn = r.bitmap.bboxNeri(380);
    expect(bo).not.toBeNull();
    expect(bn).not.toBeNull();
    if (bo && bn) {
      expect(Math.abs(bo.x0 - bn.x0), 'x0').toBeLessThanOrEqual(4);
      expect(Math.abs(bo.y0 - bn.y0), 'y0').toBeLessThanOrEqual(4);
      expect(Math.abs(bo.x1 - bn.x1), 'x1').toBeLessThanOrEqual(4);
      expect(Math.abs(bo.y1 - bn.y1), 'y1').toBeLessThanOrEqual(4);
    }

    // intersezione su unione dopo dilatazione di 2 px
    const v = iou(orig.dilata(2), r.bitmap.dilata(2));
    process.stdout.write(`IoU NCV002 (dilatazione 2 px): ${v.toFixed(4)}\n`);
    expect(v).toBeGreaterThan(0.85);
  });

  it('A3: il cartiglio ruotato finisce nella fascia sinistra e il disegno nel riquadro', async () => {
    // riquadro A3 1:200 (52×81 m) con un rettangolo e un testo
    const dxf = dxfMinimo([[0, 0], [52, 0], [52, 81], [0, 81]], [
      ['LINE', { 8: '0', 10: '10', 20: '10', 11: '40', 21: '70', 39: '0.07' }],
      ['TEXT', { 8: '0', 10: '20', 20: '40', 40: '0.5', 1: 'PROVA' }],
    ]);
    const r = await componiPlanimetria({ dxf, cartiglio: { ...CARTIGLIO_NCV002, scala: 0 } });
    expect(r.foglio).toEqual({ formato: 'A3', scala: 200 });
    expect(r.width).toBe(2340);
    expect(r.height).toBe(3310);
    const modello = await caricaModello('A3', 'planimetria');
    // pixel aggiunti rispetto al modello
    const aggiunti = new Bitmap(r.width, r.height);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.bitmap.getPixel(x, y) && !modello.getPixel(x, y)) aggiunti.setPixel(x, y);
    const fascia = aggiunti.bboxNeri();
    expect(fascia).not.toBeNull();
    // il cartiglio sta nella fascia x < 236 e la linea nel riquadro
    let inFascia = 0, inRiquadro = 0;
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      if (!aggiunti.getPixel(x, y)) continue;
      if (x < 236) inFascia++;
      else if (x >= 239 && x <= 2282 && y >= 77 && y <= 3238) inRiquadro++;
      else throw new Error(`pixel fuori posto in (${x}, ${y})`);
    }
    expect(inFascia).toBeGreaterThan(500);
    expect(inRiquadro).toBeGreaterThan(500);
  });
});

/** Costruisce un DXF minimo con un riquadro (LWPOLYLINE chiusa) e le entità indicate. */
function dxfMinimo(riquadro: [number, number][], entita: [string, Record<number, string>][]): string {
  const r: string[] = ['0', 'SECTION', '2', 'ENTITIES'];
  r.push('0', 'LWPOLYLINE', '8', 'RIQUADRO', '90', String(riquadro.length), '70', '1');
  for (const [x, y] of riquadro) r.push('10', String(x), '20', String(y));
  for (const [tipo, g] of entita) {
    r.push('0', tipo);
    for (const [c, v] of Object.entries(g)) r.push(c, v);
  }
  r.push('0', 'ENDSEC', '0', 'EOF');
  return r.join('\n');
}
