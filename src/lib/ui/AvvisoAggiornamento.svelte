<script lang="ts">
  /**
   * Barra «È disponibile una nuova versione»: controllo all'avvio e ogni 6 ore, pulsante per la pagina di
   * download. «Più tardi» la nasconde fino al prossimo avvio (o alla versione successiva).
   */
  import { onMount } from 'svelte';
  import { controllaAggiornamento, type NuovaVersione } from '$lib/aggiornamenti';
  import { apriUrl } from '$lib/piattaforma';
  import { VERSIONE_APP } from '$lib/versione';
  import Icona from './Icona.svelte';

  let nuova = $state<NuovaVersione | null>(null);
  let nascosta = $state('');
  let dettagli = $state(false);

  async function controlla(): Promise<void> {
    const n = await controllaAggiornamento();
    if (n) nuova = n;
  }

  onMount(() => {
    const avvio = setTimeout(() => void controlla(), 3000);
    const ogni = setInterval(() => void controlla(), 6 * 60 * 60 * 1000);
    return () => { clearTimeout(avvio); clearInterval(ogni); };
  });

  const visibile = $derived(!!nuova && nascosta !== nuova.commit);
</script>

{#if visibile && nuova}
  <div class="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-100" role="status">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Icona nome="info" />
      <span class="font-medium">È disponibile una nuova versione di Fa.Catasto.Doc{nuova.versione ? ` (${nuova.versione}` : ''}{nuova.quando ? `${nuova.versione ? ', ' : ' ('}del ${nuova.quando})` : nuova.versione ? ')' : ''}.</span>
      <span class="text-xs opacity-80">In uso: {VERSIONE_APP.testo || 'versione non indicata'}</span>
      {#if nuova.novita.length}
        <button type="button" class="text-xs underline" onclick={() => (dettagli = !dettagli)}>{dettagli ? 'Nascondi le novità' : 'Novità'}</button>
      {/if}
      <span class="ml-auto flex gap-2">
        <button type="button" class="btn btn-piccolo btn-primario" onclick={() => nuova && apriUrl(nuova.url)}><Icona nome="esporta" /> Scarica</button>
        <button type="button" class="btn btn-piccolo" onclick={() => nuova && (nascosta = nuova.commit)}>Più tardi</button>
      </span>
    </div>
    {#if dettagli && nuova.novita.length}
      <ul class="mt-2 list-disc space-y-0.5 pl-8 text-xs">
        {#each nuova.novita as r, i (i)}<li>{r}</li>{/each}
      </ul>
    {/if}
  </div>
{/if}
