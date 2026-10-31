/**
 * Formato di salvataggio delle pratiche (*.catasto.json): la Pratica del motore più i metadati
 * dell'applicazione. I dati binari (TIFF/NTF importati) sono serializzati in base64.
 */
import type { Pratica, UnitaImmobiliare, Mod1NParteII, Mod1NParteI, Tecnico, Dichiarante, Ditta, Intestato, TipoDocumento } from '$lib/core/model';

export const ESTENSIONE_PRATICA = '.catasto.json';
export const FORMATO_FILE = 'fa-catasto-doc';
export const VERSIONE_FILE = 1;
/** nome del formato usato prima del cambio di nome (Catasto Semplice): ancora accettato in lettura */
const FORMATI_PRECEDENTI = ['catasto-semplice'];

export type StatoPratica = 'bozza' | 'esportata';

export interface MetaPratica {
  id: string;
  titolo: string;
  stato: StatoPratica;
  /** ISO 8601 */
  creata: string;
  modificata: string;
  ultimaEsportazione?: string;
  /** nome del PDF esportato (es. NCV002.PDF) */
  pdfEsportato?: string;
}

export interface FilePratica {
  formato: typeof FORMATO_FILE;
  versione: number;
  meta: MetaPratica;
  pratica: Pratica;
}

const CHIAVE_BYTES = '$bytes';

function base64Da(b: Uint8Array): string {
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) s += String.fromCharCode(...b.subarray(i, i + passo));
  return btoa(s);
}

function base64A(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Serializza il file pratica in JSON (Uint8Array → { "$bytes": base64 }). */
export function serializzaPratica(f: FilePratica): string {
  return JSON.stringify(f, (_chiave, valore: unknown) => (valore instanceof Uint8Array ? { [CHIAVE_BYTES]: base64Da(valore) } : valore), 2);
}

/** Legge il JSON di una pratica; solleva un errore se il formato non è riconosciuto. */
export function deserializzaPratica(testo: string): FilePratica {
  const f = JSON.parse(testo, (_chiave, valore: unknown) => {
    if (valore && typeof valore === 'object' && CHIAVE_BYTES in valore) {
      const b = (valore as Record<string, unknown>)[CHIAVE_BYTES];
      if (typeof b === 'string') return base64A(b);
    }
    return valore;
  }) as Partial<FilePratica>;
  const formatoValido = f.formato === FORMATO_FILE || FORMATI_PRECEDENTI.includes(String(f.formato));
  if (!formatoValido || !f.pratica || !f.meta) throw new Error('Il file non è una pratica di Fa.Catasto.Doc');
  if ((f.versione ?? 0) > VERSIONE_FILE) throw new Error(`Pratica salvata con una versione più recente del programma (formato ${f.versione})`);
  return { formato: FORMATO_FILE, versione: VERSIONE_FILE, meta: f.meta, pratica: normalizzaPratica(f.pratica) };
}

/**
 * Completa le pratiche salvate con versioni precedenti del programma, che non avevano alcuni campi: tipo di
 * documento, tipologia (senza scelta vale "Dichiarazione ordinaria", come in Docfa), causale di presentazione.
 */
export function normalizzaPratica(p: Pratica): Pratica {
  p.tipoDocumento ??= 'variazione';
  p.tipologia ??= 0;
  p.tipiVariazione ??= {};
  p.dataVariazione ??= { gg: 0, mm: 0, aaaa: 0 };
  if (p.tipoDocumento === 'variazione') p.presentazione ??= 'variazione';
  return p;
}

export function nuovoId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function tecnicoVuoto(): Tecnico {
  return { cognome: '', nome: '', codiceFiscale: '', albo: '03', numeroIscrizione: '', provinciaAlbo: '' };
}

export function dichiaranteVuoto(): Dichiarante {
  return { cognome: '', nome: '', comune: '', provincia: '', indirizzo: '', civico: '', cap: '', pec: '' };
}

export function nuovaDitta(): Ditta {
  return { intestazione: 'nuova', intestati: [], unitaOrdinarie: 0, unitaSpeciali: 0 };
}

export function nuovoIntestato(): Intestato {
  return { tipo: 'fisica', cognome: '', nome: '', titolo: '01 ', quotaNumeratore: '1', quotaDenominatore: 1 };
}

/** Nuova pratica vuota (accatastamento o variazione), con il tecnico delle impostazioni. */
export function nuovaPratica(tecnico: Tecnico, tipo: TipoDocumento = 'variazione', progressivo = 1): Pratica {
  const base: Pratica = {
    tipoDocumento: tipo,
    progressivo,
    tipologia: 0,
    comune: { codice: '', codiceAmministrativo: '', nome: '', provincia: '' },
    dataVariazione: { gg: 0, mm: 0, aaaa: 0 },
    causale: tipo === 'accatastamento' ? 'NC' : 'VAR',
    tipiVariazione: {},
    dichiarante: dichiaranteVuoto(),
    tecnico: { ...tecnico },
    unita: [],
  };
  if (tipo === 'accatastamento') base.quadroA = { ditte: [nuovaDitta()], causale: 'NC' };
  else base.presentazione = 'variazione';
  return base;
}

export function nuovoMod1NParteI(): Mod1NParteI {
  return { recordB: {}, recordC: {} };
}

export function nuovoMod1NParteII(): Mod1NParteII {
  return {
    vaniPrincipaliN: 0, vaniPrincipaliSup: 0, bagniN: 0, bagniSup: 0, accessoriDirettiN: 0, accessoriDirettiSup: 0,
    superficieLorda: 0, accessoriIndirettiN: 0, accessoriIndirettiSup: 0, balconiSup: 0, terrazziCopertiSup: 0, pertinenzeScoperteSup: 0,
    altezzaMediaCm: 0, supAltezzaInferiore230: 0, dotazioni: {}, pavimenti: {}, infissi: {}, destinazioneUso: '',
  };
}

export function nuovaUnita(operazione: UnitaImmobiliare['operazione'] = 'V'): UnitaImmobiliare {
  return {
    operazione,
    identificativo: { foglio: '', numero: '', subalterno: '' },
    graffati: [],
    indirizzo: { toponimo: '', civici: [], piani: [] },
    classamento: { zonaCensuaria: '', categoria: '', classe: '', consistenza: '', superficieCatastale: 0, rendita: 0, classamentoAutomatico: false },
    mod1NParteII: nuovoMod1NParteII(),
    ambienti: [],
    rifMod1NParteI: 1,
  };
}

/** Copia profonda che conserva gli Uint8Array (per duplicare le u.i.u.). */
export function clonaProfondo<T>(v: T): T {
  if (v instanceof Uint8Array) return v.slice() as T;
  if (Array.isArray(v)) return v.map((x) => clonaProfondo(x)) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = clonaProfondo(x);
    return out as T;
  }
  return v;
}

/** Titolo proposto per la pratica: comune + identificativo della prima u.i.u. */
export function titoloProposto(p: Pratica): string {
  const parti: string[] = [];
  if (p.comune.nome) parti.push(p.comune.nome);
  const u = p.unita[0];
  if (u?.identificativo.foglio) parti.push(`fg. ${u.identificativo.foglio} p.lla ${u.identificativo.numero}${u.identificativo.subalterno ? ` sub ${u.identificativo.subalterno}` : ''}`);
  if (!parti.length) parti.push(`Pratica ${p.progressivo}`);
  return parti.join(' – ');
}
