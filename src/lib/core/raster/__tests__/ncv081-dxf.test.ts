/**
 * Confronto con Docfa sui DXF reali di NCV081 (fixtures-private/NCV081/dxf, saltato se mancano):
 * elaborato planimetrico su 3 schede e planimetrie su più schede (6 e 5), immagine e poligoni NTF.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { componiElaborato, componiPlanimetria } from '../planimetria';
import { preparaDxf } from '../dxf-correzioni';
import { rilevaFoglio } from '../dxf';
import { generaNtf, leggiNtf } from '../../ntf';
import { FIXTURES, CARTIGLI, leggi, iou, decodificaConPillow, pillowDisponibile } from './util';

const DIR = join(FIXTURES, 'NCV081');
const ok = existsSync(join(DIR, 'dxf', '0000217.001.dxf')) && pillowDisponibile();
const LOG = process.env.LOG_CONFRONTO;
const BASE = { ufficio: 'Firenze', comune: 'Firenze', compilatore: CARTIGLI.tecnico.compilatore, albo: 'Geometri', provincia: 'Firenze', numeroAlbo: CARTIGLI.tecnico.numeroAlbo };
const F = CARTIGLI.NCV081;

describe.skipIf(!ok)('NCV081: DXF reali contro le immagini di Docfa', () => {
  const casi = ['0000217.001', '0000217.002', '0000217.003', '0000209.001', '0000202.001', ...[1, 2, 3, 4, 5, 6].map((k) => `0000211.00${k}`), ...[1, 2, 3, 4, 5].map((k) => `0000216.00${k}`)];
  for (const nome of casi) {
    it(`${nome}: immagine come Docfa`, async () => {
      const testo = readFileSync(join(DIR, 'dxf', `${nome}.dxf`), 'latin1');
      const { letto } = preparaDxf(testo);
      const f = rilevaFoglio(letto);
      const orig = decodificaConPillow(leggi(join(DIR, nome)));
      const ep = nome.startsWith('0000217');
      const scheda = Number(nome.slice(8));
      const foglio = { formato: f.formato, scala: f.scala };
      const r = ep
        ? await componiElaborato({ dxf: letto, foglio, cartiglio: { ...BASE, foglio: F.foglio, particella: F.particella, scala: f.scala } })
        : await componiPlanimetria({ dxf: letto, foglio, cartiglio: { ...BASE, via: F.via, civico: F.civico, foglio: F.foglio, particella: F.particella, subalterno: '', scheda, scala: f.scala } });
      const v = iou(orig.dilata(2), r.bitmap.dilata(2));
      if (LOG) appendFileSync(LOG, `${nome} ${f.formato} 1:${f.scala} iou=${v.toFixed(3)} poligoni=${letto.poligoni.length}\n`);
      expect(r.width).toBe(orig.width);
      expect(v).toBeGreaterThan(0.75);
      const ntfPath = join(DIR, `N${nome}`);
      if (existsSync(ntfPath)) {
        // in Docfa il tecnico può cambiare tipo o togliere poligoni: si confrontano le coordinate di quelli corrispondenti
        const docfa = leggiNtf(new Uint8Array(readFileSync(ntfPath)));
        const nostro = leggiNtf(generaNtf(Number(nome.slice(0, 7)), scheda, foglio, letto.poligoni));
        let confrontati = 0;
        for (const p of docfa.poligoni) {
          const q = nostro.poligoni.find((q) => Math.abs(q.punti[0][0] - p.punti[0][0]) < 4 && Math.abs(q.punti[0][1] - p.punti[0][1]) < 4);
          expect(q, `poligono di Docfa con ${p.punti.length} vertici non trovato`).toBeDefined();
          // stessa superficie (in 211.005 Docfa ha tolto 27 piccoli risalti da 0,2 mm: 176 → 149 vertici, area -0,002%)
          expect(Math.abs(q!.areaCent - p.areaCent)).toBeLessThanOrEqual(Math.max(2, p.areaCent * 0.005));
          if (q!.punti.length === p.punti.length) p.punti.forEach((v, i) => {
            expect(Math.abs(v[0] - q!.punti[i][0])).toBeLessThanOrEqual(2);
            expect(Math.abs(v[1] - q!.punti[i][1])).toBeLessThanOrEqual(2);
          });
          confrontati++;
        }
        if (LOG) appendFileSync(LOG, `   NTF: ${confrontati}/${docfa.poligoni.length} poligoni di Docfa ritrovati (nostri ${nostro.poligoni.length})\n`);
      }
    }, 120000);
  }
});
