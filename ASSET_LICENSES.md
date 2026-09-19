# Asset licenses and provenance

This records the project's asset provenance. The original table below predates the world,
enemy and HUD art additions; it is representative, not an exhaustive current inventory.

For 0.1.0, source art lives under `assets/` and 146 generated atlas JSON/PNG pairs live under
`src/web/public/game/`. The pipeline is `src/web/scripts/{sheets,atlaslib,build_atlas}.py`;
generated frame metadata lives under `src/web/src/game/animation/`. Characters, enemies,
weapons, spell effects, buildings, villagers, flora, doors, lights and HUD elements now have
drawn atlas art. Procedural painting remains for floors, effects and fallbacks. Some shipped
sheets, including the corrupted arsenal and several enemy families, are not wired to gameplay.

## 1. Team-made art (Logesh)

Generated for this project by Logesh, then sliced into atlases by `src/web/scripts/build_atlas.py`.
Owned by the team; usable in the game without attribution requirements.

| Asset | Source file | Atlas | Used for |
|---|---|---|---|
| Goat character sheet (idle, walk, run, jump, attack, hurt, die, expressions, attack swirl) | `assets/goatsprite.jpg` | `src/web/public/game/goat/` | Player character, HUD portrait, brand mark |
| Companion "Bro" sheet (idle, hover, four travel directions, dances, surprised, look-around) | `assets/brosprite.jpg` | `src/web/public/game/bro/` | The twin, twin HUD portrait |
| Sword swings A/B/C | `assets/swordsprite{a,b,c}.png` | `src/web/public/game/sword{A,B,C}/` | Sword combo overlay |
| Bow swing | `assets/bowsprite.png` | `src/web/public/game/bow/` | Bow attack overlay |
| Fire wand swing | `assets/firewandsprite.png` | `src/web/public/game/fireStaff/` | Ember Staff overlay |
| Ice wand swing | `assets/icewandsprite.png` | `src/web/public/game/iceStaff/` | Frost Staff overlay |

## 2. Procedurally painted at runtime (this repo, code)

Canvas 2D painting in `src/web/src/game/world/TextureFactory.ts`, `PropPainter.ts` and `paint.ts`
provides floor tiles, effects, critters and fallbacks. `propArt.ts`, enemy animation tables and
projectile mappings select drawn atlas art where available. The following list describes the
procedural texture coverage, not a claim that every listed object still uses it on screen.

Covered: floor tiles per biome (grass, dirt, path, flagstone, water, wall), trees, bushes, rocks,
logs, flowers, grass tufts, mushrooms, pillars, crates, chest, statue, rubble, bones, gravestones,
brazier, candles, torches, well, gates; Bone Knight, Hollow Archer, Gloom Hound, Mire Slime, The
Mirror; arrows, bolts; essence, shards, potions, weapon and relic pickups; particles, glows,
shadows, slash arc, vignette; bird, squirrel, rabbit, frog.

## 3. Audio

All sound is synthesised with the WebAudio API in `src/web/src/game/audio/AudioManager.ts`:
noise bursts and oscillator gestures for effects, a filtered drone with pentatonic plucks for
music. No recorded samples are shipped.

## 4. Fonts

Loaded from Google Fonts at runtime (not shipped in the repo):

| Font | License | Source |
|---|---|---|
| Inter | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Inter |
| Instrument Serif | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Instrument+Serif |
| Silkscreen | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Silkscreen |

If the fonts fail to load, the UI falls back to system fonts.

## 5. Not used (and why)

The directive listed Kenney (CC0), OpenGameArt and similar catalogues as sources. None were
downloaded in this pass: external downloads need explicit sign-off, and the CC0 packs available are
pixel art or flat vector, which would sit badly next to the painted characters. If the team later
wants a drawn tileset, replace the corresponding `paint(...)` calls in `TextureFactory.ts` with
`this.load.image(...)` in `PreloadScene.ts` and record the pack here with author, license and URL.
