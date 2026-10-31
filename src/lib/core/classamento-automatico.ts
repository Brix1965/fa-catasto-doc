/**
 * Classamento automatico (funzione "Classamento automatico" di Docfa): categoria, classe e consistenza
 * calcolate dai modelli 1N (parte I e II) e dai prospetti provinciali NCL (V1…V8).
 *
 * Ricostruisce i programmi NZCT01…NZCT06 di Docfa 4 (cartella `classamento/`): il documento viene compilato
 * nei record Docfa, NZCT02 ne ricava per ogni unità il vettore delle caratteristiche (record NCLAS1), NZCT01
 * sceglie i prospetti e chiama NZCT03 (categoria), NZCT04 (classe) e NZCT05 (consistenza); NZCT06 calcola
 * le rendite e l'esito che finisce nel record 3 (posizioni 273-334).
 */
import type { Pratica, UnitaImmobiliare } from './model';
import { compilaDocumento } from './compile';
import { nzct02, type DatiInAtti } from './classamento/nzct02';
import { classamento, testoEsito, ErroreDocfa, ESITI, type Prospetti } from './classamento/nzct01';

export type { Prospetti } from './classamento/nzct01';
export { leggiProspetti } from './classamento/nzct01';

export interface EsitoClassamentoAutomatico {
  /** true se il calcolo ha prodotto un classamento */
  eseguito: boolean;
  /** codice dell'esito di Docfa (00 eseguito … 06), se il calcolo è arrivato all'unità */
  codice?: string;
  /** messaggio dell'esito (come in Docfa, es. "Classamento automatico eseguito") */
  esito: string;
  zonaCensuaria?: string;
  categoria?: string;
  classe?: string;
  consistenza?: string;
  /** rendita in euro calcolata da Docfa per il classamento automatico */
  rendita?: number;
}

export interface ClassamentoDocumento {
  /** errore che ferma tutto il calcolo (come i messaggi di Docfa), altrimenti assente */
  errore?: string;
  /** risultato per indice dell'unità */
  unita: Map<number, EsitoClassamentoAutomatico>;
}

/** Testo delle posizioni 273-334 del record 3 per un esito (codice + 60 caratteri). */
export function testoEsitoClassamento(codice: string): string {
  return testoEsito(codice);
}

function latin1(b: Uint8Array, da: number, a: number): string {
  let s = '';
  for (let i = da; i < a; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** Record del documento (350 caratteri) dal file NCA/NCV compilato. */
function recordDocumento(dati: Uint8Array): string[] {
  const out: string[] = [];
  for (let i = 0; i + 350 <= dati.length; i += 352) out.push(latin1(dati, i, i + 350));
  return out;
}

/** Dati delle finestre "in atti" di Docfa dalla pratica (solo in variazione, se compilati). */
function datiInAtti(p: Pratica, prospetti: Prospetti): DatiInAtti | undefined {
  if (p.tipoDocumento === 'accatastamento') return undefined;
  const cat = (c: string) => c.trim().toUpperCase().replace('/', '').replace(/^([A-Z])(\d)$/, '$10$2');
  const cl = (c: string) => (/^\d$/.test(c.trim()) ? '0' + c.trim() : c.trim().toUpperCase()).padEnd(2, ' ');
  const unita = p.unita.filter((u) => (u.operazione === 'V' || u.operazione === 'S') && u.inAtti?.categoria.trim()).map((u) => ({ categoria: cat(u.inAtti!.categoria), classe: cl(u.inAtti!.classe) }));
  const fabbricato = (p.classiFabbricato ?? []).filter((x) => x.categoria.trim()).map((x) => ({ categoria: cat(x.categoria), classe: cl(x.classe) }));
  if (!unita.length && !fabbricato.length) return undefined;
  return { unita, fabbricato, tar: prospetti.TAR ?? [] };
}

/** Classamento automatico di tutte le unità del documento, come la funzione di Docfa. */
export function classamentoAutomaticoDocumento(p: Pratica, prospetti: Prospetti | null | undefined): ClassamentoDocumento {
  const unita = new Map<number, EsitoClassamentoAutomatico>();
  if (!prospetti || !prospetti.V1 || !prospetti.V8 || !prospetti.TAR) {
    return { unita, errore: `Prospetti per il classamento automatico non caricati per la provincia ${p.comune.provincia || '—'} (Caricamento archivi: Nclxxv1…8A.dat e tariffe)` };
  }
  let doc: string[];
  try {
    doc = recordDocumento(compilaDocumento(p).ncv.dati);
  } catch (e) {
    return { unita, errore: `Documento non compilabile: ${e instanceof Error ? e.message : String(e)}` };
  }
  const n2 = nzct02(doc, datiInAtti(p, prospetti));
  const stato = n2.l54.slice(6, 8);
  if (stato !== '00' && stato !== 'X0') return { unita, errore: n2.l54.slice(9, 79).trim() || `Classamento automatico interrotto (${stato})` };
  let ris;
  try {
    ris = classamento(n2.nclas, prospetti, { doc, l4c: n2.l4c, w434e: stato });
  } catch (e) {
    if (e instanceof ErroreDocfa) return { unita, errore: `Classamento automatico interrotto: Docfa si ferma con l'errore ${e.codice}` };
    throw e;
  }
  for (const r of ris.nclas) {
    if (r[7] !== 'C' || r[0x78] === 'D' || r[0x78] === 'E') continue;
    const i = Number(r.slice(8, 11)) - 1;
    const codice = r.slice(0xb4, 0xb6);
    const categoria = r.slice(0x96, 0x99).trim();
    const d = ris.doc?.find((x) => x.slice(0, 16) === r.slice(0, 16) && x[16] === '3');
    const eseguito = codice === '00' && !!categoria;
    unita.set(i, {
      eseguito,
      codice,
      esito: (ESITI[codice] ?? '').trim() || `Esito ${codice}`,
      zonaCensuaria: r.slice(0x93, 0x96).trim(),
      categoria,
      classe: r.slice(0x99, 0x9b).trim(),
      consistenza: r.slice(0x9b, 0xa2).trim(),
      rendita: d ? Number(d.slice(209, 219)) / 100 : undefined,
    });
  }
  return { unita };
}

/** Risultato per una singola unità (comodità per le schermate). */
export function classamentoAutomatico(p: Pratica, u: UnitaImmobiliare, prospetti?: Prospetti | null, calcolato?: ClassamentoDocumento): EsitoClassamentoAutomatico {
  const r = calcolato ?? classamentoAutomaticoDocumento(p, prospetti);
  const i = p.unita.indexOf(u);
  return r.unita.get(i) ?? { eseguito: false, esito: r.errore ?? 'Unità non sottoposta al classamento automatico' };
}
