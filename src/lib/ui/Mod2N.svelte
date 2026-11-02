<script lang="ts" module>
  import type { UnitaImmobiliare } from '$lib/core/model';
  import { controlli2N } from '$lib/core/stima-2n';
  import type { VoceQuadro } from './SchedeQuadri.svelte';
  const pieno = (o: Record<string, unknown> | undefined) => !!o && Object.values(o).some((v) => v !== '' && v !== 0 && v !== undefined);
  /** Quadri del modello 2N (parte I e, per ogni corpo di fabbrica, parte II). */
  export function quadri2N(u: UnitaImmobiliare): VoceQuadro[] {
    const d = u.mod2N;
    const q: VoceQuadro[] = [
      { id: 'm1', sigla: 'I-A', titolo: "Riferimenti e azienda", obbligatorio: true, completo: !!d && (pieno({ a: d.recordM.ceu_foglio }) || pieno({ a: d.recordM.ct_foglio })) && !!d.recordM.anno_costruzione },
      { id: 'm2', sigla: 'I-B', titolo: 'Collegamenti e impianti', completo: pieno(d?.recordM) },
      { id: 'n1', sigla: 'I-C', titolo: 'Sistemazioni esterne e dati metrici', obbligatorio: true, completo: !!d && Number(d.recordN.area_totale_lorda) > 0 },
      { id: 'n2', sigla: 'I-H', titolo: 'Stima e rendita', obbligatorio: true, completo: !!d && Number(d.recordN.rendita_catastale) > 0 && !controlli2N(d).length },
    ];
    (d?.corpi ?? []).forEach((c, k) => {
      q.push({ id: `p${k}`, sigla: `II-${k + 1}`, titolo: `Corpo ${k + 1}: caratteristiche`, obbligatorio: true, completo: pieno(c.recordP) });
      q.push({ id: `q${k}`, sigla: `II-${k + 1}`, titolo: `Corpo ${k + 1}: dati metrici e impianti`, obbligatorio: true, completo: pieno(c.recordQ) });
    });
    return q;
  }
</script>

<script lang="ts">
  /** Modello 2N (u.i.u. a destinazione speciale o particolare): parte I e corpi di fabbrica (parte II). */
  import type { Campi } from '$lib/core/model';
  import { campiRecord } from '$lib/stato/mod1n-sezioni';
  import CampoRecord from './CampoRecord.svelte';
  import Icona from './Icona.svelte';
  import Stima2N from './Stima2N.svelte';

  let { unita = $bindable(), quadro }: { unita: UnitaImmobiliare; quadro: string } = $props();
  const d = $derived(unita.mod2N!);
  // campiRecord(rec, escludi): la funzione indica i campi da TOGLIERE
  /** riferimenti, anni, azienda */
  const M_RIF = campiRecord('M', (id) => /^(coll_|imp_|pav_|categoria_alfabetica)/.test(id));
  /** collegamenti, impianti, pavimentazioni */
  const M_COLL = campiRecord('M', (id) => !/^(coll_|imp_|pav_)/.test(id));
  /** sistemazioni esterne e dati metrici (gli importi sono nello schermo «Stima e rendita») */
  const N_METRICI = campiRecord('N', (id) => /^(valore_|valutazione|saggio|rendita|anno_epoca)/.test(id));
  const P = campiRecord('P');
  const Q = campiRecord('Q');
  const R = campiRecord('R');
  function aggiungiCorpo(): void { d.corpi.push({ recordP: {}, recordQ: {}, recordR: {} }); }
  const indiceCorpo = $derived(Number(quadro.slice(1)));
</script>

{#snippet griglia(rec: 'M' | 'N' | 'O' | 'P' | 'Q' | 'R', campi: ReturnType<typeof campiRecord>, valori: Campi)}
  <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
    {#each campi as c (c.id)}
      <CampoRecord {rec} campo={c} campi={valori} />
    {/each}
  </div>
{/snippet}

{#if quadro === 'm1'}
  {@render griglia('M', M_RIF, d.recordM)}
{:else if quadro === 'm2'}
  {@render griglia('M', M_COLL, d.recordM)}
{:else if quadro === 'n1'}
  {@render griglia('N', N_METRICI, d.recordN)}
{:else if quadro === 'n2' || quadro === 'o'}
  <Stima2N bind:unita />
{:else if quadro.startsWith('p') && d.corpi[indiceCorpo]}
  {@render griglia('P', P, d.corpi[indiceCorpo].recordP)}
{:else if quadro.startsWith('q') && d.corpi[indiceCorpo]}
  <div class="space-y-5">
    {@render griglia('Q', Q, d.corpi[indiceCorpo].recordQ)}
    {@render griglia('R', R, d.corpi[indiceCorpo].recordR)}
  </div>
{/if}
{#if quadro === 'n2' || quadro.startsWith('q')}
  <div class="mt-5"><button type="button" class="btn btn-piccolo" onclick={aggiungiCorpo}><Icona nome="piu" /> Corpo di fabbrica (2N parte II)</button></div>
{/if}
