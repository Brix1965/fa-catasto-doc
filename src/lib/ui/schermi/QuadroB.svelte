<script lang="ts">
  /** Quadro B – Denuncia di variazione: dati generali, causali (con le compatibilità di Docfa) e tipologia di documento. */
  import { schedeElaborato, type Pratica } from '$lib/core/model';
  import { TIPOLOGIE_VARIAZIONE, TIPOLOGIE_PLANIMETRICHE, DESCRIZIONE_CAUSALE, DICITURE_ALTRE_VARIAZIONI, causaliCompatibili, type CodiceVariazione } from '$lib/core/regole-docfa';
  import { causaliBarrate } from '$lib/core/compile';
  import { derivateCalcolate } from '$lib/stato/validazione';
  import Campo from '../Campo.svelte';
  import CampoData from '../CampoData.svelte';
  import Sezione from '../Sezione.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();

  $effect(() => {
    if (!pratica.tipoMappale) pratica.tipoMappale = { numero: 0, data: { gg: 0, mm: 0, aaaa: 0 } };
    if (!pratica.dichiarate) pratica.dichiarate = { soppresse: pratica.unita.filter((u) => u.operazione === 'S').length, variate: pratica.unita.filter((u) => u.operazione === 'V').length, costituite: pratica.unita.filter((u) => u.operazione === 'C').length };
    if (!pratica.derivate) pratica.derivate = derivateCalcolate(pratica);
    if (!pratica.presentazione) pratica.presentazione = 'variazione';
  });

  const barrate = $derived(causaliBarrate(pratica));
  let planimetricaAperta = $state(false);
  const planimetrica = $derived(planimetricaAperta || barrate.some((c) => TIPOLOGIE_PLANIMETRICHE.includes(c)));
  const incompatibile = (c: CodiceVariazione) => !barrate.includes(c) && barrate.some((b) => !causaliCompatibili(b, c));
  const motivo = (c: CodiceVariazione) => barrate.filter((b) => !causaliCompatibili(b, c)).join(', ');
  function barra(c: CodiceVariazione, v: boolean): void {
    if (v) pratica.tipiVariazione[c] = true;
    else delete pratica.tipiVariazione[c];
    if (c === 'VDE' && !v) { pratica.variazioneDa = undefined; pratica.variazioneA = undefined; }
    if (c === 'VAR' && !v) pratica.altreVariazioni = undefined;
    if (c !== 'VRP' && pratica.tipologia === 2 && !(pratica.tipiVariazione.VRP)) pratica.tipologia = 0;
    if (v && (c === 'VTO' || c === 'VRP') && causaliBarrate(pratica).every((x) => x === 'VTO' || x === 'VRP')) pratica.dataVariazione = { gg: 0, mm: 0, aaaa: 0 };
  }
  function planimetricaCambia(v: boolean): void {
    planimetricaAperta = v;
    if (!v) for (const c of TIPOLOGIE_PLANIMETRICHE) delete pratica.tipiVariazione[c];
  }
  const senzaData = $derived(pratica.presentazione === 'variazione' && barrate.length > 0 && barrate.every((c) => c === 'VTO' || c === 'VRP'));
  const n = (v: string) => Math.max(0, Math.min(999, Math.trunc(Number(v) || 0)));
  const conteggi = $derived({
    i1n: pratica.mod1NParteI ? 1 : 0, ii1n: pratica.unita.filter((u) => u.mod1NParteII).length,
    i2n: pratica.unita.filter((u) => u.mod2N).length, ii2n: pratica.unita.reduce((s, u) => s + (u.mod2N?.corpi.length ?? 0), 0),
    plan: pratica.unita.filter((u) => u.planimetria).length, ep: pratica.elaboratoPlanimetrico ? Math.max(1, schedeElaborato(pratica.elaboratoPlanimetrico).length) : 0,
  });
  const CAUSALI_SEMPLICI: [CodiceVariazione, string][] = [['VTO', 'Toponomastica'], ['UFU', 'Ultimazione di fabbricato urbano']];
</script>

<div class="space-y-5">
  <Sezione titolo="Quadro B – Denuncia di variazione" descrizione="Dati generali della variazione dello stato degli immobili.">
    {#if pratica.tipoMappale && pratica.dichiarate && pratica.derivate}
      {@const tm = pratica.tipoMappale}
      {@const d = pratica.dichiarate}
      {@const der = pratica.derivate}
      <div class="grid gap-6 xl:grid-cols-3">
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">Tipo mappale</h3>
          <div class="grid grid-cols-2 gap-3">
            <Campo etichetta="Protocollo n." aiuto="facoltativo"><input type="text" inputmode="numeric" class="campo" maxlength="8" value={tm.numero || ''} oninput={(e) => (tm.numero = Number(e.currentTarget.value.replace(/\D/g, '')))} /></Campo>
            <Campo etichetta="del"><CampoData bind:valore={tm.data} /></Campo>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted obbligatorio">Unità immobiliari</h3>
          <div class="grid grid-cols-3 gap-3">
            <Campo etichetta="In soppressione"><input type="number" class="campo" min="0" value={d.soppresse} oninput={(e) => (d.soppresse = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="In variazione"><input type="number" class="campo" min="0" value={d.variate} oninput={(e) => (d.variate = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="In costituzione"><input type="number" class="campo" min="0" value={d.costituite} oninput={(e) => (d.costituite = n(e.currentTarget.value))} /></Campo>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted obbligatorio">Unità derivate</h3>
          <div class="grid grid-cols-3 gap-3">
            <Campo etichetta="Ordinarie" aiuto="A, B, C"><input type="number" class="campo" min="0" value={der.ordinarie} oninput={(e) => (der.ordinarie = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="Speciali" aiuto="D, E e F"><input type="number" class="campo" min="0" value={der.speciali} oninput={(e) => (der.speciali = n(e.currentTarget.value))} /></Campo>
            <Campo etichetta="B.c.n.c." aiuto="partita A"><input type="number" class="campo" min="0" value={der.bcnc} oninput={(e) => (der.bcnc = n(e.currentTarget.value))} /></Campo>
          </div>
        </div>
      </div>
    {/if}
  </Sezione>

  <Sezione titolo="Causale di presentazione">
    <div class="flex flex-wrap gap-6">
      <label class="flex items-center gap-2 text-sm font-medium"><input type="radio" class="check" name="pres" checked={pratica.presentazione !== 'afferenti'} onchange={() => (pratica.presentazione = 'variazione')} /> Variazione</label>
      <label class="flex items-center gap-2 text-sm font-medium"><input type="radio" class="check" name="pres" checked={pratica.presentazione === 'afferenti'} onchange={() => { pratica.presentazione = 'afferenti'; pratica.afferentiVariazione ??= { areaUrbana: false, lastricoSolare: false, altro: false }; }} /> Unità afferenti</label>
    </div>

    {#if pratica.presentazione !== 'afferenti'}
      <div class="mt-4 grid gap-6 xl:grid-cols-[18rem_1fr]">
        <Campo etichetta="Data di realizzazione della variazione" obbligatorio={!senzaData} aiuto={senzaData ? 'per VTO e VRP la data va omessa' : 'data di ultimazione dei lavori'}>
          <CampoData bind:valore={pratica.dataVariazione} disabilitato={senzaData} />
        </Campo>
        <div class="space-y-2.5">
          <span class="etichetta obbligatorio">Barrare almeno una causale</span>
          <div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" checked={planimetrica} onchange={(e) => planimetricaCambia(e.currentTarget.checked)} disabled={!planimetrica && TIPOLOGIE_PLANIMETRICHE.every(incompatibile)} /> <span><strong>1</strong> Planimetrica</span></label>
            {#if planimetrica}
              <div class="mt-2 ml-6 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {#each TIPOLOGIE_PLANIMETRICHE as c (c)}
                  <label class="flex items-center gap-2 text-sm {incompatibile(c) ? 'opacity-50' : ''}" title={incompatibile(c) ? `Incompatibile con ${motivo(c)}` : ''}>
                    <input type="checkbox" class="check" checked={!!pratica.tipiVariazione[c]} disabled={incompatibile(c)} onchange={(e) => barra(c, e.currentTarget.checked)} />
                    <span class="font-mono text-xs text-fg-muted">{c}</span> {DESCRIZIONE_CAUSALE[c]}
                  </label>
                {/each}
              </div>
            {/if}
          </div>
          {#each CAUSALI_SEMPLICI as [c, et], k (c)}
            <label class="flex items-center gap-2 text-sm {incompatibile(c) ? 'opacity-50' : ''}" title={incompatibile(c) ? `Incompatibile con ${motivo(c)}` : ''}>
              <input type="checkbox" class="check" checked={!!pratica.tipiVariazione[c]} disabled={incompatibile(c)} onchange={(e) => barra(c, e.currentTarget.checked)} /> <span><strong>{k + 2}</strong> {et}</span>
            </label>
          {/each}
          <div class="flex flex-wrap items-center gap-2 text-sm {incompatibile('VDE') ? 'opacity-50' : ''}">
            <label class="flex items-center gap-2"><input type="checkbox" class="check" checked={!!pratica.tipiVariazione.VDE} disabled={incompatibile('VDE')} onchange={(e) => barra('VDE', e.currentTarget.checked)} /> <span><strong>4</strong> di Destinazione da</span></label>
            <input type="text" class="campo w-56" maxlength="35" disabled={!pratica.tipiVariazione.VDE} value={pratica.variazioneDa ?? ''} oninput={(e) => (pratica.variazioneDa = e.currentTarget.value.toUpperCase() || undefined)} />
            <span>a</span>
            <input type="text" class="campo w-56" maxlength="35" disabled={!pratica.tipiVariazione.VDE} value={pratica.variazioneA ?? ''} oninput={(e) => (pratica.variazioneA = e.currentTarget.value.toUpperCase() || undefined)} />
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm {incompatibile('VAR') ? 'opacity-50' : ''}">
            <label class="flex items-center gap-2"><input type="checkbox" class="check" checked={!!pratica.tipiVariazione.VAR} disabled={incompatibile('VAR')} onchange={(e) => barra('VAR', e.currentTarget.checked)} /> <span><strong>5</strong> Altre</span></label>
            <input type="text" class="campo w-80" maxlength="35" disabled={!pratica.tipiVariazione.VAR} value={pratica.altreVariazioni ?? ''} oninput={(e) => (pratica.altreVariazioni = e.currentTarget.value.toUpperCase() || undefined)} placeholder="motivazione della variazione" list="diciture-altre" />
            <datalist id="diciture-altre">{#each DICITURE_ALTRE_VARIAZIONI as d (d)}<option value={d}></option>{/each}</datalist>
          </div>
          {#each [['VRP', 'per Presentazione planimetria mancante'], ['VMI', "per Modifica d'identificativo"], ['RUR', 'Richiesta ruralità']] as [c, et], k (c)}
            {@const cc = c as CodiceVariazione}
            <label class="flex items-center gap-2 text-sm {incompatibile(cc) ? 'opacity-50' : ''}" title={incompatibile(cc) ? `Incompatibile con ${motivo(cc)}` : ''}>
              <input type="checkbox" class="check" checked={!!pratica.tipiVariazione[cc]} disabled={incompatibile(cc)} onchange={(e) => barra(cc, e.currentTarget.checked)} /> <span><strong>{k + 6}</strong> {et}</span>
            </label>
          {/each}
        </div>
      </div>
    {:else if pratica.afferentiVariazione}
      {@const a = pratica.afferentiVariazione}
      <div class="mt-4 space-y-2">
        <span class="etichetta obbligatorio">Selezionare almeno una causale</span>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={a.areaUrbana} /> Edificate su area urbana</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={a.lastricoSolare} /> Edificate su lastrico solare</label>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <label class="flex items-center gap-2"><input type="checkbox" class="check" bind:checked={a.altro} /> Altro tipo di edificazione</label>
          <input type="text" class="campo w-80" maxlength="35" disabled={!a.altro} value={a.descrizione ?? ''} oninput={(e) => (a.descrizione = e.currentTarget.value.toUpperCase() || undefined)} />
        </div>
      </div>
    {/if}
  </Sezione>

  <Sezione titolo="Tipologia di documento">
    <div class="grid gap-x-6 gap-y-1.5 lg:grid-cols-2">
      {#each TIPOLOGIE_VARIAZIONE as t (t.opzione)}
        {@const disab = t.opzione === 3 && !pratica.tipiVariazione.VRP}
        <label class="flex items-start gap-2 text-sm {disab ? 'opacity-50' : ''}"><input type="radio" class="check mt-0.5" name="tipologia" checked={(pratica.tipologia ?? 0) === t.flag} disabled={disab} onchange={() => (pratica.tipologia = t.flag)} /> <span>{t.opzione}. {t.descrizione}</span></label>
      {/each}
    </div>
  </Sezione>

  <div class="grid gap-5 md:grid-cols-3">
    <Sezione titolo="Preallineamento" descrizione="Documenti pregressi acquisiti.">
      <div class="grid grid-cols-3 gap-2 text-xs">
        {#each ['Volture', 'Variazioni', 'Accatastamenti', 'Afferenti con intestati', 'Unità afferenti'] as et (et)}<Campo etichetta={et}><input class="campo" value="0" disabled /></Campo>{/each}
      </div>
    </Sezione>
    <Sezione titolo="Modelli 1N/2N">
      <div class="grid grid-cols-2 gap-2">
        <Campo etichetta="1N parte I"><input class="campo" value={conteggi.i1n} disabled /></Campo>
        <Campo etichetta="1N parte II"><input class="campo" value={conteggi.ii1n} disabled /></Campo>
        <Campo etichetta="2N parte I"><input class="campo" value={conteggi.i2n} disabled /></Campo>
        <Campo etichetta="2N parte II"><input class="campo" value={conteggi.ii2n} disabled /></Campo>
      </div>
    </Sezione>
    <Sezione titolo="Elaborati grafici">
      <div class="grid grid-cols-2 gap-2">
        <Campo etichetta="Planimetrie n."><input class="campo" value={conteggi.plan} disabled /></Campo>
        <Campo etichetta="Elab. plan. pag. n."><input class="campo" value={conteggi.ep} disabled /></Campo>
      </div>
    </Sezione>
  </div>
</div>
