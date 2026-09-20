import pytest

from mirrorbound.game.combat.abilities import get_ability
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player, PlayerInput

DT = 1 / 60


def test_facing_follows_last_meaningful_movement_not_mouse():
    p = Player(id="player_1")
    p.apply_input(DT, PlayerInput(move_x=0, move_y=-1, aim_angle=2.0))
    assert (p.facing.x, p.facing.y) == (0, -1)
    p.apply_input(DT, PlayerInput(move_x=1, move_y=1))
    assert p.facing.x == pytest.approx(0.7071, abs=1e-3) and p.facing.y == pytest.approx(0.7071, abs=1e-3)
    # Standing still keeps the last facing.
    p.apply_input(DT, PlayerInput())
    assert p.facing.x == pytest.approx(0.7071, abs=1e-3)
    assert p.velocity.is_zero()


def test_run_is_faster_than_walk_and_states_follow():
    p = Player(id="player_1")
    p.apply_input(DT, PlayerInput(move_x=1))
    walk = p.velocity.length()
    p.update(DT)
    assert p.state == "walk"
    p.apply_input(DT, PlayerInput(move_x=1, run=True))
    assert p.velocity.length() > walk
    p.update(DT)
    assert p.state == "run"


def test_ability_gating_cooldown_and_mana():
    p = Player(id="player_1")
    bolt = get_ability("arcane_bolt")
    ok, _ = p.can_use_ability(bolt)
    assert ok
    p.start_ability(bolt)
    ok, reason = p.can_use_ability(bolt)
    assert not ok and reason == "cooldown"
    p.mana = 0
    nova = get_ability("binding_nova")
    ok, reason = p.can_use_ability(nova)
    assert not ok and reason == "mana"
    # cooldown ticks down and the HUD dict exposes it
    for _ in range(80):
        p.update(DT)
    assert p.ability_cooldowns.get("arcane_bolt", 0) == 0 or p.ability_cooldowns["arcane_bolt"] < bolt.cooldown
    # The bar is exactly as long as what is in your hands: bare-handed it is
    # the dash alone, a sword adds its pair, and a staff adds three more --
    # which is why the bar runs to six keys rather than four.
    assert [s["slot"] for s in p.abilities_to_dict()] == [1]
    p.inventory.add_weapon("iron_sword")
    assert [s["slot"] for s in p.abilities_to_dict()] == [1, 2]
    p.inventory.add_weapon("frost_staff")
    assert [s["slot"] for s in p.abilities_to_dict()] == [1, 2, 3, 4, 5]


def test_dash_moves_in_facing_direction_and_grants_invulnerability():
    p = Player(id="player_1")
    p.apply_input(DT, PlayerInput(move_x=-1))
    p.begin_dash(p.facing, distance=190, duration=0.28, invuln=0.28)
    assert p.state == "dash" and p.invulnerable_for > 0
    assert p.dash_velocity.x < 0
    assert p.take_damage(50) == 0.0  # invulnerable while dashing
    for _ in range(30):
        p.update(DT)
    assert p.state != "dash"


def test_xp_levels_up_and_grants_skill_points():
    p = Player(id="player_1")
    gained = p.add_xp(10_000)
    assert len(gained) >= 3
    assert p.level == 1 + len(gained)
    assert p.skill_points == len(gained)
    assert p.max_health > 100
    ok, _ = p.unlock_skill("vitality")
    assert ok and "vitality" in p.unlocked_skills and p.skill_points == len(gained) - 1


def test_lethal_hit_enters_dead_state_and_respawn_restores():
    p = Player(id="player_1")
    p.take_hit(500)
    assert p.state == "dead" and p.health == 0 and p.deaths == 1
    p.respawn(Vec2(100, 100))
    assert p.state == "idle" and p.health == p.max_health and p.position.x == 100
