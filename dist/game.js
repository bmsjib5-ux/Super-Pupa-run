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
    announcer: document.querySelector("#announcer")
  };

  const WORLD = { width: 6100, ground: 605, gravity: 2200 };
  const keys = { left: false, right: false, jump: false };
  const image = (src) => { const img = new Image(); img.src = src; return img; };
  const art = {
    background: image("assets/cherry-night.webp"),
    hero: image("assets/pupa-hero-3d.webp"),
    runFrames: Array.from({ length: 6 }, (_, index) => image(`assets/pupa-run-${index + 1}.webp`)),
    enemy: image("assets/thorn-shroom.webp")
  };

  const platforms = [
    [0, 605, 900, 140], [1010, 605, 820, 140], [1940, 605, 980, 140],
    [3040, 605, 670, 140], [3820, 605, 860, 140], [4790, 605, 1310, 140],
    [410, 480, 230, 34], [760, 405, 170, 34], [1130, 475, 220, 34],
    [1490, 390, 190, 34], [2020, 465, 260, 34], [2410, 375, 220, 34],
    [2740, 485, 170, 34], [3160, 445, 230, 34], [3520, 355, 180, 34],
    [3970, 470, 210, 34], [4330, 390, 190, 34], [4850, 460, 240, 34],
    [5260, 360, 210, 34]
  ].map(([x, y, w, h]) => ({ x, y, w, h }));

  const cherryLayout = [
    [470,420], [570,420], [810,345], [1180,415], [1280,415], [1540,330],
    [2090,405], [2200,405], [2460,315], [2790,425], [3210,385], [3320,385],
    [3570,295], [4020,410], [4380,330], [4890,400], [5000,400], [5320,300]
  ];
  const enemyLayout = [[690,536],[1230,536],[1740,536],[2150,536],[2730,536],[3280,536],[4080,536],[4560,536],[5040,536],[5400,291]];

  let player;
  let cherries;
  let enemies;
  let particles = [];
  let cameraX = 0;
  let state = "menu";
  let last = 0;
  let soundOn = true;
  let audio;
  let viewWidth = 1280;
  let renderScale = 1;
  let dpr = 1;
  let checkpoint = 90;
  let announcementTimer = 0;

  function resetGame() {
    player = { x: 90, y: 420, w: 70, h: 88, vx: 0, vy: 0, lives: 3, score: 0, grounded: false, hurt: 0, facing: 1 };
    cherries = cherryLayout.map(([x, y], id) => ({ id, x, y, taken: false, phase: id * .71 }));
    enemies = enemyLayout.map(([x, y], id) => ({ id, x, y, w: 70, h: 68, min: x - 95, max: x + 95, vx: id % 2 ? 58 : -58, alive: true, phase: id }));
    particles = [];
    cameraX = 0;
    checkpoint = 90;
    updateHud();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    renderScale = rect.height / 720;
    viewWidth = rect.width / renderScale;
  }

  function startGame() {
    if (state === "won" || state === "lost") resetGame();
    state = "playing";
    ui.start.hidden = true;
    ui.pause.hidden = true;
    ui.end.hidden = true;
    ui.pauseBtn.setAttribute("aria-pressed", "false");
    announce("เริ่มเกมแล้ว เดินทางไปทางขวาและเก็บเชอร์รี่");
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
    ui.endText.textContent = won ? "Pupa ฝ่าคืนมหัศจรรย์กลับถึงบ้านอย่างปลอดภัย" : "สวนเชอร์รี่ยังรอการผจญภัยครั้งต่อไป";
    ui.endIcon.textContent = won ? "✦" : "☾";
    ui.finalScore.textContent = `${player.score} / ${cherries.length}`;
    announce(won ? `ชนะแล้ว เก็บเชอร์รี่ได้ ${player.score} ลูก` : "พลังหมดแล้ว ลองใหม่อีกครั้ง");
    playFanfare(won);
    window.setTimeout(() => ui.restartBtn.focus(), 50);
  }

  function updateHud() {
    ui.score.textContent = String(player.score).padStart(2, "0");
    ui.hearts.textContent = [0,1,2].map(i => i < player.lives ? "♥" : "♡").join(" ");
    ui.distance.textContent = `${Math.min(100, Math.round((player.x / 5660) * 100))}%`;
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

  function hurtPlayer() {
    if (player.hurt > 0) return;
    player.lives--;
    player.hurt = 1.3;
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
    hurtPlayer();
  }

  function update(dt) {
    if (state !== "playing") return;
    player.hurt = Math.max(0, player.hurt - dt);
    const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const target = move * 330;
    player.vx += (target - player.vx) * Math.min(1, dt * (player.grounded ? 12 : 5));
    if (move) player.facing = move;

    if (keys.jump && player.grounded) {
      player.vy = -810;
      player.grounded = false;
      tone(360, .11, "triangle", .06);
    }
    keys.jump = false;

    const previousBottom = player.y + player.h;
    player.vy += WORLD.gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(WORLD.width - player.w, player.x));
    player.grounded = false;

    for (const p of platforms) {
      const nextBottom = player.y + player.h;
      const horizontal = player.x + player.w - 12 > p.x && player.x + 12 < p.x + p.w;
      if (horizontal && player.vy >= 0 && previousBottom <= p.y + 10 && nextBottom >= p.y) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }

    if (player.y > 780) respawn();

    for (const cherry of cherries) {
      if (cherry.taken) continue;
      const box = { x: cherry.x - 18, y: cherry.y - 22, w: 36, h: 44 };
      if (rectsOverlap(player, box)) {
        cherry.taken = true;
        player.score++;
        burst(cherry.x, cherry.y, "#ffd76a", 12);
        tone(740, .09, "sine", .06);
        tone(988, .1, "sine", .04, .05);
        updateHud();
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) { enemy.vx *= -1; enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x)); }
      if (!rectsOverlap(player, enemy)) continue;
      if (player.vy > 180 && previousBottom <= enemy.y + 22) {
        enemy.alive = false;
        player.vy = -560;
        burst(enemy.x + enemy.w / 2, enemy.y + 25, "#c68cff", 15);
        tone(210, .08, "square", .05);
        tone(420, .11, "triangle", .05, .05);
      } else hurtPlayer();
    }

    if (player.x > 2960 && checkpoint < 2960) {
      checkpoint = 3060;
      announce("ถึงจุดพักกลางสวนแล้ว");
      tone(523, .12, "sine", .05);
      tone(659, .15, "sine", .05, .08);
    }
    if (player.x > 5630) finish(true);

    const maxCamera = Math.max(0, WORLD.width - viewWidth);
    const desired = Math.max(0, Math.min(maxCamera, player.x - viewWidth * .34));
    cameraX += (desired - cameraX) * Math.min(1, dt * 4.5);

    particles = particles.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      return p.life > 0;
    });
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
      const coverScale = Math.max(width / img.width, 720 / img.height);
      const drawW = img.width * coverScale;
      const drawH = img.height * coverScale;
      const travel = Math.max(0, drawW - width);
      const sourceX = travel ? -((parallax % (travel + width * .15)) / (travel + width * .15)) * travel : 0;
      ctx.drawImage(img, sourceX, (720 - drawH) / 2, drawW, drawH);
      if (sourceX + drawW < width) ctx.drawImage(img, sourceX + drawW, (720 - drawH) / 2, drawW, drawH);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 720);
      g.addColorStop(0, "#24114d"); g.addColorStop(.6, "#38215c"); g.addColorStop(1, "#0d1533");
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, 720);
    }
    const haze = ctx.createLinearGradient(0, 200, 0, 720);
    haze.addColorStop(0, "rgba(12,6,36,.04)"); haze.addColorStop(1, "rgba(6,7,26,.5)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, width, 720);

    ctx.save();
    ctx.globalAlpha = .5;
    for (let i = 0; i < 28; i++) {
      const x = ((i * 197 - cameraX * .15) % (width + 200) + width + 200) % (width + 200) - 100;
      const y = 90 + ((i * 83) % 430) + Math.sin(time * .0015 + i) * 12;
      ctx.fillStyle = i % 3 ? "#ffd978" : "#ff8bc2";
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlatform(p) {
    const x = p.x - cameraX;
    if (x > viewWidth + 80 || x + p.w < -80) return;
    ctx.save();
    ctx.shadowColor = "rgba(5,2,20,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
    const grad = ctx.createLinearGradient(0, p.y, 0, p.y + Math.min(p.h, 110));
    grad.addColorStop(0, "#5d346f"); grad.addColorStop(.16, "#3a245b"); grad.addColorStop(1, "#161437");
    ctx.fillStyle = grad; roundedRect(x, p.y, p.w, p.h, 16); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#c5528a"; roundedRect(x, p.y, p.w, 15, 12); ctx.fill();
    ctx.fillStyle = "#ef85ad"; roundedRect(x + 8, p.y + 2, Math.max(0, p.w - 16), 5, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let i = 24; i < p.w; i += 64) { ctx.beginPath(); ctx.arc(x + i, p.y + 36 + (i % 3) * 14, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawCherry(cherry, time) {
    if (cherry.taken) return;
    const x = cherry.x - cameraX;
    if (x < -50 || x > viewWidth + 50) return;
    const y = cherry.y + Math.sin(time * .004 + cherry.phase) * 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "#ff567f"; ctx.shadowBlur = 20;
    ctx.font = "38px Apple Color Emoji, Segoe UI Emoji, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🍒", 0, 0);
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    if (!enemy.alive) return;
    const x = enemy.x - cameraX;
    if (x < -100 || x > viewWidth + 100) return;
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
    const isRunning = player.grounded && speed > 45;
    const frameRate = 7 + Math.min(5, speed / 70);
    const runFrame = art.runFrames[Math.floor((time / 1000) * frameRate) % art.runFrames.length];
    const sprite = isRunning && runFrame.complete && runFrame.naturalWidth ? runFrame : art.hero;
    const bob = isRunning ? 0 : (player.grounded ? Math.sin(time * .018) * Math.min(2, speed / 120) : 0);
    const squash = isRunning ? 1 : (player.grounded ? 1 + Math.sin(time * .018) * Math.min(.025, speed / 12000) : .94);
    ctx.save();
    if (player.hurt > 0 && Math.floor(player.hurt * 12) % 2) ctx.globalAlpha = .35;
    ctx.translate(x + player.w / 2, player.y + player.h / 2 + bob);
    ctx.scale(player.facing, 1);
    ctx.scale(1 / squash, squash);
    ctx.shadowColor = "rgba(255,92,150,.35)"; ctx.shadowBlur = 20;
    if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, -52, -62, 104, 124);
    else {
      ctx.fillStyle = "#ff78a8"; ctx.beginPath(); ctx.ellipse(0, 0, 31, 41, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#17102f"; ctx.beginPath(); ctx.arc(-10, -8, 4, 0, Math.PI * 2); ctx.arc(10, -8, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawGoal(time) {
    const x = 5740 - cameraX;
    if (x < -200 || x > viewWidth + 200) return;
    ctx.save(); ctx.translate(x, 485);
    const glow = .78 + Math.sin(time * .004) * .18;
    ctx.shadowColor = "#ffe797"; ctx.shadowBlur = 35;
    ctx.strokeStyle = `rgba(255,231,151,${glow})`; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(0, 42, 62, Math.PI, 0); ctx.lineTo(62, 120); ctx.moveTo(-62, 120); ctx.lineTo(-62, 42); ctx.stroke();
    const g = ctx.createLinearGradient(0, 0, 0, 125); g.addColorStop(0, "rgba(255,244,189,.75)"); g.addColorStop(1, "rgba(255,104,166,.08)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 42, 52, Math.PI, 0); ctx.lineTo(52, 120); ctx.lineTo(-52, 120); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawCheckpoint(time) {
    const x = 3010 - cameraX;
    if (x < -100 || x > viewWidth + 100) return;
    ctx.save(); ctx.translate(x, 490);
    ctx.strokeStyle = "#f8d37a"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = checkpoint > 1000 ? "#8df0be" : "#ff7ead";
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.quadraticCurveTo(58, 24 + Math.sin(time*.005)*6, 10, 52); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function render(time) {
    ctx.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
    ctx.clearRect(0, 0, viewWidth, 720);
    drawBackground(time);
    platforms.forEach(drawPlatform);
    drawCheckpoint(time);
    drawGoal(time);
    cherries.forEach(c => drawCherry(c, time));
    enemies.forEach(e => drawEnemy(e, time));
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPlayer(time);
  }

  function frame(time) {
    const dt = Math.min(.033, Math.max(0, (time - last) / 1000 || 0));
    last = time;
    update(dt);
    render(time);
    requestAnimationFrame(frame);
  }

  function setKey(action, value) {
    if (action === "jump") { if (value) keys.jump = true; return; }
    keys[action] = value;
  }

  const keyMap = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "jump", ArrowUp: "jump", w: "jump", W: "jump" };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); return; }
    if (event.key === "Enter" && state === "menu") { startGame(); return; }
    const action = keyMap[event.key];
    if (action) { event.preventDefault(); setKey(action, true); }
  });
  window.addEventListener("keyup", (event) => {
    const action = keyMap[event.key];
    if (action && action !== "jump") setKey(action, false);
  });
  window.addEventListener("blur", () => { keys.left = keys.right = false; if (state === "playing") togglePause(true); });
  window.addEventListener("resize", resize, { passive: true });

  document.querySelectorAll(".touch-button").forEach(button => {
    const action = button.dataset.key;
    const press = (event) => { event.preventDefault(); button.classList.add("is-pressed"); setKey(action, true); };
    const release = (event) => { event.preventDefault(); button.classList.remove("is-pressed"); if (action !== "jump") setKey(action, false); };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  ui.startBtn.addEventListener("click", startGame);
  ui.restartBtn.addEventListener("click", () => { resetGame(); startGame(); });
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
        execute() { return { state, score: player.score, lives: player.lives, progressPercent: Math.min(100, Math.round((player.x / 5660) * 100)) }; }
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
  resize();
  registerWebMcp();
  requestAnimationFrame(frame);
})();
