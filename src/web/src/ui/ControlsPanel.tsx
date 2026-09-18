const KEYS: Array<[string, string]> = [
  ['← ↑ ↓ →', 'Move'],
  ['Shift', 'Run'],
  ['J  /  M1', 'Attack'],
  ['K', 'Companion'],
  ['1 2 3', 'Weapon abilities'],
  ['Q  E', 'Switch weapon'],
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
        Arrow keys or <kbd>W</kbd>&thinsp;<kbd>A</kbd>&thinsp;<kbd>S</kbd>&thinsp;<kbd>D</kbd>.
        You face the way you walk, and everything you throw goes that way.
        The bar along the bottom of the game does the same job, and stays with
        you in fullscreen.
      </p>
    </section>
  );
}
