"""Real gameplay events (not hand-built ones) flowing into the player model and
the twin's style model — the boundary the whole AI story depends on.
"""

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import DT


def test_melee_play_is_read_as_melee_by_both_models():
    s = GameSession("flow", seed=21, record=False)
    st = s.state
    st.enemies = []
    dummy = st.spawn_enemy("slime", st.player.position + Vec2(40, 0))
    dummy.max_health = dummy.health = 100_000
    st.player.face(Vec2(1, 0))
    for _ in range(25):
        st.player.attack_cooldown = 0
        st.player.state = "idle"
        s.combat.process_player_attack(st)
        st.tick += 1
    model = s.pipeline.snapshot().to_json_dict()
    assert model["traits"]["melee_dependency"]["value"] > 0.85
    assert model["traits"]["aggression"]["value"] > 0.85
    assert model["spatial"]["melee"], "melee zone layer populated from real attack positions"
    style = s.style.snapshot()["dims"]
    assert style["preferred_range"]["value"] < 0.3
    assert style["melee_dependency"]["confidence"] > 0.4


def test_repeated_ability_sequence_becomes_a_prediction():
    s = GameSession("seq", seed=21, record=False)
    st = s.state
    st.enemies = []
    for rep in range(12):
        for slot in (3, 1, 2):
            st.player.mana = 100
            st.player.state = "idle"
            for aid in list(st.player.ability_cooldowns):
                st.player.ability_cooldowns[aid] = 0
            st.player.update(DT)
            s.combat.process_ability(st, slot)
            st.tick += 1
    # Prime with the first two, ask what comes third.
    for slot in (3, 1):
        st.player.mana = 100
        st.player.state = "idle"
        st.player.ability_cooldowns.clear()
        s.combat.process_ability(st, slot)
        st.tick += 1
    preds = s.pipeline.snapshot().to_json_dict()["predictions"]
    assert preds and preds[0]["token"] == "FLAME_BURST"
    assert preds[0]["confidence"] > 0.5


def test_the_twin_fighting_does_not_move_the_players_traits():
    """The regression the other test in this file could not catch.

    `test_melee_play_is_read_as_melee_by_both_models` calls the combat system
    directly with no twin acting, so it never exercised the case that broke:
    the collector is subscribed to the whole bus, and TWIN_ATTACKED carries
    both `tags` (its frost staff: RANGED, SPELL) and `distance` (the gap to its
    target). Scored as player evidence, a pure-melee player alongside the
    default twin read as ranged, and a stationary player as maximally mobile.

    This drives the real tick loop with the twin genuinely fighting, and asserts
    the player model still describes the *player*.
    """
    s = GameSession("twin-noise", seed=31, record=False)
    st = s.state
    st.enemies = []
    bag = st.spawn_enemy("slime", st.player.position + Vec2(70, 0))
    bag.max_health = bag.health = 10**9
    st.player.face(Vec2(1, 0))

    for _ in range(900):
        s.handle_input({"type": "INPUT", "moveX": 0.0, "moveY": 0.0, "attack": True})
        s.step(DT)
        bag.health = 10**9          # keep the fight going

    twin_attacks = sum(1 for e in s.state.bus._buffer if e.type == "TWIN_ATTACKED")
    traits = s.pipeline.snapshot().to_json_dict()["traits"]

    assert twin_attacks > 0, "the twin must actually be firing for this to prove anything"
    # The player swung a sword and never moved or cast anything.
    assert traits["melee_dependency"]["value"] > 0.9, traits["melee_dependency"]
    assert traits["ranged_dependency"]["value"] < 0.1, traits["ranged_dependency"]
    assert traits["spell_dependency"]["value"] < 0.1, traits["spell_dependency"]
    assert traits["mobility"]["samples"] == 0, "a stationary player has no mobility evidence"

    # And the Mirror therefore reads them the right way round.
    melee = traits["melee_dependency"]
    ranged = traits["ranged_dependency"]
    kite = melee["value"] * melee["confidence"]
    rush = ranged["value"] * ranged["confidence"]
    assert kite > rush, f"boss would rush a melee player: kite={kite:.3f} rush={rush:.3f}"
