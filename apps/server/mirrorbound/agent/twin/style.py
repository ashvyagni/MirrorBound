"""The twin's own evolving style (directive sections 18 and 25).

    PLAYER STYLE  (imitation channel: what the player keeps doing)
  + TWIN EXPERIENCE (experience channel: what worked for the twin)
  = TWIN EVOLVED STYLE

Every dimension is a `StyleDim`: value in [0, 1] plus confidence, sample count
and recent trend — never a naked float. Confidence decays with real time when a
dimension stops receiving evidence, so a style the player abandons fades.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

from mirrorbound.game.core.events import Event

DIMENSIONS = (
    "preferred_range",     # 0 = melee, 1 = ranged
    "aggression",
    "mobility",
    "risk_tolerance",
    "target_preference",   # 0 = nearest/weakest first, 1 = dangerous (ranged/elite) first
    "melee_dependency",
    "ranged_dependency",
    "defensive_tendency",
    "spell_preference",
    # --- v1.2: looking after itself -------------------------------------------
    #
    # The three dimensions behind "the twin buys itself potions and uses them
    # like a player would". Each one is learned from both channels, which is
    # what makes them style rather than configuration: the player's own habits
    # teach the twin when to drink and whether money is for spending, and the
    # twin's own deaths teach it when it was wrong.
    "drink_threshold",     # 0 = drink at death's door, 1 = drink at the first scratch
    "stock_target",        # 0 = carry nothing, 1 = keep a full pack
    "thrift",              # 0 = spends freely, 1 = hoards gold
)

IMITATION_RATE = 0.06     # how hard the player's behaviour pulls the twin's style
EXPERIENCE_RATE = 0.12    # how hard the twin's own outcomes pull it
CONFIDENCE_SATURATION = 25.0
CONFIDENCE_HALF_LIFE_SECONDS = 75.0


@dataclass
class StyleDim:
    value: float = 0.5
    confidence: float = 0.0
    samples: int = 0
    recent_trend: float = 0.0
    last_sample_tick: int = 0

    def update(self, signal: float, rate: float, tick: int) -> None:
        signal = min(1.0, max(0.0, signal))
        previous = self.value
        self.value = (1 - rate) * self.value + rate * signal
        self.recent_trend = 0.7 * self.recent_trend + 0.3 * (self.value - previous)
        self.samples += 1
        self.last_sample_tick = tick
        self.confidence = min(0.999, 1 - math.exp(-self.samples / CONFIDENCE_SATURATION))

    def decay(self, elapsed_seconds: float) -> None:
        """Temporal decay of confidence while no new evidence arrives."""
        if elapsed_seconds <= 0 or self.confidence <= 0:
            return
        self.confidence *= 0.5 ** (elapsed_seconds / CONFIDENCE_HALF_LIFE_SECONDS)
        if self.confidence < 1e-4:
            self.confidence = 0.0

    def to_dict(self) -> dict:
        return {
            "value": round(self.value, 3),
            "confidence": round(self.confidence, 3),
            "samples": self.samples,
            "recent_trend": round(self.recent_trend, 4),
        }


@dataclass
class TwinStyleModel:
    tick_hz: float = 60.0
    learning_mult: float = 1.0
    dims: dict[str, StyleDim] = field(default_factory=lambda: {name: StyleDim() for name in DIMENSIONS})
    lessons: deque = field(default_factory=lambda: deque(maxlen=8))
    player_events_seen: int = 0
    outcomes_seen: int = 0
    tick: int = 0
    _last_decay_tick: int = 0

    # --- accessors ---------------------------------------------------------------

    def get(self, name: str) -> StyleDim:
        return self.dims.setdefault(name, StyleDim())

    def value(self, name: str, default: float = 0.5) -> float:
        dim = self.dims.get(name)
        return dim.value if dim else default

    def confident_value(self, name: str) -> float:
        """Value blended toward neutral 0.5 by (1 - confidence)."""
        dim = self.get(name)
        return 0.5 + (dim.value - 0.5) * dim.confidence

    def _learn(self, name: str, signal: float, rate: float, tick: int) -> None:
        self.get(name).update(signal, min(0.5, rate * self.learning_mult), tick)

    def _note(self, text: str) -> None:
        if not self.lessons or self.lessons[-1] != text:
            self.lessons.append(text)

    # --- time ------------------------------------------------------------------------

    def advance(self, tick: int) -> None:
        """Apply temporal confidence decay for dimensions without recent evidence."""
        self.tick = tick
        if tick - self._last_decay_tick < int(self.tick_hz * 2):
            return
        elapsed = (tick - self._last_decay_tick) / self.tick_hz
        self._last_decay_tick = tick
        for dim in self.dims.values():
            if tick - dim.last_sample_tick > self.tick_hz * 10:
                dim.decay(elapsed)

    # --- learning ----------------------------------------------------------------------

    def observe(self, event: Event) -> None:
        """Route any gameplay event to the right channel."""
        self.tick = max(self.tick, event.tick)
        # ITEM_USED and SHOP_PURCHASE are the player's: the twin's own drinking
        # and buying publish TWIN_ITEM_USED and TWIN_PURCHASE, so routing these
        # into the imitation channel can never feed the twin its own behaviour
        # back as though it were the player's.
        if (
            event.type.startswith("PLAYER_")
            or event.type in ("TARGET_CHANGE", "ITEM_USED", "SHOP_PURCHASE")
        ):
            self._observe_player(event)
        elif event.type in ("TWIN_OUTCOME", "TWIN_DAMAGED", "TWIN_DOWNED"):
            self._observe_twin(event)

    def _observe_player(self, event: Event) -> None:
        t = event.tick
        data = event.data
        tags = set(data.get("tags") or ())
        self.player_events_seen += 1
        rate = IMITATION_RATE

        if event.type == "PLAYER_ATTACKED":
            self._learn("aggression", 1.0, rate, t)
            self._learn("defensive_tendency", 0.15, rate * 0.5, t)
            if "MELEE" in tags:
                self._learn("preferred_range", 0.0, rate, t)
                self._learn("melee_dependency", 1.0, rate, t)
                self._learn("ranged_dependency", 0.0, rate, t)
            elif "RANGED" in tags:
                self._learn("preferred_range", 1.0, rate, t)
                self._learn("melee_dependency", 0.0, rate, t)
                self._learn("ranged_dependency", 1.0, rate, t)
            if "SPELL" in tags:
                self._learn("spell_preference", 1.0, rate, t)
            hf = data.get("healthFraction")
            if hf is not None:
                # Attacking while hurt is a risk-tolerant habit.
                self._learn("risk_tolerance", 1.0 - float(hf) * 0.8, rate, t)
        elif event.type == "PLAYER_ABILITY_CAST":
            self._learn("aggression", 0.0 if "DEFENSIVE" in tags else 0.85, rate, t)
            if "SPELL" in tags:
                self._learn("spell_preference", 1.0, rate * 1.4, t)
            if "MOBILITY" in tags:
                self._learn("mobility", 1.0, rate, t)
        elif event.type == "PLAYER_DASHED":
            self._learn("mobility", 1.0, rate * 1.2, t)
        elif event.type == "PLAYER_DODGED":
            self._learn("defensive_tendency", 1.0, rate, t)
            self._learn("mobility", 1.0, rate, t)
        elif event.type == "PLAYER_RETREATED":
            self._learn("defensive_tendency", 1.0, rate * 1.3, t)
            self._learn("aggression", 0.0, rate * 0.8, t)
            hf = data.get("health_fraction")
            if hf is not None:
                self._learn("risk_tolerance", float(hf), rate, t)   # retreating at high HP = cautious
        elif event.type == "PLAYER_MOVED":
            distance = float(data.get("distance") or 0.0)
            self._learn("mobility", min(1.0, distance / 90.0), rate * 0.4, t)
        elif event.type == "ITEM_USED":
            # *When* the player reaches for a flask, not that they did. The
            # health fraction they drank at is the threshold they play by, and
            # copying it is the whole imitation channel in one line: a player who
            # sips at 80% gets a twin that sips, and one who gambles to 10% gets
            # a twin that gambles.
            at = data.get("atHealth")
            if at is not None and float(data.get("healed") or 0.0) > 0:
                self._learn("drink_threshold", float(at), rate * 1.5, t)
            if float(data.get("fed") or 0.0) > 0:
                self._learn("thrift", 0.35, rate * 0.5, t)   # food is worth carrying
        elif event.type == "SHOP_PURCHASE":
            # Spending is learned, not assumed. A player who shops has a twin
            # that will; a player who hoards gold for the smith has a twin that
            # keeps its quarter-share in its pocket.
            self._learn("thrift", 0.0, rate, t)
            if data.get("item") == "health_potion":
                self._learn("stock_target", 1.0, rate * 1.2, t)
        elif event.type == "TARGET_CHANGE":
            role = data.get("target_type", "")
            danger = {"archer": 1.0, "ranged_skeleton": 1.0, "elite_skeleton": 0.9, "mirror": 1.0,
                      "hound": 0.65, "skeleton": 0.3, "slime": 0.15}.get(str(role), 0.5)
            self._learn("target_preference", danger, rate * 1.5, t)

        # Periodic, human-readable lessons for the debug HUD.
        if self.player_events_seen % 12 == 0:
            pr = self.get("preferred_range")
            if pr.confidence > 0.3:
                self._note(f"Player favours {'ranged' if pr.value > 0.55 else 'melee' if pr.value < 0.45 else 'mixed'} combat ({pr.confidence:.2f})")
            ag = self.get("aggression")
            if ag.confidence > 0.3 and ag.value > 0.7:
                self._note("Player is aggressive — assisting attacks earlier")
            df = self.get("defensive_tendency")
            if df.confidence > 0.3 and df.value > 0.6:
                self._note("Player plays defensively — prioritising intercepts")

    def _observe_twin(self, event: Event) -> None:
        t = event.tick
        data = event.data
        rate = EXPERIENCE_RATE

        if event.type == "TWIN_OUTCOME":
            self.outcomes_seen += 1
            intent = str(data.get("intent"))
            success = bool(data.get("success"))
            dealt = float(data.get("damage_dealt") or 0.0)
            taken = float(data.get("damage_taken") or 0.0)
            if intent in ("ATTACK", "ASSIST", "FLANK", "COMBO", "DISTRACT", "INTERCEPT", "PROTECT"):
                self._learn("aggression", 1.0 if success else 0.25, rate, t)
                if taken > dealt and taken > 0:
                    self._learn("risk_tolerance", 0.0, rate, t)
                    self._learn("preferred_range", 1.0, rate * 0.8, t)   # got hurt up close: hang back
                    self._note(f"{intent.title()} cost more than it dealt — becoming more careful")
                elif success and dealt > 0:
                    self._learn("risk_tolerance", 0.8, rate * 0.6, t)
                    if self.outcomes_seen % 5 == 0:
                        self._note(f"{intent.title()} keeps paying off — trusting it more")
            elif intent == "RETREAT":
                self._learn("defensive_tendency", 1.0 if success else 0.4, rate, t)
                if success:
                    self._note("Retreating at low health worked")
            elif intent == "HEAL":
                # The fraction it actually drank at, reinforced when the drink
                # landed and pushed *up* when it did not: a HEAL that ended with
                # the twin taking hits means it left the decision too late, and
                # the fix is to drink earlier rather than to stop drinking.
                at = data.get("health_fraction")
                if at is not None:
                    self._learn("drink_threshold", float(at) if success else min(1.0, float(at) + 0.3),
                                rate, t)
                if success:
                    self._learn("stock_target", 0.85, rate * 0.7, t)
                    self._note("Drinking before it got bad worked")
            elif intent == "SHOP":
                if success:
                    self._learn("thrift", 0.3, rate * 0.5, t)
            elif intent in ("FOLLOW", "REPOSITION", "EXPLORE", "EAT"):
                if taken > 0:
                    self._learn("defensive_tendency", 0.7, rate * 0.5, t)
        elif event.type == "TWIN_DAMAGED":
            intent = str(data.get("intent", ""))
            if intent in ("ATTACK", "ASSIST", "FLANK"):
                self._learn("risk_tolerance", 0.2, rate * 0.5, t)
        elif event.type == "TWIN_DOWNED":
            self._learn("risk_tolerance", 0.0, rate * 2.0, t)
            self._learn("defensive_tendency", 1.0, rate * 1.5, t)
            self._learn("preferred_range", 1.0, rate, t)
            self._note("Went down — will keep more distance and retreat sooner")
            # Going down is the sharpest lesson available, and which lesson it is
            # depends on what was in the pack. Holding a potion and dying with it
            # is a timing mistake; dying with an empty pack is a supply mistake.
            # Either way, gold that stayed in a pocket bought nothing.
            potions = int(data.get("potions") or 0)
            self._learn("thrift", 0.0, rate, t)
            if potions > 0:
                self._learn("drink_threshold", 1.0, rate * 1.6, t)
                self._note(f"Went down holding {potions} potion{'s' if potions > 1 else ''} — drink sooner")
            else:
                self._learn("stock_target", 1.0, rate * 1.6, t)
                self._note("Went down with nothing to drink — buy potions next time")

    # --- serialisation ----------------------------------------------------------------------

    def snapshot(self) -> dict:
        return {
            "dims": {name: dim.to_dict() for name, dim in self.dims.items()},
            "lessons": list(self.lessons),
            "playerEventsSeen": self.player_events_seen,
            "outcomesSeen": self.outcomes_seen,
            "learningMult": self.learning_mult,
        }
