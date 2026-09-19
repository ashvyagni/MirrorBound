# Art prompts II — the enemies

Everything in `docs/art-prompts.md` is made. This file is the next round: the
creatures that fill the three biomes. Nothing here has been generated yet.

It is long. Work it in order and one biome at a time — the grove is the first
stage and the only one that blocks anything.

## What the game already says

None of the names below are invented. `biome_for()` splits a run three ways —
grove near the surface, ruins in the middle, crypt at the bottom — and
`ENEMY_TYPES` on `main` already names five creatures in a crypt register: Bone
Knight, Hollow Archer, Gloom Hound, Mire Slime and The Mirror.

So the crypt does not need designs. It needs **art for mobs the server already
has**, under the ids it already uses, which is the one part of this document
that costs no server change at all. The grove and the ruins are genuinely
empty, and that is where the new creatures go.

| biome | floor | mobs | status |
| --- | --- | --- | --- |
| grove | grass and dirt | 3 | new designs |
| ruins | stone and dirt | 4 | new designs |
| crypt | stone | 4 | art for `main`'s existing ids |

Eleven creatures, four sheets each: **idle**, **alert**, **walk**, **attack**.
Plus two enemy projectiles and one shared alert mark. Forty-seven sheets.

## Two decisions that save a lot of drawing

**The exclamation is one sheet, not eleven.** Every mob needs the mark that pops
over its head when it notices you, and drawing it into each mob's alert sheet
means eleven copies of the same symbol that will drift apart by the third one.
So a mob's alert sheet is the *body's* reaction — the flinch, the rise, the
turn toward you — and `assets/enemies/alert-mark.png` is the mark, composited
above whichever creature is reacting. Same reason weapon sheets carry no
character.

**Mobs are side-on only.** The goat has three drawings of itself because it is
the one thing you look at constantly. A mob is looked at while it walks at you
and dies, and `facing` mirroring a side profile is what the dummy already does.
Back and front sheets are the upgrade path, not the first pass — and at eleven
creatures they would be thirty-three more sheets.

## The rule that decides every palette here

**A creature must not be the colour of the floor it stands on.** The grove floor
is grass, scattered with green bushes, tufts and flowers; the ruins and crypt
are grey stone. So grove mobs are pale and warm — bone, tan, weathered
driftwood — with green only as an accent, and ruins and crypt mobs are warm,
dark or saturated, never the stone grey they stand on.

That is also why none of them are cream-and-magenta: that is the goat, and an
enemy sharing the player's colours is an enemy you lose in a fight.

## Silhouette, per biome

Three or four creatures share a screen, at about seventy pixels tall, beside a
goat and a floating companion. They are told apart by mass before anything
else, so each biome's set is built from shapes that cannot be confused:

| | grove | ruins | crypt |
| --- | --- | --- | --- |
| small circle | Bramble Sprout | Shardling | Gloom Hound *(low, long)* |
| broad and top-heavy | Bark Brute | Pillar Warden | Mire Slime *(wide dome)* |
| tall and narrow | Thorn Spitter | Ember Acolyte | Hollow Archer |
| low and flat | — | Scarab Sentinel | Bone Knight *(upright, blocky)* |

## Order

Each creature's **idle sheet is made first and attached to its other three**,
exactly as each weapon's idle was. That sheet defines the creature; the rest
inherit from it. Attaching an image holds a design far better than any
description, and it is the only thing that keeps four sheets of one mob at one
size.

| # | sheet | attach |
| --- | --- | --- |
| 1 | alert mark | — |
| 2 | Bramble Sprout — idle | — |
| 3 | Bramble Sprout — alert | 2 |
| 4 | Bramble Sprout — walk | 2 |
| 5 | Bramble Sprout — attack | 2 |
| 6 | Bark Brute — idle | — |
| 7 | Bark Brute — alert | 6 |
| 8 | Bark Brute — walk | 6 |
| 9 | Bark Brute — attack | 6 |
| 10 | Thorn Spitter — idle | — |
| 11 | Thorn Spitter — alert | 10 |
| 12 | Thorn Spitter — walk | 10 |
| 13 | Thorn Spitter — attack | 10 |
| 14 | thorn projectile | 10 |
| 15–18 | Shardling — idle, alert, walk, attack | 15 |
| 19–22 | Pillar Warden — idle, alert, walk, attack | 19 |
| 23–26 | Ember Acolyte — idle, alert, walk, attack | 23 |
| 27 | ember coal projectile | 23 |
| 28–31 | Scarab Sentinel — idle, alert, walk, attack | 28 |
| 32–35 | Bone Knight — idle, alert, walk, attack | 32 |
| 36–39 | Hollow Archer — idle, alert, walk, attack | 36 |
| 40–43 | Gloom Hound — idle, alert, walk, attack | 40 |
| 44–47 | Mire Slime — idle, alert, walk, attack | 44 |

The Hollow Archer shoots the arrow that already exists in
`assets/spells/arrow.png`; it needs no projectile of its own.

---

## Block 0-MOB — the creature style

Paste this **instead of** Block 0, on its own, once per chat. It is a
replacement, not an addition: Block 0's "never include a character or a
creature" is exactly what these sheets are made of, and leaving both in the
same conversation is how you get an empty green square back.

```
STYLE BRIEF. Read this once and apply it to every sheet I ask for in this chat.
I will describe each creature separately. All the rules below hold for every one
of them unless I explicitly override one.

I am making creature sprites for a 2D game.

THE LOOK — this is the part that matters most.
Flat, bold, storybook game art. A clean children's-book illustration turned into
a game sprite, NOT a painted fantasy render, and NOT pixel art.

- A thick, dark, slightly soft outline around every creature and every major
  internal shape. One consistent line weight throughout, around 5 pixels at this
  resolution.
- Two or three flat tones per material: a base colour, one shadow, one
  highlight. No gradients, no airbrushing, no soft painterly blending, no
  ambient occlusion, no rim lighting.
- Bold, simple silhouettes. A creature is read by its shape before anything
  else. Detail reduced to two or three clear shapes; no filigree, no scales
  drawn one by one, no fur drawn strand by strand, no micro-detail of any kind.
- Eyes are simple flat shapes -- a slit, a dot, a lens. Not glossy, not
  reflective, no catchlights, no pupils within pupils.
- Confident linework with a slightly loose, hand-drawn quality. Appealing and
  well made, but relaxed rather than mechanically precise.

Deliberately LESS rendered than typical fantasy creature art. If it looks like a
painted trading card, it is wrong. Simplify until it would still read clearly at
a third of its size.

THE CAMERA
Strict side-on elevation, as in a 2D side-scrolling platformer. Orthographic. No
perspective, no vanishing point, no foreshortening, no three-quarter view, no
top-down angle, no camera tilt. The creature faces to the RIGHT in every frame
of every sheet, because the game mirrors the sprite to turn it around.

THE SHEET FORMAT
Every sheet is a single 1536 x 1024 pixel image holding one 8-frame animation in
a strict 4 x 2 grid: 4 columns, 2 rows, each cell exactly 384 x 512 pixels. The
animation reads left to right across the top row, then left to right across the
bottom row.

BACKGROUND
Flat pure bright green (#00FF00), edge to edge, perfectly uniform. Nothing else
on it at all: no grid lines, no cell borders, no frame numbers, no labels, no
captions, no watermark, no shadows cast onto the background.

THE GROUND LINE -- get this wrong and the creature bobs through the floor.
Every creature stands on an invisible ground line. That line is at the SAME
HEIGHT in all eight cells of a sheet, and at the same height across all four
sheets of that creature. Its feet rest on it. There is no empty space below its
lowest foot -- the artwork's lowest pixel IS the foot, in every frame.
A creature that leaves the ground mid-animation -- a hop, a lunge, a pounce --
rises ABOVE that line and comes back to it, and the line itself never moves.

SCALE
The creature is exactly the same size in every frame and across every sheet of
that creature. Not similar: the same. It is centred horizontally in its cell
with at least 24 pixels of clear green on every side, and artwork never crosses
from one cell into the next.

NEVER INCLUDE
No ground, no floor, no terrain, no grass, no horizon, no background scenery, no
shadow on the ground, no text, no numbers, no labels, no health bars, no
speech, no exclamation marks, no other creatures, no human, no hand, no weapon
the creature is not described as holding. One creature alone on the green.

Reply "ready" and wait for my first sheet.
```

---

# Shared

### 1. Alert mark — `assets/enemies/alert-mark.png`

Nothing attached. One sheet, used by all eleven creatures.

This is **the one sheet that is allowed a symbol**, which Block 0-MOB otherwise
forbids outright — say so in the prompt or it will be refused or softened.

```
Sheet 1: AN EXCLAMATION MARK POPPING INTO EXISTENCE.

OVERRIDE: this sheet has no creature in it, and it IS an exclamation mark. Both
of those contradict the brief; they are correct for this one sheet only.

THE SUBJECT: a single bold exclamation mark, drawn as a SHAPE rather than typed
as a letter -- a thick tapered vertical stroke, wider at the top and narrowing
toward its base, with a separate rounded dot beneath it. Thick dark outline, a
flat bone-white body, one warm amber shadow tone down its left side. Nothing
else: no bubble, no banner, no burst, no circle behind it.

THE FEELING: it snaps into existence, overshoots, wobbles, settles and fades.
The whole thing lasts a fraction of a second in the game, so the first three
frames matter far more than the last three.

FRAMING: centred in its cell, filling about two thirds of the cell's height at
its largest. Every frame is centred on the SAME point -- the mark scales and
squashes about its own middle, and never travels across its cell.

FRAMES:
1. A tiny bright speck, about a tenth of full size.
2. Snapping open, stretched TALL and thin -- overshooting to about 1.2x full
   height, narrower than its final width.
3. Squashing -- slightly shorter and wider than full size, the dot catching up
   beneath it.
4. Settled at exactly full size and full opacity. This is the readable pose.
5. Held at full size, leaning about 5 degrees to the right.
6. Held, leaning back upright.
7. Beginning to fade -- same size, noticeably more transparent.
8. Nearly gone: same size, very faint, dissolving.
```

Fading in the last two frames means the alpha channel actually changes across
the sheet. Chroma keying handles that cleanly, but check frames 7 and 8 come
back genuinely translucent rather than merely paler green — if they come back
opaque, ask for them at 40% and 15% opacity explicitly.

---

# Part A — The grove

The first stage. Grass and dirt underfoot, trees and bushes hugging the walls,
flowers and grass tufts scattered across the open middle. Everything here is
**plant or wood**, pale enough to read against grass, and none of it is metal —
the ruins are where worked things start.

These three are also the game's teaching set: the sprout shows you that things
die in one or two hits, the brute shows you that some things do not, and the
spitter shows you that standing still is a choice.

---

## Bramble Sprout — weak melee

`sprout` · role `fast` · about **0.55×** the goat's height

A knee-high root bulb with a thorn crown, and the first thing you will ever
kill. Small, round, bottom-heavy — a fat teardrop — so it reads instantly
against the brute's broad slab and the spitter's thin line.

Pale bone-tan body, because the grove floor is green and a green creature there
is a creature nobody sees. The only green on it is the bramble crown, and that
is nearly black.

### 2. Bramble Sprout — idle — `assets/enemies/sprout-idle.png`

Nothing attached. **This sheet defines the creature**; the other three inherit
from it, so it is worth regenerating until the design is right.

```
Sheet 2: A SMALL ROOT CREATURE, BREATHING. Its resting loop.

THE CREATURE -- this design carries through three more sheets, so make it
simple and make it deliberate:
- A fat upside-down teardrop body, widest near the bottom, like a turnip or a
  parsnip standing on end. Flat pale bone-tan, one warmer tan shadow, one
  cream highlight. It has no neck: the head and body are one shape.
- A crown of dark, near-black bramble thorns sprouting from the top of the
  bulb, five or six crooked spikes of uneven length, fanning up and slightly
  back. This crown is its weapon and its silhouette.
- Two stubby twig arms, one either side, low on the body, ending in three blunt
  root fingers.
- Two short tapering root feet at the base, splayed slightly apart.
- A face of two small dark almond eye-slits set close together, low on the
  bulb, with a sullen downward tilt. No mouth, no nose, no eyebrows.
- One accent only: a dull ochre band of dried mud around the very bottom of the
  bulb, where it has been in the ground.

Cross-check before you draw: it must NOT be green, it must NOT have horns of
any kind, and it must NOT be cute. It is a sullen little root that resents
being awake.

PROPORTION: squat. The body is about as wide as it is tall, and the thorn crown
adds about another third on top.

THE MOTION: a slow, sulking idle. It breathes, the crown sways, and that is
all. It does not look around and it does not move from the spot.

FRAMES, one seamless loop:
1. Resting. Body at neutral height, crown upright. THE RESTING POSE.
2. Swelling slightly taller and narrower as it breathes in; crown lifting.
3. At its tallest, crown leaning a little back.
4. Beginning to settle, crown drifting forward.
5. Squashing slightly shorter and wider as it breathes out; crown dipping.
6. At its widest and lowest, crown lowest, arms hanging.
7. Rising back toward neutral, crown swinging gently up.
8. Almost exactly frame 1, flowing cleanly back into it.

The feet never leave the ground line in this sheet.
```

### 3. Bramble Sprout — alert — `assets/enemies/sprout-alert.png`

Attach sheet 2.

```
Sheet 3: THE SAME ROOT CREATURE FROM THE ATTACHED SHEET, NOTICING AN ENEMY.

Same creature, same design, same colours, same size, same ground line. Play it
ONCE rather than looping.

It has just seen something. Read it as: a flinch, then a swell of anger.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly -- the game
crossfades out of the idle loop on that frame, and any difference shows as a
jump.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. A hard flinch: the whole body squashes DOWN and wide, crown flattening back,
   arms snapping out. Caught by surprise.
3. Still squashed, held at its lowest, eyes widening from slits into small
   rounds.
4. Beginning to rise, crown starting to bristle upward.
5. Rising fast, body stretching taller than its resting height, crown spiking
   straight up and fanning wider than before.
6. At full height, crown fully bristled and spread, arms raised, eyes narrowed
   back to angry slits.
7. Settling forward -- the body tips toward the right, weight going onto the
   front foot, crown angling forward like lowered horns.
8. THE READY POSE: leaning forward and to the right, crown bristled and aimed
   ahead, arms forward, plainly about to charge. Hold this pose clean and
   readable -- the walk sheet starts from it.

Nothing else appears in the frame -- no exclamation mark, no motion lines, no
impact marks. The mark is drawn separately by the game.
```

### 4. Bramble Sprout — walk — `assets/enemies/sprout-walk.png`

Attach sheet 2.

```
Sheet 4: THE SAME ROOT CREATURE FROM THE ATTACHED SHEET, WADDLING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

It has no knees and almost no legs, so it does not stride -- it WADDLES,
rocking its whole body from one root foot to the other. The crown swings a beat
behind the body, like a heavy hat.

It walks IN PLACE: it does not travel across its cell. Its horizontal centre is
the same in all eight frames.

FRAMES:
1. Contact: weight fully on the right foot, body tipped right, left foot just
   lifting. Crown trailing left.
2. The body rocks up and over the right foot, left foot swinging through, the
   whole creature at its highest.
3. Left foot reaching forward and about to plant, body tipping left, crown
   catching up and swinging right.
4. Contact on the left: weight lands on the left foot, body tipped left, a
   small squash on impact. Crown at its rightmost.
5. Mirror of frame 1 on the other side: weight on the left foot, right foot
   lifting, crown trailing right.
6. Mirror of frame 2: rocking up over the left foot, at its highest.
7. Mirror of frame 3: right foot reaching forward, crown swinging left.
8. Mirror of frame 4: contact on the right, squashing, crown at its leftmost,
   flowing cleanly back into frame 1.

The body leans forward throughout -- it is chasing something, not strolling.
At its highest, in frames 2 and 6, the lifted foot may clear the ground line but
the planted foot never does.
```

### 5. Bramble Sprout — attack — `assets/enemies/sprout-attack.png`

Attach sheet 2.

```
Sheet 5: THE SAME ROOT CREATURE FROM THE ATTACHED SHEET, HEADBUTTING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

The attack is a thorn-first headbutt: it rears back, then throws its whole body
forward crown-first, because it has no arms worth swinging.

FRAME 1 IS THE READY POSE -- leaning forward and to the right, crown bristled --
the same pose the alert sheet ends on.

FRAMES:
1. The ready pose: leaning forward, crown aimed ahead.
2. WIND UP: rocking back and up onto its heels, body arching backward, crown
   pulled back and up, arms drawn in. The furthest point back.
3. Held at the top of the wind-up, compressed, about to release.
4. THE HIT: the body fires forward and down, crown driven ahead of it, thorns
   leading. The creature is stretched long and low, its back foot off the
   ground, its body crossing further right than in any other frame. This is the
   frame that lands the blow, and it should be the most extreme drawing on the
   sheet.
5. Follow-through: past the hit, body still stretched forward, crown flattened
   back from the impact, off balance.
6. Recovery: the body compresses, feet gathering back under it, crown flopping
   forward.
7. Rocking back upright, crown swinging back up, finding its balance.
8. Back to the ready pose, matching frame 1, ready to swing again.

No impact effect, no dust, no motion lines, no stars -- the thorn crown doing
the work is the whole of it.
```

---

## Bark Brute — strong melee

`brute` · role `tank` · about **1.5×** the goat's height, and wider than it is tall

The thing that teaches you to stop mashing. Broad, top-heavy, slow: a slab of
pale driftwood with arms far too big for it and legs far too small, so its mass
sits high and reads as a threat before you have parsed a single detail.

Pale weathered driftwood grey-tan, not green and not brown-black — it has to
carry against grass at the same value the sprout does, or a fight with both in
it becomes one readable enemy and one smudge. Moss is an accent, three patches
at most.

### 6. Bark Brute — idle — `assets/enemies/brute-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 6: A HULKING WOODEN BRUTE, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A broad, hunched slab of a body made of pale weathered driftwood: flat
  bone-grey, one warm tan shadow, one near-white highlight. Wider than it is
  tall. Read it as a stump that stood up.
- NO neck and barely a head: the top of the body is a knotted burl with two
  deep dark sockets in it, each holding a small flat warm-amber eye. The
  shoulders rise HIGHER than the head, which is what makes it read as hunched.
- Two enormous arms, each nearly as thick as the torso, hanging to the ground
  and ending in heavy knuckled fists of bundled roots. The arms are the
  silhouette; make them unmistakably too big.
- Two short stumpy legs, almost buried under the body, barely visible.
- Three or four deep vertical cracks down the torso, drawn as simple dark
  shapes, with a dull ember-amber glow deep inside them.
- ACCENT ONLY: two or three small patches of dull moss-green on the shoulders
  and one forearm. Nothing else is green.

Cross-check: it must NOT be leafy, it must NOT have a face beyond the two eye
sockets, and it must NOT be symmetrical -- one arm heavier, the burl set off to
one side. Bold shapes only; no woodgrain, no bark texture drawn line by line.

PROPORTION: about three units wide to two units tall. If it looks like a tall
figure, it is wrong -- it is a wide one.

THE MOTION: a heavy, slow idle. It is enormous and it breathes like it. The
arms hang and swing a little; the body rises and falls. It does not look
around.

FRAMES, one seamless loop:
1. Resting. Shoulders at neutral, fists on the ground. THE RESTING POSE.
2. Shoulders rising slowly, the whole mass lifting; cracks glowing a touch
   brighter.
3. At its highest, chest broadest, fists just clear of the ground.
4. Beginning to sink, arms starting to hang.
5. Settling, shoulders dropping past neutral, cracks dimming.
6. At its lowest and widest, fists planted heavily, head sunk deepest.
7. Rising back toward neutral, arms swinging gently forward.
8. Almost exactly frame 1, flowing cleanly back into it.

The feet never leave the ground line in this sheet. The motion is SMALL -- a
heavy thing moves less, not more.
```

### 7. Bark Brute — alert — `assets/enemies/brute-alert.png`

Attach sheet 6.

```
Sheet 7: THE SAME WOODEN BRUTE FROM THE ATTACHED SHEET, WAKING UP ANGRY.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It does not flinch -- it is too big to be startled. It slowly registers you,
straightens, and the light inside it comes up.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The head turns: the burl rotates toward the right, eyes narrowing to bright
   slits. Body still slumped.
3. The eyes flare -- amber, clearly brighter -- and the cracks down the torso
   brighten with them.
4. The shoulders begin to lift and roll BACK, chest opening, arms tensing.
5. Rising: the whole mass stands taller than it ever is at rest, hunch
   straightening, fists lifting clear of the ground.
6. At full height, chest wide, both fists raised to waist height, cracks at
   their brightest. The largest and most imposing drawing on the sheet.
7. Settling forward into a stalk: shoulders rolling forward again, weight going
   onto the right foot, fists forward and low.
8. THE READY POSE: hunched forward and to the right, fists up and ahead, eyes
   and cracks still bright, plainly about to come at you. The walk sheet starts
   from this pose.

Nothing else in the frame -- no exclamation mark, no motion lines, no dust.
```

### 8. Bark Brute — walk — `assets/enemies/brute-walk.png`

Attach sheet 6.

```
Sheet 8: THE SAME WOODEN BRUTE FROM THE ATTACHED SHEET, LUMBERING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

It is enormous and slow. Each step is a fall caught at the last moment: the
whole mass tips over the planted foot and lands hard. The arms swing wide and
LATE, a beat behind the body, and the knuckles very nearly graze the ground at
the bottom of each swing.

It walks IN PLACE: it does not travel across its cell.

FRAMES:
1. Contact: the right foot slams down, the whole mass squashing on the impact,
   shoulders driven down. Left arm forward, right arm back.
2. Weight rolling forward over the right foot, body compressing lowest, left
   leg beginning to drag through.
3. The mass tips up and forward, left leg swinging through low and heavy, arms
   crossing the middle of their swing.
4. Hanging at the top of the tip, left foot reaching ahead, about to fall onto
   it. Highest point of the cycle.
5. Contact on the left: the left foot slams, mass squashing again, right arm
   forward now and left arm back. Mirror of frame 1.
6. Mirror of frame 2: rolling forward over the left foot, lowest.
7. Mirror of frame 3: right leg swinging through, arms crossing.
8. Mirror of frame 4: hanging at the top, right foot reaching ahead, flowing
   cleanly back into frame 1.

Keep the hunch throughout: the shoulders stay higher than the head in every
frame. The planted foot never leaves the ground line.
```

### 9. Bark Brute — attack — `assets/enemies/brute-attack.png`

Attach sheet 6.

```
Sheet 9: THE SAME WOODEN BRUTE FROM THE ATTACHED SHEET, SLAMMING THE GROUND.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It raises BOTH fists over its head and brings them down onto the ground in
front of it. A slow, obvious, telegraphed attack -- the wind-up is long on
purpose, because it is the window the player is meant to learn to read.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: hunched forward, fists up and ahead.
2. WIND UP begins: the body straightens and leans BACK, both fists swinging up
   and behind the head, cracks brightening.
3. Fully wound: standing at its tallest, arched backward, both fists raised high
   over and behind the burl, chest fully open, cracks at their brightest. The
   most extreme backward drawing on the sheet, and the frame the player reads
   to know a slam is coming.
4. Held at the top. Nearly identical to frame 3, a fraction further back and a
   touch brighter -- the hang before it commits.
5. THE SLAM: both fists driven down and forward into the ground ahead of it,
   body folded sharply over them, shoulders past the knees, legs braced. The
   fists are at the ground line and further right than in any other frame. This
   is the frame that lands the blow.
6. Impact settle: still folded over the fists, the whole mass compressed and
   squashed by its own weight, cracks flaring bright from the effort.
7. Recovery: beginning to straighten, fists dragging back off the ground, head
   coming up, cracks dimming.
8. Back to the ready pose, matching frame 1.

No dust, no cracks in the earth, no shockwave, no debris -- there is no ground
on this sheet, and the game draws any impact effect itself.
```

---

## Thorn Spitter — ranged

`spitter` · role `ranged` · about **1.25×** the goat's height, and very narrow

The one that punishes standing still. A tall, thin stalk on two spindly legs
with a heavy seed pod for a head — a vertical line with a weight on top, which
is a silhouette neither of the others can be mistaken for.

It keeps its distance and lobs thorns. In a room with the other two, it is the
one you are supposed to notice last and regret noticing last.

### 10. Thorn Spitter — idle — `assets/enemies/spitter-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 10: A TALL PLANT CREATURE ON TWO LEGS, SWAYING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A tall, thin, slightly stooped stalk of a body, no thicker than a wrist,
  in flat dry straw-cream with one warmer tan shadow. It is a plant, not an
  animal: no chest, no shoulders, no arms at all.
- On top, a heavy bulbous SEED POD, like a closed pitcher plant -- easily three
  times the width of the stalk, hanging slightly forward under its own weight.
  Dull ochre, with four or five dark vertical ribs down it and a seam running
  along its front where it will split open. The pod is the silhouette.
- No face. Where a face would be there is only the seam. It has no eyes.
- Two thin jointed legs like a wading bird's, knees bending BACKWARD, ending in
  three splayed root toes.
- A collar of three or four drooping dull-green leaves where the pod meets the
  stalk. This is the only green on the creature.
- Two or three small thorns along the stalk, dark and short.

Cross-check: NO arms, NO eyes, NO flower, NO petals, and it must not read as
friendly or decorative. It is a tall thin thing with a heavy head and no face.

PROPORTION: extreme. The whole creature is about five times taller than it is
wide at the stalk. The pod is the widest part and it sits at the very top.

THE MOTION: it sways like a plant in wind, with the heavy pod leading and the
thin stalk following. Slow, weightless, and slightly unsettling because nothing
about it is looking at anything.

FRAMES, one seamless loop:
1. Resting: stalk near vertical, pod hanging slightly forward. THE RESTING POSE.
2. The pod drifts right, the stalk bowing after it, leaves trailing left.
3. Furthest right, stalk bowed into a shallow C, pod hanging low.
4. Rebounding, stalk straightening, pod swinging back through centre.
5. Passing vertical, pod lifting slightly, leaves lifting with it.
6. The pod drifts left, stalk bowing the other way.
7. Furthest left, less far than it went right -- an uneven sway reads as alive.
8. Returning, almost exactly frame 1, flowing cleanly back into it.

The feet stay planted on the ground line throughout; only the stalk and pod
move. The knees flex a little to absorb the sway.
```

### 11. Thorn Spitter — alert — `assets/enemies/spitter-alert.png`

Attach sheet 10.

```
Sheet 11: THE SAME PLANT CREATURE FROM THE ATTACHED SHEET, SENSING PREY.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It has no eyes, so it cannot look at you -- it SENSES you, and the whole
creature orients. That is the feeling: a blind thing turning its heavy head
toward a sound.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The sway stops dead. The stalk goes rigid and vertical, the pod freezing
   mid-drift. Held unnaturally still.
3. The pod rotates toward the right, seam turning to face forward. The leaf
   collar flares outward and stiffens.
4. The stalk rises, the creature drawing itself up TALLER than at rest, knees
   straightening, pod lifting high.
5. At full height, pod aimed straight ahead along the right, seam fully facing
   forward, leaves fully flared and rigid.
6. The seam parts -- a thin dark line opening down the front of the pod, barely
   a crack, with a faint amber glow inside.
7. The stalk bows forward slightly, aiming the pod, knees bending back into a
   braced stance.
8. THE READY POSE: braced, stalk angled forward, pod levelled ahead and seam
   cracked open, leaves flared. Clearly aiming. The walk and attack sheets both
   start from this pose.

Nothing else in the frame -- no exclamation mark, no projectile yet, no glow
outside the pod.
```

### 12. Thorn Spitter — walk — `assets/enemies/spitter-walk.png`

Attach sheet 10.

```
Sheet 12: THE SAME PLANT CREATURE FROM THE ATTACHED SHEET, STALKING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

Backward-bending knees, so it walks like a heron or a raptor: high, deliberate,
placed steps. The heavy pod stays as LEVEL as it can while the legs do the work
underneath -- like a bird keeping its head still. That contrast, still head over
busy legs, is the whole character of the walk.

It walks IN PLACE: it does not travel across its cell.

FRAMES:
1. Contact: right foot planted ahead, left foot back, weight settling. Pod
   level and forward.
2. Weight rolling onto the right foot; left leg lifting, knee folding backward
   and HIGH -- a deliberate, exaggerated lift.
3. Left leg at the top of its lift, toes gathered, swinging through. Stalk
   leaning very slightly right to compensate.
4. Left foot reaching forward and down, about to plant. Pod still level.
5. Contact on the left: mirror of frame 1. Pod dips a few pixels on the
   landing, then holds.
6. Mirror of frame 2: right leg lifting, knee folding back and high.
7. Mirror of frame 3: right leg at the top of its lift.
8. Mirror of frame 4: right foot reaching forward, flowing back into frame 1.

Keep the pod within a very small vertical range across all eight frames -- it
should look almost locked in place. The planted foot never leaves the ground
line; the lifted foot rises well above it.
```

### 13. Thorn Spitter — attack — `assets/enemies/spitter-attack.png`

Attach sheet 10.

```
Sheet 13: THE SAME PLANT CREATURE FROM THE ATTACHED SHEET, SPITTING A THORN.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

The pod rears back on the stalk, splits wide open, and whips forward to spit.
The thorn it fires is drawn on its OWN sheet and composited by the game -- so
draw the pod throwing something, and draw nothing leaving it.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: braced, pod levelled ahead, seam cracked.
2. WIND UP: the stalk bows backward, carrying the pod back and up over the rear
   leg, seam widening. Legs brace harder.
3. Fully wound: pod as far back as it goes, stalk curved into a bow, seam open
   into a dark slot with a clear amber glow inside. The most extreme backward
   drawing on the sheet.
4. The pod SPLITS: the seam opens wide into four petal-like segments peeling
   back, exposing a bright amber throat. Still held back. This is the frame
   that says a shot is coming.
5. THE SPIT: the stalk whips forward and straightens hard, driving the open pod
   ahead of it, segments flung wide and streaming back from the motion. The pod
   is further right than in any other frame. THE THORN LEAVES ON THIS FRAME,
   but do not draw the thorn -- leave the throat open and empty.
6. Follow-through: pod past the shot and still forward, segments flared back,
   throat dimming, stalk overbent.
7. Recoil: the pod snaps back toward centre, segments folding closed, stalk
   whipping back past vertical.
8. Back to the ready pose, matching frame 1: pod levelled, seam closed to a
   crack, braced to fire again.

No thorn, no projectile, no muzzle flash, no trail, no spray -- the game draws
all of that. An empty open throat is correct.
```

### 14. Thorn projectile — `assets/spells/thorn.png`

Attach sheet 10, so the thorn matches the pod that threw it.

```
Sheet 14: A THORN IN FLIGHT.

OVERRIDE: this sheet has no creature in it. It is a single small object.

THE OBJECT: one hard, dark thorn, shaped like a short curved claw -- broad at
the base, tapering to a needle point, with a slight backward curve. Near-black
dark brown body, one warm ochre highlight along its upper edge, thick dark
outline. About the length of the creature's pod is wide, and no longer.

It flies POINT FIRST toward the RIGHT, and it is drawn horizontally: the point
at the right of the cell, the base at the left. It does not tumble.

A short, tight trail of three or four small amber flecks streams back from its
base, close to the thorn and fading quickly -- not a long comet tail, not a
glow, not smoke.

FRAMING: centred in its cell, the thorn drawn LONG and thin across the cell's
width. It occupies the middle third of the cell's height and no more.

THE MOTION: it is a loop, played while the thorn travels, so it must cycle
seamlessly. The thorn itself barely changes; the flecks behind it do.

FRAMES, one seamless loop:
1. Thorn level, three flecks close behind it.
2. Flecks drifting back and fading, a new fleck appearing at the base.
3. Thorn a hair higher, flecks spread wider.
4. Flecks at their widest spread and faintest.
5. Thorn level again, a fresh tight cluster of flecks at the base.
6. Flecks beginning to drift back.
7. Thorn a hair lower, flecks spreading.
8. Returning to match frame 1, flowing cleanly back into it.

The thorn stays at the SAME position and the SAME size in all eight frames --
only the flecks move. The game moves the thorn across the screen; the sheet
must not also move it, or the two motions fight.
```

---

# Part B — The ruins

The middle stretch. Stone floors with dirt patches, standing and broken
pillars, crates, statues, rubble and bones. Where the grove is plant and wood,
this is **fired clay, dressed stone and bronze** — worked things, left behind.

Four mobs rather than three, because this is where the game stops teaching and
starts combining: something to swarm you, something to wall you off, something
to shoot you and something to flank you, all in one room.

Nothing here is stone grey. The floor is, and a grey creature standing on it is
a creature nobody sees. Warm terracotta, warm sandstone, bronze and near-black
cloth carry the whole biome.

---

## Shardling — weak melee

`shardling` · role `fast` · about **0.5×** the goat's height

Broken pottery that will not stay broken. A small round pot-bellied body of
terracotta shards held together by dark sinew, scuttling on four stubby legs.
The ruins' answer to the sprout, and the same lesson: these die in one hit and
arrive in threes.

### 15. Shardling — idle — `assets/enemies/shardling-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 15: A SMALL CREATURE OF BROKEN POTTERY, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A round, pot-bellied body, wider than it is tall, assembled from six or seven
  large curved TERRACOTTA SHARDS -- flat warm orange-terracotta, one darker
  rust shadow, one pale clay highlight. The shards do not quite meet: there are
  dark gaps between them.
- Dark, near-black SINEW strands laced through those gaps, holding the shards
  together like stitches. Three or four visible, no more -- it is stitching, not
  netting.
- Inside the gaps, a dull warm amber glow, as though something is lit within
  the pot.
- NO head. The top two shards part slightly to form a dark horizontal slot, and
  a single flat amber eye sits deep inside that slot, off to one side.
- Four short stubby legs, dark sinew, splayed wide, ending in small clay hooves.
  The legs are thin; the body is fat. That contrast is the silhouette.
- One accent: a band of faded painted pattern -- two or three simple dark
  chevrons -- across the largest front shard, so it reads as a pot that was
  once decorated.

Cross-check: NOT grey, NOT stone, NOT a spider, NO mandibles, NO face beyond the
single eye in its slot. It is an angry broken jar with legs.

PROPORTION: about three units wide to two units tall, legs included.

THE MOTION: a twitchy, unsettled idle. The shards shift against each other,
grinding and resettling. It is not calm; it is barely holding together.

FRAMES, one seamless loop:
1. Resting, shards settled, legs braced. THE RESTING POSE.
2. The body swells a fraction as the shards push apart; gaps widen, glow
   brightening.
3. Widest, glow brightest, sinew visibly taut.
4. A sharp small TWITCH -- the whole body jerks a few pixels to the left, shards
   clacking back together.
5. Settled tight, gaps narrow, glow dim.
6. Tilting slowly right on its legs, shards sliding.
7. The eye slides across its slot to the other side of the gap.
8. Returning, almost exactly frame 1, flowing cleanly back into it.

The hooves stay on the ground line throughout.
```

### 16. Shardling — alert — `assets/enemies/shardling-alert.png`

Attach sheet 15.

```
Sheet 16: THE SAME POTTERY CREATURE FROM THE ATTACHED SHEET, NOTICING PREY.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It comes apart slightly and pulls itself tight again -- a threat display made of
rattling.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. Freeze: every shard locks still, the eye snapping to the right.
3. The body FLARES -- all the shards push outward at once, gaps opening wide,
   sinew stretched taut, amber glow flooding out between them. It is visibly
   bigger than at rest.
4. Held flared, at its widest and brightest, legs splayed and braced.
5. Snapping shut: the shards slam back together, the body squashing low and
   wide, glow pinched down to thin lines.
6. Held low and tight, the eye pushed forward in its slot, legs gathering under
   it.
7. Rising onto its legs, front end tipping down toward the right.
8. THE READY POSE: crouched low, front tipped down, legs gathered under it,
   glow steady and bright. Plainly about to rush. The walk sheet starts here.

Nothing else in the frame -- no exclamation mark, no dust, no shards flying off.
```

### 17. Shardling — walk — `assets/enemies/shardling-walk.png`

Attach sheet 15.

```
Sheet 17: THE SAME POTTERY CREATURE FROM THE ATTACHED SHEET, SCUTTLING.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

Four legs and no grace: it SCUTTLES, fast and low, the body barely rising while
the legs blur under it. The two legs on each side alternate, front-left with
rear-right, the way a four-legged thing actually moves.

It walks IN PLACE: it does not travel across its cell.

FRAMES:
1. Front-left and rear-right legs planted; front-right and rear-left lifting.
   Body low.
2. The lifted pair swinging forward, body rocking a few pixels up and right.
3. The lifted pair reaching ahead, planted pair pushing back, body at its
   highest -- which is not high.
4. The swung pair plants; the body squashes a little on the landing, shards
   clacking tight.
5. Mirror of frame 1: the other diagonal pair planted, the first pair lifting.
6. Mirror of frame 2.
7. Mirror of frame 3.
8. Mirror of frame 4, flowing cleanly back into frame 1.

The body leans forward throughout and stays low -- this thing is chasing. Keep
the vertical movement small and the leg movement large. At least two hooves are
on the ground line in every frame.
```

### 18. Shardling — attack — `assets/enemies/shardling-attack.png`

Attach sheet 15.

```
Sheet 18: THE SAME POTTERY CREATURE FROM THE ATTACHED SHEET, LUNGING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It has no arms and no jaws. It attacks by throwing its whole body forward, shard
edges first -- a headbutt with a broken jar.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: crouched low, front tipped down.
2. WIND UP: it rocks BACK onto its rear legs, front lifting off the ground,
   body compressing, glow dimming as the shards pull tight.
3. Fully wound: reared back at its furthest, front hooves clear of the ground
   line, shards locked, about to fire.
4. THE HIT: the body fires forward and down, ALL FOUR legs off the ground, the
   front shards driven ahead and their broken edges leading. The creature is
   stretched long and further right than in any other frame, its glow flaring
   bright. This is the frame that lands the blow.
5. Landing: front hooves slam back onto the ground line, the body squashing
   hard, rear still airborne.
6. Settling: all four hooves down, body compressed at its lowest and widest,
   shards clacking back together.
7. Gathering: legs drawing back under it, front lifting, glow steadying.
8. Back to the ready pose, matching frame 1.

No dust, no impact mark, no shards breaking off -- the game draws any effect.
```

---

## Pillar Warden — strong melee

`warden` · role `tank` · about **1.7×** the goat's height and **1.2×** its width

A column that noticed you. Warm sandstone bound in verdigris bronze, with one
arm ending in a fist and the other broken off at the elbow. Tall AND thick,
where the Ember Acolyte is tall and thin — mass is the only thing telling those
two apart at range, so the Warden has to be unmistakably heavy.

It is the wall of the biome. It does not chase well; it blocks.

### 19. Pillar Warden — idle — `assets/enemies/warden-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 19: A TOWERING STONE GUARDIAN, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A tall, THICK column for a body -- a fluted stone pillar section standing on
  end, warm sandstone ochre, one deep rust-brown shadow, one pale cream
  highlight. Three or four simple vertical flutes down it, no more. It is wide:
  roughly a third as wide as it is tall.
- Bound by three heavy BANDS OF BRONZE -- flat verdigris blue-green with a dark
  patina shadow -- one at the base, one at the waist, one at the shoulders.
  These bands are the only cool colour on it and they are what say "made".
- A blunt CAPITAL for a head: a wider squared block at the top, like the top of
  a column, with a single horizontal recess cut across it holding two small
  flat amber eyes set close together.
- ONE complete arm, on the right, heavy and squared, ending in a blunt
  four-fingered stone fist that hangs near its knee.
- The other arm BROKEN OFF at the elbow, a jagged stump with exposed bronze
  reinforcing rods bent out of it. This asymmetry is the silhouette -- keep it
  obvious.
- Two short thick legs, barely separated from the column, ending in squared
  plinth feet.
- A long diagonal CRACK running across the chest, dark, with a faint amber glow
  deep inside it.

Cross-check: NOT grey -- warm ochre sandstone. NOT slender. NO face beyond the
two eyes in their recess. NO cape, NO helmet, NO sword.

PROPORTION: three units tall to one unit wide. Heavy and vertical.

THE MOTION: an almost-still idle. It is stone; it barely moves. The chest crack
pulses slowly, the head grinds a few pixels, the fist swings barely at all.

FRAMES, one seamless loop:
1. Resting, upright, fist hanging. THE RESTING POSE.
2. The chest crack brightens slightly; dust settles from the shoulder band.
3. Crack at its brightest, the whole body risen perhaps three pixels.
4. Held, the head grinding a few pixels to the right on its neck.
5. Crack dimming, body settling back down.
6. At its lowest, crack dimmest, fist hanging its heaviest.
7. The head grinding back to centre.
8. Almost exactly frame 1, flowing cleanly back into it.

The plinth feet never move and never leave the ground line. The whole loop
should look like something enormous holding very still, not something breathing.
```

### 20. Pillar Warden — alert — `assets/enemies/warden-alert.png`

Attach sheet 19.

```
Sheet 20: THE SAME STONE GUARDIAN FROM THE ATTACHED SHEET, ROUSING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It was a pillar a moment ago. It comes alive from the base up, and the feeling
is grinding stone rather than surprise.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The chest crack flares hard, amber light spilling out along its whole length.
3. The bronze bands brighten, verdigris burning through to hot metal at their
   edges; dust shakes loose all down the column.
4. The head grinds around to face right, both eyes lighting to bright amber.
5. The shoulders roll back and the column STRAIGHTENS, rising taller than it
   ever stands at rest, the broken stump lifting.
6. At full height, chest crack blazing, fist raised to waist height, broken
   stump flared out for balance. The tallest and most imposing drawing here.
7. Settling into a guard: the column leans forward over its right foot, fist
   coming up and across the chest, stump held low.
8. THE READY POSE: leaning forward and right, fist raised across the chest,
   stump low, crack and eyes bright. The walk sheet starts from this pose.

Nothing else in the frame -- no exclamation mark, no falling rubble, no dust
cloud drawn as a separate shape.
```

### 21. Pillar Warden — walk — `assets/enemies/warden-walk.png`

Attach sheet 19.

```
Sheet 21: THE SAME STONE GUARDIAN FROM THE ATTACHED SHEET, STRIDING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

It walks like a statue that has to think about it: slow, stiff-legged, almost no
knee bend, the whole column tipping side to side over each plinth foot. The
weight lands hard. The single fist swings; the broken stump counterweights it.

It walks IN PLACE: it does not travel across its cell.

FRAMES:
1. Contact: the right plinth foot slams down flat, the column tipping right,
   the whole mass jolting. Fist back, stump forward.
2. Weight rolling onto the right foot; the left foot dragging forward, barely
   clearing the ground line.
3. The column tips upright as the left leg swings through, fist and stump
   crossing the middle of their swing.
4. The left foot reaches ahead and hangs, about to drop. Column tipped left,
   highest point of the cycle.
5. Contact on the left: the left plinth slams flat, mass jolting. Fist forward,
   stump back. Mirror of frame 1.
6. Mirror of frame 2: rolling onto the left foot, the right dragging forward.
7. Mirror of frame 3: column upright, arms crossing.
8. Mirror of frame 4: right foot reaching ahead, flowing back into frame 1.

Keep the knees nearly straight throughout -- the tipping does the work, not the
legs. The planted foot lands FLAT, never toe-first. The chest crack stays lit.
```

### 22. Pillar Warden — attack — `assets/enemies/warden-attack.png`

Attach sheet 19.

```
Sheet 22: THE SAME STONE GUARDIAN FROM THE ATTACHED SHEET, HAMMERING DOWN.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It swings its single fist up over its head and brings it down like a hammer.
Long, slow, enormously telegraphed -- the wind-up is the tell the player learns
to walk around.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: leaning forward, fist across the chest.
2. WIND UP: the column leans BACK, the fist swinging out and up, the broken
   stump dropping as a counterweight. Chest crack brightening.
3. Fully wound: arched backward, the fist raised high above and behind the
   capital, stump thrust down and back, chest crack blazing. The most extreme
   backward drawing on the sheet.
4. Held at the top, a fraction further back, dust shaking from the shoulder
   band. The hang before it commits.
5. THE HAMMER: the fist drives down and forward, the column folding over it,
   the fist reaching the ground line and further right than in any other frame.
   The stump flung up and back. This is the frame that lands the blow.
6. Impact: still folded, the whole column jolting, the chest crack flaring
   white-hot, the capital driven down between the shoulders.
7. Recovery: straightening slowly, the fist dragging up off the ground, stump
   settling, crack dimming back to normal.
8. Back to the ready pose, matching frame 1.

No dust, no cracks in the earth, no shockwave, no flying debris -- there is no
ground on this sheet.
```

---

## Ember Acolyte — ranged

`acolyte` · role `ranged` · about **1.15×** the goat's height, and narrow

The only humanoid in the game besides the goat, and deliberately so: after two
biomes of animate objects, something that walks upright and carries a tool
reads as a step up in intent. A stooped figure in near-black rags, swinging a
censer on a chain, flinging burning coals from it.

Dark where the Warden is pale, thin where the Warden is thick. Those two share
a height and nothing else.

### 23. Ember Acolyte — idle — `assets/enemies/acolyte-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 23: A HOODED FIGURE WITH A SWINGING CENSER, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A tall, thin, STOOPED figure in a long ragged robe. Flat near-black charcoal,
  one slightly lighter cool-grey shadow fold, one dim warm highlight where the
  censer lights it from below. The hem is torn into three or four ragged points
  and reaches the ground -- no feet are ever visible.
- A deep HOOD with nothing inside it but darkness and two small flat amber
  eyes, set wide apart and low in the opening. No face, no jaw, no nose.
- The shoulders are narrow and rounded forward -- it stoops badly. The
  silhouette from the shoulders up is a question mark.
- ONE thin arm reaching out from the robe, ending in a skeletal hand of three
  long fingers, holding a CHAIN.
- On the end of that chain, a CENSER: a small pierced brass sphere, flat warm
  brass with a dark patina shadow, with four or five holes in it and hot orange
  light pouring out of them. It hangs about knee height and it is the brightest
  thing on the sheet.
- One accent: a frayed ochre cord knotted at the waist.

Cross-check: NOT a skeleton -- nothing of it is visible but the one hand. NO
staff, NO book, NO lantern, NO wings. The censer on its chain is the only
object it carries, and the robe reaches the floor.

PROPORTION: five units tall to one and a half wide. Thin, and clearly thinner
than it is tall.

THE MOTION: it stands and lets the censer swing. The robe drifts, the light from
the censer moves across the robe as the censer swings, and the figure itself
barely moves at all.

FRAMES, one seamless loop -- the censer's swing is the whole animation:
1. Censer hanging at the bottom of its arc, directly below the hand. THE
   RESTING POSE.
2. Censer swinging out to the right, chain angling, light sliding right across
   the robe.
3. Censer at the top of its right swing, chain taut, hem lifting slightly.
4. Falling back, censer passing under the hand, light flooding straight up.
5. Censer swinging out to the left, chain angling the other way.
6. Censer at the top of its left swing -- a little lower than it went right.
7. Falling back toward centre, light sliding right again.
8. Almost exactly frame 1, flowing cleanly back into it.

The hem touches the ground line in every frame and never lifts clear of it. The
hood turns a few pixels to follow the censer, and no more.
```

### 24. Ember Acolyte — alert — `assets/enemies/acolyte-alert.png`

Attach sheet 23.

```
Sheet 24: THE SAME HOODED FIGURE FROM THE ATTACHED SHEET, MARKING A TARGET.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It stops the censer, straightens out of its stoop, and looks up. The censer
flares. Quiet and deliberate -- it is not startled, it has decided.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The censer stops dead mid-swing, hanging still and crooked on its chain.
3. The hood lifts and turns to the right; both amber eyes brighten sharply.
4. The figure STRAIGHTENS -- the stoop unrolling, shoulders coming back, the
   whole thing rising taller than it ever stands at rest. The hem drags.
5. At full height, upright and still. The censer flares, orange light blowing
   out of every hole and washing up the front of the robe.
6. The chain-hand draws BACK and out to the side, lifting the censer to
   shoulder height behind it. Light raking across the hood from behind.
7. The figure leans forward into its stoop again, censer held back and high,
   robe hem swinging forward.
8. THE READY POSE: stooped forward to the right, censer held back at shoulder
   height and burning bright, free hand low. Plainly winding up. The walk and
   attack sheets both start from this pose.

Nothing else in the frame -- no exclamation mark, no coals yet, no smoke.
```

### 25. Ember Acolyte — walk — `assets/enemies/acolyte-walk.png`

Attach sheet 23.

```
Sheet 25: THE SAME HOODED FIGURE FROM THE ATTACHED SHEET, GLIDING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

The robe reaches the ground and no feet are ever visible, so it does not step --
it GLIDES, the hem rippling along the floor, the body rising and falling very
slightly as though walking underneath. The censer swings with the motion.

This is the point of the design: no feet means no walk cycle to get wrong, and
the hem doing the work reads as unnatural, which is correct for it.

It moves IN PLACE: it does not travel across its cell.

FRAMES:
1. Body at neutral height, hem gathered, censer at the back of its swing.
2. Rising slightly, hem rippling forward in a wave from back to front.
3. At its highest, the hem's ripple reaching the front points, censer swinging
   forward under the hand.
4. Settling, hem points flicking forward and out, censer at the front of its
   swing.
5. At neutral again, hem wave starting over, censer falling back.
6. Dipping slightly below neutral, hem gathering and dragging.
7. Lowest, hem pooling, censer at the back of its swing again.
8. Rising back to neutral, flowing cleanly back into frame 1.

The whole figure leans forward throughout. The hem stays ON the ground line in
every frame -- it never lifts clear, and no feet ever appear. Vertical movement
is small: three or four pixels at this resolution.
```

### 26. Ember Acolyte — attack — `assets/enemies/acolyte-attack.png`

Attach sheet 23.

```
Sheet 26: THE SAME HOODED FIGURE FROM THE ATTACHED SHEET, FLINGING A COAL.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It swings the censer up and over in a wide arc and flings a burning coal out of
it. The coal is drawn on its OWN sheet -- so draw the throw, and draw nothing
leaving the censer.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: stooped forward, censer held back at shoulder height.
2. WIND UP: the arm swings the censer further back and higher, the chain taut,
   the body arching back with it. The censer flares brighter.
3. Fully wound: censer at its highest and furthest back, well above and behind
   the hood, the whole figure arched backward, robe stretched. The most extreme
   backward drawing on the sheet.
4. The censer's LID FLIES OPEN on its hinge, the sphere splitting to show a
   white-hot interior, still held back. This is the frame that says a shot is
   coming.
5. THE THROW: the arm whips forward and down, the open censer flung ahead on
   its chain past the shoulder, mouth pointing right and DOWN-RIGHT, interior
   blazing. The censer is further right than in any other frame. THE COAL
   LEAVES ON THIS FRAME -- but do not draw the coal. Leave the censer open and
   empty.
6. Follow-through: the censer swinging on past, chain slack and looping, the
   figure folded forward over the throw, hood down.
7. Recoil: the censer swings back toward the body, lid clapping shut, the
   figure straightening out of the fold.
8. Back to the ready pose, matching frame 1: censer held back at shoulder
   height, burning, ready to throw again.

No coal, no projectile, no sparks leaving the censer, no smoke trail, no fire in
the air -- the game draws all of it.
```

### 27. Ember coal projectile — `assets/spells/coal.png`

Attach sheet 23, so the coal matches the censer that threw it.

```
Sheet 27: A BURNING COAL IN FLIGHT.

OVERRIDE: this sheet has no creature in it. It is a single small object.

THE OBJECT: one lump of burning coal, a rough irregular chunk about the size of
a fist, drawn as four or five flat facets -- NOT a sphere and not a smooth ball.
Near-black charred body, with hot orange-and-yellow cracks running through it
and one small white-hot core showing in the largest crack.

Two or three small flat flame shapes lick off its upper edge, drawn as simple
tapered tongues -- flat shapes with a dark outline, not soft glow, not
particles, not smoke.

It flies to the RIGHT and it TUMBLES, slowly, one full lazy rotation across the
eight frames.

FRAMING: centred in its cell, occupying about a third of the cell's width. It
stays at the SAME position and the SAME size in all eight frames -- the game
moves it across the screen, and a sheet that also moves it makes the two
motions fight.

FRAMES, one seamless loop:
1. Coal at its starting rotation, flames licking up and back.
2. Rotated about 45 degrees, flames trailing further back.
3. Rotated about 90 degrees, a different facet catching the light.
4. Rotated about 135 degrees, the white-hot core swinging into view.
5. Rotated about 180 degrees, core brightest and most visible.
6. Rotated about 225 degrees, core turning away.
7. Rotated about 270 degrees, flames gathering.
8. Rotated about 315 degrees, flowing cleanly back into frame 1's rotation.

The coal stays the same size and the same brightness throughout -- only its
rotation and the flames change.
```

---

## Scarab Sentinel — fast flanker

`scarab` · role `fast` · about **0.6×** the goat's height and **1.4×** its width

Low, flat, wide and quick — the only creature in the ruins whose mass sits on
the floor rather than above it. A bronze beetle-shell construct that darts in,
clips you and darts out. It is what makes the Warden dangerous: you cannot walk
around the wall while something faster is behind you.

Bronze, so it shares a metal with the Warden's bands and reads as made by the
same hands.

### 28. Scarab Sentinel — idle — `assets/enemies/scarab-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 28: A LOW BRONZE BEETLE CONSTRUCT, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A low, wide, flattened DOME of a shell, like half a shield lying face down.
  Flat warm bronze-brass, one dark patina shadow, one pale gold highlight. Much
  wider than it is tall, and hugging the ground.
- A single SEAM running front to back along the top of the shell, glowing hot
  amber, widest at the front and tapering to nothing at the back. That seam is
  the only bright thing on it.
- At the front, a blunt squared BRONZE HEAD that barely protrudes, with two tiny
  amber lenses set into it and a pair of short flat MANDIBLES like bent chisels.
- Six short jointed legs, three a side, thin dark bronze, folded tight against
  the body and splayed outward at the feet. They barely lift the shell off the
  ground.
- Two or three simple RIVET rows along the shell's edge, drawn as small dark
  dots. Nothing else on the shell: no engraving, no filigree, no scarab
  markings.

Cross-check: NOT tall, NOT round, NOT green -- warm bronze. NO wings, NO
antennae, NO spider legs. It is a shield with legs, lying low.

PROPORTION: about five units wide to two units tall, legs included. If it looks
like it is standing up, it is wrong.

THE MOTION: a tense, ticking idle. It is a machine waiting. The seam pulses in
a regular beat, the legs tick, the shell barely moves.

FRAMES, one seamless loop:
1. Resting, shell settled low, seam dim. THE RESTING POSE.
2. The seam brightens sharply, a pulse running front to back along it.
3. Seam at its brightest, shell lifting a couple of pixels on its legs.
4. Seam dimming from the front; the front pair of legs TICK -- one small sharp
   reposition.
5. Shell settling back down, seam dim.
6. Held low, the rear pair of legs ticking instead.
7. The head grinds a few pixels left and back, lenses flickering.
8. Almost exactly frame 1, flowing cleanly back into it.

The feet stay on the ground line throughout. Keep every movement SMALL and
SHARP -- it ticks rather than breathes.
```

### 29. Scarab Sentinel — alert — `assets/enemies/scarab-alert.png`

Attach sheet 28.

```
Sheet 29: THE SAME BRONZE BEETLE FROM THE ATTACHED SHEET, LOCKING ON.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

A machine acquiring a target. Sharp, mechanical, no flinch -- it snaps to
attention and drops into a sprinter's crouch.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. Every leg locks. The seam snaps to full brightness in a single frame -- no
   ramp, no fade.
3. The shell RISES on all six legs, lifting higher than it ever sits at rest,
   legs straightening underneath it. Exposed and alert.
4. Held high, the head grinding hard to the right, both lenses flaring.
5. The mandibles snap OPEN, wide, held out from the head.
6. The mandibles clack shut once, sharply -- and the shell begins to drop.
7. Dropping fast into a crouch, legs folding, front end tipping down toward the
   right, seam narrowing to a hot line.
8. THE READY POSE: crouched lower than at rest, front tipped down, all six legs
   gathered and coiled, seam a bright thin line. A sprinter in the blocks. The
   walk sheet starts from this pose.

Nothing else in the frame -- no exclamation mark, no sparks, no dust.
```

### 30. Scarab Sentinel — walk — `assets/enemies/scarab-walk.png`

Attach sheet 28.

```
Sheet 30: THE SAME BRONZE BEETLE FROM THE ATTACHED SHEET, SKITTERING FAST.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

This is the fastest thing in the biome and the cycle has to say so. Six legs in
a blur, the shell held almost perfectly STILL and level above them. Still shell
over frantic legs is the whole read -- if the shell bounces, it looks heavy, and
it is not.

Six legs move in two alternating tripods: front-left, middle-right, rear-left
together; then front-right, middle-left, rear-right.

It moves IN PLACE: it does not travel across its cell.

FRAMES:
1. First tripod planted, second tripod lifted and swinging forward.
2. Second tripod reaching ahead, first tripod pushing back.
3. Second tripod planting, first tripod beginning to lift.
4. First tripod swinging forward, second pushing back.
5. Mirror of frame 1 with the tripods exchanged.
6. Mirror of frame 2.
7. Mirror of frame 3.
8. Mirror of frame 4, flowing cleanly back into frame 1.

The shell stays within two or three pixels of the same height in all eight
frames, and stays level -- no rocking, no tilting. The seam stays lit and
steady. At least three feet are on the ground line in every frame.
```

### 31. Scarab Sentinel — attack — `assets/enemies/scarab-attack.png`

Attach sheet 28.

```
Sheet 31: THE SAME BRONZE BEETLE FROM THE ATTACHED SHEET, DASHING AND BITING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

A dash-bite: it coils, launches forward off the ground, snaps its mandibles shut
mid-air, and skids to a stop. Fast and committed -- it goes past where it
started, which is what makes it a flanker rather than a brawler.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: crouched low, front tipped down, legs coiled.
2. WIND UP: coiling tighter and pulling BACK, shell sliding a little left, all
   six legs folding under it, mandibles opening. Seam flaring.
3. Fully coiled at its furthest back and lowest, mandibles wide open, seam
   white-hot. About to launch.
4. LAUNCH: the shell fires forward, all six legs extending back and off the
   ground, the whole creature airborne and stretched long, mandibles still wide.
   Clear of the ground line.
5. THE BITE: still airborne and at its furthest right -- further right than in
   any other frame -- the mandibles SNAP SHUT hard. This is the frame that lands
   the blow.
6. Landing: the feet slam back onto the ground line, shell squashing forward and
   down, legs splaying to absorb it.
7. Skid: shell settling low and level, legs bracing and dragging, seam dimming
   from white back to amber.
8. Back to the ready pose, matching frame 1: crouched, coiled, ready to dash
   again.

No dust, no speed lines, no impact marks, no sparks -- the game draws any
effect.
```

---

# Part C — The crypt

The bottom of the run, and the only biome whose roster already exists.
`ENEMY_TYPES` on `main` names Bone Knight, Hollow Archer, Gloom Hound and Mire
Slime, with health, speed, behaviour and loot already tuned. **Use those ids and
those names.** Every sheet below drops into a mob the server can already spawn;
nothing in Python changes.

Their stats are the design brief, so the art is drawn to them rather than to
taste:

| id | name | role | health | speed | behaviour |
| --- | --- | --- | --- | --- | --- |
| `skeleton` | Bone Knight | melee | 62 | 92 | CHARGE |
| `archer` | Hollow Archer | ranged | 42 | 78 | KEEP_DISTANCE |
| `hound` | Gloom Hound | fast | 38 | 210 | DART |
| `slime` | Mire Slime | tank | 115 | 48 | TANK |

Two things to hold on to. The Hollow Archer fires the arrow that already exists
in `assets/spells/arrow.png`, so it needs no projectile sheet. And the Bone
Knight is the one creature here in danger of reading as the player — the goat is
cream and bone too — so its bone is pulled cool and grey-green and most of it is
buried under dark iron.

---

## Bone Knight — `skeleton`

Upright, blocky, armoured. About **1.1×** the goat's height. `CHARGE` behaviour,
so its attack is a committed lunging thrust rather than a swing.

### 32. Bone Knight — idle — `assets/enemies/skeleton-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 32: AN ARMOURED SKELETON KNIGHT, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- An upright armoured figure, blocky and square-shouldered. The ARMOUR is the
  bulk of it: flat dark iron, almost black, with one cold blue-grey highlight
  along its top edges and one near-black shadow. A squared breastplate, heavy
  squared pauldrons wider than its hips, and a skirt of three iron plates.
- The BONE that shows is cool and GREY-GREEN, never warm and never white --
  only the skull, the forearms and the shins are bare. Everything else is
  armour. Two or three simple rib shapes show in the gap under the breastplate,
  no more.
- A bare SKULL with no helmet, tilted slightly forward, with two deep sockets
  holding small flat pale-green flames. A simple flat jaw, closed. No teeth
  drawn one by one -- three or four dark notches at most.
- In its right hand a NOTCHED SWORD: a short, heavy, straight blade of dull
  pitted iron with three obvious notches out of its edge and a plain crossguard.
  Held point-down at rest.
- The left arm bare bone, hanging, fingers slightly curled.
- One accent: a frayed deep-magenta cloth sash across the breastplate, torn at
  both ends. The only saturated colour on it.

Cross-check: it must NOT read as the player's cream goat -- the bone here is
grey-green and mostly hidden. NO helmet, NO cape, NO shield, NO glowing runes,
NO crown.

PROPORTION: three and a half units tall to one and a half wide at the pauldrons.

THE MOTION: a still, patient idle. It does not breathe. The eye flames gutter,
the sash stirs, the sword shifts in its grip. That is all.

FRAMES, one seamless loop:
1. Standing square, sword point-down, skull level. THE RESTING POSE.
2. Eye flames rising taller and brighter; the sash lifts a little.
3. Flames at their tallest, sash at its highest drift.
4. Flames guttering low; the sword grinds a few pixels in its grip.
5. Flames at their dimmest, sash falling.
6. The skull tilts a few pixels to the right, flames leaning with it.
7. Skull grinding back to level, sash settling.
8. Almost exactly frame 1, flowing cleanly back into it.

The feet stay flat on the ground line throughout. Keep the whole loop small --
it is patient, not restless.
```

### 33. Bone Knight — alert — `assets/enemies/skeleton-alert.png`

Attach sheet 32.

```
Sheet 33: THE SAME SKELETON KNIGHT FROM THE ATTACHED SHEET, TAKING GUARD.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

A soldier's reaction, not a monster's: it sights you, brings the sword up and
sets its feet. Controlled throughout.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The skull snaps right; both eye flames flare hard, doubling in height.
3. The shoulders square up, pauldrons rising, the sash snapping taut.
4. The sword arm swings the blade UP and across, point rising from the floor.
5. The blade reaches shoulder height, held level and pointing right, the free
   hand coming up open beside it.
6. At full guard: sword levelled ahead, body upright and squared, flames
   burning steady and bright. The most composed drawing on the sheet.
7. Sinking into a stance: knees bending, weight dropping onto the back foot,
   the sword drawing back beside the head, point still forward.
8. THE READY POSE: knees bent, weight back, sword cocked beside the skull with
   its point levelled at the right, free hand forward. Plainly about to charge.
   The walk sheet starts from this pose.

Nothing else in the frame -- no exclamation mark, no motion lines, no glow
beyond the eye flames.
```

### 34. Bone Knight — walk — `assets/enemies/skeleton-walk.png`

Attach sheet 32.

```
Sheet 34: THE SAME SKELETON KNIGHT FROM THE ATTACHED SHEET, ADVANCING.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

A measured combat advance, not a stroll: the sword stays levelled ahead the
whole time and the body stays squared to the target. The armour is heavy, so
each footfall lands flat and the skirt plates swing a beat late.

It walks IN PLACE: it does not travel across its cell.

FRAMES:
1. Contact: right foot plants flat ahead, weight settling, skirt plates
   trailing back. Sword levelled.
2. Weight rolling forward over the right foot; left leg lifting, knee coming
   through, skirt plates swinging forward.
3. Left leg passing through, body at its highest; skirt plates at their
   furthest forward.
4. Left foot reaching ahead and dropping, skirt plates falling back.
5. Contact on the left, mirroring frame 1: flat landing, plates trailing.
6. Mirror of frame 2: rolling over the left foot, right leg lifting.
7. Mirror of frame 3: right leg passing through, highest point.
8. Mirror of frame 4: right foot reaching ahead, flowing back into frame 1.

The sword hand stays within a few pixels of the same height in every frame --
the legs walk, the guard does not. Eye flames stay lit and steady. The planted
foot never leaves the ground line.
```

### 35. Bone Knight — attack — `assets/enemies/skeleton-attack.png`

Attach sheet 32.

```
Sheet 35: THE SAME SKELETON KNIGHT FROM THE ATTACHED SHEET, CHARGING A THRUST.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

Its behaviour in the game is CHARGE, so this is a committed running THRUST --
it cocks the sword, drives forward off its back foot and runs the blade
straight out. Not a swing, not an arc: a straight line to the right.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: knees bent, weight back, sword cocked beside the skull.
2. WIND UP: the weight sinks further back, the sword arm draws the blade back
   past the shoulder, the free hand extending forward to aim. Eye flames
   stretching back.
3. Fully wound: crouched deep over the back foot, blade drawn its furthest
   back, body coiled. The most extreme backward drawing on the sheet.
4. LAUNCH: the back leg drives, the body fires forward, the blade beginning to
   come through. The front foot leaves the ground line.
5. THE THRUST: the body stretched into a long low lunge, the sword arm fully
   extended, the blade levelled and further right than in any other frame, back
   leg trailing straight behind. This is the frame that lands the blow.
6. Held at full extension, the body a fraction lower, eye flames streaming back.
7. Recovery: the blade withdrawing, the back leg swinging under, the body
   rising out of the lunge.
8. Back to the ready pose, matching frame 1: knees bent, sword cocked, ready to
   thrust again.

No slash arc, no trail, no impact, no sparks -- the blade doing the work is all
of it.
```

---

## Hollow Archer — `archer`

Tall, thin, hollow. About **1.1×** the goat's height and narrow. `KEEP_DISTANCE`
behaviour, so it backs away as much as it advances — and the walk sheet is
played in reverse for that, which is worth knowing while drawing it.

### 36. Hollow Archer — idle — `assets/enemies/archer-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 36: A HOLLOW HUSK WITH A BOW, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A tall, thin, upright figure that is visibly EMPTY -- a husk. Its torso is an
  open shell of dry bark-like plating, flat cold grey-brown with one pale
  highlight, and there is a clear HOLE straight through its chest that you can
  see the background through. That hole is the whole idea: it is hollow.
- Long thin limbs of the same dry material, jointed simply, with no muscle.
  Narrow shoulders, no hips to speak of.
- A smooth featureless HEAD shaped like an inverted teardrop, with no face at
  all except a single horizontal slot low across it, holding one wide pale-green
  light.
- In its left hand a LONGBOW: a tall, plain, slightly recurved bow of dark wood,
  nearly as tall as the archer itself, held vertically at rest with its lower
  limb near the ground. A simple pale string. No decoration.
- A QUIVER of four or five arrows across its back, the fletchings showing over
  its right shoulder as four simple dark shapes.
- Ragged strips of grey cloth wound around its forearms and trailing from them.
- One accent: the same pale-green light as the eye, glowing faintly from deep
  inside the chest hole -- so the hole reads as lit from within rather than
  simply empty.

Cross-check: NOT a skeleton and NOT armoured -- that is the Bone Knight. NO
face, NO hood, NO cloak. Thin, hollow, and taller than it looks like it should
be.

PROPORTION: five units tall to one wide. Clearly the thinnest thing in the
biome.

THE MOTION: a watchful idle. It stands very still and scans. The bow stays
planted; the head turns; the chest light breathes.

FRAMES, one seamless loop:
1. Standing, bow vertical and planted, head level. THE RESTING POSE.
2. The chest light swells brighter; the cloth strips drift.
3. Light at its brightest; the head begins to turn right.
4. Head turned right, eye slot narrowing as it scans.
5. Light dimming; head holding right.
6. Head turning back past centre to the left, light dimmest.
7. Head returning to level, cloth settling, light rising again.
8. Almost exactly frame 1, flowing cleanly back into it.

The feet and the bow's lower limb both stay on the ground line throughout.
```

### 37. Hollow Archer — alert — `assets/enemies/archer-alert.png`

Attach sheet 36.

```
Sheet 37: THE SAME HOLLOW HUSK FROM THE ATTACHED SHEET, RAISING ITS BOW.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It spots you and lifts the bow into a firing stance. Quick, mechanical, no
flinch -- it does not fear you, it ranges you.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The head snaps right, the eye light flaring from pale to bright green.
3. The chest light floods -- the whole hollow interior lighting up and throwing
   light out through the hole.
4. The bow arm swings the bow UP off the ground and across the body, the bow
   rotating from vertical toward horizontal.
5. The bow reaches shoulder height, held out to the right and now horizontal,
   the free hand rising toward the string.
6. The free hand reaches back over the shoulder to the quiver and draws an
   arrow clear of it, holding it up. Bow held level.
7. The archer turns side-on and squares up, bow arm extending, the arrow
   brought down to the string but NOT yet nocked.
8. THE READY POSE: side-on, bow arm fully extended to the right and level,
   arrow nocked on the string with the string undrawn, feet set apart. The walk
   and attack sheets both start from this pose.

Nothing else in the frame -- no exclamation mark, no aim line, no drawn string.
```

### 38. Hollow Archer — walk — `assets/enemies/archer-walk.png`

Attach sheet 36.

```
Sheet 38: THE SAME HOLLOW HUSK FROM THE ATTACHED SHEET, STEPPING WHILE AIMING.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

It never stops aiming. This creature backs away as often as it closes, and the
game plays this same cycle BACKWARD when it retreats -- so it must read
correctly in both directions. That means no lunging, no leaning, no committed
weight: even, symmetrical, sidling steps with the bow held level throughout.

It moves IN PLACE: it does not travel across its cell.

FRAMES:
1. Feet apart, weight centred, bow levelled right. Neutral.
2. The rear foot lifts and slides toward the front foot; body height unchanged.
3. The rear foot plants close behind the front; feet nearly together.
4. The front foot lifts and reaches ahead; body still level.
5. The front foot plants ahead; feet apart again, mirroring frame 1's spacing.
6. The rear foot lifts and slides forward again.
7. The rear foot plants close behind the front.
8. The front foot reaching ahead, flowing cleanly back into frame 1.

Two rules make the reverse playback work: the body stays at exactly the same
height in all eight frames, and the bow arm never moves at all -- the bow stays
levelled to the right in every frame, at the same height and the same angle. The
legs do everything. The arrow stays nocked and the string stays undrawn
throughout. At least one foot is on the ground line in every frame.
```

### 39. Hollow Archer — attack — `assets/enemies/archer-attack.png`

Attach sheet 36.

```
Sheet 39: THE SAME HOLLOW HUSK FROM THE ATTACHED SHEET, LOOSING AN ARROW.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It draws, holds and looses. The arrow that leaves is drawn on its own sheet and
composited by the game, so the string must end EMPTY.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: side-on, bow levelled right, arrow nocked, string undrawn.
2. The draw begins: the string hand pulls back, the string bending, the bow
   limbs starting to flex. Chest light brightening.
3. Half drawn, the string hand level with the chest hole.
4. FULL DRAW: string hand back beside the head, the bow bent hard into a deep
   curve, the arrow fully drawn and the whole body tensed and leaning very
   slightly back. Chest light at its brightest. This is the frame the player
   reads to know a shot is coming.
5. Held at full draw, identical but a fraction tighter -- the hang before
   release.
6. THE LOOSE: the string snaps forward and straight, the bow limbs springing
   back past neutral, the string hand flung open behind the head, the whole
   body recoiling upright. THE ARROW IS GONE -- the string is EMPTY and there is
   no arrow anywhere in this frame.
7. Follow-through: the bow limbs oscillating, string still vibrating, the
   string hand dropping, chest light dimming.
8. Back to the ready pose, matching frame 1: bow levelled, a FRESH arrow nocked
   from the quiver, string undrawn.

No arrow in flight, no trail, no aim line, no release spark -- the game draws
the arrow. Frames 6 and 7 must have nothing on the string.
```

---

## Gloom Hound — `hound`

Low, long, fast. About **0.6×** the goat's height and **1.5×** its length. Speed
210 — the fastest thing in the game, faster than the goat's run — and `DART`
behaviour, so it comes in, bites and leaves.

### 40. Gloom Hound — idle — `assets/enemies/hound-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 40: A LOW SHADOWY HOUND, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A long, low, lean four-legged hound. Deep violet-black body, one slightly
  lighter cool violet highlight along its back and skull, one near-black
  shadow underneath. It is DARK -- the darkest creature in the game.
- Its edges are not clean: the back, the tail and the haunches break up into
  three or four ragged wisps, like smoke coming off it. Keep these as FLAT
  outlined shapes, not soft fog, and keep them few.
- A long narrow SKULL-LIKE head, low and thrust forward on a long neck, ending
  in a blunt muzzle. The mouth is a long dark split with six or seven simple
  pale fangs.
- Two flat pale-green eyes, narrow and set far back along the skull. The same
  green as the Bone Knight's flames -- they belong to the same place.
- Inside the mouth, a faint pale-green light, so an open jaw reads as lit.
- Four long thin legs with sharply angled joints, ending in three-toed feet with
  simple claws. Built for sprinting: long in the shin, thin everywhere.
- A long thin tail held low and streaming back, fraying into wisps at its tip.
- One accent: a pale bone-white bony plate across the shoulders and down the
  spine, the only light thing on it, which is what stops it reading as a black
  blob.

Cross-check: NOT fluffy, NOT a wolf, NO collar, NO armour, NO fire. Low and long
-- if it looks tall, it is wrong.

PROPORTION: about three units long to one unit tall at the shoulder.

THE MOTION: a coiled, restless idle. It is built to sprint and it is impatient.
The head sways low, the wisps drift, the shoulders roll.

FRAMES, one seamless loop:
1. Standing low, head thrust forward and level, tail streaming back. THE
   RESTING POSE.
2. The head sways right and dips; the shoulder plate rolls with it.
3. Head lowest, eyes narrowing, wisps drifting back.
4. Head rising and swinging back toward centre; the jaw parts slightly, green
   light showing.
5. Jaw closing, head passing centre, tail flicking.
6. Head swaying left and dipping, weight rolling onto the other shoulder.
7. Head rising back toward centre, wisps gathering.
8. Almost exactly frame 1, flowing cleanly back into it.

All four feet stay on the ground line throughout. The body stays LOW in every
frame -- the head never rises above the shoulder plate.
```

### 41. Gloom Hound — alert — `assets/enemies/hound-alert.png`

Attach sheet 40.

```
Sheet 41: THE SAME SHADOWY HOUND FROM THE ATTACHED SHEET, CATCHING A SCENT.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It snaps to attention, hackles up, then drops into a sprinter's crouch. Fast and
predatory -- no hesitation anywhere in it.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. Every wisp snaps still. The head locks forward, both eyes flaring bright
   green in a single frame.
3. The head RISES -- higher than it ever lifts at rest -- and the shoulders
   rise with it, the bony spine plate lifting into a ridge.
4. The jaw peels open wide, fangs bared, green light pouring out of the mouth.
   The wisps along the back stand UP, bristling like hackles.
5. Held at its tallest and widest, jaw open, hackles fully raised. The largest
   drawing on the sheet.
6. The jaw snaps shut hard; the head begins to drop.
7. Dropping fast into a crouch: the head thrusts low and forward, the haunches
   rise above the shoulders, the tail lifts and straightens back.
8. THE READY POSE: crouched with the head low and forward, haunches high and
   coiled, tail straight back, hackles still bristled, eyes bright. A sprinter
   in the blocks. The walk sheet starts from this pose.

Nothing else in the frame -- no exclamation mark, no breath, no smoke drawn as
a separate cloud.
```

### 42. Gloom Hound — walk — `assets/enemies/hound-walk.png`

Attach sheet 40.

```
Sheet 42: THE SAME SHADOWY HOUND FROM THE ATTACHED SHEET, SPRINTING.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

This is the fastest creature in the game and the cycle is a full GALLOP, not a
trot: the body gathers and extends, and all four feet leave the ground twice in
the cycle. The spine bends. The wisps stream.

It runs IN PLACE: it does not travel across its cell.

FRAMES:
1. GATHERED SUSPENSION: all four feet off the ground, the body curled tight,
   hind feet swung forward PAST the front feet, back arched up. Above the
   ground line.
2. The hind feet land first, together, taking the whole weight; the body
   beginning to uncurl.
3. The hind legs drive and extend back; the front legs reach forward; the spine
   straightening.
4. EXTENDED SUSPENSION: all four feet off the ground again, the body stretched
   out to its longest -- front legs reaching far right, hind legs trailing far
   left, back flat. The longest drawing on the sheet.
5. The front feet land; the body begins to compress over them.
6. The front legs take the weight and push; the hind legs swing forward under
   the body.
7. The body compressing hard, back arching up, hind legs coming through.
8. Leaving the ground into the gathered curl, flowing cleanly back into frame 1.

The head stays LOW and level throughout, whatever the body does -- a running
predator keeps its eyes steady. The wisps and tail stream straight back in every
frame. Frames 1 and 4 are the two airborne frames and must be clearly airborne.
```

### 43. Gloom Hound — attack — `assets/enemies/hound-attack.png`

Attach sheet 40.

```
Sheet 43: THE SAME SHADOWY HOUND FROM THE ATTACHED SHEET, POUNCING AND BITING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

Its behaviour is DART: it launches, bites in the air, lands past its target and
is already turning to leave. Fast and total -- there is no careful wind-up here,
only a coil and a release.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: head low and forward, haunches high and coiled.
2. COIL: the haunches gather further under it, the whole body compressing back
   and down, the head drawing in. Eyes and mouth-light flaring.
3. Fully coiled at its lowest and shortest, every leg folded, about to fire.
4. LAUNCH: it fires forward and UP off the ground line, front legs thrown
   ahead, jaw beginning to open, body stretching.
5. THE BITE: airborne at its furthest right and highest, body stretched at full
   length, jaw open at its widest with green light blazing out of it, front
   claws thrown forward. This is the frame that lands the blow.
6. The jaw SNAPS SHUT, still airborne, body beginning to fold, head driving
   down.
7. Landing: front feet slam onto the ground line, the body folding over them,
   hind legs coming down behind, head low.
8. Back to the ready pose, matching frame 1: crouched, coiled, already ready to
   go again.

No dust, no speed lines, no impact, no blood -- the game draws any effect.
```

---

## Mire Slime — `slime`

Wide, low, slow and hard to kill. About **0.8×** the goat's height and **1.3×**
its width. Health 115 and speed 48 — the toughest and slowest thing in the run,
and the art has to promise both.

It is the one creature here that is genuinely green, which is safe: the crypt
floor is grey stone, and the rule about not matching your floor was about the
grove.

### 44. Mire Slime — idle — `assets/enemies/slime-idle.png`

Nothing attached. **This sheet defines the creature.**

```
Sheet 44: A LARGE SLUGGISH SLIME, IDLING. Its resting loop.

THE CREATURE -- this design carries through three more sheets:
- A broad, heavy DOME of slime, much wider than it is tall, with a sagging
  weight to it -- the base spreads out flat where it meets the ground and the
  top slumps forward. Flat sickly bog-green, one darker olive shadow low in the
  mass, one pale yellow-green highlight across the upper left.
- It is TRANSLUCENT: two or three darker shapes are suspended inside it and show
  through -- a bone, a bent iron nail, a broken coin. Simple flat silhouettes,
  no more than three, sitting low in the body. They are what make it read as a
  swallowing thing rather than a blob of jelly.
- A single bright highlight shape on the upper left of the dome, a simple flat
  crescent, which is the only thing that says "wet".
- Two small flat dark eyes floating high in the mass, close together and
  slightly uneven, with no lids and no expression.
- A wide shallow MOUTH low on the front, a simple dark curve, closed at rest.
- The bottom edge is uneven and sags into two or three drips where it meets the
  ground line.

Cross-check: NO face beyond the two eyes and the mouth line. NO crown, NO
tentacles, NO cube shape, NO bubbles drawn as circles all over it. Flat tones
only -- do NOT render it as glossy or glassy.

PROPORTION: about two units wide to one unit tall. Wide and low and heavy.

THE MOTION: a slow, heavy wobble. Everything about it is viscous -- it settles,
it sags, it never snaps. This is the slowest animation on any sheet in the
game.

FRAMES, one seamless loop:
1. Settled, dome at neutral height, mouth closed. THE RESTING POSE.
2. The mass rises slowly in the middle, dome pushing up, base drawing in
   slightly.
3. At its tallest and narrowest, the suspended objects drifting upward with it.
4. Beginning to sag, the top slumping forward over the base.
5. Spreading, dome flattening, base pushing outward, objects sinking.
6. At its lowest and widest, fully slumped, drips longest at the bottom.
7. Gathering slowly back in, objects drifting back toward centre.
8. Almost exactly frame 1, flowing cleanly back into it.

The base stays on the ground line in every frame. The eyes drift a little with
the mass but stay high in it. Keep the whole loop slow and smooth -- no frame
should be a sharp change from the one before it.
```

### 45. Mire Slime — alert — `assets/enemies/slime-alert.png`

Attach sheet 44.

```
Sheet 45: THE SAME SLIME FROM THE ATTACHED SHEET, ROUSING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE.

It has no eyes worth the name and no speed, so it does not startle -- it swells
and orients, like something waking up hungry. Slow all the way through, which
is itself the threat.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET, exactly.

FRAMES:
1. The resting pose from the attached sheet, unchanged.
2. The two eyes drift together and rotate to face right; the mass holds still.
3. The whole body begins to SWELL, rising and widening at once, colour
   deepening toward a more saturated green.
4. Swelling further, the suspended objects pushed outward toward the surface,
   the highlight stretching.
5. At its largest -- noticeably bigger than at rest, taller and wider -- surface
   taut, objects pressed near the skin. The biggest drawing on the sheet.
6. The MOUTH opens: the dark curve low on the front peeling wide into a deep
   dark opening, with the darker interior showing.
7. The mass leans forward over its base toward the right, the base creeping
   after it, mouth still open.
8. THE READY POSE: leaning forward and right, swollen, mouth open, objects
   pressed forward in the mass. The walk sheet starts from this pose.

Nothing else in the frame -- no exclamation mark, no drips flying off, no
splash.
```

### 46. Mire Slime — walk — `assets/enemies/slime-walk.png`

Attach sheet 44.

```
Sheet 46: THE SAME SLIME FROM THE ATTACHED SHEET, OOZING FORWARD.

Same creature, same design, same colours, same size, same ground line. A
seamless 8-frame loop, facing and travelling to the RIGHT.

It has no legs. It moves by pushing its mass forward and dragging its base after
it -- a slow peristaltic crawl, like a wave travelling through it from back to
front. Speed 48 in the game, which is a quarter of the hound: the cycle has to
look laborious.

It moves IN PLACE: it does not travel across its cell.

FRAMES:
1. Settled, dome neutral, base spread evenly. Neutral.
2. The REAR of the mass gathers and rises, bunching up at the back; the front
   stays put and the body leans forward.
3. The bunch travels forward through the body: the middle rises, the rear
   flattens.
4. The bunch reaches the front: the dome pushes forward and out over the base,
   overhanging it to the right. The front is ahead of the base.
5. The base CREEPS after it: the bottom edge stretches forward to catch up,
   drips dragging behind.
6. The base catches up and settles under the dome; the whole mass squashes down
   and spreads.
7. At its lowest and widest, fully settled, the objects inside sinking.
8. Gathering back in toward neutral, flowing cleanly back into frame 1.

The base touches the ground line in every frame -- it never hops, never leaves
the floor. The suspended objects lag behind the surface wave, arriving a frame
or two late, which is what sells it as thick.
```

### 47. Mire Slime — attack — `assets/enemies/slime-attack.png`

Attach sheet 44.

```
Sheet 47: THE SAME SLIME FROM THE ATTACHED SHEET, LUNGING AND ENGULFING.

Same creature, same design, same colours, same size, same ground line. Plays
ONCE, to the RIGHT.

It rears back, then throws its upper mass forward and down to swallow whatever
is in front of it. Slow to start and fast to land -- all the time is in the
wind-up, which is the window the player is meant to learn.

FRAME 1 IS THE READY POSE from the end of the alert sheet.

FRAMES:
1. The ready pose: leaning forward and right, swollen, mouth open.
2. WIND UP: the mass draws BACK and UP over its base, rearing, the dome rising
   taller and narrower than it ever is, mouth stretching wider.
3. Reared to its tallest, arched back, mouth gaping at its widest, the
   suspended objects dragged to the bottom of the mass. The tallest drawing on
   the sheet, and the frame that telegraphs the attack.
4. Held reared, a fraction further back, surface taut -- the hang before it
   commits.
5. THE ENGULF: the whole upper mass slams forward and DOWN, the body stretched
   far to the right and flattened along the ground line, mouth driven forward
   and wide open at the front. Further right than in any other frame. This is
   the frame that lands the blow.
6. Impact spread: the mass splatting outward at its widest and lowest, mouth
   still open, a ring of thick lobes pushed out around the base.
7. Gathering: the mass drawing back in over its base, mouth beginning to close,
   objects tumbling back toward the middle.
8. Back to the ready pose, matching frame 1: leaning forward, swollen, mouth
   open again.

No splash drawn as separate droplets, no impact ring, no dust -- the lobes
pushing out of its own body in frame 6 are the whole effect.
```

---

# The Figma library

Every atlas the game ships today, plus an empty slot for every sheet in this
file, live in one Figma file:

**https://www.figma.com/design/TjtHRNpdzJJ8UUgUx1qHdj**

It is a reference board, not a source of truth — the source of truth is
`src/web/public/game/`, and the file holds the *built* atlases rather than the
source sheets in `assets/`, so what you see there is what the game loads.

Two bands. **SHIPPED** is thirty-nine plates with art on them, grouped the way
`assets/` is: characters, weapons, casts, spells, UI. **PLANNED** is fifty-two
dashed slots numbered to the sheets in this document and in
`docs/art-prompts.md` — sheet 1 first, then the grove, the ruins, the
crypt, and the five interface pieces.

Drop a generated sheet onto its numbered slot as you make it, and the board
doubles as the progress tracker. The dashed border is the whole status system:
solid means drawn, dashed means waiting.

Re-run `npm run assets` and re-upload if the art changes underneath — nothing
about the file is live.

---

# Wiring these in

Every sheet here is the shape `scripts/sheets.py` already handles best: eight
frames, 4 across and 2 down, chroma-keyed green. That is exactly what `_weapon`
builds, so a creature's four sheets are four one-line specs.

```python
def _mob(name: str, file: str) -> SheetSpec:
    """One animation of one creature. Four of these per mob.

    `anchor="feet"` pins the band's lowest body pixel, which is why the prompts
    insist on a ground line the artwork's lowest pixel sits on: that line is
    what the game plants on the floor, and a sheet drawn with air under its
    feet floats by exactly that much.

    `grid_cols=4` anchors each frame on its cell rather than on its own bounds.
    A walk cycle drawn in place needs it -- anchoring on content would pull
    every frame back to the same centre and cancel the step out of the walk.
    """
    return SheetSpec(
        name=name,
        source=ASSETS / "enemies" / file,
        body=_weapon_body,          # alpha > 0.55 and not near-black
        anchor="feet",
        key="green",
        bands=(
            Band("a", 0, 512, 0, 1536, 4, grid_cols=4),
            Band("b", 512, 1024, 0, 1536, 4, grid_cols=4),
        ),
    )
```

Two things the pipeline will not catch, both of which these prompts exist to
prevent:

**A creature drawn at a different size on one of its four sheets.** The atlas
reports a body ratio per sheet and the game sizes from it, so a mob whose walk
sheet is drawn 10% larger grows when it starts walking. Attaching the idle sheet
to the other three is the only defence, and it is why the order matters.

**A ground line that moves between sheets.** `anchor="feet"` is computed per
band, so each sheet decides its own floor independently. Four sheets that
disagree give you a mob that sinks when it attacks. Check it by flicking between
the four generated atlases at the same scale before wiring anything.

The alert mark is the exception to both: it is `anchor="center"`, it belongs to
no creature, and the game positions it above whichever head is reacting.

## What is still missing after all this

Nothing here is a death animation. Eleven of those is a twelfth of a sheet set
again, and the game currently has no death for an enemy at all -- the dummy just
replays its hit. Worth doing as one round once these are in and you can see
which mobs actually earn one.

The grove's three are the only ones that block anything. Ruins and crypt can
wait until the first stage plays.

---

# Part D — The Mirror

The final boss: the twin, corrupted. `main` already names it — `mirror`, "The
Mirror", 520 health against the player's 100, speed 190, `MIRROR` behaviour,
tagged `MELEE`, `RANGED` **and** `SPELL`, with a projectile it calls
`mirror_bolt`. So the server already says this thing fights with everything the
player has. The art is drawn to that.

Two to three times the goat's height, which makes it four to six times the
companion it grew out of.

## The part that needs no art at all

**It carries the player's weapons, and they are already drawn.**

Weapon, cast and effect sheets carry no character — they are composited over
whoever holds them, which is why one sword works for the goat. The boss holds
the same sheets. "Corrupted" is that same drawing rotated to violet, which the
pipeline now does on its own: `hue_target` on a `SheetSpec` measures the
sheet's own dominant hue and rotates it to the twin's.

That is **26 atlases** — every weapon, every cast motion, every effect, plus
both shield poses — generated from the source sheets the player's versions are
generated from. They are in the repo already. Nothing was drawn.

It reads better than redrawing would, which is the real argument. A corrupted
fireball that is *literally your fireball* in violet says the boss took yours.
One drawn separately says it happens to own a different fireball.

One rotation could not do it, and that is worth knowing before anyone tries:
the sword's effects sit at 348 degrees, the fire family at 25, the ice family
at 189. So each sheet measures itself and solves its own rotation to a single
constant — `CORRUPT_HUE`, 270 degrees, a clear violet. Not the companion's
present 224, which is a blue: that is the creature *before* it turns, and
rotating the arsenal to it came back cheerful rather than corrupted.

## The part that does

Ten sheets: six for the body, two for the hatching, two for its own abilities.

They continue the numbering in `docs/art-prompts.md`, which ends at 60, so the
whole project stays one sequence and the Figma board has no two sheets sharing
a number.

| # | sheet | attach |
| --- | --- | --- |
| 61 | Mirror — idle | the concept sheet |
| 62 | Mirror — drift | 61 |
| 63 | Mirror — strike | 61 |
| 64 | Mirror — cast | 61 |
| 65 | Mirror — hurt | 61 |
| 66 | Mirror — death | 61 |
| 67 | hatch — the crack | `assets/characters/bro.jpg` **and** 61 |
| 68 | hatch — the burst | 67 |
| 69 | mirror bolt | 61 |
| 70 | shard ring | 61 |

### Two overrides, before any of them

**Block 0-MOB's ground line does not apply.** It says every creature stands on
an invisible line with its feet on it. The Mirror floats, exactly as the
companion it grew from does, and its sheets are anchored on their middle
instead. Say so in every prompt or the frames come back with a foot edge that
is not there.

**Do not let it copy the concept sheet's layout.** The reference has a title
panel, labels, a size comparison and twelve rows in one image. Block 0-MOB
already forbids text, but an attached image is a strong instruction and it will
try. Every prompt below says to take the creature's *design* from the reference
and nothing else.

---

### 61. Mirror — idle — `assets/enemies/mirror-idle.png`

Attach the concept sheet. **This sheet defines the creature**; the other five
inherit from it.

```
Sheet 61: THE CORRUPTED TWIN, HOVERING. Its resting loop.

USE THE ATTACHED IMAGE FOR THE CREATURE'S DESIGN ONLY -- its shape, its
colours, its crystals, its silhouette. Do NOT copy its layout: no title panel,
no labels, no size comparison, no rows of thumbnails, no text anywhere. One
creature, eight frames, on the 4 x 2 grid described in the brief.

OVERRIDE: this creature FLOATS. It has no feet and touches no ground. Ignore
the ground-line rule entirely -- there is no ground line on this sheet, and the
creature is centred in its cell with clear space below it.

THE CREATURE, from the reference:
- A tall, ragged mantle of white and pale violet shards hanging like torn
  feathers, widest at the bottom, tapering to nothing -- no legs, no feet.
- A crown of long violet crystal spikes above a dark face, with one large
  faceted crystal at the very top, bigger than the rest.
- Two round dark eyes with violet pupils, set close together and low, with a
  pale angular brow above them. No mouth.
- A single violet diamond set into the chest.
- Six or seven crystal shards floating FREE around it, unattached, at
  different distances and angles.
- A thin elliptical ring of violet light orbiting the crown.
- Flat, boldly outlined, two or three tones per surface, as the brief says --
  the reference is rendered more softly than this game is, so follow the brief
  on shading and the reference on shape.

PROPORTION: about twice as tall as it is wide, including the mantle.

THE MOTION: it hovers. The body rises and falls slowly; the loose shards drift
on their own slower rhythm, never in step with the body; the ring turns. It
does not look around and it does not move from the spot.

FRAMES, one seamless loop:
1. Body at its middle height, mantle hanging, shards spread. THE RESTING POSE.
2. Rising, mantle trailing down, shards drifting outward.
3. At its highest, mantle at its longest, crown ring tilted.
4. Beginning to settle, shards drifting back inward.
5. At its middle height falling, mantle gathering.
6. At its lowest, mantle bunched, shards closest to the body.
7. Rising again, shards pushing outward.
8. Almost exactly frame 1, flowing cleanly back into it.

Keep the drift SMALL -- it is enormous and enormously still. The whole loop
should read as menace holding position, not as something bobbing.
```

### 62. Mirror — drift — `assets/enemies/mirror-drift.png`

Attach sheet 61.

```
Sheet 62: THE SAME CREATURE FROM THE ATTACHED SHEET, MOVING.

Same creature, same design, same colours, same size. It FLOATS: no ground
line, centred in its cell. A seamless 8-frame loop, travelling to the RIGHT.

It does not walk and it does not lean into the movement like a runner. It
GLIDES, and the mantle and the free shards lag behind it -- that lag is the
entire read, because the body itself barely changes shape.

It moves IN PLACE: it does not travel across its cell.

FRAMES:
1. Body upright, mantle streaming back to the LEFT, shards trailing behind it.
2. Mantle streaming further back, its tips whipping.
3. The body tilts a few degrees forward into the direction of travel; shards
   strung out in a longer tail.
4. Held at its furthest forward tilt, mantle at full stream.
5. The body straightens; the mantle begins to catch up.
6. Mantle gathering under it, shards closing the gap.
7. The body tilts a few degrees BACK as it steadies; shards overtaking it
   slightly.
8. Returning to upright, flowing cleanly back into frame 1.

The crown ring stays level through all eight frames whatever the body does --
a thing this powerful does not let its crown tilt. The mantle never lifts to
show anything underneath it.
```

### 63. Mirror — strike — `assets/enemies/mirror-strike.png`

Attach sheet 61.

```
Sheet 63: THE SAME CREATURE FROM THE ATTACHED SHEET, SWINGING A WEAPON IT IS
NOT HOLDING.

Same creature, same design, same colours, same size. Floats: no ground line.
Plays ONCE, to the RIGHT.

THE IMPORTANT PART: draw NO weapon. The game composites one over this sheet --
that is how the player's own goat swings, and it is why one sword works for
both of them. Draw the creature making the swing and leave its hand empty.

The motion is a wide overhand sweep from upper left to lower right. Its arms
are not arms: the mantle's upper shards gather and drive, so the whole left
side of the mantle rises, sharpens into a point, and lashes across.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET.

FRAMES:
1. The resting pose, unchanged.
2. WIND UP: the whole body leans back and left, the mantle's upper shards
   gathering and lifting high to the left, free shards pulled in close.
3. Fully wound: arched back, the gathered shards at their highest and furthest
   left, crown crystal blazing. The most extreme backward drawing here.
4. Held, a fraction further back -- the hang before it commits.
5. THE SWING: the gathered shards lash down and across to the right, the body
   driven forward with them, mantle flung out behind. Reaching further right
   than in any other frame. This is the frame that lands the blow.
6. Follow-through: past the strike, body still forward, shards scattered wide
   and streaming.
7. Recovery: the body draws back upright, shards being pulled home.
8. Back to the resting pose, matching frame 1.

No weapon, no trail, no slash arc, no impact -- the game draws every one of
those. An empty swing is correct.
```

### 64. Mirror — cast — `assets/enemies/mirror-cast.png`

Attach sheet 61.

```
Sheet 64: THE SAME CREATURE FROM THE ATTACHED SHEET, CASTING.

Same creature, same design, same colours, same size. Floats: no ground line.
Plays ONCE, to the RIGHT.

Where the strike is a lash, this is a summoning: it opens, everything on it
lights, and it throws. The effect it throws is drawn on its OWN sheet, so draw
the casting and draw nothing leaving it.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET.

FRAMES:
1. The resting pose, unchanged.
2. The free shards STOP drifting and snap to attention, all pointing the same
   way -- right. The chest diamond brightens.
3. The mantle spreads WIDE, opening like a fan, the body rising. Every crystal
   on it brightening together.
4. Fully open and at its tallest, mantle spread to its widest, crown crystal
   and chest diamond both blazing, free shards ringed around it and aimed
   right. The largest drawing on the sheet, and the frame the player reads to
   know a cast is coming.
5. Held at full spread, a fraction brighter.
6. THE RELEASE: everything snaps FORWARD at once -- mantle whipping right, all
   free shards flung toward the right edge, body punched forward. Light dumps
   out of the chest diamond. THE EFFECT LEAVES ON THIS FRAME, but do not draw
   it: leave the space in front of the creature empty.
7. Spent: the mantle collapses, shards scattered and dimming, the body sagging
   slightly. The dimmest drawing on the sheet.
8. Gathering back to the resting pose, matching frame 1.

No projectile, no beam, no muzzle flash, no spell in the air.
```

### 65. Mirror — hurt — `assets/enemies/mirror-hurt.png`

Attach sheet 61.

```
Sheet 65: THE SAME CREATURE FROM THE ATTACHED SHEET, TAKING A HIT.

Same creature, same design, same colours, same size. Floats: no ground line.
Plays ONCE. It is struck from the RIGHT and recoils to the LEFT.

It has 520 health against the player's 100, so a single hit does not stagger
it. This is a flinch that it immediately refuses -- the recoil is small and the
recovery is fast and contemptuous.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET.

FRAMES:
1. The resting pose, unchanged.
2. IMPACT: the whole body jolts left and compresses, mantle crumpling, free
   shards knocked outward. Two or three shards CRACK -- draw a hard white
   fracture line across them.
3. Held at the furthest left, body squashed, crown ring knocked out of level --
   the only frame in which it is.
4. The body swells back, crystals flaring hard and bright, shards snapping back
   toward their places. Anger, not recovery.
5. Overshooting slightly to the RIGHT, taller than at rest, mantle sharp.
6. Settling back toward centre, crown ring righting itself.
7. Almost at rest, cracks still visible on the same shards.
8. Back to the resting pose, matching frame 1. THE CRACKS REMAIN -- it does not
   heal within the animation.
```

### 66. Mirror — death — `assets/enemies/mirror-death.png`

Attach sheet 61.

```
Sheet 66: THE SAME CREATURE FROM THE ATTACHED SHEET, BREAKING APART.

Same creature, same design, same colours, same size. Floats: no ground line.
Plays ONCE and does NOT loop. The last frame is the pose the game holds on.

It is made of crystal, so it does not slump -- it shatters, and what is left
sinks. Slow at the start and fast at the end: the opposite of the flinch.

FRAME 1 IS THE RESTING POSE FROM THE ATTACHED SHEET.

FRAMES:
1. The resting pose, unchanged.
2. Everything goes still and the light inside it flares WHITE -- brighter than
   anywhere else in this creature's whole set.
3. Fracture lines spread across every crystal at once, white and hard-edged.
   The body has not moved.
4. The crown crystal SHATTERS: its pieces fly up and outward, the ring above
   it breaking into arcs. The body begins to sag.
5. The free shards blow outward in every direction and the mantle comes apart
   down its length, the upper body collapsing into loose pieces.
6. Most of it is gone -- scattered fragments spreading outward, the light
   draining out of them, only the lower mantle still holding a shape.
7. The last fragments falling and fading, very dim, the chest diamond the one
   thing still lit.
8. Nearly empty: a few faint fragments low in the cell and the chest diamond
   going out. This is the frame the game rests on, so it must read as finished
   rather than as mid-fall.
```

### 67. The hatching — the crack — `assets/enemies/hatch-crack.png`

Attach **`assets/characters/bro.jpg`** and sheet 61. Both matter: this sheet
has to start as one creature and end on the way to the other.

```
Sheet 67: A SMALL FLOATING COMPANION BEGINNING TO CRACK OPEN. Part one of two.

Two images are attached. The FIRST is the creature as it is now: small, pale,
round, friendly, with a small crown and a soft glow. The SECOND is what it
becomes: tall, sharp, violet, crowned in crystal. THIS SHEET IS THE BEGINNING
OF THE FIRST TURNING INTO THE SECOND. It ends before the change completes.

Both creatures FLOAT. No ground line, no feet, centred in the cell with clear
space below.

THROUGHOUT THIS SHEET THE CREATURE STAYS SMALL -- the size of the first
reference, not the second. Nothing grows here. What changes is what is
happening inside it.

FRAME 1 IS THE FIRST REFERENCE'S RESTING POSE, exactly as that creature idles.

FRAMES:
1. The small companion, at rest, unchanged and unharmed.
2. It flinches and goes rigid, eyes wide, glow guttering.
3. A single hairline crack opens down its front, from crown to base. Thin,
   dark, with a hard violet light deep inside it.
4. The crack forks. Two more open across its body. Violet light rakes out of
   all three across the frame.
5. The whole shell swells -- the body pushed outward from within, cracks
   widening into gaps, the light behind them now brighter than the creature.
6. More violet light than creature: the shell is a dark lattice of fragments
   held together over a blazing interior, its original shape only just
   readable.
7. The shell loses its shape -- fragments beginning to separate, pushed apart,
   the silhouette bulging where the crown is about to come through.
8. The shell at its furthest swollen, about to fail: violet light blowing out
   between every fragment, one sharp crystal tip just breaking the surface at
   the top. HOLD THE SIZE -- this is still the small creature.

Nothing has emerged yet. The second sheet does that.
```

### 68. The hatching — the burst — `assets/enemies/hatch-burst.png`

Attach sheet 67 and sheet 61.

```
Sheet 68: THE SHELL BURSTING AND THE EVOLVED FORM RISING. Part two of two.

Two sheets are attached: the one that ends with a small shell about to fail,
and the one that shows what comes out. This sheet joins them.

Floats throughout: no ground line, centred in the cell.

THE SCALE CHANGE IS THE POINT. Frame 1 is the SMALL creature, the size it is on
the attached first sheet. Frame 8 is the evolved form at FULL size -- two to
three times a goat, which is four to six times what it started as. It must
grow visibly across these eight frames, and most of the growth belongs in
frames 4 to 6 so it reads as an eruption rather than an inflation.

Draw the creature LARGE ENOUGH IN ITS CELL that frame 8 has at least 24 pixels
of clear space around it, and let the early frames be small within the same
cell -- do not rescale the cell to fit each frame.

FRAME 1 MATCHES THE LAST FRAME OF THE ATTACHED FIRST SHEET.

FRAMES:
1. The swollen shell, blowing violet light out of every crack. Small.
2. THE BURST: the shell blows apart into fragments flung to every edge of the
   cell, a hard white flash at the centre where it was.
3. Through the flash, a dark silhouette: the crown's crystal spikes rising
   first, already larger than the shell that held them.
4. The shape climbing fast, the mantle unfurling downward beneath the crown
   like something falling open. Roughly half final size.
5. Still growing, mantle spreading to its width, the free crystal shards
   forming up around it out of the shell's own fragments -- the pieces of the
   old creature becoming the new one's orbit.
6. Nearly full size, the crown ring sweeping into place around it, eyes opening.
7. At full size, everything flared wide at its most extreme -- mantle at its
   widest, all shards thrown outward, every crystal at its brightest.
8. Settling into the evolved form's RESTING POSE, exactly as sheet 61's frame 1
   -- mantle hanging, shards spread, ring turning. The game holds here and
   crossfades into the idle loop, so any difference from that frame shows as a
   jump.
```

### 69. Mirror bolt — `assets/spells/mirror-bolt.png`

Attach sheet 61. `main` names this projectile in the boss's own definition:
`ProjectileSpec(kind="mirror_bolt", speed=430, radius=7, lifetime=1.3)`.

```
Sheet 69: A SHARD OF MIRROR IN FLIGHT.

OVERRIDE: this sheet has no creature in it. It is a single small object.

THE OBJECT: one long, narrow, double-pointed crystal shard, sharp at both ends
and widest at its middle -- the same crystal the creature in the attached sheet
is crowned and ringed with, so it reads as a piece of it. Flat violet with one
paler facet down its upper edge, one darker facet below, and a thick dark
outline.

It flies POINT FIRST toward the RIGHT and it is drawn horizontally, long across
the cell. It does not tumble.

Behind it, a short trail of three or four smaller shards of the same violet,
falling behind and shrinking -- objects with their own outlines, not a glow and
not a smear.

FRAMING: centred in its cell, occupying the middle third of the cell's height.
It stays at the SAME position and the SAME size in all eight frames. The game
moves it across the screen; a sheet that also moves it makes the two motions
fight.

FRAMES, one seamless loop:
1. Shard level, three trailing shards close behind it.
2. Trailing shards drifting back and shrinking, a new one appearing at the base.
3. A faint pale gleam travels along the shard's upper facet, front to back.
4. The gleam reaching the back, trailing shards at their widest spread.
5. Shard level, a fresh tight cluster behind it.
6. Trailing shards beginning to drift.
7. The gleam starting again at the front.
8. Returning to match frame 1, flowing cleanly back into it.
```

### 70. Shard ring — `assets/spells/shard-ring.png`

Attach sheet 61.

```
Sheet 70: A RING OF CRYSTAL SHARDS ERUPTING OUTWARD.

OVERRIDE: this sheet has no creature in it. It is an effect.

THE EFFECT: a ring of the same violet crystal shards, thrown up out of nothing
and driven outward in every direction from a point at the centre.

It is seen FLAT ON, as a ring that expands across the ground around the
creature -- so it is drawn as a wide, shallow ELLIPSE, about twice as wide as
it is tall, not as a circle. Every shard points outward along its own radius.

It expands from nothing to the full width of its cell across the eight frames,
and it plays ONCE. Frame 8 must read as spent, not as still growing.

FRAMES:
1. A small hard white flash at the centre, no shards yet.
2. Eight or ten shard tips breaking outward from the flash, very close in.
3. The ring a third of its final width, shards clearly separate and pointing
   outward, brightest here.
4. Two thirds of its width, the shards longer and leaning further outward, gaps
   opening between them as the ring stretches.
5. Near full width, shards at their longest and beginning to tilt over.
6. Full width, shards falling outward past the ring, the centre now empty.
7. Shards breaking up into smaller fragments, fading, the ring losing its shape.
8. Nearly gone: a faint scatter of fragments at the ring's furthest extent. The
   game ends the clip here, so it must read as finished.
```

### Wiring all of it in

The six body sheets are one spec each, the same shape a mob's takes but
floating:

```python
def _mirror(name: str, file: str) -> SheetSpec:
    """One animation of the boss. Like `_mob`, but it does not stand on
    anything -- `anchor="center"`, exactly as the companion it grew from."""
    return replace(_mob(name, file), anchor="center")

MIRROR = tuple(
    _mirror(f"mirror{clip.capitalize()}", f"mirror-{clip}.png")
    for clip in ("idle", "drift", "strike", "cast", "hurt", "death")
)
HATCH = (_mirror("hatchCrack", "hatch-crack.png"),
         _mirror("hatchBurst", "hatch-burst.png"))
```

The two effects go through `_spell` like every other projectile, and the
corrupted arsenal is already built — the boss reaches for `swordADark`,
`fireBallDark`, `iceNovaDark` and the rest by name.

**The hatch sheets need `normalize_to` left unset.** Every other multi-band
sheet uses it to stop a character changing size between animations; these two
are the one case where the size change is the animation, and normalising them
would flatten the entire cutscene back to one size.
