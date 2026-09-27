"""The twin looking after itself: drinking, eating, and buying more.

Three defects sat behind this feature and each one has a test here that fails
without its fix:

* `loot.py` routed every consumable to the player's bag whoever picked it up, so
  a companion with an inventory could not own a potion at all.
* `HEAL` was declared in `INTENT_TYPES`, produced by nothing, and filed in the
  executor under the *movement* intents -- so on the one occasion it might have
  appeared, the twin would have walked.
* The twin had no money, so "buy itself health potions" had nowhere to start.

The rest is the behaviour the three make possible, and the rule the whole feature
is written to: the twin is held to the player's own numbers. Same drink duration,
same shared cooldown, same refusal to drink at full health, same interruption
when something hits it.
"""

from mirrorbound.agent.observation import AgentObservation, EntitySnapshot, RoomSnapshot, VendorSnapshot
from mirrorbound.agent.twin.controller import HEALTH_POTION, STOCK_MAX, TwinV0Controller
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.contracts.messages import TwinIntentModel
from mirrorbound.game.core.events import Event
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import POTION_SHARED_COOLDOWN
from mirrorbound.game.entities.twin import CARRY_CAP, GOLD_SHARE, TwinIntent
from mirrorbound.game.progression.survival import HUNGRY_BELOW, MAX_HUNGER
from mirrorbound.game.world.npc import Npc
from tests.conftest import DT, combat_session, events_of


# --- harness ---------------------------------------------------------------------

def fresh():
    s = combat_session("autonomy", seed=11, record=False)
    s.state.enemies = []
    s.state.pending_events.clear()
    return s


def apart(gap: float = 500.0):
    """A session with the twin well clear of the player, so a pickup at the
    twin's feet is unambiguously the twin's."""
    s = fresh()
    s.state.twin.position = s.state.player.position + Vec2(gap, 0)
    return s


def collect(session, kind: str, *, by, **kw) -> None:
    session.state.spawn_pickup(kind, by.position.copy(), **kw)
    session.combat.loot.update(DT, session.state)


def run(session, ticks: int) -> None:
    """Drive the twin only -- the part of the session loop this is about."""
    st = session.state
    for _ in range(ticks):
        st.tick += 1
        session._update_twin(DT)
        session.movement.update(DT, st)


def ent(id_: str, x: float, y: float, role: str = "melee", hp: float = 50, max_hp: float = 50, **kw):
    return EntitySnapshot(id=id_, position=Vec2(x, y), health=hp, max_health=max_hp,
                          velocity=Vec2(), role=role, **kw)


def obs(twin_hp: float = 90.0, enemies=(), **kw) -> AgentObservation:
    return AgentObservation(
        tick=100,
        player_state=ent("player_1", 400, 400, "player", 100, 100),
        twin_state=ent("twin_1", 380, 420, "twin", twin_hp, 90),
        enemies=list(enemies),
        room_context=RoomSnapshot("combat", 1280, 960),
        twin_weapon_range=340, twin_weapon_is_melee=False, **kw,
    )


def decide(o: AgentObservation, style: TwinStyleModel | None = None) -> TwinIntent:
    return TwinV0Controller(style).decide(o)


# --- the purse and the pack: what the twin is allowed to own ----------------------

def test_a_potion_the_twin_walks_over_is_the_twins():
    """The defect this whole feature was blocked behind."""
    s = apart()
    collect(s, "health_potion", by=s.state.twin)
    assert s.state.twin.inventory.consumables.get("health_potion") == 1
    assert "health_potion" not in s.state.player.inventory.consumables


def test_past_the_carry_cap_the_twin_hands_potions_across():
    s = apart()
    for _ in range(CARRY_CAP + 2):
        collect(s, "health_potion", by=s.state.twin)
    assert s.state.twin.inventory.consumables["health_potion"] == CARRY_CAP
    assert s.state.player.inventory.consumables["health_potion"] == 2


def test_the_player_picking_something_up_never_fills_the_twins_pack():
    s = apart()
    collect(s, "health_potion", by=s.state.player)
    assert s.state.player.inventory.consumables["health_potion"] == 1
    assert not s.state.twin.inventory.consumables


def test_essence_stays_on_the_player_whoever_collected_it():
    """Shared currency is read off the player's inventory and nowhere else."""
    s = apart()
    before = s.state.player.inventory.resources.get("essence", 0)
    collect(s, "essence", by=s.state.twin, amount=4)
    assert s.state.player.inventory.resources["essence"] == before + 4
    assert not s.state.twin.inventory.resources.get("essence")


def test_the_twin_keeps_a_share_of_gold_it_picked_up_itself():
    s = apart()
    s.state.twin.inventory.gold = 0
    s.state.player.inventory.gold = 0
    collect(s, "gold", by=s.state.twin, amount=8)
    share = round(8 * GOLD_SHARE)
    assert s.state.twin.inventory.gold == share
    assert s.state.player.inventory.gold == 8 - share
    # And the split is reported, so a player can see where the coin went.
    assert events_of(s, "GOLD_GAINED")[-1].data["twinShare"] == share


def test_gold_the_player_picks_up_is_all_the_players():
    s = apart()
    s.state.twin.inventory.gold = 0
    s.state.player.inventory.gold = 0
    collect(s, "gold", by=s.state.player, amount=8)
    assert s.state.player.inventory.gold == 8 and s.state.twin.inventory.gold == 0


# --- HEAL: the twin drinks -------------------------------------------------------

def test_a_hurt_twin_with_a_potion_decides_to_heal():
    o = obs(twin_hp=25.0, twin_consumables={HEALTH_POTION: 2})
    intent = decide(o)
    assert intent.intent_type == "HEAL"
    assert intent.item_id == HEALTH_POTION
    TwinIntentModel.model_validate(intent.to_dict())


def test_a_hurt_twin_with_an_empty_pack_does_not_decide_to_heal():
    intent = decide(obs(twin_hp=25.0))
    assert intent.intent_type != "HEAL"
    assert intent.utilities["HEAL"] == 0.0


def test_a_healthy_twin_does_not_drink_its_potions():
    intent = decide(obs(twin_hp=90.0, twin_consumables={HEALTH_POTION: 2}))
    assert intent.intent_type != "HEAL"


def test_a_scratch_is_not_worth_a_potion():
    """0.30 of base utility loses to FOLLOW on purpose: the twin sips when it is
    hurt, not whenever it is not full."""
    intent = decide(obs(twin_hp=80.0, twin_consumables={HEALTH_POTION: 2}))
    assert intent.intent_type != "HEAL"


def test_with_something_on_top_of_it_the_twin_backs_off_before_drinking():
    """RETREAT and HEAL are scored in the same pass and neither knows the other
    exists: the drink is discounted by how close the nearest enemy is, retreat is
    rewarded by the same thing, and 'back off, then drink' is what falls out."""
    close = obs(twin_hp=20.0, enemies=[ent("enemy_1", 390, 430)],
                twin_consumables={HEALTH_POTION: 2})
    assert decide(close).intent_type == "RETREAT"
    clear = obs(twin_hp=20.0, enemies=[ent("enemy_1", 1100, 900)],
                twin_consumables={HEALTH_POTION: 2})
    assert decide(clear).intent_type == "HEAL"


def test_the_twin_will_not_drink_into_a_telegraph():
    o = obs(twin_hp=20.0,
            enemies=[ent("enemy_1", 400, 440, winding_up=True, windup=0.3)],
            twin_consumables={HEALTH_POTION: 2})
    assert decide(o).utilities["HEAL"] == 0.0


def test_heal_actually_drinks_and_heals():
    """`twin_executor` filed HEAL under the movement intents, so it walked."""
    s = fresh()
    st = s.state
    st.twin.health = 30.0
    st.twin.inventory.add_consumable(HEALTH_POTION, 2)
    s.twin_executor.on_intent(st, TwinIntent("HEAL", item_id=HEALTH_POTION, confidence=0.9))
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.busy_with == HEALTH_POTION
    assert st.twin.velocity.length() == 0          # rooted, like the player
    for _ in range(40):
        st.tick += 1
        st.twin.update(DT)
        s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.health > 30.0
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1
    used = events_of(s, "TWIN_ITEM_USED")
    assert used and used[-1].data["item"] == HEALTH_POTION and used[-1].data["healed"] > 0


def test_being_hit_spills_the_flask_and_costs_the_twin_nothing():
    s = fresh()
    st = s.state
    st.twin.health = 40.0
    st.twin.inventory.add_consumable(HEALTH_POTION, 1)
    s.twin_executor.on_intent(st, TwinIntent("HEAL", item_id=HEALTH_POTION))
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.busy
    st.twin.invulnerable_for = 0.0
    st.twin.take_hit(5.0)
    assert not st.twin.busy and st.twin.busy_with == ""
    # Interrupted, so nothing was consumed -- the same bargain the player makes.
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1
    assert not events_of(s, "TWIN_ITEM_USED")


def test_the_twin_is_on_the_players_own_potion_cooldown():
    s = fresh()
    st = s.state
    st.twin.health = 20.0
    st.twin.inventory.add_consumable(HEALTH_POTION, 3)
    s.twin_executor.on_intent(st, TwinIntent("HEAL", item_id=HEALTH_POTION))
    for _ in range(40):
        st.tick += 1
        st.twin.update(DT)
        s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.inventory.consumables[HEALTH_POTION] == 2
    # Set to the player's own constant, and already counting down by the time
    # the loop hands back.
    assert POTION_SHARED_COOLDOWN - 0.5 < st.twin.use_cooldown <= POTION_SHARED_COOLDOWN
    # Two more seconds of trying: still on cooldown, still two potions.
    for _ in range(120):
        st.tick += 1
        st.twin.update(DT)
        s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.inventory.consumables[HEALTH_POTION] == 2


def test_the_twin_will_not_drink_at_full_health():
    s = fresh()
    st = s.state
    st.twin.inventory.add_consumable(HEALTH_POTION, 1)
    s.twin_executor.on_intent(st, TwinIntent("HEAL", item_id=HEALTH_POTION))
    s.twin_executor.apply(DT, st, s.combat)
    assert not st.twin.busy
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1


def test_a_busy_twin_cannot_attack():
    s = fresh()
    st = s.state
    st.twin.health = 20.0
    st.twin.inventory.add_consumable(HEALTH_POTION, 1)
    s.twin_executor.on_intent(st, TwinIntent("HEAL", item_id=HEALTH_POTION))
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.busy and not st.twin.can_attack()


# --- EAT: the twin feeds itself --------------------------------------------------

def test_a_hungry_twin_with_food_decides_to_eat():
    o = obs(twin_consumables={"bread": 1}, twin_hunger=0.2, twin_hunger_band="hungry")
    intent = decide(o)
    assert intent.intent_type == "EAT" and intent.item_id == "bread"


def test_a_fed_twin_does_not_eat():
    o = obs(twin_consumables={"bread": 1}, twin_hunger=1.0, twin_hunger_band="fed")
    intent = decide(o)
    assert intent.intent_type != "EAT" and intent.utilities["EAT"] == 0.0


def test_the_twin_eats_the_smallest_thing_that_fills_the_gap():
    """Overeating is wasted outright, so spending cooked meat on a snack throws
    food away -- and nibbling raw meat while starving looks like inattention.

    Tested on the rule itself rather than through a whole decision: a twin only
    breaks off to eat once the gap is wide, so the interesting small-gap case is
    not reachable as an intent -- and the claim here is about which food, not
    about whether to eat.
    """
    pantry = {"raw_meat": 1, "bread": 1, "cooked_meat": 1}
    meal = TwinV0Controller._best_meal
    assert meal(pantry, 10.0) == "raw_meat"     # a nibble is enough
    assert meal(pantry, 20.0) == "bread"        # raw meat would not cover it
    assert meal(pantry, 40.0) == "cooked_meat"
    assert meal(pantry, 500.0) == "cooked_meat"  # nothing covers it: the biggest
    assert meal({}, 40.0) is None


def test_a_starving_twin_reaches_for_the_real_meal():
    starving = obs(twin_consumables={"raw_meat": 1, "cooked_meat": 1},
                   twin_hunger=0.05, twin_hunger_band="hungry")
    assert decide(starving).item_id == "cooked_meat"


def test_eating_fills_the_twins_bar_and_never_heals_it():
    s = fresh()
    st = s.state
    st.twin.hunger.value = 20.0
    st.twin.health = 40.0
    st.twin.inventory.add_consumable("bread", 1)
    s.twin_executor.on_intent(st, TwinIntent("EAT", item_id="bread"))
    for _ in range(40):
        st.tick += 1
        st.twin.update(DT)
        s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.hunger.value > 20.0
    assert st.twin.health == 40.0
    assert "bread" not in st.twin.inventory.consumables


def test_a_twin_told_to_eat_nothing_follows_instead_of_standing_there():
    s = fresh()
    st = s.state
    st.twin.hunger.value = 10.0
    away = st.player.position + Vec2(600, 0)
    st.twin.position = away
    s.twin_executor.on_intent(st, TwinIntent("EAT", item_id="bread"))
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.velocity.length() > 0


def test_the_hearth_cooks_the_twins_meat_too():
    s = fresh()
    st = s.state
    st.twin.inventory.add_consumable("raw_meat", 3)
    assert s._cook_at_hearth(st.twin) == 3
    assert st.twin.inventory.consumables["cooked_meat"] == 3
    assert "raw_meat" not in st.twin.inventory.consumables


# --- SHOP: the twin buys its own -------------------------------------------------

def vendor_obs(gold: int, held: int = 0, **kw) -> AgentObservation:
    return obs(
        twin_gold=gold,
        twin_consumables={HEALTH_POTION: held} if held else {},
        vendors=[VendorSnapshot("apothecary_siv", Vec2(500, 420), {HEALTH_POTION: 35})],
        **kw,
    )


def test_a_twin_with_money_and_an_empty_pack_goes_shopping():
    intent = decide(vendor_obs(200))
    assert intent.intent_type == "SHOP"
    assert intent.target_id == "apothecary_siv" and intent.item_id == HEALTH_POTION
    assert intent.position is not None
    TwinIntentModel.model_validate(intent.to_dict())


def test_a_twin_that_cannot_afford_it_does_not_walk_to_the_stall():
    assert decide(vendor_obs(10)).utilities["SHOP"] == 0.0


def test_a_twin_already_carrying_its_target_does_not_shop():
    assert decide(vendor_obs(200, held=STOCK_MAX)).utilities["SHOP"] == 0.0


def test_the_twin_does_not_break_off_a_fight_to_shop():
    o = vendor_obs(200, enemies=[ent("enemy_1", 600, 400)])
    assert o.vendors and decide(o).utilities["SHOP"] == 0.0


def test_shopping_walks_to_the_stall_and_buys_once_there():
    s = fresh()
    st = s.state
    st.twin.inventory.gold = 100
    siv = next(n for n in st.room.npcs if n.definition.stock) if st.room.npcs else None
    if siv is None:
        from mirrorbound.game.world.npc import APOTHECARY_SIV
        siv = Npc(APOTHECARY_SIV, st.twin.position.x + 300, st.twin.position.y)
        st.room.npcs.append(siv)
    s.twin_executor.on_intent(st, TwinIntent("SHOP", target_id=siv.id, item_id=HEALTH_POTION,
                                             position=Vec2(siv.x, siv.y)))
    # Far off: it walks.
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.velocity.length() > 0
    assert not st.twin.inventory.consumables.get(HEALTH_POTION)
    # Standing at the stall: it pays.
    st.twin.position = Vec2(siv.x, siv.y)
    s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1
    bought = events_of(s, "TWIN_PURCHASE")
    assert bought and bought[-1].data["item"] == HEALTH_POTION
    assert st.twin.inventory.gold == 100 - bought[-1].data["price"]


def test_the_twin_buys_once_per_decision_not_once_per_tick():
    """Six ticks pass between decisions; without the guard the twin would empty
    its purse standing still."""
    s = fresh()
    st = s.state
    st.twin.inventory.gold = 500
    from mirrorbound.game.world.npc import APOTHECARY_SIV
    siv = Npc(APOTHECARY_SIV, st.twin.position.x, st.twin.position.y)
    st.room.npcs.append(siv)
    s.twin_executor.on_intent(st, TwinIntent("SHOP", target_id=siv.id, item_id=HEALTH_POTION))
    for _ in range(30):
        st.tick += 1
        s.twin_executor.apply(DT, st, s.combat)
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1


def test_the_twin_cannot_buy_with_the_players_gold():
    s = fresh()
    st = s.state
    st.twin.inventory.gold = 0
    st.player.inventory.gold = 5_000
    from mirrorbound.game.world.npc import APOTHECARY_SIV
    siv = Npc(APOTHECARY_SIV, st.twin.position.x, st.twin.position.y)
    st.room.npcs.append(siv)
    s.twin_executor.on_intent(st, TwinIntent("SHOP", target_id=siv.id, item_id=HEALTH_POTION))
    s.twin_executor.apply(DT, st, s.combat)
    assert not st.twin.inventory.consumables.get(HEALTH_POTION)
    assert st.player.inventory.gold == 5_000


def test_the_twin_will_not_buy_a_weapon_off_a_shelf():
    """`_buy` is consumables only: the twin's weapon choice goes through
    `desired_weapon` over what it owns, and a companion spending its wages on a
    sword it was never scored to want is a different feature."""
    s = fresh()
    st = s.state
    st.twin.inventory.gold = 500
    from mirrorbound.game.world.npc import SMITH_OREN
    oren = Npc(SMITH_OREN, st.twin.position.x, st.twin.position.y)
    st.room.npcs.append(oren)
    s.twin_executor.on_intent(st, TwinIntent("SHOP", target_id=oren.id, item_id="iron_sword"))
    s.twin_executor.apply(DT, st, s.combat)
    assert "iron_sword" not in st.twin.inventory.weapons
    assert st.twin.inventory.gold == 500


def test_somebody_in_the_world_sells_food():
    """The SHOP branch that buys food is only reachable if food is on a shelf."""
    from mirrorbound.game.world.npc import REGION_NPCS, VILLAGE_NPCS
    from mirrorbound.game.inventory import FOODS
    everyone = [d for group in (*VILLAGE_NPCS.values(), *REGION_NPCS.values()) for d in group]
    for_sale = {e.item_id for d in everyone for e in d.stock if e.kind == "consumable"}
    assert for_sale & FOODS
    # And in the village the game opens in, so hunger has an answer from tick one.
    opening = {e.item_id for d in VILLAGE_NPCS["hollow_reach"] for e in d.stock}
    assert opening & FOODS


# --- what it learns from all of it ----------------------------------------------

def ev(kind: str, tick: int = 60, **data) -> Event:
    return Event(type=kind, tick=tick, data=data)


def test_the_twin_copies_the_health_the_player_drinks_at():
    style = TwinStyleModel()
    for i in range(30):
        style.observe(ev("ITEM_USED", tick=60 + i, item="health_potion", healed=40, atHealth=0.8))
    drink_at = style.get("drink_threshold")
    assert drink_at.value > 0.6 and drink_at.confidence > 0.5


def test_a_player_who_gambles_makes_a_twin_that_gambles():
    style = TwinStyleModel()
    for i in range(30):
        style.observe(ev("ITEM_USED", tick=60 + i, item="health_potion", healed=40, atHealth=0.12))
    assert style.get("drink_threshold").value < 0.4


def test_going_down_holding_a_potion_teaches_it_to_drink_sooner():
    style = TwinStyleModel()
    before = style.get("drink_threshold").value
    style.observe(ev("TWIN_DOWNED", potions=2, intent="ATTACK"))
    assert style.get("drink_threshold").value > before
    assert any("holding" in note for note in style.lessons)


def test_going_down_with_an_empty_pack_teaches_it_to_carry_more():
    style = TwinStyleModel()
    before = style.get("stock_target").value
    style.observe(ev("TWIN_DOWNED", potions=0, intent="ATTACK"))
    assert style.get("stock_target").value > before
    assert style.get("drink_threshold").value == 0.5   # nothing to have drunk


def test_dying_broke_makes_it_readier_to_spend():
    style = TwinStyleModel()
    before = style.get("thrift").value
    style.observe(ev("TWIN_DOWNED", potions=0, intent="ATTACK"))
    assert style.get("thrift").value < before


def test_watching_the_player_shop_teaches_it_to_spend():
    style = TwinStyleModel()
    for i in range(20):
        style.observe(ev("SHOP_PURCHASE", tick=60 + i, item="health_potion", price=35))
    assert style.get("thrift").value < 0.3
    assert style.get("stock_target").value > 0.6


def test_a_heal_that_cost_it_damage_teaches_it_to_drink_earlier():
    style = TwinStyleModel()
    style.observe(ev("TWIN_OUTCOME", intent="HEAL", success=False, damage_dealt=0.0,
                     damage_taken=22.0, health_fraction=0.45))
    assert style.get("drink_threshold").value > 0.5


def test_the_twins_own_drinking_never_teaches_it_about_the_player():
    """TWIN_ITEM_USED is a different event from ITEM_USED for exactly this: the
    imitation channel must not be fed the twin's own behaviour."""
    style = TwinStyleModel()
    style.observe(ev("TWIN_ITEM_USED", item="health_potion", healed=40, atHealth=0.1))
    assert style.player_events_seen == 0
    assert style.get("drink_threshold").value == 0.5


def test_a_learned_stock_target_changes_how_much_it_buys():
    careless, careful = TwinStyleModel(), TwinStyleModel()
    for i in range(40):
        careful.observe(ev("TWIN_DOWNED", tick=60 + i, potions=0, intent="ATTACK"))
    want_careful = TwinV0Controller._stock_target(careful.confident_value("stock_target"))
    want_careless = TwinV0Controller._stock_target(careless.confident_value("stock_target"))
    assert want_careful > want_careless


def test_every_style_dimension_survives_a_round_trip():
    style = TwinStyleModel()
    snap = style.snapshot()
    assert {"drink_threshold", "stock_target", "thrift"} <= set(snap["dims"])


# --- the whole loop, in the session ---------------------------------------------

def test_a_hurt_twin_in_a_live_session_drinks_on_its_own():
    """No hand-written intent: the controller decides, the executor acts."""
    s = fresh()
    st = s.state
    st.twin.health = 18.0
    st.twin.inventory.add_consumable(HEALTH_POTION, 2)
    run(s, 90)
    assert st.twin.health > 18.0
    assert st.twin.inventory.consumables[HEALTH_POTION] == 1
    assert events_of(s, "TWIN_ITEM_USED")


def test_a_starving_twin_in_a_live_session_eats_on_its_own():
    s = fresh()
    st = s.state
    st.twin.hunger.value = MAX_HUNGER * HUNGRY_BELOW * 0.5
    st.twin.inventory.add_consumable("cooked_meat", 1)
    run(s, 90)
    assert st.twin.hunger.value > MAX_HUNGER * HUNGRY_BELOW * 0.5
    assert "cooked_meat" not in st.twin.inventory.consumables


def test_a_dormant_twin_does_none_of_this():
    s = combat_session("dormant", seed=11, record=False)
    s.state.enemies = []
    s.state.twin.dormant = True
    s.state.twin.health = 10.0
    s.state.twin.inventory.add_consumable(HEALTH_POTION, 2)
    s.state.pending_events.clear()
    run(s, 60)
    assert s.state.twin.inventory.consumables[HEALTH_POTION] == 2
    assert not events_of(s, "TWIN_ITEM_USED")
