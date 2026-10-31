/**
 * Conferma della data di ultimazione dei lavori: una finestra che la mostra (modificabile) prima della chiusura
 * del documento (salvataggio finale) e prima dell'esportazione del PDF di presentazione.
 */
import type { Pratica } from '$lib/core/model';
import { causaliBarrate } from '$lib/core/compile';

class ConfermaData {
  aperta = $state(false);
  motivo = $state('');
  private risolvi: ((ok: boolean) => void) | null = null;

  /** Chiede la conferma; risolve true se confermata (o se la data non è prevista), false se annullata. */
  chiedi(pratica: Pratica, motivo: string): Promise<boolean> {
    if (!dataPrevista(pratica)) return Promise.resolve(true);
    this.motivo = motivo;
    this.aperta = true;
    return new Promise((r) => (this.risolvi = r));
  }

  chiudi(ok: boolean): void {
    this.aperta = false;
    this.risolvi?.(ok);
    this.risolvi = null;
  }
}

/** La data va omessa per le sole causali VTO/VRP e per le tipologie del comma 22 L. 208/2015 e comma 579 L. 205/2017. */
export function dataPrevista(p: Pratica): boolean {
  if (p.tipoDocumento === 'accatastamento') return true;
  if ([8, 9].includes(p.tipologia ?? 0)) return false;
  const c = causaliBarrate(p);
  return !(c.length > 0 && c.every((x) => x === 'VTO' || x === 'VRP'));
}

export const confermaData = new ConfermaData();
