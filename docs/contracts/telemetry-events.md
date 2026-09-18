# Telemetry event contract

Audience: whoever writes `game/` code (movement, combat, dungeon, ...) that publishes events onto
the `EventBus`. This is what `agent/telemetry`, `agent/player_model`, `agent/spatial` and
`agent/twin/style.py` consume, and what the client turns into VFX and sounds.

Implementation of the reading side: `mirrorbound/agent/features/*.py` and
`mirrorbound/agent/twin/style.py`. If this doc and the code disagree, the code is current.

## Every event (enforced by `Event`, see `game/core/events.py`)

- `tick: int` — the sim tick this happened on. Required.
- `type: str` — event type name.
- `data: Mapping[str, Any]` — everything else. Frozen recursively once published.

Convenience: `GameState.emit(type, **data)` stamps the tick for you.

## Fields the models read

None are required on every event. **When a field is absent the pipeline skips that observation
rather than guessing.**

| Field | Type | Used for | Notes |
|---|---|---|---|
| `data["action_token"]` | `str` | sequence prediction | Semantic token (`SWORD_STRIKE`, `SWORD_FINISHER`, `BOW_SHOT`, `STAFF_SHOT`, `DASH`). Overrides the type mapping. |
| `data["ability"]` | `str` | sequence prediction | On `PLAYER_ABILITY_CAST`: the token *is* the ability id upper-cased (`FLAME_BURST`). |
| `data["tags"]` | `list[str]` | aggression, dependencies, zone layers, twin style | `MELEE RANGED SPELL MAGIC AOE BURST MOBILITY DEFENSIVE FAST HEAVY HIGH_RISK`. |
| `data["distance"]` | `float` | mobility | World units moved. Normalised by `MOBILITY_DISTANCE_NORM` (95). Only on movement events — never put weapon range here. |
| `data["position"]` | `{"x","y"}` or `[x, y]` | spatial heatmaps | The *actor's* position for player actions; the target's for damage events. |
| `data["healthFraction"]` | `float` | twin risk_tolerance | On `PLAYER_ATTACKED`. |
| `data["target_type"]` | `str` | twin target_preference | On `TARGET_CHANGE`. |
| `data["comboStep"]` | `int` | `combo_dependency` | On `PLAYER_ATTACKED`, 1-indexed (`Player.start_attack`/`weapon.combo_window`). `>= 2` means this hit chained off the previous one within the weapon's own combo window; `1` is an opening hit. Read directly rather than re-derived from tick deltas — the game already computes it per weapon. |

## Player action events (feed the player model)

| `type` | Token | Emitted by | Extra data |
|---|---|---|---|
| `PLAYER_ATTACKED` | `action_token` | `combat.process_player_attack` | `weapon`, `facing`, `comboStep`, `targets`, `hitCount`, `nearestEnemyDistance` |
| `PLAYER_ABILITY_CAST` | `ability` | `combat.process_ability` | `ability_id`, `slot`, `facing`, `targets`, `hitCount`, dash: `distance`, `dodged` |
| `PLAYER_DASHED` | `DASH` | Shadow Dash | `distance`, `direction` |
| `PLAYER_DODGED` | `DODGE` | dash through a wind-up, or hit while invulnerable | `dodged` (enemy ids) |
| `PLAYER_RETREATED` | `RETREAT` | `MovementSystem` heuristic: moving away from the nearest engaged enemy ≥0.6 s (2.5 s cooldown) | `from_enemy`, `distance`, `health_fraction` |
| `PLAYER_MOVED` | — | sampled every 20 ticks while moving | `distance`, `direction`, `running` |
| `TARGET_CHANGE` | — | first hit on a different enemy | `previous`, `target`, `target_type` |
| `PLAYER_DIED` | — | lethal `DAMAGE_TAKEN` | `killer`, `room_id`, tags `HIGH_RISK` (death zone layer) |

## Outcome and world events (client feedback, replay, twin experience)

`DAMAGE_DEALT` (`attacker`, `target`, `target_type`, `damage`, `remaining`, `position`, `crit`, `source`, `tags`) ·
`DAMAGE_TAKEN` (`actor`, `attacker`, `attacker_type`, `damage`, `remaining`, `position`) ·
`ENEMY_KILLED` (`enemy_id`, `enemy_type`, `role`, `elite`, `boss`, `xp_reward`, `killer`, `position`, `room_id`) ·
`ENEMY_SPAWNED` · `ENEMY_ATTACKED` (`enemy_id`, `target`, `hit`, `ranged`) ·
`PROJECTILE_HIT` / `PROJECTILE_EXPIRED` (`kind`, `position`) ·
`ITEM_PICKUP` (`actor`, `kind`, `item_id`, `amount`, `position`) · `ITEM_USED` · `WEAPON_CHANGED` (`actor`, `weapon`) ·
`SKILL_UNLOCKED` (`skill`) · `LEVEL_UP` (`level`, `skillPoints`) · `PLAYER_HEALED` · `PLAYER_RESPAWNED` ·
`ROOM_ENTER` (`room_id`, `room_index`, `room_type`, `name`, `biome`, `first_visit`) · `ROOM_EXIT` · `ROOM_CLEARED` ·
`ACTION_REJECTED` (`action`, `reason`: `cooldown` `mana` `not owned` ...) · `RUN_COMPLETE` (`stats`, `seed`).

## Twin events

| `type` | Emitted by | Data |
|---|---|---|
| `TWIN_ACTION` | `TwinExecutor.on_intent` when the intent type or target changes | `intent`, `target`, `position`, `confidence`, `utilities`, `reason`, `twin_position` |
| `TWIN_OUTCOME` | when that intent ends (change or 4 s timeout) | `intent`, `target`, `success`, `damage_dealt`, `damage_taken`, `kills`, `duration`, `end_reason` |
| `TWIN_ATTACKED` | `combat.process_twin_attack` | `target`, `weapon`, `tags`, `hitCount`, `distance` |
| `TWIN_DAMAGED` / `TWIN_DOWNED` / `TWIN_REVIVED` | combat / session | `attacker`, `damage`, `remaining`, `intent` |

## Boss events

`BOSS_COUNTER` (`counter`: `kite` `rush` `dodge_aoe` `riposte` `predict_dash` `deny_zone`, `confidence`, `detail`, `phase`) ·
`BOSS_NOVA_CHARGE` (`radius`, `duration`) · `BOSS_NOVA` · `BOSS_DEFEATED`.

## Trait formulas (unchanged from the original contract)

- **aggression** — `1.0` for `PLAYER_ATTACKED` or a non-`DEFENSIVE` ability cast; `0.0` for
  `PLAYER_BLOCKED`/`PLAYER_RETREATED` or a `DEFENSIVE` cast; no observation otherwise.
- **mobility** — `min(1, distance / 95)` when `distance` is present.
- **melee/ranged/spell_dependency** — from `tags` when at least one combat category is present.
- **combo_dependency** — `1.0` when `comboStep >= 2` (this hit chained), `0.0` when `comboStep == 1`
  (an opening hit), no observation when `comboStep` is absent. Deliberately separate from
  `aggression`: a player who attacks constantly but never chains reads as aggressive without reading
  as combo-heavy, and vice versa.

## Zone layers (spatial)

`combat` (attacks, casts) · `melee` (combat + `MELEE`) · `spell` (cast + `SPELL`) · `retreat` ·
`dodge` · `high_risk` (tag) · `death` (`PLAYER_DIED`). Cell size 64 world units.
