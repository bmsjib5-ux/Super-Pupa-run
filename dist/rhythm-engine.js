// จังหวะเต้นของ Pupa (Pupa's dance beat): the rules, with no page in them,
// so Node can test them too. Every song is written here as notes for a small
// band of synthesised sounds (kick, snare, hat, bass, chords and a lead),
// made from the song's own seed, so the music is original and needs no
// sound files. The tap chart for each difficulty is drawn from that same
// music: what you tap is what you hear.
//
// Times are seconds from the song's start. Lanes are 0..3, left to right.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaRhythmEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LANES = 4;
  // how far from the beat a tap still counts, in seconds
  const WINDOWS = { perfect: .045, great: .09, good: .14 };
  const WEIGHT = { perfect: 1, great: .8, good: .5, miss: 0 };
  const LEVELS = [
    { key: "e", name: "ง่าย", mult: 1 },
    { key: "n", name: "ปกติ", mult: 1.5 },
    { key: "h", name: "ยาก", mult: 2 }
  ];

  // ---- Music theory ----
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  // a chord on a scale step: its three notes, from the scale
  function triad(scale, root, degree) {
    return [0, 2, 4].map(k => {
      const i = degree + k;
      return root + scale[i % 7] + 12 * Math.floor(i / 7);
    });
  }

  // ---- Songs ----
  // prog: the scale steps of four chords, a bar each; beat: kick (K), snare
  // (S) and hat (H) over a bar's sixteen steps; lead: the lead's sound
  const SONGS = [
    { name: "สวนซากุระยามเช้า", bpm: 96, root: 60, scale: "major", prog: [0, 5, 3, 4], seed: 11, lead: "triangle", look: ["#ffb3d1", "#ffe08a"],
      beat: { K: [0, 8], S: [4, 12], H: [0, 4, 8, 12] }, bars: 20 },
    { name: "Pupa วิ่งเล่น", bpm: 124, root: 55, scale: "major", prog: [0, 4, 5, 3], seed: 23, lead: "square", look: ["#7fd8ff", "#7dffb0"],
      beat: { K: [0, 6, 8], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] }, bars: 24 },
    { name: "ราตรีแสงจันทร์", bpm: 88, root: 57, scale: "minor", prog: [0, 5, 2, 6], seed: 37, lead: "sine", look: ["#b58bff", "#7fd8ff"],
      beat: { K: [0, 10], S: [8], H: [0, 4, 8, 12] }, bars: 20 },
    { name: "ป่าเห็ดเต้นระบำ", bpm: 112, root: 53, scale: "major", prog: [0, 3, 1, 4], seed: 41, lead: "triangle", look: ["#9dffb5", "#ffcf8a"],
      beat: { K: [0, 7, 10], S: [4, 12], H: [0, 3, 4, 6, 8, 11, 12, 14] }, bars: 24 },
    { name: "คืนหิมะระฆังทอง", bpm: 132, root: 62, scale: "major", prog: [0, 3, 4, 0], seed: 53, lead: "bell", look: ["#ffffff", "#ffd76a"],
      beat: { K: [0, 8], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] }, bars: 24 },
    { name: "เทศกาลดวงดาว", bpm: 148, root: 52, scale: "minor", prog: [0, 6, 5, 6], seed: 67, lead: "square", look: ["#ff7ab8", "#b58bff"],
      beat: { K: [0, 3, 8, 11], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] }, bars: 28 }
  ];

  // ---- Random numbers ----
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Writing a song ----
  // A two-bar tune (a "motif") on a 16th grid: when each note starts, which
  // scale step it plays and how long it lasts. Notes lean on the chord.
  function motif(rand, song, high) {
    const out = [];
    const scale = SCALES[song.scale];
    // rhythm: strong steps likely, weak ones less so
    for (let step = 0; step < 32; step++) {
      const w = step % 8 === 0 ? .95 : step % 4 === 0 ? .7 : step % 2 === 0 ? .42 : .14;
      if (rand() < w) out.push({ step });
    }
    let deg = high ? 7 : 4;
    for (const n of out) {
      const bar = Math.floor(n.step / 16), chord = song.prog[bar % song.prog.length];
      // on the beat: a chord tone; between: a step from the last note
      if (n.step % 4 === 0) {
        const tones = [chord, chord + 2, chord + 4].map(d => d + (high ? 7 : 0));
        deg = tones.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
        if (rand() < .3) deg = tones[Math.floor(rand() * 3)];
      } else deg += rand() < .5 ? 1 : -1;
      deg = Math.max(high ? 5 : 2, Math.min(high ? 12 : 9, deg));
      n.deg = deg;
      n.midi = song.root + 12 + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
    }
    out.forEach((n, i) => { n.len = Math.min(4, (out[i + 1]?.step ?? 32) - n.step); });
    return out;
  }
  // The whole song: sections of bars, and every sound in time order.
  // { k: "kick"|"snare"|"hat"|"bass"|"chord"|"lead", t, dur, midi?, notes?, bar, step, part }
  function compose(n) {
    const song = SONGS[n - 1];
    const rand = rng(song.seed);
    const scale = SCALES[song.scale];
    const A = motif(rand, song, false), B = motif(rand, song, true);
    // A' is A with its second bar sung anew
    const A2 = A.filter(x => x.step < 16).concat(motif(rand, song, false).filter(x => x.step >= 16));
    const beat = 60 / song.bpm, step16 = beat / 4, barLen = beat * 4;
    // intro (2 bars), then tunes two bars at a time, an outro bar
    const plan = ["intro", "intro"];
    const tunes = [A, A2, B, A];
    for (let k = 0; plan.length < song.bars - 1; k++) { const part = ["A", "A2", "B", "A"][k % 4]; plan.push(part + ":0", part + ":1"); }
    plan.length = song.bars - 1;
    plan.push("outro");
    const events = [];
    plan.forEach((section, bar) => {
      const t0 = bar * barLen, chordDeg = song.prog[bar % song.prog.length];
      const chord = triad(scale, song.root, chordDeg);
      const part = section.split(":")[0], half = Number(section.split(":")[1] || 0);
      // drums: the intro keeps it light, the outro just lands
      const beatOf = song.beat;
      for (const [k, steps] of [["kick", beatOf.K], ["snare", beatOf.S], ["hat", beatOf.H]]) {
        for (const st of steps) {
          if (section === "outro" && st > 0) continue;
          if (section === "intro" && k === "snare" && bar === 0) continue;
          events.push({ k, t: t0 + st * step16, dur: step16, bar, step: st, part });
        }
      }
      // bass on each beat, the chord's root an octave down
      for (let b = 0; b < (section === "outro" ? 1 : 4); b++) events.push({ k: "bass", t: t0 + b * beat, dur: beat * .9, midi: chord[0] - 12, bar, step: b * 4, part });
      events.push({ k: "chord", t: t0, dur: section === "outro" ? barLen * 1.5 : barLen, notes: chord, bar, step: 0, part });
      if (part === "intro" || part === "outro") return;
      const tune = tunes[["A", "A2", "B"].indexOf(part)] || A;
      for (const x of tune) {
        if (Math.floor(x.step / 16) !== half) continue;
        events.push({ k: "lead", t: t0 + (x.step % 16) * step16, dur: x.len * step16 * .92, midi: x.midi, deg: x.deg, bar, step: x.step % 16, part });
      }
    });
    events.sort((a, b) => a.t - b.t || (a.k < b.k ? -1 : 1));
    const length = song.bars * barLen;
    return { song, events, beat, barLen, length };
  }

  // ---- Charts ----
  // what to tap, by difficulty: easy takes beats, normal eighths and a few
  // pairs, hard the whole tune and pairs on the snare
  function chart(n, level) {
    const { song, events, beat } = compose(n);
    const L = LEVELS.findIndex(x => x.key === level);
    const onGrid = (e) => (L === 0 ? e.step % 4 === 0 : L === 1 ? e.step % 2 === 0 : true);
    const lead = events.filter(e => e.k === "lead" && onGrid(e));
    // higher notes further right: this level's pitches spread over the lanes;
    // a note landing in the same lane as the one before steps aside, so a
    // repeated note zigzags instead of hammering one lane
    const sorted = lead.map(e => e.midi).sort((a, b) => a - b);
    let lastLane = -1, zig = 1;
    const laneOf = (midi) => {
      // its rank among this level's notes, counting how often each pitch plays
      const mid = (sorted.indexOf(midi) + sorted.lastIndexOf(midi) + 1) / 2;
      let lane = Math.min(3, Math.floor(mid / sorted.length * 4));
      if (lane === lastLane) { if (lane + zig < 0 || lane + zig > 3) zig = -zig; lane += zig; zig = -zig; }
      lastLane = lane;
      return lane;
    };
    const notes = [];
    const add = (t, lane) => notes.push({ t: Math.round(t * 1000) / 1000, lane });
    for (const e of events) {
      if (e.k === "lead") {
        if (!onGrid(e)) continue;
        add(e.t, laneOf(e.midi));
      } else if (e.k === "kick" && e.part === "intro" && L >= 1 && e.step % 8 === 0) add(e.t, e.bar % 2 ? 3 : 0);
      else if (e.k === "snare" && e.part === "intro" && L === 2) add(e.t, e.bar % 2 ? 2 : 1);
    }
    // pairs: at the start of every other bar (normal), and on snares in the tunes (hard)
    const pairs = [];
    for (const e of events) {
      if (e.part === "intro" || e.part === "outro") continue;
      if (L === 1 && e.k === "kick" && e.step === 0 && e.bar % 2 === 0) pairs.push(e.t);
      if (L === 2 && e.k === "snare") pairs.push(e.t);
    }
    notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
    // tidy: no stacked notes in a lane, nothing faster than a hand can manage
    const minGap = [beat * .9, beat * .45, beat * .24][L], laneGap = [beat * .9, beat * .5, .12][L];
    const out = [];
    for (const x of notes) {
      const prev = out[out.length - 1];
      if (prev && x.t - prev.t < minGap - 1e-6) continue;
      out.push(x);
    }
    for (const t of pairs) {
      const at = out.find(x => Math.abs(x.t - t) < .002);
      if (!at) continue;
      const other = at.lane <= 1 ? at.lane + 2 : at.lane - 2;
      out.push({ t: at.t, lane: other });
    }
    out.sort((a, b) => a.t - b.t || a.lane - b.lane);
    // a lane never asks twice too quickly; a pair never shares a lane
    const last = [-9, -9, -9, -9], final = [];
    for (const x of out) {
      if (final.some(y => Math.abs(y.t - x.t) < .002 && y.lane === x.lane)) continue;
      if (x.t - last[x.lane] < laneGap) {
        const free = [0, 1, 2, 3].filter(l => x.t - last[l] >= laneGap && !final.some(y => Math.abs(y.t - x.t) < .002 && y.lane === l));
        if (!free.length) continue;
        x.lane = free.reduce((a, b) => (Math.abs(b - x.lane) < Math.abs(a - x.lane) ? b : a));
      }
      last[x.lane] = x.t;
      final.push(x);
    }
    return final;
  }

  // ---- Playing a chart ----
  function create(n, level) {
    const notes = chart(n, level).map((x, i) => ({ ...x, id: i, judged: null }));
    return { n, level, notes, next: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, points: 0, done: false };
  }
  // a tap in a lane at time t: the nearest waiting note there, if close enough
  function hit(s, lane, t) {
    let best = null;
    for (let i = s.next; i < s.notes.length; i++) {
      const x = s.notes[i];
      if (x.t - t > WINDOWS.good) break;
      if (x.judged || x.lane !== lane) continue;
      if (Math.abs(x.t - t) <= WINDOWS.good && (!best || Math.abs(x.t - t) < Math.abs(best.t - t))) best = x;
    }
    if (!best) return null;
    const d = Math.abs(best.t - t);
    const grade = d <= WINDOWS.perfect ? "perfect" : d <= WINDOWS.great ? "great" : "good";
    judge(s, best, grade);
    return { note: best, grade, early: t < best.t };
  }
  // notes that went by untapped
  function sweep(s, t) {
    const missed = [];
    while (s.next < s.notes.length) {
      const x = s.notes[s.next];
      if (x.judged) { s.next++; continue; }
      if (t - x.t <= WINDOWS.good) break;
      judge(s, x, "miss");
      missed.push(x);
      s.next++;
    }
    // notes judged out of order (pairs) don't hold the pointer back
    while (s.next < s.notes.length && s.notes[s.next].judged) s.next++;
    if (s.next >= s.notes.length) s.done = true;
    return missed;
  }
  function judge(s, x, grade) {
    x.judged = grade;
    s.counts[grade]++;
    s.points += WEIGHT[grade];
    if (grade === "miss") s.combo = 0;
    else { s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo); }
  }
  // the result: accuracy (0..1), a score out of a million, the grade
  function result(s) {
    const total = s.notes.length || 1;
    const accuracy = s.points / total;
    const score = Math.round((accuracy * .9 + (s.maxCombo / total) * .1) * 1_000_000);
    const grade = accuracy >= .95 ? "S" : accuracy >= .88 ? "A" : accuracy >= .78 ? "B" : accuracy >= .6 ? "C" : "F";
    return { accuracy, score, grade, stars: { S: 3, A: 2, B: 1, C: 1, F: 0 }[grade], maxCombo: s.maxCombo, counts: { ...s.counts }, total };
  }
  // a chart's key in the save: song and level, "3n"
  const chartKey = (n, level) => `${n}${level}`;
  function rewardFor(n, level, res, first, before = 0) {
    const L = LEVELS.find(x => x.key === level) || LEVELS[0];
    const coins = res.stars ? Math.round((25 + res.accuracy * 60) * L.mult * (1 + (n - 1) * .1)) : 10;
    const gems = (first && res.stars ? 8 + 4 * LEVELS.indexOf(L) : 0) + (res.stars === 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first && res.stars ? 2 : 0, ore: first && res.stars ? 3 : 0 };
  }

  return { LANES, WINDOWS, WEIGHT, LEVELS, SCALES, SONGS, freq, triad, compose, chart, create, hit, sweep, result, chartKey, rewardFor };
});
