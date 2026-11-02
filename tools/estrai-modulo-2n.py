#!/usr/bin/env python3
"""
Estrae dal PDF reale NCV081 (Docfa 4.00.5, fixtures-private/NCV081.PDF) il modulo fisso delle tre pagine del
modello 2N (parte I pagina 1 e 2, parte II): il primo content stream di ogni pagina, identico in tutti i
documenti, e i due font sottoinsieme Liberation Serif (regolare e grassetto) che usa.

Il modulo 2N di Docfa è un'esportazione di LibreOffice con crenature (TJ), spessori di linea 0,82 e font con
codifica propria: ricostruirlo a mano dava spazi e posizioni leggermente diversi (confronto con la pratica BPM
del 02/11/2026). Copiandolo così com'è la pagina è identica a quella di Docfa.

Nel modulo i font si chiamano /F1 e /F2: qui diventano /M1 e /M2 per non urtare i font del generatore.
Il modulo contiene già «Ufficio Provinciale di», «Comune di», i due «: » e «pag. »: il generatore non li
ridisegna sulle pagine 2N.

Uso: python3 tools/estrai-modulo-2n.py  →  src/lib/core/pdf/assets/modulo2n.generated.ts
"""
import base64
import os
import re

import pikepdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORGENTE = os.path.join(ROOT, 'fixtures-private', 'NCV081.PDF')
OUT = os.path.join(ROOT, 'src', 'lib', 'core', 'pdf', 'assets', 'modulo2n.generated.ts')
PAGINE = {'2N-I-1': 29, '2N-I-2': 30, '2N-II': 31}


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode('ascii')


def valore(v) -> str:
    """Valore PDF diretto (niente riferimenti) come testo."""
    if isinstance(v, pikepdf.Array):
        return '[' + ' '.join(valore(x) for x in v) + ']'
    if isinstance(v, pikepdf.Name):
        return str(v)
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float, pikepdf.Object)) and not isinstance(v, pikepdf.Dictionary):
        s = str(v)
        return s
    raise ValueError(f'valore non gestito: {v!r}')


def main() -> None:
    pdf = pikepdf.open(SORGENTE)
    moduli = {}
    font = {}
    for nome, n in PAGINE.items():
        pg = pdf.pages[n - 1]
        contenuti = pg.obj.Contents
        primo = (list(contenuti) if isinstance(contenuti, pikepdf.Array) else [contenuti])[0].read_bytes()
        primo = re.sub(rb'/F([12])(?=[\s/\[<(])', rb'/M\1', primo)
        moduli[nome] = primo
        for k in ('/F1', '/F2'):
            f = pg.obj.Resources.Font[k]
            nome_font = 'M' + k[2:]
            if nome_font in font:
                continue
            fd = f.FontDescriptor
            ff = fd.FontFile2
            font[nome_font] = dict(
                font=' '.join(f'{kk} {valore(vv)}' for kk, vv in f.items() if kk not in ('/FontDescriptor', '/ToUnicode')),
                descrittore=' '.join(f'{kk} {valore(vv)}' for kk, vv in fd.items() if kk != '/FontFile2'),
                fontFile=ff.read_bytes(),
                length1=int(ff.stream_dict.get('/Length1', len(ff.read_bytes()))),
                toUnicode=f.ToUnicode.read_bytes(),
            )
    righe = [
        '// GENERATO da tools/estrai-modulo-2n.py dal PDF Docfa 4.00.5 NCV081 (pagine 29-31). Non modificare a mano.',
        '// Modulo fisso delle pagine del 2N e font Liberation Serif sottoinsieme (licenza in LICENSE-LiberationFonts.txt).',
        'export const MODULO_2N: Record<string, string> = {',
    ]
    for nome, b in moduli.items():
        righe.append(f"  '{nome}': '{b64(b)}',")
    righe.append('};')
    righe.append('export interface FontModulo { font: string; descrittore: string; fontFile: string; length1: number; toUnicode: string }')
    righe.append('export const FONT_MODULO_2N: Record<string, FontModulo> = {')
    for nome, f in font.items():
        righe.append(f"  {nome}: {{ font: {f['font']!r}, descrittore: {f['descrittore']!r}, fontFile: '{b64(f['fontFile'])}', length1: {f['length1']}, toUnicode: '{b64(f['toUnicode'])}' }},")
    righe.append('};')
    with open(OUT, 'w') as fh:
        fh.write('\n'.join(righe) + '\n')
    print('scritto', OUT, {k: len(v) for k, v in moduli.items()}, {k: len(v['fontFile']) for k, v in font.items()})


if __name__ == '__main__':
    main()
