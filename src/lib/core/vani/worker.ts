// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Calcoli sul disegno in un Web Worker (durano qualche secondo e non devono bloccare l'interfaccia):
 * - `vani`: riconoscimento dei vani delle schede della planimetria (quadro C del 1N parte II);
 * - `disegno`: per l'editor, vani + poligoni DOCFA_POLIGONI proposti + linee dei muri sezionati da ingrossare.
 */
import { preparaDxf } from '../raster/dxf-correzioni';
import type { Entita, Punto2 } from '../raster/dxf';
import type { Poligono } from '../model';
import { riconosciVani, type ParolaVano, type RisultatoVani } from './riconosci';
import { generaPoligoni, lineeDiMuro, type PoligoniGenerati } from './poligoni';

export interface RichiestaVani { op?: 'vani'; schede: { dxf: string; poligoni: Poligono[] }[]; dizionario?: Record<string, ParolaVano> }
export interface RichiestaDisegno {
  op: 'disegno';
  entita: Entita[];
  /** poligoni attuali: se `usaPoligoni` delimitano l'unità, altrimenti i vani si cercano in tutto il riquadro */
  poligoni: Poligono[];
  usaPoligoni: boolean;
  riquadro: Punto2[] | null;
  /** parole del tecnico (dizionario personale dei vani) */
  dizionario?: Record<string, ParolaVano>;
}
export interface RisultatoDisegno { vani: RisultatoVani; generati: PoligoniGenerati; muri: number[] }
export type RispostaVani = { ok: true; risultati: RisultatoVani[] } | { ok: false; errore: string };
export type RispostaDisegno = { ok: true; disegno: RisultatoDisegno } | { ok: false; errore: string };

const CONTINUE = new Set(['', 'CONTINUOUS', 'CONTINUA', 'BYLAYER', 'BYBLOCK']);

export function calcolaVani(r: RichiestaVani): RisultatoVani[] {
  return r.schede.map((s) => {
    const d = preparaDxf(s.dxf).letto;
    return riconosciVani(d.entita, s.poligoni.length ? s.poligoni : d.poligoni, { riquadro: d.riquadro, dizionario: r.dizionario });
  });
}

export function calcolaDisegno(r: RichiestaDisegno): RisultatoDisegno {
  const vani = riconosciVani(r.entita, r.usaPoligoni ? r.poligoni : [], { riquadro: r.riquadro, dizionario: r.dizionario });
  const linee = vani.linee.filter((l) => !l.tratteggiata).map((l) => [l.a, l.b] as [Punto2, Punto2]);
  // i poligoni sono superfici lorde: i vani entrano con sguinci e soglie (nello spessore dei muri)
  const lordi = vani.vani.map((v) => (v.contorniLordi ? { ...v, contorni: v.contorniLordi } : v));
  const generati = generaPoligoni(lordi, linee);
  const ent = r.entita.map((e) => ({ ...e, tratteggiata: !CONTINUE.has((e.tipoLinea ?? '').toUpperCase()) }));
  return { vani, generati, muri: lineeDiMuro(ent, lordi, linee) };
}

// solo dentro il worker (il modulo si importa anche altrove per le funzioni di calcolo)
declare const WorkerGlobalScope: unknown;
if (typeof WorkerGlobalScope !== 'undefined') self.onmessage = (e: MessageEvent<RichiestaVani | RichiestaDisegno>) => {
  const w = self as unknown as Worker;
  try {
    if (e.data.op === 'disegno') w.postMessage({ ok: true, disegno: calcolaDisegno(e.data) } satisfies RispostaDisegno);
    else w.postMessage({ ok: true, risultati: calcolaVani(e.data) } satisfies RispostaVani);
  } catch (err) {
    w.postMessage({ ok: false, errore: err instanceof Error ? err.message : String(err) });
  }
};
