// Card battles: the 2D show. Two canvases sit in the battle field: one
// behind the cards with the scene (sky, moon, trees or water, drifting
// petals), one in front of them for skill effects (bolts, flames, slashes,
// orbs, sparkles). cards.js says what happened; this draws it. Positions
// come from the cards' boxes on the page, so the layout stays CSS's job.
(() => {
  "use strict";
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const still = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Each skill's look: colours and which kind of travel and impact.
  // kinds: slash (blades at the target), orb (a glowing ball flies over),
  // bolt (lightning from above), fire, wind (crescents), ribbon, spore,
  // seed, sonic (rings), bite, stomp (shock wave), star (falling stars),
  // heal, shield, buff.
  const LOOKS = {
    slash: { kind: "slash", colour: "#ffffff", glow: "#ffd76a" },
    orb: { kind: "orb", colour: "#ffe9a8", glow: "#ff9ac0" },
    foeSlash: { kind: "slash", colour: "#ffd0d8", glow: "#ff5f7d" },
    foeOrb: { kind: "orb", colour: "#d8b4ff", glow: "#a45cff" },
    bolt: { kind: "bolt", colour: "#fff2fb", glow: "#ff6fb5" },
    fire: { kind: "fire", colour: "#ffd76a", glow: "#ff6a2a" },
    wind: { kind: "wind", colour: "#e6fbff", glow: "#7fe3ff" },
    moon: { kind: "wind", colour: "#fff6c8", glow: "#ffd76a", big: true },
    ribbon: { kind: "ribbon", colour: "#ff8fbf", glow: "#ff5f96" },
    peck: { kind: "slash", colour: "#fff3a6", glow: "#ffb347", many: true },
    spore: { kind: "spore", colour: "#c58bff", glow: "#7a3fd0" },
    seed: { kind: "seed", colour: "#cfe0ff", glow: "#5b7bff" },
    sonic: { kind: "sonic", colour: "#c9b4ff", glow: "#7a5cff" },
    bite: { kind: "bite", colour: "#ffffff", glow: "#ff4f7d" },
    stomp: { kind: "stomp", colour: "#ffd9a0", glow: "#c47a3a" },
    steam: { kind: "spore", colour: "#fff4e6", glow: "#ffb38a" },
    star: { kind: "star", colour: "#fff2a0", glow: "#ffd76a" },
    heal: { kind: "heal", colour: "#9dffb8", glow: "#3fd17a" },
    leaf: { kind: "heal", colour: "#b6ff8f", glow: "#4fc16a", leaf: true },
    shield: { kind: "shield", colour: "#bfe6ff", glow: "#5ab4ff" },
    buff: { kind: "buff", colour: "#ffe58f", glow: "#ffb347" }
  };

  function create(field, { chapter = 1 } = {}) {
    const back = document.createElement("canvas");
    const front = document.createElement("canvas");
    back.className = "battle-scene";
    front.className = "battle-fx";
    back.setAttribute("aria-hidden", "true");
    front.setAttribute("aria-hidden", "true");
    field.prepend(back);
    field.append(front);
    const bg = back.getContext("2d"), g = front.getContext("2d");
    let w = 0, h = 0, dpr = 1, alive = true, last = performance.now(), shake = 0, flash = 0, flashColour = "#fff";
    const bits = [];      // effect particles and shapes
    const petals = [];    // the scene's drifting bits
    let units = () => [];
    let scene = null;     // the painted backdrop, redrawn on resize

    function size() {
      const box = field.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, box.width); h = Math.max(1, box.height);
      for (const c of [back, front]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      scene = paintScene();
    }
    const observer = window.ResizeObserver ? new ResizeObserver(size) : null;
    observer?.observe(field);
    size();
    for (let i = 0; i < 26; i++) petals.push(newPetal(true));

    // Where a card is, in field coordinates.
    function at(node) {
      const box = node.getBoundingClientRect(), f = field.getBoundingClientRect();
      const art = node.querySelector?.(".unit-art")?.getBoundingClientRect() || box;
      return { x: art.left + art.width / 2 - f.left, y: art.top + art.height / 2 - f.top, r: Math.max(18, art.width / 2) };
    }

    // ---- The backdrop ----
    function paintScene() {
      const c = document.createElement("canvas");
      c.width = back.width; c.height = back.height;
      const s = c.getContext("2d");
      s.scale(dpr, dpr);
      const lake = chapter === 2, fire = chapter === 3, ice = chapter === 4, dark = chapter === 5, holy = chapter === 6, cosmos = chapter === 7, abyss = chapter >= 8;
      const sky = s.createLinearGradient(0, 0, 0, h);
      if (abyss) { sky.addColorStop(0, "#0a4a5c"); sky.addColorStop(.45, "#06283c"); sky.addColorStop(1, "#020a16"); }
      else if (cosmos) { sky.addColorStop(0, "#040418"); sky.addColorStop(.6, "#14103a"); sky.addColorStop(1, "#08061c"); }
      else if (holy) { sky.addColorStop(0, "#3a5ab8"); sky.addColorStop(.5, "#9fc4ff"); sky.addColorStop(1, "#ffe7b0"); }
      else if (dark) { sky.addColorStop(0, "#05020c"); sky.addColorStop(.55, "#241038"); sky.addColorStop(1, "#0a0414"); }
      else if (ice) { sky.addColorStop(0, "#0e1a3a"); sky.addColorStop(.55, "#3a5a8a"); sky.addColorStop(1, "#1a2a48"); }
      else if (fire) { sky.addColorStop(0, "#2a0a1a"); sky.addColorStop(.5, "#7a2418"); sky.addColorStop(1, "#2a0c0c"); }
      else if (lake) { sky.addColorStop(0, "#0c1a46"); sky.addColorStop(.55, "#1d4a7a"); sky.addColorStop(1, "#0b2a3a"); }
      else { sky.addColorStop(0, "#160b38"); sky.addColorStop(.6, "#4a1f5c"); sky.addColorStop(1, "#1a0d2e"); }
      s.fillStyle = sky; s.fillRect(0, 0, w, h);
      if (cosmos) {
        // nebula clouds
        for (const [x, y, r, c] of [[w * .25, h * .18, w * .35, "rgba(255,90,200,.28)"], [w * .7, h * .12, w * .4, "rgba(80,200,255,.24)"], [w * .5, h * .3, w * .3, "rgba(160,90,255,.22)"]]) {
          const n = s.createRadialGradient(x, y, 0, x, y, r);
          n.addColorStop(0, c); n.addColorStop(1, "rgba(0,0,0,0)");
          s.fillStyle = n; s.fillRect(0, 0, w, h);
        }
      }
      if (abyss) {
        // light falling from the far surface
        s.save(); s.globalCompositeOperation = "lighter";
        for (const [x, k] of [[w * .18, 1], [w * .42, .7], [w * .63, 1.2], [w * .86, .8]]) {
          const ray = s.createLinearGradient(0, 0, 0, h * .6);
          ray.addColorStop(0, `rgba(150,255,240,${.16 * k})`); ray.addColorStop(1, "rgba(150,255,240,0)");
          s.fillStyle = ray; s.beginPath(); s.moveTo(x - 18 * k, 0); s.lineTo(x + 18 * k, 0); s.lineTo(x + 70 * k, h * .6); s.lineTo(x - 30 * k, h * .6); s.fill();
        }
        s.restore();
      }
      // stars
      for (let i = 0; i < (abyss ? 0 : 70); i++) {
        const x = (i * 97.3) % w, y = (i * 53.7) % (h * .3);
        s.globalAlpha = .25 + (i % 5) * .12;
        s.fillStyle = "#fff"; s.fillRect(x, y, 1.6, 1.6);
      }
      s.globalAlpha = 1;
      // moon (under the sea: the shimmer of the surface)
      if (abyss) s.globalAlpha = 0;
      const mx = w * .8, my = h * .13, mr = Math.min(w, h) * .07;
      const halo = s.createRadialGradient(mx, my, mr * .5, mx, my, mr * 3.2);
      halo.addColorStop(0, cosmos ? "rgba(120,220,255,.4)" : holy ? "rgba(255,240,180,.8)" : dark ? "rgba(200,120,255,.6)" : ice ? "rgba(200,240,255,.45)" : fire ? "rgba(255,150,60,.45)" : lake ? "rgba(160,220,255,.35)" : "rgba(255,210,240,.35)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = halo; s.beginPath(); s.arc(mx, my, mr * 3.2, 0, TAU); s.fill();
      s.fillStyle = cosmos ? "#5a6cd8" : holy ? "#fffbe8" : dark ? "#0a0410" : ice ? "#f4fbff" : fire ? "#ffcf7a" : lake ? "#e6f6ff" : "#fff1d6"; s.beginPath(); s.arc(mx, my, mr, 0, TAU); s.fill();
      s.globalAlpha = 1;
      if (cosmos) {
        // a ringed planet, and a small moon
        s.save(); s.translate(mx, my); s.rotate(-.35);
        s.strokeStyle = "rgba(255,210,150,.85)"; s.lineWidth = 3;
        s.beginPath(); s.ellipse(0, 0, mr * 2, mr * .45, 0, 0, TAU); s.stroke();
        s.restore();
        s.fillStyle = "#ff9ad0"; s.beginPath(); s.arc(w * .16, h * .09, mr * .35, 0, TAU); s.fill();
      }
      if (dark) {
        // an eclipse: a dark disc with a burning violet ring
        s.strokeStyle = "rgba(230,170,255,.95)"; s.lineWidth = 3; s.shadowColor = "#c47bff"; s.shadowBlur = 18;
        s.beginPath(); s.arc(mx, my, mr, 0, TAU); s.stroke(); s.shadowBlur = 0;
      }
      // far hills
      const ground = h * .34; // the fighters stand below this line
      if (cosmos) {
        // drifting asteroids
        for (let i = 0; i < 6; i++) {
          const x = (i * 197.3 + 30) % w, y = ground * (.4 + (i % 3) * .2), r = 8 + (i % 3) * 6;
          s.fillStyle = "#3a3458"; s.beginPath();
          for (let k = 0; k < 7; k++) { const a = k * TAU / 7, rr = r * (.8 + ((i + k) % 3) * .12); s.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          s.fill(); s.fillStyle = "rgba(255,255,255,.12)"; s.beginPath(); s.arc(x - r * .3, y - r * .3, r * .3, 0, TAU); s.fill();
        }
      }
      if (abyss) {
        // coral reefs and swaying kelp behind the hills, glowing jellyfish above
        for (const [x, k] of [[w * .08, 1], [w * .3, .7], [w * .7, 1.1], [w * .94, .85]]) {
          const base = ground + 4, tall = h * .2 * k;
          s.strokeStyle = "#0d4a4a"; s.lineWidth = 5 * k; s.lineCap = "round";
          for (let b = -2; b <= 2; b++) {
            s.beginPath(); s.moveTo(x, base); s.quadraticCurveTo(x + b * 14 * k, base - tall * .5, x + b * 22 * k, base - tall * (.7 + (b & 1) * .25)); s.stroke();
          }
          s.fillStyle = "rgba(255,120,170,.55)";
          for (let b = -2; b <= 2; b++) { s.beginPath(); s.arc(x + b * 22 * k, base - tall * (.7 + (b & 1) * .25), 4 * k, 0, TAU); s.fill(); }
        }
        s.strokeStyle = "rgba(40,140,90,.7)"; s.lineWidth = 3;
        for (let i = 0; i < 9; i++) {
          const x = (i * 151.7 + 20) % w, tall = h * (.12 + (i % 3) * .05);
          s.beginPath(); s.moveTo(x, ground + 6); s.bezierCurveTo(x + 14, ground - tall * .3, x - 14, ground - tall * .7, x + 6, ground - tall); s.stroke();
        }
        for (const [x, y, r] of [[w * .22, ground * .3, 14], [w * .55, ground * .18, 10], [w * .8, ground * .4, 12]]) {
          s.fillStyle = "rgba(140,230,255,.35)"; s.shadowColor = "#7ff0ff"; s.shadowBlur = 16;
          s.beginPath(); s.arc(x, y, r, Math.PI, 0); s.fill();
          s.strokeStyle = "rgba(140,230,255,.45)"; s.lineWidth = 1.5;
          for (let t = -2; t <= 2; t++) { s.beginPath(); s.moveTo(x + t * r * .35, y); s.quadraticCurveTo(x + t * r * .35 + 4, y + r, x + t * r * .35, y + r * 1.8); s.stroke(); }
        }
        s.shadowBlur = 0;
      }
      if (holy) {
        // floating islands with golden temples, and soft clouds
        for (const [x, y, k] of [[w * .14, ground * .62, .9], [w * .5, ground * .42, 1.2], [w * .86, ground * .66, .8]]) {
          const r = w * .07 * k;
          s.fillStyle = "rgba(120,110,160,.55)"; s.beginPath(); s.moveTo(x - r, y); s.lineTo(x + r, y); s.lineTo(x, y + r * 1.1); s.fill();
          s.fillStyle = "#fff7e0"; s.beginPath(); s.ellipse(x, y, r, r * .22, 0, 0, TAU); s.fill();
          s.fillStyle = "#ffd76a";
          for (let c = -2; c <= 2; c++) s.fillRect(x + c * r * .3 - 2, y - r * .55, 4, r * .55);
          s.beginPath(); s.moveTo(x - r * .75, y - r * .55); s.lineTo(x, y - r * .95); s.lineTo(x + r * .75, y - r * .55); s.fill();
        }
        s.fillStyle = "rgba(255,255,255,.7)";
        for (let i = 0; i < 6; i++) { const x = (i * 211.7) % w, y = ground * (.2 + (i % 3) * .22); s.beginPath(); s.ellipse(x, y, 40, 12, 0, 0, TAU); s.ellipse(x + 26, y - 6, 26, 12, 0, 0, TAU); s.fill(); }
      }
      if (dark) {
        // broken spires and floating crystals
        for (const [x, k] of [[w * .1, 1], [w * .3, .7], [w * .74, 1.2], [w * .93, .85]]) {
          const top = ground - h * .22 * k, half = w * .03 * k;
          s.fillStyle = "#1a0c28"; s.beginPath(); s.moveTo(x - half, ground); s.lineTo(x - half * .6, top + 12); s.lineTo(x, top); s.lineTo(x + half * .5, top + 20); s.lineTo(x + half, ground); s.fill();
        }
        for (let i = 0; i < 7; i++) {
          const x = (i * 173.3 + 40) % w, y = ground * (.35 + (i % 3) * .18), r = 6 + (i % 3) * 4;
          s.fillStyle = "rgba(190,110,255,.75)"; s.shadowColor = "#b067ff"; s.shadowBlur = 12;
          s.beginPath(); s.moveTo(x, y - r * 1.6); s.lineTo(x + r, y); s.lineTo(x, y + r * 1.6); s.lineTo(x - r, y); s.fill();
        }
        s.shadowBlur = 0;
      }
      if (ice) {
        // snowy peaks behind the hills
        for (const [x, k] of [[w * .12, .9], [w * .38, 1.25], [w * .7, 1.05], [w * .95, .8]]) {
          const top = ground - (h * .24) * k, half = w * .14 * k;
          s.fillStyle = "#2c4670"; s.beginPath(); s.moveTo(x - half, ground); s.lineTo(x, top); s.lineTo(x + half, ground); s.fill();
          s.fillStyle = "#e8f4ff"; s.beginPath(); s.moveTo(x - half * .32, top + (ground - top) * .32); s.lineTo(x, top); s.lineTo(x + half * .32, top + (ground - top) * .32);
          s.lineTo(x + half * .12, top + (ground - top) * .26); s.lineTo(x, top + (ground - top) * .36); s.lineTo(x - half * .12, top + (ground - top) * .26); s.fill();
        }
      }
      if (fire) {
        // volcanoes with glowing tops behind the hills
        for (const [x, k] of [[w * .18, 1], [w * .62, 1.3], [w * .92, .8]]) {
          const top = ground - (h * .2) * k, half = w * .12 * k;
          s.fillStyle = "#3a1414"; s.beginPath(); s.moveTo(x - half, ground); s.lineTo(x - half * .18, top); s.lineTo(x + half * .18, top); s.lineTo(x + half, ground); s.fill();
          const lava = s.createRadialGradient(x, top, 2, x, top, half * .6);
          lava.addColorStop(0, "rgba(255,170,60,.9)"); lava.addColorStop(1, "rgba(255,80,20,0)");
          s.fillStyle = lava; s.beginPath(); s.arc(x, top, half * .6, 0, TAU); s.fill();
          s.strokeStyle = "rgba(255,120,40,.6)"; s.lineWidth = 2;
          s.beginPath(); s.moveTo(x, top); s.quadraticCurveTo(x - half * .2, top + (ground - top) * .5, x - half * .35, ground); s.stroke();
        }
      }
      s.fillStyle = abyss ? "#0a2e3c" : cosmos ? "#1a1640" : holy ? "#f3e6c8" : dark ? "#140a20" : ice ? "#9db8d8" : fire ? "#2a0e10" : lake ? "#123a5c" : "#2c1450";
      s.beginPath(); s.moveTo(0, ground);
      for (let x = 0; x <= w + 20; x += 20) s.lineTo(x, ground - 24 - Math.sin(x * .012) * 18 - Math.sin(x * .031) * 8);
      s.lineTo(w, h); s.lineTo(0, h); s.fill();
      if (abyss) {
        // the sea floor: dark sand, shells and glowing anemones
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#14485a"); floor.addColorStop(1, "#03121c");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(160,240,230,.12)"; s.lineWidth = 2;
        for (let i = 1; i < 6; i++) { const y = ground + (h - ground) * i / 6; s.beginPath(); for (let x = 0; x <= w; x += 24) s.lineTo(x, y + Math.sin(x * .03 + i) * 3); s.stroke(); }
        for (let i = 0; i < 18; i++) {
          const x = (i * 139.3) % w, y = ground + 14 + ((i * 63.1) % (h - ground - 18)), k = .5 + (y - ground) / (h - ground);
          s.fillStyle = i % 3 ? "rgba(90,255,210,.5)" : "rgba(255,150,200,.5)"; s.shadowColor = s.fillStyle; s.shadowBlur = 8;
          s.beginPath(); s.arc(x, y, 3 * k, 0, TAU); s.fill();
        }
        s.shadowBlur = 0;
      } else if (cosmos) {
        // a floor of dark glass with a grid of starlight
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#221c52"); floor.addColorStop(1, "#06051a");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(120,220,255,.3)"; s.lineWidth = 1;
        for (let i = 1; i < 7; i++) { const y = ground + (h - ground) * (i / 7) ** 1.4; s.beginPath(); s.moveTo(0, y); s.lineTo(w, y); s.stroke(); }
        for (let i = 0; i < 14; i++) { const x = w * i / 13; s.beginPath(); s.moveTo(w / 2 + (x - w / 2) * .3, ground); s.lineTo(x, h); s.stroke(); }
      } else if (holy) {
        // a floor of clouds with golden tiles
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#fff4dc"); floor.addColorStop(1, "#c9b0e0");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(220,170,60,.4)"; s.lineWidth = 1.2;
        for (let i = 1; i < 6; i++) { const y = ground + (h - ground) * i / 6; s.beginPath(); s.moveTo(0, y); s.lineTo(w, y); s.stroke(); }
        for (let i = 0; i < 12; i++) { const x = w * i / 11; s.beginPath(); s.moveTo(w / 2 + (x - w / 2) * .4, ground); s.lineTo(x, h); s.stroke(); }
      } else if (dark) {
        // dark ground veined with violet light
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#22113a"); floor.addColorStop(1, "#07030f");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(190,110,255,.4)"; s.lineWidth = 1.4;
        for (let i = 0; i < 14; i++) {
          let x = (i * 149.7) % w, y = ground + 14 + ((i * 59.3) % (h - ground - 18));
          s.beginPath(); s.moveTo(x, y);
          for (let n = 0; n < 4; n++) { x += 9 + (n * 5 + i) % 13; y += ((n + i) % 3 - 1) * 4; s.lineTo(x, y); }
          s.stroke();
        }
      } else if (ice) {
        // a snowfield with blue shadows and ice crystals
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#cfe2f5"); floor.addColorStop(1, "#6f8fb8");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        for (let i = 0; i < 26; i++) {
          const x = (i * 137.9) % w, y = ground + 12 + ((i * 61.7) % (h - ground - 16)), k = .5 + (y - ground) / (h - ground);
          s.fillStyle = i % 2 ? "rgba(140,200,255,.55)" : "rgba(255,255,255,.7)";
          s.beginPath(); s.moveTo(x, y - 12 * k); s.lineTo(x + 4 * k, y); s.lineTo(x - 4 * k, y); s.fill();
        }
      } else if (fire) {
        // scorched ground with cracks of lava
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#3a1612"); floor.addColorStop(1, "#140606");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(255,110,40,.45)"; s.lineWidth = 1.6;
        for (let i = 0; i < 16; i++) {
          let x = (i * 151.3) % w, y = ground + 16 + ((i * 67.1) % (h - ground - 20));
          s.beginPath(); s.moveTo(x, y);
          for (let n = 0; n < 4; n++) { x += 10 + (n * 7 + i) % 14; y += ((n + i) % 3 - 1) * 5; s.lineTo(x, y); }
          s.stroke();
        }
      } else if (lake) {
        // water with moonlight
        const water = s.createLinearGradient(0, ground, 0, h);
        water.addColorStop(0, "#1b5d86"); water.addColorStop(1, "#08202f");
        s.fillStyle = water; s.fillRect(0, ground, w, h - ground);
        s.strokeStyle = "rgba(220,245,255,.25)"; s.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const y = ground + 10 + i * (h - ground) / 14, x = mx + Math.sin(i * 2.3) * 30; s.beginPath(); s.moveTo(x - 30 - i * 4, y); s.lineTo(x + 30 + i * 4, y); s.stroke(); }
      } else {
        // cherry trees on both sides and a path in the middle
        const floor = s.createLinearGradient(0, ground, 0, h);
        floor.addColorStop(0, "#3d1b55"); floor.addColorStop(1, "#140a26");
        s.fillStyle = floor; s.fillRect(0, ground, w, h - ground);
        for (const [x, k] of [[w * .04, 1], [w * .2, .7], [w * .93, 1.1], [w * .68, .6], [w * .45, .45]]) tree(s, x, ground + 4, Math.min(w, h) * .26 * k);
        // grass tufts and stones across the field
        for (let i = 0; i < 40; i++) {
          const x = (i * 131.7) % w, y = ground + 14 + ((i * 71.3) % (h - ground - 14));
          const k = .5 + (y - ground) / (h - ground);
          s.fillStyle = i % 3 ? "rgba(120,200,140,.25)" : "rgba(255,170,210,.22)";
          s.beginPath(); s.moveTo(x - 6 * k, y); s.lineTo(x - 2 * k, y - 9 * k); s.lineTo(x, y); s.lineTo(x + 3 * k, y - 11 * k); s.lineTo(x + 6 * k, y); s.fill();
        }
      }
      // a glowing circle of runes in the middle of the field
      const cx = w / 2, cy = ground + (h - ground) * .58, rx = Math.min(w * .3, (h - ground) * 1.1), ry = rx * .32;
      s.save();
      s.strokeStyle = abyss ? "rgba(90,255,210,.55)" : cosmos ? "rgba(255,120,220,.6)" : holy ? "rgba(230,170,40,.7)" : dark ? "rgba(200,130,255,.55)" : ice ? "rgba(120,190,255,.55)" : fire ? "rgba(255,170,90,.4)" : lake ? "rgba(150,230,255,.35)" : "rgba(255,190,230,.35)";
      s.lineWidth = 2;
      for (const k of [1, .8, .45]) { s.beginPath(); s.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU); s.stroke(); }
      s.lineWidth = 1.2;
      s.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 2, b = a + TAU / 3; s.moveTo(cx + Math.cos(a) * rx * .8, cy + Math.sin(a) * ry * .8); s.lineTo(cx + Math.cos(b) * rx * .8, cy + Math.sin(b) * ry * .8); }
      s.stroke();
      const core = s.createRadialGradient(cx, cy, 0, cx, cy, rx);
      core.addColorStop(0, abyss ? "rgba(90,255,210,.2)" : cosmos ? "rgba(120,220,255,.25)" : holy ? "rgba(255,220,120,.35)" : dark ? "rgba(170,90,255,.25)" : ice ? "rgba(160,220,255,.22)" : fire ? "rgba(255,140,60,.2)" : lake ? "rgba(120,220,255,.16)" : "rgba(255,150,210,.16)"); core.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = core; s.beginPath(); s.ellipse(cx, cy, rx, ry, 0, 0, TAU); s.fill();
      s.restore();
      // soft spotlight where the two sides meet
      const spot = s.createRadialGradient(w / 2, h * .62, 10, w / 2, h * .62, Math.max(w, h) * .55);
      spot.addColorStop(0, "rgba(255,200,230,.14)"); spot.addColorStop(1, "rgba(0,0,0,.35)");
      s.fillStyle = spot; s.fillRect(0, 0, w, h);
      return c;
    }
    function tree(s, x, base, size) {
      s.fillStyle = "#24102f";
      s.beginPath(); s.moveTo(x - size * .05, base); s.quadraticCurveTo(x - size * .02, base - size * .5, x + size * .04, base - size * .75); s.lineTo(x + size * .08, base - size * .72); s.quadraticCurveTo(x + size * .04, base - size * .45, x + size * .07, base); s.fill();
      for (const [dx, dy, r, c] of [[0, -.85, .32, "#c5528a"], [-.25, -.7, .24, "#a8417a"], [.25, -.72, .26, "#d8679c"], [0, -1.05, .22, "#ef85ad"]]) {
        s.fillStyle = c; s.globalAlpha = .85; s.beginPath(); s.arc(x + dx * size, base + dy * size, r * size, 0, TAU); s.fill();
      }
      s.globalAlpha = 1;
    }
    function newPetal(anywhere) {
      const lake = chapter === 2, fire = chapter === 3, ice = chapter === 4, dark = chapter === 5, holy = chapter === 6, cosmos = chapter === 7, abyss = chapter >= 8;
      return {
        x: anywhere ? rand(0, w) : rand(-20, w), y: anywhere ? rand(0, h) : -10, vx: rand(8, 26), vy: rand(10, 28),
        spin: rand(0, TAU), vs: rand(-2, 2), r: fire ? rand(1.5, 3.2) : rand(2.5, 5), snow: ice, colour: abyss ? "rgba(180,255,245,.6)" : cosmos ? (Math.random() < .5 ? "rgba(120,230,255,.9)" : "rgba(255,150,230,.9)") : holy ? (Math.random() < .5 ? "rgba(255,230,140,.9)" : "rgba(255,255,255,.9)") : dark ? (Math.random() < .5 ? "rgba(200,140,255,.8)" : "rgba(120,60,200,.8)") : ice ? "rgba(255,255,255,.85)" : fire ? (Math.random() < .5 ? "#ffb347" : "#ff6a2a") : lake ? "rgba(190,240,255,.55)" : (Math.random() < .5 ? "#ffb3d1" : "#ff8fbf"), bubble: lake || fire || dark || holy || cosmos || abyss, ember: fire || ice || dark || holy || cosmos
      };
    }

    // ---- Effect pieces ----
    // A piece has life (seconds left), age, and a draw(g, t) where t runs 0..1.
    function add(piece) { piece.age = 0; piece.delay = piece.delay || 0; bits.push(piece); return piece; }
    function sparks(p, colour, count = 12, speed = 160) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, TAU), v = rand(speed * .4, speed);
        add({ life: rand(.35, .6), x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 260, r: rand(1.5, 3.5), colour, kind: "spark" });
      }
    }
    function ring(p, colour, grow = 2.4, life = .4, width = 4) { add({ life, x: p.x, y: p.y, r0: p.r * .5, r1: p.r * grow, colour, width, kind: "ring" }); }
    function glow(p, colour, life = .3, size = 2) { add({ life, x: p.x, y: p.y, r: p.r * size, colour, kind: "glow" }); }

    function travel(from, to, look, opts = {}) {
      add({ life: opts.life || .28, delay: opts.delay, from, to, look, arc: opts.arc ?? 0, kind: "travel" });
    }

    // ---- What cards.js calls ----
    // A card uses a skill (or a plain attack) on these targets.
    function cast(actor, targets, name, side) {
      if (!alive || still()) return;
      const look = LOOKS[name] || LOOKS.slash;
      const from = at(actor);
      const ends = targets.map(at);
      glow(from, look.glow, .35, 1.6);
      switch (look.kind) {
        case "orb": case "ribbon": case "seed": case "spore": case "bite":
          ends.forEach((to, n) => travel(from, to, look, { delay: n * .04, arc: look.kind === "seed" ? -60 : look.kind === "ribbon" ? 40 : -25 }));
          break;
        case "wind":
          ends.forEach((to, n) => travel(from, to, look, { delay: n * .05, life: .3 }));
          break;
        case "fire":
          ends.forEach((to, n) => {
            for (let k = 0; k < 10; k++) travel(from, { ...to, x: to.x + rand(-12, 12), y: to.y + rand(-12, 12) }, look, { delay: n * .03 + k * .018, life: .26, arc: rand(-30, 30) });
          });
          break;
        case "sonic":
          for (let k = 0; k < 3; k++) add({ life: .45, delay: k * .08, x: from.x, y: from.y, r0: 10, r1: Math.hypot(w, h) * .45, colour: look.colour, width: 3, kind: "ring" });
          break;
        case "star":
          ends.forEach((to, n) => travel({ x: to.x + (side === "hero" ? -80 : 80), y: -20, r: 10 }, to, look, { delay: n * .06, life: .32 }));
          break;
        case "stomp":
          ring({ ...from, y: from.y + from.r }, look.glow, 4, .45, 6);
          shake = Math.max(shake, 6);
          break;
        case "heal": case "shield": case "buff":
          // shown on each friend when the heal / shield / effect lands
          break;
        default: break; // slash, bolt: drawn on impact
      }
    }

    // A target is struck.
    function impact(target, name, crit, boss) {
      if (!alive || still()) return;
      const look = LOOKS[name] || LOOKS.slash;
      const p = at(target);
      if (look.kind === "bolt") {
        add({ life: .3, x: p.x, y: p.y, colour: look.colour, glowColour: look.glow, kind: "bolt", seed: Math.random() * 99 });
        flash = .25; flashColour = "rgba(255,220,250,.35)";
      }
      if (look.kind === "slash") {
        const blades = look.many ? 3 : crit ? 2 : 1;
        for (let k = 0; k < blades; k++) add({ life: .24, delay: k * .06, x: p.x, y: p.y, r: p.r * 1.5, angle: rand(-.9, -.3) + k * .8, colour: look.colour, glowColour: look.glow, kind: "slash" });
      }
      if (look.kind === "bite") add({ life: .28, x: p.x, y: p.y, r: p.r, colour: look.colour, kind: "bite" });
      if (look.kind === "fire") for (let k = 0; k < 8; k++) add({ life: rand(.4, .7), x: p.x + rand(-p.r, p.r) * .6, y: p.y + rand(-4, 8), vx: rand(-10, 10), vy: rand(-90, -50), gy: 0, r: rand(3, 6), colour: Math.random() < .5 ? "#ffb347" : "#ff6a2a", kind: "spark" });
      sparks(p, look.glow, crit ? 22 : 12, crit ? 240 : 170);
      ring(p, look.colour, crit ? 3 : 2.2, .35, crit ? 5 : 3);
      glow(p, look.glow, .25, crit ? 2.6 : 1.8);
      if (crit || boss) shake = Math.max(shake, crit ? 9 : 5);
      if (crit) { flash = Math.max(flash, .15); flashColour = "rgba(255,240,180,.3)"; }
    }

    function heal(target, leafy) {
      if (!alive || still()) return;
      const look = leafy ? LOOKS.leaf : LOOKS.heal, p = at(target);
      glow(p, look.glow, .5, 2);
      for (let k = 0; k < 9; k++) add({ life: rand(.6, .9), delay: k * .03, x: p.x + rand(-p.r, p.r), y: p.y + rand(0, p.r), vx: 0, vy: rand(-70, -40), gy: 0, r: rand(5, 8), colour: look.colour, kind: leafy ? "leaf" : "plus" });
    }
    function shield(target) {
      if (!alive || still()) return;
      const p = at(target);
      add({ life: .7, x: p.x, y: p.y, r: p.r * 1.5, colour: LOOKS.shield.colour, glowColour: LOOKS.shield.glow, kind: "bubble" });
    }
    function buff(target, down) {
      if (!alive || still()) return;
      const p = at(target), colour = down ? "#ff7a8a" : LOOKS.buff.colour;
      for (let k = 0; k < 4; k++) add({ life: .7, delay: k * .07, x: p.x + (k - 1.5) * p.r * .5, y: p.y + p.r * .6, vx: 0, vy: down ? 50 : -60, gy: 0, r: 7, colour, down, kind: "arrow" });
    }
    function knockout(target) {
      if (!alive || still()) return;
      const p = at(target);
      for (let k = 0; k < 14; k++) add({ life: rand(.5, .8), x: p.x + rand(-p.r, p.r), y: p.y + p.r * .8, vx: rand(-60, 60), vy: rand(-50, -10), gy: 40, r: rand(4, 9), colour: "rgba(200,190,220,.5)", kind: "dust" });
    }
    function wave() { if (alive && !still()) { flash = .3; flashColour = "rgba(255,215,106,.25)"; } }

    // ---- Every frame ----
    function frame(now) {
      if (!alive) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      // backdrop and drifting petals or bubbles
      bg.setTransform(1, 0, 0, 1, 0, 0);
      if (scene) bg.drawImage(scene, 0, 0);
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!still()) for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.x += (p.vx + Math.sin(t + i) * 10) * dt; p.y += p.vy * (p.bubble ? -1 : 1) * dt; p.spin += p.vs * dt;
        if (p.bubble && p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
        if (!p.bubble && (p.y > h + 10 || p.x > w + 20)) petals[i] = newPetal(false);
        bg.save(); bg.translate(p.x, p.y); bg.rotate(p.spin);
        if (p.ember) { bg.fillStyle = p.colour; bg.globalAlpha = .55 + Math.sin(t * 6 + i) * .3; bg.beginPath(); bg.arc(0, 0, p.r, 0, TAU); bg.fill(); }
        else if (p.bubble) { bg.strokeStyle = p.colour; bg.lineWidth = 1.2; bg.beginPath(); bg.arc(0, 0, p.r, 0, TAU); bg.stroke(); }
        else { bg.fillStyle = p.colour; bg.globalAlpha = .7; bg.beginPath(); bg.ellipse(0, 0, p.r, p.r * .55, 0, 0, TAU); bg.fill(); }
        bg.restore();
      }

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, front.width, front.height);
      // shake the whole field a little
      if (shake > 0) {
        const s = shake * (still() ? 0 : 1);
        field.style.transform = `translate(${rand(-s, s).toFixed(1)}px, ${rand(-s, s).toFixed(1)}px)`;
        shake = Math.max(0, shake - dt * 40);
        if (shake === 0) field.style.transform = "";
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flash > 0) { g.fillStyle = flashColour; g.globalAlpha = Math.min(1, flash * 3); g.fillRect(0, 0, w, h); g.globalAlpha = 1; flash -= dt; }

      // statuses that keep showing: stars round a stunned head, flames on a burn
      for (const u of units()) {
        if (!u.el?.isConnected) continue;
        const p = at(u.el);
        if (u.stun) for (let k = 0; k < 3; k++) {
          const a = t * 4 + k * TAU / 3;
          star(g, p.x + Math.cos(a) * p.r * .9, p.y - p.r * 1.05 + Math.sin(a) * p.r * .25, 4, "#ffe58f");
        }
        if (u.burn && Math.random() < dt * 14) add({ life: rand(.4, .6), x: p.x + rand(-p.r, p.r) * .7, y: p.y + p.r * .5, vx: 0, vy: rand(-60, -35), gy: 0, r: rand(2.5, 4.5), colour: Math.random() < .5 ? "#ffb347" : "#ff6a2a", kind: "spark" });
        if (u.taunt) { g.strokeStyle = "rgba(255,120,120,.55)"; g.lineWidth = 2; g.setLineDash([5, 5]); g.lineDashOffset = -t * 20; g.beginPath(); g.arc(p.x, p.y, p.r * 1.35, 0, TAU); g.stroke(); g.setLineDash([]); }
      }

      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.age += dt;
        const k = Math.min(1, b.age / b.life);
        if (k >= 1) {
          if (b.kind === "travel") landed(b);
          bits.splice(i, 1);
          continue;
        }
        if (b.vx != null) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += (b.gy || 0) * dt; }
        drawBit(b, k, t);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // A flying piece arrives: a small splash of its colour.
    function landed(b) { sparks(b.to, b.look.glow, 6, 110); }

    function drawBit(b, k, t) {
      g.save();
      switch (b.kind) {
        case "spark": case "dust":
          g.globalAlpha = 1 - k; g.fillStyle = b.colour; g.beginPath(); g.arc(b.x, b.y, b.r * (b.kind === "dust" ? 1 + k : 1 - k * .5), 0, TAU); g.fill(); break;
        case "ring":
          g.globalAlpha = 1 - k; g.strokeStyle = b.colour; g.lineWidth = b.width * (1 - k * .6);
          g.beginPath(); g.arc(b.x, b.y, b.r0 + (b.r1 - b.r0) * easeOut(k), 0, TAU); g.stroke(); break;
        case "glow": {
          const r = b.r * (.6 + k * .6), grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          grad.addColorStop(0, b.colour); grad.addColorStop(1, "rgba(0,0,0,0)");
          g.globalAlpha = (1 - k) * .8; g.globalCompositeOperation = "lighter"; g.fillStyle = grad; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill(); break;
        }
        case "travel": {
          const e = easeIn(k);
          const x = b.from.x + (b.to.x - b.from.x) * e, y = b.from.y + (b.to.y - b.from.y) * e - Math.sin(e * Math.PI) * b.arc;
          drawShot(b.look, x, y, Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x), t);
          break;
        }
        case "slash": {
          g.globalAlpha = 1 - k; g.lineCap = "round";
          g.translate(b.x, b.y); g.rotate(b.angle);
          g.shadowColor = b.glowColour; g.shadowBlur = 14; g.strokeStyle = b.colour; g.lineWidth = 5 * (1 - k) + 1;
          const reach = b.r * easeOut(Math.min(1, k * 2.2));
          g.beginPath(); g.moveTo(-b.r, 0); g.lineTo(-b.r + reach * 2, 0); g.stroke();
          break;
        }
        case "bite": {
          g.globalAlpha = 1 - k; g.fillStyle = b.colour;
          const gap = b.r * (1 - easeOut(k)) * .9 + 4;
          for (const dir of [-1, 1]) for (let n = -2; n <= 2; n++) { g.beginPath(); g.moveTo(b.x + n * b.r * .3 - 5, b.y + dir * gap); g.lineTo(b.x + n * b.r * .3 + 5, b.y + dir * gap); g.lineTo(b.x + n * b.r * .3, b.y + dir * (gap - 12)); g.fill(); }
          break;
        }
        case "bolt": {
          g.globalAlpha = 1 - k; g.strokeStyle = b.colour; g.shadowColor = b.glowColour; g.shadowBlur = 18; g.lineWidth = 4;
          g.beginPath(); g.moveTo(b.x + Math.sin(b.seed) * 20, -10);
          const steps = 7;
          for (let n = 1; n <= steps; n++) g.lineTo(b.x + (n < steps ? Math.sin(b.seed + n * 2.7) * 18 : 0), -10 + (b.y + 10) * n / steps);
          g.stroke(); g.lineWidth = 1.5; g.strokeStyle = "#fff"; g.stroke(); break;
        }
        case "bubble": {
          const r = b.r * (k < .3 ? easeOut(k / .3) : 1);
          g.globalAlpha = k < .7 ? .9 : (1 - k) / .3;
          const grad = g.createRadialGradient(b.x - r * .3, b.y - r * .3, r * .1, b.x, b.y, r);
          grad.addColorStop(0, "rgba(255,255,255,.35)"); grad.addColorStop(.7, "rgba(140,200,255,.12)"); grad.addColorStop(1, "rgba(140,200,255,.45)");
          g.fillStyle = grad; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
          g.strokeStyle = b.colour; g.shadowColor = b.glowColour; g.shadowBlur = 10; g.lineWidth = 2; g.stroke(); break;
        }
        case "plus":
          g.globalAlpha = 1 - k; g.fillStyle = b.colour; g.fillRect(b.x - b.r / 2, b.y - 1.5, b.r, 3); g.fillRect(b.x - 1.5, b.y - b.r / 2, 3, b.r); break;
        case "leaf":
          g.globalAlpha = 1 - k; g.translate(b.x, b.y); g.rotate(Math.sin(t * 5 + b.x) * .8); g.fillStyle = b.colour;
          g.beginPath(); g.ellipse(0, 0, b.r, b.r * .45, 0, 0, TAU); g.fill(); break;
        case "arrow":
          g.globalAlpha = 1 - k; g.fillStyle = b.colour; g.translate(b.x, b.y); if (b.down) g.rotate(Math.PI);
          g.beginPath(); g.moveTo(0, -b.r); g.lineTo(b.r * .8, 0); g.lineTo(b.r * .3, 0); g.lineTo(b.r * .3, b.r); g.lineTo(-b.r * .3, b.r); g.lineTo(-b.r * .3, 0); g.lineTo(-b.r * .8, 0); g.fill(); break;
        default: break;
      }
      g.restore();
    }

    // The flying part of a skill.
    function drawShot(look, x, y, angle, t) {
      g.save();
      g.translate(x, y);
      g.globalCompositeOperation = "lighter";
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, 18);
      halo.addColorStop(0, look.glow); halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill();
      g.globalCompositeOperation = "source-over";
      g.fillStyle = look.colour;
      switch (look.kind) {
        case "wind": {
          g.rotate(angle);
          const s = look.big ? 1.8 : 1.1;
          g.beginPath(); g.arc(0, 0, 16 * s, -1.2, 1.2); g.arc(-6 * s, 0, 13 * s, 1.1, -1.1, true); g.fill();
          break;
        }
        case "ribbon":
          g.rotate(angle + Math.sin(t * 20) * .4);
          g.beginPath(); g.ellipse(-5, 0, 9, 5, .5, 0, TAU); g.ellipse(5, 0, 9, 5, -.5, 0, TAU); g.fill(); break;
        case "fire": g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); break;
        case "star": star(g, 0, 0, 10, look.colour); break;
        case "seed": g.rotate(t * 12); star(g, 0, 0, 7, look.colour); break;
        case "spore": for (let n = 0; n < 4; n++) { g.beginPath(); g.arc(Math.cos(t * 9 + n) * 6, Math.sin(t * 9 + n) * 6, 3.5, 0, TAU); g.fill(); } break;
        case "bite": g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); break;
        default: g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(-2, -2, 2.5, 0, TAU); g.fill();
      }
      g.restore();
    }

    return {
      cast, impact, heal, shield, buff, knockout, wave,
      follow(fn) { units = fn; },
      destroy() { alive = false; observer?.disconnect(); back.remove(); front.remove(); field.style.transform = ""; }
    };
  }

  function star(g, x, y, r, colour) {
    g.fillStyle = colour;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    g.closePath(); g.fill();
  }
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const easeIn = (k) => k * k * (3 - 2 * k);

  window.PupaCardsFx = { create, LOOKS };
})();
