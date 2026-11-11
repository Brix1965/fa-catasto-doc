<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /**
   * Etichetta + controllo, con eventuale testo di aiuto o errore. I campi obbligatori hanno l'etichetta fucsia come in
   * Docfa e lo sfondo verde. In una griglia etichette, controlli e aiuti stanno su righe comuni (vedi .campo-griglia):
   * i controlli della stessa riga restano allineati.
   */
  import type { Snippet } from 'svelte';
  let { etichetta, aiuto, errore, classe = '', obbligatorio = false, children }: { etichetta: string; aiuto?: string; errore?: string; classe?: string; obbligatorio?: boolean; children: Snippet } = $props();
</script>

<label class="campo-griglia min-w-0 {classe}">
  <span class="etichetta {obbligatorio ? 'obbligatorio' : ''}">{etichetta}</span>
  <div class="min-w-0">{@render children()}</div>
  {#if errore}
    <span class="block text-xs text-red-600 dark:text-red-400">{errore}</span>
  {:else if aiuto}
    <span class="block text-xs text-fg-faint">{aiuto}</span>
  {:else}
    <span></span>
  {/if}
</label>
