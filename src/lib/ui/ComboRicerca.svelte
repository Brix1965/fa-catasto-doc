<script lang="ts" generics="T">
  /**
   * Campo di ricerca con elenco di risultati (comuni, strade...). Il chiamante fornisce la funzione
   * di ricerca e il formato di ogni voce; alla scelta riceve l'elemento.
   */
  import Icona from './Icona.svelte';

  let {
    // niente valore di riserva: un bind a undefined bloccherebbe lo schermo (props_invalid_value)
    valore = $bindable(),
    cerca,
    formatta,
    dettaglio,
    scelto,
    placeholder = 'Cerca…',
    disabilitato = false,
    vuoto = 'Nessun risultato',
  }: {
    valore?: string;
    cerca: (testo: string) => T[];
    formatta: (x: T) => string;
    dettaglio?: (x: T) => string;
    scelto: (x: T) => void;
    placeholder?: string;
    disabilitato?: boolean;
    vuoto?: string;
  } = $props();

  let aperto = $state(false);
  let evidenziato = $state(0);
  let testoRicerca = $state('');
  const risultati = $derived(aperto && testoRicerca.trim() ? cerca(testoRicerca) : []);

  function inizia(): void {
    testoRicerca = valore ?? '';
    aperto = true;
    evidenziato = 0;
  }
  function conferma(x: T): void {
    scelto(x);
    valore = formatta(x);
    aperto = false;
  }
  function tastiera(e: KeyboardEvent): void {
    if (!aperto) { if (e.key === 'ArrowDown') { inizia(); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { evidenziato = Math.min(risultati.length - 1, evidenziato + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { evidenziato = Math.max(0, evidenziato - 1); e.preventDefault(); }
    else if (e.key === 'Enter') { if (risultati[evidenziato]) { conferma(risultati[evidenziato]); e.preventDefault(); } }
    else if (e.key === 'Escape') { aperto = false; }
  }
</script>

<div class="relative">
  <div class="relative">
    <input
      class="campo pr-8"
      type="text"
      {placeholder}
      disabled={disabilitato}
      value={aperto ? testoRicerca : (valore ?? '')}
      oninput={(e) => { testoRicerca = e.currentTarget.value; valore = testoRicerca; if (!aperto) aperto = true; evidenziato = 0; }}
      onfocus={inizia}
      onblur={() => setTimeout(() => (aperto = false), 150)}
      onkeydown={tastiera}
      autocomplete="off"
    />
    <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-fg-faint"><Icona nome="cerca" /></span>
  </div>
  {#if aperto && testoRicerca.trim()}
    <ul class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg" role="listbox">
      {#if !risultati.length}
        <li class="px-3 py-2 text-xs text-fg-muted">{vuoto}</li>
      {/if}
      {#each risultati as r, i (i)}
        <li role="option" aria-selected={i === evidenziato}>
          <button
            type="button"
            class="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-surface-2 {i === evidenziato ? 'bg-accent-50 dark:bg-accent-950' : ''}"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => conferma(r)}
            onmouseenter={() => (evidenziato = i)}
          >
            <span>{formatta(r)}</span>
            {#if dettaglio}<span class="text-xs text-fg-faint">{dettaglio(r)}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
