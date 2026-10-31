<script lang="ts">
  /** Dati metrici (NMVnnn.DAT): ambienti con tipo A-G, superficie e altezze. */
  import { poligoniPlanimetria, type Ambiente, type UnitaImmobiliare } from '$lib/core/model';
  import Icona from './Icona.svelte';

  let { unita = $bindable() }: { unita: UnitaImmobiliare } = $props();

  const TIPI: { tipo: Ambiente['tipo']; etichetta: string; percentuale: string }[] = [
    { tipo: 'A', etichetta: 'A – Vani principali e accessori diretti', percentuale: '100%' },
    { tipo: 'B', etichetta: 'B – Accessori indiretti comunicanti', percentuale: '50%' },
    { tipo: 'C', etichetta: 'C – Accessori indiretti non comunicanti', percentuale: '25%' },
    { tipo: 'D', etichetta: 'D – Balconi, terrazzi comunicanti', percentuale: '30% (10% oltre 25 mq)' },
    { tipo: 'E', etichetta: 'E – Balconi, terrazzi non comunicanti', percentuale: '15% (5% oltre 25 mq)' },
    { tipo: 'F', etichetta: 'F – Aree scoperte di pertinenza', percentuale: '10% (2% oltre la sup. dei vani)' },
    { tipo: 'G', etichetta: 'G – Altro', percentuale: '' },
    { tipo: 'H', etichetta: 'A2 – Accessori diretti di C/1 e C/6', percentuale: '' },
  ];
  const etichettaTipo = (t: Ambiente['tipo']) => TIPI.find((x) => x.tipo === t)?.etichetta ?? t;
  /** con i poligoni della planimetria gli ambienti sono calcolati e non si modificano a mano */
  const automatici = $derived(poligoniPlanimetria(unita.planimetria).length > 0);

  const totale = $derived(unita.ambienti.reduce((s, a) => s + (a.superficie || 0), 0));

  function aggiungi(): void {
    if (unita.ambienti.length >= 42) return;
    const ultimo = unita.ambienti[unita.ambienti.length - 1];
    unita.ambienti.push({ tipo: 'A', superficie: 0, altezzaMin: ultimo?.altezzaMin ?? 270, altezzaMax: ultimo?.altezzaMax ?? 270 });
  }

</script>

<div class="space-y-4">
  {#if automatici}
    <p class="rounded-md border border-accent-300/60 bg-accent-50 px-3 py-2 text-xs text-accent-900 dark:border-accent-700/60 dark:bg-accent-950/40 dark:text-accent-100">
      Calcolati dai {poligoniPlanimetria(unita.planimetria).length} poligoni della planimetria: un ambiente per tipo (le superfici dello stesso tipo si sommano). Per modificarli correggi i poligoni nel DXF o l'altezza nella planimetria.{#if unita.classamento?.superficieCatastale} Superficie catastale: <strong>{unita.classamento.superficieCatastale} mq</strong>.{/if}
    </p>
  {/if}
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-fg-muted">
          <th class="py-1 pr-2 text-left font-medium">#</th>
          <th class="py-1 pr-2 text-left font-medium">Tipo ambiente</th>
          <th class="w-28 py-1 pr-2 text-left font-medium">Sup. lorda (mq)</th>
          <th class="w-28 py-1 pr-2 text-left font-medium">{automatici ? 'Altezza' : 'Altezza min (cm)'}</th>
          <th class="w-28 py-1 pr-2 text-left font-medium">{automatici ? '' : 'Altezza max (cm)'}</th>
          <th class="w-10"></th>
        </tr>
      </thead>
      <tbody>
        {#each unita.ambienti as a, i (i)}
          <tr class="border-t border-line">
            <td class="py-1 pr-2 text-fg-faint">{i + 1}</td>
            {#if automatici}
              <td class="py-1.5 pr-2">{etichettaTipo(a.tipo)}</td>
              <td class="py-1.5 pr-2 text-right tabular-nums">{a.superficie}</td>
              <td class="py-1.5 pr-2 text-right tabular-nums">{a.altezzaMin === 149 ? '< 1,50 m' : a.altezzaMin === 150 ? '≥ 1,50 m' : '—'}</td>
              <td class="py-1.5 pr-2 text-right tabular-nums text-fg-faint">{a.altezzaMax || ''}</td>
              <td></td>
            {:else}
              <td class="py-1 pr-2">
                <select class="campo py-1" bind:value={a.tipo}>{#each TIPI as t (t.tipo)}<option value={t.tipo}>{t.etichetta}</option>{/each}</select>
              </td>
              <td class="py-1 pr-2"><input type="number" class="campo py-1 text-right" min="0" max="99999" bind:value={a.superficie} /></td>
              <td class="py-1 pr-2"><input type="number" class="campo py-1 text-right" min="0" max="9999" bind:value={a.altezzaMin} /></td>
              <td class="py-1 pr-2"><input type="number" class="campo py-1 text-right" min="0" max="9999" bind:value={a.altezzaMax} /></td>
              <td class="py-1"><button type="button" class="btn btn-piccolo btn-pericolo" onclick={() => unita.ambienti.splice(i, 1)} title="Elimina"><Icona nome="cestino" /></button></td>
            {/if}
          </tr>
        {/each}
        {#if !unita.ambienti.length}
          <tr><td colspan="6" class="py-3 text-center text-xs text-fg-faint">Nessun ambiente: carica il DXF della planimetria (con i poligoni) e vengono calcolati da soli.</td></tr>
        {/if}
      </tbody>
      <tfoot>
        <tr class="border-t border-line text-xs text-fg-muted"><td colspan="2" class="py-1.5 text-right">Totale</td><td class="py-1.5 pr-2 text-right font-medium">{totale} mq</td><td colspan="3"></td></tr>
      </tfoot>
    </table>
  </div>
  {#if !automatici}
    <button type="button" class="btn btn-piccolo" onclick={aggiungi} disabled={unita.ambienti.length >= 42}><Icona nome="piu" /> Aggiungi ambiente</button>
  {/if}
</div>
