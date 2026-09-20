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
    # Three abilities to repeat. One staff grants exactly three, so this needs
    # only one weapon now -- but two are carried to keep the sequence spanning
    # both hands, which is the harder thing for the predictor to learn.
    # Keys: 1 ember_bolt, 2 flame_burst, 3 flame_pillar, then the frost staff's
    # 4 frost_bolt, 5 binding_nova, 6 arcane_bolt.
    inv = st.player.inventory
    inv.weapons = ["ember_staff", "frost_staff"]
    inv.equipped_weapon, inv.offhand_weapon = "ember_staff", "frost_staff"
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
    # Primed with keys three and one, the habit says key two comes next --
    # which on this pair of staves is the flame burst.
    preds = s.pipeline.snapshot().to_json_dict()["predictions"]
    assert preds and preds[0]["token"] == "FLAME_BURST"
    assert preds[0]["confidence"] > 0.5
