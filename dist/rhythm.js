// จังหวะเต้นของ Pupa (Pupa's dance beat): the screens and the band. The
// songs, charts and judging live in rhythm-engine.js; this plays the music
// with the Web Audio API, draws the falling notes and Pupa dancing, and
// takes taps (or D F J K). game.js lends the save, sounds and coins.
//
// save.rhythm = { stars: { chart: best stars }, best: { chart: best score },
// offset: this device's timing nudge in ms }. A chart is song and level, "3n".
(() => {
  "use strict";
  const R = window.PupaRhythmEngine;
  const screen = document.querySelector("#rhythmScreen");
  if (!R || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const store = () => game().writeSave();
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (className, text, handler, label) => {
    const node = el("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    if (handler) game().onTap(node, (event) => { if (!node.disabled) handler(event); });
    return node;
  };
  const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const SONGS = R.SONGS.length;
  const LANE_COLOR = ["#ff7ab8", "#ffd23a", "#3fe0a0", "#47b8ff"];
  const KEYS = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
  const KEY_LABEL = ["D", "F", "J", "K"];
  const LEAD_IN = 2;   // seconds of quiet before the song, for the first notes to fall
  const TRAVEL = { e: 1.6, n: 1.3, h: 1.05 };   // seconds a note takes from the top to the line
  const JUDGE_TEXT = { perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS" };
  const JUDGE_COLOR = { perfect: "#ffe08a", great: "#7dffb0", good: "#7fd8ff", miss: "#ff8a9a" };

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.rhythm && typeof s.rhythm === "object" ? s.rhythm : {};
    const stars = {}, best = {};
    for (let n = 1; n <= SONGS; n++) for (const L of R.LEVELS) {
      const k = R.chartKey(n, L.key);
      const st = Math.min(3, Math.floor(Number(raw.stars?.[k]) || 0)), b = Math.min(1_000_000, Math.floor(Number(raw.best?.[k]) || 0));
      if (st > 0) stars[k] = st;
      if (b > 0) best[k] = b;
    }
    const offset = Math.max(-200, Math.min(200, Math.round(Number(raw.offset) || 0)));
    s.rhythm = { stars, best, offset };
    return s.rhythm;
  }
  const record = () => save().rhythm;
  const songStars = (n) => Math.max(0, ...R.LEVELS.map(L => record().stars[R.chartKey(n, L.key)] || 0));
  const isOpenSong = (n) => n <= 2 || songStars(n - 1) > 0;

  // ---- The band ----
  let ac = null, master = null, noise = null;
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = .55;
      const squeeze = ac.createDynamicsCompressor();
      master.connect(squeeze).connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function env(g, t, peak, attack, hold) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + hold);
  }
  function play(e, at, song) {
    const t = at;
    if (e.k === "kick") {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + .12);
      env(g, t, .9, .004, .28);
      o.connect(g).connect(master); o.start(t); o.stop(t + .32);
    } else if (e.k === "snare" || e.k === "hat") {
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noise;
      f.type = e.k === "hat" ? "highpass" : "bandpass";
      f.frequency.value = e.k === "hat" ? 7000 : 1800;
      env(g, t, e.k === "hat" ? .16 : .45, .002, e.k === "hat" ? .05 : .16);
      src.connect(f).connect(g).connect(master); src.start(t, Math.random() * .5); src.stop(t + .2);
    } else if (e.k === "bass") {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = "triangle"; o.frequency.value = R.freq(e.midi);
      f.type = "lowpass"; f.frequency.value = 700;
      env(g, t, .34, .01, Math.max(.08, e.dur));
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + e.dur + .1);
    } else if (e.k === "chord") {
      for (const m of e.notes) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = R.freq(m);
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.05, t + .08);
        g.gain.exponentialRampToValueAtTime(.0001, t + e.dur);
        o.connect(g).connect(master); o.start(t); o.stop(t + e.dur + .05);
      }
    } else if (e.k === "lead") {
      const kind = song.lead, f0 = R.freq(e.midi);
      const voices = kind === "bell" ? [[1, .2], [2, .06], [3.01, .03]] : [[1, kind === "square" ? .09 : .2]];
      for (const [mul, peak] of voices) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = kind === "bell" ? "sine" : kind;
        o.frequency.value = f0 * mul;
        env(g, t, peak, .008, kind === "bell" ? .5 / mul : Math.max(.08, e.dur));
        o.connect(g).connect(master); o.start(t); o.stop(t + Math.max(.6, e.dur) + .1);
      }
    }
  }

  // ---- The frame ----
  const frame = el("div", "shop-card rhythm-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "จังหวะเต้นของ Pupa");
  title.id = "rhythmTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button rhythm-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "rhythm-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let run = null;
  let chosen = { n: 1, level: "e" };

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setRhythmOpen?.(true);
    showLobby();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopRun();
    isShown = false;
    screen.hidden = true;
    game().setRhythmOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (run && !run.done) {
      if (event.key === "Escape" || event.key === "p" || event.key === "P") { event.preventDefault(); togglePause(); }
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (run) showLobby();
    else goHome();
  }

  // ---- Lobby ----
  function showLobby() {
    const keepTop = body.querySelector(".rhythm-songs") ? body.scrollTop : 0;
    stopRun();
    showCoins();
    frame.classList.remove("is-playing");
    const r = record();
    if (!isOpenSong(chosen.n)) chosen.n = 1;
    const intro = el("section", "rhythm-intro");
    const pic = el("img", "rhythm-intro-pic");
    pic.src = "assets/pupa-hero.webp";
    pic.alt = "";
    const words = el("div", "rhythm-intro-words");
    words.append(el("b", null, "เต้นไปกับ Pupa! แตะให้ตรงจังหวะ"),
      el("span", null, "โน้ตจะตกลงมา 4 ช่อง แตะช่องนั้นตอนโน้ตถึงเส้น (คอมพิวเตอร์กด D F J K) · ตรงเป๊ะได้ PERFECT · โน้ตคู่ให้แตะสองช่องพร้อมกัน · แม่น 95% ได้เกรด S ★★★"));
    intro.append(pic, words);

    const list = el("div", "rhythm-songs");
    R.SONGS.forEach((song, i) => {
      const n = i + 1, open = isOpenSong(n);
      const card = button(`rhythm-song${n === chosen.n ? " is-on" : ""}${open ? "" : " is-locked"}`, null, () => { chosen.n = n; showLobby(); }, `เพลง ${n} ${song.name} ${open ? "" : "ล็อกอยู่"}`);
      card.disabled = !open;
      card.style.setProperty("--a", song.look[0]);
      card.style.setProperty("--b", song.look[1]);
      const marks = el("div", "rhythm-song-stars");
      for (const L of R.LEVELS) marks.append(el("small", null, `${L.name} ${starText(r.stars[R.chartKey(n, L.key)] || 0)}`));
      card.append(el("span", "rhythm-song-icon", open ? ["🌸", "🏃", "🌙", "🍄", "🔔", "⭐"][i] : "🔒"), el("b", null, open ? song.name : "ผ่านเพลงก่อนหน้าเพื่อปลดล็อก"), el("small", "rhythm-bpm", `${song.bpm} BPM`), marks);
      list.append(card);
    });
    const levels = el("div", "rhythm-levels");
    for (const L of R.LEVELS) {
      const k = R.chartKey(chosen.n, L.key);
      const b = button(`rhythm-level${chosen.level === L.key ? " is-on" : ""}`, null, () => { chosen.level = L.key; showLobby(); });
      b.append(el("b", null, L.name), el("small", null, r.best[k] ? `สูงสุด ${fmt(r.best[k])}` : `${R.chart(chosen.n, L.key).length} โน้ต`));
      levels.append(b);
    }
    const go = button("primary-button rhythm-go", `▶ เล่น ${R.SONGS[chosen.n - 1].name}`, () => startRun(chosen.n, chosen.level));
    // the timing nudge
    const offset = el("div", "rhythm-offset");
    const val = el("b", null, `${r.offset > 0 ? "+" : ""}${r.offset} ms`);
    const nudge = (d) => { r.offset = Math.max(-200, Math.min(200, r.offset + d)); store(); val.textContent = `${r.offset > 0 ? "+" : ""}${r.offset} ms`; };
    offset.append(el("small", null, "ปรับจังหวะ (ถ้ามักขึ้น \"ช้า\" ให้กด −, ขึ้น \"เร็ว\" ให้กด +)"), button("secondary-button rhythm-nudge", "−10", () => nudge(-10), "ลด 10 มิลลิวินาที"), val, button("secondary-button rhythm-nudge", "+10", () => nudge(10), "เพิ่ม 10 มิลลิวินาที"));
    body.replaceChildren(intro, list, levels, go, offset);
    body.scrollTop = keepTop;
  }

  // ---- Pictures ----
  const pupa = new Image();
  pupa.src = "assets/pupa-hero.webp";

  // ---- Playing ----
  function startRun(n, level) {
    if (!isOpenSong(n)) return;
    stopRun();
    const ctx = audio();
    const song = R.SONGS[n - 1], music = R.compose(n);
    const state = R.create(n, level);
    const view = el("section", "rhythm-play");
    view.style.setProperty("--a", song.look[0]);
    view.style.setProperty("--b", song.look[1]);
    const canvas = el("canvas", "rhythm-canvas");
    canvas.setAttribute("aria-label", "ช่องโน้ต แตะช่องที่โน้ตถึงเส้น");
    const bar = el("div", "rhythm-bar");
    const name = el("b", "rhythm-name", song.name);
    const score = el("span", "rhythm-score", "0");
    const pause = button("icon-button rhythm-pause", "⏸", () => togglePause(), "หยุดชั่วคราว");
    bar.append(name, score, pause);
    const progressBar = el("div", "rhythm-progress");
    progressBar.append(el("i"));
    view.append(canvas, bar, progressBar);
    body.replaceChildren(view);
    frame.classList.add("is-playing");
    const latency = ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
    run = {
      n, level, song, music, state, view, canvas, g: canvas.getContext("2d"), ui: { score, fill: progressBar.firstChild },
      start: ctx ? ctx.currentTime + LEAD_IN : performance.now() / 1000 + LEAD_IN, clockStart: performance.now() / 1000,
      lag: latency + record().offset / 1000, nextEvent: 0, travel: TRAVEL[level],
      press: [0, 0, 0, 0], sparks: [], judge: null, raf: 0, timer: 0, paused: false, done: false, dpr: 1, w: 0, h: 0, beat: music.beat, miss: 0
    };
    fit();
    window.addEventListener("resize", fit);
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    run.timer = setInterval(schedule, 25);
    schedule();
    run.raf = requestAnimationFrame(loop);
  }
  function stopRun() {
    if (!run) return;
    cancelAnimationFrame(run.raf);
    clearInterval(run.timer);
    window.removeEventListener("resize", fit);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onHide);
    // let the band fall silent
    if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(.0001, ac.currentTime + .15); const m = master; setTimeout(() => { m.disconnect(); }, 250); master = ac.createGain(); master.gain.value = .55; const squeeze = ac.createDynamicsCompressor(); master.connect(squeeze).connect(ac.destination); }
    if (ac && ac.state === "suspended") ac.resume();
    run = null;
  }
  // the song's clock: the audio clock, less the time sound takes to be heard
  const songTime = () => (ac ? ac.currentTime : performance.now() / 1000) - run.start - run.lag;
  // queue the music a little ahead of time
  function schedule() {
    const r = run;
    if (!r || r.paused || !ac) return;
    const horizon = ac.currentTime + .25;
    const ev = r.music.events;
    while (r.nextEvent < ev.length && r.start + ev[r.nextEvent].t < horizon) {
      const e = ev[r.nextEvent++];
      const at = r.start + e.t;
      if (at >= ac.currentTime - .02) play(e, Math.max(at, ac.currentTime), r.song);
    }
  }
  function fit() {
    const r = run;
    if (!r) return;
    const box = r.view.getBoundingClientRect();
    r.w = Math.max(1, box.width); r.h = Math.max(1, box.height);
    r.dpr = Math.min(2, window.devicePixelRatio || 1);
    r.canvas.width = Math.round(r.w * r.dpr); r.canvas.height = Math.round(r.h * r.dpr);
    r.laneW = Math.min(110, Math.max(60, Math.min(r.w * .92, 460) / 4));
    r.left = (r.w - r.laneW * 4) / 2;
    r.line = r.h - Math.max(90, Math.min(140, r.h * .17));
    // wide: Pupa dances beside the lanes; narrow: above them, where notes start
    r.wide = r.w > 700;
    r.top = r.wide ? Math.max(60, r.h * .1) : Math.max(110, Math.min(r.h * .24, 190));
  }

  // ---- Input ----
  function tapLane(lane) {
    const r = run;
    if (!r || r.paused || r.done) return;
    r.press[lane] = .12;
    const t = songTime();
    const res = R.hit(r.state, lane, t);
    if (res) {
      r.judge = { grade: res.grade, early: res.grade !== "perfect" ? res.early : null, life: .5 };
      r.sparks.push({ lane, life: .3, color: JUDGE_COLOR[res.grade] });
    }
  }
  function onPointer(event) {
    const r = run;
    if (!r) return;
    event.preventDefault();
    const b = r.canvas.getBoundingClientRect(), x = event.clientX - b.left;
    const lane = Math.floor((x - r.left) / r.laneW);
    // taps just outside the lanes count for the nearest one
    tapLane(Math.max(0, Math.min(3, lane)));
  }
  function onKey(event) {
    const lane = KEYS[event.key];
    if (lane == null || event.repeat || !run || run.done) return;
    event.preventDefault();
    tapLane(lane);
  }
  function onHide() { if (document.hidden && run && !run.done && !run.paused) togglePause(); }

  // ---- The loop ----
  function loop() {
    const r = run;
    if (!r) return;
    r.raf = requestAnimationFrame(loop);
    const now = performance.now() / 1000, dt = r.lastFrame ? Math.min(.1, now - r.lastFrame) : 0;
    r.lastFrame = now;
    if (!r.paused && !r.done) {
      const t = songTime();
      const missed = R.sweep(r.state, t);
      if (missed.length) { r.judge = { grade: "miss", early: null, life: .5 }; r.miss = .4; }
      r.ui.score.textContent = fmt(R.result(r.state).score);
      r.ui.fill.style.width = `${Math.max(0, Math.min(100, t / r.music.length * 100))}%`;
      if (t > r.music.length + .4 && r.state.done) finish();
    }
    draw(dt);
  }
  function draw(dt) {
    const r = run, g = r.g, s = r.state;
    const t = r.done ? r.music.length : songTime();
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    g.clearRect(0, 0, r.w, r.h);
    // a light that throbs with the beat
    const beatPhase = ((t % r.beat) + r.beat) % r.beat / r.beat;
    const throb = calm() ? .2 : Math.pow(1 - beatPhase, 3) * .5;
    const grad = g.createRadialGradient(r.w / 2, r.h * .2, 10, r.w / 2, r.h * .2, Math.max(r.w, r.h) * .7);
    grad.addColorStop(0, `rgba(255,255,255,${.1 + throb * .3})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, r.w, r.h);
    // lanes
    for (let l = 0; l < 4; l++) {
      const x = r.left + l * r.laneW;
      g.fillStyle = l % 2 ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.1)";
      g.fillRect(x, 0, r.laneW, r.h);
      r.press[l] = Math.max(0, r.press[l] - dt);
      if (r.press[l] > 0) {
        const pg = g.createLinearGradient(0, r.line, 0, r.top);
        pg.addColorStop(0, hexA(LANE_COLOR[l], .45)); pg.addColorStop(1, hexA(LANE_COLOR[l], 0));
        g.fillStyle = pg; g.fillRect(x, r.top, r.laneW, r.line - r.top);
      }
    }
    // the line, and the pads under it
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(r.left, r.line - 2, r.laneW * 4, 4);
    for (let l = 0; l < 4; l++) {
      const x = r.left + l * r.laneW + r.laneW / 2, y = r.line;
      g.fillStyle = hexA(LANE_COLOR[l], r.press[l] > 0 ? .95 : .55);
      g.beginPath(); g.arc(x, y, r.laneW * .32, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, r.laneW * .32, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(255,255,255,.75)";
      g.font = `900 ${Math.round(r.laneW * .2)}px system-ui, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(KEY_LABEL[l], x, r.line + r.laneW * .55);
    }
    // notes, falling
    const yAt = (nt) => r.line - (nt - t) / r.travel * (r.line - r.top);
    let lastPair = null;
    for (let i = s.next; i < s.notes.length; i++) {
      const x = s.notes[i];
      if (x.t - t > r.travel * 1.05) break;
      if (x.judged) continue;
      const y = yAt(x.t), cx = r.left + x.lane * r.laneW + r.laneW / 2, rad = r.laneW * .3;
      // a pair is joined by a bar
      if (lastPair && Math.abs(lastPair.t - x.t) < .002) {
        g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 4;
        g.beginPath(); g.moveTo(r.left + lastPair.lane * r.laneW + r.laneW / 2, y); g.lineTo(cx, y); g.stroke();
      }
      lastPair = x;
      g.fillStyle = LANE_COLOR[x.lane];
      g.beginPath(); g.arc(cx, y, rad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, y, rad, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(255,255,255,.65)";
      g.beginPath(); g.arc(cx - rad * .3, y - rad * .3, rad * .3, 0, Math.PI * 2); g.fill();
    }
    // sparks where a note was caught
    for (const sp of r.sparks) {
      sp.life -= dt;
      const f = Math.max(0, sp.life / .3), cx = r.left + sp.lane * r.laneW + r.laneW / 2;
      g.strokeStyle = hexA(sp.color, f); g.lineWidth = 4;
      g.beginPath(); g.arc(cx, r.line, r.laneW * (.35 + (1 - f) * .3), 0, Math.PI * 2); g.stroke();
    }
    r.sparks = r.sparks.filter(sp => sp.life > 0);
    // Pupa dances above the lanes
    drawPupa(g, r, t, beatPhase);
    // the judgement and combo
    if (r.judge) {
      r.judge.life -= dt;
      const f = Math.max(0, r.judge.life / .5);
      g.globalAlpha = Math.min(1, f * 2);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `900 ${Math.round(Math.min(40, r.laneW * .42) * (1 + (1 - f) * .1))}px system-ui, sans-serif`;
      g.lineWidth = 5; g.strokeStyle = "rgba(30,10,50,.85)";
      const y = r.line - (r.line - r.top) * .38;
      g.strokeText(JUDGE_TEXT[r.judge.grade], r.w / 2, y);
      g.fillStyle = JUDGE_COLOR[r.judge.grade]; g.fillText(JUDGE_TEXT[r.judge.grade], r.w / 2, y);
      if (r.judge.early != null) { g.font = `800 ${Math.round(r.laneW * .18)}px system-ui, sans-serif`; g.fillStyle = "#fff"; g.fillText(r.judge.early ? "เร็วไป" : "ช้าไป", r.w / 2, y + r.laneW * .32); }
      g.globalAlpha = 1;
      if (r.judge.life <= 0) r.judge = null;
    }
    if (s.combo >= 3) {
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `900 ${Math.round(Math.min(30, r.laneW * .3))}px system-ui, sans-serif`;
      g.fillStyle = "rgba(255,255,255,.9)";
      g.fillText(`${s.combo} COMBO`, r.w / 2, r.line - (r.line - r.top) * .55);
    }
    // count-in
    if (t < 0 && !r.done) {
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `900 ${Math.round(Math.min(64, r.w * .12))}px system-ui, sans-serif`;
      g.fillStyle = "#fff"; g.strokeStyle = "rgba(30,10,50,.85)"; g.lineWidth = 6;
      const text = t < -1 ? "พร้อม..." : "เริ่ม!";
      g.strokeText(text, r.w / 2, r.h * .45); g.fillText(text, r.w / 2, r.h * .45);
    }
    if (r.miss > 0) { r.miss -= dt; g.fillStyle = `rgba(255,60,90,${r.miss * .3})`; g.fillRect(0, 0, r.w, r.h); }
  }
  // Pupa bounces on each beat, sways side to side, and glows on a long combo
  function drawPupa(g, r, t, phase) {
    if (!pupa.complete || !pupa.naturalWidth) return;
    const size = r.wide ? Math.min(r.h * .3, 170) : Math.max(50, r.top - 56);
    const beatNo = Math.floor(t / r.beat);
    const hop = calm() ? 0 : Math.sin(phase * Math.PI) * size * .12;
    const tilt = calm() ? 0 : (beatNo % 2 ? .12 : -.12) * Math.sin(phase * Math.PI);
    const x = r.wide ? Math.max(size * .6, r.left - size * .7) : r.w / 2, y = r.wide ? r.line + 10 : r.top - 4;
    if (r.state.combo >= 20) {
      const cy = y - size * .45 - hop, glow = g.createRadialGradient(x, cy, size * .1, x, cy, size * .75);
      glow.addColorStop(0, `rgba(255,232,150,${.45 + .2 * Math.sin(t * 6)})`);
      glow.addColorStop(1, "rgba(255,232,150,0)");
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, cy, size * .75, 0, Math.PI * 2); g.fill();
    }
    g.save();
    g.translate(x, y - hop);
    g.rotate(tilt);
    if (beatNo % 4 >= 2) g.scale(-1, 1);
    const w = size * pupa.naturalWidth / pupa.naturalHeight;
    g.drawImage(pupa, -w / 2, -size, w, size);
    g.restore();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---- Pause and the end ----
  function togglePause() {
    const r = run;
    if (!r || r.done) return;
    r.paused = !r.paused;
    r.view.querySelector(".rhythm-cover.is-pause")?.remove();
    if (r.paused) {
      ac?.suspend();
      const box = el("div", "rhythm-cover is-pause");
      box.append(el("h3", null, "⏸ หยุดชั่วคราว"));
      const actions = el("div", "title-actions");
      actions.append(button("primary-button", "▶ เล่นต่อ", () => togglePause()), button("secondary-button", "เริ่มใหม่", () => startRun(r.n, r.level)), button("secondary-button", "เลือกเพลง", () => showLobby()));
      box.append(actions);
      r.view.append(box);
      box.querySelector("button")?.focus();
    } else ac?.resume();
  }
  function finish() {
    const r = run;
    if (!r || r.done) return;
    r.done = true;
    const res = R.result(r.state), rec = record(), key = R.chartKey(r.n, r.level);
    const before = rec.stars[key] || 0, first = !before && res.stars > 0;
    const reward = R.rewardFor(r.n, r.level, res, first, before);
    if (res.stars > before) rec.stars[key] = res.stars;
    const newBest = res.score > (rec.best[key] || 0);
    if (newBest) rec.best[key] = res.score;
    save().coins += reward.coins;
    save().gems = (save().gems || 0) + reward.gems;
    const cards = save().cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) { cards.dust += reward.dust; cards.ore += reward.ore; }
    store();
    showCoins();
    if (res.stars) [659, 784, 988, 1319].forEach((note, i) => tone(note, .14, "sine", .05, i * .1));
    const parts = [`● ${fmt(reward.coins)}`];
    if (reward.gems) parts.push(`💎 ${reward.gems}`);
    if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
    if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
    const box = el("div", "rhythm-cover rhythm-result");
    const L = R.LEVELS.find(x => x.key === r.level);
    box.append(el("span", `rhythm-grade is-${res.grade}`, res.grade), el("h3", null, `${r.song.name} · ${L.name}`),
      el("p", "rhythm-stars", starText(res.stars)),
      el("p", "rhythm-big", `${fmt(res.score)}${newBest ? " · สถิติใหม่!" : ""}`),
      el("p", null, `แม่นยำ ${(res.accuracy * 100).toFixed(1)}% · คอมโบสูงสุด ${res.maxCombo}/${res.total}`),
      el("p", "rhythm-counts", `PERFECT ${res.counts.perfect} · GREAT ${res.counts.great} · GOOD ${res.counts.good} · MISS ${res.counts.miss}`),
      el("p", "rhythm-reward", `ได้รับ ${parts.join(" · ")}`),
      el("p", "rhythm-tip", res.stars ? (res.stars < 3 ? "แม่นยำ 95% ขึ้นไปได้เกรด S ★★★" : "ได้ครบ 3 ดาว!") : "แม่นยำ 60% ขึ้นไปเพื่อผ่าน ลองระดับที่ง่ายกว่า หรือปรับจังหวะในหน้าเลือกเพลง"));
    const actions = el("div", "title-actions");
    if (res.stars && r.n < SONGS) actions.append(button("primary-button", "เพลงถัดไป ▶", () => { chosen = { n: r.n + 1, level: r.level }; startRun(r.n + 1, r.level); }));
    actions.append(button(res.stars && r.n < SONGS ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startRun(r.n, r.level)), button("secondary-button", "เลือกเพลง", () => showLobby()));
    box.append(actions);
    r.view.append(box);
    announce(`จบเพลง เกรด ${res.grade} คะแนน ${res.score}`);
    box.querySelector("button")?.focus();
  }

  // `run` is read by the browser tests to play along
  window.PupaRhythm = { open, close: goHome, key, get isOpen() { return isShown; }, get run() { return run ? { state: run.state, time: songTime(), done: run.done, layout: { left: run.left, laneW: run.laneW, line: run.line } } : null; } };
  // Test link: ?rhythm opens straight into Pupa's dance beat.
  if (new URLSearchParams(location.search).has("rhythm")) setTimeout(() => open(), 400);
})();
