# HANDOFF — picking up MirrorBound

Written 2026-09-28 by the agent that built the v1.1 and v1.2 expansions, for whoever
continues. Deadline is **1 October**. Read this file, then `AGENTS.md`, then
`docs/v1.2-design.md`. Everything else can be read on demand.

This is not a summary of the code — `ARCHITECTURE.md` does that. This is the part that is
**not recoverable from the diff**: what state things are in, why the decisions went the way
they did, and what is left.

---

## 1. The one-paragraph version

MirrorBound is a single-player action-RPG whose companion learns your playstyle and whose
final boss uses it against you. Python owns the simulation, the browser renders snapshots.
Two expansions have landed on top of the beta: **v1.1** turned five portal-linked areas into
one continuous world with real dungeons and bosses, and **v1.2** added an economy (mining →
attributes → the skill tree's deep tiers), relic stones, a living wild with hunger, and a
twin that keeps itself alive. All of it is on the `ashwinwork` branch, which is **20 commits
ahead of `main` and fast-forwardable**. `main` is what Render and Vercel deploy.

---

## 2. Where the beta stood on `main`

This is the baseline everything is measured against. The beta (`0.1.0`) was a complete,
playable vertical slice:

- **5 areas** reached by portals in a village square — two villages, three dungeons.
- **1 guardian** (a tank state machine with a big health pool) plus the Mirror.
- **12 skill nodes**, all flat percentages.
- **4 weapons**, weapon-bound abilities, gold-only shops, 4 NPC definitions reused in both
  villages.
- The AI half was already the strong part and is largely unchanged: telemetry → 9 player
  traits → order-1–3 Markov prediction with decay → 7 spatial heatmaps, feeding a utility-AI
  twin and the Mirror's counter-policy.
- 299 server tests.

`main` also carries two commits the expansions build on: a landing page + auth UI
(`774c45c`), and two deployment fixes that read the JWT secret and database URL from the
environment (`95b5709`, `3046aaf`). Both are already in `ashwinwork`'s ancestry.

---

## 3. What v1.1 changed

Full audit in `docs/v1.1-audit-and-roadmap.md`. Headlines:

| Area | Beta | v1.1 |
|---|---|---|
| World | 5 areas, portals in a square | 6 regions crossed on foot, 5 named crossings |
| Villages | Areas of their own | Places **inside** regions, nothing loads |
| Gating | A refusal on the map | Kell, who won't push off until the wood is quiet |
| Dungeons | 1 archetype, linear | 3 archetypes (combat/puzzle/mirror), branches, keys, plates |
| Bosses | 1 + the Mirror | 3 phased regional bosses + the Mirror, untouched |
| Skills | 12 flat nodes | 20 nodes, 5 branches; past tier 1 everything changes *how* you play |
| Weapons | 4 | 6, plus a three-tier upgrade bench that finally spends shards and essence |
| Quests | An untyped set of flags | 4 side quests and a 6-page codex |

**Nine shipped bugs were found doing it**, listed in `FEATURE_STATUS.md`. The one worth
knowing: `GuardianController` ignored `cast_time` entirely, so every regional boss's
telegraph landed with no warning — the Warden measured **0.00 clear**. Fixing the wind-up
took the Glasswork from 0.06 to 0.89 and the Warden to 0.67 without touching a single
balance number. Difficulty in this project is measured, not felt, and that is why.

---

## 4. What v1.2 changed, and why it is shaped this way

Full reasoning in `docs/v1.2-design.md`. **Read that before changing anything in
`game/progression/`.** The short version:

Five features were requested: mining, relic stones, more stats, twin autonomy, a bigger
living world. Read as five features that is five systems bolted to one game. The
load-bearing decision — confirmed by the owner in four words, *"materials should feed you
attributes"* — was to read them as **one economy**:

```
  fighting  →  XP   →  levels  →  skill points  →  the tree        (behaviour)
  mining    →  ore  →  training  →  attributes  ──┘ gates tiers 3-4   (numbers)
```

One attribute per skill branch, one ore per attribute. Ore is therefore not a fourth
currency looking for a shop — it is the only way to open the bottom half of a tree the
player already wanted. **20 levels pay 19 attribute points; tier 3 alone asks 25 across the
five branches**, so the tree cannot be finished by levelling. `test_materials.py` asserts
that inequality. If you break it, you have removed the reason mining exists.

Everything else v1.2 added: 8 ores placed by terrain, 7 relic stones (1/200, 1/1000,
1/10000 with a saved pity floor), 2 extra regions off the campaign's spine, grassfield and
tundra biomes, 5 wild animals, hunger for player and twin, and a twin that drinks, eats and
shops.

### The decision style you are inheriting

Five principles actually drove the work. Following them will make your changes look like the
rest of the codebase; ignoring them will make the tests fight you.

1. **When the literal request is arithmetic that does not work, keep the intent and change
   the mechanism — and show the number.** Twice in v1.2. "+0.3% damage per iron" is 0.042
   damage on the real weapon table: invisible, and a quantity you add until you run out. So
   materials change a weapon's *shape* instead (iron is heavier, mithril is quick, obsidian
   splits armour), every one a trade. "1/10000 for a tier-3 stone" is about fifty
   playthroughs for one: that is not rarity, it is absence. The requested rate was kept and a
   **pity floor** put under it. Neither was refused; both were re-aimed, with the arithmetic
   stated.
2. **A number you can assert beats a number that feels right.** The pity floor exists so the
   drop rate is *sayable*: "vanishingly rare, and never worse than one in two thousand" is a
   sentence a test can check, where "it feels rare" is not.
3. **Protect what has been measured, explicitly.** Obsidian's pierce needed enemy armour, so
   three archetypes got armour with **exactly reciprocal health cuts** (SLIME 115→92 @0.20,
   BRUTE 180→135 @0.25, SHARDLING 140→105 @0.25) — effective health against a weapon with no
   obsidian is unchanged to the decimal.
4. **Reuse before you create (§35), and don't overengineer (§36).** The five wild animals are
   all the Gloom Hound's sheet tinted and scaled. Ore veins are the existing `rockBig` decor.
   A new biome is ~16 hex values in the client's `BIOMES` table, not a tileset. Cooking is at
   the hearth that already existed; attribute training is at the smith, apothecary and elder
   who already stood in every village.
5. **Emergence over scripting, where scoring can produce it.** The twin's "back off, then
   drink" is not a sequence. `HEAL` is discounted by how close the nearest enemy is and
   `RETREAT` is rewarded by the same thing; neither knows the other exists. Prefer adding a
   candidate with a score to adding a branch with a state.

### The twin, since it is the demo

The brief asked for a twin that "should buy itself health potions and use them accordingly
just as a player". The audit found the feature was not missing so much as **blocked** by
three defects: `loot.py` routed every consumable to the player's bag whoever collected it;
`HEAL` was declared in `INTENT_TYPES`, produced by nothing, and filed in the executor under
the *movement* intents; and it had no money. So it needed a purse, a stock nothing steals,
and a `HEAL` that drinks — not a bigger brain.

It is held to the player's own constants throughout: same drink duration, same 6 s shared
cooldown, same refusal at full health, same spilled flask when hit. A companion that could
chain potions six times faster than you would be a different creature.

Three learned dimensions were added (12 total). `drink_threshold` is the interesting one:
`ITEM_USED` now carries `atHealth`, captured *before* the heal, so the health fraction **you**
drink at is the threshold the twin copies. `TWIN_DOWNED` carries `potions`, because going
down teaches opposite lessons — holding one is a timing mistake, holding none is a supply
mistake.

---

## 5. State of the tree right now — READ THIS BEFORE YOU TOUCH ANYTHING

**Pushed to `ashwinwork`:** 7 v1.2 commits, `4cbb24b`..`71b2b67`. Verified at 787 server
tests, 61 frontend, TypeScript clean.

**Uncommitted in the working tree** (this is the part in flight):

I closed the gap I had flagged in three documents — *nothing in v1.2's progression layer had
been measured against play* — by extending the playtest probe to run every encounter twice:
once as the old unbuilt player (`bare`, identical to before, so v1.1's numbers stay
comparable) and once as one who mined and trained (`built`, spending the ore the campaign
spine would have yielded). That found **three real defects**, all fixed on disk:

1. **Might's tier-3 gate was unreachable.** It was fed by adamantine; a whole campaign
   yields 2.3 units and the gate costs 6, so the Combat branch's deep tiers could not be
   bought with ore at all. The cause is structural, not a tuning slip: a tier-4 vein gives
   **one** unit, which is right for a fitting and cannot buy an attribute. Might is fed by
   obsidian now, and `test_no_attribute_is_fed_by_a_tier_four_material` states the rule.
2. **Hunger's freeze was asymmetric, and it had silently inflated the boss numbers.** I
   froze the drain and the Hungry penalty at a boss door and left the Fed bonus in — so a
   player who had eaten got +6% damage through the whole fight. A/B against the pre-v1.2
   commit with the same seeds and weapons priced it: Glasswork 0.89 → 1.00, Stonecount
   0.94 → 1.00. The original argument ("a player walking in hungry fights a different fight
   from the one that was tuned") is *symmetric* and I had applied half of it. Frozen now
   means no effect in either direction.
3. **Magic opened half as fast as every other branch.** Gold was only in marsh, road, ruins
   and pasture, all late on the spine: at the Warden a player could be at Bond 10 and Might 7
   and still stuck on Focus 3. Gold is in crypt rock now (grave goods, weight 1 — deliberately
   small), and `test_no_branch_opens_far_later_than_the_others` guards it.

Also on disk: relic stones moved to their own `rng.spawn("stones")` sub-stream (they were
drawing from the loot stream, so every kill reshuffled the *next* kill's gold/potion/weapon
rolls — same seed, same result, so not a determinism break, but it moved the sequences v1.1
was measured against); an `expected_yield()` helper in `materials.py` that the probe and the
tests share so they can never disagree; and five new guard tests.

**What is NOT done in the working tree:**

- `docs/playtest-results.md` still shows only the v1.1 table. It needs the bare-vs-built
  numbers. The final JSON will be at `/private/tmp/claude-501/playtest-final.json` if that
  run finished; if not, regenerate with the command in §7.
- **One claim in `docs/v1.2-design.md` and `FEATURE_STATUS.md` is wrong and must be
  corrected**: they say v1.2 protected v1.1's measured numbers. After the hunger fix the bare
  probe is within about ±0.06 of the pre-v1.2 baseline, mixed in both directions, not
  identical. The narrower claim that *is* true: the armour change preserves effective health
  exactly. Say the ±0.06 and its causes (added RNG consumption, the twin now able to pick up
  and drink a potion mid-fight) rather than repeating the stronger claim.
- Nothing is committed. See §6.

**Temporary artifacts to clean up:** there is a git worktree at
`/private/tmp/claude-501/prev12` pinned to `ecc453a`, created for the A/B. Remove it with
`git worktree remove /private/tmp/claude-501/prev12`.

---

## 6. How to commit and where to push

**Branch rules, in force since v1.1 and not negotiable:**

- Work goes on **`ashwinwork`**. That is the branch this expansion has been built on.
- **`main` is the deploy branch** — Render (backend) and Vercel (frontend) build from it.
  Merging to it is a production deploy. `ashwinwork` → `main` is currently a clean
  fast-forward (20 ahead, 0 behind).
- **Never merge the `Ojas` or `ujesha_work` branches** into this work. They are teammates'
  parallel branches; the expansions build on `main` only.
- Prefer new commits over amending. Never `git reset --hard`, never delete unmerged branches.

**Commit authorship:** the repo's git user is `ashvyagni` and the owner is deliberately
accumulating commits under it. Do not change the author. End every commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

(Substitute your own model identity if you are not that model — but keep the trailer.)

**Commit message style** — this matters more than usual here, because it is the only place
the *why* is recorded. AGENTS.md: "Commit message explains *why*, not just *what* — the diff
already shows what changed." Look at `git log` for the shape: a one-line summary, then prose
explaining the reasoning, the numbers, and anything that was got wrong and corrected. These
are long on purpose.

**To finish and push:**

```bash
# from the repo root
cd apps/server && .venv/bin/python -m pytest -q          # must be green
cd ../../src/web && npx tsc --noEmit -p tsconfig.json     # must be silent
npx vitest run                                            # 61 tests
cd .. && git add -A && git commit                          # see style above
git push origin ashwinwork
```

**Then, to deploy** — this is the production step, so confirm with the owner first:

```bash
git checkout main && git merge --ff-only ashwinwork && git push origin main
git checkout ashwinwork
```

`--ff-only` is deliberate: if it refuses, someone has pushed to `main` and you need to look
before merging rather than creating a merge commit blindly.

**Deploy caveat:** there is no `render.yaml` or `vercel.json` in the repo — both deploys are
configured in their dashboards, so you cannot verify the build settings from here. The
server needs `DATABASE_URL` and a JWT secret from the environment (`95b5709`, `3046aaf`
added that). Postgres is optional: it stores accounts only, and the server starts without it
and says so in its log — but sign-in will not work.

---

## 7. Commands you will need

```bash
# Server tests (the gate for everything). ~3-9 min; see the variance warning below.
cd apps/server && .venv/bin/python -m pytest -q

# Frontend
cd src/web && npx tsc --noEmit -p tsconfig.json && npx vitest run

# Difficulty measurement, bare and built. ~7 min, 252 cases.
cd apps/server && .venv/bin/python ../../tools/playtest/playtest.py --output /tmp/pt.json

# Regenerate the HUD test fixture after any wire-contract change
apps/server/.venv/bin/python tools/fixtures/regen_village.py

# Replay a recorded run to find where determinism diverged
python tools/replay/replay.py <run file>

# Dev servers — use these, not bare uvicorn/npm, if you have preview tooling
cd apps/server && uv run uvicorn mirrorbound.api.app:create_app --factory --port 8000 --reload
cd src/web && npm run dev
```

**This machine's timing swings ±2.4× on identical code.** The test suite appeared to triple
in runtime mid-expansion (34s → 105s); a cProfile pass found nothing (the suspected function
was 1.8% of total) and a proper A/B — three commits, three runs each — showed the same commit
swinging 2.4×. There was no regression. Do not chase a wall-clock delta without profiling
first, and any cross-commit performance comparison needs a same-session baseline. Details in
`docs/perf-baseline.md`.

---

## 8. What is left, in priority order

**Must do to close this out (≈30–60 min):**

1. Full server suite, after the hunger and ore changes. The hunger change touches damage
   multipliers that many tests assert exact values against — this is the risky one.
2. Rewrite `docs/playtest-results.md` with the bare-vs-built table.
3. Correct the over-strong preservation claim in `docs/v1.2-design.md` and
   `FEATURE_STATUS.md` (see §5).
4. Commit, push to `ashwinwork`, remove the temp worktree.
5. Confirm with the owner, then fast-forward `main`.

**Known open, not blocking a release:**

- **`apps/.auth_secret` is tracked in git.** Flagged in the v1.1 audit and still true. Needs
  untracking, a history rewrite *and* rotation. This is the owner's call — it is not a
  gameplay change and rewriting history affects everyone on the repo. Do not do it unasked.
- **11 pre-existing ESLint errors**, 8 of them React purity errors in `LandingScreen.tsx`
  from the landing-page/auth work, 1 in `AuthScreen.tsx`, and two type-import nits in
  `EventBus.ts` and `Villagers.ts`. The count is **identical at the pre-v1.2 commit**, so the
  expansions introduced none. Most are in a teammate's file; I left them alone. TypeScript is
  clean. Do not claim "ESLint passes" anywhere.
- **The Mirror is unbeaten by the probe** and always has been, including in the beta. It
  counters the behaviour model and the bot brings no skills and no potions. This needs human
  play, not a number change. Do not "fix" it by nerfing the boss.
- **The early game reads 1.00 health left, and that is the bot, not the fight.** It sidesteps
  every wind-up perfectly. Never tune the opening against that figure.
- The twin's learned **style** is still memory-only (its inventory and hunger now persist).
- `api/session.py` still holds gameplay rules AGENTS.md places in `game/`. v1.2 added its
  logic to `game/world/` and `game/progression/` rather than growing the file, but did not
  shrink it.
- **v1.2's numbers are untested by human play.** Ore yields against training costs, whether a
  fitted weapon reads as a *different* weapon or just a worse one, whether the twin's
  quarter-share of gold is felt as a loss. The probe cannot answer any of these.

---

## 9. Traps specific to this codebase

- **`GameState` holds exactly one `Room`.** Regions *are* Rooms. So more regions is nearly
  free and a *bigger* region costs navigation-grid area. Do not reach for streamed chunks.
- **Determinism is enforced by test.** No bare `random.*` in `game/` or `agent/` — everything
  goes through `DeterministicRNG.spawn("label")`. Never `hash()` on a string for anything
  that must survive a process restart (use `zlib.crc32`). `Event.data` is immutable once
  published.
- **The client decides nothing.** If you find yourself computing damage, a hit, or a drop in
  TypeScript, stop. `veins[]` in the snapshot carries id and remaining swings only — never
  what is inside — for exactly this reason.
- **`agent/` may never mutate `GameState`.** It returns a `TwinIntent`; `twin_executor.py`
  validates and executes. The executor also owns *commitment* — while `twin.busy` the twin
  stands still whatever the controller has since decided, so no candidate needs to reason
  about being mid-drink.
- **The HUD test fixture goes stale silently.** The client typecheck does not reach test
  fixtures, so `src/web/tests/fixtures/village.json` kept passing while describing a game
  with no hunger bar and no ore. It is **generated** now — run `regen_village.py` after any
  wire-contract change and read the diff.
- **Tests that assert exact health values are load-bearing.** Six of them caught a design
  error in v1.2 (food that healed, which would have undercut the potion economy the whole
  gold balance is priced against). Do not loosen them to make a change pass.
- **A test that passes either way proves nothing.** Both new balance tests were verified by
  reverting the fix and watching them fail with the right diagnosis. Do that.

---

## 10. If you only have an hour

Do §8 items 1–4 and stop. The game is complete and playable without anything else on that
list. The three defects found today are already fixed on disk; what remains is running the
suite to confirm nothing else moved, writing down the numbers, and correcting one claim I got
wrong.

The most demo-able thing in v1.2 is the twin: get it hurt with a potion in its pack and it
will back off, drink, and — with money and an empty pack — walk to the apothecary and buy
another. `F3` shows the utility scores and the twelve style dimensions behind the decision.
