<script lang="ts" module>
  import type { Pratica, UnitaImmobiliare } from '$lib/core/model';
  import type { VoceQuadro } from './SchedeQuadri.svelte';

  /** Quadri del modello 1N parte II (finestra di Docfa) con lo stato di compilazione. */
  export function quadri1NParteII(u: UnitaImmobiliare): VoceQuadro[] {
    const m = u.mod1NParteII;
    const cat = u.classamento?.categoria ?? '';
    const c = !!m?.gruppoC;
    return [
      { id: 'ab', sigla: 'A-B', titolo: 'Riferimenti', obbligatorio: true, completo: !!m && u.spessoreMuri !== undefined && !!m.annoCostruzione },
      { id: 'c14', sigla: 'C/1', titolo: 'Dati metrici sez. 1-4', obbligatorio: true, completo: !!m && (c ? m.gruppoC!.principali.some((l) => l.utile > 0) : /^A/.test(cat) ? m.vaniPrincipaliN > 0 && m.vaniPrincipaliSup > 0 : true) },
      { id: 'c57', sigla: 'C/1', titolo: 'Dati metrici sez. 5-7', obbligatorio: false, completo: !!m && (c ? m.gruppoC!.altezzaMediaCm > 0 : m.altezzaMediaCm > 0) },
      { id: 'd', sigla: 'D', titolo: 'Dotazioni tecnologiche', obbligatorio: false, completo: typeof m?.nAscensori === 'number' },
      { id: 'e', sigla: 'E', titolo: 'Caratteristiche costruttive e di finitura', obbligatorio: !c, completo: !!m && Object.values(m.pavimenti).some(Boolean) && Object.values(m.infissi).some(Boolean) },
      { id: 'f', sigla: 'F', titolo: "Destinazione d'uso e osservazioni", obbligatorio: true, completo: !!m?.destinazioneUso.trim() },
    ];
  }
</script>

<script lang="ts">
  /** Modello 1N parte II della u.i.u.: un quadro alla volta, come nella finestra di Docfa. */
  import { poligoniPlanimetria, type LocaleGruppoC, type Mod1NParteII } from '$lib/core/model';
  import { DESTINAZIONI_1N } from '$lib/core/dati/docfa-tabelle.generated';
  import { lordeAutomatiche } from '$lib/core/superfici';
  import Campo from './Campo.svelte';
  import Icona from './Icona.svelte';

  let { unita = $bindable(), pratica, quadro }: { unita: UnitaImmobiliare; pratica: Pratica; quadro: string } = $props();
  const m = $derived(unita.mod1NParteII as Mod1NParteII);
  const categoria = $derived(unita.classamento?.categoria ?? '');
  const gruppoB = $derived(/^B/.test(categoria));
  const auto = $derived(lordeAutomatiche(poligoniPlanimetria(unita.planimetria)));
  const ids = $derived([unita.identificativo, ...unita.graffati].slice(0, 4));
  const destinazioni = $derived(DESTINAZIONI_1N[categoria] ?? []);
  const sottoMetro50 = $derived(unita.ambienti.filter((a) => a.altezzaMin === 149).reduce((s, a) => s + a.superficie, 0));
  const ante1942 = $derived(!!m.annoCostruzione && m.annoCostruzione < 1942);

  // destinazione d'uso: se la categoria ne ha una sola Docfa la imposta senza permetterne la modifica
  $effect(() => {
    if (destinazioni.length === 1 && m.destinazioneUso !== destinazioni[0]) m.destinazioneUso = destinazioni[0];
  });
  // anno di costruzione proposto dal modello 1N parte I
  $effect(() => {
    const anno = Number(pratica.mod1NParteI?.recordB.anno_costruzione);
    if (!m.annoCostruzione && anno) m.annoCostruzione = anno;
  });

  const DOTAZIONI: [string, string][] = [
    ['riscaldamento', 'Riscaldamento'], ['acqua_calda', 'Acqua calda'], ['condizionamento', 'Condizionamento'], ['citofono', 'Citofono'],
    ['videocitofono', 'Videocitofono'], ['ascensore_esclusivo', 'Ascensore a uso esclusivo'], ['ascensore', 'Ascensore'], ['ascensore_servizio', 'Ascensore di servizio'], ['montacarichi', 'Montacarichi'],
  ];
  const PAVIMENTI: [string, string][] = [['marmo', 'Marmo e pietra'], ['ceramica', 'Ceramica'], ['scaglie', 'Scaglie di marmo'], ['moquette', 'Moquette'], ['gomma', 'Gomma'], ['parquet', 'Parquet'], ['altro', 'Altro']];
  const GRUPPI_PAV: [string, string][] = [['camere', 'Camere'], ['cucina', 'Cucina'], ['accessori', 'Accessori']];
  const INFISSI: [string, string][] = [['legno', 'Legno'], ['tamburato', 'Tamburato'], ['metallo', 'Metallo'], ['altro', 'Altro']];
  const numero = (v: string): number | undefined => (v.trim() === '' ? undefined : Math.max(0, Math.trunc(Number(v))));
  const intero = (v: string): number => Math.max(0, Math.trunc(Number(v) || 0));
  /** superfici in mq interi (il record non ammette decimali): arrotonda, accetta anche la virgola */
  const mq = (v: string): number => Math.max(0, Math.round(Number(v.replace(',', '.')) || 0));

  function abilitaGruppoC(): void {
    m.gruppoC = { principali: [], accessoriDiretti: [], accessoriIndiretti: [], balconiSup: 0, coperteSup: 0, pertinenzeSup: 0, postiAuto: 0, accessoCarrabile: false, altezzaMediaCm: 0, supAltezzaInferiore230: 0, postoAutoScoperto: false };
  }
  function aggiungiLocale(lista: LocaleGruppoC[]): void {
    if (lista.length < 2) lista.push({ piano: 'T', lorda: 0, utile: 0 });
  }
</script>

{#if quadro === 'ab'}
  <div class="space-y-5">
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">[A] Riferimenti catastali dell'unità immobiliare</h3>
      <div class="flex flex-wrap gap-2">
        {#each ids as id, k (k)}<span class="pill bg-surface-2 font-mono">{id.sezione ? `${id.sezione}/` : ''}{id.foglio}/{id.numero}{id.subalterno ? `/${id.subalterno}` : ''}</span>{/each}
      </div>
    </div>
    <div>
      <h3 class="mb-2 text-xs font-semibold obbligatorio">Spessore dei muri dell'unità immobiliare</h3>
      <div class="flex flex-wrap gap-6">
        <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="spessore" checked={unita.spessoreMuri === 1} onchange={() => (unita.spessoreMuri = 1)} /> Tutti inferiori a 50 cm</label>
        <label class="flex items-center gap-2 text-sm"><input type="radio" class="check" name="spessore" checked={unita.spessoreMuri === 2} onchange={() => (unita.spessoreMuri = 2)} /> Almeno uno superiore a 50 cm</label>
      </div>
    </div>
    <div>
      <h3 class="mb-2 text-xs font-semibold obbligatorio">[B] Riferimenti temporali dell'unità immobiliare</h3>
      <div class="flex flex-wrap items-end gap-4">
        <label class="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" class="check" checked={ante1942} onchange={(e) => (m.annoCostruzione = e.currentTarget.checked ? 1900 : undefined)} /> Anteriore al 1942</label>
        <Campo etichetta="Anno di costruzione" obbligatorio><input type="number" class="campo w-32" min="1942" max="2100" value={ante1942 ? '' : m.annoCostruzione ?? ''} disabled={ante1942} oninput={(e) => (m.annoCostruzione = numero(e.currentTarget.value))} /></Campo>
        <Campo etichetta="Anno di ristrutturazione"><input type="number" class="campo w-32" min="1800" max="2100" value={m.annoRistrutturazione ?? ''} oninput={(e) => (m.annoRistrutturazione = numero(e.currentTarget.value))} /></Campo>
      </div>
    </div>
  </div>
{:else if quadro === 'c14'}
  {#if /^C/.test(categoria) && !m.gruppoC}
    <div class="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <span>Categoria {categoria}: il quadro C riporta i locali (superficie lorda e utile per piano).</span>
      <button type="button" class="btn btn-piccolo" onclick={abilitaGruppoC}>Compila i locali</button>
    </div>
  {:else if m.gruppoC}
    {@const c = m.gruppoC}
    <div class="space-y-4">
      {#each [['principali', '1) Locali principali'], ['accessoriDiretti', '2) Accessori diretti'], ['accessoriIndiretti', '3) Accessori indiretti']] as [k, et] (k)}
        {@const lista = c[k as 'principali' | 'accessoriDiretti' | 'accessoriIndiretti']}
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-semibold {k === 'principali' ? 'obbligatorio' : 'text-fg-muted'}">{et}</span>
            <button type="button" class="btn btn-piccolo btn-ghost" disabled={lista.length >= 2} onclick={() => aggiungiLocale(lista)}><Icona nome="piu" /> Piano (max 2)</button>
          </div>
          {#each lista as l, i (i)}
            <div class="mb-2 grid grid-cols-[6rem_1fr_1fr_auto] items-end gap-2">
              <Campo etichetta="Piano"><input type="text" class="campo uppercase" maxlength="3" bind:value={l.piano} /></Campo>
              <Campo etichetta="Sup. lorda (mq)" aiuto={auto && i === 0 ? 'dai poligoni' : undefined}><input type="number" class="campo" min="0" max="99999" bind:value={l.lorda} disabled={auto && i === 0} /></Campo>
              <Campo etichetta="Sup. utile (mq)"><input type="number" class="campo" min="0" max="99999" bind:value={l.utile} /></Campo>
              <button type="button" class="btn btn-piccolo btn-pericolo mb-0.5" onclick={() => lista.splice(i, 1)} title="Elimina"><Icona nome="cestino" /></button>
            </div>
          {/each}
        </div>
      {/each}
      <div class="grid gap-4 sm:grid-cols-3">
        <Campo etichetta="4) Balconi (mq)" aiuto={auto ? 'dai poligoni' : undefined}><input type="number" class="campo" min="0" bind:value={c.balconiSup} disabled={auto} /></Campo>
        <Campo etichetta="Tettoie e coperte (mq)"><input type="number" class="campo" min="0" bind:value={c.coperteSup} /></Campo>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      <div>
        <h3 class="mb-2 text-xs font-semibold obbligatorio">1) Vani principali</h3>
        <div class="grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Numero" obbligatorio><input type="number" class="campo" min="0" value={m.vaniPrincipaliN} oninput={(e) => (m.vaniPrincipaliN = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Superficie utile (mq)" obbligatorio><input type="number" class="campo" min="0" value={m.vaniPrincipaliSup} oninput={(e) => (m.vaniPrincipaliSup = intero(e.currentTarget.value))} /></Campo>
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-xs font-semibold text-fg-muted">2) Accessori diretti</h3>
        <div class="grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Bagni n."><input type="number" class="campo" min="0" value={m.bagniN} oninput={(e) => (m.bagniN = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Bagni sup. utile (mq)"><input type="number" class="campo" min="0" value={m.bagniSup} oninput={(e) => (m.bagniSup = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Altri accessori n."><input type="number" class="campo" min="0" value={m.accessoriDirettiN} oninput={(e) => (m.accessoriDirettiN = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Altri sup. utile (mq)"><input type="number" class="campo" min="0" value={m.accessoriDirettiSup} oninput={(e) => (m.accessoriDirettiSup = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Superficie lorda (mq)" aiuto={auto ? 'dai poligoni' : 'dai poligoni (manca la planimetria)'}><input type="number" class="campo" min="0" value={m.superficieLorda} onchange={(e) => (m.superficieLorda = mq(e.currentTarget.value))} disabled={auto} /></Campo>
          <Campo etichetta="di cui mq con h < 150 cm" aiuto="non entra nella consistenza"><input type="number" class="campo" value={sottoMetro50} disabled /></Campo>
        </div>
      </div>
      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">3) Accessori indiretti</h3>
          <div class="grid grid-cols-2 gap-4">
            <Campo etichetta="Numero" aiuto="se presenti"><input type="number" class="campo" min="0" value={m.accessoriIndirettiN} oninput={(e) => (m.accessoriIndirettiN = intero(e.currentTarget.value))} /></Campo>
            <Campo etichetta="Superficie (mq)" aiuto="dai poligoni"><input type="number" class="campo" min="0" value={m.accessoriIndirettiSup} onchange={(e) => (m.accessoriIndirettiSup = mq(e.currentTarget.value))} disabled={auto} /></Campo>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">4) Dipendenze esclusive</h3>
          <div class="grid grid-cols-2 gap-4">
            <Campo etichetta="Balconi e terrazzi (mq)" aiuto="dai poligoni"><input type="number" class="campo" min="0" value={m.balconiSup} onchange={(e) => (m.balconiSup = mq(e.currentTarget.value))} disabled={auto} /></Campo>
            <Campo etichetta="Terrazzi coperti (mq)"><input type="number" class="campo" min="0" value={m.terrazziCopertiSup} oninput={(e) => (m.terrazziCopertiSup = intero(e.currentTarget.value))} /></Campo>
          </div>
        </div>
      </div>
    </div>
  {/if}
{:else if quadro === 'c57'}
  {@const c = m.gruppoC}
  <div class="space-y-5">
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">5) Pertinenze scoperte esclusive</h3>
      {#if c}
        <div class="grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Superficie (mq)" aiuto="dai poligoni"><input type="number" class="campo" min="0" bind:value={c.pertinenzeSup} disabled={auto} /></Campo>
          <Campo etichetta="Posti auto n."><input type="number" class="campo" min="0" value={c.postiAuto} oninput={(e) => (c.postiAuto = intero(e.currentTarget.value))} /></Campo>
          <label class="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={c.accessoCarrabile} /> Accesso carrabile</label>
          <label class="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" class="check" bind:checked={c.postoAutoScoperto} /> Posto auto scoperto</label>
        </div>
      {:else}
        <div class="grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Superficie totale (mq)" aiuto="dai poligoni"><input type="number" class="campo" min="0" value={m.pertinenzeScoperteSup} onchange={(e) => (m.pertinenzeScoperteSup = mq(e.currentTarget.value))} disabled={auto} /></Campo>
          <Campo etichetta="Altra pertinenza (piscina, tennis…)"><input type="text" class="campo uppercase" maxlength="15" value={m.pertAltraDescrizione ?? ''} oninput={(e) => (m.pertAltraDescrizione = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
          <Campo etichetta="Sua superficie (mq)"><input type="number" class="campo" min="0" value={m.pertAltraSup ?? ''} oninput={(e) => (m.pertAltraSup = numero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Posti auto n."><input type="number" class="campo" min="0" value={m.postiAuto ?? ''} oninput={(e) => (m.postiAuto = numero(e.currentTarget.value))} /></Campo>
        </div>
      {/if}
    </div>
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">6) Dati relativi all'altezza</h3>
      <div class="grid gap-4 sm:grid-cols-4">
        {#if c}
          <Campo etichetta="Altezza media utile (cm)"><input type="number" class="campo" min="0" max="999" value={c.altezzaMediaCm || ''} oninput={(e) => (c.altezzaMediaCm = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Sup. con h < 2,30 m (mq)"><input type="number" class="campo" min="0" value={c.supAltezzaInferiore230} oninput={(e) => (c.supAltezzaInferiore230 = intero(e.currentTarget.value))} /></Campo>
        {:else}
          <Campo etichetta="Altezza media utile (cm)"><input type="number" class="campo" min="0" max="999" value={m.altezzaMediaCm || ''} oninput={(e) => (m.altezzaMediaCm = intero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Sup. con h < 2,30 m (mq)"><input type="number" class="campo" min="0" value={m.supAltezzaInferiore230} oninput={(e) => (m.supAltezzaInferiore230 = intero(e.currentTarget.value))} /></Campo>
        {/if}
      </div>
    </div>
    {#if gruppoB}
      <div>
        <h3 class="mb-2 text-xs font-semibold text-fg-muted">7) Unità del gruppo B</h3>
        <div class="grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Piani fuori terra"><input type="number" class="campo" min="0" value={m.bPianiFuoriTerra ?? ''} oninput={(e) => (m.bPianiFuoriTerra = numero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Volume fuori terra (mc)"><input type="number" class="campo" min="0" value={m.bMcFuoriTerra ?? ''} oninput={(e) => (m.bMcFuoriTerra = numero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Piani entro terra"><input type="number" class="campo" min="0" value={m.bPianiEntroTerra ?? ''} oninput={(e) => (m.bPianiEntroTerra = numero(e.currentTarget.value))} /></Campo>
          <Campo etichetta="Volume entro terra (mc)"><input type="number" class="campo" min="0" value={m.bMcEntroTerra ?? ''} oninput={(e) => (m.bMcEntroTerra = numero(e.currentTarget.value))} /></Campo>
        </div>
      </div>
    {/if}
  </div>
{:else if quadro === 'd'}
  <div class="space-y-4">
    <h3 class="text-xs font-semibold text-fg-muted">Impianto autonomo</h3>
    <div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {#each DOTAZIONI as [k, et] (k)}
        <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" class="check" checked={!!m.dotazioni[k]} onchange={(e) => (m.dotazioni[k] = e.currentTarget.checked)} /> {et}</label>
      {/each}
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <Campo etichetta="Numero ascensori" aiuto="0 in mancanza di impianto">
        <input type="number" class="campo" min="0" max="999" value={m.nAscensori ?? ''} oninput={(e) => (m.nAscensori = numero(e.currentTarget.value))} />
      </Campo>
      <Campo etichetta="Altro" classe="sm:col-span-2" aiuto="descrizione in chiaro"><input type="text" class="campo uppercase" maxlength="15" value={m.dotazioniAltre ?? ''} oninput={(e) => (m.dotazioniAltre = e.currentTarget.value.toUpperCase() || undefined)} /></Campo>
    </div>
  </div>
{:else if quadro === 'e'}
  <div class="space-y-5">
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">1) Tipo prevalente di pavimentazione</h3>
      <div class="overflow-x-auto">
        <table class="text-sm">
          <thead><tr class="text-xs text-fg-muted"><th class="py-1 pr-4 text-left font-medium"></th>{#each PAVIMENTI as [k, et] (k)}<th class="px-2 py-1 text-center font-medium">{et}</th>{/each}</tr></thead>
          <tbody>
            {#each GRUPPI_PAV as [g, et] (g)}
              <tr class="border-t border-line"><td class="py-1.5 pr-4">{et}</td>
                {#each PAVIMENTI as [k, etp] (k)}
                  <td class="px-2 py-1.5 text-center"><input type="checkbox" class="check" checked={!!m.pavimenti[`${g}_${k}`]} onchange={(e) => (m.pavimenti[`${g}_${k}`] = e.currentTarget.checked)} aria-label={`${et}: ${etp}`} /></td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <div>
      <h3 class="mb-2 text-xs font-semibold text-fg-muted">2) Tipo prevalente di infissi interni</h3>
      <div class="overflow-x-auto">
        <table class="text-sm">
          <thead><tr class="text-xs text-fg-muted"><th class="py-1 pr-4 text-left font-medium"></th>{#each INFISSI as [k, et] (k)}<th class="px-2 py-1 text-center font-medium">{et}</th>{/each}</tr></thead>
          <tbody>
            {#each [['ingresso', "Porta d'ingresso"], ['interne', 'Porte interne']] as [g, et] (g)}
              <tr class="border-t border-line"><td class="py-1.5 pr-4">{et}</td>
                {#each INFISSI as [k, eti] (k)}
                  <td class="px-2 py-1.5 text-center"><input type="checkbox" class="check" checked={!!m.infissi[`${g}_${k}`]} onchange={(e) => (m.infissi[`${g}_${k}`] = e.currentTarget.checked)} aria-label={`${et}: ${eti}`} /></td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{:else}
  <div class="space-y-4">
    <Campo etichetta="1) Destinazione d'uso" obbligatorio aiuto={destinazioni.length === 1 ? `decodificata dalla categoria ${categoria}` : destinazioni.length ? 'scegliere la destinazione pertinente' : 'indicare la categoria nel quadro U'}>
      {#if destinazioni.length > 1}
        <select class="campo" bind:value={m.destinazioneUso}><option value=""></option>{#each destinazioni as d (d)}<option value={d}>{d}</option>{/each}</select>
      {:else}
        <input type="text" class="campo uppercase" maxlength="50" value={m.destinazioneUso} disabled={destinazioni.length === 1} oninput={(e) => (m.destinazioneUso = e.currentTarget.value.toUpperCase())} />
      {/if}
    </Campo>
    <Campo etichetta="2) Osservazioni" aiuto="relative al classamento proposto, max 600 caratteri">
      <textarea class="campo" rows="4" maxlength="600" value={m.osservazioni ?? ''} oninput={(e) => (m.osservazioni = e.currentTarget.value || undefined)}></textarea>
    </Campo>
  </div>
{/if}
