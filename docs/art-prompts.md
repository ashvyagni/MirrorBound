# Art prompts

Sheets 1–72 are drawn: 106 source sheets, 132 built atlases. Everything still
to make is **the world** — sheets 73 to 84 below.

This file is the style blocks, whatever is unmade, and the rules the pipeline
learned the hard way.

**The made prompts are not lost.** Every one, including the original Block 0
the weapon art was drawn to, is one command away:

```bash
git show b789bf9:docs/art-prompts.md      # the interface, sheets 53-60, 71-72
git show b789bf9:docs/art-prompts-2.md    # the enemies and the boss, 1-47, 61-70
git show da61c32:docs/art-prompts.md      # Block 0, the original house style
```

Pull the original out before regenerating any shipped sheet. The prompts are
the reason a hundred sheets look like one game, and a fresh description of the
same object is how that quietly stops being true.

---

## Why the world needs art at all

It does not look unfinished today, and that is the trap. `main` has no world
art whatsoever: `TextureFactory.ts` and `PropPainter.ts` **paint every tile and
every prop into a canvas at runtime** with about six hundred lines of
Canvas2D — ellipses, polygons and seeded speckle. It works, it is fast, and it
is the only part of the game that does not look drawn by the same hand as the
goat.

So these sheets do not fill a hole. They replace a working system, and that
sets the brief: each piece has to drop into an existing key at an existing size
with an existing role, or the renderer will not find it.

### What is actually missing

One thing here is a genuine hole rather than a replacement, and it is worth
knowing before you start.

`village.py` builds every village out of `hut`, `hut_big`, `forge`, `stall`,
`well` and `banner`, and places its NPCs as blocking decor with sprite
`villager` or `hearth`. The client's `VARIANTS` table in `WorldRenderer.ts`
knows **none of those names except `well`**. `#textureFor` returns null for the
rest and the loop skips them without a word.

Every village on `main` is therefore an empty field with a crossroads painted
on it. Sheets 80 and 81 are the first art those rooms have ever had.

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
| the console | `Panel` + `glyphs` |
| dialogue | `dialogue.plate` + `dialogue.nameTab` |
| inventory, skill tree | `Panel` + `barsPlates.slot` + `skillNodes` |

**Ask for art when the shape itself is new** — a bubble with a tail, a glyph, a
hut. Not when it is a rectangle with a border.

---

## Block 0-WORLD — the world style

Paste this on its own, once per chat, before any sheet from 73 to 84.

It is a full replacement for Block 0 and Block 0-UI, not an override. Block 0
is strict side-on elevation, Block 0-UI is flat-on to the screen, and this one
is a camera looking down at a floor. Mixing any two of the three in one
conversation is how you get a tree lying on its back.

```
STYLE BRIEF. Read this once and apply it to every sheet I ask for in this chat.
I will describe each sheet's content separately. All the rules below hold for
every one of them unless I explicitly override one.

I am making the world art for a 2D top-down game -- the ground the character
walks on and the things standing on it.

THE LOOK
Flat, bold, storybook game art snapped to a pixel grid. A clean children's-book
illustration turned into a game sprite. NOT a painted fantasy render, NOT
photoreal, NOT an isometric tileset.

- A thick, dark outline around every object and every major internal shape. One
  consistent line weight throughout, around 5 pixels at this resolution. The
  outline colour is a very dark desaturated purple-black (#120c16), never pure
  black.
- Two or three flat tones per material: a base colour, one shadow, one
  highlight. No gradients, no airbrushing, no soft painterly blending, no
  ambient occlusion, no bloom.
- Bold, simple silhouettes. Ornament reduced to two or three clear shapes. No
  filigree, no carved scrollwork, no woodgrain, no hammered metal texture, no
  micro-detail of any kind.
- Confident linework with a slightly loose, hand-drawn quality. Appealing and
  well made, but relaxed rather than mechanically precise. A little wobble in a
  long straight edge is welcome.
- Every object reads clearly as a silhouette alone. These are seen at about
  forty pixels tall in play. Simplify until it would still read at a third of
  the size you are drawing it.

THE CAMERA -- this is the part that matters most.
A three-quarter top-down view, as in a classic 2D overhead adventure game. The
camera is high and looking down at the ground, but not straight down.

That means two different things depending on what the object is, and I will
tell you which for every sheet:

- UPRIGHT THINGS -- trees, rocks, pillars, huts, people. Drawn almost
  face-on, so you see their front and not their roof. You see a little of the
  ground they stand on, and nothing of the sky behind them. Their base is the
  point where they touch the floor, and that base sits at the BOTTOM of the
  drawing. Think of a paper cut-out standing up on a table, seen by someone
  sitting at that table.
- FLAT THINGS -- ground, water, paving, anything lying down. Drawn looking
  straight down, so a round pond is a circle and not an ellipse.

Orthographic in both cases. No vanishing point, no perspective convergence, no
foreshortening, no camera tilt, no isometric 30-degree grid, no diagonal
skewing. Two trees side by side are drawn identically; the one on the right
does not lean.

LIGHT
One soft light from the upper left. Highlights on upper-left faces, the shadow
tone on lower-right faces. Consistent across every sheet.

NO BAKED SHADOWS. Do not draw a cast shadow on the ground under anything. The
game draws its own shadow under every object and a second one baked into the
art reads as a smear of dirt. The object simply ends where it meets the floor.

NO BAKED LIGHT. Do not draw flames, fire, glowing embers, light pools, god
rays, or any glow around anything, even on a torch or a brazier. The game adds
every flame and every light as a separate animated effect on top. Draw the
fixture cold and unlit.

COLOUR
Saturated but slightly muted, like a well-printed picture book. Mossy greens,
warm mid browns, cool grey stone, bone whites. Hot saturated accents -- pink
#d62e6c, gold #f0c060, pale blue #a0cae4 -- reserved for the few things that
are meant to be magical. I will give you exact hex values per sheet; use them
as the base tone and derive your own shadow and highlight from each.

THE SHEET FORMAT
Every sheet is a single image holding a grid of SEPARATE, UNRELATED objects --
these are variants of a prop, not frames of an animation, so nothing needs to
match its neighbour pose for pose. I will give the exact canvas size, the grid,
and the cell size for each sheet. The sheet reads left to right along the top
row, then left to right along the next row down.

BACKGROUND
Flat pure bright green (#00FF00), edge to edge, perfectly uniform. Nothing else
on it at all: no grid lines, no cell borders, no frame numbers, no labels, no
captions, no watermark, no vignette, no shadow cast onto the background.

The last point is not decoration. The green is keyed out to transparency by a
script, so any grey drawn on the background becomes a grey rectangle in the
game, and a cell border welds every object on the sheet into one blob.

FRAMING
Each object is centred in its own cell with at least 24 pixels of clear green on
every side. Artwork never crosses from one cell into the next. No cell is ever
left empty.

RELATIVE SIZE WITHIN A SHEET
Objects on one sheet are drawn at their true size RELATIVE TO EACH OTHER, all
to the same scale, each centred in its cell. A boulder next to a pebble is
drawn much bigger, not blown up to fill its cell. I will give you the real
in-game size of every object in pixels so you can hold the ratios.

NEVER INCLUDE
No characters and no creatures unless the sheet is specifically about them. No
horizon, no sky, no background scenery, no text, no UI, no frames or borders
around objects, no arrows, no annotations.

Reply "ready" and wait for my first sheet.
```

---

## Still to make — the world

Twelve sheets, 101 objects. Every name in a **`code`** below is the key the
renderer already looks for, so the frame name in the atlas has to match it
exactly.

Sheets 73 to 81 are props and use `Block 0-WORLD` as written. Sheets 82 to 84
are floor tiles and need the overrides printed with them — tiles break the
framing rule on purpose.

---

### 73. Trees and bushes — `assets/world/flora.png`

The grove's silhouette. Trees are the largest thing in the game after the boss
and the first thing anyone sees, so these two rows set the look of the whole
outdoors.

Paste **Block 0-WORLD** first.

```
Sheet 73: TREES AND BUSHES. Eight UPRIGHT objects, one per cell, on a
1536 x 1024 canvas in a strict 4 x 2 grid of 384 x 512 cells.

All eight stand on the ground and are drawn nearly face-on. The base of each
trunk or clump sits low in its cell, near the bottom, because the game anchors
every one of these by its foot.

Hold these size ratios. The tallest object on the sheet is cell 4; a small
bush in the bottom row is barely a fifth of its height.

TOP ROW -- three small trees and one big one.
1. TREE, variant A. A small round-canopied tree. A straight narrow trunk in
   warm brown #5a3d2a, about a third of the total height, widening very
   slightly at the base. Above it one round mass of foliage in mid green
   #4f8a44, built from five or six overlapping rounded lobes so the outer edge
   is bumpy rather than a smooth circle. One lighter green on the upper-left
   lobes, one darker green on the lower-right. Roughly as wide as it is tall.
2. TREE, variant B. The same tree, same trunk, same height, but a slightly
   taller and narrower canopy in a cooler green #3f7a52, and the lobes bunched
   differently. It must read as the same species as variant A, just another
   individual.
3. TREE, variant C. The same again, canopy in a brighter yellow-green #5d9a4a,
   a little wider and flatter than variant A, with one lobe noticeably lower on
   the left. Same species, third individual.
4. TREE_BIG, variant A. A big tree, one and a half times the height of the
   small ones and about the same again in width. Thicker trunk in darker brown
   #523524 with two short buttress roots flaring at the base, one to each side.
   A broad heavy canopy in deep green #3f7a52 built from eight or nine lobes.
   Clearly the same species, grown up.

BOTTOM ROW -- one more big tree and three bushes.
5. TREE_BIG, variant B. The second big tree, same trunk and height as cell 4,
   canopy in a warmer green #5a8a3c and a slightly lopsided outline, heavier on
   the right.
6. BUSH, variant A. A low round shrub with no trunk at all -- a single clump of
   foliage sitting straight on the ground, wider than it is tall. Mid green
   #4a7f3e, the same bumpy lobed edge as the tree canopies. About one fifth the
   height of a small tree.
7. BUSH, variant B. The same shrub in lighter green #5b8f45, and scattered
   through it five or six tiny hot pink berries #d62e6c, each a small solid dot
   with no highlight.
8. BUSH, variant C. The same shrub again in a cool blue-green #3e6f4a, a little
   flatter and wider, no berries.

No flowers, no grass, no ground, no shadows under anything.
```

**In game:** `prop:tree:0..2`, `prop:tree_big:0..1`, `prop:bush:0..2`.
Trees are 72 x 104 and 112 x 150; bushes are 44 x 34. Trees and bushes both
sway — trees get a scale-and-angle breath, bushes a 3.5 degree rock — and both
pivot on the bottom centre, so a trunk drawn off-centre will wobble visibly.

---

### 74. Ground cover — `assets/world/groundcover.png`

The small stuff scattered between the trees. None of it blocks movement; all of
it exists to stop the floor reading as empty.

Paste **Block 0-WORLD** first.

```
Sheet 74: GROUND COVER. Eight small UPRIGHT objects, one per cell, on a
1536 x 1024 canvas in a strict 4 x 2 grid of 384 x 512 cells.

Everything on this sheet is small and low -- these are ankle height. Draw them
LARGE within their cells so the detail survives, but keep all eight to one
consistent scale relative to each other: the log in cell 8 is about three times
the width of a flower clump.

Each clump sits on the ground with its base at the bottom of the drawing.

TOP ROW -- four clumps of flowers. Each clump is four slender stems in dark
green #3f6b3a rising from one spot, each stem topped with one small simple
flower: a round blob of petals with a tiny gold #f0c060 centre dot. The stems
splay slightly and are of different heights. No leaves, no grass around them.
The four cells differ ONLY in petal colour:
1. FLOWERS, variant A -- soft pink #f5a4c0.
2. FLOWERS, variant B -- warm gold #f0c060.
3. FLOWERS, variant C -- pale blue #a0cae4.
4. FLOWERS, variant D -- white #ffffff.

BOTTOM ROW -- three grass tufts and a log.
5. GRASS_TUFT, variant A. A tuft of about eight narrow curved blades rising
   from one point and fanning outward, each blade tapering to a fine tip and
   bending over at the top, some left and some right. Mid green #6b9c58. No
   soil, no roots, no flowers.
6. GRASS_TUFT, variant B. The same tuft, darker green #4f8a44, blades a little
   shorter and bunched tighter.
7. GRASS_TUFT, variant C. The same tuft, bright yellow-green #8ab86a, blades
   taller and splayed wider.
8. LOG. A fallen log lying on its side, horizontal, about three times as wide
   as it is tall. Bark in warm brown #6a4a32 with two or three simple dark
   split lines along its length. One end faces the viewer and shows a pale
   cream cut face #c9a27a with two or three concentric rings on it. A short
   broken stub on top. It lies on the ground; it is not standing up.

No flowers on the grass tufts, no grass around the log, no shadows.
```

**In game:** `prop:flowers:0..3`, `prop:grass_tuft:0..2`, `prop:log:0`.
Flowers and tufts are 26 x 20, the log 60 x 26. Flowers and tufts sway; the log
does not.

---

### 75. Stone — `assets/world/stone.png`

Boulders and rubble. These carry three biomes between them, so they are drawn
neutral grey and the game tints nothing — they simply have to look at home on
grass, on flagstones and in a crypt.

Paste **Block 0-WORLD** first.

```
Sheet 75: ROCKS AND RUBBLE. Eight UPRIGHT objects, one per cell, on a
1536 x 1024 canvas in a strict 4 x 2 grid of 384 x 512 cells.

All stone, all cool neutral grey, all sitting on the ground with the base of
the stone at the bottom of the drawing.

Hold the ratios: the boulders in cells 4 and 5 are about twice the width and
height of the small rocks above them, and the rubble piles in the bottom row
are low and spread out.

TOP ROW -- three small rocks and one boulder.
1. ROCK, variant A. A single chunky angular stone, wider than it is tall, with
   five or six flat faces and no curves. Base grey #77757c, one bright
   upper-left face, one dark lower-right face, one narrow crack line. Sitting
   on the ground, slightly sunk, not floating.
2. ROCK, variant B. The same kind of stone, a different arrangement of faces --
   taller, leaning slightly left, a notch out of the top edge.
3. ROCK, variant C. The same again, flatter and broader, with a small patch of
   moss in mid green #4f7a3c on its left shoulder. The moss is one flat blob
   with no outline of its own.
4. ROCK_BIG, variant A. A boulder, about twice the size of the small rocks.
   Base grey #6e6c74, six or seven large flat faces, one long crack running
   from the top down to the lower left, a few small chips knocked out of the
   edges.

BOTTOM ROW -- one more boulder and three rubble piles.
5. ROCK_BIG, variant B. The second boulder, same size and grey as cell 4, a
   different face arrangement -- squatter, wider, with a flat top face you
   could stand on and a deep notch on the right.
6. RUBBLE, variant A. A loose scatter of five small broken stones lying
   together on the ground, low and spread wide -- about the width of a small
   rock but a third of the height. Grey #7a7680, each stone individually
   outlined, none stacked more than two high.
7. RUBBLE, variant B. The same, six stones, spread a little wider.
8. RUBBLE, variant C. The same, seven stones, one of them noticeably larger and
   tipped on its side.

No grass, no dirt patch, no shadows under anything.
```

**In game:** `prop:rock:0..2`, `prop:rock_big:0..1`, `prop:rubble:0..2`.
Rocks are 40 x 30, boulders 68 x 50, rubble 38 x 22. Rocks and boulders block
movement and get a shadow from the game; rubble does not.

---

### 76. Ruins — `assets/world/ruins.png`

What the ruins biome is built from. Everything here is cut stone rather than
rock: worked, old, and losing.

Paste **Block 0-WORLD** first.

```
Sheet 76: RUINED STONEWORK. Eight UPRIGHT objects, one per cell, on a
1536 x 1024 canvas in a strict 4 x 2 grid of 384 x 512 cells.

Carved stone, not boulders -- these were made by someone. Pale grey, square
edges, simple mouldings.

Hold the ratios: the standing pillars in cells 1 and 2 are the tallest things
here, nearly three times the height of a crate.

TOP ROW.
1. PILLAR, variant A. A tall slender classical column, about three times as
   tall as it is wide. A square base block at the bottom, a plain cylindrical
   shaft above it in grey #8e8993, a matching square capital block on top. Base
   and capital in slightly darker grey #7d7880 and both wider than the shaft.
   One bright vertical highlight stripe down the left of the shaft and one dark
   stripe down the right, so it reads as round. No fluting, no carving, no
   scrollwork on the capital.
2. PILLAR, variant B. The same column, same height and proportions, with a
   patch of moss in mid green #4f7a3c at its foot on the left side, and one
   small chip out of the capital.
3. BROKEN_PILLAR, variant A. The same column snapped off at a little over half
   height. Base block and lower shaft intact; above that a jagged diagonal
   break with the stone showing raw and slightly lighter at the fracture. No
   capital.
4. BROKEN_PILLAR, variant B. The same, broken lower and at a different angle --
   a shorter stump with a ragged, more horizontal top.

BOTTOM ROW.
5. STATUE. A hooded standing figure on a square plinth, about the height of a
   whole pillar. Carved from the same grey stone #8e8993, its robe falling in
   three or four simple straight folds. The hood is up and the face inside it
   is a flat dark void #4a4650 with no features at all -- no eyes, no mouth.
   Arms not visible, folded inside the robe. A patch of moss at the base on the
   right. Weathered and plain; no inscription, no held object, no wings.
6. WELL. A round stone well seen from a high angle, so the circular rim reads
   as a wide shallow ellipse -- this one object is the exception on this sheet
   and IS drawn as if looked down into. A low ring of grey stone blocks #7d7880
   with dark water #2a5f7a inside it. Two upright wooden posts #5a3d2a, one at
   each side, carrying a simple pitched wooden roof #6a4a32 above. No bucket,
   no rope, no winch.
7. CRATE, variant A. A wooden shipping crate, square, seen face-on. Planks in
   warm brown #8a6a44 with two diagonal cross-braces forming an X across the
   front face and a horizontal plank along the top. Simple and boxy.
8. CRATE, variant B. The same crate, slightly different plank spacing, one
   board sprung loose at the bottom right corner.

No ground, no grass, no shadows, no glow.
```

**In game:** `prop:pillar:0..1`, `prop:broken_pillar:0..1`, `prop:statue:0`,
`prop:well:0`, `prop:crate:0..1`. Pillars are 44 x 118, broken pillars 44 x 64,
the statue 52 x 108, the well 56 x 60, crates 36 x 36. All of them block.

---

### 77. The crypt — `assets/world/crypt.png`

The third biome's dressing. Cooler and bonier than the ruins.

Paste **Block 0-WORLD** first.

```
Sheet 77: CRYPT PROPS. Eight UPRIGHT objects, one per cell, on a 1536 x 1024
canvas in a strict 4 x 2 grid of 384 x 512 cells.

Grave markers, bones, fungus and a chest. Cool greys and bone whites.

Hold the ratios: a gravestone is about twice the height of a mushroom cluster,
and the chest in cell 8 is about as wide as a gravestone is tall.

TOP ROW -- three gravestones. Each stands upright in the ground with its foot
at the bottom of the drawing, each in weathered grey stone #6e6a76 with one
bright highlight stripe down its left edge. All plain: no names, no dates, no
letters, no symbols carved on them, no crosses.
1. GRAVESTONE, variant A. A simple round-topped slab, taller than it is wide.
2. GRAVESTONE, variant B. A plain rectangular slab, flat-topped, leaning very
   slightly to the left.
3. GRAVESTONE, variant C. A slab with a pointed, gabled top, one corner broken
   off at the top right.
4. BONES, variant A. Three long bones lying loose on the ground, crossed over
   one another at angles, low and flat. Bone white #e6dfd0 with rounded knobbed
   ends. No skull.

BOTTOM ROW.
5. BONES, variant B. The same three loose bones plus a small skull resting
   among them, also bone white. The skull is simple: a rounded cranium, two
   dark empty eye sockets, a small dark nose hollow. No jaw detail, no teeth.
6. MUSHROOMS, variant A. A cluster of three toadstools of different heights
   rising from one spot. Pale cream stems #e8dcc8, domed caps in red #d64a3f,
   each cap with two or three small white spots. The tallest is in the middle.
7. MUSHROOMS, variant B. The same cluster, caps in pale tan-brown #c9a27a and
   no spots at all, stems the same cream.
8. CHEST. A wooden treasure chest, closed, seen face-on, wider than it is tall.
   Body in dark warm brown #7a4a2a, domed lid in a lighter brown #8d5a34, one
   gold band #f0c060 running across the front where lid meets body and a small
   square gold lock plate in the middle of it. No keyhole detail, no studs, no
   gems, no glow, no open lid.

No ground, no grass, no cobwebs, no shadows, no glow.
```

**In game:** `prop:gravestone:0..2`, `prop:bones:0..1`, `prop:mushrooms:0..1`,
`prop:chest:0`. Gravestones are 30 x 44, bones 34 x 18, mushrooms 22 x 18, the
chest 44 x 36. Mushrooms sway with the grass.

---

### 78. Light fixtures — `assets/world/lights.png`

Five cells, not eight. **Every one is drawn cold and unlit** — the game puts an
animated `fx:flame` on top of each and registers it as a light source, so a
flame in the art would sit behind the real one.

Paste **Block 0-WORLD** first.

```
Sheet 78: LIGHT FIXTURES, UNLIT. Five UPRIGHT objects on a 1536 x 1024 canvas
in a strict 4 x 2 grid of 384 x 512 cells: four in the top row, ONE in the
bottom row at the far left. The remaining three cells of the bottom row are
left as plain empty green with nothing in them at all.

Every one of these is a holder for a fire, drawn with NO FIRE IN IT. No flame,
no ember, no smoke, no spark, no glow, no light pool, no warm tint. The metal
and wood are cold. This matters -- the game draws the flame itself.

Hold the ratios: the brazier in cell 1 is about the height of the torches, and
the candles in cells 2 and 3 are about a third of that.

TOP ROW.
1. BRAZIER. A wide shallow metal fire-bowl on a short stem and a splayed
   tripod foot, standing on the ground. Dark iron grey, bowl #5a5560 and stem
   and foot #4a4650. The bowl is open and EMPTY -- you can see its inner
   surface, and there is no fuel, no coal and no fire in it.
2. CANDLES, variant A. Three fat candles of different heights standing together
   on the ground in a small group, no holder. Cream wax #e8dcc8 with one
   darker tone down the right of each, a small dark wick on top of each. The
   wicks are UNLIT: a short black thread and nothing more.
3. CANDLES, variant B. The same, four candles, one of them melted down to a
   stub and one leaning. Also unlit.
4. TORCH, variant A. A wall torch: a long straight wooden shaft #5a3d2a held
   in a simple dark iron bracket #4a4650 near its top, with a dark unlit head
   of charred wrapped cloth at the very top, in near-black #2a2230. Vertical.
   No flame.

BOTTOM ROW, FIRST CELL ONLY.
5. TORCH, variant B. The same torch and the same bracket, but the head at the
   top is bare fresh cloth wrapping in dirty cream, never yet lit. Same size
   and same shaft as variant A.

The other three cells of the bottom row: nothing. Plain green.
```

**In game:** `prop:brazier:0`, `prop:candles:0..1`, `prop:torch:0..1`.
The brazier is 40 x 56, candles 26 x 18, torches 18 x 44. `WorldRenderer`
offsets the flame 40px up from a brazier's foot, 34px from a torch and 8px from
candles, so the bowl and the wick tops need to land near those heights.

---

### 79. Doors and portals — `assets/world/doors.png`

Four cells, one row. These are the only props in the game drawn **wider than
tall** and they span three tiles, so the cells are wide rather than square.

Paste **Block 0-WORLD** first.

```
Sheet 79: DOORWAYS. Four objects in ONE ROW on a 1536 x 512 canvas in a strict
4 x 1 grid of 384 x 512 cells.

Each is a gateway in a wall, seen face-on, and each is WIDER THAN IT IS TALL --
roughly twice as wide as high. Draw each one filling the width of its cell and
sitting in the vertical middle of it.

All four share the same two stone gateposts so they read as one gateway in four
states: a squat, chunky, weathered grey stone post #6f6a76 at each end, with a
slightly wider block at top and bottom, and the whole span between them open.
Draw those posts IDENTICALLY in all four cells, same size, same position.

1. GATE, CLOSED. Between the posts, a portcullis of seven or eight vertical
   iron bars in grey #7a7180, each with a bright highlight line down its left
   edge, crossed by two horizontal iron straps in darker grey #5a5060 at about
   a third and two thirds of the height. The gap behind the bars is near-black
   #2a2230. It completely fills the span.
2. GATE, OPEN. The same two posts, and the span between them now EMPTY -- no
   bars across it, nothing drawn in the middle at all, just clear background so
   the floor shows through in the game. The gate itself is folded flat against
   the inside of each post: two short stacks of vertical bars, one hard against
   each post, taking up only a sliver of the span. No glow in the opening.
3. ARCH. The same two posts with nothing between them and no gate folded
   anywhere -- an open doorway that never had a door. Add a simple flat stone
   lintel resting across the top of the two posts, same grey as the posts.
4. SEALED. The same two posts with the span between them filled solid by a slab
   of rough dark stone #231c2b, mottled with two darker and two lighter grey
   patches so it reads as rubble mortared in place. Centred on that slab, one
   ring drawn in hot pink #d62e6c as a clean open circle of even thickness --
   a plain ring, not a rune, not a symbol, not a spiral, and NOT glowing. Just
   a painted circle.

No floor, no ground line, no shadows, no glow anywhere on this sheet.
```

**In game:** `door:gate_closed`, `door:gate_open`, `door:arch`, `door:sealed`.
All four are 96 x 45. `gate_open` and `arch` must have genuinely transparent
spans — the game glows the opening itself.

---

### 80. Village buildings — `assets/world/buildings.png`

**New ground.** `village.py` has been placing these five kinds since villages
existed and the client has never had a texture for one of them. Until this
sheet lands, every village is an empty field with a crossroads painted on it.

These are the largest objects in the game. Draw them face-on like everything
else — a front wall and a roof edge above it, never a roof seen from above.

Paste **Block 0-WORLD** first.

```
Sheet 80: VILLAGE BUILDINGS. Eight UPRIGHT objects, one per cell, on a
1536 x 1024 canvas in a strict 4 x 2 grid of 384 x 512 cells.

These are small rustic buildings seen FACE-ON from slightly above: you see the
front wall, the door, the windows, and the front edge of the roof overhanging
above them. You see almost none of the roof's top surface and none of the
sides. They are NOT seen from overhead and NOT drawn in isometric.

Each building sits with the bottom of its front wall at the bottom of the
drawing.

Hold the ratios: cell 5 is the biggest thing on the sheet, roughly half again
the width and height of a small hut. The banner in cell 8 is narrow and tall,
about the height of a hut but a fifth of its width.

TOP ROW -- three small huts, one big one.
1. HUT, variant A. A small cottage, a little wider than it is tall. Cream
   plastered front wall #e8dcc8 with two dark timber beams crossing it. A
   steep thatched roof in warm straw #b08040 overhanging the wall on both
   sides, its lower edge shaggy. One arched wooden door #6a4a32 in the middle
   of the front wall and one small square window beside it with dark glass
   #2a3140 and a simple timber frame. No chimney.
2. HUT, variant B. The same cottage, same size, the front wall in warm brown
   timber planks #8a6a44 instead of plaster, the door on the right and two
   small windows on the left. A short stone chimney #7d7880 at one end of the
   roof. No smoke.
3. HUT, variant C. The same cottage again, cream plaster like variant A, but
   with the roof in grey slate #6f6a76 rather than thatch, a round-topped door
   and one wide window. No chimney.
4. FORGE. A smithy: a squat open-fronted stone workshop, wider than a hut and
   lower. Rough grey stone walls #7a7370, a heavy flat timber roof, and the
   whole front open under it so you see a dark interior #2a2230. A stone
   chimney stack up the right-hand side. In the opening, an anvil in dark iron
   #4a4650 on a wooden block. The forge fire is NOT drawn -- leave the hearth
   dark and cold.

BOTTOM ROW.
5. HUT_BIG, variant A. A two-storey longhouse, half again the width and height
   of a small hut. Cream plaster below, exposed dark timber framing above, a
   long steep thatched roof #b08040. A wide double door in the centre, two
   windows on the ground floor and two smaller ones above. One stone chimney.
6. HUT_BIG, variant B. The second longhouse, same size, timber-planked walls
   #8a6a44 all the way up, a slate roof #6f6a76, a covered porch of two wooden
   posts carrying a small roof over the front door.
7. STALL. A market stall: a simple wooden trestle counter #8a6a44 with a
   striped awning stretched over it on four corner poles, the stripes in soft
   pink #f5a4c0 and cream. On the counter, three or four simple bundles and
   crates. Open on all sides -- no walls. About the width of a hut but half
   the height.
8. BANNER. A tall narrow ceremonial banner on a wooden pole planted in the
   ground. The pole is plain timber #6a4a32; the cloth hangs from a crosspiece
   near the top, long and narrow, in hot pink #d62e6c with a cream border down
   both long edges and a simple V-cut at the bottom. One plain cream circle in
   the middle of the cloth as a device -- no heraldry, no letters, no emblem
   detail. The cloth hangs straight down; it is not blowing.

No ground, no grass, no people, no animals, no smoke, no light in any window,
no shadows.
```

**Wiring, because nothing here exists yet.** Add to `VARIANTS` in
`WorldRenderer.ts`:

```ts
hut: 3, hut_big: 2, forge: 1, stall: 1, banner: 1,
```

Suggested in-game sizes, in the proportions the sheet is drawn to: hut
96 x 88, hut_big 140 x 128, forge 120 x 76, stall 96 x 52, banner 26 x 92.
All five are placed blocking with radius 26, so all five get a game shadow.

---

### 81. Villagers — `assets/world/villagers.png`

**Also new ground.** `npc.py` defines four NPCs — Elder Mara, Oren the Smith,
Siv the Apothecary and the Hearth — and three of them share the sprite name
`villager`. Nothing draws them today.

Three identical elders standing in a village is worse than none, so this sheet
gives each named role its own body and adds four townsfolk behind them.

These are the only people on the world sheets, so they carry the rule that
makes a crowd read as one village: **one body, seven outfits.**

Paste **Block 0-WORLD** first.

```
Sheet 81: VILLAGERS. Eight UPRIGHT figures, one per cell, on a 1536 x 1024
canvas in a strict 4 x 2 grid of 384 x 512 cells.

Seven people and one object. Every person is drawn standing still, facing the
viewer, arms at their sides, feet together, with the soles of their feet at the
bottom of the drawing. A calm neutral standing pose -- no gesture, no walking,
no weapon raised, no action.

ONE BODY, SEVEN OUTFITS. Draw every one of the seven people on exactly the same
underlying figure: the same height, the same simple proportions, a large round
head about a quarter of the total height, a small rounded body, short simple
limbs, and the same soft cartoon face -- two small dark dot eyes and a tiny
simple mouth, no nose, no eyebrows, no individual features. They differ ONLY in
clothing, hair and the one thing each is holding. Two villagers standing side
by side must look like two people from the same village, not two art styles.

Skin in a warm mid tone. Every garment gets a thick dark outline and two flat
tones like everything else.

TOP ROW -- the four named ones.
1. ELDER. An old woman. Long deep purple robe #4a4650 to the ankles with a soft
   pink #f5a4c0 shawl over the shoulders. White hair gathered up. Holding a
   plain wooden staff in her right hand, upright, about her own height. Slightly
   stooped, but the same height as the others.
2. SMITH. A broad-shouldered man in a heavy dark brown leather apron #6a4a32
   over a cream shirt with the sleeves rolled up. Short dark beard, bald on
   top. Holding a blacksmith's hammer head-down in one hand. No fire, no sparks.
3. APOTHECARY. A slight woman in a long teal-green coat #3e6f4a over a cream
   underdress, a satchel on a strap across her body. Dark hair in a single
   braid over one shoulder. Holding a small round glass bottle of soft pink
   liquid #f5a4c0 in one hand, at chest height. The bottle does not glow.
4. HEARTH. NOT A PERSON. A big round communal fire-pit seen from a high angle:
   a wide ring of rough grey stones #7d7880 laid on the ground, with a neat
   stack of split logs #6a4a32 built up inside it. Drawn at about the width of
   two villagers standing side by side. The fire is NOT drawn -- no flame, no
   ember, no glow. The game lights it.

BOTTOM ROW -- four ordinary townsfolk, same body, no props in hand unless said.
5. VILLAGER, variant A. A man in a simple cream tunic and brown trousers, a
   soft brown cap, empty hands.
6. VILLAGER, variant B. A woman in a long mid-green dress #4a7f3e with a cream
   apron over it, hair in a bun, carrying a small wicker basket in both hands
   at waist height.
7. VILLAGER, variant C. A young man in a pale blue shirt #a0cae4 and dark
   trousers, untidy dark hair, empty hands.
8. VILLAGER, variant D. An older man in a long grey-brown coat, a wide brimmed
   hat, leaning on a plain walking stick.

No ground, no shadows, no speech bubbles, no name labels, no background.
```

**Wiring, because nothing here exists yet.** Add to `VARIANTS`:

```ts
villager: 4, elder: 1, smith: 1, apothecary: 1, hearth: 1,
```

and change each `NpcDef.sprite` in `npc.py` from the shared `"villager"` to its
own role name, so the elder is drawn as the elder. Suggested in-game size for a
person: 34 x 58, which puts them a little shorter than the goat. The hearth is
64 x 40 and is a light source — register it in `WorldRenderer.#buildDecor`
alongside `brazier`, with the flame about 12px above its foot.

---

### 82–84. Floor tiles — `assets/world/tiles-{grove,ruins,crypt}.png`

Three sheets, twelve tiles each, one sheet per biome. The tile set is identical
in every biome and only the palette changes, so this is **one prompt pasted
three times** with a different colour table each time.

Tiles break two rules in Block 0-WORLD on purpose, and the override below says
so: they are seen **straight down**, and they **fill their cell edge to edge**
with no green around them. Nothing is keyed out of a floor.

Paste **Block 0-WORLD** first, then this, then one of the three colour tables.

```
Sheet 82: FLOOR TILES. Twelve tiles on a 1536 x 1152 canvas in a strict
4 x 3 grid of 384 x 384 cells.

THREE OVERRIDES TO THE STYLE BRIEF, for this sheet only:

1. CAMERA. Every tile is seen looking STRAIGHT DOWN at the floor. Flat on.
   No objects standing up, no side of anything, no horizon, no perspective.
2. FRAMING. There is NO green background on this sheet and no gap between
   cells. Every one of the twelve cells is filled completely, corner to corner,
   with floor. The twelve cells sit flush against each other and against the
   edges of the canvas. Do not draw cell borders or gaps -- the cells meet
   invisibly, and the only thing separating one from the next is that the
   pattern changes.
3. OUTLINES. No thick dark outline around a whole tile. These are surfaces, not
   objects. Keep the thick outline only for shapes drawn ON a tile, like the
   edge of a paving slab.

EVERY TILE MUST TILE SEAMLESSLY. This is the whole point of the sheet. Each
tile is laid down in a grid hundreds of times, so:
- The pattern must run right off all four edges of its cell and continue.
- Whatever leaves the left edge must arrive at the right edge at the same
  height, and the same top to bottom.
- Keep detail SMALL, EVEN and SCATTERED across the whole cell. No single big
  feature in the middle of a tile -- one large rock in the centre becomes a
  polka-dot grid of rocks in the game.
- No vignette, no corner darkening, no lighting falloff, no gradient across a
  tile. Even brightness corner to corner.

TEXTURE. Build every surface the same way: one flat base colour filling the
cell, then small speckles and flecks in a lighter and a darker tone of that
same colour scattered evenly over it. Hand-stippled, not noise, not a photo
texture, not a gradient.

THE TWELVE TILES, reading left to right, top row first. The colour words below
map to the colour table I paste next.

ROW 1 -- grass, three variants. Flat GRASS colour, speckled in GRASS DARK and
GRASS LIGHT, with about six short curved blades in GRASS LIGHT scattered over
each cell. The three variants have the SAME base colour and differ ONLY in
where the speckles and blades fall. They must read as one continuous meadow
when laid next to each other, never as a checkerboard.
1. GRASS A.  2. GRASS B.  3. GRASS C.

4. DIRT A. Worn earth. Start from the GRASS base colour, then a soft irregular
   patch of DIRT brown covering most of the cell, its edges broken and blotchy
   so grass shows through at the corners. Speckled in DIRT LIGHT. The blotch
   edge must be soft and uneven, never a hard square.

ROW 2.
5. DIRT B. The same worn earth, patch shaped differently, grass showing through
   at different corners.
6. PATH A. Packed trodden path in PATH brown, speckled lighter and darker, with
   two flat rounded stepping stones set into it in a lighter tone of PATH, each
   about a sixth of the cell across. Small, so they do not repeat visibly.
7. PATH B. The same path, the two stones in different places and one of them
   smaller.
8. STONE A. Cut flagstones in STONE grey. Two or three irregular slabs meeting
   along dark grout lines, the grout slightly wobbly rather than ruler-straight.
   Speckled in STONE LIGHT. The grout lines must run off the cell edges so they
   join up with the next tile.

ROW 3.
9. STONE B. The same flagstones, the slabs divided differently.
10. STONE C. The same flagstones with a patch of moss in GRASS DARK spreading
    across one grout joint. Flat, soft-edged, no outline of its own.
11. WATER. Still water in WATER blue, with four long gentle horizontal ripple
    lines in WATER LIGHT spread across the cell, each a soft wavy stroke. No
    foam, no splash, no reflection, no shoreline, no edge -- this tile is used
    in the middle of a pond and must tile against itself on every side.
12. WALL. The TOP of a low wall, seen from directly above -- this is what you
    see when you look down on a wall, not the face of it. A course of
    rectangular blocks in WALL colour laid in a running bond, each row offset
    half a block from the row above, with dark mortar lines between them. Three
    rows of blocks fit in the cell. Along the TOP edge of the cell only, a
    narrow band of WALL TOP colour, lighter, about one-eighth of the cell
    height -- this is the sunlit cap of the wall. Along the BOTTOM edge only, a
    narrow dark band the same width, the shaded foot. Left and right edges
    ordinary, so walls join sideways.
```

Then paste **one** of these three:

```
COLOUR TABLE -- GROVE. A sunlit summer meadow.
GRASS #4b7944   GRASS DARK #3a6337   GRASS LIGHT #6f9e5c
DIRT #5f6140    DIRT LIGHT #7a7650   PATH #7c6448
STONE #6f6d70   STONE LIGHT #8c898c
WATER #2a5f7a   WATER LIGHT #5f9fbf
WALL #2a3a2a    WALL TOP #4a6b46
```

```
COLOUR TABLE -- RUINS. Dry, sun-bleached, overgrown stonework.
GRASS #5b6a49   GRASS DARK #48553a   GRASS LIGHT #8a9866
DIRT #6d5b46    DIRT LIGHT #877357   PATH #8a7860
STONE #7a7370   STONE LIGHT #9a938f
WATER #3b5e6f   WATER LIGHT #6d97ab
WALL #3a332e    WALL TOP #6b5f55
```

```
COLOUR TABLE -- CRYPT. Cold, lightless, faintly violet.
GRASS #3b3b49   GRASS DARK #2c2c38   GRASS LIGHT #585870
DIRT #4a4250    DIRT LIGHT #5d5364   PATH #5f5670
STONE #4d4a5a   STONE LIGHT #6b6880
WATER #2c2f52   WATER LIGHT #5b5fa0
WALL #1c1a26    WALL TOP #3e3a52
```

**In game:** `tile:{biome}:grass:0..2`, `:dirt:0..1`, `:path:0..1`,
`:stone:0..2`, `:water`, `:wall`. Every tile is 32 x 32 and is drawn by
`TextureFactory.tileKey()`, which indexes them with `variant % n` — so the
variant counts above are not negotiable.

**Wiring, and it is different from every other sheet.** These are opaque and
full-bleed, so there is nothing to chroma-key and nothing for the frame finder
to cluster on. They need a `SheetSpec` that slices on an exact grid instead:
`key="alpha"` with a band per row, and the packer told the cells are flush.
Expect to add a `slice_grid` mode to `atlaslib.py` — the existing `grid_cols`
still hunts for alpha blobs inside a band, which finds nothing on a solid tile.

**On seams.** A generator will get the tiling close and not exact. Check every
tile by laying it out 3 x 3 before wiring it in; a seam that is invisible in a
single cell is a hard grid line across the whole floor. The grass, dirt and
water tiles are the forgiving ones because their detail is scattered; the
flagstones and the wall are the ones that will need an edge fixed by hand.

---

## The style blocks

Paste ONE per chat, never two — mixing briefs is how a health bar ends up drawn
lying on the floor.

| block | for |
| --- | --- |
| **Block 0-UI** | interface chrome: frames, controls, bars, tokens, glyphs |
| **Block 0-MOB** | creatures: enemies, the boss, anything that moves |
| **Block 0-ITEM** | objects: potions, relics, resources, pickups |
| **Block 0-WORLD** | the world: tiles, props, buildings, villagers |

Block 0-WORLD is printed in full above. The other three are in the history
at the commands at the top of this file.

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

**A cell boundary is not a cut line.** A grid band used to label every pixel by
the cell its column fell in. That splits two creatures that touch across a
boundary, which is what it was written for, and it also splits one creature
whose sword, bow or flower head overhangs its cell -- handing the overhang to
the next frame, which then drew a blade floating behind a skeleton already
holding one. 149 blobs on the built sheets straddle a boundary and the mass
either side runs smoothly from 50/50 to 100/0, so no threshold separates the
two cases. Connectivity does: seed one label from the largest piece of art in
each cell and flood it outward *through the artwork*, and the overhang is only
ever reached by the frame it is attached to.

**A prop sheet is not an animation sheet.** The world sheets are grids of
unrelated variants, like `items` and `glyphs`, not eight frames of one thing.
They want a `Band` per row with explicit `names` and `grid_cols` set, and
nothing that assumes frame *n* resembles frame *n+1*.

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
