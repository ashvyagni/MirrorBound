# Gameplay

## The loop

```
EXPLORE → FIGHT → DISCOVER → UPGRADE → your habits emerge → the twin observes → the twin adapts
→ you fight as a team → the Mirror has learned you → the final confrontation
```

## Rooms

Seven rooms, always in this order, each drawn from a handcrafted template and dressed by seed:

| # | Type | What happens | Biome |
|---|---|---|---|
| 0 | Entrance | Safe clearing with a pond. Gate north is open. | grove |
| 1 | Combat | 2 Bone Knights, a Gloom Hound, a Hollow Archer. Clear to unlock. | grove |
| 2 | Exploration | Big, loot scattered, two enemies. Open. | grove |
| 3 | Treasure | The Reliquary: a chest (weapon + relic + potions + shards) guarded by one knight. | ruins |
| 4 | Combat | Ruined colonnade, six enemies including a slime. | ruins |
| 5 | Elite | An Elite Bone Knight with archer support. Elites drop weapons and relics. | crypt |
| 6 | Boss | The Mirror Sanctum. | crypt |

Combat rooms lock their gates until every enemy is down. Clearing a room heals if you have
Second Wind. Dying respawns you at the room's entrance after 3 s with everything you had.

## Player

Health, mana (regenerates), XP and level. Facing is the last direction you moved; attacks and
abilities use it. Running (Shift) is faster and reads as mobility to the models.

### Weapons (switch in the inventory, `I`)

| Weapon | Feel | Numbers |
|---|---|---|
| Iron Sword | Three-hit chain; finisher hits ×1.5 and knocks back | 14 dmg · 0.42 s · reach 64 |
| Hunter's Bow | Fast arrows, high crit | 16 dmg · 0.7 s · range 380 · 15% crit |
| Ember Staff | Slow fireballs that burst (AoE 56) | 20 dmg · 0.85 s · 6 mana |
| Frost Staff | Rapid bolts that slow to 55% for 1.6 s | 11 dmg · 0.5 s · 4 mana |

### Abilities (`1`-`4`)

| Slot | Ability | Cost | Cooldown | Effect |
|---|---|---|---|---|
| 1 | Arcane Bolt | 8 | 1.2 s | Piercing projectile, 22 dmg |
| 2 | Flame Burst | 22 | 5 s | Cone in facing direction, 38 dmg with falloff, burns |
| 3 | Shadow Dash | 10 | 2.6 s | Blink 190 units, invulnerable 0.28 s. Dodging a wind-up emits `PLAYER_DODGED`. |
| 4 | Binding Nova | 28 | 8 s | Radius 150, 18 dmg, slows to 35% for 2.6 s |

### Progression

XP: 80 × 1.35^(level-1) to the next level. Each level: +12 max health, +8 max mana, +1 skill point.
The tree (`K`) has four branches × three tiers; tier N needs tier N-1:

- **Mobility**: Swift Feet (+12% speed) → Shadow Step (dash CD -30%) → Phase Walker (+0.2 s dash i-frames)
- **Combat**: Keen Edge (+15% weapon dmg) → Heavy Hands (+40% knockback) → Executioner (+12% crit)
- **Magic**: Arcane Focus (+25 mana) → Pyromancer (+25% spell dmg) → Overflow (+60% regen, -15% ability CD)
- **Survival**: Vitality (+30 HP) → Second Wind (heal 25 on room clear) → Iron Skin (-15% damage taken)

### Loot

Essence (every enemy), Mirror Shards (elites, chests, some drops), health and mana potions (use
from the inventory), weapons (chest, elites) and relics: Ember Heart (+10% spell), Wolf Fang (+10%
weapon), Mirror Eye (twin learns 25% faster). Pickups are magnetised toward the player; the twin
collects too.

## Enemies

| Enemy | Role | Behaviour |
|---|---|---|
| Bone Knight | melee | Approach, 0.42 s wind-up, strike, short recovery step. Retreats when nearly dead. |
| Hollow Archer | ranged | Holds ~70% of 300 range, strafes, 0.55 s wind-up, leads its shot, sidesteps after firing. |
| Gloom Hound | fast | Rushes at 210 speed, bites quickly, darts out 170 units, repeats. |
| Mire Slime | tank | Slow, heavy 15 dmg, 70% knockback resistance, never retreats. |
| Elite Bone Knight | elite | ×2.2 health, ×1.4 damage, better loot, gold ring. |
| The Mirror | boss | 520 HP, three phases, counters from your behaviour model (see AI_ARCHITECTURE.md). |

Enemies pick targets from a threat table: whoever hurts them most gets their attention, so the
twin can pull aggro by attacking. Wind-ups are telegraphed with a red pulse and a floor arc.

## The twin

Spawns beside you with a Frost Staff (give it anything you own from the twin tab). It hits at
60% weapon damage so you remain the one who wins fights. When it drops to zero it is *downed* for
9 s and gets back up at 55% health — it never leaves the run. Its current intent shows above its
head and in the top-right panel; `F3` shows why.

## Death and victory

Dying keeps your inventory and XP. Killing the Mirror ends the run with a stat card and the option
to replay the same seed or roll a new dungeon.
