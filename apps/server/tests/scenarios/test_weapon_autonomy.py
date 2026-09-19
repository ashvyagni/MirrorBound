"""Scenario test: the full weapon-autonomy loop through the real per-tick
session, not hand-wired pieces -- loot -> the twin's own inventory ->
AgentObservation -> TwinV0Controller.decide() -> TwinExecutor -> actually
equipped. Each stage has its own unit tests (test_loot.py,
test_twin_controller.py, test_twin_executor.py); this proves they compose.
"""

from __future__ import annotations

from mirrorbound.api.session import GameSession
from tests.conftest import combat_session, DT


def test_twin_autonomously_equips_a_looted_weapon_matching_its_learned_style():
    s = combat_session("weapon-autonomy", seed=11, record=False)
    s.state.enemies = []

    # frost_staff (the twin's starting weapon) is RANGED and SPELL-tagged;
    # hunter_bow is RANGED but not SPELL-tagged. A confident dislike of
    # SPELL-tagged weapons should make hunter_bow win once it's owned,
    # without needing to touch preferred_range at all (both weapons are
    # equally "ranged", so that axis alone wouldn't differentiate them).
    for i in range(40):
        s.style.get("spell_preference").update(0.0, 0.2, i)

    assert s.state.twin.inventory.equipped_weapon == "frost_staff"

    s.state.spawn_pickup("weapon", s.state.twin.position, item_id="hunter_bow")
    for _ in range(60):  # 1 second of real ticks -- well past the 6-tick decision interval
        s.step(DT)

    assert "hunter_bow" in s.state.twin.inventory.weapons
    assert s.state.twin.inventory.equipped_weapon == "hunter_bow"


def _armed_fight(player_weapon: str | None, ticks: int = 2600, seed: int = 9):
    """A whole fight with a bow on the floor, the player fighting a given way."""
    from mirrorbound.game.entities.entity import Vec2

    s = GameSession("autonomy", seed=seed, record=False)
    st = s.state
    st.twin.awaken(st.player.position, "T")
    st.enemies = []
    if player_weapon:
        st.player.inventory.add_weapon(player_weapon)
        st.player.inventory.equip(player_weapon)
    st.spawn_pickup("weapon", st.twin.position + Vec2(-160, 0), item_id="hunter_bow")
    bag = st.spawn_enemy("slime", st.player.position + Vec2(300, 0))
    bag.max_health = bag.health = 10**9
    st.player.face(Vec2(1, 0))
    for _ in range(ticks):
        p = st.player
        p.attack_cooldown = 0
        p.mana = p.max_mana
        p.health = p.max_health
        if p.state in ("hurt", "dead", "drink", "channel"):
            p.state = "idle"
        s.combat.process_player_attack(st)
        s.step(DT)
        bag.health = 10**9
    return s


def test_the_twin_fetches_a_weapon_it_does_not_own_during_a_fight():
    """It could never do this before.

    The only intent that walks to a pickup required the room to be clear
    first, and weapons drop during fights -- so over a 4000-tick run the twin
    ended with the one staff it started with, every time, and its weapon
    choice had nothing to choose between.
    """
    s = _armed_fight(None)
    assert "hunter_bow" in s.state.twin.inventory.weapons


def test_which_weapon_it_settles_on_follows_the_player_it_learned_from():
    """frost_staff is RANGED and SPELL; hunter_bow is RANGED only. So the
    choice between them is really "how magical is this player"."""
    assert _armed_fight("ember_staff").state.twin.inventory.equipped_weapon == "frost_staff"
    assert _armed_fight("hunter_bow").state.twin.inventory.equipped_weapon == "hunter_bow"


def test_it_does_not_go_shopping_while_the_player_is_in_trouble():
    from mirrorbound.game.entities.entity import Vec2
    from mirrorbound.agent.twin.controller import TwinV0Controller

    s = GameSession("autonomy-danger", seed=9, record=False)
    st = s.state
    st.twin.awaken(st.player.position, "T")
    st.enemies = []
    st.spawn_pickup("weapon", st.twin.position + Vec2(-160, 0), item_id="hunter_bow")
    st.spawn_enemy("sprout", st.player.position + Vec2(40, 0))
    st.player.health = st.player.max_health * 0.3     # hurt

    # Only while there is still a fight on. Once the room is clear, walking
    # over to the loot is the right thing to do at any health.
    during_fight = set()
    orig = TwinV0Controller.decide
    def spy(self, obs):
        intent = orig(self, obs)
        if obs.enemies:
            during_fight.add(intent.intent_type)
        return intent
    TwinV0Controller.decide = spy
    try:
        for _ in range(240):
            st.player.health = st.player.max_health * 0.3
            s.step(DT)
    finally:
        TwinV0Controller.decide = orig
    assert during_fight, "the twin must have been deciding during the fight at all"
    assert "EXPLORE" not in during_fight, "fetching a bow while its twin is being killed"
