<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /** Radice dell'app: stili globali, tema chiaro/scuro automatico, caricamento delle impostazioni. */
  import '../app.css';
  import { onMount } from 'svelte';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import AvvisoAggiornamento from '$lib/ui/AvvisoAggiornamento.svelte';
  import { attivaSelezioneNumeri } from '$lib/ui/seleziona-numeri';
  let { children } = $props();

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applica = () => document.documentElement.classList.toggle('dark', media.matches);
    applica();
    media.addEventListener('change', applica);
    void impostazioni.carica();
    // campi numerici: entrando il numero si seleziona tutto, si scrive sopra senza cancellare
    const disattiva = attivaSelezioneNumeri();
    return () => { media.removeEventListener('change', applica); disattiva(); };
  });
</script>

{#if impostazioni.caricate}
  <div class="flex h-full flex-col">
    <AvvisoAggiornamento />
    <div class="min-h-0 flex-1">{@render children()}</div>
  </div>
{:else}
  <div class="flex h-full items-center justify-center text-sm text-fg-muted">Caricamento…</div>
{/if}
