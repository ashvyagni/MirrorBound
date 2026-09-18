#!/usr/bin/env python3
"""
Build a Phaser texture atlas from the flat `goatsprite.jpg` character sheet.

The source sheet is a JPEG on black: no alpha, no uniform grid, and the art is
drawn with near-black outlines that are *the same value as the background*.
Three problems, three answers:

  1. Keying. A luminance threshold would dissolve the outlines, so the
     silhouette is recovered morphologically instead: take pixels that are
     certainly artwork (bright), dilate outward to swallow the surrounding
     outline, fill interior holes, smooth. Value never decides whether an
     outline pixel survives -- geometry does.

  2. Finding frames. Rows hold different frame counts at different pitches, so
     frames are located by isolating the *body* (warm cream: low saturation
     with G >= B, which rejects the pink FX) and clustering it.

  3. Splitting frames. This is the hard one. The attack swirls belong to the
     goat on their left but arc up and over into the next frame's column, so
     any straight cut either clips a swirl or leaves a slice of it stuck to the
     neighbour. Instead each frame is *seeded* -- with its body, and with the
     swirl cores that overlap that body -- and the seeds are then grown through
     the artwork, so every pixel is claimed by the frame it actually belongs
     to. Frames are allowed to overlap in sheet space; they get their own cell
     in the atlas regardless.

Output: public/game/goat/{goat.png,goat.json} in Phaser "JSON Hash" format with
trim metadata, plus a generated TypeScript frame table for the game to import.

Run: npm run assets
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WEB = Path(__file__).resolve().parents[1]
SOURCE = WEB.parents[1] / "assets" / "goatsprite.jpg"
OUT_DIR = WEB / "public" / "game" / "goat"
TS_OUT = WEB / "src" / "game" / "animation" / "goatAtlas.generated.ts"
TEXTURE_NAME = "goat"

# Keying
BRIGHT_THRESHOLD = 55    # certainly artwork, never background
OUTLINE_DILATE = 4       # grow the bright core to capture the dark outline
MASK_SMOOTH = 1.1        # round off the blocky dilation
EDGE_FEATHER = 0.6       # final alpha feather

# Body isolation (locating frames only, never cutting alpha)
BODY_MIN_VALUE = 110
BODY_MAX_SAT = 45
BODY_MIN_AREA = 600

# FX isolation (pink swirls)
FX_MIN_VALUE = 110
FX_BLUE_LEAD = 12        # blue leads green in the magenta FX, unlike warm cream
FX_MIN_AREA = 400

PADDING = 2              # transparent gutter, stops neighbours bleeding at mip levels


@dataclass(frozen=True)
class Band:
    """One horizontal strip of the sheet holding a single animation."""
    key: str
    y0: int
    y1: int
    x0: int
    x1: int
    expected: int


# Measured from the sheet. `expected` is asserted at build time so a re-export
# of the art that changes frame counts fails loudly instead of silently
# producing broken animations.
BANDS = [
    Band("idle",    50,  325,    0,  720,  6),
    Band("walk",    50,  325,  720, 1448,  6),
    Band("run",    350,  632,    0,  745,  5),
    Band("jump",   350,  632,  745, 1448,  6),
    Band("attack", 660,  880,    0,  960,  6),
    Band("hurt",   660,  880,  960, 1120,  1),
    Band("die",    660,  880, 1120, 1448,  1),
    Band("face",   885, 1062,    0, 1388, 10),
]

FACE_NAMES = [
    "normal", "happy", "excited", "angry", "sad",
    "surprised", "confused", "sleepy", "wink", "blush",
]


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


# --- keying -----------------------------------------------------------------

def build_alpha(rgb: np.ndarray) -> np.ndarray:
    """Recover a 0..1 alpha channel for artwork drawn on black.

    The outlines are as dark as the background, so they cannot be separated by
    value -- only by position. Everything bright is certainly artwork; growing
    that outward by the outline's thickness and filling the interior recovers
    the true silhouette, outlines intact.
    """
    value = rgb.max(axis=2)
    core = value > BRIGHT_THRESHOLD
    silhouette = ~flood_from_border(~dilate(core, OUTLINE_DILATE))

    smoothed = Image.fromarray((silhouette * 255).astype(np.uint8))
    smoothed = smoothed.filter(ImageFilter.GaussianBlur(MASK_SMOOTH))
    silhouette = np.asarray(smoothed).astype(np.float32) > 127

    feathered = Image.fromarray((silhouette * 255).astype(np.uint8))
    feathered = feathered.filter(ImageFilter.GaussianBlur(EDGE_FEATHER))
    return np.asarray(feathered).astype(np.float32) / 255.0


def body_mask(rgb: np.ndarray) -> np.ndarray:
    """Warm cream artwork only.

    `G >= B` is what rejects the pink FX: cream is warm so green leads blue,
    while the magenta swirl -- including its white-hot core -- has blue leading
    green. Without this the FX reads as a body and frame centres drift.
    """
    value = rgb.max(axis=2)
    sat = value - rgb.min(axis=2)
    return (value > BODY_MIN_VALUE) & (sat < BODY_MAX_SAT) & (rgb[:, :, 1] >= rgb[:, :, 2])


def fx_mask(rgb: np.ndarray) -> np.ndarray:
    """Bright cores of the pink attack swirls, excluding their dim glow.

    The glow haloes merge every swirl into one blob; the cores stay separate,
    which is what makes per-frame ownership decidable.
    """
    value = rgb.max(axis=2)
    return (value > FX_MIN_VALUE) & (rgb[:, :, 2] > rgb[:, :, 1] + FX_BLUE_LEAD)


# --- segmentation -----------------------------------------------------------

def cluster_bodies(body: np.ndarray, band: Band) -> list[tuple[int, int]]:
    """One x-range per frame in the band.

    A single goat fragments into several blobs -- the horn spiral is cut off
    from the head by its own outline -- so blobs overlapping horizontally are
    merged back into one frame.
    """
    sub = body[band.y0:band.y1, band.x0:band.x1]
    spans: list[list[int]] = []
    for blob in components(sub, BODY_MIN_AREA):
        cols = np.nonzero(blob.any(axis=0))[0]
        spans.append([int(cols[0]) + band.x0, int(cols[-1]) + band.x0])

    spans.sort()
    merged: list[list[int]] = []
    for span in spans:
        if merged and span[0] <= merged[-1][1] - 6:
            merged[-1][1] = max(merged[-1][1], span[1])
        else:
            merged.append(span)
    return [(lo, hi) for lo, hi in merged]


def _owner(x0: int, x1: int, clusters: list[tuple[int, int]]) -> int:
    """Frame that a blob spanning [x0, x1] belongs to: most horizontal overlap,
    falling back to nearest when a blob sits clear of every body."""
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
    seed reaches it first *through the artwork* -- so a swirl that arcs into the
    next column still resolves to the goat it is attached to, which a straight
    cut can never do.
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


def segment(band: Band, alpha: np.ndarray, body: np.ndarray, fx: np.ndarray,
            clusters: list[tuple[int, int]]) -> np.ndarray:
    """Label every artwork pixel in the band with the frame that owns it."""
    ys, xs = slice(band.y0, band.y1), slice(band.x0, band.x1)
    region = alpha[ys, xs] > 0.08
    labels = np.full(region.shape, -1, dtype=np.int16)

    # Seed from bodies and from swirl cores, each claimed by the body it covers.
    for source, min_area in ((body[ys, xs], BODY_MIN_AREA), (fx[ys, xs], FX_MIN_AREA)):
        for blob in components(source & region, min_area):
            cols = np.nonzero(blob.any(axis=0))[0]
            owner = _owner(int(cols[0]) + band.x0, int(cols[-1]) + band.x0, clusters)
            labels[blob & (labels < 0)] = owner

    _grow(labels, region)

    # Detached extras -- the die-pose smoke, the attack sparkle, the hurt impact
    # marks -- are never reached by the flood, so place them by position.
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
    box: tuple[int, int, int, int]      # tight bounds in sheet space
    anchor_x: int                       # body centre
    baseline_y: int                     # band floor
    image: Image.Image = field(repr=False)
    x: int = 0                          # packed position in the atlas
    y: int = 0

    @property
    def w(self) -> int:
        return self.image.width

    @property
    def h(self) -> int:
        return self.image.height


def collect_frames(rgb: np.ndarray, alpha: np.ndarray) -> list[Frame]:
    body, fx = body_mask(rgb), fx_mask(rgb)
    frames: list[Frame] = []

    for band in BANDS:
        clusters = cluster_bodies(body, band)
        if len(clusters) != band.expected:
            raise SystemExit(
                f"[{band.key}] found {len(clusters)} frames, expected {band.expected}.\n"
                f"  The source art changed -- update BANDS in this script.\n"
                f"  detected x-ranges: {clusters}"
            )

        labels = segment(band, alpha, body, fx, clusters)
        band_rgb = rgb[band.y0:band.y1, band.x0:band.x1]
        band_alpha = alpha[band.y0:band.y1, band.x0:band.x1]

        # The floor is where the artist actually drew the feet -- the lowest
        # body pixel in the band -- not the band rectangle's edge, which has
        # slack below the art. Measuring it per band is what lands every
        # animation on the same ground line instead of hovering above it.
        band_body = body[band.y0:band.y1, band.x0:band.x1]
        body_rows = np.nonzero(band_body.any(axis=1))[0]
        baseline = band.y0 + int(body_rows[-1]) + 1

        for i, (lo, hi) in enumerate(clusters):
            owned = labels == i
            if not owned.any():
                raise SystemExit(f"[{band.key}] frame {i} claimed no pixels")

            rows = np.nonzero(owned.any(axis=1))[0]
            cols = np.nonzero(owned.any(axis=0))[0]
            top, bottom = int(rows[0]), int(rows[-1]) + 1
            left, right = int(cols[0]), int(cols[-1]) + 1

            cut_alpha = np.where(owned, band_alpha, 0.0)[top:bottom, left:right]
            cut_rgb = band_rgb[top:bottom, left:right]
            image = Image.fromarray(
                np.dstack([cut_rgb, cut_alpha * 255.0]).astype(np.uint8), "RGBA"
            )

            name = FACE_NAMES[i] if band.key == "face" else f"{band.key}-{i:02d}"
            frames.append(Frame(
                name=f"face-{name}" if band.key == "face" else name,
                anim=band.key,
                index=i,
                box=(left + band.x0, top + band.y0, right + band.x0, bottom + band.y0),
                anchor_x=(lo + hi) // 2,
                baseline_y=baseline,
                image=image,
            ))
    return frames


def measure_cell(frames: list[Frame]) -> tuple[int, int, int, int]:
    """One source box shared by every frame.

    Frames are positioned by body centre horizontally and by band floor
    vertically, so a sprite using the resulting anchor as its origin keeps the
    goat's feet planted and stops the body sliding between frames -- while
    still preserving deliberate vertical motion like the jump arc, since the
    floor is constant across a band but the artwork is not.
    """
    left = max(f.anchor_x - f.box[0] for f in frames)
    right = max(f.box[2] - f.anchor_x for f in frames)
    up = max(f.baseline_y - f.box[1] for f in frames)
    down = max(max(f.box[3] - f.baseline_y, 0) for f in frames)
    return left, right, up, down


def pack(frames: list[Frame], padding: int = PADDING) -> tuple[int, int]:
    """Shelf packer: tallest first, into rows of a fixed width."""
    ordered = sorted(frames, key=lambda f: -f.h)
    area = sum((f.w + padding) * (f.h + padding) for f in frames)
    width = 512
    while width * width < area * 1.3:
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

def write_typescript(frames: list[Frame], cell: tuple[int, int, int, int], path: Path) -> None:
    """Emit the frame table as TypeScript.

    The atlas JSON stays pure Phaser; this is what the game imports, so a frame
    that vanishes from the sheet becomes a compile error rather than a blank
    sprite at runtime.
    """
    left, right, up, down = cell
    width, height = left + right, up + down

    by_anim: dict[str, list[str]] = {}
    for f in frames:
        by_anim.setdefault(f.anim, []).append(f.name)

    lines = [
        "// GENERATED by scripts/build_atlas.py -- do not edit by hand.",
        "// Regenerate with: npm run assets",
        "",
        f"export const TEXTURE_KEY = {json.dumps(TEXTURE_NAME)} as const;",
        "",
        "/** Every frame shares this source box, so one origin works for all of them. */",
        f"export const FRAME_SIZE = {{ width: {width}, height: {height} }} as const;",
        "",
        "/** Origin placing the goat's body centre on x and its feet on y. */",
        f"export const ANCHOR = {{ x: {left / width:.5f}, y: {up / height:.5f} }} as const;",
        "",
        "export const GOAT_FRAMES = {",
    ]
    for anim, names in by_anim.items():
        lines.append(f"  {anim}: [{', '.join(json.dumps(n) for n in names)}],")
    lines += [
        "} as const;",
        "",
        "export type GoatClip = keyof typeof GOAT_FRAMES;",
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"source art not found: {SOURCE}")

    rgb = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float32)
    alpha = build_alpha(rgb)
    frames = collect_frames(rgb, alpha)

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
                "x": left - (f.anchor_x - f.box[0]),
                "y": up - (f.baseline_y - f.box[1]),
                "w": f.w,
                "h": f.h,
            },
            "sourceSize": {"w": cell_w, "h": cell_h},
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_DIR / f"{TEXTURE_NAME}.png", optimize=True)
    (OUT_DIR / f"{TEXTURE_NAME}.json").write_text(json.dumps({
        "frames": entries,
        "meta": {
            "app": "scripts/build_atlas.py",
            "image": f"{TEXTURE_NAME}.png",
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }, indent=1), encoding="utf-8")

    write_typescript(frames, cell, TS_OUT)

    size_kb = (OUT_DIR / f"{TEXTURE_NAME}.png").stat().st_size / 1024
    print(f"atlas   {atlas_w}x{atlas_h}  ({size_kb:.0f} KB)")
    print(f"cell    {cell_w}x{cell_h}  anchor ({left / cell_w:.3f}, {up / cell_h:.3f})")
    print(f"frames  {len(frames)}")
    for band in BANDS:
        print(f"  {band.key:<7} {sum(1 for f in frames if f.anim == band.key)}")


if __name__ == "__main__":
    main()
