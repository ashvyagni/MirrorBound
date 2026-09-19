"""Shield, Twin Protect, and the ceiling that stops them becoming immunity."""

from __future__ import annotations

from mirrorbound.game.combat.mitigation import (
    MAX_REDUCTION,
    SHIELD_REDUCTION,
    TWIN_PROTECT_REDUCTION,
    reductions_for,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from tests.conftest import DT, combat_session


def hit(session, amount=40.0):
    return session.combat.damage_player(session.state, amount, "enemy_1", Vec2(1, 0), 0)


def test_no_sources_means_full_damage():
    s = combat_session("mit-none")
    s.state.twin.remember(TwinIntent("FOLLOW"))
    assert reductions_for(s.state, s.state.player.id) == (0.0, [])
    assert round(hit(s), 1) == 40.0


def test_shield_cuts_incoming_damage():
    s = combat_session("mit-shield")
    s.state.twin.remember(TwinIntent("FOLLOW"))
    s.state.player.apply_status("shield", 5.0)
    reduction, sources = reductions_for(s.state, s.state.player.id)
    assert sources == ["shield"] and reduction == SHIELD_REDUCTION
    assert round(hit(s), 1) == round(40.0 * (1 - SHIELD_REDUCTION), 1)


def test_twin_protect_only_counts_while_the_twin_is_near_and_protecting():
    s = combat_session("mit-protect")
    player, twin = s.state.player, s.state.twin
    twin.position = player.position + Vec2(30, 0)

    twin.remember(TwinIntent("FOLLOW"))
    assert reductions_for(s.state, player.id)[0] == 0.0

    twin.remember(TwinIntent("PROTECT"))
    assert reductions_for(s.state, player.id) == (TWIN_PROTECT_REDUCTION, ["twin_protect"])

    # Protecting from across the room is not protecting.
    twin.position = player.position + Vec2(600, 0)
    assert reductions_for(s.state, player.id)[0] == 0.0


def test_a_downed_twin_protects_nothing():
    s = combat_session("mit-downed")
    player, twin = s.state.player, s.state.twin
    twin.position = player.position + Vec2(30, 0)
    twin.remember(TwinIntent("PROTECT"))
    twin.invulnerable_for = 0.0   # awaken() grants a moment of it
    twin.take_hit(9999)
    assert twin.downed
    assert reductions_for(s.state, player.id)[0] == 0.0


def test_shield_and_protect_stack_but_never_past_the_ceiling():
    s = combat_session("mit-stack")
    player, twin = s.state.player, s.state.twin
    twin.position = player.position + Vec2(30, 0)
    twin.remember(TwinIntent("PROTECT"))
    player.apply_status("shield", 5.0)
    reduction, sources = reductions_for(s.state, player.id)
    assert set(sources) == {"shield", "twin_protect"}
    assert reduction == min(SHIELD_REDUCTION + TWIN_PROTECT_REDUCTION, MAX_REDUCTION)
    assert reduction <= MAX_REDUCTION < 1.0, "no stack may approach immunity"


def test_damage_taken_reports_what_reduced_it():
    s = combat_session("mit-report")
    s.state.twin.remember(TwinIntent("FOLLOW"))
    s.state.player.apply_status("shield", 5.0)
    hit(s)
    event = next(e for e in s.state.pending_events if e.type == "DAMAGE_TAKEN")
    # Event payloads are frozen on the way onto the bus, so the list arrives as a tuple.
    assert list(event.data["mitigatedBy"]) == ["shield"]


def test_aegis_applies_the_shield_status_and_expires():
    s = combat_session("mit-aegis")
    player = s.state.player
    player.inventory.set_slot(4, "aegis")
    player.mana = player.max_mana
    assert s.combat.process_ability(s.state, 4)
    assert "shield" in player.status_effects
    for _ in range(int(6.0 / DT)):
        player.tick_status(DT)
    assert "shield" not in player.status_effects


def test_taking_a_hit_interrupts_a_channelled_heal():
    s = combat_session("mit-interrupt")
    player = s.state.player
    player.inventory.set_slot(4, "mending_light")
    player.mana = player.max_mana
    player.health = 40
    assert s.combat.process_ability(s.state, 4)
    assert player.state == "channel"
    hit(s, 10)
    assert player.channel_ability == "" and player.state != "channel"
    assert any(e.type == "ABILITY_INTERRUPTED" for e in s.state.pending_events)
    # The heal never lands, and the mana is not refunded: that is the cost.
    for _ in range(int(1.0 / DT)):
        s.step(DT)
    assert player.health < 40 + 45


def test_an_uninterrupted_channel_heals():
    s = combat_session("mit-heal")
    player = s.state.player
    player.inventory.set_slot(4, "mending_light")
    player.mana = player.max_mana
    player.health = 40
    s.combat.process_ability(s.state, 4)
    for _ in range(int(0.8 / DT)):
        s.step(DT)
    assert player.health == 85
    assert any(e.type == "PLAYER_HEALED" for e in s.state.pending_events)
