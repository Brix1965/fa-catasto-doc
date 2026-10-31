/**
 * Astrazione della piattaforma: file system, finestre di dialogo e apertura dei file.
 *
 * Dentro Tauri (window.__TAURI_INTERNALS__ presente) usa i plugin dialog, fs e opener.
 * Nel browser (pnpm dev) ricade su:
 *   - File System Access API per le cartelle scelte dall'utente (percorsi "fsa://<nome>/...");
 *   - IndexedDB per la "cartella dati dell'app" (percorsi "appdata://...");
 *   - <input type="file"> per la scelta di singoli file (percorsi "file://<nome>", contenuto in memoria);
 *   - download del file quando non c'è altro modo di scriverlo.
 */

export interface VoceCartella {
  nome: string;
  percorso: string;
  cartella: boolean;
}

export interface FiltroFile {
  nome: string;
  estensioni: string[];
}

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Unisce un percorso e un nome di file con il separatore giusto per la piattaforma. */
export function unisci(cartella: string, ...parti: string[]): string {
  const sep = cartella.includes('\\') && !cartella.includes('/') ? '\\' : '/';
  let out = cartella.replace(/[\\/]+$/, '');
  for (const p of parti) out += sep + p.replace(/^[\\/]+/, '');
  return out;
}

export function nomeFile(percorso: string): string {
  const m = /[^\\/]+$/.exec(percorso);
  return m ? m[0] : percorso;
}

export function cartellaDi(percorso: string): string {
  return percorso.replace(/[\\/][^\\/]*$/, '');
}

// ---------------------------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------------------------

export async function scegliCartella(titolo?: string): Promise<string | null> {
  if (inTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const r = await open({ directory: true, multiple: false, title: titolo });
    return typeof r === 'string' ? r : null;
  }
  return browserScegliCartella();
}

export async function scegliFile(titolo?: string, filtri?: FiltroFile[]): Promise<string | null> {
  if (inTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const r = await open({ directory: false, multiple: false, title: titolo, filters: filtri?.map((f) => ({ name: f.nome, extensions: f.estensioni })) });
    return typeof r === 'string' ? r : null;
  }
  return browserScegliFile(filtri);
}

export async function leggiFile(percorso: string): Promise<Uint8Array> {
  if (inTauri()) {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return readFile(percorso);
  }
  return browserLeggi(percorso);
}

export async function leggiTesto(percorso: string): Promise<string> {
  return new TextDecoder('utf-8').decode(await leggiFile(percorso));
}

export async function scriviFile(percorso: string, dati: Uint8Array | string): Promise<void> {
  const bytes = typeof dati === 'string' ? new TextEncoder().encode(dati) : dati;
  if (inTauri()) {
    const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const dir = cartellaDi(percorso);
    if (dir && dir !== percorso && !(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeFile(percorso, bytes);
    return;
  }
  await browserScrivi(percorso, bytes);
}

export async function esisteFile(percorso: string): Promise<boolean> {
  if (inTauri()) {
    const { exists } = await import('@tauri-apps/plugin-fs');
    return exists(percorso);
  }
  return browserEsiste(percorso);
}

export async function creaCartella(percorso: string): Promise<void> {
  if (inTauri()) {
    const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(percorso))) await mkdir(percorso, { recursive: true });
    return;
  }
  await browserCreaCartella(percorso);
}

export async function elencoFile(cartella: string): Promise<VoceCartella[]> {
  if (inTauri()) {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const voci = await readDir(cartella);
    return voci.map((v) => ({ nome: v.name, percorso: unisci(cartella, v.name), cartella: v.isDirectory })).sort((a, b) => a.nome.localeCompare(b.nome));
  }
  return browserElenco(cartella);
}

export async function eliminaFile(percorso: string): Promise<void> {
  if (inTauri()) {
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(percorso, { recursive: true });
    return;
  }
  await browserElimina(percorso);
}

/** Apre un file con il programma di sistema (nel browser: nuova scheda con il contenuto). */
export async function apriFile(percorso: string): Promise<void> {
  if (inTauri()) {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(percorso);
    return;
  }
  const dati = await browserLeggi(percorso);
  const tipo = /\.pdf$/i.test(percorso) ? 'application/pdf' : 'application/octet-stream';
  const copia = new Uint8Array(new ArrayBuffer(dati.length));
  copia.set(dati);
  const url = URL.createObjectURL(new Blob([copia], { type: tipo }));
  window.open(url, '_blank');
}

/** Apre un indirizzo web nel browser predefinito. */
export async function apriUrl(url: string): Promise<void> {
  if (inTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/** Richiesta di conferma (Sì/No): finestra nativa in Tauri, confirm() nel browser. */
export async function conferma(messaggio: string, titolo = 'Fa.Catasto.Doc'): Promise<boolean> {
  if (inTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(messaggio, { title: titolo, kind: 'warning', okLabel: 'Sì', cancelLabel: 'No' });
  }
  return confirm(messaggio);
}

/**
 * Le versioni precedenti usavano un altro identificativo dell'applicazione (sempre terminante in
 * ".facatastodoc"): alla prima apertura la loro cartella dati viene rinominata in quella nuova.
 */
async function migraCartellaDati(nuova: string): Promise<void> {
  try {
    const { exists, readDir, rename } = await import('@tauri-apps/plugin-fs');
    if (await exists(nuova)) return;
    const m = nuova.match(/^(.*)[\\/]([^\\/]+)$/);
    if (!m) return;
    const [, padre] = m;
    const sep = nuova.includes('\\') ? '\\' : '/';
    for (const e of await readDir(padre)) {
      if (!e.isDirectory || !e.name.endsWith('.facatastodoc')) continue;
      const vecchia = padre + sep + e.name;
      if (await exists(vecchia + sep + 'impostazioni.json')) { await rename(vecchia, nuova); return; }
    }
  } catch {
    /* migrazione facoltativa: in caso di errore si riparte con impostazioni nuove */
  }
}

/** Cartella dati dell'applicazione (impostazioni e archivi). */
export async function appDataDir(): Promise<string> {
  if (inTauri()) {
    const { appDataDir: dir } = await import('@tauri-apps/api/path');
    const d = (await dir()).replace(/[\\/]+$/, '');
    await migraCartellaDati(d);
    await creaCartella(d);
    return d;
  }
  return 'appdata://app';
}

// ---------------------------------------------------------------------------------------------
// Fallback browser
// ---------------------------------------------------------------------------------------------

/** Sottoinsieme della File System Access API (non ancora in lib.dom di TypeScript). */
interface HandleFile {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(d: Uint8Array): Promise<void>; close(): Promise<void> }>;
}
interface HandleCartella {
  kind: 'directory';
  name: string;
  getFileHandle(nome: string, opt?: { create?: boolean }): Promise<HandleFile>;
  getDirectoryHandle(nome: string, opt?: { create?: boolean }): Promise<HandleCartella>;
  removeEntry(nome: string, opt?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterable<HandleFile | HandleCartella>;
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<string>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<string>;
}
type FinestraFsa = Window & {
  showDirectoryPicker?: (o?: { mode?: 'read' | 'readwrite' }) => Promise<HandleCartella>;
};

const PREFISSO_FSA = 'fsa://';
const PREFISSO_APP = 'appdata://';
const PREFISSO_FILE = 'file://';

/** cartelle scelte dall'utente, per nome */
const cartelleFsa = new Map<string, HandleCartella>();
/** file scelti con <input type="file">, in memoria */
const fileInMemoria = new Map<string, Uint8Array>();

async function browserScegliCartella(): Promise<string | null> {
  const w = window as FinestraFsa;
  if (!w.showDirectoryPicker) {
    alert('Questo browser non supporta la scelta di una cartella (File System Access API). Usa Chrome/Edge oppure l\'app Tauri.');
    return null;
  }
  try {
    const h = await w.showDirectoryPicker({ mode: 'readwrite' });
    cartelleFsa.set(h.name, h);
    await salvaHandle(h.name, h);
    return PREFISSO_FSA + h.name;
  } catch {
    return null;
  }
}

function browserScegliFile(filtri?: FiltroFile[]): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (filtri?.length) input.accept = filtri.flatMap((f) => f.estensioni.map((e) => `.${e}`)).join(',');
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      fileInMemoria.set(f.name, new Uint8Array(await f.arrayBuffer()));
      resolve(PREFISSO_FILE + f.name);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Risolve un percorso "fsa://cartella/sotto/file" nell'handle della cartella e nel nome finale. */
async function risolviFsa(percorso: string, crea: boolean): Promise<{ dir: HandleCartella; nome: string } | null> {
  const parti = percorso.slice(PREFISSO_FSA.length).split('/').filter(Boolean);
  const radice = parti.shift();
  if (!radice) return null;
  let dir = cartelleFsa.get(radice) ?? (await caricaHandle(radice));
  if (!dir) return null;
  const nome = parti.pop() ?? '';
  for (const p of parti) dir = await dir.getDirectoryHandle(p, { create: crea });
  return { dir, nome };
}

async function browserLeggi(percorso: string): Promise<Uint8Array> {
  if (percorso.startsWith(PREFISSO_FILE)) {
    const d = fileInMemoria.get(percorso.slice(PREFISSO_FILE.length));
    if (!d) throw new Error(`File non più disponibile: ${percorso}`);
    return d;
  }
  if (percorso.startsWith(PREFISSO_APP)) {
    const d = await idbGet(percorso);
    if (!d) throw new Error(`File non trovato: ${percorso}`);
    return d;
  }
  const r = await risolviFsa(percorso, false);
  if (!r) throw new Error(`Cartella non disponibile: ${percorso}`);
  const h = await r.dir.getFileHandle(r.nome);
  return new Uint8Array(await (await h.getFile()).arrayBuffer());
}

async function browserScrivi(percorso: string, dati: Uint8Array): Promise<void> {
  if (percorso.startsWith(PREFISSO_APP)) return idbSet(percorso, dati);
  if (percorso.startsWith(PREFISSO_FSA)) {
    const r = await risolviFsa(percorso, true);
    if (r) {
      const h = await r.dir.getFileHandle(r.nome, { create: true });
      const w = await h.createWritable();
      await w.write(dati);
      await w.close();
      return;
    }
  }
  // ultima risorsa: download
  const copia = new Uint8Array(new ArrayBuffer(dati.length));
  copia.set(dati);
  const url = URL.createObjectURL(new Blob([copia]));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile(percorso);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function browserEsiste(percorso: string): Promise<boolean> {
  try {
    if (percorso.startsWith(PREFISSO_APP)) return (await idbGet(percorso)) !== undefined || (await idbElenco(percorso + '/')).length > 0;
    if (percorso.startsWith(PREFISSO_FILE)) return fileInMemoria.has(percorso.slice(PREFISSO_FILE.length));
    const r = await risolviFsa(percorso, false);
    if (!r) return false;
    if (!r.nome) return true;
    try { await r.dir.getFileHandle(r.nome); return true; } catch { /* non è un file */ }
    try { await r.dir.getDirectoryHandle(r.nome); return true; } catch { return false; }
  } catch {
    return false;
  }
}

async function browserCreaCartella(percorso: string): Promise<void> {
  if (!percorso.startsWith(PREFISSO_FSA)) return;
  const r = await risolviFsa(percorso, true);
  if (r?.nome) await r.dir.getDirectoryHandle(r.nome, { create: true });
}

async function browserElenco(cartella: string): Promise<VoceCartella[]> {
  if (cartella.startsWith(PREFISSO_APP)) {
    const base = cartella.replace(/\/+$/, '') + '/';
    const chiavi = await idbElenco(base);
    const viste = new Set<string>();
    const out: VoceCartella[] = [];
    for (const k of chiavi) {
      const resto = k.slice(base.length);
      const primo = resto.split('/')[0];
      if (viste.has(primo)) continue;
      viste.add(primo);
      out.push({ nome: primo, percorso: base + primo, cartella: resto.includes('/') });
    }
    return out;
  }
  const r = await risolviFsa(cartella.replace(/\/+$/, ''), false);
  if (!r) return [];
  // l'ultimo componente del percorso è la cartella da elencare (risolviFsa lo restituisce come "nome")
  const dir = r.nome ? await r.dir.getDirectoryHandle(r.nome) : r.dir;
  const out: VoceCartella[] = [];
  for await (const h of dir.values()) out.push({ nome: h.name, percorso: unisci(cartella, h.name), cartella: h.kind === 'directory' });
  return out.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function browserElimina(percorso: string): Promise<void> {
  if (percorso.startsWith(PREFISSO_APP)) {
    for (const k of [percorso, ...(await idbElenco(percorso + '/'))]) await idbDel(k);
    return;
  }
  const r = await risolviFsa(percorso, false);
  if (r?.nome) await r.dir.removeEntry(r.nome, { recursive: true });
}

// --- IndexedDB: cartella dati dell'app e handle delle cartelle scelte

const DB_NOME = 'fa-catasto-doc';

function apriDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('file')) db.createObjectStore('file');
      if (!db.objectStoreNames.contains('handle')) db.createObjectStore('handle');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function richiesta<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbGet(chiave: string): Promise<Uint8Array | undefined> {
  const db = await apriDb();
  const v = await richiesta(db.transaction('file').objectStore('file').get(chiave));
  db.close();
  return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : undefined;
}

async function idbSet(chiave: string, dati: Uint8Array): Promise<void> {
  const db = await apriDb();
  await richiesta(db.transaction('file', 'readwrite').objectStore('file').put(dati, chiave));
  db.close();
}

async function idbDel(chiave: string): Promise<void> {
  const db = await apriDb();
  await richiesta(db.transaction('file', 'readwrite').objectStore('file').delete(chiave));
  db.close();
}

async function idbElenco(prefisso: string): Promise<string[]> {
  const db = await apriDb();
  const chiavi = await richiesta(db.transaction('file').objectStore('file').getAllKeys(IDBKeyRange.bound(prefisso, prefisso + '￿')));
  db.close();
  return chiavi.map(String);
}

async function salvaHandle(nome: string, h: HandleCartella): Promise<void> {
  try {
    const db = await apriDb();
    await richiesta(db.transaction('handle', 'readwrite').objectStore('handle').put(h, nome));
    db.close();
  } catch { /* gli handle non sono sempre serializzabili */ }
}

async function caricaHandle(nome: string): Promise<HandleCartella | undefined> {
  try {
    const db = await apriDb();
    const h = (await richiesta(db.transaction('handle').objectStore('handle').get(nome))) as HandleCartella | undefined;
    db.close();
    if (!h) return undefined;
    if (h.requestPermission && (await h.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') return undefined;
    }
    cartelleFsa.set(nome, h);
    return h;
  } catch {
    return undefined;
  }
}
