<script lang="ts">
  /** Etichetta + controllo, con eventuale testo di aiuto o errore. I campi obbligatori hanno l'etichetta fucsia come in Docfa. */
  import type { Snippet } from 'svelte';
  let { etichetta, aiuto, errore, classe = '', obbligatorio = false, children }: { etichetta: string; aiuto?: string; errore?: string; classe?: string; obbligatorio?: boolean; children: Snippet } = $props();
</script>

<label class="block {classe}">
  <span class="etichetta {obbligatorio ? 'obbligatorio' : ''}">{etichetta}</span>
  {@render children()}
  {#if errore}
    <span class="mt-1 block text-xs text-red-600 dark:text-red-400">{errore}</span>
  {:else if aiuto}
    <span class="mt-1 block text-xs text-fg-faint">{aiuto}</span>
  {/if}
</label>
