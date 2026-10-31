<script lang="ts">
  /** Dati del Dichiarante: in alto il tecnico compilatore (richiamabile dall'elenco dei tecnici), in basso il dichiarante. */
  import type { Pratica, Tecnico } from '$lib/core/model';
  import { ALBI_TECNICO } from '$lib/core/regole-docfa';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from '../Campo.svelte';
  import ComuneProvincia from '../ComuneProvincia.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();
  const albo = $derived(ALBI_TECNICO.find((a) => a.codice === pratica.tecnico.albo.padStart(2, '0')));
  const tecnici = $derived(impostazioni.elencoTecnici());
  function richiama(t: Tecnico): void {
    pratica.tecnico = { ...t };
  }
  let attestazione = $state(false);
  const M = (v: string) => v.toUpperCase();
</script>

<div class="space-y-5">
  <Sezione titolo="Dati del tecnico compilatore" descrizione="Tutti obbligatori per i tecnici professionisti. I dati inseriti vengono memorizzati per i documenti successivi.">
    {#snippet azioni()}
      {#if tecnici.length}
        <select class="campo w-64" value="" onchange={(e) => { const t = tecnici[Number(e.currentTarget.value)]; if (t) richiama(t); e.currentTarget.value = ''; }} aria-label="Elenco dei tecnici">
          <option value="">Elenco dei tecnici…</option>
          {#each tecnici as t, k (k)}<option value={k}>{t.cognome} {t.nome}</option>{/each}
        </select>
      {/if}
    {/snippet}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Campo etichetta="Cognome" obbligatorio><input type="text" class="campo uppercase" maxlength="24" value={pratica.tecnico.cognome} oninput={(e) => (pratica.tecnico.cognome = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Nome" obbligatorio><input type="text" class="campo uppercase" maxlength="20" value={pratica.tecnico.nome} oninput={(e) => (pratica.tecnico.nome = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Codice fiscale" obbligatorio><input type="text" class="campo font-mono uppercase" maxlength="16" value={pratica.tecnico.codiceFiscale} oninput={(e) => (pratica.tecnico.codiceFiscale = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Albo di iscrizione" obbligatorio>
        <select class="campo" value={pratica.tecnico.albo.padStart(2, '0')} onchange={(e) => { pratica.tecnico.albo = e.currentTarget.value; if (albo?.dipendentePubblico) { pratica.tecnico.provinciaAlbo = ''; pratica.tecnico.numeroIscrizione = ''; } }}>
          {#each ALBI_TECNICO as a (a.codice)}<option value={a.codice}>{a.descrizione}</option>{/each}
        </select>
      </Campo>
      <Campo etichetta="Provincia (o circondario) di iscrizione" obbligatorio={!albo?.dipendentePubblico}><input type="text" class="campo uppercase" maxlength="2" value={pratica.tecnico.provinciaAlbo} disabled={albo?.dipendentePubblico} oninput={(e) => (pratica.tecnico.provinciaAlbo = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Numero di iscrizione" obbligatorio={!albo?.dipendentePubblico}><input type="text" class="campo" maxlength="5" value={pratica.tecnico.numeroIscrizione} disabled={albo?.dipendentePubblico} oninput={(e) => (pratica.tecnico.numeroIscrizione = e.currentTarget.value.trim())} /></Campo>
    </div>
  </Sezione>

  <Sezione titolo="Dati del dichiarante" descrizione="Il soggetto che ha richiesto la dichiarazione. Tutti obbligatori tranne la PEC.">
    {#snippet azioni()}
      <button type="button" class="btn btn-piccolo" onclick={() => (attestazione = true)}><Icona nome="scudo" /> Attestazione per invio telematico</button>
    {/snippet}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Campo etichetta="Cognome" obbligatorio><input type="text" class="campo uppercase" maxlength="24" value={pratica.dichiarante.cognome} oninput={(e) => (pratica.dichiarante.cognome = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Nome" obbligatorio><input type="text" class="campo uppercase" maxlength="20" value={pratica.dichiarante.nome} oninput={(e) => (pratica.dichiarante.nome = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Indirizzo" obbligatorio><input type="text" class="campo uppercase" maxlength="35" value={pratica.dichiarante.indirizzo} oninput={(e) => (pratica.dichiarante.indirizzo = M(e.currentTarget.value))} /></Campo>
      <Campo etichetta="Numero civico" obbligatorio aiuto="SNC se assente"><input type="text" class="campo uppercase" maxlength="5" value={pratica.dichiarante.civico} oninput={(e) => (pratica.dichiarante.civico = M(e.currentTarget.value.trim()))} /></Campo>
      <div class="sm:col-span-2"><ComuneProvincia bind:provincia={pratica.dichiarante.provincia} bind:comune={pratica.dichiarante.comune} etichettaComune="Comune di residenza" obbligatorio /></div>
      <Campo etichetta="C.A.P." obbligatorio><input type="text" class="campo" maxlength="5" inputmode="numeric" value={pratica.dichiarante.cap} oninput={(e) => (pratica.dichiarante.cap = e.currentTarget.value.replace(/\D/g, ''))} /></Campo>
      <Campo etichetta="Indirizzo PEC" aiuto="facoltativo"><input type="email" class="campo" maxlength="60" value={pratica.dichiarante.pec ?? ''} oninput={(e) => (pratica.dichiarante.pec = e.currentTarget.value || undefined)} /></Campo>
    </div>
  </Sezione>
</div>

{#if attestazione}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Attestazione per invio telematico">
    <div class="scheda max-w-xl p-6">
      <h2 class="text-base font-semibold">Attestazione per invio telematico</h2>
      <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-muted">
        <li>Dichiaro di non essere nella condizione di sospensione o revoca dell'esercizio della professione.</li>
        <li>Dichiaro di effettuare la presentazione del presente atto su incarico di {pratica.dichiarante.cognome} {pratica.dichiarante.nome}, quale soggetto obbligato.</li>
        <li>Dichiaro che il presente modello unico informatico di aggiornamento degli atti catastali è conforme ai documenti cartacei in originale sottoscritti da me medesimo e dal soggetto obbligato.</li>
      </ul>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn" onclick={() => (attestazione = false)}>Annulla</button>
        <button type="button" class="btn btn-primario" onclick={() => (attestazione = false)}><Icona nome="spunta" /> Sì</button>
      </div>
    </div>
  </div>
{/if}
