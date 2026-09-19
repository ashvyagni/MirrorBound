# AGENTS.md

Rules for anyone — human or AI — committing to this repo. If a change conflicts with
something here, the change is wrong, not this file (propose an edit to this file first).

## The one rule

> Python owns truth. Phaser displays truth. Agent recommends actions. Game executes actions.

The browser is a presentation layer, not a second copy of the simulation. Input goes
browser -> WebSocket -> Python simulation -> authoritative state -> snapshot -> browser
render. Never let client-side code decide outcomes (damage, hits, collisions, loot) —
it only renders what the server already decided.

## Dependency direction (enforced, not a suggestion)

```
               CONTRACTS
                /       \
           CLIENT        SERVER
                          /    \
                      GAME    AGENT
                        ^        ^
                        └ EVENTS ┘
```

- `game/` never imports FastAPI, WebSocket, or anything client-side.
- `agent/` never directly mutates `GameState` — it only produces an `Intent`/prediction
  that the game layer chooses whether and how to apply.
- `api/` translates network messages and calls into `game/`; it holds no game logic.
- `client/` sends input commands and renders snapshots; it holds no authoritative logic.
- Combat/movement/etc. code never imports the agent. It publishes an event
  (`EventBus.publish`) and lets the agent's telemetry subscriber react. See
  `apps/server/mirrorbound/game/core/events.py`.

## Determinism is mandatory

Same `run_seed` + same tick-stamped inputs must always produce the same final state and
the same event log. This is what makes replay, debugging, and regression testing
possible — see `apps/server/tests/integration/test_determinism.py` for the shape that
proof takes.

- Never call `random.random()` / bare `random.*` anywhere in `game/` or `agent/`. Every
  random decision goes through a `DeterministicRNG` (`apps/server/mirrorbound/game/core/rng.py`).
- Independent systems (combat, dungeon generation, loot, ...) each get their own
  `rng.spawn("label")` sub-stream, so one system's RNG usage can't perturb another's and
  call order between systems doesn't affect the sequence either sees.
- Never use Python's built-in `hash()` on strings for anything that needs to be stable
  across process runs — `str` hashing is randomized per-process (`PYTHONHASHSEED`) unless
  explicitly disabled, which would silently break replay across server restarts. Use
  `zlib.crc32` or `hashlib` instead.
- Time-based decay (prediction confidence, trait staleness, anything with a "half-life")
  is calibrated in real seconds via an explicit `half_life_seconds` + the sim's tick rate,
  never as a raw per-tick multiplier chosen by feel. A per-tick fraction that looks
  reasonable (e.g. `0.98`) can imply a sub-second half-life at 60Hz and forget everything
  almost immediately — always compute back from "how long, in seconds, should this matter?"
- Anything published on the `EventBus` must be effectively immutable once published —
  `Event.data` is a `MappingProxyType` over a copy for exactly this reason. One subscriber
  mutating shared state before another sees it is an order-dependent bug and breaks replay.

## What we explicitly do not build

No Unity/Godot/Unreal. No multiplayer. No LLM in the gameplay loop. No cloud AI
dependency. No per-player neural network training. No traditional RL training pipeline.
No full ECS framework. No microservices, Redis, Kafka, Postgres (SQLite is enough),
Kubernetes, or a custom binary protocol (JSON over WebSocket is fine — the world isn't
big enough to need delta-compression). This is one vertical slice, not an MMO.

Use plain dataclasses for entities (Player, Twin, Enemy, ...), not a full ECS.

## Testing requirements

- Unit tests for anything with real logic (damage, movement, RNG, prediction, traits,
  heatmaps, utility scoring).
- An integration or scenario test whenever a change crosses a system boundary (e.g.
  telemetry -> player model -> prediction).
- Determinism-sensitive code (RNG, decay, replay) needs a test that proves the actual
  contract: same seed + same inputs -> same output. A test that only exercises one call
  in isolation isn't enough on its own.
- Before changing shared primitives (`game/core/*`), run the full suite:
  ```bash
  cd apps/server && .venv/Scripts/python -m pytest -q     # or: uv run pytest -q
  ```
- Whole-simulation determinism is proven by `tests/integration/test_session.py`; if you change
  anything in `game/` or `agent/`, that test must still pass, and a recorded run under
  `apps/server/runs/` replayed with `tools/replay/replay.py` will tell you exactly where you
  diverged.

## Git / branch safety

- `main` stays stable. Work happens on feature branches (`feat/...`) or per-person
  branches during early scaffolding.
- Before an agent changes anything: `git status`, check recent log, understand what's
  already there. Never `git reset --hard`, delete unmerged branches, or overwrite
  unrelated files to make your own change land faster.
- Prefer new commits over amending, except to fix an unpushed commit's own mistake
  (e.g. a missing required trailer) before anyone else has based work on it.

## Team ownership boundaries (see project doc for the full rationale)

- Frontend/game design: `src/web/` (Phaser/React). The world is drawn from snapshots only.
- Deterministic simulation + probabilistic modeling: `apps/server/mirrorbound/game/`
  (core/entities/movement/combat/dungeon/progression) and the modeling half of
  `apps/server/mirrorbound/agent/` (telemetry, features, player_model, prediction,
  patterns, spatial).
- AI agent decision-making: the decision half of `apps/server/mirrorbound/agent/`
  (`agent/twin/` twin policy + style, `game/enemy_ai/mirror.py` boss counter-policy). The
  reference implementation is `TwinV0Controller`; replace it behind the `TwinController` protocol.
- Wire contracts: `apps/server/mirrorbound/contracts/` and `src/web/src/game/contracts.ts` change
  together, with `docs/contracts/*.md`.

Crossing one of these boundaries in a PR is fine when the change genuinely needs it,
but call it out explicitly rather than quietly expanding scope.

## Definition of done

1. Tests exist and pass (`uv run pytest -q` from `apps/server`).
2. No dependency-direction violation introduced (see above).
3. Determinism preserved for anything touching `game/core`, `agent/prediction`, or
   `game/core/events.py`.
4. Commit message explains *why*, not just *what* — the diff already shows what changed.
