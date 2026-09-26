"""Three regional bosses, and the one thing they must not become.

§12 asks for two or three major encounters before the final confrontation, each
belonging to a region, telegraphing what it is about to do and changing as it is
worn down. It is equally clear about the other half: the Twin → Mirror ending
stays exactly where it is and nothing may weaken it.

So the load-bearing assertion in this file is the negative one. The Mirror is
the only thing in the game that reads the player's behaviour model; a regional
boss that borrowed that would spend the ending early, and a regional boss that
took the player's weapon would stop being the fight it was designed as.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.combat.abilities import ABILITIES
from mirrorbound.game.entities.enemy import ARCHETYPES
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.campaign import AREAS

DT = 1.0 / 60.0

GUARDIANS = {eid: e for eid, e in ARCHETYPES.items() if e.phases}


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def fight(enemy_type: str, area: str = "the_proving") -> tuple[GameSession, object]:
    """Put one boss in an empty room with an admin session driving it."""
    s = GameSession(f"boss-{enemy_type}", seed=5, record=False, start_area=area, is_admin=True)
    boss = s.state.spawn_enemy(enemy_type, s.state.player.position + Vec2(260, 0))
    s.state.pending_events.clear()
    return s, boss


def run_to(s: GameSession, boss, fraction: float, limit: int = 4000) -> None:
    """Wear a boss down to a health fraction, ticking the world as it goes."""
    target = boss.max_health * fraction
    for _ in range(limit):
        if boss.health <= target:
            return
        boss.health = max(target, boss.health - 6)
        s.step(DT)
    raise AssertionError("never got there")


# --- there are three, and they are where they should be -----------------------

def test_there_are_three_regional_bosses_before_the_mirror():
    assert set(GUARDIANS) == {"warden", "stonecount", "shardmother"}


def test_each_one_ends_a_dungeon_of_its_own():
    from mirrorbound.game.dungeon.templates import GUARDIAN_ROOMS

    hosted = {}
    for area in AREAS.values():
        if not area.guardian_room:
            continue
        room = GUARDIAN_ROOMS[area.guardian_room]
        bosses = {s.enemy_type for s in room.spawns if s.enemy_type in GUARDIANS}
        assert len(bosses) == 1, area.id
        hosted[area.id] = bosses.pop()
    assert set(hosted.values()) == set(GUARDIANS), hosted
    assert len(set(hosted)) == 3, "one dungeon each"


def test_a_dungeon_puts_its_own_guardian_in_rather_than_rolling_one():
    """Rolling would put the Shardmother in the barrow."""
    for area_id, expected in (("stonecount_barrow", "stonecount"),
                              ("glasswork", "shardmother"),
                              ("ashen_deep", "warden")):
        s = GameSession(f"g-{area_id}", seed=5, record=False, start_area=area_id)
        last = s.dungeon.rooms[len(AREAS[area_id].sequence) - 1]
        assert {sp.enemy_type for sp in last.enemy_spawns} == {expected}, area_id


# --- what makes them an encounter ---------------------------------------------

@pytest.mark.parametrize("enemy_type", sorted(GUARDIANS))
def test_every_boss_has_three_phases_that_escalate(enemy_type):
    phases = GUARDIANS[enemy_type].phases
    assert len(phases) == 3
    thresholds = [p.below for p in phases]
    assert thresholds == sorted(thresholds, reverse=True), "phases enter as health falls"
    assert phases[0].below == 1.0, "the first phase is the fight starting"
    assert all(p.tell for p in phases), "each turn has something to read"
    # Speed is the escalating stat, and it only ever goes up.
    speeds = [p.speed_mult for p in phases]
    assert speeds == sorted(speeds)


@pytest.mark.parametrize("enemy_type", sorted(GUARDIANS))
def test_every_special_is_authored_with_a_wind_up(enemy_type):
    """§12 wants telegraphed attacks, and the Warden's long tell is the lesson
    the Mirror later punishes you for over-learning."""
    for phase in GUARDIANS[enemy_type].phases:
        for ability_id in phase.abilities:
            assert ABILITIES[ability_id].cast_time >= 0.5, (enemy_type, ability_id)


@pytest.mark.parametrize("enemy_type", sorted(GUARDIANS))
def test_the_wind_up_actually_happens_before_the_damage(enemy_type):
    """The test above only checked the *data*, and that was not enough.

    The controller called `resolve_enemy_ability` the instant it chose a
    special, so a 1.1-second tell went off with no warning: the ability was
    telegraphed on paper and unavoidable in play, which is §20's "artificial
    difficulty" exactly. This is the assertion that would have caught it --
    something has to be announced, and the damage has to come later.
    """
    s, boss = fight(enemy_type)
    charge_tick = cast_tick = None
    for _ in range(1200):
        s.step(DT)
        for e in s.state.pending_events:
            if e.type in ("ENEMY_ABILITY_CHARGE", "BOSS_NOVA_CHARGE") and charge_tick is None:
                charge_tick = e.tick
            if e.type == "ENEMY_ABILITY_CAST" and charge_tick is not None and cast_tick is None:
                cast_tick = e.tick
        if cast_tick is not None:
            break
    assert charge_tick is not None, f"{enemy_type} never announced anything"
    assert cast_tick is not None, f"{enemy_type} announced and never landed it"
    assert cast_tick > charge_tick, "the damage arrived with the warning"
    assert (cast_tick - charge_tick) / 60.0 >= 0.5, "no time to read it"


def test_a_charging_boss_holds_still():
    """A wind-up read as a commitment, not as something it does while chasing."""
    s, boss = fight("warden")
    for _ in range(1200):
        s.step(DT)
        if boss.id in s.guardian_controller.charging:
            assert boss.velocity.is_zero(), "charging and still moving"
            return
    pytest.fail("the Warden never wound anything up")


@pytest.mark.parametrize("enemy_type", sorted(GUARDIANS))
def test_a_boss_changes_shape_as_it_is_worn_down(enemy_type):
    s, boss = fight(enemy_type)
    run_to(s, boss, 0.55)
    run_to(s, boss, 0.20)
    turns = [e for e in s.state.pending_events if e.type == "BOSS_PHASE"]
    assert [e.data["phase"] for e in turns] == [2, 3], turns
    assert all(e.data["tell"] for e in turns)


def test_a_phase_never_goes_backwards():
    """A boss that could drop a phase after a heal is one whose tells stop
    meaning anything."""
    s, boss = fight("stonecount")
    run_to(s, boss, 0.20)
    s.state.pending_events.clear()
    boss.health = boss.max_health
    for _ in range(120):
        s.step(DT)
    assert not [e for e in s.state.pending_events if e.type == "BOSS_PHASE"]
    assert s.guardian_controller.phase[boss.id] == 2


def test_the_ones_that_call_help_actually_call_it():
    s, boss = fight("stonecount")
    before = len(s.state.get_active_enemies())
    run_to(s, boss, 0.55)
    assert len(s.state.get_active_enemies()) > before


def test_help_never_arrives_on_top_of_the_player():
    """Damage nobody could have avoided is not difficulty."""
    s, boss = fight("warden")
    run_to(s, boss, 0.55)
    for enemy in s.state.get_active_enemies():
        if enemy is boss:
            continue
        assert (enemy.position - s.state.player.position).length() > 60, enemy.enemy_def.id


def test_specials_do_not_chain_into_each_other():
    """A fight that is only specials is as flat as one with none."""
    s, boss = fight("shardmother")
    for _ in range(900):
        s.step(DT)
    casts = [e.tick for e in s.state.pending_events if e.type == "ENEMY_ABILITY_CAST"]
    gaps = [(b - a) / 60.0 for a, b in zip(casts, casts[1:])]
    assert all(g >= 2.0 for g in gaps), gaps


# --- and what they must never be ------------------------------------------------

def test_no_regional_boss_reads_the_player_model():
    """The Mirror's premise belongs to the ending.

    Sharing it would mean the player meets a thing that counters their habits
    three times before the encounter the whole game is built toward.
    """
    s, boss = fight("warden")
    for _ in range(240):
        s.step(DT)
    # The Mirror's controller was never handed a model, because it never ran.
    assert s.mirror_controller.player_model == {}
    assert not [e for e in s.state.pending_events if e.type == "BOSS_COUNTER"]


def test_a_regional_boss_does_not_take_your_weapon():
    """`armed_with` rewrites reach, cadence and projectile from the weapon, so
    a Shardmother holding your sword stops throwing the fan it exists for."""
    s, boss = fight("shardmother")
    s.state.player.inventory.add_weapon("iron_sword")
    s.state.player.inventory.equip("iron_sword")
    s._arm_boss()
    assert boss.enemy_def.weapon_id == "", "took the sword"
    assert boss.enemy_def.projectile is not None
    assert boss.enemy_def.projectile.count == 5, "still throws the fan"


def test_the_mirror_still_takes_your_weapon():
    s, boss = fight("mirror")
    s.state.player.inventory.add_weapon("iron_sword")
    s.state.player.inventory.equip("iron_sword")
    s._arm_boss()
    assert boss.enemy_def.weapon_id == "iron_sword"


def test_only_the_sanctum_ends_the_run():
    """A regional boss is a milestone. The ending is still the ending."""
    for area_id in ("stonecount_barrow", "glasswork", "ashen_deep"):
        area = AREAS[area_id]
        assert area.sequence[-1].value != "boss", area_id
    assert AREAS["mirror_sanctum"].sequence[-1].value == "boss"


def test_beating_a_regional_boss_finishes_its_dungeon_without_ending_the_game():
    s = GameSession("milestone", seed=5, record=False, start_area="stonecount_barrow")
    last = s.dungeon.rooms[len(AREAS["stonecount_barrow"].sequence) - 1]
    s._enter_room(last, from_side="south")
    for enemy in list(s.state.get_active_enemies()):
        s.combat.damage_enemy(s.state, enemy, 10_000, s.state.player.id, [], Vec2(0, 1), 0.0, "t")
    s.step(DT)
    assert "stonecount_barrow" in s.campaign.completed_areas
    assert s.state.phase == "playing", "the run goes on"
    assert "seal_of_the_count" in s.campaign.seals


@pytest.mark.parametrize("enemy_type", sorted(GUARDIANS))
def test_a_boss_pays_out_like_a_milestone(enemy_type):
    loot = GUARDIANS[enemy_type].loot
    assert loot.shard_chance >= 0.9, enemy_type
    assert loot.weapon_chance > 0 and loot.relic_chance > 0
    assert GUARDIANS[enemy_type].xp_reward >= 260
