from mirrorbound.api.session import GameSession
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from tests.conftest import combat_session, DT, events_of


def fresh():
    s = combat_session("exec", seed=3, record=False)
    s.state.enemies = []
    s.state.pending_events.clear()
    return s


def test_intent_change_emits_twin_action_and_closing_emits_outcome():
    s = fresh()
    st = s.state
    enemy = st.spawn_enemy("skeleton", st.twin.position + Vec2(120, 0))
    enemy.max_health = enemy.health = 10_000
    st.pending_events.clear()
    ex = s.twin_executor
    ex.on_intent(st, TwinIntent("ATTACK", target_id=enemy.id, confidence=0.8, reason="test"))
    actions = events_of(s, "TWIN_ACTION")
    assert len(actions) == 1 and actions[0].data["intent"] == "ATTACK"
    # Fight for two seconds: the ranged twin should land hits.
    for _ in range(120):
        st.tick += 1
        st.twin.update(DT)
        ex.apply(DT, st, s.combat)
        s.movement.update(DT, st)
        s.collision.update(DT, st)
    assert st.twin.damage_dealt > 0
    ex.on_intent(st, TwinIntent("FOLLOW", confidence=0.6))
    outcomes = events_of(s, "TWIN_OUTCOME")
    assert outcomes and outcomes[0].data["intent"] == "ATTACK"
    assert outcomes[0].data["success"] is True
    assert outcomes[0].data["damage_dealt"] > 0


def test_same_intent_does_not_spam_actions():
    s = fresh()
    st = s.state
    for _ in range(5):
        ex = s.twin_executor
        ex.on_intent(st, TwinIntent("FOLLOW", position=Vec2(100, 100)))
    assert len(events_of(s, "TWIN_ACTION")) == 1


def test_intent_with_desired_weapon_the_twin_owns_switches_equipped_weapon():
    s = fresh()
    st = s.state
    st.twin.inventory.add_weapon("hunter_bow")
    assert st.twin.inventory.equipped_weapon == "frost_staff"
    s.twin_executor.on_intent(st, TwinIntent("FOLLOW", desired_weapon="hunter_bow"))
    assert st.twin.inventory.equipped_weapon == "hunter_bow"
    assert events_of(s, "TWIN_WEAPON_SWITCH")


def test_desired_weapon_not_owned_is_ignored():
    s = fresh()
    st = s.state
    s.twin_executor.on_intent(st, TwinIntent("FOLLOW", desired_weapon="iron_sword"))
    assert st.twin.inventory.equipped_weapon == "frost_staff"
    assert not events_of(s, "TWIN_WEAPON_SWITCH")


def test_desired_weapon_already_equipped_does_not_re_emit():
    s = fresh()
    st = s.state
    s.twin_executor.on_intent(st, TwinIntent("FOLLOW", desired_weapon="frost_staff"))
    assert not events_of(s, "TWIN_WEAPON_SWITCH")


def test_follow_moves_the_twin_toward_the_goal_and_stops():
    s = fresh()
    st = s.state
    goal = st.twin.position + Vec2(200, 0)
    s.twin_executor.on_intent(st, TwinIntent("FOLLOW", position=goal))
    for _ in range(180):
        s.twin_executor.apply(DT, st, s.combat)
        s.movement.update(DT, st)
    assert (st.twin.position - goal).length() < 16
    assert st.twin.velocity.is_zero()
