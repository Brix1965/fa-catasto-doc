<script lang="ts">
  /** Importazione di un PDF Docfa esistente: riepilogo e creazione della pratica. */
  import { dataIt } from '$lib/formato-data';
  import { goto } from '$app/navigation';
  import { CAUSALI } from '$lib/core/model';
  import { importaPdfDocfa, type ImportazioneDocfa } from '$lib/core/pdf/importa';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { statoPratica } from '$lib/stato/pratica.svelte';
  import { titoloProposto } from '$lib/stato/pratica-file';
  import { scegliFile, leggiFile, nomeFile, scegliCartella } from '$lib/piattaforma';
  import { descriviUnita } from '$lib/stato/validazione';
  import Avvisi from '$lib/ui/Avvisi.svelte';
  import Icona from '$lib/ui/Icona.svelte';
  import Intestazione from '$lib/ui/Intestazione.svelte';
  import Sezione from '$lib/ui/Sezione.svelte';

  let percorso = $state<string | null>(null);
  let esito = $state.raw<ImportazioneDocfa | null>(null);
  let errore = $state<string | null>(null);
  let inCorso = $state(false);
  let titolo = $state('');

  async function scegli(): Promise<void> {
    errore = null;
    const f = await scegliFile('Scegli il PDF prodotto da Docfa', [{ nome: 'PDF Docfa', estensioni: ['pdf', 'PDF'] }]);
    if (!f) return;
    percorso = f;
    inCorso = true;
    esito = null;
    try {
      const r = await importaPdfDocfa(await leggiFile(f));
      // nome del comune dagli archivi, se importati
      const c = impostazioni.comunePerCodiceAmministrativo(r.pratica.comune.codiceAmministrativo);
      if (c) r.pratica.comune = { ...c };
      else if (r.pratica.comune.codiceAmministrativo) r.avvisi.push(`Comune ${r.pratica.comune.codiceAmministrativo} non trovato negli archivi: nome e provincia vanno inseriti a mano (importa Comuni.dat nelle impostazioni)`);
      esito = r;
      titolo = titoloProposto(r.pratica);
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    } finally {
      inCorso = false;
    }
  }

  async function crea(): Promise<void> {
    if (!esito) return;
    if (!impostazioni.dati.cartellaPratiche) {
      const c = await scegliCartella('Scegli la cartella delle pratiche');
      if (!c) return;
      impostazioni.dati.cartellaPratiche = c;
      await impostazioni.salva();
    }
    try {
      const p = await statoPratica.crea(impostazioni.dati.cartellaPratiche, esito.pratica, titolo || titoloProposto(esito.pratica));
      await goto(`/pratica?f=${encodeURIComponent(p)}`);
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<div class="flex h-full flex-col">
  <Intestazione titolo="Importa da PDF Docfa" indietro="/" />
  <main class="mx-auto w-full max-w-5xl flex-1 space-y-5 px-5 py-6">
    <Sezione titolo="File" descrizione="Il PDF generato da Docfa contiene i file dati e le planimetrie: vengono estratti e trasformati in una pratica modificabile.">
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn btn-primario" onclick={scegli} disabled={inCorso}><Icona nome="pdf" /> {inCorso ? 'Lettura in corso…' : 'Scegli PDF…'}</button>
        {#if percorso}<span class="font-mono text-xs text-fg-muted">{nomeFile(percorso)}</span>{/if}
      </div>
      {#if errore}<div class="mt-4"><Avvisi errori={[errore]} /></div>{/if}
    </Sezione>

    {#if esito}
      {@const p = esito.pratica}
      <Sezione titolo="Riepilogo">
        <dl class="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt class="text-xs text-fg-muted">Documento</dt><dd class="font-medium">{p.tipoDocumento === 'accatastamento' ? 'NCA' : 'NCV'}{String(p.progressivo).padStart(3, '0')} · {p.causale} – {CAUSALI[p.causale] ?? ''}</dd></div>
          <div><dt class="text-xs text-fg-muted">Comune</dt><dd class="font-medium">{p.comune.nome || '?'} {p.comune.provincia ? `(${p.comune.provincia})` : ''} · {p.comune.codiceAmministrativo}</dd></div>
          <div><dt class="text-xs text-fg-muted">{p.tipoDocumento === 'accatastamento' ? 'Data ultimazione lavori' : 'Data variazione'}</dt><dd class="font-medium">{dataIt(p.dataVariazione) || '—'}</dd></div>
          <div><dt class="text-xs text-fg-muted">Tecnico</dt><dd class="font-medium">{p.tecnico.cognome} {p.tecnico.nome}</dd></div>
          <div><dt class="text-xs text-fg-muted">Dichiarante</dt><dd class="font-medium">{p.dichiarante.cognome} {p.dichiarante.nome}</dd></div>
          <div><dt class="text-xs text-fg-muted">File dati</dt><dd class="font-medium">{esito.fileDati.join(', ')}</dd></div>
          <div><dt class="text-xs text-fg-muted">Pagine / immagini</dt><dd class="font-medium">{esito.contenuto.pagine} / {esito.contenuto.immagini.length}</dd></div>
          <div><dt class="text-xs text-fg-muted">Modello 1N parte I</dt><dd class="font-medium">{p.mod1NParteI ? 'presente' : 'assente'}{p.elaboratoPlanimetrico ? ' · elaborato planimetrico' : ''}</dd></div>
        </dl>
        <h3 class="mt-5 mb-2 text-xs font-semibold text-fg-muted">Unità immobiliari ({p.unita.length})</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-fg-muted"><th class="py-1 text-left font-medium">Unità</th><th class="py-1 text-left font-medium">Op.</th><th class="py-1 text-left font-medium">Indirizzo</th><th class="py-1 text-left font-medium">Classamento</th><th class="py-1 text-left font-medium">Planimetria</th></tr></thead>
          <tbody>
            {#each p.unita as u, i (i)}
              <tr class="border-t border-line">
                <td class="py-1.5">{descriviUnita(u, i)}</td>
                <td class="py-1.5">{u.operazione}</td>
                <td class="py-1.5">{u.indirizzo ? `${u.indirizzo.toponimo} ${u.indirizzo.civici.join(', ')}` : '—'}</td>
                <td class="py-1.5">{u.classamento ? `${u.classamento.categoria} cl. ${u.classamento.classe} · ${u.classamento.consistenza} · € ${u.classamento.rendita.toFixed(2)}` : '—'}</td>
                <td class="py-1.5">{u.planimetria ? `${String(u.planimetria.progressivo).padStart(7, '0')} ${u.planimetria.formato} 1:${u.planimetria.scala}${u.planimetria.tiff ? ' · immagine' : ' · senza immagine'}${u.planimetria.ntf?.length ? ' · poligoni' : ''}` : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="mt-5"><Avvisi avvisi={esito.avvisi} vuoto="Nessun avviso: tutti i file e le planimetrie sono stati letti." /></div>
      </Sezione>

      <Sezione titolo="Crea la pratica">
        <div class="flex flex-wrap items-end gap-3">
          <label class="block flex-1">
            <span class="etichetta">Titolo della pratica</span>
            <input type="text" class="campo" bind:value={titolo} />
          </label>
          <button type="button" class="btn btn-primario" onclick={crea}><Icona nome="piu" /> Crea pratica</button>
        </div>
      </Sezione>
    {/if}
  </main>
</div>
