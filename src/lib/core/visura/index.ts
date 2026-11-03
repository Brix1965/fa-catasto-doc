/**
 * Lettura delle visure catastali in PDF scaricate da Sister (Agenzia delle Entrate): "Visura attuale sintetica per
 * soggetto" e, dove il formato è lo stesso, "Visura per immobile" (attuale; della storica si legge la situazione attuale).
 * pdf.js si carica alla prima lettura.
 */
import { estraiTesto } from './testo';
import { analizzaVisura } from './analisi';
import { analizzaVisuraImmobile, eVisuraPerImmobile } from './immobile';
import type { ImmobileVisura, IntestatoVisura, Visura } from './tipi';

export type * from './tipi';
export { analizzaVisura } from './analisi';
export { estraiTesto, righe, testoCella, type ElementoTesto, type PaginaTesto, type Riga } from './testo';
export {
  categoriaDocfa, classeDocfa, consistenzaDocfa, inAttiDaVisura, classiPiuElevate,
  numeroItaliano, leggiConsistenza, leggiSuperficie, leggiRendita, leggiIndirizzo, leggiDiritti, leggiAnagrafica,
} from './formati';

/** Legge una visura PDF. Non lancia eccezioni per i dati mancanti: li segnala in `avvisi`. */
export async function leggiVisura(dati: Uint8Array): Promise<Visura> {
  const pagine = await estraiTesto(dati);
  // le visure per immobile più recenti non hanno la tabella: hanno voci «Foglio … Particella …», «Categoria …»
  return eVisuraPerImmobile(pagine) ? analizzaVisuraImmobile(pagine) : analizzaVisura(pagine);
}

/** Intestati del gruppo di un immobile. */
export function intestatiDi(v: Visura, i: ImmobileVisura): IntestatoVisura[] {
  return v.intestati.filter((x) => x.gruppo === i.gruppo);
}
