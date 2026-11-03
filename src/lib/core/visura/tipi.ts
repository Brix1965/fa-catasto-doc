/** Dati strutturati di una visura catastale (servizio Sister dell'Agenzia delle Entrate). */

export type TipoVisura = 'sintetica-soggetto' | 'immobile' | 'altro';
export type UnitaConsistenza = 'vani' | 'm²' | 'm³';

export interface IndirizzoVisura {
  /** es. "VIA ROMA" */
  toponimo: string;
  /** es. ["1", "3"]; "SNC" se senza civico */
  civici: string[];
  /** come stampati, separati da " - " (es. ["S1-T", "2"]: "S1-T" è un intervallo, come in Docfa) */
  piani: string[];
  scala?: string;
  interno?: string;
  lotto?: string;
  edificio?: string;
  /** testo originale */
  testo: string;
}

export interface ImmobileVisura {
  sezione?: string;
  foglio: string;
  numero: string;
  subalterno?: string;
  zonaCensuaria?: string;
  microzona?: string;
  /** come stampata, es. "A/2" */
  categoria: string;
  classe?: string;
  /** come stampata, senza unità (es. "14,5", "155", "6.642") */
  consistenza?: string;
  unitaConsistenza?: UnitaConsistenza;
  /** m² ("Totale: 183 m²") */
  superficieCatastale?: number;
  /** m², totale escluse aree scoperte */
  superficieSenzaAree?: number;
  /** euro */
  rendita?: number;
  indirizzo?: IndirizzoVisura;
  datiDerivanti?: string;
  /** colonna "Dati ulteriori" (es. "Annotazione") */
  datiUlteriori?: string;
  /** righe "Immobile n: Annotazione: …" */
  annotazioni?: string[];
  comune: { nome: string; codice: string };
  /** numero del gruppo ("1. Immobili siti nel Comune di …"); 1 nella visura per immobile */
  gruppo: number;
  /** numero d'ordine nel gruppo (colonna N.) */
  progressivo: number;
}

export interface IntestatoVisura {
  /** gruppo di immobili a cui si riferisce ("Intestazione degli immobili indicati al n.1") */
  gruppo: number;
  progressivo?: number;
  /** persona giuridica, o persona fisica di cui non si distinguono cognome e nome */
  denominazione?: string;
  cognome?: string;
  nome?: string;
  luogoNascita?: string;
  /** gg/mm/aaaa */
  dataNascita?: string;
  sede?: string;
  codiceFiscale?: string;
  /** "*" dopo il codice: validato in Anagrafe Tributaria */
  codiceFiscaleValidato?: boolean;
  /** es. "Proprieta'" */
  diritto?: string;
  /** es. "1/1" */
  quota?: string;
  /** codice tra parentesi, es. "1" */
  codiceDiritto?: string;
  /** testo della colonna diritti e oneri reali */
  testoDiritti?: string;
  /** testo della colonna dati anagrafici */
  testoAnagrafico?: string;
}

export interface Visura {
  tipo: TipoVisura;
  /** visura storica (solo la situazione attuale viene letta) */
  storica: boolean;
  /** es. "Visura attuale sintetica per soggetto" */
  titolo?: string;
  /** data della visura, gg/mm/aaaa */
  data?: string;
  /** "Situazione degli atti informatizzati al …", gg/mm/aaaa */
  situazioneAl?: string;
  immobili: ImmobileVisura[];
  intestati: IntestatoVisura[];
  /** problemi di lettura o dati incompleti */
  avvisi: string[];
}
