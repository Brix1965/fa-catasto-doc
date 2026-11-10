<script lang="ts">
  /**
   * Scelta Comune: collega il documento al comune dell'immobile (lista dei comuni degli archivi caricati).
   * Il comune scelto è in evidenza in alto e nella casella di ricerca; Invio nella ricerca sceglie il primo comune
   * dell'elenco, il doppio clic sceglie e passa avanti.
   */
  import type { Comune, Pratica } from '$lib/core/model';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from '../Campo.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';
  import { tick, untrack } from 'svelte';

  let { pratica = $bindable(), onavanti }: { pratica: Pratica; onavanti?: () => void } = $props();

  // le province degli archivi importati (tariffe); se non ce ne sono, tutte
  const provinceCaricate = $derived(impostazioni.dati.archivi.provinciali.filter((a) => a.tariffe || a.stradario).map((a) => a.provincia));
  let provincia = $state('');
  $effect(() => { if (!provincia) provincia = pratica.comune.provincia || provinceCaricate[0] || ''; });
  // testo della casella di ricerca: mostra il comune scelto; l'elenco si filtra solo con quello che si scrive
  // (cliccando un comune l'elenco resta fermo, così il doppio clic cade sulla stessa riga)
  let testo = $state(untrack(() => pratica.comune.nome ?? ''));
  let filtro = $state('');
  const scelto = $derived(!!pratica.comune.codice && !!pratica.comune.nome);
  const elenco = $derived(
    impostazioni.comuni
      .filter((c) => (!provincia || c.provincia === provincia) && (!filtro.trim() || c.nome.toLowerCase().includes(filtro.trim().toLowerCase()) || c.codice === filtro.trim().toUpperCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      // righe identiche (stesso codice, nome e provincia) una volta sola: la chiave dell'elenco deve essere unica
      .filter(function (this: Set<string>, c) { const k = `${c.codice}|${c.nome}|${c.provincia}`; if (this.has(k)) return false; this.add(k); return true; }, new Set<string>())
      .slice(0, 400),
  );
  let lista = $state<HTMLUListElement | null>(null);
  let cerca = $state<HTMLInputElement | null>(null);
  async function mostraScelto(): Promise<void> {
    await tick();
    lista?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function scegli(c: Comune): void {
    pratica.comune = { ...c };
    testo = c.nome;
    if (c.provincia && provincia && provincia !== c.provincia) provincia = c.provincia;
    void mostraScelto();
  }
  function cambia(): void {
    filtro = ''; testo = '';
    cerca?.focus();
    void mostraScelto();
  }
  function codiceCatastale(v: string): void {
    const c = impostazioni.comunePerCodice(v.trim().toUpperCase());
    if (c) scegli(c);
    else pratica.comune = { ...pratica.comune, codice: v.trim().toUpperCase() };
  }
  function tastoRicerca(e: KeyboardEvent): void {
    if (e.key === 'Enter' && elenco.length) { e.preventDefault(); scegli(elenco[0]); }
  }
  $effect(() => { void elenco.length; untrack(() => void mostraScelto()); });
  const tariffe = $derived(impostazioni.dati.archivi.provinciali.filter((a) => a.tariffe).map((a) => a.provincia).join(', '));
</script>

<Sezione titolo="Scelta comune" descrizione="Il comune a cui appartengono le unità immobiliari del documento. Cercalo e fai clic sul nome (o digita il codice catastale), poi «Avanti».">
  {#if scelto}
    <div class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-accent-600 bg-accent-50 px-4 py-3 dark:bg-accent-950">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white"><Icona nome="spunta" classe="size-5" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-accent-800 dark:text-accent-200">Comune scelto</p>
        <p class="truncate text-lg font-semibold text-fg">{pratica.comune.nome}{pratica.comune.provincia ? ` (${pratica.comune.provincia})` : ''} <span class="ml-1 font-mono text-sm font-normal text-fg-muted">{pratica.comune.codice}</span></p>
      </div>
      <button type="button" class="btn btn-piccolo" onclick={cambia}>Cambia comune</button>
      {#if onavanti}<button type="button" class="btn btn-piccolo btn-primario" onclick={onavanti}>Avanti <Icona nome="destra" /></button>{/if}
    </div>
  {:else}
    <div class="mb-4 flex items-center gap-3 rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <Icona nome="attenzione" classe="size-5 shrink-0" /> Nessun comune scelto: scrivi il nome nella ricerca e fai clic sul comune nell'elenco.
    </div>
  {/if}
  <div class="grid gap-5 lg:grid-cols-[1fr_22rem]">
    <div>
      <div class="mb-2 grid grid-cols-[7rem_1fr] gap-2">
        <select class="campo" bind:value={provincia} aria-label="Provincia">
          <option value="">Tutte</option>
          {#each impostazioni.province as p (p)}<option value={p}>{p}</option>{/each}
        </select>
        <div class="relative">
          <input bind:this={cerca} type="search" class="campo w-full pr-14 {scelto && testo === pratica.comune.nome ? 'border-accent-600 font-semibold text-accent-900 dark:text-accent-100' : ''}" placeholder="Cerca il comune (nome o codice)…" value={testo} oninput={(e) => { testo = e.currentTarget.value; filtro = testo; }} onkeydown={tastoRicerca} aria-label="Cerca il comune" />
          {#if scelto && testo === pratica.comune.nome}<span class="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 text-accent-600"><Icona nome="spunta" classe="size-4" /></span>{/if}
        </div>
      </div>
      <ul bind:this={lista} class="h-80 overflow-y-auto rounded-md border border-line" role="listbox" aria-label="Comuni">
        {#each elenco as c (`${c.codice}|${c.nome}|${c.provincia}`)}
          {@const sel = pratica.comune.codice === c.codice}
          <li>
            <button type="button" role="option" aria-selected={sel} class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {sel ? 'bg-accent-600 font-semibold text-white' : 'hover:bg-surface-2'}" onclick={() => scegli(c)} ondblclick={() => { scegli(c); onavanti?.(); }} title="Clic per scegliere, doppio clic per scegliere e andare avanti">
              <span class="w-4">{#if sel}<Icona nome="spunta" classe="size-4" />{/if}</span>
              <span class="flex-1">{c.nome}</span><span class="font-mono text-xs {sel ? 'text-white/80' : 'text-fg-faint'}">{c.codice}</span>
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
