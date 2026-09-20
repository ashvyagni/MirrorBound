"""Cross-system regressions for the first release's reported playability gaps."""
import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.combat.mitigation import reductions_for
from mirrorbound.game.dungeon.room import Decor, Room
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.projectile import Projectile
from mirrorbound.game.entities.twin import TwinIntent
from mirrorbound.game.world import save as saves
from tests.conftest import DT, arm, events_of, play_cutscene, run_ticks


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(saves, 'SAVE_DIR', tmp_path)


def command(s, action, **kwargs):
    s.handle_input({'type': 'COMMAND', 'action': action, **kwargs})
    s.step(DT)


def test_dormant_twin_has_no_aggro_collision_projectile_or_protection_effect(session):
    st = session.state
    st.room = Room()
    st.enemies.clear()
    st.player.position = Vec2(600, 400)
    twin = st.twin
    twin.dormant = True
    twin.position = Vec2(400, 400)
    twin.velocity = Vec2(100, 0)
    enemy = st.spawn_enemy('skeleton', Vec2(405, 400))
    enemy.threat[twin.id] = 100
    assert session.enemy_controller._choose_target(enemy, st) is st.player
    assert session.mirror_controller._target(enemy, st) is st.player
    session.movement.update(DT, st)
    assert twin.position == Vec2(400, 400)
    assert enemy.position == Vec2(405, 400)
    shot = Projectile('shot', owner_id=enemy.id, position=twin.position.copy(), damage=25)
    st.projectiles = [shot]
    session.collision.update(DT, st)
    assert shot.active and not shot.hit_ids
    twin.position = st.player.position.copy()
    twin.intent = TwinIntent('PROTECT')
    assert reductions_for(st, st.player.id) == (0.0, [])
    hp = twin.health
    assert session.combat.damage_twin(st, 40, enemy.id, Vec2(), 100) == 0
    assert twin.health == hp
    assert not session.combat.process_twin_attack(st, enemy)


@pytest.mark.parametrize('offset, accepted', [(110, True), (110.01, False), (600, False)])
def test_purchase_revalidates_distance_even_while_paused(village_session, offset, accepted):
    s = village_session
    npc = next(n for n in s.state.room.npcs if n.definition.role == 'weaponsmith')
    s.state.player.position = Vec2(npc.x + offset, npc.y)
    s.state.player.inventory.gold = 100
    command(s, 'PAUSE')
    command(s, 'BUY_ITEM', npcId=npc.id, itemId='iron_sword')
    assert ('iron_sword' in s.state.player.inventory.weapons) is accepted
    assert s.state.player.inventory.gold == (55 if accepted else 100)
    assert s.state.paused


def test_transfers_are_moves_and_empty_twin_stays_unarmed_after_save(session):
    s = arm(session, 'iron_sword', 'hunter_bow')
    command(s, 'PAUSE')
    command(s, 'TWIN_EQUIP', weaponId='iron_sword')
    p, t = s.state.player, s.state.twin
    assert p.inventory.weapons == ['hunter_bow']
    assert p.inventory.equipped_weapon == 'hunter_bow'
    assert not p.inventory.offhand_weapon
    assert t.inventory.equipped_weapon == 'iron_sword'
    command(s, 'TWIN_EQUIP', weaponId='iron_sword')
    assert t.inventory.weapons.count('iron_sword') == 1
    for weapon in list(t.inventory.weapons):
        command(s, 'TWIN_REQUEST', weaponId=weapon)
    assert not t.inventory.weapons and not t.inventory.equipped_weapon and not t.inventory.offhand_weapon
    assert t.weapon.id == 'bare_hands'
    data = saves.build_save(s.session_id, s.campaign, p, t)
    reloaded = GameSession('transferred', seed=5, record=False)
    saves.apply_save(data, reloaded.state.player, reloaded.state.twin)
    assert reloaded.state.twin.weapon.id == 'bare_hands'
    assert not reloaded.state.twin.inventory.weapons


def test_dormant_twin_cannot_receive_equipment_or_calls(village_session):
    s = arm(village_session, 'iron_sword')
    command(s, 'TWIN_EQUIP', weaponId='iron_sword')
    command(s, 'TWIN_CALL')
    assert s.state.player.inventory.weapons == ['iron_sword']
    assert s.state.twin.call_remaining == 0
    assert len(events_of(s, 'ACTION_REJECTED')) == 2


def test_call_is_authoritative_follow_for_three_unpaused_seconds(session):
    s = session
    st = s.state
    st.room = Room()
    st.enemies.clear()
    st.player.position = Vec2(700, 400)
    st.twin.position = Vec2(400, 400)
    before = st.twin.distance_to(st.player)
    command(s, 'TWIN_CALL')
    assert events_of(s, 'TWIN_CALLED')
    run_ticks(s, 60)
    assert st.twin.intent.intent_type == 'FOLLOW'
    assert st.twin.distance_to(st.player) < before - 100
    remaining = st.twin.call_remaining
    command(s, 'PAUSE')
    run_ticks(s, 120)
    assert st.twin.call_remaining == remaining
    command(s, 'RESUME')
    run_ticks(s, 130)
    assert st.twin.call_remaining == 0


def test_victory_restores_twin_before_checkpoint_and_only_once():
    s = GameSession('ending', seed=5, record=False, start_area='mirror_sanctum')
    s.campaign.rescue_twin()
    s.state.twin.awaken(s.state.player.position, 'Ash')
    boss_room = next(r for r in s.dungeon.rooms if r.room_type == 'boss')
    s._enter_room(boss_room, from_side=None)
    play_cutscene(s)
    assert s.state.twin.dormant
    for enemy in list(s.state.get_active_enemies()):
        s.combat.damage_enemy(s.state, enemy, 10000, s.state.player.id, [], Vec2(), 0, 'test')
    s._room_logic()
    assert s.state.phase == 'victory'
    assert s.state.twin.available
    assert s.state.twin.health == s.state.twin.max_health
    assert 'twin_restored' in s.campaign.flags and 'twin_taken' not in s.campaign.flags
    restored = [e for e in events_of(s, 'TWIN_REVIVED') if e.data.get('restored')]
    assert len(restored) == 1
    saved = saves.read_save('ending')
    assert 'twin_restored' in saved['campaign']['flags']
    s._room_logic()
    assert len([e for e in events_of(s, 'TWIN_REVIVED') if e.data.get('restored')]) == 1
    reloaded = GameSession('ending', seed=5, record=False, load_save=True)
    assert reloaded.state.twin.available


def test_flame_pillar_waits_for_cast_time_and_does_not_heal(session):
    s = arm(session, 'ember_staff')
    s.state.room = Room()
    s.state.enemies.clear()
    s.state.player.position = Vec2(600, 400)
    s.state.player.health = 50
    enemy = s.state.spawn_enemy('brute', Vec2(650, 400))
    hp, mana = enemy.health, s.state.player.mana
    assert s.combat.process_ability(s.state, 3)   # the pillar; key one is the bolt
    assert enemy.health == hp and s.state.player.state == 'channel'
    run_ticks(s, 14)
    assert enemy.health == hp
    run_ticks(s, 2)
    assert enemy.health < hp
    assert s.state.player.health == 50
    assert s.state.player.mana < mana
    assert len(events_of(s, 'PLAYER_ABILITY_RESOLVED')) == 1


def test_flame_pillar_can_be_interrupted(session):
    s = arm(session, 'ember_staff')
    s.state.enemies.clear()
    assert s.combat.process_ability(s.state, 3)   # the pillar; key one is the bolt
    s.state.player.invulnerable_for = 0
    s.combat.damage_player(s.state, 1, 'enemy_test', Vec2(), 0)
    run_ticks(s, 30)
    assert events_of(s, 'ABILITY_INTERRUPTED')
    assert not events_of(s, 'PLAYER_ABILITY_RESOLVED')


def test_burn_can_kill_and_awards_rewards_once(session):
    s = session
    s.state.enemies.clear()
    enemy = s.state.spawn_enemy('slime', Vec2(600, 400))
    enemy.health = .01
    enemy.apply_status('burn', 1)
    before = s.state.stats.enemies_killed
    for _ in range(3):
        s.combat.update(DT, s.state)
    assert not enemy.active
    assert s.state.stats.enemies_killed == before + 1
    assert len(events_of(s, 'ENEMY_KILLED')) == 1


def test_dash_cannot_tunnel_through_scaled_decor(session):
    s = session
    s.state.room = Room(decor=[Decor('rock', 640, 400, blocking=True, radius=18, scale=1.5)])
    p = s.state.player
    p.position, p.velocity = Vec2(580, 400), Vec2(10000, 0)
    s.movement._move(DT, p, s.state)
    assert p.position.x <= 640 - 27 - p.radius + .001
    assert not s.state.room.is_blocked(p.position, p.radius - .001)


@pytest.mark.parametrize('state', ['idle', 'attack', 'cast', 'channel', 'drink', 'hurt', 'dead'])
@pytest.mark.parametrize('running', [False, True])
def test_lite_snapshot_movement_rate_matches_server_constraints(session, state, running):
    from mirrorbound.game.entities.player import PlayerInput
    p = session.state.player
    p.state = state
    p.slow_factor = .6
    p.apply_input(DT, PlayerInput(move_x=1, run=running))
    wire = p.to_dict(detail=False)
    assert wire['runSpeed' if running else 'moveSpeed'] == pytest.approx(p.velocity.length(), abs=.001)
