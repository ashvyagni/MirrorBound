"""The Proving, the admin stick, GIVE, and arming the Mirror.

These are testing tools, and the thing worth testing about a testing tool is
that it cannot leak into the game it exists to test: the stick must not appear
in a shop, the sandbox must not overwrite a save, and nothing that happens in
there may count.
"""

from __future__ import annotations

import pytest

from mirrorbound.api.session import GameSession
from mirrorbound.contracts.messages import CommandMessage
from mirrorbound.game.combat.weapons import ADMIN_STICK, canonical_weapon_ids
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world import save as save_system
from tests.conftest import events_of


@pytest.fixture(autouse=True)
def isolated_saves(tmp_path, monkeypatch):
    monkeypatch.setattr(save_system, "SAVE_DIR", tmp_path / "saves")


def village(name: str = "sandbox") -> GameSession:
    return GameSession(name, seed=5, record=False)


def apply(s: GameSession, action: str, **fields) -> None:
    s.pending_commands.append(CommandMessage(action=action, **fields))
    s._apply_commands()


def go_to_proving(s: GameSession) -> None:
    apply(s, "TRAVEL", areaId="the_proving")


# --- the area ----------------------------------------------------------------

def test_the_proving_is_reachable_from_the_start_and_is_empty():
    s = village()
    assert "the_proving" in s.campaign.discovered_areas, "never gated, always on the map"
    go_to_proving(s)
    assert s.campaign.current_area == "the_proving"
    room = s.state.room
    assert room.room_type == "sandbox"
    assert not room.enemy_spawns and not s.state.enemies
    assert not room.decor, "nothing to hide behind or trip over"
    assert room.cleared, "nothing to clear"
    assert room.portals, "and a way home"


def test_the_sandbox_is_not_a_checkpoint():
    """Walking in must not overwrite the save the player was playing."""
    s = village("nosave")
    s.state.player.level = 9
    s._checkpoint()
    go_to_proving(s)
    saved = save_system.read_save("nosave")
    assert saved["campaign"]["currentArea"] == "hollow_reach"
    assert saved["player"]["level"] == 9


def test_you_can_walk_back_out_of_the_sandbox():
    s = village("out")
    go_to_proving(s)
    apply(s, "TRAVEL", areaId="hollow_reach")
    assert s.campaign.current_area == "hollow_reach"


# --- the admin stick ---------------------------------------------------------

def test_the_admin_stick_deletes_what_it_touches():
    s = village("stick")
    go_to_proving(s)
    p = s.state.player
    p.inventory.add_weapon(ADMIN_STICK.id)
    p.inventory.equip(ADMIN_STICK.id)
    p.face(Vec2(1, 0))
    enemy = s.state.spawn_enemy("warden", p.position + Vec2(80, 0))
    assert s.combat.process_player_attack(s.state)
    assert not enemy.active, "one swing, whatever it was"


def test_the_admin_stick_is_not_loot_and_is_not_stocked():
    assert ADMIN_STICK.id not in canonical_weapon_ids()
    s = village("shop")
    for npc in s.state.room.npcs:
        assert all(e.item_id != ADMIN_STICK.id for e in npc.definition.stock)


# --- give --------------------------------------------------------------------

def test_give_drops_the_weapon_on_the_ground_rather_than_into_the_bag():
    s = village("give")
    go_to_proving(s)
    p = s.state.player
    p.face(Vec2(1, 0))
    apply(s, "GIVE", weaponId="frost_staff")

    dropped = [pk for pk in s.state.pickups if pk.kind == "weapon"]
    assert len(dropped) == 1
    assert dropped[0].item_id == "frost_staff"
    assert dropped[0].ttl == 0, "it waits to be collected"
    assert "frost_staff" not in p.inventory.weapons, "picking it up is the point"
    assert dropped[0].position.x > p.position.x, "in front of the player"
    assert events_of(s, "ITEM_DROPPED")

    # And the ordinary pickup path still works on it.
    p.position = dropped[0].position.copy()
    s.combat.loot.collect(s.state)
    assert "frost_staff" in p.inventory.weapons


def test_give_refuses_a_weapon_that_does_not_exist():
    s = village("give-bad")
    go_to_proving(s)
    apply(s, "GIVE", weaponId="excalibur")
    assert not [pk for pk in s.state.pickups if pk.kind == "weapon"]
    assert any(e.data.get("action") == "GIVE" for e in events_of(s, "ACTION_REJECTED"))


# --- arming the Mirror -------------------------------------------------------

def test_configuring_the_boss_arms_it_and_sets_what_it_knows():
    s = village("boss")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="mirror")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    melee_range = boss.enemy_def.attack_range

    apply(s, "CONFIGURE_BOSS", bossWeapon="hunter_bow", bossSkill=1.0)
    assert boss.enemy_def.attack_range == 380, "the bow's reach, not the Mirror's"
    assert boss.enemy_def.projectile is not None
    assert boss.enemy_def.attack_range != melee_range
    assert s.mirror_controller.skill_floor == 1.0
    assert events_of(s, "BOSS_CONFIGURED")


def test_a_boss_summoned_after_configuring_arrives_armed():
    s = village("rearm")
    go_to_proving(s)
    apply(s, "CONFIGURE_BOSS", bossWeapon="hunter_bow", bossSkill=0.5)
    apply(s, "SPAWN", enemyType="mirror")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.enemy_def.projectile is not None
    assert boss.enemy_def.projectile.kind == "arrow", "the bow's, specifically"


def test_arming_the_boss_with_a_staff_gives_it_the_staff_s_bash():
    """A staff's M1 is a bash, so a Mirror holding one closes and swings.

    Its spells are on ability keys, and the Mirror has its own ability policy
    rather than a weapon's -- so what a staff hands it is the reach and cadence
    of the bash, which is exactly what `armed_with` copies.
    """
    s = village("staffboss")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="mirror")
    apply(s, "CONFIGURE_BOSS", bossWeapon="ember_staff")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.enemy_def.projectile is None, "it does not shoot"
    assert boss.enemy_def.attack_range == 74, "it swings at the staff's reach"


def test_arming_one_boss_does_not_arm_the_archetype():
    """`replace` on a frozen def, never a mutation of the shared one."""
    from mirrorbound.game.entities.enemy import ARCHETYPES

    before = ARCHETYPES["mirror"].attack_range
    s = village("shared")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="mirror")
    apply(s, "CONFIGURE_BOSS", bossWeapon="hunter_bow")
    assert ARCHETYPES["mirror"].attack_range == before


def test_the_skill_floor_never_lowers_what_the_model_actually_learned():
    s = village("floor")
    s.mirror_controller.skill_floor = 0.3
    s.mirror_controller.player_model = {
        "traits": {"aggression": {"value": 0.8, "confidence": 0.9}},
    }
    _, confidence = s.mirror_controller._trait("aggression")
    assert confidence == 0.9

    s.mirror_controller.player_model = {
        "traits": {"aggression": {"value": 0.8, "confidence": 0.1}},
    }
    _, confidence = s.mirror_controller._trait("aggression")
    assert confidence == 0.3, "but it does raise a model that knows nothing yet"


def test_spawning_is_still_refused_in_a_village():
    s = village("safe")
    apply(s, "SPAWN", enemyType="mirror")
    assert not s.state.enemies
    assert any(e.data.get("reason") == "not in a village" for e in events_of(s, "ACTION_REJECTED"))


def test_an_armed_boss_tells_the_client_what_it_is_holding():
    """The snapshot names the weapon, so the client can draw it.

    Every number the weapon dictates is already folded into the def by
    `armed_with`, so this field changes no behaviour at all. It exists because
    the Mirror fighting you with your own sword is the premise of the game, and
    a Mirror swinging an invisible one only half tells you so -- the client
    keeps twenty-six blackened weapon sheets it cannot choose between without
    this.
    """
    s = village("armed_snapshot")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="mirror")
    apply(s, "CONFIGURE_BOSS", bossWeapon="ember_staff")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.to_dict()["weapon"] == "ember_staff"


def test_an_unarmed_enemy_reports_no_weapon():
    """Null rather than absent, so the client can tell "none" from "not sent"."""
    s = village("unarmed_snapshot")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="skeleton")
    mob = next(e for e in s.state.enemies if not e.enemy_def.boss)
    assert mob.to_dict()["weapon"] is None


def test_re_arming_a_boss_replaces_the_weapon_it_reports():
    """The sandbox loop is "change one thing and watch again"."""
    s = village("rearm_snapshot")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="mirror")
    apply(s, "CONFIGURE_BOSS", bossWeapon="hunter_bow")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.to_dict()["weapon"] == "hunter_bow"
    apply(s, "CONFIGURE_BOSS", bossWeapon="iron_sword")
    assert boss.to_dict()["weapon"] == "iron_sword"


def test_a_boss_takes_the_player_s_weapon_when_nothing_is_configured():
    """The premise, finally reached.

    `armed_with` existed, was tested, and was never called outside the sandbox:
    `boss_loadout` is only set by CONFIGURE_BOSS, so every real playthrough met
    a Mirror fighting with its own archetype rather than with the player's
    weapon. A boss that spawns now takes whatever the player is holding.
    """
    s = village("inherits")
    go_to_proving(s)
    s.state.player.inventory.add_weapon("hunter_bow")
    s.state.player.inventory.equip("hunter_bow")
    apply(s, "SPAWN", enemyType="mirror")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.to_dict()["weapon"] == "hunter_bow"
    assert boss.enemy_def.projectile is not None, "and it fights with the bow's reach"


def test_an_explicit_loadout_still_beats_the_player_s_weapon():
    """The sandbox is for asking "what if it had *this* instead"."""
    s = village("explicit_wins")
    go_to_proving(s)
    s.state.player.inventory.add_weapon("hunter_bow")
    s.state.player.inventory.equip("hunter_bow")
    apply(s, "CONFIGURE_BOSS", bossWeapon="iron_sword")
    apply(s, "SPAWN", enemyType="mirror")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.to_dict()["weapon"] == "iron_sword"


def test_bare_hands_arm_nothing():
    """There is no def to copy and nothing to draw."""
    s = village("barehands")
    go_to_proving(s)
    s.state.player.inventory.equip("")   # empty hands
    apply(s, "SPAWN", enemyType="mirror")
    boss = next(e for e in s.state.enemies if e.enemy_def.boss)
    assert boss.to_dict()["weapon"] is None


def test_the_dummy_takes_damage_and_never_gives_any_back():
    """The Proving's measuring stick.

    Its value is that it goes through the ordinary damage path -- so what comes
    off it is what would come off a real enemy -- while doing none of the things
    that would make it a fight.
    """
    from mirrorbound.game.entities.enemy import ARCHETYPES

    dummy = ARCHETYPES["dummy"]
    assert dummy.damage == 0
    assert dummy.speed == 0
    assert dummy.aggro_range == 0
    assert dummy.projectile is None
    assert dummy.xp_reward == 0, "and it is not a way to farm"

    s = village("dummy")
    go_to_proving(s)
    apply(s, "SPAWN", enemyType="dummy")
    mob = next(e for e in s.state.enemies if e.enemy_def.id == "dummy")
    before = mob.health
    mob.take_damage(40)
    assert mob.health == before - 40, "it reads damage like anything else"
    assert mob.health > 0, "and survives a measuring session"
