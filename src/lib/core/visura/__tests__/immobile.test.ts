// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { inAttiDaVisura, leggiVisura } from '..';

const FILE = 'fixtures-private/visure/immobile.pdf';

// visura «attuale per immobile» nel formato a voci: il file è privato (non nel repository)
describe.skipIf(!existsSync(FILE))('visura per immobile (formato a voci)', () => {
  it('legge identificativi, classamento, superficie e intestato', async () => {
    const v = await leggiVisura(new Uint8Array(readFileSync(FILE)));
    expect(v.tipo).toBe('immobile');
    expect(v.avvisi).toEqual([]);
    expect(v.immobili).toHaveLength(1);
    const im = v.immobili[0];
    expect(im.comune.codice).toMatch(/^[A-Z]\d{3}$/);
    expect(im).toMatchObject({ foglio: '98', numero: '402', subalterno: '501', categoria: 'A/3', classe: '3', consistenza: '4,5', unitaConsistenza: 'vani', zonaCensuaria: '2', rendita: 673.98, superficieCatastale: 93, superficieSenzaAree: 91 });
    expect(im.indirizzo?.piani).toEqual(['1-2']);
    expect(im.indirizzo?.civici).toHaveLength(1);
    expect(inAttiDaVisura(im)).toMatchObject({ categoria: 'A03', classe: '03', consistenza: '4,5' });
    expect(v.intestati).toHaveLength(1);
    const it0 = v.intestati[0];
    expect(it0.codiceFiscale).toMatch(/^[A-Z0-9]{16}$/);
    expect(it0.cognome).toBeTruthy();
    expect(it0.dataNascita).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(it0).toMatchObject({ diritto: "Proprieta'", quota: '1/1' });
  });
});
