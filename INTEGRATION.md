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

## 5. For contributors merging next

- **Logesh:** `main` now contains your companion, weapons, atlases and pipeline. `Bro.ts` and `Weapon.ts` were adapted (position comes from the server, swings come from server events). Rebase `logesh` on `main`; expect conflicts only in `PlayScene.ts`, `constants.ts`, `types.ts`, `EventBus.ts`.
- **Ujesha:** your spatial work is in `apps/server/mirrorbound/agent/spatial`. `ujesha_work` still has the `src/server` rename; either drop that commit or rebase and re-apply on top of `apps/server`. `spatial_features.position()` now also reads `{"x": .., "y": ..}`.
- **Ojas:** implement `TwinController.decide(observation) -> TwinIntent` (see `AI_ARCHITECTURE.md`). `agent/twin/controller.py` (Twin v0) is the reference implementation to replace or extend; the game never calls anything else on the controller.
