"""Loot: what enemies drop, and picking things up."""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import Enemy
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.entities.pickup import Pickup
from mirrorbound.game.inventory import CONSUMABLES
from mirrorbound.game.state import GameState

# iron_sword is in here even though the player starts with one. Without it the
# twin could only ever own ranged/magic weapons, which made the melee half of
# its weapon scoring unreachable through play (see TwinV0Controller._preferred_weapon).
# The "already owned" filter below is what stops it dropping pointlessly.
WEAPON_DROPS = ("iron_sword", "hunter_bow", "ember_staff", "frost_staff")
RELIC_DROPS = ("ember_heart", "wolf_fang", "mirror_eye")


class LootSystem:
    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("loot")

    def drop_for(self, state: GameState, enemy: Enemy) -> list[Pickup]:
        table = enemy.enemy_def.loot
        drops: list[Pickup] = []
        pos = enemy.position

        def scatter() -> Vec2:
            angle = self.rng.next_float() * 6.28318
            return Vec2.from_angle(angle, 90 + self.rng.next_float() * 80)

        essence = self.rng.randint(table.essence_min, table.essence_max)
        if essence > 0:
            drops.append(state.spawn_pickup("essence", pos, amount=essence, scatter=scatter()))
        gold = self.rng.randint(table.gold_min, table.gold_max)
        if gold > 0:
            drops.append(state.spawn_pickup("gold", pos, amount=gold, scatter=scatter()))
        if self.rng.chance(table.shard_chance):
            drops.append(state.spawn_pickup("shards", pos, amount=1, scatter=scatter()))
        if self.rng.chance(table.potion_chance):
            drops.append(state.spawn_pickup("health_potion", pos, scatter=scatter()))
        if self.rng.chance(table.mana_potion_chance):
            drops.append(state.spawn_pickup("mana_potion", pos, scatter=scatter()))
        if self.rng.chance(table.weapon_chance):
            # A weapon is worth dropping while *either* of them still lacks it:
            # the twin picks up what it walks over, so a sword the player
            # already carries is still a real upgrade for a bare-handed twin.
            owned = set(state.player.inventory.weapons) & set(state.twin.inventory.weapons)
            options = [w for w in WEAPON_DROPS if w not in owned] or list(WEAPON_DROPS)
            drops.append(state.spawn_pickup("weapon", pos, item_id=self.rng.choice(options), scatter=scatter()))
        if self.rng.chance(table.relic_chance):
            owned_relics = set(state.player.inventory.relics)
            options = [r for r in RELIC_DROPS if r not in owned_relics]
            if options:
                drops.append(state.spawn_pickup("relic", pos, item_id=self.rng.choice(options), scatter=scatter()))
        return drops

    def collect(self, state: GameState) -> None:
        """Player and twin both pick things up; everything lands in the player's inventory."""
        collectors: list[Entity] = [state.player] if state.player.state != "dead" else []
        if not state.twin.downed and not state.twin.dormant:
            collectors.append(state.twin)
        for pickup in state.pickups:
            if not pickup.active:
                continue
            for who in collectors:
                # The Warden's shard is the twin's alone. Letting the player
                # scoop it up on the way past would quietly cancel the
                # Sanctum's opening, and the player has no way to know that.
                if pickup.twin_only and who is not state.twin:
                    continue
                if (pickup.position - who.position).length() <= pickup.radius + who.radius + 4:
                    self._apply(state, pickup, who)
                    break

    def _apply(self, state: GameState, pickup: Pickup, who: Entity) -> None:
        # Weapons go to whoever actually walked over them (the twin can build
        # its own arsenal this way); essence/shards/consumables/relics stay on
        # the player -- shared currency and relic effects are only ever read
        # from state.player.inventory (see Player.weapon_damage_mult etc.), so
        # routing those by `who` would silently strand them on a twin nothing
        # reads from.
        inv = who.inventory if pickup.kind == "weapon" else state.player.inventory
        detail: dict = {}
        if pickup.kind == "gold":
            # Gold is the shared purse; it never lands on the twin.
            state.player.inventory.add_gold(pickup.amount)
            state.emit("GOLD_GAINED", amount=pickup.amount, total=state.player.inventory.gold,
                       position=pickup.position.to_dict())
        elif pickup.kind == "essence":
            inv.add_resource("essence", pickup.amount)
            state.stats.essence_collected += pickup.amount
        elif pickup.kind == "shards":
            inv.add_resource("shards", pickup.amount)
        elif pickup.kind in CONSUMABLES:
            inv.add_consumable(pickup.kind, pickup.amount)
        elif pickup.kind == "weapon":
            added = inv.add_weapon(pickup.item_id)
            detail["new"] = added
            if not added:
                # Duplicate weapon: refund as shards, always to the player's
                # shared currency -- the twin has nothing to spend shards on.
                state.player.inventory.add_resource("shards", 1)
        elif pickup.kind == "relic":
            if pickup.item_id not in inv.relics:
                inv.add_relic(pickup.item_id)
            else:
                inv.add_resource("shards", 2)
        elif pickup.kind == "mirror_shard":
            # Nothing enters an inventory. What the twin picked up changes what
            # the twin *is*, and the session reads the flag on the next tick.
            state.twin.corrupted = True
            state.emit("TWIN_CORRUPTED", twin=state.twin.name, position=pickup.position.to_dict(),
                       room_id=state.room.id)
        pickup.active = False
        state.emit("ITEM_PICKUP", actor=who.id, kind=pickup.kind, item_id=pickup.item_id, amount=pickup.amount,
                   position=pickup.position.to_dict(), room_id=state.room.id, **detail)

    def update(self, dt: float, state: GameState) -> None:
        for pickup in state.pickups:
            if pickup.active:
                pickup.update(dt, state.player.position)
        self.collect(state)
        state.pickups = [p for p in state.pickups if p.active]
