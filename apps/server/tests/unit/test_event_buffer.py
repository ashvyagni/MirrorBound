from mirrorbound.agent.telemetry.event_buffer import EventBuffer
from mirrorbound.game.core.events import Event


def test_buffer_is_bounded_to_its_capacity():
    buffer = EventBuffer(capacity=3)
    for i in range(10):
        buffer.append(Event(tick=i, type="X"))
    assert len(buffer) == 3
    assert [e.tick for e in buffer.recent()] == [7, 8, 9]


def test_recent_defaults_to_oldest_first_full_history():
    buffer = EventBuffer(capacity=10)
    for i in range(3):
        buffer.append(Event(tick=i, type="X"))
    assert [e.tick for e in buffer.recent()] == [0, 1, 2]


def test_recent_with_count_returns_only_the_tail():
    buffer = EventBuffer(capacity=10)
    for i in range(5):
        buffer.append(Event(tick=i, type="X"))
    assert [e.tick for e in buffer.recent(2)] == [3, 4]


def test_clear_empties_the_buffer():
    buffer = EventBuffer(capacity=10)
    buffer.append(Event(tick=1, type="X"))
    buffer.clear()
    assert len(buffer) == 0
