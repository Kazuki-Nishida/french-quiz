"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const Adventure = require("../adventure.js");
const WorldData = require("../world-data.js");
const ProfileStore = require("../profile-store.js");
const StudyGuide = require("../study-guide.js");
const curriculum = require("../words.js");
const KEY = "frquiz-v1";
const json = value => JSON.parse(JSON.stringify(value));
let nextHarness = 0;

// A small, deliberately non-rendering DOM boundary. The production quiz,
// selection, feedback, result, navigation, and persistence functions run intact.
class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {};
    this.dataset = {}; this.listeners = {}; this.className = ""; this.hidden = false;
    this.value = ""; this.textContent = ""; this.parentNode = null;
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(n => !names.includes(n)).join(" "); },
      toggle: (name, force) => {
        const enabled = force === undefined ? !this.classList.contains(name) : force;
        enabled ? this.classList.add(name) : this.classList.remove(name);
        return enabled;
      }
    };
  }
  set innerHTML(value) { this.html = String(value); this.children = []; this.selectorNodes = new Map(); }
  get innerHTML() { return this.html || ""; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertAdjacentHTML(_where, value) { this.html = this.innerHTML + value; }
  querySelector(selector) {
    this.selectorNodes ||= new Map();
    if (!this.selectorNodes.has(selector)) this.selectorNodes.set(selector, new Element("button"));
    return this.selectorNodes.get(selector);
  }
  querySelectorAll(selector) { return this.children.filter(el => selector[0] === "." && el.classList.contains(selector.slice(1))); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  setAttribute(name, value) { this[name] = String(value); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(el => el !== this); }
  closest() { return null; }
  focus() {}
  scrollIntoView() {}
  click() { for (const callback of this.listeners.click || []) callback({ target: this, stopPropagation() {}, preventDefault() {} }); }
}

function legacyProfile(id = 1) {
  return { id, name: `テスト${id}`, avatar: "🦊", daily: {}, words: {}, stock: [], tut: 1 };
}

function harness(initial) {
  const elements = new Map(), createdElements = [], downloads = [], alerts = [], windowListeners = {};
  const document = {
    body: new Element("body"), listeners: {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement(tag) { const element = new Element(tag); createdElements.push(element); return element; },
    querySelector(selector) { return this.getElementById('selector:' + selector); },
    querySelectorAll(selector) {
      if (selector === "#opts .opt") return this.getElementById("opts").children;
      if (selector === ".confetti") return this.body.querySelectorAll(selector);
      return [];
    },
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  };
  const storage = { raw: initial === undefined ? JSON.stringify({ profiles: [legacyProfile()], active: 1, settings: {} }) : initial, fail: false, readFail: false, writes: 0 };
  const localStorage = {
    getItem(key) { assert.equal(key, KEY); if (storage.readFail) throw new Error('simulated read failure'); return storage.raw; },
    setItem(key, value) {
      assert.equal(key, KEY);
      if (storage.fail) throw new Error("simulated storage failure");
      storage.raw = value; storage.writes++;
    }
  };
  const timers = new Map(); let nextTimer = 0;
  const speech = [];
  const id = ++nextHarness; let round = 0;
  const context = vm.createContext({
    ...curriculum, Adventure, WorldData, ProfileStore, StudyGuide, document, localStorage,
    UIJa: { apply() {}, ruby: (base, reading) => `<ruby>${base}<rt>${reading}</rt></ruby>`, level: value => value },
    AdventureView: { renderMap() {}, renderScene() {}, renderResult() {}, renderJournal() {}, renderHomePreview() {}, renderNextStep() {} },
    crypto: { randomUUID: () => `harness-${id}-round-${++round}` },
    console, Date, Set, Map, Blob,
    URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test-' + downloads.length; }, revokeObjectURL() {} },
    FileReader: class { readAsText(file) { this.result = file.text; this.onload(); } },
    alert(message) { alerts.push(message); }, confirm: () => true,
    addEventListener(type, callback) { (windowListeners[type] ||= []).push(callback); },
    setTimeout(callback, delay) { const timer = ++nextTimer; timers.set(timer, { callback, delay }); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { getVoices: () => [{ name: "Audrey", lang: "fr-FR", voiceURI: "Audrey", localService: true }], cancel() {}, speak: value => speech.push(value.text) },
    matchMedia: () => ({ matches: false }), scrollTo() {}
  });
  context.window = context;
  const source = readFileSync(join(__dirname, "../app.js"), "utf8");
  const entry = "\n(function init(){";
  const entryAt = source.lastIndexOf(entry);
  assert.ok(entryAt > 0, "the known terminal UI entrypoint is present");
  assert.match(source.slice(entryAt), /^\n\(function init\(\)\{[\s\S]*\}\)\(\);\s*$/);
  // Skip only the terminal initial-screen bootstrap, not any application function.
  vm.runInContext(source.slice(0, entryAt), context, { filename: "app.js" });
  const run = code => vm.runInContext(code, context);
  const inspect = code => JSON.parse(run(`JSON.stringify(${code})`));
  const state = () => inspect("({db:DB,quiz:quiz,current:current,storageProblem:storageProblem})");
  function answer(ok = true) { run(ok ? "answer(quiz.qs[quiz.i].ansIdx)" : "answer((quiz.qs[quiz.i].ansIdx+1)%quiz.qs[quiz.i].opts.length)"); }
  function finish(correct = true) {
    const n = inspect("quiz.qs.length");
    for (let i = 0; i < n; i++) { answer(typeof correct === "function" ? correct(i) : correct); run("nextQ()"); }
  }
  function flushTimers() {
    const pending = [...timers.values()]; timers.clear();
    for (const timer of pending) timer.callback();
  }
  function dispatchStorage(event = {}) {
    for (const listener of windowListeners.storage || []) listener({ key: KEY, storageArea: localStorage, ...event });
  }
  function importText(text) {
    const target = { files: [{ text }], value: 'selected.json' };
    for (const listener of document.getElementById('importfile').listeners.change || []) listener({ target });
  }
  const pendingTimerDelays = () => [...timers.values()].map(timer => timer.delay);
  return { context, document, storage, speech, run, inspect, state, answer, finish, flushTimers, pendingTimerDelays, dispatchStorage, importText, downloads, createdElements, alerts };
}

test("actual quiz starts with three questions, saves intro completion before results, then starts ten", () => {
  const h = harness();
  h.run("Adventure.selectPath(prof(), 'trocadero--seine'); startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 3);
  h.answer(); h.run("nextQ()"); h.answer(); h.run("nextQ()"); h.answer();
  const persisted = JSON.parse(h.storage.raw).profiles[0];
  assert.equal(persisted.adventure.introCompleted, true);
  assert.equal(persisted.adventure.currentNodeId, "seine");
  assert.equal(persisted.adventure.earnedUnits, 3);
  assert.equal(h.inspect("current"), "scr-quiz", "the last explanation remains visible");
  h.run("nextQ(); startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 10);
  assert.equal(h.inspect("quiz.intro"), false);
});

test("answer, next and result repetition do not duplicate learning or travel", () => {
  const h = harness();
  h.run("startQuiz(false)");
  h.answer();
  const once = h.storage.raw;
  h.answer(); h.answer(false);
  assert.equal(h.storage.raw, once);
  h.run("nextQ(); nextQ()");
  assert.equal(h.inspect("quiz.i"), 1, "unanswered next question is not skipped");
  h.answer(); h.run("nextQ()"); h.answer(); h.run("nextQ()");
  const finished = h.storage.raw;
  h.run("showResult(); showResult(); nextQ(); answer(0)");
  assert.equal(h.storage.raw, finished);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 3);
  assert.equal(h.inspect("totalAnswered(prof())"), 3);
  assert.equal(h.inspect("quiz.results.length"), 3);
});

test("incorrect answers add stock without travel; one-question review clears it and preserves intro status", () => {
  const h = harness();
  h.run("startQuiz(false)");
  const key = h.inspect("wkey(quiz.qs[0].w)");
  h.answer(false);
  assert.deepEqual(h.inspect("prof().stock"), [key]);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 0);
  h.run("go('scr-home'); startQuiz(true)");
  assert.equal(h.inspect("quiz.qs.length"), 1);
  assert.equal(h.inspect("quiz.intro"), false);
  h.answer();
  assert.deepEqual(h.inspect("prof().stock"), []);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 1);
  assert.equal(h.inspect("prof().adventure.introCompleted"), false);
  assert.deepEqual(h.state().db.profiles[0].words[key], { c: 1, w: 1 });
  h.run("nextQ(); startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 3);
});

test("a saved interrupted round retains partial travel but starts a new question sequence", () => {
  const h = harness();
  h.run("prof().adventure.introCompleted=true; Adventure.selectPath(prof(),'trocadero--seine'); startQuiz(false)");
  h.answer(); h.run("nextQ()"); h.answer(false); h.run("nextQ()"); h.answer();
  const fresh = harness(h.storage.raw);
  assert.equal(fresh.inspect("quiz"), null);
  assert.equal(fresh.inspect("prof().adventure.activeLeg.progressUnits"), 2);
  assert.equal(fresh.inspect("totalAnswered(prof())"), 3);
  assert.equal(fresh.inspect("prof().stock.length"), 1);
  fresh.run("startQuiz(false)");
  assert.equal(fresh.inspect("quiz.i"), 0);
  assert.equal(fresh.inspect("quiz.qs.length"), 10);
  fresh.answer();
  assert.equal(fresh.inspect("prof().adventure.currentNodeId"), "seine");
});

test("profile ownership and screen guards reject stale answers without mutating either profile", () => {
  const data = { profiles: [legacyProfile(1), legacyProfile(2)], active: 1, settings: {} };
  const h = harness(JSON.stringify(data));
  h.run("startQuiz(false); DB.active=2");
  const before = h.inspect("DB");
  h.answer(); h.run("nextQ(); showResult()");
  assert.deepEqual(h.inspect("DB"), before);
  assert.equal(h.inspect("quiz.results.length"), 0);
  h.run("DB.active=1; go('scr-home'); answer(0)");
  assert.equal(h.inspect("quiz"), null);
  assert.deepEqual(h.inspect("DB.profiles"), before.profiles);
});

test("save failure leaves feedback available and retries the newest DB without re-scoring", () => {
  const h = harness();
  h.run("startQuiz(false); save()");
  const before = h.storage.raw;
  h.storage.fail = true;
  h.answer();
  assert.equal(h.storage.raw, before);
  assert.ok(h.inspect("storageProblem"));
  assert.equal(h.document.getElementById("nextwrap").style.display, "block");
  h.run("nextQ()"); h.answer(false); h.run("setEffects('calm')");
  assert.equal(h.inspect("totalAnswered(prof())"), 2);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 1);
  h.storage.fail = false;
  h.run("save(); save()");
  const persisted = JSON.parse(h.storage.raw).profiles[0];
  assert.equal(persisted.adventure.earnedUnits, 1);
  assert.equal(persisted.adventure.effectsMode, "calm");
  assert.equal(persisted.stock.length, 1);
  assert.equal(Object.values(persisted.daily).reduce((sum, day) => sum + day.q, 0), 2);
  assert.equal(h.inspect("storageProblem"), null);
});

test("advanced grammar is immediately selectable and a three-question intro does not complete its ten-question unit", () => {
  const h = harness();
  h.run("setup={dir:'jf',lv:'ぶんぽう3',unitId:'grammar-3-subjunctive'}; startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 3);
  assert.ok(h.inspect("quiz.qs.every(q=>q.w.lv==='ぶんぽう3' && q.w.cat==='せつぞくほう' && q.dir==='gram')"));
  h.finish(false);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 0);
  assert.deepEqual(h.inspect("StudyGuide.progress(prof(),'grammar-3-subjunctive',WORDS)"), { attempted: 3, total: 10, complete: false });
  h.run("startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 10);
});

test("changing visual intensity never redraws or re-scores the current question", () => {
  const h = harness();
  h.run("startQuiz(false)");
  h.answer();
  const question = h.inspect("({i:quiz.i,correct:quiz.correct,results:quiz.results,qs:quiz.qs,answered:quiz.answered})");
  h.run("setEffects('calm'); setEffects('rich')");
  assert.deepEqual(h.inspect("({i:quiz.i,correct:quiz.correct,results:quiz.results,qs:quiz.qs,answered:quiz.answered})"), question);
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 1);
});

test("leaving the quiz cancels the previous answer's pending pronunciation", () => {
  const h = harness();
  h.run("setup.dir='jf'; startQuiz(false)"); h.answer();
  h.run("go('scr-home')");
  h.flushTimers();
  assert.deepEqual(h.speech, []);
});

test("unsupported adventure data is preserved while ordinary quiz learning still works", () => {
  const p = legacyProfile(); p.adventure = { schemaVersion: 99, future: { preserve: true } };
  const h = harness(JSON.stringify({ profiles: [p], active: p.id, settings: {} }));
  h.run("startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 10);
  h.answer();
  assert.equal(h.inspect("totalAnswered(prof())"), 1);
  assert.deepEqual(JSON.parse(h.storage.raw).profiles[0].adventure, p.adventure);
});

test("review labels do not inherit the unrelated grammar unit selected before review", () => {
  const h = harness();
  h.run("setup={dir:'jf',lv:'ぶんぽう3',unitId:'grammar-3-subjunctive'}; prof().stock=[wkey(WORDS.find(w=>w.lv==='A1'))]; startQuiz(true)");
  const label = h.document.getElementById("quiz-subject").innerHTML;
  assert.ok(label.includes("A1"));
  assert.equal(label.includes("接続法"), false);
});

test("unsupported adventure formats default to restrained visual effects without rewriting them", () => {
  const p = legacyProfile(); p.adventure = { schemaVersion: 99, effectsMode: "rich", future: true };
  const h = harness(JSON.stringify({ profiles: [p], active: p.id, settings: {} }));
  assert.equal(h.run("richEffects()"), false);
  assert.deepEqual(h.inspect("prof().adventure"), p.adventure);
});

test("place recommendation selects only its real curriculum topic without changing the destination", () => {
  const h=harness();
  h.run("Adventure.selectPath(prof(),'trocadero--eiffel'); prof().adventure.introCompleted=true; selectRecommendation('eiffel-numbers'); startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"),10);
  assert.ok(h.inspect("quiz.qs.every(q=>q.w.lv==='A1' && q.w.cat==='かず')"));
  assert.equal(h.inspect("prof().adventure.activeLeg.to"),'eiffel');
  h.run("selectUnit(StudyGuide.getUnit('grammar-3-conditional')); startQuiz(false)");
  assert.equal(h.inspect("setup.recommendationId"),null);
  assert.ok(h.inspect("quiz.qs.every(q=>q.w.lv==='ぶんぽう3')"));
  assert.equal(h.inspect("prof().adventure.activeLeg.to"),'eiffel');
});

test("actual answers register a character and curriculum footprint once, and survive reload", () => {
  const h=harness();
  h.run("Adventure.selectPath(prof(),'trocadero--eiffel'); startQuiz(false)");
  h.finish();
  h.run("startQuiz(false)");
  for(let i=0;i<5;i++){h.answer();if(i<4)h.run('nextQ()');}
  assert.equal(h.inspect("prof().adventure.currentNodeId"),'eiffel');
  assert.deepEqual(h.inspect("Object.keys(prof().adventure.characters)"),['lumie']);
  const footprint=h.inspect("Adventure.summarizeLearning(prof().adventure.visited.eiffel.learning)");
  assert.equal(footprint.total,8);
  assert.equal(footprint.countsByLevel.A1,8);
  assert.equal(footprint.reviewCount,0);
  assert.ok(footprint.sampleKeys.length>0 && footprint.sampleKeys.length<=6);
  const saved=h.storage.raw;
  h.answer();
  assert.equal(h.storage.raw,saved);
  const fresh=harness(saved);
  assert.deepEqual(fresh.inspect('prof().adventure'),h.inspect('prof().adventure'));
  const before=fresh.inspect('DB');
  fresh.run("showJournal('characters'); showJournal('places'); showMap('eiffel')");
  assert.deepEqual(fresh.inspect('DB'),before,'opening a collection or location never grants progress');
});

test("mixing a grammar stage clears the place topic and restores the complete stage", () => {
  const h=harness();
  h.run("prof().adventure.introCompleted=true; selectRecommendation('trocadero-aller')");
  const mixed=h.document.getElementById('grammar-guide').children.find(b=>b.classList.contains('unit-choice'));
  assert.ok(mixed);
  assert.equal(mixed.classList.contains('selected'),false);
  mixed.click();
  assert.equal(h.inspect('setup.recommendationId'),null);
  h.run('var selectedPoolSize=0; var originalPickQuestions=pickQuestions; pickQuestions=(pool,n)=>{selectedPoolSize=pool.length; return originalPickQuestions(pool,n);}; startQuiz(false)');
  assert.equal(h.inspect('quiz.qs.length'),10);
  assert.ok(h.inspect("quiz.qs.every(q=>q.w.lv==='ぶんぽう1')"));
  assert.equal(h.inspect('selectedPoolSize'),curriculum.WORDS.filter(w=>w.lv==='ぶんぽう1').length);
});

test("review contributes a subset of the actual curriculum footprint", () => {
  const h=harness();
  h.run("prof().stock=[wkey(WORDS.find(w=>w.lv==='ぶんぽう3'))]; startQuiz(true)");
  h.answer();
  const footprint=h.inspect("Adventure.summarizeLearning(prof().adventure.pendingLearning)");
  assert.equal(footprint.total,1);
  assert.equal(footprint.countsByLevel['ぶんぽう3'],1);
  assert.equal(footprint.reviewCount,1);
});

test("place recommendations never leak into a review's heading or question pool", () => {
  const h=harness();
  h.run("selectRecommendation('eiffel-numbers'); prof().stock=[wkey(WORDS.find(w=>w.lv==='C2'))]; startQuiz(true)");
  assert.ok(h.inspect("quiz.qs.every(q=>q.w.lv==='C2')"));
  assert.equal(h.document.getElementById('quiz-subject').innerHTML.includes('数の言葉'),false);
});

test("rich correct feedback is immediate, cancellable, and never delays the next question", () => {
  const h=harness();
  h.run("startQuiz(false)"); h.answer();
  const panel=h.document.getElementById('correct-celebration');
  assert.equal(panel.hidden,false);
  assert.match(panel.innerHTML,/BRAVO/);
  assert.equal(h.document.body.querySelectorAll('.confetti').length,18);
  const saved=h.storage.raw;
  h.run("setEffects('calm')");
  assert.equal(panel.hidden,true);
  assert.equal(h.document.body.querySelectorAll('.confetti').length,0);
  assert.equal(h.inspect('quiz.results.length'),1);
  assert.equal(JSON.parse(saved).profiles[0].adventure.earnedUnits,h.inspect('prof().adventure.earnedUnits'));
  h.run("setEffects('rich'); nextQ()");
  assert.equal(h.inspect('quiz.i'),1,"the next button has no animation wait");
  assert.equal(panel.hidden,true);
  h.answer(); assert.equal(panel.hidden,false);
  h.run("go('scr-home')");
  assert.equal(panel.hidden,true); h.flushTimers(); assert.equal(panel.hidden,true);
});

test("calm and reduced-motion settings suppress the richer correct effect without changing scoring", () => {
  for(const mode of ['calm','reduced']){
    const h=harness();
    h.run(mode==='calm' ? "Adventure.ensure(prof()).effectsMode='calm'" : "window.matchMedia=()=>({matches:true})");
    h.run("startQuiz(false)"); h.answer();
    assert.equal(h.document.getElementById('correct-celebration').hidden,true,mode);
    assert.equal(h.document.body.querySelectorAll('.confetti').length,0,mode);
    assert.equal(h.inspect('prof().adventure.earnedUnits'),1,mode);
  }
});

test('ordinary reactions rotate around the existing 3, 6 and 9 correct milestones without changing scoring', () => {
  const h = harness();
  h.run('prof().adventure.introCompleted=true; startQuiz(false)');
  const panel = h.document.getElementById('correct-celebration');
  panel.className = 'correct-celebration';
  const expected = ['peek', 'clap', 'stars', 'hop', 'peek', 'balloons', 'clap', 'hop', 'stars', 'peek'];
  for (let total = 1; total <= 10; total++) {
    h.answer();
    const special = total % 3 === 0;
    assert.equal(panel.hidden, false);
    assert.equal(panel.classList.contains('correct-celebration'), true, 'the existing overlay class remains available');
    assert.match(panel.innerHTML, new RegExp('data-variant="' + expected[total - 1] + '"'));
    assert.match(panel.innerHTML, new RegExp('correct-cheer-' + expected[total - 1]));
    assert.match(panel.innerHTML, /<img\b/, 'every reaction includes character artwork');
    for (const image of panel.innerHTML.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
      const asset = image[1].split('?')[0];
      assert.match(asset, /^img\/adventure\/[\w-]+\.svg$/);
      assert.match(readFileSync(join(__dirname, '..', asset), 'utf8'), /<svg\b/, 'the chosen reaction artwork exists');
    }
    if (special) {
      assert.match(panel.innerHTML, new RegExp(total === 6 ? 'correct-special-balloons' : 'correct-special-stars'));
      assert.doesNotMatch(panel.innerHTML, new RegExp(total === 6 ? 'correct-special-stars' : 'correct-special-balloons'));
      assert.equal(h.document.body.querySelectorAll('.confetti').length, 0, 'special visuals do not stack the ordinary confetti');
    } else {
      assert.match(panel.innerHTML, /BRAVO/);
      assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
    }
    assert.ok(h.pendingTimerDelays().includes(special ? 1350 : 1100), 'the celebration schedules its short cleanup');
    assert.equal(h.inspect('quiz.correct'), total);
    assert.equal(h.inspect('totalAnswered(prof())'), total);
    assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, total);
    h.run('nextQ()');
    assert.equal(panel.hidden, true, 'next question/result never waits for the effect');
    assert.equal(panel.innerHTML, '');
    assert.equal(h.pendingTimerDelays().includes(1100), false, 'ordinary cleanup is cancelled on navigation');
    assert.equal(h.pendingTimerDelays().includes(1350), false, 'the special cleanup timer is cancelled on navigation');
  }
});

test('incorrect answers neither trigger a milestone nor reset the accumulated correct total', () => {
  const h = harness();
  h.run('prof().adventure.introCompleted=true; startQuiz(false)');
  const panel = h.document.getElementById('correct-celebration');
  const answers = [true, true, false, true, false, true, true, true];
  const expected = ['peek', 'clap', 'stars', 'hop', 'peek', 'balloons'];
  let correct = 0;
  for (const ok of answers) {
    h.answer(ok);
    if (ok) correct++;
    assert.equal(h.inspect('quiz.correct'), correct);
    if (ok) assert.match(panel.innerHTML, new RegExp('data-variant="' + expected[correct - 1] + '"'));
    if (!ok) {
      assert.equal(panel.hidden, true);
      assert.equal(panel.innerHTML, '');
      assert.equal(h.pendingTimerDelays().includes(1350), false);
    } else if (correct === 3 || correct === 6) {
      assert.match(panel.innerHTML, new RegExp(correct === 3 ? 'correct-special-stars' : 'correct-special-balloons'));
    } else assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
    h.run('nextQ()');
  }
  assert.equal(h.inspect('totalAnswered(prof())'), 8);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 6);
  assert.equal(h.inspect('prof().stock.length'), 2);
});

test('repeating a milestone answer cannot duplicate or restart its celebration or saved reward', () => {
  const h = harness(); h.run('startQuiz(false)');
  h.answer(); h.run('nextQ()'); h.answer(); h.run('nextQ()'); h.answer();
  const panel = h.document.getElementById('correct-celebration');
  assert.match(panel.innerHTML, /correct-special-stars/);
  const saved = h.storage.raw, html = panel.innerHTML, delays = h.pendingTimerDelays();
  const confetti = h.document.body.querySelectorAll('.confetti').length;
  h.answer(); h.answer(false);
  assert.equal(panel.innerHTML, html);
  assert.deepEqual(h.pendingTimerDelays(), delays);
  assert.equal(h.document.body.querySelectorAll('.confetti').length, confetti);
  assert.equal(h.storage.raw, saved);
  assert.equal(h.inspect('quiz.correct'), 3);
  h.flushTimers();
  assert.equal(panel.hidden, true);
  assert.equal(panel.innerHTML, '');
  h.answer();
  assert.equal(panel.hidden, true, 'an expired celebration cannot be replayed by repeating the answer');
  assert.equal(h.storage.raw, saved);
});

test('a new round restarts celebration milestones while lifetime travel remains cumulative', () => {
  const h = harness(); h.run('startQuiz(false)'); h.finish();
  h.document.getElementById('btnagain').click();
  const panel = h.document.getElementById('correct-celebration');
  assert.equal(h.inspect('quiz.correct'), 0);
  for (let total = 1; total <= 3; total++) {
    h.answer();
    assert.match(panel.innerHTML, new RegExp('data-variant="' + ['peek', 'clap', 'stars'][total - 1] + '"'));
    if (total === 3) {
      assert.match(panel.innerHTML, /correct-special-stars/);
      assert.doesNotMatch(panel.innerHTML, /correct-special-balloons/);
    } else assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
    if (total < 3) h.run('nextQ()');
  }
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 6);
  assert.equal(h.inspect('quiz.correct'), 3);
});

test('calm and reduced motion suppress all five reactions while preserving the six correct answers', () => {
  for (const mode of ['calm', 'reduced']) {
    const h = harness();
    h.run("prof().adventure.introCompleted=true; " + (mode === 'calm' ? "prof().adventure.effectsMode='calm'" : "window.matchMedia=()=>({matches:true})"));
    h.run('startQuiz(false)');
    const panel = h.document.getElementById('correct-celebration');
    for (let total = 1; total <= 6; total++) {
      h.answer();
      assert.equal(panel.hidden, true, mode);
      assert.equal(panel.innerHTML, '', mode);
      assert.equal(h.document.body.querySelectorAll('.confetti').length, 0, mode);
      assert.equal(h.pendingTimerDelays().includes(1100), false, mode);
      assert.equal(h.pendingTimerDelays().includes(1350), false, mode);
      h.run('nextQ()');
    }
    assert.equal(h.inspect('quiz.correct'), 6, mode);
    assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, 6, mode);
  }
});

test('mode changes and profile navigation cancel special effects without replaying them', () => {
  const h = harness();
  h.run('prof().adventure.introCompleted=true; startQuiz(false)');
  h.answer(); h.run('nextQ()'); h.answer(); h.run('nextQ()'); h.answer();
  const panel = h.document.getElementById('correct-celebration');
  assert.match(panel.innerHTML, /correct-special-stars/);
  h.run("setEffects('calm')");
  assert.equal(panel.hidden, true);
  assert.equal(panel.innerHTML, '');
  assert.equal(h.pendingTimerDelays().includes(1350), false);
  h.run("setEffects('rich')"); h.flushTimers();
  assert.equal(panel.hidden, true, 'restoring rich mode does not replay the answered question');
  for (let i = 0; i < 3; i++) { h.run('nextQ()'); h.answer(); }
  assert.match(panel.innerHTML, /correct-special-balloons/);
  h.document.getElementById('btnback').click();
  h.document.getElementById('whochip').click();
  assert.equal(h.inspect('current'), 'scr-profile');
  assert.equal(panel.hidden, true);
  assert.equal(panel.innerHTML, '');
  assert.equal(h.pendingTimerDelays().includes(1350), false);
  assert.equal(h.document.body.querySelectorAll('.confetti').length, 0);
  h.run("DB.profiles.push(newProfile('別の人','🐰')); renderProfiles()");
  h.document.getElementById('pgrid').children[1].click();
  h.run('startQuiz(false)'); h.answer();
  assert.match(panel.innerHTML, /data-variant="peek"/, 'a different profile starts with its own first reaction');
  assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
  h.flushTimers();
  assert.equal(panel.hidden, true);
  assert.equal(h.inspect('DB.profiles[0].adventure.earnedUnits'), 6);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 1);
});

test('treasure completion takes priority over each ordinary reaction and both milestone reactions', () => {
  for (const correctTotal of [1, 2, 3, 4, 6, 9]) {
    const h = harness(); readyForTreasure(h);
    h.run("Adventure.startFinale(prof()); for(let i=0;i<" + (10 - correctTotal) + ";i++) Adventure.addCorrect(prof(),'prior-treasure-'+i); save(); startQuiz(false)");
    for (let total = 1; total <= correctTotal; total++) {
      h.answer();
      if (total < correctTotal) h.run('nextQ()');
    }
    const panel = h.document.getElementById('correct-celebration');
    assert.equal(h.inspect('quiz.correct'), correctTotal);
    assert.equal(h.inspect('quiz.finaleCompleted'), true);
    assert.equal(h.inspect('prof().adventure.finale.correctCount'), 10);
    assert.match(panel.innerHTML, /TRÉSOR/);
    assert.match(panel.innerHTML, /data-variant="treasure"/);
    assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
    assert.ok(h.pendingTimerDelays().includes(1100));
    const saved = h.storage.raw;
    h.answer();
    assert.equal(h.storage.raw, saved);
  }
});

test('each ordinary reaction expires without advancing, scoring again or replaying on a repeated answer', () => {
  for (const [correctTotal, variant] of [[1, 'peek'], [2, 'clap'], [4, 'hop']]) {
    const h = harness();
    h.run('prof().adventure.introCompleted=true; startQuiz(false)');
    for (let total = 1; total <= correctTotal; total++) {
      h.answer();
      if (total < correctTotal) h.run('nextQ()');
    }
    const panel = h.document.getElementById('correct-celebration');
    assert.match(panel.innerHTML, new RegExp('data-variant="' + variant + '"'));
    const before = h.state(), saved = h.storage.raw, writes = h.storage.writes;
    h.flushTimers();
    assert.equal(panel.hidden, true);
    assert.equal(panel.innerHTML, '');
    assert.equal(h.document.body.querySelectorAll('.confetti').length, 0);
    assert.deepEqual(h.state(), before, 'finishing the animation does not advance or change the question');
    h.answer(); h.answer(false);
    assert.equal(panel.hidden, true, 'an answered question cannot start another entrance');
    assert.equal(panel.innerHTML, '');
    assert.equal(h.storage.raw, saved);
    assert.equal(h.storage.writes, writes);
  }
});

test("the third real correct answer unlocks a bicycle once and its selection survives reload", () => {
  const h=harness(); h.run('startQuiz(false)'); h.finish();
  assert.deepEqual(h.inspect('quiz.vehicleUnlocks'),['bicycle']);
  assert.equal(h.inspect("Adventure.getVehicles(prof()).find(v=>v.id==='bicycle').unlocked"),true);
  h.run("Adventure.setVehicle(prof(),'bicycle'); save()");
  const fresh=harness(h.storage.raw);
  assert.equal(fresh.inspect('prof().adventure.vehicleId'),'bicycle');
  fresh.run('startQuiz(false)'); fresh.answer();
  assert.deepEqual(fresh.inspect('quiz.vehicleUnlocks'),[]);
});

function readyForTreasure(h){
  h.run(`{
    const p=prof(); Adventure.ensure(p); p.adventure.introCompleted=true;
    let event=0;
    for(const target of ['eiffel','mont-saint-michel','chambord','marseille','versailles']){
      Adventure.selectPath(p,p.adventure.currentNodeId+'--'+target);
      while(p.adventure.activeLeg) Adventure.addCorrect(p,'prepare-'+(++event));
    }
    save();
  }`);
}

test("the final treasure counts new real answers, preserves mistakes and resumes across reload", () => {
  const h=harness(); readyForTreasure(h);
  assert.equal(h.inspect('Adventure.getFinaleStatus(prof()).unlocked'),true);
  h.run('Adventure.startFinale(prof()); startQuiz(false)');
  assert.equal(h.inspect('quiz.qs.length'),10);
  h.finish(i=>i!==4);
  assert.equal(h.inspect('prof().adventure.finale.correctCount'),9);
  assert.equal(h.inspect('prof().adventure.finale.completedAt'),null);
  assert.equal(h.inspect('prof().stock.length'),1);
  const fresh=harness(h.storage.raw);
  fresh.run('startQuiz(true)'); fresh.answer();
  assert.equal(fresh.inspect('prof().adventure.finale.correctCount'),10);
  assert.equal(fresh.inspect('quiz.finaleCompleted'),true);
  assert.equal(fresh.inspect('prof().adventure.finale.active'),false);
  assert.equal(fresh.inspect('prof().stock.length'),0);
  const saved=fresh.storage.raw;
  fresh.answer(); fresh.run('nextQ(); showResult(); showResult()');
  assert.equal(fresh.storage.raw,saved,'duplicate answer/result cannot award treasure again');
  fresh.run('startQuiz(false)'); fresh.answer();
  assert.equal(fresh.inspect('prof().adventure.finale.correctCount'),10);
  assert.equal(fresh.inspect('quiz.finaleCompleted'),false);
});

test('a stale tab cannot erase another profile’s saved answers when selecting a profile', () => {
  const initial = JSON.stringify({ profiles: [legacyProfile(1), legacyProfile(2)], active: 1, settings: {} });
  const first = harness(initial), stale = harness(initial);
  let shared = initial;
  for (const h of [first, stale]) Object.defineProperty(h.storage, 'raw', { get: () => shared, set: value => { shared = value; } });
  first.run('startQuiz(false)'); first.finish();
  const saved = shared;
  stale.run('renderProfiles()'); stale.document.getElementById('pgrid').children[1].click();
  assert.equal(shared, saved, 'profile selection must not overwrite the other tab’s completed round');
  assert.equal(stale.inspect('storageLocked'), true);
  assert.equal(stale.inspect('unreadableBackup'), saved);
  assert.equal(stale.inspect('prof().id'), 2, 'the local screen keeps its own chosen profile');
  assert.equal(stale.inspect('DB.profiles[0].adventure.earnedUnits'), 0, 'no implicit merge or reload occurs');
  stale.run('startQuiz(false)'); stale.answer();
  assert.equal(stale.inspect('prof().adventure.earnedUnits'), 1, 'local learning remains available for export');
  assert.equal(shared, saved);
  assert.match(stale.inspect('storageProblem'), /未保存/);
  assert.equal(JSON.parse(shared).profiles[0].adventure.earnedUnits, 3);
});

test('external removal is protected even before its storage event arrives', () => {
  const h = harness(); h.run('startQuiz(false)'); h.answer();
  h.storage.raw = null;
  h.run('nextQ()'); h.answer();
  assert.equal(h.storage.raw, null);
  assert.equal(h.inspect('storageLocked'), true);
  assert.equal(h.inspect('totalAnswered(prof())'), 2);
  assert.equal(h.inspect('unreadableBackup'), null);
  assert.equal(h.document.getElementById('retry-save').hidden, true);
  assert.equal(h.document.getElementById('recover-original-export').hidden, true);
  assert.equal(h.run('save()'), false, 'retry cannot recreate externally removed storage');
});

test('an initially empty tab cannot replace another tab’s first saved profile', () => {
  const h = harness(null);
  const other = harness(); other.run('save()');
  h.storage.raw = other.storage.raw;
  h.document.getElementById('nameinput').value = 'この画面';
  h.document.getElementById('btnpcreate').click();
  assert.equal(h.storage.raw, other.storage.raw);
  assert.equal(h.inspect('storageLocked'), true);
  assert.equal(h.inspect('DB.profiles.length'), 1);
  assert.equal(h.inspect('prof().name'), 'この画面');
  assert.notEqual(h.inspect('prof().id'), JSON.parse(h.storage.raw).profiles[0].id);
});

test('an identical saved value succeeds without a write; delayed events cannot lock a newer save', () => {
  const h = harness();
  h.run("DB.settings.kana=false");
  h.storage.raw = h.run('JSON.stringify(DB)');
  h.storage.fail = true;
  assert.equal(h.run('save()'), true, 'identical data does not need a storage write');
  assert.equal(h.storage.writes, 0);
  assert.equal(h.inspect('storageBaseline'), h.storage.raw);
  h.run('DB.settings.kana=true');
  h.storage.raw = h.run('JSON.stringify(DB)');
  h.dispatchStorage();
  assert.equal(h.inspect('storageLocked'), false, 'an external identical value is not a conflict');
  assert.equal(h.inspect('storageBaseline'), h.storage.raw);
  assert.equal(h.storage.writes, 0);
  h.dispatchStorage({ newValue: 'an older queued notification' });
  assert.equal(h.inspect('storageLocked'), false);
  h.storage.fail = false; h.run('startQuiz(false)'); h.answer();
  h.dispatchStorage({ newValue: null });
  assert.equal(h.inspect('storageLocked'), false);
  assert.equal(h.inspect('storageBaseline'), h.storage.raw);
});

test('storage notifications protect a snapshot and never silently unlock a conflict', () => {
  const h = harness();
  const baseline = h.storage.raw;
  const changed = JSON.parse(baseline); changed.profiles[0].name = '別の画面';
  h.storage.raw = JSON.stringify(changed);
  h.dispatchStorage({ key: 'another-key' });
  h.dispatchStorage({ storageArea: {} });
  assert.equal(h.inspect('storageLocked'), false);
  h.dispatchStorage();
  assert.equal(h.inspect('storageLocked'), true);
  assert.equal(h.inspect('prof().name'), 'テスト1');
  const protectedRaw = h.inspect('unreadableBackup');
  h.storage.raw = baseline;
  h.dispatchStorage();
  assert.equal(h.run('save()'), false);
  assert.equal(h.inspect('unreadableBackup'), protectedRaw, 'the protected snapshot is retained');
  assert.equal(h.storage.raw, baseline);
});

test('a storage clear event protects the current screen without inventing an original file', () => {
  const h = harness(); h.run('save()');
  h.storage.raw = null; h.dispatchStorage({ key: null });
  assert.equal(h.inspect('storageLocked'), true);
  h.run('exportOriginalRecords()');
  assert.equal(h.downloads.length, 0);
  assert.equal(h.inspect('DB.profiles.length'), 1);
});

test('a failed write keeps its baseline and cannot overwrite an external update on retry', () => {
  const h = harness(); h.run('save(); startQuiz(false)');
  const baseline = h.storage.raw;
  h.storage.fail = true; h.answer();
  assert.equal(h.inspect('storageBaseline'), baseline);
  assert.equal(h.inspect('storageLocked'), false);
  const external = JSON.parse(baseline); external.profiles[0].name = '保存先';
  const externalRaw = JSON.stringify(external);
  h.storage.raw = externalRaw; h.storage.fail = false;
  assert.equal(h.run('save()'), false);
  assert.equal(h.storage.raw, externalRaw);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 1);
  assert.equal(h.inspect('unreadableBackup'), externalRaw);
  assert.equal(h.inspect('storageLocked'), true);
});

test('a temporary read failure never writes blindly and can retry against the unchanged baseline', () => {
  const h = harness(); h.run('save(); startQuiz(false)');
  const baseline = h.storage.raw, writes = h.storage.writes;
  h.storage.readFail = true; h.answer();
  assert.equal(h.storage.writes, writes);
  assert.equal(h.storage.raw, baseline);
  assert.equal(h.inspect('storageBaseline'), baseline);
  assert.equal(h.inspect('storageLocked'), false);
  h.storage.readFail = false;
  assert.equal(h.run('save()'), true);
  assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, 1);
});

test('a corrupted source and newly learned local records can both be exported independently', async () => {
  const original = '{broken original';
  const h = harness(original);
  h.document.getElementById('nameinput').value = '救出用';
  h.document.getElementById('btnpcreate').click();
  h.run('startQuiz(false)'); h.answer();
  h.document.getElementById('recover-export').click();
  h.document.getElementById('recover-original-export').click();
  assert.equal(h.downloads.length, 2);
  const current = JSON.parse(await h.downloads[0].text());
  assert.equal(current.profiles[0].name, '救出用');
  assert.equal(current.profiles[0].adventure.earnedUnits, 1);
  assert.equal(await h.downloads[1].text(), original);
  assert.equal(h.storage.raw, original);
  assert.equal(h.storage.writes, 0);
  assert.equal(h.document.getElementById('retry-save').hidden, true);
  assert.equal(h.document.getElementById('recover-original-export').hidden, false);
  assert.match(h.inspect('storageProblem'), /未保存/);
  assert.deepEqual(h.createdElements.filter(el => el.tagName === 'A').map(el => el.download), ['furansugo-quiz-kiroku.json', 'furansugo-quiz-original.json']);
});

test('conflicting valid storage and the current answered quiz export without merging or writes', async () => {
  const h = harness(); h.run('startQuiz(false)');
  const external = JSON.parse(h.storage.raw); external.profiles[0].name = '外部の記録';
  const externalRaw = JSON.stringify(external);
  h.storage.raw = externalRaw; h.answer();
  h.run('exportRecords(); exportOriginalRecords()');
  const current = JSON.parse(await h.downloads[0].text());
  assert.equal(current.profiles[0].name, 'テスト1');
  assert.equal(current.profiles[0].adventure.earnedUnits, 1);
  assert.equal(await h.downloads[1].text(), externalRaw);
  assert.equal(h.storage.raw, externalRaw);
});

test('an explicit successful import clears protection and sets the exact committed baseline', () => {
  const h = harness('{broken');
  const candidate = JSON.stringify({ profiles: [legacyProfile(9)], active: 9, settings: { kana: false } });
  h.importText(candidate);
  assert.equal(h.alerts.length, 0);
  assert.equal(h.inspect('storageLocked'), false);
  assert.equal(h.inspect('unreadableBackup'), null);
  assert.equal(h.inspect('storageProblem'), null);
  assert.equal(h.inspect('storageBaseline'), h.storage.raw);
  assert.equal(h.inspect('DB.active'), 9);
  assert.equal(h.inspect('current'), 'scr-profile');
  h.run('startQuiz(false)'); h.answer();
  assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, 1);
  assert.equal(h.document.getElementById('recover-original-export').hidden, true);
});

test('a failed import leaves the live quiz, protected source, and baseline unchanged', () => {
  const h = harness(); h.run('save(); startQuiz(false)'); h.answer();
  const external = JSON.parse(h.storage.raw); external.profiles[0].name = '外部';
  h.storage.raw = JSON.stringify(external); h.dispatchStorage();
  const before = h.inspect('({DB,quiz,storageBaseline,unreadableBackup,storageLocked})'), raw = h.storage.raw;
  h.importText('{bad file');
  h.storage.fail = true;
  h.importText(JSON.stringify({ profiles: [legacyProfile(9)], active: 9, settings: {} }));
  assert.equal(h.alerts.length, 2);
  assert.deepEqual(h.inspect('({DB,quiz,storageBaseline,unreadableBackup,storageLocked})'), before);
  assert.equal(h.storage.raw, raw);
});
