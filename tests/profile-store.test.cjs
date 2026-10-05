"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const ProfileStore = require("../profile-store.js");
const Adventure = require("../adventure.js");
const StudyGuide = require("../study-guide.js");
const { WORDS } = require("../words.js");

const LS_KEY = "frquiz-v1";
const NOW = Date.UTC(2026, 9, 5, 0, 0, 0);
const clone = value => JSON.parse(JSON.stringify(value));
const wordKey = word => word.fr + "::" + word.ja;
const firstUnit = StudyGuide.units[0];
const firstQuestions = WORDS.filter(word => word.lv === firstUnit.lv && word.cat === firstUnit.cat);

function legacyData() {
  return {
    profiles: [{
      id: 101,
      name: "テストの名前",
      avatar: "🦊",
      daily: { "2026-10-03": { q: 7, c: 5, extraDay: "keep" } },
      words: {
        [wordKey(firstQuestions[0])]: { c: 4, w: 1, extraWord: { source: "legacy" } },
        [wordKey(firstQuestions[1])]: { c: 0, w: 2 }
      },
      stock: [wordKey(firstQuestions[1]), "future-word::まだない教材"],
      tut: 1,
      extraProfile: ["keep", { flag: true }]
    }],
    active: 101,
    settings: { sound: false, kana: false, quizMode: "random", extraSetting: { value: 2 } },
    extraRoot: { from: "older-or-other-client", flags: [1, 2] }
  };
}

function memoryStorage(initial, fail = false) {
  const values = new Map(Object.entries(initial || {}));
  return {
    writes: 0,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      this.writes++;
      if (fail) throw new Error("QuotaExceededError");
      values.set(key, String(value));
    }
  };
}

function legacyJourney() {
  const at = new Date(NOW).toISOString();
  return {
    schemaVersion: 1, effectsMode: "calm", introCompleted: true,
    currentNodeId: "paris-start", earnedUnits: 5, spentUnits: 3, pendingUnits: 0,
    activeLeg: { edgeId: "paris-park", from: "paris-start", to: "park", requiredUnits: 3, progressUnits: 2, oldExtraLeg: true },
    visited: { "paris-start": { firstVisitedAt: at }, riverside: { firstVisitedAt: at, oldExtraVisit: true } },
    lastProgressEventId: "old-round:9", oldExtraJourney: { preserved: [1, 2] }
  };
}

test("old profiles preserve every existing field while adding defaults without changing input", () => {
  const raw = legacyData();
  const before = clone(raw);
  const result = ProfileStore.prepare(raw, Adventure);
  assert.deepEqual(raw, before, "prepare must not mutate the caller's old DB");
  assert.notEqual(result, raw);
  for (const [field, value] of Object.entries(before.profiles[0])) assert.deepEqual(result.profiles[0][field], value, field);
  for (const [field, value] of Object.entries(before.settings)) assert.deepEqual(result.settings[field], value, field);
  assert.deepEqual(result.extraRoot, before.extraRoot);
  assert.equal(result.active, 101);
  assert.equal(result.settings.voiceGender, "f");
  assert.equal(result.settings.voiceName, null);
  assert.equal(result.profiles[0].adventure.earnedUnits, 0, "legacy correct counts are not newly awarded travel progress");
  assert.equal(result.profiles[0].adventure.introCompleted, false);
  assert.ok(Adventure.status(result.profiles[0]).ok);
  assert.deepEqual(result.profiles[0].studyGuide, { schemaVersion: 1, lastGrammarUnitId: null });
  assert.deepEqual(StudyGuide.progress(result.profiles[0], firstUnit, WORDS), { attempted: 2, total: 10, complete: false });
});

test("JSON export/import round trip preserves current progress, preferences, visits, and unknown JSON fields", () => {
  const db = ProfileStore.prepare(legacyData(), Adventure);
  const profile = db.profiles[0];
  Adventure.selectPath(profile, "trocadero--seine", NOW);
  Adventure.addCorrect(profile, "round-a:0", NOW + 1);
  Adventure.addCorrect(profile, "round-a:1", NOW + 2);
  profile.adventure.effectsMode = "calm";
  profile.adventure.extraAdventure = { futureCosmetic: "star" };
  profile.adventure.activeLeg.extraLeg = ["keep"];
  profile.adventure.visited["trocadero"].extraVisit = true;
  profile.studyGuide.lastGrammarUnitId = StudyGuide.forLevel("ぶんぽう3")[0].id;
  profile.studyGuide.extraGuide = "keep";
  db.profiles.push({ id: "second", name: "もう一人", avatar: "🐰", words: {}, daily: {}, stock: [], extraProfile: 2 });
  Adventure.ensure(db.profiles[1], NOW);
  db.profiles[1].studyGuide = { schemaVersion: 1, lastGrammarUnitId: null };
  const exported = JSON.stringify(db, null, 1);
  const storage = memoryStorage();
  const imported = ProfileStore.importData(exported, storage, LS_KEY, Adventure);
  assert.deepEqual(imported, db);
  assert.deepEqual(JSON.parse(storage.getItem(LS_KEY)), db);
  assert.equal(storage.writes, 1);
  assert.notEqual(imported.profiles[0], db.profiles[0]);
  assert.equal(imported.profiles[0].adventure.activeLeg.progressUnits, 2);
  assert.equal(imported.profiles[1].adventure.earnedUnits, 0, "profiles stay independent");
  assert.equal(imported.profiles[0].studyGuide.lastGrammarUnitId, StudyGuide.forLevel("ぶんぽう3")[0].id);
});

test("round trip also preserves an arrival and surplus correct answers", () => {
  const db = ProfileStore.prepare(legacyData(), Adventure);
  const p = db.profiles[0];
  Adventure.selectPath(p, "trocadero--seine", NOW);
  for (let i = 0; i < 5; i++) Adventure.addCorrect(p, "round-b:" + i, NOW + i);
  p.adventure.introCompleted = true;
  const storage = memoryStorage();
  const imported = ProfileStore.importData(JSON.stringify(db), storage, LS_KEY, Adventure);
  assert.deepEqual(imported, db);
  assert.equal(imported.profiles[0].adventure.currentNodeId, "seine");
  assert.equal(imported.profiles[0].adventure.pendingUnits, 2);
  assert.equal(imported.profiles[0].adventure.spentUnits, 3);
  assert.equal(imported.profiles[0].adventure.activeLeg, null);
  assert.ok(imported.profiles[0].adventure.visited.seine);
});

test("a failed import save leaves both the live DB reference and previous storage unchanged", () => {
  let liveDB = ProfileStore.prepare(legacyData(), Adventure);
  const beforeReference = liveDB;
  const before = JSON.stringify(liveDB);
  const storage = memoryStorage({ [LS_KEY]: before }, true);
  const incoming = clone(liveDB);
  incoming.profiles[0].name = "読み込み候補";
  incoming.profiles[0].words[wordKey(firstQuestions[0])].c = 999;
  assert.throws(() => { liveDB = ProfileStore.importData(JSON.stringify(incoming), storage, LS_KEY, Adventure); }, /QuotaExceededError/);
  assert.equal(liveDB, beforeReference);
  assert.equal(JSON.stringify(liveDB), before);
  assert.equal(storage.getItem(LS_KEY), before);
  assert.equal(storage.writes, 1);
});

for (const field of ["adventure", "studyGuide"]) {
  test("unknown " + field + " schema is preserved on load and rejected before import writes", () => {
    const raw = legacyData();
    const unknown = { schemaVersion: 987, extra: { neverDiscard: true }, futureArray: [4, 5] };
    raw.profiles[0][field] = unknown;
    const before = clone(raw);
    const loaded = ProfileStore.prepare(raw, Adventure);
    assert.deepEqual(loaded.profiles[0][field], unknown);
    assert.deepEqual(raw, before);
    assert.deepEqual(loaded.profiles[0].words, raw.profiles[0].words);
    if (field === "adventure") assert.equal(Adventure.ensure(loaded.profiles[0]), null);
    else assert.equal(ProfileStore.guideAvailable(loaded.profiles[0]), false);
    const currentText = JSON.stringify(legacyData());
    const storage = memoryStorage({ [LS_KEY]: currentText });
    assert.throws(() => ProfileStore.importData(JSON.stringify(raw), storage, LS_KEY, Adventure), /対応していない/);
    assert.equal(storage.writes, 0);
    assert.equal(storage.getItem(LS_KEY), currentText);
    assert.deepEqual(loaded.profiles[0][field], unknown, "checking availability must also preserve the unknown data");
  });
}

test("an unknown route is retained on load and rejected on import", () => {
  const raw = ProfileStore.prepare(legacyData(), Adventure);
  Adventure.selectPath(raw.profiles[0], "trocadero--seine", NOW);
  raw.profiles[0].adventure.activeLeg.edgeId = "future-lyon-route";
  const previousAdventure = clone(raw.profiles[0].adventure);
  const loaded = ProfileStore.prepare(raw, Adventure);
  assert.deepEqual(loaded.profiles[0].adventure, previousAdventure);
  assert.equal(Adventure.status(loaded.profiles[0]).ok, false);
  const storage = memoryStorage();
  assert.throws(() => ProfileStore.importData(JSON.stringify(raw), storage, LS_KEY, Adventure), /対応していない旅/);
  assert.equal(storage.writes, 0);
});

const invalidCases = [
  ["negative correct count", db => { db.profiles[0].words[wordKey(firstQuestions[0])].c = -1; }],
  ["fractional wrong count", db => { db.profiles[0].words[wordKey(firstQuestions[0])].w = 0.5; }],
  ["string count", db => { db.profiles[0].words[wordKey(firstQuestions[0])].c = "2"; }],
  ["unsafe integer count", db => { db.profiles[0].words[wordKey(firstQuestions[0])].c = Number.MAX_SAFE_INTEGER + 1; }],
  ["missing word counter", db => { delete db.profiles[0].words[wordKey(firstQuestions[0])].w; }],
  ["null word record", db => { db.profiles[0].words[wordKey(firstQuestions[0])] = null; }],
  ["word records as array", db => { db.profiles[0].words = []; }],
  ["negative daily count", db => { db.profiles[0].daily["2026-10-03"].q = -1; }],
  ["more daily correct than answered", db => { db.profiles[0].daily["2026-10-03"].c = 8; }],
  ["daily records as array", db => { db.profiles[0].daily = []; }],
  ["missing daily counter", db => { delete db.profiles[0].daily["2026-10-03"].c; }],
  ["review list as object", db => { db.profiles[0].stock = {}; }],
  ["non-string review key", db => { db.profiles[0].stock.push({ word: "wrong-shape" }); }],
  ["duplicate profile ID", db => { db.profiles.push(clone(db.profiles[0])); }],
  ["missing profile name", db => { delete db.profiles[0].name; }],
  ["settings as array", db => { db.settings = []; }]
];

for (const [label, mutate] of invalidCases) {
  test("invalid learning/profile data is rejected without writes: " + label, () => {
    const candidate = legacyData();
    mutate(candidate);
    const before = JSON.stringify(candidate);
    const currentText = JSON.stringify(legacyData());
    const storage = memoryStorage({ [LS_KEY]: currentText });
    assert.throws(() => ProfileStore.prepare(candidate, Adventure));
    assert.equal(JSON.stringify(candidate), before, "rejection may not alter candidate data");
    assert.throws(() => ProfileStore.importData(before, storage, LS_KEY, Adventure));
    assert.equal(storage.writes, 0);
    assert.equal(storage.getItem(LS_KEY), currentText);
  });
}

test("invalid JSON and missing profiles are rejected before writes", () => {
  const storage = memoryStorage({ [LS_KEY]: "original" });
  for (const text of ["{broken", "null", "[]", "{}", '{"profiles":{}}']) {
    assert.throws(() => ProfileStore.importData(text, storage, LS_KEY, Adventure));
  }
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(LS_KEY), "original");
});

test("missing settings and dangling active ID are safely supplemented on a copy", () => {
  const raw = legacyData();
  delete raw.settings;
  raw.active = "not-in-profiles";
  const loaded = ProfileStore.prepare(raw, Adventure);
  assert.equal(loaded.active, null);
  assert.equal(raw.active, "not-in-profiles");
  assert.equal(raw.settings, undefined);
  assert.equal(loaded.settings.sound, true);
  assert.equal(loaded.settings.kana, true);
  assert.equal(loaded.settings.quizMode, "new");
});

test("version-one journey load migrates a copy, archives every old field, and never converts learning totals again", () => {
  const raw = legacyData();
  raw.profiles[0].adventure = legacyJourney();
  const original = clone(raw);
  const loaded = ProfileStore.prepare(raw, Adventure);
  assert.deepEqual(raw, original);
  const migrated = loaded.profiles[0].adventure;
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.currentNodeId, "trocadero");
  assert.equal(migrated.pendingUnits, 5);
  assert.equal(migrated.spentUnits, 0);
  assert.equal(migrated.activeLeg, null);
  assert.deepEqual(migrated.legacyJourney, original.profiles[0].adventure);
  assert.deepEqual(migrated.characters, {});
  assert.deepEqual(Object.keys(migrated.visited), ["trocadero"]);
  assert.deepEqual(Adventure.summarizeLearning(migrated.pendingLearning), { countsByLevel: { unknown: 5 }, reviewCount: 0, sampleKeys: [], total: 5 });
  assert.deepEqual(loaded.profiles[0].words, original.profiles[0].words);
  const storage = memoryStorage();
  const imported = ProfileStore.importData(JSON.stringify(loaded), storage, LS_KEY, Adventure);
  assert.deepEqual(imported, loaded);
  assert.deepEqual(ProfileStore.prepare(JSON.parse(storage.getItem(LS_KEY)), Adventure), loaded);
});

test("direct import of a valid old journey commits the migrated schema exactly once", () => {
  const raw = legacyData();
  raw.profiles[0].adventure = legacyJourney();
  const input = JSON.stringify(raw);
  const storage = memoryStorage({ [LS_KEY]: "original" });
  const imported = ProfileStore.importData(input, storage, LS_KEY, Adventure);
  assert.equal(storage.writes, 1);
  assert.equal(imported.profiles[0].adventure.schemaVersion, 2);
  assert.equal(imported.profiles[0].adventure.pendingUnits, 5);
  assert.deepEqual(imported.profiles[0].adventure.legacyJourney, raw.profiles[0].adventure);
  assert.deepEqual(JSON.parse(storage.getItem(LS_KEY)), imported);
  assert.equal(JSON.stringify(raw), input);
});

test("failed storage while importing an old journey preserves the old storage and input exactly", () => {
  const raw = legacyData();
  raw.profiles[0].adventure = legacyJourney();
  const before = JSON.stringify(raw);
  const storage = memoryStorage({ [LS_KEY]: before }, true);
  assert.throws(() => ProfileStore.importData(before, storage, LS_KEY, Adventure), /QuotaExceededError/);
  assert.equal(storage.getItem(LS_KEY), before);
  assert.equal(JSON.stringify(raw), before);
});

test("invalid old journeys remain intact on load and fail import before any storage write", () => {
  const raw = legacyData();
  raw.profiles[0].adventure = legacyJourney();
  raw.profiles[0].adventure.earnedUnits = 999;
  const previous = clone(raw.profiles[0].adventure);
  const loaded = ProfileStore.prepare(raw, Adventure);
  assert.deepEqual(loaded.profiles[0].adventure, previous);
  assert.equal(Adventure.status(loaded.profiles[0]).ok, false);
  const storage = memoryStorage({ [LS_KEY]: "original" });
  assert.throws(() => ProfileStore.importData(JSON.stringify(raw), storage, LS_KEY, Adventure), /対応していない旅/);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(LS_KEY), "original");
});

test("character collection and mixed learning footprints round trip with pending progress and two profiles", () => {
  const db = ProfileStore.prepare(legacyData(), Adventure);
  const p = db.profiles[0];
  Adventure.selectPath(p, "trocadero--eiffel", NOW);
  for (let i = 0; i < 11; i++) Adventure.addCorrect(p, "visit:" + i, NOW + i, { level: i % 2 ? "A1" : "C2", review: i % 3 === 0, wordKey: "word-" + i });
  p.adventure.characters.lumie.extraCharacter = "keep";
  p.adventure.visited.eiffel.learning.extraLearning = "keep";
  const second = clone(legacyData().profiles[0]); second.id = 102;
  db.profiles.push(second);
  Adventure.ensure(second, NOW);
  second.studyGuide = { schemaVersion: 1, lastGrammarUnitId: null };
  const storage = memoryStorage();
  const imported = ProfileStore.importData(JSON.stringify(db), storage, LS_KEY, Adventure);
  assert.deepEqual(imported, db);
  assert.equal(imported.profiles[0].adventure.pendingUnits, 3);
  assert.equal(Adventure.summarizeLearning(imported.profiles[0].adventure.visited.eiffel.learning).total, 8);
  assert.equal(Adventure.summarizeLearning(imported.profiles[0].adventure.pendingLearning).total, 3);
  assert.deepEqual(imported.profiles[1].adventure.characters, {});
  assert.equal(imported.profiles[0].adventure.characters.lumie.extraCharacter, "keep");
  assert.equal(imported.profiles[0].adventure.visited.eiffel.learning.extraLearning, "keep");
});

test("inconsistent footprints and fabricated character locations fail import without replacing good storage", () => {
  const good = ProfileStore.prepare(legacyData(), Adventure);
  Adventure.selectPath(good.profiles[0], "trocadero--eiffel", NOW);
  for (let i = 0; i < 8; i++) Adventure.addCorrect(good.profiles[0], "visit:" + i, NOW + i, { level: "B2", review: true, wordKey: "mot" });
  for (const mutate of [
    s => { s.visited.eiffel.learning.buckets["B2|review"] = 7; },
    s => { s.visited.eiffel.learning.samples[0].count = 9; },
    s => { s.characters.lumie.placeId = "chambord"; },
    s => { delete s.characters.lumie; }
  ]) {
    const bad = clone(good); mutate(bad.profiles[0].adventure);
    const before = JSON.stringify(bad);
    const goodText = JSON.stringify(good);
    const storage = memoryStorage({ [LS_KEY]: goodText });
    assert.throws(() => ProfileStore.importData(before, storage, LS_KEY, Adventure), /対応していない旅/);
    assert.equal(storage.writes, 0);
    assert.equal(storage.getItem(LS_KEY), goodText);
    assert.equal(JSON.stringify(bad), before);
  }
});
