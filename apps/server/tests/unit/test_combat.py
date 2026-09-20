from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from tests.conftest import DT, arm, events_of, run_ticks


def fresh() -> GameSession:
    s = GameSession("combat", seed=99, record=False)
    s.state.enemies = []          # entrance has none anyway; be explicit
    s.state.pending_events.clear()
    return s


def place_enemy(s: GameSession, kind: str, offset: Vec2):
    e = s.state.spawn_enemy(kind, s.state.player.position + offset)
    s.state.pending_events.clear()
    return e


def test_melee_swing_hits_only_in_facing_direction():
    s = fresh()
    p = s.state.player
    p.face(Vec2(1, 0))
    front = place_enemy(s, "skeleton", Vec2(40, 0))
    behind = place_enemy(s, "skeleton", Vec2(-40, 0))
    assert s.combat.process_player_attack(s.state)
    assert front.health < front.max_health
    assert behind.health == behind.max_health
    dealt = events_of(s, "DAMAGE_DEALT")
    assert len(dealt) == 1 and dealt[0].data["target"] == front.id
    attacked = events_of(s, "PLAYER_ATTACKED")[0]
    assert list(attacked.data["tags"]) == ["MELEE", "FAST"]
    assert attacked.data["action_token"] == "SWORD_STRIKE"
    assert p.target_id == front.id
    assert events_of(s, "TARGET_CHANGE")


def test_combo_chain_advances_and_finisher_hits_harder():
    s = fresh()
    p = s.state.player
    # The three-hit chain is the sword's; bare hands only swing twice.
    arm(s, "iron_sword")
    p.face(Vec2(1, 0))
    e = place_enemy(s, "slime", Vec2(40, 0))
    e.max_health = e.health = 10_000
    s.combat.rng = type(s.combat.rng)(0)  # deterministic crit rolls either way
    damages = []
    for _ in range(3):
        before = e.health
        assert s.combat.process_player_attack(s.state)
        damages.append(before - e.health)
        p.attack_cooldown = 0
    assert p.combo_step == 3
    assert damages[2] > damages[0]
    assert events_of(s, "PLAYER_ATTACKED")[-1].data["action_token"] == "SWORD_FINISHER"


def test_attack_respects_cooldown():
    s = fresh()
    place_enemy(s, "skeleton", Vec2(40, 0))
    assert s.combat.process_player_attack(s.state)
    assert not s.combat.process_player_attack(s.state)


def test_bow_fires_a_projectile_in_facing_direction_that_damages():
    s = fresh()
    p = s.state.player
    p.inventory.add_weapon("hunter_bow")
    p.inventory.equip("hunter_bow")
    p.face(Vec2(0, -1))
    e = place_enemy(s, "skeleton", Vec2(0, -150))
    assert s.combat.process_player_attack(s.state)
    assert len(s.state.projectiles) == 1
    proj = s.state.projectiles[0]
    assert proj.velocity.y < 0 and abs(proj.velocity.x) < 1e-6
    for _ in range(40):
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
    assert e.health < e.max_health
    assert events_of(s, "PROJECTILE_HIT")


def test_the_ember_staff_bashes_on_m1_and_costs_nothing():
    """M1 is the bash. The fire is in the three spells the staff grants."""
    s = fresh()
    p = s.state.player
    p.inventory.add_weapon("ember_staff")
    p.inventory.equip("ember_staff")
    p.face(Vec2(1, 0))
    close = place_enemy(s, "skeleton", Vec2(50, 0))
    far = place_enemy(s, "skeleton", Vec2(220, 0))
    mana = p.mana

    assert s.combat.process_player_attack(s.state)
    assert p.mana == mana, "a bash is not a spell"
    assert not s.state.projectiles, "and it throws nothing"
    assert close.health < close.max_health
    assert far.health == far.max_health, "it only reaches what it can touch"
    assert events_of(s, "PLAYER_ATTACKED")[-1].data["action_token"] == "STAFF_STRIKE"


def test_the_ember_bolt_is_a_spell_now_and_still_bursts_on_impact():
    s = fresh()
    p = s.state.player
    arm(s, "ember_staff")
    p.face(Vec2(1, 0))
    a = place_enemy(s, "skeleton", Vec2(160, 0))
    b = place_enemy(s, "skeleton", Vec2(160, 40))
    mana = p.mana
    # Key one, the staff's first spell.
    assert s.combat.process_ability(s.state, 1)
    assert p.mana < mana
    for _ in range(60):
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
    assert a.health < a.max_health and b.health < b.max_health


def test_arcane_bolt_and_flame_burst_and_nova():
    s = fresh()
    p = s.state.player
    # Both staves: fire fills keys one to three, frost fills four to six.
    arm(s, "ember_staff", "frost_staff")
    p.face(Vec2(1, 0))
    near = place_enemy(s, "skeleton", Vec2(90, 10))
    around = place_enemy(s, "skeleton", Vec2(-80, 60))
    # Flame burst: cone in front only. Key two, the ember staff's second.
    assert s.combat.process_ability(s.state, 2)
    assert near.health < near.max_health and around.health == around.max_health
    cast = events_of(s, "PLAYER_ABILITY_CAST")[-1]
    assert cast.data["ability"] == "FLAME_BURST" and near.id in cast.data["targets"]
    p.state = "idle"
    # Nova: radial, slows. Key five -- the frost staff's second.
    assert s.combat.process_ability(s.state, 5)
    assert around.health < around.max_health
    assert "slow" in around.status_effects and around.slow_factor < 1
    p.state = "idle"
    # Rimelance: a beam, resolved the instant it is cast. Key six, the frost
    # staff's third. It used to be a fast projectile that threw a violet thorn
    # while its icon and its cast animation were both the ice beam.
    p.face(Vec2(1, 0))
    before = near.health
    assert s.combat.process_ability(s.state, 6)
    assert not any(pr.kind == "arcane_bolt" for pr in s.state.projectiles), "it still throws something"
    assert near.health < before, "the enemy in front of it was not hit"
    cast = events_of(s, "PLAYER_ABILITY_CAST")[-1]
    assert cast.data["ability"] == "ARCANE_BOLT" and near.id in cast.data["targets"]


def test_shadow_dash_emits_dash_and_dodge_telemetry():
    s = fresh()
    p = s.state.player
    # The sword's pair: guard on one, the step on two.
    arm(s, "iron_sword")
    p.apply_input(DT, PlayerInput(move_x=1))
    e = place_enemy(s, "skeleton", Vec2(30, 0))
    from mirrorbound.game.entities.enemy import EnemyState
    e.state = EnemyState.ATTACK
    e.windup_timer = 0.3
    e.target_id = p.id
    assert s.combat.process_ability(s.state, 2)
    assert p.state == "dash"
    assert events_of(s, "PLAYER_DASHED")[0].data["action_token"] == "DASH"
    assert events_of(s, "PLAYER_DODGED")


def test_ability_rejected_without_mana_emits_event():
    s = fresh()
    arm(s, "ember_staff")
    s.state.player.mana = 0
    assert not s.combat.process_ability(s.state, 1)
    rej = events_of(s, "ACTION_REJECTED")
    assert rej and rej[0].data["reason"] == "mana"


def test_killing_an_enemy_grants_xp_drops_loot_and_emits_kill():
    s = fresh()
    p = s.state.player
    p.face(Vec2(1, 0))
    e = place_enemy(s, "skeleton", Vec2(40, 0))
    e.health = 1
    s.combat.process_player_attack(s.state)
    assert not e.active
    kills = events_of(s, "ENEMY_KILLED")
    assert kills and kills[0].data["killer"] == p.id and kills[0].data["xp_reward"] == 24
    assert p.xp == 24 and p.kills == 1
    assert s.state.pickups, "loot should drop"
    assert any(pk.kind == "essence" for pk in s.state.pickups)


def test_enemy_melee_attack_damages_player_and_ranged_fires():
    s = fresh()
    p = s.state.player
    knight = place_enemy(s, "skeleton", Vec2(30, 0))
    hp = p.health
    assert s.combat.process_enemy_attack(s.state, knight, p)
    assert p.health < hp
    assert events_of(s, "DAMAGE_TAKEN")
    archer = place_enemy(s, "archer", Vec2(200, 0))
    s.combat.process_enemy_attack(s.state, archer, p)
    assert any(pr.faction == "enemy" for pr in s.state.projectiles)


def test_player_death_sets_phase_and_session_respawns():
    s = fresh()
    p = s.state.player
    knight = place_enemy(s, "skeleton", Vec2(30, 0))
    p.health = 1
    s.combat.process_enemy_attack(s.state, knight, p)
    assert s.state.phase == "dead" and events_of(s, "PLAYER_DIED")
    run_ticks(s, 60 * 4)
    assert s.state.phase == "playing" and p.health == p.max_health
    assert events_of(s, "PLAYER_RESPAWNED")


def test_loot_is_collected_into_inventory_and_emits_pickup():
    s = fresh()
    p = s.state.player
    s.state.spawn_pickup("essence", p.position, amount=3)
    s.state.spawn_pickup("weapon", p.position, item_id="hunter_bow")
    s.state.spawn_pickup("health_potion", p.position)
    s.combat.loot.update(DT, s.state)
    assert p.inventory.resources["essence"] == 3
    assert "hunter_bow" in p.inventory.weapons
    assert p.inventory.consumables["health_potion"] == 1
    assert len(events_of(s, "ITEM_PICKUP")) == 3


def _mash(s: GameSession, seconds: float, gap_seconds: float = 0.2) -> None:
    """Press attack every `gap_seconds` for `seconds`, through real ticks."""
    gap = max(1, round(gap_seconds / DT))
    for tick in range(round(seconds / DT)):
        s.pending_input = PlayerInput(attack=(tick % gap == 0))
        s.step(DT)


def test_combo_chain_advances_at_a_human_click_rate():
    """Clicking faster than the weapon swings must still chain.

    The chain needs its next press between the 0.42s cooldown and the 0.9s
    combo window. Presses used to be dropped outright if they arrived during
    the cooldown, so anyone clicking at a natural rate -- which is faster than
    that -- landed hit one over and over and never reached the finisher.
    """
    s = fresh()
    arm(s, "iron_sword")
    s.state.player.face(Vec2(1, 0))
    e = place_enemy(s, "slime", Vec2(40, 0))
    e.max_health = e.health = 10_000

    _mash(s, seconds=1.0)      # five clicks a second for a second

    attacks = events_of(s, "PLAYER_ATTACKED")
    assert [ev.data["comboStep"] for ev in attacks] == [1, 2, 3]
    assert attacks[-1].data["action_token"] == "SWORD_FINISHER"


def test_buffered_attack_expires_rather_than_queueing_up():
    """A press held in the buffer is forgotten if the weapon stays busy.

    Otherwise a player mashing during a long channel would empty a queue of
    swings the moment it ended.
    """
    s = fresh()
    arm(s, "iron_sword")
    place_enemy(s, "slime", Vec2(40, 0))
    s.pending_input = PlayerInput(attack=True)
    s.step(DT)
    assert len(events_of(s, "PLAYER_ATTACKED")) == 1
    # Three more presses inside the cooldown collapse into one buffered swing.
    for _ in range(3):
        s.pending_input = PlayerInput(attack=True)
        s.step(DT)
    run_ticks(s, 60)
    assert len(events_of(s, "PLAYER_ATTACKED")) == 2


# --- the beam ----------------------------------------------------------------
#
# Reported from play: "why the hell is frost staff's 3 some sort of thorn
# instead of the ice beam". It was a fast piercing *projectile* whose art
# resolved to `thorn` tinted violet, while its icon and its cast animation were
# both the ice beam -- which is a lance that grows from the staff and retracts
# and cannot fly across a room without reading as something else entirely.


#: The frost staff's third spell. Armed alone it fills keys one to three, so
#: the beam is on three -- not on six, which is where it sits only when the
#: ember staff is in the other hand.
BEAM_SLOT = 3


def beam_session():
    """A session with the frost staff in hand, facing east."""
    s = fresh()
    arm(s, "frost_staff")
    s.state.player.face(Vec2(1, 0))
    return s


def test_the_beam_hits_everything_along_the_line():
    """It pierces by construction: there is no first target to stop at."""
    s = beam_session()
    near = place_enemy(s, "skeleton", Vec2(120, 0))
    far = place_enemy(s, "skeleton", Vec2(500, 0))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    assert near.health < near.max_health
    assert far.health < far.max_health, "it stopped at the first thing it hit"


def test_it_misses_what_is_not_in_front_of_it():
    s = beam_session()
    behind = place_enemy(s, "skeleton", Vec2(-200, 0))
    aside = place_enemy(s, "skeleton", Vec2(300, 260))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    assert behind.health == behind.max_health, "it fired backwards"
    assert aside.health == aside.max_health, "its line is far too wide"


def test_it_reaches_most_of_the_way_across_what_you_can_see():
    """The one attack in the game that crosses a room."""
    s = beam_session()
    far = place_enemy(s, "skeleton", Vec2(700, 0))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    assert far.health < far.max_health


def test_it_stops_at_its_own_range():
    s = beam_session()
    beyond = place_enemy(s, "skeleton", Vec2(900, 0))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    assert beyond.health == beyond.max_health, "it has no end"


def test_it_leaves_from_the_staff_rather_than_the_goat():
    """The cast holds the staff out in front; the lance starts at its head.

    The event carries the same muzzle and reach the hitbox used, so the drawn
    beam and the line that hit are one line rather than two.
    """
    s = beam_session()
    place_enemy(s, "skeleton", Vec2(120, 0))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    cast = events_of(s, "PLAYER_ABILITY_CAST")[-1]
    assert cast.data["muzzle"] > 0
    assert cast.data["reach"] == 760


def test_it_throws_nothing():
    s = beam_session()
    place_enemy(s, "skeleton", Vec2(120, 0))
    assert s.combat.process_ability(s.state, BEAM_SLOT)
    assert not s.state.projectiles, "a beam that spawns a projectile is not a beam"
