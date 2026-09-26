"""Side quests, and the codex they fill in.

The beta had no quest system. `CampaignState.flags` was an untyped set of
strings, the elder set one of them, and that was the whole of it -- which was
enough for "go to the crypt" and is not enough for §5.

What §5 actually asks for is worth restating, because it rules out most of what
a quest system usually is: side quests must not be "kill five wolves" without
context; they should expand lore, explain characters, introduce locations, and
reinforce the main story rather than distract from it. So a quest here is a
short authored chain of steps, each of which is something you were going to do
anyway -- walk somewhere, talk to someone, clear a place -- with a reason
attached and something learned at the end.

Kept deliberately small (§36). There is no branching graph, no quest scripting
language and no per-step callbacks: a step is a *condition on an event* and the
tracker watches the bus. Adding a quest is adding a row.

**Determinism**: nothing here rolls. Quests advance on events the simulation
already publishes, in the order it publishes them.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: What a step is waiting for. Each maps to one event the game already emits.
#:
#:  talk    NPC_TALK with this npc id
#:  reach   AREA_ENTER with this area id
#:  slay    ENEMY_KILLED, this many of this enemy type ("" for any)
#:  clear   QUEST_UPDATED for an area completed, this area id
#:  gather  ITEM_PICKUP, this many of this item
STEP_KINDS = frozenset({"talk", "reach", "slay", "clear", "gather"})


@dataclass(frozen=True)
class QuestStep:
    """One thing to do, and the line the journal shows while you are doing it."""
    kind: str
    target: str
    text: str
    count: int = 1


@dataclass(frozen=True)
class QuestDef:
    id: str
    name: str
    #: Who hands it over. Talking to them when the prerequisites are met starts it.
    giver: str
    summary: str
    steps: tuple[QuestStep, ...]
    #: Campaign flags that must all be present before the giver will offer it.
    requires: tuple[str, ...] = ()
    reward_gold: int = 0
    reward_item: str = ""
    #: The codex entry finishing this unlocks. §15 wants the world explained
    #: progressively and by having been somewhere, not handed over at the start.
    lore: str = ""

    def to_dict(self, step: int) -> dict:
        done = step >= len(self.steps)
        return {
            "id": self.id,
            "name": self.name,
            "summary": self.summary,
            "giver": self.giver,
            "step": step,
            "done": done,
            "current": "" if done else self.steps[step].text,
            "steps": [
                {"text": s.text, "done": i < step, "count": s.count}
                for i, s in enumerate(self.steps)
            ],
            "rewardGold": self.reward_gold,
        }


@dataclass(frozen=True)
class LoreEntry:
    """One page of the codex."""
    id: str
    title: str
    body: str
    #: Where it sits in the codex: history | mirror | regions | people.
    section: str

    def to_dict(self) -> dict:
        return {"id": self.id, "title": self.title, "body": self.body, "section": self.section}


# --- the codex ---------------------------------------------------------------
#
# §15 asks for a coherent framework and for it to be revealed progressively:
# what people believe, and what is actually true, arriving in that order. These
# are unlocked by finishing the quest that earned them, so the history of the
# world is something the player went and found.

LORE: dict[str, LoreEntry] = {e.id: e for e in (
    LoreEntry(
        "the_owing", "What the Wood Is Owed", section="history",
        body=("Bram's grandfather ploughed to the treeline and no further, and could not say "
              "why. The stone in the wakewood says it plainly enough once you find it: the "
              "village was given the field, and the wood was given the dead. Hollow Reach has "
              "kept its half of that for six generations by not going in. Something under the "
              "wakewood has stopped keeping the other half."),
    ),
    LoreEntry(
        "the_count", "The Stonecount", section="history",
        body=("The bridge east is named for its toll: one stone laid on the parapet per "
              "traveller, taken up again on the way back. Stones left standing were people who "
              "did not return, and they were counted every spring so somebody would know. "
              "Nobody has counted them since the water came. There are a great many."),
    ),
    LoreEntry(
        "the_flood", "What the Water Took", section="regions",
        body=("The Drowned Flats were the road, and the road was the reason Emberfall and "
              "Hollow Reach were one thing rather than two. The water did not come from the "
              "sea or the sky -- it came up, all at once, the year the Sanctum went quiet. "
              "Kell has pulled two things out of it this month. Neither was a fish."),
    ),
    LoreEntry(
        "the_ribs", "The Ribs of Emberfall", section="history",
        body=("Emberfall is built inside a ribcage, and the people there have agreed not to "
              "ask whose. The terraces above were fired brick before anyone alive was born, "
              "and the kilns were not for pottery. Odd will tell you the old writing has a word "
              "for a thing that walks four paces behind you and copies how you stand. He will "
              "not tell you it does not translate to 'companion'."),
    ),
    LoreEntry(
        "the_glass", "The Sanctum of Glass", section="mirror",
        body=("Every account agrees on the shape and none on the cause. A room of glass under "
              "the terraces; a thing in it that has been alone a long time; and the Warden on "
              "the stair, facing *inward*. Guardians face the thing they are keeping out. The "
              "Warden was not keeping anyone from the Sanctum. It was keeping the Sanctum from "
              "the rest of us."),
    ),
    LoreEntry(
        "the_twin", "On Twins", section="mirror",
        body=("What people believe: that a twin is a companion the Mirror gives you, and that "
              "it is a gift. What the terraces' writing says: that the Mirror does not give. "
              "It borrows, it learns the shape of what it borrowed, and it returns something "
              "that fits the same outline. The longer it watches, the better the fit."),
    ),
)}


# --- the quests ---------------------------------------------------------------
#
# Four, each shaped the way §5 describes: a problem in a village, somewhere to go
# about it, something discovered there, and a conversation on the way back. None
# of them is a counter with a reward on the end; each one exists to say something
# about the world that the main route never stops to explain.

QUESTS: dict[str, QuestDef] = {q.id: q for q in (
    QuestDef(
        id="the_quiet_field", name="The Quiet Field", giver="farmer_bram",
        summary=("Bram's cattle will not go within a field's width of the treeline, and have "
                 "not for a month. He would like to know what they know."),
        steps=(
            QuestStep("reach", "wakewood", "Walk north into the Wakewood."),
            QuestStep("slay", "sprout", "Deal with what is living in the undergrowth.", count=2),
            QuestStep("talk", "farmer_bram", "Tell Bram what is in his wood."),
        ),
        reward_gold=70, lore="the_owing",
    ),
    QuestDef(
        id="the_stonecount", name="The Stonecount", giver="watch_wren",
        summary=("Wren counts the stones on Stonecount Bridge every spring. This spring the "
                 "count was wrong, and wrong in the direction that means somebody came back "
                 "who should not have."),
        steps=(
            QuestStep("reach", "greenmoor", "Cross Stonecount and walk the moor."),
            QuestStep("slay", "", "Clear whatever is using the old fields.", count=3),
            QuestStep("talk", "watch_wren", "Bring Wren her count."),
        ),
        requires=("quest_active",),
        reward_gold=90, lore="the_count",
    ),
    QuestDef(
        id="what_the_water_took", name="What the Water Took", giver="ferryman_kell",
        summary=("Kell has been pulling things out of the flats that are not fish, and he has "
                 "stopped looking at them. He would rather somebody else did."),
        steps=(
            QuestStep("slay", "slime", "Clear the shallows either side of the causeway.", count=2),
            QuestStep("talk", "ferryman_kell", "Tell Kell what is in his water."),
        ),
        requires=("cleared_wakewood_crypt",),
        reward_gold=120, lore="the_flood",
    ),
    QuestDef(
        id="ribs_and_ledgers", name="Ribs and Ledgers", giver="keeper_odd",
        summary=("Odd has most of a translation and none of the second half. The rest of the "
                 "inscription is up the Cut, on the terraces, where he is too old to go."),
        steps=(
            QuestStep("reach", "kiln_terraces", "Climb the Cut to the Kiln Terraces."),
            QuestStep("slay", "acolyte", "Clear the terrace where the writing is.", count=2),
            QuestStep("talk", "keeper_odd", "Bring Odd the rest of his sentence."),
        ),
        requires=("cleared_wakewood_crypt",),
        reward_gold=150, lore="the_ribs",
    ),
)}

#: Codex pages that are not a quest reward, and what puts them in the book.
#:
#: Some things you learn by getting somewhere rather than by being told, which is
#: §27's environmental storytelling given a page to land on.
LORE_ON_AREA: dict[str, str] = {
    "mirror_sanctum": "the_glass",
}
LORE_ON_FLAG: dict[str, str] = {
    "twin_rescued": "the_twin",
}


@dataclass
class QuestLog:
    """Which quests a run has taken, and how far through each one it is.

    `progress[quest_id]` is the index of the step being worked on, and a value at
    or past the end means finished. Absent means never started.
    """
    progress: dict[str, int] = field(default_factory=dict)
    known: list[str] = field(default_factory=list)

    # --- state ---------------------------------------------------------------

    def started(self, quest_id: str) -> bool:
        return quest_id in self.progress

    def done(self, quest_id: str) -> bool:
        quest = QUESTS.get(quest_id)
        return quest is not None and self.progress.get(quest_id, -1) >= len(quest.steps)

    def active(self) -> list[str]:
        return [q for q in self.progress if not self.done(q)]

    def offered_by(self, npc_id: str, flags: set[str]) -> QuestDef | None:
        """The quest this person is ready to hand over, if any."""
        for quest in QUESTS.values():
            if quest.giver != npc_id or self.started(quest.id):
                continue
            if all(flag in flags for flag in quest.requires):
                return quest
        return None

    def current_step(self, quest_id: str) -> QuestStep | None:
        quest = QUESTS.get(quest_id)
        if quest is None:
            return None
        step = self.progress.get(quest_id, 0)
        return quest.steps[step] if 0 <= step < len(quest.steps) else None

    # --- progress -------------------------------------------------------------

    def start(self, quest_id: str) -> bool:
        if quest_id in self.progress or quest_id not in QUESTS:
            return False
        self.progress[quest_id] = 0
        return True

    def learn(self, lore_id: str) -> bool:
        """Put a page in the codex. False when it was already there."""
        if lore_id not in LORE or lore_id in self.known:
            return False
        self.known.append(lore_id)
        return True

    def advance(self, kind: str, target: str) -> list[str]:
        """Tell every active quest that something happened.

        Returns the ids of quests that finished on this event, so the caller can
        pay them out. A step counts down rather than completing outright, which
        is what `count` is for.
        """
        finished: list[str] = []
        for quest_id in list(self.progress):
            step = self.current_step(quest_id)
            if step is None or step.kind != kind:
                continue
            # An empty target means "anything of this kind", which is how
            # "clear whatever is using the old fields" is expressed.
            if step.target and step.target != target:
                continue
            key = (quest_id, self.progress[quest_id])
            self._counted[key] = self._counted.get(key, 0) + 1
            if self._counted[key] < step.count:
                continue
            self.progress[quest_id] += 1
            if self.done(quest_id):
                finished.append(quest_id)
        return finished

    #: How many times each step has been satisfied so far, by (quest, step).
    _counted: dict[tuple[str, int], int] = field(default_factory=dict)

    # --- serialisation ---------------------------------------------------------

    def save_dict(self) -> dict:
        return {
            "progress": dict(self.progress),
            "known": list(self.known),
            # Part-finished steps are saved too, or a checkpoint taken after two
            # of three kills silently resets the count.
            "counted": [[q, s, n] for (q, s), n in self._counted.items()],
        }

    @classmethod
    def from_save(cls, data: dict) -> QuestLog:
        log = cls()
        raw = data.get("progress") or {}
        log.progress = {q: int(n) for q, n in raw.items() if q in QUESTS}
        log.known = [l for l in data.get("known", []) if l in LORE]
        for row in data.get("counted", []):
            if len(row) == 3 and row[0] in QUESTS:
                log._counted[(row[0], int(row[1]))] = int(row[2])
        return log

    def to_dict(self) -> dict:
        """The journal, as the client draws it."""
        return {
            "active": [QUESTS[q].to_dict(self.progress[q]) for q in self.progress
                       if not self.done(q)],
            "completed": [QUESTS[q].to_dict(self.progress[q]) for q in self.progress
                          if self.done(q)],
            "lore": [LORE[l].to_dict() for l in self.known],
        }


def validate() -> None:
    """Checked at import: a quest nobody can finish is worse than no quest."""
    from mirrorbound.game.world.npc import REGION_NPCS, VILLAGE_NPCS

    givers = {npc.id for people in (*VILLAGE_NPCS.values(), *REGION_NPCS.values())
              for npc in people}
    for quest in QUESTS.values():
        if quest.giver not in givers:
            raise ValueError(f"{quest.id}: nobody called {quest.giver!r} to give it")
        if not quest.steps:
            raise ValueError(f"{quest.id}: no steps")
        if quest.lore and quest.lore not in LORE:
            raise ValueError(f"{quest.id}: unknown codex page {quest.lore!r}")
        for step in quest.steps:
            if step.kind not in STEP_KINDS:
                raise ValueError(f"{quest.id}: unknown step kind {step.kind!r}")
            if step.count < 1:
                raise ValueError(f"{quest.id}: a step needs at least one of something")
        # The last step is a conversation, every time. §5's shape is "go, find
        # out, come back and be told what it meant" -- a quest that completes in
        # the field has nobody to explain what you found.
        if quest.steps[-1].kind != "talk":
            raise ValueError(f"{quest.id}: should end by reporting back")


validate()


__all__ = ["QuestDef", "QuestStep", "QuestLog", "QUESTS", "LORE", "LoreEntry",
           "LORE_ON_AREA", "LORE_ON_FLAG", "STEP_KINDS"]
