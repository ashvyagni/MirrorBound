from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.enemy import EnemyState
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import DT, events_of


def setup(kind: str, offset: Vec2):
    s = GameSession("ai", seed=5, record=False)
    s.state.enemies = []
    e = s.state.spawn_enemy(kind, s.state.player.position + offset)
    s.state.pending_events.clear()
    return s, e


def drive(s: GameSession, e, ticks: int):
    for _ in range(ticks):
        s.enemy_controller.update(DT, e, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
        s.state.player.update(DT)


def test_idle_enemy_far_away_wanders_and_does_not_engage():
    s, e = setup("skeleton", Vec2(600, 0))
    drive(s, e, 240)
    assert e.state in (EnemyState.IDLE, EnemyState.WANDER)
    assert e.target_id is None


def test_melee_enemy_detects_chases_winds_up_and_hits():
    s, e = setup("skeleton", Vec2(200, 0))
    start = e.position.copy()
    drive(s, e, 30)
    assert e.state is EnemyState.CHASE and e.position.x < start.x
    hp = s.state.player.health
    drive(s, e, 240)
    assert s.state.player.health < hp
    assert events_of(s, "ENEMY_ATTACKED")
    assert any(ev.data["hit"] for ev in events_of(s, "ENEMY_ATTACKED"))


def test_ranged_enemy_keeps_distance_and_shoots():
    s, e = setup("archer", Vec2(180, 0))
    drive(s, e, 200)
    assert any(p.faction == "enemy" for p in s.state.projectiles) or events_of(s, "PROJECTILE_HIT") or events_of(s, "DAMAGE_TAKEN")
    # It should not have closed to melee distance.
    assert e.distance_to(s.state.player) > 80


def test_fast_enemy_darts_out_after_biting():
    s, e = setup("hound", Vec2(150, 0))
    seen_reposition = False
    for _ in range(300):
        drive(s, e, 1)
        if e.state is EnemyState.REPOSITION and e.reposition_target is not None:
            seen_reposition = True
            break
    assert seen_reposition


def test_hitting_an_enemy_pulls_its_aggro_toward_the_attacker():
    s, e = setup("skeleton", Vec2(150, 0))
    twin = s.state.twin
    twin.position = s.state.player.position + Vec2(150, 140)
    e.take_hit(10, twin.id)
    drive(s, e, 5)
    assert e.target_id == twin.id


def test_low_health_fragile_enemy_retreats():
    s, e = setup("skeleton", Vec2(120, 0))
    e.health = e.max_health * 0.1
    e.hits_taken = 3
    drive(s, e, 3)
    assert e.state is EnemyState.RETREAT
