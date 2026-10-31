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

  let { pratica = $bindable(), vai }: { pratica: Pratica; vai: (s: 'unita', i?: number) => void } = $props();

  const righe = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione !== 'S' && classamentoRichiesto(pratica, u) === 'completo' && !!u.classamento && !/^[DEF]/.test(u.classamento.categoria ?? '')));
  const euro = (v: number) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  {#if variazione && righe.length && inAtti.length}
    <section class="scheda overflow-hidden">
      <header class="border-b border-line px-5 py-3">
        <h2 class="text-sm font-semibold">Dati per il classamento automatico</h2>
        <p class="text-xs text-fg-muted">In variazione Docfa li chiede quando non può leggere gli atti dell'Ufficio: senza questi dati il classamento automatico non si esegue.</p>
      </header>
      <div class="grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <h3 class="mb-2 text-xs font-semibold text-fg-muted">Classamento in atti delle unità variate o soppresse</h3>
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
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-xs font-semibold text-fg-muted">Categorie presenti nel fabbricato con la classe più elevata</h3>
            <button type="button" class="btn btn-piccolo" onclick={aggiungiFabbricato}><Icona nome="piu" /> Aggiungi</button>
          </div>
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
                    <td class="py-1 text-right"><button type="button" class="btn btn-piccolo" aria-label="Togli" onclick={() => togliFabbricato(k)}><Icona nome="cestino" /></button></td>
                  </tr>
                  {#if err}<tr><td colspan="3" class="pb-1 text-xs text-red-600 dark:text-red-400">{err}</td></tr>{/if}
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="text-xs text-fg-faint">Nessuna categoria indicata.</p>
          {/if}
        </div>
      </div>
    </section>
  {/if}
  {#if calcolo.errore && righe.length}
    <div class="scheda flex items-start gap-2 px-5 py-3 text-sm text-fg-muted"><Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> {calcolo.errore}</div>
  {/if}
  {#each righe as { u, i } (i)}
    {@const c = u.classamento!}
    {@const a = classamentoAutomatico(pratica, u, null, calcolo)}
    {@const scelta = c.convalida ?? 'proposto'}
    <section class="scheda overflow-hidden">
      <header class="flex items-center gap-3 border-b border-line px-5 py-3">
        <h2 class="flex-1 text-sm font-semibold">{descriviUnita(u, i)}</h2>
        <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => vai('unita', i)} title="Apri il quadro U"><Icona nome="modifica" /> Quadro U</button>
      </header>
      <div class="grid lg:grid-cols-2">
        <!-- proposto -->
        <div class="border-line p-5 lg:border-r {scelta === 'proposto' ? 'bg-accent-50/40 dark:bg-accent-950/20' : ''}">
          <label class="mb-4 flex items-center gap-2 text-sm font-semibold">
            <input type="radio" class="check" name={`convalida-${i}`} checked={scelta === 'proposto'} onchange={() => scegli(u, 'proposto')} />
            Classamento proposto
          </label>
          <FormClassamento bind:unita={pratica.unita[i]} {pratica} compatto />
        </div>
        <!-- automatico -->
        <div class="p-5 {scelta === 'automatico' ? 'bg-accent-50/40 dark:bg-accent-950/20' : ''}">
          <label class="mb-4 flex items-center gap-2 text-sm font-semibold {a.eseguito ? '' : 'text-fg-faint'}">
            <input type="radio" class="check" name={`convalida-${i}`} checked={scelta === 'automatico'} disabled={!a.eseguito} onchange={() => scegli(u, 'automatico')} />
            Classamento automatico
          </label>
          {#if a.eseguito}
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div><dt class="text-xs text-fg-muted">Zona</dt><dd class="font-medium">{a.zonaCensuaria}</dd></div>
              <div><dt class="text-xs text-fg-muted">Categoria</dt><dd class="font-medium" title={DESCRIZIONE_CATEGORIA[a.categoria ?? '']}>{cat(a.categoria)}</dd></div>
              <div><dt class="text-xs text-fg-muted">Classe</dt><dd class="font-medium">{a.classe}</dd></div>
              <div><dt class="text-xs text-fg-muted">Consistenza</dt><dd class="font-medium">{a.consistenza}</dd></div>
            </dl>
            {#if a.rendita !== undefined}<p class="mt-3 text-sm">Rendita € <strong class="tabular-nums">{euro(a.rendita)}</strong></p>{/if}
            <p class="mt-3 text-xs text-fg-muted">Scegliendolo, i dati passano nel classamento proposto, dove si possono ancora modificare.</p>
          {:else}
            <p class="flex items-start gap-2 text-sm text-fg-muted"><Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> {a.esito}.</p>
          {/if}
        </div>
      </div>
      <footer class="flex items-center justify-between border-t border-line bg-surface-2/50 px-5 py-2 text-sm">
        <span class="text-fg-muted">Convalidato: <strong class="text-fg">{scelta === 'automatico' ? 'automatico' : 'proposto'}</strong></span>
        <span class="tabular-nums">Rendita € <strong>{euro(c.rendita)}</strong></span>
      </footer>
    </section>
  {/each}
  {#if !righe.length}
    <div class="scheda px-6 py-10 text-center text-sm text-fg-muted">Nessuna unità a destinazione ordinaria da classare in questo documento.</div>
  {/if}
</div>
