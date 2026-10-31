<script lang="ts">
  /** Elenco di errori/avvisi con icona. */
  import Icona from './Icona.svelte';
  let { errori = [], avvisi = [], vuoto }: { errori?: string[]; avvisi?: string[]; vuoto?: string } = $props();
</script>

{#if !errori.length && !avvisi.length}
  {#if vuoto}
    <p class="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-200">
      <Icona nome="spunta" /> {vuoto}
    </p>
  {/if}
{:else}
  <ul class="space-y-1.5">
    {#each errori as e (e)}
      <li class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <Icona nome="errore" classe="mt-0.5 size-4 shrink-0" /><span>{e}</span>
      </li>
    {/each}
    {#each avvisi as a (a)}
      <li class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <Icona nome="attenzione" classe="mt-0.5 size-4 shrink-0" /><span>{a}</span>
      </li>
    {/each}
  </ul>
{/if}
