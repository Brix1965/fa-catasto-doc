<script lang="ts">
  /** Radice dell'app: stili globali, tema chiaro/scuro automatico, caricamento delle impostazioni. */
  import '../app.css';
  import { onMount } from 'svelte';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import AvvisoAggiornamento from '$lib/ui/AvvisoAggiornamento.svelte';
  let { children } = $props();

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applica = () => document.documentElement.classList.toggle('dark', media.matches);
    applica();
    media.addEventListener('change', applica);
    void impostazioni.carica();
    return () => media.removeEventListener('change', applica);
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
