/**
 * Superfici ricavate dai poligoni della planimetria, con le stesse regole osservate nei file di Docfa:
 *
 * - dati metrici (NMV): un ambiente per ogni coppia (tipo, altezza valida/non valida), nell'ordine in cui
 *   compare il primo poligono di quel gruppo; superficie = somma delle aree arrotondata al m²;
 *   altezza minima 150 (valida) o 149 (< 1,50 m) per A, A2 (H), B, C; 0 per D, E, F, G.
 *   Verificato su NCV002, NCV059 (due poligoni A sommati: 101,60 + 120,89 = 222) e NCV065 (B valido e B < 1,50 m separati).
 * - modello 1N parte II (gruppi A/B): le superfici LORDE vengono dai poligoni
 *   (vani principali e accessori diretti = A; accessori indiretti = B + C; balconi = D + E; pertinenze scoperte = F),
 *   quelle utili e il numero dei vani si inseriscono a mano.
 */
import type { Ambiente, Poligono, TipoAmbientePoligono, UnitaImmobiliare } from './model';
import { poligoniPlanimetria } from './model';
import { tipologiaMetrica } from './compile';

/** Area di un poligono in m² (coordinate in metri, formula di Gauss). */
export function areaPoligono(p: Pick<Poligono, 'vertici'>): number {
  const v = p.vertici;
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const [x1, y1] = v[i];
    const [x2, y2] = v[(i + 1) % v.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Tipi per cui conta l'altezza (≥ 1,50 m valida, altrimenti 149). */
export function haAltezza(tipo: TipoAmbientePoligono): boolean {
  return tipo === 'A' || tipo === 'B' || tipo === 'C' || tipo === 'H';
}

/** Ambienti dei dati metrici ricavati dai poligoni (vedi regole in testa al file). */
export function ambientiDaPoligoni(poligoni: Poligono[]): Ambiente[] {
  const gruppi: { tipo: TipoAmbientePoligono; valida: boolean; area: number }[] = [];
  for (const p of poligoni) {
    const valida = !haAltezza(p.tipo) || p.altezzaValida;
    let g = gruppi.find((x) => x.tipo === p.tipo && x.valida === valida);
    if (!g) { g = { tipo: p.tipo, valida, area: 0 }; gruppi.push(g); }
    g.area += areaPoligono(p);
  }
  return gruppi.map((g) => ({
    tipo: g.tipo,
    superficie: Math.round(g.area),
    altezzaMin: haAltezza(g.tipo) ? (g.valida ? 150 : 149) : 0,
    altezzaMax: 0,
  }));
}

export interface SuperficiLorde {
  /** vani principali e accessori diretti (A) */
  principali: number;
  /** accessori diretti delle categorie C/1 e C/6 (A2, lettera H) */
  accessoriDirettiA2: number;
  /** accessori indiretti (B + C) */
  accessoriIndiretti: number;
  /** balconi e terrazzi (D + E) */
  balconi: number;
  /** aree scoperte di pertinenza (F) */
  pertinenze: number;
}

/** Superfici lorde (m², arrotondate) per il modello 1N parte II. */
export function superficiLorde(poligoni: Poligono[]): SuperficiLorde {
  const somma = (...tipi: TipoAmbientePoligono[]) => Math.round(poligoni.filter((p) => tipi.includes(p.tipo)).reduce((s, p) => s + areaPoligono(p), 0));
  return { principali: somma('A'), accessoriDirettiA2: somma('H'), accessoriIndiretti: somma('B', 'C'), balconi: somma('D', 'E'), pertinenze: somma('F') };
}

/** Le superfici lorde del 1N parte II sono automatiche se la planimetria ha i poligoni. */
export function lordeAutomatiche(poligoni: Poligono[] | undefined): boolean {
  return !!poligoni && poligoni.length > 0;
}

/**
 * Allinea i dati metrici e le superfici lorde del 1N parte II ai poligoni della planimetria.
 * Non fa nulla se la planimetria non ha poligoni (es. documento importato con solo il file NTF).
 * Restituisce true se qualcosa è cambiato.
 */
export function sincronizzaDaPoligoni(u: UnitaImmobiliare): boolean {
  const pol = poligoniPlanimetria(u.planimetria);
  if (!pol.length) return false;
  let cambiato = false;
  const amb = ambientiDaPoligoni(pol);
  if (JSON.stringify(amb) !== JSON.stringify(u.ambienti)) { u.ambienti = amb; cambiato = true; }
  // superficie catastale: compilata in automatico dai poligoni (categorie ordinarie)
  const cat = u.classamento?.categoria ?? '';
  if (u.classamento && /^[ABC]\d\d$/.test(cat)) {
    const sc = superficieCatastale(amb, tipologiaMetrica(cat));
    if (u.classamento.superficieCatastale !== sc) { u.classamento.superficieCatastale = sc; cambiato = true; }
  }
  const m = u.mod1NParteII;
  if (m) {
    const l = superficiLorde(pol);
    if (m.gruppoC) {
      // gruppo C: superficie lorda del primo locale di ciascun gruppo (il piano resta quello indicato)
      const imposta = (lista: { piano: string; lorda: number; utile: number }[], lorda: number) => {
        if (!lorda) return;
        if (!lista.length) lista.push({ piano: '', lorda: 0, utile: 0 });
        if (lista.length === 1 && lista[0].lorda !== lorda) { lista[0].lorda = lorda; cambiato = true; }
      };
      imposta(m.gruppoC.principali, l.principali);
      imposta(m.gruppoC.accessoriDiretti, l.accessoriDirettiA2);
      imposta(m.gruppoC.accessoriIndiretti, l.accessoriIndiretti);
      if (m.gruppoC.balconiSup !== l.balconi) { m.gruppoC.balconiSup = l.balconi; cambiato = true; }
      if (m.gruppoC.pertinenzeSup !== l.pertinenze) { m.gruppoC.pertinenzeSup = l.pertinenze; cambiato = true; }
    } else {
      const valori: [keyof typeof m, number][] = [
        ['superficieLorda', l.principali],
        ['accessoriIndirettiSup', l.accessoriIndiretti],
        ['balconiSup', l.balconi],
        ['pertinenzeScoperteSup', l.pertinenze],
      ];
      for (const [k, v] of valori) {
        if (m[k] !== v) { (m as unknown as Record<string, number>)[k] = v; cambiato = true; }
      }
    }
  }
  return cambiato;
}

/**
 * Superficie catastale (DPR 138/98, allegato C) dagli ambienti dei dati metrici, con i criteri del gruppo
 * della categoria (tabella 6): R e P (con le regole di R/2, R/4 e del gruppo P), T (con quelle di T/1).
 * Gli ambienti con altezza inferiore a 1,50 m (149) non si computano. Risultato arrotondato al m².
 */
export function superficieCatastale(ambienti: Ambiente[], tipologia: string): number {
  const somma = (t: Ambiente['tipo']) => ambienti.filter((a) => a.tipo === t && a.altezzaMin !== 149).reduce((s, a) => s + a.superficie, 0);
  const A = somma('A'), A2 = somma('H'), B = somma('B'), C = somma('C'), D = somma('D'), E = somma('E'), F = somma('F');
  const gruppo = tipologia.charAt(0);
  const n = tipologia.slice(1);
  if (gruppo === 'T') {
    // T/1: accessori diretti (A2) al 50%, aree scoperte al 20%
    const a = A + (n === '1' ? A2 * 0.5 : A2);
    const tot = a + B * 0.5 + C * 0.25 + (D + E) * 0.1 + F * (n === '1' ? 0.2 : 0.1);
    return Math.round(tot);
  }
  // gruppi R e P
  const a = gruppo === 'R' && n === '4' ? A * 0.5 + A2 * 0.5 : A + A2;
  const b = B * 0.5 + C * 0.25;
  let c: number;
  if (gruppo === 'P') c = (D + E) * 0.1;
  else c = Math.min(D, 25) * 0.3 + Math.max(0, D - 25) * 0.1 + Math.min(E, 25) * 0.15 + Math.max(0, E - 25) * 0.05;
  let d = 0;
  if (gruppo !== 'P') {
    // R/2: parchi e giardini contano solo per la parte eccedente il quintuplo di (a)
    const area = gruppo === 'R' && n === '2' ? Math.max(0, F - 5 * a) : F;
    d = Math.min(area, a) * 0.1 + Math.max(0, area - a) * 0.02;
  }
  // pertinenze e accessori indiretti entrano fino alla metà della superficie di (a)
  const accessorie = Math.min(b + c + d, a / 2);
  return Math.round(a + accessorie);
}
