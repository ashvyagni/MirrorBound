# Art prompts

Everything previously prompted has been drawn — 104 source sheets, 130 built
atlases, nothing outstanding but sheet 71 below.

So this file is no longer a backlog. It is the three style blocks, the rules
the pipeline learned the hard way, and whatever is currently unmade.

**The old prompts are not lost.** Every one, including the original Block 0 that
the world art was drawn to, is one command away:

```bash
git show b789bf9:docs/art-prompts.md      # the interface, sheets 53-60
git show b789bf9:docs/art-prompts-2.md    # the enemies and the boss, 1-47 and 61-70
```

Pull the original out of there before regenerating any shipped sheet. The
prompts are the reason a hundred sheets look like one game, and a fresh
description of the same object is how that quietly stops being true.

---

## What is made

| set | sheets | where |
| --- | --- | --- |
| goat, companion, dummy | 5 | `assets/characters/` |
| weapons and shield | 12 | `assets/weapons/` |
| cast motions | 7 | `assets/casts/` |
| spells and projectiles | 11 | `assets/spells/` |
| HUD and screens | 13 | `assets/ui/` |
| eleven enemies + alert mark | 45 | `assets/enemies/` |
| the Mirror, and its hatching | 8 | `assets/enemies/` |
| **the corrupted arsenal** | **0** | *generated, not drawn — see below* |

The boss's weapons took no art at all. Weapon, cast and effect sheets carry no
character — they are composited over whoever holds them — so the boss holds the
player's own, and "corrupted" is that same drawing rotated to violet.
`SheetSpec.hue_target` measures each sheet's dominant hue and rotates it to 270
degrees, producing **26 corrupted atlases** from the source sheets the player's
versions come from. They cannot drift apart: there is only one drawing behind
each pair.

---

## Still to make

### 71. Small glyphs — `assets/ui/glyphs.png`

The close button, and the seven other small marks the screens will want. One
sheet rather than eight, for the same reason one alert mark serves eleven
creatures.

Paste **Block 0-UI** first.

```
Piece 71: EIGHT SMALL GLYPHS, one per cell, on a 1536 x 1024 canvas in a strict
4 x 2 grid of 384 x 512 cells. Each glyph is centred in its own cell with clear
green around it. They are unrelated marks, not an animation.

These are read at about thirty pixels, so they are SIMPLE: two or three shapes
each, thick dark outline, one flat fill, one shadow tone. No text, no numbers,
no frames or buttons around them -- the game draws the button and puts the
glyph on it.

Every glyph is drawn at the SAME visual weight and the same optical size, about
200 pixels across, so a row of them reads as one set.

TOP ROW, left to right:
1. CLOSE. A cross of two thick bars crossing at their middles at 45 degrees,
   with squared ends. Bone white #cfc3d4. Not an X of thin strokes and not a
   rounded one -- two chunky bars.
2. BACK. A single left-pointing chevron: two thick bars meeting at a point on
   the left, open to the right. Bone white. No tail, no shaft, no arrowhead
   triangle -- just the chevron.
3. CONFIRM. A tick: one short bar down-right meeting one long bar up-right, both
   thick with squared ends. Soft pink #f5a4c0.
4. ADD. A plus of two thick bars of equal length crossing at their middles,
   square to the frame. Bone white.

BOTTOM ROW, left to right:
5. REMOVE. A single thick horizontal bar with squared ends, the same length and
   thickness as one bar of the plus above it. Dim violet #7d7188.
6. LOCKED. A closed padlock: a squat rounded-square body with a plain arched
   shackle above it and one small dark keyhole. Dim violet body, bone white
   shackle. Three shapes.
7. WARNING. A triangle standing on its base with its corners cut as small
   square steps, with a short thick vertical bar and a separate square dot
   inside it. Warm accent #d62e6c.
8. INFO. A circle with a short thick vertical bar and a separate square dot
   above it, the dot on top. Bone white. The same two inner shapes as the
   warning, stacked the other way round.

Cells 1 and 4 must be exactly the same size and weight: one is the other
rotated 45 degrees, and if they do not match, a close button and an add button
will look like they came from different sets.
```

---

## The style blocks

These stay because future art needs them. Paste ONE per chat, never two —
mixing briefs is how a health bar ends up drawn lying on the floor.

| block | for |
| --- | --- |
| **Block 0-UI** | interface chrome: frames, controls, bars, map tokens, glyphs |
| **Block 0-MOB** | creatures: enemies, the boss, anything that moves |
| **Block 0-ITEM** | objects: potions, relics, resources, pickups |

All three are in the history at the commands above. Block 0-UI is in the
`art-prompts.md` link, Block 0-MOB and Block 0-ITEM in the other.

---

## What the pipeline learned

Six things that cost a debugging session each. They are written here rather
than in a commit message because every one of them will happen again.

**The generator draws the grid.** Six of the boss's ten sheets came back with
cell borders, 1 to 2 pixels thick and fully opaque, despite the brief forbidding
them in as many words. An opaque border welds all eight frames into one blob.
`SheetSpec.strip_grid` erases a few pixels either side of every cell boundary
before the frames are found — safe, because the brief also demands 24 pixels of
clear background around every frame.

**A fade has to arrive as real alpha.** The alert mark's last two frames were
asked to fade. Frame 7 came back with thirteen pixels above half opacity and
frame 8 keyed out entirely — a max alpha of 0.000. Declare such a sheet at the
frame count that actually has art and let the game tween the rest.

**Frames that touch across a cell boundary are one blob.** Two slimes in
`slime-alert` touch, so they keyed as one, one cell took it and its neighbour
came back empty. A grid band now emits one span per cell and cuts a blob at the
boundary.

**`*_FRAME_SIZE` is the sheet's shared box, not a frame's own.** It is the union
of every frame — right for anchoring, wrong for an aspect ratio. Use
`hud/fit.ts`, which reads the frame actually on screen.

**`setDisplaySize` measures the untrimmed source box.** Related, and worse: it
drew a 48px socket 48 wide and 11 tall. Set a uniform `scale` instead.

**Openings are measured, not guessed.** The rail's channel, the socket's hole,
the minimap ring's inner diameter, the hotbar's three slot centres — which are
*not* symmetric, because they were drawn by hand. Anything that has to sit
inside a piece of art is measured off that art.

---

## Wiring a new sheet in

1. Drop the PNG in the right `assets/` folder.
2. Add a `SheetSpec` to `src/web/scripts/sheets.py` and put it in `SHEETS`.
3. `npm run assets` from `src/web`.
4. Import the generated `*Atlas.generated.ts` — a missing frame is then a
   compile error rather than a blank sprite.

The build fails loudly on the wrong frame count, a missing source or an unknown
keying mode. It cannot see a creature drawn at the wrong scale, a hidden grip,
an effect drawn in perspective, or a loop whose last frame does not meet its
first. Those are what the prompts are for.
