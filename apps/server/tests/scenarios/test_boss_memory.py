"""The Mirror remembers the run; the twin reacts to the moment.

The directive's pitch is that the final boss "uses accumulated behavioural
information about the player to anticipate recurring habits". The trait model
cannot supply that on its own: it is an EWMA tuned for the twin, and measured,
about twenty actions inside the boss room were enough to overwrite the read
entirely -- so a whole run of melee followed by twenty bow shots at the door
made the Mirror treat you as a ranged player and rush you.
"""

from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from tests.conftest import DT


def _fight(s, ticks, weapon=None):
    st = s.state
    if weapon:
        st.player.inventory.add_weapon(weapon)
        st.player.inventory.equip(weapon)
    st.player.face(Vec2(1, 0))
    for _ in range(ticks):
        p = st.player
        p.attack_cooldown = 0
        p.mana = p.max_mana
        if p.state in ("hurt", "dead", "drink", "channel"):
            p.state = "idle"
        s.combat.process_player_attack(st)
        s.step(DT)


def _session():
    s = GameSession("boss-memory", seed=17, record=False)
    s.state.enemies = []
    bag = s.state.spawn_enemy("slime", s.state.player.position + Vec2(70, 0))
    bag.max_health = bag.health = 10**9
    s.state.bus.subscribe("DAMAGE_DEALT", lambda e: setattr(bag, "health", 10**9))
    return s, bag


def test_a_whole_run_of_melee_is_not_erased_by_twenty_shots_at_the_door():
    s, _ = _session()
    _fight(s, 2000)                      # the run: melee throughout
    _fight(s, 220, weapon="hunter_bow")  # the door: a sudden switch to the bow

    live = s.pipeline.snapshot().to_json_dict()["traits"]
    boss = s.pipeline.boss_snapshot().to_json_dict()["traits"]

    # The twin sees what you are doing now, which is the point of it.
    assert live["ranged_dependency"]["value"] > 0.8, live["ranged_dependency"]
    # The Mirror sees what you did, which is the point of it.
    assert boss["melee_dependency"]["value"] > 0.6, boss["melee_dependency"]
    assert boss["melee_dependency"]["value"] > boss["ranged_dependency"]["value"]

    # ...and therefore still kites rather than rushing.
    kite = boss["melee_dependency"]["value"] * boss["melee_dependency"]["confidence"]
    rush = boss["ranged_dependency"]["value"] * boss["ranged_dependency"]["confidence"]
    assert kite > rush, f"the boss would rush a melee player: kite={kite:.3f} rush={rush:.3f}"


def test_the_profile_needs_a_run_before_it_is_confident():
    """It must not claim to know you a dozen swings in.

    The harness swings once per tick, so ticks are actions here.
    """
    s, _ = _session()
    _fight(s, 15)
    early = s.pipeline.boss_snapshot().to_json_dict()["traits"]["melee_dependency"]
    _fight(s, 3000)
    late = s.pipeline.boss_snapshot().to_json_dict()["traits"]["melee_dependency"]
    assert early["confidence"] < 0.5, early
    assert late["confidence"] > early["confidence"]


def test_a_genuinely_mixed_player_reads_as_mixed_not_as_whichever_was_last():
    s, _ = _session()
    _fight(s, 1200)
    _fight(s, 1200, weapon="hunter_bow")
    boss = s.pipeline.boss_snapshot().to_json_dict()["traits"]
    melee, ranged = boss["melee_dependency"]["value"], boss["ranged_dependency"]["value"]
    assert 0.2 < melee < 0.8, melee
    assert 0.2 < ranged < 0.8, ranged
