# Telemetry event contract

Audience: whoever writes `game/` code (movement, combat, dungeon, ...) that
publishes events onto the `EventBus`. This is what `agent/telemetry` and
`agent/player_model` actually consume — get these fields right on the events
you publish and the prediction/trait pipeline works with zero changes on the
agent side.

Implementation: `mirrorbound/agent/features/*.py` (this is the code these
tables describe — if the two ever disagree, the code is the current behavior
and this doc is stale and should be fixed).

## Every event (already enforced by `Event`, see `game/core/events.py`)

- `tick: int` — the sim tick this happened on (from `SimClock.tick`). Required.
- `type: str` — event type name, e.g. `"PLAYER_DASHED"`.
- `data: Mapping[str, Any]` — everything else. Frozen recursively once
  published; you can't mutate it after the fact, so build the dict you want
  and pass it to `Event(...)` in one shot.

## Fields telemetry reads

None of these are required on every event — only on the events where they're
relevant. **When a field isn't given, the pipeline skips that observation
rather than guessing a value.** No signal is safer than a wrong signal.

| Field | Type | Used for | Notes |
|---|---|---|---|
| `data["action_token"]` | `str` | sequence prediction | Explicit override for the semantic action token this event represents (e.g. `"DASH"`, `"FIRE_BURST"`). Takes priority over the `type`-based mapping below — use this for anything data-driven (an ability defined by content, not a fixed enum in code). |
| `data["tags"]` | `list[str]` | aggression, melee/ranged/spell dependency | From the ability tag vocabulary (doc section 30): `MELEE`, `RANGED`, `SPELL`, `AOE`, `BURST`, `MOBILITY`, `DEFENSIVE`, `SINGLE_TARGET`, `HIGH_RISK`. `SPELL` is a project-specific addition to the doc's original list — needed to separate `spell_dependency` from `ranged_dependency` (a thrown weapon is `RANGED` but not `SPELL`). |
| `data["distance"]` | `float` | mobility | World units moved by this event. |
| `data["ability"]` | `str` | sequence prediction | Required on `PLAYER_ABILITY_CAST` events (see below) — without it the event contributes no prediction token, only telemetry buffering. |

## Recognized event `type`s (fallback when there's no `action_token` override)

| `type` | Token | Notes |
|---|---|---|
| `PLAYER_DASHED` | `DASH` | Include `data["distance"]` if you want this to feed mobility. |
| `PLAYER_DODGED` | `DODGE` | |
| `PLAYER_ATTACKED` | `ATTACK` | Include `data["tags"]` if you want this to feed aggression / dependency traits. |
| `PLAYER_RETREATED` | `RETREAT` | Treated as a defensive action for aggression. |
| `PLAYER_BLOCKED` | `BLOCK` | Treated as a defensive action for aggression. |
| `PLAYER_ABILITY_CAST` | `data["ability"]` | The token *is* the ability name — new abilities need no code change here, just publish the event with the right `ability`/`tags`. |

Any other `type` (enemy events, outcome events like `ENEMY_KILLED`, anything
without `action_token` or a recognized `type`) contributes nothing — it's
still buffered (for replay/debug) but produces no prediction token and no
trait signal. That's intentional: this pipeline only reasons about *player
actions*, not their outcomes. Outcome events (damage dealt, kills, loot) are
out of scope for this slice.

## Trait formulas (current slice: aggression, mobility, melee/ranged/spell dependency)

Code: `agent/features/combat_features.py`, `agent/features/movement_features.py`.

- **aggression** — classified by `type`, not by `action_token` (the token is
  meant to be overridden per-ability for sequence prediction, e.g.
  `"AERIAL_ATTACK"`, so it can't double as a stable category label). `1.0` for
  `PLAYER_ATTACKED`, or `PLAYER_ABILITY_CAST` without a `DEFENSIVE` tag. `0.0`
  for `PLAYER_BLOCKED`/`PLAYER_RETREATED`, or an ability cast tagged
  `DEFENSIVE`. **No observation** for anything else (movement, an
  unrecognized type, an ability cast with no `tags` at all) — an ambiguous
  action shouldn't pull the trait in either direction.
- **mobility** — `min(1.0, distance / 5.0)` when `data["distance"]` is
  present. `5.0` world units is a placeholder "one full dash" reference —
  retune once real movement numbers exist. **No observation** when `distance`
  is absent, even on a `PLAYER_DASHED` event — we don't assume a dash moved
  "far" without the actual number.
- **melee_dependency / ranged_dependency / spell_dependency** — when
  `data["tags"]` is present **and contains at least one combat category**
  (`MELEE`/`RANGED`/`SPELL`), each of the three gets `1.0` if its tag is in
  the set, else `0.0`. A single action is a mutually-exclusive category
  choice, so e.g. a melee attack reads as `melee_dependency=1.0`,
  `ranged_dependency=0.0`, `spell_dependency=0.0` all at once. **No
  observation for any of the three** when `tags` is absent, empty, or present
  but containing only non-combat tags (e.g. a `PLAYER_DASHED` event tagged
  only `MOBILITY`) — none of those assert or deny a combat category, so they
  must not read as "definitely not melee/ranged/spell" the way an actual
  combat action's absence of a tag does.

All traits share the same `Trait.update()` — an exponentially-weighted moving
average (see `agent/player_model/traits.py`). Recent observations matter more
than old ones; confidence rises with sample count but is capped short of
`1.0`, and a handful of observations never reads as high confidence regardless
of how consistent they are.

## What isn't covered yet

Spatial heatmaps, pattern detection beyond raw sequence prediction, and any
combat-outcome events (damage/kills/loot) are out of scope for this slice.
Extending the trait set or event vocabulary is expected — update this table
and the corresponding `agent/features/*.py` file together.
