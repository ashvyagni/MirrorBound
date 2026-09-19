from mirrorbound.game.combat.abilities import ABILITIES, DEFAULT_SLOTS, AbilityType, get_ability_by_slot
from mirrorbound.game.combat.weapons import WEAPONS, canonical_weapon_ids, get_weapon


def test_empty_hands_still_leave_you_the_dash():
    """With nothing equipped there is nothing to cast, but somewhere to be."""
    assert DEFAULT_SLOTS == ("shadow_dash",)
    assert ABILITIES["shadow_dash"].type is AbilityType.DASH
    assert get_ability_by_slot(1, DEFAULT_SLOTS) is ABILITIES["shadow_dash"]
    assert get_ability_by_slot(2, DEFAULT_SLOTS) is None


def test_every_weapon_grants_two_abilities_and_they_are_real():
    """The moveset is what you are carrying.

    Two per weapon, so the two hands fill the four ability keys exactly, and
    every id has to resolve -- a weapon granting an ability that does not exist
    would be a bar with a hole in it.
    """
    for weapon_id in canonical_weapon_ids():
        weapon = get_weapon(weapon_id)
        if weapon_id == "bare_hands":
            assert weapon.abilities == ()
            continue
        assert len(weapon.abilities) == 2, weapon_id
        for ability in weapon.abilities:
            assert ability in ABILITIES, f"{weapon_id} grants unknown {ability}"


def test_the_sword_is_guard_and_go():
    """The opening weapon teaches the two defensive buttons."""
    assert get_weapon("iron_sword").abilities == ("aegis", "shadow_dash")


def test_every_ability_has_hud_fields_and_cost():
    for ability in ABILITIES.values():
        assert ability.icon and ability.name and ability.description
        assert ability.cooldown > 0
        assert ability.cost > 0
        d = ability.to_dict()
        assert d["id"] == ability.id and d["slot"] == ability.slot


def test_weapon_families_are_genuinely_different():
    ids = canonical_weapon_ids()
    assert {"iron_sword", "hunter_bow", "ember_staff", "frost_staff"} <= set(ids)
    sword, bow, ember, frost = (get_weapon(w) for w in ("iron_sword", "hunter_bow", "ember_staff", "frost_staff"))
    assert sword.is_melee and len(sword.combo_chain) == 3
    assert not bow.is_melee and bow.projectile is not None and bow.projectile.aoe_radius == 0
    assert ember.projectile is not None and ember.projectile.aoe_radius > 0
    assert frost.projectile is not None and frost.projectile.slow > 0
    # Legacy aliases still resolve.
    assert WEAPONS["sword"] is sword and WEAPONS["fire_staff"] is ember


def test_every_weapon_maps_to_a_client_swing_sheet():
    for wid in canonical_weapon_ids():
        assert get_weapon(wid).animation in {"sword", "bow", "fireStaff", "iceStaff"}
