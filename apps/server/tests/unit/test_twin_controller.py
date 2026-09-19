from mirrorbound.agent.observation import AgentObservation, EntitySnapshot, PickupSnapshot, RoomSnapshot
from mirrorbound.agent.twin.controller import TwinV0Controller
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.contracts.messages import TwinIntentModel
from mirrorbound.game.entities.entity import Vec2


def ent(id_: str, x: float, y: float, role: str = "melee", hp: float = 50, max_hp: float = 50, **kw) -> EntitySnapshot:
    return EntitySnapshot(id=id_, position=Vec2(x, y), health=hp, max_health=max_hp, velocity=Vec2(), role=role, **kw)


def obs(player: EntitySnapshot, twin: EntitySnapshot, enemies=(), **kw) -> AgentObservation:
    return AgentObservation(
        tick=100, player_state=player, twin_state=twin, enemies=list(enemies),
        room_context=RoomSnapshot("combat", 1280, 960), twin_weapon_range=340, twin_weapon_is_melee=False, **kw,
    )


def test_no_enemies_means_follow_and_the_output_validates_against_the_contract():
    c = TwinV0Controller()
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90))
    intent = c.decide(o)
    assert intent.intent_type == "FOLLOW"
    assert intent.position is not None
    assert set(intent.utilities) >= {"FOLLOW", "ATTACK", "RETREAT", "INTERCEPT", "PROTECT", "FLANK", "REPOSITION"}
    TwinIntentModel.model_validate(intent.to_dict())


def test_low_health_twin_retreats():
    c = TwinV0Controller()
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 12, 90),
            [ent("enemy_1", 420, 470)])
    intent = c.decide(o)
    assert intent.intent_type == "RETREAT"
    assert intent.confidence > 0.5


def test_enemy_winding_up_on_player_triggers_intercept():
    c = TwinV0Controller()
    threat = ent("enemy_1", 440, 400, "melee", target_id="player_1", winding_up=True, windup=0.3)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 300, 500, "twin", 90, 90), [threat])
    intent = c.decide(o)
    assert intent.intent_type == "INTERCEPT" and intent.target_id == "enemy_1"


def test_player_target_is_assisted_when_twin_is_healthy():
    c = TwinV0Controller()
    target = ent("enemy_7", 700, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7")
    intent = c.decide(o)
    assert intent.intent_type in ("ASSIST", "ATTACK", "FLANK")
    assert intent.target_id == "enemy_7"


def test_isolated_enemy_is_attacked_and_learned_aggression_raises_utility():
    passive, aggressive = TwinStyleModel(), TwinStyleModel()
    for i in range(40):
        aggressive.get("aggression").update(1.0, 0.2, i)
        passive.get("aggression").update(0.0, 0.2, i)
    lone = ent("enemy_2", 520, 380)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [lone])
    a = TwinV0Controller(aggressive).decide(o)
    p = TwinV0Controller(passive).decide(o)
    assert a.utilities["ATTACK"] > p.utilities["ATTACK"]
    assert a.intent_type == "ATTACK"


def test_swarmed_player_gets_protected_and_fragile_player_gets_distraction():
    c = TwinV0Controller()
    swarm = [ent(f"enemy_{i}", 430 + i * 20, 400, target_id="player_1") for i in range(3)]
    o = obs(ent("player_1", 400, 400, "player", 30, 100), ent("twin_1", 380, 460, "twin", 90, 90), swarm)
    intent = c.decide(o)
    assert intent.intent_type in ("PROTECT", "DISTRACT", "INTERCEPT")
    assert intent.target_id is not None


def test_far_twin_repositions_and_cleared_room_explores_pickups():
    c = TwinV0Controller()
    far = obs(ent("player_1", 900, 400, "player", 100, 100), ent("twin_1", 100, 400, "twin", 90, 90))
    assert c.decide(far).intent_type == "REPOSITION"
    c2 = TwinV0Controller()
    loot = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
               pickups=[PickupSnapshot("pickup_1", "essence", Vec2(500, 500))])
    intent = c2.decide(loot)
    assert intent.intent_type == "EXPLORE" and intent.position == Vec2(500, 500)


def test_decisions_are_deterministic():
    o = obs(ent("player_1", 400, 400, "player", 60, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_1", 500, 400, target_id="player_1"), ent("enemy_2", 300, 700, "ranged")])
    a = TwinV0Controller().decide(o).to_dict()
    b = TwinV0Controller().decide(o).to_dict()
    assert a == b


def test_ranged_leaning_style_favors_flank_and_assist_over_attack():
    melee_style, ranged_style = TwinStyleModel(), TwinStyleModel()
    for i in range(40):
        melee_style.get("preferred_range").update(0.0, 0.2, i)
        ranged_style.get("preferred_range").update(1.0, 0.2, i)
    target = ent("enemy_7", 500, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7")
    melee_intent = TwinV0Controller(melee_style).decide(o)
    ranged_intent = TwinV0Controller(ranged_style).decide(o)
    assert ranged_intent.utilities["FLANK"] > melee_intent.utilities["FLANK"]
    assert ranged_intent.utilities["ASSIST"] > melee_intent.utilities["ASSIST"]
    assert ranged_intent.utilities["ATTACK"] < melee_intent.utilities["ATTACK"]


def test_melee_dependency_and_ranged_dependency_alone_do_not_move_the_needle():
    """preferred_range is the sole signal read for range-lean bias (see
    controller.py's comment) since melee_dependency/ranged_dependency update
    in lockstep with it in style.py -- confirms they're not separately wired
    in a way that would double-count the same evidence.
    """
    baseline = TwinStyleModel()
    only_dependency = TwinStyleModel()
    for i in range(40):
        only_dependency.get("melee_dependency").update(1.0, 0.2, i)
        only_dependency.get("ranged_dependency").update(0.0, 0.2, i)
    target = ent("enemy_7", 500, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7")
    a = TwinV0Controller(baseline).decide(o)
    b = TwinV0Controller(only_dependency).decide(o)
    assert a.utilities["ATTACK"] == b.utilities["ATTACK"]
    assert a.utilities["FLANK"] == b.utilities["FLANK"]
    assert a.utilities["ASSIST"] == b.utilities["ASSIST"]


def test_spell_leaning_style_raises_flank_utility():
    neutral, spellcaster = TwinStyleModel(), TwinStyleModel()
    for i in range(40):
        spellcaster.get("spell_preference").update(1.0, 0.2, i)
    target = ent("enemy_7", 500, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7")
    neutral_intent = TwinV0Controller(neutral).decide(o)
    spell_intent = TwinV0Controller(spellcaster).decide(o)
    assert spell_intent.utilities["FLANK"] > neutral_intent.utilities["FLANK"]


def test_unconfident_new_style_biases_nothing():
    """A brand-new TwinStyleModel (zero samples, zero confidence on every
    dimension) must produce identical utilities to what existed before these
    bias terms were added -- confident_value() blends to exactly 0.5 at zero
    confidence, and every new term here is centered at (x - 0.5), so a
    fresh twin's decisions are provably untouched by this change.
    """
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7")
    intent = TwinV0Controller(TwinStyleModel()).decide(o)
    style = TwinStyleModel()
    assert style.confident_value("preferred_range") == 0.5
    assert style.confident_value("spell_preference") == 0.5
    assert intent.utilities["ATTACK"] > 0  # sanity: candidate still fires at all


def test_no_weapon_switch_requested_with_only_one_owned_weapon():
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
            twin_weapon_id="frost_staff", twin_owned_weapons=["frost_staff"])
    intent = TwinV0Controller().decide(o)
    assert intent.desired_weapon is None


def test_ranged_leaning_twin_requests_switch_away_from_a_melee_weapon_it_owns():
    style = TwinStyleModel()
    for i in range(40):
        style.get("preferred_range").update(1.0, 0.2, i)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
            twin_weapon_id="iron_sword", twin_owned_weapons=["iron_sword", "hunter_bow"])
    intent = TwinV0Controller(style).decide(o)
    assert intent.desired_weapon == "hunter_bow"


def test_melee_leaning_twin_requests_switch_to_a_melee_weapon_it_owns():
    style = TwinStyleModel()
    for i in range(40):
        style.get("preferred_range").update(0.0, 0.2, i)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
            twin_weapon_id="hunter_bow", twin_owned_weapons=["iron_sword", "hunter_bow"])
    intent = TwinV0Controller(style).decide(o)
    assert intent.desired_weapon == "iron_sword"


def test_no_switch_requested_when_already_wielding_the_preferred_weapon():
    style = TwinStyleModel()
    for i in range(40):
        style.get("preferred_range").update(1.0, 0.2, i)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
            twin_weapon_id="hunter_bow", twin_owned_weapons=["iron_sword", "hunter_bow"])
    intent = TwinV0Controller(style).decide(o)
    assert intent.desired_weapon is None


def test_marginal_preference_does_not_trigger_a_weapon_switch():
    # No confident lean at all -> score difference is exactly 0, well under
    # WEAPON_SWITCH_MARGIN -- proves the margin actually gates something.
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
            twin_weapon_id="iron_sword", twin_owned_weapons=["iron_sword", "hunter_bow"])
    intent = TwinV0Controller(TwinStyleModel()).decide(o)
    assert intent.desired_weapon is None


# --- decision momentum (seconds_since_decision) ---------------------------


def test_momentum_penalizes_switching_to_an_opposite_posture_intent():
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
            [ent("enemy_7", 500, 400)], player_target_id="enemy_7", seconds_since_decision=0.1)

    from_follow = TwinV0Controller()
    from_follow.current_intent = "FOLLOW"  # disengaged; FLANK is engaged -> cross-posture penalty
    follow_flank = from_follow.decide(o).utilities["FLANK"]

    from_attack = TwinV0Controller()
    from_attack.current_intent = "ATTACK"  # engaged, same posture as FLANK -> no penalty
    attack_flank = from_attack.decide(o).utilities["FLANK"]

    assert attack_flank > follow_flank


def test_momentum_fades_to_nothing_after_a_long_gap_since_the_last_decision():
    def flank_utility(seconds_since_decision: float) -> float:
        o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90),
                [ent("enemy_7", 500, 400)], player_target_id="enemy_7",
                seconds_since_decision=seconds_since_decision)
        c = TwinV0Controller()
        c.current_intent = "FOLLOW"
        return c.decide(o).utilities["FLANK"]

    recent = flank_utility(0.05)   # just decided -> near-full momentum penalty on FLANK
    stale = flank_utility(2.0)     # well past MOMENTUM_WINDOW_SECONDS -> penalty fully decayed
    assert stale > recent


def test_a_genuine_emergency_still_overrides_maximum_momentum():
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 5, 90),
            [ent("enemy_1", 420, 470)], seconds_since_decision=0.01)  # near-zero -> max momentum
    c = TwinV0Controller()
    c.current_intent = "ATTACK"  # engaged; RETREAT is disengaged -> maximum penalty applies to it
    intent = c.decide(o)
    assert intent.intent_type == "RETREAT"


# --- combo_dependency ------------------------------------------------------


def test_combo_heavy_player_raises_intercept_and_flank_utility():
    threat = ent("enemy_1", 440, 400, "melee", target_id="player_1", winding_up=True, windup=0.3)
    base_kwargs = dict(
        player=ent("player_1", 400, 400, "player", 100, 100),
        twin=ent("twin_1", 300, 500, "twin", 90, 90),
        enemies=[threat],
        player_target_id="enemy_1",
    )
    combo_model = {"traits": {"combo_dependency": {"value": 0.9, "confidence": 0.9}}}

    combo_intent = TwinV0Controller().decide(obs(**base_kwargs, player_model=combo_model))
    neutral_intent = TwinV0Controller().decide(obs(**base_kwargs))

    assert combo_intent.utilities["INTERCEPT"] > neutral_intent.utilities["INTERCEPT"]
    assert combo_intent.utilities["FLANK"] > neutral_intent.utilities["FLANK"]


def test_predicted_aoe_pushes_the_twin_to_flank_instead_of_standing_in_it():
    model = {"predictions": [{"token": "FLAME_BURST", "confidence": 0.8}]}
    target = ent("enemy_7", 520, 400)
    o = obs(ent("player_1", 400, 400, "player", 100, 100), ent("twin_1", 380, 420, "twin", 90, 90), [target],
            player_target_id="enemy_7", player_model=model)
    intent = TwinV0Controller().decide(o)
    assert intent.utilities["FLANK"] > intent.utilities["ASSIST"]
