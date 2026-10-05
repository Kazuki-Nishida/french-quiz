"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Guide = require("../study-guide.js");
const UIJa = require("../ui-ja.js");
const { WORDS } = require("../words.js");

const wordSnapshot = JSON.stringify(WORDS);
const key = word => word.fr + "::" + word.ja;
const pool = unit => WORDS.filter(word => word.lv === unit.lv && word.cat === unit.cat);
const record = (profile, words, result) => words.forEach(word => { profile.words[key(word)] = { c: result ? 1 : 0, w: result ? 0 : 1 }; });

// The guide is a complete ordered projection of the real curriculum, not sample units.
assert.equal(Guide.units.length, 30);
assert.equal(new Set(Guide.units.map(unit => unit.id)).size, 30);
for (const lv of ["ぶんぽう1", "ぶんぽう2", "ぶんぽう3"]) {
  const units = Guide.forLevel(lv);
  const actualCategories = [...new Set(WORDS.filter(word => word.lv === lv).map(word => word.cat))];
  assert.deepEqual(units.map(unit => unit.cat), actualCategories);
  assert.equal(units.length, 10);
  for (const unit of units) {
    assert.equal(pool(unit).length, 10, unit.id + " must contain the ten existing questions");
    assert.equal(Guide.getUnit(unit.id), unit);
    assert.ok(unit.title && unit.reading);
    assert.deepEqual(Guide.progress(null, unit, WORDS), { attempted: 0, total: 10, complete: false });
  }
}

const first = Guide.units[0];
const firstWords = pool(first);
const firstThree = { words: {} };
record(firstThree, firstWords.slice(0, 2), true);
record(firstThree, firstWords.slice(2, 3), false);
assert.deepEqual(Guide.progress(firstThree, first, WORDS), { attempted: 3, total: 10, complete: false });
assert.equal(Guide.recommended(firstThree, WORDS), first, "three-question introduction cannot finish a ten-question unit");

// Old saved history is reused immediately, including wrong-only attempts.
const oldProfile = { words: {}, stock: [key(firstWords[0])], daily: { "2026-10-03": { q: 10, c: 0 } } };
record(oldProfile, firstWords, false);
const oldSnapshot = JSON.stringify(oldProfile);
assert.deepEqual(Guide.progress(oldProfile, first.id, WORDS), { attempted: 10, total: 10, complete: true });
assert.equal(Guide.recommended(oldProfile, WORDS), Guide.units[1]);
assert.equal(JSON.stringify(oldProfile), oldSnapshot, "reading the guide must not rewrite the old profile");

// Advice never controls access. Upper-level units can be selected with no beginner history.
const upper = Guide.forLevel("ぶんぽう3")[0];
const upperOnly = { words: {} };
record(upperOnly, pool(upper), true);
assert.equal(Guide.getUnit(upper.id), upper);
assert.deepEqual(Guide.progress(upperOnly, upper, WORDS), { attempted: 10, total: 10, complete: true });
assert.equal(Guide.recommended(upperOnly, WORDS), first);
assert.equal(Guide.forLevel("ぶんぽう3").length, 10);
assert.equal(Object.hasOwn(upper, "locked"), false);

// Repeated answers to one question do not count as ten different questions.
const repeated = { words: { [key(firstWords[0])]: { c: 99, w: 1 } } };
assert.deepEqual(Guide.progress(repeated, first, WORDS), { attempted: 1, total: 10, complete: false });
assert.equal(Guide.progress({ words: { [key(firstWords[0])]: { c: 0, w: 0 } } }, first, WORDS).attempted, 0);
assert.equal(Guide.progress({ words: { [key(firstWords[0])]: { w: 1 } } }, first, WORDS).attempted, 1);

const completed = { words: {} };
record(completed, WORDS.filter(word => word.pos === "gram"), false);
assert.equal(Guide.recommended(completed, WORDS), null);
assert.equal(Guide.recommended({}, []), null);
assert.equal(Guide.getUnit("missing"), null);
assert.deepEqual(Guide.forLevel("A1"), []);
assert.deepEqual(Guide.progress({}, "missing", WORDS), { attempted: 0, total: 0, complete: false });
assert.deepEqual(Guide.progress({}, first, []), { attempted: 0, total: 0, complete: false });
assert.equal(JSON.stringify(WORDS), wordSnapshot, "guidance must preserve every original curriculum field");

// Display helpers accept plain text only and cannot inject HTML through names/readings.
assert.equal(UIJa.ruby("<文法>&\"'", "<よみ>&\"'"), "<ruby>&lt;文法&gt;&amp;&quot;&#39;<rp>（</rp><rt>&lt;よみ&gt;&amp;&quot;&#39;</rt><rp>）</rp></ruby>");
assert.equal(UIJa.ruby("<名前>", ""), "&lt;名前&gt;");
assert.match(UIJa.level("C2"), /単語/);
assert.match(UIJa.level("ぶんぽう3"), /上級/);
assert.match(UIJa.level("はなし3"), /会話/);
assert.equal(UIJa.level("<unknown>"), "&lt;unknown&gt;");
assert.equal(UIJa.apply(null), 0);

// Plain script tags expose browser APIs without requiring a build step or module loader.
const browser = {};
for (const filename of ["study-guide.js", "ui-ja.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), browser, { filename });
}
assert.equal(browser.StudyGuide.units.length, 30);
assert.equal(typeof browser.UIJa.apply, "function");
assert.equal(browser.StudyGuide.getUnit(upper.id).lv, "ぶんぽう3");

console.log("StudyGuide: 30 real units, legacy history, introduction, free upper-level access, and display helpers passed.");
