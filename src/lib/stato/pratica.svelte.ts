/**
 * Pratica aperta: caricamento, salvataggio (con autosalvataggio) ed elenco delle pratiche nella
 * cartella di lavoro. Ogni pratica vive in una sottocartella <cartella pratiche>/<id>/ che
 * contiene <id>.catasto.json e, dopo l'esportazione, il PDF NCVnnn.PDF.
 */
import type { Pratica } from '$lib/core/model';
import { elencoFile, leggiFile, scriviFile, unisci, creaCartella, eliminaFile, cartellaDi, nomeFile } from '$lib/piattaforma';
import { deserializzaPratica, serializzaPratica, nuovoId, ESTENSIONE_PRATICA, type FilePratica, type MetaPratica } from './pratica-file';

export interface VocePratica {
  percorso: string;
  cartella: string;
  meta: MetaPratica;
  comune: string;
  progressivo: number;
  unita: number;
  tipo: 'accatastamento' | 'variazione';
}

/** Elenca le pratiche nella cartella di lavoro (file *.catasto.json nella cartella o nelle sottocartelle di primo livello). */
export async function elencoPratiche(cartella: string): Promise<VocePratica[]> {
  const out: VocePratica[] = [];
  const voci = await elencoFile(cartella);
  const candidati: string[] = [];
  for (const v of voci) {
    if (!v.cartella && v.nome.endsWith(ESTENSIONE_PRATICA)) candidati.push(v.percorso);
    else if (v.cartella) {
      try {
        for (const s of await elencoFile(v.percorso)) if (!s.cartella && s.nome.endsWith(ESTENSIONE_PRATICA)) candidati.push(s.percorso);
      } catch { /* sottocartella non leggibile */ }
    }
  }
  for (const p of candidati) {
    try {
      const f = deserializzaPratica(new TextDecoder().decode(await leggiFile(p)));
      out.push({ percorso: p, cartella: cartellaDi(p), meta: f.meta, comune: f.pratica.comune.nome, progressivo: f.pratica.progressivo, unita: f.pratica.unita.length, tipo: f.pratica.tipoDocumento ?? 'variazione' });
    } catch { /* file non valido: lo ignoriamo */ }
  }
  return out.sort((a, b) => b.meta.modificata.localeCompare(a.meta.modificata));
}

export type StatoSalvataggio = 'salvato' | 'modificato' | 'salvataggio' | 'errore';

class StatoPratica {
  file = $state<FilePratica | null>(null);
  percorso = $state<string | null>(null);
  salvataggio = $state<StatoSalvataggio>('salvato');
  errore = $state<string | null>(null);
  readonly cartella = $derived(this.percorso ? cartellaDi(this.percorso) : null);
  readonly pratica = $derived(this.file?.pratica ?? null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private ultimoSerializzato = '';

  async apri(percorso: string): Promise<FilePratica> {
    const testo = new TextDecoder().decode(await leggiFile(percorso));
    const f = deserializzaPratica(testo);
    this.file = f;
    this.percorso = percorso;
    this.ultimoSerializzato = serializzaPratica(f);
    this.salvataggio = 'salvato';
    this.errore = null;
    return f;
  }

  /** Crea la cartella e il file di una nuova pratica e la apre. */
  async crea(cartellaPratiche: string, pratica: Pratica, titolo: string): Promise<string> {
    const id = nuovoId();
    const adesso = new Date().toISOString();
    const meta: MetaPratica = { id, titolo, stato: 'bozza', creata: adesso, modificata: adesso };
    const dir = unisci(cartellaPratiche, id);
    await creaCartella(dir);
    const percorso = unisci(dir, `${id}${ESTENSIONE_PRATICA}`);
    const f: FilePratica = { formato: 'fa-catasto-doc', versione: 1, meta, pratica };
    await scriviFile(percorso, serializzaPratica(f));
    this.file = f;
    this.percorso = percorso;
    this.ultimoSerializzato = serializzaPratica(f);
    this.salvataggio = 'salvato';
    return percorso;
  }

  chiudi(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.file = null;
    this.percorso = null;
    this.salvataggio = 'salvato';
  }

  /** Salva subito (aggiorna "modificata"). */
  async salva(): Promise<void> {
    if (!this.file || !this.percorso) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.salvataggio = 'salvataggio';
    const precedente = this.ultimoSerializzato;
    try {
      this.file.meta.modificata = new Date().toISOString();
      const s = serializzaPratica($state.snapshot(this.file) as FilePratica);
      // va aggiornato PRIMA della scrittura: il cambio di "modificata" riattiva l'effetto dell'autosalvataggio,
      // che altrimenti vedrebbe una differenza e programmerebbe un altro salvataggio, all'infinito
      this.ultimoSerializzato = s;
      await scriviFile(this.percorso, s);
      this.salvataggio = 'salvato';
      this.errore = null;
    } catch (e) {
      this.ultimoSerializzato = precedente;
      this.salvataggio = 'errore';
      this.errore = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * Da chiamare a ogni modifica (lo fa l'effetto della pagina pratica): confronta con l'ultimo
   * salvataggio e programma un salvataggio con ritardo.
   */
  notificaModifica(serializzato: string, ritardoMs = 800): void {
    if (serializzato === this.ultimoSerializzato) return;
    this.salvataggio = 'modificato';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.salva(); }, ritardoMs);
  }

  /** Elimina la pratica: la sua sottocartella, oppure il solo file se sta direttamente nella cartella di lavoro. */
  async elimina(voce: VocePratica, cartellaPratiche: string): Promise<void> {
    if (this.percorso === voce.percorso) this.chiudi();
    const stessa = voce.cartella.replace(/[\\/]+$/, '') === cartellaPratiche.replace(/[\\/]+$/, '');
    // si elimina tutta la cartella solo se è quella creata dal programma per questa pratica (nome = id) e non
    // contiene altre pratiche; altrimenti (cartella del tecnico con altri file) si toglie solo il file della pratica
    let propria = !stessa && nomeFile(voce.cartella.replace(/[\\/]+$/, '')) === voce.meta.id;
    if (propria) {
      try {
        const altre = (await elencoFile(voce.cartella)).filter((v) => !v.cartella && v.nome.endsWith(ESTENSIONE_PRATICA) && v.percorso !== voce.percorso);
        if (altre.length) propria = false;
      } catch { propria = false; }
    }
    await eliminaFile(propria ? voce.cartella : voce.percorso);
  }

  /** Serializzazione corrente della pratica (per l'autosalvataggio). */
  serializza(): string {
    return this.file ? serializzaPratica($state.snapshot(this.file) as FilePratica) : '';
  }
}

export const statoPratica = new StatoPratica();
