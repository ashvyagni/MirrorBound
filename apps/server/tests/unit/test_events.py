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
