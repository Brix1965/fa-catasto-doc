<script lang="ts">
  /**
   * Gestione elaborati grafici: per ogni u.i.u. l'associazione della planimetria (DXF) e i poligoni per il
   * calcolo della superficie; l'elaborato planimetrico del fabbricato.
   */
  import type { Pratica } from '$lib/core/model';
  import { descriviUnita, motiviElaboratoObbligatorio } from '$lib/stato/validazione';
  import { sincronizzaDaPoligoni } from '$lib/core/superfici';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { conferma } from '$lib/piattaforma';
  import Campo from '../Campo.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';
  import FormPlanimetria from '../FormPlanimetria.svelte';
  import FormAmbienti from '../FormAmbienti.svelte';
  import FormElaborato from '../FormElaborato.svelte';

  let { pratica = $bindable(), selezionata = $bindable(0) }: { pratica: Pratica; selezionata?: number } = $props();
  const motiviEp = $derived(motiviElaboratoObbligatorio(pratica));
  const elenco = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione !== 'S'));
  const corrente = $derived(elenco.find((x) => x.i === selezionata) ?? elenco[0]);

  $effect(() => { for (const u of pratica.unita) sincronizzaDaPoligoni(u); });

  const statoPoligoni = (i: number) => {
    const pl = pratica.unita[i].planimetria;
    if (!pl) return '';
    if (pl.poligoni.length || pl.ntf !== undefined || (pl.altreSchede ?? []).some((s) => s.poligoni.length || s.ntf)) return 'Ok';
    return 'da calcolare';
  };
  function elaborato(): void {
    const u = pratica.unita.find((x) => x.operazione !== 'S');
    const usati = pratica.unita.map((x) => x.planimetria?.progressivo ?? 0);
    pratica.elaboratoPlanimetrico = {
      identificativo: { sezione: u?.identificativo.sezione, foglio: u?.identificativo.foglio ?? '', numero: u?.identificativo.numero ?? '' },
      progressivoImmagine: impostazioni.nuovaImmagine(usati.filter((x) => x > 0)),
      subalterni: [],
    };
  }
</script>

<div class="space-y-5">
  <div class="grid gap-5 lg:grid-cols-[19rem_1fr]">
    <aside class="scheda self-start p-3 lg:sticky lg:top-4">
      <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Unità immobiliari</h2>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-fg-muted"><th class="py-1 font-medium">U.I.U.</th><th class="font-medium">Plan.</th><th class="font-medium">Polig.</th></tr></thead>
        <tbody>
          {#each elenco as { u, i } (i)}
            <tr class="cursor-pointer border-t border-line hover:bg-surface-2 {corrente?.i === i ? 'bg-accent-50 dark:bg-accent-950' : ''}" onclick={() => (selezionata = i)}>
              <td class="py-1.5 pr-2"><span class="text-xs text-fg-faint">{i + 1}</span> {u.identificativo.foglio}/{u.identificativo.numero}{u.identificativo.subalterno ? `/${u.identificativo.subalterno}` : ''}</td>
              <td>{u.planimetria ? 'SI' : ''}</td>
              <td class="text-xs {statoPoligoni(i) === 'Ok' ? 'text-accent-700 dark:text-accent-300' : 'text-amber-700 dark:text-amber-300'}">{statoPoligoni(i)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if !elenco.length}<p class="py-3 text-xs text-fg-faint">Nessuna unità nel quadro U.</p>{/if}
    </aside>

    {#if corrente}
      {@const i = corrente.i}
      <div class="space-y-5">
        <Sezione titolo={`Associazione planimetria – ${descriviUnita(pratica.unita[i], i)}`} descrizione="Disegno vettoriale DXF: formato e scala dal riquadro; i poligoni del layer Docfa_Poligoni danno le superfici.">
          <FormPlanimetria bind:unita={pratica.unita[i]} {pratica} />
        </Sezione>
        {#if pratica.unita[i].planimetria}
          <Sezione titolo="Dati metrici" descrizione="Superfici per tipologia di ambiente, ricavate dai poligoni: alimentano il modello 1N parte II e la superficie catastale.">
            <FormAmbienti bind:unita={pratica.unita[i]} />
          </Sezione>
        {/if}
      </div>
    {/if}
  </div>

  <Sezione titolo="Elaborato planimetrico" descrizione={motiviEp.length ? `Obbligatorio in questo documento: ${motiviEp.join('; ')}.` : "Non obbligatorio in questo documento (lo diventa con due o più unità costituite, unità in categoria F o beni comuni non censibili); si può allegare comunque."}>
    {#snippet azioni()}
      {#if pratica.elaboratoPlanimetrico}
        <button type="button" class="btn btn-piccolo btn-pericolo" onclick={async () => { if (await conferma("Rimuovere l'elaborato planimetrico e l'elenco subalterni?")) pratica.elaboratoPlanimetrico = undefined; }}><Icona nome="cestino" /> Rimuovi</button>
      {/if}
    {/snippet}
    {#if pratica.elaboratoPlanimetrico}
      {@const ep = pratica.elaboratoPlanimetrico}
      <div class="grid gap-4 sm:grid-cols-4">
        <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" value={ep.identificativo.sezione ?? ''} onchange={(e) => (ep.identificativo.sezione = e.currentTarget.value.trim().toUpperCase() || undefined)} /></Campo>
        <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo" maxlength="4" bind:value={ep.identificativo.foglio} /></Campo>
        <Campo etichetta="Particella" obbligatorio><input type="text" class="campo" maxlength="5" bind:value={ep.identificativo.numero} /></Campo>
        <Campo etichetta="Immagine" aiuto="assegnata dal programma"><input class="campo font-mono" value={`${String(ep.progressivoImmagine).padStart(7, '0')}.001`} disabled /></Campo>
      </div>
      <div class="mt-4"><FormElaborato {ep} {pratica} /></div>
      <p class="mt-3 flex items-center gap-2 text-xs text-fg-muted"><Icona nome="info" /> L'elenco subalterni si compila nella funzione «Elenco subalterni».</p>
    {:else}
      <button type="button" class="btn" onclick={elaborato}><Icona nome="piu" /> Associa elaborato planimetrico</button>
    {/if}
  </Sezione>
</div>
