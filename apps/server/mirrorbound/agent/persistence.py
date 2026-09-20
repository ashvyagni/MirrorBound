"""Writing the learned model down, and reading it back.

A save carries what the game learned about the player in that run, so coming
back to a slot brings back the twin you trained rather than a blank one, and two
slots never share what they know. `save.py` deliberately stores no agent state
of its own; the session composes this into the file, which keeps `game/` free of
any import of `agent/`.

Two rules shape the format.

**Ticks are rebased to zero on the way out.** Every decaying thing here is
stamped with the sim tick it was last reinforced at, and a reloaded session
starts counting from zero again -- so a stored tick of 50,000 would sit in the
future forever and the evidence attached to it would never decay. Instead the
decay is *applied* at save time and everything is written as though it had all
arrived at tick zero. The relative weights are what carry the learning; the
absolute ticks only ever meant "how stale".

**Only what cannot be rebuilt is stored.** The spatial heatmaps have a
sixty-second half-life and are gone two minutes into any run, and the pattern
detector reads the predictor it is handed rather than holding its own evidence.
Writing either would make the file bigger and the load slower to no effect.
"""

from __future__ import annotations

from typing import Any

#: Bumped when the shape below changes. A file at a different version loads as
#: a fresh model rather than being guessed at -- a half-read model is worse
#: than an honest blank one, because it is wrong in ways nothing reports.
MODEL_VERSION = 1


# --- the player model ---------------------------------------------------------

def dump_player_model(pipeline, tick: int) -> dict[str, Any]:
    """Traits and the Markov tables, decayed to `tick` and rebased to zero."""
    predictor = pipeline.predictor
    # Sweep first: contexts that have already decayed to nothing are not worth
    # writing, and pruning here is free compared with pruning on load.
    predictor.prune(tick)

    orders: dict[str, list[dict[str, Any]]] = {}
    for order, model in predictor._models.items():
        rows: list[dict[str, Any]] = []
        for context, row in model._table.items():
            for token, entry in row.items():
                weight = model._decayed_weight(entry, tick)
                if weight <= 0.0:
                    continue
                rows.append({"context": list(context), "token": token, "weight": round(weight, 4)})
        if rows:
            orders[str(order)] = rows

    return {
        "version": MODEL_VERSION,
        "traits": {
            name: {
                "value": round(trait.value, 5),
                "confidence": round(trait.confidence, 5),
                "samples": trait.samples,
                "recentTrend": round(trait.recent_trend, 5),
            }
            for name, trait in pipeline.traits.traits.items()
        },
        "history": list(predictor.history),
        "orders": orders,
    }


def load_player_model(pipeline, data: dict[str, Any] | None) -> bool:
    """Restore onto a freshly built pipeline. False when there was nothing to load.

    Every value is validated on the way in, the same way `apply_save` validates
    progression: a file naming a trait or an order this build no longer has
    loads without it rather than raising inside a session's first tick.
    """
    if not isinstance(data, dict) or data.get("version") != MODEL_VERSION:
        return False

    for name, stored in _mapping(data.get("traits")).items():
        if not isinstance(stored, dict):
            continue
        trait = pipeline.traits.get(str(name))
        trait.value = _unit(stored.get("value"), trait.value)
        trait.confidence = _unit(stored.get("confidence"), trait.confidence)
        trait.samples = max(0, int(stored.get("samples", 0) or 0))
        trait.recent_trend = _number(stored.get("recentTrend"), 0.0)

    predictor = pipeline.predictor
    predictor.history = [str(t) for t in _sequence(data.get("history"))][-64:]
    # Everything lands at tick zero, which is where the reloaded session starts.
    predictor.tick = 0
    predictor._last_prune_tick = 0

    from mirrorbound.agent.prediction.markov import _Entry

    for order_key, rows in _mapping(data.get("orders")).items():
        model = predictor._models.get(_int(order_key))
        if model is None or not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            context = tuple(str(c) for c in (row.get("context") or ()))
            token = str(row.get("token", ""))
            weight = _number(row.get("weight"), 0.0)
            # A context of the wrong length would break the model's own
            # assertion on the next observation.
            if len(context) != model.order or not token or weight <= 0:
                continue
            model._table.setdefault(context, {})[token] = _Entry(weight=weight, last_tick=0)
    return True


# --- the twin's style ----------------------------------------------------------

def dump_twin_style(style) -> dict[str, Any]:
    """The nine dimensions the twin has learned, plus what it has read of you."""
    return {
        "version": MODEL_VERSION,
        "dims": {
            name: {
                "value": round(dim.value, 5),
                "confidence": round(dim.confidence, 5),
                "samples": dim.samples,
                "recentTrend": round(dim.recent_trend, 5),
            }
            for name, dim in style.dims.items()
        },
        "lessons": list(style.lessons),
        "playerEventsSeen": style.player_events_seen,
        "outcomesSeen": style.outcomes_seen,
    }


def load_twin_style(style, data: dict[str, Any] | None) -> bool:
    if not isinstance(data, dict) or data.get("version") != MODEL_VERSION:
        return False

    for name, stored in _mapping(data.get("dims")).items():
        if not isinstance(stored, dict):
            continue
        dim = style.get(str(name))
        dim.value = _unit(stored.get("value"), dim.value)
        dim.confidence = _unit(stored.get("confidence"), dim.confidence)
        dim.samples = max(0, int(stored.get("samples", 0) or 0))
        dim.recent_trend = _number(stored.get("recentTrend"), 0.0)
        # Rebased: the dimension counts as having been reinforced right now, so
        # the decay in `advance` starts from this load rather than from a tick
        # that no longer exists.
        dim.last_sample_tick = 0

    style.lessons.clear()
    for lesson in _sequence(data.get("lessons"))[-8:]:
        style.lessons.append(str(lesson))
    style.player_events_seen = max(0, int(data.get("playerEventsSeen", 0) or 0))
    style.outcomes_seen = max(0, int(data.get("outcomesSeen", 0) or 0))
    style.tick = 0
    style._last_decay_tick = 0
    return True


# --- validation ----------------------------------------------------------------

def _mapping(value: Any) -> dict:
    """A dict, or an empty one. A save file is text on disk that anything can
    edit, so a field that should be a table and is a string must load as
    nothing rather than raising inside the session's first tick."""
    return value if isinstance(value, dict) else {}


def _sequence(value: Any) -> list:
    return list(value) if isinstance(value, (list, tuple)) else []


def _number(value: Any, fallback: float) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return fallback
    return out if out == out and abs(out) != float("inf") else fallback


def _unit(value: Any, fallback: float) -> float:
    return min(1.0, max(0.0, _number(value, fallback)))


def _int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


__all__ = [
    "MODEL_VERSION",
    "dump_player_model", "load_player_model",
    "dump_twin_style", "load_twin_style",
]
