<script lang="ts">
  /**
   * Classamento proposto del quadro U: zona censuaria, categoria (tendina di Docfa; per D ed E la destinazione
   * d'uso), classe, consistenza, superficie catastale (dai poligoni) e rendita (calcolata dalle tariffe).
   * I campi richiesti dipendono dalla causale e dalla categoria (help del quadro U).
   */
  import { poligoniPlanimetria, type Classamento, type Pratica, type UnitaImmobiliare } from '$lib/core/model';
  import { rendita as calcolaRendita, LIRE_PER_EURO } from '$lib/core/archivi';
  import { CATEGORIE, DESCRIZIONE_CATEGORIA } from '$lib/core/regole-docfa';
  import { DESTINAZIONI_DE } from '$lib/core/dati/docfa-tabelle.generated';
  import { classamentoRichiesto } from '$lib/stato/validazione';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import Campo from './Campo.svelte';

  let { unita = $bindable(), pratica, compatto = false }: { unita: UnitaImmobiliare; pratica: Pratica; compatto?: boolean } = $props();
  const classamento = $derived(unita.classamento as Classamento);
  const richiesto = $derived(classamentoRichiesto(pratica, unita));
  const cat = $derived(classamento.categoria.trim().toUpperCase());
  const gruppoDE = $derived(/^[DE]/.test(cat));
  const gruppoF = $derived(/^F/.test(cat));
  const ordinaria = $derived(/^[ABC]\d\d$/.test(cat));

  const comune = $derived(impostazioni.comunePerCodiceAmministrativo(pratica.comune.codiceAmministrativo));
  const opzioni = $derived(impostazioni.opzioniClassamento(comune));
  const conTariffe = $derived(!!comune && !!impostazioni.tariffe[comune.provincia]);
  const tariffa = $derived(impostazioni.tariffa(comune, classamento.zonaCensuaria, cat, classamento.classe));
  const consistenzaNumero = $derived(Number(classamento.consistenza.replace(',', '.')) || 0);
  const renditaCalcolata = $derived(ordinaria && tariffa ? calcolaRendita(consistenzaNumero, tariffa.lire) : null);
  const unitaConsistenza = $derived(/^A/.test(cat) ? 'vani' : /^B/.test(cat) ? 'mc' : /^C/.test(cat) ? 'mq' : '');
  const superficieAutomatica = $derived(poligoniPlanimetria(unita.planimetria).length > 0 && ordinaria);
  const destinazioni = $derived(gruppoDE ? (cat.length === 1 ? Object.entries(DESTINAZIONI_DE).filter(([k]) => k.startsWith(cat)).flatMap(([k, v]) => v.map(([c, d]) => ({ c, d, k }))) : (DESTINAZIONI_DE[cat] ?? []).map(([c, d]) => ({ c, d, k: cat }))) : []);
  const nCorpi = $derived(unita.mod2N?.corpi.length ?? 0);
  /** id univoci delle liste di suggerimenti (più moduli nella stessa pagina) */
  const uid = Math.random().toString(36).slice(2, 8);

  $effect(() => {
    if (renditaCalcolata !== null && classamento.rendita !== renditaCalcolata) classamento.rendita = renditaCalcolata;
  });

  function categoria(v: string): void {
    classamento.categoria = v;
    if (/^[DEF]/.test(v)) { classamento.classe = ''; classamento.consistenza = ''; }
    if (/^F/.test(v) && !(pratica.tipiVariazione.DET)) classamento.zonaCensuaria = '';
    if (!/^[DE]/.test(v)) unita.destinazioneUsoDE = undefined;
  }
  function destinazione(codice: string): void {
    unita.destinazioneUsoDE = codice || undefined;
    const voce = destinazioni.find((x) => x.c === codice);
    if (voce && classamento.categoria.length === 1) classamento.categoria = voce.k;
  }
</script>

{#if richiesto === 'nessuno'}
  <p class="text-sm text-fg-muted">Per questa unità i dati del classamento non vanno indicati (causale {unita.partitaSpeciale === 'A' ? 'bene comune non censibile' : 'del documento'}).</p>
{:else}
  <div class="grid gap-4 {compatto ? 'grid-cols-2 sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-6'}">
    <Campo etichetta="Zona censuaria" obbligatorio={richiesto === 'completo' && !gruppoF || !!pratica.tipiVariazione.DET} aiuto="U se unica">
      <input type="text" class="campo uppercase" maxlength="3" list={`zone-${uid}`} bind:value={classamento.zonaCensuaria} disabled={gruppoF && !pratica.tipiVariazione.DET} />
      <datalist id={`zone-${uid}`}>{#each opzioni.zone as z (z)}<option value={z.replace(/^0+(?=\d)/, '')}></option>{/each}<option value="U"></option></datalist>
    </Campo>
    <Campo etichetta="Categoria" classe="sm:col-span-2" obbligatorio>
      <select class="campo" value={cat} onchange={(e) => categoria(e.currentTarget.value)}>
        <option value=""></option>
        {#each CATEGORIE as c (c)}<option value={c}>{c.length === 1 ? c : `${c.charAt(0)}/${Number(c.slice(1))}`} – {DESCRIZIONE_CATEGORIA[c]}</option>{/each}
        {#if cat && !CATEGORIE.includes(cat)}<option value={cat}>{cat}</option>{/if}
      </select>
    </Campo>
    {#if gruppoDE}
      <Campo etichetta="Destinazione d'uso" classe="sm:col-span-3" obbligatorio>
        <select class="campo" value={unita.destinazioneUsoDE ?? ''} onchange={(e) => destinazione(e.currentTarget.value)}>
          <option value=""></option>
          {#each destinazioni as x (x.c)}<option value={x.c}>{x.c} – {x.d}{cat.length === 1 ? ` (${x.k.charAt(0)}/${Number(x.k.slice(1))})` : ''}</option>{/each}
        </select>
      </Campo>
    {:else}
      <Campo etichetta="Classe" obbligatorio={richiesto === 'completo' && ordinaria}>
        <input type="text" class="campo" maxlength="2" list={`classi-${uid}`} bind:value={classamento.classe} disabled={!ordinaria || richiesto !== 'completo'} />
        <datalist id={`classi-${uid}`}>{#each opzioni.classi(classamento.zonaCensuaria, cat) as c (c)}<option value={c.replace(/^0+(?=\d)/, '')}></option>{/each}</datalist>
      </Campo>
      <Campo etichetta={`Consistenza${unitaConsistenza ? ` (${unitaConsistenza})` : ''}`} obbligatorio={richiesto === 'completo' && ordinaria} aiuto={/^A/.test(cat) ? 'vani, anche mezzi (4,5)' : undefined}>
        <input type="text" class="campo" maxlength="7" bind:value={classamento.consistenza} disabled={!ordinaria || richiesto !== 'completo'} />
      </Campo>
    {/if}
    <Campo etichetta="Superf. cat. (mq)" aiuto={superficieAutomatica ? 'calcolata dai poligoni' : ordinaria ? 'serve la planimetria con i poligoni' : 'facoltativa'}>
      <input type="number" class="campo" min="0" max="99999" bind:value={classamento.superficieCatastale} disabled={superficieAutomatica || (!gruppoF && !gruppoDE && !ordinaria)} />
    </Campo>
    {#if gruppoDE}
      <Campo etichetta="n° Mod. 2N II parte" aiuto="corpi di fabbrica"><input type="number" class="campo" value={nCorpi} disabled /></Campo>
    {/if}
    {#if richiesto === 'completo' && !gruppoF}
      <Campo etichetta="Rendita (€)" aiuto={tariffa ? `tariffa ${tariffa.lire.toLocaleString('it-IT')} lire (${(tariffa.lire / LIRE_PER_EURO).toFixed(2)} €) × ${consistenzaNumero}` : gruppoDE ? 'dal modello 2N parte I' : conTariffe ? 'zona, categoria e classe non presenti nelle tariffe del comune' : 'tariffe non caricate: rendita da indicare a mano'}>
        <input type="number" class="campo" step="0.01" min="0" bind:value={classamento.rendita} disabled={renditaCalcolata !== null || (ordinaria && conTariffe)} />
      </Campo>
    {/if}
  </div>
  {#if richiesto === 'categoria'}
    <p class="mt-2 text-xs text-fg-muted">Per questa causale si indica solo la categoria{pratica.tipiVariazione.DET ? ' (F/1) e la zona censuaria' : ''}.</p>
  {/if}
{/if}
