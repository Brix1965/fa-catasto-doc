#!/usr/bin/env python3
"""Genera src/lib/core/dati/docfa-tabelle.generated.ts dai dati estratti da Docfa 4.00.5 (tools/dati-docfa/*.json).

I JSON sono stati ricavati dall'help in linea (cartella HTML) e dalle librerie del programma (cartella PGM):
  errori-catalogo.json  codice diagnostico -> {t: titolo, d: spiegazione dell'help}
  destinazioni-1n.json  [categoria, destinazione d'uso] proposte nel 1N parte II
  destinazioni-de.json  categoria D/E -> [[codice, descrizione]]
"""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'dati-docfa')
cat = json.load(open(os.path.join(src, 'errori-catalogo.json')))
d1n = json.load(open(os.path.join(src, 'destinazioni-1n.json')))
dde = json.load(open(os.path.join(src, 'destinazioni-de.json')))

# titoli (NZC000.lbr): codice, descrizione, flag "Q" = quota obbligatoria (gli altri la ammettono facoltativa)
TITOLI = [('01 ', 'Proprietà', 1), ('01S', 'Proprietà superficiaria', 1), ('01T', "Proprietà per l'area", 0),
          ('02 ', 'Nuda proprietà', 1), ('02S', 'Nuda proprietà superficiaria', 1), ('03 ', 'Abitazione', 0),
          ('03S', 'Abitazione su proprietà superficiaria', 0), ('04 ', 'Diritto del concedente', 1),
          ('05 ', "Diritto dell'enfiteuta", 1), ('06 ', 'Superficie', 0), ('07 ', 'Uso', 0),
          ('07S', 'Uso su proprietà superficiaria', 0), ('08 ', 'Usufrutto', 1),
          ('08A', 'Usufrutto con diritto di accrescimento', 1), ('08E', 'Usufrutto su enfiteusi', 1),
          ('08S', 'Usufrutto su proprietà superficiaria', 1), ('10 ', 'Oneri', 0)]

L = ["/**\n * Tabelle di Docfa 4.00.5 ricavate dall'help in linea e dai programmi del pacchetto (cartella PGM):\n"
     " * titoli di possesso, destinazioni d'uso del 1N parte II, destinazioni d'uso delle categorie D/E\n"
     " * e catalogo dei diagnostici del controllo formale.\n * File generato da tools/genera-tabelle-docfa.py: non modificare a mano.\n */\n"]
L.append("/** Titoli di possesso (quadro I). quotaObbligatoria: Docfa richiede la quota (flag Q); per gli altri è facoltativa. */")
L.append("export const TITOLI: { codice: string; descrizione: string; quotaObbligatoria: boolean }[] = [")
for c, d, q in TITOLI:
    L.append(f"  {{ codice: {json.dumps(c)}, descrizione: {json.dumps(d, ensure_ascii=False)}, quotaObbligatoria: {'true' if q else 'false'} }},")
L.append("];\n")
m = {}
for c, d in d1n:
    m.setdefault(c, []).append(d)
L.append("/** Destinazioni d'uso proposte nel 1N parte II (quadro F) per categoria. */")
L.append("export const DESTINAZIONI_1N: Record<string, string[]> = " + json.dumps(m, ensure_ascii=False, indent=1) + ";\n")
m3 = {}
for k, v in dde.items():
    k = k.replace('/', '')
    m3[k[0] + k[1:].zfill(2)] = [[a, b] for a, b in v]
L.append("/** Destinazioni d'uso ammesse per le categorie D ed E (quadro U), codice a 4 cifre. */")
L.append("export const DESTINAZIONI_DE: Record<string, [string, string][]> = " + json.dumps(m3, ensure_ascii=False, indent=1) + ";\n")
L.append("/** Diagnostici del controllo formale di Docfa: codice → titolo e, se presente nell'help, spiegazione. */")
L.append("export const DIAGNOSTICI: Record<string, { t: string; d?: string }> = {")
for k in sorted(cat):
    v = cat[k]
    e = {'t': v['t']}
    if v.get('d'):
        e['d'] = v['d']
    L.append(f"  {k}: {json.dumps(e, ensure_ascii=False)},")
L.append("};\n")
out = os.path.join(here, '..', 'src', 'lib', 'core', 'dati', 'docfa-tabelle.generated.ts')
open(out, 'w').write('\n'.join(L))
print('scritto', out)
