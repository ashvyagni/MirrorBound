import { useEffect, useState } from 'react';

import type { SlotId } from '@/game/animation/weaponClips';
import { eventBus } from '@/game/EventBus';

/** Seconds left on each recharging slot. Absent means ready. */
export type CooldownMap = Partial<Record<SlotId, number>>;

/**
 * Mirror the game's recharge timers into React.
 *
 * It renders what the game says and keeps no clock of its own. An earlier
 * version ran a `performance.now()` timer here, which was cheaper right up
 * until the game paused -- the scene counts in game time, wall clock does not,
 * and the panel then cheerfully offered a spell the game would refuse to cast.
 *
 * The game pushes this about ten times a second, and only while something is
 * recharging, so there is nothing to throttle.
 */
export function useCooldowns(): CooldownMap {
  const [left, setLeft] = useState<CooldownMap>({});

  useEffect(
    () => eventBus.on('weapon:cooldowns', ({ active }) => {
      const next: CooldownMap = {};
      for (const [id, timer] of Object.entries(active)) {
        if (timer) next[id as SlotId] = timer.left;
      }
      setLeft(next);
    }),
    [],
  );

  return left;
}
