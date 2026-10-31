<script lang="ts">
  /** Quadro I – Ditta da intestare: soggetti (persona fisica, giuridica o bene comune censibile) con titolo e quota. */
  import type { Comune, Intestato, Pratica, QuadroA } from '$lib/core/model';
  import { TITOLI } from '$lib/core/dati/docfa-tabelle.generated';
  import { REGIMI } from '$lib/core/regole-docfa';
  import { calcolaCodiceFiscale } from '$lib/core/codice-fiscale';
  import { nuovoIntestato } from '$lib/stato/pratica-file';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { conferma } from '$lib/piattaforma';
  import Campo from '../Campo.svelte';
  import CampoData from '../CampoData.svelte';
  import ComuneProvincia from '../ComuneProvincia.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();
  const qa = $derived(pratica.quadroA as QuadroA);
  let indiceDitta = $state(0);
  const ditte = $derived(qa.ditte.map((d, i) => ({ d, i })).filter(({ d }) => d.intestazione === 'nuova'));
  const ditta = $derived(ditte.find((x) => x.i === indiceDitta)?.d ?? ditte[0]?.d);
  let sel = $state(0);
  const it = $derived(ditta?.intestati[Math.min(sel, (ditta?.intestati.length ?? 1) - 1)]);

  function nuovo(): void {
    if (!ditta) return;
    ditta.intestati.push(nuovoIntestato());
    sel = ditta.intestati.length - 1;
  }
  async function elimina(): Promise<void> {
    if (!ditta || !it) return;
    if (!(await conferma(`Eliminare il soggetto n. ${sel + 1}?`))) return;
    ditta.intestati.splice(sel, 1);
    sel = Math.max(0, sel - 1);
  }
  function tipo(x: Intestato, t: Intestato['tipo']): void {
    x.tipo = t;
    if (t === 'fisica') { x.denominazione = undefined; }
    else { x.cognome = undefined; x.nome = undefined; x.sesso = undefined; x.nascita = undefined; }
    if (t === 'bcc') { x.denominazione = 'BENI COMUNI CENSIBILI'; x.codiceFiscale = undefined; x.comune = undefined; x.provincia = undefined; x.regime = undefined; x.riferimento = undefined; }
  }
  let codiceNascita = $state<string | undefined>();
  function calcola(x: Intestato): void {
    const c = codiceNascita ?? impostazioni.comuni.find((k) => k.provincia === x.provincia && k.nome === x.comune)?.codice;
    if (!x.cognome || !x.nome || !x.sesso || !x.nascita?.aaaa || !c) { erroreCf = 'Per il calcolo servono cognome, nome, sesso, data e comune di nascita'; return; }
    erroreCf = '';
    x.codiceFiscale = calcolaCodiceFiscale(x.cognome, x.nome, x.sesso, x.nascita, c);
  }
  let erroreCf = $state('');
  const titolo = $derived(TITOLI.find((t) => t.codice === it?.titolo));
  const nomeSoggetto = (x: Intestato) => (x.tipo === 'fisica' ? `${x.cognome ?? ''} ${x.nome ?? ''}`.trim() : x.denominazione ?? '') || '(senza nome)';
  const descrTitolo = (c: string) => TITOLI.find((t) => t.codice === c)?.descrizione ?? c;
  const maiuscolo = (v: string) => v.toUpperCase();
</script>

{#if !ditta}
  <div class="scheda p-6 text-sm text-fg-muted">Nessuna ditta con intestazione nuova: il quadro I non va compilato (ditta già in atti).</div>
{:else}
  <div class="grid gap-5 lg:grid-cols-[18rem_1fr]">
    <aside class="scheda self-start p-3">
      {#if ditte.length > 1}
        <select class="campo mb-3" value={indiceDitta} onchange={(e) => { indiceDitta = Number(e.currentTarget.value); sel = 0; }}>
          {#each ditte as x (x.i)}<option value={x.i}>Ditta n. {x.i + 1}</option>{/each}
        </select>
      {/if}
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">Soggetti ({ditta.intestati.length})</h2>
        <div class="flex gap-1">
          <button type="button" class="btn btn-piccolo btn-primario" onclick={nuovo}><Icona nome="piu" /> Nuovo sogg.</button>
          <button type="button" class="btn btn-piccolo btn-pericolo" onclick={elimina} disabled={!it} title="Elimina soggetto"><Icona nome="cestino" /></button>
        </div>
      </div>
      <ul class="space-y-1">
        {#each ditta.intestati as x, i (i)}
          <li>
            <button type="button" class="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 {i === sel ? 'bg-accent-50 text-accent-900 dark:bg-accent-950 dark:text-accent-100' : ''}" onclick={() => (sel = i)}>
              <span class="truncate font-medium">{i + 1}. {nomeSoggetto(x)}</span>
              <span class="truncate text-xs text-fg-muted">{descrTitolo(x.titolo)}{x.quotaNumeratore && x.quotaDenominatore ? ` per ${x.quotaNumeratore}/${x.quotaDenominatore}` : ''}</span>
            </button>
          </li>
        {/each}
        {#if !ditta.intestati.length}<li class="px-2 py-3 text-xs text-fg-faint">Nessun soggetto: premi «Nuovo sogg.».</li>{/if}
      </ul>
    </aside>

    {#if it}
      <div class="space-y-5">
        <Sezione titolo={`Quadro I – Soggetto n. ${sel + 1}`} descrizione="Titolare dei diritti reali sulle unità immobiliari dichiarate.">
          <div class="mb-4 flex flex-wrap gap-5">
            {#each [['fisica', 'Persona fisica'], ['giuridica', 'Persona giuridica'], ['bcc', 'Bene comune censibile']] as [t, et] (t)}
              <label class="flex items-center gap-2 text-sm font-medium"><input type="radio" class="check" name="tipo-sogg" checked={it.tipo === t} onchange={() => tipo(it, t as Intestato['tipo'])} /> {et}</label>
            {/each}
          </div>
          {#if it.tipo === 'fisica'}
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Campo etichetta="Cognome" obbligatorio><input type="text" class="campo uppercase" maxlength="50" value={it.cognome ?? ''} oninput={(e) => (it.cognome = maiuscolo(e.currentTarget.value))} /></Campo>
              <Campo etichetta="Nome" obbligatorio><input type="text" class="campo uppercase" maxlength="50" value={it.nome ?? ''} oninput={(e) => (it.nome = maiuscolo(e.currentTarget.value))} /></Campo>
              <Campo etichetta="Data di nascita" obbligatorio><CampoData bind:valore={it.nascita} /></Campo>
              <Campo etichetta="Sesso" obbligatorio>
                <select class="campo" value={it.sesso ?? ''} onchange={(e) => (it.sesso = (e.currentTarget.value || undefined) as Intestato['sesso'])}><option value=""></option><option value="M">M</option><option value="F">F</option></select>
              </Campo>
              <div class="sm:col-span-2"><ComuneProvincia bind:provincia={it.provincia as string} bind:comune={it.comune as string} etichettaComune="Comune di nascita" obbligatorio scelto={(c: Comune | undefined) => (codiceNascita = c?.codice)} /></div>
              <Campo etichetta="Codice fiscale" obbligatorio errore={erroreCf}>
                <div class="flex gap-2">
                  <input type="text" class="campo font-mono uppercase" maxlength="16" value={it.codiceFiscale ?? ''} oninput={(e) => (it.codiceFiscale = maiuscolo(e.currentTarget.value))} />
                  <button type="button" class="btn shrink-0" onclick={() => calcola(it)}>Calcola</button>
                </div>
              </Campo>
              <Campo etichetta="Indirizzo PEC" aiuto="facoltativo"><input type="email" class="campo" maxlength="60" value={it.pec ?? ''} oninput={(e) => (it.pec = e.currentTarget.value || undefined)} /></Campo>
            </div>
          {:else if it.tipo === 'giuridica'}
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Campo etichetta="Denominazione o ragione sociale" classe="sm:col-span-2" obbligatorio><input type="text" class="campo uppercase" maxlength="100" value={it.denominazione ?? ''} oninput={(e) => (it.denominazione = maiuscolo(e.currentTarget.value))} /></Campo>
              <div class="sm:col-span-2"><ComuneProvincia bind:provincia={it.provincia as string} bind:comune={it.comune as string} etichettaComune="Sede legale (comune)" /></div>
              <Campo etichetta="Codice fiscale o partita IVA"><input type="text" class="campo font-mono uppercase" maxlength="16" value={it.codiceFiscale ?? ''} oninput={(e) => (it.codiceFiscale = maiuscolo(e.currentTarget.value))} /></Campo>
              <Campo etichetta="Indirizzo PEC" aiuto="facoltativo"><input type="email" class="campo" maxlength="60" value={it.pec ?? ''} oninput={(e) => (it.pec = e.currentTarget.value || undefined)} /></Campo>
            </div>
          {:else}
            <p class="text-sm text-fg-muted">Il soggetto sarà acquisito come «Beni comuni censibili».</p>
          {/if}
        </Sezione>

        <Sezione titolo="Titolo">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Campo etichetta="Titolo" classe="sm:col-span-2" obbligatorio>
              <select class="campo" bind:value={it.titolo}>
                {#each TITOLI as t (t.codice)}<option value={t.codice}>{t.codice.trim()} – {t.descrizione}</option>{/each}
              </select>
            </Campo>
            <Campo etichetta="Quota" obbligatorio={titolo?.quotaObbligatoria} aiuto={titolo?.quotaObbligatoria ? 'numeratore / denominatore' : 'non prevista per questo titolo'}>
              <div class="flex items-center gap-1.5">
                <input type="text" inputmode="numeric" class="campo text-right" maxlength="9" value={it.quotaNumeratore ?? ''} disabled={!titolo?.quotaObbligatoria} oninput={(e) => (it.quotaNumeratore = e.currentTarget.value.replace(/\D/g, '') || undefined)} />
                <span>/</span>
                <input type="text" inputmode="numeric" class="campo" maxlength="6" value={it.quotaDenominatore ?? ''} disabled={!titolo?.quotaObbligatoria} oninput={(e) => (it.quotaDenominatore = Number(e.currentTarget.value.replace(/\D/g, '')) || undefined)} />
              </div>
            </Campo>
            {#if it.tipo === 'fisica'}
              <Campo etichetta="Regime">
                <select class="campo" value={it.regime ?? ''} onchange={(e) => { it.regime = (e.currentTarget.value || undefined) as Intestato['regime']; if (it.regime !== 'C') it.riferimento = undefined; }}>
                  <option value=""></option>
                  {#each REGIMI as [k, v] (k)}<option value={k}>{k} – {v}</option>{/each}
                </select>
              </Campo>
            {/if}
            <Campo etichetta="Eventuale specificazione del diritto" classe="sm:col-span-2" aiuto="solo per diritti non codificati (es. livellario)"><input type="text" class="campo uppercase" maxlength="50" value={it.specificazione ?? ''} oninput={(e) => (it.specificazione = maiuscolo(e.currentTarget.value) || undefined)} /></Campo>
            {#if it.tipo === 'fisica'}
              <Campo etichetta="Num. intestato di riferimento" aiuto="solo in comunione legale">
                <input type="number" class="campo" min="1" max={ditta.intestati.length} value={it.riferimento ?? ''} disabled={it.regime !== 'C'} oninput={(e) => (it.riferimento = Number(e.currentTarget.value) || undefined)} />
              </Campo>
            {/if}
          </div>
        </Sezione>
      </div>
    {/if}
  </div>
{/if}
