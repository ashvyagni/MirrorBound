"""Hunger: the cost of being out in the world.

A bar that drains and a penalty when it runs out is easy to build and easy to
build *badly*, so three decisions here are doing most of the work:

**It drains on activity, not on wall-clock time.** Distance walked and blows
thrown, never seconds. A hunger bar on a clock punishes reading the journal,
haggling with a smith, comparing two weapons in a menu or standing up to answer
the door — none of which is the thing the mechanic is about. Tying it to what the
player actually does makes it a cost of *expedition*, which is what was wanted.

**There are three bands, not one falling number.** Fed gives a small bonus, Fine
gives nothing, Hungry gives the penalty. A bar you can only ever lose by is a
chore; a bar you can win by is a reason to cook. Most of a session sits in the
middle not thinking about it, which is where a survival mechanic belongs in a
game that is not about survival.

**It freezes while a boss is armed.** This is the important one. v1.1 measured
the regional bosses at 0.67 and 0.89 clear rates after fixing their telegraphs,
and a combat-and-defence debuff multiplies straight into those numbers without
anything in the measurement knowing. Worse, a player who walks into a boss room
hungry would be fighting a different fight from the one that was tuned, and would
have no way to tell. So the drain stops at the door and the penalty is lifted
with it.

Nothing here can kill. Starvation death in a game whose save points are villages
would mean a run ended by a walk, and the brief asked for reduced stats, which is
what this is.
"""

from __future__ import annotations

from dataclasses import dataclass

#: Full, and the scale everything below is a fraction of.
MAX_HUNGER = 100.0

#: Hunger spent per 1,000 world units walked.
#:
#: A region is 2,240 units across, so crossing one costs about 6.7 -- fifteen
#: region-widths on a full bar. A full campaign is a few dozen region crossings,
#: so a player who never eats will meet the Hungry band, and one who eats when
#: they pass a hearth will never think about it.
PER_1000_UNITS = 3.0

#: Hunger spent per swing, cast or ability.
#:
#: Deliberately much larger per event than walking is per unit: fighting is the
#: expensive thing to do, which is what makes clearing a region on the way through
#: a decision rather than free XP.
PER_ACTION = 0.22

#: Where the bands are, as fractions of `MAX_HUNGER`.
FED_ABOVE = 0.75
HUNGRY_BELOW = 0.25

#: What Fed is worth: a small, real bonus, and no more than one skill node.
#:
#: Damage and pace, and deliberately **not** health regeneration, which is what
#: this was first written as. Out-of-combat healing would have made the game
#: markedly easier and would have undercut the potion economy the v1.1 bench is
#: priced against -- which is the same objection this module's own docstring makes
#: to food that heals, so food that quietly heals *between* fights is the same
#: mistake with a longer fuse. Six existing tests caught it by asserting exact
#: health values, which is the best argument for asserting exact values.
FED_DAMAGE_MULT = 0.06
FED_SPEED_MULT = 0.05

#: What Hungry costs. The brief asked for reduced combat and defence, and these
#: are deliberately the two numbers it named.
HUNGRY_DAMAGE_MULT = -0.20
HUNGRY_DAMAGE_TAKEN_MULT = 0.15

#: And the pace you keep when you have not eaten.
HUNGRY_SPEED_MULT = -0.08

#: The floor. However long a player goes without eating, the penalty stops here.
#:
#: Hungry is a flat band rather than a slope for exactly this reason: a penalty
#: that keeps growing turns a mistake into a spiral, and there is no way back from
#: a spiral in a game where the food is several regions behind you.
MIN_HUNGER = 0.0


@dataclass
class Hunger:
    """One creature's appetite.

    Held by the player and by the twin, and read identically for both -- the twin
    getting hungry is most of what makes it interesting to watch (see
    `agent/twin/style.py`), and a twin with a different rule would be a different
    creature.
    """
    value: float = MAX_HUNGER
    #: Distance banked but not yet charged, so short steps are not lost to
    #: rounding at 60 ticks a second.
    _walked: float = 0.0
    #: True while something in the room means hunger is suspended.
    frozen: bool = False

    @property
    def fraction(self) -> float:
        return self.value / MAX_HUNGER

    @property
    def band(self) -> str:
        if self.value >= MAX_HUNGER * FED_ABOVE:
            return "fed"
        if self.value < MAX_HUNGER * HUNGRY_BELOW:
            return "hungry"
        return "fine"

    @property
    def fed(self) -> bool:
        return self.band == "fed"

    @property
    def hungry(self) -> bool:
        return self.band == "hungry"

    # --- spending --------------------------------------------------------------

    def walked(self, distance: float, resist: float = 0.0) -> None:
        if self.frozen or distance <= 0:
            return
        self._walked += distance
        if self._walked >= 1000.0:
            steps, self._walked = divmod(self._walked, 1000.0)
            self._spend(PER_1000_UNITS * steps, resist)

    def acted(self, resist: float = 0.0) -> None:
        if self.frozen:
            return
        self._spend(PER_ACTION, resist)

    def _spend(self, amount: float, resist: float) -> None:
        self.value = max(MIN_HUNGER, self.value - amount * (1.0 - min(0.75, resist)))

    def eat(self, nourish: float) -> float:
        """Eat something. Returns how much of it was actually used.

        Overeating is wasted rather than banked: a bar that can be filled past
        full is a bar you stockpile, and then the mechanic is inventory management
        instead of a reason to stop somewhere.
        """
        before = self.value
        self.value = min(MAX_HUNGER, self.value + max(0.0, nourish))
        return self.value - before

    @property
    def damage_mult(self) -> float:
        if self.frozen:
            return 0.0
        band = self.band
        if band == "fed":
            return FED_DAMAGE_MULT
        return HUNGRY_DAMAGE_MULT if band == "hungry" else 0.0

    @property
    def damage_taken_mult(self) -> float:
        return 0.0 if self.frozen else (HUNGRY_DAMAGE_TAKEN_MULT if self.hungry else 0.0)

    @property
    def speed_mult(self) -> float:
        """Walking well, or not. Small: this is a bonus, not a sprint button."""
        if self.frozen:
            return 0.0
        return FED_SPEED_MULT if self.fed else (HUNGRY_SPEED_MULT if self.hungry else 0.0)

    # --- serialisation ---------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "value": round(self.value, 1),
            "max": MAX_HUNGER,
            "band": self.band,
            "frozen": self.frozen,
            "damageMult": round(self.damage_mult, 3),
            "damageTakenMult": round(self.damage_taken_mult, 3),
            "speedMult": round(self.speed_mult, 3),
        }

    def to_save(self) -> float:
        return round(self.value, 1)

    @classmethod
    def from_save(cls, value) -> "Hunger":
        try:
            stored = float(value)
        except (TypeError, ValueError):
            return cls()
        return cls(value=max(MIN_HUNGER, min(MAX_HUNGER, stored)))
