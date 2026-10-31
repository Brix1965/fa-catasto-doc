/**
 * Pagine "Acquisizione dati metrici - calcolo delle superfici catastali": un riquadro per ogni
 * u.i.u. con modello 1N parte II, con gli ambienti (tipologia e superficie) su tre colonne, e la
 * legenda delle tipologie in fondo alla pagina. Le annotazioni con i file dati (NCV, ATT, NMV, EPV)
 * vanno sull'ultima pagina prima degli elaborati grafici (vedi documento.ts).
 */
import type { Pratica } from '../../model';
import { ambientiDatiMetrici, tipologiaMetrica } from '../../compile';
import { Pagina, MM } from '../pagina';
import { FORMATO, intestazione, type DatiCornice } from '../cornice';
import { aDestra, intero } from '../formato';

const X1 = 28.346;
const X2 = 566.929;
const mm = (v: number): number => v * MM;
const COLONNA = 184.252; // distanza fra le tre colonne degli ambienti
const LEGENDA = [
  'LEGENDA - Decodifica Tipologie di Ambiente previsti:',
  'A - Vani aventi funzione principale / accessori a diretto servizio dei principali. Per le categorie C/1 e C/6 i vani aventi',
  '   funzione principale saranno indicati con A1, i vani accessori a diretto servizio con A2',
  'B - Vani accessori a indiretto servizio della tipologia A qualora comunicanti',
  'C - Vani accessori a indiretto servizio della tipologia A qualora non comunicanti',
  'D - Balconi, terrazzi e simili comunicanti con i vani della tipologia A',
  'E - Balconi, terrazzi e simili non comunicanti con i vani della tipologia A',
  'F - Aree scoperte o assimilabili',
];

/**
 * Tipologia dell'ambiente come la stampa Docfa: per le categorie del gruppo C (tipologia metrica T*)
 * i vani principali (tipo "A" nel file) sono stampati "A1" e gli accessori diretti (tipo "H") "A2".
 */
function tipologiaStampa(tipo: string, tipologiaMetrica: string): string {
  if (tipologiaMetrica.startsWith('T')) {
    if (tipo === 'A') return 'A1';
    if (tipo === 'H') return 'A2';
  }
  return tipo;
}

export function pagineDatiMetrici(pratica: Pratica, cornice: DatiCornice): Pagina[] {
  const pagine: Pagina[] = [];
  const nuovaPagina = (): Pagina => {
    const p = new Pagina(FORMATO.datiMetrici.larghezza, FORMATO.datiMetrici.altezza);
    intestazione(p, cornice);
    p.testo(127.559, 731.339, 'R', 9, 'ACQUISIZIONE DATI METRICI - CALCOLO DELLE SUPERFICI CATASTALI');
    LEGENDA.forEach((riga, i) => p.testo(i === 2 ? 42.52 : 29.764, mm(55 - 5 * i), 'R', 9, i === 2 ? riga.trimStart() : riga));
    pagine.push(p);
    return p;
  };
  let p = nuovaPagina();
  let top = 254;
  pratica.unita.forEach((u, idx) => {
    if (!u.mod1NParteII) return;
    const ambienti = ambientiDatiMetrici(u);   // gli stessi del file NMV (senza i G per i gruppi A e B)
    const righe = Math.max(1, Math.ceil(ambienti.length / 3));
    const altezza = 26 + 5 * (righe - 1);
    if (top - altezza < 65) {
      p = nuovaPagina();
      top = 254;
    }
    const B = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'B', 9, s);
    const R = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'R', 9, s);
    p.rettangolo(X1, mm(top - altezza), X2 - X1, mm(altezza), 1);
    p.linea(X1, mm(top - 10), X2, mm(top - 10), 0);
    B(29.764, top - 4, "Unita' immobiliare n.");
    R(113.386, top - 4, aDestra(String(idx + 1), 3));
    B(29.764, top - 9, 'Sezione:');
    if (u.identificativo.sezione) R(68.0, top - 9, u.identificativo.sezione);
    B(113.386, top - 9, 'Foglio:');
    R(141.732, top - 9, aDestra(u.identificativo.foglio, 4));
    B(184.252, top - 9, 'Particella:');
    R(226.772, top - 9, aDestra(u.identificativo.numero, 10));
    B(283.465, top - 9, 'Subalterno:');
    if (u.identificativo.subalterno) R(340.157, top - 9, aDestra(u.identificativo.subalterno, 4));
    for (let c = 0; c < 3; c++) {
      const dx = c * COLONNA;
      B(31.181 + dx, top - 14, 'Tipologia');
      B(161.575 + dx, top - 14, 'Altezza');
      B(31.181 + dx, top - 19, 'Ambiente');
      B(c === 2 ? 456.378 : 102.047 + dx, top - 19, 'Superficie'); // nella terza colonna Docfa la sposta a sinistra
      B(158.74 + dx, top - 19, '< 150 cm');
    }
    const tm = u.tipologiaMetrica ?? tipologiaMetrica(u.classamento?.categoria ?? '');
    ambienti.forEach((a, k) => {
      const col = k % 3;
      const riga = Math.floor(k / 3);
      const y = top - 24 - 5 * riga;
      R(42.52 + col * COLONNA, y, tipologiaStampa(a.tipo, tm));
      R(col === 2 ? 467.717 : 113.386 + col * COLONNA, y, aDestra(intero(Math.round(a.superficie)), 5)); // terza colonna spostata come l'intestazione
      // colonna "Altezza < 150 cm": Docfa stampa SI quando l'altezza minima dichiarata è sotto i 150 cm (0 = non indicata)
      if (a.altezzaMin > 0 && a.altezzaMin < 150) R(170.079 + col * COLONNA, y, 'SI');
    });
    top = top - altezza - 7;
  });
  return pagine;
}
