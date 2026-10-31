<script lang="ts">
  /**
   * Accatastamento: quadro D – beni comuni non censibili, note relative al documento e relazione tecnica,
   * estremi del titolo giustificativo dell'intestazione. Variazione: note relative al documento.
   */
  import type { BeneComuneNonCensibile, EstremiAtto, Pratica } from '$lib/core/model';
  import { CAUSALI_ATTO, pianoValido } from '$lib/core/regole-docfa';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from '../Campo.svelte';
  import CampoData from '../CampoData.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();
  const acc = $derived(pratica.tipoDocumento === 'accatastamento');
  const MAX_NOTE = 385;

  // beni comuni non censibili
  const vuoto = (): BeneComuneNonCensibile => ({ identificativo: { foglio: pratica.unita[0]?.identificativo.foglio ?? '', numero: pratica.unita[0]?.identificativo.numero ?? '' }, piani: [] });
  let bc = $state<BeneComuneNonCensibile>(vuoto());
  let rigaBc = $state(-1);
  function inserisciBc(): void {
    if (!bc.identificativo.foglio || !bc.identificativo.numero) return;
    const elenco = [...(pratica.bcnc ?? [])];
    const voce = $state.snapshot(bc) as BeneComuneNonCensibile;
    voce.piani = voce.piani.map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (rigaBc >= 0) elenco[rigaBc] = voce; else elenco.push(voce);
    pratica.bcnc = elenco.slice(0, 20);
    bc = { identificativo: { foglio: voce.identificativo.foglio, numero: voce.identificativo.numero, sezione: voce.identificativo.sezione }, piani: [] };
    rigaBc = -1;
  }
  function modificaBc(k: number): void {
    rigaBc = k;
    bc = structuredClone($state.snapshot(pratica.bcnc![k]) as BeneComuneNonCensibile);
  }

  // estremi del titolo
  let mostraEstremi = $state(false);
  function nuovoEstremo(): void {
    pratica.estremi = [...(pratica.estremi ?? []), { uiuDa: 1, uiuA: pratica.unita.length || 1, causale: '', efficacia: { gg: 0, mm: 0, aaaa: 0 }, repertorio: '', rogante: '', sede: '', provincia: '' } satisfies EstremiAtto].slice(0, 3);
  }
  const comuniProvincia = (p: string) => impostazioni.comuni.filter((c) => c.provincia === p.toUpperCase()).sort((a, b) => a.nome.localeCompare(b.nome));
</script>

<div class="space-y-5">
  {#if acc}
    <Sezione titolo="Quadro D – Beni comuni non censibili" descrizione="Fino a 20 beni comuni non censibili, con identificativo e fino a 3 piani. La descrizione va nell'elenco subalterni.">
      <div class="grid items-end gap-2 sm:grid-cols-[5rem_6rem_7rem_6rem_6rem_5rem_5rem_5rem_auto]">
        <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" bind:value={bc.identificativo.sezione} /></Campo>
        <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo" maxlength="4" bind:value={bc.identificativo.foglio} /></Campo>
        <Campo etichetta="Numero" obbligatorio><input type="text" class="campo" maxlength="5" bind:value={bc.identificativo.numero} /></Campo>
        <Campo etichetta="Denom."><input type="text" class="campo" maxlength="4" bind:value={bc.identificativo.denominatore} /></Campo>
        <Campo etichetta="Sub."><input type="text" class="campo" maxlength="4" bind:value={bc.identificativo.subalterno} /></Campo>
        {#each [0, 1, 2] as k (k)}
          <Campo etichetta={k === 0 ? 'Piano' : `Piano ${k + 1}`}><input type="text" class="campo uppercase" maxlength="4" value={bc.piani[k] ?? ''} oninput={(e) => (bc.piani[k] = e.currentTarget.value.toUpperCase())} class:campo-errore={!!bc.piani[k] && !pianoValido(bc.piani[k])} /></Campo>
        {/each}
        <button type="button" class="btn mb-0.5" onclick={inserisciBc} disabled={(pratica.bcnc?.length ?? 0) >= 20 && rigaBc < 0}><Icona nome={rigaBc >= 0 ? 'spunta' : 'piu'} /> {rigaBc >= 0 ? 'Modifica' : 'Inserisci'}</button>
      </div>
      {#if pratica.bcnc?.length}
        <table class="mt-3 w-full text-sm">
          <thead><tr class="text-left text-xs text-fg-muted"><th class="py-1 font-medium">#</th><th class="font-medium">Sez.</th><th class="font-medium">Foglio</th><th class="font-medium">Numero</th><th class="font-medium">Sub.</th><th class="font-medium">Piani</th><th></th></tr></thead>
          <tbody>
            {#each pratica.bcnc as b, k (k)}
              <tr class="border-t border-line {rigaBc === k ? 'bg-accent-50 dark:bg-accent-950' : ''}">
                <td class="py-1 text-xs text-fg-faint">{k + 1}</td><td>{b.identificativo.sezione ?? ''}</td><td>{b.identificativo.foglio}</td><td>{b.identificativo.numero}{b.identificativo.denominatore ? `/${b.identificativo.denominatore}` : ''}</td><td>{b.identificativo.subalterno ?? ''}</td><td>{b.piani.join(' ')}</td>
                <td class="text-right whitespace-nowrap">
                  <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => modificaBc(k)} title="Modifica"><Icona nome="modifica" /></button>
                  <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" onclick={() => pratica.bcnc!.splice(k, 1)} title="Elimina"><Icona nome="cestino" /></button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Sezione>
  {/if}

  <Sezione titolo="Note relative al documento e relazione tecnica" descrizione="Testo libero per la relazione tecnica o ulteriori osservazioni.">
    {#snippet azioni()}
      <button type="button" class="btn btn-piccolo" onclick={() => (pratica.annotazioni = undefined)} disabled={!pratica.annotazioni}>Pulisci</button>
    {/snippet}
    <textarea class="campo" rows="5" maxlength={MAX_NOTE} value={pratica.annotazioni ?? ''} oninput={(e) => (pratica.annotazioni = e.currentTarget.value || undefined)}></textarea>
    <p class="mt-1 text-right text-xs {(pratica.annotazioni?.length ?? 0) > 380 ? 'text-amber-600' : 'text-fg-faint'}">{pratica.annotazioni?.length ?? 0} / 380 caratteri</p>
  </Sezione>

  {#if acc}
    <Sezione titolo="Estremi del titolo giustificativo dell'intestazione in Catasto" descrizione="Solo per intestazioni che si pongono in modo discontinuo rispetto alla storia catastale (fino a 3).">
      {#snippet azioni()}
        <button type="button" class="btn btn-piccolo" onclick={() => (mostraEstremi = !mostraEstremi)}>Estremi…</button>
      {/snippet}
      {#if mostraEstremi || pratica.estremi?.length}
        <div class="space-y-4">
          {#each pratica.estremi ?? [] as e, k (k)}
            <div class="rounded-md border border-line p-3">
              <div class="grid gap-3 sm:grid-cols-4 xl:grid-cols-8">
                <Campo etichetta="U.I.U. da" obbligatorio><input type="number" class="campo" min="1" max={pratica.unita.length} bind:value={e.uiuDa} /></Campo>
                <Campo etichetta="a" obbligatorio><input type="number" class="campo" min="1" max={pratica.unita.length} bind:value={e.uiuA} /></Campo>
                <Campo etichetta="Causale" classe="sm:col-span-2" obbligatorio>
                  <select class="campo" bind:value={e.causale}><option value=""></option>{#each CAUSALI_ATTO as [c, d] (c)}<option value={c}>{d}</option>{/each}</select>
                </Campo>
                <Campo etichetta="Efficacia dal" classe="sm:col-span-2" obbligatorio><CampoData bind:valore={e.efficacia} /></Campo>
                <Campo etichetta="Repertorio o n. reg." classe="sm:col-span-2" obbligatorio><input type="text" class="campo" maxlength="6" bind:value={e.repertorio} /></Campo>
                <Campo etichetta="Rogante o de cuius" classe="sm:col-span-3" obbligatorio><input type="text" class="campo uppercase" maxlength="20" value={e.rogante} oninput={(ev) => (e.rogante = ev.currentTarget.value.toUpperCase())} /></Campo>
                <Campo etichetta="Prov." obbligatorio><input type="text" class="campo uppercase" maxlength="2" value={e.provincia} oninput={(ev) => { e.provincia = ev.currentTarget.value.toUpperCase(); e.sede = ''; }} /></Campo>
                <Campo etichetta="Sede rogante o ufficio del registro" classe="sm:col-span-3" obbligatorio>
                  <select class="campo" bind:value={e.sede} disabled={!e.provincia}>
                    <option value=""></option>{#each comuniProvincia(e.provincia) as c, i (`${i}${c.codice}`)}<option value={c.codice}>{c.nome}</option>{/each}
                  </select>
                </Campo>
                <Campo etichetta="Volume" aiuto="successioni"><input type="text" class="campo" maxlength="6" value={e.volume ?? ''} oninput={(ev) => (e.volume = ev.currentTarget.value || undefined)} /></Campo>
                <Campo etichetta="Data registrazione" classe="sm:col-span-2" aiuto="successioni"><CampoData bind:valore={e.dataRegistrazione} /></Campo>
                <div class="flex items-end"><button type="button" class="btn btn-piccolo btn-pericolo" onclick={() => pratica.estremi!.splice(k, 1)}><Icona nome="cestino" /> Elimina</button></div>
              </div>
            </div>
          {/each}
          <button type="button" class="btn btn-piccolo" onclick={nuovoEstremo} disabled={(pratica.estremi?.length ?? 0) >= 3}><Icona nome="piu" /> Memorizza nuovi estremi</button>
        </div>
      {/if}
    </Sezione>
  {/if}
</div>
