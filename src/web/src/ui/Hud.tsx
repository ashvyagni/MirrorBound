import type { AbilitySlot } from '@/game/contracts';

import { Icon, weaponIcon } from './icons';
import { Key } from './Key';
import { Portrait } from './Portrait';
import { useUi } from './store';

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label?: string }) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`bar ${className}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ transform: `scaleX(${frac})` }} />
      {label !== undefined && <span className="bar__label">{label}</span>}
    </div>
  );
}

function Ability({ slot }: { slot: AbilitySlot }) {
  const frac = slot.cooldownTotal > 0 ? slot.cooldown / slot.cooldownTotal : 0;
  const blocked = !slot.ready && slot.blockedBy !== 'cooldown';
  return (
    <div
      className="ability"
      data-ready={slot.ready}
      data-blocked={blocked}
      title={`${slot.name} — ${slot.description} (${slot.cost} mana)`}
    >
      <Icon name={slot.icon} className="ability__icon" />
      {frac > 0 && (
        <span className="ability__cooldown" style={{ background: `conic-gradient(rgba(10,6,16,0.82) ${frac * 360}deg, transparent 0)` }} />
      )}
      {frac > 0 && <span className="ability__timer">{slot.cooldown >= 1 ? Math.ceil(slot.cooldown) : slot.cooldown.toFixed(1)}</span>}
      <kbd className="ability__key">{slot.slot}</kbd>
      <span className="ability__cost">{slot.cost}</span>
      <span className="ability__name">{slot.name}</span>
    </div>
  );
}

export function Hud() {
  const snap = useUi((s) => s.snapshot);
  const room = useUi((s) => s.room);
  const weapon = useUi((s) => s.playerDetail.weapon);
  const inventory = useUi((s) => s.playerDetail.inventory);
  const twinWeapon = useUi((s) => s.twinDetail.weapon);
  const campaign = useUi((s) => s.campaign);
  const nearbyNpc = useUi((s) => s.nearbyNpc);
  if (!snap) return null;
  const p = snap.player;
  const t = snap.twin;
  const boss = snap.enemies.find((e) => e.boss);
  const dungeon = snap.dungeon;
  const gateOpen = room?.doors.some((d) => d.side === 'north' && d.targetIndex !== null && !d.locked);
  const enemiesLeft = snap.enemies.length;
  const safe = room?.roomType === 'village';
  const potions = inventory?.consumables ?? [];
  const potionCount = (id: string) => potions.find((c) => c.id === id)?.count ?? 0;
  const potionReady = p.potionCooldown <= 0;

  return (
    <div className="hud" aria-live="off">
      {/* Top left: where you are */}
      <section className="hud__room panel">
        <div className="hud__room-name">{room?.name ?? '—'}</div>
        <div className="hud__room-sub">
          <span className="chip chip--dim">{room?.roomType ?? ''}</span>
          <span className="chip chip--dim">{room?.biome ?? ''}</span>
          {safe && <span className="chip chip--good">Safe</span>}
          {enemiesLeft > 0 && <span className="chip chip--warn">{enemiesLeft} hostile{enemiesLeft === 1 ? '' : 's'}</span>}
          {!safe && enemiesLeft === 0 && gateOpen && <span className="chip chip--good">Gate open · go north</span>}
          {safe && <span className="chip chip--dim">Roads out to the north</span>}
        </div>
        {dungeon && (
          <ol className="hud__path" aria-label="Dungeon progress">
            {dungeon.rooms.map((r) => (
              <li key={r.index} data-current={r.index === dungeon.currentIndex} data-done={r.cleared} data-type={r.type} title={`${r.name} (${r.type})`} />
            ))}
          </ol>
        )}
      </section>

      {/* Top centre: boss */}
      {boss && (
        <section className="hud__boss">
          <div className="hud__boss-name">{boss.name}{snap.boss ? ` · phase ${snap.boss.phase}` : ''}</div>
          <Bar value={boss.health} max={boss.maxHealth} className="bar--boss" />
        </section>
      )}

      {/* Top right: the twin. Nothing here until it has been found. */}
      {!t.dormant && (
      <section className="hud__twin panel" data-downed={t.state === 'downed'}>
        <Portrait atlas="bro" frame="idle-00" size={44} className="hud__twin-portrait" />
        <div className="hud__twin-body">
          <div className="hud__twin-head">
            <span className="hud__twin-name">{campaign?.twinName ?? 'Twin'}</span>
            <span className="chip chip--cool">{t.intent.intentType.toLowerCase()}</span>
          </div>
          <Bar value={t.health} max={t.maxHealth} className="bar--health bar--thin" />
          <div className="hud__twin-conf" title="Decision confidence">
            <span>{t.state === 'downed' ? `down · ${t.downedFor.toFixed(0)}s` : t.intent.reason}</span>
            <i style={{ width: `${Math.round(t.intent.confidence * 100)}%` }} />
          </div>
          {twinWeapon && <span className="hud__twin-weapon"><Icon name={weaponIcon(twinWeapon.family)} /> {twinWeapon.name}</span>}
        </div>
      </section>
      )}

      {/* Bottom left: you */}
      <section className="hud__player panel">
        <div className="hud__portrait-wrap">
          <Portrait atlas="goat" frame="face-normal" size={54} className="hud__portrait" />
          <span className="hud__level">{p.level}</span>
        </div>
        <div className="hud__vitals">
          <Bar value={p.health} max={p.maxHealth} className="bar--health" label={`${Math.ceil(p.health)} / ${Math.round(p.maxHealth)}`} />
          <Bar value={p.mana} max={p.maxMana} className="bar--mana" label={`${Math.floor(p.mana)} / ${Math.round(p.maxMana)}`} />
          <Bar value={p.xp} max={p.xpToNext} className="bar--xp" label={p.skillPoints > 0 ? `${p.skillPoints} skill point${p.skillPoints > 1 ? 's' : ''} · K` : `${p.xp} / ${p.xpToNext} xp`} />
        </div>
      </section>

      {/* Bottom centre: abilities */}
      <section className="hud__abilities">
        {p.abilities.map((a) => <Ability key={a.slot} slot={a} />)}
      </section>

      {/* Bottom right: weapon and resources */}
      <section className="hud__loadout panel">
        <div className="hud__weapon" title={weapon?.description}>
          <Icon name={weaponIcon(weapon?.family ?? 'sword')} className="hud__weapon-icon" />
          <div>
            <div className="hud__weapon-name">{weapon?.name ?? p.currentWeapon}</div>
            <div className="hud__weapon-meta">
              {p.comboLength > 1 && (
                <span className="chain">
                  {Array.from({ length: p.comboLength }, (_, i) => <i key={i} data-on={i < p.comboStep} />)}
                </span>
              )}
              <kbd>J</kbd>
            </div>
          </div>
        </div>
        <div className="hud__resources">
          <span title="Gold"><Icon name="essence" /> {inventory?.gold ?? 0}</span>
          <span
            className="hud__potion"
            data-ready={potionReady && potionCount('health_potion') > 0}
            title="Health potion"
          >
            <Icon name="health_potion" /> {potionCount('health_potion')} <Key of="healthPotion" />
          </span>
          <span
            className="hud__potion"
            data-ready={potionReady && potionCount('mana_potion') > 0}
            title="Mana potion"
          >
            <Icon name="mana_potion" /> {potionCount('mana_potion')} <Key of="manaPotion" />
          </span>
        </div>
      </section>

      {/* Standing next to someone: the one prompt the world ever shows. */}
      {nearbyNpc && (
        <div className="hud__prompt">
          <Key of="interact" /> Talk to {nearbyNpc.name}
        </div>
      )}

      {/* What you are in the middle of, when it is worth saying. */}
      {(p.drinking || p.channelling) && (
        <div className="hud__casting">
          {p.drinking ? 'Drinking…' : 'Channelling…'}
        </div>
      )}

      {/* Read off the live bindings, so a rebound key is the key it names. */}
      <div className="hud__hint">
        <Key of="moveUp" /><Key of="moveLeft" /><Key of="moveDown" /><Key of="moveRight" /> move
        · <Key of="run" /> run · <Key of="attack" /> attack · <kbd>1-4</kbd> abilities
        · <Key of="healthPotion" />/<Key of="manaPotion" /> potions · <Key of="swapWeapon" /> swap
        · <Key of="character" /> character · <Key of="inventory" /> bag · <Key of="skills" /> skills
        · <Key of="map" /> map · <Key of="pause" /> pause · <Key of="debug" /> AI view
      </div>
    </div>
  );
}
