/**
 * The world map (M): where you are, where you have been, where you may go.
 *
 * Drawn from the campaign block in the snapshot, which is the same state the
 * server routes travel against -- so an area drawn as locked is locked, and
 * clicking one that is open sends a TRAVEL command the server may still
 * refuse (it only honours travel from a village, and says so).
 *
 * Undiscovered areas are drawn as blanks rather than omitted, so the shape of
 * what is left is visible without spoiling what it is.
 */

import type { AreaSnap } from '@/game/contracts';

import { Key } from './Key';

import { command, openScreen, useUi } from './store';

function markerKind(area: AreaSnap): string {
  if (!area.discovered) return 'unknown';
  if (area.kind === 'village') return 'village';
  return area.completed ? 'dungeon-done' : 'dungeon';
}

export function MapScreen() {
  const screen = useUi((s) => s.screen);
  const campaign = useUi((s) => s.campaign);
  const room = useUi((s) => s.room);
  if (screen !== 'map' || !campaign) return null;

  const inVillage = room?.roomType === 'village';
  const areas = campaign.areas;
  // Roads between areas, drawn only between two places you have found.
  const links: Array<[AreaSnap, AreaSnap]> = [];
  for (let i = 0; i < areas.length - 1; i += 1) {
    const a = areas[i];
    const b = areas[i + 1];
    if (a && b && a.discovered && b.discovered) links.push([a, b]);
  }

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--xl">
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">The Reach</h2>
            <p className="dialog__muted">
              {inVillage ? 'Choose where to go.' : 'You can only set out from a village.'}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>Close <Key of="map" /></button>
        </header>

        <div className="worldmap">
          <svg className="worldmap__roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {links.map(([a, b]) => (
              <line
                key={`${a.id}-${b.id}`}
                x1={a.mapX * 100} y1={a.mapY * 100}
                x2={b.mapX * 100} y2={b.mapY * 100}
              />
            ))}
          </svg>

          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              className="marker"
              data-kind={markerKind(area)}
              data-current={area.current}
              style={{ left: `${area.mapX * 100}%`, top: `${area.mapY * 100}%` }}
              disabled={!area.discovered || !area.open || area.current || !inVillage}
              title={area.discovered ? area.subtitle : 'Somewhere you have not been told about'}
              onClick={() => command({ action: 'TRAVEL', areaId: area.id })}
            >
              <span className="marker__dot" />
              <span className="marker__label">
                {area.discovered ? area.name : '???'}
                {area.current && <small>you are here</small>}
                {area.discovered && !area.open && !area.current && <small>closed</small>}
                {area.completed && <small>quiet</small>}
              </span>
            </button>
          ))}
        </div>

        <footer className="worldmap__legend">
          <span data-kind="village">Village</span>
          <span data-kind="dungeon">Dungeon</span>
          <span data-kind="dungeon-done">Cleared</span>
          <span data-kind="unknown">Unknown</span>
          <span className="worldmap__seals">
            {campaign.seals.length > 0
              ? `${campaign.seals.length} seal${campaign.seals.length === 1 ? '' : 's'} taken`
              : 'No seals yet'}
          </span>
        </footer>
      </div>
    </div>
  );
}
