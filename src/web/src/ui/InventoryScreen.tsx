import { useState } from 'react';

import type { WeaponInfo } from '@/game/contracts';
import { eventBus } from '@/game/EventBus';

import { hasItemArt, Icon, weaponIcon } from './icons';
import { Portrait } from './Portrait';
import { openScreen, useUi } from './store';

function command(payload: Parameters<typeof eventBus.emit<'ui:command'>>[1]) {
  eventBus.emit('ui:command', payload);
}

function WeaponCard({ weapon, equipped, onEquip, action }: { weapon: WeaponInfo; equipped: boolean; onEquip: () => void; action: string }) {
  return (
    <button type="button" className="item" data-active={equipped} data-rarity={weapon.rarity} onClick={onEquip} aria-pressed={equipped}>
      <Icon name={weaponIcon(weapon.family)} className="item__icon" />
      <div className="item__body">
        <div className="item__head">
          <span className="item__name">{weapon.name}</span>
          <span className="item__rarity">{weapon.rarity}</span>
        </div>
        <p className="item__desc">{weapon.description}</p>
        <div className="item__stats">
          <span>{weapon.damage} dmg</span>
          <span>{(1 / weapon.cooldown).toFixed(1)}/s</span>
          <span>{weapon.range} range</span>
          {weapon.resourceCost > 0 && <span>{weapon.resourceCost} mana</span>}
          {weapon.comboLength > 1 && <span>{weapon.comboLength}-hit</span>}
        </div>
        <div className="item__tags">{weapon.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      </div>
      <span className="item__action">{equipped ? 'Equipped' : action}</span>
    </button>
  );
}

export function InventoryScreen() {
  const screen = useUi((s) => s.screen);
  const snap = useUi((s) => s.snapshot);
  const detail = useUi((s) => s.playerDetail);
  const twinDetail = useUi((s) => s.twinDetail);
  const [tab, setTab] = useState<'player' | 'twin'>('player');
  if (screen !== 'inventory' || !snap) return null;
  const inv = detail.inventory;
  const p = snap.player;
  const t = snap.twin;
  const twinDims = snap.twinModel.dims;

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--xl">
        <header className="dialog__head">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tab" aria-selected={tab === 'player'} onClick={() => setTab('player')}>
              <Portrait atlas="goat" frame="face-normal" size={26} /> You
            </button>
            <button type="button" role="tab" className="tab" aria-selected={tab === 'twin'} onClick={() => setTab('twin')}>
              <Portrait atlas="bro" frame="idle-00" size={26} /> Twin
            </button>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>Close <kbd>I</kbd></button>
        </header>

        {tab === 'player' && inv && (
          <div className="inventory">
            <section className="inventory__col">
              <h3 className="section__title">Weapons</h3>
              <div className="items">
                {inv.weapons.map((w) => (
                  <WeaponCard key={w.id} weapon={w} equipped={inv.equippedWeapon === w.id} action="Equip"
                    onEquip={() => command({ type: 'COMMAND', action: 'EQUIP_WEAPON', weaponId: w.id })} />
                ))}
              </div>
              <h3 className="section__title">Abilities</h3>
              <div className="slots">
                {p.abilities.map((a) => (
                  <div key={a.slot} className="slot" title={a.description}>
                    <Icon name={a.icon} className="slot__icon" />
                    <div><div className="slot__name">{a.name}</div><div className="slot__meta">{a.cost} mana · {a.cooldownTotal.toFixed(1)}s</div></div>
                    <kbd>{a.slot}</kbd>
                  </div>
                ))}
              </div>
            </section>
            <section className="inventory__col">
              <h3 className="section__title">Consumables</h3>
              <div className="items">
                {inv.consumables.length === 0 && <p className="empty">Nothing yet. Enemies and chests drop potions.</p>}
                {inv.consumables.map((c) => (
                  <button type="button" key={c.id} className="item item--row" onClick={() => command({ type: 'COMMAND', action: 'USE_ITEM', itemId: c.id })}>
                    <Icon name={c.id} className="item__icon" />
                    <div className="item__body"><span className="item__name">{c.name} <em>×{c.count}</em></span><p className="item__desc">{c.description}</p></div>
                    <span className="item__action">Use</span>
                  </button>
                ))}
              </div>
              <h3 className="section__title">Resources</h3>
              <div className="resources">
                <span><Icon name="essence" /> Essence <b>{inv.resources.essence ?? 0}</b></span>
                <span><Icon name="shards" /> Mirror shards <b>{inv.resources.shards ?? 0}</b></span>
              </div>
              <h3 className="section__title">Relics</h3>
              <div className="items">
                {inv.relics.length === 0 && <p className="empty">Relics are rare drops from elites and the vault.</p>}
                {inv.relics.map((r) => (
                  <div key={r.id} className="item item--row" data-rarity={r.rarity}>
                    {/* The three relics Logesh drew are named by their own ids;
                        anything else falls back to the generic ring. */}
                    <Icon name={hasItemArt(r.id) ? r.id : 'relic'} className="item__icon" />
                    <div className="item__body"><span className="item__name">{r.name}</span><p className="item__desc">{r.description}</p></div>
                  </div>
                ))}
              </div>
              {detail.stats && (
                <>
                  <h3 className="section__title">Stats</h3>
                  <dl className="statgrid statgrid--compact">
                    <div><dt>Speed</dt><dd>{detail.stats.speed}</dd></div>
                    <div><dt>Weapon dmg</dt><dd>×{detail.stats.weaponDamageMult}</dd></div>
                    <div><dt>Spell dmg</dt><dd>×{detail.stats.spellDamageMult}</dd></div>
                    <div><dt>Crit</dt><dd>{Math.round(detail.stats.critChance * 100)}%</dd></div>
                    <div><dt>Dmg taken</dt><dd>×{detail.stats.damageTakenMult}</dd></div>
                    <div><dt>Mana regen</dt><dd>{detail.stats.manaRegen}/s</dd></div>
                  </dl>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'twin' && (
          <div className="inventory">
            <section className="inventory__col">
              <h3 className="section__title">Twin's weapon</h3>
              <p className="dialog__muted">Give your twin any weapon you own. Ranged weapons keep it at a distance; the sword makes it wade in.</p>
              <div className="items">
                {(inv?.weapons ?? []).map((w) => (
                  <WeaponCard key={w.id} weapon={w} equipped={t.currentWeapon === w.id} action="Give to twin"
                    onEquip={() => command({ type: 'COMMAND', action: 'TWIN_EQUIP', weaponId: w.id })} />
                ))}
                {twinDetail.weapon && !(inv?.weapons ?? []).some((w) => w.id === twinDetail.weapon?.id) && (
                  <WeaponCard weapon={twinDetail.weapon} equipped action="" onEquip={() => undefined} />
                )}
              </div>
            </section>
            <section className="inventory__col">
              <h3 className="section__title">Record</h3>
              <dl className="statgrid statgrid--compact">
                <div><dt>Health</dt><dd>{Math.ceil(t.health)} / {t.maxHealth}</dd></div>
                <div><dt>Kills</dt><dd>{t.kills}</dd></div>
                <div><dt>Damage dealt</dt><dd>{t.damageDealt}</dd></div>
                <div><dt>Damage taken</dt><dd>{t.damageTaken}</dd></div>
              </dl>
              <h3 className="section__title">Learned preferences</h3>
              <p className="dialog__muted">What your twin has picked up — from watching you, and from what worked for it.</p>
              <div className="dims">
                {Object.entries(twinDims).map(([name, d]) => (
                  <div key={name} className="dim" title={`${d.samples} samples`}>
                    <span className="dim__name">{name.replace(/_/g, ' ')}</span>
                    <span className="dim__bar"><i style={{ width: `${Math.round(d.value * 100)}%`, opacity: 0.35 + d.confidence * 0.65 }} /></span>
                    <span className="dim__conf">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
              {snap.twinModel.lessons.length > 0 && (
                <ul className="lessons">
                  {snap.twinModel.lessons.slice(-4).map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
