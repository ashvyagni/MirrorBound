#!/usr/bin/env python3
"""
Shared machinery for turning a flat character sheet into a Phaser atlas.

Both source sheets are JPEGs on black: no alpha, no uniform grid, and artwork
drawn with near-black outlines that are *the same value as the background*. The
answers to that are the same for both, so they live here:

  * Keying is morphological, never a luminance threshold -- a threshold would
    dissolve the outlines. Grow the certainly-bright pixels outward to swallow
    the surrounding outline, fill interior holes, smooth.

  * Frames are split by seeding each one with its own body (plus any FX that
    clearly belongs to it) and growing those seeds through the artwork, so a
    glow or a swirl that spills into the next frame's column still resolves to
    the character it is attached to. A straight cut cannot do that.

What differs per sheet -- where the rows are, how to recognise a body, whether
the character stands on the ground or floats -- is supplied by a `SheetSpec`.
"""

from __future__ import annotations

import json
from collections import deque
from math import ceil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageFilter

Mask = Callable[[np.ndarray, np.ndarray], np.ndarray]

MASK_SMOOTH = 1.1        # round off the blocky dilation
EDGE_FEATHER = 0.6       # final alpha feather
PADDING = 2              # transparent gutter, stops neighbours bleeding


@dataclass(frozen=True)
class Band:
    """One horizontal strip of a sheet holding a single animation."""
    key: str
    y0: int
    y1: int
    x0: int
    x1: int
    expected: int
    #: Per-frame names. Defaults to `<key>-00`, `<key>-01`, ...
    names: tuple[str, ...] | None = None
    #: Number of equal columns the band is divided into. Set it for sheets drawn
    #: as a grid: each frame then anchors to its cell's centre rather than to
    #: its own content, which preserves the travel the artist drew *inside* the
    #: cell. Anchoring on content would pin every frame in place and flatten a
    #: sweeping swing into a rotation on the spot.
    grid_cols: int | None = None
    #: Also emit this band a second time keeping only its effects -- the swirl
    #: and its glow, with the character itself removed -- under this anim name.
    #: Lets one character's effect be drawn over another without dragging the
    #: original body along with it.
    fx_alias: str | None = None
    #: Also emit this band a second time with its effects *removed*, under this
    #: anim name -- the same split as `fx_alias`, taken from the other side. A
    #: character holding a weapon should not also be throwing its own bare
    #: handed effect, and these sheets bake the effect into the pose.
    clean_alias: str | None = None
    #: Hue rotation applied to those isolated frames, in degrees. Recolouring
    #: here rather than tinting at runtime matters because Phaser's tint is a
    #: multiply: it can only ever darken a channel, so it cannot turn a pink
    #: effect purple -- it just makes a muddy pink.
    fx_hue_shift: float = 0.0


@dataclass(frozen=True)
class SheetSpec:
    name: str                       # texture key, e.g. "goat"
    source: Path
    bands: tuple[Band, ...]
    body: Mask                      # recognises the character's own body
    #: Anchor: "feet" pins the lowest body pixel (walkers), "center" pins the
    #: body's vertical middle (floaters, which have no ground contact).
    anchor: str = "feet"
    fx: Mask | None = None          # bright effect cores worth seeding separately
    #: Pixels to pivot each frame around -- a weapon's grip, say. When set, a
    #: frame anchors on the centroid of its own pivot pixels instead of on its
    #: cell or its bounds. This is what makes a swing read as a swing: the
    #: handle stays put in the hand and the blade sweeps around it. Anchoring a
    #: swing on anything else sends the whole weapon skating across the screen,
    #: because the artist moves it within its cell from frame to frame.
    pivot: Mask | None = None
    #: Stricter mask used when lifting an effect out on its own for `fx_alias`.
    #: Seeding only needs to find the effect; isolating it must also reject the
    #: character's own pale-pink features, which the looser test lets through.
    fx_isolate: Mask | None = None
    fx_isolate_min_area: int = 300
    bright_threshold: int = 55      # certainly artwork, never background
    outline_dilate: int = 4         # px to grow, to capture the dark outline
    body_min_area: int = 600
    fx_min_area: int = 400
    #: Horizontal overlap, in px, required before two blobs are judged to be
    #: parts of the same character. Run and jump poses lean far enough to sit
    #: in a neighbour's column, so touching alone must not merge them.
    cluster_overlap: int = 6
    #: Band key whose character size every other band is matched to. Sheets
    #: are not always drawn at a consistent scale -- rows can be laid out to
    #: fit the page rather than to match each other -- and without this the
    #: character visibly shrinks when those animations play. Leave unset for
    #: sheets whose size differences are real posing (a goat lying down is
    #: genuinely smaller than one standing up).
    normalize_to: str | None = None
    #: Uniform factor applied to every frame on the way out. The source sheets
    #: are drawn far larger than anything is displayed at, which is right for
    #: the game -- a sprite is scaled up on big screens -- but wrong for UI
    #: chrome that is never drawn above a few dozen pixels, where it only buys
    #: a megabyte of atlas nobody sees. Resampled once here with a good kernel.
    downscale: float = 1.0
    #: Erase this many pixels either side of every cell boundary before the
    #: frames are found.
    #:
    #: Image models draw the grid. Block 0-MOB forbids cell borders in as many
    #: words and six of the boss's ten sheets came back with them anyway, 1 to
    #: 2 pixels thick and fully opaque -- which welds all eight frames into one
    #: blob and loses the sheet.
    #:
    #: Safe because the same brief requires 24 pixels of clear background
    #: around every frame's artwork, so a few pixels at the exact boundary can
    #: only ever be background or a border. Cheaper than regenerating a sheet
    #: that is otherwise correct, and it keeps working the next time.
    strip_grid: int = 0
    #: Hue rotation applied to every frame of the sheet, in degrees.
    #:
    #: What makes a corrupted weapon cheap. The weapon sheets carry no
    #: character -- they are composited over whoever is holding them -- so the
    #: boss can hold the player's own sword, and "corrupted" is that same sword
    #: rotated toward violet. One source sheet, two atlases, and the two cannot
    #: drift apart because there is only one drawing.
    #:
    #: It also reads better than redrawing would. A corrupted weapon that is
    #: literally your weapon says the boss took yours; one drawn separately
    #: says it happens to own a different sword.
    #:
    #: Done here rather than with a runtime tint for the reason the band-level
    #: `fx_hue_shift` already documents: Phaser's tint is a multiply, so it can
    #: only darken a channel and cannot turn an orange flame violet.
    hue_shift: float = 0.0
    #: Rotate this sheet's *dominant* hue to this one, in degrees.
    #:
    #: Preferred over `hue_shift` for the corrupted variants, because the
    #: weapons do not share a starting colour: the sword's effects sit at 348
    #: degrees, the fire family at 25 and the ice family at 189. One rotation
    #: cannot take all three to violet, and three hand-tuned rotations are
    #: three numbers that quietly stop being right the first time a sheet is
    #: redrawn. Measuring each sheet and solving its own rotation is one
    #: constant instead -- and the constant is read off the twin, which is the
    #: thing doing the corrupting.
    hue_target: float | None = None
    #: Pulled toward this, 0..1, after the hue rotation. Corruption is not only
    #: a different colour -- it is a colder, deader one, and a pure rotation
    #: leaves a cheerful violet sword.
    desaturate: float = 0.0
    #: How the background is separated from the art.
    #: "black"  -- artwork on black with near-black outlines. Outline and
    #:            background share a value, so only geometry can tell them
    #:            apart: grow the bright core outward, fill holes, smooth.
    #: "green"  -- chroma key. Far easier, because the key colour appears
    #:            nowhere in the art, so outlines survive on their own.
    #: "alpha"  -- the source already carries a usable alpha channel.
    key: str = "black"


# --- morphology -------------------------------------------------------------

def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(radius):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def flood_from_border(mask: np.ndarray) -> np.ndarray:
    """The part of `mask` reachable from the image border (4-connectivity)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    queue: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if mask[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                push(ny, nx)
    return seen


def components(mask: np.ndarray, min_area: int) -> list[np.ndarray]:
    """8-connected components of `mask`, as boolean masks, largest first."""
    h, w = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    found: list[tuple[int, np.ndarray]] = []

    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        blob = np.zeros(mask.shape, dtype=bool)
        queue = deque([(int(sy), int(sx))])
        seen[sy, sx] = True
        blob[sy, sx] = True
        area = 0
        while queue:
            y, x = queue.popleft()
            area += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        blob[ny, nx] = True
                        queue.append((ny, nx))
        if area >= min_area:
            found.append((area, blob))

    found.sort(key=lambda pair: -pair[0])
    return [blob for _, blob in found]


def strip_grid_lines(alpha: np.ndarray, spec: SheetSpec) -> np.ndarray:
    """Clear the drawn cell borders out of a sheet's alpha."""
    if spec.strip_grid <= 0:
        return alpha

    out = alpha.copy()
    pad = spec.strip_grid
    for band in spec.bands:
        if not band.grid_cols:
            continue
        cell = (band.x1 - band.x0) / band.grid_cols
        # Every boundary including the band's own two outer edges: a model that
        # draws the internal dividers usually draws the frame around them too.
        for i in range(band.grid_cols + 1):
            x = int(round(band.x0 + i * cell))
            out[band.y0:band.y1, max(0, x - pad):x + pad + 1] = 0.0
        out[max(0, band.y0 - pad):band.y0 + pad + 1, band.x0:band.x1] = 0.0
        out[max(0, band.y1 - pad):band.y1 + pad + 1, band.x0:band.x1] = 0.0
    return out


def band_mask(spec: SheetSpec, shape: tuple[int, int]) -> np.ndarray:
    """True inside any declared band."""
    keep = np.zeros(shape, dtype=bool)
    for band in spec.bands:
        keep[band.y0:band.y1, band.x0:band.x1] = True
    return keep


def mask_to_bands(rgb: np.ndarray, spec: SheetSpec) -> np.ndarray:
    """Blank everything outside the declared bands.

    Sheets carry annotation as well as art -- row labels, rule lines, frame
    numbers, palette swatches. Band rectangles already exclude it, but keying
    dilates outward by the outline thickness, which is enough to drag a rule
    line sitting a few pixels above a band down into it, where it shows up
    welded to that row's first frame. Clearing it before keying rather than
    cropping after is what keeps that from happening.
    """
    return rgb * band_mask(spec, rgb.shape[:2])[:, :, None]


def backdrop_greenness(greenness: np.ndarray) -> float:
    """How green this sheet's backdrop actually is, read off its border.

    Not every sheet came back on the same green. The interface sheets are on
    pure #00FF00, which scores about 227; the glyph sheet came back on a muted
    (52,164,70) and scores 94. One fixed threshold cannot serve both, and the
    fixed one that was here served neither once the artwork was green too.

    Sampled from a one-pixel ring at the edge, where the brief guarantees clear
    background on every sheet, and taken as a median so a stray mark in a
    corner cannot move it.
    """
    edge = np.concatenate([
        greenness[0, :], greenness[-1, :], greenness[:, 0], greenness[:, -1],
    ])
    return float(np.median(edge))


def chroma_alpha(rgb: np.ndarray) -> np.ndarray:
    """Key a green background, with a soft edge and green spill removed.

    Unlike the black sheets this needs no morphology: a dark outline is simply
    not green and survives on its own. The ramp exists to keep edges from going
    stair-stepped.

    The thresholds are a fraction of the backdrop's own greenness rather than
    fixed numbers, and that is the whole of this function's difficulty. A fixed
    cut at 60 was right for every sheet drawn before the world was: a sword and
    a skeleton contain no green, so anything green was background. A tree does.
    Its canopy is #4f8a44, which scores 67 -- so the old cut keyed the leaves
    out and left the trunk, and every tree in the game came back bare.

    Measured against the backdrop instead, the same tree is unambiguous: the
    background scores 227 and the foliage 67, which is 30% of it. Nothing drawn
    is anywhere near its own backdrop, because a sheet where the art matched
    the key colour would be unusable however it was keyed.
    """
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenness = green - np.maximum(red, blue)
    key = backdrop_greenness(greenness)
    # A backdrop that is barely green at all is not a chroma sheet; fall back
    # to the old absolute cut rather than dividing by something near zero.
    if key < 40.0:
        return np.clip((60.0 - greenness) / 40.0, 0.0, 1.0)
    # Fully transparent at three quarters of the backdrop, fully opaque at
    # two fifths, ramped between -- wide enough that an antialiased edge
    # resolves smoothly, tight enough that nothing drawn falls inside it.
    high, low = key * 0.75, key * 0.40
    return np.clip((high - greenness) / (high - low), 0.0, 1.0)


def despill(rgb: np.ndarray) -> np.ndarray:
    """Pull green back to the level of the other channels.

    Semi-transparent edge pixels carry a green cast from the backdrop; left in,
    it shows as a lime rim once the sprite is composited over anything else.
    """
    out = rgb.copy()
    ceiling = np.maximum(out[..., 0], out[..., 2])
    spilled = out[..., 1] > ceiling
    out[..., 1] = np.where(spilled, ceiling, out[..., 1])
    return out


def build_alpha(rgb: np.ndarray, spec: SheetSpec) -> np.ndarray:
    """Recover a 0..1 alpha channel for artwork drawn on black.

    The outlines are as dark as the background, so they cannot be separated by
    value -- only by position. Everything bright is certainly artwork; growing
    that outward by the outline's thickness and filling the interior recovers
    the true silhouette with the outlines intact.
    """
    if spec.key == "green":
        return chroma_alpha(rgb)

    core = rgb.max(axis=2) > spec.bright_threshold
    silhouette = ~flood_from_border(~dilate(core, spec.outline_dilate))

    smoothed = Image.fromarray((silhouette * 255).astype(np.uint8))
    smoothed = smoothed.filter(ImageFilter.GaussianBlur(MASK_SMOOTH))
    silhouette = np.asarray(smoothed).astype(np.float32) > 127

    feathered = Image.fromarray((silhouette * 255).astype(np.uint8))
    feathered = feathered.filter(ImageFilter.GaussianBlur(EDGE_FEATHER))
    return np.asarray(feathered).astype(np.float32) / 255.0


# --- segmentation -----------------------------------------------------------

def cluster_bodies(body: np.ndarray, band: Band, spec: SheetSpec) -> list[tuple[int, int]]:
    """One x-range per frame in the band.

    A single character fragments into several blobs -- a horn spiral cut off
    from the head by its own outline, a bow separated from a face -- so blobs
    that overlap horizontally are merged back into one frame.
    """
    sub = body[band.y0:band.y1, band.x0:band.x1]
    spans: list[list[int]] = []
    for blob in components(sub, spec.body_min_area):
        cols = np.nonzero(blob.any(axis=0))[0]
        spans.append([int(cols[0]) + band.x0, int(cols[-1]) + band.x0])

    spans.sort()

    # On a grid sheet the cells are the ground truth, so blobs are bucketed by
    # the cell their centre falls in. Merging by overlap instead would split a
    # frame whose artwork happens to break into two pieces a pixel apart, which
    # is exactly what a glowing trail detaching from a blade looks like.
    if band.grid_cols:
        # The cells are the ground truth, so every cell is a frame -- not just
        # the ones a blob's centre happened to land in. Bucketing blobs instead
        # loses a frame whenever two of them touch across a cell boundary: the
        # merged blob has one centre, one bucket gets it, and its neighbour
        # comes back empty. Two slimes in `slime-alert` do exactly that.
        cell = (band.x1 - band.x0) / band.grid_cols
        return [
            (int(band.x0 + i * cell), int(band.x0 + (i + 1) * cell) - 1)
            for i in range(band.grid_cols)
        ]

    merged: list[list[int]] = []
    for span in spans:
        if merged and span[0] <= merged[-1][1] - spec.cluster_overlap:
            merged[-1][1] = max(merged[-1][1], span[1])
        else:
            merged.append(span)
    return [(lo, hi) for lo, hi in merged]


def _owner(x0: int, x1: int, clusters: list[tuple[int, int]]) -> int:
    """Frame a blob spanning [x0, x1] belongs to: most horizontal overlap,
    falling back to nearest when the blob sits clear of every body."""
    best, best_score = 0, None
    for i, (lo, hi) in enumerate(clusters):
        overlap = min(x1, hi) - max(x0, lo)
        distance = -overlap if overlap > 0 else max(lo - x1, x0 - hi)
        if best_score is None or distance < best_score:
            best, best_score = i, distance
    return best


def _grow(labels: np.ndarray, region: np.ndarray) -> None:
    """Flood every labelled seed outward through `region`, in step.

    Because the wavefronts advance together, each pixel is claimed by whichever
    seed reaches it first *through the artwork* -- so a swirl or a glow that
    spills into the next column still resolves to the character it is attached
    to, which a straight cut can never do.
    """
    while True:
        proposal = np.full_like(labels, -1)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.full_like(labels, -1)
            ys = slice(max(dy, 0), labels.shape[0] + min(dy, 0))
            xs = slice(max(dx, 0), labels.shape[1] + min(dx, 0))
            ys2 = slice(max(-dy, 0), labels.shape[0] + min(-dy, 0))
            xs2 = slice(max(-dx, 0), labels.shape[1] + min(-dx, 0))
            src[ys, xs] = labels[ys2, xs2]
            empty = proposal < 0
            proposal[empty] = src[empty]
        claim = region & (labels < 0) & (proposal >= 0)
        if not claim.any():
            return
        labels[claim] = proposal[claim]


def _grid_seeds(band: Band, region: np.ndarray, body: np.ndarray,
                fx: np.ndarray | None) -> list[np.ndarray | None]:
    """The one piece of artwork that anchors each cell of a grid band.

    Taken as the largest connected component standing inside the cell's own
    columns, with no area floor: on a grid band every cell holds exactly one
    character, so the biggest thing in it is that character. A neighbour's
    overhanging blade is in the cell too, but it is a sliver beside a body and
    never wins.

    Restricting to the cell's columns is what keeps two touching characters
    apart -- each is the largest thing in its own cell, so each becomes a seed,
    and neither can swallow the other.
    """
    cell = (band.x1 - band.x0) / band.grid_cols
    seeds: list[np.ndarray | None] = []
    for i in range(band.grid_cols):
        lo, hi = int(round(i * cell)), int(round((i + 1) * cell))
        strip = np.zeros_like(region)
        strip[:, lo:hi] = region[:, lo:hi]
        # Body first; a cell with no body at all -- an all-effect frame -- falls
        # back to its largest effect rather than going unseeded and being
        # claimed by whichever neighbour floods into it.
        for source in (body, fx):
            if source is None:
                continue
            found = components(source & strip, 1)
            if found:
                seeds.append(found[0])
                break
        else:
            seeds.append(None)
    return seeds


def segment(band: Band, spec: SheetSpec, alpha: np.ndarray, body: np.ndarray,
            fx: np.ndarray | None, clusters: list[tuple[int, int]]) -> np.ndarray:
    """Label every artwork pixel in the band with the frame that owns it."""
    ys, xs = slice(band.y0, band.y1), slice(band.x0, band.x1)
    region = alpha[ys, xs] > 0.08
    labels = np.full(region.shape, -1, dtype=np.int16)

    fx_band = fx[ys, xs] if fx is not None else None
    seeds: list[tuple[np.ndarray, int]] = [(body[ys, xs], spec.body_min_area)]
    if fx_band is not None:
        seeds.append((fx_band, spec.fx_min_area))

    if band.grid_cols:
        # One seed per cell -- the biggest piece of artwork standing in it --
        # and then let the flood below carry each label outward THROUGH the
        # art. That is the whole trick, and it is why this is not a straight
        # cut at the cell line.
        #
        # A straight cut is what was here before, and it is wrong in one
        # direction and right in the other. Two slimes touching across a
        # boundary are one blob, so giving the blob to a single cell empties
        # its neighbour -- the cut fixes that. But a skeleton whose sword
        # overhangs its cell is ALSO one blob, and the cut hands the blade tip
        # to the next frame, which then draws a sword floating behind a
        # skeleton that is already holding one.
        #
        # There is no threshold that separates those two cases. Measured across
        # every grid sheet, the mass either side of a boundary runs smoothly
        # from 50/50 down to 100/0 with no gap anywhere in between.
        #
        # Connectivity separates them exactly, though, because it asks the
        # question that actually matters: is this pixel attached to this frame's
        # character? The sword is joined to its own skeleton and to nothing in
        # the next cell, so its owner's wavefront is the only one that ever
        # reaches it. The two slimes each have their own core, so their
        # wavefronts meet at the bridge between them and stop.
        for i, seed in enumerate(_grid_seeds(band, region, body[ys, xs], fx_band)):
            if seed is not None:
                labels[seed & (labels < 0)] = i
    else:
        for source, min_area in seeds:
            for blob in components(source & region, min_area):
                fresh = blob & (labels < 0)
                cols = np.nonzero(blob.any(axis=0))[0]
                owner = _owner(int(cols[0]) + band.x0, int(cols[-1]) + band.x0, clusters)
                labels[fresh] = owner

    _grow(labels, region)

    # Detached extras -- a die-pose's smoke, an attack sparkle, a dance particle
    # -- are never reached by the flood, so place them by position instead.
    for blob in components(region & (labels < 0), 20):
        cols = np.nonzero(blob.any(axis=0))[0]
        labels[blob] = _owner(int(cols[0]) + band.x0, int(cols[-1]) + band.x0, clusters)

    return labels


# --- frames -----------------------------------------------------------------

@dataclass
class Frame:
    name: str
    anim: str
    index: int
    #: Offset of the trimmed image's top-left from the anchor, after any
    #: rescaling. Storing the offset rather than a sheet-space box is what lets
    #: a band be resized without every downstream measurement going stale.
    dx: float
    dy: float
    #: Height of the character's own body in this frame, after scaling. Cells
    #: are padded by trails, glow and bob range, so cell height is a poor proxy
    #: for how big the character actually looks.
    body_h: float
    image: Image.Image = field(repr=False)
    x: int = 0                          # packed position in the atlas
    y: int = 0

    @property
    def w(self) -> int:
        return self.image.width

    @property
    def h(self) -> int:
        return self.image.height


def _band_anchor_y(body: np.ndarray, band: Band, mode: str) -> int:
    """The line a band's frames hang from.

    For a walker that is the lowest body pixel -- where the artist drew the
    feet, not the band rectangle's edge, which has slack below the art and
    would leave the character hovering. For a floater there is no ground
    contact, so the body's vertical middle is used instead; per-frame bob is
    then preserved as deviation from it, and switching animations does not
    make the character jump.
    """
    rows = np.nonzero(body[band.y0:band.y1, band.x0:band.x1].any(axis=1))[0]
    if len(rows) == 0:
        raise SystemExit(f"[{band.key}] no body pixels found in band")
    top, bottom = band.y0 + int(rows[0]), band.y0 + int(rows[-1]) + 1
    return bottom if mode == "feet" else (top + bottom) // 2


def band_scales(body: np.ndarray, spec: SheetSpec) -> dict[str, float]:
    """How much each band must grow to draw the character at a common size.

    Size is taken from the median body *area* per frame rather than its bounding
    box, because a leaning or tilted pose loses height while keeping its mass --
    judging by height alone would wrongly inflate every travel animation.
    """
    if spec.normalize_to is None:
        # Still a per-band table, so `downscale` travels the same path as a
        # normalisation factor rather than needing a second one of its own.
        return {band.key: spec.downscale for band in spec.bands}

    areas: dict[str, float] = {}
    for band in spec.bands:
        sub = body[band.y0:band.y1, band.x0:band.x1]
        per_frame = [
            float(sub[:, lo - band.x0:hi - band.x0 + 1].sum())
            for lo, hi in cluster_bodies(body, band, spec)
        ]
        areas[band.key] = float(np.median(per_frame)) if per_frame else 0.0

    reference = areas.get(spec.normalize_to)
    if not reference:
        raise SystemExit(f"[{spec.name}] normalize_to band {spec.normalize_to!r} has no body")
    return {
        key: ((reference / area) ** 0.5 if area else 1.0) * spec.downscale
        for key, area in areas.items()
    }


#: How far an effect's glow reaches past its bright core, in px.
FX_GLOW_REACH = 10

#: Extra growth when subtracting an effect, to take its soft fringe with it.
CLEAN_MARGIN = 5


def dominant_hue(rgb: np.ndarray) -> float | None:
    """The sheet's own colour, as a circular mean over its saturated pixels.

    Only confidently coloured pixels vote. A sheet is mostly bone white and
    dark outline, and letting those in drags every answer toward the same
    meaningless average.
    """
    scaled = rgb / 255.0
    high = scaled.max(axis=2)
    low = scaled.min(axis=2)
    sat = np.where(high > 0, (high - low) / np.maximum(high, 1e-6), 0.0)
    voters = (sat > 0.45) & (high > 0.35)
    if voters.sum() < 200:
        return None

    red, green, blue = scaled[..., 0], scaled[..., 1], scaled[..., 2]
    chroma = high - low
    hue = np.zeros_like(high)
    safe = chroma > 1e-6
    with np.errstate(invalid="ignore"):
        r_max = safe & (high == red)
        g_max = safe & (high == green) & ~r_max
        b_max = safe & (high == blue) & ~r_max & ~g_max
        hue[r_max] = ((green - blue)[r_max] / chroma[r_max]) % 6
        hue[g_max] = ((blue - red)[g_max] / chroma[g_max]) + 2
        hue[b_max] = ((red - green)[b_max] / chroma[b_max]) + 4
    angles = np.deg2rad(hue[voters] * 60.0)
    mean = np.arctan2(np.sin(angles).mean(), np.cos(angles).mean())
    return float(np.rad2deg(mean) % 360.0)


def recolour(rgb: np.ndarray, spec: SheetSpec) -> np.ndarray:
    """Apply a sheet's whole-sheet hue rotation and desaturation.

    A no-op for every sheet that does not ask for one, which is all of them but
    the corrupted variants.
    """
    if spec.hue_target is None and not spec.hue_shift and not spec.desaturate:
        return rgb

    shift = spec.hue_shift
    if spec.hue_target is not None:
        found = dominant_hue(rgb)
        if found is not None:
            shift = spec.hue_target - found

    out = rotate_hue(rgb, shift)
    if spec.desaturate:
        grey = out.mean(axis=2, keepdims=True)
        out = out + (grey - out) * spec.desaturate
    return out


def rotate_hue(rgb: np.ndarray, degrees: float) -> np.ndarray:
    """Rotate hue, leaving saturation and value alone."""
    if not degrees:
        return rgb
    scaled = rgb / 255.0
    high = scaled.max(axis=2)
    low = scaled.min(axis=2)
    chroma = high - low

    red, green, blue = scaled[..., 0], scaled[..., 1], scaled[..., 2]
    hue = np.zeros_like(high)
    safe = chroma > 1e-6
    with np.errstate(invalid="ignore", divide="ignore"):
        r_max = safe & (high == red)
        g_max = safe & (high == green) & ~r_max
        b_max = safe & ~r_max & ~g_max
        hue[r_max] = ((green - blue)[r_max] / chroma[r_max]) % 6
        hue[g_max] = ((blue - red)[g_max] / chroma[g_max]) + 2
        hue[b_max] = ((red - green)[b_max] / chroma[b_max]) + 4
    hue = (hue * 60.0 + degrees) % 360.0

    sector = hue / 60.0
    second = chroma * (1 - np.abs(sector % 2 - 1))
    zero = np.zeros_like(chroma)
    order = [
        (chroma, second, zero), (second, chroma, zero), (zero, chroma, second),
        (zero, second, chroma), (second, zero, chroma), (chroma, zero, second),
    ]
    out = np.zeros_like(scaled)
    index = np.clip(sector.astype(int), 0, 5)
    for i, (rr, gg, bb) in enumerate(order):
        pick = index == i
        out[pick] = np.stack([rr, gg, bb], axis=-1)[pick]

    return np.clip((out + low[..., None]) * 255.0, 0, 255)


def self_effect(owned: np.ndarray, fx_band: np.ndarray, min_area: int) -> np.ndarray:
    """Just this frame's effect: its bright cores, grown to take in their glow.

    Selecting by "not the body" instead would also keep the character's dark
    outline, leaving a ghost of it floating inside the effect. Small blobs are
    dropped so a pink ear tip or eye never counts as an effect -- and a frame
    with no effect at all, like the wind-up poses, correctly yields nothing.
    """
    core = owned & fx_band
    kept = np.zeros_like(core)
    for blob in components(core, min_area):
        kept |= blob
    return owned & dilate(kept, FX_GLOW_REACH) if kept.any() else kept


def _cut(name: str, anim: str, index: int, owned: np.ndarray,
         band_rgb: np.ndarray, band_alpha: np.ndarray, band: Band,
         anchor_x: int, anchor_y: int, scale: float) -> Frame:
    """Trim `owned` out of the band and turn it into a packed frame."""
    rows = np.nonzero(owned.any(axis=1))[0]
    cols = np.nonzero(owned.any(axis=0))[0]
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    left, right = int(cols[0]), int(cols[-1]) + 1

    cut_alpha = np.where(owned, band_alpha, 0.0)[top:bottom, left:right]
    image = Image.fromarray(
        np.dstack([band_rgb[top:bottom, left:right], cut_alpha * 255.0]).astype(np.uint8),
        "RGBA",
    )
    if abs(scale - 1.0) > 0.01:
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.LANCZOS,
        )
    body_rows = np.nonzero(owned.any(axis=1))[0]
    return Frame(
        name=name, anim=anim, index=index,
        dx=(left + band.x0 - anchor_x) * scale,
        dy=(top + band.y0 - anchor_y) * scale,
        body_h=(int(body_rows[-1] - body_rows[0]) + 1) * scale,
        image=image,
    )


def collect_frames(rgb: np.ndarray, alpha: np.ndarray, spec: SheetSpec) -> list[Frame]:
    body = spec.body(rgb, alpha)
    fx = spec.fx(rgb, alpha) if spec.fx else None
    pivot = spec.pivot(rgb, alpha) if spec.pivot else None
    isolate_mask = spec.fx_isolate or spec.fx
    isolate = isolate_mask(rgb) if isolate_mask else None
    scales = band_scales(body, spec)
    frames: list[Frame] = []

    for band in spec.bands:
        clusters = cluster_bodies(body, band, spec)
        if len(clusters) != band.expected:
            raise SystemExit(
                f"[{spec.name}/{band.key}] found {len(clusters)} frames, "
                f"expected {band.expected}.\n"
                f"  The source art changed -- update this sheet's bands.\n"
                f"  detected x-ranges: {clusters}"
            )

        labels = segment(band, spec, alpha, body, fx, clusters)
        anchor_y = _band_anchor_y(body, band, spec.anchor)
        ys, xs = slice(band.y0, band.y1), slice(band.x0, band.x1)
        band_rgb = recolour(rgb[band.y0:band.y1, band.x0:band.x1], spec)
        band_alpha = alpha[band.y0:band.y1, band.x0:band.x1]

        for i, (lo, hi) in enumerate(clusters):
            owned = labels == i
            if not owned.any():
                raise SystemExit(f"[{spec.name}/{band.key}] frame {i} claimed no pixels")

            rows = np.nonzero(owned.any(axis=1))[0]
            cols = np.nonzero(owned.any(axis=0))[0]
            top, bottom = int(rows[0]), int(rows[-1]) + 1
            left, right = int(cols[0]), int(cols[-1]) + 1

            cut_alpha = np.where(owned, band_alpha, 0.0)[top:bottom, left:right]
            image = Image.fromarray(
                np.dstack([band_rgb[top:bottom, left:right], cut_alpha * 255.0]).astype(np.uint8),
                "RGBA",
            )

            # Resampling here, once, with a good kernel beats leaving the GPU to
            # scale the sprite every frame with a bilinear filter -- and it keeps
            # one uniform sprite scale at runtime.
            scale = scales.get(band.key, 1.0)
            if abs(scale - 1.0) > 0.01:
                image = image.resize(
                    (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                    Image.LANCZOS,
                )

            frame_body = owned & body[band.y0:band.y1, band.x0:band.x1]
            body_rows = np.nonzero(frame_body.any(axis=1))[0]
            body_h = (int(body_rows[-1] - body_rows[0]) + 1) * scale if len(body_rows) else 0.0

            anchor_y_frame = anchor_y
            pivot_here = pivot[ys, xs] & owned if pivot is not None else None
            if pivot_here is not None and pivot_here.sum() >= 80:
                py, px = np.nonzero(pivot_here)
                anchor_x = int(px.mean()) + band.x0
                anchor_y_frame = int(py.mean()) + band.y0
            elif band.grid_cols:
                cell = (band.x1 - band.x0) / band.grid_cols
                anchor_x = int(band.x0 + (i + 0.5) * cell)
            else:
                anchor_x = (lo + hi) // 2
            name = band.names[i] if band.names else f"{band.key}-{i:02d}"

            if (band.fx_alias or band.clean_alias) and isolate is not None:
                effect = self_effect(
                    owned, isolate[band.y0:band.y1, band.x0:band.x1],
                    spec.fx_isolate_min_area,
                )
                if band.fx_alias and effect.any():
                    frames.append(_cut(
                        f"{band.fx_alias}-{i:02d}", band.fx_alias, i, effect,
                        rotate_hue(band_rgb, band.fx_hue_shift),
                        band_alpha, band, anchor_x, anchor_y, scale,
                    ))
                if band.clean_alias:
                    # Emitted for every frame, effect or not, so the clean clip
                    # keeps the same length and timing as the original. The
                    # effect is grown before subtracting: its soft edge falls
                    # below the blob threshold that isolates it, and those
                    # crumbs are plainly visible once the swirl around them is
                    # gone.
                    clean = owned & ~dilate(effect, CLEAN_MARGIN)
                    if clean.any():
                        frames.append(_cut(
                            f"{band.clean_alias}-{i:02d}", band.clean_alias, i, clean,
                            band_rgb, band_alpha, band, anchor_x, anchor_y, scale,
                        ))

            frames.append(Frame(
                name=name,
                anim=band.key,
                index=i,
                dx=(left + band.x0 - anchor_x) * scale,
                dy=(top + band.y0 - anchor_y_frame) * scale,
                body_h=body_h,
                image=image,
            ))
    return frames


def measure_cell(frames: list[Frame]) -> tuple[int, int, int, int]:
    """One source box shared by every frame.

    Frames are positioned by body centre horizontally and by their band's
    anchor line vertically, so a sprite using the resulting origin keeps the
    character planted and stops the body sliding between frames -- while still
    preserving deliberate motion like a jump arc or a hover bob, since the
    anchor is constant across a band but the artwork is not.
    """
    left = max(-f.dx for f in frames)
    right = max(f.dx + f.w for f in frames)
    up = max(-f.dy for f in frames)
    down = max(max(f.dy + f.h, 0.0) for f in frames)
    return ceil(left), ceil(right), ceil(up), ceil(down)


def pack(frames: list[Frame], padding: int = PADDING) -> tuple[int, int]:
    """Shelf packer: tallest first, into rows of a fixed width."""
    ordered = sorted(frames, key=lambda f: -f.h)
    area = sum((f.w + padding) * (f.h + padding) for f in frames)
    # Wide enough for the total area *and* for the widest single frame. Area
    # alone is not enough: a sheet holding one wide frame has a small area and
    # picks a narrow atlas, and the frame is then written past its right edge
    # and cropped away. The HUD's hotbar plate is 736px of a 512px canvas.
    widest = max(f.w for f in frames) + padding * 2
    width = 512
    while width < widest or width * width < area * 1.3:
        width *= 2

    x = y = shelf = 0
    for f in ordered:
        if x + f.w + padding > width:
            x, y, shelf = 0, y + shelf + padding, 0
        f.x, f.y = x + padding, y + padding
        x += f.w + padding
        shelf = max(shelf, f.h)
    return width, y + shelf + padding * 2


# --- output -----------------------------------------------------------------

def write_typescript(spec: SheetSpec, frames: list[Frame],
                     cell: tuple[int, int, int, int], path: Path) -> None:
    """Emit the frame table as TypeScript.

    The atlas JSON stays pure Phaser; this is what the game imports, so a frame
    that vanishes from the sheet becomes a compile error rather than a blank
    sprite at runtime.
    """
    left, _right, up, _down = cell
    width, height = cell[0] + cell[1], cell[2] + cell[3]
    upper = spec.name.upper()

    by_anim: dict[str, list[str]] = {}
    for f in frames:
        by_anim.setdefault(f.anim, []).append(f.name)

    anchored = "feet" if spec.anchor == "feet" else "vertical centre"
    reference = spec.normalize_to or spec.bands[0].key
    body_h = float(np.median([f.body_h for f in frames if f.anim == reference]))

    lines = [
        "// GENERATED by scripts/build_atlas.py -- do not edit by hand.",
        "// Regenerate with: npm run assets",
        "",
        f"export const {upper}_TEXTURE_KEY = {json.dumps(spec.name)} as const;",
        "",
        "/** How tall the character itself is inside the frame box, 0..1.",
        " *  Cells are padded by trails and motion range, so this -- not the frame",
        " *  height -- is what two characters must be compared on to size them",
        " *  relative to each other. */",
        f"export const {upper}_BODY_RATIO = {body_h / height:.5f} as const;",
        "",
        "/** Every frame shares this source box, so one origin works for all of them. */",
        f"export const {upper}_FRAME_SIZE = {{ width: {width}, height: {height} }} as const;",
        "",
        f"/** Origin on the body centre and its {anchored}. */",
        f"export const {upper}_ANCHOR = "
        f"{{ x: {left / width:.5f}, y: {up / height:.5f} }} as const;",
        "",
        f"export const {upper}_FRAMES = {{",
    ]
    for anim, names in by_anim.items():
        key = anim if anim.isidentifier() else json.dumps(anim)
        lines.append(f"  {key}: [{', '.join(json.dumps(n) for n in names)}],")
    lines += [
        "} as const;",
        "",
        f"export type {spec.name.capitalize()}Clip = keyof typeof {upper}_FRAMES;",
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def build(spec: SheetSpec, out_dir: Path, ts_out: Path) -> None:
    """Run the whole pipeline for one sheet."""
    if not spec.source.exists():
        raise SystemExit(f"source art not found: {spec.source}")

    source = Image.open(spec.source).convert("RGBA")
    pixels = np.asarray(source).astype(np.float32)
    rgb, source_alpha = pixels[:, :, :3], pixels[:, :, 3] / 255.0
    keep = band_mask(spec, rgb.shape[:2])

    if spec.key == "black":
        # Blank outside the bands *before* keying: this mode dilates outward,
        # far enough to drag a label's rule line into the row beneath it.
        alpha = build_alpha(rgb * keep[:, :, None], spec)
    elif spec.key == "green":
        # Masking the colour here would turn the gaps black, and black is not
        # green -- the whole sheet would key as opaque. Mask the alpha instead.
        alpha = chroma_alpha(rgb) * keep
        rgb = despill(rgb)
    elif spec.key == "alpha":
        alpha = source_alpha * keep
    else:
        raise SystemExit(f"[{spec.name}] unknown key mode {spec.key!r}")

    alpha = strip_grid_lines(alpha, spec)
    frames = collect_frames(rgb, alpha, spec)

    left, right, up, down = cell = measure_cell(frames)
    cell_w, cell_h = left + right, up + down
    atlas_w, atlas_h = pack(frames)

    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    entries: dict[str, dict] = {}
    for f in frames:
        atlas.paste(f.image, (f.x, f.y))
        entries[f.name] = {
            "frame": {"x": f.x, "y": f.y, "w": f.w, "h": f.h},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {
                "x": round(left + f.dx),
                "y": round(up + f.dy),
                "w": f.w,
                "h": f.h,
            },
            "sourceSize": {"w": cell_w, "h": cell_h},
        }

    out_dir.mkdir(parents=True, exist_ok=True)
    atlas.save(out_dir / f"{spec.name}.png", optimize=True)
    (out_dir / f"{spec.name}.json").write_text(json.dumps({
        "frames": entries,
        "meta": {
            "app": "scripts/build_atlas.py",
            "image": f"{spec.name}.png",
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }, indent=1), encoding="utf-8")

    write_typescript(spec, frames, cell, ts_out)

    size_kb = (out_dir / f"{spec.name}.png").stat().st_size / 1024
    print(f"{spec.name}: atlas {atlas_w}x{atlas_h} ({size_kb:.0f} KB)  "
          f"cell {cell_w}x{cell_h}  anchor ({left / cell_w:.3f}, {up / cell_h:.3f})  "
          f"{len(frames)} frames")
    for band in spec.bands:
        print(f"    {band.key:<14} {sum(1 for f in frames if f.anim == band.key)}")
