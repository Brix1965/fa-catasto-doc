// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  leggiVisura, analizzaVisura, intestatiDi, categoriaDocfa, classeDocfa, consistenzaDocfa, inAttiDaVisura, classiPiuElevate,
  leggiConsistenza, leggiSuperficie, leggiRendita, leggiIndirizzo, leggiDiritti, leggiAnagrafica,
  type ElementoTesto, type PaginaTesto,
} from '..';

const CAMPIONE = join(__dirname, '..', '..', '..', '..', '..', 'fixtures-private', 'visure', 'sintetica-soggetto.pdf');

describe('conversioni nei formati dell\'app', () => {
  it('categoria', () => {
    expect(categoriaDocfa('A/2')).toBe('A02');
    expect(categoriaDocfa('C/1')).toBe('C01');
    expect(categoriaDocfa('D/2')).toBe('D02');
    expect(categoriaDocfa('F/1')).toBe('F01');
    expect(categoriaDocfa('A/10')).toBe('A10');
    expect(categoriaDocfa('boh')).toBe('');
  });
  it('classe e consistenza', () => {
    expect(classeDocfa('4')).toBe('04');
    expect(classeDocfa('12')).toBe('12');
    expect(classeDocfa('u')).toBe('U');
    expect(classeDocfa(undefined)).toBe('');
    expect(consistenzaDocfa('14,5')).toBe('14,5');
    expect(consistenzaDocfa('6.642')).toBe('6642');
    expect(consistenzaDocfa('1.234,5')).toBe('1234,5');
    expect(consistenzaDocfa('4.5')).toBe('4,5');
    expect(consistenzaDocfa('155')).toBe('155');
  });
  it('dati in atti e classi più elevate', () => {
    expect(inAttiDaVisura({ categoria: 'A/3', classe: '2', consistenza: '5,5' } as never)).toEqual({ categoria: 'A03', classe: '02', consistenza: '5,5' });
    const imm = [
      { categoria: 'A/2', classe: '3' }, { categoria: 'C/2', classe: '2' }, { categoria: 'A/2', classe: '4' },
      { categoria: 'D/2' }, { categoria: 'F/1' }, { categoria: 'C/2', classe: '10' }, { categoria: 'C/2', classe: '9' },
    ];
    expect(classiPiuElevate(imm)).toEqual([{ categoria: 'A02', classe: '04' }, { categoria: 'C02', classe: '10' }]);
  });
  it('valori stampati', () => {
    expect(leggiConsistenza('14,5 vani')).toEqual({ consistenza: '14,5', unita: 'vani' });
    expect(leggiConsistenza('155m²')).toEqual({ consistenza: '155', unita: 'm²' });
    expect(leggiConsistenza('6.642m³')).toEqual({ consistenza: '6.642', unita: 'm³' });
    expect(leggiSuperficie('Totale: 1.246 m² Totale escluse aree scoperte**: 230 m²')).toEqual({ totale: 1246, senzaAree: 230 });
    expect(leggiSuperficie('Totale: 183 m²')).toEqual({ totale: 183, senzaAree: undefined });
    expect(leggiRendita('Euro 2.705,72')).toBe(2705.72);
    expect(leggiRendita('')).toBeUndefined();
  });
  it('indirizzo', () => {
    expect(leggiIndirizzo('VIA ROMA n. 1-3 Scala A Interno 4 Piano S1-T - 2')).toEqual({
      toponimo: 'VIA ROMA', civici: ['1', '3'], piani: ['S1-T', '2'], scala: 'A', interno: '4', testo: 'VIA ROMA n. 1-3 Scala A Interno 4 Piano S1-T - 2',
    });
    const snc = leggiIndirizzo('VIA DEL PIANO n. SNC Piano T');
    expect([snc.toponimo, snc.civici, snc.piani]).toEqual(['VIA DEL PIANO', ['SNC'], ['T']]);
    expect(leggiIndirizzo('LOCALITA\' BOSCO').toponimo).toBe('LOCALITA\' BOSCO');
  });
  it('intestati', () => {
    expect(leggiDiritti("(1) Proprieta' 1/1")).toEqual({ codiceDiritto: '1', diritto: "Proprieta'", quota: '1/1' });
    expect(leggiDiritti("(8) Usufrutto per 1/2 in regime di comunione dei beni")).toEqual({ codiceDiritto: '8', diritto: 'Usufrutto', quota: '1/2' });
    expect(leggiAnagrafica('ROSSI Mario Luigi nato a PROVA (PR) il 01/01/1970')).toEqual({ cognome: 'ROSSI', nome: 'Mario Luigi', luogoNascita: 'PROVA (PR)', dataNascita: '01/01/1970' });
    expect(leggiAnagrafica('DE LUCA Anna')).toEqual({ cognome: 'DE LUCA', nome: 'Anna' });
    expect(leggiAnagrafica('ALFA BETA S.R.L. con sede in PROVA (PR)')).toEqual({ denominazione: 'ALFA BETA S.R.L.', sede: 'PROVA (PR)' });
  });
});

/** Visura sintetica finta, con le posizioni del modello Sister; la seconda riga continua sulla pagina seguente. */
function visuraFinta(): PaginaTesto[] {
  let ordine = 0;
  const pagine: PaginaTesto[] = [1, 2].map((numero) => ({ numero, larghezza: 842, altezza: 595, elementi: [] }));
  const el = (p: number, testo: string, x: number, y: number, w = testo.length * 4, h = 8) => {
    const e: ElementoTesto = { testo, x, y, w, h, pagina: p, ordine: ordine++ };
    pagine[p - 1].elementi.push(e);
  };
  const testata = (p: number) => {
    el(p, 'Direzione Provinciale di Prova', 28, 529, 130, 10);
    el(p, 'Visura attuale sintetica per soggetto', 280, 530, 285, 20);
    el(p, 'Situazione degli atti informatizzati al 01/02/2026', 267, 510, 314, 16);
    el(p, 'Data: 01/02/2026 Ora: 10.00.00', 620, 560, 127, 10);
  };
  const intestazione = (p: number, dy: number) => {
    const h: [string, number, number, number][] = [
      ['DATI IDENTIFICATIVI', 94.5, 411.9, 96.9], ['N.', 36.1, 399.9, 8.7], ['Sez', 66.5, 398.9, 13], ['Urbana', 59.8, 389.9, 26.5],
      ['Foglio', 111.2, 394.4, 23.5], ['Numero', 163.3, 394.4, 29.5], ['Sub', 211, 394.4, 14], ['Zona', 238.8, 398.9, 18.5],
      ['Cens.', 237.9, 389.9, 20.3], ['Micro', 267, 398.9, 22], ['Zona', 268.8, 389.9, 18.5], ['Categoria', 300.5, 394.4, 35],
      ['Classe', 345, 394.4, 21], ['Consistenza', 371.3, 394.4, 43.5], ['Superficie', 437, 398.9, 37], ['Catastale', 439, 389.9, 33],
      ['Rendita', 509, 394.4, 28], ['Indirizzo', 616.8, 398.9, 32.5], ['Dati derivanti da', 602.8, 389.9, 60.5], ['Dati Ulteriori', 738.6, 394.4, 48.7],
    ];
    for (const [t, x, y, w] of h) el(p, t, x, y + dy, w, 9);
  };
  testata(1);
  el(1, '1. Immobili siti nel Comune di PROVA (Codice Z999) Catasto dei Fabbricati', 30, 425, 340, 10);
  intestazione(1, 0);
  const riga = (y: number, v: string[]) => {
    const pos = [38.5, 119, 172, 216, 312, 353.5, 377.7, 431.1, 499.4];
    v.forEach((t, k) => t && el(1, t, pos[k], y));
  };
  riga(352, ['1', '10', '100', '1', 'A/3', '2', '5,5 vani', 'Totale: 90 m²', 'Euro 400,00']);
  el(1, 'VIA ROMA n. 1 Piano T-1', 555, 376);
  el(1, 'COSTITUZIONE del 01/01/2020', 555, 360);
  el(1, 'Pratica n. AB0000001', 555, 352);
  riga(97, ['2', '10', '100', '2', 'C/6', '1', '15m²', 'Totale: 18 m²', 'Euro 30,00']);
  el(1, 'VIA ROMA n. 1 Piano S1', 555, 121);
  el(1, 'COSTITUZIONE del', 555, 105);
  testata(2);
  intestazione(2, 55);
  el(2, '01/01/2020 Pratica n. AB0000002', 555, 420);
  el(2, 'Unità immobiliari n. 2', 28, 300, 94, 10);
  el(2, 'Intestazione degli immobili indicati al n.1', 28, 285, 176, 10);
  el(2, 'N.', 36.6, 272, 7.8);
  el(2, 'DATI ANAGRAFICI', 218.4, 272, 69.1);
  el(2, 'CODICE FISCALE', 485.9, 272, 64.2);
  el(2, 'DIRITTI E ONERI REALI', 654.1, 272, 87.8);
  el(2, '1', 38.5, 262);
  el(2, 'ROSSI Mario nato a PROVA (PR) il 01/01/1970', 55, 262, 170);
  el(2, 'RSSMRA70A01Z999Q*', 494, 262, 68);
  el(2, "(1) Proprieta' 1/2", 668.8, 262, 54);
  el(2, '2', 38.5, 252);
  el(2, 'BIANCHI Anna nata a PROVA (PR) il 02/02/1972', 55, 252, 172);
  el(2, 'BNCNNA72B42Z999Q', 494, 252, 64);
  el(2, "(1) Proprieta' 1/2", 668.8, 252, 54);
  el(2, 'DATI DERIVANTI DA', 30, 242, 80);
  return pagine;
}

describe('analisi della tabella (visura finta)', () => {
  const v = analizzaVisura(visuraFinta());
  it('testata', () => {
    expect([v.tipo, v.storica, v.data, v.situazioneAl]).toEqual(['sintetica-soggetto', false, '01/02/2026', '01/02/2026']);
    expect(v.avvisi).toEqual([]);
  });
  it('immobili, anche con la riga spezzata tra due pagine', () => {
    expect(v.immobili).toHaveLength(2);
    const [a, b] = v.immobili;
    expect(a).toMatchObject({
      foglio: '10', numero: '100', subalterno: '1', categoria: 'A/3', classe: '2', consistenza: '5,5', unitaConsistenza: 'vani',
      superficieCatastale: 90, rendita: 400, comune: { nome: 'PROVA', codice: 'Z999' }, gruppo: 1, progressivo: 1,
      datiDerivanti: 'COSTITUZIONE del 01/01/2020 Pratica n. AB0000001',
    });
    expect(a.indirizzo).toMatchObject({ toponimo: 'VIA ROMA', civici: ['1'], piani: ['T-1'] });
    expect(b).toMatchObject({ categoria: 'C/6', consistenza: '15', unitaConsistenza: 'm²', rendita: 30, datiDerivanti: 'COSTITUZIONE del 01/01/2020 Pratica n. AB0000002' });
    expect(b.indirizzo?.piani).toEqual(['S1']);
  });
  it('intestati', () => {
    expect(v.intestati).toHaveLength(2);
    expect(v.intestati[0]).toMatchObject({ gruppo: 1, progressivo: 1, cognome: 'ROSSI', nome: 'Mario', codiceFiscale: 'RSSMRA70A01Z999Q', codiceFiscaleValidato: true, diritto: "Proprieta'", quota: '1/2' });
    expect(v.intestati[1]).toMatchObject({ cognome: 'BIANCHI', nome: 'Anna', codiceFiscaleValidato: false, quota: '1/2' });
    expect(intestatiDi(v, v.immobili[0])).toHaveLength(2);
  });
});

describe.skipIf(!existsSync(CAMPIONE))('visura sintetica per soggetto reale (fixtures-private)', () => {
  it('legge immobili e intestati', async () => {
    const v = await leggiVisura(new Uint8Array(readFileSync(CAMPIONE)));
    expect(v.tipo).toBe('sintetica-soggetto');
    expect(v.storica).toBe(false);
    expect(v.avvisi).toEqual([]);
    expect(v.data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    expect(v.immobili).toHaveLength(15);
    expect(v.immobili.filter((i) => i.gruppo === 1)).toHaveLength(13);
    expect(v.immobili.filter((i) => i.gruppo === 2)).toHaveLength(2);
    expect(v.immobili.map((i) => i.progressivo)).toEqual([...Array(13).keys()].map((k) => k + 1).concat([1, 2]));
    for (const i of v.immobili) {
      expect(i.comune.codice).toMatch(/^[A-Z]\d{3}$/);
      expect(i.foglio).toMatch(/^\d+$/);
      expect(i.numero).toMatch(/^\d+$/);
      expect(i.categoria).toMatch(/^[A-F]\/\d{1,2}$/);
      expect(i.datiDerivanti).toMatch(/^VARIAZIONE del \d{2}\/\d{2}\/\d{4}/);
      expect(i.indirizzo?.toponimo).toBeTruthy();
      expect(i.indirizzo?.civici.length).toBeGreaterThan(0);
      expect(i.indirizzo?.piani.length).toBeGreaterThan(0);
    }
    expect(new Set(v.immobili.map((i) => i.categoria))).toEqual(new Set(['C/1', 'B/4', 'D/2', 'A/2', 'C/2', 'F/1']));

    const vani = v.immobili.find((i) => i.consistenza === '14,5');
    expect(vani?.unitaConsistenza).toBe('vani');
    expect(vani?.superficieSenzaAree).toBeGreaterThan(0);
    expect(v.immobili.some((i) => i.unitaConsistenza === 'm³')).toBe(true);
    expect(v.immobili.some((i) => (i.indirizzo?.piani.length ?? 0) >= 2)).toBe(true);

    // con classe: subalterno, rendita numerica, superficie; D/2 con rendita ma senza classe; F/1 senza sub, classe e rendita
    for (const i of v.immobili.filter((x) => x.classe)) {
      expect(i.subalterno).toMatch(/^\d+$/);
      expect(typeof i.rendita).toBe('number');
      expect(i.rendita).toBeGreaterThan(0);
      expect(i.superficieCatastale).toBeGreaterThan(0);
    }
    const d = v.immobili.find((i) => i.categoria === 'D/2');
    expect(d?.classe).toBeUndefined();
    expect(d?.rendita).toBeGreaterThan(0);
    for (const f of v.immobili.filter((x) => x.categoria === 'F/1')) {
      expect([f.subalterno, f.classe, f.rendita, f.annotazioni]).toEqual([undefined, undefined, undefined, undefined]);
      expect(f.unitaConsistenza).toBe('m²');
    }
    expect(v.immobili.filter((i) => i.annotazioni?.length)).toHaveLength(13);

    const classi = classiPiuElevate(v.immobili);
    expect(classi.map((c) => c.categoria).sort()).toEqual(['A02', 'B04', 'C01', 'C02']);
    for (const c of classi) expect(c.classe).toMatch(/^\d\d$/);

    expect(v.intestati.length).toBeGreaterThanOrEqual(2);
    expect(new Set(v.intestati.map((x) => x.gruppo))).toEqual(new Set([1, 2]));
    for (const x of v.intestati) {
      expect(x.diritto).toBeTruthy();
      expect(x.quota).toMatch(/^\d+\/\d+$/);
      expect(x.codiceFiscale).toMatch(/^[A-Z0-9]{11,16}$/);
      expect(x.denominazione ?? x.cognome).toBeTruthy();
    }
  }, 30000);
});

describe.skipIf(!existsSync('fixtures-private/visure/privati.pdf'))('visura di persone fisiche (campione reale)', () => {
  it('persone, quote, graffati, terreni saltati', async () => {
    const v = await leggiVisura(new Uint8Array(readFileSync('fixtures-private/visure/privati.pdf')));
    expect(v.immobili).toHaveLength(2);
    expect(v.immobili[0].graffati).toHaveLength(2);
    expect(v.immobili[1].subalterno).toBeTruthy();
    expect(v.immobili[1].graffati?.[0].subalterno).toBeUndefined();
    const persone = v.intestati.filter((x) => x.cognome && x.nome && x.dataNascita && x.luogoNascita);
    expect(persone.length).toBe(v.intestati.length);
    expect(v.intestati.some((x) => x.quota === '1/3')).toBe(true);
    expect(v.avvisi).toEqual(['Tabelle del Catasto Terreni non lette: si leggono solo i fabbricati']);
  });
});
