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

---

## 2026-09-20 (later) — vitals wired, `7dc678f..`

Sheet 92 arrived, so the level bar and the twin's health and mana are drawn.
Frontend tests 54 (+1 file).

### What shipped

- `vitals` atlas built from `assets/ui/vitals.png`: `levelTrough`,
  `levelPlate`, `twinHealth`, `twinMana`, `twinMark`, `levelFlash`.
- `VitalsSnapshot` carries the level, its progress, and the twin's pair or
  `null`. `Bridge` fills it; `Portrait` draws it.
- The twin's bars are built once and hidden, not created when the twin appears:
  it is dormant before the crypt, taken at the Sanctum, and downed in between,
  and building art on each of those is three chances to leak a sprite.

### Defects found, and the evidence

- **The new troughs have opaque interiors.** `hp` and `mp` are transparent
  where the fill shows through (121 of 121 samples); sheet 92's three are
  painted in (0 of 31). Drawing the fill behind them, the way the existing bars
  work, hid it completely. They are composited art-first with the fill over the
  top — which also lets the level bar's ten dividers read as darker lines
  across the filled part rather than vanishing under it.
- **Every bar in the stack overlapped its neighbour.** Measured on the live
  HUD: hp `75..109`, twin health `103..132`, mp `121..156`. The gap between the
  player's two bars was eleven pixels and the companion trough is nineteen.
  `bars.gap` went 46 → 58 and the twin bars were sized to half the player's
  height. Re-measured: `75..109`, `113..131`, `133..167`, `171..189`,
  `192..240` — no overlap left.
- **The atlas was built but never loaded.** `VITALS_TEXTURE_KEY` was missing
  from `hud/textures.ts`, so the portrait corner drew Phaser's green
  missing-texture box over the health bars. That list exists to stop exactly
  this and had to be told.

### Corrections to my own work

- **The first test file counted fourteen emits instead of one.** Each
  `beforeEach` started a `Bridge` and never stopped it, so every test after the
  first was counting the emits of every Bridge before it. It only surfaced
  because two of the tests assert a count; the other six would have passed for
  the wrong reason indefinitely.
- **I measured the troughs' openings by pixel classification and got nonsense**
  — the outline and the interior are both dark, so "dark and opaque" matched
  the frame as well as the window. Mocking the whole corner at real coordinates
  and looking at it settled the insets in one pass.

### Known gaps

- `levelFlash` is sliced and loaded but nothing plays it. It is the overlay for
  the moment the level changes, and there is no level-up hook in the portrait
  yet.
- The level bar's dividers are the art's own. The client does not know where
  they fall, so a fill does not snap to segment boundaries — it stops wherever
  the fraction lands.

---

## 2026-09-20 (later still) — the frost staff's third spell

Server tests 434 (+6 cases).

### What was wrong

Reported from play: *"why the hell is frost staff's 3 some sort of thorn
instead of the ice beam"*.

`arcane_bolt` was `AbilityType.PROJECTILE` throwing a projectile of kind
`arcane_bolt`, and `PROJECTILE_ART` mapped that to **`thorn`** tinted violet.
Meanwhile its icon was the ice beam and its cast motion was `CASTS.iceBeam`.
So the wind-up said ice beam, the icon said ice beam, and what left the staff
was a violet thorn.

The `iceBeam` sheet is not a projectile and never could be: eight frames of a
lance growing out of the staff and retracting, classed `burst` and anchored at
its source. Flying it across a room would read as the wrong thing entirely.
Everything else about the ability already said beam -- including `pierce=True`
on the projectile spec it no longer has.

### What changed

- `AbilityType.BEAM`, resolved instantly along a `HitboxShape.LINE`. That shape
  already existed in `hitbox.py`, correctly bounded by its length, and had
  never been used by anything.
- Range 420 → **760**. It is the one attack in the game that crosses a room,
  which is what pays for having to aim it; the view is 960 units wide.
- `AbilityDef.muzzle` (52 here): a beam leaves the *tip of the staff*, not the
  middle of the creature holding it. The hitbox starts there and the cast event
  carries the number, so the drawn lance and the line that hit are one line.
- `area` is re-purposed as the beam's half-width (26). A line with no thickness
  is a line nothing is ever quite standing on.
- The boss gets it too -- `resolve_enemy_ability` grew the same branch, so a
  Mirror that takes the frost staff fires the beam rather than nothing.

### Defects found, and the evidence

- **The drawn beam was 110 units shorter than the one that hit you.** I scaled
  the sprite against `frameSize.width`, which is the *untrimmed* source box, so
  it drew 650 units ahead of a 760-unit hitbox. Anything standing in that last
  stretch took damage from a beam that was not there. Solved against the widest
  trimmed frame instead: measured in-game at **737 of 760**, the remainder being
  the art's own margin.

### Corrections to my own work

- **I renamed the ability to "Rimelance" and reverted it.** Sheet 85's icon for
  that slot is explicitly the *arcane bolt* dart, drawn to that name. Renaming
  game content that was not asked for would have left the name fighting the
  icon; only the effect needed to change.
- **The first six tests all failed on the wrong hotbar slot.** The frost staff's
  third spell is key six only when the ember staff is in the other hand; armed
  alone it fills keys one to three. Named `BEAM_SLOT` so the next reader does
  not have to rediscover it.
