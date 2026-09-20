"""How the twin learns risk_tolerance from the player's retreats.

Retreating early, while healthy, is cautious and must pull risk_tolerance down.
Retreating only when nearly dead is a high tolerance for risk and must push it
up. The mapping used to be the wrong way round: it learned the raw health
fraction, so an early retreater made the twin more reckless.
"""

from mirrorbound.agent.observation import AgentObservation, EntitySnapshot, RoomSnapshot
from mirrorbound.agent.twin.controller import TwinV0Controller
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.game.core.events import Event
from mirrorbound.game.entities.entity import Vec2


def retreat(tick: int, health_fraction) -> Event:
    data = {"tags": ["DEFENSIVE"]}
    if health_fraction is not None:
        data["health_fraction"] = health_fraction
    return Event(tick=tick, type="PLAYER_RETREATED", data=data)


def attack(tick: int, health_fraction: float) -> Event:
    return Event(tick=tick, type="PLAYER_ATTACKED", data={"tags": ["MELEE"], "healthFraction": health_fraction})


def trained_on_retreats(health_fraction: float, times: int = 25) -> TwinStyleModel:
    style = TwinStyleModel()
    for i in range(times):
        style.observe(retreat(i * 30, health_fraction))
    return style


def test_retreating_early_makes_the_twin_more_careful():
    style = trained_on_retreats(0.95)
    assert style.get("risk_tolerance").value < 0.3


def test_retreating_only_when_nearly_dead_makes_the_twin_more_risky():
    style = trained_on_retreats(0.1)
    assert style.get("risk_tolerance").value > 0.7


def test_early_and_late_retreaters_end_up_far_apart():
    early = trained_on_retreats(0.95).get("risk_tolerance").value
    late = trained_on_retreats(0.1).get("risk_tolerance").value
    assert late - early > 0.5


def test_a_retreat_at_half_health_says_nothing_either_way():
    assert abs(trained_on_retreats(0.5).get("risk_tolerance").value - 0.5) < 0.02


def test_retreats_and_attacks_agree_about_what_risky_means():
    """Someone who keeps fighting at 10 percent health and someone who retreats
    at 10 percent health both push on while nearly dead, so both read as risky.
    """
    fighter = TwinStyleModel()
    for i in range(25):
        fighter.observe(attack(i * 30, 0.1))
    assert fighter.get("risk_tolerance").value > 0.7
    assert trained_on_retreats(0.1).get("risk_tolerance").value > 0.7


def test_a_retreat_without_health_information_does_not_touch_risk_tolerance():
    style = TwinStyleModel()
    style.observe(retreat(1, None))
    assert style.get("risk_tolerance").samples == 0
    assert style.get("defensive_tendency").samples == 1   # the retreat itself still counts as defensive


def test_health_fraction_outside_zero_one_is_clamped():
    style = TwinStyleModel()
    style.observe(retreat(1, 5.0))
    assert style.get("risk_tolerance").value <= 0.5
    style = TwinStyleModel()
    style.observe(retreat(1, -5.0))
    assert style.get("risk_tolerance").value >= 0.5


# --- what the twin actually does with it -------------------------------------------


def snap(id_: str, x: float, y: float, role: str, hp: float, max_hp: float) -> EntitySnapshot:
    return EntitySnapshot(id=id_, position=Vec2(x, y), health=hp, max_health=max_hp, velocity=Vec2(), role=role)


def hurt_twin_with_enemy_close() -> AgentObservation:
    return AgentObservation(
        tick=100,
        player_state=snap("player_1", 400, 400, "player", 100, 100),
        twin_state=snap("twin_1", 380, 420, "twin", 30, 90),
        enemies=[snap("enemy_1", 420, 470, "melee", 50, 50)],
        room_context=RoomSnapshot("combat", 1280, 960),
        twin_weapon_range=340,
        twin_weapon_is_melee=False,
    )


def retreat_urge(style: TwinStyleModel) -> float:
    intent = TwinV0Controller(style).decide(hurt_twin_with_enemy_close())
    return intent.utilities["RETREAT"]


def test_a_cautious_players_twin_wants_to_retreat_more_than_a_risky_players_twin():
    cautious_twin = trained_on_retreats(0.95)   # this player retreats early
    risky_twin = trained_on_retreats(0.1)       # this player only retreats near death
    assert retreat_urge(cautious_twin) > retreat_urge(risky_twin)
