"""Side quests, and the codex they fill in.

§5 rules out most of what a quest system usually is: a side quest must not be
"kill five wolves" without context, and it should expand lore and reinforce the
main story rather than distract from it. So what these tests hold onto is the
*shape* -- go somewhere, find something out, come back and be told what it meant
-- and that nothing can be taken, finished or paid out twice.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import CampaignState
from mirrorbound.game.world.npc import REGION_NPCS, TALK_RADIUS, VILLAGE_NPCS
from mirrorbound.game.world.quest import LORE, QUESTS, QuestLog

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def session(name="quests", area=None) -> GameSession:
    return GameSession(name, seed=5, record=False, start_area=area)


def talk_to(s: GameSession, npc_id: str) -> None:
    """Stand next to someone and speak to them, the way a player does."""
    npc = next(n for n in s.state.room.npcs if n.id == npc_id)
    s.state.player.position = Vec2(npc.x, npc.y + TALK_RADIUS * 0.5)
    s.handle_input({"type": "COMMAND", "action": "TALK", "npcId": npc_id})
    s.step(DT)


def events(s: GameSession, kind: str) -> list:
    return [e for e in s.state.pending_events if e.type == kind]


# --- the shape of a quest ----------------------------------------------------

def test_every_quest_is_offered_by_somebody_who_exists_and_ends_in_a_conversation():
    """Enforced at import by `validate`; asserted here so the reason is written down.

    A quest that completes out in the field has nobody to explain what you
    found, which is the difference between §5's structure and a counter.
    """
    givers = {npc.id for people in (*VILLAGE_NPCS.values(), *REGION_NPCS.values())
              for npc in people}
    for quest in QUESTS.values():
        assert quest.giver in givers, quest.id
        assert quest.steps[-1].kind == "talk", quest.id
        assert quest.summary and quest.name


def test_every_quest_pays_out_a_page_of_the_codex():
    """§5 says side quests exist to expand lore. All four do."""
    for quest in QUESTS.values():
        assert quest.lore in LORE, quest.id


def test_no_two_quests_hand_over_the_same_page():
    pages = [q.lore for q in QUESTS.values()]
    assert len(pages) == len(set(pages))


# --- taking and finishing ----------------------------------------------------

def test_talking_to_the_giver_takes_the_quest():
    s = session()
    assert not s.campaign.quests.started("the_quiet_field")
    talk_to(s, "farmer_bram")
    assert s.campaign.quests.started("the_quiet_field")
    taken = events(s, "QUEST_TAKEN")
    assert taken and taken[0].data["quest"] == "the_quiet_field"
    assert taken[0].data["first"], "the journal is told what to do first"


def test_a_quest_is_only_offered_once():
    s = session()
    talk_to(s, "farmer_bram")
    s.state.pending_events.clear()
    talk_to(s, "farmer_bram")
    assert not events(s, "QUEST_TAKEN")


def test_a_gated_quest_waits_for_its_flag():
    s = session()
    # Wren's count needs the elder to have set the run going.
    assert s.campaign.quests.offered_by("watch_wren", s.campaign.flags) is None
    s.campaign.flags.add("quest_active")
    assert s.campaign.quests.offered_by("watch_wren", s.campaign.flags).id == "the_stonecount"


def test_walking_and_fighting_advance_the_steps_in_order():
    """The whole chain, driven by the events the simulation already publishes."""
    s = session()
    talk_to(s, "farmer_bram")
    log = s.campaign.quests
    assert log.current_step("the_quiet_field").kind == "reach"

    # Step one: walk north into the wood.
    bridge = next(d for d in s.state.room.doors if d.target_area == "wakewood")
    s.state.transition_timer = 0.0
    s.state.player.position = Vec2(bridge.x, bridge.y)
    s.step(DT)
    assert s.campaign.current_area == "wakewood"
    assert log.current_step("the_quiet_field").kind == "slay"

    # Step two: two of the things living in the undergrowth. Killed through the
    # combat system rather than by zeroing health, because ENEMY_KILLED is what
    # a quest listens to and only the real damage path publishes it.
    for _ in range(2):
        sprout = next(e for e in s.state.get_active_enemies() if e.enemy_def.id == "sprout")
        s.combat.damage_enemy(s.state, sprout, 10_000, s.state.player.id, [],
                              Vec2(0, 1), 0.0, "test")
        s.step(DT)
    assert log.current_step("the_quiet_field").kind == "talk", "both counted"


def test_a_counted_step_needs_all_of_them():
    log = QuestLog()
    log.start("the_quiet_field")
    log.advance("reach", "wakewood")
    assert log.advance("slay", "sprout") == [], "one is not two"
    assert log.current_step("the_quiet_field").kind == "slay"
    log.advance("slay", "sprout")
    assert log.current_step("the_quiet_field").kind == "talk"


def test_an_empty_target_means_anything_of_that_kind():
    """"Clear whatever is using the old fields" should not care what it was."""
    log = QuestLog()
    log.progress["the_stonecount"] = 1     # straight to the slay step
    for kind in ("hound", "skeleton", "spitter"):
        log.advance("slay", kind)
    assert log.current_step("the_stonecount").kind == "talk"


def test_reporting_back_pays_out_once_and_only_once():
    s = session()
    talk_to(s, "farmer_bram")
    log = s.campaign.quests
    log.progress["the_quiet_field"] = len(QUESTS["the_quiet_field"].steps) - 1
    gold = s.state.player.inventory.gold

    s.state.pending_events.clear()
    talk_to(s, "farmer_bram")
    assert log.done("the_quiet_field")
    assert s.state.player.inventory.gold == gold + QUESTS["the_quiet_field"].reward_gold
    assert events(s, "QUEST_COMPLETE")

    paid = s.state.player.inventory.gold
    s.state.pending_events.clear()
    talk_to(s, "farmer_bram")
    assert s.state.player.inventory.gold == paid, "paid twice"
    assert not events(s, "QUEST_COMPLETE")


# --- the codex ----------------------------------------------------------------

def test_finishing_a_quest_puts_its_page_in_the_codex():
    s = session()
    talk_to(s, "farmer_bram")
    s.campaign.quests.progress["the_quiet_field"] = len(QUESTS["the_quiet_field"].steps) - 1
    s.state.pending_events.clear()
    talk_to(s, "farmer_bram")
    assert "the_owing" in s.campaign.quests.known
    found = events(s, "LORE_FOUND")
    assert found and found[0].data["lore"] == "the_owing"


def test_some_pages_are_earned_by_getting_somewhere():
    """§27: the environment says it, and the codex is where that lands."""
    s = session("sanctum", area="mirror_sanctum")
    assert "the_glass" in s.campaign.quests.known


def test_finding_the_twin_is_what_makes_the_page_about_twins_readable():
    s = session("twin", area="wakewood_crypt")
    assert "the_twin" not in s.campaign.quests.known
    s._enter_room(s.dungeon.rooms[2], from_side="south")
    assert "the_twin" in s.campaign.quests.known


def test_a_page_is_never_learned_twice():
    log = QuestLog()
    assert log.learn("the_owing")
    assert not log.learn("the_owing")
    assert log.known == ["the_owing"]


# --- persistence ---------------------------------------------------------------

def test_a_part_finished_step_survives_a_checkpoint():
    """Two of three kills, then a save. The count has to come back with it."""
    campaign = CampaignState()
    campaign.quests.progress["the_stonecount"] = 1
    campaign.quests.advance("slay", "hound")
    campaign.quests.advance("slay", "skeleton")

    restored = CampaignState.from_save(campaign.save_dict())
    assert restored.quests.current_step("the_stonecount").kind == "slay", "not finished yet"
    restored.quests.advance("slay", "hound")
    assert restored.quests.current_step("the_stonecount").kind == "talk", "the count came back"


def test_the_journal_and_the_codex_round_trip():
    campaign = CampaignState()
    campaign.quests.start("the_quiet_field")
    campaign.quests.learn("the_owing")
    restored = CampaignState.from_save(campaign.save_dict())
    assert restored.quests.progress == {"the_quiet_field": 0}
    assert restored.quests.known == ["the_owing"]


def test_a_save_naming_a_quest_that_no_longer_exists_still_loads():
    restored = CampaignState.from_save({
        "quests": {"progress": {"a_quest_we_cut": 2}, "known": ["a_page_we_cut"],
                   "counted": [["a_quest_we_cut", 0, 1]]},
    })
    assert restored.quests.progress == {}
    assert restored.quests.known == []


def test_the_journal_reaches_the_client():
    s = session()
    talk_to(s, "farmer_bram")
    journal = s.snapshot()["campaign"]["journal"]
    assert [q["id"] for q in journal["active"]] == ["the_quiet_field"]
    assert journal["active"][0]["current"], "the journal says what to do next"
    assert journal["completed"] == []
