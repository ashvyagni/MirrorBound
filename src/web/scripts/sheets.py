#!/usr/bin/env python3
"""Per-sheet definitions: where the rows are, and how to recognise a body."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from atlaslib import Band, SheetSpec

ASSETS = Path(__file__).resolve().parents[3] / "assets"


# --- goat -------------------------------------------------------------------

def _goat_body(rgb: np.ndarray, _alpha: np.ndarray) -> np.ndarray:
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


def _goat_fx(rgb: np.ndarray, _alpha: np.ndarray) -> np.ndarray:
    """Bright cores of the pink attack swirls, excluding their dim glow.

    The glow haloes merge every swirl into one blob; the cores stay separate,
    which is what makes per-frame ownership decidable.
    """
    return (rgb.max(axis=2) > 110) & (rgb[:, :, 2] > rgb[:, :, 1] + 12)


GOAT = SheetSpec(
    name="goat",
    source=ASSETS / "characters" / "goat.jpg",
    body=_goat_body,
    fx=_goat_fx,
    fx_isolate=_goat_swirl,
    anchor="feet",
    bands=(
        Band("idle",    50,  325,    0,  720,  6),
        Band("walk",    50,  325,  720, 1448,  6),
        Band("run",    350,  632,    0,  745,  5),
        Band("jump",   350,  632,  745, 1448,  6),
        Band("attack", 660,  880,    0,  960,  6, fx_alias="swirl", clean_alias="strike",
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

def _bro_body(rgb: np.ndarray, _alpha: np.ndarray) -> np.ndarray:
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
    source=ASSETS / "characters" / "bro.jpg",
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


# --- weapons ----------------------------------------------------------------

def _weapon_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The solid weapon, without its trail.

    Clustering only needs to find where each weapon *is*; including the glow
    would let a long trail drag a frame's measured centre off the blade.
    """
    return (alpha > 0.55) & (rgb.max(axis=2) > 70)


def _weapon_grip(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The dark leather grip -- the part a hand would be wrapped around.

    Every weapon on these sheets has one, and it is the only landmark that
    stays put while the rest of the weapon rotates, so it is what each frame
    pivots on.

    `G >= B` is what rejects the magenta trails. Brown runs R > G > B; magenta
    runs R > B > G, and its darker outline passes both the brightness and the
    `R > B` tests -- a fifth to a third of everything the looser version caught
    on these sheets was trail outline, which drags the pivot off the handle and
    makes the weapon skate as it swings.
    """
    value = rgb.max(axis=2)
    return (
        (alpha > 0.5)
        & (value < 150)
        & (rgb[:, :, 0] > rgb[:, :, 2] + 12)
        & (rgb[:, :, 1] >= rgb[:, :, 2])
    )


def _weapon(name: str, source: str, key: str) -> SheetSpec:
    """Every weapon sheet has the same shape: 8 frames, 4 across and 2 down.

    Anchoring on the grid rather than on content is what keeps the swing a
    swing -- the artwork travels within its cell, and pinning each frame to its
    own centre would cancel exactly that motion out.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / source,
        body=_weapon_body,
        pivot=_weapon_grip,
        anchor="center",
        key=key,
        body_min_area=150,
        bands=(
            Band("swing", 0, 512, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"swing-{i:02d}" for i in range(4))),
            Band("swing_b", 512, 1024, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"swing-{i:02d}" for i in range(4, 8))),
        ),
    )


#: Melee swings. Every sheet in this round arrived chroma-keyed, so there is no
#: longer a mix of keying modes to keep track of.
SWORD_A = _weapon("swordA", "weapons/sword-a.png", "green")
SWORD_B = _weapon("swordB", "weapons/sword-b.png", "green")
SWORD_C = _weapon("swordC", "weapons/sword-c.png", "green")
BOW = _weapon("bow", "weapons/bow.png", "green")
FIRE_STAFF = _weapon("fireStaff", "weapons/fire-staff.png", "green")
ICE_STAFF = _weapon("iceStaff", "weapons/ice-staff.png", "green")

#: Idle loops. Same shape as a swing, so the same builder covers them.
SWORD_IDLE = _weapon("swordIdle", "weapons/sword-idle.png", "green")
BOW_IDLE = _weapon("bowIdle", "weapons/bow-idle.png", "green")
FIRE_STAFF_IDLE = _weapon("fireStaffIdle", "weapons/fire-staff-idle.png", "green")
ICE_STAFF_IDLE = _weapon("iceStaffIdle", "weapons/ice-staff-idle.png", "green")

#: Cast animations: the weapon's own motion while an ability fires. Shaped
#: exactly like a swing -- the weapon rotating about its grip -- so the same
#: builder covers them, and they pivot on the grip for the same reason.
ARROW_CAST = _weapon("arrowCast", "casts/arrow.png", "green")
FIRE_BALL_CAST = _weapon("fireBallCast", "casts/fire-ball.png", "green")
FIRE_PILLAR_CAST = _weapon("firePillarCast", "casts/fire-pillar.png", "green")
FIRE_WAVE_CAST = _weapon("fireWaveCast", "casts/fire-wave.png", "green")
ICE_SHARDS_CAST = _weapon("iceShardsCast", "casts/ice-shards.png", "green")
ICE_NOVA_CAST = _weapon("iceNovaCast", "casts/ice-nova.png", "green")
ICE_BEAM_CAST = _weapon("iceBeamCast", "casts/ice-beam.png", "green")

CASTS = (ARROW_CAST, FIRE_BALL_CAST, FIRE_PILLAR_CAST, FIRE_WAVE_CAST,
         ICE_SHARDS_CAST, ICE_NOVA_CAST, ICE_BEAM_CAST)


# --- the goat's other two facings -------------------------------------------

def _goat_facing_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The goat's cream body on a chroma-keyed sheet.

    Simpler than the original sheet's test, which had to separate warm cream
    from a pink effect baked into the same image. These carry no effects, so
    "opaque and bright" is the whole of it.
    """
    return (alpha > 0.5) & (rgb.max(axis=2) > 80)


def _facing(name: str, source: str) -> SheetSpec:
    """A locomotion sheet for one facing: 8 frames, 4 across and 2 down.

    `anchor="feet"` because the goat stands on the floor and the game plants it
    by its footing -- the same reason the original sheet uses it. Anchoring on
    the cell instead would let the creature bob through the ground as the fur
    hem changes shape across the cycle.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / source,
        body=_goat_facing_body,
        anchor="feet",
        key="green",
        body_min_area=400,
        bands=(
            Band("walk", 0, 512, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"walk-{i:02d}" for i in range(4))),
            Band("walk_b", 512, 1024, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"walk-{i:02d}" for i in range(4, 8))),
        ),
    )


#: Walking away from the camera and toward it. The original sheet is drawn
#: side-on, which cannot show either, and its idle row is already front-facing
#: -- so these fill the two facings two-axis movement asks for.
GOAT_BACK = _facing("goatBack", "characters/goat-back.png")
GOAT_FRONT = _facing("goatFront", "characters/goat-front.png")

FACINGS = (GOAT_BACK, GOAT_FRONT)


# --- shields ----------------------------------------------------------------

def _shield(name: str, source: str, anim: str) -> SheetSpec:
    """A shield sheet.

    No `pivot`, unlike every other weapon. A shield is not swung around a
    handle -- it is *raised* -- and the whole point of the block clip is that
    rise. Pinning each frame to the shield's own centre would hold it still and
    delete the only motion in the sheet, so these anchor on their cell instead.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / source,
        body=_weapon_body,
        anchor="center",
        key="green",
        body_min_area=150,
        bands=(
            Band(anim, 0, 512, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"{anim}-{i:02d}" for i in range(4))),
            Band(f"{anim}_b", 512, 1024, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"{anim}-{i:02d}" for i in range(4, 8))),
        ),
    )


SHIELD_BLOCK = _shield("shieldBlock", "weapons/shield-block.png", "block")
SHIELD_PARRY = _shield("shieldParry", "weapons/shield-parry.png", "parry")

SHIELDS = (SHIELD_BLOCK, SHIELD_PARRY)


# --- spells and projectiles -------------------------------------------------

def _effect_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The bright part of an effect, used only to find where each frame is."""
    return (alpha > 0.5) & (rgb.max(axis=2) > 90)


def _spell(name: str, source: str, key: str) -> SheetSpec:
    """A cast effect or a projectile.

    No `pivot`: unlike a weapon there is no handle to hold it by, so frames
    anchor on their cell. That is also what preserves a travelling or expanding
    effect -- pinning it to its own centre would hold it still.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / source,
        body=_effect_body,
        anchor="center",
        key=key,
        body_min_area=120,
        bands=(
            Band("cast", 0, 512, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"cast-{i:02d}" for i in range(4))),
            Band("cast_b", 512, 1024, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"cast-{i:02d}" for i in range(4, 8))),
        ),
    )


ARROW = _spell("arrow", "spells/arrow.png", "green")
ICE_NOVA = _spell("iceNova", "spells/ice-nova.png", "green")
ICE_SHARDS = _spell("iceShards", "spells/ice-shards.png", "green")
FIRE_BALL = _spell("fireBall", "spells/fire-ball.png", "green")
FIRE_PILLAR = _spell("firePillar", "spells/fire-pillar.png", "green")
FIRE_WAVE = _spell("fireWave", "spells/fire-wave.png", "green")

#: The beam is the one sheet not drawn four across and two down.
#:
#: Reach is the whole point of it, and a 384px cell caps how long a beam can be
#: drawn relative to its own thickness. Laid out two across and four down the
#: cell is 768x256, so the same image holds a beam at roughly four times the
#: aspect -- which is why this one needs no runtime stretching while the old
#: sheet needed 2.2x.
ICE_BEAM = SheetSpec(
    name="iceBeam",
    source=ASSETS / "spells" / "ice-beam.png",
    body=_effect_body,
    anchor="center",
    key="green",
    body_min_area=120,
    bands=tuple(
        Band(f"cast{'' if row == 0 else f'_{row}'}",
             row * 256, (row + 1) * 256, 0, 1536, 2, grid_cols=2,
             names=(f"cast-{row * 2:02d}", f"cast-{row * 2 + 1:02d}"))
        for row in range(4)
    ),
)

SPELLS = (ARROW, ICE_NOVA, ICE_SHARDS, ICE_BEAM, FIRE_BALL, FIRE_PILLAR, FIRE_WAVE)


# --- the practice dummy -----------------------------------------------------

def _dummy_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    return (alpha > 0.5) & (rgb.max(axis=2) > 80)


DUMMY = SheetSpec(
    name="dummy",
    source=ASSETS / "characters" / "dummy.png",
    body=_dummy_body,
    anchor="feet",     # it is planted in the ground, so it pins to its base
    key="green",
    body_min_area=200,
    bands=(
        Band("hit", 0, 512, 0, 1536, 4, grid_cols=4,
             names=tuple(f"hit-{i:02d}" for i in range(4))),
        Band("hit_b", 512, 1024, 0, 1536, 4, grid_cols=4,
             names=tuple(f"hit-{i:02d}" for i in range(4, 8))),
    ),
)

WEAPONS = (SWORD_A, SWORD_B, SWORD_C, BOW, FIRE_STAFF, ICE_STAFF,
           SWORD_IDLE, BOW_IDLE, FIRE_STAFF_IDLE, ICE_STAFF_IDLE)


# --- ability icons ----------------------------------------------------------

def _icon_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The icon itself. These arrive with clean alpha, so it is the whole test."""
    return alpha > 0.5


#: Static single-frame icons, one per ability plus the sword for melee. Laid
#: out on the same 4x2 grid as the spell sheets, so the same builder covers it.
#: `grid_cols` matters here for the same reason it does there: the artist
#: centred each icon in its cell, and pinning one to its own bounds would
#: make a wide icon and a tall one disagree about where their middle is.
ICONS = SheetSpec(
    name="icons",
    source=ASSETS / "ui" / "icons.png",
    body=_icon_body,
    anchor="center",
    key="alpha",
    body_min_area=200,
    #: Drawn at ~370px but never rendered above ~34, so the full-size sheet is
    #: a megabyte of atlas spent on nothing. 128px leaves room for a retina
    #: screen and still fits in a tenth of the space.
    downscale=128 / 374,
    bands=(
        Band("icon", 0, 512, 0, 1536, 4, grid_cols=4,
             names=("fireBall", "firePillar", "fireWave", "arrow")),
        Band("icon_b", 512, 1024, 0, 1536, 4, grid_cols=4,
             names=("iceNova", "iceShards", "iceBeam", "sword")),
    ),
)


# --- HUD chrome -------------------------------------------------------------

def _ui_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The piece itself. Chroma-keyed, so the alpha is the whole test."""
    return alpha > 0.5


def _ui(name: str, file: str, bands: tuple[Band, ...], downscale: float) -> SheetSpec:
    """One piece of interface chrome per frame.

    `anchor="center"` rather than "feet": none of these stand on anything, and
    the game positions each one by its own middle.

    `downscale` is always a half or a quarter. The art is drawn with hard
    aliased edges on a pixel grid, and a good resampling kernel spends exactly
    that -- resampled by 0.25 a stepped edge stays stepped, resampled by 0.31 it
    comes back with a row of in-between pixels and the pixel look is gone. It is
    the one number on this page that cannot be picked by eye.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / "ui" / file,
        body=_ui_body,
        anchor="center",
        key="green",
        downscale=downscale,
        bands=bands,
    )


#: The ring the goat's portrait sits inside. Deliberately open across the top --
#: the face frames already on the goat sheet are drawn behind it and rise clear
#: of the thinner arc, which is why no face is generated for the HUD.
PORTRAIT_RING = _ui("portraitRing", "portrait-ring.png", (
    Band("ring", 0, 1254, 0, 1254, 1, names=("ring",)),
), 0.25)

#: Two empty troughs, health above mana. One band each rather than one band of
#: two, because bands cluster horizontally and these are stacked -- a single
#: band would find one frame where there are two.
STATUS_BARS = _ui("statusBars", "status-bars.png", (
    Band("hp", 0, 512, 0, 1536, 1, names=("hp",)),
    Band("mp", 512, 1024, 0, 1536, 1, names=("mp",)),
), 0.25)

MINIMAP_RING = _ui("minimapRing", "minimap-ring.png", (
    Band("ring", 0, 1254, 0, 1254, 1, names=("ring",)),
), 0.25)

#: Rest and pressed. `grid_cols` because the two must register exactly: the
#: press is a 16px shift of the interior, and anchoring each on its own content
#: would cancel that shift out and leave a button that does nothing when clicked.
SETTINGS_BUTTON = _ui("settingsButton", "settings-button.png", (
    Band("button", 0, 1024, 0, 1536, 2, grid_cols=2, names=("rest", "press")),
), 0.25)

HOTBAR = _ui("hotbar", "hotbar.png", (
    Band("plate", 0, 1024, 0, 1536, 1, names=("plate",)),
), 0.5)

#: One frame, not eight. The game rotates the texture, which is smooth at any
#: step count and cannot go out of sync with how many potions are carried.
POTION_DIAL = _ui("potionDial", "potion-dial.png", (
    Band("dial", 0, 1254, 0, 1254, 1, names=("dial",)),
), 0.25)

#: The rail and one socket. Sockets are stacked into the rail at runtime rather
#: than drawn as a fixed column, because the number of skills recharging changes
#: from moment to moment and a baked column would be wrong most of the time.
COOLDOWN_RAIL = _ui("cooldownRail", "cooldown-rail.png", (
    Band("rail", 0, 1536, 0, 1024, 2, names=("rail", "socket")),
), 0.5)

UI = (PORTRAIT_RING, STATUS_BARS, MINIMAP_RING, SETTINGS_BUTTON,
      HOTBAR, POTION_DIAL, COOLDOWN_RAIL)


# --- enemies ----------------------------------------------------------------

def _mob_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """The creature itself.

    Looser than `_weapon_body`: a mob's darkest designs -- the Gloom Hound is
    near-black by intent, the Ember Acolyte is charcoal cloth -- fail a
    brightness test that a bone-white sword passes easily. Chroma keying has
    already separated art from background, so the alpha is nearly the whole
    answer and the brightness floor only rejects key spill along the edges.
    """
    return (alpha > 0.5) & (rgb.max(axis=2) > 24)


def _mob(name: str, file: str) -> SheetSpec:
    """One animation of one creature: 8 frames, 4 across and 2 down.

    `anchor="feet"` pins the band's lowest body pixel, which is why every mob
    prompt insists on a ground line the artwork's lowest pixel sits on -- that
    line is what the game plants on the floor, and a sheet drawn with air under
    its feet floats by exactly that much.

    `grid_cols=4` anchors each frame on its cell rather than on its own bounds.
    A walk cycle drawn in place needs it: anchoring on content would pull every
    frame back to a common centre and cancel the step out of the walk.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / "enemies" / file,
        body=_mob_body,
        anchor="feet",
        key="green",
        body_min_area=300,
        bands=(
            Band("a", 0, 512, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"f-{i:02d}" for i in range(4))),
            Band("b", 512, 1024, 0, 1536, 4, grid_cols=4,
                 names=tuple(f"f-{i:02d}" for i in range(4, 8))),
        ),
    )


#: Every creature, in the order `docs/art-prompts-2.md` makes them. The key is
#: the texture name the game imports; the value is the source file.
MOB_IDS = (
    "sprout", "brute", "spitter",                       # grove
    "shardling", "warden", "acolyte", "scarab",         # ruins
    "skeleton", "archer", "hound", "slime",             # crypt
)
MOB_CLIPS = ("idle", "alert", "walk", "attack")

MOBS = tuple(
    _mob(f"{mob}{clip.capitalize()}", f"{mob}-{clip}.png")
    for mob in MOB_IDS
    for clip in MOB_CLIPS
)

#: The mark that pops over whichever mob just noticed you. One sheet for all
#: eleven, composited above them -- see the note in `art-prompts-2.md`.
#: `anchor="center"`: it stands on nothing, and the game places it by its middle.
#:
#: Six frames, not the eight the sheet was asked for. The prompt ended with two
#: fading frames and warned that a fade has to arrive as real alpha; it did not.
#: Frame 7 came back with thirteen pixels above half opacity and frame 8 keyed
#: out entirely -- a max alpha of 0.000, which is to say the generator drew flat
#: background there. So the sheet supplies the pop and the hold, and the game
#: fades the mark with an alpha tween: smoother than two frames could be, any
#: duration you like, and impossible to desync from the mob that raised it.
ALERT_MARK = SheetSpec(
    name="alertMark",
    source=ASSETS / "enemies" / "alert-mark.png",
    body=_mob_body,
    anchor="center",
    key="green",
    body_min_area=120,
    bands=(
        Band("mark", 0, 512, 0, 1536, 4, grid_cols=4,
             names=tuple(f"mark-{i:02d}" for i in range(4))),
        Band("mark_b", 512, 1024, 0, 768, 2, grid_cols=2,
             names=("mark-04", "mark-05")),
    ),
)

#: Enemy projectiles. Same shape as the player's spells, so the same builder.
THORN = _spell("thorn", "spells/thorn.png", "green")
COAL = _spell("coal", "spells/coal.png", "green")

ENEMIES = (*MOBS, ALERT_MARK, THORN, COAL)


# --- the rest of the interface ----------------------------------------------

#: A 9-slice panel border: one frame, the whole canvas, no grid. The pipeline
#: has no 9-slice mode, so it ships as a single image and the DOM slices it with
#: `border-image` -- which is one CSS line and needs no pipeline work.
SCREEN_FRAME = _ui("screenFrame", "screen-frame.png", (
    Band("frame", 0, 1024, 0, 1024, 1, names=("frame",)),
), 0.5)

CONTROLS = _ui("controls", "controls.png", (
    Band("a", 0, 512, 0, 1536, 4, grid_cols=4,
         names=("button", "buttonPress", "toggleOff", "toggleOn")),
    Band("b", 512, 1024, 0, 1536, 4, grid_cols=4,
         names=("sliderTrack", "sliderKnob", "tab", "tabActive")),
), 0.5)

MAP_TOKENS = _ui("mapTokens", "map-tokens.png", (
    Band("a", 0, 512, 0, 1536, 4, grid_cols=4,
         names=("roomUnvisited", "roomVisited", "roomCleared", "roomCurrent")),
    Band("b", 512, 1024, 0, 1536, 4, grid_cols=4,
         names=("treasure", "elite", "boss", "corridor")),
), 0.5)

#: Stacked, so one band each -- bands cluster horizontally and two pieces one
#: above the other would read as a single frame.
BOSS_BAR = _ui("bossBar", "boss-bar.png", (
    Band("bar", 0, 512, 0, 1536, 1, names=("bar",)),
    Band("divider", 512, 1024, 0, 1536, 1, names=("divider",)),
), 0.25)

#: Three marks in the top row; the rest of the grid is deliberately empty, so
#: the next flourish is a redraw of one cell rather than a new sheet.
FLOURISHES = _ui("flourishes", "flourishes.png", (
    Band("mark", 0, 512, 0, 1152, 3, grid_cols=3,
         names=("death", "victory", "levelUp")),
), 0.5)

SCREENS = (SCREEN_FRAME, CONTROLS, MAP_TOKENS, BOSS_BAR, FLOURISHES)

SHEETS = (GOAT, BRO, DUMMY, *FACINGS, *WEAPONS, *CASTS, *SHIELDS, *SPELLS,
          ICONS, *UI, *SCREENS, *ENEMIES)
