<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /** Scheda con titolo, descrizione opzionale e azioni a destra. */
  import type { Snippet } from 'svelte';
  let { titolo, descrizione, id, azioni, classe = '', children }: { titolo: string; descrizione?: string; id?: string; azioni?: Snippet; classe?: string; children: Snippet } = $props();
</script>

<section class="scheda p-5 {classe}" {id}>
  <header class="mb-4 flex items-start justify-between gap-4">
    <div>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-fg">{titolo}</h2>
      {#if descrizione}<p class="mt-0.5 text-xs text-fg-muted">{descrizione}</p>{/if}
    </div>
    {#if azioni}<div class="flex shrink-0 items-center gap-2">{@render azioni()}</div>{/if}
  </header>
  {@render children()}
</section>
