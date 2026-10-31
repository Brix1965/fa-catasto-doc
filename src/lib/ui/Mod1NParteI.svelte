<script lang="ts" module>
  import type { Pratica } from '$lib/core/model';
  import type { VoceQuadro } from './SchedeQuadri.svelte';
  import { SEZIONI_1N_PARTE_I } from '$lib/stato/mod1n-sezioni';
  /** Quadri del modello 1N parte I con lo stato di compilazione. */
  export function quadri1NParteI(p: Pratica): VoceQuadro[] {
    const m = p.mod1NParteI;
    return SEZIONI_1N_PARTE_I.map((s) => ({
      id: s.id, sigla: s.sigla ?? '', titolo: s.titolo, obbligatorio: s.obbligatorio,
      completo: !!m && !!s.completo?.(s.rec === 'B' ? m.recordB : m.recordC),
    }));
  }
</script>

<script lang="ts">
  /** Modello 1N parte I (fabbricato): un quadro alla volta, generato dai record B e C. */
  import { TIPI_AFFACCIO } from '$lib/stato/mod1n-sezioni';
  import CampoRecord from './CampoRecord.svelte';

  let { pratica = $bindable(), quadro }: { pratica: Pratica; quadro: string } = $props();
  const s = $derived(SEZIONI_1N_PARTE_I.find((x) => x.id === quadro) ?? SEZIONI_1N_PARTE_I[0]);
  const m = $derived(pratica.mod1NParteI!);
  const flagB = (id: string) => m.recordB[id] === 1;
  function impostaFlagB(id: string, v: boolean): void {
    if (v) m.recordB[id] = 1;
    else delete m.recordB[id];
  }
</script>

<div class="space-y-5">
  <div>
    <h3 class="text-sm font-semibold">[{s.sigla}] {s.titolo}</h3>
    {#if s.descrizione}<p class="mt-0.5 text-xs text-fg-muted">{s.descrizione}</p>{/if}
  </div>
  {#if s.facciate}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-fg-muted">
            <th class="py-1 pr-3 text-left font-medium">Tipo di affaccio</th>
            {#each [1, 2, 3, 4] as f (f)}<th class="w-20 py-1 text-center font-medium">Facciata {f}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each TIPI_AFFACCIO as t (t.id)}
            <tr class="border-t border-line">
              <td class="py-1.5 pr-3">{t.etichetta}</td>
              {#each [1, 2, 3, 4] as f (f)}
                <td class="py-1.5 text-center"><input type="checkbox" class="check" checked={flagB(`facciata${f}_${t.id}`)} onchange={(e) => impostaFlagB(`facciata${f}_${t.id}`, e.currentTarget.checked)} aria-label={`${t.etichetta}, facciata ${f}`} /></td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  {#each s.gruppi as g, gi (gi)}
    <div>
      {#if g.titolo}<h4 class="mb-2 text-xs font-semibold {g.obbligatorio ? 'obbligatorio' : 'text-fg-muted'}">{g.titolo}</h4>{/if}
      <div class={g.disposizione === 'riga' ? 'flex flex-wrap gap-3 [&>*]:w-36' : 'grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3'}>
        {#each g.campi as c (c.id)}
          {#if s.rec === 'B'}
            <CampoRecord rec="B" campo={c} bind:campi={m.recordB} />
          {:else}
            <CampoRecord rec="C" campo={c} bind:campi={m.recordC} />
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>
