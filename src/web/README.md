# Mirrorbound — web client

TypeScript + React + Phaser 4 on Vite. This is the **frontend only**: the game
simulation and AI agents live behind the FastAPI backend, reached over
WebSocket. Nothing here talks to a database or renders on a server, which is why
there is no SSR framework in the stack.

```bash
npm install
npm run dev        # http://localhost:5173
npm run assets     # regenerate the sprite atlas from assets/goatsprite.jpg
npm run build      # typecheck + production bundle
npm run lint
```

## Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Move |
| `Shift` | Run |
| `Space` / `W` | Jump (hold for height) |
| `J` | Attack — swings the equipped weapon |
| `K` | Companion attack |

## Layout

```
scripts/build_atlas.py     asset pipeline: character sheet -> texture atlas
public/game/goat/          generated atlas (png + phaser json)
src/game/                  everything Phaser. Never imported by React directly.
  animation/               clip tables + the generated frame manifests
  entities/Goat.ts         the character: physics, state, animation
  entities/Bro.ts          the floating companion
  entities/Weapon.ts       the equipped weapon and its combo
  input/                   keyboard -> Intent
  scenes/                  preload, play
  state/StateMachine.ts    generic, explicit state machine
  EventBus.ts              the only React <-> Phaser channel
src/ui/                    React. Talks to the game only through EventBus.
```

## Weapons

Eight sheets feed the game: the goat, the companion, and six weapon sheets. The
sword is three of those -- one per swing -- because a combo needs its hits to
look different, and the thing that actually distinguishes a swing at this speed
is the *shape* of its trail, not the blade's angle. So the three are a crescent
sweep, a straight wedge with a ground burst, and a closed ring.

Weapon sheets carry no character. They are drawn swinging through empty space
and composited over the goat, the same way the companion's attack borrows the
goat's swirl. That keeps one weapon usable by anything, and avoids asking an
image generator to redraw a character consistently across six sheets -- which is
exactly where the companion sheet fell down.

`assets/prompts/` used to hold the generation prompts; they have served their
purpose and the rules they encoded now live in `scripts/sheets.py`, where they
are enforced rather than described.

## Three decisions worth knowing

**Backgrounds are keyed three different ways.** `SheetSpec.key` picks one:
`black` for the two character sheets, `green` for the chroma-keyed weapons,
`alpha` for the one sheet that arrived with real transparency. The black path is
by far the most work, for a reason worth remembering -- see below.

**The art is generated, not hand-sliced.** `assets/goatsprite.jpg` is a JPEG on
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

**The character consumes `Intent`, not key presses.** `KeyboardIntentSource`
turns the keyboard into a neutral `{ moveX, jump, attack, run }` struct, and
nothing downstream knows where it came from. When the agent system lands, it
drives the character by producing the same struct — no special path through the
game code, and the same replay/debug tooling works for both.

**The state machine names interrupts explicitly.** `Goat.#states()` is a table,
and its `interruptibleBy` column is the single place that says an attack cannot
be cancelled by walking, a stagger cannot be cancelled by anything but death,
and death cannot be cancelled at all. Adding a mechanic means adding a row.

## Adding an animation

1. Draw it on the sheet as a new row.
2. Add a `Band(...)` to `BANDS` in `scripts/build_atlas.py` with its frame count.
3. `npm run assets`.
4. Add a clip to `CLIPS` in `src/game/animation/clips.ts`.
5. If it is a new behaviour, add a state to `PlayerState` and a row to
   `Goat.#states()`.
