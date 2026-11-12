// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Campi numerici: entrando nel campo (clic, doppio clic o Tab) il numero si seleziona tutto, così si scrive il
 * valore nuovo direttamente sopra senza cancellare prima (richiesta di un utente, 12/11/2026). Vale per tutti i
 * campi `type="number"`, `inputmode="numeric"` e `inputmode="decimal"` (anche le date gg/mm/aaaa).
 * Le frecce su e giù continuano a funzionare come prima.
 */
export function campoNumerico(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false;
  const im = el.getAttribute('inputmode');
  return el.type === 'number' || im === 'numeric' || im === 'decimal';
}

function selezionaTutto(el: HTMLInputElement): void {
  try {
    el.select();
  } catch {
    // alcuni tipi di campo non permettono la selezione: si lascia com'è
  }
}

/** Attiva il comportamento su tutto il documento; restituisce la funzione che lo disattiva. */
export function attivaSelezioneNumeri(doc: Document = document): () => void {
  // il clic che porta il cursore nel campo, al rilascio del mouse, toglierebbe la selezione appena fatta
  let appenaEntrato: HTMLInputElement | null = null;
  const entra = (e: FocusEvent) => {
    if (!campoNumerico(e.target)) return;
    appenaEntrato = e.target;
    selezionaTutto(e.target);
  };
  const rilascia = (e: MouseEvent) => {
    if (appenaEntrato && e.target === appenaEntrato) {
      e.preventDefault();
      selezionaTutto(appenaEntrato);
    }
    appenaEntrato = null;
  };
  const doppio = (e: MouseEvent) => {
    if (campoNumerico(e.target)) selezionaTutto(e.target);
  };
  doc.addEventListener('focusin', entra);
  doc.addEventListener('mouseup', rilascia, true);
  doc.addEventListener('dblclick', doppio);
  return () => {
    doc.removeEventListener('focusin', entra);
    doc.removeEventListener('mouseup', rilascia, true);
    doc.removeEventListener('dblclick', doppio);
  };
}
