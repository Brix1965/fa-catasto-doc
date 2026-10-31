/**
 * Pagina "Elenco dei subalterni assegnati" (elaborato planimetrico): tabella dei subalterni con
 * ubicazione, piani e descrizione (a capo ogni 25 caratteri) e riquadro per protocollo e firma.
 */
import type { Pratica } from '../../model';
import { Pagina, MM } from '../pagina';
import { FORMATO, intestazione, riquadroModello, type DatiCornice } from '../cornice';
import { aCapo } from '../formato';
import { albo, nomeProvincia } from '../tabelle';

const X1 = 14.173; // 5 mm
const X2 = 581.102; // 205 mm
const mm = (v: number): number => v * MM;
/** larghezza di una cifra nei numeri allineati a destra (Docfa usa le metriche a 9 pt) */
const CIFRA = 4.535;

function civicoStampa(c: string | undefined): string {
  if (!c) return '';
  return /^\d+$/.test(c.trim()) ? String(Number(c)) : c.trim();
}

export function pagineElencoSubalterni(pratica: Pratica, cornice: DatiCornice): Pagina[] {
  const ep = pratica.elaboratoPlanimetrico;
  if (!ep) return [];
  const pagine: Pagina[] = [];
  const nuovaPagina = (): Pagina => {
    const p = new Pagina(FORMATO.datiMetrici.larghezza, FORMATO.datiMetrici.altezza);
    intestazione(p, cornice);
    p.testo(127.559, 742.677, 'B', 10, "ACCERTAMENTO DELLA PROPRIETA' IMMOBILIARE URBANA");
    p.testo(184.252, 731.339, 'B', 10, 'ELENCO DEI SUBALTERNI ASSEGNATI');
    riquadroModello(p, '  Elenco Subalterni', true);
    const R = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'R', 8, s);
    const B = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'B', 8, s);
    p.linea(X1, mm(249), X2, mm(249), 1);
    R(14.173, 245, ' Comune');
    R(255.118, 245, ' Sezione');
    R(311.811, 245, ' Foglio');
    R(368.504, 245, ' Particella');
    R(439.37, 245, ' Tipo mappale');
    R(524.409, 245, ' del:');
    for (const x of [240.945, 297.638, 354.331, 420.945]) p.linea(x, mm(239), x, mm(249), 0);
    p.linea(X1, mm(239), X2, mm(239), 0);
    B(19.843, 240, pratica.comune.nome.toUpperCase());
    if (ep.identificativo.sezione) B(262.0, 240, ep.identificativo.sezione);
    const foglio = ep.identificativo.foglio.replace(/^0+(?=\d)/, '');
    B(329.951 - CIFRA * foglio.length, 240, foglio);
    const particella = ep.identificativo.numero.replace(/^0+(?=\d)/, '');
    B(408.19 - CIFRA * particella.length, 240, particella);
    R(15.591, 235, ' Sub.');
    R(36.85, 235, ' UBICAZIONE via/piazza');
    R(240.945, 235, ' n° civ. ');
    R(289.134, 235, ' Piani');
    R(328.819, 235, ' Scala');
    R(351.496, 235, ' Int.');
    R(367.087, 235, ' Entità di Costruzione');
    R(481.89, 235, ' DESCRIZIONE');
    for (const x of [34.016, 240.945, 267.874, 327.402, 351.496, 365.669, 446.457]) p.linea(x, mm(234), x, mm(239), 0);
    p.linea(X1, mm(234), X2, mm(234), 0);
    pagine.push(p);
    return p;
  };
  let p = nuovaPagina();
  let y = 230;
  const chiudi = (topBox: number) => {
    // bordi laterali della tabella fino al riquadro della firma
    p.linea(X1, mm(249), X1, mm(topBox), 1);
    p.linea(X2, mm(249), X2, mm(topBox), 1);
  };
  const B = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'B', 8, s);
  ep.subalterni.forEach((s) => {
    const righe = aCapo(s.descrizione.trim(), 25);
    const altezza = 5 * Math.max(1, righe.length);
    if (y - altezza < 60) {
      chiudi(y + 5 - 6);
      p = nuovaPagina();
      y = 230;
    }
    const sub = (s.identificativo.subalterno ?? '').replace(/^0+(?=\d)/, '');
    if (sub) B(28.913 - CIFRA * (sub.length - 1), y, sub);
    if (s.indirizzo) B(38.268, y, s.indirizzo.trim());
    if (s.civico) B(248.031, y, civicoStampa(s.civico));
    // nell'elenco subalterni Docfa unisce i piani con "-" (S1-T, 2-3, 4 → S1-T-2-3-4)
    const piani = s.piani.map((pi) => pi.trim()).filter(Boolean).join('-');
    if (piani) B(272.126, y, piani);
    if (s.scala) B(330.0, y, s.scala.trim());
    if (s.interno) B(353.0, y, s.interno.trim());
    const entita = s.entita.filter(Boolean).join(' ');
    if (entita) B(369.0, y, entita);
    righe.forEach((r, i) => B(447.874, y - 5 * i, r));
    y -= altezza;
  });
  // riquadro protocollo / firma: 6 mm sotto l'ultima riga, alto 25 mm
  const top = y + 5 - 6;
  chiudi(top);
  p.rettangolo(X1, mm(top - 25), X2 - X1, mm(25), 1);
  const R = (x: number, ymm: number, s: string) => p.testo(x, mm(ymm), 'R', 8, s);
  R(14.173, top - 7, ' Protocollo');
  p.linea(70.866, mm(top - 7), 141.732, mm(top - 7), 0);
  R(413.858, top - 7, ' data');
  p.linea(445.039, mm(top - 7), 566.929, mm(top - 7), 0);
  const t = pratica.tecnico;
  const a = albo(t.albo);
  R(14.173, top - 15, ' IL TECNICO');
  B(85.039, top - 15, `${a.titolo} ${t.cognome.toUpperCase()} ${t.nome.toUpperCase()}`.trim());
  B(17.008, top - 19, `${a.albo} DELLA PROVINCIA DI  ${nomeProvincia(t.provinciaAlbo)} n. ${t.numeroIscrizione.trim()} `);
  R(17.008, top - 23, 'Codice Fiscale:');
  B(85.039, top - 23, t.codiceFiscale.toUpperCase());
  p.linea(445.039, mm(top - 20), 566.929, mm(top - 20), 0);
  R(467.717, top - 23, ' firma e timbro');
  return pagine;
}
