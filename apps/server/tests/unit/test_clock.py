from mirrorbound.game.core.clock import SimClock


def test_advance_increments_tick():
    clock = SimClock()
    assert clock.tick == 0
    assert clock.advance() == 1
    assert clock.advance() == 2
    assert clock.tick == 2


def test_seconds_at_60hz():
    clock = SimClock(hz=60)
    for _ in range(60):
        clock.advance()
    assert clock.seconds() == 1.0


def test_snapshot_due_at_20hz_from_60hz_sim():
    clock = SimClock(hz=60)
    due_ticks = []
    for _ in range(60):
        clock.advance()
        if clock.snapshot_due(snapshot_hz=20):
            due_ticks.append(clock.tick)
    assert due_ticks == [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60]
