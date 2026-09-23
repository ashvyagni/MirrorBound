"""Loot acquisition: a weapon pickup goes to whoever actually walked over it
(player or twin); everything else stays on the player regardless.
"""

from __future__ import annotations

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import combat_session, DT


def session_with_twin_and_player_apart(gap: float = 400.0) -> GameSession:
    s = combat_session("loot-test", seed=7, record=False)
    s.state.twin.position = s.state.player.position + Vec2(gap, 0)
    return s


def test_weapon_pickup_the_twin_walks_over_goes_to_the_twins_own_inventory():
    s = session_with_twin_and_player_apart()
    s.state.spawn_pickup("weapon", s.state.twin.position, item_id="ember_staff")
    s.combat.loot.update(DT, s.state)
    assert "ember_staff" in s.state.twin.inventory.weapons
    assert "ember_staff" not in s.state.player.inventory.weapons


def test_weapon_pickup_the_player_walks_over_still_goes_to_the_player():
    s = session_with_twin_and_player_apart()
    s.state.spawn_pickup("weapon", s.state.player.position, item_id="hunter_bow")
    s.combat.loot.update(DT, s.state)
    assert "hunter_bow" in s.state.player.inventory.weapons
    assert "hunter_bow" not in s.state.twin.inventory.weapons


def test_duplicate_weapon_pickup_by_the_twin_refunds_shards_to_the_player():
    s = session_with_twin_and_player_apart()
    assert "frost_staff" in s.state.twin.inventory.weapons  # the twin's starting weapon
    before_shards = s.state.player.inventory.resources.get("shards", 0)
    s.state.spawn_pickup("weapon", s.state.twin.position, item_id="frost_staff")
    s.combat.loot.update(DT, s.state)
    assert s.state.player.inventory.resources.get("shards", 0) == before_shards + 1
    # And it did NOT silently land in the twin's own (unread) shard pool.
    assert s.state.twin.inventory.resources.get("shards", 0) == 0


def test_non_weapon_pickups_still_always_go_to_the_player_even_via_the_twin():
    s = session_with_twin_and_player_apart()
    s.state.spawn_pickup("essence", s.state.twin.position, amount=3)
    s.combat.loot.update(DT, s.state)
    assert s.state.player.inventory.resources["essence"] == 3
    assert s.state.twin.inventory.resources.get("essence", 0) == 0
