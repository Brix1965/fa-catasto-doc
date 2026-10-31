/**
 * Elementi comuni a tutte le pagine dei modelli: intestazione (ufficio provinciale e comune),
 * riquadro con la sigla del modello e piè di pagina (identificativo, versione del programma,
 * codice fiscale del tecnico, data e ora, numero di pagina).
 */
import { Pagina } from './pagina';

export interface DatiCornice {
  /** nome della provincia dell'ufficio (es. FIRENZE) */
  ufficio: string;
  /** nome del comune (es. FIRENZE) */
  comune: string;
  /** codice fiscale del tecnico, stampato nel piè di pagina dei modelli (non del D1) */
  codiceFiscale: string;
  /** identificativo del documento stampato in basso a sinistra */
  identificativo: string;
  /** es. "Fa.Catasto.Doc - ver. 0.1" */
  versione: string;
  /** data e ora di stampa */
  dataOra: Date;
}

/** Dimensioni delle pagine (punti) come nei PDF di Docfa. */
export const FORMATO = {
  d1: { larghezza: 595.44, altezza: 842.4 },
  modello: { larghezza: 595, altezza: 836 },
  datiMetrici: { larghezza: 595.2756, altezza: 836.22046 },
  planimetriaA4: { larghezza: 595.5156, altezza: 842.507 },
  planimetriaA3: { larghezza: 842.507, altezza: 1191.7513 },
} as const;

export function intestazione(p: Pagina, d: DatiCornice): void {
  p.testo(368.504, 793.701, 'R', 9, 'Ufficio Provinciale di');
  p.testo(447.874, 793.701, 'R', 9, ': ');
  p.testo(453.543, 793.701, 'B', 9, d.ufficio);
  p.testo(408.189, 782.362, 'R', 9, 'Comune di ');
  p.testo(447.874, 782.362, 'R', 9, ': ');
  p.testo(453.543, 782.362, 'B', 9, d.comune);
}

/** Riquadro in alto a destra con la sigla del modello (es. "mod. D1"); `largo` = fino al margine destro. */
export function riquadroModello(p: Pagina, sigla: string, largo = false): void {
  const x2 = largo ? 566.929 : 524.409;
  p.linea(479.055, 756.85, 479.055, 739.843);
  p.linea(479.055, 739.843, x2, 739.843);
  p.linea(x2, 739.843, x2, 756.85);
  p.linea(x2, 756.85, 479.055, 756.85);
  p.testo(481.89, 745.512, 'R', 9, sigla);
}

export function pieDiPagina(p: Pagina, d: DatiCornice, numero: number, totale: number, conCodiceFiscale: boolean): void {
  const z = (n: number) => String(n).padStart(2, '0');
  const t = d.dataOra;
  p.testo(34.016, 22.677, 'R', 9, d.identificativo);
  p.testo(34.016, 11.339, 'R', 9, d.versione);
  if (conCodiceFiscale) p.testo(419.528, 22.677, 'R', 9, d.codiceFiscale);
  p.testo(510.236, 22.677, 'R', 9, `${z(t.getDate())}/${z(t.getMonth() + 1)}/${z(t.getFullYear() % 100)}:`);
  p.testo(544.252, 22.677, 'R', 9, `${z(t.getHours())}.${z(t.getMinutes())}.${z(t.getSeconds())}`);
  p.testo(481.89, 11.339, 'R', 9, 'pag. ');
  p.testo(488.976, 11.339, 'R', 9, String(numero).padStart(9, ' '));
  p.testo(524.409, 11.339, 'R', 9, 'di');
  p.testo(531.496, 11.339, 'R', 9, String(totale).padStart(9, ' '));
}
