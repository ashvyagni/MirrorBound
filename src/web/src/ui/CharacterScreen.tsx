/**
 * The Character screen (C): who you are in a fight, on one page.
 *
 * Everything here is read from the authoritative snapshot and every change is
 * a command the server may refuse. Nothing is computed locally, so this screen
 * and the Inventory screen can never disagree -- they are two views of the
 * same server state, not two copies of it.
 */

import type { AbilitySlot, WeaponInfo } from '@/game/contracts';
import { keyName, keybinds } from '@/game/state/Keybinds';

import { Icon, weaponIcon } from './icons';
import { Key } from './Key';
import { Portrait } from './Portrait';
import { askForNames, command, openScreen, useUi } from './store';

function WeaponCard({ weapon, held, onEquip }: {
  weapon: WeaponInfo; held: 'main' | 'off' | null; onEquip: () => void;
}) {
  return (
    <button
      type="button"
      className="gear"
      data-held={held ?? undefined}
      onClick={onEquip}
      disabled={held === 'main'}
      title={weapon.description}
    >
      <Icon name={weaponIcon(weapon.family)} className="gear__icon" />
      <span className="gear__body">
        <span className="gear__name">{weapon.name}</span>
        <span className="gear__meta">
          {weapon.damage} dmg · {weapon.type}
          {weapon.comboLength > 1 ? ` · ${weapon.comboLength}-hit chain` : ''}
        </span>
      </span>
      <span className="gear__state">
        {held === 'main' ? 'In hand' : held === 'off' ? 'Carried' : 'Equip'}
      </span>
    </button>
  );
}

function AbilitySlotRow({ slot }: { slot: AbilitySlot }) {
  return (
    <div className="slotrow">
      <kbd className="slotrow__key">{slot.slot}</kbd>
      <Icon name={slot.icon} className="slotrow__icon" />
      <div className="slotrow__body">
        <div className="slotrow__name">{slot.name}</div>
        <div className="slotrow__desc">{slot.description}</div>
      </div>
      <span className="slotrow__cost">{slot.cost} mana</span>
    </div>
  );
}

export function CharacterScreen() {
  const screen = useUi((s) => s.screen);
  const snap = useUi((s) => s.snapshot);
  const inventory = useUi((s) => s.playerDetail.inventory);
  const stats = useUi((s) => s.playerDetail.stats);
  const campaign = useUi((s) => s.campaign);
  const twinWeapon = useUi((s) => s.twinDetail.weapon);
  if (screen !== 'character' || !snap) return null;

  const p = snap.player;
  const twin = snap.twin;
  const weapons = inventory?.weapons ?? [];
  const equipped = inventory?.equippedWeapon ?? p.currentWeapon;
  const offhand = inventory?.offhandWeapon ?? '';
  const potions = inventory?.consumables ?? [];
  const xpFrac = p.xpToNext > 0 ? Math.min(1, p.xp / p.xpToNext) : 0;

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--xl sheet">
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">
              {campaign?.playerName ?? 'Wanderer'}
              {/* The opening prompt promises this is where the name can be
                  changed, so it has to actually be here. The server owns the
                  result: it sanitises, and the heading above re-renders from
                  the snapshot rather than from what was typed. */}
              <button
                type="button"
                className="dialog__rename"
                title="Change your name"
                onClick={() => askForNames('player')}
              >
                rename
              </button>
            </h2>
            <p className="dialog__muted">Level {p.level} · {campaign?.seals.length ?? 0} seal{(campaign?.seals.length ?? 0) === 1 ? '' : 's'} taken</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>Close <Key of="character" /></button>
        </header>

        <div className="sheet__grid">
          {/* Left: the body and its numbers. */}
          <section className="sheet__col">
            <div className="sheet__portrait">
              <Portrait atlas="goat" frame="face-normal" size={88} />
              <div className="sheet__vitals">
                <div className="statline"><span>Health</span><b>{Math.ceil(p.health)} / {Math.round(p.maxHealth)}</b></div>
                <div className="statline"><span>Mana</span><b>{Math.floor(p.mana)} / {Math.round(p.maxMana)}</b></div>
                <div className="statline"><span>Gold</span><b>{inventory?.gold ?? 0}</b></div>
              </div>
            </div>
            <div className="sheet__xp">
              <div className="bar bar--xp"><i style={{ transform: `scaleX(${xpFrac})` }} /></div>
              <span>{p.xp} / {p.xpToNext} xp{p.skillPoints > 0 ? ` · ${p.skillPoints} skill point${p.skillPoints > 1 ? 's' : ''} (${keyName(keybinds.get('skills').primary)})` : ''}</span>
            </div>
            <h3 className="sheet__h">Standing</h3>
            <dl className="statgrid">
              <div><dt>Weapon damage</dt><dd>{Math.round((stats?.weaponDamageMult ?? 1) * 100)}%</dd></div>
              <div><dt>Spell damage</dt><dd>{Math.round((stats?.spellDamageMult ?? 1) * 100)}%</dd></div>
              <div><dt>Damage taken</dt><dd>{Math.round((stats?.damageTakenMult ?? 1) * 100)}%</dd></div>
              <div><dt>Crit chance</dt><dd>{Math.round((stats?.critChance ?? 0) * 100)}%</dd></div>
              <div><dt>Move speed</dt><dd>{stats?.speed ?? '—'}</dd></div>
              <div><dt>Mana regen</dt><dd>{stats?.manaRegen ?? '—'}/s</dd></div>
            </dl>
          </section>

          {/* Middle: what you are holding. */}
          <section className="sheet__col">
            <h3 className="sheet__h">Carried</h3>
            <p className="dialog__muted sheet__hint">Two weapons at a time. <Key of="swapWeapon" /> swaps them.</p>
            <div className="gearlist">
              {weapons.map((w) => (
                <div key={w.id}>
                <WeaponCard
                  weapon={w}
                  held={w.id === equipped ? 'main' : w.id === offhand ? 'off' : null}
                  onEquip={() => command({ action: 'EQUIP_WEAPON', weaponId: w.id })}
                />
                {!snap.twin.dormant && <button type="button" className="btn btn--small"
                  disabled={snap.twin.state === 'downed'}
                  onClick={() => command({ action: 'TWIN_EQUIP', weaponId: w.id })}>Give to twin</button>}
                </div>
              ))}
              {weapons.length === 0 && <p className="dialog__muted">Nothing but your hands.</p>}
            </div>

            <h3 className="sheet__h">Potions</h3>
            <div className="potionrow">
              {potions.length === 0 && <p className="dialog__muted">No potions. The apothecary sells them.</p>}
              {potions.map((c) => (
                <div key={c.id} className="potion">
                  <Icon name={c.id === 'mana_potion' ? 'mana_potion' : 'health_potion'} />
                  <span className="potion__count">{c.count}</span>
                  <span className="potion__name">{c.name}</span>
                  <Key of={c.id === 'mana_potion' ? 'manaPotion' : 'healthPotion'} />
                </div>
              ))}
            </div>
          </section>

          {/* Right: abilities and the twin. */}
          <section className="sheet__col">
            <h3 className="sheet__h">Abilities</h3>
            <div className="slotlist">
              <p className="dialog__muted">Abilities come from your equipped and carried weapons. Change weapons to change this list.</p>
              {p.abilities.map((a) => <AbilitySlotRow key={a.slot} slot={a} />)}
            </div>

            <h3 className="sheet__h">
              {twin.dormant ? 'Your twin' : (campaign?.twinName ?? 'Your twin')}
              {!twin.dormant && (
                <button
                  type="button"
                  className="dialog__rename"
                  title="Change its name"
                  onClick={() => askForNames('twin')}
                >
                  rename
                </button>
              )}
            </h3>
            {twin.dormant ? (
              <p className="dialog__muted">Not found yet. Something in the Wakewood Crypt moves like you do.</p>
            ) : (
              <div className="twincard">
                <Portrait atlas="bro" frame="idle-00" size={44} />
                <div className="twincard__body">
                  <div className="statline"><span>Health</span><b>{Math.ceil(twin.health)} / {Math.round(twin.maxHealth)}</b></div>
                  <div className="statline"><span>Holding</span><b>{twinWeapon?.name ?? twin.currentWeapon}</b></div>
                  <div className="statline"><span>Doing</span><b>{twin.intent.intentType.toLowerCase()}</b></div>
                  <div className="statline"><span>Kills</span><b>{twin.kills}</b></div>
                </div>
              </div>
            )}
            {!twin.dormant && (twin.inventory?.weapons.length ?? 0) > 1 && (
              <div className="gearlist gearlist--tight">
                <p className="dialog__muted sheet__hint">It picked these up. Ask for one and it hands it over.</p>
                {twin.inventory?.weapons
                  .filter((w) => w.id !== twin.inventory?.equippedWeapon)
                  .map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className="gear"
                      onClick={() => command({ action: 'TWIN_REQUEST', weaponId: w.id })}
                    >
                      <Icon name={weaponIcon(w.family)} className="gear__icon" />
                      <span className="gear__body"><span className="gear__name">{w.name}</span></span>
                      <span className="gear__state">Ask for it</span>
                    </button>
                  ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
