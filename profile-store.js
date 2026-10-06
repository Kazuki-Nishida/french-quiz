(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfileStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = { sound: true, kana: true, voiceGender: 'f', voiceName: null, quizMode: 'new' };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  function empty() { return { profiles: [], active: null, settings: { ...defaults } }; }
  function prepare(raw, adventure, options = {}) {
    if (!object(raw) || !Array.isArray(raw.profiles)) throw new Error('プロフィールの形式が違います。');
    const data = JSON.parse(JSON.stringify(raw));
    if (data.settings !== undefined && !object(data.settings)) throw new Error('設定の形式が違います。');
    data.settings = { ...defaults, ...data.settings };
    const ids = new Set();
    data.profiles.forEach(p => {
      if (!object(p) || !['string', 'number'].includes(typeof p.id) || ids.has(p.id) ||
          typeof p.name !== 'string' || typeof p.avatar !== 'string') throw new Error('プロフィールを確認してください。');
      ids.add(p.id);
      // XP starts when this feature is introduced. Existing quiz and journey
      // counts are preserved, never converted into historical XP estimates.
      if (!Object.prototype.hasOwnProperty.call(p, 'xp')) p.xp = 0;
      if (!count(p.xp)) throw new Error('XPの記録を確認してください。');
      if (!object(p.words) || !object(p.daily) || !Array.isArray(p.stock) || p.stock.some(k => typeof k !== 'string'))
        throw new Error('学習記録の形式が違います。');
      Object.values(p.words).forEach(s => {
        if (!object(s) || !count(s.c) || !count(s.w)) throw new Error('単語の記録を確認してください。');
      });
      Object.values(p.daily).forEach(d => {
        if (!object(d) || !count(d.q) || !count(d.c) || d.c > d.q) throw new Error('日別の記録を確認してください。');
      });
      if (adventure) {
        const state = adventure.ensure(p);
        if (!state && options.forImport) throw new Error('対応していない旅の記録です。元のファイルを保管してください。');
      }
      if (!Object.prototype.hasOwnProperty.call(p, 'studyGuide')) p.studyGuide = { schemaVersion: 1, lastGrammarUnitId: null };
      if (!guideAvailable(p) && options.forImport) throw new Error('対応していない文法案内の記録です。');
    });
    if (!ids.has(data.active)) data.active = null;
    return data;
  }
  function guideAvailable(p) {
    const g = p && p.studyGuide;
    return object(g) && g.schemaVersion === 1 && (g.lastGrammarUnitId === null || typeof g.lastGrammarUnitId === 'string');
  }
  // Commit the candidate first. A failed write never replaces the caller's live DB.
  function importData(text, storage, key, adventure) {
    const candidate = prepare(JSON.parse(text), adventure, { forImport: true });
    storage.setItem(key, JSON.stringify(candidate));
    return candidate;
  }
  return { empty, prepare, guideAvailable, importData };
});
