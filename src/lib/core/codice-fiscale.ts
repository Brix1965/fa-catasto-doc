/** Calcolo del codice fiscale delle persone fisiche (DM 23/12/1976), come il tasto "Calcola" di Docfa. */
const VOCALI = 'AEIOU';
const MESI = 'ABCDEHLMPRST';
const DISPARI: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function pulisci(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}
function consonanti(s: string): string { return [...s].filter((c) => !VOCALI.includes(c)).join(''); }
function vocali(s: string): string { return [...s].filter((c) => VOCALI.includes(c)).join(''); }

function parteCognome(cognome: string): string {
  const s = pulisci(cognome);
  return (consonanti(s) + vocali(s) + 'XXX').slice(0, 3);
}
function parteNome(nome: string): string {
  const s = pulisci(nome);
  const c = consonanti(s);
  if (c.length >= 4) return c[0] + c[2] + c[3];
  return (c + vocali(s) + 'XXX').slice(0, 3);
}

export function carattereControllo(primi15: string): string {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const ch = primi15[i];
    if (i % 2 === 0) somma += DISPARI[ch];
    else somma += /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (somma % 26));
}

export function calcolaCodiceFiscale(cognome: string, nome: string, sesso: 'M' | 'F', nascita: { gg: number; mm: number; aaaa: number }, codiceComune: string): string {
  const anno = String(nascita.aaaa % 100).padStart(2, '0');
  const giorno = String(nascita.gg + (sesso === 'F' ? 40 : 0)).padStart(2, '0');
  const base = parteCognome(cognome) + parteNome(nome) + anno + MESI[nascita.mm - 1] + giorno + codiceComune.toUpperCase();
  return base + carattereControllo(base);
}
