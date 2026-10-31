/**
 * NCV081 (variazione con elaborato planimetrico su 3 schede e planimetrie su 6 e 5 schede): importazione del PDF di
 * Docfa e nuova esportazione. Stesse pagine nello stesso ordine, stesse immagini, stessi file dati.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { importaPdfDocfa, estraiContenutoPdf } from '../importa';
import { esportaPratica } from '../../esporta';
import { FIXTURES } from './helpers';

const PDF = join(FIXTURES, 'NCV081.PDF');

describe.skipIf(!existsSync(PDF))('NCV081: importa ed esporta', () => {
  it('ricostruisce lo stesso documento', async () => {
    const orig = new Uint8Array(readFileSync(PDF));
    const imp = await importaPdfDocfa(orig);
    const p = imp.pratica;
    expect(p.elaboratoPlanimetrico?.disegni?.length).toBe(3);
    const u504 = p.unita.find((u) => u.identificativo.subalterno === '504')!;
    expect(u504.planimetria?.altreSchede?.length).toBe(5);
    expect(u504.planimetria?.altreSchede?.every((s) => s.tiff && s.ntf)).toBe(true);
    const u505 = p.unita.find((u) => u.identificativo.subalterno === '505')!;
    expect(u505.planimetria?.altreSchede?.length).toBe(4);

    const r = await esportaPratica(p, { dataOra: new Date('2026-05-15T08:00:00+02:00') });
    const nuovo = await estraiContenutoPdf(r.pdf);
    const vecchio = await estraiContenutoPdf(orig);
    // stessa sequenza di immagini (elaborato prima, poi le planimetrie nell'ordine delle unità)
    expect(r.immagini.map((i) => i.nome)).toEqual(vecchio.immagini.map((i) => i.nome));
    expect(nuovo.immagini.length).toBe(vecchio.immagini.length);
    nuovo.immagini.forEach((im, k) => expect([...im.g4]).toEqual([...vecchio.immagini[k].g4]));
    // stessi file nascosti (dati e NTF)
    const mappa = (c: typeof nuovo) => Object.fromEntries(c.file.map((f) => [f.nome, [...f.dati].join(',')]));
    expect(Object.keys(mappa(nuovo)).sort()).toEqual(Object.keys(mappa(vecchio)).sort());
    const diff: string[] = [];
    for (const f of vecchio.file) {
      const g = nuovo.file.find((x) => x.nome === f.nome);
      if (!g) continue;
      // record I del 1N parte II: Docfa lascia memoria non inizializzata in 18-44 e 68-198 e varia il riempimento in 249-265
      // (vedi roundtrip.test.ts): zone non significative, si confrontano azzerate
      const maschera = (r: string) => (r[16] === 'I' && /^NC[VA]/.test(f.nome) ? [[17, 44], [67, 198], [248, 265]].reduce((t, [a, b]) => t.slice(0, a) + ' '.repeat(Math.max(0, Math.min(b, t.length) - a)) + t.slice(b), r) : r);
      const ra = Buffer.from(f.dati).toString('latin1').split('\r\n').map(maschera), rb = Buffer.from(g.dati).toString('latin1').split('\r\n').map(maschera);
      ra.forEach((r, i) => { if (r !== rb[i]) { for (let c = 0; c < Math.max(r.length, rb[i]?.length ?? 0); c++) if (r[c] !== rb[i]?.[c]) { diff.push(`${f.nome} rec ${i + 1} pos ${c + 1}: docfa "${r.slice(c, c + 12)}" nostro "${(rb[i] ?? '').slice(c, c + 12)}"`); break; } } });
      if (ra.length !== rb.length) diff.push(`${f.nome}: record ${ra.length} vs ${rb.length}`);
    }
    expect(diff.slice(0, 20).join('\n')).toBe('');
    expect(r.avvisi).toEqual([]);
  }, 300000);
});
