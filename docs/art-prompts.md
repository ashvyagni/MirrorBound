# Art prompts

Every generated sheet in the game, in the order to make them.

## Why we are redoing all of it

The characters and the weapons are currently drawn in two different styles. The
goat and the companion are flat, boldly outlined and simple — a few clean shapes
with almost no internal shading. The staffs are ornate painted RPG items:
carved scrollwork, faceted gems, gradient metal, fine highlights. Put them in
one frame and the staff looks borrowed from another game.

The characters are the ones that are right. Everything else comes down to meet
them: **bold, flat, slightly loose, and less rendered than it wants to be.**
Block 0 below is where that lives, and it is the only part of this document that
really matters. The rest is motion.

---

## How to use this

**Paste Block 0 once at the start of a chat.** It sets the house style, the
camera, the sheet format and the background for everything that follows. Every
numbered prompt after it is short because it assumes Block 0 is in the
conversation. Start a fresh chat and you must paste Block 0 again first.

**Attach the weapon's idle sheet to every other prompt for that weapon.** The
idle sheet is what defines that weapon's design, and an attached image holds a
shape far better than any description. This is why the order below is not
arbitrary: each weapon's idle comes first and everything else references it.

**Work one weapon at a time, all the way through.** The sword's four sheets have
to agree with each other more than the sword has to agree with the bow.

### Order

| # | sheet | attach |
| --- | --- | --- |
| 1 | sword idle | — |
| 2 | sword swing A | sheet 1 |
| 3 | sword swing B | sheet 1 |
| 4 | sword swing C | sheet 1 |
| 5 | shield block | sheet 1 |
| 6 | shield parry | sheets 1 and 5 |
| 7 | bow idle | — |
| 8 | bow bash | sheet 7 |
| 9 | bow draw | sheet 7 |
| 10 | arrow | sheet 7 |
| 11 | fire staff idle | — |
| 12 | fire staff smash | sheet 11 |
| 13 | fire cast — fireball | sheet 11 |
| 14 | fire cast — pillar | sheet 11 |
| 15 | fire cast — wave | sheet 11 |
| 16 | fireball effect | sheet 11 |
| 17 | flame pillar effect | sheet 11 |
| 18 | flame wave effect | sheet 11 |
| 19 | ice staff idle | — |
| 20 | ice staff sweep | sheet 19 |
| 21 | ice cast — shards | sheet 19 |
| 22 | ice cast — nova | sheet 19 |
| 23 | ice cast — beam | sheet 19 |
| 24 | shard volley effect | sheet 19 |
| 25 | frost nova effect | sheet 19 |
| 26 | freezing beam effect | sheet 19 |
| 27 | straw dummy | — |

Effect sheets take the idle attached too, so the magic picks up the staff
crystal's colours rather than inventing its own.

---

## Block 0 — the house style

Paste this first, on its own, once per chat.

```
STYLE BRIEF. Read this once and apply it to every sheet I ask for in this chat.
I will describe each sheet's content separately. All the rules below hold for
every one of them unless I explicitly override one.

I am making art for a 2D side-scrolling game.

THE LOOK — this is the part that matters most.
Flat, bold, storybook game art. A clean children's-book illustration turned into
a game sprite, NOT a painted fantasy render.

- A thick, dark, slightly soft outline around every object and every major
  internal shape. One consistent line weight throughout, around 5 pixels at this
  resolution.
- Two or three flat tones per material: a base colour, one shadow, one
  highlight. No gradients, no airbrushing, no soft painterly blending, no
  ambient occlusion.
- Bold, simple silhouettes. Ornament reduced to two or three clear shapes.
  No filigree, no carved scrollwork, no engraved runes, no woodgrain, no
  hammered metal texture, no micro-detail of any kind.
- Gems and crystals are simple faceted shapes: a flat base colour, one shadow
  face, one bright highlight, and that is all. Not many-faceted, not refractive,
  not glassy, not photoreal.
- Confident linework with a slightly loose, hand-drawn quality. Appealing and
  well made, but relaxed rather than mechanically precise. A little wobble in a
  long straight edge is welcome.
- Saturated, cheerful colour. Bone whites and creams, warm mid browns, with hot
  saturated accent colours for anything magical.

Deliberately LESS rendered than typical fantasy weapon art. If it looks like a
detailed RPG inventory icon, it is wrong. Simplify until it would still read
clearly at a third of its size.

THE CAMERA
Strict side-on elevation, as in a 2D side-scrolling platformer where the
character moves only left and right. Orthographic. No perspective, no vanishing
point, no foreshortening, no three-quarter view, no top-down angle, no camera
tilt. Nothing may look like it is lying on a floor plane seen from above, and a
circle is never drawn as an ellipse.

THE SHEET FORMAT
Every sheet is a single 1536 x 1024 pixel image holding one 8-frame animation in
a strict 4 x 2 grid: 4 columns, 2 rows, each cell exactly 384 x 512 pixels. The
animation reads left to right across the top row, then left to right across the
bottom row.

BACKGROUND
Flat pure bright green (#00FF00), edge to edge, perfectly uniform. Nothing else
on it at all: no grid lines, no cell borders, no frame numbers, no labels, no
captions, no watermark, no shadows cast onto the background.

FRAMING
Each frame's artwork is centred in its own cell with at least 24 pixels of clear
green on every side. Artwork never crosses from one cell into the next, and no
cell is ever left empty.

NEVER INCLUDE
No character, no creature, no hand, no arm, no fingers, no ground, no floor, no
terrain, no horizon, no background scenery, no text. Objects float alone on the
green.

WEAPON SHEETS SPECIFICALLY
When the sheet is a weapon in motion:
- The weapon rotates around its grip — the wrapped band where a hand would
  hold it. That grip stays at the same point in every cell, near the centre of
  the cell, while the rest of the weapon swings around it.
- The grip must be clearly visible and unobscured in all eight frames. Never
  hide it behind an effect or glow, and never crop it out of the cell.
- The weapon is exactly the same size in every frame and across every sheet of
  that weapon.

Reply "ready" and wait for my first sheet.
```

---

## Part 1 — Sword

### 1. Sword idle — `assets/weapons/sword-idle.png`

Nothing attached. This sheet defines the sword; everything after it inherits.

```
Sheet 1: SWORD IDLE.

THE WEAPON: a straight, broad, single-edged sword, held point-up, vertical and
centred. A bone-white blade with one flat shadow tone down its back edge. A
short dark leather-wrapped grip at the middle. A simple crossguard of two blunt
horns. A single flat magenta-pink gem set in the pommel, drawn as one faceted
shape with one highlight. That is the whole design — no runes, no engraving, no
fuller line, no ricasso detail.

THE MOTION: the sword hangs still and vertical, in exactly the same position and
at exactly the same size in all eight frames. Only a soft magenta-pink
enchantment glow around the blade moves, drifting slowly up the edge and fading.

FRAMES:
1. Blade clean, the faintest pink haze along the edge.
2. The haze gathers near the crossguard.
3. It drifts up the blade, brightening.
4. Brightest, a soft pink glow wrapping the upper third.
5. The glow thins and rises past the point.
6. A few pink motes lift off the point and fade.
7. Almost clean again, the pommel gem catching a glint.
8. Back to frame 1, so the loop is seamless.

This clip loops forever while the sword is carried, so frame 8 must flow into
frame 1 with no jump. The sword itself must not move, drift or change size
between frames.
```

### 2. Sword swing A, the sweep — `assets/weapons/sword-a.png`

Attach sheet 1.

```
Sheet 2: SWORD SWING A — a wide horizontal sweep.

Use the sword in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the first hit of a three-hit combo. The sword starts raised and
drawn back over the shoulder, then sweeps forward and down through a wide
horizontal arc, ending low and forward to the right. It rotates around its
leather grip, which stays near the centre of the cell throughout.

THE TRAIL: a broad magenta-pink crescent following the blade through the arc.
Flat colour with a bold outline, like a painted brushstroke — not a soft glow
and not a motion blur. Each of the three sword swings is told apart by the
SHAPE of its trail, so this one is a clean wide crescent.

FRAMES:
1. Raised and drawn back, tilted behind vertical. No trail yet.
2. Wound back further, a spark at the point. Anticipation.
3. The swing starts. A short crescent begins behind the blade.
4. Passing through vertical, fast. The crescent is half drawn.
5. Mid-sweep, blade horizontal, the crescent at its widest and brightest.
6. Past horizontal, ending low and forward right. The crescent trails behind.
7. Held low. The crescent breaks up and falls away in flat shards.
8. Recovering upward, nearly back to the idle pose, trail gone.
```

### 3. Sword swing B, the chop — `assets/weapons/sword-b.png`

Attach sheet 1.

```
Sheet 3: SWORD SWING B — an overhead chop.

Use the sword in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the second hit of a three-hit combo. The sword is raised straight
overhead and driven straight down, ending point-down and forward, striking an
imaginary floor that is never drawn. It rotates around its leather grip, which
stays near the centre of the cell throughout.

THE TRAIL: a narrow vertical magenta-pink wedge following the blade down — a
straight hard shape, quite unlike the wide crescent of swing A. On impact it
becomes a flat burst of pink shards spraying sideways at the bottom of the arc,
low and level, never a ring or an oval.

FRAMES:
1. Raised straight overhead, blade vertical. No trail.
2. Raised higher, arched back slightly. A spark at the point.
3. Driving down. A short straight wedge forms behind the blade.
4. Halfway down, fast, the wedge at full length.
5. IMPACT. Point down and forward. A hard white flash and a flat sideways spray
   of pink shards at the point.
6. Held down. The shards travel outward, low and level, and thin.
7. Lifting back, the wedge gone, a few motes falling.
8. Recovering upward, nearly back to the idle pose.
```

### 4. Sword swing C, the spin — `assets/weapons/sword-c.png`

Attach sheet 1.

```
Sheet 4: SWORD SWING C — a spinning finisher.

Use the sword in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the third and final hit of a three-hit combo, the biggest of the
three. The sword spins a full turn around its grip, the point sweeping a
complete circle, ending forward and level. It rotates around its leather grip,
which stays near the centre of the cell throughout.

THE TRAIL: a CLOSED RING of magenta-pink following the point all the way round —
this is the shape that tells the finisher apart from the other two swings. Flat
colour, bold outline, drawn as a true circle facing the viewer, never as an
ellipse and never as a disc lying on a floor.

FRAMES:
1. Level and drawn back, the point trailing behind. No ring.
2. The spin begins, point rising. A quarter arc of pink behind it.
3. Point at the top, half the ring drawn.
4. Point descending on the far side, three quarters drawn.
5. The ring closes. Brightest frame, a complete pink circle, blade level.
6. The ring holds and thickens, the blade starting to slow.
7. The ring breaks into flat shards that scatter outward.
8. Recovering, blade forward and level, nearly back to the idle pose.
```

### 5. Shield block — `assets/weapons/shield-block.png`

Attach sheet 1, so the shield is clearly the sword's companion piece.

```
Sheet 5: SHIELD BLOCK.

A NEW object, a shield, designed to belong with the sword in the attached sheet
— same palette, same line weight, same flat treatment, same bone-white and
magenta-pink.

THE SHIELD: a simple rounded kite shield. A bone-white face with one flat shadow
tone down one side, a dark leather rim, and a single flat magenta-pink gem at its
centre drawn as one faceted shape with one highlight. No heraldry, no rivets, no
scrollwork, no boss detail.

THE MOTION: the shield is brought up into a guard and then held. It is seen
edge-on-ish from the side, angled to face right — the direction the threat comes
from. It rises from low to guard height and stops. Frames 5 to 8 are a HOLD: the
shield barely moves, only its glow breathes.

This sheet has to work as a loop, because the guard is held for as long as the
player holds the button. Frame 8 must flow back into frame 5, not into frame 1.

FRAMES:
1. Low, tilted down and away, mostly out of the way.
2. Lifting, rotating to face right.
3. Higher, nearly upright, a pink glimmer waking in the gem.
4. Snapping into guard position, facing right. A brief flare at the rim.
5. GUARD, held. Gem lit, a thin pink edge-light along the rim.
6. Guard held. The edge-light breathes brighter.
7. Guard held. The edge-light settles back.
8. Guard held, matching frame 5, so frames 5-8 loop seamlessly.
```

### 6. Shield parry — `assets/weapons/shield-parry.png`

Attach sheets 1 and 5.

```
Sheet 6: SHIELD PARRY.

Use the shield in the attached block sheet: the same design, the same colours,
the same size. Do not redesign it and do not resize it.

THE MOTION: a sharp deflection. From the guard pose, the shield punches forward
and rotates hard, throwing the blow aside, then snaps back to guard. Much faster
and more violent than the block — this is a timed counter, and it must read as
a decisive hit, not a lean.

THE EFFECT: a hard white flash at the moment of contact and a flat magenta-pink
shockwave that peels off the shield face forward to the right. The shockwave is
a flat crescent seen edge-on, never a ring and never an oval on a floor.

FRAMES:
1. Guard position, matching the block sheet's held pose.
2. Pulled back a little, coiling. The gem brightens sharply.
3. Punching forward, the shield face rotating to meet the blow.
4. CONTACT. A hard white flash across the shield face, at its brightest.
5. The pink shockwave peels forward off the face, a flat crescent.
6. The shockwave travels right and thins. The shield rocks back from the recoil.
7. Rocking back further, flat pink shards scattering and fading.
8. Returned to the guard pose, matching frame 1 and the block sheet's hold.
```

## Part 2 — Bow

### 7. Bow idle — `assets/weapons/bow-idle.png`

Nothing attached. Defines the bow.

```
Sheet 7: BOW IDLE.

THE WEAPON: a simple recurve bow, held vertical and centred, limbs curving away
to the left, string on the left, facing right. Bone-white limbs with one flat
shadow tone along the inner curve, a short dark leather-wrapped grip at the
centre, and a thin magenta-pink string. No carving, no inlay, no wrapping detail
beyond the one grip band.

THE MOTION: the bow hangs still and vertical, in exactly the same position and
at exactly the same size in all eight frames. Only the string's enchantment
moves — a faint pink shimmer travelling along it.

FRAMES:
1. String quiet, the faintest pink line.
2. A shimmer wakes at the lower limb.
3. It travels up the string, brightening.
4. Brightest, the whole string glowing pink.
5. The shimmer thins toward the upper limb.
6. A few pink motes lift off the upper tip and fade.
7. Almost quiet again, one glint at the grip.
8. Back to frame 1, so the loop is seamless.

This clip loops forever while the bow is carried, so frame 8 must flow into
frame 1 with no jump. The bow itself must not move, drift or change size.
```

### 8. Bow bash — `assets/weapons/bow.png`

Attach sheet 7.

```
Sheet 8: BOW BASH — the bow's melee attack.

Use the bow in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: a close-range shove with the bow's upper limb. The bow is drawn back
and across, then thrust forward and down to the right, striking with the limb
rather than the string. It rotates around its leather grip, which stays near the
centre of the cell throughout. Short and blunt — this is what you do when
something gets too close, not a graceful shot.

THE TRAIL: a short, stubby magenta-pink smear following the upper limb. Flat
colour with a bold outline. Deliberately smaller and messier than the sword's
trails — the bow is a poor club and should look like one.

FRAMES:
1. Upright, matching the idle sheet.
2. Drawn back and tilted, coiling. No trail yet.
3. The thrust starts, a short smear behind the upper limb.
4. Driving forward, the smear at full length.
5. IMPACT. Bow angled forward right, upper limb leading. A hard white flash and
   a flat sideways spray of pink shards at the limb tip.
6. Held forward, the shards travelling outward and thinning.
7. Rocking back from the recoil, the string wobbling.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 9. Bow draw — `assets/casts/arrow.png`

Attach sheet 7. This is the bow's own animation while the arrow ability fires.

```
Sheet 9: BOW DRAW AND LOOSE.

Use the bow in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

IMPORTANT: do NOT draw a nocked arrow. The arrow is a separate sheet drawn over
this one, and drawing it here would give two arrows.

THE MOTION: the string is drawn back to full tension and loosed. The limbs bend
inward as the string comes back and snap out straight on release, then oscillate
and settle. The bow stays vertical throughout — this is limb flex and string
travel, not a swing. Its dark centre grip stays at the same point in every cell.

THE EFFECT: only the enchantment on the string, never the arrow. Magenta-pink
energy gathers along the drawn string and flares at release, throwing a few flat
pink sparks forward to the right.

FRAMES:
1. At rest, matching the idle sheet. String straight, limbs relaxed.
2. String pulled back a third of the way. Limbs beginning to bend inward.
3. String at two thirds. Pink energy gathering along it.
4. FULL DRAW. String at a deep V, limbs bent hard inward, string blazing pink.
5. LOOSE. String snapping forward past straight, limbs flung outward. A bright
   pink flare at the grip and flat sparks thrown forward to the right.
6. String overshooting forward. Limbs still recoiling.
7. String oscillating back, amplitude halved. The pink fading.
8. Settled, matching frame 1 and the idle sheet.
```

### 10. Arrow — `assets/spells/arrow.png`

Attach sheet 7, so the arrow's enchantment matches the bowstring's.

```
Sheet 10: ARROW IN FLIGHT.

THE EFFECT: a single arrow flying to the right, seen in perfect profile. A
bone-white shaft, a simple flat triangular head, plain cream fletching, wrapped
in a magenta-pink energy trail streaming back from the head. Match the pink of
the bowstring in the attached sheet.

The arrow is COMPACT: it occupies roughly the middle two thirds of its cell,
with clear green at both ends. Do not stretch it to fill the cell edge to edge.

Camera: the arrow flies perfectly horizontally, in profile, never angled toward
or away from the viewer.

FRAMES:
1. The arrow clean and tight. Trail thin, close to the shaft.
2. The trail widens into a flat ribbon.
3. The trail peaks, ragged, flat shards shedding backward.
4. Brightest. The head flares, the trail at its fullest.
5. The trail begins breaking into separate wisps.
6. The wisps trail well behind the fletching.
7. The trail draws back in toward the shaft.
8. Nearly clean again, leading cleanly into frame 1.

This clip loops in flight, so frame 8 must flow back into frame 1 with no jump.
The arrow itself is in exactly the same position and at exactly the same angle
in all eight cells — only the trail changes. Any drift shows up in game as the
arrow wobbling.
```

## Part 3 — Fire staff

### 11. Fire staff idle — `assets/weapons/fire-staff-idle.png`

Nothing attached. Defines the fire staff. **This is the sheet that fixes the
style mismatch** — the current one is the most over-rendered art in the game.

```
Sheet 11: FIRE STAFF IDLE.

THE WEAPON: a simple wooden staff held vertical and centred. A slim bone-white
shaft with one flat shadow tone down one side. A short dark leather-wrapped grip
at the middle. At the top, two blunt curved prongs cradling a single flat
orange-red gem drawn as ONE faceted shape with one highlight and one shadow
face. A small matching gem at the butt.

Keep it plain. No carved spirals, no woodgrain, no runes, no filigree, no
gold leaf, no many-faceted crystal, no glow gradients on the wood. Three or four
shapes total. If it looks like an RPG inventory icon it is wrong.

THE MOTION: the staff hangs still and vertical, in exactly the same position and
at exactly the same size in all eight frames. Only the flame above the gem
moves: a small, flat, bold-outlined tongue of fire that flickers and curls.

FRAMES:
1. A small flame sitting on the gem.
2. The flame leans left and grows.
3. Taller, curling, one ember lifting off.
4. Tallest and brightest, two embers rising.
5. The flame leans right, shortening.
6. Low and wide, embers fading above.
7. A small quiet flame, gem glinting.
8. Back to frame 1, so the loop is seamless.

This clip loops forever while the staff is carried, so frame 8 must flow into
frame 1 with no jump. The staff itself must not move, drift or change size.
```

### 12. Fire staff smash — `assets/weapons/fire-staff.png`

Attach sheet 11.

```
Sheet 12: FIRE STAFF SMASH — the staff's melee attack.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: an overhead smash. The staff is raised high and driven down and
forward, ending gem-down and forward to the right, striking an imaginary floor
that is never drawn. It rotates around its leather grip, which stays near the
centre of the cell throughout.

THE TRAIL: a broad orange-red arc following the gem through the swing, flat
colour with a bold outline, like a painted brushstroke. On impact, a flat
sideways burst of fire and embers at the gem — low and level, spreading left and
right, never a ring and never an oval on a floor.

FRAMES:
1. Upright, matching the idle sheet.
2. Raised and tilted back, the gem brightening.
3. Raised higher, flame streaming off the gem. Peak anticipation.
4. Driving down through vertical, a broad arc behind the gem.
5. IMPACT. Gem low and forward right. A hard white flash and a flat sideways
   burst of fire and embers.
6. Held low, the burst spreading outward level and thinning.
7. Lifting back, embers falling, the arc gone.
8. Recovering upright, nearly back to the idle pose.
```

### 13. Fire cast, fireball — `assets/casts/fire-ball.png`

Attach sheet 11.

```
Sheet 13: FIRE STAFF CASTING A FIREBALL.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the staff rocks back, then swings forward and down to end angled
about 30 degrees below horizontal with the gem pointing forward to the right at
roughly chest height — punching the spell out ahead. Then it settles upright. It
rotates around its leather grip, which stays near the centre of the cell.

THE EFFECT AT THE TIP: ONLY a gathering charge, never a finished fireball. The
actual fireball is a separate sheet drawn over this one, and drawing one here
would give two. What belongs here is the gathering: embers converging on the
gem, the gem going white-hot, and a small bloom breaking away forward at the
moment of release. Keep it tight around the gem.

FRAMES:
1. Upright, matching the idle sheet.
2. Rocked back about 15 degrees past vertical. First embers appear.
3. Still back. Embers stream inward, the gem glowing hot.
4. Gem white-hot and haloed. The swing has begun.
5. Swinging through vertical, fast, a short arc trail behind the gem.
6. RELEASE. Angled 30 degrees below horizontal, gem forward right at chest
   height. A small bloom of flame breaks away forward.
7. Held at the low forward angle. The gem cools, loose embers drift back.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 14. Fire cast, pillar — `assets/casts/fire-pillar.png`

Attach sheet 11.

```
Sheet 14: FIRE STAFF SLAMMING THE GROUND.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the staff is raised high, then driven down and forward so the gem
ends low and to the right, pointing down at an imaginary floor ahead — the pose
that sends fire out along the ground to erupt some distance in front. Then it
lifts back upright. It rotates around its leather grip, which stays near the
centre of the cell.

THE EFFECT AT THE TIP: ONLY a gathering charge, never a finished pillar of fire.
The pillar is a separate sheet drawn over this one. What belongs here is the
charge on the raise, and on impact a LOW FLAT spray of sparks and a shockwave
ripple running forward to the right along the implied floor line. Keep it low
and flat: no ring, no oval, no glowing disc on the ground.

FRAMES:
1. Upright, matching the idle sheet.
2. Raised, tilted back about 25 degrees. The gem begins to glow.
3. Raised higher, gem white-hot and haloed. Peak anticipation.
4. Driving down hard through vertical. Arc trail behind the gem.
5. IMPACT. Gem low and forward right, pointing down. A hard white flash and a
   low flat spray of sparks running forward.
6. Held low. A flat shockwave ripple travels forward right along the floor line.
7. Lifting back, gem cooling, embers settling.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 15. Fire cast, wave — `assets/casts/fire-wave.png`

Attach sheet 11.

```
Sheet 15: FIRE STAFF SWEEPING LOW.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the staff is drawn back and across, then swept forward low and flat,
the gem travelling in a shallow arc close to an implied floor line and ending
low to the right, almost horizontal — the gesture that rolls a wave of fire away
along the ground. It rotates around its leather grip, which stays near the
centre of the cell.

THE EFFECT AT THE TIP: ONLY a gathering charge, never a finished wave of fire.
The wave is a separate sheet drawn over this one. What belongs here is a low
smear of flame trailing the gem through the sweep, and a flat ribbon of sparks
peeling forward off it at the end of the arc. Keep it close to the gem and close
to the floor line.

FRAMES:
1. Upright, matching the idle sheet.
2. Drawn back and tilted about 30 degrees behind vertical. Gem warming.
3. Back and low, gem bright, a low pool of flame gathering below it.
4. Sweeping forward, gem passing near the floor line, flame smearing behind.
5. Mid-sweep, nearly horizontal, at its fastest. Long low flame trail.
6. RELEASE. Gem forward right and low, staff almost horizontal. A flat ribbon of
   sparks peels forward off the gem along the floor line.
7. Held low and forward. The trail breaks into flat licks and falls behind.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 16. Fireball effect — `assets/spells/fire-ball.png`

Attach sheet 11, so the fire matches the staff gem.

```
Sheet 16: FIREBALL IN FLIGHT.

THE EFFECT: a ball of fire hurtling to the right, seen from the side. A dense
white-hot core, a flat orange-red body with a bold dark outline, and a ragged
flame tail streaming back to the left. A few flat embers. Match the fire colours
of the staff in the attached sheet.

FRAMES:
1. A tight compressed spark. Small, tail barely started.
2. The core blooms to full size. Tail short and stubby.
3. Fully formed. Tail streaming back to twice the core's width.
4. The core elongates forward into a teardrop. Tail at its longest.
5. The tail breaks into separate flat licks of flame.
6. The core flattens slightly. Embers shed off the top and bottom.
7. The tail reforms tight against the core.
8. Back to a compressed teardrop, leading cleanly into frame 1.

This clip loops while the fireball is in flight, so frame 8 must flow back into
frame 1 with no jump. The core stays the same size and sits at the same point in
every cell; only the tail and the embers move.
```

### 17. Flame pillar effect — `assets/spells/fire-pillar.png`

Attach sheet 11. **The current version of this sheet has the bug worth naming.**

```
Sheet 17: A PILLAR OF FIRE ERUPTING FROM THE GROUND.

THE EFFECT: a column of fire erupting straight upward, seen from the side. Tall
and narrow, filling the height of its cell. A white-hot base flaring into flat
orange and deep red at the tip, with flame tongues peeling off the sides and
embers rising. Match the fire colours of the staff in the attached sheet.

THE MOST IMPORTANT INSTRUCTION: there is NO ground disc, NO elliptical scorch
mark, NO glowing ring or oval lying on the floor, NO crater, and NO circle of
embers seen at an angle. A circular mark on the ground can only look circular
from above, and this camera is never above anything. Draw the base as a FLAT
HORIZONTAL line of fire and sparks, exactly as wide as the flames, seen edge-on.
Nothing in the image may suggest there is any ground depth at all.

THE BASE: the fire rests on an imaginary floor at the very bottom of the
artwork, with NO empty space beneath it. The game places the lowest row of fire
directly on the ground line, so any gap you leave becomes a gap in game.

FRAMES:
1. A low flat burst of sparks. Wide, only knee-high.
2. The column punches upward to half height, base flaring.
3. Full height, narrow, the tip whipping.
4. Tallest and brightest. The tip splits into three tongues.
5. The column thins. Embers detach and rise past the tip.
6. The body breaks into separate rising tongues, base dimming.
7. Only the base glow and drifting embers remain.
8. A low smouldering flicker, almost gone.

The base of the fire sits at the same height in every cell. The column grows and
dies upward from one fixed floor line; it must not slide up the frame.
```

### 18. Flame wave effect — `assets/spells/fire-wave.png`

Attach sheet 11.

```
Sheet 18: A WAVE OF FIRE ROLLING ALONG THE GROUND.

THE EFFECT: a wave of fire rolling to the right, seen from the side. A curling
breaker of flame, taller at its leading edge, with a flattened trailing body.
White-hot at the base, flat orange through the body, deep red at the curling
crest. Match the fire colours of the staff in the attached sheet.

Seen edge-on, as a flat silhouette travelling across the screen. It must not
look like a sheet of fire spreading away from the viewer.

THE BASE: the wave rests on an imaginary floor at the very bottom of the
artwork, with NO empty space beneath it. The game places the lowest row of fire
directly on the ground line.

FRAMES:
1. A low flat sheet of fire. No crest yet.
2. The leading edge rears up into a hook.
3. The crest curls fully over. Body at full length.
4. The crest breaks, throwing flame forward off the tip.
5. The broken crest trails backward while the body still advances.
6. The body flattens. A second smaller crest forms behind it.
7. The wave spreads wide and low, losing height.
8. A flat guttering sheet with embers drifting up.

The wave keeps its base on one consistent floor line across all eight cells.
```

## Part 4 — Ice staff

### 19. Ice staff idle — `assets/weapons/ice-staff-idle.png`

Nothing attached. Defines the ice staff, and like the fire staff it needs to
come a long way down in detail from the current one.

```
Sheet 19: ICE STAFF IDLE.

THE WEAPON: a simple wooden staff held vertical and centred. A slim bone-white
shaft with one flat shadow tone down one side. A short dark leather-wrapped grip
at the middle. At the top, two blunt curved prongs cradling a single flat
ice-blue gem drawn as ONE faceted shape with one highlight and one shadow face.
A small matching gem at the butt.

It is the fire staff's twin in silhouette — only the gem colour and the effect
differ. Keep it plain: no carved spirals, no woodgrain, no frost crust on the
wood, no runes, no many-faceted crystal, no glow gradients. Three or four shapes
total.

THE MOTION: the staff hangs still and vertical, in exactly the same position and
at exactly the same size in all eight frames. Only the frost above the gem
moves: two or three small flat ice shards orbiting it, and a faint cold wisp.

FRAMES:
1. One small shard beside the gem, wisp quiet.
2. Two shards, drifting up and apart.
3. Three shards, the gem brightening, wisp curling.
4. Brightest, shards at their widest spread.
5. Shards drifting back inward.
6. Two shards, one fading out above.
7. One shard, gem glinting, wisp almost gone.
8. Back to frame 1, so the loop is seamless.

This clip loops forever while the staff is carried, so frame 8 must flow into
frame 1 with no jump. The staff itself must not move, drift or change size.
```

### 20. Ice staff sweep — `assets/weapons/ice-staff.png`

Attach sheet 19.

```
Sheet 20: ICE STAFF SWEEP — the staff's melee attack.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: a wide horizontal sweep at low height, the gem travelling right to
left through a shallow arc close to an implied floor that is never drawn. It
rotates around its leather grip, which stays near the centre of the cell.

THE TRAIL: a broad pale-cyan crescent following the gem, flat colour with a bold
outline, with a handful of flat angular ice shards scattered along the arc. On
impact, a flat sideways burst of frost — low and level, never a ring and never
an oval on a floor.

FRAMES:
1. Upright, matching the idle sheet.
2. Drawn back and tilted, the gem brightening cold.
3. The sweep starts, a short cyan crescent behind the gem.
4. Passing low through the arc, crescent half drawn, first shards appearing.
5. Mid-sweep, gem at its lowest, crescent widest, shards along its length.
6. Past the low point, a flat sideways burst of frost at the gem.
7. Held out, the crescent breaking into flat shards that fall away.
8. Recovering upright, nearly back to the idle pose.
```

### 21. Ice cast, shards — `assets/casts/ice-shards.png`

Attach sheet 19.

```
Sheet 21: ICE STAFF FLICKING OUT A SHARD VOLLEY.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: a short sharp flick, not a full swing. The staff tips back slightly,
then snaps forward to end angled about 20 degrees below horizontal with the gem
pointing forward right at chest height. Quicker and smaller than the other casts
— this is the staff's cheap repeatable attack. It rotates around its leather
grip, which stays near the centre of the cell.

THE EFFECT AT THE TIP: ONLY a gathering charge, never the finished shards. The
volley is a separate sheet drawn over this one. What belongs here is frost motes
spiralling into the gem, a ring of small flat splinters forming around it, and
those splinters breaking away forward as a tight puff of frost at the snap.

FRAMES:
1. Upright, matching the idle sheet.
2. Tipped back about 10 degrees. Frost motes begin spiralling inward.
3. A ring of small flat splinters forms around the brightening gem.
4. The snap begins. The staff swings forward fast, splinters pulled along.
5. RELEASE. Angled 20 degrees below horizontal, gem forward right at chest
   height. The splinter ring breaks away forward as a puff of frost.
6. Held forward. A cold white flare lingers on the gem.
7. Recovering upward. Frost dust drifts back and settles.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 22. Ice cast, nova — `assets/casts/ice-nova.png`

Attach sheet 19.

```
Sheet 22: ICE STAFF PLANTED INTO THE GROUND.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: the staff stays UPRIGHT throughout — this is the one cast with no
rotation at all. It is lifted, then driven straight DOWN so the small gem at its
butt strikes an imaginary floor beside the caster's own feet, then drawn back
up. All movement is vertical. Do not tilt the staff.

THE EFFECT: this is the one cast where the charge gathers at the BUTT of the
staff, not the head, because the nova erupts at the caster's feet. The head gem
still brightens, but the visible discharge is at the bottom: a hard white flash
on impact and frost cracking away LOW AND LEVEL to both left and right along the
implied floor line. No ring, no circle, no oval, nothing that suggests a floor
seen from above. The nova itself is a separate sheet drawn over this one.

FRAMES:
1. Upright, matching the idle sheet.
2. Lifted straight up. Both gems begin to glow, frost motes gathering.
3. Lifted higher, head gem white-hot, butt gem glowing cold and bright.
4. Driving straight down, fast. A vertical frost streak trails the butt gem.
5. IMPACT. Butt gem at the floor line. A hard white flash and a low flat burst
   of frost spreading level to both left and right.
6. Held down. Flat frost spikes creep outward low along the floor line,
   symmetric left and right.
7. Lifting back up. The frost dims and drops away. Gems cooling.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 23. Ice cast, beam — `assets/casts/ice-beam.png`

Attach sheet 19.

```
Sheet 23: ICE STAFF LEVELLING AND HOLDING A BEAM.

Use the staff in the attached sheet: the same design, the same colours, the same
size. Do not redesign it and do not resize it.

THE MOTION: unlike the other casts, this one HOLDS. The staff swings down once
to level, gem pointing forward right at chest height, then stays there, locked
and trembling under the strain, for the middle four frames — before lifting away
at the end. Frames 3 through 6 are almost the same pose: the staff itself barely
moves, only the energy on it does. That stillness is what makes the beam read as
sustained rather than thrown. It rotates around its leather grip, which stays
near the centre of the cell.

THE EFFECT AT THE TIP: ONLY the origin of the beam, never the beam itself. A
brilliant white star sits on the gem and holds, with frost motes streaming
backward off it and a short stub of energy pointing forward. Do NOT draw a long
beam — the beam is a separate sheet that extends far beyond this cell.

FRAMES:
1. Upright, matching the idle sheet.
2. Swinging down toward level. Frost motes rushing inward to the gem.
3. LEVEL. Gem forward right at chest height. The white star ignites on it.
4. Held level. Star at full brightness, a short stub pointing forward. The staff
   trembling, shifted a pixel or two from frame 3.
5. Held level. The star pulses. Frost motes stream backward off the gem.
6. Held level. The star begins to gutter, the stub thinning.
7. Lifting away. The star collapses to a spark. Frost falls from the gem.
8. Returned upright, matching frame 1 and the idle sheet.
```

### 24. Shard volley effect — `assets/spells/ice-shards.png`

Attach sheet 19.

```
Sheet 24: A VOLLEY OF ICE SHARDS IN FLIGHT.

THE EFFECT: three or four faceted crystal daggers flying to the right in a loose
cluster, points leading, seen from the side, with thin frost streaks trailing
behind them. Flat pale cyan faces, one ice-blue shadow face each, bold dark
outline. Match the gem colour of the staff in the attached sheet.

Each shard is a simple flat crystal: two or three facets, one highlight. Not
glassy, not refractive, not many-faceted.

Camera: the shards travel perfectly horizontally, in profile, never angled
toward or away from the viewer.

FRAMES:
1. The shards tightly grouped. Trails short.
2. The group spreads slightly. Trails lengthen.
3. The shards fan apart vertically. Trails at full length.
4. Widest spread. Brightest highlights. Frost dust shedding.
5. The shards begin drawing back together.
6. Tight group again. Trails breaking into dashes.
7. The shards tumble slightly, catching the light differently.
8. Back to the frame 1 grouping, leading cleanly into it.

This clip loops in flight, so frame 8 must flow back into frame 1 with no jump.
The cluster's centre stays at the same point in every cell.
```

### 25. Frost nova effect — `assets/spells/ice-nova.png`

Attach sheet 19. **This is the sheet that is most wrong today**, drawn as a ring
of spikes around a hole you look down into — a top-down effect in a side-on
game.

```
Sheet 25: ICE ERUPTING FROM THE GROUND, SEEN FROM THE SIDE.

THE MOST IMPORTANT INSTRUCTION, so read it before anything else: this effect is
seen from the SIDE, the way you would photograph it standing on the same ground.
It is NOT seen from above and NOT seen at an angle. There is NO ring, NO circle,
NO ellipse, NO crown of spikes surrounding a hole, NO crater, NO floor disc, NO
shockwave ring spreading outward across a ground plane, and nothing that a
top-down or isometric game would use. A viewer must not be able to tell there is
any ground depth at all.

THE EFFECT: a burst of jagged ice spikes erupting upward out of the floor,
spreading symmetrically to the left and to the right from a single point in the
middle of the cell. A row of flat angular crystal shards punching up through
ice, tallest at the centre and shortening as they spread outward, with frost
dust and small shards thrown into the air above them. A jagged skyline of ice,
not a ring. Flat pale cyan faces, one ice-blue shadow face each, bold dark
outline. Match the gem colour of the staff in the attached sheet.

THE BASE: the spikes sit on an imaginary floor at the very bottom of the
artwork, with NO empty space beneath it. The game places the lowest row of ice
directly on the ground line, so any gap you leave becomes a gap in game. They
grow upward and outward from that line.

FRAMES:
1. A sharp white flash at the centre point, low and narrow. Floor cracking.
2. Three or four short spikes stab up at the centre. Still narrow.
3. The spikes lengthen. New shorter spikes appear either side, spreading out.
4. Full width and full height. Brightest frame. A tall jagged centre falling
   away to small spikes at the far left and right. Frost dust in the air.
5. The spikes hold. Loose shards break off the tips and drift upward.
6. The outer spikes begin to crumble. The centre dims from white to pale cyan.
7. Most spikes shattered into scattered fragments, low to the floor line.
8. A faint dusting of ice crystals and a dim afterglow along the floor line.
```

### 26. Freezing beam effect — `assets/spells/ice-beam.png`

Attach sheet 19.

```
Sheet 26: A LONG THIN BEAM OF FREEZING ENERGY.

THE EFFECT: a horizontal lance of freezing energy firing to the right. A
brilliant white star at the LEFT end, where it leaves the staff gem, narrowing
into a slender beam of flat pale cyan studded with small flat angular ice
crystals along its length, ending in a sharp point at the right. Match the gem
colour of the staff in the attached sheet.

PROPORTIONS, and this matters more than anything else here: the beam spans the
ENTIRE WIDTH of its cell, touching the left and right cell edges — this is the
one sheet where artwork should reach the side edges — and it is SLENDER, no more
than about a quarter of the cell's height at its thickest. It is a lance, not a
cone and not a blast. Reach is the whole point of this spell, so err long and
thin. A short stubby beam is the one failure this sheet cannot recover from.

Keep at least 24 pixels of clear green ABOVE and BELOW the beam, so it never
crosses into the row above or below.

Camera: the beam is perfectly horizontal, never angled toward or away from the
viewer, and never receding into the distance.

FRAMES:
1. Only the white star at the left. No beam yet.
2. The beam lances out to a third of the width. Thin and sharp.
3. It reaches two thirds. The first crystals form along it.
4. Full width, edge to edge. Brightest frame. Crystals dense along the length.
5. Full width held. The crystals rotate and catch the light.
6. The beam thins. Crystals begin shedding off it.
7. The beam breaks into separate segments. The star dims.
8. Scattered frost and a dim afterglow along the beam's line.

The bright star stays pinned at the same point near the left edge in every cell.
The beam grows out of it to the right and dies back into it.
```

## Part 5 — Props

### 27. Straw dummy — `assets/characters/dummy.png`

Nothing attached. Currently far too detailed for the characters it stands next
to — individually drawn straws, rendered rope, woodgrain.

```
Sheet 27: A STRAW TRAINING DUMMY BEING STRUCK.

THE PROP: a simple straw training dummy on a post. A cream-yellow straw body
drawn as two or three FLAT masses with a ragged silhouette — not individual
straws. A plain mid-brown post below it and a short crossbar for arms. Two flat
bands of darker rope where the straw is tied. A small dark notch for a face, or
no face at all.

Keep it plain: no individually drawn straw strands, no woodgrain, no rope fibre
detail, no cloth folds, no dirt. It stands next to flat, boldly outlined
characters and has to belong with them. Three or four flat shapes total.

THE MOTION: one reaction to being hit — struck, recoil, wobble, settle. The post
stays planted at the bottom; the body bends away from the blow to the right and
rocks back. FRAME 1 IS THE UPRIGHT RESTING POSE, because the game rests on that
frame and replays the whole clip when the dummy is hit.

THE BASE: the post's foot sits at the very bottom of the artwork with NO empty
space beneath it, in every frame. The game plants that lowest point on the
ground, and the post's foot must not move between frames — only the body above
it bends.

FRAMES:
1. Upright and still. The resting pose.
2. STRUCK. The body snaps hard to the right, straw flying off, post flexing.
3. Bent furthest right, straw scattering, a few flat impact marks.
4. Springing back, passing through upright, straw settling.
5. Overshooting to the left, less far than it went right.
6. Rocking back to the right, half the amplitude.
7. A small wobble left, nearly settled.
8. Upright and still again, matching frame 1 exactly.
```

## Part 6 — Layering

You mentioned wanting a Hollow Knight sort of layered look. Two different things
are worth separating, because one is nearly free and the other is a project.

### Layering the effects around the character — do this now

Everything in this document is already a separate sheet composited over the
goat, which is why one sword works for any character. The next step up costs
almost nothing: split an effect that *surrounds* the character into two sheets,
so the goat stands inside it rather than in front of it.

It is only worth it for three: the frost nova, the flame pillar and the shield
block. Those are the ones the character occupies the middle of.

To generate a pair, run the sheet's prompt twice with one line added:

> Draw ONLY the parts of this effect that are BEHIND the character — the far
> side, the parts that should be hidden by a body standing in the middle of it.
> Leave the near side out entirely. Same eight frames, same timing, same
> positions, so this sheet and its companion line up exactly when stacked.

and then:

> Draw ONLY the parts of this effect that are IN FRONT of the character — the
> near side, the parts that should cover a body standing in the middle of it.
> Leave the far side out entirely. Same eight frames, same timing, same
> positions, so this sheet and its companion line up exactly when stacked.

Save them as `ice-nova-back.png` and `ice-nova-front.png`. In game that is one
extra sprite per effect, placed below the goat in the display list instead of
above — `PlayScene` already does exactly this for the companion, which is moved
below the goat with `children.moveBelow`.

The two sheets must be generated in the same chat, one straight after the other,
or the frames will not line up.

### Layering the world — later

Parallax background layers are a different job: they are not 8-frame sheets and
they do not go through the atlas pipeline. The game currently fakes depth with
two flat coloured bands in `PlayScene.#buildBackdrop`, scrolling at 0.15 and 0.4.
Replacing those with art means a handful of wide seamless strips, each on its own
scroll factor.

A starting point, adapted per layer:

```
A seamless horizontally-tiling background layer for a 2D side-scrolling game,
2048 x 512 pixels, PNG with transparency.

Same flat storybook style as the style brief: bold dark outlines, two or three
flat tones, no gradients, no fine detail.

This is the FAR layer, so it is the simplest and lowest contrast: a row of
distant rounded hills in two flat tones, silhouetted, with no texture and no
detail smaller than about 30 pixels. Dark, desaturated, low contrast — it must
sit behind everything without competing.

The left and right edges must match exactly so the image tiles seamlessly when
repeated horizontally. Nothing may touch the top or bottom edges.
```

Repeat with "the MIDDLE layer — closer, slightly larger shapes, a little more
contrast" and "the NEAR layer — large foreground shapes, highest contrast, may
be partly cut off by the bottom edge". Three layers is enough to sell depth;
Hollow Knight's own backgrounds are mostly three or four.

That is a separate piece of work from the sheets above, and the sheets do not
depend on it.

## Part 6b — What the first full round actually needed

All 27 sheets came back usable and every one of them keyed cleanly on green, so
the mixed keying modes the pipeline used to carry are gone. Four things still
needed doing, and they are the ones to expect again.

**The beam came back 2 across and 4 down.** Asking for a beam that "fills the
entire width of its cell" got a generator that widened the cells instead — which
is the better answer. Its frame is now 756 x 119, a 6.35:1 aspect, so the runtime
`stretchX: 2.2` that used to fake the reach is gone entirely. `sheets.py` has a
bespoke spec for that one sheet. If a redrawn beam ever comes back on the normal
4 x 2 grid, that spec has to go back to `_spell`.

**The grip detector needed tightening.** It looked for dark warm pixels, and the
new magenta trails have a dark outline that is also warm by that test — a fifth
to a third of every "grip" it found on the sword and shield sheets was actually
trail. Brown runs R > G > B and magenta runs R > B > G, so one extra clause
(`G >= B`) separates them. Grip drift across frames is now under a pixel on
every weapon sheet, which is what keeps a swing from skating.

**Every `lengthRatio` had to be re-solved, and not by eye.** `lengthRatio` is
divided by the sheet's body ratio, which measures the artwork's *vertical*
extent — so a staff drawn horizontal mid-cast has a small one and the same
number blows the weapon up. The beam cast at 1.3 drew a staff half again as tall
as the goat. The fix is to measure the distance from the grip to the far end of
the bone shaft, ignoring trails and gems, and scale it to match that weapon's
idle sheet: rotation cannot change that distance, which is why it is the one
measurement worth taking. Every clip of every weapon now draws it within a world
unit of its carried length.

**The shields do not pivot.** Every other weapon sheet anchors each frame on its
grip, which is what keeps a swing rotating around the hand. A shield is raised
rather than swung, and the rise *is* the animation — pinning it to the shield's
own centre would delete the only motion in the sheet. They anchor on their cell
instead, and `sheets.py` has a separate `_shield` builder saying so.

## Part 7 — Wiring the results in

```bash
npm run assets
```

Run from `src/web`. It re-keys, re-splits and re-packs every sheet and fails
loudly if a row no longer holds four findable frames, rather than quietly
producing a broken animation.

**Replacing existing art** — sheets 1-4, 7, 8, 10, 11, 12, 16, 17, 18, 19, 20,
24, 25, 26 and 27 overwrite files that already exist. Drop them in the same
paths, re-run `npm run assets`, and nothing else changes. The generated
`*Atlas.generated.ts` files pick up the new frame sizes and body ratios, and
every size and offset in the game is solved from those rather than hardcoded.

**New sheets** need a spec in `scripts/sheets.py`, which for anything
weapon-shaped is one line, plus an entry in the `SHEETS` tuple at the bottom:

```python
FIRE_BALL_CAST = _weapon("fireBallCast", "casts/fire-ball.png", "green")
```

**Cast sheets** hang off the optional `casts` map on `WeaponDef`, ability id to
sheet. With nothing in it the weapon keeps playing its idle loop through a cast,
so they can be added one at a time.

**The shield** is wired as the sword's ability slot. It is not an `AbilityId` —
it throws nothing — so slots are typed `SlotId = AbilityId | 'guard'` and
`slotInfo()` is the one place that answers what a slot shows, for both bars.
Guard is a press rather than a hold, because the intent stream reports abilities
as edge triggers: raising the shield starts a timer, and pressing again inside
`SHIELD.parryWindow` turns the block into a parry. Its cooldown starts when the
guard comes down, not when it goes up, so holding one does not eat the wait for
the next.

The parry currently has nothing to parry — there is no incoming damage in the
game yet. Both animations are reachable and the timing is real; what is missing
is something to counter.

### What to check on the first sheet of each weapon

Equip it and watch the grip while turning around. If the weapon jumps at the
moment of casting, the cast sheet is drawn at a different scale from the idle
sheet. If it jumps on one frame only, the grip was obscured in that frame and
the pipeline anchored it on its cell instead — `npm run assets` prints a frame
count per row, but it cannot catch this one, so it is worth a look.

### Things the pipeline will tell you about, and things it will not

It fails loudly on: the wrong number of frames in a row, a missing source file,
an unknown keying mode.

It cannot see: a weapon drawn at the wrong scale, a hidden grip, an effect drawn
in perspective, a ground effect with empty space under it, or a loop whose last
frame does not meet its first. Those are what the prompts above are for.
