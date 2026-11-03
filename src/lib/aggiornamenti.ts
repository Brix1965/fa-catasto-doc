/**
 * Avviso di nuova versione: all'avvio (e ogni 6 ore) l'app legge da GitHub l'ultima release pubblicata
 * («ultima versione», rigenerata a ogni rilascio) e la confronta con la propria build.
 * Nessun dato dell'utente viene inviato: è una semplice lettura pubblica (API di GitHub, senza credenziali).
 */
import { VERSIONE_APP } from './versione';
import { PROGETTO } from './progetto';

export interface NuovaVersione {
  versione: string;
  commit: string;
  /** data di pubblicazione (ISO) */
  data: string;
  /** «03/11/2026 10:20», ora italiana */
  quando: string;
  /** novità in testo semplice (righe), dalla nota della release */
  novita: string[];
  /** pagina della release da cui scaricare */
  url: string;
}

export interface ReleaseGitHub {
  name?: string;
  body?: string | null;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface BuildApp {
  versione: string;
  commit: string;
  /** data della build (ISO) */
  data: string;
}

const API = `https://api.github.com/repos/${PROGETTO.sorgenti.replace(/^https:\/\/github\.com\//, '')}/releases/latest`;

const dataRoma = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d).replace(',', '');
};

/**
 * Legge la release: la nota contiene il marcatore `<!-- fa-catasto-doc versione=0.4.1 commit=abc1234 -->`
 * (le release più vecchie solo «dal commit abc1234») e la sezione «## Novità».
 * Restituisce la nuova versione se è diversa dalla build in uso e pubblicata dopo; altrimenti null.
 */
export function confronta(r: ReleaseGitHub, app: BuildApp): NuovaVersione | null {
  if (!r || r.draft || r.prerelease || !app.commit) return null;
  const body = r.body ?? '';
  const m = /<!--\s*fa-catasto-doc\s+versione=([\w.-]+)\s+commit=([0-9a-f]{7,40})\s*-->/i.exec(body);
  const commit = (m?.[2] ?? /dal commit ([0-9a-f]{7,40})/i.exec(body)?.[1] ?? '').slice(0, 7);
  if (!commit || commit === app.commit.slice(0, 7)) return null;
  const data = r.published_at ?? '';
  // una build più recente della release (es. compilata in proprio) non deve vedere l'avviso
  if (app.data && data && new Date(data).getTime() <= new Date(app.data).getTime()) return null;
  const versione = m?.[1] ?? /\b(\d+\.\d+\.\d+)\b/.exec(r.name ?? '')?.[1] ?? '';
  const sez = /##\s*Novit[àa]\s*\n([\s\S]*?)(?:\n##\s|$)/i.exec(body)?.[1] ?? '';
  const novita = sez.split('\n').map((s) => s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean).slice(0, 12);
  return { versione, commit, data, quando: dataRoma(data), novita, url: r.html_url ?? `${PROGETTO.sorgenti}/releases/latest` };
}

/** Controlla su GitHub; in caso di errore (niente rete, limite di richieste) restituisce null senza disturbare. */
export async function controllaAggiornamento(leggi: typeof fetch = fetch): Promise<NuovaVersione | null> {
  if (!VERSIONE_APP.commit) return null;
  try {
    const risposta = await leggi(API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!risposta.ok) return null;
    return confronta((await risposta.json()) as ReleaseGitHub, { versione: VERSIONE_APP.versione, commit: VERSIONE_APP.commit, data: VERSIONE_APP.data });
  } catch {
    return null;
  }
}
