/**
 * Riconoscimento dei vani in un Web Worker: il calcolo dura qualche secondo per planimetria e non deve
 * bloccare l'interfaccia.
 */
import { leggiDxf } from '../raster/dxf';
import type { Poligono } from '../model';
import { riconosciVani, type RisultatoVani } from './riconosci';

export interface RichiestaVani { schede: { dxf: string; poligoni: Poligono[] }[] }
export type RispostaVani = { ok: true; risultati: RisultatoVani[] } | { ok: false; errore: string };

self.onmessage = (e: MessageEvent<RichiestaVani>) => {
  try {
    const risultati = e.data.schede.map((s) => {
      const d = leggiDxf(s.dxf);
      return riconosciVani(d.entita, s.poligoni.length ? s.poligoni : d.poligoni);
    });
    (self as unknown as Worker).postMessage({ ok: true, risultati } satisfies RispostaVani);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, errore: err instanceof Error ? err.message : String(err) } satisfies RispostaVani);
  }
};
