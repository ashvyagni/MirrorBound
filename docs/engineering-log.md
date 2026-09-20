# Engineering log

One entry per batch of work, written **before** the commits are pushed. Each
entry records what changed, what was found wrong, and how each defect was
measured — a commit message says what a change does, and this says what it cost
to find out that it was needed.

The rule for this file: a defect is only listed once it has been reproduced.
"Probably because" does not go in here.

---

## 2026-09-20 — 14 commits, `d9ca544..4c653a4`

171 files, +11,840 / −2,695. Server tests 428 (+7 files), frontend 46 (+6).

### What shipped

| commit | what |
| --- | --- |
| `d14f130` | `--reload` on the dev server; `tools/playtest` combat probe |
| `a207260` | Staves bash on M1 and grant three spells; buffered attacks so the sword combo chains |
| `34603aa` | Named save slots, each carrying its own trained model |
| `30cdbb7` | Composed room dressing; the spitter, sprout and shardling given server definitions |
| `ac61e78` | The Mirror casts its own kit plus the weapon's, and commits to a stance instead of kiting forever |
| `610b441` | The campaign arms the boss; the snapshot says what it holds |
| `c430060` | Interface moved onto the canvas; the agent view given a key |
| `efa7daf` | The blackened weapon sheets wired; flame pillar and flame burst fixed |
| `8d810fa` | Floors composed in three passes; drawn tiles via `build_tiles.py` |
| `f1b7e2c` | Floor tiles, ability icons, speaker portraits redrawn |
| `f9be55c` | Art prompts cut to what is outstanding |
| `2d674bc` | A new run starts from nothing rather than copying the current one |
| `68bfd39` | Areas gated one at a time; the way home moved off the room's centre |
| `4c653a4` | HUD hidden for the cutscene; job 4 prompt written |

### Defects found, and the evidence

- **The game's premise never ran.** `armed_with` existed and was tested, and
  was only ever called by the sandbox's `CONFIGURE_BOSS`. `boss_loadout` starts
  empty and nothing in a real playthrough set it.
- **The boss could not cast at all.** `mirror.py` had zero references to
  abilities and `armed_with` dropped `weapon.abilities`. Its nova was a
  hard-coded special case with its radius and damage as module constants, which
  is why nothing could be added beside it. Measured over a 45s fight with both
  fighters kept alive: **0 spells → 16**.
- **It kited every tick.** `melee_dependency` saturates at 1.0 and the counters
  were re-scored each tick, so a sword player was read correctly and then held
  at range for the whole encounter. Over 2,400 ticks: **1 press tick → 1,015**.
- **Floors were diagonal corduroy.** `(x * 7 + y * 13 + seed) % 3` — 7 and 13
  are both 1 mod 3, so it collapses to `(x + y) % 3` and steps by one every
  cell. Neighbour-match statistic: **0.0% → 33.3%** (0% is the signature of a
  strict cycle, not of scatter).
- **Sheet 86 shipped dead.** The Warden's `hurt` and `slam` were in the art
  table but never loaded and never registered, so its flinch and its slam did
  nothing at all.
- **Flame pillar fired in silence** — no case in the client's ability switch,
  so it fell through to `default: break`.
- **Flame burst did not travel** although its sheet is a rolling wave: **0u →
  90u over 260ms**.
- **Escape flashed the pause screen.** The store announced the menu closed
  before giving the pause back, and the panel followed the server's
  confirmation a round trip later. The test was verified by restoring the old
  ordering and watching it fail.
- **The notice column stalled mid-screen.** `avoid()` runs every frame against
  a speech bubble that moves every frame, so a new tween was created ~60×/sec,
  each fighting the last.
- **The dialogue plate had a transparent band** — its portrait window stretched
  by the nine-slice. The first fix removed the band *and* the plate's left
  border; the second keeps both.
- **The camera followed a destroyed sprite.** The twin is destroyed on the
  hatch beat while the camera still follows it. Phaser keeps the dead object's
  last coordinates and freezes silently.
- **The Mirror was not where its shell opened** — 192 units away, with a hatch
  beat (2.6s) shorter than the animation played over it (4.83s), so it spoke
  its first line from inside an unopened egg.
- **The way home opened underfoot** at `width/2, height/2`.
- **A new save was always a copy**, and the button read NEW SAVE while sending
  `SAVE_AS`.
- **`adoptArt` dropped visibility** — copied depth, flipX and alpha but not
  `visible`.
- **The asset build stopped silently** at 72 of 155 atlases. Only caught
  because the built speaker atlas still showed the old human portraits.

### Corrections to my own work

- **`npx tsc --noEmit` in `src/web` runs an npm script, not the compiler**, and
  exits 0 having done nothing. Every "typecheck clean" reported before this was
  found was meaningless. Use `npm run typecheck`.
- **The first boss measurements were of a corpse.** The player dies in about
  eight seconds in that harness, after which the boss retargets the twin — so
  "the frost staff barely casts" and "flame pillar never fires" were both
  artefacts. Keeping both fighters alive changed the answer.
- **A progress check matched itself**: `pgrep -f "build_atlas.py"` run from a
  command containing that string reported "still building" after the build had
  finished.
- **`displayWidth` is the untrimmed source box**, not the artwork. It gave
  wrong overlap numbers until replaced with `frame.width × scaleX`.
- **A test asserted nothing** — `assert x != y or True`. Ruff caught it.
- **Ruff caught dead code the tests could not**: refactoring the nova into an
  ability orphaned `_nova`, and every test still passed without it.

### Known gaps

- The two blackened shield sheets are unused: the Mirror has a riposte counter
  but no block or parry state to draw, so that needs behaviour before art.
- The twin's health and mana bars are specified (`docs/art-prompts.md`, job 4)
  but the sheet does not exist yet.
- The fourteen commits are thematic slices of one working tree. The final tree
  is verified; no intermediate commit was checked out and tested on its own.
