from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from tests.conftest import arm, DT, events_of, run_ticks


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


def test_ember_staff_costs_mana_and_bursts_on_impact():
    s = fresh()
    p = s.state.player
    p.inventory.add_weapon("ember_staff")
    p.inventory.equip("ember_staff")
    p.face(Vec2(1, 0))
    a = place_enemy(s, "skeleton", Vec2(160, 0))
    b = place_enemy(s, "skeleton", Vec2(160, 40))
    mana = p.mana
    assert s.combat.process_player_attack(s.state)
    assert p.mana < mana
    for _ in range(60):
        s.movement.update(DT, s.state)
        s.collision.update(DT, s.state)
    assert a.health < a.max_health and b.health < b.max_health


def test_arcane_bolt_and_flame_burst_and_nova():
    s = fresh()
    p = s.state.player
    # Both staves: fire fills keys one and two, frost fills three and four.
    arm(s, "ember_staff", "frost_staff")
    p.face(Vec2(1, 0))
    near = place_enemy(s, "skeleton", Vec2(90, 10))
    around = place_enemy(s, "skeleton", Vec2(-80, 60))
    # Flame burst: cone in front only. Key one, from the staff in hand.
    assert s.combat.process_ability(s.state, 1)
    assert near.health < near.max_health and around.health == around.max_health
    cast = events_of(s, "PLAYER_ABILITY_CAST")[-1]
    assert cast.data["ability"] == "FLAME_BURST" and near.id in cast.data["targets"]
    p.state = "idle"
    # Nova: radial, slows. Key three -- the frost staff's first.
    assert s.combat.process_ability(s.state, 3)
    assert around.health < around.max_health
    assert "slow" in around.status_effects and around.slow_factor < 1
    p.state = "idle"
    # Arcane bolt: a projectile appears. Key four, the frost staff's second.
    assert s.combat.process_ability(s.state, 4)
    assert any(pr.kind == "arcane_bolt" for pr in s.state.projectiles)


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
