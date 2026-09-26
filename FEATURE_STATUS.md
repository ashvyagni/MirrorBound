# Mirrorbound v1.1 — feature inventory and release audit

Reviewed 2026-09-27, after the v1.1 expansion. This is a playable release of the expanded
game, not a claim that every menu, campaign edge case or platform has been fully playtested.
Status below is based on the current executable paths, not on older roadmap text or the
presence of unused art.

**Validation at this revision:** 640 server tests, 54 frontend tests, TypeScript clean. The
whole campaign is walked start-to-finish by an automated test on three seeds
(`tests/integration/test_campaign_walkthrough.py`). Difficulty is measured rather than felt
— see [docs/playtest-results.md](docs/playtest-results.md) — and simulation cost is measured
before and after the larger world in [docs/perf-baseline.md](docs/perf-baseline.md).

## What v1.1 changed

| Area | 0.1.0 | v1.1 |
|---|---|---|
| World | 5 areas joined by portals in a village square | 6 regions crossed on foot, joined at 5 named crossings |
| Villages | Areas of their own, reached by portal | Places **inside** regions; no transition to walk into one |
| Gating | A refusal when you clicked the map | Kell, who will not push off until the wood is quiet |
| Dungeons | 1 archetype, strictly linear | 3 archetypes (combat / puzzle / mirror), branching side rooms, plates and keys |
| Bosses | 1 guardian (a tank state machine) + the Mirror | 3 phased regional bosses + the Mirror, untouched |
| Skills | 12 nodes, all percentages | 20 nodes across 5 branches; everything past tier 1 changes how the game plays |
| Weapons | 4 | 6, plus a three-tier upgrade bench |
| Economy | Gold only; essence and shards unspendable | The bench spends all three |
| Quests | None (an untyped set of flags) | 4 side quests and a 6-page codex |
| NPCs | 4 definitions, reused in both villages | 9 definitions, distinct per settlement, plus 6 villagers walking rounds |
| Music | One mood everywhere | Village / wild / dungeon / boss, eased between |

## Bugs this expansion found and fixed

Named because each one had shipped and none was visible from reading the code:

1. **Respec was admin-gated.** The auth pass wrapped it alongside genuine debug commands, so
   no ordinary player could unlearn a skill tree. 16 tests were reporting it.
2. **The server would not start without Postgres.** `init_db` aborted the FastAPI lifespan,
   so the README's two commands produced no game at all.
3. **`SAVE_VERSION` had no migration path.** Bumping it would have silently deleted every
   save on disk.
4. **Dungeons with a branch could never be completed.** Completion asked for the last room in
   the *list*, and side rooms are appended after the chain — so once the crypt grew a branch,
   the ferryman never untied his boat and the campaign stopped at the second region.
5. **The regional bosses' telegraphs never fired.** `cast_time` was ignored entirely, so a
   1.1-second tell landed with no warning: 0.00 clear rate on the Warden. Fixing it took the
   Glasswork from 0.06 to 0.89 and the Warden to 0.67 without touching a single number.
6. **Keys vanished if you left the room.** They spawned on first visit only, and entering a
   room clears its pickups — losing the key to the only route deeper.
7. **A pond's collision circle sealed the Drowned Flats**, including the player's spawn.
8. **The MIRROR skill branch was invisible** — the tree screen hardcoded four columns.
9. **Riposte hit for triple** and **Iron Skin's last stand never fired for two minutes.**

## Known limits

- **The Mirror is not beaten by the scripted probe**, and was not in 0.1.0 either. It needs
  human play; the bot brings no skills and no potions to it.
- **Early-game difficulty is unmeasured.** The probe is a perfect dodger and the opening
  deliberately sends creatures one at a time, so it reports full health and that figure says
  nothing about a human.
- **`apps/.auth_secret` is tracked in git.** Flagged in the audit, left for the owner: it
  needs untracking *and* rotation, and rewriting history is not a gameplay change.
- **`api/session.py` still holds gameplay rules** that `AGENTS.md` places in `game/`. v1.1
  added its world logic to `game/world/` rather than growing the file, but did not shrink it.

## Repository map

| Area | Responsibility and current implementation |
|---|---|
| `apps/server/mirrorbound/game/core/` | Fixed 60 Hz clock, deterministic IDs and labeled RNG substreams, recursively immutable events. |
| `game/entities/`, `movement/`, `combat/` | Entity dataclasses, input handling, collision, attacks, projectiles, abilities, statuses and damage. |
| `game/dungeon/`, `game/world/` | Seeded room templates, five-area campaign, villages, NPC definitions, checkpoint files. |
| `game/inventory.py`, `loot.py`, `progression/` | Equipment, weapon-derived abilities, drops, purchases' inventory operations, XP and skills. |
| `agent/telemetry/`, `features/`, `player_model/` | Event ingestion and behavioral signals feeding nine player traits. |
| `agent/prediction/`, `patterns/`, `spatial/` | Order-1–3 Markov prediction, confidence/decay, pattern lifecycle, seven heatmap layers. |
| `agent/observation*`, `agent/twin/`, `game/twin_executor.py` | Observation → utility recommendation → validated game execution → measured outcomes. |
| `game/enemy_ai/` | Ordinary enemy state machines and the Mirror's adaptive counter-policy. |
| `api/session.py`, `api/websocket.py` | Session lifetime, tick orchestration, commands and 20 Hz snapshots; the session also contains gameplay rules that should eventually move into `game/`. |
| `contracts/`, `packages/contracts/schema/`, `docs/contracts/` | Pydantic commands, exported JSON schemas, handwritten snapshot documentation. |
| `src/web/src/game/scenes/`, `network/`, `entities/` | Loading, WebSocket transport, snapshot reconciliation and entity presentation. |
| `src/web/src/game/hud/`, `state/`, `ui/` | Canvas HUD/menus, shared bindings and snapshot adapters, React dialogue/naming/character/debug screens. |
| `src/web/src/game/world/`, `animation/`, `effects/`, `audio/` | World presentation, generated atlas metadata, animation selection, VFX, procedural audio. |
| `assets/`, `src/web/public/game/`, `src/web/scripts/` | Source sheets, 146 atlas JSON/PNG pairs, slicing/cursor generation tools. Art on disk is not necessarily active gameplay. |
| `apps/server/tests/`, `src/web/tests/`, `tools/replay/` | Unit/scenario/integration tests, frontend interaction regressions and replay checker. |

## Implemented gameplay

| Feature | What is implemented | Limits / follow-up |
|---|---|---|
| Campaign | Hollow Reach and Emberfall villages; Wakewood Crypt (5 rooms), Ashen Deep (6), Mirror Sanctum (2). | Compact authored campaign; no larger overworld or additional chapters. |
| Dungeon generation | Handcrafted templates selected and decorated by seeded RNG; grove, ruins, crypt biomes. | Deterministic route tests cover both villages across five seeds; combat probes cover three seeds and four encounters. See PLAYTEST_RESULTS.md. |
| Tutorial opening | Start unarmed; guaranteed iron sword at a dungeon entrance; authored first combat room. | Teaching remains mostly implicit; no guided interactive tutorial. |
| Room progression | Combat gates, room clear rewards, backtracking, exit portals and area discovery. | Travel now refuses an area whose prerequisite is not cleared; the chain is the progression. The older behaviour granted skipped areas and their rewards, which made the campaign a menu. |
| NPCs | Elder Mara, Oren, Siv and the Hearth; proximity interaction and server-authored dialogue. | Linear click-through conversations, not branching conversations. |
| Quest state | Elder starts the crypt quest; rescue/completion flags change authored lines. | No general quest journal, side-quest system or branching quest graph. |
| Naming | Player/twin naming, sanitization, dialogue substitutions, rename from Character. | Naming feedback and styling still span React and Phaser. |
| Shops | Gold prices; sword/bow/staves, potions and two relics; affordability and duplicate checks. | No sell/buyback, stock depletion, crafting or shop economy simulation. Purchase range is checked on every request. |
| Hearth | Restores health/mana, clears player statuses, restores an awakened twin and saves. | Default browser identity now persists and appears in the URL; explicit session links select other checkpoints. |
| Movement | Walk/run, normalized directional input, room/decor collision and knockback. | AI uses deterministic cached grid routes around server collision geometry. Presentation prediction can still briefly disagree with authoritative position under latency. |
| Aiming | Mouse-directed attack/cast intent, server-controlled facing and outcomes. | No controller or touch input. |
| Basic combat | Unarmed swipes, three-hit sword chain, bow arrows, explosive fire bolts and slowing frost bolts. | A 60-case repeatable combat probe and browser smoke tests are available. Human difficulty and latency testing remain ongoing. |
| Carried equipment | Four equipable weapons; main/offhand selection and swapping; first pickups equip automatically. | No armor equipment, durability, randomized affixes or expanded weapon progression. |
| Abilities | Sword: Aegis + Shadow Dash. Bow: Arrow Volley + Mending Light. Ember staff: Flame Burst + Flame Pillar. Frost staff: Binding Nova + Arcane Bolt. | Two abilities per weapon; four keys with two weapons. Empty hands provide dash. Free slot reassignment is obsolete. |
| Resource rules | Mana costs/regeneration, cooldowns, dash invulnerability, slow/burn/shield effects, interrupted healing channel. | Flame Pillar resolves after its interruptible wind-up; burn can finish enemies through the normal reward pipeline. Bespoke visual feedback remains uneven. |
| Potions | Health/mana potions, timed drinking, shared cooldown, consumption after completion. | F/G are direct health/mana, R cycles and H uses the dial. Legacy conflicting saved bindings migrate. |
| Damage mitigation | Shield and nearby twin PROTECT, capped additive reduction; player stat modifiers. | Only an available twin can target, collide, attack or protect. |
| Enemies | Bone Knight, Hollow Archer, Gloom Hound, Mire Slime, Ash Acolyte, Crypt Brute, Husk Scarab, Fen Spitter, Bitterroot Sprout, Kiln Shardling; elite variants; the practice dummy. | Thirteen archetypes in `ARCHETYPES`, each with a dedicated room template where it leads. |
| Enemy behavior | Aggro/threat targeting, telegraphs, melee charges, ranged spacing, strafing, darting, retreat, crowd separation. | Deterministic obstacle routing and dormant-twin exclusion are implemented; crowd tuning can continue. |
| Guardian | Ashen Warden at the end of Ashen Deep. | Its underlying policy is the tank state machine, not a separate multi-phase encounter. |
| Mirror | Three health phases, melee/ranged attacks, telegraphed nova; kite, rush, AoE dodge, riposte, predictive dash shots, zone denial. It now spawns **armed with the weapon the player is carrying** and draws it from the blackened sheets — `armed_with` existed and was tested but was only ever reached by the sandbox's `CONFIGURE_BOSS`, so until now every campaign Mirror fought with its own archetype. An explicit sandbox loadout still wins. | Adaptive mechanics exist. Riposte has a 0.30-second minimum wind-up. The baseline unskilled scripted bot struggles with the final fight; see measured results. |
| Twin transformation | Companion becomes dormant on the boss-room threshold; server emits transformation event; client has hatch animation. | Victory restores the companion before checkpointing, clears twin_taken and records twin_restored; reload does not take it again. |
| Loot | Seeded gold/essence/shards/potions/weapons/relics, pickup scatter/magnetism and contact collection. | Contact collection/travel is described by WALK OVER / WALK INTO; E labels only NPC talk. |
| Loot ownership | Weapons go to the collecting player/twin; shared resources go to player; duplicates become shards. | Both give/equip and request-back move inventory ownership. Empty-handed twins use bare hands, including after reload. |
| Progression | XP, levels, skill points, 12 nodes across Mobility/Combat/Magic/Survival. | No level-cap/endgame progression loop established. |
| Respec | Village-only skill refund with derived-stat recomputation. | Availability retains authoritative room safety through lite snapshots. |
| Relics | Ember Heart (+spell damage), Wolf Fang (+weapon damage), Mirror Eye (+twin learning). | Three passives only; essence/shards have no spending/crafting sink yet. |
| Death/victory | Timed player respawn at room entrance, surviving enemies persist; twin down/recovery; victory state and replay/restart commands. | Full React victory statistics/restart buttons are no longer mounted; canvas flourish and Enter restart remain. |

## Implemented AI and infrastructure

| Feature | Current implementation | Limits / follow-up |
|---|---|---|
| Player telemetry | Event bus → buffered collector → action, movement, combat and spatial features. | Audit real event fields against consumers: twin risk imitation expects `healthFraction` on attacks, which the attack producer does not emit. |
| Player traits | Nine EWMA traits with confidence, sample counts and trend, including combo dependency. | Player-trait confidence does not decay with idle time; recency weighting is per observation. |
| Action prediction | Order-1–3 Markov models, evidence-based confidence, longer-context backoff, 30-second weight half-life and pruning. | Only token sequences, not a general planner or learned world model. |
| Pattern recognition | Confidence threshold, detected/lost transitions, staleness tracking and bounded recent history. | Updated through events; idle periods without events do not advance the pipeline's reported clock. |
| Spatial model | Combat, retreat, dodge, spell, melee, high-risk and death heatmaps with decay. | Shared coordinate layers span rooms; room-aware spatial modeling would improve boss interpretation. |
| Twin learning | Nine style dimensions; imitation plus own combat outcomes; confidence decay and readable lessons. | Model is in memory only. Weapon scoring does not distinguish fire from frost preferences. |
| Twin choices | FOLLOW, PROTECT, INTERCEPT, FLANK, ATTACK, ASSIST, RETREAT, DISTRACT, REPOSITION, EXPLORE; utility scores, hysteresis and posture momentum. | No manual tactical-order system; T currently sends an incomplete request. |
| Twin execution | Validated targets/equipment, movement, attacks, cover fire, loot exploration and outcome reporting. | No independent full spell-casting policy or pathfinding. |
| Authority | Python owns gameplay; client sends intents/commands and renders snapshots. | Existing gameplay in `api/session.py` exceeds AGENTS.md's intended thin API layer; extraction remains work. |
| Determinism | Seeded per-system RNG, stable IDs, immutable event payloads, fixed step, whole-session tests. | Passing tests cover tested inputs; do not assume all checkpoint/reconnect/restart replay paths are covered. |
| Networking | JSON WebSockets, 20 Hz snapshots, lighter frequent packets, reconnect/backoff and silence watchdog. | A reconnect creates a new simulation from a checkpoint, not an exact in-memory resume; replacement sockets are isolated from old simulation output; the newest tab owns the session. |
| Persistence | Versioned JSON checkpoint files and atomic replacement; progression/equipment/campaign restored; per-slot learned model; save slots with an `auto` slot and up to twelve named ones. Older saves are migrated forward rather than discarded (`save.py::migrate`). | No exact combat restore or cross-device sync. |
| Replay | Tick-stamped JSONL commands/inputs/events and first-divergence CLI. | Metadata lacks checkpoint initial state; restarting/reconnecting may overwrite recordings with the same session/seed. Paused input ordering deserves dedicated tests. |
| Contracts | Pydantic input validation, TypeScript types and generated input schemas. | Snapshot types/documentation are manually maintained; no automated end-to-end schema drift check in CI. |
| Tests | Broad server units, scenarios and deterministic sessions; frontend NPC/dialogue regressions added here. | No checked-in browser automation suite or GitHub Actions workflow. |
| Debug tools | F3 traits/predictions/utilities/heatmaps/boss counters; console spawn/travel/equip/use/swap/respec/save/restart. | Developer commands are not separated from a production build/server policy. |

## Presentation and user interface

| Feature | Status |
|---|---|
| Character/enemy art | Player directional movement, twin art, weapon overlays, enemy family atlases, Mirror animations; enemies loaded per room. An enemy the server armed with a player weapon (`enemies[].weapon`) draws that weapon from the blackened sheets, and its projectiles match; the bundle is fetched the first time anything in the room is armed. |
| World art | Drawn flora/stone/ruins/crypt/buildings/doors/lights/NPC atlases with procedural fallbacks; consistent light direction, shadows and depth sorting. Floors are drawn tiles (sheets 82–84, one atlas per biome) composed in three passes — hashed tile variants, irregular fringes where two materials meet, and slow mottling across the room — so a floor does not read as a grid of stamps. The procedural painter remains as the fallback for any biome with no sheet. |
| Living environment | Sway, torches, particles, water, motes/embers and ambient creatures. Cosmetic randomness is separate from game truth. |
| Combat feedback | Attack/cast animations, projectiles, hit/death feedback, damage numbers, shake and boss effects. Some sheets remain unused and some server abilities lack bespoke feedback. |
| HUD | Canvas portrait/vitals, weapon/potion hotbar, cooldown rail, minimap, settings button and prompt. Missing or incorrect feedback is listed below. |
| Menus | Canvas inventory, skills, world map, settings, rebinding, pause statistics and console. React dialogue, naming, character and AI debug. |
| Settings | Persisted volumes, zoom, quality, shake, damage numbers, twin thoughts and debug; runtime updates. Stored values are merged without robust validation. |
| Audio | WebAudio-generated music/effects, gesture unlock, master/music/SFX volume control. No voice acting or recorded soundtrack. |
| Fullscreen | Canvas settings button and event wiring exist. F is a potion key, not fullscreen. |
| Asset tooling | Atlas slicing, anchor/body metadata, generated TypeScript and cursor tooling. Referenced generated atlas files checked present. |
| Accessibility/platforms | Keyboard movement and shortcuts, readable DOM dialogue semantics. Full keyboard/focus management, screen-reader canvas alternatives, controller/touch support and localization are absent. |

## Fixed for this release

1. **NPC prompt flashing:** `Bridge` discarded NPCs on every lite snapshot. Cache detail data
   until replaced, clear it when the room changes, and preserve nearby portal data as well.
2. **Prompt shown where talk did nothing:** HUD used `radius + 48`, React used `radius`, Python
   accepts `radius + player.radius`. Shared nearest-target selection now matches the server's
   boundary; Python still validates each command.
3. **Bottom-right prompt positioning:** retained the existing working-tree correction to use
   the play camera's visible world rectangle instead of unadjusted scroll under zoom. Added
   zoom-1/2/3 regression tests.
4. **Dialogue skipping its opening on return:** line state now belongs to a conversation panel
   that unmounts when closed. Reopening starts from its first server-provided line.
5. **Obsolete ability selector crashing a tick:** Character now displays weapon-derived abilities;
   legacy `SET_ABILITY_SLOT` requests receive `ACTION_REJECTED` instead of calling removed code.
6. **Missing transformation animation trigger:** `TWIN_TAKEN` now passes the client event filter,
   with an integration assertion on the actual outgoing snapshot.

These changes cross frontend and API integration boundaries. They do not move authoritative
combat, movement, purchases or quest outcomes into the browser, or make the agent mutate game state.

## Gameplay hardening pass (2026-09-20)

All ten requested areas received implementation or a concrete testing pass:

1. Canvas and React menus share one modal coordinator. Switching does not resume the world;
   closing restores the prior manual-pause state, including commands awaiting a snapshot.
   Keyboard input is muted/reset and rebinding removes the old Phaser key registrations.
2. Gameplay toasts are mounted, announced through aria-live, deduplicated and expired.
   Refused abilities/items/companion requests now explain why; save/quest/transfer notices display.
3. A default session is saved in browser storage and reflected in the URL. Reload keeps it;
   explicit session/seed URLs retain their existing semantics. Newest-tab ownership prevents
   an older simulation sending snapshots into its replacement connection.
4. The twin's availability predicate gates enemy targeting, projectiles, crowd collision,
   attacking and PROTECT. Dormant companions cannot absorb projectiles or shield the player.
5. Full-room data is retained by room ID. Minimap positions update on lite packets, terrain
   changes with the room seed, and campaign/respec availability no longer flips between packets.
   Pause labels now report kills and cleared rooms rather than incorrectly naming hits/potions.
6. F/G drink health/mana, R/H operate the dial, and T asks the game for three seconds of FOLLOW.
   Menus explain unavailable twins; saved duplicate bindings migrate. E is no longer shown as
   the second weapon hand's shortcut.
7. NPC prompts show the talk binding; portals and loot describe contact actions.
8. Purchases revalidate the NPC distance while paused too. Giving and requesting twin weapons
   are transfers, repair both equipment slots, and survive save/reload. Character exposes Give.
9. Victory awakens and heals the twin before saving, restores FOLLOW and records restoration.
10. Flame Pillar uses its 0.25-second interruptible channel; cast effects occur on completion.
    Movement snapshots publish effective rates for slow/drink/channel prediction. AI routes
    around props, dash/knockback movement uses substeps, scaled foundation footprints drive
    physics/debug drawing, and burn can award a final kill. Mirror riposte gives at least
    0.30 seconds to react. The repeatable combat and route test results are in
    [PLAYTEST_RESULTS.md](PLAYTEST_RESULTS.md).

These changes cross client rendering/input, contracts, API orchestration, game simulation and
save boundaries. Vendor and companion transaction rules were extracted into game/world/actions.py;
Python still owns outcomes and no agent directly mutates game state.

## Remaining product and engineering work

- **Difficulty tuning:** the scripted player is a baseline, not a human playtest population.
  Compare learned builds, two-weapon combinations, potions, latency and full campaign pacing.
  The Mirror remains substantially harder than the opening/Warden probes.
- **Presentation:** some abilities lack bespoke VFX; canvas keyboard/focus accessibility,
  end-screen statistics/buttons and controller/touch support need their own product pass.
- **Persistence/replay scope:** checkpoints preserve progression, not learned models or exact
  fights. Recording metadata lacks checkpoint initial state; same session/seed recordings
  overwrite earlier ones and paused command ordering is not fully represented.
- **Architecture/deployment:** more gameplay remains in api/session.py than the intended thin
  transport layer. Production auth/origin/rate/debug-command policy, packaging and CI are absent.
- **General polish:** legacy unmounted React menus, settings validation, asset load budget,
  cross-browser testing and a code-license decision remain.

## Not implemented, versus deliberately out of scope

Missing product/gameplay work: crafting/resource sinks, armor and richer equipment, selling,
side quests/journal, branching dialogue, more campaign content, richer tactical twin commands beyond
the implemented three-second regroup, durable learned-model saves, save-slot management, full end-screen flow,
controller/touch support, localization, accessibility pass, CI/browser tests, executable packaging
and hosted deployment. These are options for future work, not promises that they are all necessary.

Deliberately excluded by AGENTS.md: multiplayer, Unity/Godot/Unreal, cloud AI or an LLM in the
combat loop, per-player neural training, a traditional RL pipeline, full ECS, microservices,
Redis/Kafka/Postgres/Kubernetes and a custom binary network protocol. They are not missing
requirements for this slice.

## Validation for the initial release commit (historical)

- Server: **299 tests passed**, including whole-session determinism, all four NPC roles at the
  advertised range boundary, paused shopping, legacy-command rejection and transformation delivery.
- Frontend: **10 regression tests passed**; typecheck, ESLint and production build passed.
- Live browser: isolated seeded server fixture placed the test player by Oren. E opened dialogue;
  clicking advanced a line; buying a sword changed 500 gold to 455 and showed Owned; Escape closed;
  reopening restored the first line. This was an interaction smoke test, not a full campaign playthrough.
- Replay: a fresh 900-tick seed-2024 run reproduced **all 114 recorded events exactly**.
- Repository scan: no missing generated atlas JSON/PNG references and no game-layer imports of
  agent/API/FastAPI. Existing session-layer gameplay ownership debt is documented above.

## Validation for the gameplay hardening commit

- **338 server tests** and **24 frontend tests** pass; TypeScript, ESLint and production build pass.
- Route tests cover both villages at seeds 1, 5, 19, 42 and 2024, plus a deterministic blocked route.
- Isolated integration tests cover vendor range, dormant twin exclusion, transferred/empty-handed
  equipment saves, timed regroup, ending restoration, delayed/interrupted damage and collision substeps.
- The 60-case combat probe and its reproducible invocation are recorded in PLAYTEST_RESULTS.md.
