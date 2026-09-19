# Gameplay

## The loop

```
a village → a dungeon → your habits emerge → the twin observes → the twin adapts
→ you fight as a team → a guardian → the Mirror has learned you → the confrontation
```

## The world

Five authored areas, not a generated continent. You start in a village and walk out of it.

| Area | Kind | What it is |
|---|---|---|
| Hollow Reach | village | The start. Elder, smith, apothecary, hearth. Safe. |
| Wakewood Crypt | dungeon | Five rooms. Your twin is two rooms in. |
| Emberfall | village | Opens once the crypt is quiet. Second hub. |
| The Ashen Deep | dungeon | Six rooms, ×1.35 difficulty, the Warden at the bottom. |
| The Mirror Sanctum | dungeon | Two rooms. The Mirror. |

Doors link rooms inside a dungeon. **Portals** link areas, and you can only set out from a
village: leaving a dungeon means walking out of it. The map (`M`) shows what you have found,
what is open, and where you are.

Rooms inside a dungeon come from handcrafted templates dressed by seed. Combat rooms lock their
gates until every enemy is down. A room's treasure is laid out once, ever — walking away from
loot does not make the room farmable. Finishing a dungeon pays its reward exactly once and opens
the way home.

## The village

Talk with `E` when you are standing near someone.

- **Elder Mara** carries the quest, and says different things once you have found your twin.
- **Oren the Smith** sells the bow (140), ember staff (190), frost staff (190) and Wolf Fang (260).
- **Siv the Apothecary** sells health potions (35), mana potions (30) and Ember Heart (260).
- **The Hearth** restores you and your twin, and writes a checkpoint.

Gold is the only thing vendors take. Enemies drop it; a dungeon pays a lump on completion.

## Player

Health, mana (regenerates), XP and level. Facing is the last direction you moved; attacks and
abilities use it — the mouse is only for menus. Running (Shift) is faster and reads as mobility
to the models.

### Weapons

Two carried at a time. `Q` swaps them; the Character screen (`C`) changes what you carry.

| Weapon | Feel | Numbers |
|---|---|---|
| Iron Sword | Three-hit chain; finisher hits ×1.5 and knocks back | 14 dmg · 0.42 s · reach 64 |
| Hunter's Bow | Fast arrows, high crit | 16 dmg · 0.7 s · range 380 · 15% crit |
| Ember Staff | Slow fireballs that burst (AoE 56) | 20 dmg · 0.85 s · 6 mana |
| Frost Staff | Rapid bolts that slow to 55% for 1.6 s | 11 dmg · 0.5 s · 4 mana |

The starter sword finishes the main route. The others change how it feels, not whether it works.

### Abilities (`1`-`4`, six to choose from)

| Ability | Cost | Cooldown | Effect |
|---|---|---|---|
| Arcane Bolt | 8 | 1.2 s | Piercing projectile, 22 dmg |
| Flame Burst | 22 | 5 s | Cone in facing direction, 38 dmg with falloff, burns |
| Shadow Dash | 10 | 2.6 s | Blink 190 units, invulnerable 0.28 s |
| Binding Nova | 28 | 8 s | Radius 150, 18 dmg, slows to 35% for 2.6 s |
| Mending Light | 26 | 11 s | Channels 0.55 s, restores 45. **A hit interrupts it and refunds nothing.** |
| Aegis | 20 | 14 s | Cuts incoming damage 40% for 5 s |

Four are equipped at a time; swap them on the Character screen.

### Potions (`F` health, `G` mana)

Drinking is an action, not a click. It takes 0.4 s, cuts your movement to 45%, and locks out
attacking, casting and dashing. Both potions share one 6 s cooldown. Health restores 40, mana 35.
Drinking at full is refused rather than wasted, and a drink cut short by death costs you nothing.

### Damage reduction

Aegis cuts 40%. Your twin cuts 25% more while it is actually running PROTECT and standing near
you — it is a read of what the twin is doing, not a buff it casts. Together they cap at 60%.
Nothing stacks to immunity; dashing is the only way to take zero.

### Progression

XP: 80 × 1.35^(level-1) to the next level. Each level: +12 max health, +8 max mana, +1 skill point.
The tree (`K`) has four branches × three tiers; tier N needs tier N-1:

- **Mobility**: Swift Feet (+12% speed) → Shadow Step (dash CD -30%) → Phase Walker (+0.2 s dash i-frames)
- **Combat**: Keen Edge (+15% weapon dmg) → Heavy Hands (+40% knockback) → Executioner (+12% crit)
- **Magic**: Arcane Focus (+25 mana) → Pyromancer (+25% spell dmg) → Overflow (+60% regen, -15% ability CD)
- **Survival**: Vitality (+30 HP) → Second Wind (heal 25 on room clear) → Iron Skin (-15% damage taken)

**Unlearning** ("Unlearn all", on the skill screen) refunds every point at once, in a village,
out of combat. All of it rather than one node at a time: the tree has prerequisites, so
unlearning a tier-1 node under a tier-3 one would leave a build the tree says is impossible.
Relearning the same nodes lands back exactly where you started, and the refund never heals you.

The **first fight of the first dungeon** is authored rather than rolled: four enemies, one of
each role, no brute. Any other combat room may roll any of four templates, but that one is taken
alone, at level one, before the twin has been found.

## Enemies

| Enemy | Role | The question it asks |
|---|---|---|
| Bone Knight | melee | Approach, 0.42 s wind-up, strike. The baseline. |
| Hollow Archer | ranged | Holds range, strafes, leads its shot. Close it or lose health. |
| Gloom Hound | fast | Rushes, bites, darts out. Punishes standing still. |
| Mire Slime | tank | Slow, heavy, 70% knockback resistance. Never retreats. |
| Ash Acolyte | ranged | Never closes, and its bolt slows you. Ignore it and the fight gets away. |
| Crypt Brute | tank | Huge telegraph, 26 damage, barely flinches. You are meant to leave. |
| Husk Scarab | fast | Trivial alone, arrives in sevens, surrounds you. |
| The Ashen Warden | guardian | 420 HP. Keeps hitting the same place, so it is beaten by moving. |
| The Mirror | boss | 520 HP, three phases, counters from your behaviour model. |

Enemies pick targets from a threat table: whoever hurts them most gets their attention, so the
twin can pull aggro. Wind-ups are telegraphed with a red pulse and a floor arc, always drawn
under the sprite so art can never hide one. Deeper areas scale health and damage but never speed,
range or wind-up — those are what you have learned to read.

## The twin

**You do not start with it.** It is dormant until you find it two rooms into the Wakewood Crypt.
Before that it does not decide, move, fight or pick things up. After that it is a participant:
it fights on its own, picks up weapons it walks over, and chooses between the ones it owns.

It hits at 60% weapon damage so you remain the one who wins fights. Downed at zero health for 9 s,
then back at 55% — it never leaves the run. Its current intent shows above its head and in the
HUD; `F3` shows why. Ask for a weapon it carries on the Character screen and it hands the weapon
over rather than duplicating it.

## Checkpoints

Written when you reach a village, when you rest at a hearth, and when you find your twin.
Progression is saved — level, skills, inventory, gold, quest flags, the twin's kit — not a frozen
simulation. The learned player model is deliberately not saved: a model restored out of its own
run would be a different claim than "the twin learned this from you".

A checkpoint is **read back** when you reconnect, so closing the tab does not lose the run. The
session id is the save's name; `?session=name` in the URL picks one, and `?seed=N` starts that
seed over instead of resuming.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Shift | Run |
| J / Space | Attack |
| 1-4 | Abilities |
| F / G | Health / mana potion |
| Q | Swap carried weapon |
| E | Talk to whoever you are standing next to |
| C | Character |
| I | Inventory |
| K | Skills |
| M | World map |
| P / Esc | Pause |
| F3 | AI debug overlay |

Every one of these is rebindable from Pause → Controls, primary and secondary. Escape is not: it
is the way out of the screen you would be rebinding from. Binding a key that is already taken
steals it rather than refusing, and says which row lost it. Bindings persist in the browser.
