import { useEffect, useState } from 'react';

import { WEAPONS, WEAPON_ORDER, type WeaponId } from '@/game/animation/weaponClips';
import { eventBus } from '@/game/EventBus';

/**
 * Pick a weapon, or put it away.
 *
 * Equipping is a game concern, so this only emits intent and renders whatever
 * the scene reports back. That keeps one source of truth for what is actually
 * in hand, rather than a React copy that can drift from it.
 */
export function LoadoutPanel() {
  const [equipped, setEquipped] = useState<WeaponId | null>(null);
  const [combo, setCombo] = useState({ step: 0, length: 0 });

  useEffect(
    () => eventBus.on('weapon:changed', ({ id, step, length }) => {
      setEquipped(id);
      setCombo({ step, length });
    }),
    [],
  );

  const equip = (id: WeaponId | null) => eventBus.emit('weapon:equip', { id });

  return (
    <section className="card">
      <header className="card__head">
        <h2 className="card__title">Loadout</h2>
        {equipped && combo.length > 1 && (
          <span className="chain" title="Next hit in the combo">
            {Array.from({ length: combo.length }, (_, i) => (
              <i key={i} data-on={i < combo.step} />
            ))}
          </span>
        )}
      </header>

      <div className="weapons">
        {WEAPON_ORDER.map((id) => {
          const weapon = WEAPONS[id];
          const active = equipped === id;
          return (
            <button
              key={id}
              type="button"
              className="weapon"
              data-active={active}
              aria-pressed={active}
              onClick={() => equip(active ? null : id)}
            >
              <span className="weapon__name">{weapon.name}</span>
              <span className="weapon__blurb">{weapon.blurb}</span>
              {weapon.swings.length > 1 && (
                <span className="weapon__tag">{weapon.swings.length}-hit</span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => equip(null)}
        disabled={!equipped}
      >
        {equipped ? `Put away ${WEAPONS[equipped].name.toLowerCase()}` : 'Nothing equipped'}
      </button>
    </section>
  );
}
