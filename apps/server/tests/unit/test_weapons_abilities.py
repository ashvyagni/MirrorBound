from mirrorbound.game.combat.abilities import ABILITIES, DEFAULT_SLOTS, AbilityType, get_ability_by_slot
from mirrorbound.game.combat.weapons import WEAPONS, canonical_weapon_ids, get_weapon


def test_four_abilities_fill_four_slots_with_distinct_types():
    assert len(DEFAULT_SLOTS) == 4
    types = {ABILITIES[a].type for a in DEFAULT_SLOTS}
    assert types == {AbilityType.PROJECTILE, AbilityType.CONE, AbilityType.DASH, AbilityType.NOVA}
    for slot in range(1, 5):
        ability = get_ability_by_slot(slot)
        assert ability is not None and ability.slot == slot
    assert get_ability_by_slot(5) is None


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
