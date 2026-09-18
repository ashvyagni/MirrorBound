from mirrorbound.agent.observation import AgentObservation, EntitySnapshot, PickupSnapshot, RoomSnapshot
from mirrorbound.agent.twin.controller import TwinV0Controller
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.contracts.messages import TwinIntentModel
from mirrorbound.game.entities.entity import Vec2


def ent(id_: str, x: float, y: float, role: str = "melee", hp: float = 50, max_hp: float = 50, **kw) -> EntitySnapshot:
    return EntitySnapshot(id=id_, position=Vec2(x, y), health=hp, max_health=max_hp, velocity=Vec2(), role=role, **kw)


def obs(player: EntitySnapshot, twin: EntitySnapshot, enemies=(), **kw) -> AgentObservation:
    return AgentObservation(
        tick=100, player_state=player, twin_state=twin, enemies=list(enemies),
        room_context=RoomSnapshot("combat", 1280, 960), twin_weapon_range=340, twin_weapon_is_melee=False, **kw,
    )


def test_no_enemies_means_follow_and_the_output_validates_against_the_contract():
    c = TwinV0Controller()
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90))
    intent = c.decide(o)
    assert intent.intent_type == "FOLLOW"
    assert intent.position is not None
    assert set(intent.utilities) >= {"FOLLOW", "ATTACK", "RETREAT", "INTERCEPT", "PROTECT", "FLANK", "REPOSITION"}
    TwinIntentModel.model_validate(intent.to_dict())


def test_low_health_twin_retreats():
    c = TwinV0Controller()
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 12, 90),
            [ent("enemy_1", 420, 470)])
    intent = c.decide(o)
    assert intent.intent_type == "RETREAT"
    assert intent.confidence > 0.5


def test_enemy_winding_up_on_player_triggers_intercept():
    c = TwinV0Controller()
    threat = ent("enemy_1", 440, 400, "melee", target_id="player_1", winding_up=True, windup=0.3)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 300, 500, "twin", 90, 90), [threat])
    intent = c.decide(o)
    assert intent.intent_type == "INTERCEPT" and intent.target_id == "enemy_1"


def test_player_target_is_assisted_when_twin_is_healthy():
    c = TwinV0Controller()
    target = ent("enemy_7", 700, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7")
    intent = c.decide(o)
    assert intent.intent_type in ("ASSIST", "ATTACK", "FLANK")
    assert intent.target_id == "enemy_7"


def test_isolated_enemy_is_attacked_and_learned_aggression_raises_utility():
    passive, aggressive = TwinStyleModel(), TwinStyleModel()
    for i in range(40):
        aggressive.get("aggression").update(1.0, 0.2, i)
        passive.get("aggression").update(0.0, 0.2, i)
    lone = ent("enemy_2", 520, 380)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [lone])
    a = TwinV0Controller(aggressive).decide(o)
    p = TwinV0Controller(passive).decide(o)
    assert a.utilities["ATTACK"] > p.utilities["ATTACK"]
    assert a.intent_type == "ATTACK"


def test_swarmed_player_gets_protected_and_fragile_player_gets_distraction():
    c = TwinV0Controller()
    swarm = [ent(f"enemy_{i}", 430 + i * 20, 400, target_id="player_1") for i in range(3)]
    o = obs(ent("player_1", 400, 400, "player", 30, 100), ent("twin_1", 380, 460, "twin", 90, 90), swarm)
    intent = c.decide(o)
    assert intent.intent_type in ("PROTECT", "DISTRACT", "INTERCEPT")
    assert intent.target_id is not None


def test_far_twin_repositions_and_cleared_room_explores_pickups():
    c = TwinV0Controller()
    far = obs(ent("player_1", 900, 400, "player", 100, 100), ent("twin_1", 100, 400, "twin", 90, 90))
    assert c.decide(far).intent_type == "REPOSITION"
    c2 = TwinV0Controller()
    loot = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
               pickups=[PickupSnapshot("pickup_1", "essence", Vec2(500, 500))])
    intent = c2.decide(loot)
    assert intent.intent_type == "EXPLORE" and intent.position == Vec2(500, 500)


def test_decisions_are_deterministic():
    o = obs(ent("player_1", 400, 400, "player", 60, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_1", 500, 400, target_id="player_1"), ent("enemy_2", 300, 700, "ranged")])
    a = TwinV0Controller().decide(o).to_dict()
    b = TwinV0Controller().decide(o).to_dict()
    assert a == b


def test_predicted_aoe_pushes_the_twin_to_flank_instead_of_standing_in_it():
    model = {"predictions": [{"token": "FLAME_BURST", "confidence": 0.8}]}
    target = ent("enemy_7", 520, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7", player_model=model)
    intent = TwinV0Controller().decide(o)
    assert intent.utilities["FLANK"] > intent.utilities["ASSIST"]
