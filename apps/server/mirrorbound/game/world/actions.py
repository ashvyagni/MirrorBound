"""Authoritative vendor and companion requests, independent of transport."""
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from mirrorbound.game.progression.attributes import ATTRIBUTES
from mirrorbound.game.progression.materials import MATERIALS, describe_fitting, training_cost
from mirrorbound.game.world.npc import TALK_RADIUS

#: Who will sell you an attribute point.
#:
#: The three people a village already has who could plausibly teach you
#: something: the smith, the apothecary and the elder. Adding a dedicated trainer
#: would mean a new role, a new portrait and a new stall in every settlement
#: plan -- §35 asks for composition before new assets, and a smith who will also
#: show you how to put your weight behind a swing is not a stretch.
#:
#: Any of the three will train any attribute. Splitting them by attribute was the
#: first version and it was worse: it meant walking across a village to spend ore
#: you were already standing next to the right person to spend.
TRAINER_ROLES = ("weaponsmith", "apothecary", "elder")


def buy_item(state, npc_id: str, item_id: str) -> None:
    player = state.player
    npc = next((n for n in state.room.npcs if n.id == npc_id), None)
    if npc is None:
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", reason="not here")
        return
    if (Vec2(npc.x, npc.y) - player.position).length() > TALK_RADIUS + player.radius:
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", reason="too far")
        return
    entry = next((e for e in npc.definition.stock if e.item_id == item_id), None)
    if entry is None:
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", item=item_id, reason="not stocked")
        return
    inv = player.inventory
    # Refuse before taking the gold, never after.
    if entry.kind == "weapon" and item_id in inv.weapons:
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", item=item_id, reason="already owned")
        return
    if entry.kind == "relic" and item_id in inv.relics:
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", item=item_id, reason="already owned")
        return
    if not inv.spend_gold(entry.price):
        state.emit("ACTION_REJECTED", actor=player.id, action="BUY_ITEM", item=item_id, reason="not enough gold")
        return
    if entry.kind == "weapon":
        inv.add_weapon(item_id)
    elif entry.kind == "consumable":
        inv.add_consumable(item_id)
    else:
        inv.add_relic(item_id)
    state.emit("SHOP_PURCHASE", npc=npc_id, item=item_id, kind=entry.kind, price=entry.price,
               gold=inv.gold, position=player.position.to_dict())


def transfer_weapon(state, weapon_id: str, *, to_twin: bool) -> None:
    twin, player = state.twin, state.player
    action = "TWIN_EQUIP" if to_twin else "TWIN_REQUEST"
    source, dest = (player.inventory, twin.inventory) if to_twin else (twin.inventory, player.inventory)
    reason = ""
    if not twin.available:
        reason = "twin unavailable"
    elif to_twin and weapon_id in dest.weapons:
        dest.equip(weapon_id)
        state.emit("WEAPON_CHANGED", actor=twin.id, weapon=weapon_id, position=twin.position.to_dict())
        return
    elif weapon_id not in source.weapons:
        reason = "not owned"
    elif weapon_id in dest.weapons:
        reason = "already owned"
    if reason:
        state.emit("ACTION_REJECTED", actor=player.id, action=action, weapon=weapon_id, reason=reason)
        return
    source.remove_weapon(weapon_id)
    dest.add_weapon(weapon_id)
    if to_twin:
        dest.equip(weapon_id)
    state.emit("TWIN_ITEM_GIVEN", weapon=weapon_id, to=twin.id if to_twin else player.id,
               twinWeapon=twin.inventory.equipped_weapon, position=twin.position.to_dict())


def call_twin(state, executor) -> None:
    if not state.twin.available:
        state.emit("ACTION_REJECTED", actor=state.player.id, action="TWIN_CALL", reason="twin unavailable")
        return
    state.twin.call_remaining = 3.0
    executor.on_intent(state, TwinIntent("FOLLOW", confidence=1.0, reason="called by player"))
    state.emit("TWIN_CALLED", position=state.twin.position.to_dict(), duration=3.0)


def restore_twin(state, campaign) -> None:
    if "twin_taken" not in campaign.flags:
        return
    state.twin.awaken(state.room.clamp(state.player.position, state.twin.radius), campaign.twin_name)
    state.twin.position = state.room.resolve_decor_collision(
        state.room.clamp(state.twin.position, state.twin.radius), state.twin.radius)
    campaign.flags.discard("twin_taken")
    campaign.flags.add("twin_restored")
    state.emit("TWIN_REVIVED", position=state.twin.position.to_dict(), restored=True, name=campaign.twin_name)


def shard_rush(state) -> bool:
    """Steer the twin at the Warden's shard, overriding whatever it wanted.

    Scripted on purpose. The twin's ordinary behaviour comes from a utility
    controller that scores an observation and never touches game state, and
    this is not a decision the twin makes -- it is the story reaching in and
    moving it. Teaching the controller to want the shard would mean plumbing a
    one-off story object through the observation, the traits and the learned
    style, and would leave the twin faintly interested in shards forever after.

    Returns True when it took the tick, so the caller skips the controller.
    """
    twin = state.twin
    if not twin.available or twin.corrupted:
        return False
    shard = next((p for p in state.pickups if p.active and p.kind == "mirror_shard"), None)
    if shard is None:
        return False
    twin.intent = TwinIntent("EXPLORE", position=shard.position.copy(), confidence=1.0,
                             reason="the shard")
    return True


def upgrade_weapon(state, npc_id: str, weapon_id: str) -> None:
    """Have a smith work a weapon up a tier.

    Only a weaponsmith, and only one you are standing next to -- the same rule
    buying uses, and for the same reason: the server decides, and a command that
    could be sent from across the map would make the shop a menu.
    """
    player = state.player
    npc = next((n for n in state.room.npcs if n.id == npc_id), None)
    if npc is None or npc.definition.role != "weaponsmith":
        state.emit("ACTION_REJECTED", actor=player.id, action="UPGRADE_WEAPON",
                   reason="no smith here")
        return
    if (Vec2(npc.x, npc.y) - player.position).length() > TALK_RADIUS + player.radius:
        state.emit("ACTION_REJECTED", actor=player.id, action="UPGRADE_WEAPON",
                   reason="too far")
        return
    before = player.inventory.tier(weapon_id)
    ok, reason = player.inventory.upgrade(weapon_id)
    if not ok:
        state.emit("ACTION_REJECTED", actor=player.id, action="UPGRADE_WEAPON",
                   weapon=weapon_id, reason=reason)
        return
    from mirrorbound.game.combat.weapons import get_weapon

    weapon = get_weapon(weapon_id)
    tier = player.inventory.tier(weapon_id)
    state.emit("WEAPON_UPGRADED", npc=npc_id, weapon=weapon_id, name=weapon.name,
               tier=tier, was=before, gold=player.inventory.gold,
               perk=weapon.perk_name if player.inventory.has_perk(weapon_id) else "",
               position=player.position.to_dict())


# --- v1.2: ore, and the two places it is spent ---------------------------------


def mine_vein(state, vein_id: str = "") -> None:
    """Take a swing at a vein.

    One swing, one unit, and the swing is not free: it holds the player still
    for `MINE_TIME` with no way to cancel out of it except being hit. That is the
    cost the whole system is priced against — mining in the open, in a region
    with wilderness in it, is a decision about whether you have time.

    `vein_id` is what the client believes it is pointing at; the server resolves
    the nearest vein in reach and *refuses* if the two disagree, rather than
    quietly mining a different rock. Silently substituting a target is how a
    player ends up with ore they did not choose.
    """
    player = state.player
    if player.state in ("dead", "dash", "drink", "channel"):
        state.emit("ACTION_REJECTED", actor=player.id, action="MINE", reason="busy")
        return
    vein = state.room.vein_at(player.position, player.radius)
    if vein is None:
        state.emit("ACTION_REJECTED", actor=player.id, action="MINE", reason="nothing to mine")
        return
    if vein_id and vein.id != vein_id:
        state.emit("ACTION_REJECTED", actor=player.id, action="MINE", vein=vein_id,
                   reason="not that one")
        return
    vein.remaining -= 1
    player.inventory.add_material(vein.material)
    material = MATERIALS[vein.material]
    # The pick holds you still. Reusing the drink state rather than adding a
    # sixth player state: it already means "committed to something that is not
    # fighting", the client already draws it as a pause, and being hit already
    # interrupts it.
    player.begin_drink("__mining__")
    state.emit("VEIN_WORKED", vein=vein.id, material=vein.material, name=material.name,
               remaining=vein.remaining, total=vein.total,
               carried=player.inventory.material_count(vein.material),
               spent=vein.spent, position=player.position.to_dict(),
               room_id=state.room.id)


def train_attribute(state, npc_id: str, attribute_id: str) -> None:
    """Buy a point in an attribute from a trainer, in ore.

    The point is bought, not spent: this hands over an *unspent* point and the
    player still chooses where it goes. Two steps rather than one because the
    trainer's price depends on how far the attribute has already been raised, and
    collapsing the two would mean paying a Vigour price for a point you then put
    into Focus.
    """
    player = state.player
    npc = next((n for n in state.room.npcs if n.id == npc_id), None)
    if npc is None or npc.definition.role not in TRAINER_ROLES:
        state.emit("ACTION_REJECTED", actor=player.id, action="TRAIN_ATTRIBUTE",
                   reason="nobody here teaches that")
        return
    if (Vec2(npc.x, npc.y) - player.position).length() > TALK_RADIUS + player.radius:
        state.emit("ACTION_REJECTED", actor=player.id, action="TRAIN_ATTRIBUTE", reason="too far")
        return
    definition = ATTRIBUTES.get(attribute_id)
    if definition is None:
        state.emit("ACTION_REJECTED", actor=player.id, action="TRAIN_ATTRIBUTE",
                   attribute=attribute_id, reason="unknown attribute")
        return
    if player.attributes.at_cap(attribute_id):
        state.emit("ACTION_REJECTED", actor=player.id, action="TRAIN_ATTRIBUTE",
                   attribute=attribute_id, reason="already at maximum")
        return
    # Priced off where the attribute is *now*, including points still unspent
    # that are obviously headed here. Reading only spent points would let a
    # player buy ten cheap points and put them all in one place.
    cost = training_cost(definition.ore, player.attributes.get(attribute_id))
    if not player.inventory.spend_materials(cost):
        state.emit("ACTION_REJECTED", actor=player.id, action="TRAIN_ATTRIBUTE",
                   attribute=attribute_id, reason="not enough ore", cost=dict(cost))
        return
    player.attributes.grant(1)
    state.emit("ATTRIBUTE_TRAINED", npc=npc_id, attribute=attribute_id, name=definition.name,
               paid=dict(cost), unspent=player.attributes.unspent,
               position=player.position.to_dict())


def fit_material(state, npc_id: str, weapon_id: str, material_id: str) -> None:
    """Work a material into a weapon at a smith's bench."""
    player = state.player
    npc = next((n for n in state.room.npcs if n.id == npc_id), None)
    if npc is None or npc.definition.role != "weaponsmith":
        state.emit("ACTION_REJECTED", actor=player.id, action="FIT_MATERIAL",
                   reason="no smith here")
        return
    if (Vec2(npc.x, npc.y) - player.position).length() > TALK_RADIUS + player.radius:
        state.emit("ACTION_REJECTED", actor=player.id, action="FIT_MATERIAL", reason="too far")
        return
    ok, reason = player.inventory.fit_material(weapon_id, material_id)
    if not ok:
        state.emit("ACTION_REJECTED", actor=player.id, action="FIT_MATERIAL",
                   weapon=weapon_id, material=material_id, reason=reason)
        return
    from mirrorbound.game.combat.weapons import get_weapon

    weapon = get_weapon(weapon_id)
    state.emit("MATERIAL_FITTED", npc=npc_id, weapon=weapon_id, name=weapon.name,
               material=material_id, materialName=MATERIALS[material_id].name,
               fitted=player.inventory.fittings(weapon_id),
               slots=player.inventory.forge_slots(weapon_id),
               notes=describe_fitting(player.inventory.fittings(weapon_id), weapon.family),
               position=player.position.to_dict())


def strip_weapon(state, npc_id: str, weapon_id: str) -> None:
    """Melt a weapon's fittings out. The ore is gone.

    Nothing is refunded, and the refusal to refund is the point: a bench you can
    undo for free is a menu you scroll until the numbers are biggest, and then the
    choice the forge exists to pose was never posed. What this is for is a player
    who fitted the wrong thing and would rather have the slots back than keep it.
    """
    player = state.player
    npc = next((n for n in state.room.npcs if n.id == npc_id), None)
    if npc is None or npc.definition.role != "weaponsmith":
        state.emit("ACTION_REJECTED", actor=player.id, action="STRIP_WEAPON",
                   reason="no smith here")
        return
    if weapon_id not in player.inventory.weapons:
        state.emit("ACTION_REJECTED", actor=player.id, action="STRIP_WEAPON",
                   weapon=weapon_id, reason="not owned")
        return
    removed = player.inventory.clear_fittings(weapon_id)
    if removed <= 0:
        state.emit("ACTION_REJECTED", actor=player.id, action="STRIP_WEAPON",
                   weapon=weapon_id, reason="nothing fitted")
        return
    state.emit("WEAPON_STRIPPED", npc=npc_id, weapon=weapon_id, removed=removed,
               slots=player.inventory.forge_slots(weapon_id),
               position=player.position.to_dict())
