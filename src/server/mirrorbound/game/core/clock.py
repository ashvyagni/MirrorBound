"""Fixed-timestep simulation clock — 60 Hz per the locked architecture (section 6)."""

from __future__ import annotations

SIM_HZ = 60
SNAPSHOT_HZ = 20


class SimClock:
    def __init__(self, hz: int = SIM_HZ) -> None:
        self.hz = hz
        self.dt = 1.0 / hz
        self.tick: int = 0

    def advance(self) -> int:
        self.tick += 1
        return self.tick

    def seconds(self) -> float:
        return self.tick * self.dt

    def snapshot_due(self, snapshot_hz: int = SNAPSHOT_HZ) -> bool:
        interval = max(1, self.hz // snapshot_hz)
        return self.tick % interval == 0
