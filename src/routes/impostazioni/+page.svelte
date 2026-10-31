<script lang="ts">
  /** Impostazioni: tecnico, cartella pratiche, archivi dell'Agenzia. */
  import { ALBI } from '$lib/core/esporta';
  import { impostazioni, PRIMA_IMMAGINE } from '$lib/stato/impostazioni.svelte';
  import { scegliCartella, scegliFile, conferma, apriUrl } from '$lib/piattaforma';
  import { PROGETTO } from '$lib/progetto';
  import { version } from '../../../package.json';
  import Campo from '$lib/ui/Campo.svelte';
  import Icona from '$lib/ui/Icona.svelte';
  import Intestazione from '$lib/ui/Intestazione.svelte';
  import Sezione from '$lib/ui/Sezione.svelte';
  import Avvisi from '$lib/ui/Avvisi.svelte';

  let messaggio = $state<string | null>(null);
  let esito = $state<{ righe: string[]; avvisi: string[] } | null>(null);
  let inCorso = $state(false);
  let errore = $state<string | null>(null);
  let salvato = $state(false);
  let timerSalvato: ReturnType<typeof setTimeout> | null = null;

  async function salva(): Promise<void> {
    try {
      await impostazioni.salva();
      salvato = true;
      if (timerSalvato) clearTimeout(timerSalvato);
      timerSalvato = setTimeout(() => (salvato = false), 2000);
    } catch (e) { errore = e instanceof Error ? e.message : String(e); }
  }
  async function scegli(): Promise<void> {
    const c = await scegliCartella('Scegli la cartella delle pratiche');
    if (c) { impostazioni.dati.cartellaPratiche = c; await salva(); }
  }
  async function importaCartella(): Promise<void> {
    errore = null; messaggio = null; esito = null;
    const c = await scegliCartella('Scegli la cartella degli archivi (es. la cartella "fi" scaricata dal sito dell\'Agenzia)');
    if (!c) return;
    inCorso = true;
    try { esito = await impostazioni.importaCartella(c); }
    catch (e) { errore = e instanceof Error ? e.message : String(e); }
    finally { inCorso = false; }
  }
  async function importaFile(): Promise<void> {
    errore = null; messaggio = null; esito = null;
    const f = await scegliFile('Scegli un archivio Docfa', [{ nome: 'Archivi Docfa', estensioni: ['dat', 'DAT'] }]);
    if (!f) return;
    inCorso = true;
    try { esito = await impostazioni.importaFile([f]); }
    catch (e) { errore = e instanceof Error ? e.message : String(e); }
    finally { inCorso = false; }
  }
  async function comuniIncorporati(): Promise<void> {
    if (await conferma('Tornare all\'elenco dei comuni incorporato nel programma?')) await impostazioni.usaComuniIncorporati();
  }
  async function leggiSetup(): Promise<void> {
    errore = null; messaggio = null;
    const f = await scegliFile('Scegli SETUP.DAT di Docfa', [{ nome: 'SETUP.DAT', estensioni: ['dat', 'DAT'] }]);
    if (!f) return;
    try { await impostazioni.leggiSetupDocfa(f); messaggio = 'Dati del tecnico letti da SETUP.DAT'; }
    catch (e) { errore = e instanceof Error ? e.message : String(e); }
  }
  async function rimuovi(prov: string): Promise<void> {
    if (await conferma(`Rimuovere gli archivi della provincia ${prov}?`)) await impostazioni.rimuoviProvincia(prov);
  }
  const comuniPerProvincia = (prov: string) => impostazioni.comuni.filter((c) => c.provincia === prov).length;
</script>

<div class="flex h-full flex-col">
  <Intestazione titolo="Impostazioni" indietro="/">
    {#snippet azioni()}
      {#if salvato}<span class="flex items-center gap-1 text-xs text-accent-700 dark:text-accent-300"><Icona nome="spunta" /> Salvato</span>{/if}
      <button type="button" class="btn btn-primario" onclick={salva}><Icona nome="salva" /> Salva</button>
    {/snippet}
  </Intestazione>

  <main class="mx-auto w-full max-w-5xl flex-1 space-y-5 px-5 py-6">
    <Avvisi errori={errore ? [errore] : []} />
    {#if messaggio}<Avvisi vuoto={messaggio} />{/if}

    <Sezione titolo="Tecnico" descrizione="Precompila i dati del tecnico redattore in ogni nuova pratica.">
      {#snippet azioni()}
        <button type="button" class="btn btn-piccolo" onclick={leggiSetup}><Icona nome="importa" /> Leggi SETUP.DAT di Docfa</button>
      {/snippet}
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Campo etichetta="Cognome"><input type="text" class="campo" maxlength="24" bind:value={impostazioni.dati.tecnico.cognome} onchange={salva} /></Campo>
        <Campo etichetta="Nome"><input type="text" class="campo" maxlength="20" bind:value={impostazioni.dati.tecnico.nome} onchange={salva} /></Campo>
        <Campo etichetta="Codice fiscale"><input type="text" class="campo uppercase font-mono" maxlength="16" bind:value={impostazioni.dati.tecnico.codiceFiscale} onchange={salva} /></Campo>
        <Campo etichetta="Albo">
          <select class="campo" bind:value={impostazioni.dati.tecnico.albo} onchange={salva}>
            {#each Object.entries(ALBI) as [k, v] (k)}<option value={k}>{k} – {v}</option>{/each}
          </select>
        </Campo>
        <Campo etichetta="Numero di iscrizione"><input type="text" class="campo" maxlength="5" bind:value={impostazioni.dati.tecnico.numeroIscrizione} onchange={salva} /></Campo>
        <Campo etichetta="Provincia dell'albo"><input type="text" class="campo uppercase" maxlength="2" bind:value={impostazioni.dati.tecnico.provinciaAlbo} onchange={salva} /></Campo>
      </div>
    </Sezione>

    <Sezione titolo="Cartella delle pratiche" descrizione="Dove vengono salvate le pratiche (una sottocartella per pratica).">
      <div class="flex items-center gap-3">
        <input type="text" class="campo flex-1 font-mono text-xs" value={impostazioni.dati.cartellaPratiche} readonly placeholder="Nessuna cartella scelta" />
        <button type="button" class="btn" onclick={scegli}><Icona nome="cartella" /> Scegli…</button>
      </div>
    </Sezione>

    <Sezione titolo="Numerazione delle immagini" descrizione="Ogni planimetria ed elaborato riceve un numero immagine unico. Docfa numera le sue immagini da 1: se importando una pratica compare «alcune planimetrie non importate», il numero coincide con un'immagine già presente nell'archivio di Docfa. Il numero si può anche cambiare nella singola planimetria.">
      <div class="flex items-center gap-3">
        <Campo etichetta="Prossimo numero immagine">
          <input type="text" inputmode="numeric" class="campo w-32 font-mono" maxlength="7" value={String(impostazioni.dati.prossimaImmagine ?? PRIMA_IMMAGINE).padStart(7, '0')} onchange={async (e) => { const n = Number(e.currentTarget.value.replace(/\D/g, '')); if (n > 0 && n <= 9999999) { impostazioni.dati.prossimaImmagine = n; await salva(); } e.currentTarget.value = String(impostazioni.dati.prossimaImmagine ?? PRIMA_IMMAGINE).padStart(7, '0'); }} />
        </Campo>
      </div>
    </Sezione>

    <Sezione titolo="Archivi dell'Agenzia" descrizione="Come in Docfa: scegli la cartella della provincia scaricata dal sito dell'Agenzia (es. «fi») e vengono letti tutti i file: stradario, tariffe, zone e prospetti per il classamento. Puoi scegliere anche una cartella che contiene più province, o la cartella di installazione di Docfa per aggiornare i comuni.">
      {#snippet azioni()}
        <button type="button" class="btn btn-piccolo" onclick={importaFile} disabled={inCorso}><Icona nome="importa" /> Singolo file…</button>
        <button type="button" class="btn btn-piccolo btn-primario" onclick={importaCartella} disabled={inCorso}><Icona nome="cartella" /> {inCorso ? 'Importazione…' : 'Importa cartella…'}</button>
      {/snippet}
      {#if esito}
        <div class="mb-4 rounded-md border border-accent-300/60 bg-accent-50 px-3 py-2 text-sm dark:border-accent-700/60 dark:bg-accent-950/40">
          <p class="mb-1 flex items-center gap-1 font-medium text-accent-800 dark:text-accent-200"><Icona nome="spunta" /> Importazione completata</p>
          <ul class="space-y-0.5 text-fg">{#each esito.righe as r (r)}<li>{r}</li>{/each}</ul>
          {#if esito.avvisi.length}<ul class="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">{#each esito.avvisi as a (a)}<li>{a}</li>{/each}</ul>{/if}
        </div>
      {/if}
      <dl class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-fg-muted">Comuni</dt>
          <dd class="text-lg font-semibold tabular-nums">{impostazioni.comuni.length.toLocaleString('it-IT')}</dd>
          <dd class="text-xs text-fg-faint">{impostazioni.fonteComuni}
            {#if impostazioni.dati.archivi.comuni}<button type="button" class="ml-1 underline" onclick={comuniIncorporati}>usa l'elenco incorporato</button>{/if}
          </dd>
        </div>
        <div class="rounded-md border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-fg-muted">Province</dt>
          <dd class="text-lg font-semibold tabular-nums">{impostazioni.province.length}</dd>
          <dd class="text-xs text-fg-faint">{impostazioni.dati.archivi.provinciali.length} con archivi importati</dd>
        </div>
        <div class="rounded-md border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-fg-muted">Strade</dt>
          <dd class="text-lg font-semibold tabular-nums">{impostazioni.numeroStrade.toLocaleString('it-IT')}</dd>
        </div>
      </dl>
      <h3 class="mt-5 mb-2 text-xs font-semibold text-fg-muted">Archivi provinciali</h3>
      {#if !impostazioni.dati.archivi.provinciali.length}
        <p class="text-sm text-fg-muted">Nessun archivio provinciale: senza stradario l'indirizzo si scrive liberamente, senza tariffe la rendita va inserita a mano.</p>
      {:else}
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-fg-muted">
            <th class="py-1 text-left font-medium">Provincia</th><th class="py-1 text-left font-medium">Comuni</th><th class="py-1 text-left font-medium">Stradario</th>
            <th class="py-1 text-left font-medium">Tariffe</th><th class="py-1 text-left font-medium">Zone</th><th class="py-1 text-left font-medium">Classamento</th>
            <th class="py-1 text-left font-medium">Importato</th><th></th>
          </tr></thead>
          <tbody>
            {#each impostazioni.dati.archivi.provinciali as p (p.provincia)}
              <tr class="border-t border-line">
                <td class="py-1.5 font-medium">{p.provincia}</td>
                <td class="py-1.5 tabular-nums">{comuniPerProvincia(p.provincia)}</td>
                <td class="py-1.5 tabular-nums">{p.stradario ? `${(impostazioni.strade[p.provincia]?.length ?? 0).toLocaleString('it-IT')} strade` : '—'}</td>
                <td class="py-1.5 tabular-nums">{p.tariffe ? `${(impostazioni.tariffe[p.provincia]?.length ?? 0).toLocaleString('it-IT')} voci` : '—'}</td>
                <td class="py-1.5 tabular-nums">{p.zone ? `${(impostazioni.zone[p.provincia]?.length ?? 0).toLocaleString('it-IT')} fogli` : '—'}</td>
                <td class="py-1.5 tabular-nums">{p.classamento?.length ? `${p.classamento.length} prospetti` : '—'}</td>
                <td class="py-1.5 text-xs text-fg-muted">{p.importato ? p.importato.split('-').reverse().join('/') : ''}</td>
                <td class="py-1.5 text-right"><button type="button" class="btn btn-piccolo btn-pericolo" onclick={() => rimuovi(p.provincia)} title="Rimuovi"><Icona nome="cestino" /></button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Sezione>

    <Sezione titolo="Informazioni" descrizione="{PROGETTO.nome} {version}: software libero e gratuito ({PROGETTO.licenza}).">
      <div class="space-y-3 text-sm">
        <p>
          Il programma è fornito <strong>così com'è, senza alcuna garanzia</strong>, nemmeno implicita di commerciabilità o
          di idoneità a uno scopo particolare: il professionista resta responsabile dei documenti che firma e presenta.
          {PROGETTO.nome} non è un software dell'Agenzia delle Entrate né di Sogei.
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-piccolo" onclick={() => apriUrl(PROGETTO.sorgenti)}>Codice sorgente</button>
          <button type="button" class="btn btn-piccolo btn-primario" onclick={() => apriUrl(PROGETTO.donazioni)}>Sostieni il progetto con una donazione</button>
        </div>
      </div>
    </Sezione>
  </main>
</div>
