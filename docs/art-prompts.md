# Art prompts

**Nothing outstanding. Every sheet the game asks for has been drawn.**

Jobs 1 to 4 are made and in the game -- the floor tiles, the ability icons and
the speaker portraits redrawn as the animals they actually are. Their prompts
are kept below because a sheet that is ever regenerated must be regenerated
from the prompt it was drawn to: a fresh description of the same object is how
thirty sheets stop looking like one game.

| sheet | where it went |
| --- | --- |
| **82–84** floor tiles | `build_tiles.py` → `tilesGrove`/`tilesRuins`/`tilesCrypt`, sliced by `TextureFactory.#sliceTiles` |
| **85** ability icons | `abilityIcons` atlas; the dash, ward, heal and arcane bolt stopped borrowing |
| **87** speaker portraits | `speakers` atlas, six frames named for the NPC ids |
| **92** level bar and twin vitals | `vitals` atlas; `Portrait` draws the level bar, the plate and the twin's pair |

If a sheet has to be redrawn, paste its style block and its prompt from below
unchanged. **One style block per chat, never two** -- `Block 0-WORLD` is a
camera looking down at a floor and `Block 0-UI` is flat-on to the screen, and
mixing them is how you get a health bar drawn lying in the grass.

---

## The two style blocks

Paste **one** of these at the top of a chat, before any sheet. They are full
replacements for each other, never overrides.

### Block 0-WORLD — use for jobs 1 and 3

Paste this on its own, once per chat, before the sheet.

A camera looking down at a floor. It is a full replacement for `Block 0-UI`,
not an override — that one is flat-on to the screen. Mixing the two in one
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

### Block 0-UI — use for jobs 2 and 4

Paste this on its own, once per chat, before the sheet.

Flat-on to the screen: frames, plates, rings and buttons. A full replacement
for `Block 0-WORLD`, never an override, and never both in one chat.

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

## Job 1 — floor tiles

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

## Job 2 — ability icons

Start a **new chat** for this one: it is the only remaining sheet drawn flat to
the screen rather than down at the floor.

### 85. The four missing ability icons — `assets/ui/ability-icons.png`

The icon sheet was drawn for the sandbox's seven spells. The server has six
abilities with different names, and three of them have nothing to draw with:
`shadow_dash`, `mending_light` and `aegis` are borrowing `arrow`, `iceBeam` and
`sword` today, which `animation/abilityIcons.ts` marks as borrowed. `arcane_bolt`
borrows `fireBall`, which is close but wrong-coloured.

Paste **Block 0-ITEM** first — these are objects and emblems, not chrome.

```
Sheet 85: EIGHT ABILITY ICONS, one per cell, on a 1536 x 1024 canvas in a
strict 4 x 2 grid of 384 x 512 cells. Each icon is centred in its own cell with
clear green around it. They are unrelated marks, not an animation.

These are read at about forty pixels on a dark plate, so they are SIMPLE: one
clear silhouette each, thick dark outline, two or three flat tones. No frames,
no plates, no circles behind them -- the game draws the socket and puts the
icon in it. No text, no numbers.

Every icon is drawn at the SAME optical size, about 300 pixels across, so a row
of them reads as one set.

TOP ROW -- the four the game needs now.
1. ARCANE BOLT. A single tapered dart of raw magic flying point-first to the
   upper right, with two short motion streaks trailing behind its tail. Violet
   #9a6ad6 core, pale lilac highlight along its upper edge, hot pink #d62e6c at
   the very tip. Not a flame, not an arrow with fletching -- a bolt of light
   with a hard leading point.
2. SHADOW DASH. A forward-leaning wedge of motion: one solid dark figure-shaped
   chevron at the front, and two progressively fainter copies of the same
   chevron trailing behind it to the left, like an afterimage. Near-black
   #2a2238 for the leading shape, deep violet for the two trails, pale pink rim
   light down the front edge. It reads as a dash, not as an arrow.
3. MENDING LIGHT. A rounded cross or four-petal bloom of soft light with a
   bright core, and three small rising motes above it. Warm cream #e8dcc8 body,
   gold #f0c060 core, soft pink #f5a4c0 at the petal tips. Gentle and rounded --
   no sharp points, no medical cross, no heart.
4. AEGIS. A broad rounded shield seen face-on, its surface plain, with one bold
   horizontal band across the middle. Cool grey-blue #6d97ab plate, pale blue
   #a0cae4 highlight along the top-left edge, dark outline. Add three short
   straight lines radiating outward from the shield's upper edge to say it is
   raised, not carried. No crest, no boss stud, no emblem on the face.

BOTTOM ROW -- four spares, so the next ability needs no new sheet.
5. A clenched gauntlet fist, knuckles forward, in dark iron with a pale rim.
6. A pair of crossed daggers, bone-white blades, brown grips.
7. A simple open eye with a violet iris and a pale sclera, lashes as three
   short strokes above it.
8. An hourglass, cream frame, pale blue sand in the lower bulb.
```

**Wiring.** Add the sheet to `sheets.py` beside `ICONS`, then replace the three
borrowed entries in `src/web/src/game/animation/abilityIcons.ts` and empty
`BORROWED_ICONS`. The frame names must be the server's ability ids verbatim --
`arcane_bolt`, `shadow_dash`, `mending_light`, `aegis` -- so a new ability on
the server indexes its own icon with no second lookup table.

---

## Job 3 — speaker portraits, redrawn

### 87. Who is talking — `assets/ui/speakers.png`

`dialogue.png` gave us a plate with a portrait window cut into its left end and
a `speakerFrame` to sit in it. The first pass at this sheet came back wrong, and
it is worth writing down why, because the mistake was in the prompt and not in
the generator.

**It asked for the wrong style block, and it asked for humans.** It opened with
`Block 0-UI` — dark violet chrome, a 12-pixel outline, a hard pixel grid with no
anti-aliasing — which is the brief for *frames and plates*, and it ends with the
line "no character, no creature". Then it described "an old woman", "a
broad-faced man", and told the generator the six faces "differ only in hair,
headwear, clothing and **skin tone**".

Nobody in this village has skin. `assets/world/villagers.png` is eight
anthropomorphic animals: a rabbit, a bear, a fox, a raccoon, a cat, a second
fox and a goat, plus the fire pit. The player and the twin are a cream ram with
curled horns. A portrait is a picture of a *character*, so it belongs to the
brief the characters were drawn to — **`Block 0-WORLD`** — with the camera
overridden to look at them flat on.

Paste **Block 0-WORLD** first, then this. Every description below was read off
the existing art rather than invented, so the faces match the bodies already
standing in the village.

```
Sheet 87: SIX SPEAKER PORTRAITS, one per cell, on a 1536 x 1024 canvas in a
strict 4 x 2 grid of 384 x 512 cells: four across the top row, TWO in the bottom
row at the left. The last two cells stay plain empty green.

THREE OVERRIDES TO THE BRIEF, and nothing else changes.

1. CAMERA. Not the three-quarter top-down view. These are drawn FLAT ON, square
   to the screen, eye to eye with the viewer. Everything else about the brief
   holds: the same thick dark #120c16 outline at the same weight, the same two
   or three flat tones per material, the same one soft light from the upper
   left, the same muted picture-book colour, no gradients, no glow, no blending.

2. CHARACTERS ARE THE SUBJECT. The brief says never draw characters unless the
   sheet is about them. This sheet is about them.

3. NOT FULL BODIES. Each cell is a HEAD AND SHOULDERS, cropped at the
   collarbone, centred, filling about three quarters of the cell's height. No
   arms, no hands, no props held, no legs, no ground under them.

WHO THEY ARE -- and this is the part the first attempt got wrong.

EVERY ONE OF THESE IS AN ANTHROPOMORPHIC ANIMAL, not a person. I am attaching
the existing sheet of these same characters at full body. Match them: same
species, same muzzle, same ears, same clothing, same colours. These portraits
have to read as close-ups of those exact villagers, not as new designs.

The shared face: a rounded animal head with a short muzzle, two plain dark dot
eyes with no whites, a small simple nose and a small simple mouth. No eyebrows,
no cheekbones, no individual modelling, no teeth. Fur is flat colour with one
shadow tone, never drawn strand by strand.

TOP ROW.
1. ELDER MARA -- a WHITE RABBIT. Two long upright ears, pale pink inner ear.
   Cream-white fur #f0c090 in its warmer shadows. White hair pulled up into a
   bun between the ears. A soft pink #e07090 shawl fastened at the throat with
   one small round clasp, over a deep purple #504050 robe at the shoulders.
   Old, calm, level, unbothered.
2. OREN THE SMITH -- a BROWN BEAR. Small round ears set wide on a heavy head,
   broad dark muzzle, a short darker beard under the chin. Mid-brown fur
   #a06030 with #704020 shadow. A cream #f0d0b0 shirt with the collar open, and
   the two heavy brown leather #804020 apron straps coming up over the
   shoulders. Solid and good-natured.
3. SIV THE APOTHECARY -- a RED FOX. Large pointed ears with dark tips, narrow
   pointed muzzle, white cheeks and throat against orange #e08030 fur. One dark
   braid falling forward over her shoulder. A green #406030 hooded cloak open at
   the front over a cream #f0d0b0 dress collar. Small, quick, attentive.
4. THE HEARTH -- NOT A CREATURE. The village fire pit, seen flat on and drawn at
   the same size a head would be: a ring of rough grey stones #908080 with a
   neat stack of split logs #503020 inside it. NO FLAME, no embers, no glow --
   the game lights it itself.

BOTTOM ROW, FIRST TWO CELLS ONLY.
5. THE TWIN -- a CREAM RAM, the same creature the player is. A rounded
   off-white #fcf2e8 head; two big spiral horns curling down and forward in a
   full turn on either side of the crown; two small pointed ears with pink
   inners sticking out sideways beneath the horns; shaggy pale fleece at the
   shoulders breaking into soft points. The eyes are the one difference from
   everyone else on this sheet: large, pink-magenta #e8407a, and open. Its
   expression is gentle and a little uncertain, NOT the hard glare it wears in
   combat.
6. A VILLAGER -- a GREY RACCOON, the fallback face any unnamed speaker uses. The
   black bandit mask across the eyes and the pale muzzle that go with it, grey
   #605050 fur, round ears. A soft brown flat cap on the head and a plain cream
   #e0c0a0 tunic collar at the shoulders. Pleasant and unremarkable.

The last two cells: nothing at all. Plain green.
```

**Wiring.** Frame names are the NPC ids the server sends — `elder_mara`,
`smith_oren`, `apothecary_siv`, `hearth`, `twin`, `villager` — so a line of
dialogue indexes its own face, and `faceFor()` in `DialogueScreen.ts` falls back
to `villager` for anyone unnamed. Keep the cell order above exactly: the atlas
is already generated against it, so a redraw in the same order needs no code
change at all. The dialogue screen composes `dialogue.plate` +
`dialogue.speakerFrame` + this portrait + `dialogue.nameTab`.

---

---

## Job 4 — the level bar and the twin's vitals

### 92. Level and companion bars — `assets/ui/vitals.png`

The portrait corner shows health and mana and nothing else. Two things are
missing from it: what level you are and how far through it you are, and --
once the twin is actually with you -- how the twin is doing.

`status-bars.png` already holds the two you have: a long violet capsule with a
square gem socket at its left end and an arrowhead point at its right, pink
teardrop for health and cyan diamond for mana. **The level bar must not be a
third one of those.** It is a different kind of information -- progress toward
something rather than a resource being spent -- and reading it should not mean
checking which gem is in the socket. The twin's two, by contrast, *should*
echo the player's, because they mean the same thing about someone else.

Paste **Block 0-UI** first. Flat on to the screen, dark violet chrome, hard
pixel grid, chroma green background.

```
Sheet 92: SIX INTERFACE PIECES, one per cell, on a 1536 x 1024 canvas in a
strict 4 x 2 grid of 384 x 512 cells: four across the top row, TWO in the
bottom row at the left. The last two cells stay plain empty green.

Every piece is EMPTY. The game draws its own fill, its own numbers and its own
colour inside these -- do not draw a bar that is partly full, and do not draw
any digits.

TOP ROW.
1. LEVEL TROUGH. A long, low, horizontal bar about 5 times as wide as it is
   tall, centred in its cell. Not a capsule and not arrow-tipped -- both ends
   are cut square with a small stepped notch taken out of each corner, so its
   silhouette reads as a plate rather than as the health bar's tapered
   capsule. Its opening is divided into TEN equal segments by nine thin
   vertical dividers in the frame colour #53456a, each divider the full height
   of the opening. The segments are what makes it read as progress rather than
   as a pool. Dark violet #191322 inside, #53456a rim, one thin #cfc3d4
   highlight along the top edge only.
2. LEVEL PLAQUE. A small six-sided plate, slightly wider than tall, that the
   level number is drawn inside. Flat #241d2e face, #53456a rim, and one short
   #d62e6c chevron sitting across the bottom point. Its middle is EMPTY -- no
   digits, no zero, nothing. About a third the height of the cell.
3. TWIN HEALTH TROUGH. The player's health bar shrunk and simplified: the same
   long capsule shape with the same arrowhead at its right end, but HALF the
   height and with NO gem socket at the left -- its left end is simply rounded
   off. Dark violet inside, #53456a rim. This sits under the player's own
   health bar and has to read as the same kind of thing at a glance, which is
   why the silhouette is kept and only the size changes.
4. TWIN MANA TROUGH. Identical to piece 3 in every way. Drawn as its own cell
   rather than reused so the two can be told apart if either is ever retuned.

BOTTOM ROW, FIRST TWO CELLS ONLY.
5. TWIN MARK. A small diamond about a sixth of the cell across, drawn as a
   simple faceted gem in pale blue-white #a0cae4 with a #14111a outline. It is
   set at the left end of the twin's pair of bars to say whose they are. One
   mark for both bars, not one each.
6. LEVEL-UP FLASH. The level trough's shape again, but as a solid filled
   plate in bone white #f2e8df with no opening and no dividers -- a silhouette
   of piece 1. The game lays this over the bar for a few frames when you
   level, so it must line up with piece 1 exactly: same width, same height,
   same corner notches.

The other two cells: nothing at all. Plain green.
```

**Wiring.** Frame names: `levelTrough`, `levelPlate`, `twinHealth`, `twinMana`,
`twinMark`, `levelFlash`. They go in `_ui(...)` in `sheets.py` beside
`STATUS_BARS` at the same downscale, and `HUD_ART.bars` gains the rows below
the existing two. The fills are drawn rectangles inside the art the way the
health bar's already is, so the `inset` fractions have to be measured off
pieces 1, 3 and 4 rather than guessed -- `Portrait.#buildBar` reads them.

The twin's two are only drawn while `snapshot.twin.dormant` is false. Before
the twin is found there is nobody to have vitals, and two empty troughs under
the player's would be asking a question the game has not raised yet.

---

## Redrawing a sheet

1. Save the PNG over the `assets/` path named at the top of its job.
2. Run `npm run assets` from `src/web`.

That is the whole procedure now, for all three, because every spec already
exists and every atlas is already imported. Keep the frame names and the cell
order and there is no code to touch at all.

Two things worth knowing if a fourth sheet is ever added:

- **An ordinary sheet** needs a `SheetSpec` in `src/web/scripts/sheets.py`,
  listed in `SHEETS`. `build_atlas.py` finds the artwork against its background
  and trims each frame to it.
- **Tiles do not go through that at all.** A tile is filled corner to corner on
  purpose and trimming one would be actively wrong, so `build_tiles.py` slices
  the grid and resamples each cell to `TILE` instead. `TextureFactory` cuts
  those into the same texture keys the painted floor used, which is what lets
  the renderer stay ignorant of which it got -- and why a biome with no sheet
  still gets its painted floor.

The build fails loudly on a wrong frame count, a missing source, an unknown
keying mode, or a tile sheet whose canvas is not a clean grid. It cannot see a
creature drawn at the wrong scale, a hidden grip, a tile that does not meet its
own edges, or a loop whose last frame does not meet its first. Those are what
the prompts above are for -- which is why a sheet that comes back wrong is
usually a prompt problem, not a generator problem.

---

## Getting a cut prompt back

Everything removed from this file is one command away. Pull the original rather
than writing a fresh description of the same object — the prompts are what keep
thirty-odd sheets looking like one game, and re-describing a sword is how that
quietly stops being true.

| what | where |
| --- | --- |
| sheets 73–81 and 86, and this file as it was | `git show 6894623:docs/art-prompts.md` |
| `Block 0-UI` in its original setting, sheets 53–57 | `git show b789bf9:docs/art-prompts.md` |
| the original `Block 0`, weapons, casts, HUD — sheets 1–36 | `git show da61c32:docs/art-prompts.md` |
| the eleven enemies, and `Block 0-MOB` | `docs/art-prompts-2.md` |
