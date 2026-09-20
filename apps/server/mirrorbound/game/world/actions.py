"""Authoritative vendor and companion requests, independent of transport."""
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from mirrorbound.game.world.npc import TALK_RADIUS


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
