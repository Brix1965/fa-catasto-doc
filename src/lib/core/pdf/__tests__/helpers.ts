/**
 * Supporto ai test del generatore PDF: strumenti Python (pikepdf, pypdfium2) e poppler usati tramite
 * tools/pdf_test_utils.py, caricamento dei documenti di prova in fixtures-private.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decompilaDocumento } from '../../decompile';
import { compilaDocumento, type Compilato } from '../../compile';
import type { Pratica } from '../../model';
import type { ImmagineDocumento } from '../documento';

export const ROOT = process.cwd();
export const FIXTURES = join(ROOT, 'fixtures-private');
export const UTILS = join(ROOT, 'tools', 'pdf_test_utils.py');

export function python(...args: string[]): string {
  return execFileSync('python3', [UTILS, ...args], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

export function pythonJson<T>(...args: string[]): T {
  return JSON.parse(python(...args)) as T;
}

export function strumentoDisponibile(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface Caso {
  nome: string;
  dir: string;
  pdfOriginale: string;
  pratica: Pratica;
  compilato: Compilato;
}

export function casoDisponibile(nome: string): boolean {
  return existsSync(join(FIXTURES, `${nome}.PDF`)) && existsSync(join(FIXTURES, nome, `${nome}.DAT`));
}

/** Decompila i file dati del documento e li ricompila (come farà l'applicazione con una pratica propria). */
export function caricaCaso(nome: string): Caso {
  const dir = join(FIXTURES, nome);
  const n = nome.slice(3);
  const rd = (f: string) => new Uint8Array(readFileSync(join(dir, f)));
  const epv = join(dir, `EPV${n}.DAT`);
  const { pratica } = decompilaDocumento(rd(`${nome}.DAT`), rd(`NMV${n}.DAT`), rd(`${nome}.ATT`), existsSync(epv) ? rd(`EPV${n}.DAT`) : undefined);
  // i file dati non contengono il nome del comune né la provincia: li impostiamo come nel documento originale
  pratica.comune.nome = 'FIRENZE';
  pratica.comune.provincia = 'FI';
  return { nome, dir, pdfOriginale: join(FIXTURES, `${nome}.PDF`), pratica, compilato: compilaDocumento(pratica) };
}

/** Estrae lo stream G4 grezzo dell'immagine di una pagina del PDF originale. */
export function immagineDaPdf(pdf: string, pagina: number, tmpDir: string, nome: string, ntf?: { dati: Uint8Array; nome: string }, formato: 'A4' | 'A3' = 'A4'): ImmagineDocumento {
  mkdirSync(tmpDir, { recursive: true });
  const out = join(tmpDir, `${nome}.g4`);
  const info = pythonJson<{ width: number; height: number }>('estrai-g4', pdf, String(pagina), out);
  return { nome, g4: new Uint8Array(readFileSync(out)), width: info.width, height: info.height, ntf: ntf?.dati, nomeNtf: ntf?.nome, formato };
}

/** Normalizza l'output di `pdftotext -layout` per il confronto: spazi compressi, righe vuote e piè di pagina esclusi. */
export function normalizzaTesto(testo: string): string[] {
  return testo
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter((r) => r.length > 0)
    .filter((r) => !/\d\d\/\d\d\/\d\d:\d\d\.\d\d\.\d\d/.test(r) && !/\bpag\. +\d+ di +\d+/.test(r) && !/Docfa - ver\.|Fa.Catasto.Doc - ver\./.test(r));
}

export function pdftotext(pdf: string, pagina: number): string {
  return execFileSync('pdftotext', ['-f', String(pagina), '-l', String(pagina), '-layout', pdf, '-'], { encoding: 'utf-8' });
}
