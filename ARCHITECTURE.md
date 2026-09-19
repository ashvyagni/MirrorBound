# Architecture

> Python owns truth. Phaser displays truth. Agent recommends actions. Game executes actions.

```
 browser (src/web)                         server (apps/server/mirrorbound)
 ┌──────────────────────────┐   INPUT/COMMAND   ┌────────────────────────────────────┐
 │ React: HUD, menus,       │ ───────────────►  │ api/websocket.py → api/session.py  │
 │ inventory, skills,       │                   │   GameSession.step() @ 60 Hz       │
 │ settings, debug overlay  │                   │   ┌──────────────────────────────┐ │
 │        ▲ EventBus        │                   │   │ game/  (deterministic sim)   │ │
 │ Phaser: world renderer,  │ ◄───────────────  │   │ entities · combat · movement │ │
 │ entity views, VFX, audio │   SNAPSHOT 20 Hz  │   │ enemy_ai · dungeon · loot    │ │
 │ + local player prediction│  (+ events since  │   │ progression · twin_executor  │ │
 └──────────────────────────┘    last snapshot) │   └──────────────▲───────────────┘ │
                                                │        EventBus  │  TwinIntent     │
                                                │   ┌──────────────┴───────────────┐ │
                                                │   │ agent/                       │ │
                                                │   │ telemetry → features →       │ │
                                                │   │ player_model · prediction ·  │ │
                                                │   │ spatial  ══► pipeline        │ │
                                                │   │ twin/ (style + controller)   │ │
                                                │   └──────────────────────────────┘ │
                                                └────────────────────────────────────┘
```

## Server

### Tick (`api/session.py::GameSession.step`)

1. Apply queued **commands** (equip, unlock, use item, pause, restart).
2. `player.update` (cooldowns, regen, state timers) then `player.apply_input` (velocity + facing).
3. Combat requests: `CombatSystem.process_player_attack` / `process_ability`.
4. `MovementSystem.update`: integrate velocity + knockback, clamp to room, resolve blocking decor,
   separate crowds, move projectiles, emit sampled `PLAYER_MOVED` and `PLAYER_RETREATED`.
5. Enemies: `BasicEnemyController.update` per enemy; the boss uses `MirrorController`.
6. Twin: every 6 ticks build an `AgentObservation`, ask the controller for a `TwinIntent`, hand it to
   `TwinExecutor` (validates, moves, attacks, publishes `TWIN_ACTION`/`TWIN_OUTCOME`).
7. `CollisionSystem` (projectiles), `LootSystem` (magnetism, pickup), `CombatSystem.update` (status).
8. Room logic: clear detection, door unlocks, transitions, death/respawn, victory.

Everything random goes through `DeterministicRNG` sub-streams (`rng.spawn("combat")`, `"loot"`,
`"dungeon"`, `"enemy_ai"`, `"mirror"`). No `random.*`, no `hash()` on strings.

### Modules

| Path | Owns |
|---|---|
| `game/state.py` | `GameState`: entities, room, dungeon, phase, event drain, spawning |
| `game/entities/` | `Vec2`, `Entity`, `Player`, `Twin`, `Enemy` (+archetypes, loot tables), `Projectile`, `Pickup` |
| `game/combat/` | `weapons.py`, `abilities.py` (data), `hitbox.py`, `combat.py` (the only place damage happens) |
| `game/movement/` | integration + projectile collision |
| `game/enemy_ai/` | archetype state machine, `mirror.py` boss controller |
| `game/dungeon/` | `room.py` model, `templates.py` handcrafted pieces, `generation.py` arrangement + decor |
| `game/progression/` | XP curve, skill tree data and modifiers |
| `game/inventory.py`, `game/loot.py` | inventories; drops and pickups |
| `game/twin_executor.py` | executes `TwinIntent`; outcome tracking |
| `agent/` | see [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) |
| `contracts/` | Pydantic models for inbound messages and the intent shape |
| `replay/` | JSONL recorder; `tools/replay/replay.py` re-simulates |
| `api/` | FastAPI app, WebSocket endpoint, `GameSession` |

### Wire protocol

Inbound (validated by `contracts/messages.py`):

```jsonc
{ "type": "INPUT", "moveX": -1, "moveY": 0, "attack": false, "run": true, "ability": null, "seq": 812 }
{ "type": "COMMAND", "action": "EQUIP_WEAPON", "weaponId": "hunter_bow" }
```

Outbound: one `SNAPSHOT` at 20 Hz. See [docs/contracts/snapshot.md](docs/contracts/snapshot.md). The
room's tiles/decor travel only when the room changes (`roomFull`), and inventory/skill-tree/stat
blocks only when something changed them (`detail`); the client caches both.

## Client

| Path | Owns |
|---|---|
| `game/contracts.ts` | TypeScript mirror of the wire protocol |
| `game/network/WebSocketClient.ts` | connect/reconnect, coalesced input, commands |
| `game/input/KeyboardIntentSource.ts` | WASD/J/1-4 → `Intent`; muted while a menu is open |
| `game/scenes/PlayScene.ts` | orchestrates snapshots → views, events → VFX/audio, camera, debug drawing |
| `game/world/` | `TextureFactory`/`PropPainter` (procedural painted textures), `WorldRenderer` (floor, decor, torches, doors, water), `Ambient` (motes, leaves, birds, critters) |
| `game/entities/` | `EntityView` interpolation base; `PlayerView` (prediction + reconciliation), `TwinView`, `EnemyView`, `ProjectileView`, `PickupView`, `WeaponOverlay` |
| `game/effects/Vfx.ts` | slashes, sparks, damage numbers, spell effects, telegraphs, callouts, shake |
| `game/audio/AudioManager.ts` | WebAudio synth SFX + procedural ambient music behind master/music/sfx gains |
| `ui/store.ts` | external store: snapshot, cached detail, screen state, toasts |
| `ui/*.tsx` | HUD, pause, inventory, skill tree, settings, controls, overlays, debug overlay |

Rendering rules: Phaser owns the world (one composed floor texture per room, depth = y for
entities, culling by camera), React owns everything with text. The two talk only through
`game/EventBus.ts`.

Player movement is predicted locally from the frame's intent and reconciled toward each snapshot
(`NET.reconcile`, snapping above `NET.snapDistance`). Every other entity dead-reckons from its last
velocity and eases toward the authoritative position.

## Contracts and stability

- Adding a telemetry event: publish it from `game/`, document it in
  `docs/contracts/telemetry-events.md`, and (if the client should react) add it to
  `CLIENT_EVENT_TYPES` in `api/session.py` and handle it in `PlayScene.#onEvent`.
- Adding an ability/weapon/skill/enemy: add a row to the data module; the HUD, inventory and
  skill tree render from snapshot data, and the client only needs a texture key if the sprite is new.
- Replacing the twin brain: implement `TwinController.decide(observation) -> TwinIntent` and pass it
  to `twin.set_controller(...)` in `GameSession._build_world`.
