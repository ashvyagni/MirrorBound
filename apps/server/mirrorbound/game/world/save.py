"""Checkpoints.

A checkpoint is taken when the player reaches a village -- the one place the
game promises is safe -- and never mid-dungeon. That keeps the rule simple
enough to trust: what you carry out of a dungeon is kept, what you were
carrying halfway down is not.

What is stored is *progression*, not a snapshot of the simulation: level, xp,
skills, inventory, gold, campaign flags, and the twin's own equipment. Enemy
positions and timers are deliberately not stored, because restoring them
faithfully is a much larger promise than the game needs to make, and a
half-restored fight is worse than a fresh one.

The learned player model is not written here either. It is rebuilt from play,
and a model restored out of its own run would be a different kind of claim than
"the twin learned this from you".
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

log = logging.getLogger("mirrorbound.save")

SAVE_VERSION = 1
SAVE_DIR = Path(__file__).resolve().parents[3] / "saves"


def save_path(session_id: str) -> Path:
    safe = "".join(ch for ch in session_id if ch.isalnum() or ch in "-_")[:64] or "default"
    return SAVE_DIR / f"{safe}.json"


def build_save(session_id: str, campaign, player, twin) -> dict[str, Any]:
    return {
        "version": SAVE_VERSION,
        "sessionId": session_id,
        "campaign": campaign.save_dict(),
        "player": {
            "level": player.level,
            "xp": player.xp,
            "skillPoints": player.skill_points,
            "unlockedSkills": sorted(player.unlocked_skills),
            "weapons": list(player.inventory.weapons),
            "equippedWeapon": player.inventory.equipped_weapon,
            "offhandWeapon": player.inventory.offhand_weapon,
            "abilitySlots": list(player.inventory.ability_slots),
            "consumables": dict(player.inventory.consumables),
            "resources": dict(player.inventory.resources),
            "relics": list(player.inventory.relics),
            "gold": player.inventory.gold,
        },
        "twin": {
            "weapons": list(twin.inventory.weapons),
            "equippedWeapon": twin.inventory.equipped_weapon,
        },
    }


#: How many times to retry the atomic rename, and how long to wait between.
#:
#: On Windows a file sync client, an indexer or a virus scanner can hold a
#: handle to the save for a few milliseconds after it is written, and
#: `os.replace` onto a held file fails outright. This repository lives in a
#: OneDrive folder, so that is not a hypothetical: without the retry a
#: checkpoint is lost roughly one time in three and the only trace is a line in
#: the server log.
REPLACE_ATTEMPTS = 5
REPLACE_BACKOFF = 0.04


def write_save(session_id: str, data: dict[str, Any]) -> bool:
    try:
        SAVE_DIR.mkdir(parents=True, exist_ok=True)
        path = save_path(session_id)
        # Write to a sibling first so an interrupted write cannot leave a
        # half-written save where a valid one used to be.
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
        for attempt in range(REPLACE_ATTEMPTS):
            try:
                tmp.replace(path)
                return True
            except PermissionError:
                # Held by something else, for now. Anything but the last
                # attempt waits and tries again; the last one falls through to
                # the handler below and is reported.
                if attempt == REPLACE_ATTEMPTS - 1:
                    raise
                time.sleep(REPLACE_BACKOFF * (attempt + 1))
        return False
    except OSError:
        log.exception("could not write checkpoint for %s", session_id)
        return False


def read_save(session_id: str) -> dict[str, Any] | None:
    path = save_path(session_id)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.exception("could not read checkpoint for %s", session_id)
        return None
    if not isinstance(data, dict) or data.get("version") != SAVE_VERSION:
        return None
    return data


def apply_save(data: dict[str, Any], player, twin) -> None:
    """Restore progression onto a freshly built player/twin.

    Everything is validated on the way in: a save naming a weapon or skill that
    no longer exists loads without it rather than crashing the session.
    """
    from mirrorbound.game.combat.abilities import ABILITIES
    from mirrorbound.game.combat.weapons import WEAPONS
    from mirrorbound.game.inventory import CONSUMABLES, RELICS
    from mirrorbound.game.progression.skills import SKILLS

    p = data.get("player", {})
    player.level = max(1, int(p.get("level", 1)))
    player.xp = max(0, int(p.get("xp", 0)))
    player.skill_points = max(0, int(p.get("skillPoints", 0)))
    player.unlocked_skills = {s for s in p.get("unlockedSkills", []) if s in SKILLS}

    inv = player.inventory
    inv.weapons = [w for w in p.get("weapons", []) if w in WEAPONS] or list(inv.weapons)
    equipped = p.get("equippedWeapon")
    inv.equipped_weapon = equipped if equipped in inv.weapons else (inv.weapons[0] if inv.weapons else "")
    offhand = p.get("offhandWeapon")
    inv.offhand_weapon = offhand if offhand in inv.weapons and offhand != inv.equipped_weapon else ""
    # Ability slots are no longer saved: they are derived from the two weapons
    # in hand, which are. Restoring a stored list would let a save made before
    # a weapon was rebalanced hand back a bar that weapon no longer grants.
    inv.consumables = {k: int(v) for k, v in p.get("consumables", {}).items() if k in CONSUMABLES and int(v) > 0}
    inv.resources.update({k: int(v) for k, v in p.get("resources", {}).items() if k in inv.resources})
    inv.relics = [r for r in p.get("relics", []) if r in RELICS]
    inv.resources["relics"] = len(inv.relics)
    inv.gold = max(0, int(p.get("gold", 0)))

    t = data.get("twin", {})
    twin.inventory.weapons = [w for w in t.get("weapons", []) if w in WEAPONS]
    twin_equipped = t.get("equippedWeapon")
    if twin_equipped in twin.inventory.weapons:
        twin.inventory.equipped_weapon = twin_equipped

    player.recompute_max_health()
    player.health = player.max_health
    player.mana = player.max_mana


def delete_save(session_id: str) -> None:
    try:
        save_path(session_id).unlink(missing_ok=True)
    except OSError:
        log.exception("could not delete checkpoint for %s", session_id)


__all__ = ["build_save", "write_save", "read_save", "apply_save", "delete_save", "save_path", "SAVE_VERSION"]
