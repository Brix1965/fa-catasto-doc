<script lang="ts">
  /**
   * Elenco subalterni: Aggiorna (dalle unità del documento: descrizione dalla destinazione d'uso del 1N/2N),
   * Importa (da un elenco esterno), Inserisci/Modifica/Elimina, corpi di fabbrica (obbligatori in accatastamento).
   */
  import type { ElencoSubalterno, Pratica } from '$lib/core/model';
  import { DESCRIZIONE_CATEGORIA } from '$lib/core/regole-docfa';
  import { leggiElencoSubalterni } from '$lib/core/decompile';
  import { motiviElaboratoObbligatorio } from '$lib/stato/validazione';
  import { importaPdfDocfa } from '$lib/core/pdf/importa';
  import { scegliFile, leggiFile, conferma } from '$lib/piattaforma';
  import Campo from '../Campo.svelte';
  import Sezione from '../Sezione.svelte';
  import Icona from '../Icona.svelte';

  let { pratica = $bindable() }: { pratica: Pratica } = $props();
  const ep = $derived(pratica.elaboratoPlanimetrico);
  const acc = $derived(pratica.tipoDocumento === 'accatastamento');
  const CORPI = ['CF1', 'CF2', 'CF3', 'CF4', 'CF5', 'CF6', 'CF7', 'CF8', 'CF9', 'AL', 'AC', 'CI', 'CS'];
  let sel = $state(-1);
  let errore = $state('');

  function crea(): void {
    const u = pratica.unita.find((x) => x.operazione !== 'S');
    const usati = pratica.unita.map((x) => x.planimetria?.progressivo ?? 0);
    pratica.elaboratoPlanimetrico = { identificativo: { sezione: u?.identificativo.sezione, foglio: u?.identificativo.foglio ?? '', numero: u?.identificativo.numero ?? '' }, progressivoImmagine: Math.max(0, ...usati) + 1, subalterni: [] };
  }
  /** Aggiorna: riscrive le righe delle unità del documento, lascia quelle inserite a mano. */
  function aggiorna(): void {
    if (!ep) return;
    const manuali = ep.subalterni.filter((s) => s.flagInserimento !== 0 && !pratica.unita.some((u) => stesso(s, u.identificativo)));
    const doc: ElencoSubalterno[] = pratica.unita.filter((u) => u.operazione !== 'S').map((u) => {
      const vecchia = ep.subalterni.find((s) => stesso(s, u.identificativo));
      const cat = u.classamento?.categoria;
      const descr = u.mod1NParteII?.destinazioneUso || (u.destinazioneUsoDE ? '' : '') || (cat ? (DESCRIZIONE_CATEGORIA[cat] ?? '').toUpperCase() : '');
      return {
        identificativo: { ...u.identificativo },
        indirizzo: u.indirizzo?.toponimo, civico: u.indirizzo?.civici[0], piani: [...(u.indirizzo?.piani ?? [])], scala: u.indirizzo?.scala, interno: u.indirizzo?.interno,
        descrizione: vecchia?.descrizione || descr, flagInserimento: 0, tipo: u.partitaSpeciale === 'A' ? 'B' : 'U', categoria: cat || undefined, entita: vecchia?.entita ?? [],
      };
    });
    const bcnc: ElencoSubalterno[] = (acc ? pratica.bcnc ?? [] : []).filter((b) => !ep.subalterni.some((s) => stesso(s, b.identificativo) && s.flagInserimento !== 0)).map((b) => ({
      identificativo: { ...b.identificativo }, piani: [...b.piani], descrizione: ep.subalterni.find((s) => stesso(s, b.identificativo))?.descrizione ?? 'BENE COMUNE NON CENSIBILE', flagInserimento: 0, tipo: 'B', entita: [],
    }));
    ep.subalterni = [...doc, ...bcnc, ...manuali].sort((a, b) => Number(a.identificativo.subalterno ?? 0) - Number(b.identificativo.subalterno ?? 0));
  }
  function stesso(s: ElencoSubalterno, id: { foglio: string; numero: string; subalterno?: string }): boolean {
    return s.identificativo.foglio === id.foglio && s.identificativo.numero === id.numero && (s.identificativo.subalterno ?? '') === (id.subalterno ?? '');
  }
  async function importa(): Promise<void> {
    errore = '';
    const f = await scegliFile("Scegli l'elenco subalterni (PDF Docfa o EPVnnn.DAT)", [{ nome: 'Elenco subalterni', estensioni: ['pdf', 'PDF', 'dat', 'DAT'] }]);
    if (!f || !ep) return;
    try {
      const dati = await leggiFile(f);
      const righe = /\.pdf$/i.test(f) ? (await importaPdfDocfa(dati)).pratica.elaboratoPlanimetrico?.subalterni ?? [] : leggiElencoSubalterni(dati);
      if (!righe.length) { errore = 'Nessun subalterno trovato nel file'; return; }
      ep.subalterni = [...ep.subalterni, ...righe.filter((r) => !ep.subalterni.some((s) => stesso(s, r.identificativo))).map((r) => ({ ...r, flagInserimento: 2 as const }))];
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
    }
  }
  function inserisci(): void {
    if (!ep) return;
    ep.subalterni.push({ identificativo: { sezione: ep.identificativo.sezione, foglio: ep.identificativo.foglio, numero: ep.identificativo.numero, subalterno: '' }, piani: [], descrizione: '', flagInserimento: 1, tipo: 'U', entita: [] });
    sel = ep.subalterni.length - 1;
  }
  function corpo(s: ElencoSubalterno, c: string, v: boolean): void {
    s.entita = v ? [...s.entita, c].slice(0, 5) : s.entita.filter((x) => x !== c);
  }
  const lista = (v: string, max: number) => v.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, max);
  const unicaUnita = $derived(pratica.unita.filter((u) => u.operazione !== 'S').length === 1);
  const motivi = $derived(motiviElaboratoObbligatorio(pratica));
</script>

{#snippet stato()}
  {#if motivi.length}
    <p class="mb-3 flex items-start gap-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-900 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-100">
      <Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> <span><strong>Obbligatorio in questo documento</strong> (con l'elaborato planimetrico): {motivi.join('; ')}.</span>
    </p>
  {:else}
    <p class="mb-3 flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg-muted">
      <Icona nome="info" classe="mt-0.5 size-4 shrink-0" /> <span><strong>Non obbligatorio in questo documento</strong>: lo diventa con due o più unità costituite, unità in categoria F o beni comuni non censibili. Si può allegare comunque, ad esempio se l'elaborato è già in atti e cambiano le geometrie.</span>
    </p>
  {/if}
{/snippet}

{@render stato()}

{#if !ep}
  <div class="scheda flex flex-col items-start gap-3 p-6">
    <p class="text-sm text-fg-muted">L'elenco subalterni accompagna l'elaborato planimetrico.</p>
    <button class="btn btn-primario" type="button" onclick={crea}><Icona nome="piu" /> Compila l'elenco subalterni</button>
  </div>
{:else}
  <Sezione titolo={`Elenco subalterni – fg. ${ep.identificativo.foglio} p.lla ${ep.identificativo.numero}`} descrizione="Va compilato per ultimo: la descrizione di ogni unità riprende la destinazione d'uso indicata nei modelli 1N/2N.">
    {#snippet azioni()}
      <button class="btn btn-piccolo" type="button" onclick={aggiorna}><Icona nome="ricarica" /> Aggiorna</button>
      <button class="btn btn-piccolo" type="button" onclick={importa}><Icona nome="importa" /> Importa</button>
      <button class="btn btn-piccolo btn-primario" type="button" onclick={inserisci}><Icona nome="piu" /> Inserisci</button>
      <button class="btn btn-piccolo btn-pericolo" type="button" disabled={!ep.subalterni.length} onclick={async () => { if (await conferma("Eliminare tutte le righe dell'elenco subalterni?")) ep.subalterni = []; }}><Icona nome="cestino" /> Elimina tutto</button>
    {/snippet}
    {#if errore}<p class="mb-3 text-sm text-red-600">{errore}</p>{/if}
    <table class="w-full text-sm">
      <thead><tr class="text-left text-xs text-fg-muted"><th class="py-1 font-medium">Sub.</th><th class="font-medium">Tipo</th><th class="font-medium">Ubicazione</th><th class="font-medium">Descrizione</th><th class="font-medium">Corpi</th><th></th></tr></thead>
      <tbody>
        {#each ep.subalterni as s, k (k)}
          <tr class="cursor-pointer border-t border-line hover:bg-surface-2 {sel === k ? 'bg-accent-50 dark:bg-accent-950' : ''}" onclick={() => (sel = sel === k ? -1 : k)}>
            <td class="py-1.5 font-medium">{s.identificativo.subalterno || '—'}</td>
            <td>{s.tipo === 'B' ? 'b.c.n.c.' : 'u.i.u.'}</td>
            <td class="text-xs">{s.indirizzo ?? ''} {s.civico ?? ''} {s.piani.length ? `p. ${s.piani.join('-')}` : ''}</td>
            <td class="max-w-80 truncate">{s.descrizione}</td>
            <td class="text-xs">{s.entita.join(' ')}</td>
            <td class="text-right"><button type="button" class="btn btn-piccolo btn-ghost btn-pericolo" onclick={(e) => { e.stopPropagation(); ep.subalterni.splice(k, 1); sel = -1; }} title="Elimina"><Icona nome="cestino" /></button></td>
          </tr>
          {#if sel === k}
            <tr><td colspan="6" class="bg-surface-2/50 p-3">
              <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <Campo etichetta="Subalterno" obbligatorio><input type="text" class="campo" maxlength="4" value={s.identificativo.subalterno ?? ''} oninput={(e) => (s.identificativo.subalterno = e.currentTarget.value.trim() || undefined)} /></Campo>
                <Campo etichetta="Tipo"><select class="campo" bind:value={s.tipo}><option value="U">Unità immobiliare</option><option value="B">Bene comune non censibile</option></select></Campo>
                <Campo etichetta="Indirizzo" classe="xl:col-span-2"><input type="text" class="campo" maxlength="50" value={s.indirizzo ?? ''} oninput={(e) => (s.indirizzo = e.currentTarget.value || undefined)} /></Campo>
                <Campo etichetta="Civico"><input type="text" class="campo uppercase" maxlength="6" value={s.civico ?? ''} oninput={(e) => (s.civico = e.currentTarget.value.trim() || undefined)} /></Campo>
                <Campo etichetta="Piani"><input type="text" class="campo uppercase" value={s.piani.join(', ')} onchange={(e) => (s.piani = lista(e.currentTarget.value, 3))} /></Campo>
                <Campo etichetta="Scala"><input type="text" class="campo uppercase" maxlength="2" value={s.scala ?? ''} oninput={(e) => (s.scala = e.currentTarget.value.trim() || undefined)} /></Campo>
                <Campo etichetta="Interno"><input type="text" class="campo uppercase" maxlength="3" value={s.interno ?? ''} oninput={(e) => (s.interno = e.currentTarget.value.trim() || undefined)} /></Campo>
                <Campo etichetta="Descrizione" classe="sm:col-span-3 xl:col-span-4" obbligatorio><input type="text" class="campo uppercase" maxlength="300" value={s.descrizione} oninput={(e) => (s.descrizione = e.currentTarget.value.toUpperCase())} /></Campo>
              </div>
              <div class="mt-3">
                <span class="etichetta {acc && s.tipo === 'U' && !unicaUnita ? 'obbligatorio' : ''}">Corpi di fabbrica (fino a 5)</span>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                  {#each CORPI as c (c)}
                    <label class="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" class="check" checked={s.entita.includes(c)} disabled={!s.entita.includes(c) && s.entita.length >= 5} onchange={(e) => corpo(s, c, e.currentTarget.checked)} /> {c}</label>
                  {/each}
                </div>
              </div>
            </td></tr>
          {/if}
        {/each}
        {#if !ep.subalterni.length}<tr><td colspan="6" class="py-3 text-xs text-fg-faint">Elenco vuoto: premi «Aggiorna» per riportare le unità del documento.</td></tr>{/if}
      </tbody>
    </table>
  </Sezione>
{/if}
