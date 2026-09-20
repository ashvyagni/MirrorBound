from mirrorbound.game.combat.abilities import (
    ABILITIES,
    DEFAULT_SLOTS,
    AbilityType,
    get_ability,
    get_ability_by_slot,
)
from mirrorbound.game.combat.weapons import WEAPONS, canonical_weapon_ids, get_weapon


def test_empty_hands_still_leave_you_the_dash():
    """With nothing equipped there is nothing to cast, but somewhere to be."""
    assert DEFAULT_SLOTS == ("shadow_dash",)
    assert ABILITIES["shadow_dash"].type is AbilityType.DASH
    assert get_ability_by_slot(1, DEFAULT_SLOTS) is ABILITIES["shadow_dash"]
    assert get_ability_by_slot(2, DEFAULT_SLOTS) is None


def test_every_weapon_grants_abilities_that_are_real_and_fit_the_bar():
    """The moveset is what you are carrying.

    A weapon grants two or three, and the two hands together have to stay
    inside the six ability keys -- otherwise carrying the wrong pair would
    quietly make a spell unreachable rather than merely inconvenient. Every id
    has to resolve: a weapon granting an ability that does not exist would be a
    bar with a hole in it.
    """
    carried = []
    for weapon_id in canonical_weapon_ids():
        weapon = get_weapon(weapon_id)
        if weapon_id == "bare_hands":
            assert weapon.abilities == ()
            continue
        assert 2 <= len(weapon.abilities) <= 3, weapon_id
        carried.append(len(weapon.abilities))
        for ability in weapon.abilities:
            assert ability in ABILITIES, f"{weapon_id} grants unknown {ability}"
    assert max(carried) + sorted(carried)[-2] <= 6, "the fullest two hands still fit"


def test_the_sword_is_guard_and_go():
    """The opening weapon teaches the two defensive buttons."""
    assert get_weapon("iron_sword").abilities == ("aegis", "shadow_dash")


def player_abilities():
    """Every ability something the player can hold actually grants.

    Not `ABILITIES.values()`: that registry also holds the Mirror's own two,
    and those are not on any weapon, never reach a hotbar and have no mana to
    cost -- enemies have no mana pool. Deriving the list from the weapons is
    what keeps this test about the thing it is checking, which is that anything
    the player can press is drawable and priced.
    """
    from mirrorbound.game.combat.weapons import WEAPONS

    return {
        get_ability(name)
        for weapon in WEAPONS.values()
        for name in weapon.abilities
    }


def test_every_player_ability_has_hud_fields_and_cost():
    for ability in player_abilities():
        assert ability.icon and ability.name and ability.description
        assert ability.cooldown > 0
        assert ability.cost > 0, f"{ability.id} is free"
        assert ability.slot > 0, f"{ability.id} has no hotbar slot"
        d = ability.to_dict()
        assert d["id"] == ability.id and d["slot"] == ability.slot


def test_every_ability_is_drawable_and_has_a_cooldown():
    """Including the boss's, which still have to be named, iconed and paced."""
    for ability in ABILITIES.values():
        assert ability.icon and ability.name and ability.description
        assert ability.cooldown > 0


def test_the_bosss_own_abilities_are_not_on_any_weapon():
    """They are the Mirror's, and taking its weapon must not grant them.

    If one ever leaks onto a weapon the player would get a free, mana-less
    ability with no hotbar slot, which is the kind of thing that works fine
    until someone wonders why a bow can cast Sundering.
    """
    from mirrorbound.game.combat.weapons import WEAPONS

    granted = {name for weapon in WEAPONS.values() for name in weapon.abilities}
    assert "mirror_nova" not in granted
    assert "mirror_volley" not in granted


def test_weapon_families_are_genuinely_different():
    ids = canonical_weapon_ids()
    assert {"iron_sword", "hunter_bow", "ember_staff", "frost_staff"} <= set(ids)
    sword, bow, ember, frost = (get_weapon(w) for w in ("iron_sword", "hunter_bow", "ember_staff", "frost_staff"))
    assert sword.is_melee and len(sword.combo_chain) == 3
    assert not bow.is_melee and bow.projectile is not None and bow.projectile.aoe_radius == 0
    # A staff bashes on M1. Its element is in the three spells it grants, which
    # is what stops it being a wand you hold down.
    assert ember.is_melee and ember.projectile is None and ember.resource_cost == 0
    assert frost.is_melee and frost.projectile is None and frost.resource_cost == 0
    assert len(ember.abilities) == 3 and len(frost.abilities) == 3
    ember_bolt, frost_bolt = ABILITIES["ember_bolt"], ABILITIES["frost_bolt"]
    assert ember_bolt.projectile is not None and ember_bolt.projectile.aoe_radius > 0
    assert frost_bolt.projectile is not None and frost_bolt.projectile.slow > 0
    # The staves are still told apart by their reach and their cadence.
    assert frost.cooldown < ember.cooldown and frost.range > ember.range
    # Legacy aliases still resolve.
    assert WEAPONS["sword"] is sword and WEAPONS["fire_staff"] is ember


def test_every_carried_weapon_maps_to_a_client_swing_sheet():
    """`animation` names the sheet the client hangs on the player.

    Empty hands name none, and must not: naming "sword" there drew a full iron
    blade in the hands of a player who has not found one yet, for the whole
    opening village. Everything you can actually carry still has to have one.
    """
    for wid in canonical_weapon_ids():
        weapon = get_weapon(wid)
        expected = {""} if wid == "bare_hands" else {"sword", "bow", "fireStaff", "iceStaff"}
        assert weapon.animation in expected, wid
