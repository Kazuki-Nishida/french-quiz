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
  querySelectorAll(selector) {
    return this.children.flatMap(el => [
      ...(selector[0] === "." && el.classList.contains(selector.slice(1)) ? [el] : []),
      ...el.querySelectorAll(selector)
    ]);
  }
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

function harness(initial, options = {}) {
  const elements = new Map(), createdElements = [], downloads = [], alerts = [], windowListeners = {};
  const document = {
    body: new Element("body"), listeners: {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement(tag) { const element = new Element(tag); createdElements.push(element); return element; },
    querySelector(selector) { return this.getElementById('selector:' + selector); },
    querySelectorAll(selector) {
      if (selector === "#opts .opt") return this.getElementById("opts").querySelectorAll('.opt');
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
  const speech = [], utterances = [];
  const audio = { contexts: [], oscillators: [], resumeRequests: [] };
  class FakeAudioContext {
    constructor() {
      this.currentTime = 12.5; this.state = options.audioState || 'running';
      this.destination = {}; this.resumeCalls = 0; audio.contexts.push(this);
    }
    createOscillator() {
      const number = audio.oscillators.length + 1;
      const node = {
        context: this, frequency: { value: 0 }, starts: [], stops: [], disconnected: false,
        connect(target) { this.output = target; },
        disconnect() { this.disconnected = true; },
        start(time) {
          if (options.audioStartThrowAt === number) throw new Error('simulated oscillator start failure');
          this.starts.push(time);
        },
        stop(time) { this.stops.push(time); }
      };
      audio.oscillators.push(node); return node;
    }
    createGain() {
      return {
        disconnected: false,
        gain: {
          starts: [], ramps: [],
          setValueAtTime(value, time) { this.starts.push({ value, time }); },
          exponentialRampToValueAtTime(value, time) { this.ramps.push({ value, time }); }
        },
        connect(target) { this.output = target; },
        disconnect() { this.disconnected = true; }
      };
    }
    resume() {
      this.resumeCalls++;
      return new Promise((resolve, reject) => {
        audio.resumeRequests.push({
          resolve: () => { this.state = 'running'; resolve(); }, reject
        });
      });
    }
  }
  let availableVoices = options.voices || [{ name: "Audrey", lang: "fr-FR", voiceURI: "Audrey", localService: true }];
  const id = ++nextHarness; let round = 0;
  const context = vm.createContext({
    ...curriculum, Adventure, WorldData, ProfileStore, StudyGuide, document, localStorage,
    UIJa: { apply() {}, ruby: (base, reading) => `<ruby>${base}<rt>${reading}</rt></ruby>`, level: value => value },
    AdventureView: { renderMap() {}, renderScene() {}, renderResult() {}, renderJournal() {}, renderHomePreview() {}, renderNextStep() {} },
    crypto: { randomUUID: () => `harness-${id}-round-${++round}` },
    console, Date, Set, Map, Blob, AudioContext: FakeAudioContext,
    URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test-' + downloads.length; }, revokeObjectURL() {} },
    FileReader: class { readAsText(file) { this.result = file.text; this.onload(); } },
    alert(message) { alerts.push(message); }, confirm: () => true,
    addEventListener(type, callback) { (windowListeners[type] ||= []).push(callback); },
    setTimeout(callback, delay) { const timer = ++nextTimer; timers.set(timer, { callback, delay }); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { getVoices: () => availableVoices, cancel() {}, speak(value) { speech.push(value.text); utterances.push(value); } },
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
    for (let i = 0; i < n; i++) {
      if (!(typeof correct === "function" ? correct(i) : correct)) answer(false);
      answer(true); run("nextQ()");
    }
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
  function setVoices(voices) {
    availableVoices = voices;
    context.speechSynthesis.onvoiceschanged();
  }
  const pendingTimerDelays = () => [...timers.values()].map(timer => timer.delay);
  return { context, document, storage, speech, utterances, setVoices, audio, run, inspect, state, answer, finish, flushTimers, pendingTimerDelays, dispatchStorage, importText, downloads, createdElements, alerts };
}

function frenchVoice(name, lang = 'fr-FR', extras = {}) {
  return { name, lang, voiceURI: name, localService: true, ...extras };
}

function assertSpokenWith(h, voice, text) {
  const utterance = h.utterances.at(-1);
  assert.ok(utterance, 'the real speakText function sends an utterance to speechSynthesis');
  assert.equal(utterance.text, text);
  assert.strictEqual(utterance.voice, voice, 'the selected browser voice object reaches the utterance');
  assert.equal(utterance.lang, voice.lang);
}

test('automatic speech prefers available Audrey quality and falls back to the best local Amélie', () => {
  const audrey = frenchVoice('Audrey');
  const audreyEnhanced = frenchVoice('Audrey (Enhanced)', 'fr-FR', { default: true });
  const audreyPremium = frenchVoice('Audrey (Premium)');
  const compact = frenchVoice('Amélie', 'fr-CA', { voiceURI: 'com.apple.voice.compact.fr-CA.Amelie' });
  const enhanced = frenchVoice('Amélie', 'fr-CA', { voiceURI: 'com.apple.voice.enhanced.fr-CA.Amelie' });
  const premium = frenchVoice('Amélie', 'fr-CA', { voiceURI: 'com.apple.voice.premium.fr-CA.Amelie' });
  const alternatives = [frenchVoice('Jacques'), frenchVoice('Thomas')];
  for (const [voices, expected] of [
    [[audrey, audreyEnhanced, premium, ...alternatives, audreyPremium], audreyPremium],
    [[premium, ...alternatives, audreyEnhanced, audrey], audreyEnhanced],
    [[premium, ...alternatives, audrey], audrey],
    [[...alternatives, compact], compact],
    [[compact, ...alternatives, enhanced], enhanced],
    [[enhanced, premium, ...alternatives, compact], premium]
  ]) {
    const h = harness(undefined, { voices });
    assert.equal(h.inspect('DB.settings.voiceGender'), 'f');
    assert.strictEqual(h.run('FRVOICE'), expected);
    h.run("speakText('bonjour')");
    assertSpokenWith(h, expected, 'bonjour');
    assert.equal(h.inspect('DB.settings.voiceName'), null, 'automatic selection does not become a saved manual override');
    assert.equal(h.storage.writes, 0);
  }
});

test('automatic fallback favors an available female voice and excludes non-French language tags', () => {
  const invalid = [frenchVoice('Amélie English', 'en-US'), frenchVoice('Audrey Premium', 'frank'), frenchVoice('Amélie Missing', '')];
  const french = [frenchVoice('Audrey', 'fr_CA'), frenchVoice('Julie', 'fr'), frenchVoice('Marie', 'fr-FR')];
  const male = [frenchVoice('Jacques Premium'), frenchVoice('Thomas Enhanced')];
  for (const expected of french) {
    const h = harness(undefined, { voices: [...invalid, ...male, expected] });
    assert.strictEqual(h.run('FRVOICE'), expected);
    assert.deepEqual(new Set(h.document.getElementById('voicesel').children.map(option => option.value)), new Set(['', ...male.map(voice => voice.name), expected.name]));
    h.run("speakText('merci')");
    assertSpokenWith(h, expected, 'merci');
  }
});

test('manual male and novelty French voices remain selectable, persist, and are actually spoken', () => {
  const preferred = frenchVoice('Amélie', 'fr-CA');
  for (const manual of [frenchVoice('Jacques'), frenchVoice('Eloquence', 'fr_CA')]) {
    const voices = [manual, preferred];
    const h = harness(undefined, { voices });
    const selector = h.document.getElementById('voicesel');
    assert.ok(selector.children.some(option => option.value === manual.name));
    selector.value = manual.name;
    for (const listener of selector.listeners.change) listener({ target: selector });
    assert.strictEqual(h.run('FRVOICE'), manual);
    assert.equal(JSON.parse(h.storage.raw).settings.voiceName, manual.name);
    assertSpokenWith(h, manual, 'bonjour, merci');
    const fresh = harness(h.storage.raw, { voices });
    assert.strictEqual(fresh.run('FRVOICE'), manual);
    assert.equal(fresh.document.getElementById('voicesel').value, manual.name);
    fresh.run("speakText('au revoir')");
    assertSpokenWith(fresh, manual, 'au revoir');
    assert.equal(fresh.storage.writes, 0);
  }
});

test('late voiceschanged selects available Audrey Premium and speaks a waiting request only once', () => {
  const h = harness(undefined, { voices: [] });
  h.run("speakText('bonjour en retard')");
  assert.equal(h.run('FRVOICE'), null);
  assert.equal(h.utterances.length, 0);
  const preferred = frenchVoice('Audrey Premium');
  const voices = [frenchVoice('Amélie', 'fr-CA'), frenchVoice('Thomas'), preferred];
  h.setVoices(voices);
  assert.strictEqual(h.run('FRVOICE'), preferred);
  assertSpokenWith(h, preferred, 'bonjour en retard');
  assert.equal(h.run('pendingSpeak'), null);
  h.setVoices(voices); h.flushTimers();
  assert.equal(h.utterances.length, 1, 'subsequent voice notifications and startup retries do not repeat speech');
  assert.equal(h.storage.writes, 0);
});

test('a temporarily missing manual voice survives saving and is restored when its voice list arrives', () => {
  const manual = frenchVoice('Jacques');
  const fallback = frenchVoice('Amélie', 'fr-CA');
  const initial = JSON.stringify({ profiles: [legacyProfile()], active: 1, settings: { voiceName: manual.name } });
  const h = harness(initial, { voices: [fallback] });
  assert.strictEqual(h.run('FRVOICE'), fallback);
  assert.equal(h.inspect('DB.settings.voiceName'), manual.name);
  h.run("speakText('bonjour'); save()");
  assertSpokenWith(h, fallback, 'bonjour');
  assert.equal(JSON.parse(h.storage.raw).settings.voiceName, manual.name);
  const fresh = harness(h.storage.raw, { voices: [fallback] });
  const saved = fresh.storage.raw;
  fresh.setVoices([fallback, manual]);
  assert.strictEqual(fresh.run('FRVOICE'), manual);
  assert.equal(fresh.document.getElementById('voicesel').value, manual.name);
  fresh.run("speakText('me revoilà')");
  assertSpokenWith(fresh, manual, 'me revoilà');
  assert.equal(fresh.storage.raw, saved);
  assert.equal(fresh.storage.writes, 0, 'restoring a temporarily unavailable voice does not rewrite learning records');
});

test('an existing male automatic preference is retained over the female automatic default', () => {
  const initial = JSON.stringify({ profiles: [legacyProfile()], active: 1, settings: { voiceGender: 'm' } });
  for (const male of [frenchVoice('Jacques'), frenchVoice('Thomas')]) {
    const h = harness(initial, { voices: [frenchVoice('Audrey Premium'), frenchVoice('Amélie', 'fr-CA'), male] });
    assert.strictEqual(h.run('FRVOICE'), male);
    assert.equal(h.inspect('DB.settings.voiceGender'), 'm');
    h.run("speakText('bonsoir'); save()");
    assertSpokenWith(h, male, 'bonsoir');
    assert.equal(JSON.parse(h.storage.raw).settings.voiceGender, 'm');
    assert.equal(JSON.parse(h.storage.raw).settings.voiceName, null);
  }
});

const regularCorrectNotes = [[784, 0, .18, 'sine', .25], [1175, .13, .35, 'sine', .25]];
const incorrectNotes = [[140, 0, .22, 'square', .12], [110, .24, .32, 'square', .12]];
function soundNotes(nodes) {
  const rounded = number => Number(number.toFixed(6));
  return nodes.map(node => [node.frequency.value, rounded(node.starts[0] - node.context.currentTime),
    rounded(node.stops[0] - node.starts[0]), node.type, node.output.gain.starts[0].value]);
}
function answerSound(h, correct = true) {
  const before = h.audio.oscillators.length;
  h.answer(correct);
  return h.audio.oscillators.slice(before);
}
function beginSoundRound(h) {
  h.run("prof().adventure.introCompleted=true; setup.dir='jf'; startQuiz(false)");
}
function assertShortCelebration(nodes) {
  assert.ok(nodes.length > 2, 'a milestone plays a short melody rather than the ordinary two notes');
  const notes = soundNotes(nodes);
  assert.ok(notes.every(([frequency, start, duration, , volume]) => frequency > 0 && start >= 0 && duration > 0 && start + duration <= .58 && volume > 0 && volume <= .30));
  assert.ok(Math.max(...notes.map(note => note[4])) >= .18, 'the milestone keeps a clearly audible main note');
}

test('real correct answers play the old two notes except distinct short celebrations at three, six and nine', () => {
  const h = harness(); beginSoundRound(h);
  let stars, balloons;
  for (let count = 1; count <= 10; count++) {
    const nodes = answerSound(h), notes = soundNotes(nodes);
    if ([3, 6, 9].includes(count)) {
      assertShortCelebration(nodes);
      if (count === 3) stars = notes;
      if (count === 6) {
        balloons = notes; assert.notDeepEqual(balloons, stars);
        assert.ok(Math.max(...notes.map(note => note[4])) >= .28, 'the balloon fanfare keeps its strengthened main melody');
      }
      if (count === 9) assert.deepEqual(notes, stars);
    } else assert.deepEqual(notes, regularCorrectNotes);
    assert.equal(h.run('activeCorrectTones.size'), nodes.length);
    assert.ok(h.pendingTimerDelays().includes(650), 'answer pronunciation remains scheduled at 650 ms');
    assert.equal(h.document.getElementById('nextwrap').style.display, 'block', 'sound never blocks the next question');
    for (const node of nodes) node.onended();
    assert.equal(h.run('activeCorrectTones.size'), 0, 'naturally ended tones release their tracked nodes');
    assert.ok(nodes.every(node => node.disconnected && node.output.disconnected));
    if (count < 10) h.run('nextQ()');
  }
  assert.equal(h.inspect('quiz.correct'), 10);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 10);
});

test('incorrect answer sounds keep their original notes and do not reset the next correct celebration', () => {
  const h = harness(); beginSoundRound(h);
  const answers = [true, false, true, true, false, true];
  let correct = 0;
  answers.forEach((ok, index) => {
    if (!ok) {
      const nodes = answerSound(h, false);
      assert.deepEqual(soundNotes(nodes), incorrectNotes);
      assert.equal(h.run('activeCorrectTones.size'), 0, 'wrong-answer tones are not tracked as a correct effect');
      assert.equal(h.inspect('quiz.correct'), correct, 'an unsuccessful retry does not advance the celebration count');
      h.run('stopCorrectSound()');
      assert.ok(nodes.every(node => node.stops.length === 1 && !node.disconnected), 'correct-sound cleanup leaves the existing wrong-answer sound alone');
    }
    const nodes = answerSound(h);
    correct++;
    if (correct === 3 || correct === 6) assertShortCelebration(nodes);
    else assert.deepEqual(soundNotes(nodes), regularCorrectNotes);
    if (index < answers.length - 1) h.run('nextQ()');
  });
  assert.equal(h.inspect('quiz.correct'), 6);
  assert.equal(h.inspect('prof().stock.length'), 2);
});

test('sound off suppresses correct, incorrect, milestone and result tones without muting French speech', () => {
  const h = harness(); h.run('DB.settings.sound=false'); beginSoundRound(h);
  h.finish(index => index !== 2 && index !== 5);
  assert.equal(h.audio.oscillators.length, 0);
  assert.equal(h.audio.contexts.length, 0);
  assert.equal(h.run('activeCorrectTones.size'), 0);
  assert.equal(h.inspect('quiz.correct'), 10);
  assert.equal(h.inspect('prof().daily[todayKey()].c'), 8, 'only first-choice answers count as learned correctly');
  h.run("speakText('merci')");
  assert.equal(h.utterances.at(-1).text, 'merci');
});

test('calm and reduced motion retain only the ordinary correct notes at every milestone', () => {
  for (const mode of ['calm', 'reduced']) {
    const h = harness();
    if (mode === 'calm') h.run("Adventure.ensure(prof()).effectsMode='calm'");
    else h.context.matchMedia = () => ({ matches: true });
    beginSoundRound(h);
    for (let count = 1; count <= 9; count++) {
      assert.deepEqual(soundNotes(answerSound(h)), regularCorrectNotes, mode + ' at correct ' + count);
      if (count < 9) h.run('nextQ()');
    }
    assert.equal(h.inspect('quiz.correct'), 9);
    assert.equal(h.inspect('prof().adventure.earnedUnits'), 9);
  }
});

test('next question, manual pronunciation and navigation stop correct tones without replaying repeated answers', () => {
  for (const action of ['nextQ()', 'speak(quiz.qs[quiz.i].w)', "go('scr-home')"]) {
    const h = harness(); beginSoundRound(h);
    h.answer(); h.run('nextQ()'); h.answer(); h.run('nextQ()');
    const nodes = answerSound(h);
    assertShortCelebration(nodes);
    const total = h.audio.oscillators.length, saved = h.storage.raw;
    h.answer(); h.answer(false);
    assert.equal(h.audio.oscillators.length, total, 'a second tap cannot play another cue');
    assert.equal(h.storage.raw, saved);
    h.run(action);
    assert.equal(h.run('activeCorrectTones.size'), 0, action);
    assert.ok(nodes.every(node => node.stops.length === 2 && node.stops.at(-1) === undefined && node.disconnected && node.output.disconnected));
    h.flushTimers();
    assert.equal(h.audio.oscillators.length, total, 'cleared callbacks never restart a sound');
    assert.equal(h.storage.raw, saved);
  }
});

test('suspended audio resumes safely and cannot replay a stopped cue after resolve or rejection', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const h = harness(undefined, { audioState: 'suspended' }); beginSoundRound(h);
    const nodes = answerSound(h);
    assert.deepEqual(soundNotes(nodes), regularCorrectNotes);
    assert.equal(h.audio.contexts[0].resumeCalls, 1);
    assert.equal(h.audio.resumeRequests.length, 1);
    const saved = h.storage.raw;
    h.run('nextQ()');
    assert.equal(h.run('activeCorrectTones.size'), 0);
    h.audio.resumeRequests[0][outcome](new Error('simulated autoplay rejection'));
    await Promise.resolve(); await Promise.resolve();
    assert.equal(h.audio.oscillators.length, 2, 'finishing resume does not create late notes');
    assert.ok(nodes.every(node => node.disconnected && node.stops.at(-1) === undefined));
    assert.equal(h.inspect('quiz.i'), 1);
    assert.equal(h.inspect('quiz.correct'), 1);
    assert.equal(h.storage.raw, saved);
  }
});

test('a synchronous failure starting the second correct tone stops every created node and leaves learning usable', () => {
  const h = harness(undefined, { audioStartThrowAt: 2 }); beginSoundRound(h);
  assert.doesNotThrow(() => h.answer());
  const nodes = h.audio.oscillators;
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].starts.length, 1, 'the first tone began before the second failed');
  assert.equal(nodes[1].starts.length, 0);
  assert.equal(h.run('activeCorrectTones.size'), 0);
  assert.ok(nodes.every(node => node.stops.length > 0 && node.stops.at(-1) === undefined && node.disconnected && node.output.disconnected));
  assert.equal(h.document.getElementById('nextwrap').style.display, 'block');
  assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, 1);
  h.answer();
  assert.equal(nodes.length, 2, 'retrying the already answered question cannot restart the failed cue');
  h.run('nextQ()');
  assert.deepEqual(soundNotes(answerSound(h)), regularCorrectNotes, 'a later answer can play normally after cleanup');
  assert.equal(h.inspect('quiz.correct'), 2);
  assert.equal(JSON.parse(h.storage.raw).profiles[0].adventure.earnedUnits, 2);
});

test('treasure on either sound milestone keeps the ordinary correct sound and its saved reward', () => {
  for (const finalAnswer of [3, 6]) {
    const h = harness(); readyForTreasure(h);
    h.run('Adventure.startFinale(prof())');
    for (let i = 0; i < 10 - finalAnswer; i++) h.run(`Adventure.addCorrect(prof(), 'sound-treasure-${i}')`);
    beginSoundRound(h);
    let nodes;
    for (let count = 1; count <= finalAnswer; count++) {
      nodes = answerSound(h);
      if (count < finalAnswer) h.run('nextQ()');
    }
    assert.equal(h.inspect('quiz.finaleCompleted'), true);
    assert.deepEqual(soundNotes(nodes), regularCorrectNotes);
    assert.equal(h.inspect('prof().adventure.finale.correctCount'), 10);
    const total = h.audio.oscillators.length, saved = h.storage.raw;
    h.answer();
    assert.equal(h.audio.oscillators.length, total);
    assert.equal(h.storage.raw, saved);
  }
});

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

test('wrong choices stay on the question, reject duplicate taps and record only the first attempt', () => {
  const h = harness(); h.run("setup.dir='jf'; startQuiz(false)");
  const key = h.inspect('wkey(quiz.qs[0].w)'), answerIndex = h.inspect('quiz.qs[0].ansIdx');
  const buttons = h.document.querySelectorAll('#opts .opt');
  const wrongIndices = buttons.map((_, index) => index).filter(index => index !== answerIndex);
  const originalQuestion = h.document.getElementById('qarea').innerHTML;
  const originalSpeech = h.utterances.length;
  for (let attempt = 0; attempt < wrongIndices.length; attempt++) {
    const chosen = wrongIndices[attempt];
    h.run('answer(' + chosen + ')');
    assert.equal(h.inspect('quiz.answered'), false);
    assert.equal(h.inspect('quiz.results.length'), 0);
    assert.equal(h.inspect('quiz.correct'), 0);
    assert.equal(h.inspect('prof().adventure.earnedUnits'), 0);
    assert.equal(h.document.getElementById('nextwrap').style.display, 'none');
    assert.equal(buttons[chosen].disabled, true);
    assert.ok(buttons[chosen].classList.contains('tried'));
    assert.equal(buttons.filter(button => button.disabled).length, attempt + 1);
    assert.equal(h.document.getElementById('retry-feedback').hidden, false);
    assert.match(h.document.getElementById('retry-feedback').innerHTML, new RegExp('あと' + (buttons.length - attempt - 1) + 'つ'));
    assert.notEqual(buttons[answerIndex].disabled, true, 'the correct choice stays available');
    assert.ok(buttons.every(button => !button.classList.contains('good') && !button.innerHTML.includes('class="reveal"')));
    assert.equal(h.document.getElementById('qarea').innerHTML, originalQuestion);
    assert.equal(h.document.getElementById('expl').style.display, 'none');
    assert.equal(h.pendingTimerDelays().includes(650), false, 'a wrong choice never schedules the correct pronunciation');
    assert.deepEqual(h.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 0, w: 1 });
    assert.deepEqual(h.inspect('prof().daily[todayKey()]'), { q: 1, c: 0 });
    assert.deepEqual(h.inspect('prof().stock'), [key]);
    const afterWrong = h.state(), saved = h.storage.raw, writes = h.storage.writes, tones = h.audio.oscillators.length;
    h.run('answer(' + chosen + '); answer(-1); answer(99); answer(1.5); nextQ(); showResult()');
    h.document.getElementById('btnnext').click();
    for (const listener of h.document.listeners.keydown || []) listener({ key: 'Enter', repeat: false, target: h.document.body, preventDefault() {} });
    h.document.getElementById('scr-quiz').click();
    assert.deepEqual(h.state(), afterWrong, 'disabled, invalid and next-question input cannot bypass a pending retry');
    assert.equal(h.storage.raw, saved);
    assert.equal(h.storage.writes, writes);
    assert.equal(h.audio.oscillators.length, tones, 'duplicate wrong taps do not repeat the error sound');
  }
  assert.equal(h.utterances.length, originalSpeech);
  h.answer();
  assert.equal(h.document.getElementById('retry-feedback').hidden, true);
  assert.equal(h.inspect('quiz.answered'), true);
  assert.equal(h.inspect('quiz.correct'), 1);
  assert.equal(h.inspect('quiz.results.length'), 1);
  assert.equal(h.inspect('quiz.results[0].ok'), true);
  assert.equal(h.inspect('quiz.results[0].retried'), true);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 1);
  assert.deepEqual(h.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 0, w: 1 });
  assert.deepEqual(h.inspect('prof().daily[todayKey()]'), { q: 1, c: 0 });
  assert.deepEqual(h.inspect('prof().stock'), [key]);
  const saved = h.storage.raw, toneCount = h.audio.oscillators.length;
  h.answer(); h.answer(false);
  assert.equal(h.storage.raw, saved);
  assert.equal(h.audio.oscillators.length, toneCount);
  h.run('nextQ()');
  assert.equal(h.inspect('quiz.i'), 1);
  assert.deepEqual(h.inspect('quiz.qs[1].rejectedIndices'), []);
  assert.equal(h.inspect('quiz.qs[1].firstAttempt'), null);
});

test('grammar retries hide the completed sentence, explanation and pronunciation until the answer is correct', () => {
  const h = harness();
  h.run("setup={dir:'jf',lv:'ぶんぽう3',unitId:'grammar-3-subjunctive'}; startQuiz(false)");
  const originalQuestion = h.document.getElementById('qarea').innerHTML;
  const expectedSpeech = h.inspect('frDisplay(quiz.qs[0].w)');
  h.answer(false); h.flushTimers();
  assert.equal(h.document.getElementById('qarea').innerHTML, originalQuestion);
  assert.doesNotMatch(h.document.getElementById('qarea').innerHTML, /gramfull/);
  assert.equal(h.document.getElementById('expl').style.display, 'none');
  assert.equal(h.utterances.length, 0);
  assert.equal(h.inspect('quiz.results.length'), 0);
  h.answer();
  assert.match(h.document.getElementById('qarea').innerHTML, /gramfull/);
  if (h.inspect('Boolean(quiz.qs[0].w.note)')) assert.equal(h.document.getElementById('expl').style.display, 'block');
  assert.ok(h.pendingTimerDelays().includes(650));
  h.flushTimers();
  assert.equal(h.utterances.at(-1).text, expectedSpeech);
  assert.equal(h.inspect('quiz.results[0].retried'), true);
});

test('a corrected mistake remains in review until a later question is right on the first choice', () => {
  const h = harness(); h.run("setup.dir='jf'; startQuiz(false)");
  const key = h.inspect('wkey(quiz.qs[0].w)');
  h.answer(false); h.answer();
  assert.equal(h.inspect('quiz.results[0].stocked'), true);
  assert.equal(h.inspect('quiz.results[0].unstocked'), false);
  assert.deepEqual(h.inspect('prof().stock'), [key]);
  h.run("go('scr-home'); startQuiz(true)");
  assert.equal(h.inspect('quiz.qs.length'), 1);
  h.answer(false); h.answer(); h.run('nextQ()');
  assert.deepEqual(h.inspect('prof().stock'), [key]);
  assert.deepEqual(h.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 0, w: 2 });
  assert.equal(h.inspect('quiz.results[0].unstocked'), false);
  h.run('startQuiz(true)'); h.answer();
  assert.equal(h.inspect('quiz.results[0].retried'), false);
  assert.equal(h.inspect('quiz.results[0].unstocked'), true);
  assert.deepEqual(h.inspect('prof().stock'), []);
  assert.deepEqual(h.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 1, w: 2 });
  assert.deepEqual(h.inspect('prof().daily[todayKey()]'), { q: 3, c: 1 });
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 3);
});

test('an unfinished retry survives reload as a mistake and cannot score for a different active profile', () => {
  const initial = JSON.stringify({ profiles: [legacyProfile(1), legacyProfile(2)], active: 1, settings: {} });
  const h = harness(initial); h.run("setup.dir='jf'; startQuiz(false)");
  const key = h.inspect('wkey(quiz.qs[0].w)');
  h.answer(false);
  const saved = h.storage.raw;
  h.run('DB.active=2');
  const before = h.state(), tones = h.audio.oscillators.length;
  h.answer(); h.answer(false); h.run('nextQ(); showResult()');
  assert.deepEqual(h.state(), before);
  assert.equal(h.audio.oscillators.length, tones);
  assert.equal(h.storage.raw, saved);
  const fresh = harness(saved);
  assert.equal(fresh.inspect('quiz'), null);
  assert.deepEqual(fresh.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 0, w: 1 });
  assert.deepEqual(fresh.inspect('prof().stock'), [key]);
  assert.equal(fresh.inspect('prof().adventure.earnedUnits'), 0);
  fresh.run('startQuiz(true)'); fresh.answer();
  assert.deepEqual(fresh.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 1, w: 1 });
  assert.equal(fresh.inspect('prof().adventure.earnedUnits'), 1);
  assert.deepEqual(fresh.inspect('DB.profiles[1].words'), {});
  assert.equal(fresh.inspect('DB.profiles[1].adventure.earnedUnits'), 0);
});

test('a save failure during retry can recover the original mistake and one travel reward without rescoring', () => {
  const h = harness(); h.run("setup.dir='jf'; startQuiz(false); save()");
  const initial = h.storage.raw, key = h.inspect('wkey(quiz.qs[0].w)');
  h.storage.fail = true;
  h.answer(false); h.answer(false); h.answer();
  assert.equal(h.storage.raw, initial);
  assert.ok(h.inspect('storageProblem'));
  assert.equal(h.inspect('quiz.results.length'), 1);
  assert.equal(h.document.getElementById('nextwrap').style.display, 'block');
  assert.deepEqual(h.inspect('prof().words[' + JSON.stringify(key) + ']'), { c: 0, w: 1 });
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 1);
  h.storage.fail = false; h.run('save(); save()');
  const persisted = JSON.parse(h.storage.raw).profiles[0];
  assert.deepEqual(persisted.words[key], { c: 0, w: 1 });
  assert.deepEqual(persisted.stock, [key]);
  assert.equal(persisted.adventure.earnedUnits, 1);
  assert.equal(Object.values(persisted.daily).reduce((sum, day) => sum + day.q, 0), 1);
  assert.equal(h.inspect('storageProblem'), null);
});

test('results distinguish first-choice mastery from retry completion and reserve perfect for first-choice success', () => {
  for (const mistakes of [0, 1, 3]) {
    const h = harness(); h.run('startQuiz(false)');
    h.finish(index => index >= mistakes);
    assert.equal(h.inspect('quiz.correct'), 3);
    assert.equal(h.inspect('quiz.results.length'), 3);
    assert.equal(h.inspect('quiz.results.filter(result=>result.retried).length'), mistakes);
    assert.equal(h.inspect('quiz.results.every(result=>result.ok)'), true);
    assert.equal(h.inspect('prof().adventure.introCompleted'), true);
    assert.equal(h.inspect('prof().adventure.earnedUnits'), 3);
    assert.deepEqual(h.inspect('prof().daily[todayKey()]'), { q: 3, c: 3 - mistakes });
    const plain = html => html.replace(/<rt>[\s\S]*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
    const summary = h.document.getElementById('rscore').innerHTML + h.document.getElementById('rmsg').innerHTML;
    assert.match(plain(h.document.getElementById('rscore').innerHTML), /3\s*\/\s*3\s*問クリア/);
    const detail = plain(h.document.getElementById('rscore-detail').innerHTML);
    assert.match(detail, new RegExp('はじめに正解\\s*' + (3 - mistakes) + '\\s*問'));
    assert.match(detail, new RegExp('選び直して正解\\s*' + mistakes + '\\s*問'));
    if (mistakes) assert.doesNotMatch(summary, /パーフェクト/);
    else assert.match(summary, /パーフェクト/);
    const saved = h.storage.raw, tones = h.audio.oscillators.length;
    h.run('showResult(); nextQ()');
    assert.equal(h.storage.raw, saved);
    assert.equal(h.audio.oscillators.length, tones, 'result revisits never repeat the completion sound');
  }
});

function visibleMarkup(html) {
  return html.replace(/<rt>[\s\S]*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
}

test('new and legacy profiles start at zero XP without estimating it from earlier learning or travel', () => {
  const fresh = harness(null);
  fresh.document.getElementById('nameinput').value = 'XPの確認';
  fresh.document.getElementById('btnpcreate').click();
  assert.equal(fresh.inspect('prof().xp'), 0);
  assert.equal(JSON.parse(fresh.storage.raw).profiles[0].xp, 0);
  fresh.run('renderHome()');
  assert.equal(fresh.document.getElementById('home-xp-total').textContent, '0');

  const old = legacyProfile(), word = curriculum.WORDS[0], key = word.fr + '::' + word.ja;
  old.words[key] = { c: 40, w: 5 };
  old.daily['2026-10-05'] = { q: 45, c: 40 };
  Adventure.ensure(old);
  for (let i = 0; i < 40; i++) Adventure.addCorrect(old, 'old-xp:' + i);
  const source = JSON.stringify({ profiles: [old], active: old.id, settings: { voiceName: 'Thomas' } });
  const h = harness(source);
  h.run('renderHome()');
  assert.equal(h.inspect('prof().xp'), 0);
  assert.equal(h.document.getElementById('home-xp-total').textContent, '0');
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 40);
  assert.deepEqual(h.inspect('prof().words'), old.words);
  assert.deepEqual(h.inspect('prof().daily'), old.daily);
  assert.equal(h.inspect('DB.settings.voiceName'), 'Thomas');
  assert.equal(h.storage.raw, source, 'viewing an older profile does not silently overwrite its source');
});

test('the three-question intro awards six XP for first choices or three XP for corrected mistakes', () => {
  for (const retry of [false, true]) {
    const h = harness(); h.run("setup.dir='jf'; startQuiz(false)");
    const gain = retry ? 1 : 2;
    for (let index = 0; index < 3; index++) {
      if (retry) {
        h.answer(false);
        assert.equal(h.inspect('prof().xp'), index * gain);
        assert.equal(h.inspect('quiz.xpEarned'), index * gain);
        assert.doesNotMatch(h.document.getElementById('quiz-xp').innerHTML, /xp-gain/);
      }
      h.answer();
      assert.equal(h.inspect('quiz.results.at(-1).xp'), gain);
      assert.equal(h.inspect('quiz.xpEarned'), (index + 1) * gain);
      assert.equal(JSON.parse(h.storage.raw).profiles[0].xp, (index + 1) * gain);
      assert.match(visibleMarkup(h.document.getElementById('quiz-xp').innerHTML), new RegExp('\\+' + gain + ' XP'));
      assert.match(visibleMarkup(h.document.getElementById('quiz-xp').innerHTML), new RegExp('今回\\s*' + ((index + 1) * gain) + ' XP'));
      h.run('nextQ()');
      if (index < 2) assert.doesNotMatch(h.document.getElementById('quiz-xp').innerHTML, /xp-gain/, 'the previous question reward does not flash on the next question');
    }
    const earned = 3 * gain;
    assert.equal(h.document.getElementById('result-xp-earned').textContent, '+' + earned);
    assert.equal(h.document.getElementById('result-xp-total').textContent, String(earned));
    const breakdown = visibleMarkup(h.document.getElementById('result-xp-breakdown').innerHTML);
    assert.match(breakdown, new RegExp('一発正解 ' + (retry ? 0 : 3) + '問 × 2 XP'));
    assert.match(breakdown, new RegExp('選び直して正解 ' + (retry ? 3 : 0) + '問 × 1 XP'));
    const saved = h.storage.raw, writes = h.storage.writes;
    h.run('showResult(); showResult(); nextQ(); answer(0); renderHome()');
    assert.equal(h.document.getElementById('home-xp-total').textContent, String(earned));
    assert.equal(h.storage.raw, saved);
    assert.equal(h.storage.writes, writes);
    assert.equal(h.inspect('prof().adventure.earnedUnits'), 3, 'XP does not accelerate travel');
  }
});

test('eight first answers plus two retries earn eighteen XP and completed and interrupted rounds accumulate', () => {
  const h = harness(); beginSoundRound(h);
  h.finish(index => index !== 2 && index !== 7);
  assert.equal(h.inspect('quiz.xpEarned'), 18);
  assert.equal(h.inspect('prof().xp'), 18);
  assert.equal(h.document.getElementById('result-xp-earned').textContent, '+18');
  assert.equal(h.inspect('quiz.results.reduce((sum,result)=>sum+result.xp,0)'), 18);
  h.run('startQuiz(false)');
  assert.equal(h.inspect('quiz.xpEarned'), 0);
  h.finish();
  assert.equal(h.inspect('prof().xp'), 38);
  assert.equal(h.document.getElementById('result-xp-total').textContent, '38');
  h.run('startQuiz(false)'); h.answer();
  assert.equal(h.inspect('prof().xp'), 40);
  h.run("go('scr-home'); renderHome()");
  assert.equal(h.inspect('quiz'), null);
  assert.equal(h.document.getElementById('home-xp-total').textContent, '40');
  const reloaded = harness(h.storage.raw);
  reloaded.run('renderHome(); startQuiz(false)');
  assert.equal(reloaded.inspect('prof().xp'), 40, 'leaving an unfinished round retains XP already earned');
  assert.equal(reloaded.inspect('quiz.xpEarned'), 0);
  assert.equal(reloaded.inspect('prof().adventure.earnedUnits'), 21);
});

test('wrong attempts and duplicate inputs never add XP and switching profiles keeps separate totals', () => {
  const h = harness(JSON.stringify({ profiles: [legacyProfile(1), legacyProfile(2)], active: 1, settings: {} }));
  h.run("setup.dir='jf'; startQuiz(false)");
  for (const offset of [1, 2, 3]) {
    h.run('answer((quiz.qs[quiz.i].ansIdx+' + offset + ')%quiz.qs[quiz.i].opts.length)');
    assert.equal(h.inspect('prof().xp'), 0);
    assert.equal(h.inspect('quiz.xpEarned'), 0);
  }
  h.answer(false); h.run('nextQ(); showResult()');
  assert.equal(h.inspect('prof().xp'), 0);
  h.answer();
  const saved = h.storage.raw;
  assert.equal(h.inspect('prof().xp'), 1);
  h.answer(); h.answer(false);
  assert.equal(h.storage.raw, saved);
  h.run("go('scr-profile'); renderProfiles()");
  h.document.getElementById('pgrid').children[1].click();
  assert.equal(h.inspect('DB.active'), 2);
  assert.equal(h.document.getElementById('home-xp-total').textContent, '0');
  h.run('startQuiz(false)'); h.answer();
  assert.equal(h.inspect('prof().xp'), 2);
  h.run("go('scr-profile'); renderProfiles()");
  h.document.getElementById('pgrid').children[0].click();
  assert.equal(h.document.getElementById('home-xp-total').textContent, '1');
  const reloaded = harness(h.storage.raw);
  assert.deepEqual(reloaded.inspect('DB.profiles.map(p=>p.xp)'), [1, 2]);
  assert.equal(reloaded.inspect('prof().id'), 1);
});

test('saving after an XP write failure recovers the latest total without repeating awards', () => {
  const h = harness(); h.run("setup.dir='jf'; startQuiz(false); save()");
  const initial = h.storage.raw;
  h.storage.fail = true;
  h.answer(false); h.answer();
  h.run('nextQ()'); h.answer();
  assert.equal(h.inspect('prof().xp'), 3);
  assert.equal(h.inspect('quiz.xpEarned'), 3);
  assert.equal(h.storage.raw, initial);
  assert.equal(JSON.parse(h.storage.raw).profiles[0].xp, 0);
  assert.ok(h.inspect('storageProblem'));
  h.storage.fail = false; h.run('save()');
  assert.equal(JSON.parse(h.storage.raw).profiles[0].xp, 3);
  const saved = h.storage.raw, writes = h.storage.writes;
  h.answer(); h.run('save(); save()');
  assert.equal(h.storage.raw, saved);
  assert.equal(h.storage.writes, writes);
  assert.equal(h.inspect('storageProblem'), null);
  const fresh = harness(saved);
  assert.equal(fresh.inspect('prof().xp'), 3);
  assert.equal(fresh.inspect('prof().adventure.earnedUnits'), 2);
  assert.equal(fresh.inspect('totalAnswered(prof())'), 2);
});

test('the real export and import controls preserve XP with every profile and the existing records', async () => {
  const data = { profiles: [legacyProfile(1), { ...legacyProfile(2), xp: 1234 }], active: 1, settings: { voiceName: 'Thomas', sound: false } };
  const h = harness(JSON.stringify(data));
  h.run('startQuiz(false)'); h.finish(index => index !== 1);
  assert.equal(h.inspect('prof().xp'), 5);
  h.document.getElementById('btnexport').click();
  assert.equal(h.downloads.length, 1);
  const backup = await h.downloads[0].text();
  assert.deepEqual(JSON.parse(backup).profiles.map(p => p.xp), [5, 1234]);
  const receiver = harness(null);
  receiver.importText(backup);
  assert.deepEqual(receiver.alerts, []);
  assert.deepEqual(receiver.inspect('DB'), JSON.parse(backup), 'import keeps learning, travel and settings alongside XP');
  assert.deepEqual(JSON.parse(receiver.storage.raw).profiles.map(p => p.xp), [5, 1234]);
  receiver.run('renderProfiles()');
  receiver.document.getElementById('pgrid').children[1].click();
  assert.equal(receiver.document.getElementById('home-xp-total').textContent, '1,234');
  assert.equal(receiver.inspect('DB.settings.voiceName'), 'Thomas');
  assert.equal(receiver.inspect('DB.settings.sound'), false);
  const reloaded = harness(receiver.storage.raw);
  assert.equal(reloaded.inspect('prof().xp'), 1234);
  assert.deepEqual(reloaded.inspect('DB.profiles[0].stock'), h.inspect('DB.profiles[0].stock'));
});

test("a saved interrupted round retains partial travel but starts a new question sequence", () => {
  const h = harness();
  h.run("prof().adventure.introCompleted=true; Adventure.selectPath(prof(),'trocadero--seine'); startQuiz(false)");
  h.answer(); h.run("nextQ()"); h.answer(false); h.run("nextQ()"); h.answer();
  const fresh = harness(h.storage.raw);
  assert.equal(fresh.inspect("quiz"), null);
  assert.equal(fresh.inspect("prof().adventure.activeLeg.progressUnits"), 2);
  assert.equal(fresh.inspect("totalAnswered(prof())"), 2, 'correcting the same question does not add a second learning attempt');
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
  assert.equal(h.inspect("prof().adventure.earnedUnits"), 3, 'clearing each question after retry still advances the journey');
  assert.deepEqual(h.inspect("StudyGuide.progress(prof(),'grammar-3-subjunctive',WORDS)"), { attempted: 3, total: 10, complete: false });
  h.run("startQuiz(false)");
  assert.equal(h.inspect("quiz.qs.length"), 10);
});

test("changing visual intensity never redraws or re-scores the current question", () => {
  for (const correct of [false, true]) {
    const h = harness();
    h.run("startQuiz(false)");
    h.answer(correct);
    const question = h.inspect("({i:quiz.i,correct:quiz.correct,results:quiz.results,qs:quiz.qs,answered:quiz.answered})");
    const disabled = h.document.querySelectorAll('#opts .opt').map(button => !!button.disabled);
    h.run("setEffects('calm'); setEffects('rich')");
    assert.deepEqual(h.inspect("({i:quiz.i,correct:quiz.correct,results:quiz.results,qs:quiz.qs,answered:quiz.answered})"), question);
    assert.deepEqual(h.document.querySelectorAll('#opts .opt').map(button => !!button.disabled), disabled);
    assert.equal(h.inspect("prof().adventure.earnedUnits"), correct ? 1 : 0);
  }
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
  const expected = ['peek', 'clap', 'stars', 'hop', 'peek', 'balloons', 'clap', 'hop'];
  let correct = 0;
  for (const ok of answers) {
    if (!ok) {
      h.answer(false);
      assert.equal(h.inspect('quiz.correct'), correct);
      assert.equal(panel.hidden, true);
      assert.equal(panel.innerHTML, '');
      assert.equal(h.pendingTimerDelays().includes(1350), false);
    }
    h.answer(); correct++;
    assert.equal(h.inspect('quiz.correct'), correct);
    assert.match(panel.innerHTML, new RegExp('data-variant="' + expected[correct - 1] + '"'));
    if (correct === 3 || correct === 6) {
      assert.match(panel.innerHTML, new RegExp(correct === 3 ? 'correct-special-stars' : 'correct-special-balloons'));
    } else assert.doesNotMatch(panel.innerHTML, /correct-special-(stars|balloons)/);
    h.run('nextQ()');
  }
  assert.equal(h.inspect('totalAnswered(prof())'), 8);
  assert.equal(h.inspect('prof().adventure.earnedUnits'), 8);
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
  for (let i = 0; i < 9; i++) { h.answer(); h.run('nextQ()'); }
  h.answer(false);
  h.run('nextQ()');
  assert.equal(h.inspect('quiz.results.length'), 9, 'the last wrong answer is not a completed question');
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
