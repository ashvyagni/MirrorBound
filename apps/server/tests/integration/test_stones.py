"""Relic stones: three tiers, a floor under the luck, and one socket to hold them.

The brief asked for 1-in-1,000 and 1-in-10,000 drops. Both numbers are in
`RARITY` untouched, and the interesting tests here are the two things that make
them playable rather than theoretical:

* the **pity floor**, which is the only part of a drop rate a test can actually
  prove. "It feels rare" is not assertable; "never worse than one in four
  hundred" is, and it is asserted below by draining the counter with a rigged
  roll that never succeeds.
* the **boss award**, which is why tier 3 exists at all. At one in ten thousand
  against a campaign of roughly two hundred kills, the arithmetic says fifty
  playthroughs.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.game.combat.weapons import MAX_UPGRADE, get_weapon
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player
from mirrorbound.game.progression.stones import (
    BOSS_STONES, PITY, RARITY, SOCKETS_AT_TIER, STONES, STONES_BY_TIER, StoneLuck,
    socket_bonuses,
)
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.npc import TALK_RADIUS

DT = 1.0 / 60.0


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def never(_chance: float) -> bool:
    """A roll that always loses, so only the floor can pay out."""
    return False


def always(_chance: float) -> bool:
    return True


# --- the table -----------------------------------------------------------------

def test_the_rates_are_the_ones_that_were_asked_for():
    assert RARITY[2] == 1 / 1000
    assert RARITY[3] == 1 / 10000
    assert set(STONES_BY_TIER) == set(RARITY), "a tier with no stones in it"
    for tier, ids in STONES_BY_TIER.items():
        assert ids, f"tier {tier} is rollable and empty"


def test_every_stone_does_something_and_nothing_does_only_damage():
    """The same rule the tree and the forge follow: a stone should change what
    carrying the weapon lets you do, not just scale it."""
    for stone in STONES.values():
        bonuses = socket_bonuses(stone.id)
        assert any(getattr(bonuses, f) for f in bonuses.__dataclass_fields__), stone.id
        assert stone.socket_note, f"{stone.id} has nothing the smith can say about it"


# --- the floor -----------------------------------------------------------------

def test_a_long_enough_drought_is_always_paid_out():
    luck = StoneLuck()
    for tier, limit in PITY.items():
        drops = sum(1 for _ in range(limit) if luck.roll(tier, never))
        assert drops == 1, f"tier {tier} never paid out in {limit} unlucky kills"


def test_the_floor_resets_after_it_pays():
    luck = StoneLuck()
    limit = PITY[2]
    for _ in range(limit):
        luck.roll(2, never)
    assert luck.drought[2] == 0
    # And it does not pay again immediately.
    assert not any(luck.roll(2, never) for _ in range(limit - 1))


def test_a_lucky_roll_also_resets_the_counter():
    """Otherwise a player who got lucky early would still be handed a pity stone
    on schedule, and the floor would be a second drop rate rather than a floor."""
    luck = StoneLuck()
    for _ in range(50):
        luck.roll(1, never)
    assert luck.drought[1] == 50
    assert luck.roll(1, always)
    assert luck.drought[1] == 0


def test_the_drought_survives_a_save():
    luck = StoneLuck()
    for _ in range(123):
        luck.roll(2, never)
    restored = StoneLuck.from_save(luck.to_save())
    assert restored.drought[2] == 123
    # Which means the remaining wait is the remaining wait, not a fresh one.
    assert sum(1 for _ in range(PITY[2] - 123) if restored.roll(2, never)) == 1


def test_a_reconnect_cannot_be_farmed_for_a_stone():
    """The counter is *progress toward* a stone, so reloading cannot shorten it
    and cannot restart it either. The failure this guards is the tempting one:
    storing "kills remaining" and refreshing it on load."""
    luck = StoneLuck()
    for _ in range(PITY[3] - 1):
        luck.roll(3, never)
    reloaded = StoneLuck.from_save(luck.to_save())
    assert reloaded.roll(3, never), "one kill short, and reloading pushed it back"


def test_a_garbled_save_does_not_grant_a_free_stone():
    luck = StoneLuck.from_save({"2": "lots", "9": 5, "not-a-tier": 3})
    assert set(luck.drought) == set(RARITY)
    assert all(count == 0 for count in luck.drought.values())


# --- found in the world --------------------------------------------------------

def test_a_regional_boss_leaves_one_stone_and_only_once():
    s = GameSession("boss-stone", seed=5, record=False)
    state = s.state
    from mirrorbound.game.entities.enemy import Enemy, THE_STONECOUNT

    def kill() -> list[str]:
        boss = Enemy(id="b", position=Vec2(500, 500), enemy_def=THE_STONECOUNT)
        drops = s.combat.loot.drop_for(state, boss)
        return [d.item_id for d in drops if d.kind == "stone"]

    first = kill()
    assert BOSS_STONES["stonecount"] in first
    assert "stonecount" in state.campaign.stones_awarded
    assert BOSS_STONES["stonecount"] not in kill(), "the guaranteed stone dropped twice"


def test_the_mirror_leaves_no_stone():
    """The ending gives you the ending. A drop on the last kill in the game is a
    reward for a run that is over."""
    assert "mirror" not in BOSS_STONES


def test_a_found_stone_never_expires_on_the_ground():
    s = GameSession("stone-ttl", seed=5, record=False)
    from mirrorbound.game.entities.enemy import Enemy, SHARDMOTHER

    boss = Enemy(id="b", position=Vec2(500, 500), enemy_def=SHARDMOTHER)
    drops = s.combat.loot.drop_for(s.state, boss)
    stones = [d for d in drops if d.kind == "stone"]
    assert stones and all(d.ttl == 0.0 for d in stones), \
        "a one-in-ten-thousand drop on a forty-second timer"


def test_a_stone_lands_on_the_player_whoever_picked_it_up():
    s = GameSession("stone-pick", seed=5, record=False)
    state = s.state
    state.twin.dormant = False
    state.twin.active = True
    pickup = state.spawn_pickup("stone", state.twin.position, item_id="cinder_shard")
    pickup.position = state.twin.position.copy()
    s.combat.loot.collect(state)
    assert state.player.inventory.stone_count("cinder_shard") == 1


# --- the socket ----------------------------------------------------------------

def test_only_a_finished_weapon_holds_a_stone():
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    p.inventory.add_stone("cinder_shard")
    for tier in range(SOCKETS_AT_TIER):
        p.inventory.upgrades["iron_sword"] = tier
        ok, reason = p.inventory.socket_stone("iron_sword", "cinder_shard")
        assert not ok and reason == "the weapon is not finished"
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    assert p.inventory.socket_stone("iron_sword", "cinder_shard")[0]


def test_a_stone_comes_back_out_intact_and_ore_does_not():
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("riftstone")
    p.inventory.add_material("iron")
    p.inventory.socket_stone("iron_sword", "riftstone")
    p.inventory.fit_material("iron_sword", "iron")
    assert p.inventory.stone_count("riftstone") == 0

    assert p.inventory.unsocket_stone("iron_sword") == "riftstone"
    assert p.inventory.stone_count("riftstone") == 1, "the stone was destroyed"
    p.inventory.clear_fittings("iron_sword")
    assert p.inventory.material_count("iron") == 0, "the ore came back"


def test_one_socket_per_weapon():
    p = Player(id="p")
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("cinder_shard")
    p.inventory.add_stone("riftstone")
    assert p.inventory.socket_stone("iron_sword", "cinder_shard")[0]
    ok, reason = p.inventory.socket_stone("iron_sword", "riftstone")
    assert not ok and reason == "the socket is full"


# --- what it is worth ----------------------------------------------------------

def socketed(weapon: str, stone: str) -> Player:
    p = Player(id="p")
    p.inventory.add_weapon(weapon)
    p.inventory.equip(weapon)
    p.inventory.upgrades[weapon] = MAX_UPGRADE
    p.inventory.add_stone(stone)
    assert p.inventory.socket_stone(weapon, stone)[0]
    return p


def test_a_stone_only_counts_while_its_weapon_is_in_hand():
    """Which is what gives stones the same affinity question ore has, without
    anything having to enforce it: a Cinder Shard is transformative in a staff
    and inert in a sword, because of what the number touches."""
    p = socketed("ember_staff", "cinder_shard")
    p.inventory.add_weapon("iron_sword")
    with_staff = p.spell_damage_multiplier()
    p.inventory.equip("iron_sword")
    assert p.spell_damage_multiplier() < with_staff
    p.inventory.equip("ember_staff")
    assert p.spell_damage_multiplier() == with_staff


def test_the_mirrors_tear_deepens_the_well_it_casts_from():
    plain = Player(id="plain")
    plain.inventory.add_weapon("ember_staff")
    plain.inventory.equip("ember_staff")
    rich = socketed("ember_staff", "mirrors_tear")
    assert rich.max_mana > plain.max_mana
    assert rich.spell_damage_multiplier() > plain.spell_damage_multiplier()


def test_a_riftstone_shortens_only_its_own_weapons_cooldowns():
    from mirrorbound.game.combat.abilities import ABILITIES

    p = socketed("ember_staff", "riftstone")
    p.inventory.add_weapon("hunter_bow")
    p.inventory.equip_offhand("hunter_bow")
    staff_ability = ABILITIES[get_weapon("ember_staff").abilities[0]]
    bow_ability = ABILITIES[get_weapon("hunter_bow").abilities[0]]

    assert p.ability_cooldown_for(staff_ability) < staff_ability.cooldown
    assert p.ability_cooldown_for(bow_ability) == pytest.approx(bow_ability.cooldown)


def test_a_leechstone_returns_mana_on_a_landed_hit():
    s = GameSession("leech", seed=5, record=False, start_area="the_proving")
    state = s.state
    p = state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.equip("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("leechstone")
    p.inventory.socket_stone("iron_sword", "leechstone")
    p.mana = 10.0

    from mirrorbound.game.entities.enemy import Enemy, SKELETON

    enemy = Enemy(id="e", position=Vec2(p.position.x + 40, p.position.y), enemy_def=SKELETON)
    state.enemies.append(enemy)
    s.combat.damage_enemy(state, enemy, 5.0, p.id, ["MELEE"],
                          Vec2(1, 0), 0.0, "iron_sword")
    assert p.mana > 10.0


def test_a_rimestone_slows_what_it_hits():
    s = GameSession("rime", seed=5, record=False, start_area="the_proving")
    state = s.state
    p = state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.equip("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("rimestone")
    p.inventory.socket_stone("iron_sword", "rimestone")

    from mirrorbound.game.entities.enemy import Enemy, SKELETON

    enemy = Enemy(id="e", position=Vec2(p.position.x + 40, p.position.y), enemy_def=SKELETON)
    state.enemies.append(enemy)
    s.combat.damage_enemy(state, enemy, 5.0, p.id, ["MELEE"], Vec2(1, 0), 0.0, "iron_sword")
    assert "slow" in enemy.status_effects and enemy.slow_factor < 1.0


def test_a_stone_in_a_staff_leeches_from_its_spells_too():
    """`damage_enemy` records an ability id for a spell, not a weapon id. A stone
    that only answered to weapon ids would do nothing for the three spells that
    are most of what a staff is."""
    s = GameSession("spell-leech", seed=5, record=False, start_area="the_proving")
    state = s.state
    p = state.player
    p.inventory.add_weapon("ember_staff")
    p.inventory.equip("ember_staff")
    p.inventory.upgrades["ember_staff"] = MAX_UPGRADE
    p.inventory.add_stone("leechstone")
    p.inventory.socket_stone("ember_staff", "leechstone")
    p.mana = 10.0

    from mirrorbound.game.entities.enemy import Enemy, SKELETON

    spell = get_weapon("ember_staff").abilities[0]
    enemy = Enemy(id="e", position=Vec2(p.position.x + 40, p.position.y), enemy_def=SKELETON)
    state.enemies.append(enemy)
    s.combat.damage_enemy(state, enemy, 5.0, p.id, ["SPELL"], Vec2(1, 0), 0.0, spell)
    assert p.mana > 10.0


# --- the bench, and the save ---------------------------------------------------

def test_the_smith_sockets_a_stone_and_a_stranger_does_not():
    s = GameSession("bench-stone", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("cinder_shard")

    elder = next(n for n in s.state.room.npcs if n.definition.role == "elder")
    p.position = Vec2(elder.x, elder.y + 40)
    s.handle_input({"type": "COMMAND", "action": "SOCKET_STONE", "npcId": elder.id,
                    "weaponId": "iron_sword", "stoneId": "cinder_shard"})
    s.step(DT)
    assert not p.inventory.socket_of("iron_sword")

    smith = next(n for n in s.state.room.npcs if n.definition.role == "weaponsmith")
    p.position = Vec2(smith.x, smith.y + TALK_RADIUS * 0.5)
    s.handle_input({"type": "COMMAND", "action": "SOCKET_STONE", "npcId": smith.id,
                    "weaponId": "iron_sword", "stoneId": "cinder_shard"})
    s.step(DT)
    assert p.inventory.socket_of("iron_sword") == "cinder_shard"
    assert [e for e in s.state.pending_events if e.type == "STONE_SOCKETED"]


def test_stones_and_sockets_survive_a_save():
    s = GameSession("stone-save", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    p.inventory.upgrades["iron_sword"] = MAX_UPGRADE
    p.inventory.add_stone("sunderstone")
    p.inventory.add_stone("cinder_shard", 2)
    p.inventory.socket_stone("iron_sword", "sunderstone")
    for _ in range(77):
        s.state.campaign.stone_luck.roll(2, never)

    data = save_system.build_save("stone-save", s.state.campaign, p, s.state.twin)
    fresh = GameSession("stone-save-2", seed=5, record=False)
    save_system.apply_save(data, fresh.state.player, fresh.state.twin)
    loaded = fresh.state.player
    assert loaded.inventory.socket_of("iron_sword") == "sunderstone"
    assert loaded.inventory.stone_count("cinder_shard") == 2

    from mirrorbound.game.world.campaign import CampaignState

    campaign = CampaignState.from_save(data["campaign"])
    assert campaign.stone_luck.drought[2] == 77


def test_a_socket_is_dropped_when_the_weapon_can_no_longer_hold_it():
    """A save whose weapon is no longer finished must not restore a stone into a
    setting that does not exist -- it would be held by nothing and read by
    nothing, and the bench could neither see it nor take it out."""
    s = GameSession("orphan", seed=5, record=False)
    p = s.state.player
    p.inventory.add_weapon("iron_sword")
    data = {"version": save_system.SAVE_VERSION,
            "player": {"weapons": ["iron_sword"], "equippedWeapon": "iron_sword",
                       "upgrades": {"iron_sword": 1},
                       "stones": {"cinder_shard": 1},
                       "socketed": {"iron_sword": "sunderstone",
                                    "warden_pike": "riftstone"}},
            "twin": {}}
    save_system.apply_save(data, p, s.state.twin)
    assert p.inventory.socketed == {}
    assert p.inventory.stone_count("cinder_shard") == 1


def test_the_determinism_of_a_drop_is_unchanged_by_the_counters():
    """Two runs on one seed must roll the same stones. The drought counter is
    state the loot system reads and writes, so it is exactly the kind of thing
    that breaks replay if it is shared or ordered wrongly."""
    def run() -> list[str]:
        s = GameSession("det", seed=99, record=False, start_area="the_proving")
        from mirrorbound.game.entities.enemy import Enemy, SKELETON

        found: list[str] = []
        for i in range(40):
            enemy = Enemy(id=f"e{i}", position=Vec2(400, 400), enemy_def=SKELETON)
            found += [d.item_id for d in s.combat.loot.drop_for(s.state, enemy) if d.kind == "stone"]
        return found + [str(s.state.campaign.stone_luck.drought)]

    assert run() == run()
