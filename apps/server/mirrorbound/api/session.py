"""Game session: owns one authoritative simulation and drives it at 60 Hz.

Tick order (each `step`):

    input -> player/twin housekeeping -> combat requests -> movement -> enemy AI
    -> twin decide/execute -> projectile collisions -> loot -> room logic

Everything the client needs to react to (VFX, sounds, HUD toasts) arrives as
events inside the snapshot, drained from the bus each snapshot.
"""

from __future__ import annotations

import asyncio
import logging
import time
import zlib
from typing import Any

from mirrorbound.agent.observation_builder import build_observation
from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.agent.twin import TwinStyleModel, TwinV0Controller
from mirrorbound.contracts.messages import CommandMessage, InputMessage, parse_client_message
from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.clock import SIM_HZ, SNAPSHOT_HZ
from mirrorbound.game.core.events import Event
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator, DungeonRun
from mirrorbound.game.dungeon.room import Room
from mirrorbound.game.enemy_ai.controller import BasicEnemyController
from mirrorbound.game.enemy_ai.mirror import MirrorController
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from mirrorbound.game.inventory import CONSUMABLES
from mirrorbound.game.movement.collision import CollisionSystem
from mirrorbound.game.movement.movement import MovementSystem
from mirrorbound.game.state import GameState
from mirrorbound.game.twin_executor import TwinExecutor
from mirrorbound.replay.recorder import ReplayRecorder

log = logging.getLogger("mirrorbound.session")

# Events the client is interested in (VFX / audio / toasts). Everything else is
# telemetry-only and stays server side.
CLIENT_EVENT_TYPES = {
    "PLAYER_ATTACKED", "PLAYER_ABILITY_CAST", "PLAYER_DASHED", "PLAYER_DODGED", "DAMAGE_DEALT",
    "DAMAGE_TAKEN", "ENEMY_KILLED", "PLAYER_DIED", "PLAYER_RESPAWNED", "ROOM_ENTER", "ROOM_EXIT",
    "ROOM_CLEARED", "ITEM_PICKUP", "WEAPON_CHANGED", "SKILL_UNLOCKED", "LEVEL_UP", "ITEM_USED",
    "TWIN_ACTION", "TWIN_OUTCOME", "TWIN_ATTACKED", "TWIN_DAMAGED", "TWIN_DOWNED", "TWIN_REVIVED",
    "ENEMY_ATTACKED", "ENEMY_SPAWNED", "PROJECTILE_HIT", "PROJECTILE_EXPIRED", "BOSS_COUNTER",
    "BOSS_NOVA_CHARGE", "BOSS_NOVA", "BOSS_DEFEATED", "RUN_COMPLETE", "ACTION_REJECTED", "PLAYER_HEALED",
    "TARGET_CHANGE",
}

# Spatial heatmap cell size in world units. Rooms are 1280-1600 wide, so 64 gives
# a 20x15-ish grid: coarse enough to find "the spot", fine enough to draw.
SPATIAL_CELL = 64.0


def seed_from_session(session_id: str) -> int:
    """Stable across processes (AGENTS.md forbids `hash()` for this)."""
    return zlib.crc32(session_id.encode()) % (2**31)


class GameSession:
    """Manages a single game session."""

    def __init__(self, session_id: str, seed: int | None = None, record: bool = True, room_count: int = 7):
        self.session_id = session_id
        self.running = True
        self.seed = seed if seed is not None else seed_from_session(session_id)
        self.room_count = room_count
        self.record = record
        self.recorder = ReplayRecorder(session_id, self.seed, enabled=record)
        self.pending_input: PlayerInput | None = None
        self.pending_commands: list[CommandMessage] = []
        self.last_snapshot_time = 0.0
        self.snapshot_interval = 1.0 / SNAPSHOT_HZ
        self.snapshots_sent = 0
        self.room_dirty = True
        self.last_error: str | None = None
        self._build_world()

    # ------------------------------------------------------------- world setup

    def _build_world(self) -> None:
        self.state = GameState(seed=self.seed)
        rng = DeterministicRNG(self.seed)
        self.dungeon: DungeonRun = DungeonGenerator(rng).generate(room_count=self.room_count)
        self.state.dungeon = self.dungeon

        self.movement = MovementSystem(self.state.bus)
        self.combat = CombatSystem(self.state.bus, self.state.rng)
        self.collision = CollisionSystem(self.state.bus, self.combat)
        self.enemy_controller = BasicEnemyController(self.state.rng)
        self.mirror_controller = MirrorController(self.state.rng)

        self.style = TwinStyleModel()
        self.twin_controller = TwinV0Controller(self.style)
        self.state.twin.set_controller(self.twin_controller)
        self.twin_executor = TwinExecutor()
        self._ticks_since_decision = 999

        self.pipeline = PlayerModelPipeline(spatial_cell_size=SPATIAL_CELL)
        self.pipeline.attach(self.state.bus)
        self.state.bus.subscribe_all(self.style.observe)
        self.state.bus.subscribe("PLAYER_ATTACKED", lambda e: self.mirror_controller.note_player_attack(e.tick))
        self.state.bus.subscribe("PLAYER_ABILITY_CAST", lambda e: self.mirror_controller.note_player_attack(e.tick))
        self._last_player_action: str | None = None
        self.state.bus.subscribe_all(self._track_player_action)

        self._enter_room(self.dungeon.rooms[0], from_side=None)

    def _track_player_action(self, event: Event) -> None:
        if event.type == "PLAYER_ATTACKED":
            self._last_player_action = str(event.data.get("action_token", "ATTACK"))
        elif event.type == "PLAYER_ABILITY_CAST":
            self._last_player_action = str(event.data.get("ability"))
        elif event.type == "PLAYER_DASHED":
            self._last_player_action = "DASH"

    def _enter_room(self, room: Room, from_side: str | None) -> None:
        state = self.state
        if state.room is not None and state.room is not room and state.room.index != room.index:
            state.emit("ROOM_EXIT", room_id=state.room.id, room_type=state.room.room_type,
                       position=state.player.position.to_dict())
        state.room = room
        state.enemies = []
        state.projectiles = []
        state.pickups = []
        self.dungeon.current_room_index = room.index
        spawn = room.entry_point_from(from_side) if from_side else room.player_spawn
        spawn = room.clamp(spawn, state.player.radius)
        state.player.position = spawn.copy()
        state.player.velocity = Vec2()
        state.player.knockback = Vec2()
        state.twin.position = room.clamp(spawn + Vec2(-40, 22), state.twin.radius)
        state.twin.velocity = Vec2()
        first_visit = not room.visited
        room.visited = True
        if first_visit:
            state.spawn_enemies_for_room(room)
            state.spawn_room_treasure(room)
            if not room.enemy_spawns:
                room.cleared = True
                room.unlock_doors()
        elif room.cleared:
            room.unlock_doors()
        state.transition_timer = 0.6
        self.room_dirty = True
        state.emit("ROOM_ENTER", room_id=room.id, room_index=room.index, room_type=room.room_type,
                   name=room.name, biome=room.biome, position=spawn.to_dict(), enemies=len(state.enemies),
                   first_visit=first_visit)

    # ---------------------------------------------------------------- messages

    def handle_input(self, message: dict) -> None:
        """Handle a raw JSON message from the client."""
        parsed = parse_client_message(message)
        if parsed is None:
            return
        self.recorder.record_input(self.state.tick, message)
        if isinstance(parsed, InputMessage):
            inp = PlayerInput(
                move_x=parsed.moveX, move_y=parsed.moveY, attack=parsed.attack, run=parsed.run,
                ability=parsed.ability,
            )
            # Edge-triggered flags must not be lost if two client frames land
            # between two server ticks.
            if self.pending_input is not None:
                inp.attack = inp.attack or self.pending_input.attack
                inp.ability = inp.ability or self.pending_input.ability
            self.pending_input = inp
        else:
            self.pending_commands.append(parsed)

    def _apply_commands(self) -> None:
        state = self.state
        player = state.player
        for cmd in self.pending_commands:
            action = cmd.action
            if action == "PAUSE":
                state.paused = True
            elif action == "RESUME":
                state.paused = False
            elif action == "RESTART":
                self.restart(cmd.seed)
                return
            elif action == "REQUEST_ROOM":
                self.room_dirty = True
            elif action == "EQUIP_WEAPON" and cmd.weaponId:
                if player.inventory.equip(cmd.weaponId):
                    player.combo_step = 0
                    state.emit("WEAPON_CHANGED", actor=player.id, weapon=cmd.weaponId,
                               position=player.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=player.id, action=action, reason="not owned")
            elif action == "TWIN_EQUIP" and cmd.weaponId:
                if cmd.weaponId in player.inventory.weapons or cmd.weaponId in state.twin.inventory.weapons:
                    state.twin.inventory.add_weapon(cmd.weaponId)
                    state.twin.inventory.equip(cmd.weaponId)
                    state.emit("WEAPON_CHANGED", actor=state.twin.id, weapon=cmd.weaponId,
                               position=state.twin.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=state.twin.id, action=action, reason="not owned")
            elif action == "UNLOCK_SKILL" and cmd.skillId:
                ok, reason = player.unlock_skill(cmd.skillId)
                if ok:
                    state.emit("SKILL_UNLOCKED", skill=cmd.skillId, skillPoints=player.skill_points,
                               position=player.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=player.id, action=action, skill=cmd.skillId, reason=reason)
            elif action == "USE_ITEM" and cmd.itemId:
                self._use_item(cmd.itemId)
            elif action == "SET_ABILITY_SLOT" and cmd.slot and cmd.abilityId:
                if player.inventory.set_slot(cmd.slot, cmd.abilityId):
                    state.emit("ABILITY_SLOT_CHANGED", slot=cmd.slot, ability=cmd.abilityId)
        self.pending_commands.clear()

    def _use_item(self, item_id: str) -> None:
        state, player = self.state, self.state.player
        if item_id not in CONSUMABLES or not player.inventory.take_consumable(item_id):
            state.emit("ACTION_REJECTED", actor=player.id, action="USE_ITEM", item=item_id, reason="none left")
            return
        spec = CONSUMABLES[item_id]
        healed = player.heal(float(spec.get("heal", 0))) if spec.get("heal") else 0.0
        mana = 0.0
        if spec.get("mana"):
            before = player.mana
            player.mana = min(player.max_mana, player.mana + float(spec["mana"]))
            mana = player.mana - before
        state.emit("ITEM_USED", actor=player.id, item=item_id, healed=round(healed, 1), mana=round(mana, 1),
                   position=player.position.to_dict())

    def restart(self, seed: int | None = None) -> None:
        self.recorder.close()
        if seed is not None:
            self.seed = seed
        self.recorder = ReplayRecorder(self.session_id, self.seed, enabled=self.record)
        self.pending_input = None
        self.pending_commands = []
        self._build_world()

    def stop(self) -> None:
        self.running = False
        self.recorder.close()

    # ---------------------------------------------------------------- game loop

    async def run_game_loop(self, manager) -> None:
        """Run the game loop at a fixed timestep."""
        dt = 1.0 / SIM_HZ
        while self.running:
            start = time.perf_counter()
            try:
                self.step(dt)
            except Exception:  # noqa: BLE001 - a crashed tick must not silently kill the loop
                log.exception("tick %s failed", self.state.tick)
                self.last_error = f"tick {self.state.tick} failed; see server log"
            now = time.perf_counter()
            if now - self.last_snapshot_time >= self.snapshot_interval:
                try:
                    await manager.send_message(self.session_id, self.snapshot())
                except Exception:  # noqa: BLE001
                    log.exception("snapshot failed")
                self.last_snapshot_time = now
            elapsed = time.perf_counter() - start
            await asyncio.sleep(max(0.0, dt - elapsed))

    def step(self, dt: float) -> None:
        """Advance the simulation by one tick. Public so tests and replay can drive it."""
        state = self.state
        self._apply_commands()
        if not self.running:
            return
        if state.paused:
            self.pending_input = None
            return

        state.clock.advance()
        state.tick = state.clock.tick
        state.stats.ticks += 1
        if state.transition_timer > 0:
            state.transition_timer = max(0.0, state.transition_timer - dt)

        player = state.player
        inp = self.pending_input or PlayerInput()
        self.pending_input = None

        if state.phase == "dead":
            player.update(dt)
            if player.respawn_timer <= 0:
                self._respawn()
            return
        if state.phase == "victory":
            player.update(dt)
            state.twin.update(dt)
            return

        # 1. player intent
        player.update(dt)
        player.apply_input(dt, inp)
        if inp.attack:
            self.combat.process_player_attack(state)
        if inp.ability:
            self.combat.process_ability(state, inp.ability)

        # 2. movement
        self.movement.update(dt, state)

        # 3. enemies
        for enemy in state.get_active_enemies():
            if enemy.enemy_def.boss:
                self.mirror_controller.player_model = self._player_model_dict()
                self.mirror_controller.update(dt, enemy, state, self.combat)
            else:
                self.enemy_controller.update(dt, enemy, state, self.combat)

        # 4. twin
        self._update_twin(dt)

        # 5. projectiles, loot, status
        self.collision.update(dt, state)
        self.combat.loot.update(dt, state)
        self.combat.update(dt, state)
        state.enemies = [e for e in state.enemies if e.active]

        # 6. room logic
        self._room_logic()
        self.style.advance(state.tick)

    def _update_twin(self, dt: float) -> None:
        state = self.state
        twin = state.twin
        twin.update(dt)
        if twin.downed:
            if twin.downed_timer <= 0:
                twin.revive(state.player.position)
                state.emit("TWIN_REVIVED", position=twin.position.to_dict())
            return
        self._ticks_since_decision += 1
        if self._ticks_since_decision >= twin.decision_interval:
            observation = build_observation(
                state,
                state.pending_events,
                player_model=self._player_model_dict(),
                twin_style=self.style.snapshot(),
                player_last_action=self._last_player_action,
                seconds_since_decision=self._ticks_since_decision / SIM_HZ,
            )
            intent = twin.decide(observation)
            self.twin_executor.on_intent(state, intent)
            self._ticks_since_decision = 0
        self.twin_executor.apply(dt, state, self.combat)

    def _player_model_dict(self) -> dict:
        return self.pipeline.snapshot(top_k=3, spatial_top_n=6).to_json_dict()

    def _room_logic(self) -> None:
        state = self.state
        room = state.room
        if not room.cleared and not state.get_active_enemies() and room.enemy_spawns:
            room.cleared = True
            room.unlock_doors()
            state.stats.rooms_cleared += 1
            heal = state.player.mods.heal_on_clear
            if heal > 0:
                state.player.heal(heal)
            state.emit("ROOM_CLEARED", room_id=room.id, room_type=room.room_type, room_index=room.index,
                       position=state.player.position.to_dict(), healed=heal)
            if room.room_type == "boss" and not state.boss_alive():
                state.phase = "victory"
                state.emit("RUN_COMPLETE", stats=state.stats.to_dict(), seed=self.seed)
                return
            self.room_dirty = True
        # Door transitions.
        if state.transition_timer <= 0 and room.cleared:
            door = room.door_at(state.player.position, state.player.radius)
            if door is not None and not door.locked and door.target_index is not None:
                opposite = {"north": "south", "south": "north", "east": "west", "west": "east"}[door.side]
                self._enter_room(self.dungeon.rooms[door.target_index], from_side=opposite)

    def _respawn(self) -> None:
        state = self.state
        room = state.room
        # Respawn at the room's entrance; enemies left alive stay alive.
        state.player.respawn(room.clamp(room.player_spawn, state.player.radius))
        state.twin.position = room.clamp(state.player.position + Vec2(-40, 22), state.twin.radius)
        if state.twin.downed:
            state.twin.revive(state.player.position)
        state.phase = "playing"
        state.emit("PLAYER_RESPAWNED", position=state.player.position.to_dict(), room_id=room.id)

    # ----------------------------------------------------------------- snapshot

    def snapshot(self) -> dict:
        state = self.state
        events = state.drain_events()
        self.recorder.record_events(events)
        full_room = self.room_dirty or self.snapshots_sent % (SNAPSHOT_HZ * 3) == 0
        snap = state.to_dict(include_room=full_room)
        snap["type"] = "SNAPSHOT"
        snap["roomFull"] = full_room
        snap["events"] = [e.to_json_dict() for e in events if e.type in CLIENT_EVENT_TYPES][-60:]
        snap["playerModel"] = self._player_model_dict()
        snap["playerModel"]["cellSize"] = SPATIAL_CELL
        snap["twinModel"] = self.style.snapshot()
        snap["boss"] = self.mirror_controller.debug() if state.boss_alive() else None
        snap["lastError"] = self.last_error
        self.room_dirty = False
        self.snapshots_sent += 1
        return snap
