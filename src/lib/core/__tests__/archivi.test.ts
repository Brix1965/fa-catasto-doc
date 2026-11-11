// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { leggiComuni, leggiStradario, leggiTariffe, rendita, toponimoDocfa, leggiSetup } from '../archivi';

const DIR = join(process.cwd(), 'fixtures-private/archivi');
const ok = existsSync(join(DIR, 'Comuni.dat'));

describe.skipIf(!ok)('archivi', () => {
  it('Comuni.dat: Firenze = D612 / I1AA', () => {
    const comuni = leggiComuni(new Uint8Array(readFileSync(join(DIR, 'Comuni.dat'))));
    expect(comuni.length).toBeGreaterThan(7000);
    const fi = comuni.find((c) => c.codice === 'D612');
    expect(fi).toMatchObject({ nome: 'FIRENZE', provincia: 'FI', codiceAmministrativo: 'I1AA' });
  });
  it('stradario: via Fiesolana = D612 0001271', () => {
    const strade = leggiStradario(new Uint8Array(readFileSync(join(DIR, 'FI-topo-com.dat'))));
    const s = strade.find((x) => x.toponimoArchivio === 'FIESOLANA, VIA' && x.codiceCatastale === 'D612');
    expect(s?.progressivo).toBe('0001271');
    expect(s?.toponimo).toBe('via fiesolana');
    expect(toponimoDocfa('DI SANTA MARIA IN CAMPO, PIAZZA')).toBe('piazza di santa maria in campo');
  });
  it('tariffe: A/3 classe 2 zona 1 Firenze → rendita 4,5 vani = 732,08', () => {
    const t = leggiTariffe(new Uint8Array(readFileSync(join(DIR, 'Fi-tar.dat'))));
    const x = t.find((r) => r.codiceAmministrativo === 'I1AA' && r.zona === '001' && r.categoria === 'A03' && r.classe === '02');
    expect(x?.lire).toBe(315000);
    expect(rendita(4.5, 315000)).toBe(732.08);
    expect(rendita(3.5, 315000)).toBe(569.39);
  });
  it('SETUP.DAT', () => {
    const s = leggiSetup(new Uint8Array(readFileSync(join(DIR, 'SETUP.DAT'))));
    expect(s.albo).toBe('03');
    expect(s.provinciaAlbo).toBe('FI');
  });
});

import { riconosciArchivio, comuniIncorporati, leggiZone } from '../archivi';

describe('riconoscimento archivi e comuni incorporati', () => {
  it('riconosce tutti i file della cartella provinciale', () => {
    const casi: [string, string, string?, string?][] = [
      ['FI-topo-com.dat', 'stradario', 'FI'], ['Fi-tar.dat', 'tariffe', 'FI'], ['Fi-zon.dat', 'zone', 'FI'],
      ['Nclfiv1.dat', 'classamento', 'FI', '1'], ['NCLFIV8A.DAT', 'classamento', 'FI', '8A'], ['BO-ZON.DAT', 'zone', 'BO'],
      ['BO-TAR.dat', 'tariffe', 'BO'], ['NCLBOV4.dat', 'classamento', 'BO', '4'], ['Comuni.dat', 'comuni'], ['SETUP.DAT', 'setup'],
      ['NCLPRV1.DAT', 'ignorato'], ['.DS_Store', 'ignorato'],
    ];
    for (const [nome, tipo, prov, parte] of casi) {
      const r = riconosciArchivio(nome);
      expect(r.tipo, nome).toBe(tipo);
      if (prov) expect(r.provincia, nome).toBe(prov);
      if (parte) expect(r.parte, nome).toBe(parte);
    }
  });
  it('i comuni incorporati comprendono Firenze ed Empoli', () => {
    const { comuni } = comuniIncorporati();
    expect(comuni.length).toBeGreaterThan(7000);
    expect(comuni.find((c) => c.codice === 'D612')).toMatchObject({ nome: 'FIRENZE', provincia: 'FI', codiceAmministrativo: 'I1AA' });
    expect(comuni.find((c) => c.codice === 'D403')?.nome).toBe('EMPOLI');
  });
  it('zone', () => {
    const z = leggiZone(new TextEncoder().encode('I1AA    0035DEAAA\r\nI1AA    0175BAAAA'));
    expect(z).toEqual([
      { codiceAmministrativo: 'I1AA', sezione: '', foglio: '0035', codice: 'DEAAA' },
      { codiceAmministrativo: 'I1AA', sezione: '', foglio: '0175', codice: 'BAAAA' },
    ]);
  });
});

describe('rendita con l\'aritmetica di Docfa', () => {
  it('coincide con il calcolo del classamento automatico (NZCT06)', async () => {
    const { renditaNclas } = await import('../classamento/nzct06');
    const { rendita } = await import('../archivi');
    const tariffe = (lire: number) => ['I1AA ' + '001' + 'C02' + '03' + String(lire).padStart(7, '0'), 'I1AA ' + '001' + 'A03' + '02' + String(lire).padStart(7, '0')];
    // casi in cui il calcolo in virgola mobile sbagliava il centesimo
    expect(rendita(151, 1000)).toBe(Number(renditaNclas(tariffe(1000), 'I1AA ', '001', 'C02', '03', '    151', false)) / 100);
    expect(rendita(13.5, 113000)).toBe(Number(renditaNclas(tariffe(113000), 'I1AA ', '001', 'A03', '02', '   13,5', true)) / 100);
    expect(rendita(4.5, 315000)).toBe(732.08);
    expect(rendita(0, 315000)).toBe(0);
  });
});

describe('C.A.P. del comune (Cap.dat di Docfa)', async () => {
  const { capComune } = await import('../archivi');
  it('un C.A.P. per comune, generico per le città come Docfa', () => {
    expect(capComune('F648')).toBe('50025'); // Montespertoli
    expect(capComune('D612')).toBe('50100'); // Firenze: generico
    expect(capComune('h501')).toBe('00100'); // Roma
    expect(capComune('A001')).toBe('35031');
    expect(capComune('ZZZZ')).toBeUndefined();
  });
});
