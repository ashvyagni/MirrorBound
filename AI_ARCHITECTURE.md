# AI architecture

The AI is local, deterministic, explainable and cheap. No neural networks, no reinforcement
learning, no language models in the loop. Everything below runs inside the 60 Hz tick and is
visible in the F3 overlay.

```
GAME EVENTS (EventBus)
   │
   ├─► agent/telemetry/collector.py      buffers events, routes them onward
   │       ├─► agent/features/*           action token · trait signals · position/zones
   │       ├─► agent/player_model/traits  EWMA traits with confidence, samples, trend
   │       ├─► agent/prediction/          order-1..3 Markov with time decay + back-off
   │       └─► agent/spatial/             decaying heatmap layers (combat, retreat, dodge, spell, melee, high_risk, death)
   │              └─► agent/pipeline.py   PlayerModelSnapshot {traits, predictions, spatial}
   │
   └─► agent/twin/style.py               TwinStyleModel: imitation channel + experience channel
                     │
   GameSession every 6 ticks:
   observation_builder.build_observation(state, events, player_model, twin_style)
                     │
   agent/twin/controller.py  TwinV0Controller.decide(obs) ─► TwinIntent {type, target, position, confidence, utilities, reason}
                     │
   game/twin_executor.py     validates + executes; publishes TWIN_ACTION / TWIN_OUTCOME ──► back into the bus
```

## 1. Telemetry

Events are emitted on meaningful gameplay moments, never per frame. The full vocabulary is in
[docs/contracts/telemetry-events.md](docs/contracts/telemetry-events.md). The ones the models read:

| Event | Fields the models use |
|---|---|
| `PLAYER_ATTACKED` | `action_token` (e.g. `SWORD_STRIKE`, `SWORD_FINISHER`, `BOW_SHOT`), `tags`, `position`, `healthFraction` |
| `PLAYER_ABILITY_CAST` | `ability` (the token), `tags`, `position` |
| `PLAYER_DASHED` / `PLAYER_DODGED` / `PLAYER_RETREATED` | `distance`, `position`, `tags` |
| `PLAYER_MOVED` (sampled every 20 ticks) | `distance` |
| `TARGET_CHANGE` | `target_type` |
| `PLAYER_DIED` | `position` (death zone layer) |
| `TWIN_OUTCOME`, `TWIN_DAMAGED`, `TWIN_DOWNED` | experience channel for the twin's style |

## 2. Player model (Ujesha)

- **Traits** (`aggression`, `mobility`, `risk_tolerance`, `preferred_range`, `melee/ranged/spell_dependency`,
  `defensive_tendency`, `combo_dependency`): exponentially-weighted moving averages. Each carries `value`,
  `confidence` (`1 - exp(-samples/20)`, capped below 1), `samples`, `recent_trend`. Recency weighting is
  the decay: the model answers "what is this player doing *now*". `combo_dependency` reads `PLAYER_ATTACKED`'s
  `comboStep` directly (the game's own per-weapon combo-chain tracking) rather than inferring chaining from
  tick deltas, and is deliberately separate from `aggression` -- a player who attacks constantly without
  chaining reads as aggressive but not combo-heavy.
- **Sequence prediction**: three Markov tables (orders 1-3) over action tokens with a 30 s half-life
  on every transition weight. Prediction backs off from the longest context with enough evidence
  (`min_context_weight`) to shorter ones, so a single observation never wins outright. Abandoned
  patterns decay and are pruned.
- **Spatial**: seven decaying heatmap layers on a 64-unit grid, fed from event positions.

## 3. Twin style (`agent/twin/style.py`)

Twelve dimensions, each a `StyleDim` with value/confidence/samples/trend:

- **Fighting** (nine): `preferred_range`, `aggression`, `mobility`, `risk_tolerance`,
  `target_preference`, `melee_dependency`, `ranged_dependency`, `defensive_tendency`,
  `spell_preference`.
- **Looking after itself** (three, v1.2): `drink_threshold` (the health fraction it reaches for a
  flask at), `stock_target` (how many potions it wants to carry), `thrift` (0 spends freely,
  1 hoards).

Two channels feed them:

- **Imitation** (rate 0.06): the player's events nudge the twin toward the player's habits. For
  self-care this is the interesting channel: `ITEM_USED` carries `atHealth` — the fraction the
  player was at when the drink landed, captured *before* the heal — and copying it is the whole
  imitation channel in one line. A player who sips at 80% gets a twin that sips; one who gambles
  to 10% gets a twin that gambles. `SHOP_PURCHASE` teaches `thrift` and, for a potion,
  `stock_target`.
- **Experience** (rate 0.12): `TWIN_OUTCOME` events. An attack that dealt more than it cost
  reinforces aggression and risk tolerance; one that cost more pushes toward caution and range;
  going down pushes hard toward defence. A `HEAL` outcome reinforces the threshold it drank at
  when it worked and pushes it *up* when it did not — a drink that cost damage means the decision
  came late, and the fix is to drink earlier rather than to stop drinking.

`TWIN_DOWNED` carries `potions`, because going down teaches **opposite** lessons depending on what
was in the pack: with a potion it is a timing mistake (`drink_threshold` up hard), with none it is
a supply mistake (`stock_target` up hard). Either way `thrift` falls — gold in a pocket bought
nothing.

The twin's own use publishes `TWIN_ITEM_USED`, a different event from the player's `ITEM_USED`,
specifically so the imitation channel can never be fed the twin's own behaviour back as though it
were the player's. A test asserts that.

Confidence decays with a 75 s half-life on dimensions that stop receiving evidence. The model keeps
a short list of human-readable "lessons" for the HUD ("Player favours melee (0.72)", "Went down —
will keep more distance"). The `mirror_eye` relic multiplies the learning rate.

## 4. Twin v0 decisions (`agent/twin/controller.py`)

Every decision scores all candidates from the observation, the player model and the style:

| Candidate | Fires when | Scaled by |
|---|---|---|
| RETREAT | twin low health with enemies near | (1 - risk_tolerance), defensive_tendency |
| INTERCEPT | an enemy is winding up on the player, or threats near a hurt player | defensive_tendency, player health deficit, player `combo_dependency` × its confidence (step into an ongoing chain) |
| PROTECT | two or more enemies pressing the player | defensive_tendency, threat count |
| DISTRACT | player under 40% health, twin healthy | defensive_tendency, risk |
| ASSIST | the player has a target | twin aggression, player aggression × its confidence, own `preferred_range` (ranged-leaning mildly favors supporting over closing in); penalised if an AoE is predicted at that target |
| ATTACK | any enemy, preferring isolated ones and (by `target_preference`) dangerous vs weak ones | aggression, risk vs crowd, own `preferred_range` (melee-leaning favors it, ranged-leaning suppresses it) |
| FLANK | player's target within reach | mobility, own `preferred_range` (ranged-leaning favors it), `spell_preference`, player `combo_dependency` × its confidence (break the 1v1 rhythm from another angle); bonus when an AoE is predicted (stay out of the cone) |
| REPOSITION | far from the player | mobility, distance |
| EXPLORE | room clear, pickups present | mobility |
| HEAL | hurt, carrying a potion, nothing winding up on it | `drink_threshold` (how early), and **discounted by how close the nearest enemy is** |
| EAT | hunger below the Fed band and food in the pack | the size of the gap, the Hungry band, and the same enemy-distance discount |
| SHOP | a merchant in reach selling something it wants, money for it, nothing to fight | `stock_target` (how much it wants), `thrift` (whether it will spend) |
| FOLLOW | default | — |

The three self-care candidates are scored in the same pass as the rest rather than handled as
special cases ahead of it, and that is what makes the behaviour read as judgement. The clearest
case: HEAL is discounted by how close the nearest enemy is and RETREAT is *rewarded* by exactly
the same thing, so with something on top of it the twin backs off and the drink wins the moment it
is clear. Neither candidate refers to the other; "retreat, then drink" is the two curves crossing.
An enemy winding up inside 200 units zeroes HEAL outright — 0.4s rooted into a telegraph is how
you lose a potion and a companion.

The executor owns commitment rather than the controller: while `twin.busy` is true it stands still
whatever the controller has since decided, so no candidate needs to reason about being mid-drink.

The current intent gets a small hysteresis bonus so decisions don't flap. Beyond that, a candidate whose
*posture* (engaged: `ATTACK`/`ASSIST`/`FLANK`/`DISTRACT`/`INTERCEPT`/`PROTECT` vs. disengaged:
`RETREAT`/`REPOSITION`/`FOLLOW`/`EXPLORE`/`HEAL`/`EAT`/`SHOP`) opposes the current intent's is penalized, scaled by
`seconds_since_decision` (previously computed on every observation and never read by anything): a
decision made very recently resists flipping to the opposite posture; the penalty decays to nothing
over `MOMENTUM_WINDOW_SECONDS` (0.5s). The penalty's ceiling is kept well below what a genuine
emergency scores (RETREAT at critical health easily clears 0.5+, versus a ≤0.18 penalty), so a real
threat spike still overrides it outright -- this dampens marginal flip-flopping, not survival
decisions. Confidence is the winning utility over the sum of the top two. The full utility table is
attached to the intent, sent in every snapshot and drawn in the F3 overlay.

**Contract for the full agent (Ojas):** implement `decide(observation: AgentObservation) ->
TwinIntent` and register it with `twin.set_controller(...)`. The observation already carries the
player model snapshot, the twin style snapshot, entity states (including enemy wind-ups and
targets), pickups and the player's last action token.

**Weapon autonomy (extends the above):** `TwinIntent.desired_weapon` lets `decide()` also suggest a
weapon, independent of `intent_type` -- never applied directly (see the architecture rule at the top
of this doc), only validated and equipped by `game/twin_executor.py` if the twin actually owns it
(`observation.twin_owned_weapons`). `TwinV0Controller._preferred_weapon()` scores each owned weapon
against `preferred_range`/`spell_preference` and only switches past `WEAPON_SWITCH_MARGIN` (0.15), so
a marginal lean doesn't cause flip-flopping. For the twin to have more than its starting `frost_staff`
to choose from, `game/loot.py` now routes a weapon pickup to whichever entity (player or twin)
actually walked over it, instead of always the player -- every other pickup kind (essence, shards,
consumables, relics) is unaffected and still always goes to the player, since relic effects and
shared currency are only ever read from `state.player.inventory`. Honest limit: `iron_sword`, the
only melee weapon, isn't in `loot.py`'s drop table, so autonomous switching only reaches the ranged/
magic weapons in practice unless a player manually equips the twin a sword via the `TWIN_EQUIP`
command.

## 5. Execution and outcomes (`game/twin_executor.py`)

The executor is the only thing that turns an intent into velocity or an attack. It validates the
target still exists, holds ranged weapons at ~55% of their range and melee at ~85%, strafes slowly
instead of standing still, and when an intent changes (or after 4 s) publishes `TWIN_OUTCOME` with
`success`, `damage_dealt`, `damage_taken`, `kills` and `duration`. That event is what the style
model learns from.

## 6. The Mirror (`game/enemy_ai/mirror.py`)

The boss reads the same `PlayerModelSnapshot`. Counters are weighted by confidence so the fight
stays fair:

| Counter | Trigger | Weight |
|---|---|---|
| kite | melee_dependency high | value × confidence |
| rush | ranged_dependency high | value × confidence |
| dodge_aoe | predicted `FLAME_BURST`/`BINDING_NOVA`, player facing the boss within cone range | prediction confidence |
| riposte | player just attacked in range, aggression high | aggression × confidence |
| predict_dash | predicted `DASH`, boss shooting | leads the shot to the dash landing |
| deny_zone | phase ≥ 2 | moves onto the player's hottest combat cell |

Low confidence → generic charge-and-strike. Each counter publishes `BOSS_COUNTER` (drawn as a
callout and a toast) so the player sees "you taught it that".

## 7. Debugging

- `F3` in the client: player profile bars (opacity = confidence), predictions, twin utilities with
  the chosen one highlighted, last outcomes, style dimensions with trend arrows and lessons, spatial
  layer counts, boss phase and counters. Heatmap cells, intent lines and enemy target lines are drawn
  on the floor.
- `apps/server/runs/*.jsonl`: every session's tick-stamped inputs and events.
  `python tools/replay/replay.py <file>` re-simulates and reports the first divergence.
- Tests: `tests/unit/test_twin_*.py`, `test_mirror_boss.py`, `test_loot.py`,
  `tests/scenarios/test_telemetry_flow.py`, `test_weapon_autonomy.py`,
  `test_twin_adaptation_scenarios.py` (the master directive's own section-31 review scenarios, all six
  now covered end to end against real telemetry), `tests/integration/test_session.py::test_full_simulation_is_deterministic`.
