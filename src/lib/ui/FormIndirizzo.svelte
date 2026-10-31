<script lang="ts">
  /**
   * Ubicazione della u.i.u. (quadro U): fino a 4 indirizzi, ciascuno con toponimo (dallo stradario certificato
   * o digitato) e fino a 3 civici; piano (fino a 3), scala, interno, lotto, edificio.
   */
  import type { Indirizzo, IndirizzoAggiuntivo, Pratica, UnitaImmobiliare } from '$lib/core/model';
  import type { Strada } from '$lib/core/archivi';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from './Campo.svelte';
  import ComboRicerca from './ComboRicerca.svelte';
  import Icona from './Icona.svelte';

  let { unita = $bindable(), pratica, soloIndirizzo = false }: { unita: UnitaImmobiliare; pratica: Pratica; soloIndirizzo?: boolean } = $props();
  const indirizzo = $derived(unita.indirizzo as Indirizzo);
  const comune = $derived(impostazioni.comunePerCodiceAmministrativo(pratica.comune.codiceAmministrativo) ?? (pratica.comune.codice ? pratica.comune : undefined));
  const stradario = $derived(impostazioni.stradeDelComune(comune).length > 0);
  const righe = $derived<(Indirizzo | IndirizzoAggiuntivo)[]>([indirizzo, ...(unita.altriIndirizzi ?? [])]);

  function scegli(r: Indirizzo | IndirizzoAggiuntivo, s: Strada): void {
    r.toponimo = s.toponimo;
    r.codiceStrada = s.progressivo;
  }
  function libero(r: Indirizzo | IndirizzoAggiuntivo, v: string): void {
    r.toponimo = v.slice(0, 38);
    r.codiceStrada = undefined;
  }
  function civico(r: Indirizzo | IndirizzoAggiuntivo, k: number, v: string): void {
    const c = [...r.civici];
    c[k] = v.trim().toUpperCase();
    r.civici = c.map((x) => x ?? '').filter(Boolean).slice(0, 3);
  }
  function piano(k: number, v: string): void {
    const p = [...indirizzo.piani];
    p[k] = v.trim().toUpperCase();
    indirizzo.piani = p.filter(Boolean).slice(0, 3);
  }
  function aggiungi(): void {
    unita.altriIndirizzi = [...(unita.altriIndirizzi ?? []), { toponimo: '', civici: [] }].slice(0, 3);
  }
  function togli(k: number): void {
    unita.altriIndirizzi = (unita.altriIndirizzi ?? []).filter((_, i) => i !== k - 1);
  }
  // testo digitato in ogni casella dell'indirizzo. Al primo disegno è ancora vuoto: il bind della casella di ricerca
  // passa sempre una stringa (un undefined bloccava lo schermo con lo stradario caricato: errore props_invalid_value)
  let testi = $state<string[]>([]);
  $effect(() => { testi = righe.map((r) => r.toponimo ?? ''); });
</script>

<div class="space-y-3">
  {#each righe as r, k (k)}
    <div class="grid items-end gap-3 sm:grid-cols-[1fr_6rem_6rem_6rem_auto]">
      <Campo etichetta={k === 0 ? 'Indirizzo' : `Indirizzo ${k + 1}`} obbligatorio={k === 0} aiuto={k === 0 ? (stradario ? (r.codiceStrada ? `da stradario certificato: codice ${r.codiceStrada}` : 'cerca nello stradario certificato o digita il toponimo') : 'stradario non caricato: toponimo digitato (es. "via roma")') : undefined}>
        {#if stradario}
          <ComboRicerca bind:valore={() => testi[k] ?? '', (v) => (testi[k] = v)} cerca={(t) => impostazioni.cercaStrade(comune, t)} formatta={(s) => s.toponimo} dettaglio={(s) => `${s.toponimoArchivio} · ${s.progressivo}`} scelto={(s) => scegli(r, s)} placeholder="via, piazza…" vuoto="Nessuna strada: si può digitare il toponimo" />
          {#if testi[k] !== undefined && testi[k] !== r.toponimo}
            <button type="button" class="btn btn-piccolo mt-1" onclick={() => libero(r, testi[k])}>Usa «{testi[k]}» (non certificato)</button>
          {/if}
        {:else}
          <input type="text" class="campo" maxlength="38" value={r.toponimo} oninput={(e) => libero(r, e.currentTarget.value)} placeholder="via roma" />
        {/if}
      </Campo>
      {#each [0, 1, 2] as c (c)}
        <Campo etichetta={c === 0 ? 'Civico' : `Civico ${c + 1}`} obbligatorio={k === 0 && c === 0}>
          <input type="text" class="campo uppercase" maxlength="6" value={r.civici[c] ?? ''} onchange={(e) => civico(r, c, e.currentTarget.value)} placeholder={c === 0 ? 'SNC' : ''} />
        </Campo>
      {/each}
      {#if k > 0}
        <button type="button" class="btn btn-piccolo btn-pericolo mb-1" onclick={() => togli(k)} title="Togli indirizzo"><Icona nome="cestino" /></button>
      {:else}
        <button type="button" class="btn btn-piccolo mb-1" onclick={aggiungi} disabled={righe.length >= 4} title="Aggiungi indirizzo (max 4)"><Icona nome="piu" /></button>
      {/if}
    </div>
  {/each}
  {#if !soloIndirizzo}
    <div class="grid gap-3 sm:grid-cols-7">
      {#each [0, 1, 2] as k (k)}
        <Campo etichetta={k === 0 ? 'Piano' : `Piano ${k + 1}`} obbligatorio={k === 0} aiuto={k === 0 ? 'n., T, S1 o 1-3' : undefined}>
          <input type="text" class="campo uppercase" maxlength="4" value={indirizzo.piani[k] ?? ''} onchange={(e) => piano(k, e.currentTarget.value)} />
        </Campo>
      {/each}
      <Campo etichetta="Scala"><input type="text" class="campo uppercase" maxlength="2" value={indirizzo.scala ?? ''} oninput={(e) => (indirizzo.scala = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
      <Campo etichetta="Interno"><input type="text" class="campo uppercase" maxlength="3" value={indirizzo.interno ?? ''} oninput={(e) => (indirizzo.interno = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
      <Campo etichetta="Lotto"><input type="text" class="campo uppercase" maxlength="2" value={indirizzo.lotto ?? ''} oninput={(e) => (indirizzo.lotto = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
      <Campo etichetta="Edificio"><input type="text" class="campo uppercase" maxlength="2" value={indirizzo.edificio ?? ''} oninput={(e) => (indirizzo.edificio = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
    </div>
  {/if}
</div>
