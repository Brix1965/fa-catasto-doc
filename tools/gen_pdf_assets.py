#!/usr/bin/env python3
"""
Prepara gli asset incorporati nel generatore PDF (src/lib/core/pdf/assets/):
  - i font Liberation Serif (regolare e grassetto), ridotti ai soli glifi Windows-1252 con fontTools
    (se disponibile) a partire dai TTF di sistema o da quelli già presenti nella cartella;
  - il profilo ICC sRGB per l'OutputIntent PDF/A;
  - i moduli TypeScript con il contenuto in base64 (*.generated.ts), così che i file siano incorporati
    nel bundle e disponibili anche nel webview di Tauri senza accesso al filesystem.

Uso: python3 tools/gen_pdf_assets.py
"""
import base64
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'src', 'lib', 'core', 'pdf', 'assets')
FONT_DIR_SISTEMA = '/usr/share/fonts/truetype/liberation'
FONTS = ['LiberationSerif-Regular', 'LiberationSerif-Bold']
ICC = 'sRGB_IEC61966-2-1_black_scaled.icc'


def riduci_font(sorgente: str, destinazione: str) -> None:
    """Sottoinsieme con i caratteri 32-255 di Windows-1252 (quelli raggiungibili con WinAnsiEncoding)."""
    try:
        from fontTools import subset
    except ImportError:
        if sorgente != destinazione:
            shutil.copyfile(sorgente, destinazione)
        print('fontTools non disponibile: font copiato integralmente', destinazione)
        return
    unicodes = set()
    for b in range(32, 256):
        try:
            unicodes.add(ord(bytes([b]).decode('cp1252')))
        except UnicodeDecodeError:
            pass
    opts = subset.Options()
    opts.glyph_names = True
    opts.hinting = True
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.recalc_bounds = False
    opts.layout_features = []
    opts.drop_tables += ['GSUB', 'GPOS', 'GDEF', 'kern', 'DSIG', 'FFTM']
    font = subset.load_font(sorgente, opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(unicodes))
    s.subset(font)
    subset.save_font(font, destinazione, opts)
    print('font ridotto:', destinazione, os.path.getsize(destinazione), 'byte')


def modulo_base64(nome_file: str, nome_costante: str, destinazione: str, commento: str) -> None:
    with open(os.path.join(ASSETS, nome_file), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    righe = [b64[i:i + 100] for i in range(0, len(b64), 100)]
    with open(os.path.join(ASSETS, destinazione), 'w', encoding='utf-8') as out:
        out.write(f'// File generato da tools/gen_pdf_assets.py: non modificare a mano.\n// {commento}\n')
        out.write(f'export const {nome_costante} =\n')
        out.write('\n'.join(f"  '{r}' +" for r in righe[:-1]))
        out.write(f"\n  '{righe[-1]}';\n")
    print('scritto', destinazione)


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    for nome in FONTS:
        dest = os.path.join(ASSETS, nome + '.ttf')
        src = os.path.join(FONT_DIR_SISTEMA, nome + '.ttf')
        if os.path.exists(src):
            riduci_font(src, dest)
        elif not os.path.exists(dest):
            raise SystemExit(f'font {nome} non trovato né in {FONT_DIR_SISTEMA} né in {ASSETS}')
    if not os.path.exists(os.path.join(ASSETS, ICC)):
        raise SystemExit(f'profilo ICC {ICC} mancante in {ASSETS}')
    modulo_base64('LiberationSerif-Regular.ttf', 'LIBERATION_SERIF_REGULAR_B64', 'fonts.generated.ts',
                  'Liberation Serif (licenza SIL OFL 1.1, vedi LICENSE-LiberationFonts.txt), ridotto ai glifi Windows-1252.')
    with open(os.path.join(ASSETS, 'LiberationSerif-Bold.ttf'), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    righe = [b64[i:i + 100] for i in range(0, len(b64), 100)]
    with open(os.path.join(ASSETS, 'fonts.generated.ts'), 'a', encoding='utf-8') as out:
        out.write('export const LIBERATION_SERIF_BOLD_B64 =\n')
        out.write('\n'.join(f"  '{r}' +" for r in righe[:-1]))
        out.write(f"\n  '{righe[-1]}';\n")
    modulo_base64(ICC, 'SRGB_ICC_B64', 'icc.generated.ts',
                  'Profilo sRGB IEC61966-2.1 (black scaled) dell\'International Color Consortium, vedi LICENSE-sRGB.txt.')


if __name__ == '__main__':
    main()
