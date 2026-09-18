from mirrorbound.agent.twin.style import DIMENSIONS, TwinStyleModel
from mirrorbound.game.core.events import Event


def melee_attack(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "healthFraction": 0.9})


def ranged_attack(tick: int) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["RANGED"], "healthFraction": 0.9})


def test_every_dimension_carries_value_confidence_samples_and_trend():
    snap = TwinStyleModel().snapshot()
    assert set(snap["dims"]) == set(DIMENSIONS)
    for dim in snap["dims"].values():
        assert set(dim) == {"value", "confidence", "samples", "recent_trend"}


def test_imitation_channel_learns_the_players_range_preference():
    style = TwinStyleModel()
    for t in range(30):
        style.observe(melee_attack(t))
    pr = style.get("preferred_range")
    assert pr.value < 0.25 and pr.confidence > 0.5 and pr.samples == 30
    assert style.get("melee_dependency").value > 0.75


def test_strategy_change_shifts_value_and_trend():
    style = TwinStyleModel()
    for t in range(30):
        style.observe(melee_attack(t))
    before = style.get("preferred_range").value
    for t in range(30, 60):
        style.observe(ranged_attack(t))
    after = style.get("preferred_range")
    assert after.value > before + 0.3
    assert after.recent_trend > 0


def test_experience_channel_learns_from_outcomes():
    style = TwinStyleModel()
    for t in range(10):
        style.observe(Event(tick=t, type="TWIN_OUTCOME", data={
            "intent": "ATTACK", "success": False, "damage_dealt": 0, "damage_taken": 30}))
    assert style.get("risk_tolerance").value < 0.35
    assert style.get("preferred_range").value > 0.6
    assert any("careful" in lesson for lesson in style.lessons)


def test_confidence_decays_when_evidence_stops():
    style = TwinStyleModel()
    for t in range(20):
        style.observe(melee_attack(t))
    conf = style.get("preferred_range").confidence
    # 5 minutes of silence at 60Hz.
    for tick in range(20, 20 + 60 * 300, 120):
        style.advance(tick)
    assert style.get("preferred_range").confidence < conf * 0.3
    # The value itself is kept; only certainty fades.
    assert style.get("preferred_range").value < 0.3


def test_relic_learning_multiplier_speeds_learning():
    slow, fast = TwinStyleModel(), TwinStyleModel(learning_mult=1.25)
    for t in range(10):
        slow.observe(melee_attack(t))
        fast.observe(melee_attack(t))
    assert fast.get("preferred_range").value < slow.get("preferred_range").value
