import { useEffect, useState } from 'react';

import { slotInfo, WEAPONS, WEAPON_ORDER, type SlotId, type WeaponId } from '@/game/animation/weaponClips';
import { eventBus } from '@/game/EventBus';

import { Icon } from './Icon';
import { useCooldowns } from './useCooldowns';

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
  const [flash, setFlash] = useState<SlotId | null>(null);
  const cooling = useCooldowns();

  useEffect(
    () => eventBus.on('weapon:changed', ({ id, step, length }) => {
      setEquipped(id);
      setCombo({ step, length });
    }),
    [],
  );

  // Flash the slot that just fired, so a key press has visible feedback even
  // when the effect leaves the screen quickly.
  useEffect(
    () => eventBus.on('weapon:cast-done', ({ id }) => {
      setFlash(id);
      window.setTimeout(() => setFlash((cur) => (cur === id ? null : cur)), 240);
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
              <Icon name={weapon.icon} size={34} />
              <span className="weapon__text">
                <span className="weapon__name">{weapon.name}</span>
                <span className="weapon__blurb">{weapon.blurb}</span>
              </span>
              {weapon.swings.length > 1 && (
                <span className="weapon__tag">{weapon.swings.length}-hit</span>
              )}
            </button>
          );
        })}
      </div>

      {equipped && WEAPONS[equipped].abilities.length > 0 && (
        <div className="slots">
          <h3 className="slots__title">Abilities</h3>
          {WEAPONS[equipped].abilities.map((id, i) => {
            const slot = slotInfo(id);
            const left = cooling[id];
            return (
              <button
                key={id}
                type="button"
                className="slot"
                data-flash={flash === id}
                data-cooling={left !== undefined}
                onClick={() => eventBus.emit('weapon:cast', { slot: i })}
              >
                {/* Driven straight off the pushed value rather than a CSS
                    animation, so it can never drift from the game. Ten pushes
                    a second is choppy on its own; the transition in the
                    stylesheet fills the gaps. */}
                <i
                  className="slot__sweep"
                  style={{ transform: `scaleY(${(left ?? 0) / slot.cooldown})` }}
                />
                <Icon name={slot.icon} size={28} />
                <span className="slot__name">{slot.name}</span>
                <kbd>{left === undefined ? i + 1 : `${left.toFixed(1)}s`}</kbd>
              </button>
            );
          })}
        </div>
      )}

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
