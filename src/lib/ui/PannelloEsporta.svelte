<script lang="ts">
  /** Riepilogo, controlli di completezza ed esportazione del PDF Docfa. */
  import { dataIt, dataOraIt } from '$lib/formato-data';
  import { confermaData } from '$lib/stato/conferma-data.svelte';
  import type { Pratica } from '$lib/core/model';
  import { esportaPratica } from '$lib/core/esporta';
  import { controllaPratica, type SezionePratica } from '$lib/stato/validazione';
  import { statoPratica } from '$lib/stato/pratica.svelte';
  import { impostazioni, PRIMA_IMMAGINE } from '$lib/stato/impostazioni.svelte';
  import { scriviFile, unisci, apriFile, esisteFile, conferma } from '$lib/piattaforma';
  import Avvisi from './Avvisi.svelte';
  import Icona from './Icona.svelte';
  import Sezione from './Sezione.svelte';

  let { pratica = $bindable(), vai, titoli }: { pratica: Pratica; vai: (sezione: SezionePratica, unita?: number) => void; titoli: Partial<Record<SezionePratica, string>> } = $props();

  const esito = $derived(controllaPratica(pratica));
  let inCorso = $state(false);
  let risultato = $state<{ percorso: string; avvisi: string[]; byte: number; immagini: number } | null>(null);
  let errore = $state<string | null>(null);
  const nomePdf = $derived(`NC${pratica.tipoDocumento === 'accatastamento' ? 'A' : 'V'}${String(pratica.progressivo).padStart(3, '0')}.PDF`);

  const NOMI_SEZIONI = $derived(titoli as Record<SezionePratica, string>);

  /**
   * Le immagini disegnate da DXF con un numero basso (assegnato prima della numerazione unica) coincidono con le
   * immagini già presenti nell'archivio di Docfa ("alcune planimetrie non importate"): ricevono un numero nuovo.
   * Le immagini importate da Docfa (TIFF) tengono il loro numero.
   */
  function rinumeraImmagini(): void {
    const usati = () => [...pratica.unita.map((u) => u.planimetria?.progressivo ?? 0), pratica.elaboratoPlanimetrico?.progressivoImmagine ?? 0].filter((x) => x > 0);
    for (const u of pratica.unita) {
      const pl = u.planimetria;
      if (pl && !pl.tiff && !pl.altreSchede?.some((s) => s.tiff) && pl.progressivo < PRIMA_IMMAGINE) pl.progressivo = impostazioni.nuovaImmagine(usati());
    }
    const ep = pratica.elaboratoPlanimetrico;
    if (ep && ep.disegni?.length && !ep.disegni.some((d) => d.tiff) && ep.progressivoImmagine < PRIMA_IMMAGINE) ep.progressivoImmagine = impostazioni.nuovaImmagine(usati());
  }

  async function esporta(): Promise<void> {
    const cartella = statoPratica.cartella;
    if (!cartella || esito.errori.length) return;
    if (!(await confermaData.chiedi(pratica, 'Prima di produrre il PDF di presentazione.'))) return;
    if (esito.errori.length) return;
    inCorso = true;
    errore = null;
    risultato = null;
    try {
      rinumeraImmagini();
      await statoPratica.salva();
      const r = await esportaPratica(pratica, {});
      const percorso = unisci(cartella, r.nomeFile);
      if (await esisteFile(percorso) && !(await conferma(`${r.nomeFile} esiste già nella cartella della pratica: sovrascriverlo?`))) return;
      await scriviFile(percorso, r.pdf);
      risultato = { percorso, avvisi: r.avvisi, byte: r.pdf.length, immagini: r.immagini.length };
      if (statoPratica.file) {
        statoPratica.file.meta.stato = 'esportata';
        statoPratica.file.meta.ultimaEsportazione = new Date().toISOString();
        statoPratica.file.meta.pdfEsportato = r.nomeFile;
      }
      await statoPratica.salva();
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    } finally {
      inCorso = false;
    }
  }
</script>

<div class="space-y-5">
  <Sezione titolo="Riepilogo" descrizione="Conteggi che finiranno nella testata del documento (quadro B del modello D1).">
    <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:grid-cols-8">
      {#each [['Costituite', esito.conteggi.costituite], ['Variate', esito.conteggi.variate], ['Soppresse', esito.conteggi.soppresse], ['Planimetrie', esito.conteggi.planimetrie], ['Mod. 1N parte II', esito.conteggi.mod1NParteII], ['Derivate ordinarie', esito.conteggi.derivate.ordinarie], ['Derivate speciali', esito.conteggi.derivate.speciali], ['B.c.n.c.', esito.conteggi.derivate.bcnc]] as [et, v] (et)}
        <div class="rounded-md border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-fg-muted">{et}</dt>
          <dd class="text-lg font-semibold tabular-nums">{v}</dd>
        </div>
      {/each}
    </dl>
  </Sezione>

  <Sezione titolo="Controlli" descrizione="Gli errori bloccano l'esportazione; gli avvisi vanno valutati.">
    {#if !esito.errori.length && !esito.avvisi.length}
      <Avvisi vuoto="Nessun problema rilevato: la pratica è pronta per l'esportazione." />
    {:else}
      <ul class="space-y-1.5">
        {#each [...esito.errori, ...esito.avvisi] as p, i (i)}
          <li class="flex items-start gap-2 rounded-md border px-3 py-2 text-sm {p.livello === 'errore' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}">
            <Icona nome={p.livello === 'errore' ? 'errore' : 'attenzione'} classe="mt-0.5 size-4 shrink-0" />
            <span class="flex-1">{p.testo}</span>
            <button type="button" class="shrink-0 text-xs underline-offset-2 hover:underline" onclick={() => vai(p.sezione, p.unita)}>{NOMI_SEZIONI[p.sezione]}</button>
          </li>
        {/each}
      </ul>
    {/if}
  </Sezione>

  <Sezione titolo="Esportazione" descrizione={`Il PDF ${nomePdf} viene scritto nella cartella della pratica, con i file dati nascosti nelle annotazioni come li produce Docfa.`}>
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="btn btn-primario" onclick={esporta} disabled={inCorso || esito.errori.length > 0 || !statoPratica.cartella}>
        <Icona nome="pdf" /> {inCorso ? 'Esportazione in corso…' : `Esporta ${nomePdf}`}
      </button>
      {#if esito.errori.length}<span class="text-xs text-fg-muted">Correggi {esito.errori.length} {esito.errori.length === 1 ? 'errore' : 'errori'} per esportare.</span>{/if}
      {#if statoPratica.file?.meta.ultimaEsportazione}
        <span class="text-xs text-fg-muted">Ultima esportazione: {dataOraIt(statoPratica.file.meta.ultimaEsportazione)}</span>
      {/if}
    </div>
    {#if errore}
      <div class="mt-4"><Avvisi errori={[errore]} /></div>
    {/if}
    {#if risultato}
      <div class="mt-4 space-y-3">
        <p class="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-200">
          <Icona nome="spunta" /> PDF scritto ({(risultato.byte / 1024).toFixed(0)} kB, {risultato.immagini} {risultato.immagini === 1 ? 'planimetria' : 'planimetrie'}): <span class="font-mono text-xs">{risultato.percorso}</span>
        </p>
        <Avvisi avvisi={risultato.avvisi} />
        <div class="flex gap-2">
          <button type="button" class="btn" onclick={() => apriFile(risultato!.percorso)}><Icona nome="apri" /> Apri il PDF</button>
          {#if statoPratica.cartella}
            <button type="button" class="btn" onclick={() => apriFile(statoPratica.cartella!)}><Icona nome="cartella" /> Apri la cartella</button>
          {/if}
        </div>
      </div>
    {/if}
  </Sezione>
</div>
