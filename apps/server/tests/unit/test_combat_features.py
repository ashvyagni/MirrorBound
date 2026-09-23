from mirrorbound.agent.features.combat_features import aggression_signal, combo_signal, dependency_signals
from mirrorbound.game.core.events import Event


def test_dependency_signals_split_across_traits_when_a_combat_tag_is_present():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]})
    signals = dependency_signals(event)
    assert signals == {
        "melee_dependency": 1.0,
        "ranged_dependency": 0.0,
        "spell_dependency": 0.0,
    }


def test_dependency_signals_empty_when_tags_absent():
    event = Event(tick=1, type="PLAYER_ATTACKED")
    assert dependency_signals(event) == {}


def test_dependency_signals_empty_when_tags_present_but_none_are_a_combat_category():
    # A pure-movement tag like MOBILITY doesn't assert or deny melee/ranged/spell
    # usage at all -- this must not read as "definitely not melee, not ranged,
    # not spell", or every non-combat action would silently drag the dependency
    # traits toward 0.
    event = Event(tick=1, type="PLAYER_DASHED", data={"tags": ["MOBILITY"]})
    assert dependency_signals(event) == {}


def test_dependency_signals_empty_when_tags_present_but_empty():
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": []})
    assert dependency_signals(event) == {}


def test_attack_type_is_aggressive():
    event = Event(tick=1, type="PLAYER_ATTACKED")
    assert aggression_signal(event) == 1.0


def test_attack_type_with_action_token_override_is_still_recognized():
    # The action_token can be anything (e.g. "AERIAL_ATTACK", "MELEE_STRIKE") for
    # sequence prediction purposes; classification here must still work off type.
    event = Event(
        tick=1, type="PLAYER_ATTACKED", data={"action_token": "AERIAL_ATTACK", "tags": ["MELEE"]}
    )
    assert aggression_signal(event) == 1.0


def test_block_and_retreat_types_are_defensive():
    assert aggression_signal(Event(tick=1, type="PLAYER_BLOCKED")) == 0.0
    assert aggression_signal(Event(tick=1, type="PLAYER_RETREATED")) == 0.0


def test_ability_cast_aggression_depends_on_defensive_tag():
    offensive = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"tags": ["RANGED", "BURST"]})
    defensive = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"tags": ["RANGED", "DEFENSIVE"]})
    assert aggression_signal(offensive) == 1.0
    assert aggression_signal(defensive) == 0.0


def test_ambiguous_actions_yield_no_aggression_observation():
    dash = Event(tick=1, type="PLAYER_DASHED")
    ability_without_tags = Event(tick=1, type="PLAYER_ABILITY_CAST", data={"ability": "BUFF"})
    unrecognized = Event(tick=1, type="ENEMY_KILLED")
    assert aggression_signal(dash) is None
    assert aggression_signal(ability_without_tags) is None
    assert aggression_signal(unrecognized) is None


def test_combo_signal_reads_the_games_own_combo_step_directly():
    # comboStep=1 is the opening hit of a (possible) chain -- not itself
    # evidence of chaining behavior.
    opener = Event(tick=1, type="PLAYER_ATTACKED", data={"comboStep": 1})
    assert combo_signal(opener) == 0.0


def test_combo_signal_is_positive_for_a_chained_hit():
    chained = Event(tick=1, type="PLAYER_ATTACKED", data={"comboStep": 2})
    finisher = Event(tick=1, type="PLAYER_ATTACKED", data={"comboStep": 3})
    assert combo_signal(chained) == 1.0
    assert combo_signal(finisher) == 1.0


def test_combo_signal_is_none_when_comboStep_is_absent():
    # Real PLAYER_ATTACKED events from combat.py always include comboStep
    # (every weapon has a combo_chain, defaulting to a single-element one
    # that can never exceed step 1) -- but this function must not assume
    # that shape holds for every possible caller. Missing data means no
    # observation, not a guessed 0.0.
    event = Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["RANGED"]})
    assert combo_signal(event) is None
