# Mirrorbound 0.1.0 — feature inventory and release audit

Reviewed 2026-09-19. This is the initial playable development release, not a claim that every
menu, campaign edge case or platform has been fully playtested. Status below is based on the
current executable paths, not on older roadmap text or the presence of unused art.

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
| Dungeon generation | Handcrafted templates selected and decorated by seeded RNG; grove, ruins, crypt biomes. | Balance and navigability need more multi-seed playtesting. |
| Tutorial opening | Start unarmed; guaranteed iron sword at a dungeon entrance; authored first combat room. | Teaching remains mostly implicit; no guided interactive tutorial. |
| Room progression | Combat gates, room clear rewards, backtracking, exit portals and area discovery. | Map travel intentionally auto-completes skipped prerequisites and grants their rewards. Decide whether that shortcut belongs in the public gameplay design. |
| NPCs | Elder Mara, Oren, Siv and the Hearth; proximity interaction and server-authored dialogue. | Linear click-through conversations, not branching conversations. |
| Quest state | Elder starts the crypt quest; rescue/completion flags change authored lines. | No general quest journal, side-quest system or branching quest graph. |
| Naming | Player/twin naming, sanitization, dialogue substitutions, rename from Character. | Naming feedback and styling still span React and Phaser. |
| Shops | Gold prices; sword/bow/staves, potions and two relics; affordability and duplicate checks. | No sell/buyback, stock depletion, crafting or shop economy simulation. Server purchase proximity needs tightening. |
| Hearth | Restores health/mana, clears player statuses, restores an awakened twin and saves. | Checkpoint durability depends on a stable session ID. |
| Movement | Walk/run, normalized directional input, room/decor collision and knockback. | AI movement steers directly; no obstacle-routing pathfinder. Presentation prediction can disagree temporarily with collision. |
| Aiming | Mouse-directed attack/cast intent, server-controlled facing and outcomes. | No controller or touch input. |
| Basic combat | Unarmed swipes, three-hit sword chain, bow arrows, explosive fire bolts and slowing frost bolts. | Needs sustained balance, hit-feel and latency playtesting. |
| Carried equipment | Four equipable weapons; main/offhand selection and swapping; first pickups equip automatically. | No armor equipment, durability, randomized affixes or expanded weapon progression. |
| Abilities | Sword: Aegis + Shadow Dash. Bow: Arrow Volley + Mending Light. Ember staff: Flame Burst + Flame Pillar. Frost staff: Binding Nova + Arcane Bolt. | Two abilities per weapon; four keys with two weapons. Empty hands provide dash. Free slot reassignment is obsolete. |
| Resource rules | Mana costs/regeneration, cooldowns, dash invulnerability, slow/burn/shield effects, interrupted healing channel. | Flame Pillar's configured cast time does not delay its damage; ability feedback coverage is uneven. |
| Potions | Health/mana potions, timed drinking, shared cooldown, consumption after completion. | Default F binding collides with potion-dial use; H works for the selected dial potion. |
| Damage mitigation | Shield and nearby twin PROTECT, capped additive reduction; player stat modifiers. | Dormant twin eligibility is inconsistent across combat paths. |
| Enemies | Bone Knight, Hollow Archer, Gloom Hound, Mire Slime, Ash Acolyte, Crypt Brute, Husk Scarab; elite variants. | `spitter`, `sprout`, `shardling` have art but no server archetypes. |
| Enemy behavior | Aggro/threat targeting, telegraphs, melee charges, ranged spacing, strafing, darting, retreat, crowd separation. | Direct steering can stick on props; dormant twin still appears in some candidate lists. |
| Guardian | Ashen Warden at the end of Ashen Deep. | Its underlying policy is the tank state machine, not a separate multi-phase encounter. |
| Mirror | Three health phases, melee/ranged attacks, telegraphed nova; kite, rush, AoE dodge, riposte, predictive dash shots, zone denial. | Adaptive mechanics exist; difficulty/fairness across real play styles needs broader evaluation. |
| Twin transformation | Companion becomes dormant on the boss-room threshold; server emits transformation event; client has hatch animation. | Event delivery fixed in this release. Ending does not yet restore the twin as the narrative comment promises. |
| Loot | Seeded gold/essence/shards/potions/weapons/relics, pickup scatter/magnetism and contact collection. | No interact-key pickup action; existing pickup prompts suggest one. |
| Loot ownership | Weapons go to the collecting player/twin; shared resources go to player; duplicates become shards. | `TWIN_EQUIP` can copy an owned weapon; request-back actually transfers it. Ownership semantics need one consistent rule. |
| Progression | XP, levels, skill points, 12 nodes across Mobility/Combat/Magic/Survival. | No level-cap/endgame progression loop established. |
| Respec | Village-only skill refund with derived-stat recomputation. | Canvas availability messaging can drift between full and lite snapshots. |
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
| Networking | JSON WebSockets, 20 Hz snapshots, lighter frequent packets, reconnect/backoff and silence watchdog. | A reconnect creates a new simulation from a checkpoint, not an exact in-memory resume; duplicate-session socket races need hardening. |
| Persistence | Versioned JSON checkpoint files and atomic replacement; progression/equipment/campaign restored. | No save-slot UI, stable default browser identity, learned-model persistence, exact combat restore or cross-device sync. |
| Replay | Tick-stamped JSONL commands/inputs/events and first-divergence CLI. | Metadata lacks checkpoint initial state; restarting/reconnecting may overwrite recordings with the same session/seed. Paused input ordering deserves dedicated tests. |
| Contracts | Pydantic input validation, TypeScript types and generated input schemas. | Snapshot types/documentation are manually maintained; no automated end-to-end schema drift check in CI. |
| Tests | Broad server units, scenarios and deterministic sessions; frontend NPC/dialogue regressions added here. | No checked-in browser automation suite or GitHub Actions workflow. |
| Debug tools | F3 traits/predictions/utilities/heatmaps/boss counters; console spawn/travel/equip/use/swap/respec/save/restart. | Developer commands are not separated from a production build/server policy. |

## Presentation and user interface

| Feature | Status |
|---|---|
| Character/enemy art | Player directional movement, twin art, weapon overlays, enemy family atlases, Mirror animations; enemies loaded per room. |
| World art | Drawn flora/stone/ruins/crypt/buildings/doors/lights/NPC atlases with procedural fallbacks; consistent light direction, shadows and depth sorting. |
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

## Prioritized remaining issues

These are code-confirmed integration gaps unless explicitly described as a testing need.

| Priority | Issue and concrete consequence | Main locations |
|---|---|---|
| High | **Canvas modal ownership is inconsistent.** Inventory/skills/map don't use the React modal store; `input:suspend` from settings/console has no play-scene subscriber. The world/input can continue under menus, Escape can also pause, and pressing I/K closes then immediately reopens the same panel. | `HudScene.ts`, `PlayScene.ts`, `hud/*Screen.ts`, `useHotkeys.ts` |
| High | **Ordinary gameplay toasts are invisible.** `store.ts` queues notifications, but App no longer mounts `Toasts`; the canvas toast only displays console responses. Quest/rejection/save/level notices are therefore missing. | `ui/store.ts`, `App.tsx`, `HudScene.ts` |
| High | **Default reload loses the save identity.** A random browser session ID is created on each page load unless `?session=` is supplied. Saves exist, but reopening the default URL selects a different one. | `network/WebSocketClient.ts` |
| High | **Dormant twin remains eligible in some combat systems.** Enemy targeting, projectile collision, crowd separation and PROTECT mitigation check downed/alive but not consistently dormant. This can create an invisible target/blocker before rescue or during the final fight. | `enemy_ai/*`, `movement/*`, `combat/mitigation.py` |
| Medium | **Travel and respec availability flicker.** `Bridge` computes `canTravel` and village restrictions from full snapshots only; lite frames temporarily lose room type/safety. | `hud/Bridge.ts` |
| Medium | **Minimap motion is stale.** Map updates are emitted only on full room snapshots, so markers lag the 20 Hz world. | `hud/Bridge.ts::#emitRoom` |
| Medium | **Pause labels report the wrong measures.** Enemies killed populate “hits landed”; rooms cleared populate “potions drunk.” Lite snapshots may show missing room/biome text. | `hud/Bridge.ts::#emitPause`, `hud/PauseScreen.ts` |
| Medium | **F has two default actions.** Binding lookup selects health potion before the dial's selected-potion action. R+H works; rebinding/conflict cleanup needs a migration for saved bindings. | `state/Keybinds.ts` |
| Medium | **T has no effect.** It sends `TWIN_REQUEST` without the required weapon ID. Character's explicit weapon request includes the ID and works. | `ui/useHotkeys.ts`, `api/session.py` |
| Medium | **Pickup/portal prompts imply E.** Their real actions are automatic contact collection/travel; E only talks to NPCs. Use action-specific captions. | `hud/Bridge.ts`, `InteractPrompt.ts`, `game/loot.py`, `api/session.py` |
| Medium | **Shop proximity isn't validated for BUY_ITEM.** TALK checks range, but a direct purchase command can buy from any NPC in the current room. | `api/session.py::_buy` |
| Medium | **Companion ownership and ending need polish.** TWIN_EQUIP duplicates a player-owned weapon, while request-back moves it; winning never performs the promised twin restoration. | `api/session.py::_apply_commands`, `_room_logic` |
| Medium | **Prediction and telegraph fidelity.** Flame Pillar damage lands before its configured cast time; some feedback mappings are still the old four-ability set; movement prediction omits some slow/drink/channel constraints. | `combat/combat.py`, `PlayScene.ts`, `PlayerView.ts` |
| Medium | **Presentation art is larger than collision.** Large trees/buildings/NPC frames use much smaller circular collision footprints; appearance and navigation need a deliberate pass. | `world/village.py`, `WorldRenderer.ts`, `propArt.ts` |
| Medium | **Persistence/replay scope is incomplete.** Learned models, initial checkpoint state and exact encounter state are not recorded/restored as a complete session. | `world/save.py`, `replay/recorder.py`, `tools/replay/replay.py` |
| Medium | **Hosting is not production-ready.** No auth/session ownership, connection limits, WebSocket-origin policy, production debug-command gating or packaged deployment. Local single-player use is the tested scope. | `api/app.py`, `api/websocket.py`, `api/session.py` |
| Low | **Cleanup and product polish.** Legacy unmounted React HUD/menus, stale comments/docs, missing code license decision, asset budget/loading optimizations, broader accessibility and cross-browser testing. | `ui/`, root docs, `assets/`, `public/game/` |

## Not implemented, versus deliberately out of scope

Missing product/gameplay work: crafting/resource sinks, armor and richer equipment, selling,
side quests/journal, branching dialogue, more campaign content, tactical twin commands,
pathfinding, durable learned-model saves, save-slot management, full end-screen flow,
controller/touch support, localization, accessibility pass, CI/browser tests, executable packaging
and hosted deployment. These are options for future work, not promises that they are all necessary.

Deliberately excluded by AGENTS.md: multiplayer, Unity/Godot/Unreal, cloud AI or an LLM in the
combat loop, per-player neural training, a traditional RL pipeline, full ECS, microservices,
Redis/Kafka/Postgres/Kubernetes and a custom binary network protocol. They are not missing
requirements for this slice.

## Validation for the release commit

- Server: **299 tests passed**, including whole-session determinism, all four NPC roles at the
  advertised range boundary, paused shopping, legacy-command rejection and transformation delivery.
- Frontend: **10 regression tests passed**; typecheck, ESLint and production build passed.
- Live browser: isolated seeded server fixture placed the test player by Oren. E opened dialogue;
  clicking advanced a line; buying a sword changed 500 gold to 455 and showed Owned; Escape closed;
  reopening restored the first line. This was an interaction smoke test, not a full campaign playthrough.
- Replay: a fresh 900-tick seed-2024 run reproduced **all 114 recorded events exactly**.
- Repository scan: no missing generated atlas JSON/PNG references and no game-layer imports of
  agent/API/FastAPI. Existing session-layer gameplay ownership debt is documented above.
