import { SKILLNODES_TEXTURE_KEY } from '@/game/animation/skillNodesAtlas.generated';
import type { SkillNode } from '@/game/contracts';
import { eventBus } from '@/game/EventBus';

import { Portrait } from './Portrait';
import { command, openScreen, useUi } from './store';
import { Key } from './Key';

/**
 * `emblem` is the frame name on Logesh's `skillNodes` sheet, which draws one
 * per branch under exactly these four names in lower case.
 */
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
  const room = useUi((s) => s.room);
  if (screen !== 'skills' || !snap) return null;
  const points = snap.player.skillPoints;
  // Unlearning is a village service, the same as resting and shopping. The
  // server enforces both of these; showing the reason is what stops the
  // button reading as broken.
  const learned = tree.some((n) => n.unlocked);
  const inVillage = room?.roomType === 'village';
  const canRespec = learned && inVillage && snap.enemies.length === 0;

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--xl">
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">Skills</h2>
            <p className="dialog__muted">{points > 0 ? `${points} skill point${points > 1 ? 's' : ''} to spend` : 'Level up to earn skill points'}</p>
          </div>
          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!canRespec}
              title={
                !learned ? 'Nothing learned yet'
                  : !inVillage ? 'Only in a village'
                    : snap.enemies.length > 0 ? 'Not in a fight'
                      : 'Take every point back and start the tree over'
              }
              onClick={() => command({ action: 'RESPEC' })}
            >
              Unlearn all
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>Close <Key of="skills" /></button>
          </div>
        </header>
        <div className="tree">
          {CATEGORIES.map((cat) => (
            <section key={cat.id} className="tree__branch" data-category={cat.id}>
              <h3 className="tree__title">
                <Portrait atlas={SKILLNODES_TEXTURE_KEY} frame={cat.id.toLowerCase()} size={22} />
                {cat.label}<small>{cat.blurb}</small>
              </h3>
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
