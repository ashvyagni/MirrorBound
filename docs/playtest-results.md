# Playtest results

Measured, not felt. Regenerate with:

```bash
cd apps/server && uv run python ../../tools/playtest/playtest.py
```

126 cases: a reactive scripted player fights six encounters with each of the six
weapons across three seeds. It uses no skills and no potions, and only ability
slots one and two — so it is a **floor**, not a human. Absolute clear rates are
pessimistic; what the probe is good for is comparing encounters with each other
and catching a fight nobody can survive.

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

## Two things this probe cannot tell us

**The early game reads 1.00 health left, and that is the bot, not the fight.**
It sidesteps every wind-up perfectly, and the opening deliberately sends
creatures at you one at a time with readable tells — so it is never hit at all.
No damage number changes "never hit". Whether the opening pressures a *human* is
not measurable here, and tuning against this figure would be tuning against a
perfect dodger.

**The Mirror reads 0.00 and always has.** It is the final boss, it counters the
behaviour model, and the bot brings no skills and no potions to it. The beta's
own results said the same. This needs human play, not a better number.

Both are the same limitation stated twice: the probe is a regression net for
"did something become impossible", not a substitute for playing the game.
