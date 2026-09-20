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
from tests.conftest import arm, DT, combat_session


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
    # Aegis is the sword's first: you get the shield by carrying the sword.
    arm(s, "iron_sword")
    player.mana = player.max_mana
    assert s.combat.process_ability(s.state, 1)
    assert "shield" in player.status_effects
    for _ in range(int(6.0 / DT)):
        player.tick_status(DT)
    assert "shield" not in player.status_effects


def test_taking_a_hit_interrupts_a_channelled_heal():
    s = combat_session("mit-interrupt")
    player = s.state.player
    # Mending Light is the bow's second.
    arm(s, "hunter_bow")
    player.mana = player.max_mana
    player.health = 40
    assert s.combat.process_ability(s.state, 2)
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
    # Mending Light is the bow's second.
    arm(s, "hunter_bow")
    player.mana = player.max_mana
    player.health = 40
    s.combat.process_ability(s.state, 2)
    for _ in range(int(0.8 / DT)):
        s.step(DT)
    assert player.health == 85
    assert any(e.type == "PLAYER_HEALED" for e in s.state.pending_events)


def test_a_parry_refreshes_the_ward_without_refunding_it():
    """Blocking makes the ward ready again; it does not make it free.

    The status still runs out on its own timer and raising it again still
    costs mana, so mana -- not the cooldown -- is what stops a player who is
    being hit constantly from holding a shield forever.
    """
    from mirrorbound.game.entities.entity import Vec2
    from tests.conftest import combat_session, events_of

    s = combat_session("parry", seed=3)
    p = s.state.player
    enemy = s.state.spawn_enemy("skeleton", p.position + Vec2(40, 0))
    s.state.pending_events.clear()

    # The ward is applied directly rather than cast: empty hands put the dash
    # in slot 1, and dashing would make the player invulnerable to the very hit
    # this test is about.
    p.mana = p.max_mana
    p.apply_status("shield", 5.0)
    p.ability_cooldowns["aegis"] = 14.0
    p.ability_cooldown_max["aegis"] = 14.0
    mana_after_raising = p.mana
    duration_before = p.status_effects["shield"]

    s.combat.damage_player(s.state, 40, enemy.id, Vec2(1, 0), 0)

    parried = events_of(s, "PLAYER_PARRIED")
    assert parried and "aegis" in parried[0].data["refreshed"]
    assert "aegis" not in p.ability_cooldowns, "the ward is ready again"
    assert p.mana == mana_after_raising, "but the mana is not handed back"
    assert p.status_effects["shield"] == duration_before, "nor is the ward extended"


def test_an_unshielded_hit_is_not_a_parry():
    from mirrorbound.game.entities.entity import Vec2
    from tests.conftest import combat_session, events_of

    s = combat_session("noparry", seed=3)
    enemy = s.state.spawn_enemy("skeleton", s.state.player.position + Vec2(40, 0))
    s.state.player.ability_cooldowns["aegis"] = 14.0
    s.state.pending_events.clear()
    s.combat.damage_player(s.state, 40, enemy.id, Vec2(1, 0), 0)
    assert not events_of(s, "PLAYER_PARRIED")
    assert s.state.player.ability_cooldowns["aegis"] == 14.0
