/**
 * Generazione del PDF/A del documento Docfa ("modello unico informatico"): modello D1, modelli 1N/2N,
 * dati metrici, elenco subalterni, elaborati grafici (planimetrie TIFF G4) e, nascosti nelle
 * annotazioni, i file dati che l'Agenzia estrae dal PDF (NCV, ATT, NMV, EPV e i poligoni NTF).
 */
import type { Pratica } from '../model';
import type { Compilato } from '../compile';
import { PdfWriter, type AnnotazioneTesto, type VoceOutline } from './writer';
import { decodificaBase64 } from './base64';
import { LIBERATION_SERIF_BOLD_B64, LIBERATION_SERIF_REGULAR_B64 } from './assets/fonts.generated';
import { SRGB_ICC_B64 } from './assets/icc.generated';
import { NOME_FONT, Pagina } from './pagina';
import { FORMATO, pieDiPagina, type DatiCornice } from './cornice';
import { pagineD1 } from './pagine/d1';
import { pagineModelli } from './pagine/modelli';
import { pagineDatiMetrici } from './pagine/datiMetrici';
import { pagineElencoSubalterni } from './pagine/elencoSubalterni';
import { nomeProvincia } from './tabelle';
import { codiceRiscontro } from '../riscontro';

/** piè di pagina e metadati come nel PDF di Docfa 4.00.5 (scelta del progetto: file identico all'originale) */
export const VERSIONE_PROGRAMMA = 'Docfa - ver. 4.00.5';
export const PRODUCER_PDF = 'Sogei spa SDIPDF vers. 1.3.2';
/** data di creazione e dei metadati scritte da Docfa (quelle del suo modello PDF), uguali in tutti i campioni */
const CREAZIONE_MODELLO = new Date('2013-10-11T17:29:24+02:00');
const METADATI_MODELLO = new Date('2013-10-11T17:29:26+02:00');

/** Immagine di una planimetria (o scheda dell'elaborato planimetrico) nell'ordine di stampa. */
export interface ImmagineDocumento {
  /** nome dell'immagine, es. 0000007.001 (progressivo.scheda) */
  nome: string;
  /** dati CCITT G4 grezzi (lo stream del TIFF, senza intestazione TIFF) */
  g4: Uint8Array;
  width: number;
  height: number;
  /** file dei poligoni (NTF) da nascondere nella pagina, se presente */
  ntf?: Uint8Array;
  /** nome del file NTF, es. N0000007.001 */
  nomeNtf?: string;
  formato: 'A4' | 'A3';
}

export interface OpzioniDocumento {
  /** nome della provincia per "Ufficio Provinciale di" (default: dalla provincia del comune) */
  ufficioProvinciale?: string;
  /** data e ora di stampa (default: adesso) */
  dataOra?: Date;
  /** codice di riscontro stampato in basso a sinistra (default: calcolato dai file come fa Docfa) */
  identificativo?: string;
  /** testo della versione nel piè di pagina */
  versione?: string;
  titolo?: string;
}

/** Nomi usati nel PDF per i font incorporati (non sono Times New Roman: Liberation Serif è metricamente compatibile). */
export const NOME_FONT_REGOLARE = 'LiberationSerif';
export const NOME_FONT_GRASSETTO = 'LiberationSerif-Bold';

/** Genera il PDF del documento. */
export async function renderDocumento(pratica: Pratica, compilato: Compilato, immagini: ImmagineDocumento[], opzioni: OpzioniDocumento = {}): Promise<Uint8Array> {
  const dataOra = opzioni.dataOra ?? new Date();
  const cornice: DatiCornice = {
    ufficio: (opzioni.ufficioProvinciale ?? nomeProvincia(pratica.comune.provincia)).toUpperCase(),
    comune: pratica.comune.nome.toUpperCase(),
    codiceFiscale: pratica.tecnico.codiceFiscale.toUpperCase(),
    identificativo: opzioni.identificativo ?? codiceRiscontro(compilato.ncv.dati, compilato.nmv.dati),
    versione: opzioni.versione ?? VERSIONE_PROGRAMMA,
    dataOra,
  };

  // pagine dei modelli (numerate); le planimetrie non contano nella numerazione
  const d1 = pagineD1(pratica, compilato, cornice);
  const modelli = pagineModelli(pratica, compilato, cornice);
  const datiMetrici = pagineDatiMetrici(pratica, cornice);
  const elenco = pagineElencoSubalterni(pratica, cornice);
  const numerate: Pagina[] = [...d1, ...modelli, ...datiMetrici, ...elenco];
  numerate.forEach((p, i) => pieDiPagina(p, cornice, i + 1, numerate.length, i >= d1.length));

  const w = new PdfWriter();
  w.impostaMetadati({
    producer: PRODUCER_PDF,
    titolo: opzioni.titolo,
    data: dataOra,
    creazione: CREAZIONE_MODELLO,
    dataMetadati: METADATI_MODELLO,
  });
  await w.impostaOutputIntent(decodificaBase64(SRGB_ICC_B64), 'sRGB IEC61966-2.1');
  const regolare = await w.aggiungiFontTrueType(decodificaBase64(LIBERATION_SERIF_REGULAR_B64), NOME_FONT_REGOLARE);
  const grassetto = await w.aggiungiFontTrueType(decodificaBase64(LIBERATION_SERIF_BOLD_B64), NOME_FONT_GRASSETTO);
  const font = { [NOME_FONT.R]: regolare.rif, [NOME_FONT.B]: grassetto.rif };

  // i file dati vanno come annotazioni sull'ultima pagina prima degli elaborati grafici
  const fileDati = [compilato.ncv, compilato.att, compilato.nmv, ...(compilato.epv ? [compilato.epv] : [])];
  const annotazioniDati: AnnotazioneTesto[] = fileDati.map((f, k) => ({
    nome: f.nome,
    contenuto: f.dati,
    rect: [40 + 20 * k, 30, 60 + 20 * k, 50],
  }));

  const indici: number[] = [];
  for (let i = 0; i < numerate.length; i++) {
    const p = numerate[i];
    const ultima = i === numerate.length - 1;
    indici.push(await w.aggiungiPagina({
      larghezza: p.larghezza,
      altezza: p.altezza,
      contenuto: p.bytes(),
      font,
      annotazioni: ultima ? annotazioniDati : undefined,
      rotate: p.larghezza === FORMATO.modello.larghezza && p.altezza === FORMATO.modello.altezza ? 0 : undefined,
      cropBox: p.larghezza === FORMATO.modello.larghezza && p.altezza === FORMATO.modello.altezza,
    }));
  }

  // elaborati grafici
  const vociImmagini: VoceOutline[] = [];
  for (const im of immagini) {
    const f = im.formato === 'A3' ? FORMATO.planimetriaA3 : FORMATO.planimetriaA4;
    const p = new Pagina(f.larghezza, f.altezza);
    p.immagine('Im0', 0, 0, f.larghezza, f.altezza);
    const rifImmagine = await w.aggiungiImmagineCCITT(im.g4, im.width, im.height);
    const annotazioni: AnnotazioneTesto[] = im.ntf ? [{ nome: im.nomeNtf ?? `N${im.nome}`, contenuto: im.ntf, rect: [20, 20, 40, 40] }] : [];
    const idx = await w.aggiungiPagina({ larghezza: f.larghezza, altezza: f.altezza, contenuto: p.bytes(), xobject: { Im0: rifImmagine }, annotazioni });
    vociImmagini.push({ titolo: im.nome, pagina: idx });
  }

  // segnalibri
  const figli: VoceOutline[] = [{ titolo: 'Modello D1', pagina: 0 }];
  if (modelli.length) figli.push({ titolo: 'Modelli 1N 2N', pagina: d1.length });
  if (datiMetrici.length) figli.push({ titolo: 'Dati metrici', pagina: d1.length + modelli.length });
  if (elenco.length) figli.push({ titolo: 'Elenco subalterni', pagina: d1.length + modelli.length + datiMetrici.length });
  if (vociImmagini.length) figli.push({ titolo: 'Elaborati grafici', pagina: vociImmagini[0].pagina, figli: vociImmagini, chiusa: true });
  w.impostaOutline([{ titolo: 'Modello unico informatico degli atti catastali', pagina: 0, figli }]);

  return w.genera();
}
