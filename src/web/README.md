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
| `←` `→` / `A` `D` | Move |
| `Shift` | Run |
| `Space` / `W` | Jump (hold for height) |
| `J` or left click | Attack — swings the equipped weapon |
| `K` | Companion attack |
| `1` `2` `3` | The equipped weapon's abilities. The sword's is Guard -- press again quickly to parry |
| `Q` `E` | Previous / next weapon |

Abilities and weapons are labelled with icons from `assets/ui/icons.png` -- one
per spell, plus a sword standing in for plain melee. They go through the same
atlas pipeline as everything else, downscaled at build time since nothing draws
them above about 34 px.

## Layout

```
scripts/build_atlas.py     asset pipeline: character sheet -> texture atlas
public/game/<name>/         generated atlas (png + phaser json), one per sheet
src/game/                  everything Phaser. Never imported by React directly.
  animation/               clip tables + the generated frame manifests
  entities/Goat.ts         the character: physics, state, animation
  entities/Bro.ts          the floating companion
  entities/Weapon.ts       the equipped weapon: idle, combo, cast motions
  entities/Shield.ts       the sword's guard and parry
  input/                   keyboard and mouse -> Intent
  scenes/HudScene.ts       the in-game bar: weapons, abilities, cooldowns
  scenes/                  preload, play
  state/StateMachine.ts    generic, explicit state machine
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
assets/ui/           the ability icon set
```

A cast is two sheets, not one: `casts/fire-ball.png` is the staff swinging and
charging its gem, `spells/fire-ball.png` is the fireball that leaves it. They
are drawn separately and composited, so neither has to know about the other --
and the charge at the tip is deliberately only a charge, since drawing the
finished spell in both would give you two of it.

Every generated sheet has a prompt in `docs/art-prompts.md`, in the order they
should be made. Its Block 0 is the house style, pasted once per chat; each
numbered prompt after it is short because it inherits from that.

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
