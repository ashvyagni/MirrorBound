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

from mirrorbound.agent.observation_builder import build_observation
from mirrorbound.agent.persistence import (
    dump_player_model,
    dump_twin_style,
    load_player_model,
    load_twin_style,
)
from mirrorbound.agent.pipeline import PlayerModelPipeline
from mirrorbound.agent.twin import TwinStyleModel, TwinV0Controller
from mirrorbound.contracts.messages import (
    CommandMessage,
    InputMessage,
    parse_client_message,
)
from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.combat.weapons import STARTING_BLADE, WEAPONS
from mirrorbound.game.core.clock import SIM_HZ, SNAPSHOT_HZ
from mirrorbound.game.core.events import Event
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator, DungeonRun
from mirrorbound.game.dungeon.room import TILE, Portal, Room
from mirrorbound.game.enemy_ai.controller import BasicEnemyController
from mirrorbound.game.enemy_ai.mirror import MirrorController
from mirrorbound.game.entities.enemy import ARCHETYPES, armed_with
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import PlayerInput
from mirrorbound.game.inventory import CONSUMABLES
from mirrorbound.game.movement.collision import CollisionSystem
from mirrorbound.game.movement.movement import MovementSystem
from mirrorbound.game.state import GameState
from mirrorbound.game.twin_executor import TwinExecutor
from mirrorbound.game.world import save as save_system
from mirrorbound.game.world.actions import (
    buy_item,
    call_twin,
    restore_twin,
    shard_rush,
    transfer_weapon,
)
from mirrorbound.game.world.campaign import (
    AREAS,
    HOME_VILLAGE,
    START_AREA,
    CampaignState,
    sanitise_name,
)
from mirrorbound.game.world.cutscene import BEATS, LINE_SECONDS, LINES, Cutscene
from mirrorbound.game.world.npc import TALK_RADIUS
from mirrorbound.game.world.sandbox import build_sandbox
from mirrorbound.game.world.village import build_village
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
    "CHEST_OPENED",
    # What the boss casts, and its wind-up. Without these on the list the
    # Mirror's whole spell kit resolves server-side and the client draws none
    # of it -- which is how you get a boss that damages you from an empty room.
    "ENEMY_ABILITY_CAST", "ENEMY_ABILITY_CHARGE",
    "PLAYER_ABILITY_RESOLVED", "BOSS_NOVA_CHARGE", "BOSS_NOVA", "BOSS_DEFEATED", "RUN_COMPLETE", "ACTION_REJECTED", "PLAYER_HEALED",
    "TARGET_CHANGE", "ITEM_USE_STARTED", "ABILITY_INTERRUPTED", "TWIN_WEAPON_SWITCH", "GOLD_GAINED",
    "SHOP_PURCHASE", "NPC_TALK", "QUEST_UPDATED", "CHECKPOINT_SAVED", "AREA_ENTER", "ABILITY_SLOT_CHANGED",
    "TWIN_ITEM_GIVEN", "AREA_DISCOVERED", "TWIN_TAKEN", "TWIN_CALLED",
    "SAVE_LOADED", "SAVE_CREATED", "SAVE_DELETED", "DATA_RESET", "RUN_FAILED", "PLAYER_PARRIED",
    "ITEM_DROPPED", "BOSS_CONFIGURED",
    "SHARD_DROPPED", "TWIN_CORRUPTED", "TWIN_CLEANSED",
    "CUTSCENE_BEGIN", "CUTSCENE_BEAT", "CUTSCENE_LINE", "CUTSCENE_END",
}

# Spatial heatmap cell size in world units. Rooms are 1280-1600 wide, so 64 gives
# a 20x15-ish grid: coarse enough to find "the spot", fine enough to draw.
SPATIAL_CELL = 64.0


def seed_from_session(session_id: str) -> int:
    """Stable across processes (AGENTS.md forbids `hash()` for this)."""
    return zlib.crc32(session_id.encode()) % (2**31)


class GameSession:
    """Manages a single game session."""

    def __init__(self, session_id: str, seed: int | None = None, record: bool = True, room_count: int = 7,
                 load_save: bool = False, start_area: str | None = None,
                 slot: str = save_system.AUTO_SLOT):
        self.session_id = session_id
        # Which slot this run reads and writes. The village checkpoint follows
        # the run, so playing a named slot keeps checkpointing into that slot
        # rather than quietly diverting the player's progress into `auto`.
        self.slot = slot
        self.running = True
        self.seed = seed if seed is not None else seed_from_session(session_id)
        self.room_count = room_count
        self.record = record
        self.load_save = load_save
        self.start_area = start_area or START_AREA
        self.recorder = ReplayRecorder(session_id, self.seed, enabled=record)
        self.pending_input: PlayerInput | None = None
        self.pending_commands: list[CommandMessage] = []
        self.last_snapshot_time = 0.0
        self.snapshot_interval = 1.0 / SNAPSHOT_HZ
        self.snapshots_sent = 0
        self.room_dirty = True
        self.last_error: str | None = None
        self.saves_dirty = True
        self._build_world()

    # ------------------------------------------------------------- world setup

    def _build_world(self) -> None:
        self.state = GameState(seed=self.seed)
        self.campaign = CampaignState()
        self.dungeon: DungeonRun | None = None
        #: The Sanctum's opening while it plays, and None the rest of the time.
        self.cutscene: Cutscene | None = None
        #: Sandbox: what a summoned boss is armed with, as (main, offhand).
        self.boss_loadout: tuple[str, str] = ("", "")
        self._first_visit_to_sanctum = False

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
        # Inventory / skill / weapon blocks are only re-sent after something changed them.
        self.detail_dirty = True
        # A rebuilt world is a loaded or reset one, so the slot list is stale.
        self.saves_dirty = True
        for kind in ("ITEM_PICKUP", "WEAPON_CHANGED", "SKILL_UNLOCKED", "LEVEL_UP", "ITEM_USED",
                     "ABILITY_SLOT_CHANGED", "PLAYER_RESPAWNED", "ROOM_ENTER", "GOLD_GAINED",
                     "SHOP_PURCHASE", "NPC_TALK", "QUEST_UPDATED", "AREA_ENTER", "TWIN_ITEM_GIVEN"):
            self.state.bus.subscribe(kind, self._mark_detail_dirty)

        # A loaded checkpoint decides where the run resumes; otherwise the run
        # opens wherever it was told to, which is the first village unless a
        # caller (a test, a debug link) asked for somewhere specific.
        opening_area = self.start_area
        if self.load_save:
            saved = save_system.read_save(self.session_id, self.slot)
            if saved is not None:
                self.campaign = CampaignState.from_save(saved.get("campaign", {}))
                save_system.apply_save(saved, self.state.player, self.state.twin)
                if self.campaign.twin_rescued:
                    self.state.twin.dormant = False
                    self.state.twin.name = self.campaign.twin_name
                # The twin the player trained in this slot, not a blank one and
                # not the one from whatever slot was open a moment ago.
                agent = saved.get("agent") or {}
                load_player_model(self.pipeline, agent.get("playerModel"))
                load_twin_style(self.style, agent.get("twinStyle"))
                opening_area = self.campaign.current_area
        self.state.campaign = self.campaign
        self._enter_area(opening_area, announce=False)

    # ------------------------------------------------------------------- areas

    def _enter_area(self, area_id: str, announce: bool = True) -> None:
        """Move the run to another area: a village (one authored safe room) or a
        dungeon (a seeded run of rooms). The player and twin keep everything --
        level, inventory, learned model -- because only the world changes."""
        area = AREAS.get(area_id)
        if area is None:
            return
        state = self.state
        self.campaign.current_area = area_id
        self.campaign.discover(area_id)
        state.difficulty = area.difficulty
        # Each area gets its own RNG stream off the run seed, so a given seed
        # always produces the same Ashen Deep whether or not you detoured.
        rng = DeterministicRNG(self.seed).spawn(f"area:{area_id}")

        if area.kind == "sandbox":
            # Not a checkpoint. Nothing that happens here is written down, so
            # walking in cannot overwrite the save the player was playing.
            self.dungeon = None
            state.dungeon = None
            self._enter_room(build_sandbox(area_id, rng), from_side=None)
        elif area.kind == "village":
            # Standing in a village is what puts the roads out of it on the
            # map. Gated areas stay unknown, so the map fills in as you do.
            for found in self.campaign.reveal_open():
                state.emit("AREA_DISCOVERED", area=found, name=AREAS[found].name,
                           subtitle=AREAS[found].subtitle)
            self.dungeon = None
            state.dungeon = None
            room = build_village(area_id, rng)
            self._enter_room(room, from_side=None)
            self._checkpoint()
        else:
            self.dungeon = DungeonGenerator(rng).generate(
                room_count=len(area.sequence) or self.room_count,
                sequence=area.sequence or None,
                biome=area.biome,
                tutorial=area.tutorial,
            )
            for room in self.dungeon.rooms:
                room.area_id = area_id
                # A room whose treasure was taken in an earlier visit stays empty.
                if room.id in self.campaign.looted_rooms:
                    room.looted = True
            state.dungeon = self.dungeon
            self._enter_room(self.dungeon.rooms[0], from_side=None)

        if announce:
            state.emit("AREA_ENTER", area=area_id, name=area.name, kind=area.kind,
                       subtitle=area.subtitle, difficulty=area.difficulty)

    def _leave_area(self, portal_target: str) -> None:
        if portal_target not in AREAS:
            self.state.emit("ACTION_REJECTED", actor=self.state.player.id, action="TRAVEL",
                            area=portal_target, reason="unknown area")
            return
        # Gated areas are refused, and nothing is granted for skipping one.
        #
        # This used to work the other way: the map let you jump anywhere and
        # quietly completed every area you had jumped over, seals and gold and
        # all. That made the campaign a menu -- the Mirror was two clicks from
        # the opening village, and finishing a dungeon was something the game
        # did for you rather than something you did.
        #
        # The chain is the progression now: one area at a time, each opened by
        # finishing the one before it. `is_open` already knew the rule; nothing
        # was asking it.
        open_now, reason = self.campaign.is_open(portal_target)
        if not open_now:
            self.state.emit("ACTION_REJECTED", actor=self.state.player.id, action="TRAVEL",
                            area=portal_target, reason=reason)
            return
        self._enter_area(portal_target)

    def _complete_area(self) -> None:
        """A dungeon's last room is cleared. Rewards land exactly once."""
        area_id = self.campaign.current_area
        area = AREAS.get(area_id)
        if area is None:
            return
        first_time = self.campaign.complete(area_id)
        if first_time and area.completion_gold:
            self.state.player.inventory.add_gold(area.completion_gold)
        self.state.emit("QUEST_UPDATED", area=area_id, name=area.name, first=first_time,
                        gold=area.completion_gold if first_time else 0,
                        seal=area.completion_seal if first_time else "",
                        seals=list(self.campaign.seals))
        self._checkpoint()

    def _checkpoint(self, slot: str | None = None, name: str = "") -> None:
        target = slot or self.slot
        # Keep whatever the slot was already called unless a new name is given,
        # so an autosave into a named slot does not rename it to "Autosave".
        if not name:
            existing = save_system.read_save(self.session_id, target)
            name = str(existing.get("name", "")) if existing else ""
        data = save_system.build_save(self.session_id, self.campaign, self.state.player,
                                      self.state.twin, name=name, agent=self._agent_save())
        if save_system.write_save(self.session_id, data, target):
            # `safe` says whether this was the village kind of checkpoint or
            # one taken because something happened; the client says different
            # things about them, and "the village remembers" in a crypt reads
            # as a bug.
            self.saves_dirty = True
            self.state.emit("CHECKPOINT_SAVED", area=self.campaign.current_area,
                            slot=target, name=name,
                            safe=self.state.room.room_type == "village")

    def _agent_save(self) -> dict:
        """What this run has learned, for the slot it is being written to.

        Kept beside the checkpoint rather than in a file of its own so a slot is
        one file: deleting a save deletes the twin that was trained in it, and
        there is no way for the two to drift apart or for a stale model to
        attach itself to a save that never produced it.
        """
        return {
            "playerModel": dump_player_model(self.pipeline, self.state.tick),
            "twinStyle": dump_twin_style(self.style),
        }

    def _mark_detail_dirty(self, _event: Event) -> None:
        self.detail_dirty = True

    # The room, one in from the crypt's entrance, where the twin is found. The
    # player has had two rooms to learn moving and swinging before it shows up,
    # which is the order the tutorial is meant to teach them in.
    TWIN_RESCUE_AREA = "wakewood_crypt"
    TWIN_RESCUE_ROOM_INDEX = 2

    def _maybe_rescue_twin(self, room, first_visit: bool) -> None:
        state = self.state
        if not state.twin.dormant:
            return
        reached = room.area_id == self.TWIN_RESCUE_AREA and room.index >= self.TWIN_RESCUE_ROOM_INDEX
        if not (reached and first_visit):
            return
        state.twin.awaken(state.player.position, self.campaign.twin_name)
        self.campaign.rescue_twin()
        state.emit("TWIN_REVIVED", position=state.twin.position.to_dict(), rescued=True,
                   name=self.campaign.twin_name)
        state.emit("QUEST_UPDATED", area=room.area_id, name="The Twin", first=True,
                   rescued=True, seals=list(self.campaign.seals))

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
        if self.dungeon is not None:
            self.dungeon.current_room_index = room.index
        spawn = room.entry_point_from(from_side) if from_side else room.player_spawn
        spawn = room.clamp(spawn, state.player.radius)
        state.player.position = spawn.copy()
        state.player.velocity = Vec2()
        state.player.knockback = Vec2()
        state.twin.position = room.clamp(spawn + Vec2(-40, 22), state.twin.radius)
        state.twin.velocity = Vec2()
        # A twin that went down in the last room is back on its feet in the
        # next one: a room transition is not a punishment window.
        if state.twin.downed and not state.twin.dormant:
            state.twin.revive(state.player.position)
        first_visit = not room.visited
        room.visited = True
        if first_visit:
            state.spawn_enemies_for_room(room)
            # Anything boss-shaped that just spawned takes the player's weapon,
            # so the Mirror meets you holding your own.
            self._arm_boss()
            self._maybe_leave_a_blade(room)
            if not room.looted:
                state.spawn_room_treasure(room)
                # Treasure is handed out once per room, ever. Marking it here
                # rather than on pickup means walking away from loot does not
                # make the room farmable by coming back for it.
                room.looted = True
                self.campaign.looted_rooms.add(room.id)
            if not room.enemy_spawns:
                room.cleared = True
                room.unlock_doors()
        elif room.cleared:
            room.unlock_doors()
        state.transition_timer = 0.6
        self.room_dirty = True
        state.emit("ROOM_ENTER", room_id=room.id, room_index=room.index, room_type=room.room_type,
                   name=room.name, biome=room.biome, position=spawn.to_dict(), enemies=len(state.enemies),
                   first_visit=first_visit, area=room.area_id, safe=room.room_type == "village")
        self._maybe_rescue_twin(room, first_visit)
        self._maybe_take_the_twin(room, first_visit)

    def _maybe_leave_a_blade(self, room: Room) -> None:
        """A sword at the threshold, for someone who walked in with nothing.

        The player starts bare-handed on purpose: abilities belong to weapons,
        so the first one you pick up is the first time the ability bar has
        anything on it. That only works if there is one to pick up -- and there
        was not. Starting gold is zero, the smith stocked nothing under 140,
        and weapon drops run from 12% on a brute to 50% on the Warden. A new
        player could clear the opening dungeon with two swipes and a dash and
        never see the rest of the game.

        So a dungeon entrance leaves one out, exactly when you have nothing at
        all. Owning any weapon -- bought, found, or handed over by the twin --
        means the threshold is bare, so this can never be farmed and never
        shows up as clutter on a second run.
        """
        if room.room_type != "entrance":
            return
        if self.state.player.inventory.weapons:
            return
        where = self.state.player.position + Vec2(0.0, -110.0)
        self.state.spawn_pickup("weapon", room.clamp(where, 20.0), item_id=STARTING_BLADE)
        self.state.emit("BLADE_LEFT", item=STARTING_BLADE, position=where.to_dict(),
                        room_id=room.id)

    def _maybe_take_the_twin(self, room: Room, first_visit: bool) -> None:
        """The Mirror is your twin. Walking into its room is where that lands.

        Up to here the twin has followed you, learned from you and fought
        beside you. The boss room takes it: the twin leaves the world, and the
        thing that comes out of it is the Mirror -- which is why the Mirror
        fights the way you do.

        Entering the room starts the scene rather than doing the deed outright;
        `_advance_cutscene` walks it through its beats and takes the twin on the
        `hatch` one. Done on entering rather than on the Warden's death so the
        two beats do not land on top of each other: the Warden is the end of the
        Ashen Deep, and this is the opening of the Sanctum.

        The twin goes dormant rather than dying. It is not dead -- it is in
        front of you, and killing the Mirror is what gets it back.
        """
        state = self.state
        if room.room_type != "boss" or state.twin.dormant or "twin_restored" in self.campaign.flags:
            return
        if not any(e.enemy_def.boss for e in state.enemies):
            return
        if self.cutscene is not None or "twin_taken" in self.campaign.flags:
            return

        self.cutscene = Cutscene(centre=Vec2(room.width / 2, room.height / 2))
        self._first_visit_to_sanctum = first_visit
        state.emit("CUTSCENE_BEGIN", scene="sanctum", beat=BEATS[0].name,
                   twin=self.campaign.twin_name, room_id=room.id, first_visit=first_visit)

    # ------------------------------------------------------------ the cutscene

    #: How close to the middle counts as arrived, so the `approach` beat can end
    #: early rather than always running its full ceiling.
    CENTRE_TOLERANCE = 26.0

    def _advance_cutscene(self, dt: float) -> None:
        """Run the Sanctum scene. Nothing else in the tick runs while it does.

        The player does not move, the Mirror does not act and the twin is moved
        by this rather than by its controller: a scene the boss can interrupt is
        not a scene.
        """
        scene = self.cutscene
        state = self.state
        if scene is None:
            return
        twin = state.twin
        beat = scene.beat.name

        if beat == "approach":
            # Walked, not placed. The twin arriving by teleport is the one thing
            # that would make the whole sequence read as a bug.
            to_centre = scene.centre - twin.position
            distance = to_centre.length()
            if distance > self.CENTRE_TOLERANCE:
                step = to_centre.normalized() * min(twin.speed * dt, distance)
                twin.position = twin.position + step
                twin.facing = to_centre.normalized()
                twin.set_state("walk")
            else:
                twin.velocity = Vec2()
                twin.set_state("idle")
                scene.next_beat()
                self._begin_beat()
                return
        elif beat == "speak":
            due = int(scene.elapsed / LINE_SECONDS) + 1
            while scene.lines_sent < min(due, len(LINES)):
                line = LINES[scene.lines_sent].format(
                    player=self.campaign.player_name, twin=self.campaign.twin_name)
                state.emit("CUTSCENE_LINE", scene="sanctum", index=scene.lines_sent, text=line)
                scene.lines_sent += 1

        if not scene.advance(dt):
            return
        scene.next_beat()
        if scene.done:
            self.cutscene = None
            state.emit("CUTSCENE_END", scene="sanctum")
            return
        self._begin_beat()

    def _begin_beat(self) -> None:
        """Do whatever a beat does the moment it starts, then announce it."""
        scene = self.cutscene
        state = self.state
        if scene is None or scene.done:
            return
        beat = scene.beat.name
        if beat == "cleanse":
            # The shard is finished with it. The red going out is the only
            # moment the player sees the twin as itself again.
            state.twin.corrupted = False
            state.emit("TWIN_CLEANSED", twin=self.campaign.twin_name,
                       position=state.twin.position.to_dict())
        elif beat == "hatch":
            where = state.twin.position.copy()
            # The boss is put where the shell opens.
            #
            # It was spawned by the room's own table at (0.50, 0.34) and left
            # there, while the twin walked to the centre and cracked open two
            # hundred units away from it. The scene's whole promise is that the
            # thing following you around all game *becomes* the boss, and it
            # cannot read that way while the two are in different places.
            for enemy in state.enemies:
                if enemy.enemy_def.boss and enemy.active:
                    enemy.position = where.copy()
                    enemy.home = where.copy()
            state.twin.dormant = True
            state.twin.corrupted = False
            state.twin.velocity = Vec2()
            self.campaign.flags.add("twin_taken")
            state.emit("TWIN_TAKEN", twin=self.campaign.twin_name, position=where.to_dict(),
                       room_id=state.room.id, first_visit=self._first_visit_to_sanctum)
        state.emit("CUTSCENE_BEAT", scene="sanctum", beat=beat,
                   duration=round(scene.duration(), 2))

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
                ability=parsed.ability, aim_x=parsed.aimX, aim_y=parsed.aimY,
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
                transfer_weapon(state, cmd.weaponId, to_twin=True)
            elif action == "TWIN_CALL":
                call_twin(state, self.twin_executor)
            elif action == "UNLOCK_SKILL" and cmd.skillId:
                ok, reason = player.unlock_skill(cmd.skillId)
                if ok:
                    state.emit("SKILL_UNLOCKED", skill=cmd.skillId, skillPoints=player.skill_points,
                               position=player.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=player.id, action=action, skill=cmd.skillId, reason=reason)
            elif action == "SPAWN" and cmd.enemyType:
                self._spawn_debug(cmd.enemyType)
            elif action == "RESPEC":
                self._respec()
            elif action == "USE_ITEM" and cmd.itemId:
                self._use_item(cmd.itemId)
            elif action == "SET_ABILITY_SLOT":
                # Older clients can still send this command. Slots are now
                # derived from weapons; never call the removed inventory setter.
                state.emit("ACTION_REJECTED", actor=player.id, action=action,
                           reason="abilities are determined by equipped weapons")
            elif action == "SWAP_WEAPON":
                if player.inventory.swap_weapons():
                    player.combo_step = 0
                    state.emit("WEAPON_CHANGED", actor=player.id, weapon=player.inventory.equipped_weapon,
                               offhand=player.inventory.offhand_weapon, position=player.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=player.id, action=action, reason="nothing to swap to")
            elif action == "SET_OFFHAND" and cmd.weaponId:
                if player.inventory.equip_offhand(cmd.weaponId):
                    state.emit("WEAPON_CHANGED", actor=player.id, weapon=player.inventory.equipped_weapon,
                               offhand=cmd.weaponId, position=player.position.to_dict())
                else:
                    state.emit("ACTION_REJECTED", actor=player.id, action=action, reason="not owned")
            elif action == "TRAVEL" and cmd.areaId:
                self._travel(cmd.areaId)
            elif action == "TALK" and cmd.npcId:
                self._talk(cmd.npcId)
            elif action == "BUY_ITEM" and cmd.npcId and cmd.itemId:
                self._buy(cmd.npcId, cmd.itemId)
            elif action == "SET_NAME":
                self._set_names(cmd.playerName, cmd.twinName)
            elif action == "TWIN_REQUEST" and cmd.weaponId:
                self._request_from_twin(cmd.weaponId)
            elif action == "SAVE":
                self._checkpoint()
            elif action == "SAVE_AS":
                self._save_as(cmd.saveName or "")
            elif action == "NEW_SAVE":
                self._new_save(cmd.saveName or "")
                return
            elif action == "LOAD_SAVE" and cmd.saveId:
                self._load_slot(cmd.saveId)
                return
            elif action == "DELETE_SAVE" and cmd.saveId:
                self._delete_slot(cmd.saveId)
            elif action == "RESET_DATA":
                self._reset_data()
                return
            elif action == "GIVE" and cmd.weaponId:
                self._give(cmd.weaponId)
            elif action == "CONFIGURE_BOSS":
                self._configure_boss(cmd.bossWeapon, cmd.bossOffhand, cmd.bossSkill)
        self.pending_commands.clear()

    # ------------------------------------------------------------- save slots

    def _save_as(self, name: str) -> None:
        """Copy the run into a new named slot, leaving the current one alone."""
        player = self.state.player
        slot = save_system.new_slot_id(self.session_id)
        if slot is None:
            self.state.emit("ACTION_REJECTED", actor=player.id, action="SAVE_AS",
                            reason=f"no room for another save (limit {save_system.MAX_SLOTS})")
            return
        clean = sanitise_name(name, f"Save {slot.removeprefix('slot-')}")
        self._checkpoint(slot=slot, name=clean)
        # The run continues in the slot it was just written to, so the next
        # village checkpoint updates the save the player just made rather than
        # the one they saved away from.
        self.slot = slot
        save_system.write_active_slot(self.session_id, slot)

    def _new_save(self, name: str) -> None:
        """Start a fresh run in a slot of its own.

        The one thing the save system could not do. `SAVE_AS` *copies* the run
        you are in, so every slot a player could make already knew their level,
        their gear, how far through the campaign they were and -- worst of it --
        what the twin had learned about them. The only route to a blank
        campaign was RESET_DATA, which deletes every save they have.

        So this allocates an empty slot and rebuilds the world from nothing
        rather than from a save. The name is asked for by the client once the
        fresh campaign arrives, the same way it is on a first run.
        """
        player = self.state.player
        slot = save_system.new_slot_id(self.session_id)
        if slot is None:
            self.state.emit("ACTION_REJECTED", actor=player.id, action="NEW_SAVE",
                            reason=f"no room for another save (limit {save_system.MAX_SLOTS})")
            return
        self.slot = slot
        save_system.write_active_slot(self.session_id, slot)
        # Rebuilt without a save, which is what makes it new: `load_save` is
        # the flag `_build_world` reads to decide whether to apply one.
        self.load_save = False
        self.restart()
        if name:
            self.campaign.player_name = sanitise_name(name, self.campaign.player_name)
        # Written immediately so the slot exists on disk before the player has
        # done anything in it. A new save that only appears in the list after
        # the first village is a new save the player thinks failed.
        self._checkpoint(slot=slot, name=name)
        self.saves_dirty = True
        self.state.emit("SAVE_CREATED", slot=slot, area=self.campaign.current_area,
                        named=bool(name))

    def _load_slot(self, slot: str) -> None:
        """Restart the run from a slot. A fresh world, then the save onto it."""
        player_id = self.state.player.id
        if save_system.read_save(self.session_id, slot) is None:
            self.state.emit("ACTION_REJECTED", actor=player_id, action="LOAD_SAVE", reason="no such save")
            return
        self.slot = slot
        save_system.write_active_slot(self.session_id, slot)
        self.load_save = True
        self.restart()
        self.saves_dirty = True
        self.state.emit("SAVE_LOADED", slot=slot, area=self.campaign.current_area)

    def _delete_slot(self, slot: str) -> None:
        save_system.delete_save(self.session_id, slot)
        self.saves_dirty = True
        # Deleting the slot being played drops the run back onto the autosave,
        # so the next checkpoint has somewhere real to go.
        if slot == self.slot:
            self.slot = save_system.AUTO_SLOT
            save_system.write_active_slot(self.session_id, self.slot)
        self.state.emit("SAVE_DELETED", slot=slot)

    def _reset_data(self) -> None:
        """Throw away every save and start the campaign over from nothing."""
        save_system.delete_profile(self.session_id)
        self.slot = save_system.AUTO_SLOT
        self.load_save = False
        self.restart()
        self.saves_dirty = True
        self.state.emit("DATA_RESET")

    # ----------------------------------------------------------- world commands

    def _travel(self, area_id: str) -> None:
        """Travel from a village, or out of the sandbox.

        Only ever from those two: leaving a dungeon means walking out of it,
        which is what makes going in a decision. The sandbox is exempt because
        it is not part of the campaign -- being unable to leave it without a
        portal walk would make it a worse place to test in, which is its only
        purpose.
        """
        state = self.state
        if state.room.room_type not in ("village", "sandbox"):
            state.emit("ACTION_REJECTED", actor=state.player.id, action="TRAVEL", area=area_id,
                       reason="only from a village")
            return
        self._leave_area(area_id)

    def _npc_at(self, npc_id: str):
        for npc in self.state.room.npcs:
            if npc.id == npc_id:
                return npc
        return None

    def _talk(self, npc_id: str) -> None:
        state, player = self.state, self.state.player
        npc = self._npc_at(npc_id)
        if npc is None:
            state.emit("ACTION_REJECTED", actor=player.id, action="TALK", npc=npc_id, reason="not here")
            return
        if (Vec2(npc.x, npc.y) - player.position).length() > TALK_RADIUS + player.radius:
            state.emit("ACTION_REJECTED", actor=player.id, action="TALK", npc=npc_id, reason="too far")
            return
        lines = npc.definition.dialogue_for(self.campaign.flags, self.campaign.player_name,
                                            self.campaign.twin_name)
        # The elder telling you where to go is what starts the quest. Read
        # *after* the lines above, so this first talk still gets her opening
        # and every talk after it gets the reminder.
        if npc.definition.role == "elder" and "quest_active" not in self.campaign.flags:
            self.campaign.flags.add("quest_active")
            state.emit("QUEST_UPDATED", quest="wakewood_crypt", started=True,
                       name=npc.definition.name)
        # Resting at the hearth is the village's one mechanical service.
        if npc.definition.role == "hearth":
            player.health = player.max_health
            player.mana = player.max_mana
            player.status_effects.clear()
            player.slow_factor = 1.0
            if not state.twin.dormant:
                state.twin.health = state.twin.max_health
                state.twin.mana = state.twin.max_mana
            self._checkpoint()
        state.emit("NPC_TALK", npc=npc_id, name=npc.definition.name, role=npc.definition.role,
                   lines=list(lines), stock=[e.to_dict() for e in npc.definition.stock],
                   position=player.position.to_dict())

    # ---------------------------------------------------------- sandbox tools

    def _give(self, weapon_id: str) -> None:
        """Drop a weapon on the ground in front of the player.

        Dropped rather than granted, deliberately. A weapon that appears in the
        bag skips the pickup -- the scatter, the walk over it, the first-pickup
        auto-equip -- and those are exactly the paths worth being able to test.
        It goes through `spawn_pickup` like any other drop, so what lands is a
        real pickup and not a special case.
        """
        state, player = self.state, self.state.player
        if weapon_id not in WEAPONS:
            state.emit("ACTION_REJECTED", actor=player.id, action="GIVE",
                       reason=f"no such weapon: {weapon_id}")
            return
        facing = player.facing
        offset = Vec2(facing.x, facing.y)
        if offset.length() < 0.01:
            offset = Vec2(0.0, 1.0)
        # Clear of the pickup magnet (90 units), or the drop is snatched back
        # the instant it lands and "drop it in front of me" becomes "put it in
        # my bag" -- which is the thing GIVE exists not to do.
        where = state.room.clamp(player.position + offset.normalized() * 170.0, 24.0)
        pickup = state.spawn_pickup("weapon", where, item_id=weapon_id)
        # It waits. A dropped test weapon expiring while you walk back to look
        # at something else is only ever an annoyance.
        pickup.ttl = 0.0
        state.emit("ITEM_DROPPED", actor=player.id, kind="weapon", item_id=weapon_id,
                   position=where.to_dict(), room_id=state.room.id)

    def _configure_boss(self, weapon: str | None, offhand: str | None, skill: float | None) -> None:
        """Arm the Mirror and set how much of you it already knows.

        Takes effect on the boss standing in the room now *and* is remembered,
        so a Mirror summoned afterwards arrives configured the same way -- the
        point is to change one variable and summon it again, not to re-enter
        the whole setup between attempts.
        """
        state, player = self.state, self.state.player
        for wid in (weapon, offhand):
            if wid and wid not in WEAPONS:
                state.emit("ACTION_REJECTED", actor=player.id, action="CONFIGURE_BOSS",
                           reason=f"no such weapon: {wid}")
                return
        if weapon is not None:
            self.boss_loadout = (weapon, offhand or "")
        if skill is not None:
            self.mirror_controller.skill_floor = max(0.0, min(1.0, skill))
        self._arm_boss()
        state.emit("BOSS_CONFIGURED", weapon=self.boss_loadout[0], offhand=self.boss_loadout[1],
                   skill=round(self.mirror_controller.skill_floor, 2))

    def _arm_boss(self) -> None:
        """Put a weapon in the hands of any boss in the room.

        An enemy carries no inventory, so this swaps the def it fights from --
        see `armed_with`. Every boss in the room, because the sandbox can have
        more than one standing in it.

        With nothing configured it falls back to **whatever the player is
        carrying**, which is the whole point of the fight: the Mirror is meant
        to fight the way you do, and for the entire campaign it was fighting
        with its own archetype instead. `boss_loadout` is only ever set by the
        sandbox's CONFIGURE_BOSS, so before this every real playthrough met an
        unarmed Mirror -- the mechanism existed, was tested, and was never
        reached. An explicit configuration still wins, so the sandbox is
        unaffected.
        """
        weapon, _ = self.boss_loadout
        if not weapon:
            weapon = self.state.player.current_weapon
        # Bare hands arm nothing: there is no def to copy and nothing to draw.
        if not weapon or weapon == "bare_hands":
            return
        for enemy in self.state.enemies:
            if enemy.enemy_def.boss and enemy.active:
                enemy.enemy_def = armed_with(ARCHETYPES[enemy.enemy_def.id], weapon)

    def _spawn_debug(self, enemy_type: str) -> None:
        """Put one enemy in front of the player, from the console.

        It goes in through `spawn_enemy` like every other creature, which is
        the whole point: it gets a real `EnemyDef`, a real id, a real AI and a
        real loot table, so a Mirror summoned this way hunts you exactly as the
        one at the end of the run does. Nothing here is a preview.

        Refused in a village -- a safe room with a boss in it is not safe, and
        the client is told why rather than being left to wonder.
        """
        state = self.state
        # `safe` is a snapshot field, not a model one -- the model spells it
        # `room_type`. Reading the snapshot's name off the Room raised inside
        # the tick, which stopped snapshots entirely and froze the client with
        # everything standing where it was.
        if state.room.room_type == "village":
            state.emit("ACTION_REJECTED", actor=state.player.id, action="SPAWN",
                       reason="not in a village")
            return
        if enemy_type not in ARCHETYPES:
            state.emit("ACTION_REJECTED", actor=state.player.id, action="SPAWN",
                       reason=f"no such enemy: {enemy_type}")
            return

        # A little in front of the player, clamped inside the room so a spawn
        # aimed at a wall does not arrive inside one.
        facing = state.player.facing
        offset = Vec2(facing.x, facing.y)
        if offset.length() < 0.01:
            offset = Vec2(0.0, 1.0)
        offset = offset.normalized() * 220.0
        margin = float(TILE * 2)
        position = Vec2(
            min(max(state.player.position.x + offset.x, margin), state.room.width - margin),
            min(max(state.player.position.y + offset.y, margin), state.room.height - margin),
        )
        enemy = state.spawn_enemy(enemy_type, position)
        # A boss summoned after a CONFIGURE_BOSS arrives already armed, so the
        # sandbox loop is "change one thing, summon again" rather than "summon,
        # then remember to re-arm".
        if enemy.enemy_def.boss:
            self._arm_boss()
        state.emit("DEBUG_SPAWNED", enemy_id=enemy.id, enemy_type=enemy_type,
                   position=position.to_dict())

    def _respec(self) -> None:
        """Unlearn the whole tree and take the points back.

        Only in a village, and only out of combat. A respec mid-fight would let
        the player re-solve an encounter from inside it, which is a different
        game than the one the skill choices are meant to be part of; a village
        is where the campaign already lets you change your mind.
        """
        state, player = self.state, self.state.player
        if state.room.room_type != "village":
            state.emit("ACTION_REJECTED", actor=player.id, action="RESPEC",
                       reason="only in a village")
            return
        if state.get_active_enemies():
            state.emit("ACTION_REJECTED", actor=player.id, action="RESPEC", reason="not in a fight")
            return
        if not player.unlocked_skills:
            state.emit("ACTION_REJECTED", actor=player.id, action="RESPEC", reason="nothing learned")
            return
        refunded = player.respec()
        state.emit("SKILL_UNLOCKED", skill="", respec=True, refunded=refunded,
                   skillPoints=player.skill_points, position=player.position.to_dict())
        self._checkpoint()

    def _buy(self, npc_id: str, item_id: str) -> None:
        buy_item(self.state, npc_id, item_id)

    def _set_names(self, player_name: str | None, twin_name: str | None) -> None:
        state = self.state
        changed = False
        if player_name:
            self.campaign.player_name = sanitise_name(player_name, self.campaign.player_name)
            changed = True
        if twin_name and not state.twin.dormant:
            self.campaign.twin_name = sanitise_name(twin_name, self.campaign.twin_name)
            self.campaign.twin_named = True
            state.twin.name = self.campaign.twin_name
            changed = True
        if changed:
            state.emit("QUEST_UPDATED", area=self.campaign.current_area, name="names",
                       playerName=self.campaign.player_name, twinName=self.campaign.twin_name,
                       seals=list(self.campaign.seals))
            self._checkpoint()

    def _request_from_twin(self, weapon_id: str) -> None:
        transfer_weapon(self.state, weapon_id, to_twin=False)

    def _use_item(self, item_id: str) -> None:
        """Begin drinking. Nothing is consumed and nothing is restored yet --
        that happens in `_finish_drink` when the timer runs out, so a drink cut
        short by death costs the player nothing."""
        state, player = self.state, self.state.player
        if item_id not in CONSUMABLES:
            state.emit("ACTION_REJECTED", actor=player.id, action="USE_ITEM", item=item_id, reason="unknown item")
            return
        ok, reason = player.can_drink(item_id, CONSUMABLES[item_id])
        if not ok:
            state.emit("ACTION_REJECTED", actor=player.id, action="USE_ITEM", item=item_id, reason=reason)
            return
        player.begin_drink(item_id)
        state.emit("ITEM_USE_STARTED", actor=player.id, item=item_id, duration=player.drink_timer,
                   position=player.position.to_dict())

    def _finish_drink(self, item_id: str) -> None:
        state, player = self.state, self.state.player
        spec = CONSUMABLES.get(item_id)
        # The stock check happened when the drink started; re-check here because
        # a whole 0.4s of simulation has happened since.
        if spec is None or not player.inventory.take_consumable(item_id):
            state.emit("ACTION_REJECTED", actor=player.id, action="USE_ITEM", item=item_id, reason="none left")
            return
        healed = player.heal(float(spec.get("heal", 0))) if spec.get("heal") else 0.0
        mana = 0.0
        if spec.get("mana"):
            before = player.mana
            player.mana = min(player.max_mana, player.mana + float(spec["mana"]))
            mana = player.mana - before
        state.emit("ITEM_USED", actor=player.id, item=item_id, healed=round(healed, 1), mana=round(mana, 1),
                   position=player.position.to_dict())

    def _finish_channel(self, ability_id: str) -> None:
        from mirrorbound.game.combat.abilities import get_ability

        self.combat.resolve_ability(self.state, get_ability(ability_id), completed=True)

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
            except Exception:
                log.exception("tick %s failed", self.state.tick)
                self.last_error = f"tick {self.state.tick} failed; see server log"
            now = time.perf_counter()
            if now - self.last_snapshot_time >= self.snapshot_interval:
                try:
                    await manager.send_message(self.session_id, self.snapshot())
                except Exception:
                    log.exception("snapshot failed")
                self.last_snapshot_time = now
            elapsed = time.perf_counter() - start
            await asyncio.sleep(max(0.0, dt - elapsed))

    def step(self, dt: float) -> None:
        """Advance the simulation by one tick. Public so tests and replay can drive it."""
        self._apply_commands()
        state = self.state
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
        if state.phase in ("victory", "defeat"):
            player.update(dt)
            state.twin.update(dt)
            return
        # The scene owns the tick. The player's own input is dropped rather
        # than buffered -- a swing queued during the cutscene coming out on the
        # first frame of the fight is not what anyone pressed it for.
        if self.cutscene is not None:
            player.update(dt)
            player.attack_buffer = 0.0
            self._advance_cutscene(dt)
            return

        # 1. player intent
        player.update(dt)
        if player.finished_drink:
            self._finish_drink(player.finished_drink)
        if player.finished_channel:
            self._finish_channel(player.finished_channel)
        player.apply_input(dt, inp)
        # A press is remembered, not spent: the swing fires on the first tick
        # the weapon is free, so clicking faster than the cooldown chains the
        # combo instead of throwing the extra presses away.
        if inp.attack:
            player.buffer_attack()
        if player.take_buffered_attack():
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
        if twin.dormant:
            return
        twin.update(dt)
        if twin.downed:
            if twin.downed_timer <= 0:
                twin.revive(state.player.position)
                state.emit("TWIN_REVIVED", position=twin.position.to_dict())
            return
        if twin.call_remaining > 0:
            twin.call_remaining = max(0.0, twin.call_remaining - dt)
            self.twin_executor.apply(dt, state, self.combat)
            return
        # The shard outranks being called and outranks the controller: once it
        # is on the ground the twin is going for it and nothing else.
        if shard_rush(state):
            self.twin_executor.apply(dt, state, self.combat)
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
                restore_twin(state, self.campaign)
                self._complete_area()
                state.phase = "victory"
                state.emit("RUN_COMPLETE", stats=state.stats.to_dict(), seed=self.seed)
                return
            # Clearing the last room of a dungeon finishes the area and opens
            # the way home; the player still walks out under their own power.
            if self.dungeon is not None and room.index == len(self.dungeon.rooms) - 1:
                self._complete_area()
                self._open_exit_portal(room)
            self.room_dirty = True
        # Door transitions.
        if state.transition_timer <= 0 and room.cleared and self.dungeon is not None:
            door = room.door_at(state.player.position, state.player.radius)
            if door is not None and not door.locked and door.target_index is not None:
                opposite = {"north": "south", "south": "north", "east": "west", "west": "east"}[door.side]
                self._enter_room(self.dungeon.rooms[door.target_index], from_side=opposite)
                return
        # Portals out of the area.
        if state.transition_timer <= 0:
            portal = room.portal_at(state.player.position, state.player.radius)
            if portal is not None and not portal.locked:
                self._leave_area(portal.target_area)

    def _open_exit_portal(self, room) -> None:
        """The way back to the village, opened in place once a dungeon is done.

        At the far end of the room rather than in the middle of it. The middle
        is where the fight just happened and where the player already is, so a
        road home drawn there is not a way out that you walk to -- it is a tile
        you are standing on, and the last thing a finished dungeon should do is
        end without a step.

        Placed opposite the way in, mirrored through the room's centre, so it
        reads as the far side whichever door the player arrived through. Inset
        by a tile and a half: a portal flush against the wall is one the
        collision hull will not let you reach the middle of.
        """
        home = HOME_VILLAGE.get(self.campaign.current_area, START_AREA)
        if any(p.target_area == home for p in room.portals):
            return
        entered = room.player_spawn
        inset = TILE * 1.5
        far = Vec2(
            min(max(room.width - entered.x, inset), room.width - inset),
            min(max(room.height - entered.y, inset), room.height - inset),
        )
        room.portals.append(Portal(
            id=f"{room.id}_home", x=far.x, y=far.y,
            target_area=home, label=AREAS[home].name, kind="road",
        ))
        self.room_dirty = True

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
        detail = full_room or self.detail_dirty or self.snapshots_sent % SNAPSHOT_HZ == 0
        snap = state.to_dict(include_room=full_room, detail=detail)
        snap["type"] = "SNAPSHOT"
        snap["roomFull"] = full_room
        snap["detail"] = detail
        self.detail_dirty = False
        snap["events"] = [e.to_json_dict() for e in events if e.type in CLIENT_EVENT_TYPES][-60:]
        snap["playerModel"] = self._player_model_dict()
        snap["playerModel"]["cellSize"] = SPATIAL_CELL
        snap["twinModel"] = self.style.snapshot()
        snap["boss"] = self.mirror_controller.debug() if state.boss_alive() else None
        # Present only while the scene runs; the client holds input and points
        # the camera off whatever this says, so its absence means "play on".
        if self.cutscene is not None:
            snap["cutscene"] = self.cutscene.to_dict()
        snap["lastError"] = self.last_error
        # The slot list only changes when a save is written or thrown away, so
        # it rides the detail snapshot rather than going out twenty times a
        # second -- it is a directory listing, and hitting the disk at 20Hz to
        # tell the player nothing changed would be the expensive kind of wrong.
        if detail and self.saves_dirty:
            snap["saves"] = save_system.list_saves(self.session_id)
            snap["saveSlot"] = self.slot
            self.saves_dirty = False
        self.room_dirty = False
        self.snapshots_sent += 1
        return snap
