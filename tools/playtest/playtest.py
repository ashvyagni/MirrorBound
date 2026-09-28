#!/usr/bin/env python3
"""Repeatable combat probes, not a substitute for human difficulty testing.

Run: uv run --directory apps/server python ../../tools/playtest/playtest.py
A reactive bot fights opening, depths, Warden and Mirror encounters with each
weapon. Opening compares solo and twin play; Mirror is solo, as in the story. Checkpoints are isolated; no player save is changed.

Since v1.2 every encounter is run twice, as two kinds of player:

* **bare** -- exactly what this probe always did. No attributes, no fittings, no
  stones. It is the v1.1 floor, kept identical so those published numbers stay
  comparable rather than being quietly replaced.
* **built** -- the same bot, having spent its level-up points and the ore the
  campaign spine would have yielded by that point (`REACHED_BY` x
  `expected_yield`), evenly across the five attributes up to the tier-3 gate,
  with the leftovers fitted into the weapon it is carrying.

The number worth reading is the **difference**. "Built clears the Warden more
often" is not interesting on its own; "built changes the opening by nothing and
the Warden by a lot" is the shape the curve is supposed to have, and "built
trivialises everything" would mean the layer is too strong. Neither kit uses
potions or skills, so both remain floors.

Hunger is deliberately not a dimension here. It freezes while a boss is armed, so
by construction it cannot touch four of the six encounters, and the freeze already
has a test. Measuring it would mean measuring the two non-boss rooms twice to
observe a debuff whose size is a constant.
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
from mirrorbound.game.progression.attributes import ATTRIBUTES, TIER_GATE
from mirrorbound.game.progression.materials import (
    MATERIALS, VEINS_PER_DUNGEON_ROOM, VEINS_PER_REGION, expected_yield, training_cost)
from mirrorbound.game.world import save
from mirrorbound.game.world.campaign import AREAS

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

#: What ground the player has crossed before each encounter, for the ore budget.
#:
#: The campaign's own spine, in order, and **the two optional regions are in no
#: budget at all**: the Windward Downs and the Rimefell are off the route, so a
#: probe that assumed the detour would be measuring the detour rather than the
#: fight. It is a floor here for the same reason the bot brings no potions.
REACHED_BY = {
    'opening':   ('hollowreach_vale',),
    'depths':    ('hollowreach_vale', 'wakewood', 'wakewood_crypt'),
    'barrow':    ('hollowreach_vale', 'wakewood', 'wakewood_crypt', 'greenmoor'),
    'glasswork': ('hollowreach_vale', 'wakewood', 'wakewood_crypt', 'greenmoor',
                  'stonecount_barrow', 'drowned_flats', 'emberfall_basin'),
    'warden':    ('hollowreach_vale', 'wakewood', 'wakewood_crypt', 'greenmoor',
                  'stonecount_barrow', 'drowned_flats', 'emberfall_basin',
                  'glasswork', 'kiln_terraces'),
    'mirror':    ('hollowreach_vale', 'wakewood', 'wakewood_crypt', 'greenmoor',
                  'stonecount_barrow', 'drowned_flats', 'emberfall_basin',
                  'glasswork', 'kiln_terraces', 'ashen_deep'),
}


def ore_budget(area_ids):
    """Expected ore from mining out every vein in those areas, once.

    Read from `expected_yield`, which is the same function
    `test_every_attribute_gate_is_reachable_by_mining` asserts against -- so this
    probe can never build a player the test believes impossible.
    """
    budget = {}
    for area_id in area_ids:
        area = AREAS[area_id]
        key, veins = ((area.terrain, VEINS_PER_REGION) if area.kind == 'region'
                      else (area.biome, VEINS_PER_DUNGEON_ROOM * len(area.sequence)))
        for material, amount in expected_yield(key, veins).items():
            budget[material] = budget.get(material, 0.0) + amount
    return budget


def build_out(player, encounter, weapon):
    """Spend a plausible ore budget, and say what it bought.

    The policy is deliberately dull and stated rather than tuned, because a probe
    that plays optimally measures the ceiling and the interesting number is the
    middle: **spread evenly across all five attributes, stop at the tier-3 gate,
    then put whatever is left into the weapon.** A real player would specialise
    and do better; this is meant to be beatable.

    The free level-up points go in first, since they cost nothing and a player who
    ignored them would be ignoring a button the game puts in front of them.
    """
    budget = ore_budget(REACHED_BY[encounter])
    attributes = player.attributes
    # Level-up points: one per level past the first, spread round-robin.
    order = list(ATTRIBUTES)
    attributes.grant((player.level - 1) * 1)
    index = 0
    while attributes.unspent > 0:
        attributes.spend(order[index % len(order)])
        index += 1
    # Then ore, one point at a time across the five, until the gate or the ground
    # runs out. Round-robin rather than depth-first so no branch is starved.
    gate, progressing = TIER_GATE[3], True
    while progressing:
        progressing = False
        for attribute in ATTRIBUTES.values():
            if attributes.get(attribute.id) >= gate:
                continue
            bill = training_cost(attribute.ore, attributes.get(attribute.id))
            if any(budget.get(ore, 0.0) < qty for ore, qty in bill.items()):
                continue
            for ore, qty in bill.items():
                budget[ore] -= qty
            # What the trainer does: the ore buys a point, and the point is placed.
            attributes.grant(1)
            attributes.spend(attribute.id)
            progressing = True
    # And the leftovers into the weapon it is actually holding, cheapest first, so
    # the fitting is something the walk paid for rather than a gift.
    inventory = player.inventory
    for material in sorted(budget, key=lambda m: -budget[m]):
        if MATERIALS[material].fuel or budget[material] < 1:
            continue
        if len(inventory.fittings(weapon)) >= inventory.forge_slots(weapon):
            break
        inventory.add_material(material, 1)
        inventory.fit_material(weapon, material)
        budget[material] -= 1
    return {'attributes': {a: attributes.get(a) for a in ATTRIBUTES},
            'fitted': list(inventory.fittings(weapon))}


def probe(seed, weapon, twin, max_ticks=5400, encounter="opening", kit="bare"):
    spec = ENCOUNTERS[encounter]
    s = GameSession('balance-probe', seed=seed, record=False, start_area=spec['area'])
    s.state.player.inventory.add_weapon(weapon)
    s.state.player.level = spec['level']
    s.state.player.recompute_max_health()
    built = None
    if kit == 'built':
        # Spend the ore the walk to here would have yielded, then recompute --
        # Vigour is max health, so the order matters.
        built = build_out(s.state.player, encounter, weapon)
        s.state.player.recompute_max_health()
        s.state.player.health = s.state.player.max_health
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
    result = {'encounter':encounter,'seed':seed,'weapon':weapon,'twin':twin,'kit':kit,
              'built':built,'seconds':round((elapsed+1)*DT,2),
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
    parser.add_argument('--kit', choices=('bare','built','both'), default='both',
                        help="bare reproduces the v1.1 floor exactly; built spends the ore the "
                             "walk to each encounter would have yielded. Default runs both, "
                             "because the number worth reading is the difference.")
    args=parser.parse_args()
    kits = ('bare',) if args.kit == 'bare' else ('built',) if args.kit == 'built' else ('bare','built')
    with TemporaryDirectory(prefix='mirrorbound-playtest-') as directory:
        save.SAVE_DIR=Path(directory)
        rows=[probe(seed,weapon,twin,kit=kit) for kit in kits
              for seed in (1,5,19) for weapon in WEAPONS for twin in (False,True)]
        # Replay the inputs generated by this policy: outcomes must match.
        assert rows[0] == probe(1,WEAPONS[0],False,kit=kits[0])
        rows += [probe(seed,weapon,encounter != 'mirror',encounter=encounter,kit=kit)
                 for kit in kits
                 for encounter in ('depths','barrow','glasswork','warden','mirror')
                 for seed in (1,5,19) for weapon in WEAPONS]
    # Per encounter, because the headline number hides the thing worth knowing:
    # a suite that clears 80% overall can still have one fight nobody survives
    # and another nobody can lose.
    summary = {}
    for row in rows:
        key = row['encounter'] if row['kit'] == 'bare' else f"{row['encounter']} (built)"
        bucket = summary.setdefault(key, {'cases':0,'cleared':0,'died':0,
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
                       'levels 1/3/5/6/7/8 by encounter; '
                       '"built" rows additionally spend level-up points and the ore the '
                       'campaign spine would have yielded, evenly across the five attributes '
                       'up to the tier-3 gate, leftovers fitted into the carried weapon',
            'kits':list(kits),
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
