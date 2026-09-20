# Snapshot contract

One JSON object per snapshot, 20 per second, from server to client. TypeScript mirror:
`src/web/src/game/contracts.ts` (`GameSnapshot`). Producer: `apps/server/mirrorbound/api/session.py::GameSession.snapshot`.

```jsonc
{
  "type": "SNAPSHOT",
  "tick": 4812, "seed": 1234,
  "phase": "playing" | "dead" | "victory",
  "paused": false,
  "transition": 0.0,               // seconds left in a room fade
  "roomFull": true,                // tiles + decor present (room changed) — else a lite room
  "detail": true,                  // inventory/skillTree/weapon/stats present on player & twin

  "room": {                        // full
    "id": "room_1", "index": 1, "roomType": "combat", "name": "Hollow Glade", "biome": "grove",
    "width": 1280, "height": 960, "tileSize": 32,
    "tiles": [[1,1,...],[1,0,...]],            // 0 grass 1 wall 2 path 3 stone 4 dirt 5 water
    "decor": [{"kind":"tree","x":312.0,"y":455.0,"variant":2,"scale":1.05,"blocking":true,"radius":23.1,"flip":false}],
    "doors": [{"side":"north","x":640,"y":16,"width":96,"targetIndex":2,"locked":true,"kind":"gate"}],
    "cleared": false, "seed": 918273
  },
  // lite: { "id", "index", "cleared", "doors" }

  "player": {
    "id":"player_1","position":{"x":640,"y":857.6},"velocity":{"x":0,"y":-290},"facing":{"x":0,"y":-1},
    "health":87,"maxHealth":100,"radius":14,"statusEffects":[],"invulnerable":false,"active":true,
    "type":"player","state":"run",             // idle walk run attack cast dash hurt dead
    "mana":52.3,"maxMana":60,"xp":24,"xpToNext":80,"level":1,"skillPoints":0,
    "currentWeapon":"iron_sword","attackCooldown":0,"comboStep":1,"comboLength":3,
    "abilities":[{"slot":1,"id":"arcane_bolt","name":"Arcane Bolt","icon":"arcane_bolt","cost":8,
                  "cooldown":0.9,"cooldownTotal":1.2,"ready":false,"blockedBy":"cooldown","tags":["RANGED","SPELL","MAGIC"],"description":"..."}],
    "kills":1,"deaths":0,"targetId":"enemy_3","respawnIn":0,
    // detail only:
    "unlockedSkills":[], "skillTree":[{"id":"swift_feet","name":"Swift Feet","category":"MOBILITY","tier":1,"cost":1,
                                       "description":"...","requires":[],"unlocked":false,"available":true,"reason":"ok"}],
    "weapon":{"id":"iron_sword","name":"Iron Sword","type":"melee","family":"sword","damage":14,"cooldown":0.42,"range":64,
              "resourceCost":0,"tags":["MELEE","FAST"],"comboLength":3,"rarity":"common","animation":"sword","description":"..."},
    "inventory":{"weapons":[...],"equippedWeapon":"iron_sword","abilitySlots":["arcane_bolt","flame_burst","shadow_dash","binding_nova"],
                 "consumables":[{"id":"health_potion","count":1,"name":"Health Potion","heal":45,...}],
                 "resources":{"essence":2,"shards":1,"relics":0},"relics":[]},
    "stats":{"speed":175,"weaponDamageMult":1,"spellDamageMult":1,"critChance":0.08,"damageTakenMult":1,"manaRegen":4.5}
  },

  "twin": {
    "...EntityBase","type":"twin","state":"walk",   // idle walk attack cast downed
    "mana":40,"maxMana":50,"currentWeapon":"frost_staff",
    "intent":{"intentType":"INTERCEPT","targetId":"enemy_3","position":{"x":..,"y":..},"confidence":0.71,
              "utilities":{"INTERCEPT":0.84,"ASSIST":0.52,...},"reason":"melee threatening player (hp 87%)"},
    "kills":0,"damageDealt":31,"damageTaken":0,"downedFor":0,"attackCooldown":0.2,
    "weapon":{...},"inventory":{...}                 // detail only
  },

  "enemies":[{"...EntityBase","type":"skeleton","name":"Bone Knight","role":"melee","sprite":"skeleton","elite":false,"boss":false,
              "state":"attack","targetId":"player_1","windingUp":true,"windup":0.3,"weapon":null}],
  "projectiles":[{"id":"projectile_4","kind":"ice_bolt","ownerId":"twin_1","faction":"ally","position":{..},"velocity":{..},"radius":6}],
  "pickups":[{"id":"pickup_2","kind":"essence","itemId":"","amount":3,"position":{..},"age":1.2}],

  "stats":{"enemiesKilled":1,"roomsCleared":0,"damageDealt":62,"damageTaken":13,"essenceCollected":2,"abilitiesCast":1,"seconds":80.2},
  "dungeon":{"seed":1234,"roomCount":7,"currentIndex":1,"rooms":[{"index":0,"type":"entrance","name":"...","biome":"grove","cleared":true,"visited":true}]},

  "events":[{"tick":4810,"type":"DAMAGE_DEALT","data":{...}}],          // since last snapshot, client-relevant types only
  "playerModel":{"tick":4812,"traits":{"aggression":{"value":0.65,"confidence":0.4,"samples":10,"recent_trend":0.02}},
                 "predictions":[{"token":"FLAME_BURST","confidence":0.7,"order":2,"weight":6.2}],
                 "spatial":{"combat":[{"cell":[10,13],"weight":4.9}],...},"cellSize":64},
  "twinModel":{"dims":{"preferred_range":{"value":0.31,"confidence":0.45,"samples":14,"recent_trend":-0.01}},
               "lessons":["Player favours melee (0.45)"],"playerEventsSeen":40,"outcomesSeen":6,"learningMult":1},
  "boss": null | {"phase":1,"activeCounter":"kite","countersUsed":{"kite":3}},
  "lastError": null
}
```

Rules:

- Positions and velocities are world units (tile = 32). `facing` is a unit vector.
- `events` is filtered to `CLIENT_EVENT_TYPES` and capped at 60 per snapshot.
- The client must tolerate a lite `room` and missing detail blocks by caching the last full ones.
- Field names are camelCase on the wire, snake_case inside event `data` (they are the telemetry events verbatim).
- `enemies[].weapon` is the player weapon this creature was armed with (`armed_with`),
  or `null`. It is **presentational only** -- every number the weapon dictates (reach,
  cadence, cooldown, projectile, damage scale) has already been folded into the
  archetype's own fields server-side. The client reads it solely to draw the weapon in
  the creature's hands from the blackened sheets, and to draw what it throws to match.

## NPC interactions and weapon-derived abilities (0.1.0)

- `npcs` is detail-only. Absence means unchanged; `[]` explicitly clears it. Clear cached
  NPCs when `room.id` changes, including transitions between areas whose room indexes match.
- Each NPC includes `id`, `name`, `role`, `sprite`, `position`, `radius`, authored `lines`,
  and `stock` entries (`kind`, `itemId`, `price`, `name`, `description`).
- The displayed talk reach is `npc.radius + player.radius`. The client uses authoritative
  positions to choose its nearest candidate; `TALK` with `npcId` is still validated by Python.
- Successful `TALK` emits `NPC_TALK` with `npc`, `name`, `role`, `lines`, `stock`, `position`.
  It is delivered through `snapshot.events`; the UI then requests `PAUSE`. Purchases are
  `BUY_ITEM` requests and their results arrive as updated inventory and `SHOP_PURCHASE`.
- `TWIN_TAKEN` is delivered to the client for the boss transformation. Its data contains
  `twin`, `position`, `room_id` and `first_visit`; the twin snapshot is already dormant.
- Player ability slots derive from the equipped weapon pair, and may number fewer than four.
  Legacy `SET_ABILITY_SLOT` remains a recognized command for compatibility but returns
  `ACTION_REJECTED` with `abilities are determined by equipped weapons`.


## Gameplay hardening contracts (2026-09-20)

- `TWIN_CALL` has no payload. Python validates that the twin is available, installs FOLLOW for
  three seconds of unpaused simulation time and emits `TWIN_CALLED` with `duration`/`position`.
  Dormant/downed twins receive `ACTION_REJECTED`. `TWIN_REQUEST` still requires `weaponId`.
- `TWIN_EQUIP` equips a weapon already held by the twin, or transfers an owned player weapon
  into the twin's inventory before equipping. `TWIN_REQUEST` transfers in the reverse direction.
  Both repair main/offhand references; an empty inventory resolves to `bare_hands`.
  Transfers emit `TWIN_ITEM_GIVEN` with `weapon`, destination actor `to`, `twinWeapon`, `position`.
- `BUY_ITEM` checks the same inclusive NPC distance as TALK on every request, before gold or
  inventory mutation. It works while paused; pausing is not an exemption from validation.
- A restored ending emits `TWIN_REVIVED` with `restored: true`; the twin snapshot is available
  and campaign flags contain `twin_restored` instead of `twin_taken`. The checkpoint includes it.
- Nonzero `castTime` starts an interruptible channel. `PLAYER_ABILITY_CAST` reports `channel`
  at acceptance; `PLAYER_ABILITY_RESOLVED` reports targets and effects only when completed.
  Mana/cooldowns are paid once at acceptance. An interruption emits `ABILITY_INTERRUPTED` and
  prevents resolution. Instant abilities retain the existing PLAYER_ABILITY_CAST event.
- Player lite snapshots include `moveSpeed` and `runSpeed`: current effective input rates after
  state/slow modifiers. They are prediction hints, never authority for client-side outcomes.
- Decor `radius` is the unscaled base radius; `scale` scales it once. `collisionX`, `collisionY`,
  `collisionRadius` describe the final authoritative foundation circle. Building foundations
  sit above the bottom sprite anchor; debug drawing uses the transmitted circle.
- Room geometry is cached by `room.id` (not just index), terrain by ID and seed. Lite room packets
  update clearance/doors but do not remove full-room safety, portals, tiles or cached NPCs.
- WebSocket close code **4409** means another tab took this save. The old client stops automatic
  reconnects. Each simulation's snapshots are bound to its own socket, preventing mixed states.
