// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/** Avvio dei calcoli sul disegno nel worker (o direttamente, dove i worker non ci sono). */
import type { Planimetria, Poligono, SchedaGrafica } from '../model';
import type { RisultatoVani } from './riconosci';
import type { RichiestaDisegno, RichiestaVani, RisultatoDisegno } from './worker';

/** Schede della planimetria con il DXF (la prima e le altre), con i loro poligoni. */
export function schedeConDxf(pl: Planimetria | undefined): { dxf: string; poligoni: Poligono[] }[] {
  return oggettiSchede(pl).map((s) => ({ dxf: s.dxf!, poligoni: s.poligoni ?? [] }));
}

/** Le schede con il DXF, come oggetti della pratica (nello stesso ordine di `schedeConDxf`). */
export function oggettiSchede(pl: Planimetria | undefined): (Planimetria | SchedaGrafica)[] {
  if (!pl) return [];
  return [pl, ...(pl.altreSchede ?? [])].filter((s) => !!s.dxf);
}

async function nelWorker<T>(richiesta: RichiestaVani | RichiestaDisegno, estrai: (d: { ok: true } & Record<string, unknown>) => T): Promise<T> {
  // $state.snapshot dei chiamanti: qui arrivano dati semplici, copiabili nel worker
  if (typeof Worker === 'undefined') {
    const m = await import('./worker');
    return estrai(richiesta.op === 'disegno' ? { ok: true, disegno: m.calcolaDisegno(richiesta) } : { ok: true, risultati: m.calcolaVani(richiesta) });
  }
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<T>((resolve, reject) => {
      // un disegno enorme o guasto non lascia «Calcolo in corso…» per sempre
      const scadenza = setTimeout(() => reject(new Error('il calcolo sul disegno ha superato i 3 minuti: il DXF è troppo complesso o danneggiato')), 180000);
      w.onmessage = (e: MessageEvent) => { clearTimeout(scadenza); if (e.data.ok) resolve(estrai(e.data)); else reject(new Error(e.data.errore)); };
      w.onerror = (e) => { clearTimeout(scadenza); reject(new Error(e.message || 'errore nel calcolo sul disegno')); };
      w.postMessage(richiesta);
    });
  } finally {
    w.terminate();
  }
}

export function riconosciInBackground(richiesta: RichiestaVani): Promise<RisultatoVani[]> {
  return nelWorker(richiesta, (d) => d.risultati as RisultatoVani[]);
}

export function analizzaDisegnoInBackground(richiesta: Omit<RichiestaDisegno, 'op'>): Promise<RisultatoDisegno> {
  return nelWorker({ ...richiesta, op: 'disegno' }, (d) => d.disegno as RisultatoDisegno);
}
