# Mirrorbound

**You play. Your twin watches. Your twin learns. Eventually, your mirror fights back.**

Mirrorbound **0.1.0** is an initial playable single-player action-RPG vertical slice, built with
Python, FastAPI, TypeScript, React and Phaser. The Python simulation owns movement, combat,
loot and progression. The browser renders its snapshots. A local utility-AI companion learns
from your actions and its own outcomes; the final boss counters your accumulated habits.

This is an early release with known integration and polish work remaining. See
[FEATURE_STATUS.md](FEATURE_STATUS.md) for the current feature inventory, verified fixes,
and prioritized issues. Older integration documents describe earlier development stages.

## Run locally

Requires Python 3.12+, [uv](https://docs.astral.sh/uv/), and Node.js 22.22.2+, 24.15+, or 26+ with npm.
Run these in separate terminals from the repository root:

```bash
cd apps/server
uv sync
uv run uvicorn mirrorbound.api.app:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

`--reload` matters more than it looks. The browser is only a view, so a server
running yesterday's code answers today's client perfectly politely -- it just
rejects every command it has never heard of as an unknown action, which reads
in the game as a button that does nothing rather than as a stale process.

```bash
cd src/web
npm ci
npm run dev
```

Open [the game](http://127.0.0.1:5173/). The browser remembers its default checkpoint identity
and adds it to the URL; reloading keeps the same save. Use `?session=player` to select a named save.
If two tabs open the same session, the newest tab takes over and the older one stops reconnecting.
`?seed=1234&session=test` starts a fresh reproducible run and deliberately ignores checkpoints.
An alternate server can be selected with `?server=ws://127.0.0.1:8000` (use `wss://` for TLS).

Saves live in `apps/server/saves/`; replay recordings live in `apps/server/runs/`. Both are local,
gitignored data. Checkpoints preserve progression, not the exact fight or learned AI model.
This repository does not currently include a packaged executable or a hosted game service.

Menus pause the simulation and suppress gameplay input; closing preserves any earlier manual pause.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move |
| `Shift` | Run |
| Mouse position | Aim attacks and spells |
| `J` / `Space` | Basic attack |
| `1`–`4` | Abilities supplied by your two carried weapons |
| `Q` | Swap equipped and offhand weapons |
| `E` | Talk to a nearby NPC; click dialogue to advance, `Esc` to leave |
| `F` / `G` | Health / mana potion |
| `R`, then `H` | Cycle the potion dial, then drink the selected potion |
| `T` | Call the available twin to regroup/follow for three seconds |
| `I` / `K` / `C` / `M` | Inventory / skills / character / map |
| `P` / `Esc` | Pause or resume; Escape also closes menus |
| `F3` | AI debug overlay |
| `\` | Command console |

Settings and key rebinding are available through the canvas settings button. Pickups collect
on contact; walk into unlocked doors and portals to travel. Some menu/input behavior still
needs consolidation; details are in the feature audit.

## In this release

- Five areas: Hollow Reach, Wakewood Crypt, Emberfall, the Ashen Deep and Mirror Sanctum.
  Two villages and thirteen dungeon rooms across grove, ruins and crypt environments.
- Four NPC roles with authored dialogue, quest flags, names, weapon/potion/relic shops,
  and a hearth that restores health and mana and writes a checkpoint.
- An unarmed opening, a guaranteed entrance sword, four equipable weapons, eight weapon-granted
  abilities, two carried weapons, potions, gold, resources, three relics and twelve skill nodes.
- Seven ordinary enemy archetypes, elite variants, the Ashen Warden guardian and the Mirror boss.
- A rescued twin with ten utility choices, independent weapon selection, imitation and outcome
  learning; player traits, decaying sequence predictions, pattern detection and spatial heatmaps.
- Drawn character, enemy, world and HUD atlases, directional villagers, ambient life, particles,
  synthesized audio, canvas inventory/skills/map/settings, and React dialogue and character screens.
- Deterministic simulation tests and a JSONL recording/replay checker.

## Validate

```bash
cd apps/server
uv run pytest -q
```

```bash
cd src/web
npm test
npm run typecheck
npm run lint
npm run build
```

Replay a fresh recorded run with the server environment:

```bash
cd apps/server
uv run python ../../tools/replay/replay.py runs/<recording>.jsonl
```

## Code and design

- [FEATURE_STATUS.md](FEATURE_STATUS.md) — release inventory and remaining work.
- [PLAYTEST_RESULTS.md](PLAYTEST_RESULTS.md) — repeatable combat probes and measured limits.
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design.
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) — modeling, utility decisions and boss counters.
- [GAMEPLAY.md](GAMEPLAY.md) — gameplay design; some older descriptions need updating.
- [docs/contracts](docs/contracts/) — snapshot and telemetry documentation.
- [ASSET_LICENSES.md](ASSET_LICENSES.md) — recorded asset provenance.
- [INTEGRATION.md](INTEGRATION.md) — historical contributor integration notes.
- [AGENTS.md](AGENTS.md) — repository rules.
