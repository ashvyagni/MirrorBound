"""Loot: what enemies drop, and picking things up."""

from __future__ import annotations

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import Enemy
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.entities.pickup import Pickup
from mirrorbound.game.entities.twin import CARRY_CAP, GOLD_SHARE
from mirrorbound.game.inventory import CONSUMABLES
from mirrorbound.game.progression.stones import BOSS_STONES, RARITY, STONES, STONES_BY_TIER
from mirrorbound.game.state import GameState

# iron_sword is in here even though the player starts with one. Without it the
# twin could only ever own ranged/magic weapons, which made the melee half of
# its weapon scoring unreachable through play (see TwinV0Controller._preferred_weapon).
# The "already owned" filter below is what stops it dropping pointlessly.
WEAPON_DROPS = ("iron_sword", "hunter_bow", "ember_staff", "frost_staff")

#: How many meals a beast is worth. Size, roughly -- a cow is three sheep.
MEAT_PER_BEAST: dict[str, int] = {"cow": 3, "sheep": 1}
RELIC_DROPS = ("ember_heart", "wolf_fang", "mirror_eye")


class LootSystem:
    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("loot")
        #: Relic stones roll on their own stream, not on the loot one.
        #:
        #: AGENTS.md's reason for sub-streams stated at a finer grain than usual:
        #: rolling stones from `self.rng` meant every kill drew one to three extra
        #: values before the *next* kill's gold, potion and weapon rolls, so adding
        #: stones silently reshuffled every loot sequence a seed had ever produced.
        #: Same seed, same result -- so not a determinism break -- but it moved the
        #: v1.1 drops a run was measured against, which is the thing the rule exists
        #: to stop. On its own stream, the gold/potion/weapon sequence for a seed is
        #: bit-identical to the one before stones existed.
        self.stone_rng = rng.spawn("stones")

    def drop_for(self, state: GameState, enemy: Enemy) -> list[Pickup]:
        table = enemy.enemy_def.loot
        drops: list[Pickup] = []
        pos = enemy.position

        def scatter() -> Vec2:
            angle = self.rng.next_float() * 6.28318
            return Vec2.from_angle(angle, 90 + self.rng.next_float() * 80)

        if enemy.enemy_def.livestock:
            # Meat, and nothing else. A cow carries no essence, no gold and no
            # chance of a relic: essence is what a creature of the Reach leaves
            # behind and a cow is not one of those. Its loot table is all zeroes
            # for the same reason, so this returns early rather than rolling a
            # row of nothings.
            for _ in range(MEAT_PER_BEAST.get(enemy.enemy_def.id, 1)):
                drops.append(state.spawn_pickup("raw_meat", pos, scatter=scatter()))
            return drops

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
        drops.extend(self._stones(state, enemy, scatter))
        if self.rng.chance(table.relic_chance):
            owned_relics = set(state.player.inventory.relics)
            options = [r for r in RELIC_DROPS if r not in owned_relics]
            if options:
                drops.append(state.spawn_pickup("relic", pos, item_id=self.rng.choice(options), scatter=scatter()))
        return drops

    def _stones(self, state: GameState, enemy: Enemy, scatter) -> list[Pickup]:
        """Relic stones: three tiers, each rolled once per kill.

        Every tier is rolled on every kill rather than one roll picking a tier,
        so a lucky kill can drop two -- which is the right answer for independent
        lotteries and the wrong answer only if you think of a stone as a slot on
        a loot table. The drought counters behind this live on the campaign, so
        the pity floor survives a reconnect.

        A regional boss also hands over one tier-3 stone the first time it dies,
        and only the first time. That is what makes tier 3 reachable at all: at
        one in ten thousand it is roughly twenty-eight hours of farming, and the
        rarest thing in the game should be earned somewhere as well as won
        somewhere.
        """
        campaign = getattr(state, "campaign", None)
        if campaign is None:
            return []
        drops: list[Pickup] = []
        pos = enemy.position

        def leave(stone_id: str) -> Pickup:
            stone = state.spawn_pickup("stone", pos, item_id=stone_id, scatter=scatter())
            # It waits, like the Warden's shard does. The ordinary forty-second
            # timer on loot is fine for a potion and indefensible for a one-in-ten-
            # thousand drop that expired while the player was finishing the fight
            # that produced it.
            stone.ttl = 0.0
            return stone

        awarded = BOSS_STONES.get(enemy.enemy_def.id)
        if awarded and enemy.enemy_def.id not in campaign.stones_awarded:
            campaign.stones_awarded.add(enemy.enemy_def.id)
            drops.append(leave(awarded))

        for tier in sorted(RARITY):
            options = STONES_BY_TIER.get(tier, ())
            if not options:
                continue
            if campaign.stone_luck.roll(tier, self.stone_rng.chance):
                drops.append(leave(self.stone_rng.choice(list(options))))
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
        # Weapons go to whoever walked over them, and so do potions and food now.
        #
        # This used to route every consumable to the player on the grounds that
        # nothing read the twin's -- true when it was written, and the whole
        # reason a companion with an inventory could not use one. Something reads
        # them now (`agent/twin/controller.py` scores HEAL and EAT off what the
        # twin is carrying), so the rule inverts: what the twin picks up is the
        # twin's, up to `CARRY_CAP` of each, and the surplus goes across.
        #
        # Essence, shards and relics still go to the player whoever collected
        # them, because their effects are only ever read from the player's
        # inventory and routing them by `who` really would strand them.
        keeps = pickup.kind == "weapon" or (
            who is state.twin
            and pickup.kind in CONSUMABLES
            and who.inventory.consumables.get(pickup.kind, 0) < CARRY_CAP
        )
        inv = who.inventory if keeps else state.player.inventory
        detail: dict = {}
        if pickup.kind == "gold":
            # The twin takes a cut of what it personally picks up, and the rest
            # is the shared purse. That cut is the whole reason "the twin bought
            # itself potions" is a story the player can watch happen rather than
            # a number that changed: the money it spends is money they saw it
            # collect.
            # Rounded, not truncated: enemies drop 1-8 gold and truncation would
            # have given the twin nothing at all from most of them, leaving a
            # feature that only works after an hour. The player's purse is the
            # one paying, and only on the drops the twin personally reached
            # first -- a few gold a region, bought back by a companion that stops
            # going down.
            share = round(pickup.amount * GOLD_SHARE) if who is state.twin else 0
            if share > 0:
                state.twin.inventory.add_gold(share)
            state.player.inventory.add_gold(pickup.amount - share)
            state.emit("GOLD_GAINED", amount=pickup.amount - share,
                       total=state.player.inventory.gold, twinShare=share,
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
        elif pickup.kind == "stone":
            # Always the player's, whoever walked over it. A stone is socketed at
            # a bench the twin never visits.
            state.player.inventory.add_stone(pickup.item_id)
            state.emit("STONE_FOUND", stone=pickup.item_id,
                       name=STONES[pickup.item_id].name, tier=STONES[pickup.item_id].tier,
                       position=pickup.position.to_dict(), room_id=state.room.id)
        elif pickup.kind == "relic":
            if pickup.item_id not in inv.relics:
                inv.add_relic(pickup.item_id)
            else:
                inv.add_resource("shards", 2)
        elif pickup.kind == "key":
            # Not an inventory item. A key is a fact about the dungeon you are
            # in -- the door reads it, nothing spends it, and it does not leave
            # the area with you.
            state.keys.add(pickup.item_id)
            state.room.unlock_doors(state.keys)
            state.emit("KEY_FOUND", key=pickup.item_id, room_id=state.room.id,
                       position=pickup.position.to_dict())
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
