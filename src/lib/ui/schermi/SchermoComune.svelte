<script lang="ts">
  /** Scelta Comune: collega il documento al comune dell'immobile (lista dei comuni degli archivi caricati). */
  import type { Comune, Pratica } from '$lib/core/model';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from '../Campo.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();

  // le province degli archivi importati (tariffe); se non ce ne sono, tutte
  const provinceCaricate = $derived(impostazioni.dati.archivi.provinciali.filter((a) => a.tariffe || a.stradario).map((a) => a.provincia));
  let provincia = $state('');
  $effect(() => { if (!provincia) provincia = pratica.comune.provincia || provinceCaricate[0] || ''; });
  let filtro = $state('');
  const elenco = $derived(
    impostazioni.comuni
      .filter((c) => (!provincia || c.provincia === provincia) && (!filtro.trim() || c.nome.toLowerCase().includes(filtro.trim().toLowerCase())))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .slice(0, 400),
  );
  function scegli(c: Comune): void {
    pratica.comune = { ...c };
  }
  function codiceCatastale(v: string): void {
    const c = impostazioni.comunePerCodice(v.trim().toUpperCase());
    if (c) scegli(c);
    else pratica.comune = { ...pratica.comune, codice: v.trim().toUpperCase() };
  }
  const tariffe = $derived(impostazioni.dati.archivi.provinciali.filter((a) => a.tariffe).map((a) => a.provincia).join(', '));
</script>

<Sezione titolo="Scelta comune" descrizione="Il comune a cui appartengono le unità immobiliari del documento. Selezionalo nella lista (il comune scelto è evidenziato con la spunta) o digita il codice catastale, poi OK.">
  <div class="grid gap-5 lg:grid-cols-[1fr_22rem]">
    <div>
      <div class="mb-2 grid grid-cols-[7rem_1fr] gap-2">
        <select class="campo" bind:value={provincia} aria-label="Provincia">
          <option value="">Tutte</option>
          {#each impostazioni.province as p (p)}<option value={p}>{p}</option>{/each}
        </select>
        <input type="search" class="campo" placeholder="Cerca il comune…" bind:value={filtro} />
      </div>
      <ul class="h-80 overflow-y-auto rounded-md border border-line" role="listbox" aria-label="Comuni">
        {#each elenco as c, i (`${i}${c.codice}`)}
          {@const scelto = pratica.comune.codice === c.codice}
          <li>
            <button type="button" role="option" aria-selected={scelto} class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {scelto ? 'bg-accent-600 font-semibold text-white' : 'hover:bg-surface-2'}" onclick={() => scegli(c)} ondblclick={() => scegli(c)}>
              <span class="w-4">{#if scelto}<Icona nome="spunta" classe="size-4" />{/if}</span>
              <span class="flex-1">{c.nome}</span><span class="font-mono text-xs {scelto ? 'text-white/80' : 'text-fg-faint'}">{c.codice}</span>
            </button>
          </li>
        {/each}
        {#if !elenco.length}<li class="px-3 py-4 text-xs text-fg-faint">Nessun comune: controlla il filtro o carica gli archivi.</li>{/if}
      </ul>
    </div>
    <div class="space-y-4">
      <div>
        <h3 class="mb-2 text-xs font-semibold text-fg-muted">Comune catastale</h3>
        <div class="grid grid-cols-[6rem_1fr] gap-2">
          <Campo etichetta="Codice" obbligatorio><input type="text" class="campo uppercase font-mono" maxlength="4" value={pratica.comune.codice} onchange={(e) => codiceCatastale(e.currentTarget.value)} /></Campo>
          <Campo etichetta="Descrizione"><input type="text" class="campo" value={pratica.comune.nome} disabled /></Campo>
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-xs font-semibold text-fg-muted">Comune amministrativo</h3>
        <div class="grid grid-cols-[6rem_1fr] gap-2">
          <Campo etichetta="Codice"><input type="text" class="campo font-mono" value={pratica.comune.codiceAmministrativo} disabled /></Campo>
          <Campo etichetta="Descrizione"><input type="text" class="campo" value={pratica.comune.nome ? `${pratica.comune.nome} (${pratica.comune.provincia})` : ''} disabled /></Campo>
        </div>
      </div>
      <Campo etichetta="Sono caricate le tariffe di">
        <input type="text" class="campo" value={tariffe || '—'} disabled />
      </Campo>
      <a href="/impostazioni" class="btn"><Icona nome="importa" /> Caricamento archivi</a>
    </div>
  </div>
</Sezione>
