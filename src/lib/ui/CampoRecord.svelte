<script lang="ts">
  /**
   * Campo generato dallo schema del record (modello 1N parte I): flag a un carattere → casella,
   * numerico → input numerico con il massimo di cifre, alfanumerico → testo con lunghezza massima,
   * campo con opzioni → scelta.
   */
  import type { Campi } from '$lib/core/model';
  import { campoSchema, lunghezzaCampo, type CampoUi, type RecordMod1N } from '$lib/stato/mod1n-sezioni';

  let { rec, campo, campi = $bindable(), compatto = false }: { rec: RecordMod1N; campo: CampoUi; campi: Campi; compatto?: boolean } = $props();

  const def = $derived(campoSchema(rec, campo.id));
  const len = $derived(lunghezzaCampo(def));
  const tipo = $derived(campo.opzioni ? 'opzioni' : def.kind === 'N' && len === 1 ? 'flag' : def.kind === 'N' ? 'numero' : 'testo');
  const defAcc = $derived(campo.accoppiato ? campoSchema(rec, campo.accoppiato.id) : null);

  function leggiNumero(id: string): number | '' {
    const v = campi[id];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v)) return Number(v);
    return '';
  }
  function scriviNumero(id: string, max: number, e: Event): void {
    const s = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, max);
    (e.currentTarget as HTMLInputElement).value = s;
    if (s === '') delete campi[id];
    else campi[id] = Number(s);
  }
  function leggiTesto(id: string): string {
    const v = campi[id];
    return typeof v === 'string' ? v : v === undefined ? '' : String(v);
  }
  function scriviTesto(id: string, max: number, e: Event): void {
    const s = (e.currentTarget as HTMLInputElement).value.slice(0, max);
    if (s === '') delete campi[id];
    else campi[id] = s;
  }
  const flag = (id: string) => campi[id] === 1 || campi[id] === true || campi[id] === '1';
</script>

{#if tipo === 'flag'}
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 {compatto ? '' : 'min-h-8'} {campo.accoppiato ? 'sm:col-span-2' : ''}">
    <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" class="check" checked={flag(campo.id)} onchange={(e) => { if (e.currentTarget.checked) campi[campo.id] = 1; else delete campi[campo.id]; }} />
      <span>{campo.etichetta}</span>
    </label>
    {#if campo.accoppiato && defAcc}
      <label class="flex flex-1 items-center gap-1.5 text-xs whitespace-nowrap text-fg-muted">
        <span>{campo.accoppiato.etichetta}</span>
        {#if defAcc.kind === 'N'}
          <input type="text" inputmode="numeric" class="campo w-20 py-1 text-right" maxlength={lunghezzaCampo(defAcc)} value={leggiNumero(campo.accoppiato.id)} oninput={(e) => scriviNumero(campo.accoppiato!.id, lunghezzaCampo(defAcc!), e)} disabled={!flag(campo.id)} />
        {:else}
          <input type="text" class="campo min-w-40 flex-1 py-1" maxlength={lunghezzaCampo(defAcc)} value={leggiTesto(campo.accoppiato.id)} oninput={(e) => scriviTesto(campo.accoppiato!.id, lunghezzaCampo(defAcc!), e)} disabled={!flag(campo.id)} />
        {/if}
      </label>
    {/if}
  </div>
{:else if tipo === 'opzioni'}
  <div>
    <span class="etichetta">{campo.etichetta}</span>
    <div class="flex flex-wrap gap-x-4 gap-y-1">
      {#each campo.opzioni ?? [] as o (o.valore)}
        <label class="inline-flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="radio" class="check" name={`${rec}-${campo.id}`} checked={leggiNumero(campo.id) === o.valore} onchange={() => (campi[campo.id] = o.valore)} />
          <span>{o.etichetta}</span>
        </label>
      {/each}
    </div>
  </div>
{:else if tipo === 'numero' && campo.id === 'anno_costruzione'}
  {@const ante = leggiNumero(campo.id) !== '' && (leggiNumero(campo.id) as number) < 1942}
  <div>
    <label class="mb-1 flex items-center gap-2 text-sm"><input type="checkbox" class="check" checked={ante} onchange={(e) => { if (e.currentTarget.checked) campi[campo.id] = 1900; else delete campi[campo.id]; }} /> Anteriore al 1942</label>
    <label class="block">
      <span class="etichetta">{campo.etichetta}</span>
      <input type="text" inputmode="numeric" class="campo text-right" maxlength={len} value={ante ? '' : leggiNumero(campo.id)} disabled={ante} oninput={(e) => scriviNumero(campo.id, len, e)} title="dal 1942 in poi; prima, spuntare «Anteriore al 1942»" />
    </label>
  </div>
{:else if tipo === 'numero'}
  <label class="block">
    <span class="etichetta">{campo.etichetta}{campo.suffisso ? ` (${campo.suffisso})` : ''}</span>
    <input type="text" inputmode="numeric" class="campo text-right" maxlength={len} value={leggiNumero(campo.id)} oninput={(e) => scriviNumero(campo.id, len, e)} title={`massimo ${len} cifre`} />
  </label>
{:else}
  <label class="block">
    <span class="etichetta">{campo.etichetta}</span>
    <input type="text" class="campo" maxlength={len} value={leggiTesto(campo.id)} oninput={(e) => scriviTesto(campo.id, len, e)} title={`massimo ${len} caratteri`} />
  </label>
{/if}
