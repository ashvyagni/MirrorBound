import type { GameSnapshot, NpcSnap, PlayerSnap, RoomFull } from '../contracts';
import { isRoomFull } from '../contracts';

/** Display the same reachable NPC that the talk key will request. Python validates it. */
export function nearbyNpc(npcs: readonly NpcSnap[], player: Pick<PlayerSnap, 'position' | 'radius'>): NpcSnap | null {
  let closest: NpcSnap | null = null;
  let distance = Infinity;
  for (const npc of npcs) {
    const d = Math.hypot(npc.position.x - player.position.x, npc.position.y - player.position.y);
    if (d <= npc.radius + player.radius && d < distance) {
      closest = npc;
      distance = d;
    }
  }
  return closest;
}

/** Omitted detail fields mean unchanged; an empty list or a new room clears them. */
export class Interactions {
  #roomId: string | null = null;
  npcs: NpcSnap[] = [];
  room: RoomFull | null = null;

  update(snap: GameSnapshot): NpcSnap | null {
    if (snap.room.id !== this.#roomId) {
      this.#roomId = snap.room.id;
      this.npcs = [];
      this.room = null;
    }
    if (snap.npcs !== undefined) this.npcs = snap.npcs;
    if (isRoomFull(snap.room)) this.room = snap.room;
    else if (this.room) this.room = { ...this.room, cleared: snap.room.cleared, doors: snap.room.doors };
    return nearbyNpc(this.npcs, snap.player);
  }
}
