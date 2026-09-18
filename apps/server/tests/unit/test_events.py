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


def test_nested_dict_in_event_data_is_also_immutable():
    event = Event(tick=1, type="ABILITY_CAST", data={"position": {"x": 1.0, "y": 2.0}})
    with pytest.raises(TypeError):
        event.data["position"]["x"] = 999
    assert event.data["position"]["x"] == 1.0


def test_nested_list_in_event_data_becomes_an_immutable_tuple():
    event = Event(tick=1, type="ABILITY_CAST", data={"tags": ["MELEE", "AOE"]})
    assert event.data["tags"] == ("MELEE", "AOE")
    with pytest.raises(AttributeError):
        event.data["tags"].append("BURST")


def test_deeply_nested_structure_is_also_frozen_and_the_original_cant_leak_in():
    source_tags = ["MELEE"]
    source = {"target": {"tags": source_tags, "pos": [1.0, 2.0]}}
    event = Event(tick=1, type="ABILITY_CAST", data=source)

    source_tags.append("AOE")  # mutate the original list after construction

    assert event.data["target"]["tags"] == ("MELEE",)
    assert event.data["target"]["pos"] == (1.0, 2.0)
    with pytest.raises(TypeError):
        event.data["target"]["tags"] = ("SOMETHING_ELSE",)


def test_to_json_dict_round_trips_through_json():
    import json

    event = Event(
        tick=42,
        type="ABILITY_CAST",
        data={"tags": ["MELEE", "AOE"], "position": {"x": 1.0, "y": 2.0}},
    )
    exported = event.to_json_dict()

    assert exported == {
        "tick": 42,
        "type": "ABILITY_CAST",
        "data": {"tags": ["MELEE", "AOE"], "position": {"x": 1.0, "y": 2.0}},
    }
    # Must actually be plain dict/list, not MappingProxyType/tuple, or json.dumps fails.
    round_tripped = json.loads(json.dumps(exported))
    assert round_tripped == exported
