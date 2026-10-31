<script lang="ts" module>
  export interface VoceQuadro { id: string; sigla: string; titolo: string; obbligatorio?: boolean; completo: boolean }
</script>

<script lang="ts">
  /**
   * Finestra a quadri come i modelli 1N/2N di Docfa: etichette a sinistra (sottolineate se obbligatorie),
   * pallino verde a compilazione avvenuta; OK passa al successivo quadro obbligatorio non compilato.
   */
  import type { Snippet } from 'svelte';
  import Icona from './Icona.svelte';

  let { quadri, corrente = $bindable(), contenuto, titolo, onfine, onannulla }: {
    quadri: VoceQuadro[];
    corrente: string;
    contenuto: Snippet<[string]>;
    titolo: string;
    onfine: () => void;
    onannulla: () => void;
  } = $props();

  /** OK: salta al prossimo quadro obbligatorio non compilato, altrimenti chiude. */
  export function ok(): void {
    const i = quadri.findIndex((q) => q.id === corrente);
    const dopo = [...quadri.slice(i + 1), ...quadri.slice(0, i + 1)].find((q) => q.obbligatorio && !q.completo);
    if (dopo) corrente = dopo.id;
    else onfine();
  }
  /** Esc: chiude il modello (come «Chiudi»), senza annullare lo schermo intero. */
  export function chiudi(): void { onannulla(); }
  const mancanti = $derived(quadri.filter((q) => q.obbligatorio && !q.completo).length);
</script>

<div class="scheda overflow-hidden">
  <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
    <h2 class="text-sm font-semibold uppercase tracking-wide">{titolo}</h2>
    <span class="text-xs text-fg-muted">{mancanti ? `${mancanti} quadri obbligatori da compilare` : 'Quadri obbligatori compilati'}</span>
  </header>
  <div class="grid md:grid-cols-[14rem_1fr]">
    <nav class="border-b border-line bg-surface-2/50 p-2 md:border-r md:border-b-0" aria-label="Quadri">
      <ul class="space-y-0.5">
        {#each quadri as q (q.id)}
          <li>
            <button type="button" class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface {corrente === q.id ? 'bg-surface font-medium shadow-xs' : ''}" onclick={() => (corrente = q.id)}>
              <span class="size-2.5 shrink-0 rounded-full {q.completo ? 'bg-emerald-500' : 'border border-line-strong'}" title={q.completo ? 'compilato' : 'da compilare'}></span>
              <span class="w-11 shrink-0 font-mono text-xs {q.obbligatorio ? 'text-fuchsia-700 underline decoration-fuchsia-500 underline-offset-2 dark:text-fuchsia-300' : 'text-fg-muted'}">[{q.sigla}]</span>
              <span class="min-w-0 flex-1 truncate">{q.titolo}</span>
            </button>
          </li>
        {/each}
      </ul>
    </nav>
    <div class="min-w-0 p-5">
      {@render contenuto(corrente)}
      <div class="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" class="btn" onclick={onannulla}>Chiudi</button>
        <button type="button" class="btn btn-primario" onclick={ok}><Icona nome="spunta" /> OK <span class="tasto ml-1 border-white/40 bg-white/10 text-white">Ctrl+O</span></button>
      </div>
    </div>
  </div>
</div>
