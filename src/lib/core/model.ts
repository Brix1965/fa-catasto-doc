/**
 * Modello dati di una pratica Docfa (documento di variazione o accatastamento).
 * È il formato "umano" con cui lavora l'interfaccia; il compilatore (compile.ts)
 * lo trasforma nei record a lunghezza fissa dell'Agenzia.
 */

export type Causale =
  | 'NC' | 'AFF' | 'DIV' | 'FRZ' | 'FUS' | 'AMP' | 'DET' | 'DEP' | 'VSI' | 'RST'
  | 'FRF' | 'VTO' | 'UFU' | 'VDE' | 'VAR' | 'VRP' | 'VMI' | 'RUR';

export const CAUSALI: Record<Causale, string> = {
  NC: 'Accatastamento',
  AFF: "Denuncia di unità afferente",
  DIV: 'Divisione',
  FRZ: 'Frazionamento',
  FUS: 'Fusione',
  AMP: 'Ampliamento',
  DET: 'Demolizione totale',
  DEP: 'Demolizione parziale',
  VSI: 'Diversa distribuzione degli spazi interni',
  RST: 'Ristrutturazione',
  FRF: 'Frazionamento e fusione',
  VTO: 'Variazione toponomastica',
  UFU: 'Ultimazione di fabbricato urbano',
  VDE: 'Variazione della destinazione',
  VAR: 'Altre variazioni',
  VRP: 'Presentazione di planimetria mancante',
  VMI: 'Modifica di identificativo',
  RUR: 'Richiesta ruralità',
};

export type TipoDocumento = 'accatastamento' | 'variazione';

export interface Data { gg: number; mm: number; aaaa: number }

/** Tipo mappale: protocollo e data (obbligatori in accatastamento, facoltativi in variazione ma in coppia). */
export interface TipoMappale { numero: number; data: Data }

/** Soggetto della ditta da intestare (quadro I, record tipo 2). */
export interface Intestato {
  tipo: 'fisica' | 'giuridica' | 'bcc';
  cognome?: string;
  nome?: string;
  /** persona giuridica o bene comune censibile */
  denominazione?: string;
  sesso?: 'M' | 'F';
  nascita?: Data;
  /** sigla della provincia di nascita (o della sede); EE per lo stato estero */
  provincia?: string;
  /** comune di nascita (o della sede legale) */
  comune?: string;
  codiceFiscale?: string;
  pec?: string;
  /** codice titolo a 3 caratteri (es. "01 ", "08A"), vedi TITOLI */
  titolo: string;
  /** quota: numeratore (fino a 5 interi e 3 decimali, con la virgola) / denominatore */
  quotaNumeratore?: string;
  quotaDenominatore?: number;
  specificazione?: string;
  regime?: 'S' | 'C' | 'P';
  /** numero d'ordine dell'intestato con cui vige la comunione legale */
  riferimento?: number;
}

/** Ditta da intestare di un accatastamento (un modello D per ditta). */
export interface Ditta {
  tipoMappale?: TipoMappale;
  intestazione: 'nuova' | 'ceu' | 'ct';
  /** ditta già in atti: identificativo di riferimento (comune = codice amministrativo, es. I1AA) */
  riferimento?: Identificativo & { comune: string };
  intestati: Intestato[];
  unitaOrdinarie: number;
  unitaSpeciali: number;
}

/** Quadro A (dichiarazione di fabbricato urbano). */
export interface QuadroA {
  ditte: Ditta[];
  causale: 'NC' | 'AFF';
  /** unità afferenti: identificativo di riferimento e tipo di edificazione */
  afferenti?: { identificativo: Identificativo; sopraelevazione: boolean; areaCorte: boolean; altro: boolean };
}

/** Bene comune non censibile del quadro D (record tipo 8). */
export interface BeneComuneNonCensibile { identificativo: Identificativo; piani: string[] }

/** Estremi del titolo giustificativo dell'intestazione (record tipo 9, fino a 3). */
export interface EstremiAtto {
  uiuDa: number;
  uiuA: number;
  /** codice a 3 lettere (CAUSALI_ATTO) */
  causale: string;
  efficacia: Data;
  repertorio: string;
  rogante: string;
  /** codice catastale del comune sede del rogante o dell'ufficio del registro */
  sede: string;
  provincia: string;
  volume?: string;
  dataRegistrazione?: Data;
}

/** Ulteriore indirizzo della u.i.u. (record tipo 6, fino a 3 oltre al primo). */
export interface IndirizzoAggiuntivo { codiceStrada?: string; toponimo: string; civici: string[] }

/** Bene comune censibile associato alla u.i.u. (utilità comune). */
export interface UtilitaComune { operazione: 'I' | 'A'; identificativo: Identificativo }

export interface Identificativo {
  sezione?: string;
  foglio: string;
  numero: string;
  denominatore?: string;
  subalterno?: string;
}

export interface Comune {
  /** codice catastale (es. D612) */
  codice: string;
  /** codice amministrativo usato nei record (es. I1AA) */
  codiceAmministrativo: string;
  nome: string;
  provincia: string;
}

export interface Indirizzo {
  /** progressivo strada da stradario (7 cifre, es. 0001271); vuoto = indirizzo libero */
  codiceStrada?: string;
  toponimo: string;
  civici: string[];
  piani: string[];
  scala?: string;
  interno?: string;
  lotto?: string;
  edificio?: string;
}

export interface Tecnico {
  cognome: string;
  nome: string;
  codiceFiscale: string;
  /** codice albo: 03 = geometri */
  albo: string;
  numeroIscrizione: string;
  provinciaAlbo: string;
}

export interface Dichiarante {
  cognome: string;
  nome: string;
  comune: string;
  provincia: string;
  indirizzo: string;
  civico: string;
  cap: string;
  pec?: string;
}

export interface Classamento {
  zonaCensuaria: string;
  /** es. A03 */
  categoria: string;
  classe: string;
  /** consistenza come stringa (vani con virgola, o mq) */
  consistenza: string;
  superficieCatastale: number;
  /** rendita in euro */
  rendita: number;
  classamentoAutomatico: boolean;
  /** codice dell'esito del classamento automatico (00 eseguito … 06), scritto nel record 3 come in Docfa */
  esitoAutomatico?: string;
  /** scelta della validazione del classamento: proposto dal tecnico o automatico (Docfa: Convalida) */
  convalida?: 'proposto' | 'automatico';
}

export interface Ambiente {
  /** A..G secondo DPR 138/98 */
  /** A..G secondo il DPR 138/98; H = A2 (accessori diretti delle categorie C/1 e C/6) */
  tipo: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  superficie: number;
  altezzaMin: number;
  altezzaMax: number;
}

/** Tipo di ambiente del poligono; H = A2 (colore 8, accessori diretti di C/1 e C/6), come scrive Docfa nel file NTF. */
export type TipoAmbientePoligono = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface Poligono {
  tipo: TipoAmbientePoligono;
  /** vertici in metri (coordinate del DXF) */
  vertici: [number, number][];
  /** altezza valida (>= 1,50 m) */
  altezzaValida: boolean;
}

export interface Planimetria {
  /** numero immagine (7 cifre) assegnato dal programma, es. 0000007 */
  progressivo: number;
  formato: 'A4' | 'A3';
  scala: 100 | 200 | 500;
  /** file DXF importato (contenuto testuale) */
  dxf?: string;
  poligoni: Poligono[];
  /** superficie dichiarata totale (m²) */
  superficieDichiarata?: number;
  /** più schede (fogli) della stessa planimetria: una riga per scheda nell'indice allegati */
  schede?: { formato: 'A4' | 'A3'; scala: 100 | 200 | 500; poligoni: boolean }[];
  /** file NTF già pronto (importato da un documento esistente); se presente ha la precedenza sui poligoni */
  ntf?: Uint8Array;
  /** immagine TIFF già pronta (importata) */
  tiff?: Uint8Array;
  /**
   * schede dalla seconda in poi (la prima è descritta dai campi sopra): ognuna con il suo DXF o la sua immagine
   * importata e i suoi poligoni. Se presente, l'indice allegati si ricava da qui e non da `schede`.
   */
  altreSchede?: SchedaGrafica[];
}

/** Scheda (foglio) aggiuntiva di una planimetria. */
export interface SchedaGrafica {
  formato: 'A4' | 'A3';
  scala: 100 | 200 | 500;
  dxf?: string;
  poligoni: Poligono[];
  ntf?: Uint8Array;
  tiff?: Uint8Array;
}

/** Disegno di una scheda dell'elaborato planimetrico (DXF da comporre o immagine importata). */
export interface DisegnoElaborato {
  formato: 'A4' | 'A3';
  scala: 100 | 200 | 500;
  dxf?: string;
  tiff?: Uint8Array;
}

/** Riga dell'elenco subalterni (elaborato planimetrico). */
export interface ElencoSubalterno {
  identificativo: Identificativo;
  indirizzo?: string;
  civico?: string;
  piani: string[];
  scala?: string;
  interno?: string;
  descrizione: string;
  /** 0 letto dal documento, 1 inserito, 2 importato */
  flagInserimento: 0 | 1 | 2;
  tipo: 'U' | 'B';
  categoria?: string;
  entita: string[];
}

export interface ElaboratoPlanimetrico {
  /** identificativo del fabbricato (foglio/particella) */
  identificativo: Identificativo;
  /** progressivo immagine dell'elaborato */
  progressivoImmagine: number;
  /** schede (immagini) dell'elaborato planimetrico nell'indice allegati */
  schede?: { progressivo: number; scheda: number; formato: 'A4' | 'A3'; scala: 100 | 200 | 500 }[];
  /** disegni delle schede, nell'ordine (scheda 1, 2, …); se presenti l'indice allegati si ricava da qui */
  disegni?: DisegnoElaborato[];
  subalterni: ElencoSubalterno[];
}

/** Schede della planimetria per l'indice allegati: la prima più le altre (o quelle lette dal documento). */
export function schedePlanimetria(pl: Planimetria): { formato: 'A4' | 'A3'; scala: 100 | 200 | 500; poligoni: boolean }[] {
  if (pl.altreSchede?.length) {
    return [
      { formato: pl.formato, scala: pl.scala, poligoni: pl.poligoni.length > 0 || !!pl.ntf },
      ...pl.altreSchede.map((s) => ({ formato: s.formato, scala: s.scala, poligoni: s.poligoni.length > 0 || !!s.ntf })),
    ];
  }
  return pl.schede ?? [{ formato: pl.formato, scala: pl.scala, poligoni: pl.poligoni.length > 0 || !!pl.ntf }];
}

/** Tutti i poligoni della planimetria, di tutte le schede (per superfici e dati metrici). */
export function poligoniPlanimetria(pl: Planimetria | undefined): Poligono[] {
  if (!pl) return [];
  return [...pl.poligoni, ...(pl.altreSchede ?? []).flatMap((s) => s.poligoni)];
}

/** Schede dell'elaborato planimetrico per l'indice allegati (dai disegni, o quelle lette dal documento). */
export function schedeElaborato(ep: ElaboratoPlanimetrico): { progressivo: number; scheda: number; formato: 'A4' | 'A3'; scala: 100 | 200 | 500 }[] {
  if (ep.disegni?.length) return ep.disegni.map((d, i) => ({ progressivo: ep.progressivoImmagine, scheda: i + 1, formato: d.formato, scala: d.scala }));
  return ep.schede ?? [];
}

/** Valore di un campo generico dei record, indicizzato per id dello schema (vedi tracciati/schema.ts). */
export type Campi = Record<string, boolean | number | string>;

/**
 * Modello 1N parte I (fabbricato): record B e C. I campi sono indicizzati per id dello schema
 * (es. anno_costruzione, n_abitazioni, strutture_muratura...), così l'interfaccia si genera dai tracciati.
 */
export interface Mod1NParteI {
  recordB: Campi;
  recordC: Campi;
}

/** Modello 2N (categorie speciali D/E): record M, N, O (stima) e per ogni corpo di fabbrica P, Q, R. */
export interface Mod2N {
  recordM: Campi;
  recordN: Campi;
  /** stima comparativa: record O con trascinato 2-4 */
  stimaComparativa: Campi[];
  /** altro tipo di stima (testo libero): record O con trascinato 5-7 */
  altroTipoStima?: string[];
  corpi: { recordP: Campi; recordQ: Campi; recordR: Campi }[];
}

/** Locale del modello 1N parte II per le u.i.u. del gruppo C (piano, superficie lorda e utile). */
export interface LocaleGruppoC { piano: string; lorda: number; utile: number }

export interface Mod1NParteIIGruppoC {
  principali: LocaleGruppoC[];
  accessoriDiretti: LocaleGruppoC[];
  accessoriIndiretti: LocaleGruppoC[];
  balconiSup: number;
  coperteSup: number;
  pertinenzeSup: number;
  postiAuto: number;
  accessoCarrabile: boolean;
  altezzaMediaCm: number;
  supAltezzaInferiore230: number;
  postoAutoScoperto: boolean;
}

export interface Mod1NParteII {
  /** se valorizzato, la u.i.u. è del gruppo C e i campi dei vani (gruppo A/B) non si usano */
  gruppoC?: Mod1NParteIIGruppoC;
  annoCostruzione?: number;
  annoRistrutturazione?: number;
  vaniPrincipaliN: number; vaniPrincipaliSup: number;
  bagniN: number; bagniSup: number;
  accessoriDirettiN: number; accessoriDirettiSup: number;
  superficieLorda: number;
  accessoriIndirettiN: number; accessoriIndirettiSup: number;
  balconiSup: number; terrazziCopertiSup: number; pertinenzeScoperteSup: number;
  pertAltraDescrizione?: string;
  pertAltraSup?: number;
  pertSupLorda?: number;
  postiAuto?: number;
  /** solo gruppo B */
  bPianiFuoriTerra?: number; bMcFuoriTerra?: number; bPianiEntroTerra?: number; bMcEntroTerra?: number;
  altezzaMediaCm: number;
  supAltezzaInferiore230: number;
  nAscensori?: number;
  dotazioniAltre?: string;
  dotazioni: Record<string, boolean>;
  pavimenti: Record<string, boolean>;
  infissi: Record<string, boolean>;
  destinazioneUso: string;
  osservazioni?: string;
}

export interface UnitaImmobiliare {
  operazione: 'C' | 'V' | 'S';
  /**
   * variazione, u.i.u. variata o soppressa: classamento in atti (prima finestra del classamento automatico di Docfa,
   * richiesta quando l'archivio dell'Ufficio non è accessibile). Categoria "A03", classe "02", consistenza "4,5".
   */
  inAtti?: { categoria: string; classe: string; consistenza: string };
  /** accatastamento: unità erroneamente soppressa che si recupera (operazione R in Docfa) */
  recuperata?: boolean;
  /** accatastamento con più ditte: indice della ditta (modello D) a cui appartiene */
  ditta?: number;
  /** indirizzi oltre al primo (fino a 3) */
  altriIndirizzi?: IndirizzoAggiuntivo[];
  /** beni comuni censibili associati (fino a 10) */
  utilitaComuni?: UtilitaComune[];
  /** partita speciale (es. "A" = beni comuni non censibili) */
  partitaSpeciale?: string;
  /** destinazione d'uso per le categorie D/E (codice a 4 cifre, es. 0904) */
  destinazioneUsoDE?: string;
  /** spessore muri per i dati metrici: 1 = fino a 50 cm, 2 = oltre */
  spessoreMuri?: 1 | 2;
  /** codice "tabella 6" dei dati metrici (es. R1 abitazioni, R2 ville/villini, T1 negozi, T2 magazzini, P4 B/4); se assente viene dedotto dalla categoria */
  tipologiaMetrica?: string;
  identificativo: Identificativo;
  /** identificativi graffati (record tipo 4) */
  graffati: Identificativo[];
  indirizzo?: Indirizzo;
  classamento?: Classamento;
  mod1NParteII?: Mod1NParteII;
  ambienti: Ambiente[];
  planimetria?: Planimetria;
  /** riferimento al modello 1N parte I (numero d'ordine); 1 anche per le u.i.u. con modello 2N */
  rifMod1NParteI?: number;
  mod2N?: Mod2N;
}

export interface Pratica {
  /** variazione: categorie presenti nel fabbricato con la classe più elevata (seconda finestra del classamento automatico) */
  classiFabbricato?: { categoria: string; classe: string }[];
  /** accatastamento (NCA) o variazione (NCV); se assente è una variazione */
  tipoDocumento?: TipoDocumento;
  /** progressivo del documento (NCV002 → 2) */
  progressivo: number;
  /** tipologia di documento: valore del flag nel record 1 (0 = dichiarazione ordinaria), vedi TIPOLOGIE_* */
  tipologia?: number;
  /** quadro A (solo accatastamento) */
  quadroA?: QuadroA;
  /** variazione: tipo mappale facoltativo */
  tipoMappale?: TipoMappale;
  /** variazione: causale di presentazione (variazione o unità afferenti) */
  presentazione?: 'variazione' | 'afferenti';
  /** variazione per unità afferenti: tipo di edificazione */
  afferentiVariazione?: { areaUrbana: boolean; lastricoSolare: boolean; altro: boolean; descrizione?: string };
  /** quadro B: numero di u.i.u. dichiarate (se assenti si contano le unità) */
  dichiarate?: { soppresse: number; variate: number; costituite: number };
  /** quadro D: beni comuni non censibili (solo accatastamento) */
  bcnc?: BeneComuneNonCensibile[];
  /** estremi del titolo giustificativo (solo accatastamento) */
  estremi?: EstremiAtto[];
  comune: Comune;
  /** data variazione / ultimazione lavori */
  dataVariazione: { gg: number; mm: number; aaaa: number };
  causale: Causale;
  /** flag "tipo variazione" (ogni causale può accenderne più d'uno) */
  tipiVariazione: Partial<Record<'DIV' | 'FRZ' | 'FUS' | 'AMP' | 'DET' | 'DEP' | 'VSI' | 'RST' | 'FRF' | 'VTO' | 'UFU' | 'VDE' | 'VAR' | 'VRP' | 'NC' | 'AREA_CORTE' | 'AFFERENTI' | 'VMI' | 'ALTRE' | 'RUR', boolean>>;
  variazioneDa?: string;
  variazioneA?: string;
  altreVariazioni?: string;
  annotazioni?: string;
  /** quadro B "unità derivate": se assenti vengono calcolate */
  derivate?: { ordinarie: number; speciali: number; bcnc: number };
  /** righe dell'indice allegati non riconducibili a u.i.u. (es. planimetrie di u.i.u. poi soppresse), conservate per fedeltà */
  allegatiOrfani?: { progressivo: number; scheda: number; formato: 'A4' | 'A3'; scala: 100 | 200 | 500; poligoni: boolean }[];
  dichiarante: Dichiarante;
  tecnico: Tecnico;
  mod1NParteI?: Mod1NParteI;
  unita: UnitaImmobiliare[];
  elaboratoPlanimetrico?: ElaboratoPlanimetrico;
  /** riferimento catastale del fabbricato per il 1N parte I (CT e CEU) */
  riferimentiFabbricato?: { ct: Identificativo[]; ceu: Identificativo[] };
}
