/* Grammar guidance uses existing curriculum identifiers; it never locks a unit. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.StudyGuide = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const definitions = [
    ["ぶんぽう1", [
      ["etre", "エートル", "être", "エートル"],
      ["avoir", "アヴォワール", "avoir", "アヴォワール"],
      ["indefinite", "かんし", "不定冠詞", "ふていかんし"],
      ["definite", "ていかんし", "定冠詞", "ていかんし"],
      ["aller", "アレ", "allerと行き先", "アレといきさき"],
      ["er-verbs", "どうし", "-er動詞", "エーアールどうし"],
      ["negative", "ひてい", "否定文", "ひていぶん"],
      ["questions", "ぎもん", "疑問詞", "ぎもんし"],
      ["possessive", "しょゆう", "所有形容詞", "しょゆうけいようし"],
      ["adjectives", "けいようし", "形容詞の性・数", "けいようしのせい・すう"]
    ]],
    ["ぶんぽう2", [
      ["past-avoir", "ふくごうかこ", "複合過去（avoir）", "ふくごうかこ（アヴォワール）"],
      ["past-etre", "エートルかこ", "複合過去（être）", "ふくごうかこ（エートル）"],
      ["imperfect", "はんかこ", "半過去", "はんかこ"],
      ["partitive", "ぶぶんかんし", "部分冠詞", "ぶぶんかんし"],
      ["reflexive", "だいめいどうし", "代名動詞", "だいめいどうし"],
      ["pronouns", "だいめいし", "目的語代名詞", "もくてきごだいめいし"],
      ["future", "みらい", "単純未来", "たんじゅんみらい"],
      ["comparison", "ひかく", "比較級・最上級", "ひかくきゅう・さいじょうきゅう"],
      ["y-en", "y と en", "y と en", "イとアン"],
      ["irregular", "ふきそく", "不規則動詞", "ふきそくどうし"]
    ]],
    ["ぶんぽう3", [
      ["conditional", "じょうけんほう", "条件法", "じょうけんほう"],
      ["subjunctive", "せつぞくほう", "接続法", "せつぞくほう"],
      ["relative", "かんけいし", "関係代名詞", "かんけいだいめいし"],
      ["passive", "うけみ", "受動態", "じゅどうたい"],
      ["gerund", "ジェロンディフ", "ジェロンディフ・分詞", "ジェロンディフ・ぶんし"],
      ["pluperfect", "だいかこ", "大過去", "だいかこ"],
      ["si", "かてい", "siの仮定表現", "シのかていひょうげん"],
      ["reported", "かんせつわほう", "間接話法", "かんせつわほう"],
      ["causative", "しえき", "使役", "しえき"],
      ["emphasis", "きょうちょう", "強調などの表現", "きょうちょうなどのひょうげん"]
    ]]
  ];

  const units = Object.freeze(definitions.flatMap(function (group, index) {
    return group[1].map(function (entry) {
      return Object.freeze({
        id: "grammar-" + (index + 1) + "-" + entry[0],
        lv: group[0], cat: entry[1], title: entry[2], reading: entry[3]
      });
    });
  }));
  const byId = new Map(units.map(function (unit) { return [unit.id, unit]; }));

  function getUnit(id) { return byId.get(id) || null; }
  function forLevel(lv) { return units.filter(function (unit) { return unit.lv === lv; }); }

  function progress(profile, unit, words) {
    const target = getUnit(typeof unit === "string" ? unit : unit && unit.id);
    if (!target || !Array.isArray(words)) return { attempted: 0, total: 0, complete: false };
    const pool = words.filter(function (word) { return word.lv === target.lv && word.cat === target.cat; });
    const history = profile && profile.words || {};
    const attempted = pool.reduce(function (count, word) {
      // Keep the legacy fr::ja identity exactly, including punctuation and spaces.
      const key = word.fr + "::" + word.ja;
      const record = Object.prototype.hasOwnProperty.call(history, key) ? history[key] : null;
      const correct = record && Number.isFinite(record.c) && record.c > 0 ? record.c : 0;
      const wrong = record && Number.isFinite(record.w) && record.w > 0 ? record.w : 0;
      return count + (correct + wrong > 0 ? 1 : 0);
    }, 0);
    return { attempted: attempted, total: pool.length, complete: pool.length > 0 && attempted === pool.length };
  }

  function recommended(profile, words) {
    // An empty/missing curriculum is not an invitation to start an empty unit.
    return units.find(function (unit) {
      const state = progress(profile, unit, words);
      return state.total > 0 && !state.complete;
    }) || null;
  }

  return Object.freeze({ units: units, getUnit: getUnit, forLevel: forLevel, progress: progress, recommended: recommended });
});
