import pytest

from mirrorbound.game.core.events import Event, EventBus


def test_typed_subscriber_only_gets_matching_events():
    bus = EventBus()
    received = []
    bus.subscribe("ENEMY_KILLED", received.append)

    bus.publish(Event(tick=1, type="PLAYER_MOVED"))
    bus.publish(Event(tick=2, type="ENEMY_KILLED", data={"enemy": "enemy_7"}))

    assert len(received) == 1
    assert received[0].data["enemy"] == "enemy_7"


def test_wildcard_subscriber_gets_every_event():
    bus = EventBus()
    received = []
    bus.subscribe_all(received.append)

    bus.publish(Event(tick=1, type="PLAYER_MOVED"))
    bus.publish(Event(tick=2, type="ENEMY_KILLED"))

    assert [e.type for e in received] == ["PLAYER_MOVED", "ENEMY_KILLED"]


def test_drain_returns_events_in_order_and_clears_buffer():
    bus = EventBus()
    bus.publish(Event(tick=1, type="A"))
    bus.publish(Event(tick=2, type="B"))

    drained = bus.drain()
    assert [e.type for e in drained] == ["A", "B"]
    assert bus.drain() == []


def test_event_data_cannot_be_mutated_by_a_subscriber():
    # A subscriber mutating `data` in place would make later subscribers, telemetry,
    # and replay see a different event than earlier ones did — order-dependent
    # behavior that would break deterministic replay.
    event = Event(tick=1, type="ENEMY_DAMAGED", data={"amount": 10})
    with pytest.raises(TypeError):
        event.data["amount"] = 999
    assert event.data["amount"] == 10


def test_event_data_is_copied_so_the_caller_cant_mutate_it_after_the_fact():
    source = {"amount": 10}
    event = Event(tick=1, type="ENEMY_DAMAGED", data=source)
    source["amount"] = 999
    assert event.data["amount"] == 10
