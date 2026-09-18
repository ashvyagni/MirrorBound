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
    "health_potion": {"name": "Health Potion", "heal": 45, "description": "Restores 45 health.", "rarity": "common"},
    "mana_potion": {"name": "Mana Potion", "mana": 40, "description": "Restores 40 mana.", "rarity": "common"},
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
    ability_slots: list[str] = field(default_factory=lambda: list(DEFAULT_SLOTS))
    consumables: dict[str, int] = field(default_factory=dict)
    resources: dict[str, int] = field(default_factory=lambda: {"essence": 0, "shards": 0, "relics": 0})
    relics: list[str] = field(default_factory=list)

    # --- weapons -----------------------------------------------------------
    def add_weapon(self, weapon_id: str) -> bool:
        get_weapon(weapon_id)  # validates
        if weapon_id in self.weapons:
            return False
        self.weapons.append(weapon_id)
        if not self.equipped_weapon:
            self.equipped_weapon = weapon_id
        return True

    def equip(self, weapon_id: str) -> bool:
        if weapon_id not in self.weapons:
            return False
        self.equipped_weapon = weapon_id
        return True

    # --- abilities ----------------------------------------------------------
    def set_slot(self, slot: int, ability_id: str) -> bool:
        if not 1 <= slot <= 4:
            return False
        get_ability(ability_id)
        # Keep slots unique: swap if the ability already sits elsewhere.
        if ability_id in self.ability_slots:
            other = self.ability_slots.index(ability_id)
            self.ability_slots[other] = self.ability_slots[slot - 1]
        self.ability_slots[slot - 1] = ability_id
        return True

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
            "abilitySlots": list(self.ability_slots),
            "consumables": [
                {"id": cid, "count": n, **CONSUMABLES[cid]} for cid, n in sorted(self.consumables.items())
            ],
            "resources": dict(self.resources),
            "relics": [{"id": r, **RELICS[r]} for r in self.relics],
        }
