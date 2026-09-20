"""The trait updater now feeds all nine traits. Before this, preferred_range,
risk_tolerance and defensive_tendency were never observed and stayed at
value 0.5 with zero confidence for an entire run.
"""

from mirrorbound.agent.player_model.traits import DEFAULT_TRAIT_NAMES, PlayerTraitModel
from mirrorbound.agent.player_model.updater import apply_event
from mirrorbound.game.core.events import Event


def test_a_fresh_model_has_no_evidence_for_any_trait():
    traits = PlayerTraitModel()
    for name in DEFAULT_TRAIT_NAMES:
        assert traits.get(name).samples == 0


def test_an_attack_with_full_context_feeds_range_risk_and_defensive_tendency():
    traits = PlayerTraitModel()
    event = Event(
        tick=1,
        type="PLAYER_ATTACKED",
        data={"tags": ["MELEE"], "nearestEnemyDistance": 60.0, "healthFraction": 0.3},
    )
    apply_event(traits, event)

    assert traits.get("preferred_range").samples == 1
    assert traits.get("risk_tolerance").samples == 1
    assert traits.get("defensive_tendency").samples == 1
    assert traits.get("risk_tolerance").value > 0.5   # hurt and still swinging
    assert traits.get("defensive_tendency").value < 0.5


def test_an_attack_missing_context_leaves_range_and_risk_untouched():
    """The contract's core promise: no field, no observation."""
    traits = PlayerTraitModel()
    apply_event(traits, Event(tick=1, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]}))

    assert traits.get("preferred_range").samples == 0
    assert traits.get("risk_tolerance").samples == 0
    assert traits.get("defensive_tendency").samples == 1   # an attack is offensive on its own


def test_a_kiter_and_a_brawler_separate_on_preferred_range():
    kiter, brawler = PlayerTraitModel(), PlayerTraitModel()
    for t in range(30):
        apply_event(kiter, Event(tick=t, type="PLAYER_ATTACKED", data={"tags": ["RANGED"], "nearestEnemyDistance": 280.0}))
        apply_event(brawler, Event(tick=t, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "nearestEnemyDistance": 50.0}))

    assert kiter.get("preferred_range").value > 0.8
    assert brawler.get("preferred_range").value < 0.2
    assert kiter.get("preferred_range").confidence > 0.7


def test_a_reckless_player_and_a_careful_one_separate_on_risk_tolerance():
    reckless, careful = PlayerTraitModel(), PlayerTraitModel()
    for t in range(30):
        apply_event(reckless, Event(tick=t, type="PLAYER_ATTACKED", data={"healthFraction": 0.15}))
        apply_event(careful, Event(tick=t, type="PLAYER_ATTACKED", data={"healthFraction": 0.95}))

    assert reckless.get("risk_tolerance").value > 0.7
    assert careful.get("risk_tolerance").value < 0.35


def test_a_dodger_reads_more_defensive_than_someone_who_only_attacks():
    dodger, attacker = PlayerTraitModel(), PlayerTraitModel()
    for t in range(20):
        apply_event(attacker, Event(tick=t, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]}))
        apply_event(dodger, Event(tick=t, type="PLAYER_ATTACKED", data={"tags": ["MELEE"]}))
        apply_event(dodger, Event(tick=t, type="PLAYER_DODGED", data={"tags": ["MOBILITY", "DEFENSIVE"]}))

    assert dodger.get("defensive_tendency").value > attacker.get("defensive_tendency").value + 0.3


def test_dodging_feeds_defensive_tendency_but_not_aggression():
    # Dodges are outside aggression's definition (docs/contracts/telemetry-events.md),
    # so the two traits stay distinct instead of being one number counted twice.
    traits = PlayerTraitModel()
    apply_event(traits, Event(tick=1, type="PLAYER_DODGED", data={"tags": ["MOBILITY", "DEFENSIVE"]}))

    assert traits.get("aggression").samples == 0
    assert traits.get("defensive_tendency").samples == 1


def test_existing_traits_are_unaffected_by_the_new_signals():
    """A pre-change style event still updates exactly the traits it used to."""
    traits = PlayerTraitModel()
    apply_event(traits, Event(tick=1, type="PLAYER_DASHED", data={"distance": 190.0}))

    assert traits.get("mobility").samples == 1
    assert traits.get("aggression").samples == 0
    assert traits.get("preferred_range").samples == 0
    assert traits.get("risk_tolerance").samples == 0
    assert traits.get("defensive_tendency").samples == 0
