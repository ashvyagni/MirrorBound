from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import combat_session, DT, events_of


def boss_session():
    s = combat_session("boss", seed=42, record=False)
    s.state.enemies = []
    boss = s.state.spawn_enemy("mirror", s.state.player.position + Vec2(150, 0))
    s.state.pending_events.clear()
    return s, boss


def confident(name: str, value: float, conf: float = 0.9) -> dict:
    return {"traits": {name: {"value": value, "confidence": conf}}, "predictions": [], "spatial": {}}


def run(s, boss, ticks):
    for _ in range(ticks):
        s.state.tick += 1
        s.mirror_controller.update(DT, boss, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
        s.state.player.update(DT)


def test_confident_melee_player_gets_kited():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("melee_dependency", 0.95)
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 90)
    assert boss.distance_to(s.state.player) > d0
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "kite" in counters


def test_unknown_player_gets_generic_charge():
    s, boss = boss_session()
    s.mirror_controller.player_model = {"traits": {}, "predictions": []}
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 60)
    assert boss.distance_to(s.state.player) < d0
    assert "kite" not in [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]


def test_predicted_aoe_makes_the_boss_sidestep():
    s, boss = boss_session()
    s.state.player.face(Vec2(1, 0))
    s.mirror_controller.player_model = {"traits": {}, "predictions": [{"token": "FLAME_BURST", "confidence": 0.8}]}
    run(s, boss, 20)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "dodge_aoe" in counters


def test_confident_ranged_player_gets_rushed():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("ranged_dependency", 0.95)
    s.state.player.position = boss.position + Vec2(300, 0)
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 30)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "rush" in counters
    assert boss.distance_to(s.state.player) < d0


def test_confident_aggressive_player_gets_riposted_right_after_swinging():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("aggression", 0.95)
    s.state.player.position = boss.position - Vec2(40, 0)
    s.mirror_controller.note_player_attack(s.state.tick)
    run(s, boss, 5)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "riposte" in counters
    assert boss.state.value == "attack"


def test_predicted_dash_makes_the_boss_lead_its_shot():
    s, boss = boss_session()
    s.mirror_controller.player_model = {
        "traits": {}, "predictions": [{"token": "SHADOW_DASH", "confidence": 0.8}],
    }
    # Mid-range: close enough for the opportunistic ranged attack, far enough
    # that the windup resolves as a ranged shot rather than a melee swing.
    s.state.player.position = boss.position - Vec2(200, 0)
    s.state.player.last_move_dir = Vec2(-1, 0)
    run(s, boss, 40)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "predict_dash" in counters


def test_phase_two_denies_the_players_favourite_combat_cell():
    s, boss = boss_session()
    boss.health = boss.max_health * 0.5  # hp fraction 0.5 -> phase 2 (phase 1 is > 0.6)
    s.mirror_controller.player_model = {
        "traits": {}, "predictions": [],
        "spatial": {"combat": [{"cell": [50, 50], "weight": 5.0}]},
    }
    s.state.player.position = boss.position + Vec2(300, 0)
    run(s, boss, 3)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "deny_zone" in counters
    assert boss.state.value == "reposition"
    assert boss.reposition_target is not None


def test_boss_kill_completes_the_run():
    # The Mirror is only in its own area; the first dungeon ends at an elite.
    s = combat_session("bossrun", seed=42, start_area="mirror_sanctum")
    boss_room = s.dungeon.rooms[-1]
    s._enter_room(boss_room, from_side="south")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    boss.health = 1
    s.state.player.position = boss.position - Vec2(40, 0)
    s.state.player.face(Vec2(1, 0))
    s.state.player.attack_cooldown = 0
    assert s.combat.process_player_attack(s.state)
    assert not boss.active
    s.step(DT)
    assert s.state.phase == "victory"
    assert events_of(s, "RUN_COMPLETE") or any(e.type == "RUN_COMPLETE" for e in s.state.bus._buffer)
