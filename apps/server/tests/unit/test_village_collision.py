"""A village building blocks something close to the size it is drawn.

All six were placed on one hardcoded 26 -- a flagpole and a two-storey house
on the same number. A `hut_big`, drawn around 129 units across, blocked a 52
unit circle: the player's centre halted 40 units out against a 65 unit
half-width, so the whole player sprite fitted inside the house outline. The
`banner` ran the other way and blocked 139% of a flagpole.

The sizes are checked against the drawn art rather than against the numbers
that were chosen, so re-cutting a sheet at a different size fails here rather
than in the village.
"""

import json
import pathlib

import pytest

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.world.campaign import AREAS
from mirrorbound.game.world.village import BUILDING_RADII, build_village

PLAYER_RADIUS = 14.0

_ATLASES = pathlib.Path(__file__).resolve().parents[4] / "src" / "web" / "public" / "game"

# Sheet, frame stem, variant count, and the height `propArt.ts` fits it to.
_ART = {
    "hut": ("buildings", "hut", 3, 88),
    "hut_big": ("buildings", "hutBig", 2, 128),
    "forge": ("buildings", "forge", 1, 76),
    "stall": ("buildings", "stall", 1, 52),
    "banner": ("buildings", "banner", 1, 92),
    "well": ("ruins", "well", 1, 60),
}

needs_art = pytest.mark.skipif(not _ATLASES.exists(), reason="client atlases not checked out")


def _frames(sheet: str) -> dict:
    raw = json.loads((_ATLASES / sheet / f"{sheet}.json").read_text())["frames"]
    if isinstance(raw, list):
        return {f["filename"]: f for f in raw}
    return raw


def _half_widths(kind: str) -> list[float]:
    """Drawn half-width in world units, per variant, at scale 1."""
    sheet, stem, variants, target_h = _ART[kind]
    frames = _frames(sheet)
    out = []
    for v in range(variants):
        name = f"{stem}{v}"
        key = name if name in frames else next(k for k in frames if k.startswith(name))
        f = frames[key]["frame"]
        out.append(f["w"] * (target_h / f["h"]) / 2)
    return out


def _villages():
    for area_id, area in AREAS.items():
        if area.kind == "dungeon":
            continue
        for seed in range(12):
            yield build_village(area_id, DeterministicRNG(seed))


@needs_art
@pytest.mark.parametrize("kind", sorted(_ART))
def test_a_building_blocks_most_of_what_it_draws(kind):
    """You may clip the eaves. You may not stand in the house."""
    reach = BUILDING_RADII[kind] + PLAYER_RADIUS
    widest = max(_half_widths(kind))
    assert reach >= widest - 6, (
        f"{kind}: stopped at {reach:.0f} against a {widest:.0f} half-width -- "
        f"{widest - reach:.0f} units inside the art"
    )


@needs_art
@pytest.mark.parametrize("kind", sorted(_ART))
def test_a_building_is_not_an_invisible_wall_either(kind):
    """`banner` blocked 139% of a flagpole. The error runs both ways."""
    narrowest = min(_half_widths(kind))
    assert BUILDING_RADII[kind] <= narrowest * 1.1, (
        f"{kind}: blocks {BUILDING_RADII[kind]} around art only {narrowest:.0f} wide"
    )


def test_every_building_has_a_radius_of_its_own():
    """One shared 26 is what put the player inside the houses."""
    assert set(BUILDING_RADII) == set(_ART)
    assert len(set(BUILDING_RADII.values())) > 1, "back to one number for every building"


def test_the_radius_follows_the_per_instance_scale():
    """The village jitters props 0.92..1.12 and used to leave the circle flat,
    so its biggest-drawn huts were its most under-blocked."""
    seen: dict[str, set[float]] = {k: set() for k in BUILDING_RADII}
    scales: dict[str, set[float]] = {k: set() for k in BUILDING_RADII}
    for room in _villages():
        for d in room.decor:
            if d.kind in seen and d.blocking:
                seen[d.kind].add(round(d.radius / d.scale, 3))
                scales[d.kind].add(d.scale)
    for kind, ratios in seen.items():
        assert ratios, f"no {kind} placed in any village"
        assert ratios == {float(BUILDING_RADII[kind])}, (kind, ratios)
        assert len(scales[kind]) > 1, f"{kind} never varied, so this proves nothing"


def test_the_buildings_still_get_placed():
    """Bigger circles mean more rejected positions; they must not starve."""
    counts = {k: 0 for k in BUILDING_RADII}
    villages = 0
    for room in _villages():
        villages += 1
        for d in room.decor:
            if d.kind in counts:
                counts[d.kind] += 1
    for kind, n in counts.items():
        assert n / villages >= 1.0, f"{kind} averages only {n / villages:.2f} per village"


def test_nothing_blocking_carries_a_zero_radius():
    for room in _villages():
        for d in room.decor:
            if d.blocking:
                assert d.radius > 0, f"{d.kind} blocks with radius {d.radius}"
