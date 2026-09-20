"""World pickups: dropped resources, potions, weapons and relics."""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.entities.entity import Entity, Vec2

#: `mirror_shard` is not ordinary loot. The Warden leaves exactly one, only
#: the twin may take it, and taking it is what turns the twin into the Mirror.
#: It is a story beat wearing a pickup's clothes, which is why it is listed
#: here but handled apart everywhere it appears.
PICKUP_KINDS = ("essence", "shards", "gold", "health_potion", "mana_potion", "weapon", "relic",
                "mirror_shard")


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

    @property
    def twin_only(self) -> bool:
        """Whether the player is forbidden from taking this."""
        return self.kind == "mirror_shard"

    def update(self, dt: float, player_pos: Vec2) -> None:
        self.age += dt
        # The shard waits. A story beat that expires because the player took
        # too long to walk into the room is a beat that silently does not
        # happen, and the Sanctum would then open on an uncorrupted twin.
        if self.ttl > 0 and self.age >= self.ttl:
            self.active = False
            return
        # Nor is it dragged toward the player: it is the twin's to reach.
        if self.twin_only:
            return
        to_player = player_pos - self.position
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
