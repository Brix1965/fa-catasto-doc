/**
 * Regole e tabelle del modello D di Docfa 4.00.5, ricavate dall'help in linea e dai programmi del pacchetto
 * (schermi NZU080 scelta comune, NZU210 quadro A, NZU110 quadro B, NZU230 note, NZU240 dichiarante;
 * controllo formale NZC000). Dove una regola è dedotta e non letta, è scritto nel commento.
 */

export type CodiceVariazione =
  | 'DIV' | 'FRZ' | 'FUS' | 'AMP' | 'DET' | 'DEP' | 'VSI' | 'RST' | 'FRF'
  | 'VTO' | 'UFU' | 'VDE' | 'VAR' | 'VRP' | 'VMI' | 'RUR';

/** Ordine delle causali nella matrice di compatibilità di Docfa (NZU110) e nei flag del record 1 (57-76). */
export const CAUSALI_VARIAZIONE: CodiceVariazione[] = ['DIV', 'FRZ', 'FUS', 'AMP', 'DET', 'DEP', 'VSI', 'RST', 'FRF', 'VTO', 'UFU', 'VDE', 'VAR', 'VRP', 'VMI', 'RUR'];

/** Tipologie della variazione "Planimetrica" (quadro B, casella 1). */
export const TIPOLOGIE_PLANIMETRICHE: CodiceVariazione[] = ['DIV', 'FRZ', 'FUS', 'AMP', 'DET', 'DEP', 'VSI', 'RST', 'FRF'];

export const DESCRIZIONE_CAUSALE: Record<CodiceVariazione, string> = {
  DIV: 'Divisione',
  FRZ: 'Frazionamento per trasferimento di diritti',
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
  VMI: "Modifica d'identificativo",
  RUR: 'Richiesta ruralità',
};

/**
 * Matrice di compatibilità tra le causali, copiata dalla tabella interna di Docfa (programma NZU110):
 * riga i, colonna j = 'X' se le causali possono essere barrate insieme. La tabella è simmetrica.
 * (La tabella dell'help in linea ha la riga RST sfasata e manca la riga FRF: fa fede questa.)
 */
const MATRICE = [
  'X XX XXX XXX    ', // DIV
  ' X X XXX XXX    ', // FRZ
  'X XX XXX XXX    ', // FUS
  'XXXX XXXXXXX    ', // AMP
  '    X    X      ', // DET
  'XXXX XXXXXXX    ', // DEP
  'XXXX XXXXXXX    ', // VSI
  'XXXX XXXXX X    ', // RST
  '   X XXXXXXX    ', // FRF
  'XXXXXXXXXXXXX   ', // VTO
  'XXXX XX XXXX    ', // UFU
  'XXXX XXXXXXX    ', // VDE
  '         X  X   ', // VAR
  '             X  ', // VRP
  '              X ', // VMI
  '               X', // RUR
];

export function causaliCompatibili(a: CodiceVariazione, b: CodiceVariazione): boolean {
  const i = CAUSALI_VARIAZIONE.indexOf(a);
  const j = CAUSALI_VARIAZIONE.indexOf(b);
  return MATRICE[i]?.[j] === 'X';
}

/** Coppie di causali barrate che Docfa non accetta insieme. */
export function coppieIncompatibili(causali: CodiceVariazione[]): [CodiceVariazione, CodiceVariazione][] {
  const out: [CodiceVariazione, CodiceVariazione][] = [];
  for (let i = 0; i < causali.length; i++)
    for (let j = i + 1; j < causali.length; j++)
      if (!causaliCompatibili(causali[i], causali[j])) out.push([causali[i], causali[j]]);
  return out;
}

export interface RegolaOperazioni {
  soppressione: boolean;
  variazione: boolean;
  costituzione: boolean;
  /** numero minimo/massimo di u.i.u. per operazione (quando la causale è l'unica barrata) */
  s?: [number, number];
  v?: [number, number];
  c?: [number, number];
  /** richiede i modelli 1N/2N */
  modelli: boolean;
  /** classamento: completo, solo categoria, nessuno */
  classamento: 'completo' | 'categoria' | 'nessuno';
  nota: string;
}

const N = Infinity;
/** Compatibilità tra causali e operazioni (help del quadro B, tabella "Compatibilità tra causali e operazioni associate"). */
export const OPERAZIONI_CAUSALE: Record<CodiceVariazione, RegolaOperazioni> = {
  AMP: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [1, 1], modelli: true, classamento: 'completo', nota: 'soppressione di 1 unità e costituzione di 1 unità' },
  VTO: { soppressione: false, variazione: true, costituzione: false, v: [1, N], modelli: false, classamento: 'nessuno', nota: 'sola variazione di 1 o più unità, senza modelli 1N/2N' },
  VSI: { soppressione: false, variazione: true, costituzione: false, v: [1, N], modelli: true, classamento: 'completo', nota: 'sola variazione di 1 o più unità' },
  UFU: { soppressione: false, variazione: true, costituzione: false, v: [1, N], modelli: true, classamento: 'completo', nota: 'sola variazione di 1 o più unità' },
  RST: { soppressione: false, variazione: true, costituzione: false, v: [1, N], modelli: true, classamento: 'completo', nota: 'sola variazione di 1 o più unità' },
  DEP: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [1, 1], modelli: true, classamento: 'completo', nota: 'soppressione di 1 unità e costituzione di 1 unità' },
  DET: { soppressione: true, variazione: false, costituzione: true, s: [1, N], c: [1, N], modelli: false, classamento: 'categoria', nota: "soppressione e costituzione di 1 o più unità; la costituita è un'area urbana (F/1)" },
  FRF: { soppressione: true, variazione: false, costituzione: true, s: [2, N], c: [2, N], modelli: true, classamento: 'completo', nota: 'soppressione di 2 o più unità e costituzione di 2 o più unità' },
  VDE: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [1, 1], modelli: true, classamento: 'completo', nota: 'soppressione di 1 unità e costituzione di 1 unità' },
  DIV: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [2, N], modelli: true, classamento: 'completo', nota: 'soppressione di 1 unità e costituzione di 2 o più unità' },
  FRZ: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [2, N], modelli: false, classamento: 'categoria', nota: 'soppressione di 1 unità e costituzione di 2 o più unità, solo unità del gruppo F' },
  FUS: { soppressione: true, variazione: false, costituzione: true, s: [2, N], c: [1, 1], modelli: true, classamento: 'completo', nota: 'soppressione di 2 o più unità e costituzione di 1 unità' },
  VAR: { soppressione: true, variazione: true, costituzione: true, modelli: true, classamento: 'completo', nota: 'soppressione, variazione e costituzione' },
  VRP: { soppressione: false, variazione: true, costituzione: false, v: [1, 1], modelli: false, classamento: 'categoria', nota: 'sola variazione di 1 unità: solo la categoria, poligoni per la superficie catastale' },
  VMI: { soppressione: true, variazione: false, costituzione: true, s: [1, 1], c: [1, 1], modelli: false, classamento: 'nessuno', nota: 'soppressione di 1 unità e costituzione di 1 unità, senza classamento né planimetria' },
  RUR: { soppressione: false, variazione: true, costituzione: false, v: [1, N], modelli: false, classamento: 'nessuno', nota: 'sola variazione di 1 o più unità, senza classamento' },
};

/** Tipologia di documento (campo "flag documento presentato", record 1 pos. 45). */
export interface TipologiaDocumento { opzione: number; flag: number; descrizione: string }

export const TIPOLOGIE_ACCATASTAMENTO: TipologiaDocumento[] = [
  { opzione: 1, flag: 0, descrizione: 'Dichiarazione ordinaria' },
  { opzione: 2, flag: 1, descrizione: "Dichiarazione resa ai sensi dell'art. 1, comma 336, L n. 311/04" },
  { opzione: 3, flag: 4, descrizione: 'Fabbricato ex rurale – art. 2, comma 36 o 37, DL n. 262/06' },
  { opzione: 4, flag: 5, descrizione: 'Fabbricato mai dichiarato – art. 2, comma 36, DL n. 262/06' },
  { opzione: 5, flag: 6, descrizione: 'Dichiarazione fabbricato rurale DM 26/7/2012' },
  { opzione: 6, flag: 7, descrizione: 'Dichiarazione fabbricato rurale art. 13, comma 14 ter, del DL 201/2012' },
];

export const TIPOLOGIE_VARIAZIONE: TipologiaDocumento[] = [
  { opzione: 1, flag: 0, descrizione: 'Dichiarazione ordinaria' },
  { opzione: 2, flag: 1, descrizione: "Dichiarazione resa ai sensi dell'art. 1, comma 336, L n. 311/04" },
  { opzione: 3, flag: 2, descrizione: "Dichiarazione resa ai sensi dell'art. 1, comma 340, L n. 311/04" },
  { opzione: 4, flag: 3, descrizione: 'Stralcio da categoria E – art. 2, comma 40, DL n. 262/06' },
  { opzione: 5, flag: 6, descrizione: 'Dichiarazione resa ai sensi del DM 26/7/2012' },
  { opzione: 6, flag: 7, descrizione: "Dichiarazione resa ai sensi dell'art. 13, comma 14 ter, del DL 201/2012" },
  { opzione: 7, flag: 8, descrizione: "Dichiarazione resa ai sensi dell'art. 1, comma 22, del DL 208/2015" },
  // il tracciato 4.00.3 si ferma a 8: il valore 9 per la L. 205/2017 (introdotta con la 4.00.5) è dedotto
  { opzione: 8, flag: 9, descrizione: "Dichiarazione resa ai sensi dell'art. 1, comma 579, L. n. 205/2017" },
];

/** Albi e qualifiche del tecnico (codici del record A, pos. 194-195), nell'ordine della tendina di Docfa. */
export const ALBI_TECNICO: { codice: string; descrizione: string; dipendentePubblico: boolean }[] = [
  { codice: '13', descrizione: 'Agrotecnici', dipendentePubblico: false },
  { codice: '01', descrizione: 'Architetti', dipendentePubblico: false },
  { codice: '05', descrizione: 'Dottori agronomi e forestali', dipendentePubblico: false },
  { codice: '03', descrizione: 'Geometri', dipendentePubblico: false },
  { codice: '02', descrizione: 'Ingegneri', dipendentePubblico: false },
  { codice: '06', descrizione: 'Periti agrari', dipendentePubblico: false },
  { codice: '04', descrizione: 'Periti edili', dipendentePubblico: false },
  { codice: '14', descrizione: 'Agrotecnico Dipendente Pubblico', dipendentePubblico: true },
  { codice: '07', descrizione: 'Architetto Dipendente Pubblico', dipendentePubblico: true },
  { codice: '11', descrizione: 'Dottore agronomo o forestale Dipendente Pubblico', dipendentePubblico: true },
  { codice: '09', descrizione: 'Geometra Dipendente Pubblico', dipendentePubblico: true },
  { codice: '08', descrizione: 'Ingegnere Dipendente Pubblico', dipendentePubblico: true },
  { codice: '12', descrizione: 'Perito agrario Dipendente Pubblico', dipendentePubblico: true },
  { codice: '10', descrizione: 'Perito edile Dipendente Pubblico', dipendentePubblico: true },
];

/** Causali degli atti negli estremi del titolo giustificativo (codice a 3 lettere del record 9). */
export const CAUSALI_ATTO: [string, string][] = [
  ['ATC', 'Atto di consegna'], ['PRV', 'Atto di provvisione'], ['DEC', 'Decreto'], ['DEL', 'Delibera'],
  ['DEN', 'Denuncia di successione'], ['DOM', 'Domanda'], ['IST', 'Istrumento'], ['SEN', 'Sentenza'],
  ['SPR', 'Scrittura privata'], ['TOL', 'Testamento olografo'], ['TPU', 'Testamento pubblico'], ['TSE', 'Testamento segreto'],
  ['VER', 'Verbale'], ['VBC', 'Verbale di consegna'], ['VBD', 'Verbale di delimitazione'], ['VBS', 'Verbale di sopralluogo'],
  ['VBT', 'Verbale di trasferimento'], ['VBU', 'Verbale di utilizzazione'], ['VUF', "Voltura d'ufficio"],
];

/** Regime patrimoniale degli intestati (record 2, pos. 179). */
export const REGIMI: [string, string][] = [['S', 'Separazione dei beni'], ['C', 'Comunione legale'], ['P', 'Bene personale']];

/** Categorie selezionabili nel quadro U (tendina di Docfa). */
export const CATEGORIE: string[] = [
  'A', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11',
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08',
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07',
  'D', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
  'E', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09',
  'F01', 'F02', 'F03', 'F04', 'F05', 'F07',
];

/** Descrizione delle categorie (tendina del quadro U di Docfa). */
export const DESCRIZIONE_CATEGORIA: Record<string, string> = {
  A: 'Categoria generica A (classamento dopo il 1N)',
  A01: 'Abitazione di tipo signorile', A02: 'Abitazione di tipo civile', A03: 'Abitazione di tipo economico',
  A04: 'Abitazione di tipo popolare', A05: 'Abitazione di tipo ultrapopolare', A06: 'Abitazione di tipo rurale',
  A07: 'Abitazione in villino', A08: 'Abitazione in villa', A09: 'Castelli, palazzi di eminente pregio',
  A10: 'Uffici e studi privati', A11: 'Abitazioni ed alloggi tipici dei luoghi',
  B01: 'Collegi, convitti, ricoveri, conventi, caserme', B02: 'Case di cura e ospedali', B03: 'Prigioni e riformatori',
  B04: 'Uffici pubblici', B05: 'Scuole e laboratori scientifici', B06: 'Biblioteche, pinacoteche, musei, gallerie, accademie',
  B07: 'Cappelle e oratori non destinati al culto pubblico', B08: 'Magazzini sotterranei per depositi di derrate',
  C01: 'Negozi e botteghe', C02: 'Magazzini e locali di deposito', C03: 'Laboratori per arti e mestieri',
  C04: 'Fabbricati e locali per esercizi sportivi', C05: 'Stabilimenti balneari e di acque curative',
  C06: 'Stalle, scuderie, rimesse, autorimesse', C07: 'Tettoie chiuse od aperte',
  D: 'Categoria generica D (scegliere la destinazione)',
  D01: 'Opifici', D02: 'Alberghi e pensioni', D03: 'Teatri, cinematografi, sale per concerti e spettacoli',
  D04: 'Case di cura ed ospedali', D05: 'Istituti di credito, cambio e assicurazione', D06: 'Fabbricati e locali per esercizi sportivi',
  D07: "Fabbricati per le speciali esigenze di un'attività industriale", D08: "Fabbricati per le speciali esigenze di un'attività commerciale",
  D09: 'Edifici galleggianti o sospesi, ponti privati soggetti a pedaggio', D10: 'Fabbricati per funzioni produttive connesse alle attività agricole',
  E: 'Categoria generica E (scegliere la destinazione)',
  E01: 'Stazioni per servizi di trasporto terrestri, marittimi ed aerei', E02: 'Ponti comunali e provinciali soggetti a pedaggio',
  E03: 'Costruzioni e fabbricati per speciali esigenze pubbliche', E04: 'Recinti chiusi per speciali esigenze pubbliche',
  E05: 'Fabbricati costituenti fortificazioni e loro dipendenze', E06: "Fari, semafori, torri per rendere d'uso pubblico l'orologio comunale",
  E07: "Fabbricati destinati all'esercizio pubblico dei culti", E08: 'Fabbricati e costruzioni nei cimiteri',
  E09: 'Edifici a destinazione particolare non compresi nelle categorie precedenti',
  F01: 'Area urbana', F02: 'Unità collabenti', F03: 'Unità in corso di costruzione', F04: 'Unità in corso di definizione',
  F05: 'Lastrico solare', F07: 'Infrastrutture di reti pubbliche di comunicazione',
};

/** Caratteri ammessi nei campi descrittivi (help "Caratteri ammissibili"). */
export const CARATTERI_AMMESSI = /^[A-Za-z0-9 .,;:'"/()\-+*%&°àèéìòùÀÈÉÌÒÙ]*$/;

/**
 * Caratteri accettati dal controllo formale nell'indirizzo del dichiarante (W0708): lettere, cifre, spazio e ' . , / - ( ).
 * Verificato su Docfa 4.00.5: "VIA DELL’AGNOLO" (apostrofo tipografico), "À" e "°" danno W0708.
 */
export const CARATTERI_INDIRIZZO = /^[A-Z0-9 '.,\/()\-]*$/;

/** Indirizzo nella forma accettata da Docfa: maiuscolo, accentate → lettera + apostrofo, apostrofi tipografici → ', ° → . */
export function normalizzaIndirizzo(s: string): string {
  return s
    .toUpperCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[ÀÁÂÄ]/g, "A'").replace(/[ÈÉÊË]/g, "E'").replace(/[ÌÍÎÏ]/g, "I'").replace(/[ÒÓÔÖ]/g, "O'").replace(/[ÙÚÛÜ]/g, "U'")
    .replace(/[°º]/g, '.')
    .replace(/[^A-Z0-9 '.,/()\-]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Zona censuaria e classe come le scrive Docfa nel record 3: numeriche con gli zeri a sinistra (001, 02). */
export function allineaZona(z: string | undefined): string {
  const t = (z ?? '').trim();
  return /^\d{1,3}$/.test(t) ? t.padStart(3, '0') : t;
}
export function allineaClasse(c: string | undefined): string {
  const t = (c ?? '').trim();
  return /^\d{1,2}$/.test(t) ? t.padStart(2, '0') : t;
}

/** Piano: numero, T, S seguita da numero, o intervallo "1-3" (help del quadro U). */
export function pianoValido(p: string): boolean {
  const s = p.trim().toUpperCase();
  const uno = /^(T|S\d{1,2}|\d{1,3})$/;
  if (uno.test(s)) return s !== '0';
  const m = /^(T|S\d{1,2}|\d{1,3})-(T|S\d{1,2}|\d{1,3})$/.exec(s);
  return !!m;
}

/** Civico: caratteri alfanumerici con al più una barra o un trattino. */
export function civicoValido(c: string): boolean {
  const s = c.trim().toUpperCase();
  if (s === 'SNC') return true;
  return /^[A-Z0-9]+([/-][A-Z0-9]+)?$/.test(s) && s.length <= 6;
}

/**
 * Diciture del campo "Altre" della causale di variazione (vademecum Docfa 2022, par. 2.3.1.5). Il campo resta
 * libero come in Docfa (35 caratteri): l'elenco serve solo come suggerimento.
 */
export const DICITURE_ALTRE_VARIAZIONI: string[] = [
  'FRAZ. CON CAMBIO DI DESTINAZIONE',
  'FUSIONE CON CAMBIO DI DESTINAZIONE',
  'DEM. PARZIALE CON CAMBIO DI DESTIN',
  'AMPLIAMENTO CON CAMBIO DI DESTINAZ',
  'FRAZ. E FUS. CON CAMBIO DI DESTINAZ',
  'DEMOLIZIONE TOTALE E DIVISIONE',
  'DEMOLIZIONE TOTALE E RICOSTRUZIONE',
  'DEMOLIZIONE TOTALE E AMPLIAMENTO',
  'DEMOLIZIONE TOTALE E FUSIONE',
  'DEMOLIZIONE TOTALE, AMPL. E FUS.',
  'COSTITUZIONE DI BCNC',
  'RIDEFINIZIONE DI BCNC',
  'RIDEFINIZIONE DI CORTE',
  'RIQUALIFICAZIONE PARTI COMUNI',
  'DICHIARAZIONE DI PORZIONE DI U.I.',
  'ASSOCIAZIONE ELABORATO PLANIMETRICO',
  'RECUPERO DI SITUAZIONE PREGRESSA',
  'DICHIARAZIONE UIU ART 19 DL 78/10',
  'VAR. EX ART 86 DLGS 259/2003',
  'INTESTAZIONE A BCC',
  'MODIFICA DESCRIZIONE ELENCO SUB',
  'RETTIFICA DOCFA PROT. N. / ANNO',
  'ESATTA RAPPRESENTAZIONE GRAFICA',
  'SOSTITUZIONE PLANIMETRIA ERRATA',
  'PER MIGLIORE IDENTIFICAZIONE PLANIM',
];

/** Diciture di "Altro" tra le unità afferenti dell'accatastamento (vademecum, par. 2.2.1.4). */
export const DICITURE_AFFERENTI_ALTRO: string[] = ['COSTITUZIONE DI BCC', 'RECUPERO DI SITUAZIONE PREGRESSA', 'RECUPERO PER ERRATA SOPPRESSIONE'];
