from mirrorbound.agent.patterns.decay import is_stale


def test_not_stale_when_recently_confirmed():
    assert is_stale(last_confirmed_tick=100, tick=105, staleness_ticks=50.0) is False


def test_stale_once_threshold_elapsed():
    assert is_stale(last_confirmed_tick=100, tick=150, staleness_ticks=50.0) is True


def test_exactly_at_threshold_counts_as_stale():
    assert is_stale(last_confirmed_tick=100, tick=150, staleness_ticks=50.0) is True
