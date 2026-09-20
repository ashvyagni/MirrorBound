"""Authoritative game state container."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from mirrorbound.game.core.clock import SimClock
from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.core.ids import IdAllocator
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import Room
from mirrorbound.game.entities.enemy import Enemy, get_archetype
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.entities.pickup import Pickup
from mirrorbound.game.entities.player import Player
from mirrorbound.game.entities.projectile import Projectile
from mirrorbound.game.entities.twin import Twin

# Re-exported for older imports (`from mirrorbound.game.state import Room`).
__all__ = ["GameState", "Room", "RunStats"]

#: `dead` is a setback -- the respawn timer runs and the room carries on.
#: `defeat` is the run ending, and only the Sanctum does that: everywhere else
#: dying costs you the walk back, which is the deal the rest of the game makes.
PHASES = ("playing", "dead", "defeat", "victory")


@dataclass
class RunStats:
    enemies_killed: int = 0
    rooms_cleared: int = 0
    damage_dealt: float = 0.0
    damage_taken: float = 0.0
    essence_collected: int = 0
    abilities_cast: int = 0
    ticks: int = 0

    def to_dict(self) -> dict:
        return {
            "enemiesKilled": self.enemies_killed,
            "roomsCleared": self.rooms_cleared,
            "damageDealt": round(self.damage_dealt),
            "damageTaken": round(self.damage_taken),
            "essenceCollected": self.essence_collected,
            "abilitiesCast": self.abilities_cast,
            "seconds": round(self.ticks / 60.0, 1),
        }


@dataclass
class GameState:
    """Authoritative game state owned by the server."""
    tick: int = 0
    seed: int = 0
    rng: DeterministicRNG = field(default_factory=lambda: DeterministicRNG(0))
    clock: SimClock = field(default_factory=SimClock)
    ids: IdAllocator = field(default_factory=IdAllocator)
    bus: EventBus = field(default_factory=EventBus)

    player: Player = field(default_factory=lambda: Player(id="player_1"))
    twin: Twin = field(default_factory=lambda: Twin(id="twin_1"))
    enemies: list[Enemy] = field(default_factory=list)
    projectiles: list[Projectile] = field(default_factory=list)
    pickups: list[Pickup] = field(default_factory=list)
    room: Room = field(default_factory=Room)
    dungeon: Any = None            # DungeonRun; typed loosely to avoid an import cycle
    campaign: Any = None           # CampaignState, owned by the session
    # Region scaling for the area currently being played; applied at spawn.
    difficulty: float = 1.0
    phase: str = "playing"
    # Whether the Warden has already left its shard this run. Kept on the state
    # rather than counted from `pickups`, because the shard stops being a
    # pickup the moment the twin takes it.
    shard_dropped: bool = False
    paused: bool = False
    transition_timer: float = 0.0  # > 0 while fading between rooms
    stats: RunStats = field(default_factory=RunStats)
    # Everything published since the last snapshot; drained by the session so the
    # client can react to events (VFX, sounds) instead of diffing entity state.
    pending_events: list[Event] = field(default_factory=list)

    def __post_init__(self):
        self.rng = DeterministicRNG(self.seed)
        self.player.position = self.room.player_spawn.copy()
        self.twin.position = self.room.twin_spawn.copy()
        self.bus.subscribe_all(self._collect)

    def _collect(self, event: Event) -> None:
        self.pending_events.append(event)
        if len(self.pending_events) > 400:
            self.pending_events = self.pending_events[-400:]

    # --- events -----------------------------------------------------------------

    def emit(self, event_type: str, **data: Any) -> Event:
        event = Event(tick=self.tick, type=event_type, data=data)
        self.bus.publish(event)
        return event

    def drain_events(self) -> list[Event]:
        events, self.pending_events = self.pending_events, []
        # The bus keeps its own buffer for replay tooling; keep it bounded too.
        self.bus.drain()
        return events

    # --- spawning ------------------------------------------------------------------

    def spawn_enemy(self, enemy_type: str, position: Vec2) -> Enemy:
        enemy_def = get_archetype(enemy_type, self.difficulty)
        kind = "boss" if enemy_def.boss else "enemy"
        enemy = Enemy(id=self.ids.next(kind), position=position.copy(), enemy_def=enemy_def)
        enemy.home = position.copy()
        self.enemies.append(enemy)
        self.emit("ENEMY_SPAWNED", enemy_id=enemy.id, enemy_type=enemy_def.id, role=enemy_def.role,
                  position=position.to_dict(), room_id=self.room.id)
        return enemy

    def spawn_enemies_for_room(self, room: Room) -> None:
        for spawn in room.enemy_spawns:
            self.spawn_enemy(spawn.enemy_type, spawn.position)

    def spawn_pickup(self, kind: str, position: Vec2, amount: int = 1, item_id: str = "",
                     scatter: Vec2 | None = None) -> Pickup:
        pickup = Pickup(id=self.ids.next("pickup"), position=position.copy(), kind=kind,
                        amount=amount, item_id=item_id)
        if scatter is not None:
            pickup.velocity = scatter
        self.pickups.append(pickup)
        return pickup

    def spawn_room_treasure(self, room: Room) -> None:
        loot_rng = self.rng.spawn(f"treasure:{room.index}")
        for kind, pos in room.treasure:
            if kind == "chest":
                # A chest is a burst of everything.
                #
                # The loot lands on the floor the instant the room is entered,
                # so there is no "open the chest" interaction to hang an
                # animation on -- this *is* the moment the chest opens, and the
                # client plays the lid coming up against it.
                self.emit("CHEST_OPENED", position=pos.to_dict(), room_id=room.id)
                self.spawn_pickup("shards", pos + Vec2(-26, 18), amount=loot_rng.randint(2, 4))
                self.spawn_pickup("essence", pos + Vec2(26, 18), amount=loot_rng.randint(6, 10))
                self.spawn_pickup("health_potion", pos + Vec2(0, 30))
                weapon = loot_rng.choice(["hunter_bow", "ember_staff", "frost_staff"])
                self.spawn_pickup("weapon", pos + Vec2(0, -26), item_id=weapon)
                relic = loot_rng.choice(["ember_heart", "wolf_fang", "mirror_eye"])
                self.spawn_pickup("relic", pos + Vec2(40, -10), item_id=relic)
            elif kind == "essence":
                self.spawn_pickup("essence", pos, amount=loot_rng.randint(2, 5))
            elif kind == "shards":
                self.spawn_pickup("shards", pos, amount=1)
            else:
                self.spawn_pickup(kind, pos)

    # --- queries --------------------------------------------------------------------

    def get_active_enemies(self) -> list[Enemy]:
        return [e for e in self.enemies if e.active]

    def entity_by_id(self, entity_id: str | None) -> Entity | None:
        if entity_id is None:
            return None
        if entity_id == self.player.id:
            return self.player
        if entity_id == self.twin.id:
            return self.twin
        for e in self.enemies:
            if e.id == entity_id:
                return e
        return None

    def nearest_enemy(self, pos: Vec2, max_dist: float = float("inf")) -> Enemy | None:
        best, best_d = None, max_dist
        for e in self.get_active_enemies():
            d = (e.position - pos).length()
            if d < best_d:
                best, best_d = e, d
        return best

    def boss_alive(self) -> bool:
        return any(e.active and e.enemy_def.boss for e in self.enemies)

    # --- serialisation ------------------------------------------------------------------

    def to_dict(self, include_room: bool = True, detail: bool = True) -> dict:
        d = {
            "tick": self.tick,
            "seed": self.seed,
            "phase": self.phase,
            "paused": self.paused,
            "transition": round(self.transition_timer, 2),
            "player": self.player.to_dict(detail=detail),
            "twin": self.twin.to_dict(detail=detail),
            "enemies": [e.to_dict() for e in self.get_active_enemies()],
            "projectiles": [p.to_dict() for p in self.projectiles if p.active],
            "pickups": [p.to_dict() for p in self.pickups if p.active],
            "stats": self.stats.to_dict(),
            "dungeon": self.dungeon.to_dict() if self.dungeon is not None else None,
        }
        if self.campaign is not None:
            d["campaign"] = self.campaign.to_dict()
            if detail:
                d["npcs"] = [
                    n.to_dict(self.campaign.flags, self.campaign.player_name, self.campaign.twin_name)
                    for n in self.room.npcs
                ]
        if include_room:
            d["room"] = self.room.to_dict()
        else:
            d["room"] = {"id": self.room.id, "index": self.room.index, "cleared": self.room.cleared,
                         "doors": [door.to_dict() for door in self.room.doors]}
        return d
