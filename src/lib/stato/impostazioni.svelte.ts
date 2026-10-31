/**
 * Impostazioni dell'applicazione (tecnico, cartella pratiche, archivi importati) e archivi
 * caricati in memoria. Persistite in <appDataDir>/impostazioni.json; gli archivi dell'Agenzia
 * sono copiati in <appDataDir>/archivi/.
 */
import type { Comune, Tecnico } from '$lib/core/model';
import { leggiComuni, leggiStradario, leggiTariffe, leggiSetup, leggiZone, contaRighe, riconosciArchivio, comuniIncorporati, type Strada, type Tariffa, type ZonaFoglio, type ArchivioRiconosciuto } from '$lib/core/archivi';
import { leggiProspetti, type Prospetti } from '$lib/core/classamento-automatico';
import { appDataDir, leggiFile, scriviFile, esisteFile, unisci, nomeFile, elencoFile, eliminaFile, type VoceCartella } from '$lib/piattaforma';
import { tecnicoVuoto } from './pratica-file';

export interface ArchivioProvinciale {
  /** sigla della provincia (dal nome dei file: FI-topo-com.dat → FI) */
  provincia: string;
  /** percorsi relativi alla cartella archivi (es. "FI/FI-topo-com.dat") */
  stradario?: string;
  tariffe?: string;
  zone?: string;
  /** prospetti per il classamento automatico (Nclxxv1..8A.dat) */
  classamento?: string[];
  /** data dell'ultima importazione (ISO) */
  importato?: string;
}

export interface Impostazioni {
  tecnico: Tecnico;
  /** elenco dei tecnici memorizzati (come la tendina "Elenco dei tecnici" di Docfa) */
  tecnici?: Tecnico[];
  cartellaPratiche: string;
  /** comuni: percorso relativo di un Comuni.dat importato (altrimenti si usano i comuni incorporati) */
  archivi: { comuni?: string; provinciali: ArchivioProvinciale[] };
  /**
   * prossimo numero immagine (planimetrie ed elaborati): unico tra tutte le pratiche, per non coincidere con
   * le immagini già presenti nell'archivio di Docfa (stesso numero → "alcune planimetrie non importate")
   */
  prossimaImmagine?: number;
}

/** Primo numero immagine proposto: lontano dai numeri che assegna Docfa (partono da 1). */
export const PRIMA_IMMAGINE = 9000001;

export interface EsitoImportazione {
  righe: string[];
  avvisi: string[];
}

class StatoImpostazioni {
  dati = $state<Impostazioni>({ tecnico: tecnicoVuoto(), cartellaPratiche: '', archivi: { provinciali: [] } });
  caricate = $state(false);
  errore = $state<string | null>(null);
  /** archivi in memoria: non reattivi in profondità (sono grandi) */
  comuni = $state.raw<Comune[]>([]);
  strade = $state.raw<Record<string, Strada[]>>({});
  tariffe = $state.raw<Record<string, Tariffa[]>>({});
  zone = $state.raw<Record<string, ZonaFoglio[]>>({});
  /** numero di righe dei prospetti di classamento per provincia */
  classamento = $state.raw<Record<string, number>>({});
  /** prospetti per il classamento automatico, per provincia (con le tariffe come TARIFFE) */
  prospetti = $state.raw<Record<string, Prospetti>>({});
  /** origine dell'elenco comuni */
  fonteComuni = $state<string>('');
  private dir = '';

  readonly province = $derived([...new Set(this.comuni.map((c) => c.provincia))].sort());
  readonly numeroStrade = $derived(Object.values(this.strade).reduce((n, s) => n + s.length, 0));

  async carica(): Promise<void> {
    if (this.caricate) return;
    try {
      this.dir = await appDataDir();
      const p = unisci(this.dir, 'impostazioni.json');
      if (await esisteFile(p)) {
        const letto = JSON.parse(new TextDecoder().decode(await leggiFile(p))) as Partial<Impostazioni>;
        this.dati = {
          tecnico: { ...tecnicoVuoto(), ...(letto.tecnico ?? {}) },
          tecnici: letto.tecnici ?? [],
          cartellaPratiche: letto.cartellaPratiche ?? '',
          archivi: { comuni: letto.archivi?.comuni, provinciali: letto.archivi?.provinciali ?? [] },
        };
      }
      await this.caricaArchivi();
    } catch (e) {
      this.errore = `Impostazioni non leggibili: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this.caricate = true;
    }
  }

  /** Tecnici memorizzati, compreso quello predefinito. */
  elencoTecnici(): Tecnico[] {
    const tutti = [this.dati.tecnico, ...(this.dati.tecnici ?? [])].filter((t) => t.cognome.trim());
    const visti = new Set<string>();
    return tutti.filter((t) => { const k = `${t.cognome}|${t.nome}|${t.codiceFiscale}`.toUpperCase(); if (visti.has(k)) return false; visti.add(k); return true; });
  }

  /** Memorizza il tecnico della pratica (Docfa lo ripropone nei documenti successivi). */
  async memorizzaTecnico(t: Tecnico): Promise<void> {
    if (!t.cognome.trim()) return;
    const k = (x: Tecnico) => `${x.cognome}|${x.nome}|${x.codiceFiscale}`.toUpperCase();
    const elenco = (this.dati.tecnici ?? []).filter((x) => k(x) !== k(t));
    this.dati.tecnici = [{ ...t }, ...elenco].slice(0, 20);
    if (!this.dati.tecnico.cognome.trim()) this.dati.tecnico = { ...t };
    await this.salva();
  }

  /** Assegna un nuovo numero immagine, unico tra le pratiche e diverso da quelli già usati nella pratica. */
  nuovaImmagine(usati: number[]): number {
    const n = Math.max(this.dati.prossimaImmagine ?? PRIMA_IMMAGINE, ...usati.map((x) => x + 1));
    this.dati.prossimaImmagine = n + 1 > 9999999 ? PRIMA_IMMAGINE : n + 1;
    void this.salva().catch(() => {});
    return n;
  }

  async salva(): Promise<void> {
    if (!this.dir) this.dir = await appDataDir();
    await scriviFile(unisci(this.dir, 'impostazioni.json'), JSON.stringify($state.snapshot(this.dati), null, 2));
  }

  /** Percorso di un archivio dato il percorso relativo alla cartella archivi (es. "FI/FI-tar.dat"). */
  private percorsoArchivio(rel: string): string {
    return unisci(this.dir, 'archivi', ...rel.split('/'));
  }

  private async caricaArchivi(): Promise<void> {
    const a = this.dati.archivi;
    const inc = comuniIncorporati();
    this.comuni = inc.comuni;
    this.fonteComuni = `elenco incorporato (Comuni.dat di Docfa 4.00.5, ${inc.data.split('-').reverse().join('/')})`;
    if (a.comuni) {
      try {
        const c = leggiComuni(await leggiFile(this.percorsoArchivio(a.comuni)));
        if (c.length) { this.comuni = c; this.fonteComuni = `${nomeFile(a.comuni)} importato`; }
      } catch { /* resta l'elenco incorporato */ }
    }
    const strade: Record<string, Strada[]> = {};
    const tariffe: Record<string, Tariffa[]> = {};
    const zone: Record<string, ZonaFoglio[]> = {};
    const classamento: Record<string, number> = {};
    const prospetti: Record<string, Prospetti> = {};
    for (const p of a.provinciali) {
      if (p.stradario) { try { strade[p.provincia] = leggiStradario(await leggiFile(this.percorsoArchivio(p.stradario))); } catch { /* ignora */ } }
      if (p.tariffe) { try { tariffe[p.provincia] = leggiTariffe(await leggiFile(this.percorsoArchivio(p.tariffe))); } catch { /* ignora */ } }
      if (p.zone) { try { zone[p.provincia] = leggiZone(await leggiFile(this.percorsoArchivio(p.zone))); } catch { /* ignora */ } }
      if (p.classamento?.length) {
        let n = 0;
        const file: Record<string, Uint8Array | undefined> = {};
        for (const f of p.classamento) {
          try {
            const dati = await leggiFile(this.percorsoArchivio(f));
            n += contaRighe(dati);
            const parte = riconosciArchivio(nomeFile(f)).parte;
            if (parte) file[`V${parte}`] = dati;
          } catch { /* ignora */ }
        }
        if (p.tariffe) { try { file.TAR = await leggiFile(this.percorsoArchivio(p.tariffe)); } catch { /* ignora */ } }
        classamento[p.provincia] = n;
        prospetti[p.provincia] = leggiProspetti(file);
      }
    }
    this.strade = strade;
    this.tariffe = tariffe;
    this.zone = zone;
    this.classamento = classamento;
    this.prospetti = prospetti;
  }

  /**
   * Importa una cartella di archivi come fa Docfa: si sceglie la cartella della provincia (es. "fi")
   * e vengono letti tutti i file riconosciuti. Si può scegliere anche una cartella che contiene più
   * province (fi, bo, …) o la cartella di installazione di Docfa (Comuni.dat, SETUP.DAT).
   */
  async importaCartella(cartella: string): Promise<EsitoImportazione> {
    const trovati: { percorso: string; nome: string; info: ArchivioRiconosciuto }[] = [];
    const esplora = async (dir: string, profondita: number): Promise<void> => {
      let voci: VoceCartella[] = [];
      try { voci = await elencoFile(dir); } catch { return; }
      for (const v of voci) {
        if (v.cartella) { if (profondita < 2 && !/^(pgm|html|doc|out|d1|d8|ds|classa)$/i.test(v.nome)) await esplora(v.percorso, profondita + 1); continue; }
        const info = riconosciArchivio(v.nome);
        if (info.tipo !== 'ignorato') trovati.push({ percorso: v.percorso, nome: v.nome, info });
      }
    };
    await esplora(cartella, 0);
    if (!trovati.length) throw new Error('Nessun archivio Docfa nella cartella scelta (attesi file come FI-topo-com.dat, Fi-tar.dat, Fi-zon.dat, Nclfiv1.dat, Comuni.dat)');
    return this.importaTrovati(trovati);
  }

  /** Importa singoli file scelti dall'utente (stessa logica della cartella). */
  async importaFile(percorsi: string[]): Promise<EsitoImportazione> {
    const trovati = percorsi.map((p) => ({ percorso: p, nome: nomeFile(p), info: riconosciArchivio(nomeFile(p)) }));
    const ignorati = trovati.filter((t) => t.info.tipo === 'ignorato').map((t) => t.nome);
    const esito = await this.importaTrovati(trovati.filter((t) => t.info.tipo !== 'ignorato'));
    if (ignorati.length) esito.avvisi.push(`File non riconosciuti come archivi Docfa: ${ignorati.join(', ')}`);
    return esito;
  }

  private async importaTrovati(trovati: { percorso: string; nome: string; info: ArchivioRiconosciuto }[]): Promise<EsitoImportazione> {
    if (!this.dir) this.dir = await appDataDir();
    const righe: string[] = [];
    const avvisi: string[] = [];
    const oggi = new Date().toISOString().slice(0, 10);

    // comuni e setup
    for (const t of trovati.filter((x) => x.info.tipo === 'comuni')) {
      const dati = await leggiFile(t.percorso);
      const c = leggiComuni(dati);
      if (!c.length) { avvisi.push(`${t.nome}: nessun comune letto`); continue; }
      await scriviFile(this.percorsoArchivio('Comuni.dat'), dati);
      this.dati.archivi.comuni = 'Comuni.dat';
      this.comuni = c;
      this.fonteComuni = `${t.nome} importato`;
      righe.push(`Comuni: ${c.length.toLocaleString('it-IT')} (da ${t.nome})`);
    }
    for (const t of trovati.filter((x) => x.info.tipo === 'setup')) {
      if (!this.dati.tecnico.cognome && !this.dati.tecnico.codiceFiscale) {
        try { await this.leggiSetupDocfa(t.percorso); righe.push(`Tecnico letto da ${t.nome}`); } catch (e) { avvisi.push(`${t.nome}: ${e instanceof Error ? e.message : String(e)}`); }
      } else righe.push(`${t.nome} trovato: i dati del tecnico già presenti non sono stati sovrascritti`);
    }

    // archivi provinciali, raggruppati per provincia
    const perProvincia = new Map<string, typeof trovati>();
    for (const t of trovati) {
      if (!t.info.provincia) continue;
      const l = perProvincia.get(t.info.provincia) ?? [];
      l.push(t);
      perProvincia.set(t.info.provincia, l);
    }
    const strade = { ...this.strade }, tariffe = { ...this.tariffe }, zone = { ...this.zone }, classamento = { ...this.classamento };
    for (const [prov, files] of perProvincia) {
      // attenzione: l'oggetto va ripreso dall'array reattivo dopo il push, altrimenti si modifica una copia
      if (!this.dati.archivi.provinciali.some((p) => p.provincia === prov)) this.dati.archivi.provinciali.push({ provincia: prov });
      const voce = this.dati.archivi.provinciali.find((p) => p.provincia === prov)!;
      const parti: string[] = [];
      const nuoviClassamento: string[] = [];
      let righeClassamento = 0;
      for (const t of files) {
        const dati = await leggiFile(t.percorso);
        const rel = `${prov}/${t.nome}`;
        try {
          switch (t.info.tipo) {
            case 'stradario': {
              const s = leggiStradario(dati);
              if (!s.length) throw new Error('nessuna strada letta');
              await scriviFile(this.percorsoArchivio(rel), dati);
              voce.stradario = rel; strade[prov] = s;
              parti.push(`${s.length.toLocaleString('it-IT')} strade`);
              break;
            }
            case 'tariffe': {
              const tr = leggiTariffe(dati);
              if (!tr.length) throw new Error('nessuna tariffa letta');
              await scriviFile(this.percorsoArchivio(rel), dati);
              voce.tariffe = rel; tariffe[prov] = tr;
              parti.push(`${tr.length.toLocaleString('it-IT')} tariffe`);
              break;
            }
            case 'zone': {
              const z = leggiZone(dati);
              if (!z.length) throw new Error('nessuna zona letta');
              await scriviFile(this.percorsoArchivio(rel), dati);
              voce.zone = rel; zone[prov] = z;
              parti.push(`${z.length.toLocaleString('it-IT')} fogli/zone`);
              break;
            }
            case 'classamento': {
              await scriviFile(this.percorsoArchivio(rel), dati);
              nuoviClassamento.push(rel);
              righeClassamento += contaRighe(dati);
              break;
            }
          }
        } catch (e) {
          avvisi.push(`${t.nome}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (nuoviClassamento.length) {
        voce.classamento = nuoviClassamento.sort();
        classamento[prov] = righeClassamento;
        parti.push(`${nuoviClassamento.length} prospetti di classamento`);
      }
      voce.importato = oggi;
      const comuniProv = this.comuni.filter((c) => c.provincia === prov).length;
      righe.push(`${prov}: ${parti.join(', ') || 'nessun file valido'}${comuniProv ? ` · ${comuniProv} comuni in provincia` : ''}`);
      const mancanti = (['stradario', 'tariffe', 'zone'] as const).filter((k) => !voce[k]);
      if (mancanti.length) avvisi.push(`${prov}: mancano ${mancanti.join(', ')}`);
    }
    this.strade = strade; this.tariffe = tariffe; this.zone = zone; this.classamento = classamento;
    await this.salva();
    return { righe, avvisi };
  }

  /** Torna all'elenco dei comuni incorporato (elimina il Comuni.dat importato). */
  async usaComuniIncorporati(): Promise<void> {
    if (this.dati.archivi.comuni) { try { await eliminaFile(this.percorsoArchivio(this.dati.archivi.comuni)); } catch { /* ignora */ } }
    this.dati.archivi.comuni = undefined;
    await this.caricaArchivi();
    await this.salva();
  }

  async rimuoviProvincia(provincia: string): Promise<void> {
    const voce = this.dati.archivi.provinciali.find((p) => p.provincia === provincia);
    if (!voce) return;
    for (const n of [voce.stradario, voce.tariffe, voce.zone, ...(voce.classamento ?? [])]) if (n) { try { await eliminaFile(this.percorsoArchivio(n)); } catch { /* ignora */ } }
    this.dati.archivi.provinciali = this.dati.archivi.provinciali.filter((p) => p.provincia !== provincia);
    const senza = <T,>(r: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(r).filter(([k]) => k !== provincia));
    this.strade = senza(this.strade);
    this.tariffe = senza(this.tariffe);
    this.zone = senza(this.zone);
    this.classamento = senza(this.classamento);
    await this.salva();
  }

  /** Precompila il tecnico da SETUP.DAT di Docfa. */
  async leggiSetupDocfa(percorso: string): Promise<void> {
    const s = leggiSetup(await leggiFile(percorso));
    if (!s.cognome && !s.codiceFiscale) throw new Error('SETUP.DAT non contiene i dati del tecnico');
    this.dati.tecnico = { cognome: s.cognome, nome: s.nome, codiceFiscale: s.codiceFiscale, albo: s.albo || '03', numeroIscrizione: s.numeroIscrizione, provinciaAlbo: s.provinciaAlbo };
    await this.salva();
  }

  /** Nomi dei file presenti nella cartella archivi (per diagnostica). */
  async fileArchivi(): Promise<string[]> {
    try { return (await elencoFile(unisci(this.dir, 'archivi'))).map((v) => v.nome); } catch { return []; }
  }

  // --- ricerche

  comunePerCodiceAmministrativo(codice: string): Comune | undefined {
    return this.comuni.find((c) => c.codiceAmministrativo === codice);
  }

  comunePerCodice(codice: string): Comune | undefined {
    return this.comuni.find((c) => c.codice === codice);
  }

  cercaComuni(testo: string, limite = 20): Comune[] {
    const t = testo.trim().toUpperCase();
    if (!t) return [];
    const inizia = this.comuni.filter((c) => c.nome.startsWith(t));
    const contiene = inizia.length < limite ? this.comuni.filter((c) => !c.nome.startsWith(t) && (c.nome.includes(t) || c.codice === t)) : [];
    return [...inizia, ...contiene].slice(0, limite);
  }

  /** Strade del comune (per codice catastale), se lo stradario della provincia è importato. */
  stradeDelComune(comune: Comune | undefined): Strada[] {
    if (!comune) return [];
    const s = this.strade[comune.provincia];
    if (!s) return [];
    return s.filter((x) => x.codiceCatastale === comune.codice);
  }

  cercaStrade(comune: Comune | undefined, testo: string, limite = 20): Strada[] {
    const t = testo.trim().toLowerCase();
    if (!t) return [];
    const parole = t.split(/\s+/).filter(Boolean);
    return this.stradeDelComune(comune).filter((s) => parole.every((p) => s.toponimo.includes(p) || s.toponimoArchivio.toLowerCase().includes(p))).slice(0, limite);
  }

  /** Tariffa (lire) per comune/zona/categoria/classe, se l'archivio della provincia è importato. */
  tariffa(comune: Comune | undefined, zona: string, categoria: string, classe: string): Tariffa | undefined {
    if (!comune) return undefined;
    const t = this.tariffe[comune.provincia];
    if (!t) return undefined;
    const z = zona.trim().padStart(3, '0');
    const c = categoria.trim().toUpperCase().replace('/', '');
    const cl = classe.trim().toUpperCase().padStart(2, '0');
    return t.find((x) => x.codiceAmministrativo === comune.codiceAmministrativo && x.zona === z && x.categoria === c && x.classe === cl);
  }

  /** Zone, categorie e classi disponibili per un comune (dalle tariffe). */
  opzioniClassamento(comune: Comune | undefined): { zone: string[]; categorie: string[]; classi: (zona: string, categoria: string) => string[] } {
    const t = comune ? (this.tariffe[comune.provincia] ?? []).filter((x) => x.codiceAmministrativo === comune.codiceAmministrativo) : [];
    return {
      zone: [...new Set(t.map((x) => x.zona))].sort(),
      categorie: [...new Set(t.map((x) => x.categoria))].sort(),
      classi: (zona, categoria) => {
        const z = zona.trim().padStart(3, '0');
        const c = categoria.trim().toUpperCase().replace('/', '');
        return [...new Set(t.filter((x) => x.zona === z && x.categoria === c).map((x) => x.classe))].sort();
      },
    };
  }
}

export const impostazioni = new StatoImpostazioni();
