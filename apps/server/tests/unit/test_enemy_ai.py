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
    twin.awaken(s.state.player.position, "Twin")
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


# --- the three families that had art and no archetype ------------------------

def test_the_three_new_families_exist_and_are_reachable():
    """Art for these shipped long before any server def did.

    Twelve atlases sat in `public/game` that nothing could ever spawn. The
    point of the check is the second half: an archetype nothing references
    from a spawn table is the same problem one step along.
    """
    from mirrorbound.game.dungeon.templates import TEMPLATES
    from mirrorbound.game.entities.enemy import ARCHETYPES

    spawnable = {
        spec.enemy_type
        for templates in TEMPLATES.values()
        for template in templates
        for spec in template.spawns
    }
    for family in ("spitter", "sprout", "shardling"):
        assert family in ARCHETYPES, f"{family} has art but no archetype"
        assert family in spawnable, f"{family} exists but no room ever spawns it"


def test_the_shardling_is_the_only_spread_shot():
    """Everything else throws one thing you can step around.

    The whole reason it earns a place is that sidestepping does not answer it.
    If something else grows a spread later this is worth revisiting, but it
    should be a decision rather than a drift.
    """
    from mirrorbound.game.entities.enemy import ARCHETYPES

    spreads = {
        eid: e.projectile.count
        for eid, e in ARCHETYPES.items()
        if e.projectile is not None and e.projectile.count > 1
    }
    assert spreads == {"shardling": 5}


def test_the_sprout_notices_you_far_later_than_anything_else():
    """Its entire contribution is that a dressed room stops reading as safe."""
    from mirrorbound.game.entities.enemy import ARCHETYPES

    sprout = ARCHETYPES["sprout"]
    # The dummy is excluded because it is not a creature: it is a post with
    # straw on it and it notices nothing at all, which would make this
    # comparison meaningless rather than wrong.
    others = [e.aggro_range for eid, e in ARCHETYPES.items()
              if eid not in ("sprout", "dummy") and not e.boss and not eid.startswith("elite_")]
    assert sprout.aggro_range < min(others) / 1.5


def test_the_spitter_outranges_every_other_enemy():
    """It is meant to be able to hurt you from off-screen, and to die to one hit."""
    from mirrorbound.game.entities.enemy import ARCHETYPES

    spitter = ARCHETYPES["spitter"]
    others = [e.attack_range for eid, e in ARCHETYPES.items() if eid != "spitter"]
    assert spitter.attack_range > max(others)
    assert spitter.health == min(e.health for e in ARCHETYPES.values() if e.id != "scarab")
