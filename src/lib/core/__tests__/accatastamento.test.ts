import { describe, it, expect } from 'vitest';
import { compilaDocumento } from '../compile';
import { decompilaDocumento } from '../decompile';
import { decode1252, splitCRLF } from '../bytes';
import { nuovaPratica, nuovaUnita } from '$lib/stato/pratica-file';
import type { Pratica } from '../model';

function praticaAccatastamento(): Pratica {
  const p = nuovaPratica({ cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: 'RSSMRA70A01D612X', albo: '03', numeroIscrizione: '1234', provinciaAlbo: 'FI' }, 'accatastamento', 10);
  p.comune = { codice: 'D612', codiceAmministrativo: 'I1AA', nome: 'FIRENZE', provincia: 'FI' };
  const d = p.quadroA!.ditte[0];
  d.tipoMappale = { numero: 123456, data: { gg: 3, mm: 4, aaaa: 2026 } };
  d.unitaOrdinarie = 2;
  d.intestati = [
    { tipo: 'fisica', cognome: 'BIANCHI', nome: 'ANNA', sesso: 'F', nascita: { gg: 1, mm: 2, aaaa: 1970 }, provincia: 'FI', comune: 'FIRENZE', codiceFiscale: 'BNCNNA70B41D612Z', titolo: '01 ', quotaNumeratore: '1', quotaDenominatore: 2, regime: 'C', riferimento: 2 },
    { tipo: 'fisica', cognome: 'VERDI', nome: 'LUCA', sesso: 'M', nascita: { gg: 5, mm: 6, aaaa: 1968 }, provincia: 'FI', comune: 'FIRENZE', codiceFiscale: 'VRDLCU68H05D612K', titolo: '01 ', quotaNumeratore: '1', quotaDenominatore: 2, regime: 'C', riferimento: 1 },
  ];
  const u1 = nuovaUnita('C');
  u1.identificativo = { foglio: '12', numero: '345', subalterno: '1' };
  u1.indirizzo = { codiceStrada: '0001271', toponimo: 'via fiesolana', civici: ['48'], piani: ['T'] };
  u1.altriIndirizzi = [{ toponimo: 'via dei pilastri', civici: ['3/A'] }];
  u1.utilitaComuni = [{ operazione: 'I', identificativo: { foglio: '12', numero: '345', subalterno: '3' } }, { operazione: 'I', identificativo: { foglio: '12', numero: '345', subalterno: '4' } }];
  u1.classamento = { zonaCensuaria: '1', categoria: 'A03', classe: '3', consistenza: '4,5', superficieCatastale: 80, rendita: 650.74, classamentoAutomatico: false };
  const u2 = nuovaUnita('C');
  u2.recuperata = true;
  u2.identificativo = { foglio: '12', numero: '345', subalterno: '2' };
  u2.indirizzo = { toponimo: 'via fiesolana', civici: ['48'], piani: ['1'] };
  delete u2.mod1NParteII;
  u2.classamento = { zonaCensuaria: '1', categoria: 'C06', classe: '2', consistenza: '18', superficieCatastale: 20, rendita: 98.2, classamentoAutomatico: false };
  p.unita = [u1, u2];
  p.bcnc = [{ identificativo: { foglio: '12', numero: '345', subalterno: '3' }, piani: ['T', '1'] }, { identificativo: { foglio: '12', numero: '345', subalterno: '4' }, piani: ['T'] }];
  p.estremi = [{ uiuDa: 1, uiuA: 2, causale: 'IST', efficacia: { gg: 10, mm: 1, aaaa: 2020 }, repertorio: '12345', rogante: 'NOTAIO ROSSI', sede: 'D612', provincia: 'FI' }];
  p.annotazioni = 'Nuova costruzione di due unità';
  p.dichiarante = { cognome: 'BIANCHI', nome: 'ANNA', comune: 'FIRENZE', provincia: 'FI', indirizzo: 'VIA FIESOLANA', civico: 'SNC', cap: '50121' };
  return p;
}

describe('accatastamento', () => {
  it('produce i record attesi (NCA, testata NC, intestati, bcnc, indirizzi, utilità comuni)', () => {
    const c = compilaDocumento(praticaAccatastamento());
    expect(c.ncv.nome).toBe('NCA010.DAT');
    expect(c.nmv.nome).toBe('NMA010.DAT');
    const righe = splitCRLF(c.ncv.dati).filter((l) => l.length).map((l) => decode1252(l));
    expect(righe.every((r) => r.length === 350)).toBe(true);
    const tipi = righe.map((r) => r.charAt(16));
    expect(tipi).toEqual(['1', '2', '2', '3', '5', '6', '3', '8', '8', '8', '9', 'A', 'H', 'I']);
    const r1 = righe[0];
    expect(r1.slice(0, 8)).toBe('0010001A');
    expect(r1.slice(25, 28)).toBe('NC ');
    expect(r1.slice(28, 36)).toBe('00123456');
    expect(r1.charAt(70)).toBe('1'); // flag NC
    expect(r1.slice(94, 103)).toBe('001001002'); // ditta 1 di 1, 2 intestati
    expect(righe[1].slice(249, 252)).toBe('01 ');
    expect(righe[1].slice(247, 249)).toBe('DN');
    expect(righe[3].charAt(227)).toBe('0');
    expect(righe[6].charAt(227)).toBe('1'); // recuperata
    expect(righe[11].slice(123, 128)).toBe('SNC  ');
  });

  it('round-trip: decompila e ricompila gli stessi byte', () => {
    const c1 = compilaDocumento(praticaAccatastamento());
    const d = decompilaDocumento(c1.ncv.dati);
    expect(d.nonInterpretati).toEqual([]);
    expect(d.pratica.tipoDocumento).toBe('accatastamento');
    expect(d.pratica.quadroA?.ditte[0].intestati).toHaveLength(2);
    expect(d.pratica.bcnc).toHaveLength(2);
    expect(d.pratica.estremi?.[0].causale).toBe('IST');
    expect(d.pratica.unita[0].utilitaComuni).toHaveLength(2);
    expect(d.pratica.unita[0].altriIndirizzi?.[0].civici).toEqual(['3/A']);
    d.pratica.comune.codice = 'D612';
    const c2 = compilaDocumento(d.pratica);
    expect(decode1252(c2.ncv.dati)).toBe(decode1252(c1.ncv.dati));
  });

  it('dati metrici con il numero del modello D come il record 3 (altrimenti Docfa dà M0726)', () => {
    const c = compilaDocumento(praticaAccatastamento());
    expect(decode1252(c.nmv.dati).slice(0, 11)).toBe('0010001C001');
  });
});

import { deserializzaPratica, serializzaPratica, nuovaPratica as nuovaPraticaFile, tecnicoVuoto } from '$lib/stato/pratica-file';
import { controllaPratica } from '$lib/stato/validazione';

describe('pratiche salvate con versioni precedenti', () => {
  it('senza tipologia valgono come dichiarazione ordinaria', () => {
    const p = nuovaPraticaFile(tecnicoVuoto());
    delete (p as { tipologia?: number }).tipologia;
    const testo = serializzaPratica({ formato: 'fa-catasto-doc', versione: 1, meta: { id: 'x', titolo: 'x', stato: 'bozza', creata: '', modificata: '' }, pratica: p });
    const letta = deserializzaPratica(testo).pratica;
    expect(letta.tipologia).toBe(0);
    expect(controllaPratica(letta).errori.some((e) => /tipologia di documento/i.test(e.testo))).toBe(false);
  });
});

import { motiviElaboratoObbligatorio } from '$lib/stato/validazione';

describe('obbligo di elaborato planimetrico ed elenco subalterni', () => {
  const conUnita = (ops: ('V' | 'C' | 'S')[], cat = 'A03') => {
    const p = nuovaPraticaFile(tecnicoVuoto());
    p.unita = ops.map((o) => { const u = nuovaUnita(o); u.classamento = { ...(u.classamento ?? {}), categoria: cat } as never; return u; });
    return p;
  };
  it('non obbligatorio per una sola unità variata', () => expect(motiviElaboratoObbligatorio(conUnita(['V']))).toEqual([]));
  it('obbligatorio con due unità costituite', () => expect(motiviElaboratoObbligatorio(conUnita(['S', 'C', 'C'])).length).toBe(1));
  it('obbligatorio con unità in categoria F', () => expect(motiviElaboratoObbligatorio(conUnita(['V'], 'F03'))[0]).toMatch(/F\/3/));
  it('obbligatorio con bene comune non censibile', () => {
    const p = conUnita(['V']);
    p.unita[0].partitaSpeciale = 'A';
    expect(motiviElaboratoObbligatorio(p).some((m) => /non censibili/.test(m))).toBe(true);
  });
});
