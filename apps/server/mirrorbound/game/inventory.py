"""Inventories for the player and the twin.

Kept deliberately small: weapons owned, four ability slots, stackable
consumables, stackable resources, and relics (passive trinkets). The twin has
the same shape so equipment can matter to its combat behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.abilities import DEFAULT_SLOTS, get_ability
from mirrorbound.game.combat.weapons import MAX_UPGRADE, get_weapon, upgrade_cost
from mirrorbound.game.progression.materials import (
    MATERIALS, ForgeBonuses, forge_bonuses, slots_for_tier,
)


CONSUMABLES: dict[str, dict] = {
    "health_potion": {"name": "Health Potion", "heal": 40, "description": "Restores 40 health.", "rarity": "common", "price": 35},
    "mana_potion": {"name": "Mana Potion", "mana": 35, "description": "Restores 35 mana.", "rarity": "common", "price": 30},
}

RESOURCES: dict[str, dict] = {
    "essence": {"name": "Essence", "description": "Raw life force. Dropped by every enemy; fuels relic crafting later.", "rarity": "common"},
    "shards": {"name": "Mirror Shards", "description": "Fragments of the mirror. Elite enemies and chests drop them.", "rarity": "uncommon"},
    "relics": {"name": "Relics", "description": "Counted here; the relics themselves live in the relic slots.", "rarity": "rare"},
}

RELICS: dict[str, dict] = {
    "ember_heart": {"name": "Ember Heart", "description": "+10% spell damage.", "rarity": "rare", "spell_damage_mult": 0.10},
    "wolf_fang": {"name": "Wolf Fang", "description": "+10% weapon damage.", "rarity": "rare", "weapon_damage_mult": 0.10},
    "mirror_eye": {"name": "Mirror Eye", "description": "The twin learns from you 25% faster.", "rarity": "rare", "twin_learning_mult": 0.25},
}


@dataclass
class Inventory:
    weapons: list[str] = field(default_factory=list)
    equipped_weapon: str = ""
    # The second carried weapon. `equipped_weapon` is always the one that
    # actually swings -- the offhand is what SWAP_WEAPON trades it for -- so
    # every combat path still reads exactly one weapon and none of them had to
    # learn about slots.
    offhand_weapon: str = ""
    # No stored ability list. What you can cast is what you are carrying --
    # see `ability_slots` below.
    consumables: dict[str, int] = field(default_factory=dict)
    resources: dict[str, int] = field(default_factory=lambda: {"essence": 0, "shards": 0, "relics": 0})
    relics: list[str] = field(default_factory=list)
    gold: int = 0
    #: How far each weapon has been worked, by weapon id. Absent means tier 0.
    upgrades: dict[str, int] = field(default_factory=dict)
    #: Ore and fuel, by material id. Mined, never bought.
    materials: dict[str, int] = field(default_factory=dict)
    #: What is fitted into each weapon, by weapon id.
    #:
    #: A list rather than a set: two iron in one weapon is a legitimate and
    #: deliberately available choice (heavier still), and the slot count is what
    #: limits it. Order is the order they were fitted, which is what the bench
    #: shows.
    fitted: dict[str, list[str]] = field(default_factory=dict)

    # --- weapons -----------------------------------------------------------
    def add_weapon(self, weapon_id: str) -> bool:
        get_weapon(weapon_id)  # validates
        if weapon_id in self.weapons:
            return False
        self.weapons.append(weapon_id)
        if not self.equipped_weapon:
            self.equipped_weapon = weapon_id
        elif not self.offhand_weapon:
            self.offhand_weapon = weapon_id
        return True

    def remove_weapon(self, weapon_id: str) -> bool:
        if weapon_id not in self.weapons:
            return False
        self.weapons.remove(weapon_id)
        if self.equipped_weapon == weapon_id:
            self.equipped_weapon = self.offhand_weapon if self.offhand_weapon in self.weapons else next(iter(self.weapons), "")
        if self.offhand_weapon == weapon_id or self.offhand_weapon == self.equipped_weapon:
            self.offhand_weapon = ""
        return True

    def equip(self, weapon_id: str) -> bool:
        if weapon_id not in self.weapons:
            return False
        # Equipping the offhand is a swap, not an overwrite: the weapon that was
        # in hand stays carried rather than silently falling out of the pair.
        if weapon_id == self.offhand_weapon:
            self.offhand_weapon = self.equipped_weapon
        self.equipped_weapon = weapon_id
        return True

    def equip_offhand(self, weapon_id: str) -> bool:
        if weapon_id not in self.weapons or weapon_id == self.equipped_weapon:
            return False
        self.offhand_weapon = weapon_id
        return True

    def swap_weapons(self) -> bool:
        """Trade the carried pair. False when there is nothing to swap to."""
        if not self.offhand_weapon or self.offhand_weapon == self.equipped_weapon:
            return False
        self.equipped_weapon, self.offhand_weapon = self.offhand_weapon, self.equipped_weapon
        return True

    # --- upgrades --------------------------------------------------------------
    def tier(self, weapon_id: str) -> int:
        return self.upgrades.get(weapon_id, 0)

    def can_upgrade(self, weapon_id: str) -> tuple[bool, str]:
        """Whether this weapon can be worked further, and why not if it cannot."""
        if weapon_id not in self.weapons:
            return False, "not owned"
        tier = self.tier(weapon_id)
        cost = upgrade_cost(tier)
        if cost is None:
            return False, "already finished"
        if self.gold < cost["gold"]:
            return False, "not enough gold"
        if self.resources.get("shards", 0) < cost["shards"]:
            return False, "not enough shards"
        if self.resources.get("essence", 0) < cost["essence"]:
            return False, "not enough essence"
        return True, "ok"

    def upgrade(self, weapon_id: str) -> tuple[bool, str]:
        """Take the payment and raise the tier. Nothing is spent on a refusal."""
        ok, reason = self.can_upgrade(weapon_id)
        if not ok:
            return False, reason
        cost = upgrade_cost(self.tier(weapon_id))
        assert cost is not None
        self.gold -= cost["gold"]
        self.resources["shards"] = self.resources.get("shards", 0) - cost["shards"]
        self.resources["essence"] = self.resources.get("essence", 0) - cost["essence"]
        self.upgrades[weapon_id] = self.tier(weapon_id) + 1
        return True, "ok"

    def has_perk(self, weapon_id: str) -> bool:
        """Whether this weapon has been worked far enough to have its perk."""
        return self.tier(weapon_id) >= MAX_UPGRADE

    # --- materials -----------------------------------------------------------
    def add_material(self, material_id: str, count: int = 1) -> None:
        if material_id not in MATERIALS:
            raise ValueError(f"Unknown material: {material_id}")
        self.materials[material_id] = self.materials.get(material_id, 0) + count

    def material_count(self, material_id: str) -> int:
        return self.materials.get(material_id, 0)

    def has_materials(self, cost: dict[str, int]) -> bool:
        return all(self.material_count(m) >= n for m, n in cost.items())

    def spend_materials(self, cost: dict[str, int]) -> bool:
        """All or nothing. Nothing is taken unless the whole bill can be paid."""
        if not self.has_materials(cost):
            return False
        for material_id, count in cost.items():
            left = self.material_count(material_id) - count
            if left > 0:
                self.materials[material_id] = left
            else:
                self.materials.pop(material_id, None)
        return True

    # --- fitting -------------------------------------------------------------
    def forge_slots(self, weapon_id: str) -> int:
        return slots_for_tier(self.tier(weapon_id))

    def fittings(self, weapon_id: str) -> list[str]:
        return list(self.fitted.get(weapon_id, ()))

    def can_fit(self, weapon_id: str, material_id: str) -> tuple[bool, str]:
        if weapon_id not in self.weapons:
            return False, "not owned"
        material = MATERIALS.get(material_id)
        if material is None:
            return False, "unknown material"
        if material.fuel:
            return False, "that is fuel, not metal"
        if self.material_count(material_id) <= 0:
            return False, f"no {material.name.lower()}"
        if len(self.fittings(weapon_id)) >= self.forge_slots(weapon_id):
            return False, "no free slot"
        return True, "ok"

    def fit_material(self, weapon_id: str, material_id: str) -> tuple[bool, str]:
        """Work a material into a weapon. The ore is consumed either way it turns out.

        Consumed, and not refundable: `clear_fittings` empties the slots and
        gives nothing back. A forge you can undo for free is a menu you scroll
        through until the numbers are biggest, and then the choice this system
        exists to pose was never posed.
        """
        ok, reason = self.can_fit(weapon_id, material_id)
        if not ok:
            return False, reason
        if not self.spend_materials({material_id: 1}):
            return False, "not enough"
        self.fitted.setdefault(weapon_id, []).append(material_id)
        return True, "ok"

    def clear_fittings(self, weapon_id: str) -> int:
        """Melt a weapon back down to bare. Returns how many slots were emptied."""
        removed = len(self.fitted.get(weapon_id, ()))
        self.fitted.pop(weapon_id, None)
        return removed

    def forge_for(self, weapon_id: str) -> ForgeBonuses:
        fittings = self.fitted.get(weapon_id)
        if not fittings:
            return ForgeBonuses()
        try:
            family = get_weapon(weapon_id).family
        except ValueError:
            family = ""
        return forge_bonuses(fittings, family)

    # --- gold ----------------------------------------------------------------
    def add_gold(self, amount: int) -> None:
        self.gold = max(0, self.gold + int(amount))

    def spend_gold(self, amount: int) -> bool:
        if amount < 0 or self.gold < amount:
            return False
        self.gold -= amount
        return True

    # --- abilities ----------------------------------------------------------
    @property
    def ability_slots(self) -> list[str]:
        """The four ability keys, derived from the two weapons in hand.

        Keys one and two are the equipped weapon's pair; three and four are the
        offhand's. Nothing is stored, so there is no way for the bar to
        disagree with what is being held -- swapping weapons swaps the bar, and
        dropping a weapon takes its abilities with it.

        That is the whole design: what you carry decides what you can do. A
        stored loadout would make the two hands cosmetic and turn the choice of
        weapon into a damage-number comparison.

        With nothing equipped at all you still get the dash, because with no
        weapon there is nothing to cast but there is always somewhere to be
        that is not here.
        """
        slots: list[str] = []
        for weapon_id in (self.equipped_weapon, self.offhand_weapon):
            if weapon_id:
                slots.extend(get_weapon(weapon_id).abilities)
        return slots or list(DEFAULT_SLOTS)

    def weapon_granting(self, ability_id: str) -> str:
        """Which carried weapon grants this ability. Empty when neither does.

        Main hand first, so a spell held in both hands is costed against the one
        actually swinging. This exists because a fitted material belongs to a
        weapon and abilities belong to weapons -- discounting the offhand's
        spells because the *main* hand has gold in it would make the pair
        cosmetic again, which `ability_slots` went out of its way to avoid.
        """
        for weapon_id in (self.equipped_weapon, self.offhand_weapon):
            if not weapon_id:
                continue
            try:
                if ability_id in get_weapon(weapon_id).abilities:
                    return weapon_id
            except ValueError:
                continue
        return ""

    # --- stackables ----------------------------------------------------------
    def add_consumable(self, item_id: str, count: int = 1) -> None:
        if item_id not in CONSUMABLES:
            raise ValueError(f"Unknown consumable: {item_id}")
        self.consumables[item_id] = self.consumables.get(item_id, 0) + count

    def take_consumable(self, item_id: str) -> bool:
        if self.consumables.get(item_id, 0) <= 0:
            return False
        self.consumables[item_id] -= 1
        if self.consumables[item_id] == 0:
            del self.consumables[item_id]
        return True

    def add_resource(self, resource: str, amount: int) -> None:
        if resource not in RESOURCES:
            raise ValueError(f"Unknown resource: {resource}")
        self.resources[resource] = self.resources.get(resource, 0) + amount

    def add_relic(self, relic_id: str) -> None:
        if relic_id not in RELICS:
            raise ValueError(f"Unknown relic: {relic_id}")
        self.relics.append(relic_id)
        self.resources["relics"] = len(self.relics)

    def relic_bonus(self, key: str) -> float:
        return sum(float(RELICS[r].get(key, 0.0)) for r in self.relics)

    def to_dict(self) -> dict:
        return {
            "weapons": [
                {**get_weapon(w).to_dict(), "tier": self.tier(w),
                 "upgradeCost": upgrade_cost(self.tier(w)),
                 "hasPerk": self.has_perk(w),
                 "slots": self.forge_slots(w),
                 "fitted": self.fittings(w)}
                for w in self.weapons
            ],
            "equippedWeapon": self.equipped_weapon,
            "offhandWeapon": self.offhand_weapon,
            "gold": self.gold,
            "abilitySlots": list(self.ability_slots),
            "consumables": [
                {"id": cid, "count": n, **CONSUMABLES[cid]} for cid, n in sorted(self.consumables.items())
            ],
            "resources": dict(self.resources),
            "materials": [
                {"id": mid, "count": self.materials[mid], "name": MATERIALS[mid].name,
                 "tier": MATERIALS[mid].tier, "description": MATERIALS[mid].description,
                 "fuel": MATERIALS[mid].fuel}
                for mid in sorted(self.materials, key=lambda m: (MATERIALS[m].tier, m))
                if self.materials[mid] > 0 and mid in MATERIALS
            ],
            "relics": [{"id": r, **RELICS[r]} for r in self.relics],
        }
