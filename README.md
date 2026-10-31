# Fa.Catasto.Doc

Programma indipendente e open source per compilare i documenti di aggiornamento del Catasto
Fabbricati (dichiarazioni di nuova costruzione e di variazione) e produrre il **PDF/A da presentare
all'Agenzia delle Entrate**, nello stesso formato prodotto da Docfa 4.

Fa.Catasto.Doc **non è un software dell'Agenzia delle Entrate** e non è affiliato a Sogei:
è un'alternativa sviluppata da un geometra per i geometri. Docfa è il nome del programma
ufficiale dell'Agenzia.

> **Nessuna garanzia.** Fa.Catasto.Doc è software libero distribuito **così com'è**, senza alcuna
> garanzia, nemmeno implicita di commerciabilità o di idoneità a uno scopo particolare (vedi `LICENSE`,
> sezioni 15 e 16). Il professionista resta l'unico responsabile dei documenti che firma e presenta.
> Prima della presentazione si consiglia di importare il documento nel Docfa ufficiale e di eseguirne
> il controllo formale.

## Scaricare

Gli eseguibili per Windows, macOS e Linux sono nella pagina
[Releases](https://github.com/Brix1965/fa-catasto-doc/releases/latest) («ultima versione»),
aggiornata automaticamente a ogni modifica.

### Installazione

Gli eseguibili non sono firmati con un certificato a pagamento: al primo avvio il sistema chiede una conferma.

**macOS (Apple Silicon)** — `FaCatastoDoc-macOS-AppleSilicon.dmg`
1. Apri il `.dmg` e trascina **Fa.Catasto.Doc** nella cartella **Applicazioni**.
2. Apri il **Terminale** e scrivi (dopo ogni installazione o aggiornamento):
   `xattr -cr "/Applications/Fa.Catasto.Doc.app"`
3. Avvia Fa.Catasto.Doc normalmente.

In alternativa al Terminale: prova ad aprire l'app, poi **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque**.

**Windows** — `FaCatastoDoc-Windows-portatile.exe` (nessuna installazione), oppure l'installer o il `.msi`
- Se compare «Windows ha protetto il PC»: **Ulteriori informazioni → Esegui comunque**.

**Linux** — `FaCatastoDoc-Linux.AppImage` oppure `FaCatastoDoc-Linux.deb`
- AppImage: `chmod +x FaCatastoDoc-Linux.AppImage` e poi avviarlo con doppio clic o `./FaCatastoDoc-Linux.AppImage`.
- Pacchetto per Debian/Ubuntu: `sudo apt install ./FaCatastoDoc-Linux.deb`.

## Sostieni il progetto

Fa.Catasto.Doc è gratuito e lo resterà. Se ti è utile puoi contribuire allo sviluppo con una
donazione: [PayPal](https://paypal.me/lombardoconsulting).

## Cosa fa

- compila il modello D1 (quadri B, U, D), i modelli 1N parte I e II, 2N parte I e II, i dati metrici
  (DPR 138/98) e l'elenco subalterni dell'elaborato planimetrico;
- importa la planimetria da un **DXF** (riquadro dell'Agenzia, layer `DOCFA_POLIGONI` per i poligoni)
  e genera l'immagine della scheda con cartiglio e i poligoni per il calcolo della superficie catastale;
- usa gli archivi ufficiali dell'Agenzia (comuni, stradari, tariffe) importandoli dai file distribuiti
  per provincia, così i dati restano identici a quelli di Docfa;
- calcola la rendita dalle tariffe d'estimo;
- esporta il **PDF/A-1b** con i modelli, le planimetrie e i dati nascosti nelle annotazioni, cioè il file
  che si firma digitalmente e si invia tramite Sister;
- **importa un PDF prodotto da Docfa** e lo rende modificabile.

Il motore è verificato su documenti reali: i file dati rigenerati dal programma sono identici byte
per byte a quelli prodotti da Docfa 4.00.5.

## Piattaforme

Un solo eseguibile, senza installazione, per **Windows**, **Linux** e **macOS** (Tauri 2).
Nessun server: tutto resta sul computer del professionista.

## Sviluppo

```
pnpm install
pnpm dev            # interfaccia nel browser (Chrome/Edge per l'accesso alle cartelle)
pnpm tauri dev      # applicazione desktop
npx vitest run      # test del motore
pnpm check          # svelte-check
pnpm tauri build    # pacchetti per la piattaforma corrente
```

I test di fedeltà con i documenti reali leggono i campioni dalla cartella `fixtures-private/`
(non inclusa nel repository perché contiene dati personali); senza quella cartella vengono saltati.
I dati di prova inclusi nel repository sono anonimizzati.

## Struttura

- `src/lib/core/tracciati/` — tracciati record Docfa 4 (versione D3) e codifica a lunghezza fissa
- `src/lib/core/compile.ts`, `decompile.ts` — pratica ⇄ record (NCV, NMV, ATT, EPV)
- `src/lib/core/ntf.ts` — poligoni delle planimetrie (formato NTF)
- `src/lib/core/raster/` — DXF → immagine TIFF CCITT G4 con cartiglio
- `src/lib/core/pdf/` — generazione e lettura del PDF/A
- `src/lib/core/archivi.ts` — archivi dell'Agenzia (comuni, stradari, tariffe)
- `src/lib/ui/`, `src/routes/` — interfaccia (Svelte 5 + Tailwind)
- `src-tauri/` — involucro desktop

## Licenza

GNU General Public License v3.0 (vedi `LICENSE`). I font Liberation Serif inclusi sono distribuiti
con licenza SIL OFL; il profilo colore sRGB con la licenza dell'International Color Consortium.
