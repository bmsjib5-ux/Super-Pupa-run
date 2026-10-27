// The weekly dragon raid ranking. A ranked run starts here: the server
// picks the seed and the team (from the account's save, so the page and
// the server fight the same battle), the page plays it and sends back its
// turns, and the server replays them with the game's own engine
// (dist/cards-engine.js, see raidReplay there) for the score. A week runs
// from Monday 00:00 Bangkok time; once it is over, each place pays gems,
// given the next time the player looks at the ranking.

import { createRequire } from "node:module";
import { randomUUID, randomInt } from "node:crypto";

export const E = createRequire(import.meta.url)("../../dist/cards-engine.js");

export const RUNS_A_DAY = 40;
export const RUN_TTL = 15 * 60_000;
export const BOARD_SIZE = 50;
// a run started just before a week ends may still finish into it; the
// week's places are paid after that
const LATE_FINISH = 5 * 60_000;
const SETTLE = 10 * 60_000;
const BANGKOK = 7 * 3_600_000;
const DAY = 86_400_000;

// The Bangkok day, and the Monday of the week, a time falls in.
export const dayOf = (ms = Date.now()) => new Date(ms + BANGKOK).toISOString().slice(0, 10);
export function weekOf(ms = Date.now()) {
  const local = new Date(ms + BANGKOK);
  const fromMonday = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - fromMonday)).toISOString().slice(0, 10);
}
export const weekEnds = (week) => Date.parse(`${week}T00:00:00Z`) - BANGKOK + 7 * DAY;
export const weekBefore = (week) => new Date(Date.parse(`${week}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10);

// Gems for a finished week's place.
export const RAID_PRIZES = [
  { upTo: 1, gems: 3000 }, { upTo: 2, gems: 2000 }, { upTo: 3, gems: 1500 },
  { upTo: 10, gems: 1000 }, { upTo: 50, gems: 500 }, { upTo: 100, gems: 300 }, { upTo: null, gems: 100 }
];
export const prizeFor = (rank) => RAID_PRIZES.find(p => p.upTo == null || rank <= p.upTo).gems;

// What the ranking shows of a Google name: the first word and the next
// one's initial; of an e-mail address, only its first letters.
export function shortName(name) {
  const text = String(name || "").trim();
  if (text.includes("@")) return `${[...text.split("@")[0]].slice(0, 3).join("")}***`;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return "ผู้เล่น";
  const first = [...words[0]].slice(0, 14).join("");
  return words[1] ? `${first} ${[...words[1]][0]}.` : first;
}

// The page's turns, checked: at most 150 hero turns of up to ten skills.
function cleanTurns(raw) {
  if (!Array.isArray(raw) || raw.length > 150) return null;
  const turns = [];
  for (const turn of raw) {
    if (!turn || typeof turn !== "object" || !Array.isArray(turn.q) || turn.q.length > 10) return null;
    const q = [];
    for (const pick of turn.q) {
      const i = Number(pick?.i), s = Number(pick?.s);
      if (!Number.isInteger(i) || i < 0 || i >= 10 || !Number.isInteger(s) || s < 0 || s > 3) return null;
      q.push({ i, s });
    }
    const f = Number(turn.f);
    turns.push({ q, f: Number.isInteger(f) && f >= -1 && f < 10 ? f : -1 });
  }
  return turns;
}

// What the page needs to play a ranked run.
const runView = (run) => ({ runId: run.id, seed: run.seed, week: run.week, best: run.best, team: run.team, pumpkin: run.pumpkin, rules: run.rules });

// A ranked run: the account's team as last synced, a fresh seed. One run is
// open at a time (a new one replaces it), RUNS_A_DAY a Bangkok day.
export async function startRun(store, profile, now = Date.now()) {
  let error = null, run = null;
  await store.updateUser(profile.uid, user => {
    const cards = user?.save?.cards;
    const team = E.fielded(cards || {});
    if (!team.some(Boolean)) { error = "no_team"; return null; }
    const today = dayOf(now);
    const count = user.raidDay === today ? user.raidCount || 0 : 0;
    if (count >= RUNS_A_DAY) { error = "too_many_runs"; return null; }
    run = { id: randomUUID(), seed: randomInt(1, 2 ** 31), week: weekOf(now), best: E.bestStageOf(cards.stars), team, pumpkin: E.halloweenOn(today), rules: E.RAID_RULES, at: now };
    return { ...user, raidRun: run, raidDay: today, raidCount: count + 1 };
  });
  return error ? { error } : runView(run);
}

// The page's turns for the open run: replayed for the score, which counts
// for the run's week if it beats the player's best there.
export async function finishRun(store, profile, body, now = Date.now()) {
  const turns = cleanTurns(body?.turns);
  const shown = Number(body?.shown);
  if (!turns || !Number.isInteger(shown) || shown < 0 || typeof body?.runId !== "string") return { error: "bad_run" };
  let run = null;
  await store.updateUser(profile.uid, user => {
    if (!user?.raidRun || user.raidRun.id !== body.runId) return null;
    run = user.raidRun;
    return { ...user, raidRun: null };
  });
  if (!run) return { error: "no_run" };
  if (now - run.at > RUN_TTL) return { error: "run_expired" };
  if (now > weekEnds(run.week) + LATE_FINISH) return { error: "week_over" };
  if (run.rules !== E.RAID_RULES) return { error: "old_rules" };
  const stage = E.raid(run.best, { pumpkin: run.pumpkin });
  const result = E.raidReplay({ team: run.team, stage, seed: run.seed, turns, shown });
  const entry = await store.putRaidScore(run.week, { uid: profile.uid, name: shortName(profile.name), score: result.score, phase: result.phase, at: now });
  const rank = await store.raidRank(run.week, entry.score);
  return { score: result.score, phase: result.phase, week: run.week, best: entry.score, rank };
}

// This week's top places and the player's own; and last week's place,
// paid in gems into the account's save the first time it is seen.
export async function board(store, profile, now = Date.now()) {
  const week = weekOf(now), prev = weekBefore(week);
  const [top, mine, user] = await Promise.all([store.raidTop(week, BOARD_SIZE), store.raidScore(week, profile.uid), store.getUser(profile.uid)]);
  let rank = 0, last = null;
  const places = top.map((entry, n) => {
    if (!n || entry.score !== last) rank = n + 1;
    last = entry.score;
    return { rank, name: entry.name, score: entry.score, phase: entry.phase, me: entry.uid === profile.uid };
  });
  const me = mine ? { score: mine.score, phase: mine.phase, rank: await store.raidRank(week, mine.score) } : null;
  let reward = null;
  if (user?.save && user.raidPaid !== prev && now >= weekEnds(prev) + SETTLE) {
    const before = await store.raidScore(prev, profile.uid);
    if (before) {
      const place = await store.raidRank(prev, before.score), gems = prizeFor(place);
      let paid = false;
      await store.updateUser(profile.uid, current => {
        if (!current?.save || current.raidPaid === prev) return null;
        paid = true;
        return { ...current, raidPaid: prev, save: { ...current.save, gems: (current.save.gems || 0) + gems } };
      });
      if (paid) reward = { week: prev, rank: place, score: before.score, gems };
    }
  }
  return { week, endsAt: weekEnds(week), top: places, me, reward, prizes: RAID_PRIZES, runsLeft: Math.max(0, RUNS_A_DAY - (user?.raidDay === dayOf(now) ? user.raidCount || 0 : 0)) };
}
