(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const ui = {
    start: document.querySelector("#startScreen"),
    pause: document.querySelector("#pauseScreen"),
    end: document.querySelector("#endScreen"),
    startBtn: document.querySelector("#startBtn"),
    pauseBtn: document.querySelector("#pauseBtn"),
    resumeBtn: document.querySelector("#resumeBtn"),
    restartBtn: document.querySelector("#restartBtn"),
    fullscreenBtn: document.querySelector("#fullscreenBtn"),
    soundBtn: document.querySelector("#soundBtn"),
    score: document.querySelector("#score"),
    hearts: document.querySelector("#hearts"),
    distance: document.querySelector("#distance"),
    finalScore: document.querySelector("#finalScore"),
    endTitle: document.querySelector("#endTitle"),
    endText: document.querySelector("#endText"),
    endIcon: document.querySelector("#endIcon"),
    announcer: document.querySelector("#announcer"),
    levelName: document.querySelector("#levelName"),
    points: document.querySelector("#points"),
    attackBtn: document.querySelector(".touch-button.attack"),
    finalPoints: document.querySelector("#finalPoints"),
    bestPoints: document.querySelector("#bestPoints")
  };

  const WORLD = { width: 6100, ground: 605, gravity: 2200 };
  const keys = { left: false, right: false, jump: false, attack: false };
  const image = (src) => { const img = new Image(); img.src = src; return img; };
  const art = {
    background: image("assets/cherry-night.webp"),
    hero: image("assets/pupa-hero-3d.webp"),
    runFrames: Array.from({ length: 3 }, (_, index) => image(`assets/pupa-run-${index + 1}.webp`)),
    enemy: image("assets/thorn-shroom.webp")
  };

  // A platform may carry three extra values to make it glide back and forth:
  // axis ("x" or "y"), travel distance and top speed.
  // A fifth value of "spring" makes a bounce pad instead, and "crumble" a
  // platform that drops away shortly after Pupa lands on it.
  const rects = (list) => list.map(([x, y, w, h, axis, range, speed]) => {
    const kind = axis === "spring" || axis === "crumble" ? axis : undefined;
    return { x, y, w, h, ox: x, oy: y, axis: kind ? undefined : axis, kind, range, speed, t: 0, dx: 0, dy: 0, state: "idle", timer: 0, bounce: 0, vy: 0 };
  });
  // Enemy types: "walker" patrols the ground, "bat" flies in a wave,
  // "hopper" waits and then leaps, "urchin" patrols and is too spiky to
  // stomp, "spitter" stays put and fires seeds at Pupa. Mystery blocks give a random item when
  // bumped from below.
  const levels = [
    {
      name: "ด่าน 1 · สวนเชอร์รี่เรืองแสง",
      width: 6100, goalX: 5740, checkpointX: 3010,
      theme: { tint: null, top: "#c5528a", shine: "#ef85ad", body: ["#5d346f", "#3a245b", "#161437"], sparks: ["#ffd978", "#ff8bc2"] },
      platforms: rects([
        [0, 605, 900, 140], [1010, 605, 820, 140], [1940, 605, 980, 140],
        [3040, 605, 670, 140], [3820, 605, 860, 140], [4790, 605, 1310, 140],
        [410, 480, 230, 34], [760, 405, 170, 34], [1130, 475, 220, 34],
        [1490, 390, 190, 34], [2020, 465, 260, 34], [2410, 375, 220, 34],
        [2740, 485, 170, 34], [3160, 445, 230, 34], [3520, 355, 180, 34],
        [3970, 470, 210, 34], [4330, 390, 190, 34], [4850, 460, 240, 34],
        [5260, 360, 210, 34]
      ]),
      cherries: [
        [470,420], [570,420], [810,345], [1180,415], [1280,415], [1540,330],
        [2090,405], [2200,405], [2460,315], [2790,425], [3210,385], [3320,385],
        [3570,295], [4020,410], [4380,330], [4890,400], [5000,400], [5320,300]
      ],
      enemies: [
        ["walker",690,536], ["walker",1230,536], ["walker",1740,536], ["walker",2150,536], ["walker",2730,536],
        ["walker",3280,536], ["walker",4080,536], ["walker",4560,536], ["walker",5040,536], ["walker",5400,291]
      ],
      blocks: [[250,390],[1392,390],[1700,390],[2318,390],[3425,390],[4225,390],[4580,390],[5150,390]]
    },
    {
      name: "ด่าน 2 · หุบเขาหิ่งห้อยคราม",
      width: 6600, goalX: 6240, checkpointX: 3500,
      theme: { tint: "#1fb6c9", top: "#2fb6a6", shine: "#8df5dc", body: ["#2d5a78", "#1c3557", "#0c1633"], sparks: ["#8ff5ff", "#c9ff9a"] },
      platforms: rects([
        [0, 605, 700, 140], [840, 605, 560, 140], [1560, 605, 520, 140], [2620, 605, 700, 140],
        [3470, 605, 430, 140], [4050, 605, 640, 140], [5200, 605, 1400, 140],
        [300, 480, 200, 34], [560, 390, 170, 34], [960, 470, 220, 34], [1250, 380, 180, 34],
        [1650, 460, 220, 34], [1900, 370, 170, 34], [2150, 505, 150, 34], [2370, 440, 150, 34],
        [2760, 470, 220, 34], [3050, 380, 200, 34], [3560, 450, 220, 34], [4150, 470, 200, 34],
        [4420, 380, 190, 34], [4760, 500, 140, 34], [4960, 430, 140, 34], [5350, 460, 230, 34],
        [5700, 370, 200, 34]
      ]),
      cherries: [
        [350,420], [450,420], [640,330], [1020,410], [1120,410], [1340,320], [1700,400], [1810,400],
        [1985,310], [2225,445], [2445,380], [2820,410], [2920,410], [3150,320], [3620,390], [3720,390],
        [4250,410], [4515,320], [4830,440], [5030,370], [5420,400], [5800,310]
      ],
      enemies: [
        ["hopper",520,553], ["bat",770,430], ["walker",1050,536], ["hopper",1300,553], ["bat",1480,440],
        ["walker",1750,536], ["hopper",1950,553], ["bat",2330,255], ["walker",2900,536], ["hopper",3200,553],
        ["bat",3400,450], ["hopper",3760,553], ["walker",4200,536], ["bat",4530,470], ["bat",4880,240],
        ["hopper",5500,553], ["walker",5850,536], ["hopper",6050,553]
      ],
      blocks: [[130,390],[885,390],[2690,390],[3800,390],[5250,390],[5600,390],[6000,390]]
    },
    {
      name: "ด่าน 3 · ผาเมฆรุ่งอรุณ",
      width: 7000, goalX: 6640, checkpointX: 3600,
      theme: { tint: "#ff8a3c", top: "#f2a23c", shine: "#ffe08a", body: ["#7a3f4f", "#4e2647", "#1c1230"], sparks: ["#ffe9a8", "#ff9d6b"] },
      platforms: rects([
        [0, 605, 600, 140], [760, 605, 420, 140], [1800, 605, 560, 140], [2520, 605, 480, 140],
        [3480, 605, 620, 140], [4260, 605, 400, 140], [5400, 605, 500, 140], [6060, 605, 940, 140],
        [200, 480, 200, 34], [450, 390, 170, 34], [830, 470, 200, 34],
        [1250, 500, 130, 34], [1450, 470, 150, 34, "x", 160, 70],
        [1900, 470, 220, 34], [2150, 380, 180, 34], [2600, 460, 200, 34], [2820, 370, 160, 34],
        [3080, 380, 150, 34, "y", 160, 60], [3290, 400, 130, 34],
        [3600, 470, 220, 34], [3880, 380, 190, 34], [4330, 460, 200, 34],
        [4720, 500, 150, 34, "x", 180, 70], [5080, 450, 130, 34], [5250, 380, 130, 34, "y", 140, 60],
        [5480, 470, 200, 34], [5700, 380, 180, 34], [6200, 460, 230, 34]
      ]),
      cherries: [
        [260,420], [340,420], [535,330], [890,410], [980,410], [1315,440], [1525,410], [1600,410],
        [1960,410], [2060,410], [2240,320], [2660,400], [2900,310], [3155,330], [3355,340], [3660,410],
        [3760,410], [3975,320], [4390,400], [4480,400], [4795,440], [5145,390], [5315,330], [5540,410],
        [5790,320], [6260,400], [6370,400]
      ],
      enemies: [
        ["hopper",380,553], ["bat",680,440], ["walker",950,536], ["bat",1500,250], ["walker",2000,536],
        ["hopper",2230,553], ["bat",2440,450], ["walker",2700,536], ["hopper",2880,553], ["bat",3250,220],
        ["walker",3780,536], ["hopper",3950,553], ["bat",4180,440], ["hopper",4400,553], ["walker",4560,536],
        ["bat",4850,300], ["bat",5200,200], ["walker",5600,536], ["hopper",5780,553], ["bat",5980,450],
        ["walker",6250,536], ["hopper",6400,553]
      ],
      blocks: [[60,390],[1070,390],[1840,390],[3520,390],[4560,390],[6100,390]]
    },
    {
      name: "ด่าน 4 · รังราชาเห็ดหนาม",
      width: 6200, goalX: 5960, checkpointX: 4230,
      theme: { tint: "#e0355e", top: "#d1345b", shine: "#ff9fb5", body: ["#5a1f3a", "#3a1430", "#150a1f"], sparks: ["#ff7b9c", "#ffd166"] },
      // The boss wakes when Pupa walks into its arena and the goal stays
      // sealed until it is beaten.
      boss: { name: "ราชาเห็ดหนาม", x: 5300, left: 4350, right: 5750, hp: 5 },
      platforms: rects([
        [0, 605, 700, 140], [860, 605, 640, 140], [2000, 605, 560, 140], [2720, 605, 500, 140],
        [3740, 605, 2460, 140],
        [250, 480, 200, 34], [500, 390, 170, 34], [950, 470, 210, 34], [1230, 380, 180, 34],
        [1570, 490, 150, 34, "x", 170, 75],
        [2100, 470, 220, 34], [2350, 380, 170, 34], [2800, 460, 200, 34], [3020, 370, 150, 34],
        [3290, 380, 140, 34, "y", 150, 60], [3500, 420, 130, 34],
        [3850, 470, 200, 34],
        [4560, 440, 190, 34], [4955, 340, 190, 34], [5350, 440, 190, 34], [5590, 380, 120, 34]
      ]),
      cherries: [
        [310,420], [390,420], [585,330], [1010,410], [1100,410], [1320,320], [1650,430], [2160,410],
        [2260,410], [2435,320], [2860,400], [3095,310], [3360,330], [3565,360], [3910,410], [3990,410],
        [4655,380], [5050,280], [5445,380]
      ],
      enemies: [
        ["hopper",430,553], ["bat",780,440], ["walker",1050,536], ["hopper",1380,553], ["bat",1750,260],
        ["walker",2150,536], ["hopper",2460,553], ["bat",2640,450], ["walker",2900,536], ["hopper",3100,553],
        ["bat",3450,200], ["walker",3950,536], ["hopper",4150,553]
      ],
      blocks: [[120,390],[2020,390],[2740,390],[4180,390],[4820,390],[5220,390]]
    },
    {
      name: "ด่าน 5 · ทะเลเมฆจันทร์เงิน",
      width: 7200, goalX: 6860, checkpointX: 3600,
      theme: { tint: "#5b7bff", top: "#8fb4ff", shine: "#e3eeff", body: ["#3b4a8a", "#262f66", "#0e1233"], sparks: ["#ffffff", "#a8c8ff"] },
      platforms: rects([
        [0, 605, 640, 140], [800, 605, 520, 140], [1860, 605, 600, 140], [2620, 605, 460, 140],
        [3560, 605, 700, 140], [4420, 605, 380, 140], [5500, 605, 560, 140], [6220, 605, 980, 140],
        [220, 480, 190, 34], [460, 390, 160, 34], [880, 470, 200, 34], [1120, 380, 170, 34],
        [1390, 490, 140, 34, "x", 150, 80], [1720, 430, 110, 34],
        [1950, 470, 210, 34], [2200, 380, 180, 34], [2700, 460, 190, 34], [2900, 370, 150, 34],
        [3150, 360, 140, 34, "y", 170, 70], [3340, 400, 130, 34, "x", 70, 60],
        [3650, 470, 210, 34], [3900, 380, 180, 34], [4480, 460, 190, 34],
        [4870, 500, 140, 34, "x", 160, 80], [5210, 440, 110, 34], [5350, 370, 120, 34, "y", 150, 70],
        [5580, 470, 200, 34], [5800, 380, 170, 34], [6320, 470, 200, 34], [6500, 380, 150, 34]
      ]),
      cherries: [
        [280,420], [360,420], [540,330], [940,410], [1020,410], [1205,320], [1460,430], [1775,370],
        [2010,410], [2100,410], [2290,320], [2760,400], [2975,310], [3220,300], [3405,340], [3710,410],
        [3800,410], [3990,320], [4540,400], [4610,400], [4940,440], [5265,380], [5410,310], [5640,410],
        [5885,320], [6380,410], [6575,320]
      ],
      enemies: [
        ["urchin",400,549], ["bat",720,440], ["walker",950,536], ["spitter",1230,535], ["bat",1600,250],
        ["urchin",2050,549], ["hopper",2250,553], ["spitter",2400,535], ["bat",2540,450], ["walker",2800,536],
        ["spitter",3030,535], ["bat",3300,180], ["urchin",3850,549], ["hopper",4100,553], ["bat",4340,440],
        ["urchin",4560,549], ["spitter",4750,535], ["bat",5000,280], ["bat",5300,185], ["walker",5650,536],
        ["hopper",5850,553], ["spitter",6020,535], ["bat",6140,450], ["urchin",6400,549], ["spitter",6450,400]
      ],
      blocks: [[100,390],[1260,390],[1880,390],[2640,390],[3580,390],[4700,390],[5510,390],[6240,390]]
    },
    {
      name: "ด่าน 6 · หอคอยจันทร์ดับ",
      width: 6400, goalX: 6100, checkpointX: 4250,
      theme: { tint: "#8b3dff", top: "#a06bff", shine: "#e2ccff", body: ["#3d2a6b", "#291b52", "#0d0820"], sparks: ["#d9b8ff", "#ffe27a"] },
      // A flying boss: she rains moon orbs, then dives at Pupa and is left
      // dazed on the ground for a moment.
      boss: { kind: "queen", name: "ราชินีค้างคาวจันทร์", x: 5300, left: 4450, right: 5850, hp: 6 },
      platforms: rects([
        [0, 605, 620, 140], [780, 605, 500, 140], [1840, 605, 560, 140], [2560, 605, 440, 140],
        [3520, 605, 2880, 140],
        [230, 480, 190, 34], [470, 390, 160, 34], [860, 470, 200, 34], [1090, 380, 160, 34],
        [1350, 380, 130, 34, "y", 160, 70], [1530, 440, 130, 34, "x", 150, 80],
        [1930, 470, 200, 34], [2170, 380, 170, 34], [2640, 460, 180, 34], [2850, 370, 140, 34],
        [3070, 490, 130, 34, "x", 130, 85], [3370, 420, 110, 34],
        [3620, 470, 200, 34], [3860, 380, 170, 34], [4100, 470, 180, 34],
        [4650, 440, 190, 34], [5050, 330, 200, 34], [5450, 440, 190, 34], [5700, 380, 120, 34]
      ]),
      cherries: [
        [290,420], [370,420], [550,330], [920,410], [1000,410], [1170,320], [1415,320], [1600,380],
        [1990,410], [2070,410], [2255,320], [2700,400], [2920,310], [3140,430], [3425,360], [3680,410],
        [3760,410], [3945,320], [4190,410], [4745,380], [5150,270], [5545,380]
      ],
      enemies: [
        ["urchin",420,549], ["bat",700,440], ["walker",950,536], ["spitter",1210,535], ["bat",1500,200],
        ["urchin",2020,549], ["hopper",2280,553], ["bat",2480,450], ["walker",2720,536], ["spitter",2950,535],
        ["bat",3250,260], ["urchin",3700,549], ["hopper",3950,553], ["walker",4200,536]
      ],
      blocks: [[90,390],[1220,390],[1860,390],[2580,390],[3540,390],[4040,390],[4900,390],[5300,390]]
    },
    {
      name: "ด่าน 7 · ถ้ำคริสตัลมรกต",
      width: 7000, goalX: 6660, checkpointX: 3500,
      theme: { tint: "#3ddc84", top: "#5fe39a", shine: "#d6ffe6", body: ["#1f5a4a", "#143d3a", "#081a1f"], sparks: ["#b6ffcf", "#ffe27a"] },
      platforms: rects([
        [0, 605, 600, 140], [1100, 605, 480, 140], [1740, 605, 420, 140], [2760, 605, 500, 140],
        [3420, 605, 600, 140], [4620, 605, 420, 140], [5640, 605, 1360, 140],
        [200, 480, 190, 34], [430, 390, 150, 34],
        [660, 520, 110, 30, "crumble"], [810, 500, 110, 30, "crumble"], [960, 520, 110, 30, "crumble"],
        [1180, 470, 190, 34], [1400, 380, 150, 34], [1490, 585, 80, 20, "spring"],
        [1820, 470, 180, 34],
        [2230, 560, 90, 20, "spring"], [2380, 300, 180, 34], [2600, 400, 120, 34],
        [2850, 460, 190, 34], [3060, 370, 140, 34],
        [3520, 470, 200, 34], [3760, 380, 150, 34], [3820, 585, 80, 20, "spring"],
        [4080, 500, 110, 30, "crumble"], [4230, 470, 110, 30, "crumble"], [4380, 450, 130, 34, "x", 100, 70],
        [4700, 460, 180, 34],
        [5100, 560, 90, 20, "spring"], [5250, 330, 120, 30, "crumble"], [5420, 360, 120, 30, "crumble"],
        [5750, 470, 190, 34], [5980, 380, 160, 34], [6200, 470, 180, 34], [6340, 360, 140, 34]
      ]),
      cherries: [
        [260,420], [330,420], [505,330], [715,460], [865,440], [1015,460], [1240,410], [1320,410],
        [1475,320], [1530,290], [1530,220], [1880,410], [2275,340], [2275,260], [2470,240], [2660,340],
        [2910,400], [3130,310], [3580,410], [3660,410], [3860,300], [3860,230], [4135,440], [4285,410],
        [4445,390], [4760,400], [5145,330], [5310,270], [5480,300], [5810,410], [6060,320], [6260,410],
        [6410,300]
      ],
      enemies: [
        ["hopper",380,553], ["bat",850,300], ["urchin",1300,549], ["walker",1900,536], ["spitter",2100,535],
        ["urchin",2950,549], ["hopper",3150,553], ["bat",3340,440], ["walker",3700,536], ["spitter",3985,535],
        ["bat",4300,290], ["urchin",4800,549], ["hopper",4940,553], ["bat",5350,150], ["walker",5800,536],
        ["urchin",6000,549], ["spitter",6130,535], ["hopper",6300,553]
      ],
      blocks: [[80,390],[1120,390],[1760,390],[2780,390],[3440,390],[4640,390],[5660,390],[6120,390]]
    },
    {
      name: "ด่าน 8 · ภูเขาไฟเชอร์รี่เพลิง",
      width: 7400, goalX: 7040, checkpointX: 4300,
      theme: { tint: "#ff5a2e", top: "#ff7a3d", shine: "#ffd3a1", body: ["#6b2a2a", "#471b2b", "#1a0a18"], sparks: ["#ffb347", "#ff5f6e"] },
      // Everything learned so far in one climb up the volcano: bounce pads,
      // crumbling ledges, gliding platforms and every enemy, then a rematch
      // with the thorn king, now angrier and tougher than before.
      boss: { name: "ราชาเห็ดหนามเพลิง", x: 6250, left: 5160, right: 6880, hp: 7 },
      platforms: rects([
        [0, 605, 560, 140], [720, 605, 420, 140], [1300, 605, 380, 140], [2040, 605, 460, 140],
        [2700, 605, 440, 140], [3360, 605, 560, 140], [4140, 605, 380, 140], [4700, 605, 2700, 140],
        [200, 480, 180, 34], [380, 400, 140, 34], [470, 585, 80, 20, "spring"], [640, 290, 150, 34],
        [800, 470, 180, 34], [1020, 380, 140, 34, "x", 120, 70],
        [1360, 470, 180, 34], [1580, 380, 130, 34],
        [1740, 520, 110, 30, "crumble"], [1900, 490, 110, 30, "crumble"],
        [2110, 470, 190, 34], [2340, 380, 150, 34],
        [2780, 460, 180, 34], [3000, 370, 140, 34, "y", 150, 60],
        [3440, 470, 200, 34], [3680, 380, 160, 34], [3840, 585, 80, 20, "spring"], [3980, 260, 160, 34],
        [4220, 470, 180, 34, "x", 130, 80], [4480, 380, 120, 30, "crumble"],
        [4780, 470, 200, 34], [5000, 380, 150, 34],
        [5420, 440, 190, 34], [5820, 340, 190, 34], [6220, 440, 190, 34], [6520, 380, 120, 34]
      ]),
      cherries: [
        [260,420], [340,420], [450,340], [510,500], [510,420], [510,340], [680,230], [760,230],
        [860,410], [940,410], [1090,320], [1420,410], [1500,410], [1645,320], [1795,460], [1955,430],
        [2170,410], [2250,410], [2415,320], [2840,400], [2920,400], [3070,310], [3500,410], [3580,410],
        [3760,320], [3880,500], [3880,420], [3880,340], [4020,200], [4100,200], [4280,410], [4540,320],
        [4840,410], [4920,410], [5075,320], [5515,380], [5915,280], [6315,380], [6580,320]
      ],
      enemies: [
        ["urchin",380,549], ["bat",640,420], ["walker",900,536], ["spitter",1050,535], ["hopper",1450,553],
        ["bat",1800,300], ["urchin",2200,549], ["spitter",2420,535], ["bat",2600,450], ["walker",2850,536],
        ["hopper",3020,553], ["bat",3250,250], ["urchin",3550,549], ["spitter",3760,535], ["bat",4030,380],
        ["hopper",4300,553], ["bat",4560,200], ["walker",4850,536], ["urchin",5050,549]
      ],
      blocks: [[100,390],[760,390],[1320,390],[2070,390],[2720,390],[3400,390],[4160,390],[5680,390],[6080,390],[6440,390]]
    },
    {
      name: "ด่าน 9 · สะพานรุ้งกลางพายุ",
      width: 7600, goalX: 7240, checkpointX: 4250,
      theme: { tint: "#ffd23c", top: "#f5c542", shine: "#fff3b0", body: ["#6a5a2a", "#463a22", "#1a1410"], sparks: ["#fff6c2", "#8fe3ff"] },
      // Short islands of ground with wide gaps between them: each crossing
      // is a chain of gliding, crumbling or bouncing platforms.
      platforms: rects([
        [0, 605, 620, 140], [1500, 605, 460, 140], [2900, 605, 420, 140], [4100, 605, 500, 140],
        [5500, 605, 380, 140], [6500, 605, 1100, 140],
        [200, 480, 180, 34], [420, 390, 150, 34],
        [700, 500, 140, 34, "x", 200, 80], [1100, 430, 150, 34], [1300, 500, 110, 30, "crumble"],
        [1580, 470, 180, 34], [1800, 380, 140, 34],
        [2040, 470, 150, 34], [2260, 560, 90, 20, "spring"], [2400, 300, 170, 34], [2650, 400, 130, 34, "y", 150, 60],
        [3000, 460, 170, 34], [3180, 370, 120, 34],
        [3400, 480, 120, 30, "crumble"], [3580, 430, 120, 30, "crumble"], [3760, 480, 140, 34, "x", 140, 90],
        [4180, 470, 190, 34], [4420, 380, 150, 34],
        [4680, 470, 150, 34], [4880, 380, 130, 34, "y", 160, 70], [5080, 460, 130, 34, "x", 180, 80],
        [5560, 460, 170, 34],
        [5960, 500, 110, 30, "crumble"], [6120, 440, 110, 30, "crumble"], [6290, 500, 120, 34, "x", 100, 70],
        [6600, 470, 190, 34], [6850, 380, 160, 34]
      ]),
      cherries: [
        [260,420], [330,420], [495,330], [770,440], [870,440], [1175,370], [1355,440], [1640,410],
        [1720,410], [1870,320], [2115,410], [2305,440], [2305,360], [2440,240], [2520,240], [2715,340],
        [3060,400], [3140,400], [3240,310], [3460,420], [3640,370], [3830,420], [4240,410], [4320,410],
        [4495,320], [4755,410], [4945,320], [5145,400], [5645,400], [6015,440], [6175,380], [6350,440],
        [6660,410], [6740,410], [6930,320]
      ],
      enemies: [
        ["walker",450,536], ["bat",1000,300], ["urchin",1700,549], ["spitter",1900,535], ["bat",2700,250],
        ["hopper",3050,553], ["walker",3200,536], ["bat",3600,300], ["urchin",4500,549], ["bat",4900,250],
        ["hopper",5650,553], ["spitter",5820,535], ["bat",6200,300], ["walker",6700,536], ["urchin",6900,549],
        ["hopper",6950,553]
      ],
      blocks: [[120,390],[1510,390],[2920,390],[4110,390],[5760,390],[6510,390]]
    },
    {
      name: "ด่าน 10 · บัลลังก์จันทร์เต็มดวง",
      width: 7600, goalX: 7300, checkpointX: 5300,
      theme: { tint: "#ff3fb0", top: "#ff6fc4", shine: "#ffd6f0", body: ["#5e2453", "#3d1840", "#140818"], sparks: ["#ffe27a", "#ffb3e6"] },
      // The last level: one more run through every trick, then the bat
      // queen's stronger elder sister under the full moon.
      boss: { kind: "queen", name: "จักรพรรดินีค้างคาวจันทร์", x: 6500, left: 5600, right: 7050, hp: 8 },
      platforms: rects([
        [0, 605, 600, 140], [1200, 605, 420, 140], [2000, 605, 460, 140], [2900, 605, 400, 140],
        [3700, 605, 600, 140], [4700, 605, 2900, 140],
        [150, 480, 180, 34], [380, 390, 140, 34],
        [680, 560, 90, 20, "spring"], [820, 300, 160, 34], [830, 500, 110, 34], [1050, 420, 120, 30, "crumble"],
        [1280, 470, 170, 34], [1480, 380, 130, 34],
        [1700, 480, 130, 34, "y", 140, 70],
        [2080, 470, 170, 34], [2290, 380, 140, 34],
        [2530, 500, 110, 30, "crumble"], [2690, 450, 110, 30, "crumble"],
        [2980, 460, 170, 34], [3180, 370, 120, 34],
        [3380, 470, 140, 34, "x", 120, 80],
        [3780, 470, 180, 34], [4000, 380, 150, 34], [4180, 585, 80, 20, "spring"],
        [4330, 260, 160, 34], [4400, 490, 130, 34, "y", 120, 60],
        [4800, 470, 190, 34], [5050, 380, 150, 34],
        [5800, 440, 190, 34], [6200, 330, 200, 34], [6600, 440, 190, 34], [6850, 380, 120, 34]
      ]),
      cherries: [
        [210,420], [290,420], [450,330], [725,500], [725,420], [860,240], [940,240], [1110,360],
        [1340,410], [1420,410], [1545,320], [1765,420], [2140,410], [2220,410], [2360,320], [2585,440],
        [2745,390], [3040,400], [3120,400], [3240,310], [3450,410], [3840,410], [3920,410], [4075,320],
        [4220,500], [4220,420], [4370,200], [4450,200], [4465,430], [4860,410], [4940,410], [5125,320],
        [5895,380], [6300,270], [6695,380]
      ],
      enemies: [
        ["walker",420,536], ["bat",1000,420], ["urchin",1450,549], ["spitter",1580,535], ["bat",1800,300],
        ["hopper",2200,553], ["walker",2380,536], ["bat",2650,350], ["urchin",3050,549], ["spitter",3250,535],
        ["bat",3500,250], ["hopper",3900,553], ["walker",4150,536], ["bat",4500,350], ["spitter",4950,535],
        ["urchin",5100,549]
      ],
      blocks: [[120,390],[1210,390],[2910,390],[3710,390],[6050,390],[6450,390]]
    }
  ];
  const totalCherries = levels.reduce((sum, entry) => sum + entry.cherries.length, 0);
  // Open the page with ?level=2 to start on a later level.
  const startLevel = Math.min(levels.length, Math.max(1, Number(new URLSearchParams(location.search).get("level")) || 1)) - 1;
  // Add &checkpoint to also begin from that level's checkpoint flag.
  const startAtCheckpoint = new URLSearchParams(location.search).has("checkpoint");
  const enemySizes = { walker: [70, 68], bat: [66, 40], hopper: [62, 52], urchin: [64, 56], spitter: [60, 70] };
  // Each level ends with a flagpole just before the gate: the higher Pupa
  // grabs it, the more points it pays.
  const POLE_OFFSET = 150;
  const POLE_HEIGHT = 500;
  // Seconds of invulnerability (shown as blinking) after taking a hit.
  const HURT_TIME = 5;
  const BEST_KEY = "superPupaRunBest";
  const formatPoints = (n) => n.toLocaleString("en-US");
  const QUEEN_HOVER = 200; // height the bat queen circles at
  const STAR_TIME = 8;
  const BOOST_TIME = 10;
  const BOMB_TIME = 10;
  const itemGlow = { heart: "#ff6e99", star: "#ffe27a", leaf: "#89f0c0", grow: "#ff9d6b", bomb: "#ff5f6e", shield: "#7fd4ff" };

  // Progress kept on this device. Points and coins are running totals that
  // only ever grow: across levels, game overs, replays and visits.
  const SAVE_KEY = "superPupaRunSave";
  const save = { best: 0, points: null, coins: 0, plays: 0, wins: 0 };
  try {
    Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"));
    save.best = Math.max(Number(save.best) || 0, Number(localStorage.getItem(BEST_KEY)) || 0);
    if (save.points == null) save.points = save.best; // saves from before totals existed
    for (const key of ["points", "coins", "plays", "wins"]) save[key] = Math.max(0, Math.floor(Number(save[key]) || 0));
  } catch { save.points = 0; /* storage unavailable: play on without saving */ }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
    const line = document.querySelector("#saveLine");
    if (line) line.textContent = `คะแนนสะสม ${formatPoints(save.points)} · เหรียญสะสม ${formatPoints(save.coins)}`;
  }
  // Move coins picked up since the last call into the lifetime total.
  function bankCoins() {
    if (!player) return;
    const held = player.score + player.bonus;
    if (held > player.banked) { save.coins += held - player.banked; player.banked = held; writeSave(); }
  }
  const SMALL = { w: 70, h: 88 };
  const BIG = { w: 92, h: 124 };

  let levelIndex = 0;
  let level = levels[0];
  let platforms = level.platforms;
  let bannerTime = 0;
  let bannerText = "";
  let levelStart = { score: 0, bonus: 0, points: 0 };
  let boss = null;
  let hazards = [];
  let popups = [];
  let bombs = [];
  let shots = [];
  let blasts = [];
  let shake = 0;
  let player;
  let cherries;
  let enemies;
  let blocks;
  let solids;
  let items = [];
  let particles = [];
  let cameraX = 0;
  let state = "menu";
  let last = 0;
  let soundOn = true;
  let audio;
  let viewWidth = 1280;
  let viewHeight = 720;
  let renderScale = 1;
  let dpr = 1;
  let checkpoint = 90;
  let announcementTimer = 0;

  function makeEnemy(type, x, y, id) {
    const [w, h] = enemySizes[type];
    const speed = type === "bat" ? 115 : type === "hopper" ? 70 : type === "urchin" ? 80 : type === "spitter" ? 0 : 58;
    const reach = type === "bat" ? 150 : 95;
    return { id, type, x, y, baseY: y, w, h, min: x - reach, max: x + reach, vx: id % 2 ? speed : -speed, vy: 0, wait: .6 + (id % 3) * .3, alive: true, phase: id, dir: -1, puff: 0 };
  }

  function loadLevel(index) {
    levelIndex = index;
    level = levels[index];
    platforms = level.platforms;
    for (const p of platforms) { p.x = p.ox; p.y = p.oy; p.t = 0; p.dx = 0; p.dy = 0; p.state = "idle"; p.timer = 0; p.bounce = 0; p.vy = 0; }
    WORLD.width = level.width;
    cherries = level.cherries.map(([x, y], id) => ({ id, x, y, taken: false, phase: id * .71 }));
    enemies = level.enemies.map(([type, x, y], id) => makeEnemy(type, x, y, id));
    blocks = level.blocks.map(([x, y], id) => ({ id, x, y, w: 56, h: 56, used: false, bump: 0 }));
    solids = platforms.concat(blocks);
    items = [];
    particles = [];
    cameraX = 0;
    checkpoint = 90;
    Object.assign(player, { x: 90, y: 420, vx: 0, vy: 0, grounded: false, facing: 1, ride: null });
    if (startAtCheckpoint && index === startLevel) {
      checkpoint = level.checkpointX + 50;
      player.x = checkpoint;
      cameraX = Math.max(0, player.x - viewWidth * .34);
    }
    boss = level.boss ? {
      ...level.boss, w: 170, h: 180, y: WORLD.ground - 180, vx: 0, vy: 0, maxHp: level.boss.hp,
      active: false, alive: true, hurt: 0, mode: "walk", timer: 1.6, spit: 1, facing: -1, fade: 0
    } : null;
    if (boss?.kind === "queen") Object.assign(boss, { w: 180, h: 100, y: QUEEN_HOVER, mode: "hover", timer: 2.4, spit: 1, t: 0 });
    hazards = [];
    popups = [];
    bombs = [];
    blasts = [];
    shots = [];
    shake = 0;
    player.flag = null;
    levelStart = { score: player.score, bonus: player.bonus, points: player.points };
    bannerText = level.name;
    bannerTime = 3;
    if (ui.levelName) ui.levelName.textContent = level.name;
    updateHud();
  }

  function resetGame() {
    player = { x: 90, y: 420, w: 70, h: 88, vx: 0, vy: 0, lives: 3, score: 0, grounded: false, hurt: 0, facing: 1, bonus: 0, points: 0, star: 0, boost: 0, bomb: 0, bombCooldown: 0, banked: 0, airJumps: 1, shield: false, big: false, ride: null, flag: null };
    if (state !== "playing") state = "menu";
    loadLevel(startLevel);
  }

  // After a game over, try the same level again with full hearts. Coins and
  // points are never taken away; coins already collected and blocks already
  // opened stay that way so they cannot be collected twice.
  function retryLevel() {
    if (player.big) setBig(false);
    // Coming back from a game over also starts with the 5 s grace period.
    Object.assign(player, { lives: 3, hurt: HURT_TIME, star: 0, boost: 0, bomb: 0, shield: false });
    const takenCoins = new Set(cherries.filter(cherry => cherry.taken).map(cherry => cherry.id));
    const usedBlocks = new Set(blocks.filter(block => block.used).map(block => block.id));
    const reachedCheckpoint = checkpoint > 90;
    const bossBefore = boss && { hp: boss.hp, alive: boss.alive };
    state = "menu";
    loadLevel(levelIndex);
    for (const cherry of cherries) cherry.taken = takenCoins.has(cherry.id);
    // On a boss level the item blocks refill, so there is always help for the
    // rematch; elsewhere opened blocks stay opened.
    if (!boss) for (const block of blocks) block.used = usedBlocks.has(block.id);
    // Damage already dealt to the boss is kept.
    if (boss && bossBefore) { boss.hp = bossBefore.hp; boss.alive = bossBefore.alive; }
    if (reachedCheckpoint) {
      checkpoint = level.checkpointX + 50;
      player.x = checkpoint;
      cameraX = Math.max(0, player.x - viewWidth * .34);
    }
  }

  function nextLevel() {
    bankCoins();
    // Every new level starts with full hearts.
    player.lives = 3;
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .18, "triangle", .06, i * .11));
    loadLevel(levelIndex + 1);
    announce(`ผ่านด่านแล้ว เข้าสู่${level.name}`);
  }

  function progress() {
    return Math.min(100, Math.round((player.x / (level.goalX - 80)) * 100));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    renderScale = rect.height / 720;
    // With the touch buttons on screen, zoom out just enough for the ground
    // line to sit above them, so they cover soil instead of Pupa.
    const touchButton = document.querySelector(".mobile-controls .touch-button");
    if (touchButton && touchButton.offsetParent) {
      const buttonTop = touchButton.getBoundingClientRect().top - rect.top;
      if (buttonTop > 0) renderScale = Math.max(renderScale * .72, Math.min(renderScale, (buttonTop - 8) / WORLD.ground));
    }
    viewWidth = rect.width / renderScale;
    viewHeight = rect.height / renderScale;
  }

  function startGame() {
    if (state === "lost") retryLevel();
    else if (state === "won") resetGame();
    state = "playing";
    ui.start.hidden = true;
    ui.pause.hidden = true;
    ui.end.hidden = true;
    ui.pauseBtn.setAttribute("aria-pressed", "false");
    announce("เริ่มเกมแล้ว เดินทางไปทางขวาและเก็บเหรียญทอง");
    tone(440, .08, "sine");
  }

  function togglePause(force) {
    if (!["playing", "paused"].includes(state)) return;
    const shouldPause = force ?? state === "playing";
    state = shouldPause ? "paused" : "playing";
    ui.pause.hidden = !shouldPause;
    ui.pauseBtn.setAttribute("aria-pressed", String(shouldPause));
    ui.pauseBtn.textContent = shouldPause ? "▶" : "Ⅱ";
    if (shouldPause) ui.resumeBtn.focus();
  }

  function finish(won) {
    state = won ? "won" : "lost";
    ui.end.hidden = false;
    ui.endTitle.textContent = won ? "ถึงรังไหมแล้ว!" : "ลองใหม่อีกครั้ง";
    ui.endText.textContent = won ? "Pupa ฝ่าคืนมหัศจรรย์กลับถึงบ้านอย่างปลอดภัย" : "เหรียญและคะแนนยังอยู่ครบ กดเล่นอีกครั้งเพื่อเริ่มด่านนี้ใหม่";
    ui.endIcon.textContent = won ? "✦" : "☾";
    ui.finalScore.textContent = formatPoints(save.coins);
    const isNewBest = player.points > save.best;
    if (isNewBest) save.best = player.points;
    save.plays++;
    if (won) save.wins++;
    bankCoins();
    writeSave();
    ui.finalPoints.textContent = formatPoints(save.points);
    ui.bestPoints.textContent = `รอบนี้ได้ +${formatPoints(player.points)} คะแนน · +${player.score + player.bonus} เหรียญ`;
    announce(won ? `ชนะแล้ว คะแนนสะสม ${formatPoints(save.points)} เหรียญสะสม ${formatPoints(save.coins)}` : "พลังหมดแล้ว ลองใหม่อีกครั้ง");
    playFanfare(won);
    window.setTimeout(() => ui.restartBtn.focus(), 50);
  }

  function updateHud() {
    ui.score.textContent = formatPoints(save.coins);
    ui.hearts.textContent = [0,1,2].map(i => i < player.lives ? "♥" : "♡").join(" ");
    ui.distance.textContent = `${progress()}%`;
    ui.points.textContent = formatPoints(save.points);
    ui.attackBtn?.classList.toggle("is-ready", player.bomb > 0);
  }

  function addScore(amount, x, y, label = "") {
    player.points += amount;
    save.points += amount;
    bankCoins();
    writeSave();
    popups.push({ x, y, text: `${label}+${formatPoints(amount)}`, life: 1.1 });
  }

  function grabFlag(poleX) {
    const top = WORLD.ground - POLE_HEIGHT;
    const height = Math.max(0, Math.min(POLE_HEIGHT, WORLD.ground - (player.y + player.h / 2)));
    const ratio = height / POLE_HEIGHT;
    const points = ratio >= .86 ? 5000 : ratio >= .65 ? 2000 : ratio >= .45 ? 1000 : ratio >= .25 ? 500 : 100;
    player.y = Math.max(player.y, top - player.h / 2);
    player.x = poleX - player.w + 18;
    player.vx = 0; player.vy = 0; player.facing = 1; player.ride = null;
    player.flag = { phase: "slide", t: 0, poleX, flagY: Math.max(top + 8, player.y + player.h / 2 - 20) };
    addScore(points, poleX + 10, player.y - 6);
    if (player.lives > 0) addScore(player.lives * 500, poleX + 10, player.y + 34, "♥ ");
    const notes = points >= 5000 ? [523, 659, 784, 1047, 1319] : points >= 1000 ? [523, 659, 784, 1047] : [523, 659, 784];
    notes.forEach((note, i) => tone(note, .14, "square", .05, i * .08));
    announce(`ดึงธงได้ ${formatPoints(points)} คะแนน`);
    updateHud();
  }

  // Slide down the pole with the flag, then stroll to the gate.
  function updateFlag(dt) {
    const flag = player.flag;
    const floor = WORLD.ground - player.h;
    flag.t += dt;
    if (flag.phase === "slide") {
      player.grounded = false;
      player.vy = 120;
      player.y = Math.min(floor, player.y + 380 * dt);
      flag.flagY = Math.min(WORLD.ground - 64, flag.flagY + 380 * dt);
      if (player.y >= floor && flag.t > .6) { flag.phase = "walk"; flag.t = 0; }
      return;
    }
    player.grounded = true;
    player.vy = 0;
    player.y = floor;
    player.vx = 210;
    player.x += player.vx * dt;
    if (player.x > level.goalX - 110) {
      player.flag = null;
      if (levelIndex < levels.length - 1) nextLevel();
      else finish(true);
    }
  }

  function announce(message) {
    window.clearTimeout(announcementTimer);
    ui.announcer.textContent = "";
    announcementTimer = window.setTimeout(() => { ui.announcer.textContent = message; }, 60);
  }

  function ensureAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  }

  function tone(freq, duration = .09, type = "sine", gain = .08, delay = 0) {
    if (!soundOn) return;
    ensureAudio();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime + delay);
    amp.gain.setValueAtTime(gain, audio.currentTime + delay);
    amp.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start(audio.currentTime + delay);
    osc.stop(audio.currentTime + delay + duration);
  }

  function playFanfare(won) {
    const notes = won ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((note, i) => tone(note, .22, "triangle", .07, i * .13));
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70, life: .45 + Math.random() * .45, max: .9, color, size: 3 + Math.random() * 5 });
    }
  }

  function setBig(big) {
    // Resize around the feet so Pupa neither sinks into nor hovers above the floor.
    const size = big ? BIG : SMALL;
    player.x -= (size.w - player.w) / 2;
    player.y -= size.h - player.h;
    player.w = size.w;
    player.h = size.h;
    player.big = big;
  }

  function hurtPlayer() {
    if (player.hurt > 0 || player.star > 0) return;
    if (player.shield) {
      // The shield takes the hit and breaks.
      player.shield = false;
      player.hurt = 1.5;
      burst(player.x + player.w / 2, player.y + player.h / 2, "#7fd4ff", 22);
      tone(880, .08, "triangle", .06); tone(587, .1, "triangle", .06, .07); tone(392, .16, "triangle", .06, .15);
      announce("เกราะแตกแล้ว");
      return;
    }
    if (player.big) {
      // Being big absorbs one hit: shrink instead of losing a heart.
      setBig(false);
      player.hurt = HURT_TIME;
      player.vy = -520;
      player.vx = -player.facing * 220;
      burst(player.x + player.w / 2, player.y + player.h / 2, "#ff9d6b", 16);
      tone(520, .1, "square", .05); tone(390, .1, "square", .05, .09); tone(260, .16, "square", .05, .18);
      announce("ตัวหดกลับเท่าเดิมแล้ว");
      return;
    }
    player.lives--;
    player.hurt = HURT_TIME;
    player.vy = -700;
    player.vx = -player.facing * 280;
    burst(player.x + player.w / 2, player.y + player.h / 2, "#ff6e99", 16);
    tone(145, .28, "sawtooth", .06);
    updateHud();
    if (player.lives <= 0) finish(false);
  }

  function respawn() {
    player.x = checkpoint;
    player.y = 400;
    player.vx = 0;
    player.vy = 0;
    player.star = 0;
    player.ride = null;
    // A fall always costs a heart, even during the post-hit grace period.
    player.hurt = 0;
    if (player.big) setBig(false);
    // ...and neither the shield nor anything else softens it.
    const shield = player.shield;
    player.shield = false;
    hurtPlayer();
    player.shield = shield;
  }

  function damageBoss() {
    boss.hp--;
    boss.hurt = 1.1;
    addScore(boss.hp > 0 ? 1000 : 5000, boss.x + boss.w / 2, boss.y - 20);
    shake = .25;
    burst(boss.x + boss.w / 2, boss.y + 30, "#ffd166", 22);
    tone(180, .12, "square", .07); tone(360, .16, "triangle", .06, .07);
    if (boss.hp > 0) {
      // A hit knocks the queen out of her daze and back into the air.
      if (boss.kind === "queen" && (boss.mode === "rest" || boss.mode === "swoop")) boss.mode = "rise";
      return;
    }
    boss.alive = false;
    boss.fade = 1;
    hazards = [];
    shake = .6;
    for (let i = 0; i < 4; i++) burst(boss.x + 30 + i * 36, boss.y + 30 + (i % 2) * 60, i % 2 ? "#ff7b9c" : "#ffd166", 18);
    [392, 523, 659, 784, 1047].forEach((note, i) => tone(note, .2, "triangle", .07, i * .1));
    bannerText = "ชนะบอสแล้ว! · ประตูแสงจันทร์เปิดแล้ว";
    bannerTime = 3;
    announce(`${boss.name}พ่ายแพ้แล้ว ประตูแสงจันทร์เปิดแล้ว`);
  }

  function updateBoss(dt, previousBottom) {
    if (!boss) return;
    boss.fade = Math.max(0, boss.fade - dt * 1.4);
    if (!boss.alive) return;
    if (!boss.active) {
      if (player.x < boss.left + 40) return;
      boss.active = true;
      bannerText = `บอส · ${boss.name}`;
      bannerTime = 3;
      announce(`${boss.name}ปรากฏตัว เหยียบหัวมันให้ครบ ${boss.maxHp} ครั้ง`);
      [196, 185, 175, 147].forEach((note, i) => tone(note, .22, "sawtooth", .05, i * .14));
    }
    boss.hurt = Math.max(0, boss.hurt - dt);
    const rage = boss.maxHp - boss.hp;
    const floor = WORLD.ground - boss.h;
    const aim = player.x + player.w / 2 - (boss.x + boss.w / 2);
    if (boss.kind === "queen") updateQueen(dt, aim, rage);
    else if (boss.mode === "walk") {
      boss.facing = aim < 0 ? -1 : 1;
      if (Math.abs(aim) > 30) boss.x += boss.facing * (70 + rage * 14) * dt;
      boss.timer -= dt;
      if (boss.timer <= 0) { boss.mode = "windup"; boss.timer = .5; tone(110, .3, "sawtooth", .05); }
      // From half health on it also lobs thorn spores between leaps.
      boss.spit -= dt;
      if (rage >= 2 && boss.spit <= 0) {
        boss.spit = 1.5;
        hazards.push({ type: "spore", x: boss.x + boss.w / 2 - 16, y: boss.y + 30, w: 32, h: 32, vx: Math.max(-380, Math.min(380, aim * .95)), vy: -620, life: 4 });
        tone(300, .1, "square", .04);
      }
    } else if (boss.mode === "windup") {
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.mode = "jump";
        boss.vy = -940;
        boss.vx = Math.max(-430, Math.min(430, aim / .9));
        boss.y -= 1;
      }
    } else {
      boss.vy += 2100 * dt;
      boss.x += boss.vx * dt;
      boss.y += boss.vy * dt;
      if (boss.y >= floor) {
        boss.y = floor;
        boss.mode = "walk";
        boss.timer = Math.max(1.1, 2.3 - rage * .22);
        shake = .3;
        tone(70, .3, "sawtooth", .08);
        burst(boss.x + boss.w / 2, WORLD.ground, "#ff7b9c", 14);
        for (const side of [-1, 1]) {
          hazards.push({ type: "wave", x: boss.x + boss.w / 2 - 23 + side * 70, y: WORLD.ground - 34, w: 46, h: 34, vx: side * (290 + rage * 22), vy: 0, life: 2.4 });
        }
      }
    }
    boss.x = Math.max(boss.left, Math.min(boss.right - boss.w, boss.x));

    hazards = hazards.filter(h => {
      h.life -= dt;
      h.x += h.vx * dt;
      if (h.type !== "wave") {
        h.vy += (h.g ?? 1100) * dt;
        h.y += h.vy * dt;
        if (h.y + h.h >= WORLD.ground) { burst(h.x + 16, WORLD.ground - 6, h.type === "orb" ? "#cfe0ff" : "#c68cff", 8); return false; }
      }
      if (h.life <= 0 || h.x < boss.left - 60 || h.x > boss.right + 20) return false;
      if (rectsOverlap(player, { x: h.x + 6, y: h.y + 6, w: h.w - 12, h: h.h - 6 })) { hurtPlayer(); return h.type === "wave"; }
      return true;
    });

    const body = { x: boss.x + 16, y: boss.y + 8, w: boss.w - 32, h: boss.h - 8 };
    if (boss.hurt > 0 || !rectsOverlap(player, body)) return;
    if (player.star > 0) { damageBoss(); return; }
    if (player.vy > 120 && previousBottom <= boss.y + 44) {
      player.vy = -820;
      damageBoss();
    } else hurtPlayer();
  }

  function throwBomb() {
    if (player.bomb <= 0 || player.bombCooldown > 0) return;
    player.bombCooldown = .35;
    bombs.push({ x: player.x + player.w / 2 + player.facing * 24, y: player.y + player.h * .35, vx: player.facing * 520 + player.vx * .4, vy: -360, life: 1.8, spin: 0 });
    tone(300, .08, "square", .05);
  }

  function explode(x, y) {
    blasts.push({ x, y, life: .35 });
    burst(x, y, "#ff5f6e", 18);
    burst(x, y, "#ffd76a", 10);
    shake = Math.max(shake, .18);
    tone(90, .25, "sawtooth", .08); tone(55, .3, "square", .06, .03);
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x + enemy.w / 2 - x;
      const dy = enemy.y + enemy.h / 2 - y;
      if (dx * dx + dy * dy > 105 * 105) continue;
      enemy.alive = false;
      addScore(enemy.type === "walker" ? 200 : 300, enemy.x + enemy.w / 2, enemy.y - 10);
      burst(enemy.x + enemy.w / 2, enemy.y + 25, "#c68cff", 12);
    }
    if (boss?.active && boss.alive && boss.hurt <= 0) {
      const dx = Math.max(boss.x, Math.min(boss.x + boss.w, x)) - x;
      const dy = Math.max(boss.y, Math.min(boss.y + boss.h, y)) - y;
      if (dx * dx + dy * dy < 80 * 80) damageBoss();
    }
  }

  function updateBombs(dt) {
    player.bombCooldown = Math.max(0, player.bombCooldown - dt);
    bombs = bombs.filter(bomb => {
      const previousBottom = bomb.y + 12;
      bomb.life -= dt;
      bomb.vy += 1400 * dt;
      bomb.x += bomb.vx * dt;
      bomb.y += bomb.vy * dt;
      bomb.spin += dt * 12;
      let hit = bomb.life <= 0;
      for (const p of solids) {
        if (bomb.x > p.x && bomb.x < p.x + p.w && bomb.vy >= 0 && previousBottom <= p.y + 12 && bomb.y + 12 >= p.y) hit = true;
      }
      const box = { x: bomb.x - 12, y: bomb.y - 12, w: 24, h: 24 };
      for (const enemy of enemies) if (enemy.alive && rectsOverlap(box, enemy)) hit = true;
      if (boss?.active && boss.alive && rectsOverlap(box, boss)) hit = true;
      if (hit) { explode(bomb.x, bomb.y); return false; }
      return bomb.y < 820 && bomb.x > -60 && bomb.x < WORLD.width + 60;
    });
    blasts = blasts.filter(blast => (blast.life -= dt) > 0);
  }

  // Bat queen: hover and drop orbs -> wind up -> dive at Pupa -> sit dazed
  // on the ground (the safe moment to stomp her) -> climb back up.
  function updateQueen(dt, aim, rage) {
    const floor = WORLD.ground - boss.h;
    boss.t += dt;
    if (boss.mode === "hover") {
      boss.facing = aim < 0 ? -1 : 1;
      if (Math.abs(aim) > 24) boss.x += boss.facing * (150 + rage * 18) * dt;
      boss.y += (QUEEN_HOVER + Math.sin(boss.t * 3) * 14 - boss.y) * Math.min(1, dt * 4);
      boss.spit -= dt;
      if (boss.spit <= 0) {
        boss.spit = Math.max(.6, 1.15 - rage * .09);
        // From half health the orbs come three at a time, fanned out.
        for (const drift of rage >= 3 ? [-130, 0, 130] : [0]) {
          hazards.push({ type: "orb", x: boss.x + boss.w / 2 - 14, y: boss.y + boss.h - 14, w: 28, h: 28, vx: drift, vy: 110, g: 420, life: 5 });
        }
        tone(880, .06, "sine", .04);
      }
      boss.timer -= dt;
      if (boss.timer <= 0) { boss.mode = "windup"; boss.timer = .6; tone(140, .35, "sawtooth", .05); }
    } else if (boss.mode === "windup") {
      boss.y += (QUEEN_HOVER - 40 - boss.y) * Math.min(1, dt * 5);
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.mode = "swoop";
        boss.t = 0;
        boss.fromX = boss.x;
        boss.fromY = boss.y;
        boss.toX = Math.max(boss.left, Math.min(boss.right - boss.w, player.x + player.w / 2 - boss.w / 2));
        boss.facing = boss.toX < boss.x ? -1 : 1;
      }
    } else if (boss.mode === "swoop") {
      boss.t += dt * (.8 + rage * .05);
      const p = Math.min(1, boss.t / 1.05);
      boss.x = boss.fromX + (boss.toX - boss.fromX) * p;
      boss.y = boss.fromY + (floor - boss.fromY) * p * p;
      if (p >= 1) {
        boss.mode = "rest";
        boss.timer = Math.max(1.1, 1.9 - rage * .12);
        shake = .25;
        tone(80, .25, "sawtooth", .07);
        burst(boss.x + boss.w / 2, WORLD.ground, "#d9b8ff", 14);
      }
    } else if (boss.mode === "rest") {
      boss.y = floor;
      boss.timer -= dt;
      if (boss.timer <= 0) boss.mode = "rise";
    } else {
      boss.y += (QUEEN_HOVER - boss.y) * Math.min(1, dt * 3);
      if (Math.abs(boss.y - QUEEN_HOVER) < 10) {
        boss.mode = "hover";
        boss.timer = Math.max(1.5, 2.6 - rage * .16);
        boss.spit = .5;
      }
    }
  }

  function hitBlock(block) {
    if (block.used) { tone(120, .06, "square", .04); return; }
    block.used = true;
    block.bump = .18;
    const cx = block.x + block.w / 2;
    const roll = Math.random();
    let type = roll < .28 ? "cherry" : roll < .40 ? "heart" : roll < .52 ? "leaf" : roll < .64 ? "star" : roll < .76 ? "grow" : roll < .88 ? "bomb" : "shield";
    if (type === "heart" && player.lives >= 3) type = "cherry";
    if (type === "grow" && player.big) type = "cherry";
    if (type === "shield" && player.shield) type = "cherry";
    burst(cx, block.y, "#ffd76a", 8);
    tone(520, .07, "square", .05);
    if (type === "cherry") {
      // Like a coin: collected the moment it pops out.
      player.bonus++;
      addScore(200, cx, block.y - 58);
      items.push({ type, x: cx, y: block.y - 20, vx: 0, vy: -330, life: .65, popup: true });
      tone(880, .09, "sine", .06, .06);
      tone(1175, .12, "sine", .05, .12);
      updateHud();
      return;
    }
    // Toss the item toward a side that has ground under it, never into a pit
    // or off the edge of the level.
    const hasGround = (x) => platforms.some(p => p.y >= WORLD.ground && x > p.x + 24 && x < p.x + p.w - 24);
    const sides = [-1, 1].filter(side => hasGround(cx + side * 95));
    const side = sides.length ? sides[Math.floor(Math.random() * sides.length)] : 0;
    items.push({ type, x: cx, y: block.y - 22, vx: side * 90, vy: -520, life: 9, age: 0, resting: false });
    tone(392, .09, "triangle", .05, .06);
    tone(587, .14, "triangle", .05, .13);
  }

  function collectItem(item) {
    burst(item.x, item.y, itemGlow[item.type], 16);
    addScore(500, item.x, item.y - 30);
    if (item.type === "heart") {
      player.lives = Math.min(3, player.lives + 1);
      announce("ได้หัวใจเพิ่ม 1 ดวง");
      tone(659, .1, "sine", .06); tone(988, .16, "sine", .06, .09);
    } else if (item.type === "star") {
      player.star = STAR_TIME;
      announce("ได้ดาว อมตะชั่วคราว ชนศัตรูได้เลย");
      [659, 784, 988, 1319].forEach((note, i) => tone(note, .12, "square", .04, i * .07));
    } else if (item.type === "grow") {
      if (!player.big) setBig(true);
      announce("ได้เห็ดยักษ์ ตัวใหญ่ขึ้นและทนการโจมตีได้ 1 ครั้ง");
      [262, 330, 392, 523, 659].forEach((note, i) => tone(note, .1, "square", .05, i * .06));
    } else if (item.type === "shield") {
      player.shield = true;
      announce("ได้เกราะป้องกัน กันการโจมตีได้ 1 ครั้ง");
      tone(392, .1, "triangle", .06); tone(587, .1, "triangle", .06, .08); tone(880, .2, "triangle", .06, .16);
    } else if (item.type === "bomb") {
      player.bomb = BOMB_TIME;
      announce("ได้เชอร์รี่ระเบิด กดปุ่มโจมตีเพื่อขว้างได้ 10 วินาที");
      tone(196, .1, "square", .05); tone(294, .1, "square", .05, .08); tone(392, .16, "square", .05, .16);
    } else {
      player.boost = BOOST_TIME;
      announce("ได้ใบไม้วิเศษ กระโดดสูงขึ้นชั่วคราว");
      tone(523, .1, "triangle", .06); tone(784, .18, "triangle", .06, .09);
    }
    updateHud();
  }

  function updateItems(dt) {
    for (const block of blocks) block.bump = Math.max(0, block.bump - dt);
    items = items.filter(item => {
      item.life -= dt;
      if (item.life <= 0) return false;
      if (item.popup) { item.y += item.vy * dt; item.vy += 600 * dt; return true; }
      item.age += dt;
      if (!item.resting) {
        const previousBottom = item.y + 20;
        item.vy += 1500 * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        for (const p of platforms) {
          if (item.x > p.x && item.x < p.x + p.w && item.vy >= 0 && previousBottom <= p.y + 10 && item.y + 20 >= p.y) {
            item.y = p.y - 20;
            item.resting = true;
          }
        }
        if (item.y > 800) return false;
      }
      if (item.age > .3 && rectsOverlap(player, { x: item.x - 20, y: item.y - 20, w: 40, h: 40 })) {
        collectItem(item);
        return false;
      }
      return true;
    });
  }

  function update(dt) {
    if (state !== "playing") return;
    bannerTime = Math.max(0, bannerTime - dt);
    if (player.flag) { updateFlag(dt); if (state === "playing") finishFrame(dt); return; }
    player.hurt = Math.max(0, player.hurt - dt);
    player.star = Math.max(0, player.star - dt);
    player.boost = Math.max(0, player.boost - dt);
    player.bomb = Math.max(0, player.bomb - dt);
    for (const p of platforms) {
      p.bounce = Math.max(0, p.bounce - dt);
      if (p.kind === "crumble" && p.state !== "idle") {
        // shaking -> falling -> gone -> back in place
        if (p.state === "shaking") {
          p.timer -= dt;
          if (p.timer <= 0) { p.state = "falling"; p.vy = 0; tone(160, .12, "sawtooth", .04); }
        } else if (p.state === "falling") {
          p.vy += 1800 * dt;
          p.y += p.vy * dt;
          if (p.y > 840) { p.state = "gone"; p.timer = 2.5; }
        } else {
          p.timer -= dt;
          if (p.timer <= 0) { p.state = "idle"; p.y = p.oy; }
        }
      }
      if (!p.axis) continue;
      p.t += dt;
      const offset = p.range * (1 - Math.cos(p.t * p.speed * 2 / p.range)) / 2;
      const nx = p.axis === "x" ? p.ox + offset : p.ox;
      const ny = p.axis === "y" ? p.oy + offset : p.oy;
      p.dx = nx - p.x; p.dy = ny - p.y;
      p.x = nx; p.y = ny;
    }
    // Carry Pupa along with the moving platform she is standing on.
    if (player.ride?.axis) { player.x += player.ride.dx; player.y += player.ride.dy; }
    if (player.star > 0 && Math.random() < dt * 22) burst(player.x + player.w / 2, player.y + player.h / 2, "#ffe27a", 1);
    const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const target = move * 330;
    player.vx += (target - player.vx) * Math.min(1, dt * (player.grounded ? 12 : 5));
    if (move) player.facing = move;

    // Double jump: one extra jump in mid-air, refilled on landing.
    if (keys.jump && (player.grounded || player.airJumps > 0)) {
      const second = !player.grounded;
      if (second) {
        player.airJumps--;
        burst(player.x + player.w / 2, player.y + player.h, "#ffffff", 7);
      }
      player.vy = (player.boost > 0 ? -1080 : -900) * (second ? .92 : 1);
      player.grounded = false;
      tone((player.boost > 0 ? 480 : 360) * (second ? 1.35 : 1), .11, "triangle", .06);
    }
    keys.jump = false;
    if (keys.attack) throwBomb();
    keys.attack = false;

    const previousBottom = player.y + player.h;
    player.vy += WORLD.gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(WORLD.width - player.w, player.x));
    // The arena seals behind Pupa until the boss falls.
    if (boss?.active && boss.alive) player.x = Math.max(boss.left, Math.min(boss.right - player.w, player.x));
    player.grounded = false;
    player.ride = null;

    const previousTop = previousBottom - player.h;
    for (const block of blocks) {
      const under = player.x + player.w - 12 > block.x && player.x + 12 < block.x + block.w;
      const blockBottom = block.y + block.h;
      if (under && player.vy < 0 && previousTop >= blockBottom - 10 && player.y <= blockBottom) {
        player.y = blockBottom;
        player.vy = 60;
        hitBlock(block);
      }
    }

    for (const p of solids) {
      const nextBottom = player.y + player.h;
      const horizontal = player.x + player.w - 12 > p.x && player.x + 12 < p.x + p.w;
      if (p.state === "falling" || p.state === "gone") continue;
      if (horizontal && player.vy >= 0 && previousBottom <= p.y + 10 && nextBottom >= p.y) {
        player.y = p.y - player.h;
        if (p.kind === "spring") {
          // Bounce pads fling Pupa far higher than a normal jump.
          player.vy = -1280;
          player.airJumps = 1;
          p.bounce = .3;
          tone(330, .08, "triangle", .06); tone(660, .16, "triangle", .06, .06);
          continue;
        }
        player.vy = 0;
        player.grounded = true;
        player.airJumps = 1;
        player.ride = p;
        if (p.kind === "crumble" && p.state === "idle") { p.state = "shaking"; p.timer = .5; }
      }
    }

    if (player.y > 780) respawn();

    for (const cherry of cherries) {
      if (cherry.taken) continue;
      const box = { x: cherry.x - 18, y: cherry.y - 22, w: 36, h: 44 };
      if (rectsOverlap(player, box)) {
        cherry.taken = true;
        player.score++;
        addScore(100, cherry.x, cherry.y - 26);
        burst(cherry.x, cherry.y, "#ffd76a", 12);
        tone(740, .09, "sine", .06);
        tone(988, .1, "sine", .04, .05);
        updateHud();
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.type === "bat") {
        enemy.phase += dt;
        enemy.y = enemy.baseY + Math.sin(enemy.phase * 3) * 46;
      } else if (enemy.type === "hopper") {
        if (enemy.y >= enemy.baseY) {
          enemy.y = enemy.baseY;
          enemy.vy = 0;
          enemy.wait -= dt;
          if (enemy.wait <= 0) { enemy.vy = -780; enemy.y -= 1; enemy.wait = 1 + (enemy.id % 3) * .25; }
        } else {
          enemy.vy += 1900 * dt;
          enemy.y = Math.min(enemy.baseY, enemy.y + enemy.vy * dt);
        }
      }
      else if (enemy.type === "spitter") {
        const dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
        enemy.dir = dx < 0 ? -1 : 1;
        enemy.puff = Math.max(0, enemy.puff - dt);
        enemy.wait -= dt;
        // Swell up for a moment as a warning, then fire along the ground line.
        if (enemy.wait <= 0 && Math.abs(dx) < 760 && Math.abs(player.y - enemy.y) < 320) {
          enemy.wait = 2.4;
          enemy.puff = .35;
          shots.push({ x: enemy.x + enemy.w / 2 + enemy.dir * 26 - 11, y: enemy.y + 14, w: 22, h: 22, vx: enemy.dir * 310, life: 3 });
          tone(520, .07, "square", .035);
        }
      }
      // Hoppers only travel while they are in the air.
      if (enemy.type !== "hopper" || enemy.y < enemy.baseY) enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) { enemy.vx *= -1; enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x)); }
      if (!rectsOverlap(player, enemy)) continue;
      if (player.star > 0) {
        enemy.alive = false;
        addScore(200, enemy.x + enemy.w / 2, enemy.y - 10);
        burst(enemy.x + enemy.w / 2, enemy.y + 25, "#ffe27a", 18);
        tone(330, .07, "square", .05);
        tone(660, .1, "triangle", .05, .05);
        continue;
      }
      if (enemy.type !== "urchin" && player.vy > 180 && previousBottom <= enemy.y + (enemy.type === "walker" ? 22 : 34)) {
        enemy.alive = false;
        addScore(enemy.type === "walker" ? 200 : 300, enemy.x + enemy.w / 2, enemy.y - 10);
        player.vy = -560;
        burst(enemy.x + enemy.w / 2, enemy.y + 25, "#c68cff", 15);
        tone(210, .08, "square", .05);
        tone(420, .11, "triangle", .05, .05);
      } else hurtPlayer();
    }

    updateItems(dt);
    shots = shots.filter(shot => {
      shot.life -= dt;
      shot.x += shot.vx * dt;
      if (shot.life <= 0) return false;
      if (!rectsOverlap(player, shot)) return true;
      if (player.star > 0) burst(shot.x + 11, shot.y + 11, "#ffe27a", 8);
      else hurtPlayer();
      return false;
    });
    updateBombs(dt);
    updateBoss(dt, previousBottom);
    shake = Math.max(0, shake - dt);
    if (state !== "playing") return;

    if (player.x > level.checkpointX - 50 && checkpoint < level.checkpointX) {
      checkpoint = level.checkpointX + 50;
      announce("ถึงจุดพักกลางทางแล้ว");
      tone(523, .12, "sine", .05);
      tone(659, .15, "sine", .05, .08);
    }
    const poleX = level.goalX - POLE_OFFSET;
    if (!boss?.alive && player.x + player.w - 14 >= poleX && player.x < poleX + 30) grabFlag(poleX);
    else if (player.x > level.goalX - 110) {
      if (levelIndex < levels.length - 1) nextLevel();
      else finish(true);
    }

    finishFrame(dt);
  }

  function finishFrame(dt) {
    const maxCamera = Math.max(0, WORLD.width - viewWidth);
    let desired = Math.max(0, Math.min(maxCamera, player.x - viewWidth * .34));
    if (boss?.active && boss.alive) {
      const low = boss.left - 60;
      desired = Math.max(low, Math.min(Math.max(low, boss.right + 60 - viewWidth), desired));
    }
    cameraX += (desired - cameraX) * Math.min(1, dt * 4.5);

    particles = particles.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      return p.life > 0;
    });
    popups = popups.filter(p => { p.life -= dt; p.y -= 55 * dt; return p.life > 0; });
    updateHud();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawBackground(time) {
    const width = viewWidth;
    const parallax = cameraX * .08;
    if (art.background.complete && art.background.naturalWidth) {
      const img = art.background;
      const coverScale = Math.max(width / img.width, viewHeight / img.height);
      const drawW = img.width * coverScale;
      const drawH = img.height * coverScale;
      const travel = Math.max(0, drawW - width);
      const sourceX = travel ? -((parallax % (travel + width * .15)) / (travel + width * .15)) * travel : 0;
      ctx.drawImage(img, sourceX, (viewHeight - drawH) / 2, drawW, drawH);
      if (sourceX + drawW < width) ctx.drawImage(img, sourceX + drawW, (viewHeight - drawH) / 2, drawW, drawH);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 720);
      g.addColorStop(0, "#24114d"); g.addColorStop(.6, "#38215c"); g.addColorStop(1, "#0d1533");
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, viewHeight);
    }
    if (level.theme.tint) {
      // Recolour the shared backdrop for this level.
      ctx.save();
      ctx.globalCompositeOperation = "hue";
      ctx.fillStyle = level.theme.tint; ctx.fillRect(0, 0, width, viewHeight);
      ctx.restore();
      ctx.fillStyle = "rgba(4,10,34,.22)"; ctx.fillRect(0, 0, width, viewHeight);
    }
    const haze = ctx.createLinearGradient(0, 200, 0, 720);
    haze.addColorStop(0, "rgba(12,6,36,.04)"); haze.addColorStop(1, "rgba(6,7,26,.5)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, width, viewHeight);

    ctx.save();
    ctx.globalAlpha = .5;
    for (let i = 0; i < 28; i++) {
      const x = ((i * 197 - cameraX * .15) % (width + 200) + width + 200) % (width + 200) - 100;
      const y = 90 + ((i * 83) % 430) + Math.sin(time * .0015 + i) * 12;
      ctx.fillStyle = level.theme.sparks[i % 3 ? 0 : 1];
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSpring(p, x) {
    const press = p.bounce > 0 ? Math.sin((p.bounce / .3) * Math.PI) : 0;
    ctx.save();
    ctx.translate(x + p.w / 2, p.y + p.h);
    ctx.fillStyle = "#3a2d57"; roundedRect(-p.w / 2 + 8, -8, p.w - 16, 12, 5); ctx.fill();
    ctx.strokeStyle = "#cfd6ff"; ctx.lineWidth = 4; ctx.lineCap = "round";
    const coil = p.h - 4 - press * 8;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo((i % 2 ? 1 : -1) * 14, -6 - (coil * i) / 4);
    ctx.stroke();
    ctx.translate(0, -p.h + press * 8);
    ctx.shadowColor = "rgba(255,215,106,.7)"; ctx.shadowBlur = 14;
    const cap = ctx.createLinearGradient(0, -14, 0, 8);
    cap.addColorStop(0, "#ffe58f"); cap.addColorStop(1, "#ff7b9c");
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.ellipse(0, 0, p.w / 2, 13 - press * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath(); ctx.ellipse(-p.w / 5, -5, p.w / 7, 3, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8632a";
    ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(0, -7); ctx.lineTo(9, 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawCrumble(p, x) {
    if (p.state === "gone") return;
    const shaking = p.state === "shaking";
    const jitter = shaking ? Math.sin(performance.now() * .09) * 3 : 0;
    ctx.save();
    ctx.translate(x + jitter, p.y);
    if (p.state === "falling") ctx.globalAlpha = Math.max(0, 1 - (p.y - p.oy) / 220);
    ctx.shadowColor = "rgba(5,2,20,.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
    const slab = ctx.createLinearGradient(0, 0, 0, p.h);
    slab.addColorStop(0, "#e9d7a8"); slab.addColorStop(1, "#9a7b4f");
    ctx.fillStyle = slab; roundedRect(0, 0, p.w, p.h, 9); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = shaking ? "#ff9d6b" : "#fff3d0"; roundedRect(5, 2, p.w - 10, 5, 3); ctx.fill();
    // cracks: the hint that this one will not hold for long
    ctx.strokeStyle = "rgba(70,45,20,.75)"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const cx = (p.w * i) / 4;
      ctx.moveTo(cx - 6, 4); ctx.lineTo(cx + 3, p.h * .45); ctx.lineTo(cx - 4, p.h * .7); ctx.lineTo(cx + 5, p.h - 3);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPlatform(p) {
    const x = p.x - cameraX;
    if (x > viewWidth + 80 || x + p.w < -80) return;
    if (p.kind === "spring") { drawSpring(p, x); return; }
    if (p.kind === "crumble") { drawCrumble(p, x); return; }
    ctx.save();
    ctx.shadowColor = "rgba(5,2,20,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
    const grad = ctx.createLinearGradient(0, p.y, 0, p.y + Math.min(p.h, 110));
    const theme = level.theme;
    grad.addColorStop(0, theme.body[0]); grad.addColorStop(.16, theme.body[1]); grad.addColorStop(1, theme.body[2]);
    // Ground slabs run on to the bottom of the screen, however tall the view is.
    const height = p.y >= WORLD.ground ? Math.max(p.h, viewHeight - p.y + 20) : p.h;
    ctx.fillStyle = grad; roundedRect(x, p.y, p.w, height, 16); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = theme.top; roundedRect(x, p.y, p.w, 15, 12); ctx.fill();
    ctx.fillStyle = theme.shine; roundedRect(x + 8, p.y + 2, Math.max(0, p.w - 16), 5, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let i = 24; i < p.w; i += 64) { ctx.beginPath(); ctx.arc(x + i, p.y + 36 + (i % 3) * 14, 5, 0, Math.PI * 2); ctx.fill(); }
    if (p.axis) {
      // Glowing studs mark the platforms that move.
      ctx.shadowColor = theme.shine; ctx.shadowBlur = 12; ctx.fillStyle = "#fff6d8";
      for (const dx of [16, p.w - 16]) { ctx.beginPath(); ctx.arc(x + dx, p.y + 23, 4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // Pickups are drawn as shapes rather than emoji: phone browsers render
  // glowing emoji on a canvas as a blurry smear.
  function drawGlow(color, radius) {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    glow.addColorStop(0, color); glow.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalAlpha *= .5;
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBall(x, y, r, light, dark) {
    const fill = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    fill.addColorStop(0, light); fill.addColorStop(1, dark);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .42, r * .24, r * .15, -.6, 0, Math.PI * 2); ctx.fill();
  }

  const pickupArt = {
    // spin is an angle: the coin's width follows its cosine so it appears to turn.
    coin(spin = 0) {
      const turn = Math.cos(spin);
      ctx.save();
      ctx.scale(Math.max(.16, Math.abs(turn)), 1);
      ctx.fillStyle = "#b8741a"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
      const face = ctx.createLinearGradient(-12, -15, 12, 15);
      face.addColorStop(0, "#fff6b8"); face.addColorStop(.5, "#ffd24a"); face.addColorStop(1, "#f0a01e");
      ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, 0, 14.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#d98f1c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 3 : 7;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath(); ctx.ellipse(-6, -8, 4, 2.2, -.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    shield() {
      const fill = ctx.createLinearGradient(0, -20, 0, 20);
      fill.addColorStop(0, "#c9f0ff"); fill.addColorStop(1, "#3f8fe0");
      ctx.fillStyle = fill; ctx.strokeStyle = "#1f4f9a"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(0, -20); ctx.lineTo(17, -13); ctx.quadraticCurveTo(17, 10, 0, 21);
      ctx.quadraticCurveTo(-17, 10, -17, -13);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 3.2 : 8;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(Math.cos(angle) * radius, -1 + Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath(); ctx.ellipse(-8, -11, 4, 2, -.5, 0, Math.PI * 2); ctx.fill();
    },
    // A pair of cherries with a lit fuse: the bomb pickup.
    bomb() {
      ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-6, -12, 5, -18);
      ctx.moveTo(10, 6); ctx.quadraticCurveTo(10, -8, 5, -18); ctx.stroke();
      drawBall(-9, 9, 10.5, "#ff8fa8", "#d81f4f");
      drawBall(10, 11, 10.5, "#ff8fa8", "#c2143f");
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 ? 2.5 : 7;
        ctx.lineTo(5 + Math.cos(i * Math.PI / 4) * radius, -20 + Math.sin(i * Math.PI / 4) * radius);
      }
      ctx.closePath(); ctx.fill();
    },
    heart() {
      const fill = ctx.createLinearGradient(0, -16, 0, 18);
      fill.addColorStop(0, "#ff9db8"); fill.addColorStop(1, "#e52462");
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(0, 17);
      ctx.bezierCurveTo(-26, -1, -18, -22, 0, -8);
      ctx.bezierCurveTo(18, -22, 26, -1, 0, 17);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath(); ctx.ellipse(-8, -8, 5, 3, -.6, 0, Math.PI * 2); ctx.fill();
    },
    star() {
      const fill = ctx.createLinearGradient(0, -20, 0, 20);
      fill.addColorStop(0, "#fff6b0"); fill.addColorStop(1, "#ffb22e");
      ctx.fillStyle = fill; ctx.strokeStyle = "#c9741a"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 9 : 20;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6b3a12";
      ctx.beginPath(); ctx.ellipse(-4, 0, 1.8, 3.2, 0, 0, Math.PI * 2); ctx.ellipse(4, 0, 1.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    },
    leaf() {
      const fill = ctx.createLinearGradient(-14, 14, 14, -14);
      fill.addColorStop(0, "#2f9d57"); fill.addColorStop(1, "#b6f58a");
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(-15, 16);
      ctx.bezierCurveTo(-22, -8, 0, -22, 18, -18);
      ctx.bezierCurveTo(22, 2, 6, 20, -15, 16);
      ctx.fill();
      ctx.strokeStyle = "#1f7a45"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-17, 18); ctx.quadraticCurveTo(-2, 2, 13, -13);
      ctx.moveTo(-6, 7); ctx.lineTo(-9, -3); ctx.moveTo(1, 0); ctx.lineTo(-1, -10);
      ctx.moveTo(-5, 6); ctx.lineTo(5, 9); ctx.moveTo(3, -2); ctx.lineTo(12, 1);
      ctx.stroke();
    },
    grow() {
      ctx.fillStyle = "#fff1d6";
      ctx.beginPath(); ctx.roundRect(-10, -1, 20, 19, 7); ctx.fill();
      const cap = ctx.createLinearGradient(0, -20, 0, 4);
      cap.addColorStop(0, "#ff7b6b"); cap.addColorStop(1, "#d92b3c");
      ctx.fillStyle = cap;
      ctx.beginPath(); ctx.moveTo(-21, 3);
      ctx.bezierCurveTo(-23, -14, -10, -21, 0, -21);
      ctx.bezierCurveTo(10, -21, 23, -14, 21, 3);
      ctx.quadraticCurveTo(0, 8, -21, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, -11, 5.5, 0, Math.PI * 2); ctx.arc(-13, -4, 3.8, 0, Math.PI * 2); ctx.arc(13, -4, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a1d2a";
      ctx.beginPath(); ctx.ellipse(-4, 9, 1.7, 3, 0, 0, Math.PI * 2); ctx.ellipse(4, 9, 1.7, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  function drawCherry(cherry, time) {
    if (cherry.taken) return;
    const x = cherry.x - cameraX;
    if (x < -50 || x > viewWidth + 50) return;
    const y = cherry.y + Math.sin(time * .004 + cherry.phase) * 7;
    ctx.save();
    ctx.translate(x, y);
    drawGlow("#ffd24a", 30);
    pickupArt.coin(time * .005 + cherry.phase);
    ctx.restore();
  }

  function drawBlock(block, time) {
    const x = block.x - cameraX;
    if (x < -80 || x > viewWidth + 80) return;
    const lift = Math.sin((block.bump / .18) * Math.PI) * 14;
    ctx.save();
    ctx.translate(x, block.y - lift);
    ctx.shadowColor = block.used ? "rgba(5,2,20,.45)" : "rgba(255,215,106,.55)";
    ctx.shadowBlur = block.used ? 12 : 16 + Math.sin(time * .005 + block.id) * 6;
    const grad = ctx.createLinearGradient(0, 0, 0, block.h);
    if (block.used) { grad.addColorStop(0, "#5a4a78"); grad.addColorStop(1, "#33284f"); }
    else { grad.addColorStop(0, "#ffe58f"); grad.addColorStop(1, "#f2a23c"); }
    ctx.fillStyle = grad; roundedRect(0, 0, block.w, block.h, 12); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 3;
    ctx.strokeStyle = block.used ? "#241a3d" : "#b8632a";
    roundedRect(1.5, 1.5, block.w - 3, block.h - 3, 11); ctx.stroke();
    ctx.fillStyle = block.used ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.55)";
    roundedRect(7, 5, block.w - 14, 5, 3); ctx.fill();
    ctx.fillStyle = block.used ? "#241a3d" : "#b8632a";
    for (const [dx, dy] of [[8, 8], [block.w - 8, 8], [8, block.h - 8], [block.w - 8, block.h - 8]]) {
      ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (!block.used) {
      ctx.font = "900 36px 'Trebuchet MS', system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#b8632a"; ctx.fillText("?", block.w / 2 + 2, block.h / 2 + 4);
      ctx.fillStyle = "#fffaf0"; ctx.fillText("?", block.w / 2, block.h / 2 + 2);
    }
    ctx.restore();
  }

  function drawItem(item, time) {
    const x = item.x - cameraX;
    if (x < -60 || x > viewWidth + 60) return;
    ctx.save();
    if (item.popup) {
      ctx.globalAlpha = Math.min(1, item.life / .3);
      ctx.translate(x, item.y);
      ctx.save();
      ctx.translate(-14, 0); ctx.scale(.85, .85);
      drawGlow("#ffd76a", 28);
      pickupArt.coin();
      ctx.restore();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "900 24px 'Trebuchet MS', system-ui, sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(48,16,45,.8)"; ctx.strokeText("+1", 24, 0);
      ctx.fillStyle = "#ffe58f"; ctx.fillText("+1", 24, 0);
    } else {
      if (item.life < 2 && Math.floor(item.life * 10) % 2) ctx.globalAlpha = .3;
      ctx.translate(x, item.y + (item.resting ? Math.sin(time * .006) * 4 : 0));
      drawGlow(itemGlow[item.type], 34);
      pickupArt[item.type]();
    }
    ctx.restore();
  }

  function drawPowerBars() {
    const bars = [];
    if (player.star > 0) bars.push([player.star / STAR_TIME, "#ffe27a"]);
    if (player.boost > 0) bars.push([player.boost / BOOST_TIME, "#89f0c0"]);
    if (player.bomb > 0) bars.push([player.bomb / BOMB_TIME, "#ff5f6e"]);
    const x = player.x - cameraX + player.w / 2 - 32;
    bars.forEach(([amount, color], i) => {
      const y = player.y - 44 - i * 11;
      ctx.fillStyle = "rgba(13,8,36,.6)"; roundedRect(x, y, 64, 7, 4); ctx.fill();
      ctx.fillStyle = color; roundedRect(x, y, Math.max(7, 64 * amount), 7, 4); ctx.fill();
    });
  }

  function drawBat(enemy, x, time) {
    const flap = Math.sin(time * .022 + enemy.id);
    ctx.save();
    ctx.translate(x + enemy.w / 2, enemy.y + enemy.h / 2);
    ctx.scale(enemy.vx > 0 ? 1 : -1, 1);
    ctx.shadowColor = "#7ad9ff"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#2b1d5c";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 8, -4);
      ctx.quadraticCurveTo(side * 30, -26 - flap * 16, side * 52, -6 - flap * 20);
      ctx.quadraticCurveTo(side * 42, 2 - flap * 6, side * 37, 13 - flap * 8);
      ctx.quadraticCurveTo(side * 29, 2, side * 23, 13);
      ctx.quadraticCurveTo(side * 16, 2, side * 8, 11);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(side * 5, -13); ctx.lineTo(side * 16, -30); ctx.lineTo(side * 15, -9);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowColor = "transparent";
    const body = ctx.createRadialGradient(-4, -6, 2, 0, 2, 22);
    body.addColorStop(0, "#6a4fc0"); body.addColorStop(1, "#33226e");
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 2, 17, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "#9ff3ff"; ctx.shadowBlur = 10;
    ctx.fillStyle = "#9ff3ff";
    ctx.beginPath(); ctx.ellipse(-7, -2, 4.5, 5.5, .25, 0, Math.PI * 2); ctx.ellipse(7, -2, 4.5, 5.5, -.25, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#14093a";
    ctx.beginPath(); ctx.arc(-6, -1, 2, 0, Math.PI * 2); ctx.arc(8, -1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-3.5, 15); ctx.lineTo(-1, 8); ctx.moveTo(1, 8); ctx.lineTo(3.5, 15); ctx.lineTo(6, 8); ctx.fill();
    ctx.restore();
  }

  function drawHopper(enemy, x) {
    const grounded = enemy.y >= enemy.baseY;
    // Crouch just before a leap, stretch on the way up, flatten on the way down.
    const stretch = grounded ? (enemy.wait < .25 ? .8 : 1) : 1 + Math.max(-.16, Math.min(.24, -enemy.vy / 2600));
    ctx.save();
    ctx.translate(x + enemy.w / 2, enemy.y + enemy.h);
    ctx.scale((enemy.vx > 0 ? 1 : -1) / Math.sqrt(stretch), stretch);
    ctx.shadowColor = "rgba(120,255,225,.55)"; ctx.shadowBlur = 16;
    const body = ctx.createLinearGradient(0, -54, 0, 0);
    body.addColorStop(0, "#a6ffe9"); body.addColorStop(.55, "#39c9b4"); body.addColorStop(1, "#167f86");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-31, 0);
    ctx.bezierCurveTo(-38, -30, -21, -54, 0, -54);
    ctx.bezierCurveTo(21, -54, 38, -30, 31, 0);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#1d6f4f";
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.quadraticCurveTo(-4, -70, 12, -72); ctx.quadraticCurveTo(10, -58, 0, -52); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.ellipse(-13, -40, 8, 4.5, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0c2a3a";
    ctx.beginPath(); ctx.ellipse(-2, -24, 5, 7, 0, 0, Math.PI * 2); ctx.ellipse(16, -24, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-.5, -27, 2, 0, Math.PI * 2); ctx.arc(17.5, -27, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0c2a3a"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-9, -36); ctx.lineTo(1, -32); ctx.moveTo(23, -36); ctx.lineTo(13, -32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -11); ctx.quadraticCurveTo(7, -15, 12, -11); ctx.stroke();
    ctx.restore();
  }

  function drawUrchin(enemy, x, time) {
    const step = Math.sin(time * .012 + enemy.id);
    ctx.save();
    ctx.translate(x + enemy.w / 2, enemy.y + enemy.h / 2 + 2);
    ctx.scale(enemy.vx > 0 ? 1 : -1, 1);
    // feet
    ctx.fillStyle = "#1b2350";
    ctx.beginPath(); ctx.ellipse(-12, 24 + step * 2, 9, 5, 0, 0, Math.PI * 2); ctx.ellipse(12, 24 - step * 2, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    // spikes all round: the warning that this one cannot be stomped
    ctx.shadowColor = "rgba(160,200,255,.7)"; ctx.shadowBlur = 12;
    const spike = ctx.createLinearGradient(0, -38, 0, 20);
    spike.addColorStop(0, "#f2f8ff"); spike.addColorStop(1, "#7fa8ff");
    ctx.fillStyle = spike;
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const angle = Math.PI + (i / 21) * Math.PI;
      const radius = i % 2 ? 24 : 38 + Math.sin(time * .01 + i) * 2;
      ctx.lineTo(Math.cos(angle) * radius, 4 + Math.sin(angle) * radius);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent";
    const body = ctx.createRadialGradient(-6, -4, 3, 0, 4, 28);
    body.addColorStop(0, "#5a74d6"); body.addColorStop(1, "#27357f");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 6, 27, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(6, 3, 6, 7, 0, 0, Math.PI * 2); ctx.ellipse(19, 4, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#101642";
    ctx.beginPath(); ctx.arc(8, 4, 3, 0, Math.PI * 2); ctx.arc(20, 5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#101642"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(11, -2); ctx.moveTo(25, -3); ctx.lineTo(16, -1); ctx.stroke();
    ctx.restore();
  }

  function drawSpitter(enemy, x, time) {
    const swell = 1 + (enemy.puff > 0 ? Math.sin((enemy.puff / .35) * Math.PI) * .22 : Math.sin(time * .005 + enemy.id) * .03);
    // Tense up shortly before the next shot.
    const charging = enemy.wait < .45;
    ctx.save();
    ctx.translate(x + enemy.w / 2, enemy.y + enemy.h);
    ctx.scale(enemy.dir, 1);
    // stem and leaves
    ctx.strokeStyle = "#2f8f6a"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -18, 0, -34); ctx.stroke();
    ctx.fillStyle = "#3fb07f";
    ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-30, -16, -32, 0); ctx.quadraticCurveTo(-16, 4, -2, -6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, -6); ctx.quadraticCurveTo(26, -18, 30, -2); ctx.quadraticCurveTo(14, 4, 2, -6); ctx.fill();
    // head
    ctx.translate(0, -44);
    ctx.scale(swell, swell);
    ctx.shadowColor = charging ? "rgba(255,255,255,.9)" : "rgba(150,190,255,.6)"; ctx.shadowBlur = charging ? 20 : 12;
    ctx.fillStyle = "#cfe0ff";
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + .3;
      ctx.beginPath(); ctx.ellipse(Math.cos(angle) * 22, Math.sin(angle) * 22, 12, 8, angle, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowColor = "transparent";
    const head = ctx.createRadialGradient(-6, -6, 3, 0, 0, 24);
    head.addColorStop(0, "#9db6ff"); head.addColorStop(1, "#4a5fc4");
    ctx.fillStyle = head; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#141a4a";
    ctx.beginPath(); ctx.ellipse(13, 3, charging ? 9 : 6, charging ? 10 : 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-2, -8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#141a4a";
    ctx.beginPath(); ctx.arc(0, -8, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#141a4a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -16); ctx.lineTo(4, -13); ctx.stroke();
    ctx.restore();
  }

  function drawShots(time) {
    for (const shot of shots) {
      ctx.save();
      ctx.translate(shot.x + shot.w / 2 - cameraX, shot.y + shot.h / 2);
      drawGlow("#bcd4ff", 24);
      ctx.rotate(time * .012 * (shot.vx > 0 ? 1 : -1));
      ctx.fillStyle = "#eef5ff"; ctx.strokeStyle = "#5b7bff"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const radius = i % 2 ? 6 : 13;
        ctx.lineTo(Math.cos(i * Math.PI / 6) * radius, Math.sin(i * Math.PI / 6) * radius);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemy(enemy, time) {
    if (!enemy.alive) return;
    const x = enemy.x - cameraX;
    if (x < -100 || x > viewWidth + 100) return;
    if (enemy.type === "bat") { drawBat(enemy, x, time); return; }
    if (enemy.type === "hopper") { drawHopper(enemy, x); return; }
    if (enemy.type === "urchin") { drawUrchin(enemy, x, time); return; }
    if (enemy.type === "spitter") { drawSpitter(enemy, x, time); return; }
    const bob = Math.sin(time * .008 + enemy.phase) * 2;
    ctx.save();
    ctx.translate(x + enemy.w / 2, enemy.y + enemy.h / 2 + bob);
    ctx.scale(enemy.vx > 0 ? -1 : 1, 1);
    if (art.enemy.complete && art.enemy.naturalWidth) ctx.drawImage(art.enemy, -46, -48, 92, 92);
    else {
      ctx.fillStyle = "#8d4ec4"; ctx.beginPath(); ctx.arc(0, 2, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffc84e"; ctx.fillRect(-14, -4, 7, 7); ctx.fillRect(8, -4, 7, 7);
    }
    ctx.restore();
  }

  function drawPlayer(time) {
    const x = player.x - cameraX;
    const speed = Math.abs(player.vx);
    const model = window.Pupa3D;
    if (model?.ready && model.render({ time, facing: player.facing, speed, vy: player.vy, grounded: player.grounded })) {
      // The model's feet sit 1 unit below the camera centre; line them up with
      // the bottom of the hitbox.
      const size = 164 * player.h / SMALL.h;
      const feet = size * (model.viewHalf + 1) / (model.viewHalf * 2);
      ctx.save();
      if (player.hurt > 0 && Math.floor(player.hurt * 12) % 2) ctx.globalAlpha = .35;
      ctx.shadowColor = player.star > 0 ? "#ffe27a" : player.boost > 0 ? "rgba(137,240,192,.8)" : "rgba(255,92,150,.35)";
      ctx.shadowBlur = player.star > 0 ? 34 + Math.sin(time * .02) * 10 : 20;
      ctx.drawImage(model.canvas, x + player.w / 2 - size / 2, player.y + player.h - feet, size, size);
      ctx.restore();
      return;
    }
    const isRunning = player.grounded && speed > 45;
    const frameRate = 7 + Math.min(5, speed / 70);
    const cycleFrame = Math.floor((time / 1000) * frameRate) % (art.runFrames.length * 2);
    const oppositeStride = cycleFrame >= art.runFrames.length;
    const runFrame = art.runFrames[cycleFrame % art.runFrames.length];
    const sprite = isRunning && runFrame.complete && runFrame.naturalWidth ? runFrame : art.hero;
    const bob = isRunning ? 0 : (player.grounded ? Math.sin(time * .018) * Math.min(2, speed / 120) : 0);
    const squash = isRunning ? 1 : (player.grounded ? 1 + Math.sin(time * .018) * Math.min(.025, speed / 12000) : .94);
    ctx.save();
    if (player.hurt > 0 && Math.floor(player.hurt * 12) % 2) ctx.globalAlpha = .35;
    ctx.translate(x + player.w / 2, player.y + player.h / 2 + bob);
    ctx.scale(player.facing * player.h / SMALL.h, player.h / SMALL.h);
    ctx.scale(1 / squash, squash);
    ctx.shadowColor = "rgba(255,92,150,.35)"; ctx.shadowBlur = 20;
    if (sprite.complete && sprite.naturalWidth) {
      if (isRunning && oppositeStride) {
        // Mirror only the lower body for the second half of the run cycle. The
        // head and torso keep facing forward while the leading/trailing legs
        // visibly exchange sides.
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -52, -62, 104, 124);
        ctx.restore();

        const upperBodyCut = Math.floor(sprite.naturalHeight * .66);
        const upperBodyHeight = 124 * upperBodyCut / sprite.naturalHeight;
        ctx.drawImage(sprite, 0, 0, sprite.naturalWidth, upperBodyCut, -52, -62, 104, upperBodyHeight);
      } else {
        ctx.drawImage(sprite, -52, -62, 104, 124);
      }
    }
    else {
      ctx.fillStyle = "#ff78a8"; ctx.beginPath(); ctx.ellipse(0, 0, 31, 41, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#17102f"; ctx.beginPath(); ctx.arc(-10, -8, 4, 0, Math.PI * 2); ctx.arc(10, -8, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(time) {
    if (!boss || (!boss.alive && boss.fade <= 0)) return;
    const x = boss.x - cameraX;
    if (x < -300 || x > viewWidth + 300) return;
    if (boss.kind === "queen") { drawQueen(x, time); return; }
    const airborne = boss.mode === "jump";
    const squash = boss.mode === "windup" ? .78 : airborne ? 1.1 : 1 + Math.sin(time * .006) * .025;
    ctx.save();
    ctx.translate(x + boss.w / 2, boss.y + boss.h);
    if (!boss.alive) { ctx.globalAlpha = boss.fade; ctx.rotate((1 - boss.fade) * .5); ctx.scale(boss.fade, boss.fade); }
    else if (boss.hurt > 0 && Math.floor(boss.hurt * 14) % 2) ctx.globalAlpha = .35;
    ctx.scale(boss.facing > 0 ? -1 : 1, 1);
    ctx.scale(1 / Math.sqrt(squash), squash);
    const size = 236;
    ctx.shadowColor = "rgba(255,60,110,.7)"; ctx.shadowBlur = 30;
    if (art.enemy.complete && art.enemy.naturalWidth) ctx.drawImage(art.enemy, -size / 2, -size + 26, size, size);
    else { ctx.fillStyle = "#8d4ec4"; ctx.beginPath(); ctx.arc(0, -80, 80, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowColor = "transparent";
    // Crown
    const crown = ctx.createLinearGradient(0, -size + 4, 0, -size + 52);
    crown.addColorStop(0, "#fff3a6"); crown.addColorStop(1, "#f2a23c");
    ctx.fillStyle = crown; ctx.strokeStyle = "#a85a14"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-38, -size + 54); ctx.lineTo(-44, -size + 14); ctx.lineTo(-22, -size + 34); ctx.lineTo(0, -size + 2);
    ctx.lineTo(22, -size + 34); ctx.lineTo(44, -size + 14); ctx.lineTo(38, -size + 54);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff4f7d";
    ctx.beginPath(); ctx.arc(0, -size + 38, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawQueen(x, time) {
    const dazed = boss.mode === "rest";
    const diving = boss.mode === "swoop";
    const flap = dazed ? -.9 : diving ? .5 : Math.sin(time * (boss.mode === "windup" ? .04 : .018));
    ctx.save();
    ctx.translate(x + boss.w / 2, boss.y + boss.h / 2);
    if (!boss.alive) { ctx.globalAlpha = boss.fade; ctx.rotate((1 - boss.fade) * .6); ctx.scale(boss.fade, boss.fade); }
    else if (boss.hurt > 0 && Math.floor(boss.hurt * 14) % 2) ctx.globalAlpha = .35;
    ctx.scale(boss.facing > 0 ? 1 : -1, 1);
    if (diving) ctx.rotate(.25);
    ctx.scale(2.7, 2.7);
    ctx.shadowColor = boss.mode === "windup" ? "#ff5f96" : "#b88cff"; ctx.shadowBlur = 22;
    // wings
    ctx.fillStyle = "#2a1658";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 8, -4);
      ctx.quadraticCurveTo(side * 30, -26 - flap * 16, side * 54, -6 - flap * 20);
      ctx.quadraticCurveTo(side * 44, 2 - flap * 6, side * 39, 14 - flap * 8);
      ctx.quadraticCurveTo(side * 30, 2, side * 24, 14);
      ctx.quadraticCurveTo(side * 16, 2, side * 8, 11);
      ctx.closePath(); ctx.fill();
      // ears
      ctx.beginPath(); ctx.moveTo(side * 5, -13); ctx.lineTo(side * 17, -31); ctx.lineTo(side * 15, -9); ctx.closePath(); ctx.fill();
    }
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(210,180,255,.45)"; ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * 9, -2); ctx.lineTo(side * 39, 13 - flap * 8);
      ctx.moveTo(side * 9, -2); ctx.lineTo(side * 24, 13); ctx.stroke();
    }
    const body = ctx.createRadialGradient(-4, -6, 2, 0, 2, 22);
    body.addColorStop(0, "#8a5fe0"); body.addColorStop(1, "#3a1f7a");
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 2, 17, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9dcff"; ctx.beginPath(); ctx.ellipse(0, 10, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    // tiara
    ctx.fillStyle = "#ffd76a"; ctx.strokeStyle = "#a85a14"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-11, -25); ctx.lineTo(-5, -19); ctx.lineTo(0, -29); ctx.lineTo(5, -19); ctx.lineTo(11, -25); ctx.lineTo(10, -15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8ff5ff"; ctx.beginPath(); ctx.arc(0, -20, 2, 0, Math.PI * 2); ctx.fill();
    // face
    if (dazed) {
      ctx.strokeStyle = "#14093a"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      for (const ex of [-7, 7]) {
        ctx.beginPath(); ctx.moveTo(ex - 3, -5); ctx.lineTo(ex + 3, 1); ctx.moveTo(ex + 3, -5); ctx.lineTo(ex - 3, 1); ctx.stroke();
      }
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < 3; i++) {
        const angle = time * .006 + i * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(angle) * 16, -34 + Math.sin(angle) * 4, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.shadowColor = "#ff9dd0"; ctx.shadowBlur = 8;
      ctx.fillStyle = boss.mode === "windup" || diving ? "#ff5f96" : "#ffd0f0";
      ctx.beginPath(); ctx.ellipse(-7, -2, 4.5, 5.5, .3, 0, Math.PI * 2); ctx.ellipse(7, -2, 4.5, 5.5, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#14093a";
      ctx.beginPath(); ctx.arc(-6, -1, 2, 0, Math.PI * 2); ctx.arc(8, -1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#14093a"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(-3, -6); ctx.moveTo(12, -9); ctx.lineTo(3, -6); ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-3.5, 15); ctx.lineTo(-1, 8); ctx.moveTo(1, 8); ctx.lineTo(3.5, 15); ctx.lineTo(6, 8); ctx.fill();
    ctx.restore();
  }

  function drawHazard(h, time) {
    const x = h.x - cameraX;
    ctx.save();
    ctx.translate(x + h.w / 2, h.y + h.h);
    if (h.type === "wave") {
      ctx.globalAlpha = Math.min(1, h.life / .4);
      ctx.scale(h.vx > 0 ? 1 : -1, 1);
      const fill = ctx.createLinearGradient(0, -h.h - 8, 0, 0);
      fill.addColorStop(0, "#ffd166"); fill.addColorStop(1, "#ff3c6e");
      ctx.fillStyle = fill;
      const wobble = Math.sin(time * .03) * 4;
      ctx.beginPath(); ctx.moveTo(-26, 0);
      ctx.lineTo(-16, -22 - wobble); ctx.lineTo(-8, -6); ctx.lineTo(4, -40 + wobble); ctx.lineTo(10, -8);
      ctx.lineTo(22, -26 - wobble); ctx.lineTo(28, 0);
      ctx.closePath(); ctx.fill();
    } else if (h.type === "orb") {
      ctx.translate(0, -h.h / 2);
      drawGlow("#cfe0ff", 34);
      drawBall(0, 0, 13, "#ffffff", "#8fb4ff");
      ctx.fillStyle = "rgba(91,123,255,.5)";
      ctx.beginPath(); ctx.arc(4, 3, 4, 0, Math.PI * 2); ctx.arc(-5, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.translate(0, -h.h / 2);
      ctx.rotate(time * .01);
      drawGlow("#c68cff", 30);
      ctx.fillStyle = "#7b3fc4";
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const radius = i % 2 ? 10 : 18;
        ctx.lineTo(Math.cos(i * Math.PI / 8) * radius, Math.sin(i * Math.PI / 8) * radius);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e7c6ff"; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBossBar() {
    if (!boss?.active || !boss.alive || state !== "playing") return;
    const width = Math.min(420, viewWidth - 80);
    const x = (viewWidth - width) / 2;
    const y = 156;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "800 20px 'Trebuchet MS', 'Noto Sans Thai', system-ui, sans-serif";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(13,8,36,.85)"; ctx.strokeText(boss.name, viewWidth / 2, y - 8);
    ctx.fillStyle = "#ffe5a5"; ctx.fillText(boss.name, viewWidth / 2, y - 8);
    ctx.fillStyle = "rgba(13,8,36,.75)"; roundedRect(x - 3, y - 3, width + 6, 20, 10); ctx.fill();
    const gap = 4;
    const cell = (width - gap * (boss.maxHp - 1)) / boss.maxHp;
    for (let i = 0; i < boss.maxHp; i++) {
      ctx.fillStyle = i < boss.hp ? "#ff4f7d" : "rgba(255,255,255,.12)";
      roundedRect(x + i * (cell + gap), y, cell, 14, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawFlagpole(time) {
    const x = level.goalX - POLE_OFFSET - cameraX;
    if (x < -120 || x > viewWidth + 120) return;
    const top = WORLD.ground - POLE_HEIGHT;
    const flagY = player.flag ? player.flag.flagY : top + 8;
    ctx.save();
    ctx.translate(x, 0);
    if (boss?.alive) ctx.globalAlpha = .22;
    ctx.fillStyle = "#5a4a78"; roundedRect(-22, WORLD.ground - 26, 44, 26, 6); ctx.fill();
    ctx.fillStyle = "#3a2d57"; roundedRect(-22, WORLD.ground - 8, 44, 8, 3); ctx.fill();
    const pole = ctx.createLinearGradient(-5, 0, 5, 0);
    pole.addColorStop(0, "#fff3c4"); pole.addColorStop(.5, "#ffd76a"); pole.addColorStop(1, "#c98a2a");
    ctx.fillStyle = pole; roundedRect(-5, top, 10, POLE_HEIGHT - 20, 5); ctx.fill();
    ctx.translate(0, top);
    drawGlow("#ffe27a", 28);
    drawBall(0, -4, 12, "#fff6c9", "#f2a23c");
    ctx.translate(0, flagY - top);
    const wave = Math.sin(time * .006) * 5;
    // The flag flies on the far side of the pole so Pupa never hides it.
    const cloth = ctx.createLinearGradient(0, 0, 74, 0);
    cloth.addColorStop(0, "#fff6d8"); cloth.addColorStop(1, "#ff8fb4");
    ctx.fillStyle = cloth; ctx.strokeStyle = "rgba(60,16,50,.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(38, 6 + wave, 76, 26);
    ctx.quadraticCurveTo(38, 42 - wave, 5, 52);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(30, 26); ctx.scale(.62, .62); pickupArt.star(); ctx.restore();
    ctx.restore();
  }

  function drawBombs(time) {
    for (const bomb of bombs) {
      ctx.save();
      ctx.translate(bomb.x - cameraX, bomb.y);
      ctx.rotate(bomb.spin);
      drawBall(0, 0, 12, "#ff8fa8", "#c2143f");
      ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(4, -18, 9, -19); ctx.stroke();
      ctx.fillStyle = Math.floor(time / 60) % 2 ? "#fff6b8" : "#ffb22e";
      ctx.beginPath(); ctx.arc(10, -20, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const blast of blasts) {
      const grow = 1 - blast.life / .35;
      ctx.save();
      ctx.translate(blast.x - cameraX, blast.y);
      ctx.globalAlpha = Math.max(0, 1 - grow);
      const fire = ctx.createRadialGradient(0, 0, 4, 0, 0, 30 + grow * 80);
      fire.addColorStop(0, "#fffbe0"); fire.addColorStop(.4, "#ffd24a"); fire.addColorStop(.75, "#ff5f6e"); fire.addColorStop(1, "transparent");
      ctx.fillStyle = fire;
      ctx.beginPath(); ctx.arc(0, 0, 30 + grow * 80, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawShield(time) {
    if (!player.shield) return;
    const pulse = Math.sin(time * .006);
    ctx.save();
    ctx.translate(player.x - cameraX + player.w / 2, player.y + player.h / 2);
    const radius = player.h * .78 + pulse * 3;
    const bubble = ctx.createRadialGradient(-radius * .3, -radius * .35, radius * .1, 0, 0, radius);
    bubble.addColorStop(0, "rgba(255,255,255,.28)"); bubble.addColorStop(.7, "rgba(127,212,255,.1)"); bubble.addColorStop(1, "rgba(127,212,255,.42)");
    ctx.fillStyle = bubble;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(190,235,255,${.75 + pulse * .2})`; ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, radius - 8, -2.4, -1.8); ctx.stroke();
    ctx.restore();
  }

  function drawPopups() {
    if (!popups.length) return;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "900 26px 'Trebuchet MS', 'Noto Sans Thai', system-ui, sans-serif";
    ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(30,10,45,.85)";
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life / .35);
      ctx.strokeText(p.text, p.x - cameraX, p.y);
      ctx.fillStyle = "#ffe58f"; ctx.fillText(p.text, p.x - cameraX, p.y);
    }
    ctx.restore();
  }

  function drawGoal(time) {
    const x = level.goalX - cameraX;
    if (x < -200 || x > viewWidth + 200) return;
    ctx.save(); ctx.translate(x, 485);
    if (boss?.alive) ctx.globalAlpha = .22; // sealed until the boss is beaten
    const glow = .78 + Math.sin(time * .004) * .18;
    ctx.shadowColor = "#ffe797"; ctx.shadowBlur = 35;
    ctx.strokeStyle = `rgba(255,231,151,${glow})`; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(0, 42, 62, Math.PI, 0); ctx.lineTo(62, 120); ctx.moveTo(-62, 120); ctx.lineTo(-62, 42); ctx.stroke();
    const g = ctx.createLinearGradient(0, 0, 0, 125); g.addColorStop(0, "rgba(255,244,189,.75)"); g.addColorStop(1, "rgba(255,104,166,.08)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 42, 52, Math.PI, 0); ctx.lineTo(52, 120); ctx.lineTo(-52, 120); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawCheckpoint(time) {
    const x = level.checkpointX - cameraX;
    if (x < -100 || x > viewWidth + 100) return;
    ctx.save(); ctx.translate(x, 490);
    ctx.strokeStyle = "#f8d37a"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = checkpoint > 90 ? "#8df0be" : "#ff7ead";
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.quadraticCurveTo(58, 24 + Math.sin(time*.005)*6, 10, 52); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawBanner() {
    if (bannerTime <= 0 || state !== "playing") return;
    const [title, subtitle] = bannerText.split(" · ");
    ctx.save();
    ctx.globalAlpha = Math.min(1, bannerTime / .6, (3 - bannerTime) / .35);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(8,4,28,.9)"; ctx.shadowBlur = 18;
    ctx.font = "900 64px 'Trebuchet MS', 'Noto Sans Thai', system-ui, sans-serif";
    ctx.fillStyle = "#fff6d8"; ctx.fillText(title, viewWidth / 2, 250);
    ctx.font = "700 30px 'Trebuchet MS', 'Noto Sans Thai', system-ui, sans-serif";
    ctx.fillStyle = level.theme.shine; ctx.fillText(subtitle, viewWidth / 2, 308);
    ctx.restore();
  }

  function render(time) {
    ctx.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    if (shake > 0 && state === "playing") ctx.translate((Math.random() - .5) * 14 * Math.min(1, shake * 3), (Math.random() - .5) * 10 * Math.min(1, shake * 3));
    drawBackground(time);
    platforms.forEach(drawPlatform);
    drawCheckpoint(time);
    drawFlagpole(time);
    drawGoal(time);
    blocks.forEach(b => drawBlock(b, time));
    cherries.forEach(c => drawCherry(c, time));
    items.forEach(item => drawItem(item, time));
    enemies.forEach(e => drawEnemy(e, time));
    drawBoss(time);
    hazards.forEach(h => drawHazard(h, time));
    drawShots(time);
    drawBombs(time);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPlayer(time);
    drawShield(time);
    drawPopups();
    drawPowerBars();
    drawBossBar();
    drawBanner();
  }

  function frame(time) {
    const dt = Math.min(.033, Math.max(0, (time - last) / 1000 || 0));
    last = time;
    update(dt);
    render(time);
    requestAnimationFrame(frame);
  }

  function setKey(action, value) {
    if (action === "jump" || action === "attack") { if (value) keys[action] = true; return; }
    keys[action] = value;
  }

  const keyMap = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "jump", ArrowUp: "jump", w: "jump", W: "jump", j: "attack", J: "attack", x: "attack", X: "attack", f: "attack", F: "attack" };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); return; }
    if (event.key === "Enter" && state === "menu") { startGame(); return; }
    const action = keyMap[event.key];
    if (action) { event.preventDefault(); setKey(action, true); }
  });
  window.addEventListener("keyup", (event) => {
    const action = keyMap[event.key];
    if (action && action !== "jump" && action !== "attack") setKey(action, false);
  });
  window.addEventListener("blur", () => { keys.left = keys.right = false; if (state === "playing") togglePause(true); });
  window.addEventListener("resize", resize, { passive: true });

  document.querySelectorAll(".touch-button").forEach(button => {
    const action = button.dataset.key;
    const press = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); button.classList.add("is-pressed"); setKey(action, true); };
    const release = (event) => { event.preventDefault(); button.classList.remove("is-pressed"); if (action !== "jump" && action !== "attack") setKey(action, false); };
    // Cancelling touchstart is what stops the long-press copy/select menu on
    // phones; the pointer events below still fire.
    button.addEventListener("touchstart", (event) => { if (event.cancelable) event.preventDefault(); }, { passive: false });
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  // Keep touch play clean: no long-press menu, text selection, pinch or
  // double-tap zoom while fingers are on the game.
  const shell = document.querySelector(".game-shell");
  for (const type of ["contextmenu", "selectstart", "dragstart", "dblclick", "gesturestart", "gesturechange"]) {
    shell.addEventListener(type, (event) => event.preventDefault());
  }
  shell.addEventListener("touchmove", (event) => { if (event.cancelable) event.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  shell.addEventListener("touchend", (event) => {
    const now = performance.now();
    if (now - lastTouchEnd < 350 && event.cancelable && !event.target.closest("button")) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  // Same for a long press on the playfield itself.
  canvas.addEventListener("touchstart", (event) => { if (event.cancelable) event.preventDefault(); }, { passive: false });
  // Last resort: if the system still starts a selection, drop it at once.
  if (window.matchMedia("(pointer: coarse)").matches) {
    document.addEventListener("selectionchange", () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    });
    document.addEventListener("contextmenu", (event) => event.preventDefault());
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

  // Install as an app. Chrome/Edge/Samsung hand us a prompt to trigger; iOS
  // Safari has no prompt, so the button explains the Share-menu route instead.
  const installBtn = document.querySelector("#installBtn");
  const installHint = document.querySelector("#installHint");
  const installed = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let installPrompt = null;
  if (!installed && window.matchMedia("(pointer: coarse)").matches) installBtn.hidden = false;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installBtn.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installBtn.hidden = true;
    installHint.hidden = true;
  });
  installBtn.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      if (choice?.outcome === "accepted") installBtn.hidden = true;
      return;
    }
    installHint.textContent = isIos
      ? "บน iPhone/iPad: เปิดใน Safari แตะปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”"
      : "เปิดเมนูของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”";
    installHint.hidden = false;
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  ui.startBtn.addEventListener("click", startGame);
  ui.restartBtn.addEventListener("click", startGame);
  ui.resumeBtn.addEventListener("click", () => togglePause(false));
  ui.pauseBtn.addEventListener("click", () => togglePause());
  ui.soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    ui.soundBtn.setAttribute("aria-pressed", String(!soundOn));
    ui.soundBtn.setAttribute("aria-label", soundOn ? "ปิดเสียง" : "เปิดเสียง");
    ui.soundBtn.textContent = soundOn ? "♫" : "♩";
    if (soundOn) tone(660, .08);
  });
  ui.fullscreenBtn.addEventListener("click", async () => {
    const shell = document.querySelector(".game-shell");
    if (!document.fullscreenElement) await shell.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const tools = [
      {
        name: "start_super_pupa_run",
        title: "เริ่มเกม Super Pupa Run",
        description: "เริ่มหรือเล่นเกม Super Pupa Run ต่อ และอัปเดตหน้าจอเกม",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() { startGame(); return { state, score: player.score, lives: player.lives }; }
      },
      {
        name: "read_super_pupa_status",
        title: "ดูสถานะเกม",
        description: "อ่านสถานะ คะแนน ชีวิต และความคืบหน้าปัจจุบันของ Super Pupa Run",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() { return { state, score: player.score, lives: player.lives, level: levelIndex + 1, progressPercent: progress() }; }
      },
      {
        name: "restart_super_pupa_run",
        title: "เริ่มเกมใหม่",
        description: "รีเซ็ตคะแนน ชีวิต และตำแหน่ง แล้วเริ่ม Super Pupa Run ใหม่ทันที",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() { resetGame(); startGame(); return { state, score: 0, lives: 3 }; }
      }
    ];
    for (const tool of tools) Promise.resolve(context.registerTool(tool)).catch(() => {});
  }

  resetGame();
  writeSave();
  // Bank coins if the tab is closed or backgrounded mid-level.
  window.addEventListener("pagehide", bankCoins);
  document.addEventListener("visibilitychange", () => { if (document.hidden) bankCoins(); });
  resize();
  registerWebMcp();
  requestAnimationFrame(frame);
})();
