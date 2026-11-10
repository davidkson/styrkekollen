import { useEffect, useRef, useState } from "react";

// ─── Sprite ──────────────────────────────────────────────────────────────────
// A 24×28 pixel grid drawn with SVG rects, scaled 2× with crisp edges. Every
// frame is composed from body parts (head, torso, arms, legs, props) and gets
// a 1px outline added automatically around its silhouette. The sprite faces
// right; facing left is a CSS mirror. Climbing frames have the wall on the
// right, hanging frames grip an edge with the hands in the top rows.

const W = 24;
const H = 28;
const SCALE = 3;
const SPRITE_W = W * SCALE;
const SPRITE_H = H * SCALE;

// Fixed palette, independent of the app theme
const PALETTE = {
  o: "#1d1726", // outline
  e: "#1d1726", // eyes
  s: "#f5c08f", // skin
  S: "#d9925f", // skin, shaded (far side)
  h: "#4a2a1b", // hair
  y: "#ffd23f", // headband
  m: "#9b2f35", // mouth
  M: "#5c1620", // open mouth
  p: "#ff8f8f", // blush
  r: "#e8483b", // shirt
  R: "#b5302a", // shirt, shaded
  w: "#ffffff",
  b: "#2d5fc4", // shorts
  B: "#1f418a", // shorts, shaded
  k: "#f2f2f2", // shoe
  K: "#8a8f99", // sole
  g: "#c3cad2", // bar
  G: "#3a3f48", // plates
  c: "#5fd0ff", // water bottle
  C: "#2c9ad1", // bottle, shaded
};

const CONFETTI = ["#ffd23f", "#e8483b", "#5fd0ff", "#7ee06b", "#ff8fd8", "#ffffff"];

function rect(g, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    if (j < 0 || j >= H) continue;
    for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < W) g[j][i] = c;
    }
  }
}

function head(g, x, y, { eyes = "open", mouth = "n", tail = 0, blush = false, sweat = false } = {}) {
  rect(g, x + 1, y, 6, 1, "h");
  rect(g, x, y + 1, 8, 1, "h");
  rect(g, x, y + 2, 8, 1, "y");
  rect(g, x, y + 3, 8, 4, "s");
  rect(g, x + 1, y + 7, 6, 1, "s");
  rect(g, x, y + 3, 1, 2, "h");
  rect(g, x + 2, y + 4, 1, 2, "S"); // ear

  if (eyes === "open") {
    rect(g, x + 4, y + 4, 1, 2, "e");
    rect(g, x + 6, y + 4, 1, 2, "e");
  } else if (eyes === "blink") {
    rect(g, x + 4, y + 5, 1, 1, "e");
    rect(g, x + 6, y + 5, 1, 1, "e");
  } else if (eyes === "happy") {
    rect(g, x + 4, y + 4, 1, 1, "e");
    rect(g, x + 6, y + 4, 1, 1, "e");
    blush = true;
  }
  if (blush) rect(g, x + 7, y + 5, 1, 1, "p");

  if (mouth === "n") rect(g, x + 5, y + 6, 1, 1, "m");
  else if (mouth === "smile") rect(g, x + 4, y + 6, 3, 1, "m");
  else if (mouth === "open") rect(g, x + 5, y + 6, 2, 2, "M");

  // Headband tail flapping behind the head
  rect(g, x - 1, y + 2, 1, 1, "y");
  if (tail === 0) rect(g, x - 2, y + 3, 1, 2, "y");
  else if (tail === 1) rect(g, x - 3, y + 2, 2, 1, "y");
  else rect(g, x - 2, y + 1, 1, 1, "y");

  if (sweat) {
    rect(g, x + 8, y + 1, 1, 1, "w");
    rect(g, x + 8, y + 2, 1, 1, "c");
  }
}

function torso(g, t, rows = 6) {
  rect(g, 11, t - 1, 2, 1, "s"); // neck
  rect(g, 9, t, 6, rows, "r");
  rect(g, 9, t, 1, rows, "R");
  rect(g, 12, t + 2, 2, 1, "w"); // chest logo
}

function shorts(g, y, x = 9, w = 6, h = 2) {
  rect(g, x, y, w, h, "b");
  rect(g, x, y, 1, h, "B");
}

function shoe(g, x) {
  rect(g, x, 25, 3, 1, "k");
  rect(g, x, 26, 3, 1, "K");
}

function legs(g, kind, bob) {
  const top = 22 - bob;
  const len = 25 - top;
  if (kind === "stand") {
    rect(g, 9, top, 2, len, "S");
    rect(g, 13, top, 2, len, "s");
    shoe(g, 9);
    shoe(g, 13);
  } else {
    // Stride: "walkA" has the near leg forward, "walkB" the far leg
    const fwd = kind === "walkA" ? "s" : "S";
    const back = kind === "walkA" ? "S" : "s";
    rect(g, 9, top, 2, 1, back);
    rect(g, 8, top + 1, 2, len - 1, back);
    shoe(g, 7);
    rect(g, 13, top, 2, 1, fwd);
    rect(g, 14, top + 1, 2, len - 1, fwd);
    shoe(g, 14);
  }
}

// Far arm, drawn before the torso so the body covers it
function armBack(g, kind, t) {
  switch (kind) {
    case "swingBack": rect(g, 7, t, 2, 2, "R"); rect(g, 6, t + 2, 2, 3, "S"); break;
    case "hidden": rect(g, 8, t, 1, 2, "R"); break;
    case "up": rect(g, 7, t - 1, 2, 2, "R"); rect(g, 6, t - 3, 2, 2, "S"); rect(g, 5, t - 6, 2, 3, "S"); rect(g, 4, t - 10, 2, 4, "S"); break;
    case "straightUp": rect(g, 7, t - 1, 2, 2, "R"); rect(g, 6, t - 3, 2, 2, "S"); rect(g, 5, t - 9, 2, 7, "S"); break;
    case "point": rect(g, 7, t, 2, 2, "R"); rect(g, 5, t + 2, 3, 2, "S"); rect(g, 3, t + 4, 3, 2, "S"); break;
    case "hang": rect(g, 7, t - 1, 2, 2, "R"); rect(g, 6, t - 3, 2, 2, "S"); rect(g, 5, 1, 2, t - 3, "S"); break;
    default: rect(g, 7, t, 2, 2, "R"); rect(g, 7, t + 2, 2, 4, "S");
  }
}

// Near arm, drawn after the torso and head
function armFront(g, kind, t) {
  switch (kind) {
    case "swingFwd": rect(g, 15, t, 2, 2, "r"); rect(g, 16, t + 2, 2, 3, "s"); break;
    case "swingBack": rect(g, 15, t, 2, 2, "r"); rect(g, 14, t + 2, 2, 3, "s"); break;
    case "up": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, t - 6, 2, 3, "s"); rect(g, 18, t - 10, 2, 4, "s"); break;
    case "straightUp": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, t - 9, 2, 7, "s"); break;
    case "waveA": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, t - 10, 2, 8, "s"); break;
    case "waveB": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, t - 6, 2, 3, "s"); rect(g, 18, t - 9, 2, 3, "s"); rect(g, 19, t - 11, 2, 3, "s"); break;
    case "forward": rect(g, 15, t, 2, 2, "r"); rect(g, 17, t, 4, 2, "s"); break;
    case "chest": rect(g, 15, t, 2, 1, "r"); rect(g, 15, t + 1, 2, 2, "s"); rect(g, 17, t - 1, 2, 3, "s"); break;
    case "point": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 17, t - 2, 3, 2, "s"); rect(g, 19, t - 4, 3, 2, "s"); break;
    case "hang": rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, 1, 2, t - 3, "s"); break;
    case "hangReach":
      rect(g, 15, t - 1, 2, 2, "r"); rect(g, 16, t - 3, 2, 2, "s"); rect(g, 17, 5, 2, t - 7, "s");
      rect(g, 18, 3, 2, 3, "s"); rect(g, 19, 1, 2, 3, "s");
      break;
    case "drink1": drinkArm(g, t, 0); break;
    case "drink2": drinkArm(g, t, 1); break;
    case "bottle": rect(g, 15, t, 2, 2, "r"); rect(g, 15, t + 2, 2, 3, "s"); bottle(g, 15, t + 5); break;
    default: rect(g, 15, t, 2, 2, "r"); rect(g, 15, t + 2, 2, 4, "s");
  }
}

function barbell(g, y) {
  rect(g, 3, y, 19, 1, "g");
  rect(g, 1, y - 2, 2, 5, "G");
  rect(g, 21, y - 2, 2, 5, "G");
}

function bottle(g, x, y) {
  rect(g, x, y, 2, 1, "w");
  rect(g, x, y + 1, 2, 3, "c");
  rect(g, x + 1, y + 1, 1, 3, "C");
}

// Bottle tipped up to the mouth; offsets are relative to the torso top
function drinkArm(g, t, lift) {
  rect(g, 15, t, 2, 2, "r");
  rect(g, 16, t - 2, 2, 2, "s");
  rect(g, 15, t - 4, 1, 1, "w"); // cap at the mouth
  rect(g, 16, t - 5 - lift, 2, 2, "c");
  rect(g, 18, t - 7 - lift * 2, 2, 3, "c");
  rect(g, 19, t - 7 - lift * 2, 1, 3, "C");
  rect(g, 17, t - 4, 2, 2, "s"); // hand on the bottle
}

function standing({ bob = 0, legKind = "stand", armB = "down", armF = "down", face, prop }) {
  return (g) => {
    const t = 14 - bob;
    armBack(g, armB, t);
    legs(g, legKind, bob);
    shorts(g, 20 - bob);
    torso(g, t);
    head(g, 8, 5 - bob, face);
    armFront(g, armF, t);
    if (prop === "barChest") barbell(g, t - 1);
    if (prop === "barOver") barbell(g, t - 10);
  };
}

function squatting({ face } = {}) {
  return (g) => {
    const t = 17;
    rect(g, 8, t, 1, 2, "R");
    shorts(g, 22, 8, 6, 2);
    rect(g, 14, 22, 3, 2, "s"); // thigh, knee forward
    rect(g, 15, 24, 2, 1, "s"); // shin
    shoe(g, 14);
    torso(g, t, 5);
    head(g, 8, 8, face);
    armFront(g, "forward", t);
  };
}

function sitting({ arm = "bottle", face } = {}) {
  return (g) => {
    const t = 18;
    rect(g, 8, t, 2, 2, "R");
    rect(g, 7, t + 2, 2, 5, "S"); // leaning back on the far hand
    shorts(g, 24, 9, 7, 3);
    rect(g, 16, 25, 4, 2, "s"); // legs stretched out
    rect(g, 20, 23, 2, 4, "k"); // shoes, toes up
    rect(g, 21, 26, 1, 1, "K");
    torso(g, t);
    head(g, 8, 9, face);
    if (arm === "bottle") {
      bottle(g, 18, 18);
      rect(g, 15, t, 2, 2, "r");
      rect(g, 15, t + 2, 2, 2, "s");
      rect(g, 17, t + 2, 2, 2, "s");
    } else if (arm === "drink1" || arm === "drink2") {
      drinkArm(g, t, arm === "drink2" ? 1 : 0);
    } else {
      bottle(g, 3, 23); // put down behind him
      armFront(g, arm, t);
    }
  };
}

// Side view against a wall on the right, hand over hand
function climbing(phase) {
  return (g) => {
    const t = 14;
    if (phase === 0) {
      rect(g, 13, t - 1, 2, 2, "R");
      rect(g, 15, t - 4, 2, 4, "S"); // far hand low on the wall
      rect(g, 9, 22, 2, 3, "S"); // far leg hanging
      shoe(g, 9);
    } else {
      rect(g, 13, t - 1, 2, 2, "R");
      rect(g, 16, t - 12, 2, 9, "S"); // far hand reaching high
      rect(g, 11, 21, 4, 2, "S"); // far knee up
      rect(g, 15, 22, 2, 2, "S");
      rect(g, 15, 24, 3, 1, "k");
      rect(g, 15, 25, 3, 1, "K");
    }
    shorts(g, 20);
    torso(g, t);
    head(g, 8, 5, { eyes: phase === 0 ? "open" : "blink", tail: phase });
    if (phase === 0) {
      rect(g, 15, t - 1, 2, 2, "r");
      rect(g, 16, t - 3, 2, 2, "s");
      rect(g, 17, 2, 2, t - 4, "s"); // near hand reaching high
      rect(g, 13, 21, 3, 2, "s"); // near knee up
      rect(g, 16, 22, 2, 2, "s");
      rect(g, 16, 24, 3, 1, "k");
      rect(g, 16, 25, 3, 1, "K");
    } else {
      rect(g, 15, t, 2, 2, "r");
      rect(g, 17, t - 2, 2, 4, "s"); // near hand low
      rect(g, 13, 22, 2, 3, "s"); // near leg hanging
      shoe(g, 13);
    }
  };
}

function plank(down) {
  return (g) => {
    rect(g, 1, 25, 3, 1, "k");
    rect(g, 1, 26, 3, 1, "K");
    if (!down) {
      rect(g, 3, 24, 3, 2, "s");
      rect(g, 6, 23, 2, 2, "s");
      shorts(g, 21, 8, 3, 3);
      rect(g, 11, 20, 5, 3, "r");
      rect(g, 11, 22, 5, 1, "R");
      head(g, 15, 13, { eyes: "open", mouth: "n" });
      rect(g, 15, 21, 2, 6, "s");
    } else {
      rect(g, 3, 24, 5, 2, "s");
      shorts(g, 23, 8, 3, 2);
      rect(g, 11, 23, 5, 2, "r");
      rect(g, 11, 24, 5, 1, "R");
      head(g, 15, 17, { eyes: "blink", mouth: "n", sweat: true });
      rect(g, 13, 21, 3, 2, "s"); // bent elbow
      rect(g, 15, 25, 2, 2, "s");
    }
  };
}

const HAPPY = { eyes: "happy", mouth: "open" };

const FRAME_DEFS = {
  stand: standing({}),
  blink: standing({ face: { eyes: "blink" } }),
  smile: standing({ face: { mouth: "smile" } }),
  walk1: standing({ legKind: "walkA", armB: "swingBack", armF: "swingFwd", face: { tail: 1 } }),
  walk2: standing({ bob: 1, face: { tail: 2 } }),
  walk3: standing({ legKind: "walkB", armB: "hidden", armF: "swingBack", face: { tail: 1 } }),
  walk4: standing({ bob: 1, face: { tail: 2, eyes: "open" } }),
  yawn: standing({ armB: "up", armF: "up", face: { eyes: "blink", mouth: "open" } }),
  reach: standing({ bob: 1, armB: "straightUp", armF: "straightUp", face: { eyes: "happy", mouth: "open", tail: 2 } }),
  squatUp: standing({ armB: "hidden", armF: "forward", face: { mouth: "smile" } }),
  squatDown: squatting({ face: { eyes: "blink", sweat: true } }),
  crouch: squatting({ face: { eyes: "open", mouth: "smile" } }),
  pushUp: plank(false),
  pushDown: plank(true),
  fist: standing({ armF: "straightUp", face: { eyes: "happy", mouth: "smile", tail: 2 } }),
  cheer: standing({ armB: "up", armF: "up", face: { ...HAPPY, tail: 2 } }),
  point: standing({ armB: "point", armF: "point", face: { ...HAPPY, tail: 1 } }),
  waveA: standing({ armF: "waveA", face: { eyes: "open", mouth: "smile" } }),
  waveB: standing({ armF: "waveB", face: { eyes: "happy", mouth: "smile" } }),
  barChest: standing({ armB: "hidden", armF: "chest", prop: "barChest", face: { eyes: "blink", sweat: true } }),
  barOver: standing({ armB: "straightUp", armF: "straightUp", prop: "barOver", face: { ...HAPPY, tail: 2 } }),
  sit: sitting({}),
  sitBlink: sitting({ face: { eyes: "blink" } }),
  drink1: sitting({ arm: "drink1", face: { eyes: "happy", mouth: "none" } }),
  drink2: sitting({ arm: "drink2", face: { eyes: "happy", mouth: "none" } }),
  sitWaveA: sitting({ arm: "waveA", face: { eyes: "open", mouth: "smile" } }),
  sitWaveB: sitting({ arm: "waveB", face: { eyes: "happy", mouth: "smile" } }),
  climb1: climbing(0),
  climb2: climbing(1),
  fall: standing({ legKind: "walkA", armB: "up", armF: "up", face: { eyes: "open", mouth: "open", tail: 2 } }),
  hang: standing({ armB: "hang", armF: "hang" }),
  hangBlink: standing({ armB: "hang", armF: "hang", face: { eyes: "blink" } }),
  hangSwingA: standing({ legKind: "walkA", armB: "hang", armF: "hang", face: { mouth: "smile", tail: 1 } }),
  hangSwingB: standing({ legKind: "walkB", armB: "hang", armF: "hang", face: { mouth: "smile", tail: 0 } }),
  hangReach: standing({ legKind: "walkA", armB: "hang", armF: "hangReach", face: { tail: 1 } }),
  hangCheerA: standing({ legKind: "walkA", armB: "hang", armF: "up", face: { ...HAPPY, tail: 1 } }),
  hangCheerB: standing({ legKind: "walkB", armB: "hang", armF: "up", face: { ...HAPPY, tail: 2 } }),
  hangWaveA: standing({ armB: "hang", armF: "waveA", face: { mouth: "smile" } }),
  hangWaveB: standing({ armB: "hang", armF: "waveB", face: { eyes: "happy", mouth: "smile" } }),
  hangHold: standing({ armB: "hang", armF: "bottle" }),
  hangHoldBlink: standing({ armB: "hang", armF: "bottle", face: { eyes: "blink" } }),
  hangDrink1: standing({ armB: "hang", armF: "drink1", face: { eyes: "happy", mouth: "none" } }),
  hangDrink2: standing({ legKind: "walkA", armB: "hang", armF: "drink2", face: { eyes: "happy", mouth: "none" } }),
};

const frameCache = new Map();

// Grid → outlined grid → horizontal runs of one colour as [x, y, width, colour]
function frameRects(name) {
  if (frameCache.has(name)) return frameCache.get(name);
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  (FRAME_DEFS[name] ?? FRAME_DEFS.stand)(g);
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== null;
  const out = g.map((row, y) => row.map((c, x) => {
    if (c !== null) return c;
    return filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ? "o" : null;
  }));
  const rects = [];
  out.forEach((row, y) => {
    let x = 0;
    while (x < W) {
      const c = row[x];
      let end = x + 1;
      while (end < W && row[end] === c) end++;
      if (c) rects.push([x, y, end - x, c]);
      x = end;
    }
  });
  frameCache.set(name, rects);
  return rects;
}

// ─── Scripts ─────────────────────────────────────────────────────────────────
// A script is a list of steps: [frame, ms, jumpHeight?, flipFacing?] or a
// function to call (e.g. fire confetti). Jump height is in sprite pixels.

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const hop = (frame, h = 5, ms = 110) => [[frame, ms, Math.round(h * 0.6)], [frame, ms, h], [frame, ms, Math.round(h * 0.6)]];

function repeat(n, steps) {
  return Array.from({ length: n }, () => steps).flat();
}

function pauseScript() {
  const steps = [["stand", rand(900, 2600)]];
  if (Math.random() < 0.7) steps.push(["blink", 130], ["stand", rand(500, 1800)]);
  if (Math.random() < 0.25) steps.push(["blink", 110], ["stand", 140], ["blink", 110]);
  steps.push(["stand", rand(300, 900)]);
  return steps;
}

const IDLE_SCRIPTS = {
  look: () => [["stand", rand(400, 900)], ["stand", rand(700, 1400), 0, true], ["blink", 120], ["stand", rand(500, 1000), 0, true]],
  stretch: () => [["yawn", 650], ["reach", 900], ["yawn", 300], ["smile", 500], ["stand", 300]],
  squats: () => [["squatUp", 300], ...repeat(randInt(2, 4), [["squatDown", 420], ["squatUp", 420]]), ["smile", 500]],
  pushups: () => [
    ["crouch", 250], ["pushUp", 350],
    ...repeat(randInt(2, 4), [["pushDown", 380], ["pushUp", 380]]),
    ["crouch", 250], ["smile", 500],
  ],
};

// Hanging from the bottom edge of the top bar
const TOP_SCRIPTS = {
  swing: () => [...repeat(randInt(2, 4), [["hangSwingA", 260], ["hang", 200], ["hangSwingB", 260], ["hang", 200]]), ["hang", rand(300, 900)]],
  pause: () => [["hang", rand(800, 2200)], ["hangBlink", 130], ["hang", rand(600, 1600)]],
  look: () => [["hang", 500], ["hangBlink", 120], ["hang", rand(700, 1400), 0, true], ["hang", rand(500, 1000), 0, true]],
};

const REACTIONS = {
  set: () => pick([
    [["crouch", 90], ...hop("fist", 4), ["fist", 350], ["stand", 150]],
    [["crouch", 160], ["barChest", 300], ["barOver", 160], ["barOver", 500], ["barChest", 220], ["smile", 300]],
  ]),
  pr: (burst) => [
    burst,
    ["crouch", 100], ...hop("cheer", 5),
    ["point", 230], ["point", 230, 0, true], ["point", 230, 0, true], ["point", 230, 0, true],
    ...hop("cheer", 5), ["cheer", 120],
    burst,
    ["point", 230, 0, true], ["point", 230, 0, true],
    ["smile", 400],
  ],
  session: (burst) => [
    burst,
    ["crouch", 180], ["barChest", 280], ["barOver", 220],
    ...hop("barOver", 5, 120), ["barOver", 160], ...hop("barOver", 5, 120),
    burst,
    ["barChest", 200], ["crouch", 120],
    ...hop("cheer", 6), ["cheer", 140], ...hop("cheer", 6),
    ["point", 230, 0, true], ["point", 230, 0, true], ["point", 230, 0, true], ["point", 230, 0, true],
    burst,
    ...hop("cheer", 4), ["smile", 600],
  ],
  tap: () => pick([
    [...repeat(3, [["waveA", 170], ["waveB", 170]]), ["smile", 300]],
    [["crouch", 90], ...hop("cheer", 6, 100), ["smile", 350]],
  ]),
};

const kick = (n, ms = 150) => repeat(n, [["hangCheerA", ms], ["hangCheerB", ms]]);

const TOP_REACTIONS = {
  set: () => [...kick(3), ["hang", 200]],
  pr: (burst) => [
    burst, ...kick(4),
    ...repeat(2, [["hangWaveA", 170], ["hangWaveB", 170]]),
    burst, ...kick(3, 130), ["hangSwingA", 260], ["hang", 300],
  ],
  session: (burst) => [
    burst, ...kick(4),
    ...repeat(2, [["hangWaveA", 170], ["hangWaveB", 170]]),
    burst, ...kick(5, 130),
    burst, ...repeat(2, [["hangSwingA", 260], ["hangSwingB", 260]]), ["hang", 400],
  ],
  tap: () => pick([
    [...repeat(3, [["hangWaveA", 170], ["hangWaveB", 170]]), ["hang", 200]],
    [...kick(3, 130), ["hang", 200]],
  ]),
};

// Reduced motion: a pose change and nothing else
const REDUCED_REACTIONS = {
  set: () => [["fist", 900], ["stand", 100]],
  pr: () => [["cheer", 1400], ["stand", 100]],
  session: () => [["cheer", 2000], ["stand", 100]],
  tap: () => [["waveA", 900], ["stand", 100]],
};

const WALK_FRAMES = ["walk1", "walk2", "walk3", "walk4"];
const CLIMB_FRAMES = ["climb1", "climb2"];
const SHIMMY_FRAMES = ["hangReach", "hang"];
const WALK_SPEED = 34; // px per second
const CLIMB_SPEED = 60;
const SHIMMY_SPEED = 26;
const GRAVITY = 2600; // px/s²
const GRIP_PX = 5; // how far the hands reach above the top bar's bottom edge
const CLIMB_OUT = 18; // how far past the walking range the climbing wall is
const MIN_CLIMB = 120; // don't bother travelling up a shorter distance
const PRIORITY = { tap: 0, set: 1, pr: 2, session: 3 };
const CHROME_SELECTOR = ".session-chrome";

function makePieces() {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (-Math.PI / 2) + rand(-1.15, 1.15);
    const dist = rand(40, 95);
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      color: pick(CONFETTI),
      size: Math.random() < 0.3 ? 9 : 6,
      dur: Math.round(rand(850, 1300)),
      delay: Math.round(rand(0, 120)),
    };
  });
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PixelBuddy({ event, resting = false, restDone = false, behind = false }) {
  const [frame, setFrame] = useState("stand");
  const [bursts, setBursts] = useState([]);
  const trackRef = useRef(null);
  const posRef = useRef(null);
  const spriteRef = useRef(null);
  const shadowRef = useRef(null);
  const ctrlRef = useRef(null);
  const lastEventId = useRef(event?.id);
  // Latest props for the controller, which lives outside React's render cycle
  const ctx = useRef({ resting, restDone });

  useEffect(() => {
    ctx.current.resting = resting;
    ctx.current.restDone = restDone;
  });

  useEffect(() => {
    let timer = null;
    let raf = 0;
    // x: px from the track's left edge; y: px from the ground (track bottom) up
    let x = null;
    let y = 0;
    let facing = 1;
    let jump = 0;
    // idle | react | rest | travel (climbing/jumping/falling, not interruptible) | sleep
    let mode = "idle";
    let place = "ground"; // ground | top
    let priority = -1;
    let pending = null; // reaction waiting for a climb/jump/fall to finish
    let leaveAt = 0; // when to come down from the top bar
    let reduced = prefersReducedMotion();
    const burstTimers = new Set();

    const maxX = () => Math.max(0, (trackRef.current?.clientWidth ?? SPRITE_W) - SPRITE_W);
    const clampX = (v) => Math.max(0, Math.min(maxX(), v));

    // Height (y) at which the hands grip the bottom edge of the top bar. The
    // bar changes height (rest strip, safe area), so this is always measured.
    function topY() {
      const chrome = document.querySelector(CHROME_SELECTOR);
      const track = trackRef.current;
      if (!chrome || !track) return null;
      const ground = track.getBoundingClientRect().bottom;
      const edge = chrome.getBoundingClientRect().bottom;
      return Math.round(ground - edge + GRIP_PX - SPRITE_H);
    }

    function apply() {
      const max = maxX();
      if (x === null) x = Math.round(max * rand(0.15, 0.85));
      x = Math.max(-CLIMB_OUT, Math.min(max + CLIMB_OUT, x));
      if (place === "top" && mode !== "travel") {
        const ty = topY();
        if (ty !== null) y = ty;
      }
      if (posRef.current) posRef.current.style.transform = `translate3d(${Math.round(x)}px, ${-Math.round(y)}px, 0)`;
      if (spriteRef.current) {
        spriteRef.current.style.transform = `translate3d(0, ${-jump * SCALE}px, 0)${facing < 0 ? " scaleX(-1)" : ""}`;
      }
      if (shadowRef.current) {
        const s = Math.max(0, 1 - (y + jump * SCALE) / 140);
        shadowRef.current.style.transform = `translate3d(${Math.round(x)}px, 0, 0) scale(${s.toFixed(2)})`;
        shadowRef.current.style.opacity = s.toFixed(2);
      }
    }

    function stop() {
      clearTimeout(timer);
      timer = null;
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function play(steps, done) {
      let i = 0;
      const step = () => {
        while (i < steps.length && typeof steps[i] === "function") steps[i++]();
        if (i >= steps.length) {
          jump = 0;
          apply();
          done?.();
          return;
        }
        const [name, ms, h = 0, flip = false] = steps[i++];
        if (flip) facing = -facing;
        jump = reduced ? 0 : h;
        setFrame(name);
        apply();
        timer = setTimeout(step, ms);
      };
      step();
    }

    // Straight-line move towards a (possibly moving) target, cycling frames
    function move(target, speed, frames, frameMs, done) {
      let fi = 0;
      const nextFrame = () => {
        setFrame(frames[fi++ % frames.length]);
        timer = setTimeout(nextFrame, frameMs);
      };
      nextFrame();
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(64, now - last) / 1000;
        last = now;
        const t = target();
        const dx = t.x - x;
        const dy = t.y - y;
        const dist = Math.hypot(dx, dy);
        const stepLen = speed * dt;
        if (dist <= stepLen) {
          x = t.x;
          y = t.y;
          stop();
          apply();
          done();
          return;
        }
        x += (dx / dist) * stepLen;
        y += (dy / dist) * stepLen;
        apply();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // Ballistic flight: up until the apex (grabbing the top bar), or down to the ground
    function fly(v0, frameName, toTop, done) {
      const y0 = y;
      const t0 = performance.now();
      setFrame(frameName);
      const tick = (now) => {
        const t = (now - t0) / 1000;
        const vy = v0 - GRAVITY * t;
        const ny = y0 + v0 * t - (GRAVITY * t * t) / 2;
        if (toTop && vy <= 0) {
          y = topY() ?? ny;
          raf = 0;
          apply();
          done();
          return;
        }
        if (!toTop && vy < 0 && ny <= 0) {
          y = 0;
          raf = 0;
          apply();
          done();
          return;
        }
        y = ny;
        apply();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function burst() {
      if (reduced) return;
      const id = Math.random().toString(36).slice(2);
      const bx = Math.round((x ?? 0) + SPRITE_W / 2);
      const by = Math.round(y + SPRITE_H * 0.55);
      setBursts((prev) => [...prev, { id, x: bx, y: by, pieces: makePieces() }]);
      const t = setTimeout(() => {
        burstTimers.delete(t);
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 1600);
      burstTimers.add(t);
    }

    function walkTo(target, done) {
      facing = target > x ? 1 : -1;
      move(() => ({ x: target, y: 0 }), WALK_SPEED, WALK_FRAMES, 150, done);
    }

    function walk() {
      const max = maxX();
      let target = Math.round(rand(0, max));
      if (Math.abs(target - x) < 40) target = x < max / 2 ? Math.round(rand(x + 40, max)) : Math.round(rand(0, x - 40));
      target = clampX(target);
      if (Math.abs(target - x) < 8) return play(pauseScript(), idle);
      walkTo(target, () => play([["stand", 200]], idle));
    }

    function canTravel() {
      if (reduced) return false;
      const ty = topY();
      return ty !== null && ty >= MIN_CLIMB;
    }

    function idle() {
      mode = "idle";
      priority = -1;
      if (ctx.current.resting) return sitDown();
      if (reduced) return play(pauseScript(), idle);
      const roll = Math.random();
      if (roll < 0.08 && canTravel()) goUp();
      else if (roll < 0.46) walk();
      else if (roll < 0.68) play(pauseScript(), idle);
      else if (roll < 0.77) play(IDLE_SCRIPTS.look(), idle);
      else if (roll < 0.85) play(IDLE_SCRIPTS.stretch(), idle);
      else if (roll < 0.93) play(IDLE_SCRIPTS.squats(), idle);
      else play(IDLE_SCRIPTS.pushups(), idle);
    }

    // ── Travelling to and from the top bar ──

    function goUp() {
      const ty = topY();
      if (ty < 330 && Math.random() < 0.5) {
        // Close enough for one big jump
        play([["crouch", 280]], () => {
          mode = "travel";
          place = "top";
          fly(Math.sqrt(2 * GRAVITY * Math.max(0, ty - y)), "reach", true, () => arriveTop(false));
        });
        return;
      }
      const left = x < maxX() / 2;
      const edgeX = left ? 0 : maxX();
      const wallX = left ? -CLIMB_OUT : maxX() + CLIMB_OUT;
      walkTo(edgeX, () => {
        mode = "travel";
        place = "top";
        facing = left ? -1 : 1;
        // Step onto the wall, then climb hand over hand
        move(() => ({ x: wallX, y: 6 }), 40, ["climb1"], 400, () => {
          move(() => ({ x: wallX, y: topY() ?? y }), CLIMB_SPEED, CLIMB_FRAMES, 220, () => arriveTop(true));
        });
      });
    }

    function arriveTop(fromWall) {
      leaveAt = performance.now() + rand(10000, 30000);
      play([["hang", 350], ["hangBlink", 120], ["hang", 250]], () => {
        mode = "idle";
        if (!fromWall) return settle();
        // Shimmy away from the wall along the edge; just clear of it if
        // something is waiting (a rest or a reaction)
        const max = maxX();
        const hurry = pending || ctx.current.resting;
        const tx = x < 0
          ? (hurry ? 12 : rand(max * 0.2, max * 0.6))
          : (hurry ? max - 12 : rand(max * 0.4, max * 0.8));
        shimmyTo(Math.round(clampX(tx)), settle);
      });
    }

    function shimmyTo(tx, done) {
      facing = tx > x ? 1 : -1;
      move(() => ({ x: tx, y: topY() ?? y }), SHIMMY_SPEED, SHIMMY_FRAMES, 280, done);
    }

    function topIdle() {
      mode = "idle";
      priority = -1;
      if (reduced || topY() === null) return snapToGround(idle);
      if (ctx.current.resting) return sitDown();
      if (performance.now() > leaveAt) return goDown();
      const roll = Math.random();
      if (roll < 0.4) play(TOP_SCRIPTS.swing(), topIdle);
      else if (roll < 0.62) play(TOP_SCRIPTS.pause(), topIdle);
      else if (roll < 0.8) play(TOP_SCRIPTS.look(), topIdle);
      else {
        const max = maxX();
        let tx = Math.round(rand(0, max));
        if (Math.abs(tx - x) < 40) tx = clampX(x < max / 2 ? x + 60 : x - 60);
        shimmyTo(tx, topIdle);
      }
    }

    function goDown() {
      if (Math.random() < 0.6) {
        // Let go and drop
        play([["hangBlink", 200], ["hang", 250]], () => {
          mode = "travel";
          place = "ground";
          fly(0, "fall", false, land);
        });
        return;
      }
      const left = x < maxX() / 2;
      const wallX = left ? -CLIMB_OUT : maxX() + CLIMB_OUT;
      shimmyTo(wallX, () => {
        mode = "travel";
        place = "ground";
        facing = left ? -1 : 1;
        move(() => ({ x: wallX, y: 0 }), CLIMB_SPEED, CLIMB_FRAMES, 220, land);
      });
    }

    // Landing squash, then step back into the walking range if needed
    function land() {
      play([["crouch", 180], ["smile", 250]], () => {
        const tx = clampX(x);
        if (tx !== x) walkTo(tx, settle);
        else settle();
      });
    }

    function snapToGround(next) {
      stop();
      place = "ground";
      y = 0;
      x = clampX(x ?? 0);
      apply();
      next?.();
    }

    // A climb/jump/fall or arrival is done: catch up on what happened meanwhile
    function settle() {
      mode = "idle";
      priority = -1;
      if (pending) {
        const type = pending;
        pending = null;
        return react(type);
      }
      after();
    }

    function after() {
      if (ctx.current.resting) sitDown();
      else if (place === "top") topIdle();
      else idle();
    }

    // ── Rest ──

    function restLoop() {
      const top = place === "top";
      const steps = [[top ? "hangHold" : "sit", rand(1200, 3200)]];
      const roll = Math.random();
      if (roll < 0.4) {
        steps.push(...(top
          ? [["hangDrink1", 450], ["hangDrink2", 280], ["hangDrink1", 280], ["hangDrink2", 280], ["hangDrink1", 350], ["hangHoldBlink", 120]]
          : [["drink1", 450], ["drink2", 280], ["drink1", 280], ["drink2", 280], ["drink1", 350], ["sitBlink", 120]]));
      } else if (roll < 0.85) {
        steps.push([top ? "hangHoldBlink" : "sitBlink", 130]);
      } else {
        const f = top ? "hangHold" : "sit";
        steps.push([f, 200, 0, true], [top ? "hangHoldBlink" : "sitBlink", 120], [f, rand(600, 1200), 0, true]);
      }
      play(steps, restLoop);
    }

    function sitDown() {
      mode = "rest";
      priority = -1;
      if (place === "top") return restLoop();
      x = clampX(x);
      play(reduced ? [] : [["crouch", 180]], restLoop);
    }

    function react(type) {
      if (mode === "sleep") return;
      if (mode === "travel") {
        if (!pending || PRIORITY[type] > PRIORITY[pending]) pending = type;
        return;
      }
      if (mode === "react" && PRIORITY[type] < priority) return;
      stop();
      if (reduced && place === "top") snapToGround();
      mode = "react";
      priority = PRIORITY[type];
      const table = reduced ? REDUCED_REACTIONS : place === "top" ? TOP_REACTIONS : REACTIONS;
      play(table[type](burst), after);
    }

    function tap() {
      if (mode === "sleep" || mode === "react" || mode === "travel") return;
      if (mode === "rest") {
        stop();
        const [a, b] = place === "top" ? ["hangWaveA", "hangWaveB"] : ["sitWaveA", "sitWaveB"];
        return play(reduced ? [[a, 900]] : repeat(3, [[a, 170], [b, 170]]), after);
      }
      react("tap");
    }

    function restChanged(on, done) {
      // While reacting or travelling, after()/settle() picks up the new state
      if (mode === "sleep" || mode === "react" || mode === "travel") return;
      if (on && mode !== "rest") {
        stop();
        sitDown();
      } else if (!on && mode === "rest") {
        stop();
        mode = "react";
        priority = 1;
        let up;
        if (place === "top") up = done && !reduced ? [...kick(3), ["hang", 200]] : [["hang", 200]];
        else if (done) up = reduced ? [["fist", 900]] : [["crouch", 120], ...hop("cheer", 6), ["fist", 450], ["stand", 150]];
        else up = reduced ? [] : [["crouch", 160], ["stand", 150]];
        play(up, after);
      }
    }

    // Coming back from a hidden tab: finish any travel instantly, then carry on
    function resume() {
      jump = 0;
      if (place === "top" && (reduced || topY() === null)) place = "ground";
      if (place === "ground") {
        y = 0;
        x = clampX(x ?? 0);
      }
      if (place === "top" && leaveAt < performance.now()) leaveAt = performance.now() + rand(5000, 15000);
      mode = "idle";
      apply();
      settle();
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
        mode = "sleep";
      } else if (mode === "sleep") {
        resume();
      }
    }

    function onLayout() {
      if (mode !== "travel") apply();
    }

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => { reduced = mq.matches; };
    mq?.addEventListener?.("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, { passive: true });
    const chrome = document.querySelector(CHROME_SELECTOR);
    const ro = chrome && typeof ResizeObserver !== "undefined" ? new ResizeObserver(onLayout) : null;
    ro?.observe(chrome);

    ctrlRef.current = { react, tap, restChanged };
    apply();
    if (document.hidden) mode = "sleep";
    else if (ctx.current.resting) { mode = "rest"; restLoop(); }
    else play([["stand", 600]], idle);

    return () => {
      stop();
      burstTimers.forEach(clearTimeout);
      ro?.disconnect();
      mq?.removeEventListener?.("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout);
      ctrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!event || event.id === lastEventId.current) return;
    lastEventId.current = event.id;
    ctrlRef.current?.react(event.type);
  }, [event]);

  useEffect(() => {
    ctrlRef.current?.restChanged(resting, restDone);
  }, [resting, restDone]);

  const rects = frameRects(frame);

  return (
    <div className={`buddy${behind ? " buddy--behind" : ""}`} aria-hidden="true">
      <div className="buddy-track" ref={trackRef}>
        <span className="buddy-shadow" ref={shadowRef} />
        <div className="buddy-pos" ref={posRef}>
          <button
            type="button"
            className="buddy-sprite"
            ref={spriteRef}
            tabIndex={-1}
            onClick={() => ctrlRef.current?.tap()}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width={SPRITE_W}
              height={SPRITE_H}
              shapeRendering="crispEdges"
            >
              {rects.map(([rx, ry, rw, c], i) => (
                <rect key={i} x={rx} y={ry} width={rw} height={1} fill={PALETTE[c]} />
              ))}
            </svg>
          </button>
        </div>
        {bursts.map((b) => (
          <div key={b.id} className="buddy-burst" style={{ left: b.x, bottom: b.y }}>
            {b.pieces.map((p) => (
              <span
                key={p.id}
                className="buddy-confetti"
                style={{
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  "--c": p.color,
                  "--size": `${p.size}px`,
                  "--dur": `${p.dur}ms`,
                  "--delay": `${p.delay}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
