"""The Sanctum's opening, as an authoritative sequence.

The scene the player sees is: the camera leaves them and finds the twin; the
twin walks to the middle of the room; the shard's red drains out of it; the
shell closes over it and cracks open as the Mirror; it says its piece; the
camera comes back; the fight starts.

Owned here rather than in the client, for the same reason everything else is:
the client renders it, but what is true during it -- that the player cannot
move, that the boss cannot attack, where the twin actually is -- is the
server's to say. A client-run cutscene would be a second simulation, and a
player who reloaded mid-scene would rejoin a world that disagreed with the one
they were watching.

Each beat is a duration in seconds, advanced by the fixed tick, so the sequence
is deterministic and replays identically. The client is told which beat is
running and for how long; it never decides when to move on.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Vec2


@dataclass(frozen=True)
class Beat:
    """One step of the scene, and how long the player watches it."""
    name: str
    seconds: float


#: The scene, in order.
#:
#: `approach` ends the moment the twin reaches the middle, so its length is a
#: safety net rather than a pace: the twin walks it at its own speed, and the
#: ceiling only has to cover the worst case of one starting in a far corner of
#: the largest room (about 2000 units of diagonal at 185 units a second). In
#: practice the twin walks in beside the player and takes a second or two.
BEATS: tuple[Beat, ...] = (
    Beat("focus", 0.9),      # camera leaves the player and settles on the twin
    Beat("approach", 12.0),  # the twin walks to the centre of the room
    Beat("cleanse", 1.4),    # the red drains out
    # Long enough to contain the animation the client plays over it.
    #
    # The shell is sixteen drawn frames across two sheets, with a held breath
    # before it cracks and a beat on the reveal: 4.83 seconds, measured in
    # `Hatch.HATCH_SECONDS`. At 2.6 the scene moved on to the Mirror's first
    # line while the shell was still closed and the boss still hidden, so it
    # spoke from inside an egg. The number lives here because the server owns
    # the pacing, but it is a fact about the art and the two have to agree.
    Beat("hatch", 5.0),      # the shell closes and cracks open
    Beat("speak", 0.0),      # the Mirror's lines; length comes from the lines
    Beat("release", 1.0),    # camera returns to the player
)

#: Seconds each line of dialogue holds the screen.
LINE_SECONDS = 2.6

#: What the Mirror says on the threshold. `{player}` and `{twin}` are filled in
#: from the campaign, so it uses the names the player chose.
LINES: tuple[str, ...] = (
    "You taught me every step of this.",
    "{twin} is not gone, {player}. {twin} is listening.",
    "Show me something I have not already learned.",
)


def speak_seconds() -> float:
    return len(LINES) * LINE_SECONDS


@dataclass
class Cutscene:
    """The running scene. Absent (`None` on the session) when nothing is playing."""
    index: int = 0
    elapsed: float = 0.0
    #: Where the twin is walking, set when the scene starts.
    centre: Vec2 = field(default_factory=Vec2)
    #: Lines already sent, so each is emitted exactly once.
    lines_sent: int = 0

    @property
    def beat(self) -> Beat:
        return BEATS[self.index]

    @property
    def done(self) -> bool:
        return self.index >= len(BEATS)

    def duration(self) -> float:
        beat = self.beat
        return speak_seconds() if beat.name == "speak" else beat.seconds

    def advance(self, dt: float) -> bool:
        """Tick the current beat. Returns True when it has just ended."""
        self.elapsed += dt
        if self.elapsed < self.duration():
            return False
        return True

    def next_beat(self) -> None:
        self.index += 1
        self.elapsed = 0.0
        self.lines_sent = 0

    def to_dict(self) -> dict:
        if self.done:
            return {}
        beat = self.beat
        return {
            "beat": beat.name,
            "elapsed": round(self.elapsed, 2),
            "duration": round(self.duration(), 2),
            # The client points the camera at whoever this names, and holds the
            # player's input for as long as the scene is in the snapshot.
            "focus": "player" if beat.name == "release" else "twin",
        }


__all__ = ["Beat", "BEATS", "Cutscene", "LINES", "LINE_SECONDS", "speak_seconds"]
