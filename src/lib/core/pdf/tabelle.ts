/**
 * Tabelle di decodifica usate nella stampa: province (sigla → nome, come compare in
 * "Ufficio Provinciale di" e nell'albo del tecnico), albi professionali e causali.
 */
import { CAUSALI, type Causale } from '../model';

export const PROVINCE: Record<string, string> = {
  AG: 'AGRIGENTO', AL: 'ALESSANDRIA', AN: 'ANCONA', AO: 'AOSTA', AR: 'AREZZO', AP: 'ASCOLI PICENO', AT: 'ASTI',
  AV: 'AVELLINO', BA: 'BARI', BT: 'BARLETTA-ANDRIA-TRANI', BL: 'BELLUNO', BN: 'BENEVENTO', BG: 'BERGAMO', BI: 'BIELLA',
  BO: 'BOLOGNA', BZ: 'BOLZANO', BS: 'BRESCIA', BR: 'BRINDISI', CA: 'CAGLIARI', CL: 'CALTANISSETTA', CB: 'CAMPOBASSO',
  CE: 'CASERTA', CT: 'CATANIA', CZ: 'CATANZARO', CH: 'CHIETI', CO: 'COMO', CS: 'COSENZA', CR: 'CREMONA', KR: 'CROTONE',
  CN: 'CUNEO', EN: 'ENNA', FM: 'FERMO', FE: 'FERRARA', FI: 'FIRENZE', FG: 'FOGGIA', FC: 'FORLI\'-CESENA', FR: 'FROSINONE',
  GE: 'GENOVA', GO: 'GORIZIA', GR: 'GROSSETO', IM: 'IMPERIA', IS: 'ISERNIA', AQ: 'L\'AQUILA', SP: 'LA SPEZIA', LT: 'LATINA',
  LE: 'LECCE', LC: 'LECCO', LI: 'LIVORNO', LO: 'LODI', LU: 'LUCCA', MC: 'MACERATA', MN: 'MANTOVA', MS: 'MASSA-CARRARA',
  MT: 'MATERA', ME: 'MESSINA', MI: 'MILANO', MO: 'MODENA', MB: 'MONZA E DELLA BRIANZA', NA: 'NAPOLI', NO: 'NOVARA',
  NU: 'NUORO', OR: 'ORISTANO', PD: 'PADOVA', PA: 'PALERMO', PR: 'PARMA', PV: 'PAVIA', PG: 'PERUGIA', PU: 'PESARO E URBINO',
  PE: 'PESCARA', PC: 'PIACENZA', PI: 'PISA', PT: 'PISTOIA', PN: 'PORDENONE', PZ: 'POTENZA', PO: 'PRATO', RG: 'RAGUSA',
  RA: 'RAVENNA', RC: 'REGGIO CALABRIA', RE: 'REGGIO EMILIA', RI: 'RIETI', RN: 'RIMINI', RM: 'ROMA', RO: 'ROVIGO',
  SA: 'SALERNO', SS: 'SASSARI', SV: 'SAVONA', SI: 'SIENA', SR: 'SIRACUSA', SO: 'SONDRIO', SU: 'SUD SARDEGNA', TA: 'TARANTO',
  TE: 'TERAMO', TR: 'TERNI', TO: 'TORINO', TP: 'TRAPANI', TN: 'TRENTO', TV: 'TREVISO', TS: 'TRIESTE', UD: 'UDINE',
  VA: 'VARESE', VE: 'VENEZIA', VB: 'VERBANO-CUSIO-OSSOLA', VC: 'VERCELLI', VR: 'VERONA', VV: 'VIBO VALENTIA',
  VI: 'VICENZA', VT: 'VITERBO',
};

/** Nome della provincia da sigla (se non è una sigla nota restituisce il testo com'è). */
export function nomeProvincia(sigla: string): string {
  const s = sigla.trim().toUpperCase();
  return PROVINCE[s] ?? s;
}

/**
 * Albi del tecnico secondo la codifica di Docfa (record A, pos. 194-195) e come li stampa il modello D1
 * (programma di stampa NZST00): titolo abbreviato e dicitura dell'albo; per i dipendenti pubblici la
 * dicitura "IN QUALITA' DI …" senza provincia e numero di iscrizione.
 */
export const ALBI: Record<string, { titolo: string; albo: string; dipendentePubblico?: boolean }> = {
  '01': { titolo: 'Arch.', albo: 'ALBO DEGLI ARCHITETTI' },
  '02': { titolo: 'Ing.', albo: 'ALBO DEGLI INGEGNERI' },
  '03': { titolo: 'Geom.', albo: 'ALBO DEI GEOMETRI' },
  '04': { titolo: 'Per. Ed.', albo: 'ALBO DEI PERITI EDILI' },
  '05': { titolo: 'Dott.', albo: 'ALBO DEI DOTTORI AGRONOMI E FORESTALI' },
  '06': { titolo: 'Per. Agr.', albo: 'ALBO DEI PERITI AGRARI' },
  '13': { titolo: 'Agr.', albo: 'ALBO DEGLI AGROTECNICI' },
  '07': { titolo: 'Arch.', albo: "IN QUALITA' DI ARCHITETTO DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '08': { titolo: 'Ing.', albo: "IN QUALITA' DI INGEGNERE DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '09': { titolo: 'Geom.', albo: "IN QUALITA' DI GEOMETRA DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '10': { titolo: 'Per. Ed.', albo: "IN QUALITA' DI PERITO EDILE DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '11': { titolo: 'Dott.', albo: "IN QUALITA' DI DOTTORE AGRONOMO O FORESTALE DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '12': { titolo: 'Per. Agr.', albo: "IN QUALITA' DI PERITO AGRARIO DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
  '14': { titolo: 'Agr.', albo: "IN QUALITA' DI AGROTECNICO DIPENDENTE DELLA PUBBLICA AMMINISTRAZIONE", dipendentePubblico: true },
};

export function albo(codice: string): { titolo: string; albo: string; dipendentePubblico?: boolean } {
  return ALBI[codice.padStart(2, '0')] ?? { titolo: 'Tecnico', albo: `ALBO n. ${codice}` };
}

/** Riga dell'albo come la stampa Docfa: "ALBO DEI GEOMETRI DELLA PROVINCIA DI FIRENZE n. 1234". */
export function rigaAlbo(codice: string, provincia: string, numero: string): string {
  const a = albo(codice);
  if (a.dipendentePubblico) return a.albo;
  return `${a.albo} DELLA PROVINCIA DI ${nomeProvincia(provincia)} n. ${numero.trim()}`;
}

/** Descrizione delle causali come la stampa Docfa nel quadro B (minuscolo), nell'ordine dei flag del record 1. */
export const CAUSALI_STAMPA: [Causale, string][] = (['DIV', 'FRZ', 'FUS', 'AMP', 'DET', 'DEP', 'VSI', 'RST', 'FRF', 'VTO', 'UFU', 'VDE', 'VAR', 'VRP', 'NC'] as Causale[])
  .map((c) => [c, CAUSALI[c].toLowerCase()]);
