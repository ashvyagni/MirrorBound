# Playtest results

Measured, not felt. Regenerate with:

```bash
cd apps/server && uv run python ../../tools/playtest/playtest.py
```

252 cases: a reactive scripted player fights six encounters with each of the six
weapons across three seeds, **twice** — once unbuilt and once having mined. It
uses no skills and no potions, and only ability slots one and two, so both runs
are **floors**, not humans. Absolute clear rates are pessimistic; what the probe
is good for is comparing encounters with each other, comparing the two kinds of
player, and catching a fight nobody can survive.

- **bare** — no attributes, no fittings, no stones. Identical to what this probe
  always did, kept that way so v1.1's published numbers stay comparable rather
  than being quietly replaced.
- **built** — the same bot, having spent its level-up points and the ore the
  campaign spine would have yielded by that point (`REACHED_BY` × `expected_yield`),
  spread evenly across the five attributes up to the tier-3 gate, leftovers fitted
  into the weapon it carries. Deliberately a dull, middling build: a real player
  would specialise and do better.

## v1.2 — what the expansion is worth, measured

| Encounter | Level | bare clear | built clear | bare hp | built hp | bare s | built s |
|---|---|---|---|---|---|---|---|
| opening (crypt, room 1) | 1 | 0.97 | 1.00 | 0.97 | 1.00 | 11.1 | 11.0 |
| depths (crypt, elite) | 3 | 1.00 | 1.00 | 0.99 | 1.00 | 12.0 | 11.3 |
| barrow (the Stonecount) | 5 | 1.00 | 1.00 | 0.99 | 0.99 | 18.0 | 15.6 |
| glasswork (the Shardmother) | 6 | 0.94 | 1.00 | 0.75 | 0.84 | 26.7 | 24.2 |
| ashen deep (the Warden) | 7 | 0.61 | 0.94 | 0.61 | 0.94 | 18.6 | 16.0 |
| sanctum (the Mirror) | 8 | 0.00 | 0.00 | 0.00 | 0.00 | 15.1 | 17.8 |

**The shape is the result, not the absolute numbers.** Building changes the
opening by nothing worth having (0.97 → 1.00 — it was never being hit) and changes
the Warden a great deal (0.61 → 0.94). A progression layer that mattered
everywhere equally would be a flat power increase; one that mattered nowhere
would be pointless. Mattering most where the game is hardest is what it is for.

Note *how* it helps. The Warden fight is only 14% shorter built than bare, so the
survival is not coming from killing it faster — it is coming from about +50 max
health off Vigour, turning a fight the bare bot loses 39% of the time into one it
loses 6% of. Health investment converting a losable fight into a survivable one is
what health investment does.

The Mirror is unchanged at 0.00, as it has been since the beta. See the last
section.

## Three defects this measurement found

Each one had shipped, and none was visible from reading the code.

**Might's tier-3 gate was unreachable.** It was fed by adamantine. A whole campaign
with every vein mined yields 2.3 adamantine and the gate costs 6, so the Combat
branch's bottom half — arguably the branch an action-RPG player wants most — could
not be bought with ore at all. The cause is structural rather than a slip: a tier-4
vein gives up **one** unit by design, which is exactly right for a material you fit
into a weapon once and nowhere near enough to buy twenty points of anything. Might
is fed by obsidian now, and the rule is a test.

**Hunger's freeze was asymmetric, and it had inflated the boss numbers.** Hunger
stops while a boss is armed so that a hungry player is not silently fighting a
harder fight than the one that was tuned. That argument is *symmetric*, and the
first version only applied one side: the drain stopped and the Hungry penalty
lifted, while a player who arrived **Fed** carried +6% damage and +5% pace through
the entire fight. Re-running this probe against the pre-v1.2 commit priced it:

| Encounter | pre-v1.2 | v1.2 with the bonus riding | v1.2 fixed |
|---|---|---|---|
| barrow | 0.94 | 1.00 | 1.00 |
| glasswork | 0.89 | 1.00 | 0.94 |
| warden | 0.67 | 0.72 | 0.61 |

Frozen now means no effect in either direction, so a boss fight is the tuned fight
whatever you last ate. The Fed bonus still applies to the rest of the game, which
is most of it.

**Magic opened half as fast as every other branch.** Gold was only in marsh, road,
ruins and pasture, all late on the campaign's spine: at the Warden a probe could
reach Bond 10 and Might 7 and still be stuck on Focus 3, so the Magic branch alone
needed level-up points to reach a gate the other four bought with ore. Gold is in
crypt rock now — grave goods, at weight 1, deliberately small enough to take the
branch to its gate rather than to make gold plentiful.

## How close v1.2 is to v1.1's fights

Honestly: **close, but not identical.** After the hunger fix the bare probe sits
within ±0.06 of the pre-v1.2 baseline, and the drift runs in both directions:

| Encounter | pre-v1.2 | v1.2 bare | delta |
|---|---|---|---|
| opening | 1.00 | 0.97 | −0.03 |
| depths | 1.00 | 1.00 | +0.00 |
| barrow | 0.94 | 1.00 | +0.06 |
| glasswork | 0.89 | 0.94 | +0.05 |
| warden | 0.67 | 0.61 | −0.06 |
| mirror | 0.00 | 0.00 | +0.00 |

Two mechanical causes, not noise: the twin can now pick up and drink a potion that
drops mid-fight, and v1.2 consumes more RNG (relic stones were moved onto their own
`rng.spawn("stones")` sub-stream precisely so they stopped reshuffling the
gold/potion/weapon rolls, which removed the largest part of it). At 18–36 cases a
bucket, ±0.06 is one or two cases flipping.

What *is* exactly preserved, and was built to be: **effective enemy health**. Enemy
armour arrived for obsidian's pierce to have something to pierce, and the three
armoured archetypes took reciprocal health cuts — SLIME 115→92 at 0.20, BRUTE
180→135 at 0.25, SHARDLING 140→105 at 0.25 — so against a weapon with no obsidian
in it the numbers are unchanged to the decimal.

## v1.1 Phase 7 (historical, for comparison)

## v1.1 Phase 7

| Encounter | Level | Clear | Died | Health left | Seconds |
|---|---|---|---|---|---|
| opening (crypt, room 1) | 1 | 1.00 | 0.00 | 1.00 | 12.5 |
| depths (crypt, elite) | 3 | 1.00 | 0.00 | 1.00 | 11.5 |
| barrow (the Stonecount) | 5 | 0.94 | 0.06 | 0.93 | 17.1 |
| glasswork (the Shardmother) | 6 | 0.89 | 0.11 | 0.65 | 26.7 |
| ashen deep (the Warden) | 7 | 0.67 | 0.33 | 0.66 | 19.0 |
| sanctum (the Mirror) | 8 | 0.00 | 1.00 | 0.00 | 14.5 |

Read as §20's curve — learning, learning, mastery, mastery, challenge, high
mastery — that is the right shape, with two caveats below.

## What the first measurement found

The three regional bosses were **unwinnable**, and not because of their numbers:

| Encounter | Before | After |
|---|---|---|
| glasswork | 0.06 clear, 0.94 died | 0.89 clear |
| ashen deep | 0.00 clear, 1.00 died | 0.67 clear |

`GuardianController` called `resolve_enemy_ability` the instant it chose a
special, so `cast_time` was never honoured. The Warden's slam — a 200-unit ring
with a 1.1-second tell, the single most readable thing in the game on paper —
landed with no warning at all. The data said "telegraphed" and nothing
implemented it, which is §20's *artificial difficulty* exactly: unavoidable
damage dressed as a mechanic.

The boss now announces, holds still, and lands it at the end of the wind-up.
`test_the_wind_up_actually_happens_before_the_damage` is the assertion that was
missing — the old test only checked the ability *data* had a `cast_time`.

## What changed on purpose

**Damage leads the ramp.** Region scaling used to put the full multiplier into
health and 70% of it into damage, so a deeper region mostly meant the same fight
for longer — the definition of the HP inflation §20 forbids. Damage takes the
full multiplier now and health takes 60%: a ×1.8 region is +48% health and +80%
damage. Mistakes cost more; fights do not drag.

**A ramp instead of three steps.** 1.1 → 1.2 → 1.4 → 1.6 → 1.8 across the five
dungeons, with a test that it never goes down, never repeats, and never steps by
more than 25% — a step that doubles is a wall, and a wall reads as unfair.

Speed, range and wind-up are still never scaled. They are the telegraph, and a
later skeleton that moves faster would be a different enemy wearing the same
tell.

## Three things this probe cannot tell us

**The early game reads 1.00 health left, and that is the bot, not the fight.**
It sidesteps every wind-up perfectly, and the opening deliberately sends
creatures at you one at a time with readable tells — so it is never hit at all.
No damage number changes "never hit". Whether the opening pressures a *human* is
not measurable here, and tuning against this figure would be tuning against a
perfect dodger.

**The Mirror reads 0.00 and always has.** It is the final boss, it counters the
behaviour model, and the bot brings no skills and no potions to it. The beta's
own results said the same. This needs human play, not a better number.

**Nothing about whether v1.2's layer is *fun*.** The probe can say a built player
clears the Warden 0.94 of the time. It cannot say whether mining four veins per
region is a pleasure or a chore, whether an obsidian sword reads as a *different*
sword or just a worse one, or whether the twin's quarter-share of gold is felt as
a loss. The `built` policy is also stated rather than tuned — spread evenly, stop
at the gate — and a real player would specialise, so the built column is a floor
in the same way the bare one is.

All three are the same limitation stated three times: the probe is a regression net
for "did something become impossible or trivial", not a substitute for playing the
game.
