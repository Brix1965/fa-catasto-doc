// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { leggiDxf, rilevaFoglio, type Entita } from '../dxf';
import { preparaDxf } from '../dxf-correzioni';
import { scriviDxf } from '../dxf-scrivi';

const base = { layer: '0', colore: 7, spessore: 0 };
const entita: Entita[] = [
  { ...base, tipo: 'linea', p1: [1, 1], p2: [5, 1], spessore: 0.07 },
  { ...base, tipo: 'linea', p1: [1, 2], p2: [2, 2], tipoLinea: 'NASCOSTA' },
  { ...base, tipo: 'polilinea', punti: [[1, 1], [5, 1], [5, 4], [1, 4]], chiusa: true, layer: 'MURI', colore: 3 },
  { ...base, tipo: 'arco', centro: [2, 2], raggio: 0.8, inizio: 0, fine: 90 },
  { ...base, tipo: 'cerchio', centro: [3, 3], raggio: 0.2 },
  { ...base, tipo: 'testo', testo: 'camera', punto: [3, 2.5], altezza: 0.25, rotazione: 0, allineamentoH: 'centro', allineamentoV: 'medio', larghezza: 1 },
];

describe('scrittura DXF R12', () => {
  it('si rilegge uguale', () => {
    const testo = scriviDxf({ entita, poligoni: [{ tipo: 'A', vertici: [[0.9, 0.9], [5.1, 0.9], [5.1, 4.1], [0.9, 4.1]], altezzaValida: true }], riquadro: [[0, 0], [39, 0], [39, 47], [0, 47]] });
    const l = leggiDxf(testo);
    expect(l.versione).toBe('AC1009');
    expect(l.entita.map((e) => e.tipo)).toEqual(['linea', 'linea', 'polilinea', 'arco', 'cerchio', 'testo']);
    expect(l.entita[0]).toMatchObject({ p1: [1, 1], p2: [5, 1], spessore: 0.07 });
    expect(l.entita[1].tipoLinea).toBe('NASCOSTA');
    expect(l.entita[2]).toMatchObject({ layer: 'MURI', colore: 3, chiusa: true });
    expect(l.entita[5]).toMatchObject({ testo: 'camera', punto: [3, 2.5], allineamentoH: 'centro' });
    expect(l.poligoni).toEqual([{ tipo: 'A', vertici: [[0.9, 0.9], [5.1, 0.9], [5.1, 4.1], [0.9, 4.1]], altezzaValida: true }]);
    expect(l.layers.DOCFA_POLIGONI.spento).toBe(true);
    expect(rilevaFoglio(l)).toMatchObject({ formato: 'A4', scala: 200 });
  });
});

const DIR = 'fixtures-private/vani';
describe.skipIf(!existsSync(DIR))('scrittura DXF R12: disegni reali', () => {
  for (const f of ['caso-1.dxf', 'caso-3.dxf'])
    it(`${f}: riscritto, stesse entità e poligoni`, () => {
      const a = preparaDxf(readFileSync(`${DIR}/${f}`, 'latin1')).letto;
      const b = preparaDxf(scriviDxf({ entita: a.entita, poligoni: a.poligoni, riquadro: a.riquadro })).letto;
      expect(b.entita.length).toBe(a.entita.length);
      expect(b.poligoni.length).toBe(a.poligoni.length);
      expect(b.entita.filter((e) => e.spessore > 0).length).toBe(a.entita.filter((e) => e.spessore > 0).length);
      expect(b.entita.map((e) => e.tipo)).toEqual(a.entita.map((e) => e.tipo));
    });
});

describe.skipIf(!existsSync(DIR))('scrittura DXF R12: stessa immagine', () => {
  it('caso-1 riscritto: la planimetria composta è identica', async () => {
    const { componiPlanimetria } = await import('../planimetria');
    const a = preparaDxf(readFileSync(`${DIR}/caso-1.dxf`, 'latin1'));
    const testo = scriviDxf({ entita: a.letto.entita, poligoni: a.letto.poligoni, riquadro: a.letto.riquadro });
    const cart = { ufficio: '', comune: '', via: '', civico: '', foglio: '1', particella: '1', compilatore: '', albo: '', provincia: '', numeroAlbo: '', scheda: 1, scala: 200 } as never;
    const foglio = { formato: a.foglio!.formato, scala: a.foglio!.scala };
    const x = await componiPlanimetria({ dxf: a.letto, foglio, cartiglio: cart });
    const y = await componiPlanimetria({ dxf: preparaDxf(testo).letto, foglio, cartiglio: cart });
    let diversi = 0;
    for (let i = 0; i < x.bitmap.data.length; i++) if (x.bitmap.data[i] !== y.bitmap.data[i]) diversi++;
    expect(diversi).toBe(0);
  }, 120000);
});

describe('riquadro di partenza', () => {
  it('A3 1:200: riquadro giusto, esempio riconosciuto, istruzioni spente', async () => {
    const { riquadroDiPartenza } = await import('../riquadro');
    const { riconosciVani } = await import('../../vani/riconosci');
    const p = preparaDxf(riquadroDiPartenza('A3', 200));
    expect(p.foglio).toMatchObject({ formato: 'A3', scala: 200, origineInZero: true });
    expect(p.letto.layers.ISTRUZIONI.spento).toBe(true);
    expect(p.letto.entita.some((e) => e.layer === 'ISTRUZIONI')).toBe(false);
    const r = riconosciVani(p.letto.entita, p.letto.poligoni, { riquadro: p.letto.riquadro });
    expect(r.vani.map((v) => [v.tipo, v.m2, v.altezze])).toEqual([['principale', 14, [2.7]]]);
  });
});
