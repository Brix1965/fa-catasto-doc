#!/usr/bin/env python3
"""
Utilità Python usate dai test del generatore PDF (src/lib/core/pdf/__tests__): pikepdf, pypdfium2 e
Pillow fanno quello che in TypeScript non abbiamo (lettura di PDF arbitrari, rendering, decodifica CCITT).

Sottocomandi:
  estrai-g4 PDF PAGINA OUT        salva lo stream grezzo CCITT G4 dell'immagine /Im0 della pagina (1-based)
  verifica PDF                    stampa in JSON i controlli strutturali/PDF-A sul file
  annotazioni PDF CARTELLA        salva il contenuto di ogni annotazione di testo in CARTELLA/<nome>
  render PDF PAGINA OUT.png [SCALA]   renderizza una pagina con pypdfium2
  confronto-visivo ORIG NOSTRO PREFISSO [SCALA]   PNG affiancati pagina per pagina: PREFISSO<n>.png
"""
import json
import os
import subprocess
import sys


def estrai_g4(pdf_path, pagina, out):
    import pikepdf
    pdf = pikepdf.open(pdf_path)
    p = pdf.pages[int(pagina) - 1]
    xo = p.Resources.XObject['/Im0']
    assert str(xo.get('/Filter')) == '/CCITTFaxDecode', xo.get('/Filter')
    with open(out, 'wb') as f:
        f.write(xo.read_raw_bytes())
    print(json.dumps({'width': int(xo.Width), 'height': int(xo.Height), 'bytes': len(xo.read_raw_bytes())}))


def verifica(pdf_path):
    import pikepdf
    esito = {'errori': []}
    with open(pdf_path, 'rb') as f:
        testa = f.read(16)
        f.seek(-64, 2)
        coda = f.read()
    esito['header'] = testa[:8].decode('latin1')
    esito['eof'] = b'%%EOF' in coda
    try:
        r = subprocess.run(['qpdf', '--check', pdf_path], capture_output=True, text=True)
        esito['qpdf'] = r.returncode == 0
        if r.returncode != 0:
            esito['errori'].append('qpdf: ' + (r.stderr or r.stdout)[-500:])
    except FileNotFoundError:
        esito['qpdf'] = None
    pdf = pikepdf.open(pdf_path)
    esito['versione'] = pdf.pdf_version
    esito['pagine'] = len(pdf.pages)
    esito['cifrato'] = pdf.is_encrypted
    esito['id'] = '/ID' in pdf.trailer and len(pdf.trailer['/ID']) == 2
    root = pdf.Root
    meta = root.get('/Metadata')
    esito['xmp'] = None
    if meta is not None:
        xml = meta.read_bytes().decode('utf-8', 'replace')
        esito['xmp'] = {
            'part': 'pdfaid:part="1"' in xml,
            'conformance': 'pdfaid:conformance="B"' in xml,
            'filtrato': '/Filter' in meta,
            'producer_coerente': str(pdf.docinfo.get('/Producer', '')) in xml,
        }
    oi = root.get('/OutputIntents')
    esito['outputIntent'] = None
    if oi is not None and len(oi):
        o = oi[0]
        prof = o.get('/DestOutputProfile')
        esito['outputIntent'] = {
            'S': str(o.get('/S')),
            'N': int(prof.get('/N')) if prof is not None else None,
            'icc_bytes': len(prof.read_bytes()) if prof is not None else 0,
            'identifier': str(o.get('/OutputConditionIdentifier')),
        }
    font_non_incorporati = []
    font_visti = set()
    annots = []
    for i, p in enumerate(pdf.pages):
        for nome, f in p.Resources.get('/Font', {}).items():
            base = str(f.get('/BaseFont'))
            font_visti.add(base)
            fd = f.get('/FontDescriptor')
            if fd is None or not any(k in fd for k in ('/FontFile', '/FontFile2', '/FontFile3')):
                font_non_incorporati.append(base)
            else:
                if int(f.get('/FirstChar', -1)) != 32 or int(f.get('/LastChar', -1)) != 255 or len(f.get('/Widths', [])) != 224:
                    esito['errori'].append(f'font {base}: FirstChar/LastChar/Widths non coerenti')
                if str(f.get('/Encoding')) != '/WinAnsiEncoding':
                    esito['errori'].append(f'font {base}: encoding {f.get("/Encoding")}')
        for a in p.get('/Annots', []):
            annots.append({'pagina': i + 1, 'nome': str(a.get('/T')), 'subtype': str(a.get('/Subtype')), 'F': int(a.get('/F', 0)),
                           'rect': [float(x) for x in a.get('/Rect')], 'bytes': len(bytes(a.get('/Contents', b'')))})
        for nome, x in p.Resources.get('/XObject', {}).items():
            if str(x.get('/Subtype')) == '/Image' and str(x.get('/Filter')) == '/CCITTFaxDecode':
                dp = x.get('/DecodeParms')
                if dp is None or int(dp.get('/K', 0)) != -1 or int(dp.get('/Columns', 0)) != int(x.Width):
                    esito['errori'].append(f'immagine {nome} pagina {i + 1}: DecodeParms non coerenti')
    esito['font'] = sorted(font_visti)
    esito['fontNonIncorporati'] = sorted(set(font_non_incorporati))
    esito['annotazioni'] = annots
    esito['outline'] = []
    o = root.get('/Outlines')
    if o is not None and '/First' in o:
        def walk(n, d):
            while n is not None:
                esito['outline'].append((d, str(n.get('/Title'))))
                if '/First' in n:
                    walk(n['/First'], d + 1)
                n = n.get('/Next')
        walk(o['/First'], 0)
    esito['dimensioni'] = [[float(v) for v in p.MediaBox] for p in pdf.pages]
    print(json.dumps(esito, ensure_ascii=False))


def annotazioni(pdf_path, cartella):
    import pikepdf
    os.makedirs(cartella, exist_ok=True)
    pdf = pikepdf.open(pdf_path)
    out = []
    for i, p in enumerate(pdf.pages):
        for a in p.get('/Annots', []):
            nome = str(a.get('/T'))
            dati = bytes(a.get('/Contents', b''))
            with open(os.path.join(cartella, nome), 'wb') as f:
                f.write(dati)
            out.append({'pagina': i + 1, 'nome': nome, 'bytes': len(dati)})
    print(json.dumps(out))


def render(pdf_path, pagina, out, scala=1.0):
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_path)
    page = pdf[int(pagina) - 1]
    img = page.render(scale=float(scala)).to_pil()
    img.save(out)
    grigio = img.convert('L')
    istogramma = grigio.histogram()
    scuri = sum(istogramma[:128])
    print(json.dumps({'width': img.width, 'height': img.height, 'pixelScuri': scuri, 'frazioneScuri': scuri / (img.width * img.height)}))


def confronto_visivo(orig, nostro, prefisso, scala=1.0):
    import pypdfium2 as pdfium
    from PIL import Image, ImageDraw
    a = pdfium.PdfDocument(orig)
    b = pdfium.PdfDocument(nostro)
    n = max(len(a), len(b))
    out = []
    for i in range(n):
        imgs = []
        for doc in (a, b):
            if i < len(doc):
                imgs.append(doc[i].render(scale=float(scala)).to_pil().convert('RGB'))
            else:
                imgs.append(Image.new('RGB', imgs[0].size if imgs else (595, 842), 'white'))
        w = imgs[0].width + imgs[1].width + 30
        h = max(imgs[0].height, imgs[1].height) + 30
        tela = Image.new('RGB', (w, h), (200, 200, 200))
        tela.paste(imgs[0], (0, 30))
        tela.paste(imgs[1], (imgs[0].width + 30, 30))
        d = ImageDraw.Draw(tela)
        d.text((10, 8), f'originale Docfa - pagina {i + 1}', fill=(0, 0, 0))
        d.text((imgs[0].width + 40, 8), f'Fa.Catasto.Doc - pagina {i + 1}', fill=(0, 0, 0))
        nome = f'{prefisso}{i + 1}.png'
        tela.save(nome)
        out.append(nome)
    print(json.dumps(out))


def main():
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd == 'estrai-g4':
        estrai_g4(*args)
    elif cmd == 'verifica':
        verifica(*args)
    elif cmd == 'annotazioni':
        annotazioni(*args)
    elif cmd == 'render':
        render(*args)
    elif cmd == 'confronto-visivo':
        confronto_visivo(*args)
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
