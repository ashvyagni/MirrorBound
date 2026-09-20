"""Potions: a drink is an action with a cost, not an inventory click."""

from __future__ import annotations

from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import DRINK_SECONDS, POTION_SHARED_COOLDOWN
from tests.conftest import DT, combat_session


def drink(session, item_id="health_potion"):
    session.handle_input({"type": "COMMAND", "action": "USE_ITEM", "itemId": item_id})
    session.step(DT)


def finish_drink(session):
    for _ in range(int(DRINK_SECONDS / DT) + 2):
        session.step(DT)


def test_health_potion_restores_40_after_the_drink_finishes():
    s = combat_session("potion-heal")
    p = s.state.player
    p.health = 40
    p.inventory.add_consumable("health_potion")
    drink(s)
    assert p.state == "drink" and p.health == 40
    finish_drink(s)
    assert p.health == 80 and p.inventory.consumables.get("health_potion", 0) == 0


def test_mana_potion_restores_35():
    s = combat_session("potion-mana")
    p = s.state.player
    p.mana = 10
    p.inventory.add_consumable("mana_potion")
    drink(s, "mana_potion")
    finish_drink(s)
    assert round(p.mana) >= 45


def test_drinking_slows_movement_and_blocks_attack_cast_and_dash():
    s = combat_session("potion-lock")
    p = s.state.player
    p.health = 10
    p.inventory.add_consumable("health_potion")
    drink(s)
    assert p.state == "drink"
    assert not p.can_attack()
    for slot in (1, 2, 3, 4):
        ability = p.ability_in_slot(slot)
        if ability is not None:
            assert p.can_use_ability(ability) == (False, "drinking")
    # Movement continues, at a fraction of the usual speed.
    from mirrorbound.game.entities.player import DRINK_SLOW, PlayerInput

    p.apply_input(DT, PlayerInput(move_x=1))
    assert 0 < p.velocity.length() <= p.speed * DRINK_SLOW + 0.01


def test_one_shared_cooldown_covers_both_potions():
    s = combat_session("potion-cd")
    p = s.state.player
    p.health, p.mana = 10, 5
    p.inventory.add_consumable("health_potion")
    p.inventory.add_consumable("mana_potion")
    drink(s)
    finish_drink(s)
    # The cooldown starts when the drink lands, so a few ticks of it are
    # already gone by the time the loop above returns.
    assert 0 < p.potion_cooldown <= POTION_SHARED_COOLDOWN
    # The other potion is refused while that cooldown runs.
    ok, reason = p.can_drink("mana_potion", {"mana": 35})
    assert not ok and reason == "cooldown"


def test_drinking_at_full_is_refused_rather_than_wasted():
    s = combat_session("potion-full")
    p = s.state.player
    p.inventory.add_consumable("health_potion")
    ok, reason = p.can_drink("health_potion", {"heal": 40})
    assert not ok and reason == "health full"
    drink(s)
    assert p.inventory.consumables["health_potion"] == 1 and p.state != "drink"


def test_death_mid_drink_consumes_nothing():
    s = combat_session("potion-death")
    p = s.state.player
    p.health = 30
    p.inventory.add_consumable("health_potion")
    drink(s)
    assert p.state == "drink"
    p.take_hit(9999)
    s.step(DT)
    assert p.state == "dead"
    assert p.inventory.consumables["health_potion"] == 1, "an interrupted drink is not consumed"
    assert p.drink_item == ""


def test_a_drink_that_finishes_while_the_stock_is_gone_is_refused():
    s = combat_session("potion-stock")
    p = s.state.player
    p.health = 10
    p.inventory.add_consumable("health_potion")
    drink(s)
    # Something else spent the potion during the 0.4 seconds.
    p.inventory.consumables.clear()
    finish_drink(s)
    assert p.health == 10
    assert any(e.type == "ACTION_REJECTED" for e in s.state.pending_events)


def test_enemies_cannot_be_hit_while_the_player_is_drinking():
    s = combat_session("potion-noattack")
    p = s.state.player
    p.health = 10
    p.inventory.add_consumable("health_potion")
    enemy = s.state.spawn_enemy("skeleton", p.position + Vec2(30, 0))
    drink(s)
    before = enemy.health
    assert not s.combat.process_player_attack(s.state)
    assert enemy.health == before
