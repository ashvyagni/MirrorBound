# Art prompts

Everything previously prompted has been drawn — 104 source sheets, 130 built
atlases. What is left is **sheets 71 and 72** below.

This file is the three style blocks, whatever is unmade, and the rules the
pipeline learned the hard way.

**The made prompts are not lost.** Every one, including the original Block 0
the world art was drawn to, is one command away:

```bash
git show b789bf9:docs/art-prompts.md      # the interface, sheets 53-60
git show b789bf9:docs/art-prompts-2.md    # the enemies and the boss, 1-47 and 61-70
```

Pull the original out before regenerating any shipped sheet. The prompts are
the reason a hundred sheets look like one game, and a fresh description of the
same object is how that quietly stops being true.

---

## Before asking for anything: what needs no art

Most new interface does not. The screen frame is a **nine-slice** — `Panel.ts`
assembles it from one corner and two bar slices at any size — so anything that
is "a framed box with things in it" is already solved:

| surface | built from |
| --- | --- |
| settings screen | `Panel` + `controls` + `barsPlates` |
| pause screen | `Panel` + `barsPlates.divider` |
| full map | `Panel` + `mapTokens` |
| **the console** | `Panel` at 1180 x 108 — a thin frame is just a short one |
| inventory, skill tree | `Panel` + `barsPlates.slot` + `skillNodes` |

`controls` holds a button pair, a toggle pair, a slider track and knob, and a
tab pair. `barsPlates` holds an xp trough, a toast plate, a slot in two states,
a scrollbar and a divider. Between them and `Panel`, a new screen is usually a
layout problem rather than an art one.

**Ask for art when the shape itself is new** — a bubble with a tail, a glyph, a
frame with a portrait cut into it. Not when it is a rectangle with a border.

---

## Still to make

### 71. Small glyphs — `assets/ui/glyphs.png`

The close button and the seven other small marks the screens want. One sheet
rather than eight, for the same reason one alert mark serves eleven creatures.

Paste **Block 0-UI** first.

```
Piece 71: EIGHT SMALL GLYPHS, one per cell, on a 1536 x 1024 canvas in a strict
4 x 2 grid of 384 x 512 cells. Each glyph is centred in its own cell with clear
green around it. They are unrelated marks, not an animation.

These are read at about thirty pixels, so they are SIMPLE: two or three shapes
each, thick dark outline, one flat fill, one shadow tone. No text, no numbers,
no frames or buttons around them -- the game draws the button and puts the
glyph on it.

Every glyph is drawn at the SAME optical size, about 200 pixels across, so a
row of them reads as one set.

TOP ROW, left to right:
1. CLOSE. A cross of two thick bars crossing at their middles at 45 degrees,
   with squared ends. Bone white #cfc3d4. Not an X of thin strokes, and not
   rounded -- two chunky bars.
2. BACK. A single left-pointing chevron: two thick bars meeting at a point on
   the left, open to the right. Bone white. No tail, no shaft, no arrowhead.
3. CONFIRM. A tick: one short bar down-right meeting one long bar up-right,
   both thick with squared ends. Soft pink #f5a4c0.
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

Cells 1 and 4 must be the same size and weight: one is the other rotated 45
degrees, and if they do not match, a close button and an add button will look
like they came from different sets.
```

---

### 72. Dialogue and interaction — `assets/ui/dialogue.png`

The one part of the new interface that is genuinely a new shape. A prompt
bubble has a tail; a dialogue plate has a name tab cut into it and a portrait
window in its side. Neither is a rectangle with a border, which is why neither
can come out of `Panel`.

Paste **Block 0-UI** first.

```
Piece 72: EIGHT INTERFACE PIECES, on a 1536 x 1024 canvas in a strict 4 x 2
grid of 384 x 512 cells. Each is centred in its own cell with clear green
around it. They are unrelated pieces, not an animation.

Every one of them is EMPTY: no text, no numbers, no portraits, no icons inside.
The game draws all of that.

TOP ROW, left to right:

1. PROMPT BUBBLE. A small rounded plate about 300 x 110 with its corners cut as
   small 45-degree steps, and a short triangular TAIL about 40 pixels wide
   pointing DOWN from the middle of its bottom edge. Dark violet face #191322,
   lighter violet rim. This floats over a thing you can pick up, and the tail
   is what makes it point at that thing rather than hover near it.
2. PROMPT BUBBLE, PRESSED. The same bubble at the same size and in the same
   position, with the face pushed in: darker face, dimmer rim, tail unchanged.
   Only the interior changes -- the game swaps between them in place.
3. DIALOGUE PLATE. A wide low plate about 1300 x 300 -- the widest piece on
   this sheet, so let it run close to its cell's edges. Dark violet face,
   lighter violet rim, corners cut as 45-degree steps. Along its LEFT end, a
   square PORTRAIT WINDOW about 220 x 220 cut into the plate as a recess: a
   darker inner edge, a thin lighter rim, and a completely empty pure-green
   interior, because a face is drawn through it. Draw NO tail on this one.
4. NAME TAB. A small tab about 280 x 90 with its TOP two corners stepped and
   its bottom edge square, so it reads as sitting on top of the dialogue
   plate's upper edge. Lighter violet face #241d2e, bright rim, and a solid
   soft-pink #f5a4c0 bar 10 pixels thick along its top edge.

BOTTOM ROW, left to right:

5. CONTINUE CHEVRON. A single down-pointing chevron, two thick bars meeting at
   a point below, about 90 pixels across, in soft pink #f5a4c0 with a dark
   outline. It blinks at the end of a line of dialogue, so it must read at a
   glance and carry nothing else.
6. INTERACT RING. A thin ellipse about 260 wide and 110 tall -- flat-on to the
   ground, so an ellipse and NOT a circle -- in soft pink #f5a4c0 with a dark
   outline, about 10 pixels thick, broken into four arcs with clear gaps
   between them. It sits on the floor under a thing you can interact with.
7. INTERACT RING, HELD. The same ellipse at the same size and position, drawn
   as ONE unbroken ring instead of four arcs and with the warm accent #d62e6c
   instead of pink. The game swaps to this while the interact key is held.
8. SPEAKER FRAME. A square frame about 250 x 250, hollow, with a thick dark
   violet border about 26 pixels and a lighter violet rim on both its inner and
   outer edge, corners cut as small square steps. Its middle is pure green.
   This goes around the portrait window when someone is speaking.

Pieces 1 and 2 must be identical in outline, size and position. So must 6 and
7. Each pair is one thing in two states, swapped in place.
```

---

## The style blocks

Paste ONE per chat, never two — mixing briefs is how a health bar ends up drawn
lying on the floor.

| block | for |
| --- | --- |
| **Block 0-UI** | interface chrome: frames, controls, bars, tokens, glyphs |
| **Block 0-MOB** | creatures: enemies, the boss, anything that moves |
| **Block 0-ITEM** | objects: potions, relics, resources, pickups |

All three are in the history at the commands at the top of this file.

---

## What the pipeline learned

Eight things that each cost a debugging session. They are written here rather
than in a commit message because every one of them will happen again.

**The generator draws the grid.** Six of the boss's ten sheets came back with
cell borders, 1 to 2 pixels thick and fully opaque, despite the brief forbidding
them. An opaque border welds all eight frames into one blob.
`SheetSpec.strip_grid` erases a few pixels either side of every boundary before
the frames are found — safe, because the brief also demands 24 pixels of clear
background around every frame.

**A fade has to arrive as real alpha.** The alert mark's last two frames were
asked to fade. Frame 7 came back with thirteen pixels above half opacity and
frame 8 keyed out entirely — a max alpha of 0.000. Declare the sheet at the
frame count that actually has art and let the game tween the rest.

**Frames that touch across a cell boundary are one blob.** Two slimes in
`slime-alert` touch, so they keyed as one, one cell took it and its neighbour
came back empty. A grid band emits one span per cell and cuts a blob at the
boundary.

**`*_FRAME_SIZE` is the sheet's shared box, not a frame's own.** It is the
union of every frame — right for anchoring, wrong for an aspect ratio. Use
`hud/fit.ts`, which reads the frame actually on screen.

**`setDisplaySize` measures the untrimmed source box.** It drew a 48px socket
48 wide and 11 tall. Set a uniform `scale` instead.

**Size sprites on `realHeight`, never on `frame.height`.** The same trap from
the other side. `frame.height` is the trimmed height of whichever frame is
showing; the alert mark's first frame is a 45px speck and its fourth is 344px,
so scaling the speck to mark height drew the full mark seven times too big and
filled the screen. `realHeight` is the box every frame on a sheet shares.

**Openings are measured, not guessed.** The rail's channel, the socket's hole,
the minimap ring's inner diameter, the hotbar's three slot centres — which are
*not* symmetric, because they were drawn by hand.

**Phaser hit areas are in the object's local texture space.** Every hand-built
one in the HUD was in absolute canvas coordinates, which put the settings
gear's hit area about eighteen hundred pixels from the gear. Call
`setInteractive()` with no shape and let Phaser use the frame's own bounds.

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
