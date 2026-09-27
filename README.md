<p align="center">
  <img src="assets/logo.png" alt="MirrorBound Logo" width="300" />
</p>

# MirrorBound

**You play. Your twin watches. Your twin learns. Eventually, your mirror fights back.**

MirrorBound is a single-player action-RPG where your playstyle shapes your ultimate challenge. Built around a dynamic utility-AI companion that learns from your actions and outcomes, your "twin" adapts to how you fight, move, and survive. In the end, the final boss uses your accumulated habits against you.

---

## 🎮 Play the Game
- **Frontend (Vercel):** [Coming Soon - Add Vercel Link]
- **Backend (Render):** [Coming Soon - Add Render Link]

---

## 🚀 Key Features

- **Adaptive AI Twin:** A rescued twin that fights alongside you. It learns your behavior through continuous pattern detection, spatial heatmaps, and decaying sequence predictions.
- **A companion that looks after itself:** It keeps the potions it walks over, holds a quarter-share of the gold it picks up, and spends it — walking to a merchant, buying its own flasks, drinking them when it is hurt and eating when it is hungry. *When* it drinks is copied from the health you drink at; how much it carries is learned from going down with an empty pack.
- **One continuous world:** Eight regions you cross on foot, joined at named crossings — the Rootbridge, Ewesford, the Long Causeway, Kell's ferry, the Windgate, the Cut through the rock. Two of the eight are off the campaign's spine entirely. Villages stand *inside* regions, so you come over the ridge and walk in with nothing loading.
- **Three dungeon archetypes:** Combat, puzzle and mirror dungeons that differ in what opens the far door — clear the room, work out what opens it, or both at once. Branching side rooms, keys and plates.
- **Four bosses before the last one:** The Stonecount, the Kiln Shardmother and the Ashen Warden each run a three-phase, fully telegraphed ladder. Only the Mirror reads your behaviour model — that premise belongs to the ending.
- **Mining, and a forge that changes what a weapon is for:** Eight materials in the ground, placed by the terrain you are standing on. Trained, they buy attributes; fitted into a weapon, they make it heavier, faster, sharper or armour-splitting. Every one is a trade rather than an upgrade.
- **Two progression layers that need each other:** Levels buy a skill tree, ore buys five attributes, and the tree's deep tiers are gated on the attributes — so 20 levels of skill points cannot finish a tree on their own.
- **Relic stones with a floor under the luck:** Seven stones at 1/200, 1/1000 and 1/10000, socketed into a fully worked weapon. A saved drought counter per tier turns "vanishingly rare" into a number a test can check, and each regional boss awards a tier-3 outright.
- **A wild that lives in itself:** Cows and sheep to hunt, tigers and wolves that hunt you, a pasture and a tundra that are not on the way to anything, and a hunger bar that drains on how far you walk and how much you swing — never on the clock.
- **Quests and a codex:** Four side quests that exist to explain the world, and a codex that fills in as you find it out.

---

## 🏗️ Architecture

MirrorBound is designed with a strict separation of concerns, ensuring determinism and scalable AI integration.

- **Frontend (TypeScript, React, Phaser 3):** Deployed on **Vercel**. The browser serves exclusively as a presentation layer. It renders snapshots and forwards user input, but holds no authoritative game logic.
- **Backend (Python 3.12+, FastAPI, WebSocket):** Deployed on **Render**. The Python server owns the ground truth for movement, combat, loot, and progression. The AI agent runs as an independent layer, subscribing to the simulation's event bus to analyze telemetry and issue commands without mutating the game state directly.

---

## 🛠️ Local Development Setup

To run MirrorBound locally, you'll need two terminal windows—one for the Python server and one for the frontend client.

### Prerequisites
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js (22.22.2+, 24.15+, or 26+) and npm

**Postgres is optional.** It stores accounts and nothing else — the simulation lives in
memory and progression is checkpointed to JSON files — so the server starts without one
and says so in its log. Sign-in is unavailable until you start it; everything else works:

```bash
docker compose up -d db
```

### 1. Start the Server (Backend)
```bash
cd apps/server
uv sync
uv run uvicorn mirrorbound.api.app:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Client (Frontend)
```bash
cd src/web
npm ci
npm run dev
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) to play. 

---

## 🎮 Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move |
| `Shift` | Run |
| Mouse position | Aim attacks and spells |
| `J` / `Space` | Basic attack |
| `1`–`4` | Abilities from carried weapons |
| `Q` | Swap weapons |
| `E` | Interact: talk to an NPC, or mine the ore vein you are standing next to |
| `F` / `G` | Health / mana potion |
| `I` / `K` / `C` / `M` | Inventory / Skills and attributes / Character / Map |
| `L` | Journal: quests and the codex |
| `P` / `Esc` | Pause |

---

## 📚 Technical Documentation

Dive deeper into MirrorBound's architecture and design:
- [FEATURE_STATUS.md](FEATURE_STATUS.md) — Release inventory and remaining work.
- [ARCHITECTURE.md](ARCHITECTURE.md) — Core system design.
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) — Modeling, utility decisions, and boss counters.
- [GAMEPLAY.md](GAMEPLAY.md) — Gameplay and mechanic design.
- [docs/v1.1-audit-and-roadmap.md](docs/v1.1-audit-and-roadmap.md) — The v1.1 expansion audit and plan.
- [docs/v1.2-design.md](docs/v1.2-design.md) — The v1.2 expansion: mining, attributes, stones, hunger and the twin's autonomy.
- [docs/playtest-results.md](docs/playtest-results.md) — Measured difficulty, and what the probe cannot tell us.
- [docs/perf-baseline.md](docs/perf-baseline.md) — Simulation cost, before and after the bigger world.
- [AGENTS.md](AGENTS.md) — Codebase contribution rules.

---

*Developed for Vinhack*
