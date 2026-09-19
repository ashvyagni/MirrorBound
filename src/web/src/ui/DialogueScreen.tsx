/**
 * Talking to someone, and buying from them.
 *
 * Every line shown here was authored on the server and arrived in the
 * NPC_TALK event with the player's and twin's names already substituted. The
 * client never writes dialogue and never decides what an NPC knows.
 *
 * Buying is a request: the price shown is the server's, the gold check is the
 * server's, and the item only appears once a SHOP_PURCHASE comes back.
 */

import { useState } from 'react';

import { Icon, weaponIcon } from './icons';
import { closeConversation, command, useUi } from './store';
import type { Conversation } from './store';

function priceTone(price: number, gold: number): 'ok' | 'short' {
  return gold >= price ? 'ok' : 'short';
}

export function DialogueScreen() {
  const screen = useUi((s) => s.screen);
  const conversation = useUi((s) => s.conversation);
  if (screen !== 'dialogue' || !conversation) return null;
  return <ConversationPanel key={conversation.npcId} conversation={conversation} />;
}

function ConversationPanel({ conversation }: { conversation: Conversation }) {
  const inventory = useUi((s) => s.playerDetail.inventory);
  const [line, setLine] = useState(0);

  const gold = inventory?.gold ?? 0;
  const owned = new Set(inventory?.weapons.map((w) => w.id) ?? []);
  const ownedRelics = new Set(inventory?.relics.map((r) => r.id) ?? []);
  const lines = conversation.lines;
  const atEnd = line >= lines.length - 1;
  const hasStock = conversation.stock.length > 0;

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--talk" role="dialog" aria-modal="true" aria-label={conversation.name}>
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">{conversation.name}</h2>
            <p className="dialog__muted">{conversation.role}</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={closeConversation}>Leave <kbd>Esc</kbd></button>
        </header>

        {lines.length > 0 && (
          <button
            type="button"
            className="speech"
            onClick={() => setLine((n) => Math.min(n + 1, lines.length - 1))}
            disabled={atEnd}
          >
            <p className="speech__line">{lines[Math.min(line, lines.length - 1)]}</p>
            {!atEnd && <span className="speech__more">more…</span>}
          </button>
        )}

        {hasStock && (
          <section className="shop">
            <header className="shop__head">
              <h3>For sale</h3>
              <span className="shop__purse"><Icon name="essence" /> {gold} gold</span>
            </header>
            <ul className="shop__list">
              {conversation.stock.map((entry) => {
                const already = entry.kind === 'weapon' ? owned.has(entry.itemId)
                  : entry.kind === 'relic' ? ownedRelics.has(entry.itemId) : false;
                return (
                  <li key={entry.itemId} className="shop__item">
                    <Icon
                      name={entry.kind === 'weapon' ? weaponIcon(entry.itemId.includes('bow') ? 'bow' : entry.itemId.includes('staff') ? 'staff' : 'sword') : entry.itemId}
                      className="shop__icon"
                    />
                    <div className="shop__body">
                      <div className="shop__name">{entry.name}</div>
                      <div className="shop__desc">{entry.description}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--buy"
                      data-tone={priceTone(entry.price, gold)}
                      disabled={already || gold < entry.price}
                      onClick={() => command({ action: 'BUY_ITEM', npcId: conversation.npcId, itemId: entry.itemId })}
                    >
                      {already ? 'Owned' : `${entry.price} gold`}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
