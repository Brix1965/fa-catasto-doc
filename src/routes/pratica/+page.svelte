<script lang="ts">
  /**
   * Pagina della pratica, con la sequenza di schermi di Docfa: modello D (comune, quadro A o B, quadro I,
   * quadro U, quadro D/note, dichiarante), poi elaborati grafici, modelli 1N/2N, classamento, elenco
   * subalterni, «Cosa manca» (controllo formale) ed esportazione. A sinistra l'albero degli schermi e delle unità,
   * cliccabile liberamente: i dati si caricano anche un po' per volta e la pratica resta salvata in bozza; gli errori
   * bloccano solo l'esportazione. In fondo OK (Ctrl+O: passa al successivo, segnalando cosa manca nello schermo) e
   * Annulla (Esc: scarta le modifiche dello schermo e torna al precedente); F1 apre l'aiuto.
   */
  import { dataIt, dataOraIt } from '$lib/formato-data';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { statoPratica } from '$lib/stato/pratica.svelte';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { controllaPratica, controllaSchermo, descriviUnita, motiviElaboratoObbligatorio, type SezionePratica } from '$lib/stato/validazione';
  import { schermiPratica } from '$lib/stato/schermi';
  import { clonaProfondo } from '$lib/stato/pratica-file';
  import Icona from '$lib/ui/Icona.svelte';
  import SchermoComune from '$lib/ui/schermi/SchermoComune.svelte';
  import QuadroA from '$lib/ui/schermi/QuadroA.svelte';
  import QuadroB from '$lib/ui/schermi/QuadroB.svelte';
  import QuadroI from '$lib/ui/schermi/QuadroI.svelte';
  import QuadroU from '$lib/ui/schermi/QuadroU.svelte';
  import QuadroD from '$lib/ui/schermi/QuadroD.svelte';
  import DatiDichiarante from '$lib/ui/schermi/DatiDichiarante.svelte';
  import ElaboratiGrafici from '$lib/ui/schermi/ElaboratiGrafici.svelte';
  import Modelli1N2N from '$lib/ui/schermi/Modelli1N2N.svelte';
  import Classamento from '$lib/ui/schermi/Classamento.svelte';
  import ElencoSubalterni from '$lib/ui/schermi/ElencoSubalterni.svelte';
  import ControlloFormale from '$lib/ui/schermi/ControlloFormale.svelte';
  import PannelloEsporta from '$lib/ui/PannelloEsporta.svelte';
  import FinestraConfermaData from '$lib/ui/FinestraConfermaData.svelte';
  import { confermaData } from '$lib/stato/conferma-data.svelte';
  import type { Pratica } from '$lib/core/model';

  const percorsoRichiesto = $derived(page.url.searchParams.get('f'));
  let sezione = $state<SezionePratica>('comune');
  let unitaSelezionata = $state(0);
  let errore = $state<string | null>(null);
  let modificaTitolo = $state(false);
  let aiuto = $state(false);
  /** avviso (non bloccante) dopo OK: cosa manca nello schermo appena lasciato */
  let avvisoOk = $state<{ titolo: string; n: number; sezione: SezionePratica; unita?: number } | null>(null);
  /** rami aperti dell'albero (quadro U ed elaborati grafici mostrano le unità) */
  let aperti = $state<Partial<Record<SezionePratica, boolean>>>({ unita: true });
  let okInterno = $state<(() => void) | null>(null);
  /** copia della pratica all'ingresso nello schermo, per Annulla */
  let istantanea: Pratica | null = null;

  // apertura del file indicato nell'URL
  $effect(() => {
    const p = percorsoRichiesto;
    if (!p) { errore = 'Nessuna pratica indicata'; return; }
    if (statoPratica.percorso === p) return;
    statoPratica.apri(p).then(() => entra('comune')).catch((e) => (errore = `Pratica non apribile: ${e instanceof Error ? e.message : String(e)}`));
  });

  // autosalvataggio
  $effect(() => {
    if (!statoPratica.file) return;
    const s = statoPratica.serializza();
    statoPratica.notificaModifica(s);
  });

  onDestroy(() => { if (statoPratica.salvataggio === 'modificato') void statoPratica.salva(); });

  const schermi = $derived(statoPratica.pratica ? schermiPratica(statoPratica.pratica) : []);
  const titoli = $derived(Object.fromEntries(schermi.map((s) => [s.id, s.titolo])) as Partial<Record<SezionePratica, string>>);
  const indice = $derived(schermi.findIndex((s) => s.id === sezione));
  const corrente = $derived(schermi[indice]);
  const acc = $derived(statoPratica.pratica?.tipoDocumento === 'accatastamento');

  const esito = $derived(statoPratica.pratica ? controllaPratica(statoPratica.pratica) : null);
  const problemiPerSezione = $derived.by(() => {
    const m: Partial<Record<SezionePratica, { errori: number; avvisi: number }>> = {};
    for (const p of [...(esito?.errori ?? []), ...(esito?.avvisi ?? [])]) {
      const x = (m[p.sezione] ??= { errori: 0, avvisi: 0 });
      if (p.livello === 'errore') x.errori++; else x.avvisi++;
    }
    return m;
  });
  /** errori per unità, per i rami dell'albero: chiave "sezione:indice" */
  const erroriPerUnita = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const p of esito?.errori ?? []) if (p.unita !== undefined) m[`${p.sezione}:${p.unita}`] = (m[`${p.sezione}:${p.unita}`] ?? 0) + 1;
    return m;
  });
  const totaleErrori = $derived(esito?.errori.length ?? 0);
  /** sezioni dell'albero che si aprono sulle unità */
  const CON_UNITA: SezionePratica[] = ['unita', 'elaborati'];
  const etichettaUnita = (s: SezionePratica, i: number): string => {
    const u = statoPratica.pratica?.unita[i];
    if (!u) return '';
    const id = u.identificativo;
    const testo = id.foglio || id.numero ? `${id.foglio || '?'}/${id.numero || '?'}${id.subalterno ? `/${id.subalterno}` : ''}` : 'senza identificativo';
    return s === 'unita' ? `${u.recuperata ? 'R' : u.operazione} ${testo}` : testo;
  };

  /** Entra in uno schermo: memorizza lo stato per Annulla. */
  function entra(s: SezionePratica, unita?: number): void {
    sezione = s;
    if (unita !== undefined) unitaSelezionata = unita;
    if (CON_UNITA.includes(s)) aperti[s] = true;
    avvisoOk = null;
    istantanea = statoPratica.file ? clonaProfondo(statoPratica.file.pratica) : null;
    document.getElementById('contenuto')?.scrollTo({ top: 0 });
  }

  function vai(s: SezionePratica, unita?: number): void { entra(s, unita); }

  /** OK: controlla lo schermo e passa al successivo (nel quadro U alla unità successiva). */
  function ok(): void {
    const p = statoPratica.pratica;
    if (!p) return;
    if (okInterno) { okInterno(); return; }
    if (sezione === 'controllo' || sezione === 'esporta') { const n = schermi[indice + 1]; if (n) entra(n.id); return; }
    // niente blocchi: si passa avanti e si segnala cosa manca ancora nello schermo lasciato (si completa quando si vuole)
    const prob = controllaSchermo(p, sezione, sezione === 'unita' ? unitaSelezionata : undefined);
    const avviso = prob.length
      ? { titolo: sezione === 'unita' ? `${corrente?.breve ?? ''} – unità ${unitaSelezionata + 1}` : (corrente?.breve ?? ''), n: prob.length, sezione, unita: sezione === 'unita' ? unitaSelezionata : undefined }
      : null;
    if (sezione === 'dichiarante' && p.tecnico.cognome.trim()) void impostazioni.memorizzaTecnico(p.tecnico);
    if (sezione === 'unita' && unitaSelezionata < p.unita.length - 1) entra('unita', unitaSelezionata + 1);
    else {
      const n = schermi[indice + 1];
      if (n) entra(n.id, n.id === 'unita' ? 0 : undefined);
    }
    avvisoOk = avviso;
  }

  /** Annulla: scarta le modifiche fatte nello schermo e torna al precedente. */
  function annulla(): void {
    if (statoPratica.file && istantanea) statoPratica.file.pratica = istantanea;
    const prec = schermi[indice - 1];
    if (prec) entra(prec.id); else entra(sezione);
  }

  function tasti(e: KeyboardEvent): void {
    if (!statoPratica.pratica || confermaData.aperta) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); ok(); }
    else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); void statoPratica.salva(); }
    else if (e.key === 'F1') { e.preventDefault(); aiuto = !aiuto; }
    else if (e.key === 'Escape') {
      if (aiuto) { aiuto = false; return; }
      if (avvisoOk) { avvisoOk = null; return; }
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault(); annulla();
    }
  }

  async function chiudi(): Promise<void> {
    if (statoPratica.pratica && !(await confermaData.chiedi(statoPratica.pratica, 'Prima del salvataggio finale e della chiusura del documento.'))) return;
    await statoPratica.salva();
    statoPratica.chiudi();
    await goto('/');
  }

  const STATO_SALVATAGGIO: Record<typeof statoPratica.salvataggio, string> = { salvato: 'Salvato', modificato: 'Modifiche non salvate', salvataggio: 'Salvataggio…', errore: 'Errore di salvataggio' };
  const ora = (iso: string) => dataOraIt(iso);
  const gruppi = $derived([...new Set(schermi.map((s) => s.gruppo))]);
</script>

<svelte:window onkeydown={tasti} />

{#if errore}
  <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-fg-muted">
    <p>{errore}</p>
    <a href="/" class="btn">Torna all'elenco</a>
  </div>
{:else if statoPratica.file && statoPratica.pratica}
  {@const f = statoPratica.file}
  <div class="flex h-full">
    <aside class="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div class="flex h-14 items-center gap-2 border-b border-line px-4">
        <button type="button" class="btn btn-ghost btn-piccolo -ml-2" onclick={chiudi} title="Torna ai documenti"><Icona nome="sinistra" /></button>
        <span class="flex size-7 items-center justify-center rounded-md bg-accent-600 text-white"><Icona nome="casa" classe="size-4" /></span>
        <span class="text-sm font-semibold">Fa.Catasto.Doc</span>
      </div>
      {#if totaleErrori}
        <button type="button" class="mx-2 mt-2 flex items-center gap-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-left text-xs text-fuchsia-900 hover:bg-fuchsia-100 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-100" onclick={() => entra('controllo')} title="Elenco di tutto quello che manca">
          <Icona nome="elenco" classe="size-3.5" /> <span class="flex-1">Mancano {totaleErrori} {totaleErrori === 1 ? 'dato' : 'dati'}: vedi «Cosa manca»</span>
        </button>
      {/if}
      <nav class="flex-1 overflow-y-auto p-2" aria-label="Schermi della pratica">
        {#each gruppi as g (g)}
          <p class="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">{g}</p>
          <ul class="space-y-0.5">
            {#each schermi.filter((s) => s.gruppo === g) as s (s.id)}
              {@const pr = problemiPerSezione[s.id]}
              {@const fatto = !pr?.errori && s.id !== 'controllo' && s.id !== 'esporta'}
              {@const facoltativo = s.id === 'elenco' && !statoPratica.pratica.elaboratoPlanimetrico && !motiviElaboratoObbligatorio(statoPratica.pratica).length}
              {@const conFigli = CON_UNITA.includes(s.id) && statoPratica.pratica.unita.length > 0}
              <li>
                <div class="flex items-center">
                  <button type="button" class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-surface-2 {sezione === s.id ? 'bg-accent-50 font-medium text-accent-900 dark:bg-accent-950 dark:text-accent-100' : 'text-fg'}" onclick={() => entra(s.id, s.id === 'unita' ? 0 : undefined)}>
                    <span class="size-2 shrink-0 rounded-full {s.id === 'controllo' || s.id === 'esporta' ? 'bg-transparent' : facoltativo ? 'bg-zinc-300 dark:bg-zinc-600' : fatto ? 'bg-green-500' : 'bg-fuchsia-500'}" title={facoltativo ? 'Non obbligatorio in questo documento' : fatto ? 'Completo' : 'Dati obbligatori mancanti'}></span>
                    <span class="flex-1 truncate">{s.breve}</span>
                    {#if s.id === 'controllo' && totaleErrori}<span class="pill bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">{totaleErrori}</span>
                    {:else if pr?.errori}<span class="pill bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">{pr.errori}</span>
                    {:else if pr?.avvisi}<span class="pill bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">{pr.avvisi}</span>{/if}
                  </button>
                  {#if conFigli}
                    <button type="button" class="btn btn-ghost btn-piccolo px-1" onclick={() => (aperti[s.id] = !aperti[s.id])} title={aperti[s.id] ? 'Chiudi l\'elenco delle unità' : 'Mostra le unità'} aria-expanded={!!aperti[s.id]}>
                      <Icona nome={aperti[s.id] ? 'giu' : 'destra'} classe="size-3.5" />
                    </button>
                  {/if}
                </div>
                {#if conFigli && aperti[s.id]}
                  <ul class="mb-1 ml-5 border-l border-line pl-1">
                    {#each statoPratica.pratica.unita as u, i (i)}
                      {#if s.id === 'unita' || u.operazione !== 'S'}
                        {@const ne = erroriPerUnita[`${s.id}:${i}`] ?? 0}
                        <li>
                          <button type="button" class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-surface-2 {sezione === s.id && unitaSelezionata === i ? 'bg-accent-50 font-medium text-accent-900 dark:bg-accent-950 dark:text-accent-100' : 'text-fg-muted'}" onclick={() => entra(s.id, i)} title={descriviUnita(u, i)}>
                            <span class="w-4 text-right text-fg-faint">{i + 1}</span>
                            <span class="min-w-0 flex-1 truncate">{etichettaUnita(s.id, i)}</span>
                            {#if ne}<span class="pill bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">{ne}</span>{/if}
                          </button>
                        </li>
                      {/if}
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ul>
        {/each}
      </nav>
      <div class="border-t border-line p-4 text-xs text-fg-muted">
        <p class="flex items-center gap-1.5"><Icona nome="orologio" classe="size-3.5" /> Ultima modifica: {ora(f.meta.modificata)}</p>
        <p class="mt-1 flex items-center gap-1.5"><Icona nome="tastiera" classe="size-3.5" /> <span><kbd class="tasto">Ctrl+O</kbd> OK · <kbd class="tasto">Esc</kbd> Annulla · <kbd class="tasto">F1</kbd> Aiuto</span></p>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-5 backdrop-blur">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          {#if modificaTitolo}
            <!-- svelte-ignore a11y_autofocus -->
            <input type="text" class="campo max-w-md" autofocus bind:value={f.meta.titolo} onblur={() => (modificaTitolo = false)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); modificaTitolo = false; } }} />
          {:else}
            <button type="button" class="truncate text-base font-semibold hover:underline" title="Modifica la descrizione" onclick={() => (modificaTitolo = true)}>{f.meta.titolo || 'Documento senza descrizione'}</button>
          {/if}
          <span class="pill shrink-0 bg-surface-2 text-fg-muted">{acc ? 'Accatastamento' : 'Variazione'} {acc ? 'NCA' : 'NCV'}{String(f.pratica.progressivo).padStart(3, '0')}</span>
          {#if f.meta.stato === 'esportata'}<span class="pill shrink-0 bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-100">Esportata</span>{/if}
        </div>
        <span class="text-xs {statoPratica.salvataggio === 'errore' ? 'text-red-600' : 'text-fg-muted'}" title={statoPratica.errore ?? ''}>{STATO_SALVATAGGIO[statoPratica.salvataggio]}</span>
        <button type="button" class="btn" onclick={() => statoPratica.salva()} disabled={statoPratica.salvataggio === 'salvataggio'}><Icona nome="salva" /> Salva</button>
        <button type="button" class="btn" class:btn-primario={aiuto} onclick={() => (aiuto = !aiuto)} title="Aiuto (F1)"><Icona nome="info" /> Aiuto</button>
      </header>

      <div class="flex min-h-0 flex-1">
        <main id="contenuto" class="flex-1 overflow-y-auto bg-fondo">
          <div class="mx-auto max-w-6xl px-5 py-6">
            {#key sezione}
            <svelte:boundary onerror={(e) => console.error('Errore nello schermo', sezione, e)}>
            {#if sezione === 'comune'}
              <SchermoComune bind:pratica={statoPratica.file.pratica} />
            {:else if sezione === 'generali'}
              {#if acc}<QuadroA bind:pratica={statoPratica.file.pratica} />{:else}<QuadroB bind:pratica={statoPratica.file.pratica} />{/if}
            {:else if sezione === 'intestati'}
              <QuadroI bind:pratica={statoPratica.file.pratica} />
            {:else if sezione === 'unita'}
              <QuadroU bind:pratica={statoPratica.file.pratica} bind:selezionata={unitaSelezionata} />
            {:else if sezione === 'quadroD'}
              <QuadroD bind:pratica={statoPratica.file.pratica} />
            {:else if sezione === 'dichiarante'}
              <DatiDichiarante bind:pratica={statoPratica.file.pratica} />
            {:else if sezione === 'elaborati'}
              <ElaboratiGrafici bind:pratica={statoPratica.file.pratica} bind:selezionata={unitaSelezionata} />
            {:else if sezione === 'modelli'}
              <Modelli1N2N bind:pratica={statoPratica.file.pratica} registraOk={(h) => (okInterno = h)} />
            {:else if sezione === 'classamento'}
              <Classamento bind:pratica={statoPratica.file.pratica} vai={(s, i) => entra(s, i)} />
            {:else if sezione === 'elenco'}
              <ElencoSubalterni bind:pratica={statoPratica.file.pratica} />
            {:else if sezione === 'controllo'}
              <ControlloFormale pratica={statoPratica.file.pratica} {vai} {titoli} />
            {:else}
              <PannelloEsporta bind:pratica={statoPratica.file.pratica} {vai} {titoli} />
            {/if}
              {#snippet failed(err, riprova)}
                <div class="scheda space-y-3 border-red-300 p-5 text-sm" role="alert">
                  <p class="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><Icona nome="errore" /> Questo schermo non si è aperto per un errore del programma</p>
                  <p class="text-fg-muted">I dati della pratica sono salvati. Puoi andare in un altro schermo dall'albero a sinistra. Per correggere il programma serve il testo qui sotto (copialo o fai uno screenshot).</p>
                  <pre class="max-h-60 overflow-auto rounded bg-surface-2 p-3 text-xs whitespace-pre-wrap select-text">{`Schermo: ${sezione}${sezione === 'unita' || sezione === 'elaborati' ? `, unità ${unitaSelezionata + 1}` : ''}\n${err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)}`}</pre>
                  <button type="button" class="btn" onclick={riprova}><Icona nome="ricarica" /> Riprova</button>
                </div>
              {/snippet}
            </svelte:boundary>
            {/key}
          </div>
        </main>
        {#if aiuto && corrente}
          <aside class="w-80 shrink-0 overflow-y-auto border-l border-line bg-surface p-4 text-sm">
            <div class="mb-2 flex items-center justify-between">
              <h2 class="font-semibold">Aiuto – {corrente.breve}</h2>
              <button type="button" class="btn btn-ghost btn-piccolo" onclick={() => (aiuto = false)} title="Chiudi"><Icona nome="x" /></button>
            </div>
            <p class="leading-relaxed text-fg-muted">{corrente.aiuto}</p>
            <p class="mt-4 text-xs text-fg-faint">I campi obbligatori sono in <span class="obbligatorio">fucsia</span>; il pallino verde indica uno schermo completo.</p>
          </aside>
        {/if}
      </div>

      {#if avvisoOk}
        <div class="flex shrink-0 items-center gap-3 border-t border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
          <Icona nome="info" classe="size-4 shrink-0" />
          <span class="flex-1">{avvisoOk.titolo}: {avvisoOk.n === 1 ? 'manca ancora un dato' : `mancano ancora ${avvisoOk.n} dati`}. Puoi completarli quando vuoi: il documento resta salvato in bozza.</span>
          <button type="button" class="btn btn-piccolo" onclick={() => { const a = avvisoOk!; avvisoOk = null; entra(a.sezione, a.unita); }}>Torna lì</button>
          <button type="button" class="btn btn-piccolo" onclick={() => { avvisoOk = null; entra('controllo'); }}>Cosa manca</button>
          <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => (avvisoOk = null)} title="Chiudi"><Icona nome="x" /></button>
        </div>
      {/if}

      <FinestraConfermaData bind:pratica={statoPratica.file.pratica} />
      <footer class="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-surface px-5">
        <span class="flex-1 text-xs text-fg-muted">
          {#if corrente}Schermo {indice + 1} di {schermi.length}{#if sezione === 'unita' && f.pratica.unita.length}{" · "}unità {unitaSelezionata + 1} di {f.pratica.unita.length}{/if}{/if}
        </span>
        <button type="button" class="btn" onclick={annulla} title="Annulla le modifiche dello schermo e torna al precedente (Esc)"><span><u class="underline-offset-2">A</u>nnulla</span></button>
        <button type="button" class="btn btn-primario min-w-24" onclick={ok} disabled={sezione === 'esporta' && !okInterno} title="Conferma e passa allo schermo successivo (Ctrl+O)"><span><u class="underline-offset-2">O</u>K</span></button>
      </footer>
    </div>
  </div>
{:else}
  <div class="flex h-full items-center justify-center text-sm text-fg-muted">Apertura del documento…</div>
{/if}
