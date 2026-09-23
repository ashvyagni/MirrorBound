from mirrorbound.agent.spatial.zones import SpatialModel
from mirrorbound.game.core.events import Event


def test_record_routes_a_melee_attack_into_combat_and_melee_layers():
    model = SpatialModel(half_life_seconds=float("inf"))
    event = Event(
        tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "position": [1.0, 1.0]}
    )
    model.record(event)

    assert model.layers["combat"].weight_at(1.0, 1.0, tick=1) == 1.0
    assert model.layers["melee"].weight_at(1.0, 1.0, tick=1) == 1.0
    assert model.layers["retreat"].weight_at(1.0, 1.0, tick=1) == 0.0


def test_record_without_position_is_skipped_entirely():
    model = SpatialModel()
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]})
    model.record(event)

    assert len(model.layers["combat"]) == 0


def test_record_with_no_matching_layer_updates_nothing():
    model = SpatialModel()
    event = Event(tick=1, type="ENEMY_KILLED", data={"position": [0.0, 0.0]})
    model.record(event)

    assert all(len(layer) == 0 for layer in model.layers.values())


def test_snapshot_reports_top_cells_per_layer():
    model = SpatialModel(half_life_seconds=float("inf"))
    for _ in range(5):
        model.record(
            Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "position": [1.0, 1.0]})
        )
    model.record(
        Event(tick=1, type="PLAYER_RETREATED", data={"position": [50.0, 50.0]})
    )

    snap = model.snapshot(tick=1)
    assert snap["combat"][0][1] == 5.0
    assert snap["retreat"][0][1] == 1.0
    assert snap["dodge"] == []


def test_to_json_dict_is_plain_and_json_serializable():
    import json

    model = SpatialModel(half_life_seconds=float("inf"))
    model.record(Event(tick=1, type="PLAYER_DODGED", data={"position": [3.0, 4.0]}))

    exported = model.to_json_dict(tick=1)
    assert exported["dodge"] == [{"cell": list(model.layers["dodge"].cell_of(3.0, 4.0)), "weight": 1.0}]
    json.dumps(exported)  # must not raise
