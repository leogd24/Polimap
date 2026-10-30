"""
POLIMAP — Convierte el PDF oficial de horarios de la UdeG en una imagen por grupo.
Responsable: Alexis.  Se corre UNA vez por ciclo (cuando sale el PDF nuevo).

Cada página del PDF es un grupo ("1AM TIN. TECNOLOGO PROFESIONAL EN ..."). El
script lee la clave del grupo de cada página, la dibuja a 170 dpi, recorta los
márgenes blancos y la guarda en PNG de 64 colores (~80 KB, se lee nítido):

    public/horarios/2026B/1AM-TIN.png

La app las muestra en Horario → "Oficial" (src/lib/horario.js → urlOficial).

Requisitos: Python 3, Pillow (pip install pillow) y Poppler (pdftoppm y
pdftotext). En Windows: https://github.com/oschwartz10612/poppler-windows
(agrega su carpeta bin al PATH).

Uso:
    python scripts/generar_horarios_oficiales.py hrios_grupos26b.pdf 2026B
"""
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageOps


def clave_de_pagina(pdf, pagina):
    texto = subprocess.run(
        ["pdftotext", "-f", str(pagina), "-l", str(pagina), pdf, "-"],
        capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    m = re.search(r"^(\d[A-Z]{1,3} [A-Z]{2,5})\.", texto, re.M)
    return m.group(1) if m else None


def paginas(pdf):
    info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True, check=True).stdout
    return int(re.search(r"Pages:\s+(\d+)", info).group(1))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    pdf, ciclo = sys.argv[1], sys.argv[2]
    salida = os.path.join("public", "horarios", ciclo)
    os.makedirs(salida, exist_ok=True)
    total = paginas(pdf)
    hechas = 0
    with tempfile.TemporaryDirectory() as tmp:
        for p in range(1, total + 1):
            clave = clave_de_pagina(pdf, p)
            if not clave:
                print(f"  página {p}: no se encontró la clave del grupo, se salta")
                continue
            base = os.path.join(tmp, f"p{p}")
            subprocess.run(["pdftoppm", "-f", str(p), "-l", str(p), "-r", "170", "-png", "-singlefile", pdf, base], check=True)
            img = Image.open(base + ".png").convert("RGB")
            # Recortar el blanco de alrededor (dejando 20 px de margen).
            caja = ImageOps.invert(img.convert("L")).getbbox()
            if caja:
                w, h = img.size
                img = img.crop((max(0, caja[0] - 20), max(0, caja[1] - 20), min(w, caja[2] + 20), min(h, caja[3] + 20)))
            nombre = clave.replace(" ", "-") + ".png"
            img.quantize(colors=64, method=Image.Quantize.MEDIANCUT).save(os.path.join(salida, nombre), optimize=True)
            hechas += 1
            print(f"  {nombre}  (página {p})")
    print(f"Listo: {hechas} imágenes en {salida}")


if __name__ == "__main__":
    main()
