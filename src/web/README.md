# Mirrorbound — web client

TypeScript + React + Phaser 4 on Vite. This is the **frontend only**: the game
simulation and AI agents live behind the FastAPI backend, reached over
WebSocket. Nothing here talks to a database or renders on a server, which is why
there is no SSR framework in the stack.

```bash
npm install
npm run dev        # http://localhost:5173
npm run assets     # rebuild every atlas from the sheets in assets/
npm run build      # typecheck + production bundle
npm run lint
```

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / `WASD` | Move, in any of eight directions |
| `Shift` | Run |
| `J` or left click | Attack — swings the equipped weapon |
| `K` | Companion attack |
| `1` `2` `3` | The equipped weapon's abilities. The sword's is Guard -- press again quickly to parry |
| `Q` `E` | Draw from the first or second hand |
| `R` | Turn the potion dial |
| `F` | Drink the selected potion |
| `M` | Open the full map |
| `P` | Pause — blurs the world and shows the run's stats |
| `Space` | Interact with whatever you are standing next to |
| `\` | Console: `spawn <thing>`, `clear`, `help` |

Every one of these is rebindable. The settings screen's Controls tab takes the
next key you press, and the table persists -- `DeviceIntentSource` was already
the only thing in the game that knew a key code, which is what made rebinding a
change to one table rather than a hunt through the codebase.

`Q` and `E` are bound to *hands*, not to a carousel: two weapons are carried at
a time, so each key always reaches the same weapon. Which two is decided in the
Loadout panel, which is the whole of the inventory.

Abilities and weapons are labelled with icons from `assets/ui/icons.png` -- one
per spell, plus a sword standing in for plain melee. They go through the same
atlas pipeline as everything else, downscaled at build time since nothing draws
them above about 34 px.

## Layout

```
scripts/build_atlas.py     asset pipeline: character sheet -> texture atlas
scripts/build_tiles.py     floor tiles: a full-bleed grid sliced to TILE, no keying
public/game/<name>/         generated atlas (png + phaser json), one per sheet
src/game/                  everything Phaser. Never imported by React directly.
  animation/               clip tables + the generated frame manifests
  entities/Goat.ts         the character: physics, state, animation
  entities/Bro.ts          the floating companion
  entities/Weapon.ts       the equipped weapon: idle, combo, cast motions
  entities/Shield.ts       the sword's guard and parry
  input/                   keyboard and mouse -> Intent
  hud/                     the in-game interface, one file per piece
    Portrait.ts            the goat's face in its ring, health and mana
    Hotbar.ts              two hands and the potion dial
    CooldownRail.ts        what is recharging, stacked up the right
    Minimap.ts             the room and what is in it
    SettingsButton.ts      the gear and its two switches
    fit.ts                 size a piece from the frame actually on screen
  scenes/                  preload, play, and HudScene which composes the above
  state/StateMachine.ts    generic, explicit state machine
  state/Vitals.ts          health and mana
  state/Loadout.ts         two weapon slots and the potion carousel
  EventBus.ts              the only React <-> Phaser channel
src/ui/                    React. Talks to the game only through EventBus.
  atlas.ts                 reads a generated atlas for the DOM to draw from
```

## Weapons

Ten weapon sheets feed the game alongside the goat and the companion: a swing
and an idle loop for each of the four weapons, with the sword taking three
swings of its own. It gets three because a combo needs its hits to look
different, and the thing that actually distinguishes a swing at this speed is
the *shape* of its trail, not the blade's angle -- so the three are a crescent
sweep, a straight wedge with a ground burst, and a closed ring.

Weapon sheets carry no character. They are drawn swinging through empty space
and composited over the goat, the same way the companion's attack borrows the
goat's swirl. That keeps one weapon usable by anything, and avoids asking an
image generator to redraw a character consistently across six sheets -- which is
exactly where the companion sheet fell down.

Source art is grouped by what it is:

```
assets/characters/   goat, companion, practice dummy
assets/weapons/      an idle and a swing sheet per weapon, plus the shield
assets/casts/        the weapon's own motion while an ability fires
assets/spells/       the effects those abilities throw
assets/ui/           the ability icon set, and the seven HUD pieces
```

A cast is two sheets, not one: `casts/fire-ball.png` is the staff swinging and
charging its gem, `spells/fire-ball.png` is the fireball that leaves it. They
are drawn separately and composited, so neither has to know about the other --
and the charge at the tip is deliberately only a charge, since drawing the
finished spell in both would give you two of it.

Every generated sheet was made from a prompt, and the prompts are the reason
twenty-six sheets look like one game. `docs/art-prompts.md` now holds only what
is still to draw; the prompts for everything already shipping -- Block 0, the
house style itself, included -- were cut once they were made and live in the
history:

```bash
git show da61c32:docs/art-prompts.md
```

Pull the original out of there before regenerating any shipped sheet. A fresh
description of the same object is how a set quietly stops matching.

The style is the point of the document. The characters are flat, boldly
outlined and simple; the first round of weapons came back as ornate painted RPG
items, and in one frame together they read as two different games. Block 0
brings everything down to the characters rather than the other way round.

Two rules run through all of it. Weapon sheets are sent with that weapon's idle
sheet attached, because an attached image holds a shape better than any
description -- which is why the order matters, each weapon's idle being made
first. And effects are drawn flat and side-on: the game moves on one axis, and
an effect drawn as though seen from above reads as belonging to a different
game entirely. Half of what they say -- grid, keying colour,
frame spacing -- is enforced by `scripts/sheets.py`, which fails the build
rather than producing a broken animation. The other half is not enforceable and
is the reason the file exists: the per-frame timing, and keeping every effect in
a flat side-on view. The game moves on one axis, and an effect drawn as though
seen from above reads as belonging to a different game entirely.

## The interface

Seven pieces of chrome in `assets/ui/`, drawn to the Block 0-UI brief in
`docs/art-prompts.md` and keyed the same way the weapons are. Three things
about it are worth knowing.

**Nothing in it holds state.** Health arrives as `vitals:changed`, the loadout
as `loadout:changed`, recharge times as `weapon:cooldowns` — all pushed by the
scene that owns them. No view can disagree with the game about what is in hand
or what is ready, because no view is keeping its own copy to disagree with.

**The portrait's face was already drawn.** `GOAT_FRAMES.face` is ten
expressions on the character sheet, already cycling in the wordmark. The ring
was drawn open across the top so the head can break it, and the head is drawn
*over* the ring rather than inside it — behind it, the portrait reads as a face
at the bottom of a hole. It answers what just happened: surprised when hit, sad
at death, happy on a potion.

**Sizes are measured off the art, not chosen.** `HUD_ART` carries the rail's
inner channel and the hotbar's three slot centres as fractions taken from the
PNGs, and `hud/fit.ts` sizes every piece from the frame on screen rather than
from the sheet's shared box. Both exist because the alternative was tried: a
socket sized independently of its channel grew straight through the rail's
walls, and an item centred where a slot *ought* to be sat visibly off the
hand-drawn slot that was actually there.

Health, mana and the potions are local to this branch and named to match the
server's snapshot on `main` — `health`, `maxHealth`, `mana`, `maxMana`, and
consumable ids from its `CONSUMABLES` — so adopting the real ones is deleting
`state/Vitals.ts` and pointing the HUD at the snapshot. The two-weapon rule is
the exception: `main`'s `Inventory` has a weapons list and a single
`equipped_weapon`, so carrying two is a server change rather than a rename.

## Settings

The gear opens a two-tab screen drawn in the canvas, not in React, for the same
reason the rest of the HUD is: it has to survive fullscreen, where no DOM panel
beside the game exists any more.

`ui/settings.ts` carries all nine of `main`'s settings even though this branch
can honour three -- zoom, quality and the hitbox overlay. There is no audio
module here, nothing shakes, nothing draws damage numbers and there is no twin
to have thoughts about. Keeping the shape means adopting `main`'s store later is
deleting a file, and it means a setting saved now is still the right setting
when the system behind it arrives. The six that do nothing are *named* on the
screen rather than hidden, so they read as coming rather than missing -- and so
nobody wires a slider to nothing to fill the space.

`state/Keybinds.ts` is the binding table. Rebinding steals a key rather than
refusing it: someone putting attack on `K` wants attack on `K`, and refusing
leaves them to work out that the companion had it. The row that lost its key
shows a dash, which is a problem you can see rather than one you have to deduce.
Escape, Tab, F5 and F12 are reserved, because binding the key that closes the
screen you are binding from leaves clearing storage by hand as the only way out.

## The console

`\` opens a one-line command bar. `spawn <thing>` puts any of the eleven
creatures, the boss or any of the seven items in front of you; `clear` takes
them all back out.

Completion is a ghost drawn behind the cursor at low opacity and taken with Tab
or the right arrow. Nothing is ever typed for you, so a wrong guess costs
nothing and the opaque text is always exactly what you entered.

Commands live in one table in `state/Commands.ts` rather than a switch, because
the same table answers both "run this" and "what might they be typing" — two
lists that have to agree are one list that eventually does not.

## The room

The arena is gone. `world/Grove.ts` generates a `RoomFull` -- grass and dirt
under an S-bend path, a pond, trees hugging the walls, and sixty-odd props --
and hands it to `WorldRenderer`, which is `main`'s renderer pulled across
unchanged along with `TextureFactory`, `PropPainter`, `paint` and `Ambient`.

The renderer cannot tell which side produced the room, and that is the whole
point of doing it this way: `RoomFull` is `main`'s wire contract, so when the
socket lands the generator is deleted and the snapshot goes straight in. The
generator is a port of `dungeon/generation.py`, kept faithful rather than tidied
-- the blotch radii, the edge biases and the decor counts are numbers `main`
tunes against, and a grove that looks different here than it does there is
worse than no grove at all.

Props are not physics bodies. A room holds about sixty of them, most of which
never move and most of which the goat is nowhere near, so `#clampToRoom` pushes
out of the few circles it actually overlaps. That is cheaper than sixty static
bodies and it cannot wedge the goat between two of them the way overlapping
bodies can.

`world/Run.ts` carries the shape of a run -- `biome_for()` and the room
sequence, both ported from `main` -- so the full map has something true to draw.
Only the first room exists as geometry; the rest are known positions on a known
path, drawn unvisited.

## The camera

The world is seen from above and drawn with painter's ordering: every entity
sets its depth from its own `y` each frame, so whatever is further down the
screen draws in front. That sorting *is* the 2.5D look -- there is no
projection anywhere, no isometric transform, nothing skewed. A shadow ellipse
under each entity and a vignette over the whole screen do the rest.

It follows that `y` means depth into the scene, not height above a floor.
Nothing falls, there is no gravity and no jump; the goat's body box is a
shallow rectangle around its footing, so its head overlaps whatever is behind
it rather than colliding with it.

The goat has three drawings of itself: the original side-on sheet, and two more
for walking away from the camera and toward it. `rowFor(aim)` picks between
them, with a bias that keeps a mostly-sideways diagonal on the side sheet --
that is the only one with a profile and a direction in it, and without the bias
a gentle diagonal turns the goat's face away for no reason. Only the side sheet
is ever mirrored: the other two are symmetrical, so flipping one would just
swap which way the horns spiral.

They are sized by body ratio rather than frame height. The three sheets are
cropped differently -- the new ones are tight, the original has padding for its
jump and attack rows -- so matching their boxes would draw the same creature at
three different sizes.

Attacks, staggers and deaths always play from the side sheet, which is the only
one that has them. The goat turns side-on for the moment it swings, which is
both what the art can do and what reads most clearly anyway.

`facing` still flips the side sprite while a separate `aim` vector carries the
real direction. Everything thrown
travels along `aim`. Weapons are placed along it too, and a mostly-vertical aim
tilts the whole weapon and pulls it in close, because a side-on swing drawn
flat would read as swinging across the screen no matter where the goat was
pointing.

## Three decisions worth knowing

**Backgrounds are keyed three different ways.** `SheetSpec.key` picks one:
`black` for the two character sheets, `green` for the chroma-keyed weapons,
`alpha` for the one sheet that arrived with real transparency. The black path is
by far the most work, for a reason worth remembering -- see below.

**The art is generated, not hand-sliced.** `assets/characters/goat.jpg` is a JPEG on
black: no alpha, no uniform grid, and the artwork is outlined in near-black —
the *same value as the background*, so no luminance threshold can separate them.
`scripts/build_atlas.py` recovers the silhouette morphologically instead (grow
the certainly-bright pixels outward to swallow the outline, fill holes, smooth),
locates frames by isolating the warm cream body, and splits them by seeding each
frame with its body plus its own FX and growing those labels through the art.
That last part matters: the attack swirls belong to the goat on their left but
arc over into the next frame's column, so any straight cut either clips a swirl
or leaves a slice of it stuck to its neighbour.

Re-run `npm run assets` after changing the art. It asserts the frame count per
row and fails loudly rather than silently producing broken animations, and it
emits `goatAtlas.generated.ts` so a missing frame is a compile error.

**The character consumes `Intent`, not key presses.** `DeviceIntentSource`
turns the keyboard and mouse into a neutral `{ moveX, jump, attack, run, ... }`
struct, and nothing downstream knows where it came from. Switching weapons is
in there too, which is why the in-game bar, the React panel and the `Q`/`E`
keys all reach the same code. When the agent system lands, it
drives the character by producing the same struct — no special path through the
game code, and the same replay/debug tooling works for both.

**The state machine names interrupts explicitly.** `Goat.#states()` is a table,
and its `interruptibleBy` column is the single place that says an attack cannot
be cancelled by walking, a stagger cannot be cancelled by anything but death,
and death cannot be cancelled at all. Adding a mechanic means adding a row.

## Adding an animation

1. Draw it on the sheet as a new row.
2. Add a `Band(...)` to that sheet's `SheetSpec` in `scripts/sheets.py` with
   its frame count.
3. `npm run assets`.
4. Add a clip to `CLIPS` in `src/game/animation/goatClips.ts`.
5. If it is a new behaviour, add a state to `PlayerState` and a row to
   `Goat.#states()`.
