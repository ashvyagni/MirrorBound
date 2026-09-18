# Art prompts — the interface

What is still to draw for the interface. Everything else that was in this file
has been made and is in the game, so it has been cut: the house style, the four
weapons, their casts and effects, the goat's two extra facings, the practice
dummy and the seven HUD pieces — sheets 1 to 36.

**They are not lost.** Every one of those prompts, Block 0 included, is one
command away:

```bash
git show da61c32:docs/art-prompts.md
```

Worth knowing before you need it: if a shipped sheet is ever regenerated — the
sword redrawn, the portrait ring redone — pull its original prompt out of that
commit rather than writing a new one. The prompts are what keep twenty-six
sheets looking like one game, and a fresh description of the same object is how
that quietly stops being true.

Two files, and they do not overlap:

| file | holds |
| --- | --- |
| this one | the interface — Block 0-UI, and sheets 53 to 57 |
| `docs/art-prompts-2.md` | the eleven enemies — Block 0-MOB, and sheets 1 to 47 |

The sheet numbers here start at 53 rather than at 1 on purpose. They are the
numbers on the empty slots in the Figma board, and renumbering them would
desync the two.

---

## Block 0-UI — the interface style

Paste this on its own, once per chat.

It is a full replacement for Block 0 — the house style the world art was drawn
to, now in the history alongside the prompts that used it — rather than an
override. That art is side-on elevation and this is flat-on to the screen, so
mixing the two briefs in one conversation is how you get a health bar drawn
lying on the floor. Never paste both.

```
STYLE BRIEF. Read this once and apply it to every piece I ask for in this chat.
I will describe each piece separately. All the rules below hold for every one of
them unless I explicitly override one.

I am making the on-screen interface for a 2D game. These are frames, plates,
rings and buttons -- the chrome that the game draws its own numbers and bars
inside. They are not objects in the world.

THE LOOK
Flat, bold, storybook game art snapped to a pixel grid. A clean children's-book
illustration turned into a game sprite. NOT a painted fantasy render, and NOT a
glossy modern app interface.

- A thick, dark outline around every piece and every major internal shape. One
  consistent line weight throughout, around 12 pixels at this resolution.
- Two or three flat tones per material: a base colour, one shadow, one
  highlight. No gradients, no glow, no bevel, no drop shadow, no glassy
  reflection, no ambient occlusion, no transparency effects.
- Bold, simple silhouettes. Ornament reduced to two or three clear shapes. No
  filigree, no scrollwork, no runes, no rivets, no hammered metal texture, no
  micro-detail of any kind.
- Confident linework with a slightly loose, hand-drawn quality. Appealing and
  well made, but relaxed rather than mechanically precise. A little wobble in a
  long straight edge is welcome.

THE PIXEL GRID -- this is the part that matters most and the part usually got
wrong.
Every edge in the image lands on a 16-pixel grid. Corners are cut as square
steps, never rounded. Diagonals are drawn as clean stair-steps of equal run.
Curves are stepped pixel curves, not smooth vector arcs -- a circle is a
pixel-art circle with visible steps around its edge.
Every edge is HARD and ALIASED: a pixel is either the fill colour or the outline
colour, never a blend of the two. No anti-aliasing, no feathering, no soft edges
anywhere in the image. If you zoom into any edge and find a row of in-between
colours, it is wrong.

THE PALETTE -- use these exact colours and no others.
  Outline, darkest      #14111a
  Panel fill            #191322
  Panel raised face     #241d2e
  Frame line and rim    #53456a
  Light trim            #cfc3d4
  Dim trim              #7d7188
  Bone white            #f2e8df
  Warm accent           #d62e6c
  Soft pink accent      #f5a4c0
  Cool accent           #6fd8e8
The chrome is dark violet metal with a lighter violet rim. Accents are used
sparingly -- one small emblem, or one short line of trim. Never a whole face of
accent colour.

THE CAMERA
Flat-on, straight at the screen. Orthographic. No perspective, no vanishing
point, no foreshortening, no three-quarter view, no tilt, no thickness receding
into the distance. A circle is a circle and a rectangle is a rectangle.

BACKGROUND
Flat pure bright green (#00FF00), edge to edge, perfectly uniform. Any hole in
the middle of a piece -- the inside of a ring, the inside of an empty slot -- is
that same pure green, because it is keyed out to transparent and the game draws
its own content through it. Nothing else on the background at all: no grid
lines, no cell borders, no labels, no captions, no watermark, no shadow cast
onto it.

NEVER INCLUDE
No text, no numbers, no letters, no keybind labels. No icons inside slots, no
bar fills, no liquid, no percentages, no progress of any kind. No character, no
creature, no hand, no ground, no background scenery. The game draws every one of
those itself. Every frame, slot and socket you draw is EMPTY.

Reply "ready" and wait for my first piece.
```

---

## The rest of the interface

The HUD is made — the portrait, the bars, the minimap frame, the hotbar, the
cooldown rail, the settings button. This is everything else: the screens you
open, the map you read, and the moments the game needs to mark. It is scoped against what `main` already builds, so none of it is
speculative:

`Overlays.tsx` there already has `DeathOverlay`, `VictoryOverlay`, `PauseMenu`,
`ControlsScreen`, `ConnectionOverlay` and `Toasts`. `SettingsScreen.tsx` renders
the nine settings in `settings.ts` — three volume sliders, a zoom control, a
quality select and four toggles. `InventoryScreen.tsx` and `SkillTreeScreen.tsx`
exist. The structure is written. What none of it has is a face.

### What needs generated art, and what does not

This is the part worth getting right before drawing anything, because most of
this list does not need a single generated pixel.

| surface | needs |
| --- | --- |
| settings, pause, controls, inventory, skill tree | **the shared kit below, and nothing else** |
| full area map | map tokens — genuinely new art |
| boss encounter | a wide health bar of its own |
| death, victory, level-up | three flourishes |
| damage numbers, toasts, tooltips | **nothing** — type and CSS |

Five screens share one answer. A settings panel is a frame, some sliders, some
toggles and some buttons; an inventory is the same frame with a grid of slots in
it; a skill tree is the same frame with nodes and lines. Drawing each screen its
own chrome would be five sheets of the same four controls, and they would drift
apart by the third — the same argument that made one alert mark serve eleven
creatures.

So: **one frame, one control kit, and the screens are built from them in the
DOM.** Everything in `styles.css` already works this way.

### The one format change

Every HUD piece so far is fixed-size: a ring is a ring. A panel is not — a
settings dialog and an inventory are different shapes, and scaling one image to
both stretches its border.

So the frame is a **9-slice**: one square drawn so its four corners stay fixed,
its four edges tile, and its middle stretches. That is a different thing to ask
an image generator for than an 8-frame grid, and sheet 53 says so explicitly.
The atlas pipeline has no 9-slice mode today, so it ships as a single frame and
the DOM slices it with `border-image` — which is one CSS line and needs no
pipeline work at all.

### Order

| # | sheet | canvas | frames |
| --- | --- | --- | --- |
| 53 | screen frame (9-slice) | 1024 x 1024 | 1 |
| 54 | control kit | 1536 x 1024 | 8 |
| 55 | map tokens | 1536 x 1024 | 8 |
| 56 | boss bar | 1536 x 1024 | 2 |
| 57 | flourishes | 1536 x 1024 | 3 |

Paste **Block 0-UI** above first, as every HUD piece was.

---

### 53. Screen frame — `assets/ui/screen-frame.png`

```
Piece 53: A PANEL FRAME, DRAWN TO BE SLICED.

OVERRIDE: this is a SINGLE image, not an 8-frame grid. One square, 1024 x 1024,
one frame, no cells.

THE SHAPE: a hollow rectangular frame filling the whole canvas — a border of
dark violet metal about 120 pixels thick all the way round, with a completely
EMPTY pure-green middle. It is a picture frame, not a filled panel.

HOW IT WILL BE USED, which is why the next two rules matter: the game cuts this
into nine pieces. The four corners are kept as drawn. The four edges are
repeated to whatever length is needed. The middle is thrown away.

THE CORNERS: all four are identical under rotation, and each carries the same
ornament — a simple stepped notch cut out of the outer edge and one small square
stud in soft pink #f5a4c0 set into the corner itself. Keep the ornament inside
the corner's own 120-pixel square and no larger, or it will be cut in half.

THE EDGES: between the corners, every edge is UNIFORM along its length —
a plain band of dark violet with a lighter violet rim line along its inner and
outer boundary, and nothing else. No ornament, no centre-point detail, no
gradient along its run, no tapering. An edge with anything unique on it repeats
that thing every time the frame is stretched, and that is the single most common
way this asset is drawn wrong.

THE INNER EDGE: a clean one-pixel-crisp step down into the empty middle, so the
frame reads as a raised border around a recess.

THE MIDDLE: pure green #00FF00, completely empty, no content of any kind.
```

Check the edges by covering the corners: what is left must be four plain bands
you could cut anywhere without noticing. If a band has a middle, it is wrong.

---

### 54. Control kit — `assets/ui/controls.png`

Eight controls on one sheet, in cell order.

```
Piece 54: EIGHT INTERFACE CONTROLS, one per cell, on a 1536 x 1024 canvas in a
strict 4 x 2 grid of 384 x 512 cells. Each control is centred in its own cell
with clear green around it. They are unrelated objects, not an animation.

Every one of them is EMPTY: no text, no numbers, no icons, no labels inside.

TOP ROW, left to right:
1. BUTTON, resting. A wide flat rectangle about 300 x 110, dark violet with a
   lighter violet rim line and a slightly lighter raised face, corners cut as
   small 45-degree steps.
2. BUTTON, pressed. The same rectangle at the same size and position, with the
   face pushed IN: darker face, dimmer rim, no raised look. Same outline.
3. TOGGLE, off. A rounded-rectangle track about 220 x 100 in dark violet, with
   a square knob about 80 x 80 sitting at its LEFT end. The knob is dim violet.
4. TOGGLE, on. The same track at the same size and position, knob at its RIGHT
   end, and the track filled behind the knob with the warm accent #d62e6c. The
   knob is bone white.

BOTTOM ROW, left to right:
5. SLIDER TRACK. A long thin horizontal trough about 340 x 40, dark violet with
   a lighter violet rim, hollow and EMPTY — no fill, no tick marks, no notches.
6. SLIDER KNOB. A single squat upright block about 60 x 100, dark violet with a
   lighter violet rim and a bone-white vertical line down its centre.
7. TAB, resting. A rectangle about 260 x 90 with its TOP two corners stepped and
   its bottom edge left square, so it reads as a tab attached to something
   below. Dark violet, dim rim.
8. TAB, active. The same tab at the same size and position, with a brighter rim
   and a solid soft-pink #f5a4c0 bar running along its full TOP edge, about 12
   pixels thick.

The pairs — 1 and 2, 3 and 4, 7 and 8 — must be drawn at exactly the same size
and in exactly the same position within their cells, because the game swaps
between them in place and any difference reads as the control jumping.
```

---

### 55. Map tokens — `assets/ui/map-tokens.png`

The one genuinely new surface here. The shipped minimap ring frames a live
view; this is the full map you open, and its rooms are drawn as tokens.

A run is a sequence of rooms of known types — `entrance`, `combat`,
`exploration`, `treasure`, `event`, `elite`, `boss` — so the tokens are drawn
against that list rather than invented.

```
Piece 55: EIGHT MAP TOKENS, one per cell, on a 1536 x 1024 canvas in a strict
4 x 2 grid of 384 x 512 cells. Each token is centred in its own cell with clear
green around it. They are unrelated objects, not an animation.

These are read at about forty pixels on a dark map, so they are SIMPLE: a
shape, an outline, and at most one mark inside. No text, no numbers.

Every token in the top row is the SAME outer shape at the SAME size — a squat
hexagon about 240 pixels across, flat-topped — so the map reads as one grid
with different things in it. Only the fill and the mark inside change.

TOP ROW, left to right:
1. ROOM, UNVISITED. The hexagon in flat dark violet #191322 with a DIM violet
   rim and nothing inside it. Deliberately the quietest token on the sheet.
2. ROOM, VISITED. The same hexagon with a lighter violet face #241d2e, a bright
   violet rim, and nothing inside.
3. ROOM, CLEARED. The same hexagon, lighter face, bright rim, and a simple
   bone-white tick mark centred inside it — two strokes, nothing more.
4. ROOM, CURRENT. The same hexagon with a soft-pink #f5a4c0 rim about twice the
   thickness of the others, a dark face, and a solid pink diamond centred
   inside it.

BOTTOM ROW, left to right — these four are marks placed ON a room token, so
they are drawn smaller, about 140 pixels, with no hexagon around them:
5. TREASURE. A simple closed chest shape in warm accent #d62e6c: a squat box
   with a curved lid and one dark band across it. Three shapes total.
6. ELITE. A simple three-pointed crown in bone white, flat, with a dark outline.
7. BOSS. A stylised skull in bone white — a rounded dome, two dark eye sockets,
   a simple jaw line. Three shapes total, no teeth drawn individually.
8. CORRIDOR. A short straight connector bar about 200 x 44, flat dim violet
   #7d7188 with a dark outline, square ends. This is repeated and rotated
   between rooms, so it must be uniform along its length and symmetrical
   end to end.
```

---

### 56. Boss bar — `assets/ui/boss-bar.png`

The Mirror has 520 health against the player's 100, and reading it off the same
trough would be a lie about the fight. It gets a bar of its own: wider, across
the top of the screen, and framed rather than tucked beside a portrait.

```
Piece 56: TWO BOSS HEALTH BAR FRAMES, stacked one above the other on a
1536 x 1024 canvas. They are unrelated pieces, not an animation.

UPPER HALF — the bar. A long horizontal trough about 1400 x 150, roughly nine
times wider than it is tall. A dark violet frame about 28 pixels thick with a
lighter violet rim, hollow and EMPTY inside — the game fills it. Both ends are
cut at a steep diagonal so the bar tapers to blunt points at BOTH ends,
symmetrically. Above the trough's centre sits a small flourish: two short
angled wings in bone white sweeping out from a central point, about 300 pixels
across in total, flat, with a dark outline.

Draw NO fill, NO segments, NO tick marks, NO notches inside the trough, and no
text anywhere.

LOWER HALF — the segment divider. A single thin vertical bar about 16 x 120,
flat bone white with a dark outline, square ends. The game repeats this across
the bar to mark phase thresholds, so it must be plain and symmetrical.

Clear green between and around the two pieces.
```

---

### 57. Flourishes — `assets/ui/flourishes.png`

Three moments the game currently marks with nothing at all.

```
Piece 57: THREE LARGE MARKS, on a 1536 x 1024 canvas in a strict 4 x 2 grid of
384 x 512 cells. Use the FIRST THREE CELLS of the top row only; leave the other
five cells completely empty pure green.

They are unrelated marks, not an animation. Each is centred in its own cell and
fills about three quarters of it. No text.

CELL 1 — DEATH. A cracked ring: a heavy circular band of dark violet, broken
into four uneven arcs with dark gaps between them, the arcs drifting slightly
apart as though the ring has shattered and paused. One small bone-white diamond
falling away from the lower-right gap. Sombre and still.

CELL 2 — VICTORY. A sunburst: twelve straight tapered rays radiating from a
central point, alternating long and short, in bone white with a dark outline,
with a solid soft-pink #f5a4c0 disc at the centre about a fifth of the whole
mark's width. Flat and symmetrical. No face, no rounded glow.

CELL 3 — LEVEL UP. An upward chevron stack: three chevrons pointing up, stacked
one above another with clear space between them, the lowest widest and the
highest narrowest. Warm accent #d62e6c with a dark outline, flat. Beneath the
lowest chevron, one short horizontal bar the width of that chevron.

Cells 4 to 8: nothing. Pure flat green.
```

The empty cells are deliberate — `Band` takes an expected frame count, so a
sheet with three findable frames is declared as three and the pipeline holds
you to it. Leaving room on the grid means the next flourish is a redraw of one
cell rather than a new sheet.

### What is still not covered after this

**Damage numbers and toasts are type, not art.** They are Silkscreen over a
dark plate, which the DOM already does; generating them would fix their length,
which is the one thing about a number you cannot fix.

**The skill tree's connector lines are drawn, not generated** — they run between
nodes at arbitrary angles and lengths, which is a `Graphics` call, not a sheet.
The nodes themselves reuse piece 54's button pair and piece 55's tokens.

**Nothing here is animated.** Every piece above is a still. The death ring
drifting apart, the sunburst turning and the chevrons rising are all transforms
the game applies to a static image — which is cheaper, smoother, and cannot go
out of sync with the moment that triggered it.
