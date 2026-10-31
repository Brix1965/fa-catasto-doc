/**
 * Lettura degli archivi distribuiti dall'Agenzia delle Entrate per Docfa 4.
 *
 * - Comuni.dat (con l'installazione): file indicizzato Micro Focus, header di 128 byte e record
 *   da 72 byte che iniziano con "@F": codice amministrativo (5) + nome (50) + codice catastale (4) + provincia (2) + flag (1).
 * - Archivi provinciali (da scaricare per provincia, testo con CRLF):
 *   XX-topo-com.dat  stradario, 176 byte: codice amm. (5) + toponimo "NOME, TIPO" (80) + codice catastale (4) + progressivo strada (7) + toponimo breve (80)
 *   Xx-tar.dat       tariffe, 20 byte: codice amm. (5) + zona (3) + categoria (3) + classe (2) + tariffa in lire (7)
 *   Xx-zon.dat       zone censuarie, 17 byte
 *   Nclxxv*.dat      prospetti per il classamento automatico
 */
import { decode1252 } from './bytes';
import type { Comune } from './model';
import { COMUNI_INCORPORATI, DATA_COMUNI_INCORPORATI } from './dati/comuni.generated';

export function leggiComuni(data: Uint8Array): Comune[] {
  const out: Comune[] = [];
  const s = decode1252(data);
  const re = /@F(.{5})(.{50})(.{4})(.{2})(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const codice = m[3].trim();
    if (!/^[A-Z]\d{3}$/.test(codice)) continue;
    out.push({ codiceAmministrativo: m[1].trim(), nome: m[2].trim(), codice, provincia: m[4].trim() });
  }
  return out;
}

export interface Strada {
  codiceAmministrativo: string;
  codiceCatastale: string;
  /** progressivo a 7 cifre (va nel record come codice catastale + progressivo) */
  progressivo: string;
  /** toponimo nella forma dell'archivio, es. "FIESOLANA, VIA" */
  toponimoArchivio: string;
  /** toponimo come lo scrive Docfa nei record, es. "via fiesolana" */
  toponimo: string;
}

/** "FIESOLANA, VIA" → "via fiesolana" (forma usata da Docfa nei record e nelle stampe). */
export function toponimoDocfa(archivio: string): string {
  const t = archivio.trim();
  const i = t.lastIndexOf(',');
  const nome = i >= 0 ? t.slice(0, i).trim() : t;
  const tipo = i >= 0 ? t.slice(i + 1).trim() : '';
  return `${tipo} ${nome}`.trim().toLowerCase();
}

export function leggiStradario(data: Uint8Array): Strada[] {
  const out: Strada[] = [];
  for (const riga of decode1252(data).split(/\r?\n/)) {
    if (riga.length < 96) continue;
    out.push({
      codiceAmministrativo: riga.slice(0, 5).trim(),
      toponimoArchivio: riga.slice(5, 85).trim(),
      codiceCatastale: riga.slice(85, 89),
      progressivo: riga.slice(89, 96),
      toponimo: toponimoDocfa(riga.slice(5, 85)),
    });
  }
  return out;
}

export interface Tariffa {
  codiceAmministrativo: string;
  zona: string;
  categoria: string;
  classe: string;
  /** tariffa unitaria in lire (come nell'archivio) */
  lire: number;
}

export const LIRE_PER_EURO = 1936.27;

export function leggiTariffe(data: Uint8Array): Tariffa[] {
  const out: Tariffa[] = [];
  for (const riga of decode1252(data).split(/\r?\n/)) {
    if (riga.length < 20) continue;
    out.push({ codiceAmministrativo: riga.slice(0, 5).trim(), zona: riga.slice(5, 8), categoria: riga.slice(8, 11), classe: riga.slice(11, 13), lire: Number(riga.slice(13, 20)) });
  }
  return out;
}

/** Rendita catastale in euro = consistenza × tariffa (lire) / 1936,27, arrotondata al centesimo (come Docfa). */
export function rendita(consistenza: number, tariffaLire: number): number {
  return Math.round((consistenza * tariffaLire) / LIRE_PER_EURO * 100) / 100;
}

/** Legge SETUP.DAT di Docfa (data + tecnico) per precompilare le impostazioni. */
export function leggiSetup(data: Uint8Array): { data: string; cognome: string; nome: string; codiceFiscale: string; albo: string; numeroIscrizione: string; provinciaAlbo: string } {
  const s = decode1252(data);
  return {
    data: s.slice(0, 8),
    cognome: s.slice(8, 32).trim(),
    nome: s.slice(32, 52).trim(),
    codiceFiscale: s.slice(52, 68).trim(),
    albo: s.slice(68, 70),
    numeroIscrizione: s.slice(70, 75).trim(),
    provinciaAlbo: s.slice(75, 77).trim(),
  };
}

// ---------------------------------------------------------------------------------------------
// Comuni incorporati e riconoscimento dei file degli archivi
// ---------------------------------------------------------------------------------------------


/** Elenco dei comuni incorporato nel programma (da Comuni.dat di Docfa 4.00.5). */
export function comuniIncorporati(): { comuni: Comune[]; data: string } {
  const comuni: Comune[] = COMUNI_INCORPORATI.split('\n').map((r) => {
    const [codice, nome, provincia, codiceAmministrativo] = r.split('|');
    return { codice, nome, provincia, codiceAmministrativo };
  });
  return { comuni, data: DATA_COMUNI_INCORPORATI };
}

export type TipoArchivio = 'comuni' | 'setup' | 'stradario' | 'tariffe' | 'zone' | 'classamento' | 'ignorato';

export interface ArchivioRiconosciuto {
  tipo: TipoArchivio;
  /** sigla della provincia (archivi provinciali) */
  provincia?: string;
  /** per i prospetti di classamento: parte (1..8, 8A) */
  parte?: string;
}

/**
 * Riconosce un file degli archivi Docfa dal nome. Nomi reali osservati (maiuscole/minuscole variabili):
 * FI-topo-com.dat, Fi-tar.dat, Fi-zon.dat, Nclfiv1.dat … NCLFIV8A.DAT, BO-ZON.DAT, Comuni.dat, SETUP.DAT.
 */
export function riconosciArchivio(nome: string): ArchivioRiconosciuto {
  const n = nome.trim();
  const l = n.toLowerCase();
  if (l === 'comuni.dat') return { tipo: 'comuni' };
  if (l === 'setup.dat') return { tipo: 'setup' };
  let m = /^([a-z]{2})-topo-com\.dat$/i.exec(n);
  if (m) return { tipo: 'stradario', provincia: m[1].toUpperCase() };
  m = /^([a-z]{2})-tar\.dat$/i.exec(n);
  if (m) return { tipo: 'tariffe', provincia: m[1].toUpperCase() };
  m = /^([a-z]{2})-zon\.dat$/i.exec(n);
  if (m) return { tipo: 'zone', provincia: m[1].toUpperCase() };
  m = /^ncl([a-z]{2})v(\d[a-z]?)\.dat$/i.exec(n);
  // NCLPRV*.DAT sono le copie "di lavoro" nella cartella CLASSA di Docfa: si ignorano
  if (m && m[1].toLowerCase() !== 'pr') return { tipo: 'classamento', provincia: m[1].toUpperCase(), parte: m[2].toUpperCase() };
  return { tipo: 'ignorato' };
}

export interface ZonaFoglio {
  codiceAmministrativo: string;
  sezione: string;
  foglio: string;
  /** codice a 5 caratteri associato al foglio (usato dal classamento automatico) */
  codice: string;
}

/** Xx-zon.dat: 17 byte = codice amministrativo (5) + sezione (3) + foglio (4) + codice (5). */
export function leggiZone(data: Uint8Array): ZonaFoglio[] {
  const out: ZonaFoglio[] = [];
  for (const riga of decode1252(data).split(/\r?\n/)) {
    if (riga.length < 17) continue;
    out.push({ codiceAmministrativo: riga.slice(0, 5).trim(), sezione: riga.slice(5, 8).trim(), foglio: riga.slice(8, 12), codice: riga.slice(12, 17) });
  }
  return out;
}

/** Numero di righe significative di un archivio testuale (per i prospetti di classamento). */
export function contaRighe(data: Uint8Array): number {
  return decode1252(data).split(/\r?\n/).filter((r) => r.trim().length > 0).length;
}
