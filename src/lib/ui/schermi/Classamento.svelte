<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /**
   * Validazione classamento (come Docfa): per ogni unità a destinazione ordinaria due colonne, il classamento
   * proposto (quello del quadro U, modificabile) e quello automatico; si sceglie quale convalidare. Scegliendo
   * l'automatico i suoi dati passano nel proposto ("Automatico su Proposto"), dove restano modificabili.
   */
  import type { Pratica, UnitaImmobiliare } from '$lib/core/model';
  import { classamentoRichiesto, descriviUnita } from '$lib/stato/validazione';
  import { classamentoAutomaticoDocumento, classamentoAutomatico } from '$lib/core/classamento-automatico';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { DESCRIZIONE_CATEGORIA, CATEGORIE } from '$lib/core/regole-docfa';
  import FormClassamento from '../FormClassamento.svelte';
  import Icona from '../Icona.svelte';
  import Sezione from '../Sezione.svelte';

  let { pratica = $bindable(), vai }: { pratica: Pratica; vai: (s: 'unita', i?: number) => void } = $props();

  const righe = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione !== 'S' && classamentoRichiesto(pratica, u) === 'completo' && !!u.classamento && !/^[DEF]/.test(u.classamento.categoria ?? '')));
  const euro = (v: number | null | undefined) => (Number.isFinite(v) ? (v as number) : 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cat = (c?: string) => (c && c.length === 3 ? `${c.charAt(0)}/${Number(c.slice(1))}` : c ?? '');

  // calcolo come la funzione "Classamento automatico" di Docfa, su tutto il documento
  const calcolo = $derived(classamentoAutomaticoDocumento($state.snapshot(pratica) as Pratica, impostazioni.prospetti[pratica.comune.provincia]));

  // l'esito va nel record 3 di ogni unità (posizioni 273-334), come lo scrive Docfa
  $effect(() => {
    for (const [i, a] of calcolo.unita) {
      const c = pratica.unita[i]?.classamento;
      if (c && a.codice && c.esitoAutomatico !== a.codice) c.esitoAutomatico = a.codice;
    }
  });

  // ---- dati "in atti" (le due finestre che Docfa apre in variazione quando l'archivio dell'Ufficio non è accessibile)
  const variazione = $derived(pratica.tipoDocumento !== 'accatastamento');
  const inAtti = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione === 'V' || u.operazione === 'S'));
  /** categorie che entrano nel classamento automatico (gruppi A, B, C) */
  const CAT_ORDINARIE = CATEGORIE.filter((c) => /^[ABC]\d\d$/.test(c));
  /** zona censuaria delle unità (Docfa controlla le classi sulle tariffe di quella zona) */
  const zonaRif = $derived(pratica.unita.find((u) => u.classamento?.zonaCensuaria?.trim())?.classamento?.zonaCensuaria ?? '');
  const classeDue = (c: string) => (/^\d$/.test(c.trim()) ? '0' + c.trim() : c.trim().toUpperCase());
  /** messaggio di Docfa se categoria/classe non sono nelle tariffe del comune (null se va bene o non si può verificare) */
  function nonPresente(categoria: string, classe: string, zona = zonaRif): string | null {
    if (!categoria || !classe.trim() || !impostazioni.tariffe[pratica.comune.provincia]) return null;
    return impostazioni.tariffa(pratica.comune, zona, categoria, classeDue(classe)) ? null : 'Cat./classe non presente nel comune';
  }
  function datoInAtti(u: UnitaImmobiliare, campo: 'categoria' | 'classe' | 'consistenza', v: string): void {
    u.inAtti ??= { categoria: '', classe: '', consistenza: '' };
    u.inAtti[campo] = campo === 'classe' ? v.trim().toUpperCase() : v.trim();
    if (!u.inAtti.categoria && !u.inAtti.classe && !u.inAtti.consistenza) u.inAtti = undefined;
  }
  function aggiungiFabbricato(): void {
    pratica.classiFabbricato = [...(pratica.classiFabbricato ?? []), { categoria: '', classe: '' }];
  }
  function togliFabbricato(k: number): void {
    pratica.classiFabbricato = (pratica.classiFabbricato ?? []).filter((_, j) => j !== k);
    if (!pratica.classiFabbricato.length) pratica.classiFabbricato = undefined;
  }

  function scegli(u: UnitaImmobiliare, scelta: 'proposto' | 'automatico'): void {
    const c = u.classamento;
    if (!c) return;
    if (scelta === 'automatico') {
      const a = classamentoAutomatico(pratica, u, null, calcolo);
      if (!a.eseguito) return;
      c.zonaCensuaria = a.zonaCensuaria ?? c.zonaCensuaria;
      c.categoria = a.categoria ?? c.categoria;
      c.classe = a.classe ?? c.classe;
      c.consistenza = a.consistenza ?? c.consistenza;
      if (a.rendita !== undefined) c.rendita = a.rendita;
    }
    c.convalida = scelta;
  }
</script>

<div class="space-y-5">
  <header>
    <h2 class="text-sm font-semibold uppercase tracking-wide text-fg">Classamento</h2>
    <p class="mt-0.5 text-xs text-fg-muted">Per ogni unità a destinazione ordinaria si sceglie quale classamento convalidare: quello proposto o quello automatico.</p>
  </header>

  {#if variazione && righe.length && inAtti.length}
    <div class="grid gap-5 xl:grid-cols-2">
      <Sezione titolo="Classamento in atti" descrizione="Unità variate o soppresse. Docfa li chiede in variazione: senza questi dati il classamento automatico non si esegue.">
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-fg-muted"><th class="py-1 text-left font-medium">Unità</th><th class="py-1 text-left font-medium">Categoria</th><th class="py-1 text-left font-medium">Classe</th><th class="py-1 text-left font-medium">Consistenza</th></tr></thead>
          <tbody>
            {#each inAtti as { u, i } (i)}
              {@const err = nonPresente(u.inAtti?.categoria ?? '', u.inAtti?.classe ?? '', u.classamento?.zonaCensuaria || zonaRif)}
              <tr class="border-t border-line align-top">
                <td class="py-1.5 pr-2 text-xs">{descriviUnita(u, i)}</td>
                <td class="py-1 pr-2">
                  <select class="campo campo-piccolo w-24" value={u.inAtti?.categoria ?? ''} onchange={(e) => datoInAtti(u, 'categoria', e.currentTarget.value)}>
                    <option value="">—</option>
                    {#each CAT_ORDINARIE as k (k)}<option value={k}>{cat(k)}</option>{/each}
                  </select>
                </td>
                <td class="py-1 pr-2"><input type="text" class="campo campo-piccolo w-14 uppercase" maxlength="2" value={u.inAtti?.classe ?? ''} onchange={(e) => datoInAtti(u, 'classe', e.currentTarget.value)} /></td>
                <td class="py-1"><input type="text" class="campo campo-piccolo w-20" maxlength="7" placeholder={/^A/.test(u.inAtti?.categoria ?? '') ? 'es. 4,5' : 'mq'} value={u.inAtti?.consistenza ?? ''} onchange={(e) => datoInAtti(u, 'consistenza', e.currentTarget.value)} /></td>
              </tr>
              {#if err}<tr><td></td><td colspan="3" class="pb-1 text-xs text-red-600 dark:text-red-400">{err}</td></tr>{/if}
            {/each}
          </tbody>
        </table>
      </Sezione>
      <Sezione titolo="Classi più elevate nel fabbricato" descrizione="Categorie presenti nel fabbricato, ciascuna con la classe più elevata.">
        {#snippet azioni()}<button type="button" class="btn btn-piccolo" onclick={aggiungiFabbricato}><Icona nome="piu" /> Aggiungi categoria</button>{/snippet}
        {#if pratica.classiFabbricato?.length}
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-fg-muted"><th class="py-1 text-left font-medium">Categoria</th><th class="py-1 text-left font-medium">Classe</th><th></th></tr></thead>
            <tbody>
              {#each pratica.classiFabbricato as f, k (k)}
                {@const err = nonPresente(f.categoria, f.classe)}
                <tr class="border-t border-line align-top">
                  <td class="py-1 pr-2">
                    <select class="campo campo-piccolo w-24" value={f.categoria} onchange={(e) => (f.categoria = e.currentTarget.value)}>
                      <option value="">—</option>
                      {#each CAT_ORDINARIE as c (c)}<option value={c}>{cat(c)}</option>{/each}
                    </select>
                  </td>
                  <td class="py-1 pr-2"><input type="text" class="campo campo-piccolo w-14 uppercase" maxlength="2" value={f.classe} onchange={(e) => (f.classe = e.currentTarget.value.trim().toUpperCase())} /></td>
                  <td class="py-1 text-right"><button type="button" class="btn btn-piccolo" onclick={() => togliFabbricato(k)}><Icona nome="cestino" /> Togli</button></td>
                </tr>
                {#if err}<tr><td colspan="3" class="pb-1 text-xs text-red-600 dark:text-red-400">{err}</td></tr>{/if}
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="text-xs text-fg-faint">Nessuna categoria indicata: premi «Aggiungi categoria».</p>
        {/if}
      </Sezione>
    </div>
  {/if}

  {#if calcolo.errore && righe.length}
    <div class="scheda flex items-start gap-2 px-5 py-3 text-sm text-fg-muted"><Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> {calcolo.errore}</div>
  {/if}

  {#each righe as { u, i } (i)}
    {@const c = u.classamento!}
    {@const a = classamentoAutomatico(pratica, u, null, calcolo)}
    {@const scelta = c.convalida ?? 'proposto'}
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3 border-b border-line pb-2">
        <h3 class="flex-1 text-sm font-semibold">{descriviUnita(u, i)}</h3>
        <button type="button" class="btn btn-piccolo" onclick={() => vai('unita', i)}><Icona nome="modifica" /> Apri il quadro U</button>
      </div>
      <div class="grid gap-5 xl:grid-cols-3">
        <Sezione titolo="Classamento proposto" descrizione="Quello del quadro U: si può modificare qui." classe="xl:col-span-2 {scelta === 'proposto' ? 'ring-2 ring-accent-500' : ''}">
          {#snippet azioni()}
            {#if scelta === 'proposto'}<span class="flex items-center gap-1 text-sm font-semibold text-accent-700 dark:text-accent-300"><Icona nome="spunta" /> Convalidato</span>
            {:else}<button type="button" class="btn btn-piccolo" onclick={() => scegli(u, 'proposto')}>Convalida il proposto</button>{/if}
          {/snippet}
          <FormClassamento bind:unita={pratica.unita[i]} {pratica} compatto />
        </Sezione>
        <Sezione titolo="Classamento automatico" descrizione="Calcolato come la funzione di Docfa." classe={scelta === 'automatico' ? 'ring-2 ring-accent-500' : ''}>
          {#snippet azioni()}
            {#if scelta === 'automatico'}<span class="flex items-center gap-1 text-sm font-semibold text-accent-700 dark:text-accent-300"><Icona nome="spunta" /> Convalidato</span>
            {:else if a.eseguito}<button type="button" class="btn btn-piccolo btn-primario" onclick={() => scegli(u, 'automatico')}>Convalida l'automatico</button>{/if}
          {/snippet}
          {#if a.eseguito}
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt class="text-xs text-fg-muted">Zona</dt><dd class="font-medium">{a.zonaCensuaria}</dd></div>
              <div><dt class="text-xs text-fg-muted">Categoria</dt><dd class="font-medium" title={DESCRIZIONE_CATEGORIA[a.categoria ?? '']}>{cat(a.categoria)}</dd></div>
              <div><dt class="text-xs text-fg-muted">Classe</dt><dd class="font-medium">{a.classe}</dd></div>
              <div><dt class="text-xs text-fg-muted">Consistenza</dt><dd class="font-medium">{a.consistenza}</dd></div>
            </dl>
            {#if a.rendita !== undefined}<p class="mt-3 text-sm">Rendita € <strong class="tabular-nums">{euro(a.rendita)}</strong></p>{/if}
            <p class="mt-3 text-xs text-fg-muted">Convalidandolo, i dati passano nel classamento proposto, dove si possono ancora modificare.</p>
          {:else}
            <p class="flex items-start gap-2 text-sm text-fg-muted"><Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> {a.esito}.</p>
          {/if}
        </Sezione>
      </div>
      <div class="scheda flex flex-wrap items-center justify-between gap-3 bg-surface-2/50 px-5 py-3 text-sm">
        <span class="text-fg-muted">Classamento convalidato: <strong class="text-fg">{scelta === 'automatico' ? 'automatico' : 'proposto'}</strong> · {cat(c.categoria)} classe {c.classe ?? ''} · consistenza {c.consistenza ?? ''}</span>
        <span class="tabular-nums">Rendita € <strong>{euro(c.rendita)}</strong></span>
      </div>
    </div>
  {/each}

  {#if !righe.length}
    <div class="scheda px-6 py-10 text-center text-sm text-fg-muted">Nessuna unità a destinazione ordinaria da classare in questo documento.</div>
  {/if}
</div>
