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
const empty = () => ({ buckets: {}, samples: [] });
const summary = Adventure.summarizeLearning;

function profile(id = 1) {
  const value = { id, name: "テスト", avatar: "🦊", daily: {}, words: {}, stock: [], tut: 1 };
  Adventure.ensure(value, NOW);
  return value;
}

// Frozen-in-time fixture: version one deliberately retains fictional places.
function legacyV1(overrides = {}) {
  return {
    schemaVersion: 1, effectsMode: "calm", currentNodeId: "paris-start", activeLeg: null,
    earnedUnits: 7, spentUnits: 3, pendingUnits: 4,
    visited: { "paris-start": { firstVisitedAt: iso, oldNote: true }, riverside: { firstVisitedAt: iso } },
    lastProgressEventId: "old:7", introCompleted: true, extra: { future: "keep" }, ...overrides
  };
}

// Generated with the actual v38 WorldData + Adventure scripts from
// git show 3084b2f9658c9ebb34e29102f63e1fd691889b74 in an isolated VM.
// Kept as data so the test also runs without Git history in exported copies.
function legacyV38ActiveJourney() {
  const sample = (bucket, count) => ({ wordKey: "aventure::冒険", bucket, count });
  const metAt = "2026-10-05T00:00:00.007Z";
  return {
    schemaVersion: 2, effectsMode: "rich", currentNodeId: "eiffel",
    activeLeg: {
      edgeId: "eiffel--chambord", from: "eiffel", to: "chambord", requiredUnits: 24, progressUnits: 2,
      learning: { buckets: { "C2|regular": 1, "C2|review": 1 }, samples: [sample("C2|regular", 1), sample("C2|review", 1)] },
      extraLeg: "keep"
    },
    earnedUnits: 10, spentUnits: 8, pendingUnits: 0, pendingLearning: empty(),
    visited: {
      trocadero: { firstVisitedAt: iso, learning: empty() },
      eiffel: { firstVisitedAt: metAt, learning: { buckets: { "C2|review": 4, "C2|regular": 4 }, samples: [sample("C2|review", 4), sample("C2|regular", 4)] } }
    },
    characters: { lumie: { metAt, placeId: "eiffel" } }, lastProgressEventId: "v38-a:9",
    introCompleted: false, extraV38: { preserved: true }
  };
}

function check(value) {
  assert.deepEqual(Adventure.status(value), { ok: true, reason: null });
  const s = value.adventure;
  assert.equal(s.earnedUnits, s.spentUnits + s.pendingUnits + (s.activeLeg ? s.activeLeg.progressUnits : 0));
  assert.equal(summary(s.pendingLearning).total, s.pendingUnits);
  let recorded = 0;
  for (const visit of Object.values(s.visited)) recorded += summary(visit.learning).total;
  assert.equal(recorded, s.spentUnits);
  if (s.activeLeg) {
    assert.equal(s.activeLeg.from, s.currentNodeId);
    assert.equal(summary(s.activeLeg.learning).total, s.activeLeg.progressUnits);
  }
}

function correct(value, count, prefix = "round", context) {
  for (let i = 0; i < count; i++) {
    assert.equal(Adventure.addCorrect(value, `${prefix}:${i}`, NOW + i, context).added, true);
    check(value);
  }
}

function bucketTotals(value) {
  const s = value.adventure;
  const totals = {};
  const all = [s.pendingLearning, ...Object.values(s.visited).map(v => v.learning)];
  if (s.activeLeg) all.push(s.activeLeg.learning);
  for (const learning of all) for (const [key, count] of Object.entries(learning.buckets)) totals[key] = (totals[key] || 0) + count;
  return totals;
}

test("old learning-only profiles initialize at Trocadero without converting old scores", () => {
  const p = { id: 7, words: { "bonjour::こんにちは": { c: 30, w: 2 } }, daily: { "2026-10-04": { q: 32, c: 30 } }, stock: ["other"], extra: { retained: true } };
  const before = clone(p);
  assert.equal(Adventure.status(p).ok, true);
  assert.equal(Object.hasOwn(p, "adventure"), false, "status is read-only");
  const s = Adventure.ensure(p, NOW);
  assert.equal(s.schemaVersion, 2);
  assert.equal(s.earnedUnits, 0);
  assert.deepEqual(s.visited, { trocadero: { firstVisitedAt: iso, learning: empty() } });
  assert.deepEqual(s.characters, {});
  assert.equal(s.effectsMode, "rich");
  assert.equal(s.introCompleted, false);
  for (const key of Object.keys(before)) assert.deepEqual(p[key], before[key]);
  const serialized = JSON.stringify(p);
  assert.equal(Adventure.ensure(p, NOW + 1000), s);
  assert.equal(JSON.stringify(p), serialized);
  check(p);
});

test("third correct answer reaches the Seine and each earlier answer survives JSON reload", () => {
  let p = profile();
  assert.deepEqual(Adventure.selectPath(p, "trocadero--seine", NOW), { changed: true, arrived: null });
  for (let i = 1; i <= 3; i++) {
    assert.deepEqual(Adventure.addCorrect(p, `round:${i}`, NOW + i, { level: "C2", review: i === 2, wordKey: "mot" + i }), { added: true, arrived: i === 3 ? "seine" : null });
    p = clone(p);
    assert.ok(Adventure.ensure(p, NOW + 9000));
    check(p);
    if (i < 3) assert.equal(p.adventure.activeLeg.progressUnits, i);
  }
  assert.equal(p.adventure.currentNodeId, "seine");
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.spentUnits, 3);
  assert.equal(p.adventure.pendingUnits, 0);
  assert.equal(p.adventure.visited.seine.firstVisitedAt, new Date(NOW + 3).toISOString());
  assert.deepEqual(summary(p.adventure.visited.seine.learning), { countsByLevel: { C2: 3 }, reviewCount: 1, sampleKeys: ["mot1", "mot2", "mot3"], total: 3 });
});

test("unassigned answers carry over but consume only the explicitly selected route", () => {
  const p = profile();
  correct(p, 12);
  assert.deepEqual(Adventure.selectPath(p, "trocadero--seine", NOW), { changed: true, arrived: "seine" });
  assert.equal(p.adventure.pendingUnits, 9);
  assert.equal(p.adventure.activeLeg, null);
  const afterArrival = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "trocadero--eiffel", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), afterArrival, "route origin must be the current place");
  assert.deepEqual(Adventure.selectPath(p, "seine--eiffel", NOW), { changed: true, arrived: "eiffel" });
  assert.equal(p.adventure.pendingUnits, 1);
  assert.equal(p.adventure.spentUnits, 11);
  assert.equal(Object.hasOwn(p.adventure.visited, "champ-de-mars"), false);
  check(p);
});

test("arrival midway through a round preserves later answers without auto-selecting a route", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 10);
  assert.equal(p.adventure.earnedUnits, 10);
  assert.equal(p.adventure.pendingUnits, 7);
  assert.equal(p.adventure.currentNodeId, "seine");
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.visited.seine.firstVisitedAt, new Date(NOW + 2).toISOString());
  assert.equal(Object.keys(p.adventure.visited).length, 2);
});

test("changing to a shorter route refunds unfinished progress with its learning attribution", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  correct(p, 2, "first", { level: "A1", review: true, wordKey: "chat::猫" });
  assert.deepEqual(Adventure.selectPath(p, "trocadero--seine", NOW), { changed: true, arrived: null });
  assert.equal(p.adventure.activeLeg.progressUnits, 2);
  assert.equal(summary(p.adventure.activeLeg.learning).reviewCount, 2);
  const selected = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "trocadero--seine", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), selected);
  assert.deepEqual(Adventure.addCorrect(p, "third", NOW, { level: "C2", review: false, wordKey: "mot" }), { added: true, arrived: "seine" });
  assert.equal(Object.hasOwn(p.adventure.visited, "eiffel"), false);
  assert.deepEqual(summary(p.adventure.visited.seine.learning).countsByLevel, { A1: 2, C2: 1 });
  check(p);
});

test("returning to another known place refunds only unfinished travel without spending carryover", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 3, "first");
  const firstVisit = clone(p.adventure.visited.seine);
  Adventure.returnTo(p, "trocadero");
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  correct(p, 2, "second", { level: "B1", review: true, wordKey: "vu::見た" });
  assert.deepEqual(Adventure.returnTo(p, "seine"), { changed: true });
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.earnedUnits, 5);
  assert.equal(p.adventure.spentUnits, 3);
  assert.equal(p.adventure.pendingUnits, 2);
  assert.equal(summary(p.adventure.pendingLearning).reviewCount, 2);
  assert.deepEqual(p.adventure.visited.seine, firstVisit);
  const returned = JSON.stringify(p);
  assert.deepEqual(Adventure.returnTo(p, "seine"), { changed: false });
  assert.equal(JSON.stringify(p), returned);
  check(p);
});

test("current-place, unvisited, and unknown return clicks do not cancel or mutate travel", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  correct(p, 1);
  const before = JSON.stringify(p);
  for (const id of ["trocadero", "seine", "unknown", "__proto__"]) {
    assert.deepEqual(Adventure.returnTo(p, id), { changed: false });
    assert.equal(JSON.stringify(p), before);
  }
  assert.deepEqual(Adventure.selectPath(p, "unknown", NOW), { changed: false, arrived: null });
  assert.deepEqual(Adventure.selectPath(p, "trocadero--champ-de-mars", NOW), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), before);
});

test("the original three characters register once on first arrival; free revisits preserve dates and learning", () => {
  const p = profile();
  for (const [place, character, cost] of [["eiffel", "lumie", 8], ["mont-saint-michel", "mare", 48], ["chambord", "plume", 48]]) {
    const from = p.adventure.currentNodeId;
    Adventure.selectPath(p, from + "--" + place, NOW);
    correct(p, cost, place, { level: "A1", review: false, wordKey: place });
    assert.deepEqual(p.adventure.characters[character], { placeId: place, metAt: new Date(NOW + cost - 1).toISOString() });
  }
  const collection = clone(p.adventure.characters);
  const visits = clone(p.adventure.visited);
  const spent = p.adventure.spentUnits;
  Adventure.returnTo(p, "trocadero");
  const before = JSON.stringify(p);
  assert.deepEqual(Adventure.selectPath(p, "trocadero--eiffel", NOW + 100), { changed: false, arrived: null });
  assert.equal(JSON.stringify(p), before);
  for (const place of ["eiffel", "chambord", "mont-saint-michel"]) assert.equal(Adventure.returnTo(p, place).changed, true);
  assert.deepEqual(p.adventure.characters, collection);
  assert.deepEqual(p.adventure.visited, visits);
  assert.equal(p.adventure.spentUnits, spent);
  check(p);
});

test("latest event duplicates are ignored immediately and after JSON restoration", () => {
  let p = profile();
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 3, "round", { level: "A2", review: true, wordKey: "mot" });
  const saved = JSON.stringify(p);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(Adventure.addCorrect(p, "round:2", NOW + 100, { level: "C2", review: false, wordKey: "other" }), { added: false, arrived: null });
    assert.equal(JSON.stringify(p), saved);
    p = JSON.parse(saved);
  }
});

test("profiles, preferences, collection, and samples remain independent in backups", () => {
  const a = profile(1), b = profile(2);
  a.adventure.effectsMode = "calm";
  a.adventure.introCompleted = true;
  Adventure.selectPath(a, "trocadero--eiffel", NOW);
  correct(a, 8, "a", { level: "C2", review: true, wordKey: "aventure" });
  const beforeB = JSON.stringify(b);
  const restored = clone({ profiles: [a, b], settings: { sound: false }, extra: "retained" });
  Adventure.addCorrect(restored.profiles[0], "new:0", NOW);
  assert.equal(JSON.stringify(restored.profiles[1]), beforeB);
  assert.equal(restored.profiles[0].adventure.effectsMode, "calm");
  assert.equal(restored.profiles[0].adventure.introCompleted, true);
  assert.ok(restored.profiles[0].adventure.characters.lumie);
  assert.equal(restored.settings.sound, false);
  assert.equal(restored.extra, "retained");
  restored.profiles.forEach(check);
});

test("unknown JSON fields survive validation and normal travel changes", () => {
  const p = profile();
  p.extra = { nested: [1, 2, 3] };
  p.adventure.extra = { future: "preserved" };
  p.adventure.visited.trocadero.extra = 42;
  const before = JSON.stringify(p);
  Adventure.ensure(p, NOW + 1000);
  assert.equal(JSON.stringify(p), before);
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 3);
  assert.deepEqual(p.extra, { nested: [1, 2, 3] });
  assert.deepEqual(p.adventure.extra, { future: "preserved" });
  assert.equal(p.adventure.visited.trocadero.extra, 42);
});

test("unknown versions and malformed existing values are preserved rather than repaired", () => {
  for (const adventure of [null, {}, [], { schemaVersion: 99, unknown: { keep: true } }]) {
    const p = { id: 1, words: { retained: { c: 7 } }, adventure };
    const before = JSON.stringify(p);
    assert.equal(Adventure.status(p).ok, false);
    assert.equal(Adventure.ensure(p, NOW), null);
    assert.deepEqual(Adventure.addCorrect(p, "round:0", NOW), { added: false, arrived: null });
    assert.deepEqual(Adventure.selectPath(p, "trocadero--seine", NOW), { changed: false, arrived: null });
    assert.deepEqual(Adventure.returnTo(p, "trocadero"), { changed: false });
    assert.equal(JSON.stringify(p), before);
  }
});

test("invalid counts, routes, dates, and learning aggregates cannot mutate imported state", () => {
  const mutations = [
    s => { s.earnedUnits = -1; }, s => { s.earnedUnits = 0.5; },
    s => { s.earnedUnits = Number.MAX_SAFE_INTEGER + 1; }, s => { s.pendingUnits = 1; },
    s => { s.spentUnits = 1; }, s => { s.currentNodeId = "unknown"; },
    s => { delete s.visited.trocadero; }, s => { s.visited.trocadero.firstVisitedAt = "bad-date"; },
    s => { s.visited.futurePlace = { firstVisitedAt: iso, learning: empty() }; },
    s => { s.effectsMode = "unrecognized"; }, s => { s.introCompleted = 1; },
    s => { s.lastProgressEventId = ""; }, s => { s.activeLeg.edgeId = "missing-edge"; },
    s => { s.activeLeg.from = "eiffel"; }, s => { s.activeLeg.to = "eiffel"; },
    s => { s.activeLeg.requiredUnits = 4; }, s => { s.activeLeg.progressUnits = 3; s.earnedUnits = 3; },
    s => { s.pendingUnits = 1; s.earnedUnits = 1; }, s => { s.pendingLearning = {}; },
    s => { s.activeLeg.learning.buckets.unknown = 1; },
    s => { s.activeLeg.learning.buckets["future|regular"] = 0; },
    s => { s.activeLeg.learning.samples = [{ wordKey: "x", bucket: "A1|review", count: 1 }]; },
    s => { s.characters.future = { placeId: "eiffel", metAt: iso }; },
    s => { s.characters.lumie = { placeId: "eiffel", metAt: iso }; },
    s => { s.legacyJourney = { schemaVersion: 1 }; }
  ];
  for (const mutate of mutations) {
    const p = profile();
    Adventure.selectPath(p, "trocadero--seine", NOW);
    mutate(p.adventure);
    const before = JSON.stringify(p);
    assert.equal(Adventure.status(p).ok, false, String(mutate));
    assert.equal(Adventure.ensure(p, NOW), null);
    assert.equal(Adventure.addCorrect(p, "round:0", NOW).added, false);
    assert.equal(Adventure.selectPath(p, "trocadero--eiffel", NOW).changed, false);
    assert.equal(JSON.stringify(p), before);
  }
});

test("invalid event IDs, clocks, and unsafe increments do not partially update state", () => {
  const p = profile();
  const before = JSON.stringify(p);
  for (const id of [null, "", "   ", 1, {}]) assert.equal(Adventure.addCorrect(p, id, NOW).added, false);
  for (const time of [NaN, Infinity, "2026-10-05", 9e15]) {
    assert.equal(Adventure.addCorrect(p, "round:0", time).added, false);
    assert.equal(Adventure.selectPath(p, "trocadero--seine", time).changed, false);
  }
  assert.equal(JSON.stringify(p), before);
  p.adventure.earnedUnits = p.adventure.pendingUnits = Number.MAX_SAFE_INTEGER;
  p.adventure.pendingLearning.buckets.unknown = Number.MAX_SAFE_INTEGER;
  assert.equal(Adventure.addCorrect(p, "overflow:0", NOW).added, false);
  check(p);
});

test("version-one migration retains the complete old journey and transfers earned progress exactly once", () => {
  const p = { id: 1, words: { old: { c: 99, w: 2 } }, adventure: legacyV1() };
  const original = clone(p.adventure);
  const originalText = JSON.stringify(p);
  assert.equal(Adventure.status(p).ok, true);
  assert.equal(JSON.stringify(p), originalText, "status does not migrate");
  const state = Adventure.ensure(p, NOW + 100);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.currentNodeId, "trocadero");
  assert.equal(state.earnedUnits, 7);
  assert.equal(state.pendingUnits, 7);
  assert.equal(state.spentUnits, 0);
  assert.equal(state.activeLeg, null);
  assert.deepEqual(state.legacyJourney, original);
  assert.deepEqual(state.extra, original.extra);
  assert.deepEqual(p.words, { old: { c: 99, w: 2 } });
  assert.deepEqual(Object.keys(state.visited), ["trocadero"]);
  assert.deepEqual(state.characters, {});
  assert.equal(state.effectsMode, "calm");
  assert.equal(state.introCompleted, true);
  assert.equal(state.lastProgressEventId, "old:7");
  assert.deepEqual(summary(state.pendingLearning), { countsByLevel: { unknown: 7 }, reviewCount: 0, sampleKeys: [], total: 7 });
  let reloaded = clone(p);
  for (let i = 0; i < 3; i++) { const before = JSON.stringify(reloaded); Adventure.ensure(reloaded, NOW + 500); assert.equal(JSON.stringify(reloaded), before); reloaded = clone(reloaded); }
  Adventure.selectPath(reloaded, "trocadero--seine", NOW);
  assert.equal(reloaded.adventure.pendingUnits, 4);
  assert.equal(summary(reloaded.adventure.visited.seine.learning).countsByLevel.unknown, 3);
  assert.deepEqual(reloaded.adventure.legacyJourney, original);
  check(reloaded);
});

test("version-one partial travel is archived and refunded with spent and pending progress", () => {
  const old = legacyV1({ earnedUnits: 5, pendingUnits: 0, activeLeg: { edgeId: "paris-park", from: "paris-start", to: "park", requiredUnits: 3, progressUnits: 2 } });
  const p = { adventure: clone(old) };
  Adventure.ensure(p, NOW);
  assert.equal(p.adventure.pendingUnits, 5);
  assert.equal(p.adventure.spentUnits, 0);
  assert.equal(p.adventure.activeLeg, null);
  assert.deepEqual(p.adventure.legacyJourney, old);
  check(p);
});

test("malformed version-one fixtures fail strict original validation without repair or migration", () => {
  for (const change of [
    old => { old.earnedUnits = 8; }, old => { old.currentNodeId = "trocadero"; },
    old => { old.visited.seine = { firstVisitedAt: iso }; }, old => { old.pendingUnits = -1; },
    old => { old.effectsMode = "future"; }, old => { old.introCompleted = null; },
    old => { old.activeLeg = { edgeId: "paris-park", from: "paris-start", to: "park", requiredUnits: 3, progressUnits: 0 }; }
  ]) {
    const p = { adventure: legacyV1() }; change(p.adventure);
    const before = JSON.stringify(p);
    assert.equal(Adventure.ensure(p, NOW), null);
    assert.equal(JSON.stringify(p), before);
  }
});

test("mixed buckets split across arrival and carryover without inventing review or sample attribution", () => {
  const p = profile();
  correct(p, 4, "a", { level: "A1", review: false, wordKey: "un::一" });
  correct(p, 2, "ar", { level: "A1", review: true, wordKey: "deux::二" });
  correct(p, 3, "c", { level: "C2", review: true, wordKey: "trois::三" });
  const before = bucketTotals(p);
  Adventure.selectPath(p, "trocadero--seine", NOW);
  assert.deepEqual(summary(p.adventure.visited.seine.learning), { countsByLevel: { A1: 3 }, reviewCount: 0, sampleKeys: ["un::一"], total: 3 });
  assert.deepEqual(summary(p.adventure.pendingLearning), { countsByLevel: { A1: 3, C2: 3 }, reviewCount: 5, sampleKeys: ["un::一", "deux::二", "trois::三"], total: 6 });
  assert.equal(p.adventure.pendingLearning.samples[0].count, 1);
  Adventure.selectPath(p, "seine--eiffel", NOW);
  assert.equal(p.adventure.activeLeg.progressUnits, 6);
  Adventure.returnTo(p, "trocadero");
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  assert.deepEqual(bucketTotals(p), before);
  check(p);
});

test("samples stay bounded after many answers and repeated splits, while every bucket count is preserved", () => {
  let p = profile();
  const expected = {};
  for (let i = 0; i < 180; i++) {
    const context = { level: ["A1", "C2", "ぶんぽう3"][i % 3], review: i % 2 === 0, wordKey: "word-" + i };
    const bucket = context.level + (context.review ? "|review" : "|regular");
    expected[bucket] = (expected[bucket] || 0) + 1;
    Adventure.addCorrect(p, "mixed:" + i, NOW + i, context);
    if (i % 13 === 0) Adventure.returnTo(p, "trocadero");
    if (i % 13 === 1) Adventure.selectPath(p, "trocadero--mont-saint-michel", NOW);
    if (i % 13 === 2) Adventure.selectPath(p, "trocadero--chambord", NOW);
    if (i % 13 === 3) Adventure.selectPath(p, "trocadero--seine", NOW);
    if (i % 13 === 4) Adventure.selectPath(p, "seine--eiffel", NOW);
    if (i % 13 === 5) Adventure.selectPath(p, "eiffel--champ-de-mars", NOW);
    assert.equal(Adventure.addCorrect(p, "mixed:" + i, NOW, context).added, false);
    p = clone(p);
    check(p);
    assert.deepEqual(bucketTotals(p), expected);
    const records = [p.adventure.pendingLearning, ...Object.values(p.adventure.visited).map(v => v.learning)];
    if (p.adventure.activeLeg) records.push(p.adventure.activeLeg.learning);
    for (const learning of records) assert.ok(learning.samples.length <= 6);
    assert.equal(p.adventure.earnedUnits, i + 1);
  }
});

test("malformed sample counts, repeated samples, excess samples, and character records are rejected", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  correct(p, 8, "unlock", { level: "A1", review: true, wordKey: "word" });
  const mutations = [
    s => { s.visited.eiffel.learning.samples[0].count = 9; },
    s => { s.visited.eiffel.learning.samples.push(clone(s.visited.eiffel.learning.samples[0])); },
    s => { s.visited.eiffel.learning.samples = Array.from({ length: 7 }, (_, i) => ({ wordKey: "w" + i, bucket: "A1|review", count: 1 })); },
    s => { s.visited.eiffel.learning.samples[0].bucket = "unknown"; },
    s => { delete s.characters.lumie; },
    s => { s.characters.lumie.placeId = "seine"; },
    s => { s.characters.lumie.metAt = iso; }
  ];
  for (const mutate of mutations) {
    const bad = clone(p); mutate(bad.adventure);
    const before = JSON.stringify(bad);
    assert.equal(Adventure.status(bad).ok, false, String(mutate));
    assert.equal(Adventure.ensure(bad, NOW), null);
    assert.equal(JSON.stringify(bad), before);
  }
});

test("omitted or unusable attribution becomes unknown instead of fabricating a level or review", () => {
  const p = profile();
  [undefined, {}, { level: "future", review: true, wordKey: "x" }, { level: "A1", review: "yes", wordKey: "x" }].forEach((context, index) => Adventure.addCorrect(p, "unknown:" + index, NOW, context));
  assert.deepEqual(summary(p.adventure.pendingLearning), { countsByLevel: { unknown: 4 }, reviewCount: 0, sampleKeys: [], total: 4 });
  check(p);
});

test("browser UMD exports the catalog and every route has an equal-cost reverse route without level locks", () => {
  const browser = { window: {} }; browser.globalThis = browser.window;
  for (const file of ["world-data.js", "adventure.js"]) vm.runInNewContext(readFileSync(join(__dirname, "../" + file), "utf8"), browser);
  assert.equal(typeof browser.window.Adventure.ensure, "function");
  assert.equal(typeof browser.window.Adventure.summarizeLearning, "function");
  assert.deepEqual(new Set(Adventure.nodes.map(n => n.id)), new Set(["trocadero", "seine", "eiffel", "champ-de-mars", "mont-saint-michel", "chambord", "versailles", "marseille"]));
  assert.equal(Adventure.edges.length, 54);
  for (const edge of Adventure.edges) {
    assert.equal(edge.id, edge.from + "--" + edge.to);
    const reverse = Adventure.edges.find(other => other.from === edge.to && other.to === edge.from);
    assert.equal(reverse.cost, edge.cost);
    assert.deepEqual(Object.keys(edge).sort(), ["cost", "from", "id", "to"]);
    const p = profile();
    if (edge.from === "trocadero") assert.equal(Adventure.selectPath(p, edge.id, NOW).changed, true);
  }
  assert.ok(Object.isFrozen(Adventure.nodes));
  assert.ok(Adventure.edges.every(Object.isFrozen));
});

test("the twenty-eight old directed routes retain their IDs and costs in the expanded graph", () => {
  const pairs = [["trocadero", "seine", 3], ["trocadero", "eiffel", 8], ["seine", "eiffel", 8], ["eiffel", "champ-de-mars", 8], ["seine", "champ-de-mars", 8], ["mont-saint-michel", "chambord", 48]];
  for (const from of ["trocadero", "seine", "eiffel", "champ-de-mars"]) pairs.push([from, "mont-saint-michel", 48], [from, "chambord", 24]);
  const expected = pairs.flatMap(([from, to, cost]) => [{ id: from + "--" + to, from, to, cost }, { id: to + "--" + from, from: to, to: from, cost }]);
  assert.equal(expected.length, 28);
  for (const edge of expected) assert.deepEqual(Adventure.edges.find(current => current.id === edge.id), edge);
  assert.equal(new Set(Adventure.edges.map(edge => edge.id)).size, 54);
  for (const place of ["trocadero", "seine", "eiffel", "champ-de-mars"]) assert.equal(Adventure.edges.find(edge => edge.id === place + "--versailles").cost, 16);
  assert.equal(Adventure.edges.find(edge => edge.id === "versailles--chambord").cost, 24);
  assert.equal(Adventure.edges.find(edge => edge.id === "versailles--mont-saint-michel").cost, 48);
  for (const place of Adventure.nodes.filter(node => node.id !== "marseille")) assert.equal(Adventure.edges.find(edge => edge.id === place.id + "--marseille").cost, 48);
});

test("actual v38 schema-two active journey loads byte-for-byte without a migration or progress change", () => {
  const p = { adventure: legacyV38ActiveJourney() };
  const original = JSON.stringify(p);
  const state = p.adventure;
  assert.equal(Adventure.ensure(p, NOW + 999999), state);
  assert.equal(JSON.stringify(p), original);
  assert.equal(p.adventure.schemaVersion, 2);
  assert.equal(Object.hasOwn(p.adventure, "legacyJourney"), false);
  assert.equal(Adventure.addCorrect(p, "v38-a:9", NOW).added, false);
  assert.equal(JSON.stringify(p), original);
  assert.equal(Adventure.addCorrect(p, "continued:0", NOW, { level: "A1", review: true, wordKey: "bonjour::こんにちは" }).added, true);
  assert.equal(p.adventure.activeLeg.progressUnits, 3);
  assert.equal(p.adventure.spentUnits, 8);
  assert.equal(p.adventure.characters.lumie.metAt, "2026-10-05T00:00:00.007Z");
  check(p);
});

test("new first visits register Miro and Sol once and revisits preserve both footprints", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--versailles", NOW);
  correct(p, 16, "versailles", { level: "B1", review: true, wordKey: "château::城" });
  assert.equal(p.adventure.currentNodeId, "versailles");
  assert.deepEqual(p.adventure.characters.miro, { metAt: new Date(NOW + 15).toISOString(), placeId: "versailles" });
  Adventure.selectPath(p, "versailles--marseille", NOW);
  correct(p, 48, "marseille", { level: "A1", review: false, wordKey: "mer::海" });
  assert.deepEqual(p.adventure.characters.sol, { metAt: new Date(NOW + 47).toISOString(), placeId: "marseille" });
  const visits = clone(p.adventure.visited), collection = clone(p.adventure.characters);
  Adventure.returnTo(p, "trocadero");
  assert.equal(Adventure.selectPath(p, "trocadero--versailles", NOW).changed, false);
  Adventure.returnTo(p, "versailles"); Adventure.returnTo(p, "marseille");
  assert.deepEqual(p.adventure.visited, visits);
  assert.deepEqual(p.adventure.characters, collection);
  assert.equal(p.adventure.earnedUnits, 64);
  assert.equal(p.adventure.spentUnits, 64);
  assert.equal(summary(visits.versailles.learning).reviewCount, 16);
  assert.equal(summary(visits.marseille.learning).reviewCount, 0);
  check(p);
});

test("switching a long Marseille route to Versailles and returning refunds exact unfinished learning", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--marseille", NOW);
  correct(p, 17, "long", { level: "C2", review: true, wordKey: "voyage::旅" });
  const before = bucketTotals(p);
  assert.deepEqual(Adventure.selectPath(p, "trocadero--versailles", NOW), { changed: true, arrived: "versailles" });
  assert.equal(p.adventure.spentUnits, 16);
  assert.equal(p.adventure.pendingUnits, 1);
  assert.equal(p.adventure.characters.sol, undefined);
  Adventure.selectPath(p, "versailles--marseille", NOW);
  correct(p, 2, "continued", { level: "A1", review: false, wordKey: "sud::南" });
  assert.equal(p.adventure.activeLeg.progressUnits, 3);
  Adventure.returnTo(p, "trocadero");
  assert.equal(p.adventure.pendingUnits, 3);
  assert.equal(p.adventure.spentUnits, 16);
  assert.equal(p.adventure.activeLeg, null);
  assert.deepEqual(bucketTotals(p), { ...before, "A1|regular": 2 });
  assert.deepEqual(summary(p.adventure.pendingLearning).countsByLevel, { A1: 2, C2: 1 });
  check(p);
});

test("an already migrated version-one archive is not credited a second time after the map expands", () => {
  const p = { adventure: legacyV1() };
  Adventure.ensure(p, NOW);
  Adventure.selectPath(p, "trocadero--seine", NOW);
  const archived = clone(p.adventure.legacyJourney);
  const before = JSON.stringify(p);
  Adventure.ensure(p, NOW + 1000);
  assert.equal(JSON.stringify(p), before);
  assert.equal(p.adventure.earnedUnits, 7);
  assert.equal(p.adventure.spentUnits, 3);
  assert.equal(p.adventure.pendingUnits, 4);
  Adventure.selectPath(p, "seine--versailles", NOW);
  assert.equal(p.adventure.activeLeg.progressUnits, 4);
  assert.deepEqual(p.adventure.legacyJourney, archived);
  check(p);
});
