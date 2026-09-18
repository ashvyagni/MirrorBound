"""The actual determinism proof (doc section 7): same run_seed + same tick-stamped
inputs must produce an identical final state and an identical event log, every time.

There's no real game simulation yet (no entities/movement/combat), so this exercises
a minimal toy "simulation" built only from the core primitives that exist today
(DeterministicRNG, SimClock, IdAllocator, EventBus). Once real game systems land,
this same shape of test — run twice, compare state + event log byte-for-byte —
is what replay/regression testing depends on.
"""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.core.clock import SimClock
from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.core.ids import IdAllocator
from mirrorbound.game.core.rng import DeterministicRNG

SCRIPTED_INPUTS = ["ATTACK", "ATTACK", "LOOT", "ATTACK", "LOOT", "ATTACK", "ATTACK", "LOOT"]


@dataclass
class RunResult:
    final_state: dict
    event_log: list[tuple]


def run_toy_simulation(seed: int, inputs: list[str]) -> RunResult:
    rng = DeterministicRNG(seed)
    combat_rng = rng.spawn("combat")
    loot_rng = rng.spawn("loot")
    ids = IdAllocator()
    clock = SimClock()
    bus = EventBus()

    total_damage = 0
    loot_collected: list[str] = []

    for action in inputs:
        clock.advance()
        if action == "ATTACK":
            enemy_id = ids.next("enemy")
            hit = combat_rng.chance(0.6)
            damage = combat_rng.randint(5, 20) if hit else 0
            total_damage += damage
            bus.publish(
                Event(
                    tick=clock.tick,
                    type="ATTACK_RESOLVED",
                    data={"target": enemy_id, "hit": hit, "damage": damage},
                )
            )
        elif action == "LOOT":
            loot_id = ids.next("loot")
            item = loot_rng.choice(["sword", "shield", "potion"])
            loot_collected.append(item)
            bus.publish(
                Event(tick=clock.tick, type="LOOT_COLLECTED", data={"id": loot_id, "item": item})
            )

    event_log = [(e.tick, e.type, tuple(sorted(e.data.items()))) for e in bus.drain()]
    final_state = {
        "total_damage": total_damage,
        "loot_collected": loot_collected,
        "final_tick": clock.tick,
    }
    return RunResult(final_state=final_state, event_log=event_log)


def test_same_seed_and_inputs_produce_identical_state_and_event_log():
    run_a = run_toy_simulation(seed=48192017, inputs=SCRIPTED_INPUTS)
    run_b = run_toy_simulation(seed=48192017, inputs=SCRIPTED_INPUTS)

    assert run_a.final_state == run_b.final_state
    assert run_a.event_log == run_b.event_log


def test_different_seed_diverges():
    run_a = run_toy_simulation(seed=1, inputs=SCRIPTED_INPUTS)
    run_b = run_toy_simulation(seed=2, inputs=SCRIPTED_INPUTS)

    assert run_a.final_state != run_b.final_state or run_a.event_log != run_b.event_log


def test_different_inputs_diverge_even_with_the_same_seed():
    run_a = run_toy_simulation(seed=7, inputs=SCRIPTED_INPUTS)
    run_b = run_toy_simulation(seed=7, inputs=list(reversed(SCRIPTED_INPUTS)))

    assert run_a.event_log != run_b.event_log
