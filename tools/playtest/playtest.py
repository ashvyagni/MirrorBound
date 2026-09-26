#!/usr/bin/env python3
"""Repeatable combat probes, not a substitute for human difficulty testing.

Run: uv run --directory apps/server python ../../tools/playtest/playtest.py
A reactive bot fights opening, depths, Warden and Mirror encounters with each
weapon. Opening compares solo and twin play; Mirror is solo, as in the story. Checkpoints are isolated; no player save is changed.
"""
import argparse
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'apps/server'))
from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from mirrorbound.game.world import save

WEAPONS = ('iron_sword', 'hunter_bow', 'ember_staff', 'frost_staff',
           'warden_pike', 'shard_lance')
DT = 1 / 60

#: Every encounter worth probing, and where and at what level it is met.
#:
#: The three regional bosses were added in v1.1 and they are the ones the
#: difficulty pass is actually about: the Warden used to be a Crypt Brute with a
#: big health pool, and the two new ones have never been measured at all.
ENCOUNTERS = {
    'opening':    {'area': 'wakewood_crypt',    'room': 1,  'level': 1},
    'depths':     {'area': 'wakewood_crypt',    'room': -1, 'level': 3},
    'barrow':     {'area': 'stonecount_barrow', 'room': -1, 'level': 5},
    'glasswork':  {'area': 'glasswork',         'room': -1, 'level': 6},
    'warden':     {'area': 'ashen_deep',        'room': -1, 'level': 7},
    'mirror':     {'area': 'mirror_sanctum',    'room': -1, 'level': 8},
}


def probe(seed, weapon, twin, max_ticks=5400, encounter="opening"):
    spec = ENCOUNTERS[encounter]
    s = GameSession('balance-probe', seed=seed, record=False, start_area=spec['area'])
    s.state.player.inventory.add_weapon(weapon)
    s.state.player.level = spec['level']
    s.state.player.recompute_max_health()
    if twin:
        s.state.twin.awaken(s.state.player.position, 'Probe')
    # The last room on the *chain*: side rooms are appended after it, so -1 on
    # the list is a branch rather than the boss.
    index = spec['room'] if spec['room'] >= 0 else s.dungeon.last_room_index
    s._enter_room(s.dungeon.rooms[index], from_side='south')
    # The Sanctum's threshold starts a scene that owns the tick. Let it play.
    guard = 0
    while s.cutscene is not None and guard < 4000:
        s.step(DT)
        guard += 1
    initial = len(s.state.get_active_enemies())
    for elapsed in range(max_ticks):
        p = s.state.player
        target = s.state.nearest_enemy(p.position)
        if target is None or p.state == 'dead':
            break
        diff = target.position - p.position
        distance = diff.length()
        # The same simple policy in every case: approach melee, keep ranged
        # spacing, sidestep a telegraph, cast affordable/recharged abilities.
        reach = p.weapon.range * (.75 if p.weapon.is_melee else .65)
        move = diff.normalized() if distance > reach else Vec2()
        if not p.weapon.is_melee and distance < reach * .6:
            move = -diff.normalized()
        if target.is_winding_up and distance < target.enemy_def.attack_range + 35:
            move = diff.normalized().perpendicular()
        ability = None
        for slot in (1, 2):
            spec = p.ability_in_slot(slot)
            if spec is None or not p.can_use_ability(spec)[0]:
                continue
            if spec.type.value == 'heal' and p.health > p.max_health - 25:
                continue
            if spec.type.value in ('nova','cone') and distance > spec.area + target.radius:
                continue
            ability = slot
            break
        s.pending_input = PlayerInput(move_x=move.x, move_y=move.y, aim_x=diff.x, aim_y=diff.y,
                                      attack=p.can_attack(), ability=ability)
        s.step(DT)
        if elapsed % 3 == 0:
            s.snapshot()  # normal event draining and detail cadence
    result = {'encounter':encounter,'seed':seed,'weapon':weapon,'twin':twin,'seconds':round((elapsed+1)*DT,2),
              'cleared':not s.state.get_active_enemies(), 'initialEnemies':initial,
              'died': s.state.player.state == 'dead' or s.state.phase in ('dead','defeat'),
              'healthLeft': round(max(0.0, s.state.player.health / max(1.0, s.state.player.max_health)), 2),
              'kills':s.state.stats.enemies_killed, 'health':round(s.state.player.health,1),
              'damageTaken':round(s.state.stats.damage_taken,1),'casts':s.state.stats.abilities_cast,
              'twinKills':s.state.twin.kills,'error':s.last_error}
    s.stop()
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args=parser.parse_args()
    with TemporaryDirectory(prefix='mirrorbound-playtest-') as directory:
        save.SAVE_DIR=Path(directory)
        rows=[probe(seed,weapon,twin) for seed in (1,5,19) for weapon in WEAPONS for twin in (False,True)]
        # Replay the inputs generated by this policy: outcomes must match.
        assert rows[0] == probe(1,WEAPONS[0],False)
        rows += [probe(seed,weapon,encounter != 'mirror',encounter=encounter)
                 for encounter in ('depths','barrow','glasswork','warden','mirror')
                 for seed in (1,5,19) for weapon in WEAPONS]
    # Per encounter, because the headline number hides the thing worth knowing:
    # a suite that clears 80% overall can still have one fight nobody survives
    # and another nobody can lose.
    summary = {}
    for row in rows:
        bucket = summary.setdefault(row['encounter'], {'cases':0,'cleared':0,'died':0,
                                                       'seconds':0.0,'healthLeft':0.0})
        bucket['cases'] += 1
        bucket['cleared'] += int(row['cleared'])
        bucket['died'] += int(row['died'])
        bucket['seconds'] += row['seconds']
        bucket['healthLeft'] += row['healthLeft']
    for name, bucket in summary.items():
        n = bucket['cases']
        bucket['clearRate'] = round(bucket['cleared'] / n, 2)
        bucket['deathRate'] = round(bucket['died'] / n, 2)
        bucket['seconds'] = round(bucket['seconds'] / n, 1)
        bucket['healthLeft'] = round(bucket['healthLeft'] / n, 2)

    result={'scenario':'reactive scripted player, no skills and no healing items; '
                       'levels 1/3/5/6/7/8 by encounter',
            'cases':len(rows),'cleared':sum(row['cleared'] for row in rows),
            'crashes':sum(row['error'] is not None for row in rows),
            'byEncounter':summary,'results':rows}
    data=json.dumps(result,indent=2)+'\n'
    if args.output:
        args.output.write_text(data)
    print(json.dumps({'cases':result['cases'],'crashes':result['crashes'],
                      'byEncounter':summary}, indent=2))

if __name__ == '__main__':
    main()
