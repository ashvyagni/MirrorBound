"""Export the generated cursor as eight registered frames; preserve source alpha.

Only crop, align and downsample: the generated artwork stays unchanged.
Run from src/web: python3 scripts/build_cursor.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

WEB = Path(__file__).resolve().parents[1]
ASSETS = WEB.parents[1] / 'assets/ui'
OUT = WEB / 'public/game/cursor'


def export(name: str, source_name: str, inset: int):
    source = Image.open(ASSETS / source_name)
    assert source.mode == 'RGBA', 'Cursor artwork must have real transparency'
    assert source.size == (1536, 1024), 'Cursor source must be four by two cells'
    frames = []
    for i in range(8):
        col, row = i % 4, i // 4
        cell = source.crop((col * 384, row * 512, (col + 1) * 384, (row + 1) * 512))
        alpha = np.array(cell)[:, :, 3]
        # The highest opaque pixel is the sharp tip; the generated second row
        # sits 32px higher. Register by the tip, never by the moving glint.
        ys, xs = np.where(alpha > 245)
        top = int(ys.min())
        tip_x = int(np.median(xs[ys == top]))
        registered = cell.crop((tip_x - inset, top - 24, tip_x + 384 - inset, top + 424))
        frames.append(registered.resize((96, 112), Image.Resampling.LANCZOS))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (96 * 8, 112))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * 96, 0))
    sheet.save(OUT / f'{name}.png', optimize=True)
    frames[0].resize((48, 56), Image.Resampling.LANCZOS).save(OUT / f'{name}-static.png')
    print(f'Exported {name}: {len(frames)} registered 96x112 frames')


if __name__ == '__main__':
    export('hornbound', 'cursor-hornbound.png', 32)
    export('grab', 'cursor-grab.png', 64)
