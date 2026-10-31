<script lang="ts">
  /**
   * Selezione modelli 1N/2N: quattro riquadri (1N parte I, 1N parte II per le unità ordinarie, 2N parte I e II
   * per le unità a destinazione speciale), con Compila, Elimina e, per il 1N parte II, Copia/Incolla.
   */
  import type { Mod1NParteII as DatiMod1NParteII, Pratica } from '$lib/core/model';
  import { clonaProfondo, nuovoMod1NParteI, nuovoMod1NParteII } from '$lib/stato/pratica-file';
  import { descriviUnita } from '$lib/stato/validazione';
  import { conferma } from '$lib/piattaforma';
  import SchedeQuadri from '../SchedeQuadri.svelte';
  import Mod1NParteI, { quadri1NParteI } from '../Mod1NParteI.svelte';
  import Mod1NParteII, { quadri1NParteII } from '../Mod1NParteII.svelte';
  import Mod2N, { quadri2N } from '../Mod2N.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable(), registraOk }: { pratica: Pratica; registraOk?: (f: (() => void) | null) => void } = $props();

  type Editor = { tipo: '1NI' } | { tipo: '1NII'; i: number } | { tipo: '2N'; i: number };
  let editor = $state<Editor | null>(null);
  let quadro = $state('');
  let schede = $state<SchedeQuadri | undefined>();

  $effect(() => {
    registraOk?.(editor ? () => schede?.ok() : null);
    return () => registraOk?.(null);
  });

  const ordinarie = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione !== 'S' && /^[ABC]/.test(u.classamento?.categoria ?? '') && u.partitaSpeciale !== 'A'));
  const speciali = $derived(pratica.unita.map((u, i) => ({ u, i })).filter(({ u }) => u.operazione !== 'S' && /^[DE]/.test(u.classamento?.categoria ?? '')));

  function compila1NI(): void {
    if (!pratica.mod1NParteI) {
      pratica.mod1NParteI = nuovoMod1NParteI();
      const u = pratica.unita.find((x) => x.operazione !== 'S');
      if (u) {
        pratica.mod1NParteI.recordB.ceu_foglio = u.identificativo.foglio.padStart(4, '0');
        pratica.mod1NParteI.recordB.ceu_numero = u.identificativo.numero.padStart(5, '0');
        if (u.identificativo.sezione) pratica.mod1NParteI.recordB.ceu_sezione = u.identificativo.sezione;
      }
    }
    editor = { tipo: '1NI' };
    quadro = quadri1NParteI(pratica).find((q) => q.obbligatorio && !q.completo)?.id ?? 'riferimenti';
  }
  function compila1NII(i: number): void {
    const u = pratica.unita[i];
    u.mod1NParteII ??= nuovoMod1NParteII();
    editor = { tipo: '1NII', i };
    quadro = quadri1NParteII(u).find((q) => q.obbligatorio && !q.completo)?.id ?? 'ab';
  }
  function compila2N(i: number): void {
    const u = pratica.unita[i];
    u.mod2N ??= { recordM: {}, recordN: {}, stimaComparativa: [], corpi: [{ recordP: {}, recordQ: {}, recordR: {} }] };
    editor = { tipo: '2N', i };
    quadro = 'm1';
  }
  // copia/incolla del 1N parte II (le superfici lorde, che vengono dai poligoni, non si copiano)
  let copia = $state<number | null>(null);
  let destinazioni = $state<Set<number>>(new Set());
  async function incolla(): Promise<void> {
    if (copia === null || !destinazioni.size) return;
    if (!(await conferma("ATTENZIONE – L'operazione di copia ricoprirà i dati già esistenti. Confermi?"))) return;
    const sorgente = pratica.unita[copia];
    for (const i of destinazioni) {
      const u = pratica.unita[i];
      if ((u.classamento?.categoria ?? '') !== (sorgente.classamento?.categoria ?? '')) continue;
      const m = clonaProfondo($state.snapshot(sorgente.mod1NParteII) as DatiMod1NParteII);
      const vecchio = u.mod1NParteII;
      if (vecchio) Object.assign(m, { superficieLorda: vecchio.superficieLorda, accessoriIndirettiSup: vecchio.accessoriIndirettiSup, balconiSup: vecchio.balconiSup, pertinenzeScoperteSup: vecchio.pertinenzeScoperteSup });
      u.mod1NParteII = m;
      u.spessoreMuri = sorgente.spessoreMuri;
    }
    destinazioni = new Set();
  }
  const obbligatoriCompleti = (i: number) => quadri1NParteII(pratica.unita[i]).filter((q) => q.obbligatorio).every((q) => q.completo);
  const altriDati = (i: number) => quadri1NParteII(pratica.unita[i]).some((q) => !q.obbligatorio && q.completo);
  const titoloEditor = $derived(!editor ? '' : editor.tipo === '1NI' ? 'Modello 1NB – parte I (fabbricato)' : editor.tipo === '1NII' ? `Modello 1NB – parte II · ${descriviUnita(pratica.unita[editor.i], editor.i)}` : `Modello 2NB · ${descriviUnita(pratica.unita[editor.i], editor.i)}`);
  const vociEditor = $derived(!editor ? [] : editor.tipo === '1NI' ? quadri1NParteI(pratica) : editor.tipo === '1NII' ? quadri1NParteII(pratica.unita[editor.i]) : quadri2N(pratica.unita[editor.i]));
</script>

{#if editor}
  <SchedeQuadri bind:this={schede} titolo={titoloEditor} quadri={vociEditor} bind:corrente={quadro} onfine={() => (editor = null)} onannulla={() => (editor = null)}>
    {#snippet contenuto(q: string)}
      {#if editor?.tipo === '1NI'}
        <Mod1NParteI bind:pratica quadro={q} />
      {:else if editor?.tipo === '1NII'}
        <Mod1NParteII bind:unita={pratica.unita[editor.i]} {pratica} quadro={q} />
      {:else if editor?.tipo === '2N'}
        <Mod2N bind:unita={pratica.unita[editor.i]} quadro={q} />
      {/if}
    {/snippet}
  </SchedeQuadri>
{:else}
  <div class="grid gap-5 xl:grid-cols-2">
    <Sezione titolo="1N parte I" descrizione="Dati del fabbricato a cui appartengono le unità ordinarie.">
      {#snippet azioni()}
        <button type="button" class="btn btn-piccolo btn-primario" onclick={compila1NI}><Icona nome="modifica" /> Compila</button>
        <button type="button" class="btn btn-piccolo btn-pericolo" disabled={!pratica.mod1NParteI} onclick={async () => { if (await conferma('Eliminare il modello 1N parte I?')) pratica.mod1NParteI = undefined; }}><Icona nome="cestino" /> Elimina</button>
      {/snippet}
      {#if pratica.mod1NParteI}
        <div class="flex flex-wrap gap-1.5">
          {#each quadri1NParteI(pratica) as q (q.id)}
            <span class="pill {q.completo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' : q.obbligatorio ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200' : 'bg-surface-2 text-fg-muted'}">[{q.sigla}]</span>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-fg-muted">{ordinarie.length ? 'Da compilare: ci sono unità a destinazione ordinaria.' : 'Nessuna unità a destinazione ordinaria.'}</p>
      {/if}
    </Sezione>

    <Sezione titolo="1N parte II" descrizione="Per ogni unità a destinazione ordinaria: dati obbligatori per il classamento e altri dati.">
      {#snippet azioni()}
        <button type="button" class="btn btn-piccolo" disabled={copia === null || !destinazioni.size} onclick={incolla}><Icona nome="copia" /> Incolla</button>
      {/snippet}
      {#if copia !== null}<p class="mb-2 text-xs text-fg-muted">Copia da {descriviUnita(pratica.unita[copia], copia)}: seleziona le unità e premi Incolla (le superfici lorde non si copiano).</p>{/if}
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-fg-muted"><th class="w-6"></th><th class="py-1 font-medium">U.I.U.</th><th class="font-medium">Cat.</th><th class="font-medium">Dati obbligatori</th><th class="font-medium">Altri dati</th><th></th></tr></thead>
        <tbody>
          {#each ordinarie as { u, i } (i)}
            <tr class="border-t border-line">
              <td>{#if copia !== null && copia !== i}<input type="checkbox" class="check" checked={destinazioni.has(i)} onchange={(e) => { const s = new Set(destinazioni); if (e.currentTarget.checked) s.add(i); else s.delete(i); destinazioni = s; }} aria-label="Incolla su questa unità" />{/if}</td>
              <td class="py-1.5">{i + 1}. {u.identificativo.foglio}/{u.identificativo.numero}{u.identificativo.subalterno ? `/${u.identificativo.subalterno}` : ''}</td>
              <td>{u.classamento?.categoria}</td>
              <td>{u.mod1NParteII && obbligatoriCompleti(i) ? 'SI' : ''}</td>
              <td>{u.mod1NParteII && altriDati(i) ? 'SI' : ''}</td>
              <td class="text-right whitespace-nowrap">
                <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => compila1NII(i)} title="Compila"><Icona nome="modifica" /></button>
                <button type="button" class="btn btn-piccolo btn-ghost" disabled={!u.mod1NParteII} onclick={() => { copia = i; destinazioni = new Set(); }} title="Copia"><Icona nome="copia" /></button>
                <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" disabled={!u.mod1NParteII} onclick={async () => { if (await conferma('Eliminare il modello 1N parte II di questa unità?')) u.mod1NParteII = undefined; }} title="Elimina"><Icona nome="cestino" /></button>
              </td>
            </tr>
          {/each}
          {#if !ordinarie.length}<tr><td colspan="6" class="py-3 text-xs text-fg-faint">Nessuna unità a destinazione ordinaria (categorie A, B, C).</td></tr>{/if}
        </tbody>
      </table>
    </Sezione>

    <Sezione titolo="2N parte I e II" descrizione="Per ogni unità a destinazione speciale o particolare (categorie D ed E) e i suoi corpi di fabbrica.">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-fg-muted"><th class="py-1 font-medium">U.I.U.</th><th class="font-medium">Cat.</th><th class="font-medium">2N I</th><th class="font-medium">2N II (corpi)</th><th></th></tr></thead>
        <tbody>
          {#each speciali as { u, i } (i)}
            <tr class="border-t border-line">
              <td class="py-1.5">{i + 1}. {u.identificativo.foglio}/{u.identificativo.numero}{u.identificativo.subalterno ? `/${u.identificativo.subalterno}` : ''}</td>
              <td>{u.classamento?.categoria}</td>
              <td>{u.mod2N ? 'SI' : ''}</td>
              <td>{u.mod2N?.corpi.length ?? 0}</td>
              <td class="text-right whitespace-nowrap">
                <button type="button" class="btn btn-piccolo btn-ghost" onclick={() => compila2N(i)} title="Compila"><Icona nome="modifica" /></button>
                <button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" disabled={!u.mod2N} onclick={async () => { if (await conferma('Eliminare il modello 2N di questa unità?')) u.mod2N = undefined; }} title="Elimina"><Icona nome="cestino" /></button>
              </td>
            </tr>
          {/each}
          {#if !speciali.length}<tr><td colspan="5" class="py-3 text-xs text-fg-faint">Nessuna unità a destinazione speciale o particolare.</td></tr>{/if}
        </tbody>
      </table>
    </Sezione>
  </div>
{/if}
