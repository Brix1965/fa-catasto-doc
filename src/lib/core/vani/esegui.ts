/** Avvio del riconoscimento dei vani nel worker (o direttamente, dove i worker non ci sono). */
import type { Planimetria, Poligono } from '../model';
import type { RisultatoVani } from './riconosci';
import type { RichiestaVani, RispostaVani } from './worker';

/** Schede della planimetria con il DXF (la prima e le altre), con i loro poligoni. */
export function schedeConDxf(pl: Planimetria | undefined): { dxf: string; poligoni: Poligono[] }[] {
  if (!pl) return [];
  const out: { dxf: string; poligoni: Poligono[] }[] = [];
  if (pl.dxf) out.push({ dxf: pl.dxf, poligoni: pl.poligoni ?? [] });
  for (const s of pl.altreSchede ?? []) if (s.dxf) out.push({ dxf: s.dxf, poligoni: s.poligoni ?? [] });
  return out;
}

export async function riconosciInBackground(richiesta: RichiestaVani): Promise<RisultatoVani[]> {
  // $state.snapshot dei chiamanti: qui arrivano dati semplici, copiabili nel worker
  if (typeof Worker === 'undefined') {
    const { leggiDxf } = await import('../raster/dxf');
    const { riconosciVani } = await import('./riconosci');
    return richiesta.schede.map((s) => { const d = leggiDxf(s.dxf); return riconosciVani(d.entita, s.poligoni.length ? s.poligoni : d.poligoni); });
  }
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<RisultatoVani[]>((resolve, reject) => {
      w.onmessage = (e: MessageEvent<RispostaVani>) => (e.data.ok ? resolve(e.data.risultati) : reject(new Error(e.data.errore)));
      w.onerror = (e) => reject(new Error(e.message || 'errore nel calcolo dei vani'));
      w.postMessage(richiesta);
    });
  } finally {
    w.terminate();
  }
}
