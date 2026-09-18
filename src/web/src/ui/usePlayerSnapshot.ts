import { useEffect, useState } from 'react';

import { eventBus } from '@/game/EventBus';
import type { PlayerSnapshot } from '@/game/types';

/**
 * Mirror the character's state into React.
 *
 * Subscribes to `player:changed`, not `player:tick` -- the game emits a tick
 * every frame, and re-rendering React at 60 Hz to show a label that changes
 * twice a second is how a UI starts costing more than the game.
 */
export function usePlayerSnapshot(): PlayerSnapshot | null {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);

  useEffect(() => eventBus.on('player:changed', setSnapshot), []);

  return snapshot;
}
