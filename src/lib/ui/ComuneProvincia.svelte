<script lang="ts">
  /**
   * Provincia (sigla) e comune a scelta obbligata come in Docfa: digitando la provincia si abilita
   * la tendina dei comuni di quella provincia; EE = stato estero (nome libero).
   */
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import type { Comune } from '$lib/core/model';

  let {
    // niente valori di riserva: con un bind a un campo ancora vuoto (undefined) Svelte bloccherebbe lo schermo
    provincia = $bindable(),
    comune = $bindable(),
    etichettaComune = 'Comune',
    obbligatorio = false,
    scelto,
  }: { provincia?: string; comune?: string; etichettaComune?: string; obbligatorio?: boolean; scelto?: (c: Comune | undefined) => void } = $props();

  const sigla = $derived((provincia ?? '').trim().toUpperCase());
  const elenco = $derived(sigla && sigla !== 'EE' ? impostazioni.comuni.filter((c) => c.provincia === sigla).sort((a, b) => a.nome.localeCompare(b.nome)) : []);
  const provinciaNota = $derived(sigla === 'EE' || impostazioni.province.includes(sigla));

  function cambiaProvincia(v: string): void {
    provincia = v.toUpperCase().slice(0, 2);
    if (comune && !impostazioni.comuni.some((c) => c.provincia === provincia && c.nome === comune)) { comune = ''; scelto?.(undefined); }
  }
  function cambiaComune(nome: string): void {
    comune = nome;
    scelto?.(elenco.find((c) => c.nome === nome));
  }
</script>

<div class="grid grid-cols-[5rem_1fr] gap-2">
  <label class="block">
    <span class="etichetta {obbligatorio ? 'obbligatorio' : ''}">Prov.</span>
    <input type="text" class="campo uppercase" maxlength="2" list="sigle-province" value={provincia ?? ''} oninput={(e) => cambiaProvincia(e.currentTarget.value)} placeholder="FI" class:campo-errore={!!sigla && !provinciaNota} />
    <datalist id="sigle-province">{#each impostazioni.province as p (p)}<option value={p}></option>{/each}<option value="EE">Stato estero</option></datalist>
  </label>
  <label class="block">
    <span class="etichetta {obbligatorio ? 'obbligatorio' : ''}">{etichettaComune}</span>
    {#if sigla === 'EE'}
      <input type="text" class="campo uppercase" maxlength="25" value={comune ?? ''} oninput={(e) => cambiaComune(e.currentTarget.value.toUpperCase())} placeholder="Stato estero" />
    {:else}
      <select class="campo" value={comune ?? ''} onchange={(e) => cambiaComune(e.currentTarget.value)} disabled={!elenco.length}>
        <option value="">{elenco.length ? '— scegli —' : 'indicare prima la provincia'}</option>
        {#each elenco as c, i (`${i}${c.codice}`)}<option value={c.nome}>{c.nome}</option>{/each}
        {#if comune && !elenco.some((c) => c.nome === comune)}<option value={comune}>{comune}</option>{/if}
      </select>
    {/if}
  </label>
</div>
