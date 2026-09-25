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

## v1.1 Phase 1 — the continuous world, before optimising

The world got about four times bigger per map, and the cost showed up immediately:

| Scene | mean | p95 | max | budget |
|---|---|---|---|---|
| hollowreach_vale | 1.751 ms | 7.175 ms | 163.5 ms | **10.51%** |
| drowned_flats | 0.703 ms | 0.648 ms | 116.8 ms | 4.22% |
| kiln_terraces | 0.275 ms | 0.502 ms | 0.634 ms | 1.65% |

A p95 of 7.2 ms is 43% of the frame on its own, and 163 ms is a ten-frame stall. So
this is the case §29 describes: measure first, then optimise what the measurement
actually flags. A profile of four hundred ticks in the opening region named three
things, and nothing else came close:

- `Decor.collision_center` built a fresh `Vec2` on **722,000** reads. A prop never
  moves, so its collision circle is constant.
- `clear_segment` walked the entire decor list on every call — and the navigator
  calls it several times per steering decision plus once per grid edge considered.
  340 props per region, against 76 in a dungeon room.
- `Navigator._search` sorted **every walkable cell** in the region twice per
  search, to find the cell nearest the actor and the cell nearest the goal. At
  4,480 cells that is 104 ms a call, which is the 163 ms spike.

## v1.1 Phase 1 — after: caching, a spatial index, and a local cell search

Decor caches its own centre; `Room` keeps blocking decor bucketed in 128-unit
blocks so a collision query tests a handful of props instead of all of them; and
the navigator finds its nearest cells by spiralling out from the cell a point is
already in.

| Scene | mean | p95 | max | budget | snapshot full | lite | tiles | decor | foes |
|---|---|---|---|---|---|---|---|---|---|
| hollowreach_vale | 0.399 ms | 0.703 ms | 23.8 ms | **2.39%** | 101.3 KB | 9.5 KB | 4480 | 340 | 4 |
| drowned_flats | 0.432 ms | 0.611 ms | 48.8 ms | 2.59% | 64.4 KB | 10.1 KB | 3520 | 153 | 5 |
| kiln_terraces | 0.292 ms | 0.536 ms | 15.7 ms | 1.75% | 56.4 KB | 9.4 KB | 3920 | 91 | 4 |
| wakewood_crypt | 0.324 ms | 0.531 ms | 48.9 ms | 1.94% | 43.1 KB | 9.8 KB | 1200 | 76 | 4 |
| mirror_sanctum | 0.194 ms | 0.423 ms | 9.8 ms | 1.17% | 49.5 KB | 8.9 KB | 1850 | 90 | 1 |

**4.4× on the mean and 10× on the p95** in the worst region, which now costs less
than the dungeon did before any of this. Nothing was made approximate to get
there: the spatial index returns a superset and the real distance test still runs,
and the cell search breaks ties by coordinate exactly as the sort did, so routes
stay deterministic.

The remaining max spikes (16–49 ms) are the navigator building and caching its
walkable-cell grid the first time something steers in a new room. One frame, at a
transition the client is already fading through, and it is now the only measured
thing above budget. Revisit in Phase 9 if it is ever visible.

The snapshot is the number to keep watching: 101 KB for a region with a village in
it, sent once on a transition. Well inside what the audit budgeted, and the reason
the region cap is 4096×3072.

## What this says about the expansion

**There is ample tick headroom, once the per-tick scans are bucketed.** A real fight in a
full region costs under 2.6% of the frame. What did not scale was never the arithmetic — it
was doing it over every prop in the room. Measure again after Phase 4 adds dungeon
branching.

**The snapshot is the number to watch.** A `roomFull` payload is already 42–48 KB, and it
is dominated by the tile grid and decor list. The audit's 4096×3072 region cap was chosen
against this: 12,288 tiles is ~7× a village's 1750, which puts a region transition in the
low hundreds of KB. That is acceptable **once, on a transition**, and unacceptable at
20 Hz — so regions must never mark the room dirty during steady play.

**The max spikes are the navigator's grid build**, confirmed by profile: one frame per room
per actor radius, at a transition. Still the only measured thing above budget.
