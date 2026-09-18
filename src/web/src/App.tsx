import { AnimatedMark } from './ui/AnimatedMark';
import { CompanionPanel } from './ui/CompanionPanel';
import { ControlsPanel } from './ui/ControlsPanel';
import { DevTools } from './ui/DevTools';
import { GameMount } from './ui/GameMount';
import { LoadoutPanel } from './ui/LoadoutPanel';
import { usePlayerSnapshot } from './ui/usePlayerSnapshot';

export default function App() {
  const snapshot = usePlayerSnapshot();

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__brand">
          <AnimatedMark />
          <div>
            <h1 className="masthead__title">Mirrorbound</h1>
            <p className="masthead__sub">Character sandbox</p>
          </div>
        </div>
        <span className="pill" data-live={snapshot !== null}>
          {snapshot ? snapshot.state : 'loading'}
        </span>
      </header>

      <main className="stage-grid">
        <div className="stage-col">
          <GameMount />
          <p className="stage-caption">
            Move with the arrow keys. Arm the goat from the loadout and press
            <kbd>J</kbd> — the sword chains through three swings if you keep going.
          </p>
        </div>

        <aside className="rail">
          <LoadoutPanel />
          <ControlsPanel />
          <CompanionPanel />
        </aside>
      </main>

      <footer className="footer">
        <DevTools snapshot={snapshot} />
      </footer>
    </div>
  );
}
