"""Game session management."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from mirrorbound.agent.basic_controller import BasicFollowController
from mirrorbound.agent.observation_builder import build_observation
from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.clock import SIM_HZ, SNAPSHOT_HZ
from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.core.ids import IdAllocator
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator
from mirrorbound.game.enemy_ai.controller import BasicEnemyController
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from mirrorbound.game.movement.collision import CollisionSystem
from mirrorbound.game.movement.movement import MovementSystem
from mirrorbound.game.state import GameState
from mirrorbound.agent.pipeline import PlayerModelPipeline


class GameSession:
    """Manages a single game session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.running = True

        # Initialize game state
        seed = hash(session_id) % (2**31)
        self.state = GameState(seed=seed)

        # Generate dungeon
        rng = DeterministicRNG(seed)
        generator = DungeonGenerator(rng)
        dungeon = generator.generate(room_count=5)

        # Set initial room
        self.state.room = dungeon.rooms[0]
        self.dungeon = dungeon

        # Spawn enemies in first room
        self.state.spawn_enemies(3)

        # Initialize systems
        self.movement = MovementSystem(self.state.bus)
        self.collision = CollisionSystem(self.state.bus)
        self.combat = CombatSystem(self.state.bus, self.state.rng)
        self.enemy_controller = BasicEnemyController()

        # Set up twin controller
        self.state.twin.set_controller(BasicFollowController())

        # Set up telemetry pipeline
        self.pipeline = PlayerModelPipeline()
        self.pipeline.attach(self.state.bus)

        # Input buffer
        self.pending_input: PlayerInput | None = None

        # Track snapshot timing
        self.last_snapshot_time = 0.0
        self.snapshot_interval = 1.0 / SNAPSHOT_HZ

    def handle_input(self, message: dict) -> None:
        """Handle input from client."""
        if message.get("type") == "INPUT":
            inp = PlayerInput(
                move_x=message.get("moveX", 0.0),
                move_y=message.get("moveY", 0.0),
                attack=message.get("attack", False),
                run=message.get("run", False),
                aim_angle=message.get("aimAngle", 0.0),
                ability=message.get("ability"),
            )
            self.pending_input = inp

    def stop(self) -> None:
        """Stop the game loop."""
        self.running = False

    async def run_game_loop(self, manager) -> None:
        """Run the game loop at fixed timestep."""
        dt = 1.0 / SIM_HZ
        tick_duration = 1.0 / SIM_HZ

        while self.running:
            start_time = time.time()

            # Process input
            if self.pending_input:
                self.state.player.apply_input(dt, self.pending_input)

                # Handle attack
                if self.pending_input.attack:
                    self.combat.process_player_attack(
                        self.state,
                        self.pending_input.aim_angle,
                    )

                # Handle ability
                if self.pending_input.ability:
                    self.combat.process_ability(
                        self.state,
                        self.pending_input.ability,
                    )

                self.pending_input = None

            # Update game state
            self._update(dt)

            # Send snapshot at snapshot rate
            current_time = time.time()
            if current_time - self.last_snapshot_time >= self.snapshot_interval:
                await self._send_snapshot(manager)
                self.last_snapshot_time = current_time

            # Sleep to maintain tick rate
            elapsed = time.time() - start_time
            sleep_time = max(0, tick_duration - elapsed)
            await asyncio.sleep(sleep_time)

    def _update(self, dt: float) -> None:
        """Update game state for one tick."""
        # Advance clock
        self.state.clock.advance()
        self.state.tick = self.state.clock.tick

        # Update player cooldowns
        self.state.player.update_cooldowns(dt)

        # Update movement
        self.movement.update(dt, self.state)

        # Update enemy AI
        for enemy in self.state.get_active_enemies():
            self.enemy_controller.update(dt, enemy, self.state.player)

        # Update twin
        observation = build_observation(self.state, [])
        intent = self.state.twin.decide(observation)
        self.state.twin.execute_intent(intent, self.state.player.position)

        # Update collisions
        self.collision.update(dt, self.state)

        # Clean up dead projectiles
        self.state.projectiles = [p for p in self.state.projectiles if p.active]

        # Check for room clear
        if not self.state.get_active_enemies():
            self.state.bus.publish(Event(
                tick=self.state.tick,
                type="ROOM_CLEARED",
                data={
                    "roomType": self.state.room.room_type,
                }
            ))

    async def _send_snapshot(self, manager) -> None:
        """Send game state snapshot to client."""
        snapshot = self.state.to_dict()
        snapshot["type"] = "SNAPSHOT"

        # Add player model data for debug
        model_snapshot = self.pipeline.snapshot()
        snapshot["playerModel"] = model_snapshot.to_json_dict()

        await manager.send_message(self.session_id, snapshot)
