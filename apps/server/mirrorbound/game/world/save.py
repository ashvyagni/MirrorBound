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

The learned model *is* carried, but this module never builds it. A save holds
an opaque `agent` block that the session fills in from `agent/persistence.py`,
so what the twin learned belongs to the slot it was learned in and two slots
never share a twin. It is passed through untouched here, which is what keeps
`game/` free of any import of `agent/`.

Saves are kept in named slots under a per-profile directory. One profile is one
browser identity -- the id in `localStorage` that also rides in the URL -- so a
player's slots follow them between sessions on that machine and never mix with
anyone else's. The village checkpoint always writes `auto`; every other slot is
one the player made and named, and only they delete it.
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

#: The slot the village checkpoint writes. Autosaving into a fresh slot every
#: time a player walked into a village would bury their own named saves.
AUTO_SLOT = "auto"

#: Named slots a player may keep, not counting `auto`. A cap because these are
#: files on a shared disk written by an unauthenticated client.
MAX_SLOTS = 12


def _safe(value: str, fallback: str) -> str:
    return "".join(ch for ch in value if ch.isalnum() or ch in "-_")[:64] or fallback


def profile_dir(session_id: str) -> Path:
    """Where one browser identity's slots live."""
    return SAVE_DIR / _safe(session_id, "default")


def save_path(session_id: str, slot: str = AUTO_SLOT) -> Path:
    return profile_dir(session_id) / f"{_safe(slot, AUTO_SLOT)}.json"


def legacy_path(session_id: str) -> Path:
    """Where saves lived before slots: one file per profile, beside the dirs."""
    return SAVE_DIR / f"{_safe(session_id, 'default')}.json"


#: Remembers which slot a profile was last playing.
#:
#: Without it, loading a named save and then closing the tab would drop the
#: player back onto the autosave next time -- their named run would still be on
#: disk, but "continue" would quietly resume something else.
ACTIVE_FILE = "active"


def read_active_slot(session_id: str) -> str:
    path = profile_dir(session_id) / f"{ACTIVE_FILE}.txt"
    try:
        slot = _safe(path.read_text(encoding="utf-8").strip(), AUTO_SLOT)
    except OSError:
        return AUTO_SLOT
    # A pointer at a slot that has since been deleted is not a pointer.
    return slot if save_path(session_id, slot).exists() else AUTO_SLOT


def write_active_slot(session_id: str, slot: str) -> None:
    try:
        directory = profile_dir(session_id)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"{ACTIVE_FILE}.txt").write_text(_safe(slot, AUTO_SLOT), encoding="utf-8")
    except OSError:
        log.exception("could not record the active slot for %s", session_id)


def new_slot_id(session_id: str) -> str | None:
    """The next free named slot, or None when the profile is full."""
    existing = {p.stem for p in profile_dir(session_id).glob("*.json")}
    for n in range(1, MAX_SLOTS + 1):
        slot = f"slot-{n}"
        if slot not in existing:
            return slot
    return None


def build_save(session_id: str, campaign, player, twin, name: str = "",
               agent: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "version": SAVE_VERSION,
        "sessionId": session_id,
        "name": name,
        "savedAt": time.time(),
        # Enough to tell two slots apart in a list without loading either.
        "summary": {
            "area": campaign.current_area,
            "level": player.level,
            "gold": player.inventory.gold,
        },
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
            "offhandWeapon": twin.inventory.offhand_weapon,
        },
        # What the run learned. Opaque here on purpose -- see the module docstring.
        "agent": agent or {},
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


def write_save(session_id: str, data: dict[str, Any], slot: str = AUTO_SLOT) -> bool:
    try:
        path = save_path(session_id, slot)
        path.parent.mkdir(parents=True, exist_ok=True)
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


def read_save(session_id: str, slot: str = AUTO_SLOT) -> dict[str, Any] | None:
    path = save_path(session_id, slot)
    # A profile saved before slots existed has one file where the directory now
    # is. It is read as `auto`, which is what it was, rather than being lost.
    if not path.exists() and slot == AUTO_SLOT:
        path = legacy_path(session_id)
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
    twin.inventory.equipped_weapon = twin_equipped if twin_equipped in twin.inventory.weapons else next(iter(twin.inventory.weapons), "")
    offhand = t.get("offhandWeapon")
    twin.inventory.offhand_weapon = offhand if offhand in twin.inventory.weapons and offhand != twin.inventory.equipped_weapon else ""

    player.recompute_max_health()
    player.health = player.max_health
    player.mana = player.max_mana


def delete_save(session_id: str, slot: str = AUTO_SLOT) -> None:
    try:
        save_path(session_id, slot).unlink(missing_ok=True)
        if slot == AUTO_SLOT:
            legacy_path(session_id).unlink(missing_ok=True)
    except OSError:
        log.exception("could not delete checkpoint for %s", session_id)


def delete_profile(session_id: str) -> None:
    """Throw away every slot this profile has. The 'reset my data' button.

    Files are removed one by one rather than with `rmtree`, so a path that
    somehow resolved outside the profile cannot take a directory tree with it.
    """
    try:
        directory = profile_dir(session_id)
        for path in directory.glob("*.json"):
            path.unlink(missing_ok=True)
        for path in directory.glob("*.tmp"):
            path.unlink(missing_ok=True)
        (directory / f"{ACTIVE_FILE}.txt").unlink(missing_ok=True)
        if directory.exists():
            directory.rmdir()
        legacy_path(session_id).unlink(missing_ok=True)
    except OSError:
        log.exception("could not reset saves for %s", session_id)


def list_saves(session_id: str) -> list[dict[str, Any]]:
    """Every slot this profile has, newest first, as the client shows them.

    Unreadable and stale-version files are skipped rather than reported: a slot
    the game can no longer load is not a slot, and offering it in a list would
    only give the player a button that fails.
    """
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    paths = sorted(profile_dir(session_id).glob("*.json"))
    if legacy_path(session_id).exists():
        paths.append(legacy_path(session_id))
    for path in paths:
        slot = AUTO_SLOT if path.parent == SAVE_DIR else path.stem
        if slot in seen:
            continue
        data = read_save(session_id, slot)
        if data is None:
            continue
        seen.add(slot)
        summary = data.get("summary", {})
        found.append({
            "id": slot,
            "name": str(data.get("name") or ("Autosave" if slot == AUTO_SLOT else slot)),
            "auto": slot == AUTO_SLOT,
            "savedAt": float(data.get("savedAt", 0.0)),
            "area": str(summary.get("area", "")),
            "level": int(summary.get("level", 1)),
            "gold": int(summary.get("gold", 0)),
        })
    found.sort(key=lambda s: s["savedAt"], reverse=True)
    return found


__all__ = [
    "build_save", "write_save", "read_save", "apply_save", "delete_save",
    "delete_profile", "list_saves", "new_slot_id", "save_path", "profile_dir",
    "read_active_slot", "write_active_slot",
    "AUTO_SLOT", "MAX_SLOTS", "SAVE_VERSION",
]
