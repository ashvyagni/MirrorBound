"""JSONL replay recorder.

One line per record:

    {"kind": "meta",  "seed": 123, "session": "..."}
    {"kind": "input", "tick": 42, "data": {...InputMessage/CommandMessage...}}
    {"kind": "event", "tick": 42, "type": "DAMAGE_DEALT", "data": {...}}

Because the simulation is deterministic, the `input` lines alone are enough to
re-run the session (see tools/replay/replay.py); the `event` lines are what the
re-run is checked against.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import IO

from mirrorbound.game.core.events import Event


class ReplayRecorder:
    def __init__(self, session_id: str, seed: int, directory: str | os.PathLike | None = None, enabled: bool = True):
        self.enabled = enabled
        self.path: Path | None = None
        self._fh: IO[str] | None = None
        if not enabled:
            return
        root = Path(directory) if directory else Path(__file__).resolve().parents[2] / "runs"
        root.mkdir(parents=True, exist_ok=True)
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
        self.path = root / f"{safe}_{seed}.jsonl"
        self._fh = self.path.open("w", encoding="utf-8")
        self._write({"kind": "meta", "seed": seed, "session": session_id})

    def _write(self, record: dict) -> None:
        if self._fh is None:
            return
        self._fh.write(json.dumps(record, separators=(",", ":")) + "\n")

    def record_input(self, tick: int, data: dict) -> None:
        self._write({"kind": "input", "tick": tick, "data": data})

    def record_events(self, events: list[Event]) -> None:
        for e in events:
            d = e.to_json_dict()
            self._write({"kind": "event", "tick": d["tick"], "type": d["type"], "data": d["data"]})
        if self._fh is not None:
            self._fh.flush()

    def close(self) -> None:
        if self._fh is not None:
            self._fh.close()
            self._fh = None
