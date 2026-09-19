"""World pickups: dropped resources, potions, weapons and relics."""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.entities.entity import Entity, Vec2

PICKUP_KINDS = ("essence", "shards", "gold", "health_potion", "mana_potion", "weapon", "relic")


@dataclass
class Pickup(Entity):
    kind: str = "essence"      # one of PICKUP_KINDS
    item_id: str = ""          # weapon id / relic id when kind is weapon/relic
    amount: int = 1
    ttl: float = 40.0
    age: float = 0.0
    # Pickups get pulled toward the player once close: feels good, and stops
    # loot hiding under a corpse.
    magnet_radius: float = 90.0
    magnet_speed: float = 340.0

    def __post_init__(self):
        self.radius = 10.0
        self.health = 1
        self.max_health = 1

    def update(self, dt: float, *collectors: Vec2) -> None:
        """Drift toward whichever collector is nearest.

        It used to magnetise to the player alone, which meant the twin could
        never actually reach a weapon it had decided to go and fetch -- the
        drop flew to the player on the way past. Everything still ends up in
        the player's inventory except weapons (see loot.py), so serving the
        nearer of the two costs the player nothing and is the difference
        between the twin's weapon choice working and not.
        """
        self.age += dt
        if self.age >= self.ttl:
            self.active = False
            return
        if not collectors:
            return
        nearest = min(collectors, key=lambda c: (c - self.position).length())
        to_player = nearest - self.position
        dist = to_player.length()
        if dist < self.magnet_radius and dist > 0:
            pull = to_player.normalized() * (self.magnet_speed * (1.0 - dist / self.magnet_radius) + 60)
            self.position = self.position + pull * dt
        elif not self.velocity.is_zero():
            # Drop scatter: slide a little, then settle.
            self.position = self.position + self.velocity * dt
            self.velocity = self.velocity * max(0.0, 1.0 - dt * 6)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "itemId": self.item_id,
            "amount": self.amount,
            "position": self.position.to_dict(),
            "age": round(self.age, 2),
        }
