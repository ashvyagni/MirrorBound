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
| Ember Staff | A heavy overhead bash; its fire is in its spells | 16 dmg · 0.62 s · reach 74 |
| Frost Staff | A lighter, faster sweep; its frost is in its spells | 12 dmg · 0.48 s · reach 78 |
| Warden's Pike | Long, slow and narrow. Reaches what nothing else does | 21 dmg · 0.78 s · reach 104 |
| Shard Lance | Everything it throws goes in a line, and through | 13 dmg · 0.52 s · reach 80 |

The last two are Emberfall's, and Hask is the only one who sells them.

You begin with **nothing**, because abilities come from weapons: the first one you pick up
is the first time the ability bar has anything on it. A dungeon entrance leaves an iron
sword out when you own no weapon at all, so that moment is something you walked over rather
than something you woke up with.

The starter sword finishes the main route. The others change how it feels, not whether it works.

### Abilities (`1`-`4`)

**Abilities belong to weapons, not to you.** Carrying a sword is what gives you a guard and
a step; carrying a staff is what gives you the spells. The four keys are the main hand's
abilities followed by the offhand's, so what you carry *is* what you can do — there is no
loadout screen to set and forget, and dropping a weapon takes its abilities with it.

| Weapon | Grants |
|---|---|
| Iron Sword | Aegis, Shadow Dash |
| Hunter's Bow | Arrow Volley, Mending Light |
| Ember Staff | Ember Bolt, Flame Burst, Flame Pillar |
| Frost Staff | Frost Bolt, Binding Nova, Arcane Bolt |
| *(empty hands)* | Shadow Dash only |

| Ability | Cost | Cooldown | Effect |
|---|---|---|---|
| Ember Bolt | 6 | 0.85 s | Slow fireball, 20 dmg, bursts for AoE 56 |
| Frost Bolt | 4 | 0.5 s | Rapid bolt, 11 dmg, slows to 55% for 1.6 s |
| Arcane Bolt | 8 | 1.2 s | A **beam**: a 760-unit lance, 22 dmg, hits everything on the line |
| Arrow Volley | 12 | 2.4 s | Fast arrow, 15 dmg |
| Flame Burst | 22 | 5 s | Cone in facing direction, 38 dmg with falloff, burns |
| Flame Pillar | 24 | 6.5 s | Column around you after a 0.25 s wind-up, 34 dmg, radius 120 |
| Binding Nova | 28 | 8 s | Radius 150, 18 dmg, slows to 35% for 2.6 s |
| Mending Light | 26 | 11 s | Channels 0.55 s, restores 45. **A hit interrupts it and refunds nothing.** |
| Aegis | 20 | 14 s | Cuts incoming damage 40% for 5 s |
| Shadow Dash | 10 | 2.6 s | Blink 190 units, invulnerable 0.28 s |

A staff's basic attack is a **bash**, not a bolt — its element is in the spells it grants,
which is what makes a staff three spells and a way to buy time between them rather than a
wand you hold down. Carrying two staves fills all four keys with spells and leaves you
without a dash, which is a real choice rather than a strictly worse one.

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
The tree (`K`) has five branches × four tiers; tier N needs tier N-1. **The first point in a
branch is a number and everything past it is a behaviour** — a tree of percentages is a tree
where picking a branch changes how hard you hit rather than how you play:

- **Mobility**: Swift Feet (+12% speed) → Shadow Step (dash CD −30%) → Phase Walker (dash
  *through* things, +0.2 s i-frames) → Doublestep (a second dash before the cooldown starts)
- **Combat**: Keen Edge (+15% weapon dmg) → Heavy Hands (+40% knockback) → Riposte (strike
  within 0.4 s of a dodge for double) → Executioner (a fourth swing on every melee chain, +12% crit)
- **Magic**: Arcane Focus (+25 mana) → Pyromancer (+25% spell dmg) → Overflow (cast at a walk,
  +60% regen, −15% CD) → Kindling (a kill takes a second off everything cooling)
- **Survival**: Vitality (+30 HP) → Second Wind (heal 25 on room clear) → Steady Hand (drink
  on the move) → Iron Skin (−15% damage, and one killing blow every two minutes leaves you at 1)
- **Mirror**: Shared Sight (twin learns 25% faster) → Close Order (twin hits for 75% instead
  of 60%) → Covering Fire (twin back up in 4 s, not 9) → Reflection (a protecting twin takes
  a third of what you would have)

### The bench

A weaponsmith works a weapon up three tiers for **gold, mirror shards and essence** — which is
what those last two are finally *for*. Each tier is +14%, +30%, +50% damage, and the third
turns on the weapon's own perk. The upgrade belongs to the weapon, not to you: a sword worked
to its third tier does nothing for the bow in your other hand.

**Unlearning** ("Unlearn all", on the skill screen) refunds every point at once, in a village,
out of combat. All of it rather than one node at a time: the tree has prerequisites, so
unlearning a tier-1 node under a tier-3 one would leave a build the tree says is impossible.
Relearning the same nodes lands back exactly where you started, and the refund never heals you.

The **first fight of the first dungeon** is authored rather than rolled: four enemies, one of
each role, no brute. Any other combat room may roll any of the six combat templates, but that one
is taken alone, at level one, before the twin has been found.

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
| Fen Spitter | ranged | Outranges everything but the bow, and can hit you off-screen. One clean hit kills it. |
| Bitterroot Sprout | melee | Notices you at 130 units where everything else sees you at three hundred. The dressing is the ambush. |
| Kiln Shardling | tank | Sheds a fan of five, so sidestepping does not work. Armoured, so it is a decision rather than a race. |
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
simulation. The learned player model **is** saved, in the slot it was learned in: a save is one
file, so deleting it deletes the twin trained in it and a stale model can never attach itself to
a run that did not produce it. Two slots never share a twin.

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
