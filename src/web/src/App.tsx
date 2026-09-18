import { AnimationDock } from './ui/AnimationDock';
import { CompanionDock } from './ui/CompanionDock';
import { GameMount } from './ui/GameMount';
import { StatusPanel } from './ui/StatusPanel';
import { usePlayerSnapshot } from './ui/usePlayerSnapshot';

export default function App() {
  const snapshot = usePlayerSnapshot();

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <h1 className="masthead__title">Mirrorbound</h1>
          <p className="masthead__sub">Character sandbox · goat & companion</p>
        </div>
        <span className="masthead__badge">
          {snapshot ? snapshot.state : 'booting'}
        </span>
      </header>

      <main className="layout">
        <GameMount />
        <aside className="sidebar">
          <StatusPanel snapshot={snapshot} />
          <AnimationDock active={snapshot?.clip ?? null} />
          <CompanionDock />
        </aside>
      </main>
    </div>
  );
}
