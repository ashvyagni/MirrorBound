import { useEffect, useState } from 'react';

import { slotInfo, WEAPONS, WEAPON_ORDER, type SlotId, type WeaponId } from '@/game/animation/weaponClips';
import { eventBus } from '@/game/EventBus';
import { POTIONS, type LoadoutSnapshot } from '@/game/state/Loadout';

import { Icon } from './Icon';
import { useCooldowns } from './useCooldowns';

/**
 * What is carried, and what goes in each hand.
 *
 * This is the inventory: the plate in the game only swaps between the two
 * hands, so choosing *which* two is the thing that has to live somewhere with
 * room to show every weapon at once. Assigning still only emits intent and
 * renders what the scene reports back, which keeps one source of truth for what
 * is actually in hand rather than a React copy that can drift from it.
 */
export function LoadoutPanel() {
  const [loadout, setLoadout] = useState<LoadoutSnapshot | null>(null);
  const [combo, setCombo] = useState({ step: 0, length: 0 });
  const [flash, setFlash] = useState<SlotId | null>(null);
  const cooling = useCooldowns();

  useEffect(() => eventBus.on('loadout:changed', setLoadout), []);

  useEffect(
    () => eventBus.on('weapon:changed', ({ step, length }) => setCombo({ step, length })),
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

  const equipped = loadout ? loadout.weapons[loadout.active] ?? null : null;
  const abilities = equipped ? WEAPONS[equipped].abilities : [];

  /**
   * Put a weapon in a named hand, or take it out again.
   *
   * Named rather than "whichever hand is free": the two slots are bound to Q
   * and E in the game, so which one a weapon goes into is the whole decision
   * being made here. Clicking the slot a weapon is already in empties it.
   */
  const assign = (slot: 0 | 1, id: WeaponId) => {
    if (!loadout) return;
    eventBus.emit('loadout:set-slot', {
      slot,
      id: loadout.weapons[slot] === id ? null : id,
    });
  };

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

      <div className="hands">
        {([0, 1] as const).map((slot) => {
          const id = loadout?.weapons[slot] ?? null;
          const active = loadout?.active === slot;
          return (
            <button
              key={slot}
              type="button"
              className="hand"
              data-active={active}
              aria-pressed={active}
              onClick={() => eventBus.emit('loadout:select', { slot })}
              title={active ? 'In hand' : 'Draw from this hand'}
            >
              <kbd className="hand__key">{slot === 0 ? 'Q' : 'E'}</kbd>
              {id ? <Icon name={WEAPONS[id].icon} size={30} /> : <span className="hand__empty" />}
              <span className="hand__name">{id ? WEAPONS[id].name : 'Empty'}</span>
            </button>
          );
        })}
      </div>

      <p className="hint">
        Two at a time. <kbd>Q</kbd> and <kbd>E</kbd> draw from each hand; the
        buttons below decide what is in them.
      </p>

      <div className="weapons">
        {WEAPON_ORDER.map((id) => {
          const weapon = WEAPONS[id];
          const carried = loadout?.weapons.indexOf(id) ?? -1;
          return (
            <div key={id} className="weapon" data-active={carried !== -1}>
              <Icon name={weapon.icon} size={34} />
              <span className="weapon__text">
                <span className="weapon__name">{weapon.name}</span>
                <span className="weapon__blurb">{weapon.blurb}</span>
              </span>
              <span className="weapon__slots">
                {([0, 1] as const).map((slot) => {
                  const here = loadout?.weapons[slot] === id;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className="weapon__slot"
                      data-on={here}
                      aria-pressed={here}
                      onClick={() => assign(slot, id)}
                      title={here ? `Remove from hand ${slot + 1}` : `Put in hand ${slot + 1}`}
                    >
                      {slot === 0 ? 'Q' : 'E'}
                    </button>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>

      {loadout && (
        <div className="potions">
          <h3 className="slots__title">Potions</h3>
          {POTIONS.map((potion, i) => {
            const count = loadout.counts[potion.id] ?? 0;
            return (
              <button
                key={potion.id}
                type="button"
                className="potion"
                data-active={loadout.potionIndex === i}
                data-empty={count === 0}
                onClick={() => eventBus.emit('loadout:use-potion', {})}
                onMouseEnter={() => {
                  if (loadout.potionIndex !== i) {
                    eventBus.emit('loadout:cycle-potion', { step: 1 });
                  }
                }}
              >
                <Icon name={potion.heal ? 'fireBall' : 'iceNova'} size={24} />
                <span className="potion__name">{potion.name}</span>
                <kbd>{count}</kbd>
              </button>
            );
          })}
          <p className="hint"><kbd>R</kbd> turns the dial, <kbd>F</kbd> drinks.</p>
        </div>
      )}

      {abilities.length > 0 && (
        <div className="slots">
          <h3 className="slots__title">Abilities</h3>
          {abilities.map((id, i) => {
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
                <span className="slot__cost">{slot.cost > 0 ? `${slot.cost} mp` : ''}</span>
                <kbd>{left === undefined ? i + 1 : `${left.toFixed(1)}s`}</kbd>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
