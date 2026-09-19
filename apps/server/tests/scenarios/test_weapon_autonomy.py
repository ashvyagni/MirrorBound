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
