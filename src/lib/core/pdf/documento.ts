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
import { FONT_MODULO_2N } from './assets/modulo2n.generated';
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
  /** logo del D1 (preso dal PDF di Docfa del tecnico): in alto a sinistra della prima pagina, come Docfa */
  logoD1?: { jpeg: Uint8Array; larghezza: number; altezza: number };
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
  // font del modulo 2N copiato da Docfa: si aggiungono solo se ci sono pagine 2N
  let fontModulo: Record<string, number> | undefined;
  const fontPagina = async (p: Pagina) => {
    if (!p.moduloGrezzo) return font;
    if (!fontModulo) {
      fontModulo = {};
      for (const [nome, f] of Object.entries(FONT_MODULO_2N))
        fontModulo[nome] = await w.aggiungiFontModulo({ ...f, fontFile: decodificaBase64(f.fontFile), toUnicode: decodificaBase64(f.toUnicode) });
    }
    return { ...font, ...fontModulo };
  };

  // i file dati vanno come annotazioni sull'ultima pagina prima degli elaborati grafici
  // posizioni fisse per file (NCV 40, ATT 60, NMV 80, EPV 100); un file vuoto non si scrive (NMV senza 1N parte II)
  // e oltre 65535 byte Docfa lo divide in «.part1», «.part2»… spostando ogni parte di 1 punto (pratica BPM)
  const fileDati = [compilato.ncv, compilato.att, compilato.nmv, compilato.epv];
  const annotazioniDati: AnnotazioneTesto[] = [];
  fileDati.forEach((f, k) => {
    if (!f || !f.dati.length) return;
    const parti = Math.ceil(f.dati.length / 65535);
    for (let j = 0; j < parti; j++) {
      annotazioniDati.push({
        nome: parti > 1 ? `${f.nome}.part${j + 1}` : f.nome,
        contenuto: f.dati.subarray(j * 65535, (j + 1) * 65535),
        rect: [40 + 20 * k + j, 30 + j, 60 + 20 * k + j, 50 + j],
      });
    }
  });

  // logo: Docfa lo disegna solo sulla prima pagina del D1, 60 × 20 mm a 10 mm dal bordo (170.07874 × 56.69291
  // in 28.34646, 765.3543: NCV002, NCV081, BPM)
  let xobjectLogo: Record<string, number> | undefined;
  if (opzioni.logoD1 && d1.length) {
    xobjectLogo = { Im0: await w.aggiungiImmagineJPEG(opzioni.logoD1.jpeg, opzioni.logoD1.larghezza, opzioni.logoD1.altezza) };
    d1[0].immagine('Im0', 28.34646, 765.3543, 170.07874, 56.69291);
  }

  const indici: number[] = [];
  for (let i = 0; i < numerate.length; i++) {
    const p = numerate[i];
    const ultima = i === numerate.length - 1;
    indici.push(await w.aggiungiPagina({
      larghezza: p.larghezza,
      altezza: p.altezza,
      contenuto: p.bytes(),
      font: await fontPagina(p),
      xobject: i === 0 ? xobjectLogo : undefined,
      annotazioni: ultima ? annotazioniDati : undefined,
      rotate: p.larghezza === FORMATO.modello.larghezza && p.altezza === FORMATO.modello.altezza && !p.modello2N ? 0 : undefined,
      cropBox: p.larghezza === FORMATO.modello.larghezza && p.altezza === FORMATO.modello.altezza && !p.modello2N,
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
  // senza 1N (solo 2N) Docfa non mette il segnalibro «Modelli 1N 2N» (pratica BPM)
  if (modelli.length && modelli.some((p) => !p.modello2N)) figli.push({ titolo: 'Modelli 1N 2N', pagina: d1.length });
  if (datiMetrici.length) figli.push({ titolo: 'Dati metrici', pagina: d1.length + modelli.length });
  if (elenco.length) figli.push({ titolo: 'Elenco subalterni', pagina: d1.length + modelli.length + datiMetrici.length });
  if (vociImmagini.length) figli.push({ titolo: 'Elaborati grafici', pagina: vociImmagini[0].pagina, figli: vociImmagini, chiusa: true });
  w.impostaOutline([{ titolo: 'Modello unico informatico degli atti catastali', pagina: 0, figli }]);

  return w.genera();
}
