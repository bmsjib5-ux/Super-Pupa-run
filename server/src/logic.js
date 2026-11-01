// Pupa Logic's daily ranking. The day's puzzle (the same for everyone, see
// dailyFor in dist/logic-engine.js) is timed here: the run starts when the
// page first asks for it and keeps its start however often it is asked
// again, hints come from here and add HINT_PENALTY seconds each, and the
// finish is checked against the puzzle's answer. One ranked solve a
// Bangkok day; the fastest time ranks first.

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { dayOf, shortName } from "./raid.js";

export const L = createRequire(import.meta.url)("../../dist/logic-engine.js");

export const BOARD_SIZE = 50;
export const MAX_HINTS = 5;
// a run must finish within this (a long break still counts)
export const RUN_TTL = 6 * 3_600_000;

// The cells a run's hints show, in its own order: filled cells of the answer.
function hintCells(run) {
  const puzzle = L.dailyFor(run.day), cells = [];
  puzzle.rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === "1") cells.push([r, c]); }));
  // a shuffle seeded by the run's id
  let seed = [...run.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
  for (let i = cells.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}
const runView = (run) => ({ runId: run.id, day: run.day, at: run.at, hints: run.hints.map(k => hintCells(run)[k]) });

// Today's run: the solved one's time and place, or the open run (a new one
// if there is none for today).
export async function startLogic(store, profile, now = Date.now()) {
  const day = dayOf(now);
  const done = await store.logicScore(day, profile.uid);
  if (done) return { day, done: { ms: done.ms, hints: done.hints, rank: await store.logicRank(day, done.ms) } };
  let run = null;
  await store.updateUser(profile.uid, user => {
    const u = user ?? { uid: profile.uid, save: null, createdAt: now };
    const open = u.logicRun;
    if (open && open.day === day && now - open.at < RUN_TTL) { run = open; return null; }
    run = { id: randomUUID(), day, at: now, hints: [] };
    return { ...u, logicRun: run };
  });
  return runView(run);
}

// A hint for the open run: a cell of the answer to fill.
export async function hintLogic(store, profile, body, now = Date.now()) {
  let out = null, error = null;
  await store.updateUser(profile.uid, user => {
    const run = user?.logicRun;
    if (!run || run.id !== body?.runId) { error = "no_run"; return null; }
    if (now - run.at > RUN_TTL) { error = "run_expired"; return null; }
    if (run.hints.length >= MAX_HINTS) { error = "no_hints"; return null; }
    const next = { ...run, hints: [...run.hints, run.hints.length] };
    out = { cell: hintCells(next)[next.hints.length - 1], hints: next.hints.length };
    return { ...user, logicRun: next };
  });
  return error ? { error } : out;
}

// The page's grid: right, it is timed (with the hints' penalty) and ranked.
export async function finishLogic(store, profile, body, now = Date.now()) {
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length > 20 || !rows.every(r => typeof r === "string" && /^[01]{1,20}$/.test(r)) || typeof body?.runId !== "string") return { error: "bad_run" };
  const user = await store.getUser(profile.uid);
  const run = user?.logicRun;
  if (!run || run.id !== body.runId) return { error: "no_run" };
  if (now - run.at > RUN_TTL) return { error: "run_expired" };
  const puzzle = L.dailyFor(run.day);
  if (rows.length !== puzzle.rows.length || rows.some((r, i) => r !== puzzle.rows[i])) return { error: "wrong" };
  const ms = Math.max(0, now - run.at) + run.hints.length * L.HINT_PENALTY * 1000;
  await store.updateUser(profile.uid, u => (u?.logicRun?.id === run.id ? { ...u, logicRun: null } : null));
  const entry = await store.putLogicScore(run.day, { uid: profile.uid, name: shortName(profile.name), ms, hints: run.hints.length, at: now });
  return { day: run.day, ms: entry.ms, hints: entry.hints, rank: await store.logicRank(run.day, entry.ms) };
}

// Today's places, and the player's own.
export async function boardLogic(store, profile, now = Date.now()) {
  const day = dayOf(now);
  const [top, mine] = await Promise.all([store.logicTop(day, BOARD_SIZE), store.logicScore(day, profile.uid)]);
  let rank = 0, last = null;
  const places = top.map((entry, n) => {
    if (!n || entry.ms !== last) rank = n + 1;
    last = entry.ms;
    return { rank, name: entry.name, ms: entry.ms, hints: entry.hints, me: entry.uid === profile.uid };
  });
  const me = mine ? { ms: mine.ms, hints: mine.hints, rank: await store.logicRank(day, mine.ms) } : null;
  return { day, places, me };
}
