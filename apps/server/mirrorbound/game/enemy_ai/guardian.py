"""Regional bosses: the milestones on the way to the Mirror.

§12 asks for two or three major encounters before the final confrontation, each
of which belongs to a region, has a combat identity of its own, telegraphs what
it is about to do, changes as it is worn down, and is built from the art the
game already has. It is equally clear about what they must not be: the Twin →
Mirror ending stays exactly where it is, and nothing here is allowed to dilute
it.

So these are deliberately *not* Mirrors. The Mirror is the only thing in the
game that reads your behaviour model and counters it — that is its whole premise
and sharing it would spend the ending early. A regional boss is the other kind
of hard: a fixed, legible, learnable pattern that changes shape twice while you
are learning it. You beat the Mirror by being unpredictable; you beat these by
paying attention.

One controller drives all three, because the difference between them is their
*kit* rather than their code: three phases of data on the `EnemyDef`, and a
cadence that will not let two specials land on top of each other.
"""

from __future__ import annotations

from mirrorbound.game.combat.abilities import get_ability
from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.enemy_ai.controller import BasicEnemyController
from mirrorbound.game.entities.enemy import BossPhase, Enemy
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.state import GameState

#: The shortest gap between two specials, whatever their own cooldowns allow.
#:
#: The same reasoning as the Mirror's `SPELL_CADENCE`: a boss holding four
#: abilities could otherwise chain them with nothing in between, and a fight
#: that is only specials is as flat as one with none. Cast, then fight for a
#: couple of seconds, then consider casting again.
CADENCE = 2.6

#: How close a special that goes off around the caster wants its target before
#: it is worth spending. Slightly inside the real radius, so it commits only
#: when it will land.
CLOSE_ENOUGH = 0.85


class GuardianController:
    """Drives a phased regional boss.

    Movement and the basic attack are the ordinary archetype state machine --
    these creatures fight like what they are, and a warden that stopped moving
    like a tank would stop reading as one. What this adds on top is the phase
    ladder and the kit.
    """

    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("guardian")
        self.basic = BasicEnemyController(rng)
        #: Phase index per boss id, so two in one room never share a ladder.
        self.phase: dict[str, int] = {}
        self.cadence: dict[str, float] = {}
        #: A special that has been announced and is still winding up, per boss.
        self.charging: dict[str, tuple[str, float]] = {}

    def update(self, dt: float, enemy: Enemy, state: GameState, combat: CombatSystem) -> None:
        if not enemy.active:
            return
        phases = enemy.enemy_def.phases
        if not phases:
            self.basic.update(dt, enemy, state, combat)
            return

        for ability_id, left in list(enemy.ability_timers.items()):
            enemy.ability_timers[ability_id] = left - dt
        self.cadence[enemy.id] = self.cadence.get(enemy.id, 0.0) - dt

        phase = self._advance_phase(enemy, state, phases)
        target = state.entity_by_id(enemy.target_id) or state.player

        # A special that is already winding up owns the boss until it lands.
        if self._resolve_charge(dt, enemy, state, combat, target):
            return

        if not self._cast(enemy, state, combat, phase, target):
            self.basic.update(dt, enemy, state, combat)
            # Escalating speed, applied to the movement the archetype produced
            # rather than to the def, so nothing about the creature's own
            # numbers is mutated and two bosses never disagree about a shared
            # archetype.
            if phase.speed_mult != 1.0 and not enemy.velocity.is_zero():
                enemy.velocity = enemy.velocity * phase.speed_mult

    # --- phases ----------------------------------------------------------------

    def _advance_phase(self, enemy: Enemy, state: GameState, phases: tuple[BossPhase, ...]) -> BossPhase:
        fraction = enemy.health / max(1.0, enemy.max_health)
        want = 0
        for index, phase in enumerate(phases):
            if fraction <= phase.below:
                want = index
        # Never backwards: a boss that drops a phase is a boss whose tells stop
        # meaning anything.
        current = self.phase.get(enemy.id, 0)
        if want <= current:
            return phases[current]

        self.phase[enemy.id] = want
        phase = phases[want]
        for enemy_type, count in phase.summons:
            self._call_help(enemy, state, enemy_type, count)
        # A phase change is a moment to read, so it buys the player the cadence
        # gap rather than opening with a special.
        self.cadence[enemy.id] = CADENCE
        state.emit("BOSS_PHASE", boss=enemy.id, enemy_type=enemy.enemy_def.id,
                   phase=want + 1, name=phase.name, tell=phase.tell,
                   health=round(fraction, 2), position=enemy.position.to_dict())
        return phase

    def _call_help(self, enemy: Enemy, state: GameState, enemy_type: str, count: int) -> None:
        """Summon around the boss, in a ring, away from the player.

        Placed deterministically rather than rolled: the ring starts opposite
        the player so nothing spawns on top of them, which would be damage
        nobody could have avoided.
        """
        away = (enemy.position - state.player.position)
        away = away.normalized() if not away.is_zero() else Vec2(0.0, -1.0)
        for i in range(count):
            # Spread the ring either side of "away", widest at the ends.
            offset = (i - (count - 1) / 2) * 0.7
            direction = Vec2(
                away.x * _cos(offset) - away.y * _sin(offset),
                away.x * _sin(offset) + away.y * _cos(offset),
            )
            where = state.room.clamp(enemy.position + direction * 120.0, 30.0)
            state.spawn_enemy(enemy_type, where)

    # --- the kit ------------------------------------------------------------------

    def _resolve_charge(self, dt: float, enemy: Enemy, state: GameState,
                        combat: CombatSystem, target) -> bool:
        """Run down a wind-up and land the special at the end of it.

        **The telegraph is the encounter.** Without this the controller called
        `resolve_enemy_ability` the instant it chose a special, so an ability
        whose whole design is a 1.1-second tell -- the Warden's slam, a
        two-hundred-unit ring you are meant to see coming and leave -- went off
        with no warning at all. The data said it was telegraphed and nothing
        honoured it, which is §20's "artificial difficulty" exactly: unavoidable
        damage dressed as a mechanic.

        The boss holds still while it charges, the way the player does when
        channelling, so the wind-up reads as a commitment rather than as
        something it does while chasing you.
        """
        pending = self.charging.get(enemy.id)
        if pending is None:
            return False
        ability_id, left = pending
        left -= dt
        enemy.velocity = Vec2()
        if left > 0:
            self.charging[enemy.id] = (ability_id, left)
            return True
        del self.charging[enemy.id]
        ability = get_ability(ability_id)
        enemy.face(target.position - enemy.position)
        combat.resolve_enemy_ability(state, enemy, ability, target)
        state.emit("ENEMY_ABILITY_CAST", enemy_id=enemy.id, enemy_type=enemy.enemy_def.id,
                   ability=ability_id, position=enemy.position.to_dict())
        return True

    def _begin(self, enemy: Enemy, state: GameState, combat: CombatSystem,
               ability, target) -> None:
        """Announce a special, then either charge it or land it now."""
        enemy.face(target.position - enemy.position)
        enemy.ability_timers[ability.id] = ability.cooldown
        self.cadence[enemy.id] = CADENCE
        # Stop on the spot the moment it commits, not on the next tick: the
        # wind-up is a promise about where the thing will land, and a boss that
        # slides a stride further while charging breaks it.
        enemy.velocity = Vec2()
        if ability.cast_time <= 0:
            combat.resolve_enemy_ability(state, enemy, ability, target)
            state.emit("ENEMY_ABILITY_CAST", enemy_id=enemy.id, enemy_type=enemy.enemy_def.id,
                       ability=ability.id, position=enemy.position.to_dict())
            return
        self.charging[enemy.id] = (ability.id, ability.cast_time)
        # The ring the client already draws for the Mirror's nova is the
        # fairest thing in that fight; anything that goes off around the caster
        # gets the same one, and everything else announces generically.
        if ability.type.value == "nova":
            state.emit("BOSS_NOVA_CHARGE", enemy_id=enemy.id, position=enemy.position.to_dict(),
                       radius=ability.area, duration=ability.cast_time)
        else:
            state.emit("ENEMY_ABILITY_CHARGE", enemy_id=enemy.id, ability_id=ability.id,
                       position=enemy.position.to_dict(), radius=ability.area,
                       duration=ability.cast_time)

    def _cast(self, enemy: Enemy, state: GameState, combat: CombatSystem,
              phase: BossPhase, target) -> bool:
        """Spend one special, if one is ready and worth spending."""
        if self.cadence.get(enemy.id, 0.0) > 0 or not phase.abilities:
            return False
        if enemy.is_winding_up or enemy.stagger > 0:
            return False

        distance = (target.position - enemy.position).length()
        for ability_id in phase.abilities:
            if enemy.ability_timers.get(ability_id, 0.0) > 0:
                continue
            ability = get_ability(ability_id)
            if not self._worth_it(ability, distance):
                continue
            self._begin(enemy, state, combat, ability, target)
            return True
        return False

    @staticmethod
    def _worth_it(ability, distance: float) -> bool:
        """Whether this special will actually reach.

        The most common way a boss with abilities looks stupid is throwing a
        nova at someone standing outside it.
        """
        kind = ability.type.value
        if kind in ("nova", "cone"):
            return distance <= max(ability.area, ability.range) * CLOSE_ENOUGH
        if kind in ("projectile", "beam"):
            return distance <= ability.range
        return True

    def debug(self, enemy_id: str) -> dict:
        return {"phase": self.phase.get(enemy_id, 0) + 1,
                "cadence": round(max(0.0, self.cadence.get(enemy_id, 0.0)), 2)}


def _cos(a: float) -> float:
    import math
    return math.cos(a)


def _sin(a: float) -> float:
    import math
    return math.sin(a)


__all__ = ["GuardianController", "CADENCE"]
