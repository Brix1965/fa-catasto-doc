/**
 * NZCT06 di Docfa 4: dopo il classamento calcola le rendite e riporta i risultati nel record 3 del documento.
 *
 * Per ogni record NCLAS1 (in ordine) legge il record del documento con la stessa chiave (16 caratteri);
 * se manca si ferma con errore '4'. Categorie D ed E: il record resta com'è. Altrimenti:
 *   doc[179:189] = rendita proposta (centesimi, 10 cifre)
 *   doc[189:219] = zona, categoria, classe, consistenza, superficie, rendita automatiche (NCLAS1 0x93-0xb0)
 *   doc[272:334] = esito (2) + messaggio (60)
 * Rendita: tariffa in lire da TARIFFE (comune5+zona3+cat3+classe2) convertita in euro con 5 decimali (NZUU08);
 * gruppo A: (vani×10 × euro5 + 5000) / 10^4, altrimenti (consistenza × euro5 + 500) / 10^3 (centesimi).
 */
import { nv, lireInEuro5 } from './comune';

export const ESITI: Record<string, string> = {
  '00': ' Classamento automatico eseguito',
  '01': ' Categoria scartata da prospetto V3',
  '02': ' Categoria/classe non presente nel comune',
  '03': ' Classe ordinaria non indicata',
  '04': ' Uiu non classabile automaticamente',
  '05': ' Uiu di categoria speciale',
  '06': ' Dati della uiu in atti non disponibili',
};

function tariffaEuro5(tariffe: string[], chiave: string): number | null {
  for (const t of tariffe) if (t.slice(0, 13) === chiave) return lireInEuro5(nv(t.slice(13, 20)));
  return null;
}

/** cons: 7 caratteri come in NCLAS1 (es. '    4,5', '   1237'); restituisce 10 cifre */
export function renditaNclas(tariffe: string[], comune: string, zona: string, cat: string, classe: string, cons: string, gruppoA: boolean): string {
  const c = cons.split('');
  for (let i = 0; i < 7; i++) { if (c[i] !== ' ') break; c[i] = '0'; } // solo gli spazi iniziali diventano zeri
  const cs = c.join('');
  const cons6 = cs[5] === ',' ? nv(cs.slice(0, 5) + cs[6]) % 1e6 : nv(cs.slice(2, 7) + '0');
  const eu = tariffaEuro5(tariffe, comune + zona + cat + classe);
  if (eu === null) return '0'.repeat(10);
  const r = gruppoA
    ? (BigInt(cons6) * BigInt(eu) + 5000n) / 10000n
    : (BigInt(nv(cs)) * BigInt(eu) + 500n) / 1000n;
  return (r % 10000000000n).toString().padStart(10, '0');
}

function calcolaRendite(rec: string, tariffe: string[]): string {
  const r = rec.split('');
  const R = (a: number, b: number) => r.slice(a, b).join('');
  const put = (a: number, s: string) => { for (let i = 0; i < s.length; i++) r[a + i] = s[i]; };
  const gruppoA = r[0x78] === 'A';
  put(0xa7, '0'.repeat(10));
  if (R(0x9b, 0xa2) !== ' '.repeat(7)) put(0xa7, renditaNclas(tariffe, R(0x19, 0x1e), R(0x93, 0x96), R(0x96, 0x99), R(0x99, 0x9b), R(0x9b, 0xa2), gruppoA));
  put(0x89, '0'.repeat(10));
  if (!(r[0x78] === ' ' || R(0x79, 0x7b) === '00' || R(0x7b, 0x7d) === '  ' || R(0x7d, 0x84) === ' '.repeat(7))) {
    put(0x89, renditaNclas(tariffe, R(0x19, 0x1e), R(0x75, 0x78), R(0x78, 0x7b), R(0x7b, 0x7d), R(0x7d, 0x84), gruppoA));
  }
  return r.join('');
}

/** Restituisce il documento aggiornato, i record NCLAS1 con le rendite calcolate e l'eventuale errore ('4'). */
export function nzct06(nclas: string[], doc: string[], tariffe: string[]): { doc: string[]; nclas: string[]; errore: string | null } {
  const out = [...doc];
  const indice = new Map<string, number>();
  for (let i = out.length - 1; i >= 0; i--) indice.set(out[i].slice(0, 16), i);
  const usciti: string[] = [];
  let msgPrec = ' '.repeat(60); // l'area del messaggio resta quella precedente se l'esito non è 00..06
  for (let rec of nclas) {
    const i = indice.get(rec.slice(0, 16));
    if (i === undefined) return { doc: out, nclas: usciti, errore: '4' };
    if ('DE'.includes(rec[0x78])) { usciti.push(rec); continue; }
    rec = calcolaRendite(rec, tariffe);
    usciti.push(rec);
    const d = out[i].padEnd(334, ' ').split('');
    const es = rec.slice(0xb4, 0xb6);
    if (es in ESITI) msgPrec = ESITI[es].padEnd(60, ' ');
    const put = (a: number, s: string) => { for (let k = 0; k < s.length; k++) d[a + k] = s[k]; };
    put(179, rec.slice(0x89, 0x93));
    put(189, rec.slice(0x93, 0xb1));
    put(272, es + msgPrec);
    const nuovo = d.join('');
    out[i] = out[i].length >= 334 ? nuovo.slice(0, out[i].length) : nuovo;
  }
  return { doc: out, nclas: usciti, errore: null };
}
