<script lang="ts">
  /** Controllo formale del documento: diagnostici di tipo G (struttura), E (errori) e W (avvertimenti), come in Docfa. */
  import type { Pratica } from '$lib/core/model';
  import { controllaPratica, type Problema, type SezionePratica } from '$lib/stato/validazione';
  import { DIAGNOSTICI } from '$lib/core/dati/docfa-tabelle.generated';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica, vai, titoli }: { pratica: Pratica; vai: (s: SezionePratica, unita?: number) => void; titoli: Partial<Record<SezionePratica, string>> } = $props();
  const esito = $derived(controllaPratica(pratica));
  let aperto = $state<string | null>(null);
  const tipo = (p: Problema) => p.codice?.charAt(0) ?? (p.livello === 'errore' ? 'E' : 'W');
  const gruppi = $derived.by(() => {
    const m = new Map<SezionePratica, Problema[]>();
    for (const p of [...esito.errori, ...esito.avvisi]) m.set(p.sezione, [...(m.get(p.sezione) ?? []), p]);
    return [...m.entries()];
  });
</script>

<Sezione titolo="Cosa manca" descrizione="Tutto quello che manca o va corretto, con le regole del controllo formale di Docfa. Il documento resta salvato in bozza: gli errori bloccano solo l'esportazione. Clicca una voce per andare al punto da completare.">
  <div class="mb-5 flex flex-wrap gap-3">
    <span class="pill {esito.errori.length ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'}">{esito.errori.length} da completare o correggere</span>
    <span class="pill bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{esito.avvisi.length} avvertimenti</span>
  </div>
  {#if !gruppi.length}
    <p class="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Icona nome="spunta" /> Non manca niente: il documento si può esportare.</p>
  {/if}
  <div class="space-y-5">
    {#each gruppi as [sezione, problemi] (sezione)}
      <div>
        <h3 class="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {titoli[sezione] ?? sezione}
          <button type="button" class="btn btn-piccolo btn-ghost normal-case" onclick={() => vai(sezione)}>Vai <Icona nome="destra" /></button>
        </h3>
        <ul class="divide-y divide-line rounded-md border border-line">
          {#each problemi as p, k (k)}
            {@const id = `${sezione}-${k}`}
            {@const spieg = p.codice ? DIAGNOSTICI[p.codice]?.d : undefined}
            <li class="px-3 py-2 text-sm">
              <div class="flex items-start gap-2">
                <span class="mt-0.5 w-12 shrink-0 font-mono text-xs {p.livello === 'errore' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}">{p.codice ?? tipo(p)}</span>
                <button type="button" class="flex-1 text-left hover:underline" onclick={() => vai(p.sezione, p.unita)}>{p.testo}</button>
                {#if spieg}<button type="button" class="btn btn-piccolo btn-ghost" onclick={() => (aperto = aperto === id ? null : id)} title="Spiegazione del diagnostico"><Icona nome="info" /></button>{/if}
              </div>
              {#if aperto === id && spieg}<p class="mt-1.5 ml-14 text-xs text-fg-muted">{spieg}</p>{/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</Sezione>
