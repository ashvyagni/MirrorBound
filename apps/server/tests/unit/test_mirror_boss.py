from mirrorbound.game.entities.entity import Vec2
from tests.conftest import DT, combat_session, events_of, play_cutscene


def boss_session():
    s = combat_session("boss", seed=42, record=False)
    s.state.enemies = []
    boss = s.state.spawn_enemy("mirror", s.state.player.position + Vec2(150, 0))
    s.state.pending_events.clear()
    return s, boss


def confident(name: str, value: float, conf: float = 0.9) -> dict:
    return {"traits": {name: {"value": value, "confidence": conf}}, "predictions": [], "spatial": {}}


def run(s, boss, ticks):
    for _ in range(ticks):
        s.state.tick += 1
        s.mirror_controller.update(DT, boss, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
        s.state.player.update(DT)


def test_confident_melee_player_gets_kited():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("melee_dependency", 0.95)
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 90)
    assert boss.distance_to(s.state.player) > d0
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "kite" in counters


def test_unknown_player_gets_generic_charge():
    s, boss = boss_session()
    s.mirror_controller.player_model = {"traits": {}, "predictions": []}
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 60)
    assert boss.distance_to(s.state.player) < d0
    assert "kite" not in [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]


def test_predicted_aoe_makes_the_boss_sidestep():
    s, boss = boss_session()
    s.state.player.face(Vec2(1, 0))
    s.mirror_controller.player_model = {"traits": {}, "predictions": [{"token": "FLAME_BURST", "confidence": 0.8}]}
    run(s, boss, 20)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "dodge_aoe" in counters


def test_confident_ranged_player_gets_rushed():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("ranged_dependency", 0.95)
    s.state.player.position = boss.position + Vec2(300, 0)
    d0 = boss.distance_to(s.state.player)
    run(s, boss, 30)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "rush" in counters
    assert boss.distance_to(s.state.player) < d0


def test_confident_aggressive_player_gets_riposted_right_after_swinging():
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("aggression", 0.95)
    s.state.player.position = boss.position - Vec2(40, 0)
    s.mirror_controller.note_player_attack(s.state.tick)
    run(s, boss, 1)
    assert boss.windup_timer >= .30
    run(s, boss, 4)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "riposte" in counters
    assert boss.state.value == "attack"


def test_predicted_dash_makes_the_boss_lead_its_shot():
    s, boss = boss_session()
    s.mirror_controller.player_model = {
        "traits": {}, "predictions": [{"token": "SHADOW_DASH", "confidence": 0.8}],
    }
    # Mid-range: close enough for the opportunistic ranged attack, far enough
    # that the windup resolves as a ranged shot rather than a melee swing.
    s.state.player.position = boss.position - Vec2(200, 0)
    s.state.player.last_move_dir = Vec2(-1, 0)
    run(s, boss, 40)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "predict_dash" in counters


def test_phase_two_denies_the_players_favourite_combat_cell():
    s, boss = boss_session()
    boss.health = boss.max_health * 0.5  # hp fraction 0.5 -> phase 2 (phase 1 is > 0.6)
    s.mirror_controller.player_model = {
        "traits": {}, "predictions": [],
        "spatial": {"combat": [{"cell": [50, 50], "weight": 5.0}]},
    }
    s.state.player.position = boss.position + Vec2(300, 0)
    run(s, boss, 3)
    counters = [e.data["counter"] for e in events_of(s, "BOSS_COUNTER")]
    assert "deny_zone" in counters
    assert boss.state.value == "reposition"
    assert boss.reposition_target is not None


def test_boss_kill_completes_the_run():
    # The Mirror is only in its own area; the first dungeon ends at an elite.
    s = combat_session("bossrun", seed=42, start_area="mirror_sanctum")
    boss_room = s.dungeon.rooms[-1]
    s._enter_room(boss_room, from_side="south")
    play_cutscene(s)
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    boss.health = 1
    s.state.player.position = boss.position - Vec2(40, 0)
    s.state.player.face(Vec2(1, 0))
    s.state.player.attack_cooldown = 0
    assert s.combat.process_player_attack(s.state)
    assert not boss.active
    s.step(DT)
    assert s.state.phase == "victory"
    assert events_of(s, "RUN_COMPLETE") or any(e.type == "RUN_COMPLETE" for e in s.state.bus._buffer)


def test_dying_to_the_mirror_ends_the_run_but_dying_elsewhere_does_not():
    """Only the Sanctum is final.

    Respawning at the entrance of the last room would let the player walk back
    in with the boss still on whatever health they left it, which turns the
    fight into an attrition the boss cannot win.
    """
    s = combat_session("final", seed=42, start_area="mirror_sanctum")
    s._enter_room(s.dungeon.rooms[-1], from_side="south")
    play_cutscene(s)
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    s.combat.damage_player(s.state, 10_000, boss.id, Vec2(1, 0), 0)
    assert s.state.phase == "defeat"
    assert events_of(s, "RUN_FAILED")
    assert events_of(s, "PLAYER_DIED")[0].data["final"] is True
    # And the world stops: no respawn timer ticking the player back in.
    s.step(DT)
    assert s.state.phase == "defeat"


def test_dying_in_an_ordinary_room_still_respawns():
    s = combat_session("setback", seed=42)
    enemy = s.state.spawn_enemy("skeleton", s.state.player.position + Vec2(40, 0))
    s.combat.damage_player(s.state, 10_000, enemy.id, Vec2(1, 0), 0)
    assert s.state.phase == "dead"
    assert not events_of(s, "RUN_FAILED")
    assert events_of(s, "PLAYER_DIED")[0].data["final"] is False


# --- stance commitment -------------------------------------------------------
#
# Reported from play: "its entire ai just continuously keeps distance from me,
# and its annoying." It was not a bug in the model -- the model had read the
# player correctly. `melee_dependency` saturates at 1.0 after a couple of dozen
# sword swings and never comes down, the counters were scored fresh every tick,
# and so `kite` won every tick of the entire fight. The boss was right about the
# player and unplayable because of it.


def melee_player(s):
    s.mirror_controller.player_model = {
        "traits": {"melee_dependency": {"value": 1.0, "confidence": 1.0},
                   "aggression": {"value": 0.8, "confidence": 0.9}},
        "predictions": [], "spatial": {},
    }


def stance_mix(s, boss, seconds=24):
    """How the boss spends a fight against a player who keeps closing on it."""
    from collections import Counter
    seen = Counter()
    for _ in range(60 * seconds):
        s.state.tick += 1
        to = boss.position - s.state.player.position
        if to.length() > 1:
            s.state.player.velocity = to.normalized() * s.state.player.speed
        seen[s.mirror_controller.stance] += 1
        s.mirror_controller.update(DT, boss, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
        s.state.player.update(DT)
    total = sum(seen.values())
    return {name: count / total for name, count in seen.items()}


def test_it_still_mostly_keeps_away_from_a_melee_player():
    """The read is correct and should still drive most of the fight."""
    s, boss = boss_session()
    melee_player(s)
    mix = stance_mix(s, boss)
    assert mix.get("kite", 0) > mix.get("press", 0)


def test_but_it_commits_to_closing_often_enough_to_be_fought():
    """The fix, stated as the thing that was wrong.

    A boss that keeps range on every tick of every phase cannot be reached by
    the player it has correctly identified as melee, which is a boss that reads
    you perfectly and is no fun at all. It must put itself in reach regularly.
    """
    s, boss = boss_session()
    melee_player(s)
    mix = stance_mix(s, boss)
    assert mix.get("press", 0) > 0.25, f"barely ever closes: {mix}"


def test_it_announces_deciding_to_close():
    """Changing its mind in front of you is the whole point of the system."""
    s, boss = boss_session()
    melee_player(s)
    stance_mix(s, boss)
    counters = {e.data["counter"] for e in events_of(s, "BOSS_COUNTER")}
    assert "press" in counters and "kite" in counters, counters


def test_the_last_phase_stops_backing_away_altogether():
    """The climax should not be the longest chase of the encounter."""
    s, boss = boss_session()
    melee_player(s)
    boss.health = boss.max_health * 0.2
    for _ in range(60 * 6):
        s.state.tick += 1
        boss.health = boss.max_health * 0.2   # hold the phase
        s.mirror_controller.update(DT, boss, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.state.player.update(DT)
    assert s.mirror_controller.phase == 3
    assert s.mirror_controller.stance == "press"


def test_a_ranged_player_is_closed_on_and_never_kited():
    """The counter for a ranged player was always right; keep it that way."""
    s, boss = boss_session()
    s.mirror_controller.player_model = confident("ranged_dependency", 0.95)
    mix = stance_mix(s, boss)
    assert mix.get("kite", 0) == 0, mix


def test_an_unread_player_is_closed_on():
    """Thirty seconds in, the boss knows nothing and should still fight."""
    s, boss = boss_session()
    s.mirror_controller.player_model = {"traits": {}, "predictions": []}
    mix = stance_mix(s, boss, seconds=8)
    assert mix.get("kite", 0) == 0, mix


# --- the kit it takes off you -------------------------------------------------
#
# Reported from play: "if the boss gets the flame thing it should have all those
# abilities including its own two abilities, i feel like it never uses them."
# It never did. `armed_with` copied the weapon's reach, cadence and projectile
# and dropped `weapon.abilities` on the floor, and `MirrorController` had no
# route to cast anything at all -- its nova was a hard-coded special case with
# its radius and damage as module constants, which is exactly why nothing else
# could ever be added beside it.


def armed(s, weapon: str):
    from mirrorbound.game.entities.enemy import ARCHETYPES, armed_with

    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    boss.enemy_def = armed_with(ARCHETYPES["mirror"], weapon)
    return boss


def casts_over(s, boss, seconds=30, hp_frac=1.0, chase=True):
    """What the boss casts in a fight where nobody dies.

    Both fighters are topped up every tick on purpose. Without it the player is
    dead inside ten seconds, the boss retargets the twin, and every number that
    comes out is about a corpse rather than about the boss's choices.
    """
    from collections import Counter

    for _ in range(int(60 * seconds)):
        s.state.tick += 1
        s.state.player.health = s.state.player.max_health
        s.state.twin.health = s.state.twin.max_health
        boss.health = boss.max_health * hp_frac
        to = boss.position - s.state.player.position
        if chase and to.length() > 1:
            s.state.player.velocity = to.normalized() * s.state.player.speed
        s.mirror_controller.update(DT, boss, s.state, s.combat)
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
        s.state.player.update(DT)
    return Counter(e.data["ability_id"] for e in events_of(s, "ENEMY_ABILITY_CAST"))


def test_an_unarmed_mirror_still_has_its_own_two():
    _, boss = boss_session()
    assert set(boss.enemy_def.abilities) == {"mirror_nova", "mirror_volley"}


def test_taking_a_staff_adds_its_spells_and_keeps_its_own():
    s, _ = boss_session()
    boss = armed(s, "ember_staff")
    assert boss.enemy_def.abilities[:2] == ("mirror_nova", "mirror_volley"), "its own come first"
    assert {"ember_bolt", "flame_burst", "flame_pillar"} <= set(boss.enemy_def.abilities)


def test_a_mirror_with_the_ember_staff_actually_casts_its_spells():
    """The whole complaint: it held the staff and only ever swung it."""
    s, _ = boss_session()
    boss = armed(s, "ember_staff")
    melee_player(s)
    cast = casts_over(s, boss)
    assert cast, "it cast nothing at all"
    assert set(cast) & {"flame_burst", "flame_pillar"}, f"no fire spells: {dict(cast)}"
    assert "mirror_nova" in cast, "and it stopped using its own"


def test_it_does_not_throw_spells_that_cannot_reach():
    """A cone or a nova spent on someone outside it is a cooldown spent on nothing."""
    s, _ = boss_session()
    boss = armed(s, "ember_staff")
    melee_player(s)
    # Held at arm's length, well outside every radius the staff has.
    s.state.player.position = boss.position + Vec2(600, 0)
    cast = casts_over(s, boss, seconds=12, chase=False)
    assert "flame_burst" not in cast, "threw a 170-unit cone at 600 units"
    assert "flame_pillar" not in cast


def test_it_heals_only_when_it_is_actually_hurt():
    s, _ = boss_session()
    boss = armed(s, "hunter_bow")
    melee_player(s)
    assert "mending_light" not in casts_over(s, boss, seconds=20, hp_frac=1.0)

    s2, _ = boss_session()
    boss2 = armed(s2, "hunter_bow")
    melee_player(s2)
    assert "mending_light" in casts_over(s2, boss2, seconds=20, hp_frac=0.3)


def test_its_nova_still_telegraphs_before_it_lands():
    """The fairest thing in the fight, and the refactor must not lose it."""
    s, _ = boss_session()
    melee_player(s)
    casts_over(s, next(e for e in s.state.enemies if e.enemy_def.boss), seconds=20)
    charges = events_of(s, "BOSS_NOVA_CHARGE")
    landed = events_of(s, "BOSS_NOVA")
    assert charges and landed
    assert charges[0].tick < landed[0].tick, "it went off before it was announced"


def test_two_mirrors_do_not_share_one_cooldown():
    """Cooldowns live on the creature, not on the archetype they share."""
    s, boss = boss_session()
    other = s.state.spawn_enemy("mirror", s.state.player.position + Vec2(-200, 0))
    boss.ability_timers["mirror_nova"] = 5.0
    assert other.ability_timers.get("mirror_nova", 0.0) == 0.0
