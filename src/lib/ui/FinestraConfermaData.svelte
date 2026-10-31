<script lang="ts">
  /** Finestra "Confermi la data di ultimazione dei lavori?" (prima della chiusura e dell'esportazione). */
  import { dataIt, dataOraIt } from '$lib/formato-data';
  import type { Pratica } from '$lib/core/model';
  import { confermaData } from '$lib/stato/conferma-data.svelte';
  import CampoData from './CampoData.svelte';
  import Icona from './Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();

  const acc = $derived(pratica.tipoDocumento === 'accatastamento');
  const d = $derived(pratica.dataVariazione);
  const testo = $derived(dataIt(d) || 'non indicata');

  function tasti(e: KeyboardEvent): void {
    if (!confermaData.aperta) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); confermaData.chiudi(false); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); e.stopPropagation(); confermaData.chiudi(true); }
  }
</script>

<svelte:window onkeydown={tasti} />

{#if confermaData.aperta}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
    <div class="scheda w-full max-w-md p-5" role="dialog" aria-modal="true" aria-labelledby="titolo-conferma-data" tabindex="-1">
      <h2 id="titolo-conferma-data" class="mb-1 flex items-center gap-2 text-base font-semibold"><Icona nome="attenzione" classe="size-5 text-amber-600" /> Confermi la data di ultimazione dei lavori?</h2>
      <p class="mb-4 text-sm text-fg-muted">{confermaData.motivo}</p>
      <p class="mb-2 text-sm">{acc ? 'Data di ultimazione lavori (quadro A)' : 'Data di realizzazione della variazione (quadro B)'}: <strong class={d && d.aaaa ? '' : 'text-red-600'}>{testo}</strong></p>
      <label class="mb-5 block text-sm">
        <span class="mb-1 block text-fg-muted">Se non è giusta, correggila qui:</span>
        <CampoData bind:valore={pratica.dataVariazione} classe="w-48" />
      </label>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" onclick={() => confermaData.chiudi(false)}><span><u class="underline-offset-2">A</u>nnulla</span></button>
        <!-- svelte-ignore a11y_autofocus -->
        <button type="button" class="btn btn-primario min-w-28" autofocus onclick={() => confermaData.chiudi(true)}>Confermo</button>
      </div>
    </div>
  </div>
{/if}
