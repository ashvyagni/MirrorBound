# Integration log

How the contributor branches were audited and folded into `main`, what was kept,
what was changed, and why. Read this before merging another branch.

## 1. Repository audit (2026-09-18)

Branches at audit time:

| Branch | Author | Head | State vs `main` |
|---|---|---|---|
| `main` | ashvyagni | `9f47c0f` | Integration branch: Python server + adapted client |
| `logesh` | medriid (Logesh) | `a7389c0` | 2 commits **not** in main (`cb91113`, `a7389c0`) |
| `ujesha_work` | Ujesha Sivaramakrishnan | `8977550` | 2 commits **not** in main (`61a38cf`, `8977550`) |
| (none) | Ojas | — | No branch present. Agent decision layer is unowned in-repo. |

### Contributor -> branch -> systems -> assets -> status

**Logesh (`logesh`)** — client foundation and all hand-made art.

| System / asset | Files | Status before | Integration |
|---|---|---|---|
| Vite + React 19 + Phaser 4 client | `src/web/*` | Merged (older commit `7d351db`) | Kept |
| Goat character, state machine, Intent input | `entities/Goat.ts`, `state/StateMachine.ts`, `input/*` | Merged, adapted to top-down by ashvyagni | Kept, re-scaled |
| Asset pipeline (morphological sheet slicing, chroma keying, body ratios) | `scripts/atlaslib.py`, `scripts/sheets.py`, `scripts/build_atlas.py` | **Unmerged** | Ported as-is |
| Companion "Bro" sprite + follow/emote logic | `public/game/bro/*`, `entities/Bro.ts`, `animation/broClips.ts` | **Unmerged** | Ported; now renders the server-driven twin |
| Weapon swing sheets: sword A/B/C combo, bow, fire staff, ice staff | `public/game/{swordA,swordB,swordC,bow,fireStaff,iceStaff}`, `entities/Weapon.ts`, `animation/weaponClips.ts` | **Unmerged** | Ported; swings now triggered by server attack events |
| Goat atlas with lifted "swirl" FX + body ratio | `public/game/goat/*`, `animation/goatAtlas.generated.ts`, `animation/fx.ts` | **Unmerged** (main had older atlas) | Ported (superset of main's) |
| Fullscreen toggle, supersampled render scale | `createGame.ts`, `GameMount.tsx` | **Unmerged** | Ported |
| Loadout / Companion / Controls panels, DevTools, AnimatedMark logo | `ui/*` | **Unmerged** | Logo + DevTools kept; loadout/companion panels replaced by the in-game inventory and twin HUD |
| Side-view platformer physics (gravity, jump, coyote time, endless ground) | `Goat.ts`, `PlayScene.ts` on `logesh` | Unmerged | **Not adopted** — the game is top-down; main's adaptation is the base |
| Source art | `assets/*.jpg|png` | Unmerged | Ported (needed by `npm run assets`) |

**Ujesha (`ujesha_work`)** — deterministic core + probabilistic player model.

| System | Files | Status before | Integration |
|---|---|---|---|
| EventBus, DeterministicRNG, SimClock, IdAllocator | `game/core/*` | Merged | Kept |
| Trait model, n-gram/Markov predictor, telemetry collector, pipeline | `agent/{player_model,prediction,telemetry,features}`, `agent/pipeline.py` | Merged | Kept |
| Spatial heatmaps: `GridHeatmap`, `SpatialModel`, zone features + 4 test files | `agent/spatial/*`, `agent/features/spatial_features.py` | **Unmerged** | Ported into `apps/server`; `position()` also accepts `{"x","y"}` dicts because main's combat events already publish that shape |
| Rename `apps/server` -> `src/server` | whole tree | **Unmerged** | **Not adopted** — `AGENTS.md`, tests and tooling all reference `apps/server`; a tree-wide rename would conflict with every other change. Ujesha's branch will need `git mv` reverted or a rebase; see section 4 |

**ashvyagni (`main`)** — server game skeleton and client/server wiring.

| System | Files | Verdict at audit |
|---|---|---|
| GameState, entities, movement, collision | `game/state.py`, `game/entities/*`, `game/movement/*` | Working skeleton. Kept and extended |
| Combat, weapons, abilities, hitboxes | `game/combat/*` | Data-driven, but abilities were Dash/FireBurst/Heal/Shield, no mana, dash ignored facing. Extended |
| Enemy archetypes + AI | `game/entities/enemy.py`, `game/enemy_ai/*` | **Crashed on tick 1**: `EnemyState.KEEP_DISTANCE` does not exist (it is an `EnemyBehavior`), and `Vec2.multiply` does not exist. Enemies also never dealt damage and never fired. Fixed |
| Dungeon generation + templates | `game/dungeon/*` | Generated room order only; rooms were empty rectangles and never transitioned. Extended |
| Twin + `BasicFollowController` | `entities/twin.py`, `agent/basic_controller.py` | "Follow, and walk toward nearest enemy"; the twin never actually attacked. Replaced by Twin v0 (utility AI), interface preserved |
| API / WebSocket / session | `api/*` | Worked, but `hash(session_id)` seeded the run (non-deterministic across processes, violates AGENTS.md) and the crashed loop task was silently swallowed. Fixed |
| Client snapshot rendering | `PlayScene.ts` | Enemies/twin drawn as circles from server; player simulated locally in Phaser (two simulations). Rewritten |
| `FABLE5_HANDOFF.md` | — | Claimed "What currently works" was not manually tested (it says so in section 15). Superseded by `README.md`, `ARCHITECTURE.md`, `GAMEPLAY.md`, `AI_ARCHITECTURE.md` |

### Verified at audit

- `apps/server`: `pytest -q` -> 75 passed (Ujesha's modules; zero tests covered the game systems).
- `src/web`: `tsc -b --noEmit` clean.
- Running the app: black 1280x960 room, goat drawn 190 world units tall in a 960x540 view, no enemies or twin (server loop dead).
- `pyproject.toml` demanded Python `>=3.14`; nothing in the code needs it. Relaxed to `>=3.12`.

## 2. Decisions

1. **Keep Phaser, do not switch to PixiJS.** The directive's preferred stack lists PixiJS, but the whole client, the asset pipeline and Logesh's ongoing work are Phaser. Phaser already provides the sprite batching, camera, particles and tilemaps a Pixi rewrite would have to rebuild. React owns HUD/menus; Phaser owns the world. Same separation the directive asks for.
2. **Server-authoritative, single simulation.** The client no longer runs its own player physics. It predicts the player's own movement locally for responsiveness and reconciles to server snapshots; every other entity is interpolated from snapshots. Damage, hits, loot, cooldowns and AI happen only in Python.
3. **Keep `apps/server` and `src/web` where they are.** Moving either tree would put every contributor into conflict. Documented as a known layout quirk.
4. **Art direction: painted, side-view characters on a top-down floor.** The team's art (goat, companion, weapon sheets) is painted and side-view. That reads fine on a top-down floor (the "Hyper Light Drifter" convention). Environment and enemy art is generated procedurally at runtime in a matching soft-painted style (see `ASSET_LICENSES.md`). No third-party asset packs were downloaded in this pass: external downloads need explicit sign-off and mixing a pixel-art pack with painted characters would break the coherence rule. Swapping in a CC0 pack later is a texture-key change in `TextureFactory.ts`.
5. **Facing comes from movement, not the mouse.** Attacks and abilities fire in the player's facing direction. Mouse is for UI only.

## 3. How the port was done

- Logesh's files were copied from `origin/logesh` (not merged) so that his platformer `PlayScene`/`Goat` did not overwrite main's top-down versions. Git history for those files is preserved on his branch; this log records provenance.
- Ujesha's spatial commit `61a38cf` was applied to `apps/server` with paths rewritten; her tests were kept verbatim.

## 4. What landed on `main` in this pass

Commits, in order: contributor ports (Logesh client assets/pipeline; Ujesha spatial), then
`feat(game)` (directional combat, abilities, weapons, enemies, dungeon, progression, inventory),
`feat(ai)` (Twin v0, style learning, Mirror boss), `feat(api)` (session rewrite, contracts, replay),
`feat(client)` (world renderer, entity views, HUD, menus, audio), then tuning and docs.

Verified by hand in the browser: load, movement and facing, camera, room transition through the
gate, sword combo, all four abilities, enemy kills, loot pickup, level-up, room clear, twin
deciding and fighting on its own, inventory/skills/settings/pause/controls screens, F3 overlay.
Automated: 181 server tests (game systems, AI, contracts, whole-run determinism), strict
TypeScript, production build.

Known limitations, honestly:

- Enemy and environment sprites are procedurally painted; a hand-drawn set would look better.
- No Playwright suite: adding it means downloading browser binaries, which needs sign-off. The
  seams it would test (movement, attack, abilities, pause, inventory) are exercised by the Python
  integration tests plus manual browser QA.
- Key rebinding is not implemented; the binds are displayed but fixed.
- The player sprite is side-view (goat); vertical facing is shown by tilting the weapon swing.
- Balance is a first pass (twin hits at 60%, enemy health raised once).

## 5. Second pass (2026-09-19)

The remote had moved since the first pass. Re-audited before touching anything:

| Branch | Author | Head then | Not in `main` |
|---|---|---|---|
| `Ojas` | Ojas Kulkarni | `ae78911` | **5 commits**, based directly on `main`'s head |
| `logesh` | medriid (Logesh) | `83a5ce1` | **20 further commits**: 94 built atlases, 47 enemy sheets, a gear screen, rebindable keys, a minimap |
| `ujesha_work` | Ujesha Sivaramakrishnan | `bff724b` | **1 further commit**: pattern detection |

### Ojas — merged, not ported

`Ojas` branched from `main`'s head, so it fast-forwarded. His five commits are on `main` with
their original authorship and messages. Nothing of his was rewritten. What he added:
`preferred_range`/`spell_preference` feeding `decide()`, autonomous twin weapon-switching
(`desired_weapon` on the intent, validated by the executor before it ever equips), decision
momentum driven by `seconds_since_decision`, a real `combo_dependency` trait, and tests for the
four previously untested Mirror counters.

His own note said the melee half of `_preferred_weapon()` was unreachable through play, because
`iron_sword` was not in `WEAPON_DROPS`. That is now fixed in `game/loot.py`: the sword drops, and
the "already owned" filter considers the twin as well as the player, so a sword the player carries
is still worth dropping for a twin that has none.

### Ujesha — ported by hand again

`bff724b` is written against that branch's `src/server` layout. `agent/patterns/*` and its five
test files came across verbatim; `pipeline.py` and `telemetry/collector.py` took her versions.
Her `agent/__init__.py` change was **not** taken: it re-exports `PatternDetector` eagerly, which
reintroduces the circular import `main` broke deliberately. Importing the submodule costs nothing.

### Logesh — art taken, client not

His branch is still a standalone client with its own simulated state. The art came across and the
simulation did not. 94 atlas folders (up from 8), all byte-verified against the source blobs, plus
his source sheets and the asset pipeline — including the four bug fixes his `context-logesh.md`
records, which were upgrades over the older copies `main` held.

What was taken: every enemy sheet (11 families × idle/walk/alert/attack), `goatFront`/`goatBack`
for real directional facing, the cast and spell sheets, and the item/skill-node atlases for the
React screens.

What was not, and why:

- **His HUD** (`hud/*`, `Panel.ts`, `Minimap.ts`, `MapScreen.ts`) is drawn in canvas because his
  branch has no DOM beside the game in fullscreen. `main`'s HUD is React over a `.viewport`
  wrapper that already survives fullscreen. The atlases are on disk and generated; a later pass
  can use them from the DOM as `Portrait`/`AtlasIcon` already do.
- **His Loadout / Controls / Companion sidebar** was removed by explicit team decision. The
  information lives in the HUD and the Character screen now.
- **His local `Vitals`/`Loadout`/`Cooldowns`** are two simulations' worth of the same rules. The
  server owns them.
- His two-carried-weapons rule was the one thing that genuinely needed a server change. It got
  one: `Inventory.offhand_weapon` plus `SWAP_WEAPON`.

### Decisions added this pass

6. **The campaign is five authored areas, not a generated world.** A bigger world would not carry
   Player + Twin + Mirror any better, and the directive's own rule prefers the compact authored
   one when it delivers the intended experience.
7. **The twin is found, not issued.** It is dormant until two rooms into the first dungeon. This
   is what makes the tutorial order work (move, fight, *then* meet it) and turns the rescue into
   an event rather than backstory.
8. **Checkpoints save progression, not a frozen simulation.** Restoring half a fight is a bigger
   promise than the game needs to make. The learned player model is not saved either: a model
   restored out of its own run would be a different claim than "the twin learned this from you".
9. **One home for damage reduction** (`game/combat/mitigation.py`) with a hard 60% ceiling, so no
   combination of sources ever approaches immunity.

### Known limitations after this pass

- **First load is 65 MB** if every enemy atlas loads at boot. Per-room loading from the room
  snapshot's `enemySprites` is the fix and is in progress; the number to watch is in
  `PreloadScene`'s console line.
- The Mirror still has no drawn sheet and uses the procedurally painted fallback. `shardling` is
  the obvious candidate when someone wants to wire it.
- Key rebinding is still display-only. Logesh's `state/Keybinds.ts` is the implementation to port.
- `spitter`, `sprout`, `shardling` and the shield/parry sheets are on disk and addressable but
  have no server concept behind them. Adding one is an `EnemyDef` row plus a template.
- Balance across the five areas is a first pass, tuned by playtest rather than by simulation.

## 6. Third pass (2026-09-19)

Re-fetched before touching anything. `Ojas` and `ujesha_work` had not moved and were already in
`main`. `logesh` had **four further commits** (`83a5ce1..698e5f4`).

### Logesh -- the boss finally has a face

36 new atlas folders, byte-verified against his blobs, plus the ten source sheets they are built
from and his two pipeline changes (`hue_target`/`desaturate` for the corrupted set, `strip_grid`
for the six sheets that came back with cell borders drawn in). `npm run assets` reproduces all of
them, which is why the pipeline came across with the artwork rather than after it.

- **Seven Mirror sheets** close the largest limitation the last pass recorded. The boss is no
  longer the procedurally painted fallback. Its six map onto the same four states every other
  family uses (`drift` is the walk, `cast` is the alert, `strike` is the attack), so nothing about
  loading, scaling or state resolution is special-cased for it. `mirrorDeath` is the one drawn
  death in the game; `mirrorHurt` is on disk and unused, because the white flash every enemy
  shares already reads and a second reaction layer would fight it.
- **`mirrorBolt` and `shardRing`** are its projectile and its nova. Both load with the boss rather
  than at boot.
- **34 `*Dark` sheets** -- the corrupted arsenal -- are on disk and unused. Wiring them means
  inventing "what is the Mirror holding" server-side, which the boss has no concept of. They
  regenerate from the same sources as the player's own weapons, so they cannot drift.
- His `state/Keybinds.ts` was **taken**, adapted to main's control set. See below.

### What this pass fixed, and why each was worth it

| Found | Why it mattered | Fix |
|---|---|---|
| `load_save` defaulted to `False` and the WebSocket never passed it | The checkpoint system was **write-only**. Every village and every hearth wrote a save nothing ever read; closing the tab lost the run | A real connection resumes; `?seed=` still starts over, because a seed and a resume cannot both apply |
| `CampaignState.flags` started as `{"quest_active"}` | Every `intro` line in the game was unreachable, including the only place the player's chosen name is spoken back to them | Flags start empty; the elder telling you about the crypt is what sets it |
| Nothing ever revealed an area | The elder names the Wakewood Crypt and the map had never heard of it -- the opening was a dead end | Standing in a village reveals the areas currently open to you; gated ones stay unknown |
| A dormant twin was still drawn | It trailed the player from the opening village, so the rescue two rooms into the crypt was a scene about someone already standing there | `PlayScene` destroys the view while dormant |
| Any combat room could roll the five-enemy sanctum | The tutorial's first fight is taken alone, at level one, before the twin exists to help. Rolling a brute into it is the difference between a tutorial and a wall | The first combat room of a `tutorial` area is authored (`TUTORIAL_COMBAT`); everything after it still rolls |
| `write_save`'s atomic rename failed under a file lock | This repository lives in a OneDrive folder. A checkpoint was lost roughly one run in three, and the only trace was a server log line | Bounded retry with backoff around `os.replace` |
| 65 MB first load | Eleven enemy families at boot for rooms that draw a few | `EnemyAtlasLoader` fetches per room from `RoomFull.enemySprites`. Boot is 28 atlases; the Mirror's own eight arrive in 182 ms when its arena opens |

### Features finished

- **Character screen (`C`)**, **world map (`M`)**, **dialogue**, **naming** -- all reading the
  authoritative snapshot, every change a command the server may refuse.
- **Key rebinding.** Logesh's table, his conflict rule (steal rather than refuse, and say which
  row lost the key), his reserved set. One table serves both halves of the input: Phaser samples
  it for movement and combat, React for menu and world keys, both on Phaser's key codes. A rebind
  takes effect on the next frame, not the next scene restart. Every key cap in the UI now renders
  from the table, so a rebound key is the key the HUD names.
- **Respec.** The whole tree at once, in a village, out of combat -- the only refund that cannot
  produce a build the tree's own prerequisites forbid.
- **Habits in `F3`.** Ujesha's `PatternDetector` output was already in the snapshot and shown
  nowhere. It is the most legible evidence that the game reads you.

### Verified by playing it

Fresh session, clean load, zero console errors. Named the character; Mara's opening plays with
the name in it and sets the quest. Travelled to the crypt from the map, cleared the authored first
fight, walked into room 2 and the twin woke, was named, and started fighting on its own with its
reasoning in the HUD. Rebound "move up" to `T`: `W` stopped moving, `T` moved, no restart; Reset
put it back. Respec was correctly refused in a boss room ("only in a village"). In the Mirror
Sanctum the boss drew from its own sheets, and after a repeated two-swings-then-dash the detector
held `sword_finisher -> sword_strike -> sword_strike` at 0.72 and the Mirror went to phase 2, then
to "melee dependency 0.87@1.00: keeping range" and kited. Killed it; the run completed.

Automated: 282 server tests, strict TypeScript, ESLint, production build.

### Known limitations after this pass

- The corrupted `*Dark` arsenal is drawn and unused (above).
- `spitter`, `sprout`, `shardling`, `hatchCrack`/`hatchBurst` and the shield/parry sheets are on
  disk and addressable with no server concept behind them. Each is an `EnemyDef` row plus a
  template.
- Balance across the five areas is still tuned by playtest rather than by simulation. The opening
  is now survivable at level one; the later areas were not re-tuned this pass.
- No Playwright suite, for the reason section 4 gives.

## 7. For contributors merging next

- **Logesh:** all 130 of your atlases, your source sheets and your pipeline are on `main`. The
  Mirror now uses your seven sheets -- it was the last enemy drawn procedurally, and its death is
  the only drawn one in the game. `state/Keybinds.ts` is in, adapted to main's control set; your
  conflict rule and reserved set came across unchanged. Still not taken: your canvas HUD, for the
  reason in section 5. Two things worth your time next: `screen-frame.png` as a closed rectangle,
  and a decision about the corrupted `*Dark` arsenal -- it is drawn and on disk, but the boss has
  no server-side notion of holding a weapon, so wiring it is a design call rather than a wiring
  one.

- **Ujesha:** your spatial work and your pattern detection are both in
  `apps/server/mirrorbound/agent/`. `ujesha_work` still carries the `src/server` rename; drop that
  commit or rebase onto `apps/server`. Note that `agent/__init__.py` on `main` is intentionally
  docstring-only — import submodules directly.

- **Ojas:** your five commits are on `main` unchanged, by fast-forward. The structural gap you
  documented in `_preferred_weapon()` is closed from the loot side, so the twin can now genuinely
  own a melee weapon and the melee term in your scoring is reachable. Two things now feed you that
  did not before: Ujesha's `PatternDetector` output is in the pipeline snapshot
  (`patterns`, `pattern_events`), and the twin has a real dormant/awake lifecycle, so `decide()`
  is never called before the twin has been found.
