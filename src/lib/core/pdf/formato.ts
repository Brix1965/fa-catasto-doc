/**
 * Formattazione dei valori come li stampa Docfa: numeri senza zeri iniziali allineati a destra in un
 * campo di larghezza fissa (riempito con spazi), separatore delle migliaia "." e decimali ",".
 */

/** Allinea a destra su `len` caratteri (non tronca). */
export function aDestra(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

/** Intero da campo numerico grezzo (es. "00013" → "13"); zero → stringa vuota. */
export function intero(raw: string | number): string {
  const v = typeof raw === 'number' ? Math.round(raw) : Number(raw.trim() || '0');
  if (!Number.isFinite(v) || v === 0) return '';
  return String(v);
}

/** Intero con separatore delle migliaia (4935 → "4.935"); zero → vuoto. */
export function migliaia(v: number): string {
  if (!v) return '';
  const neg = v < 0;
  const s = String(Math.abs(Math.round(v)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return (neg ? '-' : '') + out;
}

/** Numero con `decimali` cifre decimali, separatore migliaia e virgola (centesimi 73208 → "732,08"). */
export function decimali(valoreScalato: number, nDecimali: number): string {
  if (!valoreScalato) return '';
  const fattore = Math.pow(10, nDecimali);
  const intPart = Math.floor(Math.abs(valoreScalato) / fattore);
  const dec = Math.abs(valoreScalato) % fattore;
  return (valoreScalato < 0 ? '-' : '') + (migliaia(intPart) || '0') + ',' + String(dec).padStart(nDecimali, '0');
}

/** Data gg/mm/aaaa. */
export function dataEstesa(gg: number, mm: number, aaaa: number): string {
  return `${String(gg).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${String(aaaa).padStart(4, '0')}`;
}

/**
 * Spezza un testo in righe di al più `larghezza` caratteri, andando a capo fra le parole; una parola
 * più lunga della riga viene spezzata all'ultimo trattino (che viene consumato, come fa Docfa negli
 * elenchi di subalterni "503-504-...") o, in mancanza, al limite della riga.
 */
export function aCapo(testo: string, larghezza: number): string[] {
  const righe: string[] = [];
  for (const paragrafo of testo.split(/\r?\n/)) {
    const parole = paragrafo.split(/\s+/).filter((p) => p.length > 0);
    let riga = '';
    for (let parola of parole) {
      while (parola.length > larghezza) {
        if (riga) {
          righe.push(riga);
          riga = '';
        }
        const taglio = parola.lastIndexOf('-', larghezza);
        if (taglio > 0) {
          righe.push(parola.slice(0, taglio));
          parola = parola.slice(taglio + 1);
        } else {
          righe.push(parola.slice(0, larghezza));
          parola = parola.slice(larghezza);
        }
      }
      if (!riga) riga = parola;
      else if (riga.length + 1 + parola.length <= larghezza) riga += ' ' + parola;
      else {
        righe.push(riga);
        riga = parola;
      }
    }
    if (riga || !parole.length) righe.push(riga);
  }
  while (righe.length && righe[righe.length - 1] === '') righe.pop();
  return righe;
}
