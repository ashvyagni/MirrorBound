const KEYS: Array<[string, string]> = [
  ['← →', 'Move'],
  ['Shift', 'Run'],
  ['Space', 'Jump — hold for height'],
  ['J', 'Attack'],
  ['K', 'Companion'],
  ['1 2 3', 'Weapon abilities'],
];

export function ControlsPanel() {
  return (
    <section className="card">
      <header className="card__head">
        <h2 className="card__title">Controls</h2>
      </header>
      <dl className="keys">
        {KEYS.map(([key, action]) => (
          <div key={key} className="keys__row">
            <dt><kbd>{key}</kbd></dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <p className="card__note">
        Arrow keys or <kbd>A</kbd>&thinsp;<kbd>D</kbd>. <kbd>W</kbd> also jumps.
      </p>
    </section>
  );
}
