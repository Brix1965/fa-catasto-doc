import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { Bitmap } from '../bitmap';
import { caricaModello, AREA_DISEGNO } from '../modelli';
import { componiElaborato, scriviCartiglioElaborato, type CartiglioElaborato } from '../planimetria';
import { FIXTURES, CARTIGLI, esiste, leggi, iou, decodificaConPillow, pillowDisponibile } from './util';

/** Solo la fascia del cartiglio (fuori dal riquadro del disegno). */
function cartiglio(bm: Bitmap, formato: 'A4' | 'A3'): Bitmap {
  const a = AREA_DISEGNO[formato];
  const out = new Bitmap(bm.width, bm.height);
  for (let y = 0; y < bm.height; y++) for (let x = 0; x < bm.width; x++) {
    const dentro = x >= a.x0 - 3 && x <= a.x1 + 3 && y >= a.y0 - 3 && y <= a.y1 + 3;
    if (!dentro && bm.getPixel(x, y)) out.setPixel(x, y, true);
  }
  return out;
}

const BASE: Omit<CartiglioElaborato, 'foglio' | 'particella' | 'scala'> = {
  ufficio: 'Firenze', comune: 'Firenze', compilatore: CARTIGLI.tecnico.compilatore, albo: 'Geometri', provincia: 'Firenze', numeroAlbo: CARTIGLI.tecnico.numeroAlbo,
};
const CASI: [string, 'A4' | 'A3', CartiglioElaborato][] = [
  ['NCV065/0000195.001', 'A4', { ...BASE, ...CARTIGLI.NCV065, scala: 500 }],
  ['NCV081/0000217.001', 'A3', { ...BASE, foglio: CARTIGLI.NCV081.foglio, particella: CARTIGLI.NCV081.particella, scala: 200 }],
];

describe.skipIf(!pillowDisponibile())('elaborato planimetrico', () => {
  for (const [file, formato, c] of CASI) {
    it.skipIf(!esiste(join(FIXTURES, file)))(`cartiglio ${formato} come Docfa (${file})`, async () => {
      const orig = cartiglio(decodificaConPillow(leggi(join(FIXTURES, file))), formato);
      const bm = await caricaModello(formato, 'elaborato');
      scriviCartiglioElaborato(bm, formato, c);
      const nostro = cartiglio(bm, formato);
      expect(iou(orig.dilata(2), nostro.dilata(2))).toBeGreaterThan(0.9);
    });
  }

  it('compone la scheda dal DXF: disegno solo nel riquadro, TIFF della misura giusta', async () => {
    const dxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', '0', '10', '1', '20', '1', '11', '30', '21', '40', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const r = await componiElaborato({ dxf, foglio: { formato: 'A3', scala: 200 }, cartiglio: { ...BASE, foglio: '1', particella: '2', scala: 200 } });
    expect(r.width).toBe(2340);
    expect(r.height).toBe(3310);
    expect(r.tiff.length).toBeGreaterThan(1000);
    const a = AREA_DISEGNO.A3;
    let dentro = 0;
    for (let y = a.y0 + 5; y < a.y1 - 5; y++) for (let x = a.x0 + 5; x < a.x1 - 5; x++) if (r.bitmap.getPixel(x, y)) dentro++;
    expect(dentro).toBeGreaterThan(100);
  });
});
