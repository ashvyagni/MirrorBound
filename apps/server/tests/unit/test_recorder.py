"""The replay recorder must never destroy a recording it has already written."""

from mirrorbound.replay.recorder import ReplayRecorder


def test_a_second_run_does_not_overwrite_the_first(tmp_path):
    """Restart keeps the session id, and restarting without a seed keeps the
    seed, so the obvious filename collides with the run that just ended. That
    used to be opened "w" -- deleting exactly the recording someone would want
    after dying. Reconnecting hit the same path.
    """
    first = ReplayRecorder("web-abc", 1234, directory=tmp_path)
    first.record_input(10, {"type": "INPUT", "moveX": 1.0})
    first.close()
    first_bytes = first.path.read_bytes()
    assert first_bytes

    second = ReplayRecorder("web-abc", 1234, directory=tmp_path)
    second.record_input(10, {"type": "INPUT", "moveX": -1.0})
    second.close()

    assert second.path != first.path, "the second run must get its own file"
    assert first.path.read_bytes() == first_bytes, "the first run's recording survived"
    assert second.path.read_bytes(), "and the second one was written"
    assert len(list(tmp_path.glob("*.jsonl"))) == 2


def test_disabled_recorder_writes_nothing(tmp_path):
    r = ReplayRecorder("web-abc", 1, directory=tmp_path, enabled=False)
    r.record_input(1, {"type": "INPUT"})
    r.close()
    assert r.path is None
    assert not list(tmp_path.glob("*.jsonl"))
