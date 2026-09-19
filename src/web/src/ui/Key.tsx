/**
 * A key cap that names whatever key is bound to an action right now.
 *
 * Every `<kbd>` in the UI used to be a letter typed into the markup, which was
 * fine while the keys were fixed and became a lie the moment they were not.
 * This subscribes to the binding table, so rebinding "drink" repaints the
 * potion slot, the hint line and the Character screen together.
 */

import { useEffect, useState } from 'react';

import { keyName, keybinds, type Action } from '@/game/state/Keybinds';

export function Key({ of: action }: { of: Action }) {
  const [, bump] = useState(0);
  useEffect(() => keybinds.onChange(() => bump((n) => n + 1)), []);
  return <kbd>{keyName(keybinds.get(action).primary)}</kbd>;
}
