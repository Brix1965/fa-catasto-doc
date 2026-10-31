<script lang="ts">
  /** Quadro U – U.I.U.: dati generali, identificativi, beni comuni censibili associati, ubicazione e classamento. */
  import { conferma } from '$lib/piattaforma';
  import type { Identificativo, Pratica, UnitaImmobiliare, UtilitaComune } from '$lib/core/model';
  import { clonaProfondo, nuovaUnita } from '$lib/stato/pratica-file';
  import { descriviUnita } from '$lib/stato/validazione';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from '../Campo.svelte';
  import Icona from '../Icona.svelte';
  import Sezione from '../Sezione.svelte';
  import FormIndirizzo from '../FormIndirizzo.svelte';
  import FormClassamento from '../FormClassamento.svelte';

  let { pratica = $bindable(), selezionata = $bindable(0) }: { pratica: Pratica; selezionata?: number } = $props();
  const acc = $derived(pratica.tipoDocumento === 'accatastamento');
  const unita = $derived(pratica.unita[selezionata] as UnitaImmobiliare | undefined);
  const nDitte = $derived(pratica.quadroA?.ditte.length ?? 1);

  /** Nuova u.i.u.: come Docfa propone foglio e particella della precedente (senza subalterno), indirizzo, civico e piano. */
  function aggiungi(): void {
    const u = nuovaUnita(acc ? 'C' : 'V');
    const prec = pratica.unita[pratica.unita.length - 1];
    if (prec) {
      u.identificativo = { sezione: prec.identificativo.sezione, foglio: prec.identificativo.foglio, numero: prec.identificativo.numero };
      if (prec.indirizzo) u.indirizzo = clonaProfondo($state.snapshot(prec.indirizzo));
      if (acc) u.ditta = prec.ditta;
    }
    u.mod1NParteII = undefined;
    pratica.unita.push(u);
    selezionata = pratica.unita.length - 1;
  }
  async function elimina(i: number): Promise<void> {
    if (!(await conferma(`Eliminare ${descriviUnita(pratica.unita[i], i)}?`))) return;
    pratica.unita.splice(i, 1);
    selezionata = Math.max(0, Math.min(selezionata, pratica.unita.length - 1));
  }
  function operazione(u: UnitaImmobiliare, v: string): void {
    if (v === 'R') { u.operazione = 'C'; u.recuperata = true; }
    else { u.operazione = v as UnitaImmobiliare['operazione']; u.recuperata = undefined; }
    if (u.operazione !== 'S') {
      u.indirizzo ??= { toponimo: '', civici: [], piani: [] };
      u.classamento ??= { zonaCensuaria: '', categoria: '', classe: '', consistenza: '', superficieCatastale: 0, rendita: 0, classamentoAutomatico: false };
    }
  }
  // identificativi: il primo è quello principale, gli altri sono graffati
  let nuovoId = $state<Identificativo>({ foglio: '', numero: '' });
  let rigaId = $state(-1);
  function inserisciId(u: UnitaImmobiliare): void {
    if (!nuovoId.foglio || !nuovoId.numero) return;
    const id = { ...nuovoId, sezione: nuovoId.sezione || undefined, denominatore: nuovoId.denominatore || undefined, subalterno: nuovoId.subalterno || undefined };
    if (rigaId === 0) u.identificativo = id;
    else if (rigaId > 0) u.graffati[rigaId - 1] = id;
    else u.graffati.push(id);
    nuovoId = { foglio: id.foglio, numero: id.numero, sezione: id.sezione };
    rigaId = -1;
  }
  function modificaId(u: UnitaImmobiliare, k: number): void {
    rigaId = k;
    nuovoId = { ...(k === 0 ? u.identificativo : u.graffati[k - 1]) };
  }
  function eliminaId(u: UnitaImmobiliare, k: number): void {
    if (k === 0) { if (!u.graffati.length) return; u.identificativo = u.graffati.shift()!; }
    else u.graffati.splice(k - 1, 1);
  }
  let nuovaUc = $state<UtilitaComune>({ operazione: 'I', identificativo: { foglio: '', numero: '' } });
  function inserisciUc(u: UnitaImmobiliare): void {
    if (!nuovaUc.identificativo.foglio || !nuovaUc.identificativo.numero) return;
    u.utilitaComuni = [...(u.utilitaComuni ?? []), $state.snapshot(nuovaUc) as UtilitaComune].slice(0, 10);
    nuovaUc = { operazione: 'I', identificativo: { foglio: nuovaUc.identificativo.foglio, numero: nuovaUc.identificativo.numero } };
  }
  const idTesto = (id: Identificativo) => `${id.sezione ? `sez. ${id.sezione} ` : ''}fg. ${id.foglio || '?'} p.lla ${id.numero || '?'}${id.denominatore ? `/${id.denominatore}` : ''}${id.subalterno ? ` sub ${id.subalterno}` : ''}`;
  const opTesto = (u: UnitaImmobiliare) => (u.recuperata ? 'R' : u.operazione);
  const COLORE: Record<string, string> = {
    C: 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-100', R: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100',
    V: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100', S: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100',
  };
  const archivio = $derived(impostazioni.dati.archivi.provinciali.find((a) => a.provincia === pratica.comune.provincia)?.provincia ?? '—');
</script>

<div class="grid gap-5 lg:grid-cols-[17rem_1fr]">
  <aside class="scheda self-start p-3 lg:sticky lg:top-4">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">U.I.U. ({pratica.unita.length})</h2>
      <button type="button" class="btn btn-piccolo btn-primario" onclick={aggiungi}><Icona nome="piu" /> Nuova U.I.U.</button>
    </div>
    <ul class="space-y-1">
      {#each pratica.unita as u, i (i)}
        <li>
          <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 {i === selezionata ? 'bg-accent-50 text-accent-900 dark:bg-accent-950 dark:text-accent-100' : ''}" onclick={() => (selezionata = i)}>
            <span class="w-5 text-right text-xs text-fg-faint">{i + 1}</span>
            <span class="pill {COLORE[opTesto(u)]}">{opTesto(u)}</span>
            <span class="min-w-0 flex-1 truncate">{idTesto(u.identificativo)}</span>
          </button>
        </li>
      {/each}
      {#if !pratica.unita.length}<li class="px-2 py-3 text-xs text-fg-faint">Nessuna unità: premi «Nuova U.I.U.».</li>{/if}
    </ul>
  </aside>

  {#if unita}
    {@const i = selezionata}
    <div class="space-y-5">
      <Sezione titolo={`Quadro U – U.I.U. n. ${i + 1}`} descrizione={`Comune di ${pratica.comune.nome || '—'} · archivio di ${archivio}`}>
        {#snippet azioni()}
          <button type="button" class="btn btn-piccolo btn-pericolo" onclick={() => elimina(i)}><Icona nome="cestino" /> Elimina U.I.U.</button>
        {/snippet}
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Campo etichetta="Tipo operazione" obbligatorio>
            <select class="campo" value={opTesto(unita)} onchange={(e) => operazione(unita, e.currentTarget.value)}>
              {#if acc}
                <option value="C">C – Costituita</option><option value="R">R – Recuperata</option>
              {:else if pratica.presentazione === 'afferenti'}
                <option value="S">S – Soppressa</option><option value="C">C – Costituita</option>
              {:else}
                <option value="V">V – Variata</option><option value="C">C – Costituita</option><option value="S">S – Soppressa</option>
              {/if}
            </select>
          </Campo>
          {#if !acc}
            <Campo etichetta="Partita speciale" aiuto="bene comune censibile o non censibile">
              <select class="campo" value={unita.partitaSpeciale ?? ''} onchange={(e) => (unita.partitaSpeciale = e.currentTarget.value || undefined)}>
                <option value=""></option><option value="A">A – Beni comuni non censibili</option>
              </select>
            </Campo>
          {:else if nDitte > 1}
            <Campo etichetta="Ditta">
              <select class="campo" value={unita.ditta ?? 0} onchange={(e) => (unita.ditta = Number(e.currentTarget.value) || undefined)}>
                {#each pratica.quadroA?.ditte ?? [] as _, k (k)}<option value={k}>Ditta n. {k + 1}</option>{/each}
              </select>
            </Campo>
          {/if}
        </div>

        <h3 class="mt-5 mb-2 text-xs font-semibold text-fg-muted">Identificativi catastali</h3>
        <div class="grid items-end gap-2 sm:grid-cols-[5rem_6rem_7rem_6rem_6rem_auto]">
          <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" bind:value={nuovoId.sezione} /></Campo>
          <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo uppercase" maxlength="4" bind:value={nuovoId.foglio} /></Campo>
          <Campo etichetta="Numero" obbligatorio><input type="text" class="campo uppercase" maxlength="5" bind:value={nuovoId.numero} /></Campo>
          <Campo etichetta="Denom."><input type="text" class="campo" maxlength="4" bind:value={nuovoId.denominatore} /></Campo>
          <Campo etichetta="Sub."><input type="text" class="campo uppercase" maxlength="4" bind:value={nuovoId.subalterno} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inserisciId(unita); } }} /></Campo>
          <button type="button" class="btn mb-0.5" onclick={() => inserisciId(unita)} disabled={!nuovoId.foglio || !nuovoId.numero}><Icona nome={rigaId >= 0 ? 'spunta' : 'piu'} /> {rigaId >= 0 ? 'Modifica' : 'Inserisci'}</button>
        </div>
        <table class="mt-2 w-full text-sm">
          <thead><tr class="text-left text-xs text-fg-muted"><th class="py-1 font-medium">#</th><th class="font-medium">Sez.</th><th class="font-medium">Foglio</th><th class="font-medium">Numero</th><th class="font-medium">Denom.</th><th class="font-medium">Sub.</th><th></th></tr></thead>
          <tbody>
            {#each [unita.identificativo, ...unita.graffati] as id, k (k)}
              <tr class="border-t border-line {rigaId === k ? 'bg-accent-50 dark:bg-accent-950' : ''}">
                <td class="py-1 text-xs text-fg-faint">{k === 0 ? 'principale' : `graffato ${k}`}</td>
                <td>{id.sezione ?? ''}</td><td>{id.foglio}</td><td>{id.numero}</td><td>{id.denominatore ?? ''}</td><td>{id.subalterno ?? ''}</td>
                <td class="text-right whitespace-nowrap">
                  <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => modificaId(unita, k)} title="Modifica"><Icona nome="modifica" /></button>
                  <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" onclick={() => eliminaId(unita, k)} disabled={k === 0 && !unita.graffati.length} title="Elimina"><Icona nome="cestino" /></button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if unita.operazione !== 'S' && unita.partitaSpeciale !== 'A' && !(pratica.tipiVariazione.VTO || pratica.tipiVariazione.VSI)}
          <details class="mt-5" open={!!unita.utilitaComuni?.length}>
            <summary class="cursor-pointer text-xs font-semibold text-fg-muted">Associa beni comuni censibili ({unita.utilitaComuni?.length ?? 0}/10)</summary>
            <div class="mt-2 grid items-end gap-2 sm:grid-cols-[6rem_5rem_6rem_7rem_6rem_auto]">
              <Campo etichetta="Operazione" obbligatorio>
                <select class="campo" bind:value={nuovaUc.operazione}><option value="I">I – Iscrizione</option>{#if !acc && unita.operazione === 'V'}<option value="A">A – Annullamento</option>{/if}</select>
              </Campo>
              <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" bind:value={nuovaUc.identificativo.sezione} /></Campo>
              <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo" maxlength="4" bind:value={nuovaUc.identificativo.foglio} /></Campo>
              <Campo etichetta="Numero" obbligatorio><input type="text" class="campo" maxlength="5" bind:value={nuovaUc.identificativo.numero} /></Campo>
              <Campo etichetta="Sub."><input type="text" class="campo" maxlength="4" bind:value={nuovaUc.identificativo.subalterno} /></Campo>
              <button type="button" class="btn mb-0.5" onclick={() => inserisciUc(unita)} disabled={(unita.utilitaComuni?.length ?? 0) >= 10}><Icona nome="piu" /> Inserisci</button>
            </div>
            {#if unita.utilitaComuni?.length}
              <ul class="mt-2 divide-y divide-line text-sm">
                {#each unita.utilitaComuni as x, k (k)}
                  <li class="flex items-center justify-between py-1"><span><span class="pill bg-surface-2">{x.operazione}</span> {idTesto(x.identificativo)}</span>
                    <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" onclick={() => unita.utilitaComuni!.splice(k, 1)}><Icona nome="cestino" /></button></li>
                {/each}
              </ul>
            {/if}
          </details>
        {/if}
      </Sezione>

      {#if unita.operazione !== 'S'}
        <Sezione titolo="Ubicazione dell'unità immobiliare" descrizione="Fino a 4 indirizzi, almeno uno obbligatorio, con l'indirizzo dallo stradario certificato.">
          {#if unita.indirizzo}
            <FormIndirizzo bind:unita={pratica.unita[i]} {pratica} soloIndirizzo={!!pratica.tipiVariazione.DET && !acc} />
          {/if}
        </Sezione>
        <Sezione titolo="Classamento proposto dell'unità immobiliare">
          {#if unita.classamento}
            <FormClassamento bind:unita={pratica.unita[i]} {pratica} />
          {/if}
        </Sezione>
      {:else}
        <div class="scheda p-5 text-sm text-fg-muted">Per l'unità soppressa gli unici dati sono gli identificativi catastali.</div>
      {/if}
    </div>
  {/if}
</div>
