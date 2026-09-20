"""Consolidated proof that the twin's behavior actually adapts to different
player archetypes -- the master directive's own AI-review scenarios
(section 31): aggressive player, ranged player, spell-heavy player,
dodge-heavy player, combo-heavy player, and a player who switches strategy
mid-run.

Five of the six scenarios feed real telemetry events into a real
TwinStyleModel (the imitation channel), proving the full
player-behavior -> learned style -> decide() chain end to end, not hand-set
style values (see test_twin_controller.py's unit tests for those, isolating
individual formula terms).

Combo-heavy is different: TwinV0Controller reads combo_dependency from the
*player's own* modeled traits (obs.player_model, fed by PlayerTraitModel via
PlayerModelPipeline), not from TwinStyleModel -- a separate channel from the
other five scenarios here, so it's driven through the real pipeline rather
than TwinStyleModel's imitation. (Previously this scenario had no real hook
to prove at all -- TwinV0Controller only had two narrow prediction checks;
combo_dependency and the INTERCEPT/FLANK bias were added specifically to
close that gap.)
"""

from __future__ import annotations

from mirrorbound.agent.observation import AgentObservation, EntitySnapshot
from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.agent.twin.controller import TwinV0Controller
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.game.core.events import Event
from mirrorbound.game.entities.entity import Vec2


def _entity(entity_id: str, x: float = 0.0, y: float = 0.0, role: str = "melee", **kw) -> EntitySnapshot:
    return EntitySnapshot(
        id=entity_id, position=Vec2(x, y), health=90, max_health=90, velocity=Vec2(), role=role, **kw
    )


def _observation(
    owned_weapons: tuple[str, ...] = ("frost_staff",),
    weapon_id: str = "frost_staff",
    enemies: list[EntitySnapshot] | None = None,
    player_target_id: str | None = "__default__",
    player_model: dict | None = None,
) -> AgentObservation:
    enemies = enemies if enemies is not None else [_entity("enemy_1", 500, 400)]
    if player_target_id == "__default__":
        player_target_id = enemies[0].id if enemies else None
    return AgentObservation(
        tick=1000,
        player_state=_entity("player_1", 400, 400, role="player"),
        twin_state=_entity("twin_1", 380, 420, role="twin"),
        enemies=enemies,
        player_target_id=player_target_id,
        twin_weapon_id=weapon_id,
        twin_owned_weapons=list(owned_weapons),
        player_model=player_model or {},
    )


def _melee_attack(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "healthFraction": 0.9})


def _ranged_attack(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["RANGED"], "healthFraction": 0.9})


def _spell_cast(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ABILITY_CAST", data={"tags": ["SPELL"]})


def _dodge(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_DODGED", data={})


def _chained_attack(tick: int, combo_step: int) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "comboStep": combo_step})


def _feed(style: TwinStyleModel, events: list[Event]) -> None:
    for event in events:
        style.observe(event)


def test_aggressive_player_produces_a_more_aggressive_twin():
    aggressive = TwinStyleModel()
    _feed(aggressive, [_melee_attack(t) for t in range(40)])
    obs = _observation()

    aggressive_intent = TwinV0Controller(aggressive).decide(obs)
    neutral_intent = TwinV0Controller(TwinStyleModel()).decide(obs)

    assert aggressive_intent.utilities["ATTACK"] > neutral_intent.utilities["ATTACK"]
    assert aggressive_intent.utilities["FOLLOW"] < neutral_intent.utilities["FOLLOW"]


def test_ranged_player_shifts_the_twin_toward_flank_and_off_a_melee_weapon():
    """The bow, not a staff.

    A staff bashes on M1 -- its element is on its ability keys, and the twin
    has no autonomous spell policy -- so the bow is the only weapon that gives
    it a ranged *basic attack*, which is what a range-leaning style is asking
    for.
    """
    ranged_style = TwinStyleModel()
    _feed(ranged_style, [_ranged_attack(t) for t in range(40)])
    obs = _observation(owned_weapons=("iron_sword", "hunter_bow"), weapon_id="iron_sword")

    ranged_intent = TwinV0Controller(ranged_style).decide(obs)
    neutral_intent = TwinV0Controller(TwinStyleModel()).decide(obs)

    assert ranged_intent.utilities["FLANK"] > neutral_intent.utilities["FLANK"]
    assert ranged_intent.desired_weapon == "hunter_bow"


def test_spell_heavy_player_shifts_the_twin_toward_flank_and_a_spell_weapon():
    """A staff is still the spell weapon, even though its M1 is a bash.

    What makes it one is the three spells it grants, which is why the
    controller scores this off the weapon's type rather than off the tags its
    basic attack happens to carry.
    """
    spell_style = TwinStyleModel()
    _feed(spell_style, [_spell_cast(t) for t in range(40)])
    obs = _observation(owned_weapons=("hunter_bow", "frost_staff"), weapon_id="hunter_bow")

    spell_intent = TwinV0Controller(spell_style).decide(obs)
    neutral_intent = TwinV0Controller(TwinStyleModel()).decide(obs)

    assert spell_intent.utilities["FLANK"] > neutral_intent.utilities["FLANK"]
    assert spell_intent.desired_weapon == "frost_staff"


def test_dodge_heavy_player_produces_a_more_defensive_twin():
    dodgy = TwinStyleModel()
    _feed(dodgy, [_dodge(t) for t in range(40)])
    swarm = [_entity(f"enemy_{i}", 430 + i * 20, 400, target_id="player_1") for i in range(2)]
    obs = _observation(enemies=swarm, player_target_id=None)

    dodgy_intent = TwinV0Controller(dodgy).decide(obs)
    neutral_intent = TwinV0Controller(TwinStyleModel()).decide(obs)

    assert dodgy_intent.utilities["PROTECT"] > neutral_intent.utilities["PROTECT"]


def test_twin_disposition_swings_when_player_strategy_changes_midrun():
    style = TwinStyleModel()
    controller = TwinV0Controller(style)
    obs = _observation(owned_weapons=("iron_sword", "hunter_bow"), weapon_id="iron_sword")

    _feed(style, [_melee_attack(t) for t in range(40)])
    early_intent = controller.decide(obs)
    assert early_intent.desired_weapon is None  # melee-leaning twin is content with its sword

    _feed(style, [_ranged_attack(t) for t in range(40, 100)])
    late_intent = controller.decide(obs)
    assert late_intent.desired_weapon == "hunter_bow"  # now prefers ranged
    assert late_intent.utilities["FLANK"] > early_intent.utilities["FLANK"]


def test_combo_heavy_player_pushes_the_twin_toward_breaking_the_chain():
    pipeline = PlayerModelPipeline()
    for i in range(30):
        base = i * 3
        pipeline.ingest(_chained_attack(base, 1))       # opening hit
        pipeline.ingest(_chained_attack(base + 1, 2))    # chained
        pipeline.ingest(_chained_attack(base + 2, 3))    # chained
    combo_model = pipeline.snapshot().to_json_dict()

    threat = _entity("enemy_1", 440, 400, target_id="player_1", winding_up=True, windup=0.3)
    combo_obs = _observation(enemies=[threat], player_target_id="enemy_1", player_model=combo_model)
    neutral_obs = _observation(enemies=[threat], player_target_id="enemy_1")

    combo_intent = TwinV0Controller().decide(combo_obs)
    neutral_intent = TwinV0Controller().decide(neutral_obs)

    assert combo_intent.utilities["INTERCEPT"] > neutral_intent.utilities["INTERCEPT"]
    assert combo_intent.utilities["FLANK"] > neutral_intent.utilities["FLANK"]
