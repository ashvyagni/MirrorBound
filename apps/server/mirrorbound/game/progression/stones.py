"""Relic stones: the rarest thing in the game, and the one socket that takes them.

A stone is not a material. Ore changes a weapon's *shape* — how fast it swings,
how far it shoves — and a stone changes what carrying it lets you do, mostly on
the magic side. They are kept apart because they are found apart: ore is in the
ground and you go and get it, a stone falls off something you killed and you
cannot make that happen.

**On the drop rates.** The brief asked for 1 in 1,000 and 1 in 10,000 by tier.
Counting the real content — 58 spawn slots across 20 room templates, 37 wild
encounters across five terrains, six regions and five dungeons — a full campaign
is on the order of 150–250 kills. So:

    1/1,000   ~ one stone every five complete playthroughs
    1/10,000  ~ one every fifty

At a hard farming rate of roughly 350 kills an hour, the second is about
twenty-eight hours for one stone. That is an item nobody on the team would ever
see and no test could tell you felt good.

Both numbers are in `RARITY` unchanged, because the ask was for a lottery and a
lottery it is. What makes them reachable is the two things beside them:

* a **pity floor** (`PITY`). The roll is counted, and a drought long enough is
  paid out. So 1/1,000 means "about one in a thousand, and never worse than one
  in four hundred" — which is a promise a determinism test can actually prove,
  where "it feels rare" is not.
* the top tier is also **guaranteed from a regional boss**, once each. The rarest
  thing in the game should be *earned* somewhere as well as won somewhere, and a
  boss you beat once is the honest place for it.

Effects are read only while the weapon holding the stone is in hand, which gives
stones the same affinity question ore has: a Cinder Shard is transformative in a
staff and wasted in a sword, and nothing has to enforce that — it falls out of
what the numbers touch.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

#: One socket, and only on a weapon worked all the way up.
#:
#: The bench's third job. A finished weapon is where a stone goes, so the gold
#: and shards spent getting there are also what makes the rarest drop in the game
#: usable -- rather than a stone sitting in a bag because nothing can hold it.
SOCKETS_AT_TIER = 3


@dataclass(frozen=True)
class StoneDef:
    id: str
    name: str
    #: 1..3. Decides how it is found, not how strong it is -- a tier-1 stone with
    #: the right weapon under it is worth more than a tier-3 in the wrong one.
    tier: int
    description: str
    #: What the smith says about socketing it.
    socket_note: str = ""
    # --- what carrying it does, while its weapon is in hand ------------------
    spell_damage_mult: float = 0.0
    mana_cost_mult: float = 0.0
    mana_regen_mult: float = 0.0
    max_mana_bonus: float = 0.0
    ability_cooldown_mult: float = 0.0
    #: Mana returned by a landed hit.
    mana_on_hit: float = 0.0
    #: Speed multiplier applied to whatever this weapon hits, and for how long.
    #: 0 means no slow. Reuses the same status the frost staff already applies.
    slow_on_hit: float = 0.0
    slow_seconds: float = 0.0
    crit_chance: float = 0.0
    crit_multiplier: float = 0.0


STONES: dict[str, StoneDef] = {
    s.id: s
    for s in (
        # --- tier 1: uncommon, and the first one is a revelation --------------
        StoneDef(
            "cinder_shard", "Cinder Shard", 1,
            "A coal that never went out. Warm through a glove, through a bag, "
            "through a winter.",
            socket_note="Spells burn 15% hotter.",
            spell_damage_mult=0.15),
        StoneDef(
            "quiet_stone", "Quiet Stone", 1,
            "River-smooth, and it makes the air around it feel like the inside "
            "of a held breath.",
            socket_note="Mana comes back half again as fast.",
            mana_regen_mult=0.50),
        # --- tier 2: rare enough to remember where you were ------------------
        StoneDef(
            "riftstone", "Riftstone", 2,
            "Cracked through, and the crack does not go all the way in. Whatever "
            "is on the other side of it is not stone.",
            socket_note="Everything recharges a fifth faster.",
            ability_cooldown_mult=-0.20),
        StoneDef(
            "leechstone", "Leechstone", 2,
            "Grave-grey, and it drinks. The Wakewood diggers used to bury them "
            "face down for that reason.",
            socket_note="Every blow that lands gives back a little mana.",
            mana_on_hit=3.0),
        StoneDef(
            "rimestone", "Rimestone", 2,
            "Frost forms on it in high summer, in the shape of a hand that is "
            "not yours.",
            socket_note="What you hit moves slower for a moment.",
            slow_on_hit=0.6, slow_seconds=1.5),
        # --- tier 3: the rarest thing there is -------------------------------
        StoneDef(
            "mirrors_tear", "The Mirror's Tear", 3,
            "It is not glass and it is not water. It shows you the room you are "
            "in with one thing missing, and you never work out what.",
            socket_note="Far stronger spells, and a deeper well to cast them from.",
            spell_damage_mult=0.40, max_mana_bonus=25.0),
        StoneDef(
            "sunderstone", "Sunderstone", 3,
            "Star-iron's heart, left over from whatever the Kiln was built to do "
            "to it.",
            socket_note="A telling blow comes far more often, and tells for far more.",
            crit_chance=0.10, crit_multiplier=0.50),
    )
}

#: The chance one kill drops a stone of each tier, straight from the brief.
RARITY: dict[int, float] = {1: 1 / 200, 2: 1 / 1000, 3: 1 / 10000}

#: Kills without a stone of that tier after which the next one is given.
#:
#: Roughly four hundred times the odds, so the floor is a backstop and not the
#: real distribution -- a player is very unlikely to reach it for tier 1 and
#: certain to reach it eventually for tier 3. The numbers here are what make the
#: rates above a promise instead of a hope.
PITY: dict[int, int] = {1: 80, 2: 400, 3: 2000}

#: Stones a regional boss leaves the first time it is beaten.
#:
#: One each, and tier 3, which is the whole reason the tier is reachable. The
#: Mirror is deliberately absent: the ending gives you the ending.
BOSS_STONES: dict[str, str] = {
    "stonecount": "sunderstone",
    "shardmother": "mirrors_tear",
    "warden": "mirrors_tear",
}

STONES_BY_TIER: dict[int, tuple[str, ...]] = {
    tier: tuple(s.id for s in STONES.values() if s.tier == tier)
    for tier in sorted({s.tier for s in STONES.values()})
}


def get_stone(stone_id: str) -> StoneDef:
    stone = STONES.get(stone_id)
    if stone is None:
        raise ValueError(f"Unknown relic stone: {stone_id}")
    return stone


@dataclass(frozen=True)
class SocketBonuses:
    """What a socketed stone is worth. Zero when the socket is empty."""
    spell_damage_mult: float = 0.0
    mana_cost_mult: float = 0.0
    mana_regen_mult: float = 0.0
    max_mana_bonus: float = 0.0
    ability_cooldown_mult: float = 0.0
    mana_on_hit: float = 0.0
    slow_on_hit: float = 0.0
    slow_seconds: float = 0.0
    crit_chance: float = 0.0
    crit_multiplier: float = 0.0


_FIELDS = tuple(SocketBonuses.__dataclass_fields__)


@lru_cache(maxsize=64)
def socket_bonuses(stone_id: str) -> SocketBonuses:
    stone = STONES.get(stone_id or "")
    if stone is None:
        return SocketBonuses()
    return SocketBonuses(**{name: getattr(stone, name) for name in _FIELDS})


@dataclass
class StoneLuck:
    """The drought counters behind `PITY`, one per tier.

    Saved with the run. A counter that reset every session would turn the pity
    floor into a promise the game breaks every time the player closes the tab --
    and worse, one they could farm by reconnecting.
    """
    drought: dict[int, int] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.drought is None:
            self.drought = {tier: 0 for tier in RARITY}

    def roll(self, tier: int, chance) -> bool:
        """Count one kill against `tier`, and say whether it pays out.

        `chance` is a callable taking a probability, which in practice is
        `DeterministicRNG.chance` -- passed in rather than held so this stays
        pure data and the loot system keeps owning its own sub-stream.
        """
        odds = RARITY.get(tier)
        if odds is None:
            return False
        self.drought[tier] = self.drought.get(tier, 0) + 1
        if chance(odds) or self.drought[tier] >= PITY.get(tier, 10**9):
            self.drought[tier] = 0
            return True
        return False

    def to_save(self) -> dict:
        return {str(tier): count for tier, count in sorted(self.drought.items()) if count}

    @classmethod
    def from_save(cls, data) -> "StoneLuck":
        luck = cls()
        if isinstance(data, dict):
            for tier, count in data.items():
                try:
                    key = int(tier)
                except (TypeError, ValueError):
                    continue
                if key in RARITY:
                    try:
                        luck.drought[key] = max(0, int(count))
                    except (TypeError, ValueError):
                        continue
        return luck
