<script lang="ts">
  /** Barra superiore delle pagine fuori dalla pratica (home, impostazioni, importazione). */
  import type { Snippet } from 'svelte';
  import Icona from './Icona.svelte';
  let { titolo, indietro, azioni }: { titolo: string; indietro?: string; azioni?: Snippet } = $props();
</script>

<header class="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-5 backdrop-blur">
  {#if indietro}
    <a href={indietro} class="btn btn-ghost btn-piccolo -ml-2" aria-label="Indietro"><Icona nome="sinistra" /></a>
  {/if}
  <div class="flex items-center gap-2">
    <span class="flex size-7 items-center justify-center rounded-md bg-accent-600 text-white"><Icona nome="casa" classe="size-4" /></span>
    <h1 class="text-base font-semibold">{titolo}</h1>
  </div>
  <div class="ml-auto flex items-center gap-2">
    {#if azioni}{@render azioni()}{/if}
  </div>
</header>
