import { eventBus } from '@/game/EventBus';

import { AnimatedMark } from './AnimatedMark';
import { Key } from './Key';
import { openScreen, useUi } from './store';

export function ConnectionOverlay() {
  const connection = useUi((s) => s.connection);
  const attempt = useUi((s) => s.attempt);
  const message = useUi((s) => s.connectionMessage);
  const ready = useUi((s) => s.ready);
  const snapshot = useUi((s) => s.snapshot);
  if (!ready || (connection === 'open' && snapshot)) return null;
  const failing = connection === 'closed' || connection === 'error';
  return (
    <div className="overlay overlay--dim">
      <div className="dialog">
        <AnimatedMark />
        <h2 className="dialog__title">{message ? 'Save opened elsewhere' : failing ? 'Cannot reach the game server' : 'Connecting to the world'}</h2>
        <p className="dialog__text">
          {message ?? (failing
            ? 'The browser is the view; the Python server is the world. Start it and this page will reconnect on its own.'
            : 'Waiting for the first snapshot from the simulation…')}
        </p>
        {failing && !message && (
          <pre className="dialog__code">{`cd apps/server\npython -m uvicorn mirrorbound.api.app:create_app --factory --port 8000`}</pre>
        )}
        {attempt > 0 && <p className="dialog__muted">Reconnect attempt {attempt}</p>}
      </div>
    </div>
  );
}

export function DeathOverlay() {
  const snap = useUi((s) => s.snapshot);
  if (!snap || snap.phase !== 'dead') return null;
  return (
    <div className="overlay overlay--death">
      <div className="death">
        <h2 className="death__title">You fell</h2>
        <p className="death__text">Your twin watched. It will remember. Respawning in {Math.max(0, snap.player.respawnIn).toFixed(0)}s…</p>
      </div>
    </div>
  );
}

export function VictoryOverlay() {
  const snap = useUi((s) => s.snapshot);
  if (!snap || snap.phase !== 'victory') return null;
  const s = snap.stats;
  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--wide">
        <AnimatedMark />
        <h2 className="dialog__title">The Mirror is broken</h2>
        <p className="dialog__text">It learned how you fight. You fought differently anyway.</p>
        <dl className="statgrid">
          <div><dt>Time</dt><dd>{Math.floor(s.seconds / 60)}:{String(Math.floor(s.seconds % 60)).padStart(2, '0')}</dd></div>
          <div><dt>Enemies</dt><dd>{s.enemiesKilled}</dd></div>
          <div><dt>Rooms</dt><dd>{s.roomsCleared}</dd></div>
          <div><dt>Damage dealt</dt><dd>{s.damageDealt}</dd></div>
          <div><dt>Damage taken</dt><dd>{s.damageTaken}</dd></div>
          <div><dt>Essence</dt><dd>{s.essenceCollected}</dd></div>
          <div><dt>Twin kills</dt><dd>{snap.twin.kills}</dd></div>
          <div><dt>Level</dt><dd>{snap.player.level}</dd></div>
        </dl>
        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={() => eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESTART' })}>
            Play again (same seed)
          </button>
          <button type="button" className="btn" onClick={() => eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESTART', seed: Math.floor(Math.random() * 1e9) })}>
            New dungeon
          </button>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu() {
  const screen = useUi((s) => s.screen);
  const fullscreen = useUi((s) => s.fullscreen);
  if (screen !== 'pause') return null;
  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--menu">
        <div className="dialog__brand"><AnimatedMark /><div><h2 className="dialog__title">Paused</h2><p className="dialog__muted">Mirrorbound</p></div></div>
        <nav className="menu">
          <button type="button" className="menu__item" onClick={() => openScreen('none')}>Resume <Key of="pause" /></button>
          <button type="button" className="menu__item" onClick={() => openScreen('character')}>Character <Key of="character" /></button>
          <button type="button" className="menu__item" onClick={() => openScreen('inventory')}>Inventory <Key of="inventory" /></button>
          <button type="button" className="menu__item" onClick={() => openScreen('skills')}>Skills <Key of="skills" /></button>
          <button type="button" className="menu__item" onClick={() => openScreen('map')}>World map <Key of="map" /></button>
          <button type="button" className="menu__item" onClick={() => openScreen('settings')}>Settings</button>
          <button type="button" className="menu__item" onClick={() => openScreen('controls')}>Controls</button>
          <button type="button" className="menu__item" onClick={() => eventBus.emit('game:toggle-fullscreen', {})}>
            {fullscreen ? 'Leave fullscreen' : 'Fullscreen'}
          </button>
          <button type="button" className="menu__item menu__item--danger" onClick={() => { eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESTART' }); openScreen('none'); }}>
            Restart run
          </button>
        </nav>
      </div>
    </div>
  );
}
