<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /** Versione e data di rilascio dell'app, in piccolo (in basso a sinistra). */
  import { VERSIONE_APP } from '$lib/versione';
  let { classe = '' }: { classe?: string } = $props();
</script>

{#if VERSIONE_APP.testo}
  <p class="text-[11px] text-fg-faint tabular-nums {classe}" title={VERSIONE_APP.commit ? `commit ${VERSIONE_APP.commit}` : undefined}>Fa.Catasto.Doc {VERSIONE_APP.testo}</p>
{/if}
