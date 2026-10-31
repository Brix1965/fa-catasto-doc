<script lang="ts">
  /**
   * Planimetria della u.i.u.: caricamento del DXF, formato/scala rilevati dal riquadro, poligoni
   * del layer DOCFA_POLIGONI con superficie, anteprima dell'immagine composta (o del TIFF importato).
   */
  import type { Planimetria, Pratica, SchedaGrafica, TipoAmbientePoligono, UnitaImmobiliare } from '$lib/core/model';
  import type { DxfLetto } from '$lib/core/raster/dxf';
  import { preparaDxf } from '$lib/core/raster/dxf-correzioni';
  import { componiPlanimetria, type Cartiglio } from '$lib/core/raster/planimetria';
  import { leggiTiff } from '$lib/core/raster/tiff';
  import type { Bitmap } from '$lib/core/raster/bitmap';
  import { leggiNtf, areaDaNtf, dxfToPx } from '$lib/core/ntf';
  import { areaPoligono, haAltezza } from '$lib/core/superfici';
  import { ALBI, capitalizza } from '$lib/core/esporta';
  import { nomeProvincia } from '$lib/core/pdf/tabelle';
  import { decode1252 } from '$lib/core/bytes';
  import { scegliFile, leggiFile, nomeFile, conferma } from '$lib/piattaforma';
  import AnteprimaBitmap from './AnteprimaBitmap.svelte';
  import Avvisi from './Avvisi.svelte';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from './Campo.svelte';
  import Icona from './Icona.svelte';

  /** $ACADVER → versione di AutoCAD */
  const VERSIONI_ACAD: Record<string, string> = { AC1009: 'R12', AC1012: 'R13', AC1014: 'R14', AC1015: 'AutoCAD 2000', AC1018: 'AutoCAD 2004', AC1021: 'AutoCAD 2007', AC1024: 'AutoCAD 2010', AC1027: 'AutoCAD 2013', AC1032: 'AutoCAD 2018' };

  let { unita = $bindable(), pratica }: { unita: UnitaImmobiliare; pratica: Pratica } = $props();

  let errore = $state<string | null>(null);
  let avvisiDxf = $state<string[]>([]);
  let correzioniDxf = $state<string[]>([]);
  let infoDxf = $state<{ nome?: string; entita: number; versione: string; origineInZero: boolean } | null>(null);
  let bitmap = $state.raw<Bitmap | null>(null);
  let generazione = $state(false);
  let ultimoDxfAnteprima = '';

  const pl = $derived(unita.planimetria);
  /** scheda mostrata: 0 = la prima (campi della planimetria), k = altreSchede[k - 1] */
  let schedaCorrente = $state(0);
  const nSchede = $derived(pl ? 1 + (pl.altreSchede?.length ?? 0) : 0);
  /** la scheda corrente: la planimetria stessa (scheda 1) o una delle altre, con gli stessi campi */
  const sc = $derived<Planimetria | SchedaGrafica | undefined>(pl ? (schedaCorrente === 0 ? pl : pl.altreSchede?.[schedaCorrente - 1]) : undefined);
  $effect(() => { if (schedaCorrente >= nSchede) schedaCorrente = Math.max(0, nSchede - 1); });

  function prossimoProgressivo(): number {
    const usati = pratica.unita.map((u) => u.planimetria?.progressivo ?? 0);
    const ep = pratica.elaboratoPlanimetrico?.progressivoImmagine ?? 0;
    return impostazioni.nuovaImmagine([...usati, ep].filter((x) => x > 0));
  }
  function aggiungi(): void {
    unita.planimetria = { progressivo: prossimoProgressivo(), formato: 'A4', scala: 200, poligoni: [] };
    schedaCorrente = 0;
    bitmap = null;
  }
  function aggiungiScheda(): void {
    const p = unita.planimetria;
    if (!p) return;
    p.altreSchede = [...(p.altreSchede ?? []), { formato: p.formato, scala: p.scala, poligoni: [] }];
    // le schede lette da un documento Docfa non servono più: l'indice allegati si ricava dalle schede
    p.schede = undefined;
    schedaCorrente = p.altreSchede.length;
    bitmap = null; infoDxf = null; ultimoDxfAnteprima = '';
  }
  async function rimuoviScheda(): Promise<void> {
    const p = unita.planimetria;
    if (!p || schedaCorrente === 0 || !(await conferma(`Rimuovere la scheda ${schedaCorrente + 1}?`))) return;
    p.altreSchede = p.altreSchede?.filter((_, i) => i !== schedaCorrente - 1);
    if (!p.altreSchede?.length) p.altreSchede = undefined;
    p.schede = undefined;
    schedaCorrente -= 1;
    bitmap = null; infoDxf = null; ultimoDxfAnteprima = '';
  }
  function vaiAScheda(k: number): void {
    schedaCorrente = k;
    selezionato = null;
    bitmap = null; infoDxf = null; avvisiDxf = []; correzioniDxf = []; ultimoDxfAnteprima = '';
  }
  async function rimuovi(): Promise<void> {
    if (await conferma('Rimuovere la planimetria di questa unità?')) { unita.planimetria = undefined; bitmap = null; infoDxf = null; }
  }

  /** Decodifica il DXF: UTF-8 se valido, altrimenti Windows-1252 (AutoCAD vecchio). */
  function decodificaDxf(b: Uint8Array): string {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return decode1252(b); }
  }

  function analizza(testo: string, nome?: string, nuovo = false): DxfLetto | null {
    avvisiDxf = [];
    correzioniDxf = [];
    errore = null;
    try {
      const { letto, foglio: f, correzioni, problemi } = preparaDxf(testo);
      const p = sc;
      if (!p) return null;
      correzioniDxf = correzioni;
      avvisiDxf = [...problemi];
      if (f) {
        p.formato = f.formato;
        p.scala = f.scala as 100 | 200 | 500;
        if (![100, 200, 500].includes(f.scala)) avvisiDxf.push(`Scala 1:${f.scala} non prevista dai record Docfa (ammesse 100, 200, 500)`);
      }
      infoDxf = { nome, entita: letto.entita.length, versione: letto.versione, origineInZero: true };
      if (!letto.poligoni.length) avvisiDxf.push('Nessun poligono sul layer DOCFA_POLIGONI: servono per il calcolo della superficie');
      if (!letto.entita.length) avvisiDxf.push('Il DXF non contiene oggetti disegnabili');
      // alla riapertura si tengono i poligoni salvati (tipo cambiato, poligoni eliminati); si rileggono solo con un DXF nuovo
      if (nuovo || !p.poligoni.length) p.poligoni = letto.poligoni;
      return letto;
    } catch (e) {
      errore = `DXF non leggibile: ${e instanceof Error ? e.message : String(e)}`;
      return null;
    }
  }

  async function caricaDxf(): Promise<void> {
    const percorso = await scegliFile(nSchede > 1 ? `Scegli il DXF della scheda ${schedaCorrente + 1}` : 'Scegli il DXF della planimetria', [{ nome: 'Disegni DXF', estensioni: ['dxf', 'DXF'] }]);
    const s = sc;
    if (!percorso || !s) return;
    try {
      const testo = decodificaDxf(await leggiFile(percorso));
      if (s.tiff && !(await conferma('Questa scheda ha un\'immagine importata da Docfa: caricando il DXF verrà rigenerata. Continuare?'))) return;
      s.dxf = testo;
      s.tiff = undefined;
      s.ntf = undefined;
      if (unita.planimetria) unita.planimetria.schede = undefined;
      const letto = analizza(testo, nomeFile(percorso), true);
      selezionato = null;
      if (letto) await genera(letto);
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    }
  }

  function cartiglio(): Cartiglio {
    const p = unita.planimetria!;
    return {
      ufficio: capitalizza(nomeProvincia(pratica.comune.provincia)),
      comune: capitalizza(pratica.comune.nome),
      via: unita.indirizzo ? capitalizza(unita.indirizzo.toponimo) : '',
      civico: unita.indirizzo?.civici[0] ?? '',
      sezione: unita.identificativo.sezione,
      foglio: unita.identificativo.foglio,
      particella: unita.identificativo.numero,
      subalterno: unita.identificativo.subalterno,
      compilatore: `${capitalizza(pratica.tecnico.cognome)} ${capitalizza(pratica.tecnico.nome)}`,
      albo: ALBI[pratica.tecnico.albo] ?? 'Tecnico',
      provincia: capitalizza(nomeProvincia(pratica.tecnico.provinciaAlbo)),
      numeroAlbo: pratica.tecnico.numeroIscrizione.trim(),
      scheda: schedaCorrente + 1,
      scala: sc?.scala ?? p.scala,
    };
  }

  async function genera(letto?: DxfLetto): Promise<void> {
    const p = sc;
    if (!p) return;
    errore = null;
    if (p.tiff && !p.dxf) {
      try { bitmap = leggiTiff(p.tiff).bitmap; } catch (e) { errore = `TIFF importato non leggibile: ${e instanceof Error ? e.message : String(e)}`; }
      return;
    }
    if (!p.dxf) return;
    generazione = true;
    try {
      const composta = await componiPlanimetria({ dxf: letto ?? p.dxf, foglio: { formato: p.formato, scala: p.scala }, cartiglio: cartiglio() });
      bitmap = composta.bitmap;
      ultimoDxfAnteprima = p.dxf;
    } catch (e) {
      errore = `Anteprima non generata: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      generazione = false;
    }
  }

  // all'apertura: anteprima del TIFF importato o analisi del DXF già salvato
  $effect(() => {
    const p = sc;
    if (!p) { bitmap = null; return; }
    if (p.tiff && !p.dxf) void genera();
    else if (p.dxf && p.dxf !== ultimoDxfAnteprima) { analizza(p.dxf); void genera(); }
  });

  const area = areaPoligono;

  /** poligono selezionato (indice in sc.poligoni), evidenziato sull'anteprima e nella tabella */
  let selezionato = $state<number | null>(null);
  /** colori dei tipi come nel DXF di Docfa (1 rosso … 8 grigio) */
  const COLORE_TIPO: Record<string, string> = { A: '#e11d48', B: '#ca8a04', C: '#16a34a', D: '#0891b2', E: '#2563eb', F: '#c026d3', G: '#475569', H: '#78716c' };
  const puntiSvg = (v: [number, number][], f: { formato: 'A4' | 'A3'; scala: 100 | 200 | 500 }) =>
    v.map(([x, y]) => dxfToPx(x, y, f).map((n) => n.toFixed(1)).join(',')).join(' ');
  function seleziona(i: number | null): void {
    selezionato = i;
    if (i !== null) document.getElementById(`poligono-${i}`)?.scrollIntoView({ block: 'nearest' });
  }
  function eliminaPoligono(i: number): void {
    const s = sc;
    if (!s) return;
    s.poligoni = s.poligoni.filter((_, k) => k !== i);
    selezionato = null;
  }
  const NOMI_TIPO: Record<string, string> = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'A2' };

  const poligoniNtf = $derived.by(() => {
    const p = sc;
    if (!p?.ntf?.length || p.poligoni.length) return [];
    try { const n = leggiNtf(p.ntf); return n.poligoni.map((x) => ({ tipo: x.tipo, area: areaDaNtf(x.punti, p.scala), altezza: x.altezza })); } catch { return []; }
  });

</script>

{#if !pl}
  <div class="flex flex-col items-start gap-3">
    <p class="text-sm text-fg-muted">Nessuna planimetria allegata a questa unità.</p>
    <button type="button" class="btn btn-primario" onclick={aggiungi}><Icona nome="piu" /> Aggiungi planimetria</button>
  </div>
{:else if sc}
  <div class="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Schede della planimetria">
    {#each Array.from({ length: nSchede }, (_, k) => k) as k (k)}
      {@const s = k === 0 ? pl : pl.altreSchede?.[k - 1]}
      <button type="button" role="tab" aria-selected={schedaCorrente === k} class="btn btn-piccolo {schedaCorrente === k ? 'btn-primario' : ''}" onclick={() => vaiAScheda(k)}>
        Scheda {k + 1}{#if s && !s.dxf && !s.tiff}<span class="ml-1 text-amber-600" title="senza disegno">•</span>{/if}
      </button>
    {/each}
    <button type="button" class="btn btn-piccolo" onclick={aggiungiScheda} title="Planimetria su più fogli (es. un piano per scheda)"><Icona nome="piu" /> Aggiungi scheda</button>
    {#if schedaCorrente > 0}
      <button type="button" class="btn btn-piccolo btn-pericolo" onclick={rimuoviScheda}><Icona nome="cestino" /> Rimuovi scheda {schedaCorrente + 1}</button>
    {/if}
  </div>
  <div class="mb-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
    <Campo etichetta="Immagine" aiuto="numero unico tra le pratiche; modificabile se coincide con un'immagine già presente in Docfa">
      <div class="flex items-center gap-1 font-mono">
        <input type="text" inputmode="numeric" class="campo w-28 font-mono" maxlength="7" value={String(pl.progressivo).padStart(7, '0')} onchange={(e) => { const n = Number(e.currentTarget.value.replace(/\D/g, '')); if (n > 0 && n <= 9999999) pl.progressivo = n; e.currentTarget.value = String(pl.progressivo).padStart(7, '0'); }} />
        <span class="text-sm text-fg-muted">.{String(schedaCorrente + 1).padStart(3, '0')}</span>
      </div>
    </Campo>
    <Campo etichetta="Formato" aiuto={sc.dxf ? 'rilevato dal riquadro' : ''}>
      <select class="campo" bind:value={sc.formato}><option value="A4">A4</option><option value="A3">A3</option></select>
    </Campo>
    <Campo etichetta="Scala" aiuto={sc.dxf ? 'rilevata dal riquadro' : ''}>
      <select class="campo" bind:value={sc.scala}><option value={100}>1:100</option><option value={200}>1:200</option><option value={500}>1:500</option></select>
    </Campo>
  </div>
  <div class="grid gap-5 xl:grid-cols-[1fr_26rem]">
    <div class="space-y-4">

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn" onclick={caricaDxf}><Icona nome="importa" /> {sc.dxf ? 'Sostituisci DXF' : 'Carica DXF'}</button>
        {#if sc.dxf}
          <button type="button" class="btn" onclick={() => genera()} disabled={generazione}><Icona nome="ricarica" /> {generazione ? 'Generazione…' : 'Rigenera anteprima'}</button>
        {/if}
        <button type="button" class="btn btn-pericolo" onclick={rimuovi}><Icona nome="cestino" /> Rimuovi planimetria</button>
      </div>

      {#if sc.tiff && !sc.dxf}
        <p class="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          <Icona nome="immagine" /> Immagine importata da Docfa ({sc.tiff.length.toLocaleString('it-IT')} byte){sc.ntf?.length ? ', con file dei poligoni NTF' : ''}: verrà riusata tale e quale nel PDF.
        </p>
      {/if}
      {#if infoDxf}
        <p class="text-xs text-fg-muted">DXF {infoDxf.nome ? `"${infoDxf.nome}" ` : ''}({VERSIONI_ACAD[infoDxf.versione] ?? infoDxf.versione ?? 'versione non indicata'}): {infoDxf.entita} oggetti, {sc.poligoni.length} poligoni.</p>
      {/if}
      {#if correzioniDxf.length}
        <div class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
          <p class="mb-1 flex items-center gap-2 font-medium"><Icona nome="spunta" /> Corretto automaticamente</p>
          <ul class="list-disc space-y-0.5 pl-6 text-xs">{#each correzioniDxf as c, i (i)}<li>{c}</li>{/each}</ul>
        </div>
      {/if}
      <Avvisi errori={errore ? [errore] : []} avvisi={avvisiDxf} />

      {#if sc.poligoni.length || poligoniNtf.length}
        <div>
          <div class="mb-1 flex items-center justify-between">
            <h3 class="text-xs font-semibold text-fg-muted">Poligoni</h3>
            <span class="text-xs text-fg-faint">compilano dati metrici e superfici lorde</span>
          </div>
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-fg-muted"><th class="py-1 text-left font-medium">#</th><th class="py-1 text-left font-medium">Tipo</th><th class="py-1 text-right font-medium">Superficie</th><th class="py-1 text-right font-medium">Altezza &lt; 1,50 m</th><th class="py-1 text-right font-medium">Vertici</th><th class="py-1"></th></tr></thead>
            <tbody>
              {#each sc.poligoni as p, i (i)}
                <tr id={`poligono-${i}`} class="cursor-pointer border-t border-line {selezionato === i ? 'bg-accent-100 dark:bg-accent-900/40' : 'hover:bg-surface-2'}" onclick={() => seleziona(selezionato === i ? null : i)}>
                  <td class="py-1 pl-1"><span class="inline-flex items-center gap-1.5 text-fg-faint"><span class="inline-block size-2.5 rounded-sm" style:background={COLORE_TIPO[p.tipo]}></span>{i + 1}</span></td><td class="py-1">
                    <select class="campo campo-piccolo w-20" value={p.tipo} onchange={(e) => (p.tipo = e.currentTarget.value as TipoAmbientePoligono)} title="Tipologia dell'ambiente (in Docfa si può cambiare anche dopo l'importazione del DXF)">
                      {#each Object.entries(NOMI_TIPO) as [v, et] (v)}<option value={v}>{et}</option>{/each}
                    </select>
                  </td>
                  <td class="py-1 text-right tabular-nums">{area(p).toFixed(2).replace('.', ',')} m²</td>
                  <td class="py-1 text-right">
                    {#if haAltezza(p.tipo)}
                      <input type="checkbox" class="check" checked={!p.altezzaValida} onchange={(e) => (p.altezzaValida = !e.currentTarget.checked)} title="Spunta se l'ambiente ha altezza inferiore a 1,50 m (non computato)" />
                    {:else}—{/if}
                  </td>
                  <td class="py-1 text-right">{p.vertici.length}</td>
                  <td class="py-1 pl-2 text-right"><button type="button" class="btn btn-piccolo" title="Elimina il poligono (non serve)" aria-label={`Elimina il poligono ${i + 1}`} onclick={(e) => { e.stopPropagation(); eliminaPoligono(i); }}><Icona nome="cestino" /></button></td>
                </tr>
              {/each}
              {#each poligoniNtf as p, i (i)}
                <tr class="border-t border-line"><td class="py-1 text-fg-faint">{i + 1}</td><td class="py-1">{p.tipo}</td><td class="py-1 text-right">{p.area.toFixed(2)} m²</td><td class="py-1 text-right">{p.altezza === '000' ? '—' : `${(Number(p.altezza) / 100).toFixed(2).replace('.', ',')} m`}</td><td class="py-1 text-right text-fg-faint">NTF</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">Anteprima</h3>
      {#if bitmap}
        <div class="relative inline-block max-w-full">
          <AnteprimaBitmap {bitmap} larghezzaMax={700} classe="block" />
          {#if sc.poligoni.length}
            {@const f = { formato: sc.formato, scala: sc.scala }}
            <svg class="absolute inset-0 h-full w-full" viewBox={`0 0 ${bitmap.width} ${bitmap.height}`} preserveAspectRatio="none" role="group" aria-label="Poligoni">
              {#each sc.poligoni as p, i (i)}
                <polygon points={puntiSvg(p.vertici, f)} fill={COLORE_TIPO[p.tipo]} fill-opacity={selezionato === i ? 0.45 : 0.18} stroke={COLORE_TIPO[p.tipo]} stroke-width={selezionato === i ? 10 : 4} class="cursor-pointer" role="button" tabindex="-1" aria-label={`Poligono ${i + 1} tipo ${NOMI_TIPO[p.tipo]}`} onclick={() => seleziona(selezionato === i ? null : i)} onkeydown={() => {}}><title>{i + 1} · {NOMI_TIPO[p.tipo]} · {area(p).toFixed(2).replace('.', ',')} m²</title></polygon>
              {/each}
            </svg>
          {/if}
        </div>
        <p class="mt-1 text-xs text-fg-faint">{bitmap.width} × {bitmap.height} px a 200 dpi</p>
      {:else if generazione}
        <div class="flex h-64 items-center justify-center rounded border border-dashed border-line text-sm text-fg-muted">Generazione in corso…</div>
      {:else}
        <div class="flex h-64 items-center justify-center rounded border border-dashed border-line text-sm text-fg-muted">Carica un DXF per vedere l'anteprima</div>
      {/if}
    </div>
  </div>
{/if}
