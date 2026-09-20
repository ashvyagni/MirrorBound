"""Real gameplay events (not hand-built ones) reaching the three traits that used
to sit at 0.5 forever, and the `healthFraction` field the telemetry contract
promised on PLAYER_ATTACKED but the game never sent.
"""

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import arm, events_of


def fighter(seed: int, weapon: str, enemy_distance: float) -> GameSession:
    s = GameSession(f"coverage-{seed}", seed=seed, record=False)
    arm(s, weapon)
    st = s.state
    st.enemies = []
    dummy = st.spawn_enemy("slime", st.player.position + Vec2(enemy_distance, 0))
    dummy.max_health = dummy.health = 1_000_000
    st.player.face(Vec2(1, 0))
    st.pending_events.clear()
    return s


def swing(s: GameSession, times: int, health_fraction: float = 1.0) -> None:
    st = s.state
    for _ in range(times):
        st.player.health = st.player.max_health * health_fraction
        st.player.attack_cooldown = 0
        st.player.state = "idle"
        st.player.mana = st.player.max_mana
        s.combat.process_player_attack(st)
        st.tick += 1


def test_player_attacked_carries_the_health_fraction_the_contract_documents():
    s = fighter(seed=5, weapon="iron_sword", enemy_distance=40)
    swing(s, 1, health_fraction=0.4)

    attacked = events_of(s, "PLAYER_ATTACKED")
    assert len(attacked) == 1
    assert abs(attacked[0].data["healthFraction"] - 0.4) < 0.01


def test_health_fraction_tracks_the_players_actual_health_at_swing_time():
    s = fighter(seed=6, weapon="iron_sword", enemy_distance=40)
    swing(s, 1, health_fraction=1.0)
    swing(s, 1, health_fraction=0.25)

    fractions = [e.data["healthFraction"] for e in events_of(s, "PLAYER_ATTACKED")]
    assert fractions[0] == 1.0
    assert abs(fractions[1] - 0.25) < 0.01


def test_twin_style_risk_tolerance_now_learns_from_real_attacks():
    """This dimension read `healthFraction` off attacks that never carried it,
    so it had zero samples no matter how the player fought.
    """
    reckless = fighter(seed=7, weapon="iron_sword", enemy_distance=40)
    careful = fighter(seed=7, weapon="iron_sword", enemy_distance=40)
    swing(reckless, 30, health_fraction=0.15)
    swing(careful, 30, health_fraction=1.0)

    reckless_dim = reckless.style.snapshot()["dims"]["risk_tolerance"]
    careful_dim = careful.style.snapshot()["dims"]["risk_tolerance"]
    assert reckless_dim["samples"] == 30
    assert careful_dim["samples"] == 30
    assert reckless_dim["value"] > careful_dim["value"] + 0.2


def test_player_model_separates_a_reckless_brawler_from_a_careful_kiter():
    brawler = fighter(seed=8, weapon="iron_sword", enemy_distance=45)
    kiter = fighter(seed=8, weapon="frost_staff", enemy_distance=260)
    swing(brawler, 30, health_fraction=0.2)
    swing(kiter, 30, health_fraction=1.0)

    b = brawler.pipeline.snapshot().to_json_dict()["traits"]
    k = kiter.pipeline.snapshot().to_json_dict()["traits"]

    for traits in (b, k):
        for name in ("preferred_range", "risk_tolerance", "defensive_tendency"):
            assert traits[name]["samples"] > 0, f"{name} still never observed"

    assert b["preferred_range"]["value"] < 0.25
    assert k["preferred_range"]["value"] > 0.6
    assert b["risk_tolerance"]["value"] > k["risk_tolerance"]["value"] + 0.3


def test_confidence_builds_for_the_newly_fed_traits():
    s = fighter(seed=9, weapon="iron_sword", enemy_distance=45)
    swing(s, 40, health_fraction=0.3)

    traits = s.pipeline.snapshot().to_json_dict()["traits"]
    for name in ("preferred_range", "risk_tolerance", "defensive_tendency"):
        assert traits[name]["confidence"] > 0.8


def test_same_seed_and_inputs_give_identical_trait_snapshots():
    """The added signals must not introduce nondeterminism (AGENTS.md)."""
    def run() -> dict:
        s = fighter(seed=10, weapon="iron_sword", enemy_distance=45)
        swing(s, 12, health_fraction=0.5)
        swing(s, 12, health_fraction=0.9)
        return s.pipeline.snapshot().to_json_dict()["traits"]

    assert run() == run()
