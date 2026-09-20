"""Inventories for the player and the twin.

Kept deliberately small: weapons owned, four ability slots, stackable
consumables, stackable resources, and relics (passive trinkets). The twin has
the same shape so equipment can matter to its combat behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.combat.abilities import DEFAULT_SLOTS, get_ability
from mirrorbound.game.combat.weapons import get_weapon


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
            "weapons": [get_weapon(w).to_dict() for w in self.weapons],
            "equippedWeapon": self.equipped_weapon,
            "offhandWeapon": self.offhand_weapon,
            "gold": self.gold,
            "abilitySlots": list(self.ability_slots),
            "consumables": [
                {"id": cid, "count": n, **CONSUMABLES[cid]} for cid, n in sorted(self.consumables.items())
            ],
            "resources": dict(self.resources),
            "relics": [{"id": r, **RELICS[r]} for r in self.relics],
        }
