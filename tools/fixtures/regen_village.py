#!/usr/bin/env python3
"""Regenerate `src/web/tests/fixtures/village.json` from the live server.

The HUD tests drive themselves from a recorded snapshot, which is the right shape
of test -- it means the interface is exercised against something the server
actually produced rather than against a hand-written object that agrees with the
client by construction.

The cost is that the recording goes stale, silently. When v1.2 added `hunger` to
the player and `veins` to the snapshot, the fixture kept passing while describing
a game that no longer existed: the client's typecheck does not reach the test
fixtures, so nothing said so.

So the recording is generated rather than maintained. Run this after changing the
wire contract:

    apps/server/.venv/bin/python tools/fixtures/regen_village.py

It stands the player in the opening village, steps the simulation far enough for
the first detail snapshot, and writes the result. Deterministic: same seed, same
file, so a regeneration that changes anything is a contract change worth reading
in the diff.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

from mirrorbound.game.world import save as save_system  # noqa: E402

# Never write over a real run's saves while recording.
save_system.SAVE_DIR = Path(__file__).resolve().parent / "_fixture_saves"

from mirrorbound.api.session import GameSession  # noqa: E402

OUT = ROOT / "src" / "web" / "tests" / "fixtures" / "village.json"
SEED = 7


def main() -> int:
    session = GameSession("fixture-village", seed=SEED, record=False)
    player = session.state.player
    # A player with something in the bag, so the inventory, bench and journal
    # screens have rows to draw. The fixture is the HUD's only stage.
    player.inventory.add_weapon("iron_sword")
    player.inventory.equip("iron_sword")
    player.inventory.add_consumable("health_potion", 3)
    player.inventory.add_consumable("mana_potion", 2)
    player.inventory.add_consumable("cooked_meat", 2)
    player.inventory.add_material("iron", 6)
    player.inventory.add_material("coal", 4)
    player.inventory.add_stone("cinder_shard")
    player.inventory.add_gold(180)
    player.attributes.grant(3)
    player.attributes.spend("vigour")

    # Walk the player next to the smith, which is what the dialogue test expects
    # the interact prompt to find.
    smith = next(n for n in session.state.room.npcs
                 if n.definition.role == "weaponsmith")
    player.position = type(player.position)(smith.x, smith.y + 40)

    # Far enough for a detail snapshot (inventory, tree, attributes ride those).
    snapshot = None
    for _ in range(80):
        session.step(1.0 / 60.0)
        candidate = session.snapshot()
        if candidate.get("detail") and candidate.get("roomFull"):
            snapshot = candidate
    if snapshot is None:
        print("no detail snapshot was produced", file=sys.stderr)
        return 1

    # Events are per-tick noise and the tests raise their own; a recorded list
    # would just be whatever happened in the eightieth tick.
    snapshot["events"] = []
    OUT.write_text(json.dumps(snapshot, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
