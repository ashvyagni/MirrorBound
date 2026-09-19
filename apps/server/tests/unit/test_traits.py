from mirrorbound.agent.player_model.traits import PlayerTraitModel, Trait


def test_new_trait_starts_neutral_with_zero_confidence():
    trait = Trait()
    assert trait.value == 0.5
    assert trait.confidence == 0.0
    assert trait.samples == 0


def test_repeated_high_signal_pulls_value_up_and_confidence_up():
    trait = Trait()
    for _ in range(30):
        trait.update(1.0)
    assert trait.value > 0.9
    assert trait.confidence > 0.7
    assert trait.samples == 30


def test_confidence_never_reaches_one():
    trait = Trait()
    for _ in range(10_000):
        trait.update(1.0)
    assert trait.confidence < 1.0


def test_recent_trend_reflects_direction_of_latest_change():
    trait = Trait()
    for _ in range(10):
        trait.update(0.0)  # settle near 0
    trait.update(1.0)
    assert trait.recent_trend > 0


def test_few_samples_give_low_confidence_even_at_extreme_value():
    # "3 occurrences != I know what you're doing" applies to traits too.
    trait = Trait()
    trait.update(1.0)
    trait.update(1.0)
    trait.update(1.0)
    assert trait.confidence < 0.2


def test_player_trait_model_tracks_named_traits_independently():
    model = PlayerTraitModel()
    model.observe("aggression", 1.0)
    model.observe("defensive_tendency", 0.0)

    assert model.get("aggression").value > 0.5
    assert model.get("defensive_tendency").value < 0.5
    # Unrelated trait, never observed, stays at neutral prior.
    assert model.get("mobility").value == 0.5


def test_snapshot_returns_plain_dict_for_all_traits():
    model = PlayerTraitModel(trait_names=("aggression",))
    model.observe("aggression", 0.9)
    snapshot = model.snapshot()
    assert set(snapshot["aggression"]) == {"value", "confidence", "samples", "recent_trend"}
