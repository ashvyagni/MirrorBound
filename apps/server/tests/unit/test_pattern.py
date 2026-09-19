from mirrorbound.agent.patterns.pattern import Pattern


def test_sequence_property_joins_context_and_next_token():
    pattern = Pattern(
        context=("DASH", "FIRE"),
        next_token="AERIAL_ATTACK",
        order=2,
        confidence=0.9,
        first_detected_tick=10,
        last_confirmed_tick=20,
    )
    assert pattern.sequence == ("DASH", "FIRE", "AERIAL_ATTACK")


def test_to_json_dict_is_plain_and_json_serializable():
    import json

    pattern = Pattern(
        context=("DASH",),
        next_token="FIRE",
        order=1,
        confidence=0.75,
        first_detected_tick=5,
        last_confirmed_tick=8,
    )
    exported = pattern.to_json_dict()
    assert exported == {
        "sequence": ["DASH", "FIRE"],
        "order": 1,
        "confidence": 0.75,
        "first_detected_tick": 5,
        "last_confirmed_tick": 8,
    }
    json.dumps(exported)  # must not raise
