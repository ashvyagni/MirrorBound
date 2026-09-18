#!/usr/bin/env python3
"""
Build the Phaser texture atlases from the flat character sheets.

Each source sheet is a JPEG on black: no alpha, no uniform grid, and artwork
outlined in near-black -- the same value as the background, so no luminance
threshold can separate the two. `atlaslib` does the work; `sheets` says where
the rows are and how to recognise each character's body.

Outputs, per sheet:
  public/game/<name>/<name>.png + .json   Phaser "JSON Hash" atlas, trimmed
  src/game/animation/<name>Atlas.generated.ts

Run: npm run assets
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from atlaslib import build          # noqa: E402
from sheets import SHEETS           # noqa: E402

WEB = Path(__file__).resolve().parents[1]


def main() -> None:
    for spec in SHEETS:
        build(
            spec,
            out_dir=WEB / "public" / "game" / spec.name,
            ts_out=WEB / "src" / "game" / "animation" / f"{spec.name}Atlas.generated.ts",
        )


if __name__ == "__main__":
    main()
