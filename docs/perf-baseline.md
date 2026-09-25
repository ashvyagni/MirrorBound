# Performance baseline

Recorded before the v1.1 world work, so §29's optimisation has a *before* to compare
against rather than a feeling. Regenerate with:

```bash
cd apps/server && uv run python ../../tools/perf/baseline.py
```

The harness holds the load steady — it tops up the player, the twin and every enemy each
tick — because otherwise the twin clears the room, the idle player dies, and a dead player
short-circuits `step`, so the timings quietly become those of an empty room again.

## v1.1 Phase 0 — `main` @ 3046aaf, 600 ticks per scene

60 Hz, so the tick budget is **16.67 ms**.

| Scene | mean | p95 | max | budget | snapshot full | lite | tiles | decor | foes |
|---|---|---|---|---|---|---|---|---|---|
| hollow_reach | 0.033 ms | 0.106 ms | 0.352 ms | 0.20% | 43.2 KB | 5.8 KB | 1750 | 121 | 0 |
| wakewood_crypt | 0.323 ms | 0.510 ms | 19.62 ms | 1.94% | 41.8 KB | 8.5 KB | 1200 | 76 | 4 |
| mirror_sanctum | 0.301 ms | 0.431 ms | 42.06 ms | 1.81% | 48.3 KB | 7.7 KB | 1850 | 90 | 1 |

## What this says about the expansion

**There is ample tick headroom.** A real fight costs under 2% of the frame. The simulation
is not what will limit a larger world, so per-entity micro-optimisation would be exactly
the premature work §29 warns against. Measure again after Phase 1 and Phase 4.

**The snapshot is the number to watch.** A `roomFull` payload is already 42–48 KB, and it
is dominated by the tile grid and decor list. The audit's 4096×3072 region cap was chosen
against this: 12,288 tiles is ~7× a village's 1750, which puts a region transition in the
low hundreds of KB. That is acceptable **once, on a transition**, and unacceptable at
20 Hz — so regions must never mark the room dirty during steady play.

**Both fight scenes show a max spike well over budget** (19.6 ms and 42.1 ms) against a
p95 of half a millisecond. A one-off cost on the first tick of a fight, consistent with
`Navigator` building and caching its route grid for a new room. It is a single dropped
frame at a room transition, where the client is already fading, so it is not urgent — but
it is the one measured thing that exceeds the budget today, and it will happen more often
in a world with more rooms. Revisit in Phase 9.
