<script lang="ts">
  /** Home: elenco delle pratiche nella cartella di lavoro. */
  import { dataIt, dataOraIt } from '$lib/formato-data';
  import { goto } from '$app/navigation';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { elencoPratiche, statoPratica, type VocePratica } from '$lib/stato/pratica.svelte';
  import { nuovaPratica } from '$lib/stato/pratica-file';
  import { scegliCartella, conferma } from '$lib/piattaforma';
  import Icona from '$lib/ui/Icona.svelte';
  import Intestazione from '$lib/ui/Intestazione.svelte';

  let pratiche = $state<VocePratica[]>([]);
  let caricamento = $state(false);
  let errore = $state<string | null>(null);
  let filtro = $state('');
  let filtroTipo = $state<'tutti' | 'accatastamento' | 'variazione'>('tutti');
  /** finestra "Nuovo documento" (File → Nuovo di Docfa) */
  let dialogo = $state(false);
  let nuovoTipo = $state<'accatastamento' | 'variazione'>('variazione');
  let nuovoProgressivo = $state(1);
  let nuovaDescrizione = $state('');

  const cartella = $derived(impostazioni.dati.cartellaPratiche);
  const filtrate = $derived(pratiche.filter((p) => (filtroTipo === 'tutti' || p.tipo === filtroTipo) && (!filtro.trim() || `${p.meta.titolo} ${p.comune}`.toLowerCase().includes(filtro.toLowerCase()))));
  const sigla = (tipo: 'accatastamento' | 'variazione', n: number) => `${tipo === 'accatastamento' ? 'NCA' : 'NCV'}${String(n).padStart(3, '0')}`;
  /** progressivo proposto: il primo libero per il tipo di documento */
  function progressivoProposto(tipo: 'accatastamento' | 'variazione'): number {
    const usati = new Set(pratiche.filter((x) => x.tipo === tipo).map((x) => x.progressivo));
    let n = 1;
    while (usati.has(n) && n < 999) n++;
    return n;
  }
  const progressivoUsato = $derived(pratiche.some((x) => x.tipo === nuovoTipo && x.progressivo === nuovoProgressivo));

  async function ricarica(): Promise<void> {
    if (!cartella) { pratiche = []; return; }
    caricamento = true;
    errore = null;
    try { pratiche = await elencoPratiche(cartella); }
    catch (e) { errore = `Cartella non leggibile: ${e instanceof Error ? e.message : String(e)}`; pratiche = []; }
    finally { caricamento = false; }
  }
  $effect(() => { void cartella; void ricarica(); });

  async function scegli(): Promise<void> {
    const c = await scegliCartella('Scegli la cartella delle pratiche');
    if (!c) return;
    impostazioni.dati.cartellaPratiche = c;
    await impostazioni.salva();
  }

  async function nuova(): Promise<void> {
    if (!cartella) { await scegli(); if (!impostazioni.dati.cartellaPratiche) return; }
    nuovoProgressivo = progressivoProposto(nuovoTipo);
    nuovaDescrizione = '';
    dialogo = true;
  }

  async function creaNuova(): Promise<void> {
    if (nuovoProgressivo < 1 || nuovoProgressivo > 999) return;
    const p = nuovaPratica(impostazioni.dati.tecnico, nuovoTipo, nuovoProgressivo);
    const titolo = nuovaDescrizione.trim() || `${nuovoTipo === 'accatastamento' ? 'Accatastamento' : 'Variazione'} ${sigla(nuovoTipo, nuovoProgressivo)}`;
    dialogo = false;
    const percorso = await statoPratica.crea(impostazioni.dati.cartellaPratiche, p, titolo);
    await goto(`/pratica?f=${encodeURIComponent(percorso)}`);
  }

  function tasti(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); void nuova(); }
    else if (dialogo && e.key === 'Escape') { e.preventDefault(); dialogo = false; }
    else if (dialogo && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); void creaNuova(); }
  }

  async function elimina(v: VocePratica): Promise<void> {
    if (!(await conferma(`Eliminare la pratica "${v.meta.titolo}" e i suoi file?`))) return;
    try { await statoPratica.elimina(v, cartella); await ricarica(); }
    catch (e) { errore = e instanceof Error ? e.message : String(e); }
  }

  const data = (iso: string) => dataOraIt(iso);
</script>

<svelte:window onkeydown={tasti} />

<div class="flex h-full flex-col">
  <Intestazione titolo="Fa.Catasto.Doc">
    {#snippet azioni()}
      <a href="/importa" class="btn"><Icona nome="importa" /> Importa da PDF Docfa</a>
      <a href="/impostazioni" class="btn"><Icona nome="impostazioni" /> Impostazioni</a>
      <button type="button" class="btn btn-primario" onclick={nuova}><Icona nome="piu" /> Nuovo documento</button>
    {/snippet}
  </Intestazione>

  <main class="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
    {#if !cartella}
      <div class="scheda flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-200"><Icona nome="cartella" classe="size-6" /></span>
        <div>
          <h2 class="text-lg font-semibold">Scegli la cartella delle pratiche</h2>
          <p class="mt-1 max-w-md text-sm text-fg-muted">Ogni pratica viene salvata in una sottocartella con il file <span class="font-mono">.catasto.json</span> e, dopo l'esportazione, il PDF per l'Agenzia.</p>
        </div>
        <button type="button" class="btn btn-primario" onclick={scegli}><Icona nome="cartella" /> Scegli cartella</button>
      </div>
    {:else}
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="relative flex-1">
          <input type="search" class="campo pl-8" placeholder="Cerca per titolo o comune…" bind:value={filtro} />
          <span class="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-fg-faint"><Icona nome="cerca" /></span>
        </div>
        <select class="campo w-auto" bind:value={filtroTipo} aria-label="Tipo di documento">
          <option value="tutti">Tutti i documenti</option>
          <option value="accatastamento">Accatastamenti</option>
          <option value="variazione">Variazioni</option>
        </select>
        <button type="button" class="btn" onclick={ricarica} disabled={caricamento}><Icona nome="ricarica" /> Aggiorna</button>
        <button type="button" class="btn btn-ghost text-xs text-fg-muted" onclick={scegli} title={cartella}><Icona nome="cartella" /> <span class="max-w-64 truncate">{cartella}</span></button>
      </div>
      {#if errore}<p class="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{errore}</p>{/if}
      {#if !impostazioni.dati.tecnico.cognome}
        <p class="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Icona nome="attenzione" /> I dati del tecnico non sono impostati: <a href="/impostazioni" class="underline">compila le impostazioni</a>.
        </p>
      {/if}
      {#if caricamento && !pratiche.length}
        <p class="py-10 text-center text-sm text-fg-muted">Lettura della cartella…</p>
      {:else if !filtrate.length}
        <div class="scheda px-6 py-14 text-center text-sm text-fg-muted">
          {pratiche.length ? 'Nessuna pratica corrisponde alla ricerca.' : 'Nessuna pratica in questa cartella. Creane una nuova o importa un PDF Docfa.'}
        </div>
      {:else}
        <ul class="scheda divide-y divide-line">
          {#each filtrate as v (v.percorso)}
            <li class="flex items-center gap-4 px-4 py-3">
              <a href={`/pratica?f=${encodeURIComponent(v.percorso)}`} class="flex min-w-0 flex-1 items-center gap-4">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted"><Icona nome="file" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{v.meta.titolo}</span>
                  <span class="block truncate text-xs text-fg-muted">{v.tipo === 'accatastamento' ? 'Accatastamento' : 'Variazione'} {sigla(v.tipo, v.progressivo)} · {v.comune || 'comune non indicato'} · {v.unita} unità · modificata {data(v.meta.modificata)}</span>
                </span>
                <span class="pill {v.meta.stato === 'esportata' ? 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-100' : 'bg-surface-2 text-fg-muted'}">{v.meta.stato === 'esportata' ? 'Esportata' : 'Bozza'}</span>
              </a>
              <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" onclick={() => elimina(v)} title="Elimina"><Icona nome="cestino" /></button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </main>
</div>

{#if dialogo}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) dialogo = false; }}>
    <div class="scheda w-full max-w-md p-5" role="dialog" aria-modal="true" aria-labelledby="titolo-nuovo" tabindex="-1"><form onsubmit={(e) => { e.preventDefault(); void creaNuova(); }}>
      <h2 id="titolo-nuovo" class="mb-4 text-base font-semibold">Nuovo documento</h2>
      <fieldset class="mb-4">
        <legend class="mb-2 text-sm font-medium obbligatorio">Tipo documento</legend>
        <div class="flex gap-4 text-sm">
          {#each [['accatastamento', 'Accatastamento'], ['variazione', 'Variazione']] as [v, t] (v)}
            <label class="flex items-center gap-2"><input type="radio" name="tipo" value={v} bind:group={nuovoTipo} onchange={() => (nuovoProgressivo = progressivoProposto(nuovoTipo))} /> {t}</label>
          {/each}
        </div>
      </fieldset>
      <label class="mb-3 block text-sm">
        <span class="mb-1 block font-medium obbligatorio">Progressivo</span>
        <span class="flex items-center gap-2">
          <span class="font-mono text-fg-muted">{nuovoTipo === 'accatastamento' ? 'NCA' : 'NCV'}</span>
          <input type="number" class="campo w-24" min="1" max="999" bind:value={nuovoProgressivo} />
        </span>
        {#if progressivoUsato}<span class="mt-1 block text-xs text-amber-700 dark:text-amber-300">Esiste già un documento {sigla(nuovoTipo, nuovoProgressivo)} in questa cartella.</span>{/if}
      </label>
      <label class="mb-5 block text-sm">
        <span class="mb-1 block font-medium">Descrizione</span>
        <input type="text" class="campo" maxlength="80" bind:value={nuovaDescrizione} />
      </label>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" onclick={() => (dialogo = false)}><span><u class="underline-offset-2">A</u>nnulla</span></button>
        <button type="submit" class="btn btn-primario min-w-24" disabled={nuovoProgressivo < 1 || nuovoProgressivo > 999}><span><u class="underline-offset-2">O</u>K</span></button>
      </div>
    </form></div>
  </div>
{/if}
