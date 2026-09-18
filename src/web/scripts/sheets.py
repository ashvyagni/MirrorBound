#!/usr/bin/env python3
"""Per-sheet definitions: where the rows are, and how to recognise a body."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from atlaslib import Band, SheetSpec

ASSETS = Path(__file__).resolve().parents[3] / "assets"


# --- goat -------------------------------------------------------------------

def _goat_body(rgb: np.ndarray) -> np.ndarray:
    """Warm cream artwork only.

    `G >= B` is what rejects the pink FX: cream is warm so green leads blue,
    while the magenta swirl -- including its white-hot core -- has blue leading
    green. Without this the FX reads as a body and frame centres drift.
    """
    value = rgb.max(axis=2)
    sat = value - rgb.min(axis=2)
    return (value > 110) & (sat < 45) & (rgb[:, :, 1] >= rgb[:, :, 2])


def _goat_swirl(rgb: np.ndarray) -> np.ndarray:
    """Saturated magenta only.

    The looser `_goat_fx` test also catches the goat's pale pink ears and eyes,
    which is harmless when all it does is seed frame ownership but would weld
    facial features into the swirl when the effect is lifted out on its own.
    """
    return (rgb.max(axis=2) > 110) & (rgb[:, :, 2] > rgb[:, :, 1] + 25)


def _goat_fx(rgb: np.ndarray) -> np.ndarray:
    """Bright cores of the pink attack swirls, excluding their dim glow.

    The glow haloes merge every swirl into one blob; the cores stay separate,
    which is what makes per-frame ownership decidable.
    """
    return (rgb.max(axis=2) > 110) & (rgb[:, :, 2] > rgb[:, :, 1] + 12)


GOAT = SheetSpec(
    name="goat",
    source=ASSETS / "goatsprite.jpg",
    body=_goat_body,
    fx=_goat_fx,
    fx_isolate=_goat_swirl,
    anchor="feet",
    bands=(
        Band("idle",    50,  325,    0,  720,  6),
        Band("walk",    50,  325,  720, 1448,  6),
        Band("run",    350,  632,    0,  745,  5),
        Band("jump",   350,  632,  745, 1448,  6),
        Band("attack", 660,  880,    0,  960,  6, fx_alias="swirl",
     #: Pink -> violet, matching the companion's own palette; it is the
     #: companion that uses this effect, not the goat.
     fx_hue_shift=-55),
        Band("hurt",   660,  880,  960, 1120,  1),
        Band("die",    660,  880, 1120, 1448,  1),
        Band("face",   885, 1062,    0, 1388, 10, names=(
            "face-normal", "face-happy", "face-excited", "face-angry", "face-sad",
            "face-surprised", "face-confused", "face-sleepy", "face-wink", "face-blush",
        )),
    ),
)


# --- bro --------------------------------------------------------------------

def _bro_body(rgb: np.ndarray) -> np.ndarray:
    """The companion's white body.

    This sheet is cold -- white body, cyan bow, violet eyes -- so the goat's
    warm-cream test is useless here. Brightness alone separates the body from
    the dim violet aura that otherwise merges neighbouring dance frames.
    """
    return rgb.max(axis=2) > 170


#: Row bands. The sheet labels each row in a bordered box above the sprites and
#: numbers each frame below them; both sit outside these y-ranges, which is why
#: the chrome never reaches the mask.
BRO = SheetSpec(
    name="bro",
    source=ASSETS / "brosprite.jpg",
    body=_bro_body,
    fx=None,           # the aura is diffuse and symmetric; nearest-body wins
    anchor="center",   # it floats: there is no ground contact to pin
    #: The sheet draws its rows at wildly different sizes -- the emotes at about
    #: 55% of idle, travel at 70% -- so without this the companion visibly
    #: shrinks the moment it moves or performs.
    normalize_to="idle",
    bright_threshold=45,
    outline_dilate=3,  # smaller sprites than the goat, so a thinner outline
    body_min_area=200,
    bands=(
        Band("idle",       72,  190,    0,  770,  8),
        Band("hover",      72,  190,  770, 1536,  8),
        Band("moveRight", 306,  398,    0,  775,  8),
        Band("moveLeft",  306,  398,  775, 1536,  8),
        Band("moveUp",    493,  645,    0,  770,  8),
        Band("moveDown",  493,  645,  770, 1536,  8),
        Band("danceHappy", 720, 836,    0,  782, 12),
        Band("danceSpin",  720, 836,  782, 1536, 10),
        Band("surprised", 897,  995,    0,  400,  6),
        Band("lookAround", 897, 995,  400,  865,  7),
        Band("danceExcited", 897, 995, 865, 1536, 10),
    ),
)

SHEETS = (GOAT, BRO)
