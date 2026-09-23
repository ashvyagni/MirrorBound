from mirrorbound.game.core.rng import DeterministicRNG


def test_same_seed_same_sequence():
    a = DeterministicRNG(seed=48192017)
    b = DeterministicRNG(seed=48192017)

    a_values = [a.next_float() for _ in range(50)]
    b_values = [b.next_float() for _ in range(50)]

    assert a_values == b_values


def test_different_seed_different_sequence():
    a = DeterministicRNG(seed=1)
    b = DeterministicRNG(seed=2)

    assert [a.next_float() for _ in range(20)] != [b.next_float() for _ in range(20)]


def test_randint_bounds_are_inclusive():
    rng = DeterministicRNG(seed=7)
    values = {rng.randint(1, 3) for _ in range(200)}
    assert values == {1, 2, 3}


def test_choice_is_deterministic():
    a = DeterministicRNG(seed=99)
    b = DeterministicRNG(seed=99)
    options = ["DASH", "FIRE", "AERIAL_ATTACK", "DODGE", "MELEE"]

    a_choices = [a.choice(options) for _ in range(30)]
    b_choices = [b.choice(options) for _ in range(30)]

    assert a_choices == b_choices


def test_spawned_stream_is_independent_of_parent():
    parent = DeterministicRNG(seed=123)
    combat = parent.spawn("combat")
    dungeon = parent.spawn("dungeon")

    combat_values = [combat.next_float() for _ in range(10)]
    dungeon_values = [dungeon.next_float() for _ in range(10)]

    assert combat_values != dungeon_values


def test_spawned_stream_is_deterministic_and_order_independent():
    # Deriving "combat" then "dungeon" from a fresh parent must give the same
    # combat stream as deriving them in the opposite order — spawn() must not
    # depend on call order, only on (seed, label).
    parent_a = DeterministicRNG(seed=123)
    combat_a = parent_a.spawn("combat")
    _dungeon_a = parent_a.spawn("dungeon")

    parent_b = DeterministicRNG(seed=123)
    _dungeon_b = parent_b.spawn("dungeon")
    combat_b = parent_b.spawn("combat")

    assert [combat_a.next_float() for _ in range(10)] == [
        combat_b.next_float() for _ in range(10)
    ]


def test_chance_respects_extremes():
    rng = DeterministicRNG(seed=1)
    assert all(not rng.chance(0.0) for _ in range(20))
    assert all(rng.chance(1.0) for _ in range(20))
