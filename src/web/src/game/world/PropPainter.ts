/**
 * Painters for props, enemies and ambient critters.
 *
 * Every function is idempotent (keys are checked) and seeded by key, so the
 * third bush always looks like the third bush.
 */

import type Phaser from 'phaser';

import { blob, glow, paint, poly, rgba, shade, speckle, type Ctx } from './paint';

const OUTLINE = 'rgba(18,12,22,0.65)';

// --- props ------------------------------------------------------------------

function canopy(ctx: Ctx, cx: number, cy: number, r: number, base: string, rng: () => number): void {
  // Several overlapping shaded blobs read as painted foliage.
  const lobes = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rng() * 0.6;
    const d = r * (0.35 + rng() * 0.3);
    blob(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.5 + rng() * 0.2), r * (0.45 + rng() * 0.2),
         shade(base, 0.85 + rng() * 0.3), { outline: OUTLINE, highlight: 0.3, shadow: 0.35 });
  }
  blob(ctx, cx, cy - r * 0.15, r * 0.7, r * 0.6, shade(base, 1.08), { outline: 'rgba(0,0,0,0)', highlight: 0.4 });
  speckle(ctx, rng, cx + r, cy + r, 18, [shade(base, 1.5), shade(base, 0.7)], 0.8, 2, 0.4);
}

export function paintProps(scene: Phaser.Scene): void {
  const greens = ['#4f8a44', '#3f7a52', '#5d9a4a'];
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:tree:${v}`, 72, 104, (ctx, rng) => {
      // trunk
      poly(ctx, [[31, 100], [41, 100], [39, 58], [33, 58]], '#5a3d2a', OUTLINE);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(33, 60, 2, 36);
      canopy(ctx, 36, 42, 30, greens[v] ?? '#4f8a44', rng);
    });
  }
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:tree_big:${v}`, 112, 150, (ctx, rng) => {
      poly(ctx, [[46, 146], [66, 146], [62, 86], [50, 86]], '#523524', OUTLINE);
      poly(ctx, [[40, 146], [50, 140], [50, 146]], '#452c1e');
      poly(ctx, [[72, 146], [62, 140], [62, 146]], '#452c1e');
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(52, 90, 3, 50);
      canopy(ctx, 56, 60, 48, v === 0 ? '#3f7a52' : '#5a8a3c', rng);
    });
  }
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:bush:${v}`, 44, 34, (ctx, rng) => {
      canopy(ctx, 22, 20, 14, ['#4a7f3e', '#5b8f45', '#3e6f4a'][v] ?? '#4a7f3e', rng);
      if (v === 1) {
        for (let i = 0; i < 5; i++) blob(ctx, 8 + rng() * 28, 12 + rng() * 14, 1.8, 1.8, '#d62e6c', { outline: 'rgba(0,0,0,0)' });
      }
    });
  }
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:rock:${v}`, 40, 30, (ctx, rng) => {
      poly(ctx, [[4, 26], [2, 16], [10, 6], [22, 3], [34, 9], [38, 20], [33, 27]], '#77757c', OUTLINE);
      poly(ctx, [[10, 6], [22, 3], [30, 9], [18, 12]], 'rgba(255,255,255,0.22)');
      poly(ctx, [[4, 26], [33, 27], [38, 20], [30, 22]], 'rgba(0,0,0,0.22)');
      speckle(ctx, rng, 40, 30, 10, ['#5e5c63', '#98959c'], 0.6, 1.4, 0.5);
      if (v === 2) blob(ctx, 14, 20, 6, 3, '#4f7a3c', { outline: 'rgba(0,0,0,0)' });
    });
  }
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:rock_big:${v}`, 68, 50, (ctx, rng) => {
      poly(ctx, [[6, 46], [2, 26], [14, 10], [34, 4], [54, 10], [66, 30], [60, 46]], '#6e6c74', OUTLINE);
      poly(ctx, [[14, 10], [34, 4], [50, 12], [30, 18]], 'rgba(255,255,255,0.2)');
      poly(ctx, [[6, 46], [60, 46], [66, 30], [40, 38]], 'rgba(0,0,0,0.25)');
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(30, 12);
      ctx.lineTo(36, 30);
      ctx.lineTo(28, 44);
      ctx.stroke();
      speckle(ctx, rng, 68, 50, 14, ['#55535b', '#928f97'], 0.6, 1.6, 0.5);
    });
  }
  paint(scene, 'prop:log:0', 60, 26, (ctx, rng) => {
    blob(ctx, 30, 14, 28, 9, '#6a4a32', { outline: OUTLINE, highlight: 0.25 });
    blob(ctx, 55, 14, 5, 8, '#c9a27a', { outline: OUTLINE });
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(6 + rng() * 40, 8 + rng() * 10);
      ctx.lineTo(16 + rng() * 40, 8 + rng() * 10);
      ctx.stroke();
    }
  });
  const petals = ['#f5a4c0', '#f0c060', '#a0cae4', '#ffffff'];
  for (let v = 0; v < 4; v++) {
    paint(scene, `prop:flowers:${v}`, 26, 20, (ctx, rng) => {
      ctx.strokeStyle = '#3f6b3a';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const x = 4 + rng() * 18, y = 10 + rng() * 8;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, y);
        ctx.stroke();
        blob(ctx, x, y, 2.6, 2.6, petals[v] ?? '#fff', { outline: 'rgba(0,0,0,0.25)', highlight: 0.5 });
        ctx.fillStyle = '#f0c060';
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:grass_tuft:${v}`, 26, 20, (ctx, rng) => {
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const x = 3 + rng() * 20;
        ctx.strokeStyle = rgba(['#6b9c58', '#4f8a44', '#8ab86a'][v] ?? '#6b9c58', 0.9);
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, 10, x + (rng() - 0.5) * 12, 2 + rng() * 6);
        ctx.stroke();
      }
    });
  }
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:mushrooms:${v}`, 22, 18, (ctx) => {
      for (const [x, s] of [[6, 1], [14, 1.4], [18, 0.8]] as const) {
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(x - 1.5 * s, 10, 3 * s, 8);
        blob(ctx, x, 9, 5 * s, 3.5 * s, v === 0 ? '#d64a3f' : '#c9a27a', { outline: OUTLINE, highlight: 0.4 });
        if (v === 0) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x - 1, 8, 1, 0, Math.PI * 2);
          ctx.arc(x + 2, 9, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:pillar:${v}`, 44, 118, (ctx, rng) => {
      // base, shaft, capital
      poly(ctx, [[4, 116], [40, 116], [36, 104], [8, 104]], '#7d7880', OUTLINE);
      poly(ctx, [[10, 104], [34, 104], [32, 14], [12, 14]], '#8e8993', OUTLINE);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(13, 16, 4, 86);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(27, 16, 5, 86);
      poly(ctx, [[6, 14], [38, 14], [36, 4], [8, 4]], '#7d7880', OUTLINE);
      speckle(ctx, rng, 44, 118, 20, ['#6a656f', '#a19ca6'], 0.6, 1.6, 0.4);
      if (v === 1) blob(ctx, 20, 96, 9, 4, '#4f7a3c', { outline: 'rgba(0,0,0,0)' });
    });
    paint(scene, `prop:broken_pillar:${v}`, 44, 64, (ctx, rng) => {
      poly(ctx, [[4, 62], [40, 62], [36, 50], [8, 50]], '#7d7880', OUTLINE);
      poly(ctx, [[10, 50], [34, 50], [33, 22 + v * 8], [24, 10 + v * 6], [16, 18], [12, 26]], '#8e8993', OUTLINE);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(13, 28, 4, 22);
      speckle(ctx, rng, 44, 64, 12, ['#6a656f', '#a19ca6'], 0.6, 1.6, 0.4);
    });
    paint(scene, `prop:crate:${v}`, 36, 36, (ctx) => {
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(2, 6, 32, 28);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 6, 32, 28);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(2, 6);
      ctx.lineTo(34, 34);
      ctx.moveTo(34, 6);
      ctx.lineTo(2, 34);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(4, 8, 28, 3);
    });
  }
  paint(scene, 'prop:chest:0', 44, 36, (ctx) => {
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(4, 14, 36, 20);
    poly(ctx, [[4, 14], [40, 14], [40, 6], [22, 2], [4, 6]], '#8d5a34', OUTLINE);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 14, 36, 20);
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(6, 15, 32, 3);
    ctx.fillRect(19, 12, 6, 10);
    glow(ctx, 22, 8, 12, '#f0c060', 0.4);
  });
  paint(scene, 'prop:statue:0', 52, 108, (ctx, rng) => {
    poly(ctx, [[4, 106], [48, 106], [44, 92], [8, 92]], '#726d78', OUTLINE);
    // hooded figure
    poly(ctx, [[14, 92], [38, 92], [36, 44], [30, 30], [26, 12], [22, 30], [16, 44]], '#8e8993', OUTLINE);
    poly(ctx, [[20, 34], [32, 34], [30, 24], [26, 18], [22, 24]], '#4a4650');
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(17, 46, 4, 44);
    speckle(ctx, rng, 52, 108, 16, ['#5e5a64', '#a29da7'], 0.6, 1.6, 0.4);
    blob(ctx, 40, 100, 7, 3, '#4f7a3c', { outline: 'rgba(0,0,0,0)' });
  });
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:rubble:${v}`, 38, 22, (ctx, rng) => {
      for (let i = 0; i < 5 + v; i++) {
        blob(ctx, 4 + rng() * 30, 8 + rng() * 10, 3 + rng() * 4, 2 + rng() * 2.5, '#7a7680', { outline: OUTLINE, highlight: 0.3 });
      }
    });
  }
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:bones:${v}`, 34, 18, (ctx, rng) => {
      ctx.strokeStyle = '#e6dfd0';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const x = 4 + rng() * 22, y = 4 + rng() * 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8 + rng() * 4, y + (rng() - 0.5) * 6);
        ctx.stroke();
      }
      if (v === 1) blob(ctx, 24, 10, 5, 4.5, '#e6dfd0', { outline: OUTLINE, highlight: 0.3 });
    });
  }
  for (let v = 0; v < 3; v++) {
    paint(scene, `prop:gravestone:${v}`, 30, 44, (ctx, rng) => {
      const w = 22, x = 4;
      ctx.fillStyle = '#6e6a76';
      ctx.beginPath();
      if (v === 0) {
        ctx.moveTo(x, 42);
        ctx.lineTo(x, 12);
        ctx.arc(x + w / 2, 12, w / 2, Math.PI, 0);
        ctx.lineTo(x + w, 42);
      } else if (v === 1) {
        ctx.rect(x, 6, w, 36);
      } else {
        ctx.moveTo(x, 42);
        ctx.lineTo(x + 2, 10);
        ctx.lineTo(x + w / 2, 4);
        ctx.lineTo(x + w - 2, 10);
        ctx.lineTo(x + w, 42);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 3, 14, 3, 24);
      speckle(ctx, rng, 30, 44, 8, ['#4f4c56', '#8d8993'], 0.6, 1.5, 0.5);
    });
  }
  paint(scene, 'prop:brazier:0', 40, 56, (ctx) => {
    poly(ctx, [[8, 54], [32, 54], [28, 46], [12, 46]], '#4a4650', OUTLINE);
    ctx.fillStyle = '#3d3944';
    ctx.fillRect(18, 28, 4, 18);
    poly(ctx, [[4, 20], [36, 20], [30, 32], [10, 32]], '#5a5560', OUTLINE);
    glow(ctx, 20, 16, 14, '#ff9a3c', 0.6);
  });
  for (let v = 0; v < 2; v++) {
    paint(scene, `prop:candles:${v}`, 26, 18, (ctx, rng) => {
      for (let i = 0; i < 3 + v; i++) {
        const x = 4 + rng() * 18, h = 6 + rng() * 8;
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(x - 1.5, 18 - h, 3, h);
        glow(ctx, x, 18 - h - 2, 4, '#ffb13d', 0.8);
      }
    });
  }
  paint(scene, 'prop:torch:0', 18, 44, (ctx) => {
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(7, 12, 4, 32);
    ctx.fillStyle = '#4a4650';
    ctx.fillRect(5, 10, 8, 5);
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(6, 40, 6, 4);
  });
  paint(scene, 'prop:torch:1', 18, 44, (ctx) => {
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(7, 12, 4, 32);
    ctx.fillStyle = '#4a4650';
    ctx.fillRect(5, 10, 8, 5);
  });
  paint(scene, 'prop:well:0', 56, 60, (ctx) => {
    blob(ctx, 28, 44, 24, 12, '#7d7880', { outline: OUTLINE });
    blob(ctx, 28, 44, 14, 6, '#2a5f7a', { outline: 'rgba(0,0,0,0.4)', highlight: 0.5 });
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(6, 10, 4, 34);
    ctx.fillRect(46, 10, 4, 34);
    poly(ctx, [[2, 12], [54, 12], [28, 2]], '#6a4a32', OUTLINE);
  });
  paintVillage(scene);
}

// --- the village ---------------------------------------------------------------
// A village has to read as somewhere people live, and the people in it have to
// be findable: each vendor is drawn differently enough to pick out across the
// square, because "walk up to the smith" is the instruction the game gives.

/** A standing figure: the shared silhouette every villager is a variation of. */
function villager(
  ctx: Ctx, rng: () => number, robe: string, trim: string, accent: string,
  opts: { hood?: boolean; apron?: boolean } = {},
): void {
  const cx = 22;
  blob(ctx, cx, 62, 16, 5, 'rgba(10,8,14,0.34)', { outline: 'rgba(0,0,0,0)' });   // ground shadow
  // Robe: wider at the hem so it reads as cloth rather than a pillar.
  poly(ctx, [[cx - 8, 26], [cx + 8, 26], [cx + 13, 62], [cx - 13, 62]], robe, OUTLINE);
  poly(ctx, [[cx - 13, 62], [cx + 13, 62], [cx + 11, 58], [cx - 11, 58]], shade(robe, 0.7), 'rgba(0,0,0,0)');
  if (opts.apron) {
    poly(ctx, [[cx - 7, 32], [cx + 7, 32], [cx + 9, 58], [cx - 9, 58]], trim, 'rgba(0,0,0,0.3)');
  }
  // Shoulders and sleeves.
  blob(ctx, cx - 10, 32, 5, 7, shade(robe, 0.85), { outline: OUTLINE });
  blob(ctx, cx + 10, 32, 5, 7, shade(robe, 0.85), { outline: OUTLINE });
  // Head, hooded or bare.
  if (opts.hood) {
    poly(ctx, [[cx - 9, 24], [cx + 9, 24], [cx + 6, 8], [cx - 6, 8]], shade(robe, 1.12), OUTLINE);
    blob(ctx, cx, 20, 5, 5, '#2a2030', { outline: 'rgba(0,0,0,0)' });
    glow(ctx, cx, 19, 6, accent, 0.5);
  } else {
    blob(ctx, cx, 17, 7, 8, '#c8a583', { outline: OUTLINE, highlight: 0.35 });
    blob(ctx, cx, 11, 8, 5, trim, { outline: OUTLINE });        // hair
  }
  blob(ctx, cx, 27, 9, 3, trim, { outline: 'rgba(0,0,0,0.35)' });  // collar
  speckle(ctx, rng, cx + 13, 62, 8, [shade(robe, 1.3), shade(robe, 0.7)], 0.7, 2, 0.35);
}

function paintVillage(scene: Phaser.Scene): void {
  // The elder: hooded, violet, lantern-eyed. Reads as the one who talks.
  paint(scene, 'prop:npc_elder:0', 44, 68, (ctx, rng) => {
    villager(ctx, rng, '#4a3d6e', '#b9a4e6', '#a0cae4', { hood: true });
    glow(ctx, 22, 44, 9, '#7c6add', 0.35);
  });
  // The smith: leather apron, an ember at the belt, a hammer.
  paint(scene, 'prop:npc_smith:0', 44, 68, (ctx, rng) => {
    villager(ctx, rng, '#6a4a32', '#3a2a1e', '#f0c060', { apron: true });
    ctx.fillStyle = '#4a4650';
    ctx.fillRect(34, 34, 3, 22);            // hammer haft
    ctx.fillStyle = '#8b8792';
    ctx.fillRect(31, 30, 9, 6);             // head
    glow(ctx, 22, 44, 7, '#f0c060', 0.3);
  });
  // The apothecary: green robe, a bottle that catches the light.
  paint(scene, 'prop:npc_apothecary:0', 44, 68, (ctx, rng) => {
    villager(ctx, rng, '#3f6a4c', '#d8cfa8', '#63c26d');
    blob(ctx, 34, 42, 4, 6, '#d62e6c', { outline: OUTLINE, highlight: 0.6 });
    ctx.fillStyle = '#d8cfa8';
    ctx.fillRect(33, 35, 2, 4);             // cork
  });
  // The hearth: a fire ring, not a person. Warm, and obviously the safe spot.
  paint(scene, 'prop:hearth:0', 64, 56, (ctx, rng) => {
    blob(ctx, 32, 46, 26, 9, 'rgba(10,8,14,0.3)', { outline: 'rgba(0,0,0,0)' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      blob(ctx, 32 + Math.cos(a) * 22, 44 + Math.sin(a) * 9, 6, 5, shade('#7d7880', 0.8 + rng() * 0.5),
           { outline: OUTLINE });
    }
    // Logs, then the fire on top of them.
    poly(ctx, [[20, 40], [44, 34], [46, 39], [22, 45]], '#5a3d2a', OUTLINE);
    poly(ctx, [[20, 34], [44, 40], [42, 45], [18, 39]], '#4a3122', OUTLINE);
    glow(ctx, 32, 30, 22, '#f0c060', 0.55);
    glow(ctx, 32, 26, 13, '#d62e6c', 0.4);
    blob(ctx, 32, 30, 7, 11, '#f5a03c', { outline: 'rgba(0,0,0,0)', highlight: 0.7 });
    blob(ctx, 32, 26, 4, 7, '#ffe09a', { outline: 'rgba(0,0,0,0)' });
  });

  // Buildings. Painted as simple shapes with a lit window, because a village
  // seen from above is mostly roofs and the light coming out of them.
  const roofs = ['#6a3f44', '#4f4a6a', '#5a4a32'];
  for (let v = 0; v < 3; v++) {
    const roof = roofs[v] ?? roofs[0]!;
    paint(scene, `prop:hut:${v}`, 96, 92, (ctx, rng) => {
      blob(ctx, 48, 84, 40, 9, 'rgba(10,8,14,0.32)', { outline: 'rgba(0,0,0,0)' });
      poly(ctx, [[14, 44], [82, 44], [82, 82], [14, 82]], '#6b5b48', OUTLINE);      // walls
      poly(ctx, [[6, 46], [90, 46], [48, 10]], roof, OUTLINE);                       // roof
      poly(ctx, [[6, 46], [48, 10], [48, 46]], shade(roof, 1.15), 'rgba(0,0,0,0)');  // lit slope
      ctx.fillStyle = '#2a2230';
      ctx.fillRect(40, 58, 16, 24);                                                  // door
      glow(ctx, 26, 58, 9, '#f0c060', 0.45);
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(22, 54, 9, 9);                                                    // window
      speckle(ctx, rng, 90, 82, 16, [shade(roof, 1.3), shade(roof, 0.7)], 0.7, 2, 0.3);
    });
  }
  paint(scene, 'prop:hut_big:0', 128, 116, (ctx, rng) => {
    blob(ctx, 64, 106, 54, 11, 'rgba(10,8,14,0.32)', { outline: 'rgba(0,0,0,0)' });
    poly(ctx, [[18, 54], [110, 54], [110, 104], [18, 104]], '#6b5b48', OUTLINE);
    poly(ctx, [[8, 56], [120, 56], [64, 12]], '#4f4a6a', OUTLINE);
    poly(ctx, [[8, 56], [64, 12], [64, 56]], shade('#4f4a6a', 1.15), 'rgba(0,0,0,0)');
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(54, 74, 20, 30);
    for (const wx of [28, 88]) {
      glow(ctx, wx + 5, 72, 11, '#f0c060', 0.42);
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(wx, 66, 11, 11);
    }
    speckle(ctx, rng, 120, 104, 20, ['#8d7d68', '#4a3f34'], 0.7, 2, 0.3);
  });
  paint(scene, 'prop:forge:0', 104, 96, (ctx) => {
    blob(ctx, 52, 88, 44, 10, 'rgba(10,8,14,0.32)', { outline: 'rgba(0,0,0,0)' });
    poly(ctx, [[16, 40], [88, 40], [88, 86], [16, 86]], '#544a52', OUTLINE);
    poly(ctx, [[10, 42], [94, 42], [52, 12]], '#3c3640', OUTLINE);
    // The mouth of the forge: the brightest thing in the village after the hearth.
    glow(ctx, 52, 66, 26, '#d62e6c', 0.5);
    glow(ctx, 52, 68, 15, '#f0c060', 0.8);
    poly(ctx, [[38, 84], [66, 84], [62, 56], [42, 56]], '#1a1420', OUTLINE);
    blob(ctx, 52, 74, 9, 8, '#f5a03c', { outline: 'rgba(0,0,0,0)', highlight: 0.7 });
    ctx.fillStyle = '#3c3640';
    ctx.fillRect(74, 8, 12, 36);          // chimney
    glow(ctx, 80, 8, 12, '#7d7880', 0.3); // smoke
  });
  paint(scene, 'prop:stall:0', 88, 72, (ctx, rng) => {
    blob(ctx, 44, 66, 36, 8, 'rgba(10,8,14,0.3)', { outline: 'rgba(0,0,0,0)' });
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(12, 26, 4, 40);
    ctx.fillRect(72, 26, 4, 40);
    poly(ctx, [[8, 28], [80, 28], [80, 40], [8, 40]], '#8b8792', OUTLINE);   // counter
    // Striped awning.
    for (let i = 0; i < 6; i++) {
      poly(ctx, [[8 + i * 12, 8], [20 + i * 12, 8], [20 + i * 12, 26], [8 + i * 12, 26]],
           i % 2 === 0 ? '#a83a56' : '#e0d4c4', 'rgba(0,0,0,0.25)');
    }
    speckle(ctx, rng, 80, 40, 10, ['#f0c060', '#63c26d', '#d62e6c'], 0.9, 3, 0.7);  // goods
  });
  paint(scene, 'prop:banner:0', 30, 84, (ctx) => {
    ctx.fillStyle = '#4a4650';
    ctx.fillRect(13, 10, 4, 74);
    poly(ctx, [[6, 14], [24, 14], [24, 48], [15, 56], [6, 48]], '#4a3d6e', OUTLINE);
    glow(ctx, 15, 30, 8, '#a0cae4', 0.4);
    blob(ctx, 15, 30, 5, 5, '#a0cae4', { outline: 'rgba(0,0,0,0)', highlight: 0.6 });
  });
}

// --- enemies ------------------------------------------------------------------

function eyes(ctx: Ctx, x: number, y: number, dx: number, colour: string, r = 2): void {
  glow(ctx, x - dx, y, r * 2.2, colour, 0.8);
  glow(ctx, x + dx, y, r * 2.2, colour, 0.8);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x - dx, y, r, 0, Math.PI * 2);
  ctx.arc(x + dx, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function paintEnemies(scene: Phaser.Scene): void {
  // Bone Knight: hunched skeleton with a rusted shield.
  paint(scene, 'enemy:skeleton', 48, 62, (ctx, rng) => {
    const bone = '#dcd4c4';
    poly(ctx, [[16, 58], [22, 58], [21, 40], [17, 40]], bone, OUTLINE);      // legs
    poly(ctx, [[27, 58], [33, 58], [32, 40], [28, 40]], bone, OUTLINE);
    poly(ctx, [[12, 42], [36, 42], [34, 22], [14, 22]], '#8a7e8c', OUTLINE);  // ragged tunic
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = bone;
      ctx.fillRect(15, 25 + i * 4, 18, 1.6);                                 // ribs
    }
    blob(ctx, 24, 15, 9, 8.5, bone, { outline: OUTLINE, highlight: 0.3 });   // skull
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(20, 20, 8, 2.5);
    eyes(ctx, 24, 14, 3.5, '#8cf0c0', 1.8);
    // shield
    blob(ctx, 8, 34, 7, 10, '#6b5a4a', { outline: OUTLINE, highlight: 0.3 });
    ctx.fillStyle = '#b08040';
    ctx.fillRect(7, 30, 2, 8);
    // sword
    ctx.fillStyle = '#c9c4bc';
    ctx.fillRect(40, 18, 3, 26);
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(37, 42, 9, 3);
    speckle(ctx, rng, 48, 62, 8, ['#a09484', '#f5efe4'], 0.5, 1.2, 0.5);
  });

  // Hollow Archer: thin, cloaked, bow on its back.
  paint(scene, 'enemy:archer', 46, 62, (ctx) => {
    poly(ctx, [[12, 58], [34, 58], [32, 26], [23, 18], [14, 26]], '#3f4a5c', OUTLINE); // cloak
    poly(ctx, [[15, 30], [31, 30], [30, 22], [23, 14], [16, 22]], '#2a3140');           // hood
    eyes(ctx, 23, 24, 3.2, '#ffd27a', 1.6);
    ctx.strokeStyle = '#c9a27a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(36, 36, 16, -Math.PI / 2 - 0.5, Math.PI / 2 + 0.5);                        // bow
    ctx.stroke();
    ctx.strokeStyle = '#e8e4dc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 20);
    ctx.lineTo(36, 52);
    ctx.stroke();
    ctx.fillStyle = '#dcd4c4';
    ctx.fillRect(20, 40, 8, 3);                                                       // bony hand
  });

  // Gloom Hound: low, fast quadruped with a glowing maw.
  paint(scene, 'enemy:hound', 62, 40, (ctx, rng) => {
    const fur = '#2f2a3a';
    blob(ctx, 30, 22, 20, 10, fur, { outline: OUTLINE, highlight: 0.25, shadow: 0.4 });   // body
    blob(ctx, 50, 18, 9, 7, fur, { outline: OUTLINE, highlight: 0.3 });                   // head
    poly(ctx, [[46, 12], [50, 4], [53, 13]], fur, OUTLINE);                              // ear
    for (const x of [16, 24, 36, 44]) poly(ctx, [[x, 30], [x + 5, 30], [x + 6, 38], [x + 1, 38]], shade(fur, 0.8), OUTLINE);
    poly(ctx, [[10, 20], [2, 10], [6, 22]], fur, OUTLINE);                               // tail
    ctx.fillStyle = '#d62e6c';
    poly(ctx, [[52, 21], [60, 20], [53, 25]], '#d62e6c');                                // maw
    eyes(ctx, 51, 16, 2.6, '#ff6a8a', 1.5);
    speckle(ctx, rng, 62, 40, 10, ['#463f55', '#1c1824'], 0.6, 1.4, 0.6);
  });

  // Mire Slime: a big translucent blob.
  paint(scene, 'enemy:slime', 56, 44, (ctx, rng) => {
    glow(ctx, 28, 30, 26, '#63c26d', 0.25);
    blob(ctx, 28, 28, 25, 15, '#4f9a5a', { outline: 'rgba(20,50,25,0.7)', highlight: 0.5, shadow: 0.35 });
    blob(ctx, 18, 22, 6, 4, 'rgba(255,255,255,0.35)', { outline: 'rgba(0,0,0,0)', highlight: 0 });
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(30,80,40,0.4)';
      ctx.beginPath();
      ctx.arc(10 + rng() * 36, 20 + rng() * 16, 1.5 + rng() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    eyes(ctx, 32, 24, 5, '#f0ffb0', 2.2);
  });

  // The Mirror: a dark reflection of the player, cracked glass sheen.
  paint(scene, 'enemy:mirror', 64, 92, (ctx, rng) => {
    glow(ctx, 32, 50, 32, '#d62e6c', 0.35);
    const body = '#1f1a2c';
    poly(ctx, [[18, 88], [46, 88], [44, 54], [40, 40], [32, 34], [24, 40], [20, 54]], body, 'rgba(214,46,108,0.9)');
    blob(ctx, 32, 24, 13, 14, '#2a2238', { outline: 'rgba(214,46,108,0.9)', highlight: 0.35 });
    // horns / ears like the goat
    poly(ctx, [[22, 16], [14, 2], [26, 12]], '#2a2238', 'rgba(214,46,108,0.9)');
    poly(ctx, [[42, 16], [50, 2], [38, 12]], '#2a2238', 'rgba(214,46,108,0.9)');
    eyes(ctx, 32, 24, 5, '#ff4d8a', 2.4);
    // cracks
    ctx.strokeStyle = 'rgba(245,164,192,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(20 + rng() * 24, 40 + rng() * 40);
      ctx.lineTo(20 + rng() * 24, 40 + rng() * 40);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(24, 44, 4, 40);
  });

  paint(scene, 'enemy:elite_ring', 96, 40, (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(240,192,96,0.85)';
    ctx.beginPath();
    ctx.ellipse(48, 20, 42, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(240,192,96,0.2)';
    ctx.stroke();
  });
}

// --- critters -----------------------------------------------------------------

export function paintCritters(scene: Phaser.Scene): void {
  for (let f = 0; f < 2; f++) {
    paint(scene, `critter:bird:${f}`, 24, 16, (ctx) => {
      blob(ctx, 12, 10, 6, 4, '#3a3548', { outline: OUTLINE, highlight: 0.3 });
      blob(ctx, 17, 7, 3.2, 3, '#3a3548', { outline: OUTLINE });
      ctx.fillStyle = '#f0c060';
      poly(ctx, [[20, 7], [24, 8], [20, 9]], '#f0c060');
      const lift = f === 0 ? -6 : 4;
      poly(ctx, [[8, 9], [2, 9 + lift], [14, 8]], '#4a4560', OUTLINE);
      poly(ctx, [[12, 9], [18, 9 + lift], [16, 8]], '#4a4560', OUTLINE);
    });
  }
  for (let f = 0; f < 2; f++) {
    paint(scene, `critter:squirrel:${f}`, 22, 18, (ctx) => {
      blob(ctx, 10, 12, 6, 4.5, '#8a5a3a', { outline: OUTLINE, highlight: 0.3 });
      blob(ctx, 16, 9, 3.4, 3, '#8a5a3a', { outline: OUTLINE });
      poly(ctx, [[14, 6], [15, 2], [17, 6]], '#8a5a3a', OUTLINE);
      blob(ctx, 3, 8 + (f ? 2 : 0), 3.5, 6, '#a06a44', { outline: OUTLINE, highlight: 0.3 });
      ctx.fillStyle = '#1a1420';
      ctx.beginPath();
      ctx.arc(17, 9, 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  for (let f = 0; f < 2; f++) {
    paint(scene, `critter:rabbit:${f}`, 20, 20, (ctx) => {
      blob(ctx, 9, 14, 6, 4.5, '#cfc4b4', { outline: OUTLINE, highlight: 0.35 });
      blob(ctx, 15, 11, 3.4, 3, '#cfc4b4', { outline: OUTLINE });
      poly(ctx, [[13, 9], [12, 1 + (f ? 2 : 0)], [15, 8]], '#cfc4b4', OUTLINE);
      poly(ctx, [[16, 9], [17, 1 + (f ? 1 : 0)], [18, 8]], '#cfc4b4', OUTLINE);
      ctx.fillStyle = '#1a1420';
      ctx.beginPath();
      ctx.arc(16, 11, 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  paint(scene, 'critter:frog:0', 16, 12, (ctx) => {
    blob(ctx, 8, 7, 6, 4, '#5d9a4a', { outline: OUTLINE, highlight: 0.4 });
    eyes(ctx, 8, 3.5, 3, '#f0ffb0', 1.2);
  });
}
