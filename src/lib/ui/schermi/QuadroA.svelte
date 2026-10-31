<script lang="ts">
  /** Quadro A – Dichiarazione di fabbricato urbano (accatastamento): dati generali per ogni ditta. */
  import { schedeElaborato, type Pratica, type QuadroA } from '$lib/core/model';
  import { TIPOLOGIE_ACCATASTAMENTO, DICITURE_AFFERENTI_ALTRO } from '$lib/core/regole-docfa';
  import { nuovaDitta } from '$lib/stato/pratica-file';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { conferma } from '$lib/piattaforma';
  import Campo from '../Campo.svelte';
  import CampoData from '../CampoData.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();
  let indice = $state(0);
  const qa = $derived(pratica.quadroA as QuadroA);
  const ditta = $derived(qa.ditte[Math.min(indice, qa.ditte.length - 1)]);
  $effect(() => { if (ditta && !ditta.tipoMappale) ditta.tipoMappale = { numero: 0, data: { gg: 0, mm: 0, aaaa: 0 } }; });

  async function eliminaDitta(): Promise<void> {
    if (qa.ditte.length < 2) return;
    if (!(await conferma(`Eliminare la ditta n. ${indice + 1}?`))) return;
    qa.ditte.splice(indice, 1);
    for (const u of pratica.unita) if ((u.ditta ?? 0) === indice) u.ditta = 0; else if ((u.ditta ?? 0) > indice) u.ditta = (u.ditta ?? 0) - 1;
    indice = Math.max(0, indice - 1);
  }
  function nuova(): void {
    qa.ditte.push(nuovaDitta());
    indice = qa.ditte.length - 1;
  }
  function intestazione(v: 'nuova' | 'ceu' | 'ct'): void {
    ditta.intestazione = v;
    if (v === 'nuova') ditta.riferimento = undefined;
    else ditta.riferimento ??= { comune: pratica.comune.codiceAmministrativo, foglio: '', numero: '' };
  }
  const n = (v: string) => Math.max(0, Math.min(999, Math.trunc(Number(v) || 0)));
  const conteggi = $derived({
    i1n: pratica.mod1NParteI ? 1 : 0,
    ii1n: pratica.unita.filter((u) => u.mod1NParteII).length,
    i2n: pratica.unita.filter((u) => u.mod2N).length,
    ii2n: pratica.unita.reduce((s, u) => s + (u.mod2N?.corpi.length ?? 0), 0),
    plan: pratica.unita.filter((u) => u.planimetria).length,
    ep: pratica.elaboratoPlanimetrico ? Math.max(1, schedeElaborato(pratica.elaboratoPlanimetrico).length) : 0,
  });
  const comuni = $derived(impostazioni.comuni.filter((c) => c.provincia === pratica.comune.provincia));
</script>

<div class="space-y-5">
  <Sezione titolo="Quadro A – Dichiarazione di fabbricato urbano" descrizione="Da compilare solo per la dichiarazione di nuova costruzione o di unità afferenti.">
    {#snippet azioni()}
      <span class="text-sm">Ditta n. <strong>{indice + 1}</strong> di <strong>{qa.ditte.length}</strong></span>
      <div class="flex">
        <button type="button" class="btn btn-piccolo rounded-r-none" disabled={indice === 0} onclick={() => indice--} title="Ditta precedente"><Icona nome="sinistra" /></button>
        <button type="button" class="btn btn-piccolo -ml-px rounded-l-none" disabled={indice >= qa.ditte.length - 1} onclick={() => indice++} title="Ditta successiva"><Icona nome="destra" /></button>
      </div>
      <button type="button" class="btn btn-piccolo" onclick={nuova}><Icona nome="piu" /> Nuova ditta</button>
      <button type="button" class="btn btn-piccolo btn-pericolo" onclick={eliminaDitta} disabled={qa.ditte.length < 2}><Icona nome="cestino" /> Elimina ditta</button>
    {/snippet}

    <div class="grid gap-6 xl:grid-cols-2">
      <div class="space-y-5">
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">Tipo mappale</h3>
          {#if ditta.tipoMappale}
            {@const tm = ditta.tipoMappale}
            <div class="grid grid-cols-2 gap-3">
              <Campo etichetta="Protocollo n." obbligatorio>
                <input type="text" inputmode="numeric" class="campo" maxlength="8" value={tm.numero || ''} oninput={(e) => (tm.numero = Number(e.currentTarget.value.replace(/\D/g, '')))} />
              </Campo>
              <Campo etichetta="del" obbligatorio><CampoData bind:valore={tm.data} /></Campo>
            </div>
          {/if}
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">Ditta da intestare</h3>
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="intest" checked={ditta.intestazione === 'nuova'} onchange={() => intestazione('nuova')} /> Nuova con intestati n. <strong>{ditta.intestati.length}</strong></label>
            <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="intest" checked={ditta.intestazione === 'ceu'} onchange={() => intestazione('ceu')} /> Già in atti al C.E.U.</label>
            <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="intest" checked={ditta.intestazione === 'ct'} onchange={() => intestazione('ct')} /> Già in atti al C.T.</label>
          </div>
          {#if ditta.intestazione !== 'nuova' && ditta.riferimento}
            {@const r = ditta.riferimento}
            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Campo etichetta="Comune" classe="col-span-2" obbligatorio>
                <select class="campo" bind:value={r.comune}>
                  {#each comuni as c, i (`${i}${c.codice}`)}<option value={c.codiceAmministrativo}>{c.nome}</option>{/each}
                  {#if !comuni.length}<option value={pratica.comune.codiceAmministrativo}>{pratica.comune.nome || pratica.comune.codiceAmministrativo}</option>{/if}
                </select>
              </Campo>
              {#if ditta.intestazione === 'ceu'}
                <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" value={r.sezione ?? ''} onchange={(e) => (r.sezione = e.currentTarget.value.trim().toUpperCase() || undefined)} /></Campo>
              {/if}
              <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo" maxlength={ditta.intestazione === 'ct' ? 5 : 4} bind:value={r.foglio} /></Campo>
              <Campo etichetta="Particella" obbligatorio><input type="text" class="campo" maxlength="5" bind:value={r.numero} /></Campo>
              <Campo etichetta="Sub."><input type="text" class="campo" maxlength="4" value={r.subalterno ?? ''} onchange={(e) => (r.subalterno = e.currentTarget.value.trim() || undefined)} /></Campo>
            </div>
          {/if}
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">Unità immobiliari</h3>
          <div class="grid grid-cols-3 gap-3">
            <Campo etichetta="A destinazione ordinaria" obbligatorio aiuto="categorie A, B, C"><input type="number" class="campo" min="0" max="999" value={ditta.unitaOrdinarie} oninput={(e) => (ditta.unitaOrdinarie = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="Speciale o particolare" obbligatorio aiuto="categorie D, E e F"><input type="number" class="campo" min="0" max="999" value={ditta.unitaSpeciali} oninput={(e) => (ditta.unitaSpeciali = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="In costituzione"><input type="number" class="campo" value={ditta.unitaOrdinarie + ditta.unitaSpeciali} disabled /></Campo>
          </div>
        </div>

        <div class="w-56">
          <Campo etichetta="Data di ultimazione lavori" aiuto="da quando le unità sono abitabili o servibili all'uso"><CampoData bind:valore={pratica.dataVariazione} /></Campo>
        </div>
      </div>

      <div class="space-y-5">
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted obbligatorio">Causale di presentazione</h3>
          <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="caus" checked={qa.causale === 'NC'} onchange={() => { qa.causale = 'NC'; qa.afferenti = undefined; }} /> Nuova costruzione</label>
          <label class="mt-2 flex items-center gap-2 text-sm"><input type="radio" class="check" name="caus" checked={qa.causale === 'AFF'} onchange={() => { qa.causale = 'AFF'; qa.afferenti ??= { identificativo: { foglio: '', numero: '' }, sopraelevazione: false, areaCorte: false, altro: false }; }} /> Unità afferenti al seguente identificativo</label>
          {#if qa.causale === 'AFF' && qa.afferenti}
            {@const a = qa.afferenti}
            <div class="mt-3 ml-6 space-y-3">
              <div class="grid grid-cols-4 gap-3">
                <Campo etichetta="Sezione"><input type="text" class="campo uppercase" maxlength="3" value={a.identificativo.sezione ?? ''} onchange={(e) => (a.identificativo.sezione = e.currentTarget.value.trim().toUpperCase() || undefined)} /></Campo>
                <Campo etichetta="Foglio" obbligatorio><input type="text" class="campo" maxlength="4" bind:value={a.identificativo.foglio} /></Campo>
                <Campo etichetta="Numero" obbligatorio><input type="text" class="campo" maxlength="5" bind:value={a.identificativo.numero} /></Campo>
                <Campo etichetta="Denom."><input type="text" class="campo" maxlength="4" value={a.identificativo.denominatore ?? ''} onchange={(e) => (a.identificativo.denominatore = e.currentTarget.value.trim() || undefined)} /></Campo>
              </div>
              <div class="space-y-1.5">
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={a.sopraelevazione} /> Unità afferenti edificate in sopraelevazione</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={a.areaCorte} /> Unità afferenti edificate su aree di corte</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={a.altro} onchange={() => { if (!a.altro) pratica.altreVariazioni = undefined; }} /> Altro</label>
                <input type="text" class="campo ml-6 w-80" maxlength="35" list="diciture-afferenti" disabled={!a.altro} value={pratica.altreVariazioni ?? ''} oninput={(e) => (pratica.altreVariazioni = e.currentTarget.value.toUpperCase() || undefined)} />
                <datalist id="diciture-afferenti">{#each DICITURE_AFFERENTI_ALTRO as d (d)}<option value={d}></option>{/each}</datalist>
              </div>
            </div>
          {/if}
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted obbligatorio">Tipologia di documento</h3>
          <div class="space-y-1.5">
            {#each TIPOLOGIE_ACCATASTAMENTO as t (t.opzione)}
              <label class="flex items-start gap-2 text-sm"><input type="radio" class="check mt-0.5" name="tipologia" checked={pratica.tipologia === t.flag} onchange={() => (pratica.tipologia = t.flag)} /> <span>{t.opzione}. {t.descrizione}</span></label>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </Sezione>

  <div class="grid gap-5 md:grid-cols-2">
    <Sezione titolo="Modelli 1N/2N" descrizione="Riportati automaticamente.">
      <div class="grid grid-cols-4 gap-3">
        <Campo etichetta="1N parte I"><input class="campo" value={conteggi.i1n} disabled /></Campo>
        <Campo etichetta="1N parte II"><input class="campo" value={conteggi.ii1n} disabled /></Campo>
        <Campo etichetta="2N parte I"><input class="campo" value={conteggi.i2n} disabled /></Campo>
        <Campo etichetta="2N parte II"><input class="campo" value={conteggi.ii2n} disabled /></Campo>
      </div>
    </Sezione>
    <Sezione titolo="Elaborati grafici" descrizione="Riportati automaticamente.">
      <div class="grid grid-cols-2 gap-3">
        <Campo etichetta="Elab. plan. pag. n."><input class="campo" value={conteggi.ep} disabled /></Campo>
        <Campo etichetta="Planimetrie n."><input class="campo" value={conteggi.plan} disabled /></Campo>
      </div>
    </Sezione>
  </div>
</div>
