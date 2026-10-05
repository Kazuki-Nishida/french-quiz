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

function harness(initial = null) {
  const elements = new Map();
  const document = {
    body: new Element("body"), listeners: {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement(tag) { return new Element(tag); },
    querySelectorAll(selector) {
      if (selector === "#opts .opt") return this.getElementById("opts").children;
      if (selector === ".confetti") return this.body.querySelectorAll(selector);
      return [];
    },
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  };
  const storage = { raw: initial === null ? JSON.stringify({ profiles: [legacyProfile()], active: 1, settings: {} }) : initial, fail: false, writes: 0 };
  const localStorage = {
    getItem(key) { assert.equal(key, KEY); return storage.raw; },
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
    AdventureView: { renderMap() {}, renderScene() {}, renderResult() {}, renderJournal() {} },
    crypto: { randomUUID: () => `harness-${id}-round-${++round}` },
    console, Date, Set, Map, URL, Blob,
    alert() {}, confirm: () => true,
    setTimeout(callback) { const timer = ++nextTimer; timers.set(timer, callback); return timer; },
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
    for (const callback of pending) callback();
  }
  return { context, document, storage, speech, run, inspect, state, answer, finish, flushTimers };
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
