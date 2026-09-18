# Mirrorbound

**You play. Your twin watches. Your twin learns. Eventually, your mirror learns you well enough to fight back.**

Mirrorbound is a top-down fantasy action RPG vertical slice. You are an elf-kin wanderer searching a
haunted grove for your missing twin, accompanied by a spirit-twin that fights beside you. The
companion is a real AI: it observes how you fight, forms its own preferences from what works for
it, and chooses among competing actions every tenth of a second. The run ends at **The Mirror**, a
boss that reads your accumulated behaviour model and counters your habits, weighted by how sure it
is about them.

| | |
|---|---|
| Client | TypeScript · React 19 · Phaser 4 · Vite (`src/web`) |
| Server / game core | Python 3.12+ · FastAPI · WebSockets · Pydantic (`apps/server`) |
| Agent | Python: EWMA traits, n-gram/Markov sequence prediction, spatial heatmaps, utility AI |
| Determinism | Same seed + same tick-stamped inputs = same run. Replays are JSONL. |

## Run it

Two processes: the Python server owns the world, the browser draws it.

```bash
# 1. server (from the repo root)
cd apps/server
python -m venv .venv && .venv/Scripts/pip install -e . pytest          # Windows
# python -m venv .venv && .venv/bin/pip install -e . pytest             # macOS / Linux
.venv/Scripts/python -m uvicorn mirrorbound.api.app:create_app --factory --port 8000
```

```bash
# 2. client
cd src/web
npm install
npm run dev            # http://localhost:5173
```

Open <http://localhost:5173>. Useful URL parameters: `?seed=1234` reproduces a dungeon,
`?session=name` runs a separate game per tab, `?server=http://host:8000` points at another server.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move. Your last movement direction is your facing. |
| `Shift` | Run |
| `J` / `Space` | Attack in facing direction (sword chains three hits) |
| `1` `2` `3` `4` | Arcane Bolt · Flame Burst · Shadow Dash · Binding Nova |
| `P` / `Esc` | Pause menu |
| `I` | Inventory (player and twin tabs) |
| `K` | Skill tree |
| `F3` | AI debug overlay: player profile, prediction, twin utilities, learning, heatmaps |
| `F` | Fullscreen |

The mouse is only used for menus.

## What is in the slice

- Seven-room dungeon: entrance → combat → exploration → treasure → combat → elite → boss, built
  from handcrafted templates and seeded decoration across three biomes (grove, ruins, crypt).
- Four weapons that feel different (sword combo, bow, ember staff, frost staff), four abilities
  with mana and cooldowns, consumables, resources, relics, XP/levels and a 12-node skill tree.
- Four enemy archetypes plus elites, each with wind-up telegraphs, threat-based targeting,
  repositioning and retreat.
- Twin v0: a utility-AI companion that intercepts, protects, flanks, assists, retreats and
  explores, and a style model that learns from you and from its own outcomes.
- The Mirror: a final boss driven by the player model (kite, rush, dodge, riposte, predict-dash,
  zone denial), every counter announced on screen.
- Living environment: swaying flora, torches, ripples, motes/fireflies/embers, leaves, birds and
  ground critters with a wander/pause/flee state machine.
- Working HUD, pause, inventory, skills, settings (volumes, zoom, quality, shake, damage numbers),
  controls, death/victory screens, and synthesised audio with real volume control.

## Tests and build

```bash
cd apps/server && .venv/Scripts/python -m pytest -q     # 180+ tests: game systems, AI, contracts, determinism
cd src/web && npm run typecheck && npm run build         # strict TS + production bundle
python tools/replay/replay.py apps/server/runs/<recording>.jsonl   # re-simulate a run, diff the event log
```

## Read next

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the client, server and agent fit together.
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) — telemetry → player model → twin decisions → boss counters.
- [GAMEPLAY.md](GAMEPLAY.md) — the loop, rooms, weapons, abilities, enemies, progression.
- [INTEGRATION.md](INTEGRATION.md) — how contributor branches were audited and merged; what to do next.
- [ASSET_LICENSES.md](ASSET_LICENSES.md) — where every asset came from.
- [AGENTS.md](AGENTS.md) — rules for anyone (human or AI) committing here.
