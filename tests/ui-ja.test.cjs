"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const UIJa = require("../ui-ja.js");
const World = require("../world-data.js");
const Guide = require("../study-guide.js");
const bases = html => [...html.matchAll(/<ruby>(.*?)<rp>/g)].map(match => match[1]);
const readings = html => [...html.matchAll(/<rt>(.*?)<\/rt>/g)].map(match => match[1]);

test("Japanese kana names remain plain, including all-katakana character names", () => {
  for (const text of ["トロカデロ", "パリ", "モン・サン・ミシェル", "ルミエ", "マレ", "プリュム", "ソル", "ミロ", "あいさつ"]) {
    assert.equal(UIJa.ruby(text, text), text);
  }
});

test("mixed place names annotate their kanji without repeating katakana", () => {
  const cases = [
    ["エッフェル塔", "エッフェルとう", ["塔"], ["とう"]],
    ["セーヌ川（イエナ橋）", "セーヌがわ（イエナばし）", ["川", "橋"], ["がわ", "ばし"]],
    ["マルセイユ旧港", "マルセイユきゅうこう", ["旧港"], ["きゅうこう"]],
    ["ヴェルサイユ宮殿", "ヴェルサイユきゅうでん", ["宮殿"], ["きゅうでん"]],
    ["羽ペンの帽子", "はねペンのぼうし", ["羽", "帽子"], ["はね", "ぼうし"]]
  ];
  for (const [text, reading, expectedBases, expectedReadings] of cases) {
    const html = UIJa.ruby(text, reading);
    assert.deepEqual(bases(html), expectedBases);
    assert.deepEqual(readings(html), expectedReadings);
  }
});

test("all catalog labels and grammar titles keep their kanji readings without kana ruby bases", () => {
  const labels = [...World.nodes, ...World.regions, ...World.characters].map(item => [item.name, item.reading])
    .concat(World.nodes.flatMap(item => item.recommendations.map(rec => [rec.label, rec.labelReading])), Guide.units.map(unit => [unit.title, unit.reading]));
  for (const [text, reading] of labels) {
    const annotations = bases(UIJa.ruby(text, reading));
    assert.ok(annotations.every(base => !/[\u3040-\u30ff]/.test(base)), text);
    const kanji = (text.match(/[\u3400-\u9fff々〆〇]+/g) || []).join("");
    assert.equal(annotations.filter(base => /[\u3400-\u9fff々〆〇]/.test(base)).join(""), kanji, text);
  }
});

test("foreign grammar pronunciation aids remain available without annotating nearby kana", () => {
  assert.deepEqual(readings(UIJa.ruby("être", "エートル")), ["エートル"]);
  assert.deepEqual(bases(UIJa.ruby("y と en", "イとアン")), ["y", "en"]);
  assert.deepEqual(readings(UIJa.ruby("y と en", "イとアン")), ["イ", "アン"]);
  assert.deepEqual(bases(UIJa.ruby("allerと行き先", "アレといきさき")), ["aller", "行", "先"]);
  assert.deepEqual(readings(UIJa.ruby("複合過去（avoir）", "ふくごうかこ（アヴォワール）")), ["ふくごうかこ", "アヴォワール"]);
  assert.deepEqual(readings(UIJa.ruby("-er動詞", "エーアールどうし")), ["エーアール", "どうし"]);
});

test("reviewed labels do not mistake kana inside a word for the following particle", () => {
  const cases = [
    ["乗り物の言葉", "のりもののことば", ["乗", "物", "言葉"], ["の", "もの", "ことば"]],
    ["食べ物の言葉", "たべもののことば", ["食", "物", "言葉"], ["た", "もの", "ことば"]],
    ["物語の言葉", "ものがたりのことば", ["物語", "言葉"], ["ものがたり", "ことば"]],
    ["庭園と「鏡の回廊」がある宮殿。回廊では窓の向かいに鏡が並びます。", "ていえんと「かがみのかいろう」があるきゅうでん。かいろうではまどのむかいにかがみがならびます。", ["庭園", "鏡", "回廊", "宮殿", "回廊", "窓", "向", "鏡", "並"], ["ていえん", "かがみ", "かいろう", "きゅうでん", "かいろう", "まど", "む", "かがみ", "なら"]]
  ];
  for (const [text, reading, expectedBases, expectedReadings] of cases) {
    const html = UIJa.ruby(text, reading);
    assert.deepEqual(bases(html), expectedBases, text);
    assert.deepEqual(readings(html), expectedReadings, text);
    assert.equal(html.replace(/<rp>.*?<\/rp>|<rt>.*?<\/rt>|<\/?ruby>/g, ""), text, "base text stays intact");
  }
});

test("a future ambiguous label is not assigned either the shortest or longest guess", () => {
  // Correct: 花(はな)の野原(のはら). Greedy matching incorrectly makes
  // 花=はなの / 野原=はら, so switching all matching to greedy is not a fix.
  assert.equal(UIJa.ruby("花の野原", "はなののはら"), "花の野原");
  assert.equal(UIJa.ruby("物の言葉", "もののことば"), "物の言葉");
  assert.equal(UIJa.ruby("乗り物の言葉", "のりもののべつ"), "乗り物の言葉", "an explicit split still must match the supplied whole reading");
});

test("current recommendation readings are verified per kanji span, not just by text coverage", () => {
  const expected = {
    "あいさつ": [], "道案内の会話": ["みちあんない", "かいわ"], "allerと行き先": ["アレ", "い", "さき"],
    "自然の言葉": ["しぜん", "ことば"], "乗り物の言葉": ["の", "もの", "ことば"],
    "数の言葉": ["かず", "ことば"], "街の言葉": ["まち", "ことば"], "形容詞の性・数": ["けいようし", "せい", "すう"],
    "食べ物の言葉": ["た", "もの", "ことば"], "遊びの会話": ["あそ", "かいわ"], "天気の会話": ["てんき", "かいわ"],
    "これからのことを話す文法": ["はな", "ぶんぽう"], "物語の言葉": ["ものがたり", "ことば"],
    "過去のことを話す文法": ["かこ", "はな", "ぶんぽう"], "レストランの会話": ["かいわ"],
    "色の言葉": ["いろ", "ことば"], "家や部屋の言葉": ["いえ", "へや", "ことば"], "比べて話す文法": ["くら", "はな", "ぶんぽう"]
  };
  for (const node of World.nodes) for (const rec of node.recommendations) {
    assert.ok(Object.hasOwn(expected, rec.label), "review the reading of a new recommendation: " + rec.label);
    assert.deepEqual(readings(UIJa.ruby(rec.label, rec.labelReading)), expected[rec.label], rec.label);
  }
});

test("all thirty grammar titles retain their reviewed readings including kana-delimited compounds", () => {
  const expected = [
    ["エートル"], ["アヴォワール"], ["ふていかんし"], ["ていかんし"], ["アレ", "い", "さき"], ["エーアール", "どうし"],
    ["ひていぶん"], ["ぎもんし"], ["しょゆうけいようし"], ["けいようし", "せい", "すう"],
    ["ふくごうかこ", "アヴォワール"], ["ふくごうかこ", "エートル"], ["はんかこ"], ["ぶぶんかんし"], ["だいめいどうし"],
    ["もくてきごだいめいし"], ["たんじゅんみらい"], ["ひかくきゅう", "さいじょうきゅう"], ["イ", "アン"], ["ふきそくどうし"],
    ["じょうけんほう"], ["せつぞくほう"], ["かんけいだいめいし"], ["じゅどうたい"], ["ぶんし"], ["だいかこ"],
    ["シ", "かていひょうげん"], ["かんせつわほう"], ["しえき"], ["きょうちょう", "ひょうげん"]
  ];
  assert.equal(Guide.units.length, expected.length);
  Guide.units.forEach((unit, index) => assert.deepEqual(readings(UIJa.ruby(unit.title, unit.reading)), expected[index], unit.title));
});

test("labels remain escaped and a mismatched reading is never guessed", () => {
  assert.equal(UIJa.ruby("エッフェル塔", "よめない"), "エッフェル塔");
  assert.equal(UIJa.ruby('<マレ>&"', 'マレ'), '&lt;マレ&gt;&amp;&quot;');
  assert.equal(UIJa.ruby('文法', '<よみ>&"'), '<ruby>文法<rp>（</rp><rt>&lt;よみ&gt;&amp;&quot;</rt><rp>）</rp></ruby>');
});
