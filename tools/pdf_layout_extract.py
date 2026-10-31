#!/usr/bin/env python3
"""
Estrae dai PDF reali prodotti da Docfa 4 il layout dei modelli (1N parte I e II, 2N parte I e II)
e lo salva come JSON in src/lib/core/pdf/layout/.

Ogni pagina dei modelli nel PDF di Docfa è composta da più content stream: i primi contengono il
"modulo" (testi fissi, righe, caselle di spunta) identico in tutti i documenti, gli ultimi i valori
compilati (in grassetto) e il numero di pagina. Il tool:
  1. interpreta gli stream del modulo e produce la lista dei "fissi" (testi, righe, caselle);
  2. aggiunge la lista dei "campi" (posizione in cui Docfa stampa ogni valore) definita a mano nella
     tabella MAPPATURE qui sotto, verificata sulle posizioni osservate nei PDF reali;
  3. scrive il JSON.

Uso:
  python3 tools/pdf_layout_extract.py --elenca 1N-I-1   # elenca caselle e testi "____" per fare la mappatura
  python3 tools/pdf_layout_extract.py --dinamici 1N-I-1 # unione delle posizioni dei valori nei PDF reali
  python3 tools/pdf_layout_extract.py                   # genera tutti i JSON

I PDF di riferimento sono in fixtures-private/ (dati riservati: nel JSON finiscono solo i testi fissi del modulo).
"""
import json
import os
import re
import sys
from collections import OrderedDict

import pikepdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, 'fixtures-private')
OUT = os.path.join(ROOT, 'src', 'lib', 'core', 'pdf', 'layout')

MM = 72 / 25.4
LATO_CASELLA = 8.504  # 3 mm

# ---------------------------------------------------------------------------
# Parser minimale dei content stream (solo gli operatori usati da Docfa)
# ---------------------------------------------------------------------------

def tokenize(data: str):
    toks = []
    i = 0
    n = len(data)
    while i < n:
        c = data[i]
        if c in ' \t\r\n\x00\x0c':
            i += 1
            continue
        if c == '%':
            j = data.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '(':
            depth = 1
            i += 1
            s = ''
            while i < n and depth > 0:
                ch = data[i]
                if ch == '\\':
                    nx = data[i + 1]
                    if nx in '01234567':
                        m = re.match(r'[0-7]{1,3}', data[i + 1:i + 4])
                        s += chr(int(m.group(0), 8))
                        i += 1 + len(m.group(0))
                        continue
                    s += {'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f'}.get(nx, nx)
                    i += 2
                    continue
                if ch == '(':
                    depth += 1
                if ch == ')':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                s += ch
                i += 1
            toks.append(('str', s))
            continue
        if c == '<' and data[i + 1] != '<':
            j = data.find('>', i)
            h = re.sub(r'\s', '', data[i + 1:j])
            toks.append(('str', bytes.fromhex(h).decode('cp1252', 'replace')))  # stringhe esadecimali (testi con accenti)
            i = j + 1
            continue
        if c == '/':
            m = re.match(r'/[^\s/\[\]()<>{}%]*', data[i:])
            toks.append(('name', m.group(0)))
            i += len(m.group(0))
            continue
        if c in '[]':
            toks.append(('op', c))
            i += 1
            continue
        if c == '<':
            toks.append(('op', '<<'))
            i += 2
            continue
        if c == '>':
            toks.append(('op', '>>'))
            i += 2
            continue
        m = re.match(r'[+-]?(\d+\.?\d*|\.\d+)', data[i:])
        if m:
            toks.append(('num', float(m.group(0))))
            i += len(m.group(0))
            continue
        m = re.match(r'[A-Za-z\'"*]+', data[i:])
        if m:
            toks.append(('op', m.group(0)))
            i += len(m.group(0))
            continue
        i += 1
    return toks


def parse(data: str):
    """Restituisce item ('text', x, y, font, size, testo) e ('line', x1, y1, x2, y2, w)."""
    toks = tokenize(data)
    items = []
    stack = []
    font = None
    size = 0
    lx = ly = tx = ty = 0.0
    w = 1.0
    path = []
    for t in toks:
        if t[0] != 'op':
            stack.append(t)
            continue
        op = t[1]
        args = [a[1] for a in stack]
        stack = []
        if op == 'Tf':
            font, size = args[0], args[1]
        elif op == 'Td':
            lx += args[0]
            ly += args[1]
            tx, ty = lx, ly
        elif op == 'Tm':
            lx, ly = args[4], args[5]
            tx, ty = lx, ly
        elif op == 'BT':
            lx = ly = tx = ty = 0.0
        elif op == 'Tj' and isinstance(args[-1], str):
            items.append(('text', round(tx, 3), round(ty, 3), font, size, args[-1]))
        elif op == 'w':
            w = args[0]
        elif op == 'm':
            path = [(args[0], args[1])]
        elif op == 'l':
            path.append((args[0], args[1]))
        elif op == 're':
            path = []
        elif op in ('S', 's', 'f', 'B', 'b', 'f*', 'n'):
            if op == 'S' and len(path) >= 2:
                for a, b in zip(path, path[1:]):
                    items.append(('line', round(a[0], 3), round(a[1], 3), round(b[0], 3), round(b[1], 3), w))
            path = []
    return items


def stream_di_pagina(pdf, n_pagina):
    p = pdf.pages[n_pagina - 1]
    c = p.Contents
    parts = [c] if not isinstance(c, pikepdf.Array) else list(c)
    return [x.read_bytes().decode('cp1252', 'replace') for x in parts]


# ---------------------------------------------------------------------------
# Riconoscimento delle caselle di spunta
# ---------------------------------------------------------------------------

def trova_caselle(items):
    """Casella: quadrato di 8,504 pt con tratto 0 (hairline) più ombra (tratto 1, spostata di 0,85 in basso a destra)."""
    segs = [it for it in items if it[0] == 'line' and it[5] < 0.5]
    inizio = {}
    for s in segs:
        inizio.setdefault((s[1], s[2]), []).append(s)
    caselle = set()
    for s in segs:
        x1, y1, x2, y2 = s[1:5]
        if abs(x1 - x2) < 0.01 and abs((y2 - y1) - LATO_CASELLA) < 0.25 and y2 > y1:
            top = [t for t in inizio.get((x1, y2), []) if abs(t[4] - y2) < 0.01 and abs((t[3] - x1) - LATO_CASELLA) < 0.25]
            if top:
                caselle.add((round(x1, 3), round(y1, 3)))
    return sorted(caselle, key=lambda b: (-b[1], b[0]))


def e_segmento_di_casella(seg, caselle):
    x1, y1, x2, y2, w = seg[1:6]
    for (cx, cy) in caselle:
        # lati del quadrato (tratto 0) e ombra (tratto ~1 spostata di 0,85)
        for dx, dy in ((0, 0), (0.85, -0.85)):
            bx, by = cx + dx, cy + dy
            pts = {(round(bx, 1), round(by, 1)), (round(bx + LATO_CASELLA, 1), round(by, 1)),
                   (round(bx, 1), round(by + LATO_CASELLA, 1)), (round(bx + LATO_CASELLA, 1), round(by + LATO_CASELLA, 1))}
            if (round(x1, 1), round(y1, 1)) in pts and (round(x2, 1), round(y2, 1)) in pts:
                return True
    return False


# ---------------------------------------------------------------------------
# Testi fissi delle pagine 2N (modulo esportato da LibreOffice con font subset): pdfplumber
# ---------------------------------------------------------------------------

def testi_pdfplumber(path, n_pagina):
    """Ricostruisce le sequenze di testo (Tj/TJ) dai caratteri in ordine di content stream."""
    import pdfplumber
    out = []
    with pdfplumber.open(path) as pdf:
        p = pdf.pages[n_pagina - 1]
        corrente = None
        for c in p.chars:
            if 'Liberation' not in c['fontname']:
                continue  # i valori compilati usano Times: non fanno parte del modulo
            font = 'B' if 'Bold' in c['fontname'] else 'R'
            size = round(c['size'], 1)
            y = round(p.height - c['bottom'] + 0.2163 * size, 3)  # baseline = fondo + |descent|
            # gli scostamenti piccoli sono crenature (kerning) dell'esportazione LibreOffice: restano nella stessa sequenza
            if corrente and corrente['font'] == font and corrente['size'] == size and abs(corrente['y'] - y) < 0.5 \
                    and abs(c['x0'] - corrente['x1']) < 2.5:
                corrente['testo'] += c['text']
                corrente['x1'] = c['x1']
            else:
                if corrente:
                    out.append(corrente)
                corrente = dict(font=font, size=size, y=y, x0=round(c['x0'], 3), x1=c['x1'], testo=c['text'])
        if corrente:
            out.append(corrente)
    return [('text', r['x0'], r['y'], r['font'], r['size'], r['testo'].rstrip()) for r in out if r['testo'].strip()]


# ---------------------------------------------------------------------------
# Definizione delle pagine
# ---------------------------------------------------------------------------

def font_rb(nome):
    return 'B' if nome in ('/F1', '/T1_1', '/Fcpdf1', '/Arial2', '/F3', '/F4', '/F2') else 'R'


PAGINE = OrderedDict([
    # nome: (file, pagina, indici stream del modulo, usa pdfplumber per i testi, pagine da cui unire i valori dinamici)
    ('1N-I-1', dict(file='NCV002.PDF', pagina=2, modulo=range(0, 8), plumber=False,
                    dinamici=[('NCV002.PDF', 2, [8]), ('NCV059.PDF', 2, [8]), ('NCV065.PDF', 2, [8]), ('NCV081.PDF', 3, [8])])),
    ('1N-I-2', dict(file='NCV002.PDF', pagina=3, modulo=range(0, 2), plumber=False,
                    dinamici=[('NCV002.PDF', 3, [2]), ('NCV059.PDF', 3, [2]), ('NCV065.PDF', 3, [2]), ('NCV081.PDF', 4, [2])])),
    ('1N-II-1', dict(file='NCV002.PDF', pagina=4, modulo=range(0, 1), plumber=False,
                     dinamici=[('NCV002.PDF', 4, [1]), ('NCV059.PDF', 4, [1]), ('NCV065.PDF', 4, [1])] + [('NCV081.PDF', p, [1]) for p in range(5, 29, 2)])),
    ('1N-II-2', dict(file='NCV002.PDF', pagina=5, modulo=range(0, 2), plumber=False,
                     dinamici=[('NCV002.PDF', 5, [2]), ('NCV059.PDF', 5, [2]), ('NCV065.PDF', 5, [2])] + [('NCV081.PDF', p, [2]) for p in range(6, 29, 2)])),
    ('2N-I-1', dict(file='NCV081.PDF', pagina=29, modulo=range(0, 5), plumber=True, dinamici=[('NCV081.PDF', 29, [5])])),
    ('2N-I-2', dict(file='NCV081.PDF', pagina=30, modulo=range(0, 2), plumber=True, dinamici=[('NCV081.PDF', 30, [2])])),
    ('2N-II', dict(file='NCV081.PDF', pagina=31, modulo=range(0, 5), plumber=True, dinamici=[('NCV081.PDF', 31, [5])])),
])

# testi di intestazione/piè di pagina comuni a tutte le pagine: li disegna il renderer, non il layout
TESTI_COMUNI = {'Ufficio Provinciale di', ': ', 'Comune di ', 'Comune di:', 'Ufficio Provinciale di:', 'pag. ', 'pag.'}


def carica_modulo(nome):
    cfg = PAGINE[nome]
    path = os.path.join(FIX, cfg['file'])
    pdf = pikepdf.open(path)
    streams = stream_di_pagina(pdf, cfg['pagina'])
    items = parse('\n'.join(streams[i] for i in cfg['modulo']))
    if cfg['plumber']:
        items = [it for it in items if it[0] != 'text'] + testi_pdfplumber(path, cfg['pagina'])
    else:
        items = [(it[0], it[1], it[2], font_rb(it[3]), it[4], it[5]) if it[0] == 'text' else it for it in items]
    return items


def valori_dinamici(nome):
    cfg = PAGINE[nome]
    pos = OrderedDict()
    for file, pagina, idx in cfg['dinamici']:
        pdf = pikepdf.open(os.path.join(FIX, file))
        streams = stream_di_pagina(pdf, pagina)
        for it in parse('\n'.join(streams[i] for i in idx)):
            if it[0] != 'text' or it[2] < 30 or it[2] > 770:
                continue
            pos.setdefault((it[1], it[2]), []).append(it[5])
    return pos


# ---------------------------------------------------------------------------
# Mappatura campi (posizioni dei valori). "F" = flag (X nella casella n), "T" = testo.
# Le posizioni dei testi sono quelle osservate nei PDF reali; per i campi mai valorizzati nei PDF
# disponibili la posizione è stimata dall'inizio dei trattini "____" del modulo.
# ---------------------------------------------------------------------------

def T(id, x, y, len=None, **kw):
    d = dict(id=id, tipo='T', x=x, y=y)
    if len is not None:
        d['len'] = len
    d.update(kw)
    return d


def F(id, casella, **kw):
    d = dict(id=id, tipo='F', casella=casella)
    d.update(kw)
    return d


MAPPATURE = {}
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf_layout_mappature.py'), encoding='utf-8').read())


def genera(nome):
    items = carica_modulo(nome)
    caselle = trova_caselle(items)
    testi = [it for it in items if it[0] == 'text' and it[5].strip() not in TESTI_COMUNI and 30 < it[2] < 770]
    linee = [it for it in items if it[0] == 'line' and not e_segmento_di_casella(it, caselle)
             and not (it[1] == it[3] and it[2] == it[4])]
    # righe duplicate (Docfa ridisegna più volte gli stessi bordi)
    viste = set()
    linee_u = []
    for l in linee:
        k = (min(l[1], l[3]), min(l[2], l[4]), max(l[1], l[3]), max(l[2], l[4]), round(l[5], 2))
        if k in viste:
            continue
        viste.add(k)
        linee_u.append(k)
    fissi = []
    for t in testi:
        fissi.append(['T', t[1], t[2], t[3], t[4], t[5]])
    for l in linee_u:
        fissi.append(['L', l[0], l[1], l[2], l[3], 1 if l[4] > 0.5 else 0])
    for c in caselle:
        fissi.append(['C', c[0], c[1]])
    campi = []
    for m in MAPPATURE.get(nome, []):
        m = dict(m)
        if m['tipo'] == 'F':
            c = caselle[m.pop('casella')]
            m['x'] = round(c[0] + 0.567, 3)
            m['y'] = round(c[1] + 1.417, 3)
        campi.append(m)
    return dict(nome=nome, larghezza=595, altezza=836, fissi=fissi, campi=campi)


def elenca(nome):
    items = carica_modulo(nome)
    caselle = trova_caselle(items)
    testi = [it for it in items if it[0] == 'text']

    def etichette(c):
        x, y = c
        riga = [t for t in testi if abs(t[2] - (y + 1.4)) < 3.5 and t[5].strip()]
        dx = sorted([t for t in riga if t[1] > x], key=lambda t: t[1])
        sx = sorted([t for t in riga if t[1] < x], key=lambda t: -t[1])
        return (dx[0][5].strip() if dx else ''), (sx[0][5].strip() if sx else '')

    print(len(caselle), 'caselle')
    for i, c in enumerate(caselle):
        d, s = etichette(c)
        print(f'{i:3d} {c} | dx: {d!r} | sx: {s!r}')
    print('--- testi con ____')
    for t in testi:
        if '__' in t[5]:
            print((t[1], t[2]), t[3], repr(t[5]))


def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--elenca':
        elenca(sys.argv[2])
        return
    if len(sys.argv) > 2 and sys.argv[1] == '--dinamici':
        pos = valori_dinamici(sys.argv[2])
        for k in sorted(pos, key=lambda k: (-k[1], k[0])):
            print(k, len(pos[k]), pos[k][:4])
        return
    os.makedirs(OUT, exist_ok=True)
    for nome in PAGINE:
        lay = genera(nome)
        with open(os.path.join(OUT, nome + '.json'), 'w', encoding='utf-8') as f:
            json.dump(lay, f, ensure_ascii=False, separators=(',', ':'))
        print(nome, len(lay['fissi']), 'fissi', len(lay['campi']), 'campi')


if __name__ == '__main__':
    main()
