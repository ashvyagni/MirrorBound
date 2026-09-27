"""Executes validated `TwinIntent`s and reports their outcomes.

The controller says *what* it wants (INTERCEPT enemy_12 at (x, y)); this turns
that into velocity and attack calls, checks that the target still exists, and
publishes TWIN_ACTION when the intent changes and TWIN_OUTCOME when it ends,
so the twin's style model can learn from what actually happened.
"""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.entities.enemy import Enemy
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from mirrorbound.game.inventory import CONSUMABLES
from mirrorbound.game.progression.survival import MAX_HUNGER
from mirrorbound.game.state import GameState
from mirrorbound.game.movement.navigation import Navigator
from mirrorbound.game.world.npc import TALK_RADIUS

OFFENSIVE = {"ATTACK", "ASSIST", "INTERCEPT", "PROTECT", "DISTRACT", "FLANK", "COMBO"}
#: The intents the twin carries out with its hands rather than its feet.
SELF_CARE = {"HEAL", "EAT"}
MAX_INTENT_SECONDS = 4.0
MIN_OUTCOME_SECONDS = 0.4


@dataclass
class _Open:
    intent: TwinIntent
    started_tick: int
    dealt_at_start: float
    taken_at_start: float
    kills_at_start: int
    #: True once this intent's errand actually happened -- the drink landed, the
    #: meal went down, the purchase went through. It is both the success test for
    #: HEAL/EAT/SHOP and the guard that stops SHOP buying once per tick for the
    #: whole six ticks between decisions.
    resolved: bool = False


class TwinExecutor:
    def __init__(self) -> None:
        self._open: _Open | None = None
        self.navigator = Navigator()

    # --- intent lifecycle -------------------------------------------------------

    def on_intent(self, state: GameState, intent: TwinIntent) -> None:
        current = self._open
        changed = (
            current is None
            or current.intent.intent_type != intent.intent_type
            or current.intent.target_id != intent.target_id
        )
        expired = current is not None and (state.tick - current.started_tick) / 60.0 > MAX_INTENT_SECONDS
        if changed or expired:
            if current is not None:
                self._close(state, current, reason="changed" if changed else "expired")
            self._open = _Open(intent, state.tick, state.twin.damage_dealt, state.twin.damage_taken, state.twin.kills)
            state.emit(
                "TWIN_ACTION",
                intent=intent.intent_type,
                target=intent.target_id,
                position=intent.position.to_dict() if intent.position else None,
                confidence=round(intent.confidence, 3),
                utilities=dict(intent.utilities),
                reason=intent.reason,
                twin_position=state.twin.position.to_dict(),
            )
        state.twin.remember(intent)
        self._apply_weapon_switch(state, intent)

    def _apply_weapon_switch(self, state: GameState, intent: TwinIntent) -> None:
        """The controller only ever suggests a weapon via `desired_weapon` --
        this validates it against what the twin actually owns before ever
        calling equip(), same intent -> validate -> execute shape as every
        other intent. A request for a weapon not in inventory.weapons (a
        stale suggestion, or a controller bug) is silently ignored rather
        than trusted.
        """
        weapon_id = intent.desired_weapon
        inventory = state.twin.inventory
        if (
            weapon_id
            and weapon_id != inventory.equipped_weapon
            and weapon_id in inventory.weapons
        ):
            inventory.equip(weapon_id)
            state.emit("TWIN_WEAPON_SWITCH", weapon=weapon_id)

    def _close(self, state: GameState, opened: _Open, reason: str) -> None:
        twin = state.twin
        duration = (state.tick - opened.started_tick) / 60.0
        dealt = twin.damage_dealt - opened.dealt_at_start
        taken = twin.damage_taken - opened.taken_at_start
        kills = twin.kills - opened.kills_at_start
        if duration < MIN_OUTCOME_SECONDS and dealt == 0 and taken == 0:
            return
        kind = opened.intent.intent_type
        if kind in OFFENSIVE:
            success = dealt > 0 and taken <= max(dealt * 0.9, 8.0)
        elif kind in SELF_CARE or kind == "SHOP":
            # An errand succeeds by being completed, not by being quiet. A drink
            # that landed while something was hitting the twin still worked -- but
            # `damage_taken` rides along on the event, so the style model can read
            # "it drank too late" out of a success that cost it.
            success = opened.resolved and taken <= max(4.0, dealt)
        elif kind == "RETREAT":
            success = taken <= 2.0
        else:
            success = taken <= 2.0
        state.emit(
            "TWIN_OUTCOME",
            intent=kind,
            target=opened.intent.target_id,
            success=success,
            damage_dealt=round(dealt, 1),
            damage_taken=round(taken, 1),
            kills=kills,
            duration=round(duration, 2),
            end_reason=reason,
            confidence=round(opened.intent.confidence, 3),
            # The two numbers self-care is learned from: what it drank at, and
            # what it still has. See agent/twin/style.py.
            health_fraction=round(twin.health / twin.max_health if twin.max_health else 0.0, 3),
            potions=twin.inventory.consumables.get("health_potion", 0),
        )

    # --- per tick ------------------------------------------------------------------

    def apply(self, dt: float, state: GameState, combat: CombatSystem) -> None:
        twin = state.twin
        intent = twin.intent
        if not twin.available:
            twin.velocity = Vec2()
            return

        # A use that ran its course lands here, not in the entity: the entity holds
        # the timer, the game decides what a finished drink is worth. Same split as
        # the player's, whose `finished_drink` the session resolves.
        self._resolve_use(state)

        # Committed. Whatever the controller has since decided, a twin with a flask
        # at its lips stands still until the flask is empty or something spills it
        # -- which is why the controller never has to reason about being busy.
        if twin.busy:
            twin.velocity = Vec2()
            return

        target = state.entity_by_id(intent.target_id)
        target_enemy = target if isinstance(target, Enemy) and target.active else None
        kind = intent.intent_type

        if kind in SELF_CARE:
            if not self._begin_use(state, intent.item_id or ""):
                # Nothing to drink, or nothing a drink would fix: don't stand there
                # about it, fall back to the one intent that is always valid.
                self._move_to(dt, state, self._follow_point(state))
            return
        if kind == "SHOP":
            self._shop(dt, state, intent)
            return

        if kind in OFFENSIVE and target_enemy is not None:
            self._engage(dt, state, combat, target_enemy, hold_position=intent.position if kind in ("FLANK", "PROTECT", "INTERCEPT") else None)
        elif kind in OFFENSIVE:
            # Target vanished: drift back to the player until the next decision.
            self._move_to(dt, state, self._follow_point(state))
        elif kind in ("FOLLOW", "REPOSITION", "EXPLORE", "RETREAT"):
            goal = intent.position or self._follow_point(state)
            self._move_to(dt, state, goal)
            if kind == "RETREAT" and target_enemy is None:
                nearest = state.nearest_enemy(twin.position, 260)
                if nearest is not None and not twin.weapon.is_melee and twin.can_attack():
                    # Cover fire while backing off.
                    combat.process_twin_attack(state, nearest)
        else:
            self._move_to(dt, state, self._follow_point(state))

    # --- looking after itself ---------------------------------------------------------
    #
    # Three small methods for the whole of "the twin keeps itself alive": start a
    # use, finish a use, and pay for another one. Each is the twin's own version of
    # something the session does for the player, deliberately written to the same
    # shape -- nothing is consumed when a use *starts*, the stock is re-checked
    # when it *ends*, and a purchase is refused before the gold moves, never after.

    def _begin_use(self, state: GameState, item_id: str) -> bool:
        """Put a flask or a meal to the twin's mouth. False if it cannot."""
        twin = state.twin
        spec = CONSUMABLES.get(item_id)
        if spec is None or not twin.can_use(item_id):
            return False
        # Drinking at full or eating when full is a wasted item, not an action --
        # the same refusal `Player.can_drink` makes.
        if spec.get("heal") and twin.health >= twin.max_health:
            return False
        if spec.get("nourish") and twin.hunger.value >= MAX_HUNGER:
            return False
        twin.begin_use(item_id)
        state.emit("TWIN_ITEM_USE_STARTED", actor=twin.id, item=item_id,
                   duration=round(twin.busy_timer, 2), position=twin.position.to_dict())
        return True

    def _resolve_use(self, state: GameState) -> None:
        """Apply a use whose timer has run out. An interrupted one costs nothing."""
        twin = state.twin
        if not twin.busy_with or twin.busy:
            return
        item_id = twin.finish_use()
        spec = CONSUMABLES.get(item_id)
        # Re-checked here rather than trusted from when the use began: a whole
        # 0.4s of simulation has happened since, and the player's potion may have
        # been the one it was reaching for.
        if spec is None or not twin.inventory.take_consumable(item_id):
            return
        healed = twin.heal(float(spec["heal"])) if spec.get("heal") else 0.0
        fed = twin.hunger.eat(float(spec["nourish"])) if spec.get("nourish") else 0.0
        if self._open is not None:
            self._open.resolved = True
        state.emit("TWIN_ITEM_USED", actor=twin.id, item=item_id, healed=round(healed, 1),
                   fed=round(fed, 1), health=round(twin.health, 1), hunger=twin.hunger.to_dict(),
                   position=twin.position.to_dict())

    def _shop(self, dt: float, state: GameState, intent: TwinIntent) -> None:
        """Walk to the merchant the controller picked, and buy once there."""
        twin = state.twin
        npc = next((n for n in state.room.npcs if n.id == intent.target_id), None)
        if npc is None or not intent.item_id:
            self._move_to(dt, state, self._follow_point(state))
            return
        stall = Vec2(npc.x, npc.y)
        if (stall - twin.position).length() > TALK_RADIUS * 0.7:
            self._move_to(dt, state, stall)
            return
        twin.velocity = Vec2()
        twin.face(stall - twin.position)
        # Once per opened intent. Without this the twin would buy on every one of
        # the six ticks between decisions and empty its purse at the first stall.
        if self._open is not None and not self._open.resolved:
            self._buy(state, npc, intent.item_id)

    def _buy(self, state: GameState, npc, item_id: str) -> bool:
        twin = state.twin
        entry = next((e for e in npc.definition.stock
                      if e.item_id == item_id and e.kind == "consumable"), None)
        if entry is None:
            return False
        # Refused before the gold moves, never after -- and out of the twin's own
        # purse, which is the quarter-share of what it picked up (see loot.py).
        if not twin.inventory.spend_gold(entry.price):
            return False
        twin.inventory.add_consumable(item_id)
        if self._open is not None:
            self._open.resolved = True
        state.emit("TWIN_PURCHASE", actor=twin.id, npc=npc.id, item=item_id, price=entry.price,
                   gold=twin.inventory.gold,
                   held=twin.inventory.consumables.get(item_id, 0),
                   position=twin.position.to_dict())
        return True

    # --- movement primitives ----------------------------------------------------------

    @staticmethod
    def _follow_point(state: GameState) -> Vec2:
        player = state.player
        return player.position - player.facing * 62 + player.facing.perpendicular() * 26

    def _move_to(self, dt: float, state: GameState, goal: Vec2) -> None:
        twin = state.twin
        goal = state.room.clamp(goal, twin.radius)
        diff = goal - twin.position
        dist = diff.length()
        if dist < 10:
            twin.velocity = Vec2()
            return
        speed = min(twin.speed * twin.slow_factor, dist / max(dt, 1e-3))
        twin.velocity = self.navigator.velocity(state.room, twin, goal, speed)
        twin.face(diff)

    def _engage(self, dt: float, state: GameState, combat: CombatSystem, target: Enemy,
                hold_position: Vec2 | None) -> None:
        twin = state.twin
        weapon = twin.weapon
        to_target = target.position - twin.position
        dist = to_target.length()
        direction = to_target.normalized() if dist > 0 else twin.facing

        if weapon.is_melee:
            reach = weapon.range * 0.85 + target.radius
            if hold_position is not None and (hold_position - twin.position).length() > 18 and dist > reach:
                self._move_to(dt, state, hold_position)
            elif dist > reach:
                self._move_to(dt, state, target.position - direction * (reach * 0.8))
            else:
                twin.velocity = Vec2()
            twin.face(direction)
            if dist <= weapon.range + target.radius and twin.can_attack():
                combat.process_twin_attack(state, target)
            return

        hold = weapon.range * 0.55
        if hold_position is not None and (hold_position - twin.position).length() > 18:
            self._move_to(dt, state, hold_position)
        elif dist > hold + 40:
            self._move_to(dt, state, target.position - direction * hold)
        elif dist < hold - 70:
            back = state.room.clamp(twin.position - direction * 80, twin.radius)
            self._move_to(dt, state, back)
        else:
            # Slow strafe keeps a ranged twin from being a static turret.
            side = 1 if (state.tick // 90) % 2 == 0 else -1
            twin.velocity = direction.perpendicular() * (twin.speed * 0.25 * side)
        twin.face(direction)
        if dist <= weapon.range and twin.can_attack():
            combat.process_twin_attack(state, target)
