# The `logesh` branch, so far

What this branch is, what is in it, and what is left. Written against the repo
rather than from memory: every count below is `wc -l` or `ls | wc -l` at the
commit that added this file.

Twenty commits since `7d351db`, the point `main` last merged from here.
**448 files, +32,463 lines.** 94 source sheets in `assets/`, 94 built atlases in
`src/web/public/game/`, 11,050 lines of TypeScript across 156 files, and 1,503
lines of Python in the asset pipeline.

---

## What it is

A standalone Phaser 4 + React client. No backend, no socket — everything runs
in the browser. `main` rewrote its own client into a server-driven renderer
while this branch was going; the two have not been merged since `7d351db`, and
the reconciliation notes are at the bottom.

---

## 1. The asset pipeline

`src/web/scripts/` — 1,503 lines of Python across three files.

`build_atlas.py` is a 40-line driver over `atlaslib.py` (the machinery) and
`sheets.py` (per-sheet band tables and body predicates). It takes AI-generated
sheets and emits a Phaser atlas plus a `*Atlas.generated.ts` per sheet, so a
missing frame is a compile error rather than a blank sprite.

Three keying modes: `black` (artwork on black with near-black outlines, where
only geometry can separate the two), `green` chroma, and `alpha`.

**Four bugs the art found, each after it failed:**

- **The packer sized atlases by total area**, which is right until one frame is
  wider than the width that picks. The hotbar plate is 736px on an atlas that
  sized itself 512, and a whole weapon slot was written past the edge and
  dropped silently.
- **Grid cells were not authoritative.** Two slimes in `slime-alert` touch
  across a cell boundary, so they key as one blob with one centre — one cell
  took it and its neighbour came back empty. A grid band now emits one span per
  cell and segmentation cuts a blob at the boundary.
- **`setDisplaySize` measures a frame's untrimmed source box, not its artwork.**
  The cooldown sheet holds a 132×736 rail and a 172×173 socket sharing a
  172×737 box, so asking for a 48px socket drew one 48 wide and 11 tall.
  `hud/fit.ts` sets a uniform scale instead and never touches the origin.
- **The alert mark's fade did not exist.** Its prompt warned a fade has to
  arrive as real alpha; frame 7 came back with 13 pixels above half opacity and
  frame 8 keyed out entirely — max alpha 0.000. The sheet is declared as six
  frames and the game fades it with a tween.

---

## 2. The character

- `entities/Goat.ts` — three sheets (side, back, front). `rowFor(aim)` picks
  between them with a bias that keeps a mostly-sideways diagonal on the side
  sheet, the only one with a profile in it. Sized by *body ratio*, not frame
  height, because the three sheets are cropped differently. A state machine
  table whose `interruptibleBy` column is the single place that says an attack
  cannot be cancelled by walking.
- `entities/Weapon.ts` — four weapons, idle loops, a three-hit sword combo, and
  per-ability cast motions with a `releaseFrame` so the spell leaves on the
  frame that throws it.
- `entities/Shield.ts` — the sword's guard; press again inside `parryWindow` to
  counter.
- `entities/Projectile.ts` — a pool of twelve, seven spells. Thrown effects
  point along their travel; `ground` effects stay upright, because a flame
  pillar tipped forty degrees is a pillar falling over.
- `entities/Bro.ts` — the floating companion.

---

## 3. The room

The flat arena is gone. `world/Grove.ts` generates a `RoomFull` — grass and
dirt under an S-bend path, a pond, trees hugging the walls, ~60 props — and
hands it to `WorldRenderer`, which is **`main`'s renderer pulled across
unchanged** along with `TextureFactory`, `PropPainter`, `paint` and `Ambient`.

The renderer cannot tell which side produced the room, and that is the point:
`RoomFull` is `main`'s wire contract, so when the socket lands the generator is
deleted and the snapshot goes straight in. The generator is a port of
`dungeon/generation.py`, kept faithful rather than tidied.

Props are not physics bodies. Sixty per room, most never moving and most
nowhere near the goat, so `#clampToRoom` pushes out of the few circles it
actually overlaps — cheaper than sixty static bodies, and it cannot wedge the
goat between two of them.

`world/Run.ts` ports `biome_for()` and the room sequence so the map draws a
true run rather than an invented one.

---

## 4. The interface

Everything is drawn in the canvas, not in React, because it has to survive
fullscreen — where no DOM panel beside the game exists any more.

| piece | what it is |
| --- | --- |
| `hud/Portrait.ts` | the goat's face in its ring, health and mana |
| `hud/Hotbar.ts` | two hands and the potion dial |
| `hud/CooldownRail.ts` | what is recharging, stacked up the right |
| `hud/Minimap.ts` | the room's own tiles, painted in miniature |
| `hud/MapScreen.ts` | the full run, on `M` |
| `hud/SettingsScreen.ts` | two tabs: display, and rebindable controls |
| `hud/SettingsButton.ts` | the gear |
| `hud/Flourish.ts` | death, victory, level-up |
| `hud/Panel.ts` | the framed panel every screen is built from |
| `hud/fit.ts` | size a piece from the frame actually on screen |

**Nothing in it holds state.** Health arrives as `vitals:changed`, the loadout
as `loadout:changed`, recharge times as `weapon:cooldowns` — all pushed by the
scene that owns them, so no view can disagree with the game.

**The portrait's face was already drawn.** `GOAT_FRAMES.face` is ten
expressions on the character sheet; the ring was drawn open across the top and
the head composites *over* it. It reacts: surprised when hit, sad at death,
happy on a potion.

**Sizes are measured off the art, not chosen.** The rail's inner channel, the
socket's opening, the hotbar's three slot centres — which are *not* symmetric,
because they were drawn by hand.

**`screen-frame.png` came back as an L** — a top bar, a left bar, one corner,
nothing on the right or bottom. `Panel.ts` takes it apart into the corner and
two bar slices and rebuilds the rectangle. Sheet 53 wants redrawing; the
missing prompt line is recorded in `docs/art-prompts.md`.

---

## 5. Mechanics

- `state/Vitals.ts` — health and mana, named to match `main`'s `PlayerSnap`
  (`health`, `maxHealth`, `mana`, `maxMana`) so adopting the real ones is
  deleting a file.
- `state/Loadout.ts` — two weapons carried, `Q` and `E` bound to *hands* rather
  than to a carousel, so each key always reaches the same weapon. Plus a potion
  carousel using `main`'s consumable ids.
- `state/Cooldowns.ts` — per-ability timers, keyed by ability rather than by
  slot so unequipping does not hand out a free cast.
- `state/Keybinds.ts` — **every key is rebindable**, which `main` does not do
  either. Cheap because `DeviceIntentSource` was already the only thing that
  knew a key code. Rebinding steals a key rather than refusing it; Escape, Tab,
  F5 and F12 are reserved.
- `ui/settings.ts` — all nine of `main`'s settings, of which this branch can
  honour three (zoom, quality, hitboxes). The six that cannot are *named* on
  the screen rather than hidden.

Abilities gained a mana cost, priced off their cooldown since the two answer
the same question.

---

## 6. The art, and what is left

**94 sheets drawn, 120 atlases built** — the extra 26 are the corrupted
arsenal, generated rather than drawn. Characters, weapons, casts, spells, the seven
HUD pieces, the five screen pieces, items, skill nodes, and all 47 enemy
sheets.

Prompts live in two files, and the prompts are the reason the set looks like
one game:

- `docs/art-prompts.md` — the interface. Block 0-UI, and sheets 53–60.
- `docs/art-prompts-2.md` — eleven enemies. Block 0-MOB, and sheets 1–47.

The prompts for everything already shipping — Block 0, the house style itself,
included — were cut once made and live in the history:

```bash
git show da61c32:docs/art-prompts.md
```

Pull an original out of there before regenerating any shipped sheet. A fresh
description of the same object is how a set quietly stops matching.

### The boss

`main`'s boss is `mirror` — "The Mirror", 520 health, tagged `MELEE`, `RANGED`
and `SPELL`. It is the twin, corrupted, and it fights with everything the
player has.

**Its arsenal needed no art.** Weapon and effect sheets carry no character, so
the boss holds the player's own; `SheetSpec.hue_target` measures a sheet's
dominant hue and rotates it to `CORRUPT_HUE`, 270 degrees. That generated **26
corrupted atlases** from the existing source art, and they cannot drift from
the originals because there is only one drawing behind each pair.

One fixed rotation could not have done it — the sword's effects sit at 348
degrees, fire at 25, ice at 189 — which is why each sheet solves its own. And
the target is 270 rather than the companion's present 224: 224 is a blue, the
creature *before* it turns.

Ten sheets still want drawing: six for the body, two for the hatching cutscene,
two for its own abilities. Prompted as Part D of `docs/art-prompts-2.md`.

### Still to build

- **The enemy system.** All 44 mob sheets are built and addressable, but there
  is no enemy entity, no AI and no spawning — only the practice dummy. The
  generator already reserves spawn points that the dummies stand on, so that is
  the seam.
- **Inventory and skill tree screens.** `main` has both written;
  `barsPlates` and `skillNodes` are built and waiting.
- **Sheet 53 redrawn** as a closed rectangle, which would let `Panel.ts` delete
  half of itself.

---

## 7. Reconciling with `main`

None of these twenty commits are on `main`. It merged this branch once at
`7d351db` and then rewrote the client out from under it — `PlayerView`,
`TwinView`, `WebSocketClient`, `contracts.ts`, fed by the FastAPI backend in
`apps/server/`.

What has been done deliberately to make that merge cheap:

- **`RoomFull` is `main`'s contract**, so the world renderer takes a server
  snapshot unchanged.
- **Vitals field names are `main`'s**, so the local model is deleted rather
  than translated.
- **Item and enemy frame names are `main`'s ids** — `health_potion`,
  `ember_heart`, `skeleton`, `archer`, `hound`, `slime` — so nothing needs a
  lookup table, and an id with no art fails at build.
- **The crypt's four mobs are drawn to `main`'s existing `ENEMY_TYPES`**, with
  its health, speed and behaviour already tuned. Those four cost no server
  change at all.

The one thing that genuinely needs a server change: **`main`'s `Inventory` has
a weapons list and a single `equipped_weapon`.** Carrying two is a rule this
branch invented.
