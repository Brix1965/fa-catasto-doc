/**
 * Organizzazione del modello 1N parte I (record B e C) in sezioni come nel modello cartaceo, con le
 * etichette italiane. Le etichette qui definite hanno la precedenza su quelle generate
 * (tracciati/etichette.generated.ts); i campi si descrivono dallo schema dei record.
 */
import { SCHEMAS } from '$lib/core/tracciati/schema';
import type { FieldDef } from '$lib/core/tracciati/types';
import { ETICHETTE } from '$lib/core/tracciati/etichette.generated';
import type { Campi } from '$lib/core/model';

export type RecordMod1N = 'B' | 'C' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R';

export interface OpzioneCampo { valore: number; etichetta: string }

export interface CampoUi {
  id: string;
  etichetta: string;
  /** campo numerico associato (es. superficie accanto al flag) mostrato sulla stessa riga */
  accoppiato?: { id: string; etichetta: string };
  /** valori ammessi (radio/select) per i campi a scelta */
  opzioni?: OpzioneCampo[];
  suffisso?: string;
}

export interface GruppoUi {
  titolo?: string;
  /** sezione da compilare obbligatoriamente (titolo di colore diverso) */
  obbligatorio?: boolean;
  campi: CampoUi[];
  /** disposizione: 'colonne' (default) oppure 'riga' per i campi brevi */
  disposizione?: 'colonne' | 'riga';
}

export interface SezioneUi {
  id: string;
  /** etichetta del quadro nella finestra di Docfa ([A]-[B], [C], ...) */
  sigla?: string;
  /** quadro obbligatorio (etichetta sottolineata) */
  obbligatorio?: boolean;
  /** compilazione completa (pallino verde) */
  completo?: (campi: Campi) => boolean;
  titolo: string;
  rec: RecordMod1N;
  descrizione?: string;
  gruppi: GruppoUi[];
  /** tabella degli affacci (4 facciate × tipi) */
  facciate?: boolean;
}

/** Etichette curate (sovrascrivono quelle generate). */
export const ETICHETTE_1N: Partial<Record<RecordMod1N, Record<string, string>>> = {
  B: {
    ct_sezione: 'Sezione', ct_foglio: 'Foglio', ct_numero: 'Particella', ct_numero_2: 'Particella (2ª)',
    ceu_sezione: 'Sezione', ceu_foglio: 'Foglio', ceu_numero: 'Particella', ceu_numero_2: 'Particella (2ª)',
    anno_costruzione: 'Anno di costruzione', anno_ristrutturazione: 'Anno di ristrutturazione totale',
    posizione_fabbricato: 'Posizione rispetto ai fabbricati circostanti', complesso_immobiliare: 'Fa parte di un complesso immobiliare',
    numero_edifici: 'Se SÌ: fabbricati n.',
    n_abitazioni: 'Abitazioni', n_negozi: 'Negozi', n_laboratori: 'Laboratori', n_magazzini: 'Magazzini', n_uffici: 'Uffici',
    n_box: 'Box, posti auto', n_autorimesse: 'Autorimesse collettive', n_impianti_sportivi: 'Locali per attività sportive',
    n_uiu_cat_b: 'Unità immobiliari censibili nel gruppo B',
    n_scale: 'Il fabbricato si articola in n. scale', tipo_accesso: 'Con accesso', cortile_interno: 'Cortile interno',
    piani_fuori_terra: 'Piani fuori terra n.', piani_fuori_terra_min: 'ovvero minimo', piani_fuori_terra_max: 'massimo',
    piani_entro_terra: 'Piani entro terra n.', piani_entro_terra_min: 'ovvero minimo', piani_entro_terra_max: 'massimo',
    densita_ft_int: 'Densità fondiaria fuori terra (parte intera)', densita_ft_dec: 'decimali',
    densita_et_int: 'Densità fondiaria entro terra (parte intera)', densita_et_dec: 'decimali',
    corpi_1_ft: 'Corpo 1 – fuori terra', corpi_1_et: 'Corpo 1 – entro terra', corpi_2_ft: 'Corpo 2 – fuori terra', corpi_2_et: 'Corpo 2 – entro terra',
    corpi_3_ft: 'Corpo 3 – fuori terra', corpi_3_et: 'Corpo 3 – entro terra', corpi_4_ft: 'Corpo 4 – fuori terra', corpi_4_et: 'Corpo 4 – entro terra',
    coperti_guardiola: 'Guardiola', coperti_alloggio_custode: 'Alloggio custode', coperti_sala_riunioni: 'Sala riunioni', coperti_atrio: 'Atrio',
    coperti_porticato: 'Porticato – pilotis', coperti_lavatoio: 'Lavatoio', coperti_piscina: 'Piscina coperta', coperti_altro: 'Altra destinazione',
    sup_sala_riunioni: 'mq', sup_atrio: 'mq', sup_porticato: 'mq', sup_lavatoio: 'mq', sup_piscina_coperta: 'mq', coperti_altro_descrizione: 'Descrizione',
    scoperti_terrazza: 'Terrazza', scoperti_cortile: 'Cortile e camminamenti', scoperti_verde: 'Verde', scoperti_parcheggio: 'Parcheggio auto',
    scoperti_tennis: 'Tennis', scoperti_piscine: 'Piscine', scoperti_altro: 'Altre destinazioni',
    sup_terrazza: 'mq', sup_cortile: 'mq', sup_verde: 'mq', n_posti_auto: 'posti auto n.', n_campi_tennis: 'campi n.', sup_piscina_scoperta: 'mq',
    scoperti_altro_descrizione: 'Descrizione', affaccio_altro_descrizione: 'Descrizione altro tipo di affaccio',
  },
  C: {
    strutture_muratura: 'Muratura', strutture_ca: 'Cemento armato', strutture_ferro: 'Ferro', strutture_prefabbricate: 'Prefabbricate',
    strutture_altro: 'Altro o tipiche del luogo', strutture_altro_descrizione: 'Descrizione altra struttura portante',
    copertura_terrazza_praticabile: 'A terrazza praticabile', copertura_terrazza_non_praticabile: 'A terrazza non praticabile', copertura_tetto: 'A tetto',
    tamponature_muratura: 'Muratura', tamponature_intercapedine: 'Muratura con intercapedine isolante', tamponature_pannelli: 'Pannelli prefabbricati',
    tamponature_facciata_continua: 'Facciata continua in vetro o metallo', tamponature_altro: 'Altro o tipiche del luogo', tamponature_altro_descrizione: 'Descrizione altra tamponatura',
    imp_idrico: 'Idrico', imp_elettrico: 'Elettrico', imp_gas: 'Gas', imp_telefonico: 'Telefonico', imp_fognario: 'Fognario',
    imp_riscaldamento_centralizzato: 'Riscaldamento centralizzato', imp_acqua_calda_centralizzata: 'Acqua calda centralizzata',
    imp_condizionamento_centralizzato: 'Condizionamento centralizzato', imp_citofonico: 'Citofonico', imp_videocitofonico: 'Videocitofonico',
    imp_antenna_tv: 'Antenna TV centralizzata', imp_ascensore: 'Ascensore', n_ascensori: 'Numero ascensori (obbligatorio, anche 0)', imp_montacarichi: 'Montacarichi',
    imp_altro: 'Altro', imp_altro_descrizione: 'Descrizione altro impianto', imp_energie_alternative: 'Energie alternative', energie_alternative_descrizione: 'Descrizione',
    fin_principale_tinteggiatura: 'Tinteggiatura', fin_principale_resino_plastica: 'Resino-plastica', fin_principale_klinker: 'Piastrelle di klinker, cotto o simili',
    fin_principale_marmo: 'Marmo o pietra naturale', fin_principale_pannelli: 'Pannelli, metallo, materiali plastici', fin_principale_legno: 'Legno',
    fin_principale_intonaco: 'Solo intonaco', fin_principale_altro: 'Altro o tipiche del luogo',
    fin_altre_tinteggiatura: 'Tinteggiatura', fin_altre_resino_plastica: 'Resino-plastica', fin_altre_klinker: 'Piastrelle di klinker, cotto o simili',
    fin_altre_marmo: 'Marmo o pietra naturale', fin_altre_pannelli: 'Pannelli, metallo, materiali plastici', fin_altre_legno: 'Legno',
    fin_altre_intonaco: 'Solo intonaco', fin_altre_altro: 'Altro o tipiche del luogo', fin_altro_descrizione: 'Descrizione altre finiture',
    portone_legno: 'Legno', portone_metallo: 'Metallo', portone_altro: 'Altro', accessi_legno: 'Legno', accessi_metallo: 'Metallo', accessi_altro: 'Altro',
    serramenti_altro_descrizione: 'Descrizione altro tipo di serramenti', finiture_pregio: 'Finiture di particolare pregio',
    pav_atrio_marmo: 'Marmo e pietra naturale', pav_atrio_ceramica: 'Ceramica, gres e simili', pav_atrio_moquette: 'Moquette e altri tessili',
    pav_atrio_plastica: 'Materiali plastici e simili', pav_atrio_legno: 'Legno', pav_atrio_altro: 'Altro o tipiche del luogo',
    pav_scale_marmo: 'Marmo e pietra naturale', pav_scale_ceramica: 'Ceramica, gres e simili', pav_scale_moquette: 'Moquette e altri tessili',
    pav_scale_plastica: 'Materiali plastici e simili', pav_scale_legno: 'Legno', pav_scale_altro: 'Altro o tipiche del luogo',
    pav_altro_descrizione: 'Descrizione altro tipo di pavimentazione',
    pareti_atrio_idropittura: 'Idropittura', pareti_atrio_resino_plastica: 'Resino-plastica', pareti_atrio_smalto: 'Smalto', pareti_atrio_laminati: 'Laminati plastici',
    pareti_atrio_legno: 'Legno', pareti_atrio_marmo: 'Marmo', pareti_atrio_altro: 'Altro o tipiche del luogo',
    pareti_scale_idropittura: 'Idropittura', pareti_scale_resino_plastica: 'Resino-plastica', pareti_scale_smalto: 'Smalto', pareti_scale_laminati: 'Laminati plastici',
    pareti_scale_legno: 'Legno', pareti_scale_marmo: 'Marmo', pareti_scale_altro: 'Altro o tipiche del luogo', pareti_altro_descrizione: 'Descrizione altra rifinitura pareti',
    rec_muratura: 'Muratura', rec_metalli: 'Metalli', rec_maglie: 'Maglie metalliche', rec_prefabbricati: 'Elementi prefabbricati', rec_altro: 'Altro',
    rec_altro_descrizione: 'Descrizione altro tipo di recinzione',
    vincolo_storico: 'Immobile soggetto a vincolo storico-artistico', vincolo_descrizione: 'Estremi del vincolo',
  },
};

export function etichetta1N(rec: RecordMod1N, id: string): string {
  const e = ETICHETTE_1N[rec]?.[id] ?? ETICHETTE[rec]?.[id] ?? id.replace(/_/g, ' ');
  return e.charAt(0).toUpperCase() + e.slice(1);
}

export function campoSchema(rec: RecordMod1N, id: string): FieldDef {
  const f = SCHEMAS[rec].fields.find((x) => x.id === id);
  if (!f) throw new Error(`Campo ${id} assente nel record ${rec}`);
  return f;
}

export function lunghezzaCampo(f: FieldDef): number {
  return f.end - f.start + 1;
}

const c = (id: string, accoppiato?: string, suffisso?: string): CampoUi => ({ id, etichetta: '', accoppiato: accoppiato ? { id: accoppiato, etichetta: '' } : undefined, suffisso });
const flags = (prefix: string, keys: string[]): CampoUi[] => keys.map((k) => c(`${prefix}_${k}`));

const uno = (campi: Campi, prefissi: string[]) => Object.entries(campi).some(([k, v]) => prefissi.some((p) => k.startsWith(p)) && !k.endsWith('_descrizione') && (v === 1 || v === true));
const pieno = (v: unknown) => v !== undefined && v !== '' && v !== 0;

/**
 * Quadri del modello 1N parte I come nella finestra di Docfa (etichette a sinistra, obbligatori sottolineati,
 * pallino verde a compilazione avvenuta). I campi sono quelli dei record B e C.
 */
const SEZIONI_GREZZE: SezioneUi[] = [
  {
    id: 'riferimenti', sigla: 'A-B', titolo: 'Riferimenti al fabbricato', rec: 'B', obbligatorio: true,
    descrizione: '[A] Riferimenti di mappa del fabbricato al C.T. e al C.E.U. – [B] anno di costruzione (se anteriore al 1942 basta barrare la casella) ed eventuale ristrutturazione.',
    completo: (b) => pieno(b.anno_costruzione),
    gruppi: [
      { titolo: '[A] Catasto terreni', disposizione: 'riga', campi: [c('ct_sezione'), c('ct_foglio'), c('ct_numero'), c('ct_numero_2')] },
      { titolo: '[A] Catasto edilizio urbano', disposizione: 'riga', campi: [c('ceu_sezione'), c('ceu_foglio'), c('ceu_numero'), c('ceu_numero_2')] },
      { titolo: '[B] Riferimenti temporali', disposizione: 'riga', obbligatorio: true, campi: [c('anno_costruzione'), c('anno_ristrutturazione')] },
    ],
  },
  {
    id: 'c1', sigla: 'C1', titolo: 'Elementi descrittivi del fabbricato (sez. 1)', rec: 'B', obbligatorio: true,
    completo: (b) => pieno(b.posizione_fabbricato),
    gruppi: [
      { titolo: '1.a Posizione rispetto ai fabbricati circostanti', obbligatorio: true, campi: [{ ...c('posizione_fabbricato'), opzioni: [{ valore: 1, etichetta: 'Isolato' }, { valore: 2, etichetta: 'Contiguo' }, { valore: 3, etichetta: 'A schiera' }] }] },
      { titolo: '1.b Complesso immobiliare', campi: [{ ...c('complesso_immobiliare'), opzioni: [{ valore: 0, etichetta: 'No' }, { valore: 1, etichetta: 'Sì' }] }, c('numero_edifici')] },
    ],
  },
  {
    id: 'c2', sigla: 'C2-4', titolo: 'Elementi descrittivi del fabbricato (sez. 2, 3, 4)', rec: 'B', obbligatorio: true,
    completo: (b) => ['n_abitazioni', 'n_negozi', 'n_laboratori', 'n_magazzini', 'n_uffici', 'n_box', 'n_autorimesse', 'n_impianti_sportivi', 'n_uiu_cat_b'].some((k) => Number(b[k]) > 0)
      && (Number(b.piani_fuori_terra) > 0 || (Number(b.piani_fuori_terra_min) > 0 && Number(b.piani_fuori_terra_max) > 0) || Number(b.piani_entro_terra) > 0 || (Number(b.piani_entro_terra_min) > 0 && Number(b.piani_entro_terra_max) > 0)),
    gruppi: [
      { titolo: '2. Destinazione e numero di U.I. in cui è suddiviso il fabbricato (almeno una)', obbligatorio: true, campi: [
        c('n_abitazioni'), c('n_negozi'), c('n_laboratori'), c('n_magazzini'), c('n_uffici'), c('n_box'), c('n_autorimesse'), c('n_impianti_sportivi'), c('n_uiu_cat_b'),
      ] },
      { titolo: '3. Il fabbricato', campi: [
        c('n_scale'),
        { ...c('tipo_accesso'), opzioni: [{ valore: 1, etichetta: 'Unico esterno' }, { valore: 2, etichetta: 'Plurimo esterno' }, { valore: 3, etichetta: 'Dal cortile interno' }] },
      ] },
      { titolo: '4. Caratteristiche dimensionali (fuori/entro terra, oppure minimo e massimo)', obbligatorio: true, disposizione: 'riga', campi: [c('piani_fuori_terra'), c('piani_fuori_terra_min'), c('piani_fuori_terra_max'), c('piani_entro_terra'), c('piani_entro_terra_min'), c('piani_entro_terra_max')] },
    ],
  },
  {
    id: 'c5', sigla: 'C5-7', titolo: 'Elementi descrittivi del fabbricato (sez. 5, 6, 7)', rec: 'B',
    completo: (b) => pieno(b.densita_ft_int) || pieno(b.corpi_1_ft),
    gruppi: [
      { titolo: '5. Densità fondiaria (mc/mq)', disposizione: 'riga', campi: [c('densita_ft_int'), c('densita_ft_dec'), c('densita_et_int'), c('densita_et_dec')] },
      { titolo: '6. Corpi accessori: piani fuori terra (compreso il terreno) ed entro terra (compreso il seminterrato)', disposizione: 'riga', campi: [c('corpi_1_ft'), c('corpi_1_et'), c('corpi_2_ft'), c('corpi_2_et'), c('corpi_3_ft'), c('corpi_3_et'), c('corpi_4_ft'), c('corpi_4_et')] },
      { titolo: '7. Il fabbricato', campi: [{ ...c('cortile_interno'), opzioni: [{ valore: 0, etichetta: 'No' }, { valore: 1, etichetta: 'Sì' }] }] },
    ],
  },
  {
    id: 'd', sigla: 'D', titolo: 'Destinazione degli spazi ad uso comune', rec: 'B',
    completo: (b) => uno(b, ['coperti_', 'scoperti_']),
    gruppi: [
      { titolo: '1. Spazi coperti', campi: [
        c('coperti_guardiola'), c('coperti_alloggio_custode'), c('coperti_sala_riunioni', 'sup_sala_riunioni'), c('coperti_atrio', 'sup_atrio'),
        c('coperti_porticato', 'sup_porticato'), c('coperti_lavatoio', 'sup_lavatoio'), c('coperti_piscina', 'sup_piscina_coperta'), c('coperti_altro', 'coperti_altro_descrizione'),
      ] },
      { titolo: '2. Spazi scoperti', campi: [
        c('scoperti_terrazza', 'sup_terrazza'), c('scoperti_cortile', 'sup_cortile'), c('scoperti_verde', 'sup_verde'), c('scoperti_parcheggio', 'n_posti_auto'),
        c('scoperti_tennis', 'n_campi_tennis'), c('scoperti_piscine', 'sup_piscina_scoperta'), c('scoperti_altro', 'scoperti_altro_descrizione'),
      ] },
    ],
  },
  {
    id: 'e', sigla: 'E', titolo: 'Posizione del fabbricato', rec: 'B', facciate: true, obbligatorio: true,
    descrizione: 'Almeno un tipo di affaccio per una facciata.',
    completo: (b) => Object.keys(b).some((k) => /^facciata\d_/.test(k) && (b[k] === 1 || b[k] === true)),
    gruppi: [{ campi: [c('affaccio_altro_descrizione')] }],
  },
  {
    id: 'f', sigla: 'F', titolo: 'Caratteristiche costruttive del fabbricato', rec: 'C', obbligatorio: true,
    descrizione: 'Almeno una voce per ogni punto.',
    completo: (x) => uno(x, ['strutture_']) && uno(x, ['copertura_']) && uno(x, ['tamponature_']),
    gruppi: [
      { titolo: '1. Strutture portanti verticali', obbligatorio: true, campi: [...flags('strutture', ['muratura', 'ca', 'ferro', 'prefabbricate']), c('strutture_altro', 'strutture_altro_descrizione')] },
      { titolo: '2. Copertura', obbligatorio: true, campi: flags('copertura', ['terrazza_praticabile', 'terrazza_non_praticabile', 'tetto']) },
      { titolo: '3. Tamponature', obbligatorio: true, campi: [...flags('tamponature', ['muratura', 'intercapedine', 'pannelli', 'facciata_continua']), c('tamponature_altro', 'tamponature_altro_descrizione')] },
    ],
  },
  {
    id: 'g', sigla: 'G', titolo: 'Dotazioni di impianti nel fabbricato', rec: 'C', obbligatorio: true,
    descrizione: 'Impianti comuni all\'intero fabbricato. Il numero di ascensori è obbligatorio: 0 in mancanza di impianto.',
    completo: (x) => typeof x.n_ascensori === 'number',
    gruppi: [
      { campi: [
        ...flags('imp', ['idrico', 'elettrico', 'gas', 'telefonico', 'fognario', 'riscaldamento_centralizzato', 'acqua_calda_centralizzata', 'condizionamento_centralizzato', 'citofonico', 'videocitofonico', 'antenna_tv']),
        c('n_ascensori'), c('imp_montacarichi'), c('imp_altro', 'imp_altro_descrizione'), c('imp_energie_alternative', 'energie_alternative_descrizione'),
      ] },
    ],
  },
  {
    id: 'h', sigla: 'H', titolo: 'Recinzioni del fabbricato', rec: 'C',
    completo: (x) => uno(x, ['rec_']),
    gruppi: [{ campi: [...flags('rec', ['muratura', 'metalli', 'maglie', 'prefabbricati']), c('rec_altro', 'rec_altro_descrizione')] }],
  },
  {
    id: 'i', sigla: 'I', titolo: 'Finiture delle parti esterne del fabbricato', rec: 'C', obbligatorio: true,
    completo: (x) => uno(x, ['fin_principale_', 'fin_altre_']) && uno(x, ['portone_', 'accessi_']),
    gruppi: [
      { titolo: '1. Tipo prevalente di finitura esterna – facciata principale', obbligatorio: true, campi: flags('fin_principale', ['tinteggiatura', 'resino_plastica', 'klinker', 'marmo', 'pannelli', 'legno', 'intonaco', 'altro']) },
      { titolo: 'Altre facciate', campi: [...flags('fin_altre', ['tinteggiatura', 'resino_plastica', 'klinker', 'marmo', 'pannelli', 'legno', 'intonaco', 'altro']), c('fin_altro_descrizione')] },
      { titolo: '2. Serramenti esterni – portone d\'ingresso', obbligatorio: true, campi: flags('portone', ['legno', 'metallo', 'altro']) },
      { titolo: 'Serramenti esterni – altri accessi', campi: [...flags('accessi', ['legno', 'metallo', 'altro']), c('serramenti_altro_descrizione')] },
      { titolo: '3. Finiture di particolare pregio', campi: [c('finiture_pregio')] },
    ],
  },
  {
    id: 'l', sigla: 'L', titolo: 'Finitura delle parti interne del fabbricato', rec: 'C',
    completo: (x) => uno(x, ['pav_atrio_', 'pav_scale_', 'pareti_atrio_', 'pareti_scale_']),
    gruppi: [
      { titolo: '1. Pavimentazione atrio', campi: flags('pav_atrio', ['marmo', 'ceramica', 'moquette', 'plastica', 'legno', 'altro']) },
      { titolo: 'Pavimentazione scale', campi: [...flags('pav_scale', ['marmo', 'ceramica', 'moquette', 'plastica', 'legno', 'altro']), c('pav_altro_descrizione')] },
      { titolo: '2. Finitura pareti atrio', campi: flags('pareti_atrio', ['idropittura', 'resino_plastica', 'smalto', 'laminati', 'legno', 'marmo', 'altro']) },
      { titolo: 'Finitura pareti scale', campi: [...flags('pareti_scale', ['idropittura', 'resino_plastica', 'smalto', 'laminati', 'legno', 'marmo', 'altro']), c('pareti_altro_descrizione')] },
    ],
  },
  {
    id: 'm', sigla: 'M', titolo: 'Vincoli artistici e storici', rec: 'C',
    completo: (x) => x.vincolo_storico === 1 ? pieno(x.vincolo_descrizione) : false,
    gruppi: [{ campi: [c('vincolo_storico', 'vincolo_descrizione')] }],
  },
];

/** Sezioni con le etichette risolte. */
export const SEZIONI_1N_PARTE_I: SezioneUi[] = SEZIONI_GREZZE.map((s) => ({
  ...s,
  gruppi: s.gruppi.map((g) => ({
    ...g,
    campi: g.campi.map((x) => ({
      ...x,
      etichetta: x.etichetta || etichetta1N(s.rec, x.id),
      accoppiato: x.accoppiato ? { id: x.accoppiato.id, etichetta: x.accoppiato.etichetta || (x.accoppiato.id.endsWith('_descrizione') ? 'Descrizione' : etichetta1N(s.rec, x.accoppiato.id)) } : undefined,
    })),
  })),
}));

export const TIPI_AFFACCIO: { id: string; etichetta: string }[] = [
  { id: 'strada_larga', etichetta: 'Su strada larga oltre 10 m' },
  { id: 'strada_stretta', etichetta: 'Su strada larga fino a 10 m' },
  { id: 'piazza', etichetta: 'Su piazza, largo o simili' },
  { id: 'distacco_abitazioni', etichetta: 'Su distacco da altri edifici (abitazioni)' },
  { id: 'distacco_altro', etichetta: 'Su distacco da altri edifici (altro)' },
  { id: 'verde_pubblico', etichetta: 'Su verde pubblico' },
  { id: 'verde_privato', etichetta: 'Su verde privato' },
  { id: 'altro', etichetta: 'Altro' },
  { id: 'aderenza', etichetta: 'Facciata in aderenza' },
];

/** Campi dati (18-334) di un record, con le etichette, per i modelli resi in forma generica (2N). */
export function campiRecord(rec: RecordMod1N, escludi: (id: string) => boolean = () => false): CampoUi[] {
  return SCHEMAS[rec].fields
    .filter((f) => f.start >= 18 && f.start < 335 && f.id !== 'codice_comune' && !escludi(f.id))
    .map((f) => ({ id: f.id, etichetta: etichetta1N(rec, f.id) }));
}
