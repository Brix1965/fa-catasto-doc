<script lang="ts">
  /**
   * Importazione di una visura catastale PDF (Sister): l'elenco degli immobili letti, da scegliere; quelli scelti
   * diventano u.i.u. della pratica (o aggiornano quelle con lo stesso identificativo) con identificativo,
   * indirizzo e piani e il classamento in atti; in variazione anche le classi più elevate del fabbricato per il
   * classamento automatico. Tutto resta modificabile negli schermi della pratica.
   */
  import type { Pratica, UnitaImmobiliare } from '$lib/core/model';
  import type { ImmobileVisura, Visura } from '$lib/core/visura/tipi';
  import { nuovaUnita } from '$lib/stato/pratica-file';
  import { leggiFile, scegliFile } from '$lib/piattaforma';
  import Icona from './Icona.svelte';

  let { pratica = $bindable(), aperto = $bindable(), onfatto }: { pratica: Pratica; aperto: boolean; onfatto?: (indice: number) => void } = $props();

  let visura = $state.raw<Visura | null>(null);
  let errore = $state('');
  let lettura = $state(false);
  let scelti = $state<boolean[]>([]);
  let operazioni = $state<('V' | 'S')[]>([]);
  let classi = $state(true);
  const acc = $derived(pratica.tipoDocumento === 'accatastamento');

  const stessoId = (u: UnitaImmobiliare, i: ImmobileVisura) =>
    (u.identificativo.sezione ?? '') === (i.sezione ?? '') && u.identificativo.foglio === i.foglio && u.identificativo.numero === i.numero && (u.identificativo.subalterno ?? '') === (i.subalterno ?? '');
  const esistente = (i: ImmobileVisura) => pratica.unita.findIndex((u) => stessoId(u, i));

  async function scegli(): Promise<void> {
    errore = '';
    const percorso = await scegliFile('Scegli la visura (PDF scaricato da Sister)', [{ nome: 'Visura PDF', estensioni: ['pdf', 'PDF'] }]);
    if (!percorso) return;
    lettura = true;
    try {
      const { leggiVisura } = await import('$lib/core/visura');
      const v = await leggiVisura(await leggiFile(percorso));
      if (!v.immobili.length) throw new Error('Nella visura non ho trovato immobili del Catasto Fabbricati.');
      visura = v;
      // proposti: gli immobili del comune della pratica già presenti, oppure tutti quelli del comune se la pratica è vuota
      const vuota = pratica.unita.every((u) => !u.identificativo.foglio);
      scelti = v.immobili.map((i) => esistente(i) >= 0 || (vuota && (!pratica.comune.codice || i.comune.codice === pratica.comune.codice)));
      operazioni = v.immobili.map(() => 'V');
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    } finally {
      lettura = false;
    }
  }

  function importa(): void {
    if (!visura) return;
    const { inAttiDaVisura, classiPiuElevate } = MODULO!;
    let prima = -1;
    // le u.i.u. vuote (create con la pratica) si riusano
    const vuote = pratica.unita.map((u, k) => (!u.identificativo.foglio && !u.identificativo.numero ? k : -1)).filter((k) => k >= 0);
    visura.immobili.forEach((im, k) => {
      if (!scelti[k]) return;
      let idx = esistente(im);
      let u: UnitaImmobiliare;
      if (idx >= 0) u = pratica.unita[idx];
      else if (vuote.length) { idx = vuote.shift()!; u = pratica.unita[idx]; }
      else { u = nuovaUnita(acc ? 'C' : operazioni[k]); pratica.unita.push(u); idx = pratica.unita.length - 1; }
      if (!acc) u.operazione = operazioni[k];
      u.identificativo = { sezione: im.sezione || undefined, foglio: im.foglio, numero: im.numero, subalterno: im.subalterno || undefined };
      if (!acc) u.inAtti = inAttiDaVisura(im);
      if (u.operazione === 'S') { u.classamento = undefined; u.mod1NParteII = undefined; }
      else if (im.indirizzo && (!u.indirizzo?.toponimo)) {
        u.indirizzo = { toponimo: im.indirizzo.toponimo, civici: im.indirizzo.civici.slice(0, 3), piani: im.indirizzo.piani.slice(0, 4), scala: im.indirizzo.scala, interno: im.indirizzo.interno, lotto: im.indirizzo.lotto, edificio: im.indirizzo.edificio };
      }
      if (u.classamento && im.zonaCensuaria && !u.classamento.zonaCensuaria) u.classamento.zonaCensuaria = im.zonaCensuaria;
      if (prima < 0) prima = idx;
    });
    if (!acc && classi) {
      const c = classiPiuElevate(visura.immobili);
      if (c.length) pratica.classiFabbricato = c;
    }
    aperto = false;
    visura = null;
    if (prima >= 0) onfatto?.(prima);
  }

  let MODULO = $state.raw<typeof import('$lib/core/visura') | null>(null);
  $effect(() => { if (aperto && !MODULO) void import('$lib/core/visura').then((m) => (MODULO = m)); });

  const nScelti = $derived(scelti.filter(Boolean).length);
  const idTesto = (i: ImmobileVisura) => `${i.sezione ? `sez. ${i.sezione} ` : ''}fg. ${i.foglio} p.lla ${i.numero}${i.subalterno ? ` sub ${i.subalterno}` : ''}`;
  const euro = (n?: number) => (n === undefined ? '' : `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  function tasti(e: KeyboardEvent): void { if (aperto && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); aperto = false; } }
</script>

<svelte:window onkeydowncapture={tasti} />

{#if aperto}
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Importa da visura">
    <div class="w-full max-w-5xl rounded-lg border border-line bg-surface shadow-xl">
      <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <h2 class="text-base font-semibold">Importa da visura catastale</h2>
          <p class="mt-0.5 text-xs text-fg-muted">PDF scaricato da Sister (visura per soggetto o per immobile, Catasto Fabbricati). Gli immobili scelti diventano u.i.u. con identificativo, indirizzo, piani{acc ? '' : ' e classamento in atti'}; tutto resta modificabile.</p>
        </div>
        <button type="button" class="btn btn-piccolo" onclick={() => (aperto = false)} title="Chiudi (Esc)"><Icona nome="x" /></button>
      </header>
      <div class="space-y-3 p-5">
        <button type="button" class="btn btn-primario" onclick={scegli} disabled={lettura}><Icona nome="pdf" /> {lettura ? 'Lettura…' : visura ? 'Scegli un\'altra visura' : 'Scegli la visura PDF'}</button>
        {#if errore}<p class="text-sm text-red-700 dark:text-red-300">{errore}</p>{/if}
        {#if visura}
          <p class="text-xs text-fg-muted">{visura.titolo ?? 'Visura'}{visura.situazioneAl ? `, situazione al ${visura.situazioneAl}` : ''}: {visura.immobili.length} immobili.</p>
          {#each visura.avvisi as a, i (i)}<p class="text-xs text-amber-700 dark:text-amber-300">{a}</p>{/each}
          <div class="max-h-[55vh] overflow-auto rounded-md border border-line">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-surface-2 text-left text-xs text-fg-muted">
                <tr><th class="px-2 py-1.5"><input type="checkbox" class="check" checked={nScelti === scelti.length} onchange={(e) => { const v = e.currentTarget.checked; scelti = scelti.map(() => v); }} aria-label="Tutti" /></th><th class="py-1.5 pr-2">Identificativo</th><th class="py-1.5 pr-2">Categoria</th><th class="py-1.5 pr-2">Consistenza</th><th class="py-1.5 pr-2 text-right">Rendita</th><th class="py-1.5 pr-2">Indirizzo</th>{#if !acc}<th class="py-1.5 pr-2">Operazione</th>{/if}</tr>
              </thead>
              <tbody>
                {#each visura.immobili as im, k (k)}
                  <tr class="border-t border-line {scelti[k] ? '' : 'text-fg-muted'}">
                    <td class="px-2 py-1"><input type="checkbox" class="check" bind:checked={scelti[k]} aria-label={`Importa ${idTesto(im)}`} /></td>
                    <td class="py-1 pr-2 whitespace-nowrap">{idTesto(im)}{#if esistente(im) >= 0}<span class="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-100" title="già nella pratica: verrà aggiornata">già presente</span>{/if}{#if im.comune.codice !== pratica.comune.codice && pratica.comune.codice}<span class="ml-1 text-[10px] text-amber-700">{im.comune.nome}</span>{/if}</td>
                    <td class="py-1 pr-2">{im.categoria}{im.classe ? ` cl. ${im.classe}` : ''}</td>
                    <td class="py-1 pr-2 whitespace-nowrap">{im.consistenza ?? ''} {im.unitaConsistenza ?? ''}</td>
                    <td class="py-1 pr-2 text-right tabular-nums whitespace-nowrap">{euro(im.rendita)}</td>
                    <td class="py-1 pr-2 text-xs">{im.indirizzo?.toponimo ?? ''}{im.indirizzo?.civici.length ? ` n. ${im.indirizzo.civici.join('-')}` : ''}{im.indirizzo?.piani.length ? ` · piano ${im.indirizzo.piani.join(', ')}` : ''}</td>
                    {#if !acc}<td class="py-1 pr-2"><select class="campo campo-piccolo w-28" bind:value={operazioni[k]}><option value="V">variata</option><option value="S">soppressa</option></select></td>{/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if !acc}<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={classi} /> Usa le classi più elevate per categoria per il classamento automatico (dati del fabbricato)</label>{/if}
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" onclick={() => (aperto = false)}>Annulla</button>
            <button type="button" class="btn btn-primario" onclick={importa} disabled={!nScelti || !MODULO}><Icona nome="importa" /> Importa {nScelti} {nScelti === 1 ? 'immobile' : 'immobili'}</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
