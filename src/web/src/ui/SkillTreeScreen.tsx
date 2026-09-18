import type { SkillNode } from '@/game/contracts';
import { eventBus } from '@/game/EventBus';

import { openScreen, useUi } from './store';

const CATEGORIES: Array<{ id: SkillNode['category']; label: string; blurb: string }> = [
  { id: 'MOBILITY', label: 'Mobility', blurb: 'Move faster, dash more.' },
  { id: 'COMBAT', label: 'Combat', blurb: 'Hit harder with weapons.' },
  { id: 'MAGIC', label: 'Magic', blurb: 'More mana, stronger spells.' },
  { id: 'SURVIVAL', label: 'Survival', blurb: 'Stay standing.' },
];

export function SkillTreeScreen() {
  const screen = useUi((s) => s.screen);
  const snap = useUi((s) => s.snapshot);
  const tree = useUi((s) => s.playerDetail.skillTree);
  if (screen !== 'skills' || !snap) return null;
  const points = snap.player.skillPoints;

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--xl">
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">Skills</h2>
            <p className="dialog__muted">{points > 0 ? `${points} skill point${points > 1 ? 's' : ''} to spend` : 'Level up to earn skill points'}</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>Close <kbd>K</kbd></button>
        </header>
        <div className="tree">
          {CATEGORIES.map((cat) => (
            <section key={cat.id} className="tree__branch" data-category={cat.id}>
              <h3 className="tree__title">{cat.label}<small>{cat.blurb}</small></h3>
              {tree.filter((n) => n.category === cat.id).sort((a, b) => a.tier - b.tier).map((node, i) => (
                <div key={node.id} className="node-wrap">
                  {i > 0 && <span className="node__link" data-on={node.unlocked || node.available} />}
                  <button
                    type="button"
                    className="node"
                    data-unlocked={node.unlocked}
                    data-available={node.available}
                    disabled={!node.available}
                    title={node.unlocked ? 'Unlocked' : node.reason}
                    onClick={() => eventBus.emit('ui:command', { type: 'COMMAND', action: 'UNLOCK_SKILL', skillId: node.id })}
                  >
                    <span className="node__tier">{['I', 'II', 'III'][node.tier - 1]}</span>
                    <span className="node__name">{node.name}</span>
                    <span className="node__desc">{node.description}</span>
                    <span className="node__cost">{node.unlocked ? 'Unlocked' : node.available ? `Unlock · ${node.cost} pt` : node.reason}</span>
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
