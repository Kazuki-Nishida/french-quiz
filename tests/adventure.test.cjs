"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const Adventure = require("../adventure.js");
const NOW = Date.UTC(2026, 9, 5, 0, 0, 0);
const iso = new Date(NOW).toISOString();
const clone = value => JSON.parse(JSON.stringify(value));

function profile(id = 1) {
  const value = { id, name: "テスト", avatar: "🦊", daily: {}, words: {}, stock: [], tut: 1 };
  Adventure.ensure(value, NOW);
  return value;
}

function check(value) {
  assert.deepEqual(Adventure.status(value), { ok: true, reason: null });
  const s = value.adventure;
  assert.equal(s.earnedUnits, s.spentUnits + s.pendingUnits + (s.activeLeg ? s.activeLeg.progressUnits : 0));
  if (s.activeLeg) assert.equal(s.activeLeg.from, s.currentNodeId);
}

function correct(value, count, prefix = "round") {
  for (let i = 0; i < count; i++) {
    assert.equal(Adventure.addCorrect(value, `${prefix}:${i}`, NOW + i).added, true);
    check(value);
  }
}

test("legacy initialization preserves learning data and records the starting place without converting old scores", () => {
  const p = { id: 7, words: { "bonjour::こんにちは": { c: 30, w: 2 } }, daily: { "2026-10-04": { q: 32, c: 30 } }, stock: ["other"], extra: { retained: true } };
  const before = clone(p);
  assert.deepEqual(Adventure.status(p), { ok: true, reason: null });
  assert.equal(Object.hasOwn(p, "adventure"), false, "status is read-only");
  const s = Adventure.ensure(p, NOW);
  assert.equal(s.earnedUnits, 0);
  assert.deepEqual(s.visited, { "paris-start": { firstVisitedAt: iso } });
  assert.equal(s.effectsMode, "rich");
  assert.equal(s.introCompleted, false);
  for (const key of Object.keys(before)) assert.deepEqual(p[key], before[key]);
  const serialized = JSON.stringify(p);
  assert.equal(Adventure.ensure(p, NOW + 1000), s);
  assert.equal(JSON.stringify(p), serialized, "reinitialization changes no field or timestamp");
  check(p);
});

test("third correct answer arrives exactly at the boundary and each earlier answer is persistable", () => {
  let p = profile();
  assert.deepEqual(Adventure.selectPath(p, "paris-riverside", NOW), { changed: true, arrived: null });
  for (let i = 1; i <= 3; i++) {
    assert.deepEqual(Adventure.addCorrect(p, `round:${i}`, NOW + i), { added: true, arrived: i === 3 ? "riverside" : null });
    p = clone(p);
    assert.ok(Adventure.ensure(p, NOW + 9000));
    check(p);
    if (i < 3) assert.equal(p.adventure.activeLeg.progressUnits, i);
  }
  assert.equal(p.adventure.currentNodeId, "riverside");
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.spentUnits, 3);
  assert.equal(p.adventure.pendingUnits, 0);
  assert.equal(p.adventure.visited.riverside.firstVisitedAt, new Date(NOW + 3).toISOString());
});

test("correct answers without a chosen path are carried over and consume only one explicitly selected edge", () => {
  const p = profile();
  correct(p, 7);
  assert.equal(p.adventure.pendingUnits, 7);
  assert.deepEqual(Adventure.selectPath(p, "paris-riverside", NOW), { changed: true, arrived: "riverside" });
  assert.equal(p.adventure.pendingUnits, 4);
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(Object.hasOwn(p.adventure.visited, "park"), false);
  const afterArrival = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "paris-park", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), afterArrival, "an unconnected destination cannot be selected");
  assert.deepEqual(Adventure.returnTo(p, "paris-start"), { changed: true });
  assert.deepEqual(Adventure.selectPath(p, "paris-park", NOW), { changed: true, arrived: "park" });
  assert.equal(p.adventure.pendingUnits, 1);
  assert.equal(p.adventure.spentUnits, 6);
  check(p);
});

test("arrival midway through a round preserves later correct answers without auto-selecting another route", () => {
  const p = profile();
  Adventure.selectPath(p, "paris-park", NOW);
  correct(p, 8);
  assert.equal(p.adventure.earnedUnits, 8);
  assert.equal(p.adventure.pendingUnits, 5);
  assert.equal(p.adventure.currentNodeId, "park");
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(Object.hasOwn(p.adventure.visited, "riverside"), false);
  assert.equal(p.adventure.visited.park.firstVisitedAt, new Date(NOW + 2).toISOString());
});

test("changing direction transfers unfinished progress once, and repeated selection is a no-op", () => {
  const p = profile();
  Adventure.selectPath(p, "paris-riverside", NOW);
  correct(p, 2);
  assert.deepEqual(Adventure.selectPath(p, "paris-park", NOW), { changed: true, arrived: null });
  assert.equal(p.adventure.activeLeg.progressUnits, 2);
  assert.equal(p.adventure.earnedUnits, 2);
  assert.equal(p.adventure.spentUnits, 0);
  const selected = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "paris-park", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), selected);
  assert.deepEqual(Adventure.addCorrect(p, "round:2", NOW), { added: true, arrived: "park" });
  assert.equal(Object.hasOwn(p.adventure.visited, "riverside"), false);
  check(p);
});

test("returning to another known place refunds only unfinished travel and does not spend the carryover", () => {
  const p = profile();
  Adventure.selectPath(p, "paris-riverside", NOW);
  correct(p, 3, "first");
  const firstVisit = p.adventure.visited.riverside.firstVisitedAt;
  Adventure.returnTo(p, "paris-start");
  Adventure.selectPath(p, "paris-park", NOW);
  correct(p, 2, "second");
  assert.deepEqual(Adventure.returnTo(p, "riverside"), { changed: true });
  assert.equal(p.adventure.currentNodeId, "riverside");
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.earnedUnits, 5);
  assert.equal(p.adventure.spentUnits, 3);
  assert.equal(p.adventure.pendingUnits, 2);
  assert.equal(p.adventure.visited.riverside.firstVisitedAt, firstVisit);
  const returned = JSON.stringify(p);
  assert.deepEqual(Adventure.returnTo(p, "riverside"), { changed: false });
  assert.equal(JSON.stringify(p), returned);
  check(p);
});

test("clicking the current base does not cancel the chosen path; unknown and unvisited returns do nothing", () => {
  const p = profile();
  Adventure.selectPath(p, "paris-park", NOW);
  correct(p, 1);
  const before = JSON.stringify(p);
  for (const id of ["paris-start", "riverside", "unknown", "__proto__"]) {
    assert.deepEqual(Adventure.returnTo(p, id), { changed: false });
    assert.equal(JSON.stringify(p), before);
  }
  assert.deepEqual(Adventure.selectPath(p, "unknown", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), before);
});

test("known destinations use free return rather than charging for a previously visited edge", () => {
  const p = profile();
  correct(p, 3);
  Adventure.selectPath(p, "paris-riverside", NOW);
  Adventure.returnTo(p, "paris-start");
  const before = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "paris-riverside", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(Adventure.returnTo(p, "riverside"), { changed: true });
  assert.equal(p.adventure.spentUnits, 3);
  check(p);
});

test("duplicate latest events are ignored both immediately and after JSON backup restoration", () => {
  let p = profile();
  Adventure.selectPath(p, "paris-riverside", NOW);
  correct(p, 2);
  Adventure.addCorrect(p, "round:2", NOW);
  const saved = JSON.stringify(p);
  assert.deepEqual(Adventure.addCorrect(p, "round:2", NOW + 100), { added: false, arrived: null });
  assert.equal(JSON.stringify(p), saved);
  p = JSON.parse(saved);
  assert.deepEqual(Adventure.addCorrect(p, "round:2", NOW + 200), { added: false, arrived: null });
  assert.equal(JSON.stringify(p), saved);
});

test("profiles and settings remain independent across backup round trips", () => {
  const a = profile(1);
  const b = profile(2);
  a.adventure.effectsMode = "calm";
  a.adventure.introCompleted = true;
  Adventure.selectPath(a, "paris-park", NOW);
  correct(a, 2);
  const beforeB = JSON.stringify(b);
  const restored = clone({ profiles: [a, b], settings: { sound: false }, extra: "retained" });
  for (const p of restored.profiles) check(p);
  Adventure.addCorrect(restored.profiles[0], "new:0", NOW);
  assert.equal(JSON.stringify(restored.profiles[1]), beforeB);
  assert.equal(restored.profiles[0].adventure.effectsMode, "calm");
  assert.equal(restored.profiles[0].adventure.introCompleted, true);
  assert.equal(restored.settings.sound, false);
  assert.equal(restored.extra, "retained");
});

test("unknown fields survive validation and normal travel changes", () => {
  const p = profile();
  p.extra = { nested: [1, 2, 3] };
  p.adventure.extra = { future: "preserved" };
  p.adventure.visited["paris-start"].extra = 42;
  const before = JSON.stringify(p);
  Adventure.ensure(p, NOW + 1000);
  assert.equal(JSON.stringify(p), before);
  Adventure.selectPath(p, "paris-park", NOW);
  correct(p, 3);
  assert.deepEqual(p.extra, { nested: [1, 2, 3] });
  assert.deepEqual(p.adventure.extra, { future: "preserved" });
  assert.equal(p.adventure.visited["paris-start"].extra, 42);
});

test("unknown versions and malformed existing values are preserved rather than repaired", () => {
  const variants = [null, {}, [], { schemaVersion: 99, unknown: { keep: true } }];
  for (const adventure of variants) {
    const p = { id: 1, words: { retained: { c: 7 } }, adventure };
    const before = JSON.stringify(p);
    assert.equal(Adventure.status(p).ok, false);
    assert.equal(Adventure.ensure(p, NOW), null);
    assert.deepEqual(Adventure.addCorrect(p, "round:0", NOW), { added: false, arrived: null });
    assert.deepEqual(Adventure.selectPath(p, "paris-park", NOW), { changed: false, arrived: null });
    assert.deepEqual(Adventure.returnTo(p, "paris-start"), { changed: false });
    assert.equal(JSON.stringify(p), before);
  }
});

test("invalid counts, routes, timestamps, and inconsistent topology cannot mutate imported state", () => {
  const mutations = [
    s => { s.earnedUnits = -1; },
    s => { s.earnedUnits = 0.5; },
    s => { s.earnedUnits = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.pendingUnits = 1; },
    s => { s.spentUnits = 1; },
    s => { s.currentNodeId = "unknown"; },
    s => { delete s.visited["paris-start"]; },
    s => { s.visited["paris-start"].firstVisitedAt = "bad-date"; },
    s => { s.visited.futurePlace = { firstVisitedAt: iso }; },
    s => { s.effectsMode = "unrecognized"; },
    s => { s.introCompleted = 1; },
    s => { s.lastProgressEventId = ""; },
    s => { s.activeLeg.edgeId = "missing-edge"; },
    s => { s.activeLeg.from = "park"; },
    s => { s.activeLeg.to = "park"; },
    s => { s.activeLeg.requiredUnits = 4; },
    s => { s.activeLeg.progressUnits = 3; s.earnedUnits = 3; },
    s => { s.pendingUnits = 1; s.earnedUnits = 1; }
  ];
  for (const mutate of mutations) {
    const p = profile();
    Adventure.selectPath(p, "paris-riverside", NOW);
    mutate(p.adventure);
    const before = JSON.stringify(p);
    assert.equal(Adventure.status(p).ok, false);
    assert.equal(Adventure.ensure(p, NOW), null);
    assert.equal(Adventure.addCorrect(p, "round:0", NOW).added, false);
    assert.equal(Adventure.selectPath(p, "paris-park", NOW).changed, false);
    assert.equal(JSON.stringify(p), before);
  }
});

test("invalid event IDs, clocks, and unsafe increments do not partially update state", () => {
  const p = profile();
  const before = JSON.stringify(p);
  for (const id of [null, "", "   ", 1, {}]) assert.equal(Adventure.addCorrect(p, id, NOW).added, false);
  for (const time of [NaN, Infinity, "2026-10-05", 9e15]) {
    assert.equal(Adventure.addCorrect(p, "round:0", time).added, false);
    assert.equal(Adventure.selectPath(p, "paris-park", time).changed, false);
  }
  assert.equal(JSON.stringify(p), before);
  p.adventure.earnedUnits = Number.MAX_SAFE_INTEGER;
  p.adventure.pendingUnits = Number.MAX_SAFE_INTEGER;
  assert.equal(Adventure.addCorrect(p, "overflow:0", NOW).added, false);
  check(p);
});

test("mixed answer, selection, return, and serialization operations preserve all earned progress", () => {
  let p = profile();
  let expectedEarned = 0;
  for (let i = 0; i < 90; i++) {
    if (i % 5 === 0) Adventure.returnTo(p, "paris-start");
    if (i % 5 === 1) Adventure.selectPath(p, "paris-riverside", NOW + i);
    if (i % 5 === 2) Adventure.selectPath(p, "paris-park", NOW + i);
    if (i % 5 === 3) Adventure.returnTo(p, "riverside");
    const result = Adventure.addCorrect(p, `sequence:${i}`, NOW + i);
    if (result.added) expectedEarned++;
    assert.equal(Adventure.addCorrect(p, `sequence:${i}`, NOW + i).added, false);
    p = clone(p);
    assert.equal(p.adventure.earnedUnits, expectedEarned);
    check(p);
  }
});

test("browser script exports the same dependency-free API and the map data is immutable", () => {
  const browser = { window: {} };
  browser.globalThis = browser.window;
  vm.runInNewContext(readFileSync(join(__dirname, "../adventure.js"), "utf8"), browser);
  assert.equal(typeof browser.window.Adventure.ensure, "function");
  assert.equal(typeof browser.window.Adventure.addCorrect, "function");
  assert.deepEqual(Adventure.nodes.map(n => n.id), ["paris-start", "riverside", "park"]);
  assert.ok(Adventure.edges.every(e => e.from === "paris-start" && e.cost === 3));
  assert.ok(Object.isFrozen(Adventure.nodes));
  assert.ok(Adventure.edges.every(Object.isFrozen));
});
