/**
 * Codice di riscontro: il codice alfanumerico di 9 caratteri stampato in basso a sinistra di ogni pagina.
 *
 * Docfa lo calcola nel sottoprogramma NZSB321N (libreria NCU000.lbr) e l'ufficio lo ricalcola in
 * registrazione per verificare che la stampa corrisponda ai file. Algoritmo (ricostruito dal codice e
 * verificato sui documenti presentati):
 *  1. si sommano i codici dei byte dei primi 250 caratteri di ogni record del file documento (NCVnnn.DAT o
 *     NCAnnn.DAT, record da 350) e poi del file dei dati metrici (NMVnnn.DAT / NMAnnn.DAT, record da 313);
 *  2. la somma si scrive in 9 cifre decimali (le ultime 9, con zeri a sinistra);
 *  3. le cifre dispari si sostituiscono con una lettera della tabella "AP1N33GA5E77LX9": nelle prime
 *     5 posizioni 1→A, 3→N, 5→G, 7→E, 9→L; dalla sesta 1→P, 3→3, 5→A, 7→7, 9→X. Le cifre pari restano.
 */

const LUNGHEZZA_SOMMATA = 250;

/** coppie (cifra, carattere nelle posizioni 1-5, carattere nelle posizioni 6-9) */
const TABELLA: Record<string, [string, string]> = {
  '1': ['A', 'P'],
  '3': ['N', '3'],
  '5': ['G', 'A'],
  '7': ['E', '7'],
  '9': ['L', 'X'],
};

/** Somma dei byte dei primi 250 caratteri di ogni record (record separati da CR LF). */
export function sommaRiscontro(file: Uint8Array): number {
  let somma = 0;
  let inizio = 0;
  const n = file.length;
  while (inizio < n) {
    let fine = inizio;
    while (fine < n && !(file[fine] === 0x0d && file[fine + 1] === 0x0a)) fine++;
    const lim = Math.min(fine, inizio + LUNGHEZZA_SOMMATA);
    for (let i = inizio; i < lim; i++) somma += file[i];
    inizio = fine + 2;
  }
  return somma;
}

/** Codifica della somma nel codice di 9 caratteri. */
export function codificaRiscontro(somma: number): string {
  const cifre = String(somma % 1_000_000_000).padStart(9, '0');
  let out = '';
  for (let i = 0; i < 9; i++) {
    const t = TABELLA[cifre[i]];
    out += t ? t[i < 5 ? 0 : 1] : cifre[i];
  }
  return out;
}

/** Codice di riscontro del documento, dal file documento e dal file dei dati metrici (se c'è). */
export function codiceRiscontro(documento: Uint8Array, datiMetrici?: Uint8Array): string {
  return codificaRiscontro(sommaRiscontro(documento) + (datiMetrici ? sommaRiscontro(datiMetrici) : 0));
}
