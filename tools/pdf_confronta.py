#!/usr/bin/env python3
"""
Confronta pagina per pagina i testi di due PDF (originale Docfa e rigenerato): per ogni pagina elenca
i testi presenti in uno solo dei due (posizione arrotondata al decimo di punto, font R/B, dimensione,
stringa). Serve a verificare le mappature dei campi dei modelli 1N/2N.

Uso: python3 tools/pdf_confronta.py ORIGINALE.pdf NOSTRO.pdf [--pagine 2-5] [--solo-grassetto] [--json]
Esce con 0 se non ci sono differenze (a parte piè di pagina e intestazione, esclusi dal confronto).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pikepdf  # noqa: E402
from pdf_layout_extract import parse, stream_di_pagina  # noqa: E402

GRASSETTO = {'/F1', '/T1_1', '/Fcpdf1', '/Arial2', '/F3', '/F4', '/F2'}


def testi_pagina(pdf, n, solo_grassetto):
    p = pdf.pages[n - 1]
    font_bold = set()
    for nome, f in p.Resources.get('/Font', {}).items():
        base = str(f.get('/BaseFont', ''))
        if 'Bold' in base:
            font_bold.add(nome)
    items = parse('\n'.join(stream_di_pagina(pdf, n)))
    out = []
    for it in items:
        if it[0] != 'text':
            continue
        x, y, font, size, s = it[1:]
        if y < 30 or y > 770:
            continue  # piè di pagina e intestazione
        bold = font in font_bold
        if solo_grassetto and not bold:
            continue
        if not s.strip() or any(ord(ch) < 32 for ch in s):
            continue  # vuoti e codici glifo dei font subset (modulo 2N)
        out.append((round(x, 1), round(y, 1), 'B' if bold else 'R', size, s.rstrip()))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('originale')
    ap.add_argument('nostro')
    ap.add_argument('--pagine', default=None, help='es. 2-5 oppure 3')
    ap.add_argument('--solo-grassetto', action='store_true')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--ignora-fissi', action='store_true', help='esclude i testi fissi dei layout (titoli dei moduli 2N, che nei PDF originali usano font subset non letti dal parser)')
    a = ap.parse_args()
    fissi = set()
    if a.ignora_fissi:
        cartella = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'lib', 'core', 'pdf', 'layout')
        for nome in os.listdir(cartella):
            if nome.endswith('.json'):
                with open(os.path.join(cartella, nome), encoding='utf-8') as f:
                    for it in json.load(f)['fissi']:
                        if it[0] == 'T':
                            fissi.add((round(it[1], 1), round(it[2], 1), it[5].strip()))
    o = pikepdf.open(a.originale)
    m = pikepdf.open(a.nostro)
    n = min(len(o.pages), len(m.pages))
    if a.pagine:
        if '-' in a.pagine:
            da, al = [int(x) for x in a.pagine.split('-')]
        else:
            da = al = int(a.pagine)
    else:
        da, al = 1, n
    risultato = {}
    for pg in range(da, al + 1):
        to = testi_pagina(o, pg, a.solo_grassetto)
        tm = testi_pagina(m, pg, a.solo_grassetto)

        def chiave(t):
            return (t[0], t[1], t[2], t[4].strip())

        so = {chiave(t) for t in to if (round(t[0], 1), round(t[1], 1), t[4].strip()) not in fissi}
        sm = {chiave(t) for t in tm if (round(t[0], 1), round(t[1], 1), t[4].strip()) not in fissi}

        def vicino(t, insieme):
            # tolleranza di 0,15 pt sulle coordinate (arrotondamenti diversi)
            return any(abs(t[0] - u[0]) <= 0.15 and abs(t[1] - u[1]) <= 0.15 and t[2] == u[2] and t[3] == u[3] for u in insieme)

        solo_o = sorted([t for t in so if not vicino(t, sm)], key=lambda t: (-t[1], t[0]))
        solo_m = sorted([t for t in sm if not vicino(t, so)], key=lambda t: (-t[1], t[0]))
        if solo_o or solo_m:
            risultato[pg] = {'solo_originale': solo_o, 'solo_nostro': solo_m}
    if a.json:
        print(json.dumps(risultato, ensure_ascii=False))
    else:
        for pg, d in risultato.items():
            print(f'=== pagina {pg}')
            for t in d['solo_originale']:
                print('  - originale:', t)
            for t in d['solo_nostro']:
                print('  + nostro:   ', t)
        if not risultato:
            print('nessuna differenza')
    sys.exit(1 if risultato else 0)


if __name__ == '__main__':
    main()
