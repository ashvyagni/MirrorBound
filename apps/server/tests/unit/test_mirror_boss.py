from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import DT, events_of


def boss_session():
    s = GameSession("boss", seed=42, record=False)
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


def test_boss_kill_completes_the_run():
    s = GameSession("bossrun", seed=42, record=False)
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
