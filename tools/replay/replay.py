#!/usr/bin/env python3
"""Re-simulate a recorded run and check it against the recorded events.

    python tools/replay/replay.py apps/server/runs/web-abc123_1234.jsonl

The recorder (apps/server/mirrorbound/replay/recorder.py) writes tick-stamped
inputs and every published event. Because the simulation is deterministic,
feeding the same inputs at the same ticks into a fresh GameSession must
reproduce the same event log. This tool does exactly that and reports the first
divergence, which is the fastest way to find a non-deterministic change.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

from mirrorbound.api.session import GameSession  # noqa: E402
from mirrorbound.game.core.clock import SIM_HZ  # noqa: E402


def load(path: Path) -> tuple[dict, dict[int, list[dict]], list[dict]]:
    meta: dict = {}
    inputs: dict[int, list[dict]] = defaultdict(list)
    events: list[dict] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            record = json.loads(line)
            kind = record.get("kind")
            if kind == "meta":
                meta = record
            elif kind == "input":
                inputs[int(record["tick"])].append(record["data"])
            elif kind == "event":
                events.append(record)
    return meta, inputs, events


def replay(path: Path, verbose: bool = False) -> int:
    meta, inputs, recorded = load(path)
    seed = int(meta["seed"])
    last_tick = max([*inputs.keys(), *(e["tick"] for e in recorded)], default=0)
    session = GameSession(f"replay:{path.stem}", seed=seed, record=False)
    dt = 1.0 / SIM_HZ

    produced: list[dict] = []
    for tick in range(0, last_tick + 1):
        # Inputs were recorded against the tick *before* the step that consumed them.
        for message in inputs.get(tick, []):
            session.handle_input(message)
        session.step(dt)
        produced.extend(e.to_json_dict() for e in session.state.drain_events())

    def key(e: dict) -> tuple:
        return (e["tick"], e["type"], json.dumps(e["data"], sort_keys=True))

    recorded_keys = [key(e) for e in recorded]
    produced_keys = [key(e) for e in produced]
    matched = 0
    for a, b in zip(recorded_keys, produced_keys):
        if a != b:
            break
        matched += 1

    print(f"seed {seed}: replayed {last_tick} ticks, {len(produced)} events produced, {len(recorded)} recorded")
    counts = Counter(e["type"] for e in produced)
    for name, n in sorted(counts.items(), key=lambda kv: -kv[1])[:12]:
        print(f"  {name:<22} {n}")
    if matched == len(recorded_keys) == len(produced_keys):
        print("OK: event log reproduced exactly")
        return 0
    print(f"DIVERGED after {matched} matching events")
    if matched < len(recorded_keys):
        print("  recorded:", recorded_keys[matched][:2], recorded_keys[matched][2][:160])
    if matched < len(produced_keys):
        print("  produced:", produced_keys[matched][:2], produced_keys[matched][2][:160])
    if verbose:
        for e in produced[matched: matched + 5]:
            print("   ", e)
    return 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("recording", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    raise SystemExit(replay(args.recording, args.verbose))


if __name__ == "__main__":
    main()
