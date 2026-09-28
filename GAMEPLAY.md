# Gameplay

## The loop

```
a village → a dungeon → your habits emerge → the twin observes → the twin adapts
→ you fight as a team → a guardian → the Mirror has learned you → the confrontation
```

Underneath that, a second loop that is about the world rather than the twin:

```
walk out → mine what is under the ground you are on → train an attribute with it
→ that attribute opens the bottom half of a skill branch → and the ore you did not
spend goes into a weapon instead, which changes what the weapon is for
```

## The world

One continuous world, authored rather than generated. You start in a village and **walk**
out of it — there is no portal in the square any more.

| Region | Terrain | What is in it |
|---|---|---|
| Hollowreach Vale | grassland | **Hollow Reach**: elder, smith, apothecary, hearth, and the people who live there. |
| The Wakewood | forest | Old trees, an ambush terrain, and the crypt's mouth among the roots. |
| Greenmoor | grassland | Fields going back to meadow. The barrow is under the far end of it. |
| The Drowned Flats | marsh | A road the water took. Kell keeps the ferry at the east end. |
| The Windward Downs | grassfield | Open pasture. Esk keeps two hundred head and no market to drive them to; cats come off the high ground when the wind turns. |
| Emberfall Basin | road/ruins | **Emberfall**, in the ribs of something older. The Glasswork is above it. |
| The Kiln Terraces | mountain pass | Cut steps and fired brick, and the last two ways down. |
| The Rimefell | tundra | Above the treeline. Brek counts what comes off the fell, wolves work in threes, and the ground is worth more than what walks on it. |

Regions are joined at **crossings** — a place you find, not a seam you walk into:

| Crossing | Kind | Between |
|---|---|---|
| The Rootbridge | bridge | Hollowreach Vale ↔ The Wakewood |
| Stonecount Bridge | bridge | Hollowreach Vale ↔ Greenmoor |
| Ewesford | bridge | Greenmoor ↔ The Windward Downs |
| The Long Causeway | causeway | Greenmoor ↔ The Drowned Flats |
| The Windgate | pass | The Wakewood ↔ The Rimefell |
| **Kell's Crossing** | ferry | The Drowned Flats ↔ Emberfall Basin — *the campaign's one gate* |
| The Cut | pass | Emberfall Basin ↔ The Kiln Terraces |

Each boundary is a real barrier — a river, a flood, a wall of rock — with one narrow way
through. Kell will not push off until the wood is quiet, and he says so when you walk up to
the jetty; that is the whole of the campaign's gating, and it is a man with a boat rather
than a refusal on a map.

**Two of the eight regions are not on the way to anything.** The Windward Downs and the
Rimefell are off the campaign's spine, ungated, and there is nothing in either one you *need*.
What they have is geology the main route does not — mithril under the fell, and the only
pasture with animals in it — plus the two people who live out there. A world where every road
leads somewhere you must go is a corridor with scenery; these two are the reason the map is
worth opening.

**Villages are places inside regions**, not maps of their own. You come over the ridge, see
the rooftops, and walk in with nothing loading. "Somewhere safe" is therefore a question
about where you are standing rather than which map you are on.

### The five dungeons

| Dungeon | Kind | In | What ends it |
|---|---|---|---|
| Wakewood Crypt | combat | The Wakewood | Your twin is two rooms in. |
| The Stonecount Barrow | **puzzle** | Greenmoor | The Stonecount. |
| The Glasswork | **mirror** | Emberfall Basin | The Kiln Shardmother. |
| The Ashen Deep | combat | The Kiln Terraces | The Ashen Warden. |
| The Mirror Sanctum | mirror | The Kiln Terraces | The Mirror. |

The three archetypes differ in what opens the far door: a **combat** room opens when it is
clear, a **puzzle** room when you work out what opens it (plates you stand on, keys from
further back), and a **mirror** room wants both at once. Dungeons branch — side rooms hang
off the main chain, are never on the way to anywhere, and always have something in them.

A **descent** keeps its portal: going underground is a threshold and should read as one. The
map (`M`) shows what you have found, and it fills in as you walk rather than all at once.

Rooms inside a dungeon come from handcrafted templates dressed by seed. Combat rooms lock their
gates until every enemy is down. A room's treasure is laid out once, ever — walking away from
loot does not make the room farmable. Finishing a dungeon pays its reward exactly once and opens
the way home.

## The village

Talk with `E` when you are standing near someone.

- **Elder Mara** carries the quest, and says different things once you have found your twin.
- **Oren the Smith** sells the bow (140), ember staff (190), frost staff (190) and Wolf Fang (260),
  works a weapon up its three tiers, fits your ore into it and sets your stones.
- **Siv the Apothecary** sells health potions (35), mana potions (30) and Ember Heart (260).
- **Bram** sells trail bread (14) — the answer to a hunger bar, in the village the game opens in.
- **The Hearth** restores you and your twin, cooks everything raw in both your bags, and writes
  a checkpoint.

The smith, the apothecary and the elder will all **train an attribute** for ore. Any of the
three will train any of the five: splitting them by attribute was the first version and it
meant walking across a village to spend ore you were already standing next to the right
person to spend.

Gold is the only thing vendors take. Enemies drop it; a dungeon pays a lump on completion. Out
in the world, **Esk** on the Downs sells meat and bread below village price because she has no
market to drive her herd to, and **Brek** on the fell sells the same things dearer because
everything up there came up on somebody's back.

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

### Food and hunger

A second bar under your health, and it drains on **what you do, not how long you have been
playing**: three points per thousand units walked, and 0.22 per swing, cast or ability. A hunger
bar on a clock punishes reading the journal, comparing two weapons in a menu or standing up to
answer the door — none of which is what the mechanic is about. On activity it is a cost of
*expedition*, which is.

Three bands, not one falling number:

| Band | Where | What it is worth |
|---|---|---|
| **Fed** | above 75% | +6% damage, +5% pace |
| Fine | 25–75% | Nothing |
| **Hungry** | below 25% | −20% damage, **+15% damage taken**, −8% pace |

A bar you can only ever lose by is a chore; a bar you can win by is a reason to cook. Most of a
session sits in the middle not thinking about it. Nothing here can kill you — the penalty is a
flat band rather than a slope, so going without food is a cost you can carry rather than a spiral
you cannot climb out of. **Vigour** slows the drain, up to 75%.

**It freezes the moment a boss is in the room**, and the penalty lifts with it. This is the
load-bearing half: v1.1 measured the regional bosses at 0.67 and 0.89 clear after fixing their
telegraphs, and a combat-and-defence debuff multiplies straight into those numbers with nothing
in the measurement able to see it. A player who walked into a boss room hungry would be fighting
a different fight from the one that was tuned and would have no way to tell.

| Food | Fills | Where |
|---|---|---|
| Raw Meat | 14 | Off a cow or a sheep. Edible. Barely. |
| Trail Bread | 28 | Bram (14g), Esk (10g), Brek (22g) |
| Cooked Meat | 48 | Any hearth, from raw meat — or Esk (18g), Brek (34g) |

Eating goes through the same path as drinking: it takes the same moment, it is interrupted by
being hit, and **Steady Hand** lets you do it walking. Food carries no healing at all,
deliberately — food that heals is a cheap potion, and the moment it is a cheap potion the
apothecary has nothing to sell.

### Damage reduction

Aegis cuts 40%. Your twin cuts 25% more while it is actually running PROTECT and standing near
you — it is a read of what the twin is doing, not a buff it casts. Together they cap at 60%.
Nothing stacks to immunity; dashing is the only way to take zero.

### Progression: two layers, one economy

There are **two** things to spend and they are not interchangeable. Levels buy the tree, which
changes how the game plays. Ore buys attributes, which change the numbers. And the tree's deep
tiers are **gated on attributes**, so neither layer finishes on its own:

```
   fighting  →  XP  →  levels  →  skill points  →  the tree        (behaviour)
   mining    →  ore  →  training  →  attributes  ──┘ gates tiers 3-4   (numbers)
```

This is the whole reason mining exists. A fourth currency with a shop of its own would have
been a parallel system looking for a use; instead ore is the only way to open the bottom half
of a tree you already wanted. Levelling to 20 pays 19 skill points and tier 3 alone asks for
25 points of attributes across the five branches, so **the tree cannot be finished by
levelling** — a test asserts that inequality, because it is the one number holding the two
layers together.

#### The five attributes (`K`)

One per skill branch, and each one is bought with one specific ore. Max 20 each.

| Attribute | Branch | Ore | At 10 points |
|---|---|---|---|
| **Vigour** | Survival | iron | +80 max health, hunger bites 40% slower |
| **Might** | Combat | obsidian | +30% weapon damage, +40% knockback |
| **Finesse** | Mobility | mithril | +15% attack speed, +8% crit chance |
| **Focus** | Magic | gold | +60 max mana, +30% spell damage |
| **Bond** | Mirror | silver | Twin hits 30% harder and learns 20% faster |

Training costs rise per point, and **rarer ore buys more per unit**: Vigour to 5 is 15 iron,
Might to 5 is 7 obsidian. **Coal is on every bill** — the first point in anything is one coal, the
tenth is five — which is what stops the rare ores being the only thing worth mining, and what
finally caps how deep you can go: taking all five attributes to the tier-4 gate costs more coal
than the ground holds, however much iron is left over.

Note what is *not* on that list. Diamond and adamantine, the two tier-4 materials, buy no
attribute at all. A tier-4 vein gives up one unit and the whole campaign holds about two of each,
which is exactly enough to change what a weapon is and nowhere near enough to buy twenty points
of anything — so they are fitting materials only. (Might was fed by adamantine when this was
first written, which made the Combat branch's deep tiers unreachable by mining. Found by
arithmetic rather than by play; the test that now guards it is
`test_every_attribute_gate_is_reachable_by_mining`.)

| Skill tier | Needs |
|---|---|
| 1, 2 | Nothing. Levels alone. |
| 3 | 5 points in that branch's attribute |
| 4 | 10 points |

XP: 80 × 1.35^(level-1) to the next level. Each level: +12 max health, +8 max mana, +1 skill
point, **+1 attribute point** (spendable without a trainer, anywhere, into anything). The tree
(`K`) has five branches × four tiers; tier N needs tier N-1. **The first point in a branch is a
number and everything past it is a behaviour** — a tree of percentages is a tree where picking a
branch changes how hard you hit rather than how you play:

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

### Mining

Ore veins are in the ground — four to a region, two to a dungeon room — and you mine them by
standing next to one and pressing the interact key (`E`, the same key you talk with; there is no
new button and no tool). One swing gives one unit and holds you still, the same commitment a
drink is and interrupted the same way. Then the vein is gone for good.

**What is in it depends on where you are standing**, so the map is a geology map:

| Where | What is under it |
|---|---|
| Grassland, pasture | Coal and iron, in quantity |
| Forest, grove | Coal, iron, a little silver |
| Marsh | Silver, and the first gold |
| Road, ruins | Gold, and obsidian among the stones |
| Mountain pass | Mithril and obsidian |
| **Tundra** | Mithril, in more quantity than anywhere else |
| **Crypt** | Everything, including the only diamond and adamantine in the game |

**A vein's size is inverted against its value**: a tier-1 vein gives up four units, a tier-4
vein gives one. Common ore comes out in handfuls and a diamond vein is one stone and a lot of
walking, which is what keeps a tier-4 material from being a tier-1 material with a bigger number
on it. Veins do not regenerate — a region's ore is finite, deliberately, so there is nothing to
farm.

The two rarest materials exist in crypt rock alone, which means the deepest thing in the game is
also the only place the best ore is: you are not sent somewhere new to grind for it, you find it
where you were already going.

### The forge

Ore does two things. Trained, it buys attributes. **Fitted**, it changes the shape of a weapon.

| Material | What it does | Wrong weapon |
|---|---|---|
| **Iron** | +12% damage, +8% cooldown — heavier, slower | — |
| **Gold** | −25% mana cost, −4% damage | Favours staves; spoils swords and pikes |
| **Silver** | +4% damage, +5% crit, and your twin reads the weapon faster | — |
| **Obsidian** | Ignores a third of armour, −6% damage | Favours swords and bows; spoils staves |
| **Mithril** | −22% cooldown, −35% knockback | — |
| **Diamond** | +60% crit multiplier, +5% cooldown | — |
| **Adamantine** | +40% knockback, and nothing knocks you out of a swing | — |
| Coal | Fuel. It goes in the fire, not in the weapon. | — |

Every one of them is a **trade**, not an upgrade — which is the answer to "+0.3% damage per
iron". A flat percentage per unit is a number you add until you run out; on the real numbers it
would have been four hundredths of a point of damage per iron, invisible and endless. A material
that makes the weapon *heavier* is a decision about what the weapon is for.

**Affinity** is the second half of that. Gold in a staff is gold doing what gold does; gold on a
sword edge halves the upside and doubles the penalty, and the smith says so before you spend it.
Slots come with the bench tier — 1, 1, 2, then 3 — so a fully worked weapon holds three fittings
and you can strip them back out.

### Relic stones

Seven stones over three tiers, dropped by anything you kill, and **socketed into a weapon at its
third bench tier** (three sockets). A stone's tier decides how it is *found*, not how strong it
is: a Cinder Shard in the right weapon beats a Sunderstone in the wrong one.

| Stone | Tier | What it does |
|---|---|---|
| Cinder Shard | 1 | Spells burn 15% hotter |
| Quiet Stone | 1 | Mana comes back half again as fast |
| Riftstone | 2 | Everything recharges a fifth faster |
| Leechstone | 2 | Every blow that lands returns 3 mana |
| Rimestone | 2 | What you hit moves at 60% for 1.5 s |
| The Mirror's Tear | 3 | +40% spell damage and +25 max mana |
| Sunderstone | 3 | +10% crit chance and +50% crit multiplier |

The drop rates are the ones asked for — **1/200, 1/1000, 1/10000** by tier — with a **pity
floor** underneath: a drought counter per tier, saved with the run, guarantees a tier-1 by 80
kills, a tier-2 by 400 and a tier-3 by 2000. The floor is what makes the rate sayable. A raw
1-in-10000 is about fifty playthroughs for one stone, which is not rarity, it is absence; with a
floor the same number becomes *"vanishingly rare, and never worse than one in two thousand"* —
and that is a sentence a test can check, where "it feels rare" is not.

Each of the three **regional bosses awards a tier-3 stone outright**, so the best stones have a
route that is a fight rather than a dice roll. The Mirror deliberately awards none: the ending is
not a loot table.

### The bench

A weaponsmith works a weapon up three tiers for **gold, mirror shards and essence** — which is
what those last two are finally *for*. Each tier is +14%, +30%, +50% damage, and the third
turns on the weapon's own perk. The upgrade belongs to the weapon, not to you: a sword worked
to its third tier does nothing for the bow in your other hand.

Bench tier also decides how much a weapon can *carry*: fitting slots at 1/1/2/3, and its three
stone sockets at tier 3.

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
| The Stonecount | boss | Never stops calling for help. The fight is what you deal with first. |
| The Kiln Shardmother | boss | A seven-shard fan you cannot sidestep. Get behind a pillar or get inside it. |
| The Ashen Warden | boss | Three phases, a slam you can see coming, and the nest it was keeping down there. |
| The Mirror | boss | Three phases, and the only thing in the game that counters your behaviour model. |

### The wild

Five creatures that are not undead and are not in a dungeon. They are what makes a region
somewhere you *are* rather than a corridor between two doors.

| Creature | Where | The question it asks |
|---|---|---|
| Moorland Cow | pasture, grassland | None. It grazes, and it runs when you hit it. 70 health and no damage: it is food. |
| Fell Sheep | pasture, tundra | The same, faster and smaller. |
| Reach Tiger | the Downs, grassland | 21 damage and sees you at 420 units — further than anything else that has to close the distance. It charges. |
| Shadepelt | forest, the Downs | Fastest thing in the game. Darts in, bites, leaves before you turn round. |
| Winter Wolf | the fell | Works in threes, and the tundra is where you find out what that means. |

**Livestock has no aggro range and deals no damage.** It grazes until something hits it, and then
it runs and never stops running. That is the whole of it: a mechanic, not an enemy — a cow is a
question about whether you want to stop walking, and the answer is meat.

Killing one drops **raw meat** and nothing else: no essence, no gold, no shards, no chance of a
relic (2–3 XP, which is not a living). Essence is what a creature of the Reach leaves behind and
a cow is not one of those — so a pasture is a larder, not a farm.

The three regional bosses are **milestones, not Mirrors**. They run a fixed, legible phase
ladder and read nothing about you: you beat the Mirror by being unpredictable, and you beat
these by paying attention. Each announces a special, holds still while it winds up, and
lands it at the end — the telegraph is the encounter.

Enemies pick targets from a threat table: whoever hurts them most gets their attention, so the
twin can pull aggro. Wind-ups are telegraphed with a red pulse and a floor arc, always drawn
under the sprite so art can never hide one. Deeper areas scale health and damage but never speed,
range or wind-up — those are what you have learned to read.

**Damage leads the ramp.** The five dungeons run ×1.1 → ×1.2 → ×1.4 → ×1.6 → ×1.8, and a
region's multiplier goes into damage in full and into health at 60% of it: going deeper means
mistakes cost more rather than fights lasting longer.

## The twin

**You do not start with it.** It is dormant until you find it two rooms into the Wakewood Crypt.
Before that it does not decide, move, fight or pick things up. After that it is a participant:
it fights on its own, picks up weapons it walks over, and chooses between the ones it owns.

It hits at 60% weapon damage so you remain the one who wins fights. Downed at zero health for 9 s,
then back at 55% — it never leaves the run. Its current intent shows above its head and in the
HUD; `F3` shows why. Ask for a weapon it carries on the Character screen and it hands the weapon
over rather than duplicating it.

### It keeps itself alive

The twin has a pack, a purse and an appetite, and it uses all three without being asked.

- **It keeps what it walks over.** Up to three of any potion or food, then it hands the surplus
  across to you. Before v1.2 every consumable it collected went straight into your bag, which is
  why a companion with an inventory had never once drunk a potion.
- **It has its own money** — a quarter of the gold it personally picks up. That cut is why "the
  twin bought itself potions" is something you watch happen rather than a number that changed.
- **It drinks.** When it is hurt, when nothing is on top of it, and never into a wind-up. If
  something *is* on top of it, it backs off first and drinks when it is clear — which is not a
  scripted sequence: retreating and drinking are scored in the same pass, both penalised by how
  close the nearest enemy is, and the order falls out of the two curves crossing.
- **It eats**, on the same hunger rules you do, and a hearth cooks its meat alongside yours.
- **It shops.** With money, an empty pack and nothing to fight, it walks to a merchant and buys
  its own potions.

It is held to **your** numbers throughout: the same drink duration, the same six-second shared
cooldown, the same refusal to drink at full health, and the same spilled flask when something
hits it mid-drink. A companion that could chain potions six times faster than you would be a
different creature.

**Three things it learns about looking after itself**, and the first one is the interesting one:

| It learns | From you | From itself |
|---|---|---|
| *When to drink* | The health fraction **you** drink at. Sip at 80% and you get a twin that sips; gamble to 10% and you get a twin that gambles. | Going down with a potion still in the pack, which pushes it to drink sooner. |
| *How much to carry* | Watching you buy potions. | Going down with an empty pack. |
| *Whether money is for spending* | Watching you shop. | Dying broke. |

Going down teaches it opposite lessons depending on what was in the pack — died holding a potion
is a timing mistake, died with nothing is a supply mistake — so the event carries the count.

`F3` shows all twelve style dimensions it has opinions about, ordered by how sure it is.

## Checkpoints

Written when you reach a village, when you rest at a hearth, and when you find your twin.
Progression is saved — level, skills, **attributes, ore, stones, what is fitted into which
weapon**, inventory, gold, quest flags, both hunger bars, the twin's kit and the stone drought
counters — not a frozen simulation. A save written before v1.2 is migrated forward rather than
discarded: it is paid the attribute points its level earned, so an existing run opens the new
layer at the level it had already reached.

The learned player model **is** saved, in the slot it was learned in: a save is one file, so
deleting it deletes the twin trained in it and a stale model can never attach itself to a run that
did not produce it. Two slots never share a twin. The twin's own learned *style* is not saved yet
— it relearns you each session.

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
| E | Talk to whoever you are standing next to — or mine the vein you are standing next to, when nobody is |
| C | Character |
| I | Inventory |
| K | Skills and attributes |
| M | World map |
| L | Journal: quests and the codex |
| P / Esc | Pause |
| F3 | AI debug overlay |

Every one of these is rebindable from Pause → Controls, primary and secondary. Escape is not: it
is the way out of the screen you would be rebinding from. Binding a key that is already taken
steals it rather than refusing, and says which row lost it. Bindings persist in the browser.
