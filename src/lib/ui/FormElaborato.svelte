<script lang="ts">
  /**
   * Elaborato planimetrico: una o più schede, ognuna dal suo DXF (formato e scala dal riquadro), con l'anteprima
   * composta sul modello dell'Agenzia (EP2_A4 / EP2_A3) o l'immagine importata da Docfa.
   */
  import type { DisegnoElaborato, ElaboratoPlanimetrico, Pratica } from '$lib/core/model';
  import { preparaDxf } from '$lib/core/raster/dxf-correzioni';
  import { componiElaborato, type CartiglioElaborato } from '$lib/core/raster/planimetria';
  import { leggiTiff } from '$lib/core/raster/tiff';
  import type { Bitmap } from '$lib/core/raster/bitmap';
  import { ALBI, capitalizza } from '$lib/core/esporta';
  import { nomeProvincia } from '$lib/core/pdf/tabelle';
  import { decode1252 } from '$lib/core/bytes';
  import { scegliFile, leggiFile, nomeFile, conferma } from '$lib/piattaforma';
  import AnteprimaBitmap from './AnteprimaBitmap.svelte';
  import Avvisi from './Avvisi.svelte';
  import Campo from './Campo.svelte';
  import Icona from './Icona.svelte';

  let { ep, pratica }: { ep: ElaboratoPlanimetrico; pratica: Pratica } = $props();

  let corrente = $state(0);
  let bitmap = $state.raw<Bitmap | null>(null);
  let errore = $state<string | null>(null);
  let avvisi = $state<string[]>([]);
  let correzioni = $state<string[]>([]);
  let nomeDxf = $state<string | null>(null);
  let generazione = $state(false);
  let ultimo = '';

  const disegni = $derived(ep.disegni ?? []);
  const d = $derived<DisegnoElaborato | undefined>(disegni[corrente]);
  $effect(() => { if (corrente >= disegni.length) corrente = Math.max(0, disegni.length - 1); });

  function decodificaDxf(b: Uint8Array): string {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return decode1252(b); }
  }

  function cartiglio(scala: number): CartiglioElaborato {
    return {
      ufficio: capitalizza(nomeProvincia(pratica.comune.provincia)),
      comune: capitalizza(pratica.comune.nome),
      sezione: ep.identificativo.sezione,
      foglio: ep.identificativo.foglio,
      particella: ep.identificativo.numero,
      compilatore: `${capitalizza(pratica.tecnico.cognome)} ${capitalizza(pratica.tecnico.nome)}`,
      albo: ALBI[pratica.tecnico.albo] ?? 'Tecnico',
      provincia: capitalizza(nomeProvincia(pratica.tecnico.provinciaAlbo)),
      numeroAlbo: pratica.tecnico.numeroIscrizione.trim(),
      scala,
    };
  }

  async function anteprima(): Promise<void> {
    const x = d;
    errore = null;
    if (!x) { bitmap = null; return; }
    if (x.tiff && !x.dxf) {
      try { bitmap = leggiTiff(x.tiff).bitmap; } catch (e) { errore = `Immagine importata non leggibile: ${e instanceof Error ? e.message : String(e)}`; }
      return;
    }
    if (!x.dxf) { bitmap = null; return; }
    generazione = true;
    try {
      const r = await componiElaborato({ dxf: x.dxf, foglio: { formato: x.formato, scala: x.scala }, cartiglio: cartiglio(x.scala) });
      bitmap = r.bitmap;
      ultimo = x.dxf;
    } catch (e) {
      errore = `Anteprima non generata: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      generazione = false;
    }
  }

  $effect(() => {
    const x = d;
    if (!x) { bitmap = null; return; }
    if ((x.tiff && !x.dxf) || (x.dxf && x.dxf !== ultimo)) void anteprima();
  });

  function vai(k: number): void {
    corrente = k;
    bitmap = null; ultimo = ''; avvisi = []; correzioni = []; nomeDxf = null; errore = null;
  }

  async function caricaDxf(nuova: boolean): Promise<void> {
    const percorso = await scegliFile(nuova ? 'Scegli il DXF della nuova scheda dell\'elaborato' : `Scegli il DXF della scheda ${corrente + 1}`, [{ nome: 'Disegni DXF', estensioni: ['dxf', 'DXF'] }]);
    if (!percorso) return;
    try {
      const testo = decodificaDxf(await leggiFile(percorso));
      const r = preparaDxf(testo);
      correzioni = r.correzioni;
      avvisi = [...r.problemi];
      if (!r.foglio) { errore = 'Il riquadro del DXF non corrisponde a nessun formato e scala di Docfa'; return; }
      if (![100, 200, 500].includes(r.foglio.scala)) avvisi.push(`Scala 1:${r.foglio.scala} non prevista dai record Docfa (ammesse 100, 200, 500)`);
      const nuovo: DisegnoElaborato = { formato: r.foglio.formato, scala: r.foglio.scala as 100 | 200 | 500, dxf: testo };
      if (nuova || !d) {
        ep.disegni = [...disegni, nuovo];
        corrente = ep.disegni.length - 1;
      } else {
        if (d.tiff && !(await conferma('Questa scheda ha un\'immagine importata da Docfa: caricando il DXF verrà rigenerata. Continuare?'))) return;
        ep.disegni = disegni.map((x, i) => (i === corrente ? nuovo : x));
      }
      // le schede lette dal documento Docfa non servono più: l'indice allegati si ricava dai disegni
      ep.schede = undefined;
      nomeDxf = nomeFile(percorso);
      ultimo = '';
      errore = null;
    } catch (e) {
      errore = `DXF non leggibile: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function rimuovi(): Promise<void> {
    if (!d || !(await conferma(`Rimuovere la scheda ${corrente + 1} dell'elaborato?`))) return;
    ep.disegni = disegni.filter((_, i) => i !== corrente);
    if (!ep.disegni.length) ep.disegni = undefined;
    ep.schede = undefined;
    vai(Math.max(0, corrente - 1));
  }
</script>

<div class="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Schede dell'elaborato planimetrico">
  {#each disegni as x, k (k)}
    <button type="button" role="tab" aria-selected={corrente === k} class="btn btn-piccolo {corrente === k ? 'btn-primario' : ''}" onclick={() => vai(k)}>
      Scheda {k + 1} <span class="ml-1 opacity-70">{x.formato} 1:{x.scala}</span>
    </button>
  {/each}
  <button type="button" class="btn btn-piccolo" onclick={() => caricaDxf(true)}><Icona nome="importa" /> {disegni.length ? 'Aggiungi scheda (DXF)' : 'Carica DXF'}</button>
</div>

{#if d}
  <div class="grid gap-5 xl:grid-cols-[1fr_26rem]">
    <div class="space-y-3">
      <div class="grid gap-4 sm:grid-cols-3">
        <Campo etichetta="Immagine" aiuto="assegnata dal programma"><input class="campo font-mono" value={`${String(ep.progressivoImmagine).padStart(7, '0')}.${String(corrente + 1).padStart(3, '0')}`} disabled /></Campo>
        <Campo etichetta="Formato" aiuto={d.dxf ? 'rilevato dal riquadro' : ''}><input class="campo" value={d.formato} disabled /></Campo>
        <Campo etichetta="Scala" aiuto={d.dxf ? 'rilevata dal riquadro' : ''}><input class="campo" value={`1:${d.scala}`} disabled /></Campo>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn" onclick={() => caricaDxf(false)}><Icona nome="importa" /> {d.dxf ? 'Sostituisci DXF' : 'Carica DXF'}</button>
        {#if d.dxf}<button type="button" class="btn" onclick={anteprima} disabled={generazione}><Icona nome="ricarica" /> {generazione ? 'Generazione…' : 'Rigenera anteprima'}</button>{/if}
        <button type="button" class="btn btn-pericolo" onclick={rimuovi}><Icona nome="cestino" /> Rimuovi scheda</button>
      </div>
      {#if d.tiff && !d.dxf}
        <p class="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted"><Icona nome="immagine" /> Immagine importata da Docfa: verrà riusata tale e quale nel PDF.</p>
      {/if}
      {#if nomeDxf}<p class="text-xs text-fg-muted">DXF "{nomeDxf}"</p>{/if}
      {#if correzioni.length}
        <div class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
          <p class="mb-1 flex items-center gap-2 font-medium"><Icona nome="spunta" /> Corretto automaticamente</p>
          <ul class="list-disc space-y-0.5 pl-6 text-xs">{#each correzioni as c, i (i)}<li>{c}</li>{/each}</ul>
        </div>
      {/if}
      <Avvisi errori={errore ? [errore] : []} {avvisi} />
    </div>
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">Anteprima</h3>
      {#if bitmap}
        <AnteprimaBitmap {bitmap} larghezzaMax={700} />
      {:else}
        <div class="flex h-64 items-center justify-center rounded border border-dashed border-line text-sm text-fg-muted">{generazione ? 'Generazione in corso…' : 'Nessuna anteprima'}</div>
      {/if}
    </div>
  </div>
{:else}
  <p class="text-sm text-fg-muted">Carica il DXF della dimostrazione grafica dei subalterni: una scheda per file, formato e scala dal riquadro (come per le planimetrie).</p>
{/if}
