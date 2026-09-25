"""Measure the simulation, so §29's optimisation work has a before.

The brief says to profile first and optimise only what measurement flags. This
is the measurement: it drives real `GameSession`s at a fixed timestep with no
network and no browser, and reports what one tick costs and how big a snapshot
is.

Those two numbers are the ones the expansion puts pressure on. The tick budget
at 60 Hz is 16.67 ms and every creature, projectile and AI decision spends
against it; the snapshot is JSON over a WebSocket at 20 Hz, and a much larger
region means a much larger `roomFull` payload on every transition.

Run it before and after a phase that adds world content:

    uv run python ../../tools/perf/baseline.py            # from apps/server
    uv run python ../../tools/perf/baseline.py --json      # machine-readable
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

# Importable when run from anywhere: the server package is a sibling of tools/.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

from mirrorbound.api.session import GameSession  # noqa: E402
from mirrorbound.game.core.clock import SIM_HZ  # noqa: E402
from mirrorbound.game.world import save as save_system  # noqa: E402

DT = 1.0 / SIM_HZ
TICK_BUDGET_MS = 1000.0 / SIM_HZ

#: Scenes worth measuring, and why each one.
#:
#: A village is the quiet case and the one the overworld regions are modelled
#: on. The opening dungeon is the ordinary fight. The Sanctum is the worst case
#: the game currently has: the boss runs a counter-policy over the whole player
#: model every tick.
SCENES: tuple[tuple[str, str], ...] = (
    ("hollow_reach", "a village: no enemies, many props, the overworld's shape"),
    ("wakewood_crypt", "the opening dungeon: an ordinary fight"),
    ("mirror_sanctum", "the Mirror: the heaviest AI in the game"),
)


def measure(area: str, ticks: int) -> dict:
    """Drive one area and time its ticks and its snapshot."""
    # Saves are per-machine run state; a measurement must not write over a run.
    save_system.SAVE_DIR = Path(__file__).resolve().parent / "_perf_saves"
    session = GameSession(f"perf-{area}", seed=4242, record=False, start_area=area)

    # Room 0 of every dungeon is its entrance, which is empty. Measuring there
    # measures an empty room and reports a tenth of a percent of the budget --
    # true, and useless, because the cost this is watching for is creatures and
    # the AI that drives them. Walk to the first room that has a fight in it.
    if session.dungeon is not None:
        for room in session.dungeon.rooms:
            if room.enemy_spawns:
                session._enter_room(room, None)
                break

    # The twin is found partway through the first dungeon, and it is one of the
    # more expensive things in the tick: an observation built and a controller
    # asked every sixth tick. A baseline without it understates every scene.
    twin = session.state.twin
    if twin.dormant:
        twin.awaken(session.state.player.position, session.campaign.twin_name)
        session.campaign.rescue_twin()

    # Entering the boss room starts the Sanctum's scene, and a scene owns every
    # tick it runs for -- so timing during it times the cutscene, not the boss.
    guard = 0
    while session.cutscene is not None and guard < 4000:
        session.step(DT)
        guard += 1

    # Hold the load steady for the whole measurement.
    #
    # Left alone, the scene collapses: the twin kills most of the room and the
    # idle player dies, and a dead player short-circuits `step` — so the timings
    # would be of an empty room again, just less obviously. Topping both up each
    # tick keeps every creature alive and deciding, which is the load worth
    # measuring. Nothing here is a gameplay change; it is a harness.
    player, twin = session.state.player, session.state.twin
    peak_foes = len(session.state.get_active_enemies())

    samples: list[float] = []
    for _ in range(ticks):
        player.health = player.max_health
        twin.health = twin.max_health
        for enemy in session.state.get_active_enemies():
            enemy.health = enemy.max_health
        peak_foes = max(peak_foes, len(session.state.get_active_enemies()))
        start = time.perf_counter()
        session.step(DT)
        samples.append((time.perf_counter() - start) * 1000.0)

    # The full room rides the snapshot only on a transition, so both are worth
    # knowing: the lite one is the steady-state cost, the full one the spike.
    session.room_dirty = True
    full = session.snapshot()
    session.room_dirty = False
    lite = session.snapshot()

    ordered = sorted(samples)
    room = session.state.room
    return {
        "area": area,
        "ticks": ticks,
        "tick_ms": {
            "mean": round(statistics.fmean(samples), 4),
            "median": round(statistics.median(samples), 4),
            "p95": round(ordered[int(len(ordered) * 0.95)], 4),
            "max": round(max(samples), 4),
        },
        "budget_used_pct": round(statistics.fmean(samples) / TICK_BUDGET_MS * 100, 2),
        "snapshot_kb": {
            "full": round(len(json.dumps(full)) / 1024, 1),
            "lite": round(len(json.dumps(lite)) / 1024, 1),
        },
        "world": {
            "room": f"{room.width}x{room.height}",
            "tiles": len(room.tiles) * (len(room.tiles[0]) if room.tiles else 0),
            "decor": len(room.decor),
            "enemies": peak_foes,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ticks", type=int, default=600, help="ticks per scene (default 600 = 10s)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = ap.parse_args()

    results = [measure(area, args.ticks) for area, _ in SCENES]

    if args.json:
        print(json.dumps({"tickBudgetMs": round(TICK_BUDGET_MS, 3), "scenes": results}, indent=2))
        return 0

    print(f"\nMirror Bound simulation baseline — {SIM_HZ} Hz, {TICK_BUDGET_MS:.2f} ms/tick budget")
    print(f"{'scene':<16} {'mean':>7} {'p95':>7} {'max':>7} {'budget':>8} "
          f"{'snap full':>10} {'lite':>7} {'tiles':>7} {'decor':>6} {'foes':>5}")
    print("-" * 96)
    for r in results:
        print(f"{r['area']:<16} "
              f"{r['tick_ms']['mean']:>6.3f}m {r['tick_ms']['p95']:>6.3f}m {r['tick_ms']['max']:>6.3f}m "
              f"{r['budget_used_pct']:>7.2f}% "
              f"{r['snapshot_kb']['full']:>9.1f}K {r['snapshot_kb']['lite']:>6.1f}K "
              f"{r['world']['tiles']:>7} {r['world']['decor']:>6} {r['world']['enemies']:>5}")
    for area, why in SCENES:
        print(f"  {area:<16} {why}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
