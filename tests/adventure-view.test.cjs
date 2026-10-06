"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const Adventure = require("../adventure.js");
const WorldData = require("../world-data.js");
const NOW = Date.UTC(2026, 9, 6);

// A non-rendering DOM boundary: only the selectors, HTML-created controls,
// click listeners, and focus operations used by the actual view are modeled.
// In particular, a missing control returns null rather than a fabricated node.
class Element {
  constructor(document, tag = "div", attributes = {}) {
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.attributes = attributes;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
  }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  set innerHTML(html) {
    this.html = String(html);
    this.children = [];
    const stack = [this];
    for (const token of this.html.match(/<[^>]*>|[^<]+/g) || []) {
      if (token.startsWith("</")) {
        const tag = token.slice(2, -1).trim().toUpperCase();
        assert.equal(stack.at(-1).tagName, tag, "test DOM requires balanced production HTML");
        stack.pop();
      } else if (token.startsWith("<")) {
        const tag = /^<([\w-]+)/.exec(token);
        if (!tag) continue;
        const attributes = {};
        for (const match of token.slice(tag[0].length).matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) attributes[match[1]] = match[2] || "";
        const child = new Element(this.ownerDocument, tag[1], attributes);
        stack.at(-1).children.push(child);
        if (!/\/\s*>$/.test(token) && !/^(img|input|br|hr|meta|link)$/i.test(tag[1])) stack.push(child);
      } else {
        stack.at(-1).children.push(token);
      }
    }
    assert.equal(stack.length, 1, "test DOM requires closed production HTML");
  }
  get innerHTML() { return this.html || ""; }
  get textContent() { return this.children.map(child => typeof child === "string" ? child : child.textContent).join(""); }
  contains(target) { return target === this || this.children.some(child => typeof child !== "string" && child.contains(target)); }
  matches(selector) {
    if (selector.startsWith("#")) return this.getAttribute("id") === selector.slice(1);
    if (selector.startsWith(".")) return (this.getAttribute("class") || "").split(/\s+/).includes(selector.slice(1));
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute) return this.getAttribute(attribute[1]) !== null && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    assert.match(selector, /^[\w-]+$/, "unsupported test DOM selector: " + selector);
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) if (typeof child !== "string") {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  focus(options) { this.ownerDocument.activeElement = this; this.ownerDocument.focusCalls.push({ target: this, options }); }
  scrollIntoView(options) { this.ownerDocument.scrollCalls.push({ target: this, options }); }
  click() {
    if (this.getAttribute("disabled") !== null) return;
    this.focus();
    for (const listener of this.listeners.click || []) listener({ target: this, stopPropagation() {}, preventDefault() {} });
  }
}

function harness() {
  const document = { activeElement: null, focusCalls: [], scrollCalls: [] };
  const context = vm.createContext({ document, WorldData, Adventure });
  context.window = context;
  vm.runInContext(readFileSync(join(__dirname, "../adventure-view.js"), "utf8"), context, { filename: "adventure-view.js" });
  return { view: context.AdventureView, document, container: () => new Element(document) };
}

function profile() {
  const p = { id: 1, name: "案内の確認", words: {}, daily: {}, stock: [] };
  Adventure.ensure(p, NOW);
  return p;
}

function correct(p, amount, prefix = "learning") {
  for (let i = 0; i < amount; i++) assert.equal(Adventure.addCorrect(p, prefix + ":" + i, NOW + i).added, true);
  assert.equal(Adventure.status(p).ok, true);
}

function readyForFinale() {
  const p = profile();
  for (const placeId of ["eiffel", "versailles", "chambord", "mont-saint-michel", "marseille"]) {
    const edge = Adventure.edges.find(item => item.from === p.adventure.currentNodeId && item.to === placeId);
    assert.ok(edge, "fixture uses a real route");
    assert.equal(Adventure.selectPath(p, edge.id, NOW).changed, true);
    correct(p, edge.cost, placeId);
  }
  assert.equal(Adventure.getFinaleStatus(p).unlocked, true);
  return p;
}

function click(container, selector) {
  const control = container.querySelector(selector);
  assert.ok(control, "missing real rendered control " + selector);
  assert.equal((control.listeners.click || []).length, 1, "one actual click handler is connected");
  control.click();
}

function nextStep(p, options = {}) {
  const h = harness(), container = h.container(), calls = [], before = JSON.stringify(p);
  const handlers = {
    onStudy: () => calls.push(["study"]), onMap: () => calls.push(["map"]),
    onFinaleDetails: () => calls.push(["finale-details"]), onJournal: tab => calls.push(["journal", tab])
  };
  h.view.renderNextStep(container, p, { ...options, ...handlers });
  assert.deepEqual(calls, [], "rendering alone must not navigate or start learning");
  assert.equal(container.querySelectorAll("[data-next-action]").length, 1);
  click(container, "[data-next-action]");
  assert.equal(JSON.stringify(p), before, "view and navigation callbacks do not mutate learning or travel");
  return calls;
}

test("an unfinished ordinary journey continues through the study callback", () => {
  const p = profile();
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 1);
  assert.deepEqual(nextStep(p), [["study"]]);
  assert.equal(p.adventure.activeLeg.progressUnits, 1);
});

test("arrival and an unselected route lead to the map without choosing a new road", () => {
  const p = profile();
  assert.deepEqual(nextStep(p), [["map"]]);
  Adventure.selectPath(p, "trocadero--seine", NOW);
  correct(p, 4);
  assert.deepEqual(nextStep(p, { arrivals: ["seine"] }), [["map"]]);
  assert.equal(p.adventure.activeLeg, null);
  assert.equal(p.adventure.pendingUnits, 1);
});

test("a ready finale opens its introduction without starting it or spending carryover", () => {
  const p = readyForFinale();
  correct(p, 5, "carryover");
  assert.deepEqual(nextStep(p, { arrivals: ["marseille"] }), [["finale-details"]]);
  assert.equal(p.adventure.finale, undefined);
  assert.equal(p.adventure.pendingUnits, 5);
});

test("an active finale continues learning, including when a stale completion hint is passed", () => {
  const p = readyForFinale();
  Adventure.startFinale(p, NOW);
  correct(p, 2, "treasure");
  assert.deepEqual(nextStep(p), [["study"]]);
  assert.deepEqual(nextStep(p, { finaleCompleted: true }), [["study"]]);
  assert.equal(p.adventure.finale.correctCount, 2);
});

test("only this round's confirmed finale completion points to the character journal", () => {
  const p = readyForFinale();
  Adventure.startFinale(p, NOW);
  correct(p, WorldData.finale.requiredCorrect, "treasure");
  assert.equal(Adventure.getFinaleStatus(p).completed, true);
  assert.deepEqual(nextStep(p, { finaleCompleted: true }), [["journal", "characters"]]);
  assert.deepEqual(nextStep(p), [["map"]], "past completion does not repeat the reward navigation");
});

test("home preview shows the actual next vehicle and does not invent another reward after all four", () => {
  for (const amount of [0, 2, 3, 23, 24, 71, 72, 119, 120]) {
    const p = profile(); correct(p, amount);
    const h = harness(), container = h.container(), calls = [], before = JSON.stringify(p);
    h.view.renderHomePreview(container, p, {
      onJournal: tab => calls.push(["journal", tab]), onFinaleDetails: () => calls.push(["finale-details"])
    });
    const card = container.querySelector(".av-home-vehicle");
    assert.ok(card);
    const expected = WorldData.vehicles.find(vehicle => vehicle.requiredUnits > amount);
    const picture = card.querySelector("img");
    if (expected) {
      assert.equal(picture && picture.getAttribute("src").split('?')[0], expected.asset);
      assert.match(card.textContent, new RegExp("あと\\s*" + (expected.requiredUnits - amount) + "\\s*問"));
      assert.doesNotMatch(card.textContent, /全部そろった/);
    } else {
      assert.equal(picture, null, "there is no fictional fifth vehicle preview");
      assert.doesNotMatch(card.textContent, /あと|次は/);
      assert.match(card.textContent, /全部そろった/);
    }
    assert.deepEqual(calls, []);
    click(container, "[data-home-vehicles]");
    click(container, "[data-finale-details]");
    assert.deepEqual(calls, [["journal", "vehicles"], ["finale-details"]]);
    assert.equal(JSON.stringify(p), before);
  }
});

test("home preview follows the chosen destination and the active imaginary finale without changing location", () => {
  const p = profile(), h = harness(), container = h.container();
  Adventure.selectPath(p, "trocadero--versailles", NOW);
  let before = JSON.stringify(p);
  h.view.renderHomePreview(container, p);
  assert.equal(container.querySelector(".av-scene-art").getAttribute("src"), WorldData.getNode("versailles").illustration);
  assert.equal(JSON.stringify(p), before);
  const ready = readyForFinale();
  Adventure.startFinale(ready, NOW);
  before = JSON.stringify(ready);
  h.view.renderHomePreview(container, ready);
  assert.equal(container.querySelector(".av-scene-art").getAttribute("src"), WorldData.finale.illustration);
  assert.equal(JSON.stringify(ready), before);
  assert.equal(ready.adventure.currentNodeId, "marseille");
});

test("unsupported saved journeys offer ordinary study without claiming progress or rewriting the data", () => {
  for (const adventure of [
    { schemaVersion: 999, payload: { retain: true } },
    { schemaVersion: 1, currentNodeId: "paris-start", privateOldField: [1, 2] },
    { schemaVersion: 2, currentNodeId: "unknown-place", earnedUnits: -4 }
  ]) {
    const p = { id: 77, adventure, words: { retained: { c: 2, w: 1 } } };
    assert.equal(Adventure.status(p).ok, false);
    const before = JSON.stringify(p), h = harness(), container = h.container();
    assert.doesNotThrow(() => h.view.renderHomePreview(container, p));
    assert.equal(container.querySelector(".av-home-vehicle"), null);
    assert.equal(container.querySelector("[data-finale-details]"), null);
    assert.deepEqual(nextStep(p, { finaleCompleted: true }), [["study"]]);
    assert.equal(JSON.stringify(p), before);
  }
});

test("rendering a learning-only profile does not create optional journey state", () => {
  const p = { id: 9, words: { "bonjour::こんにちは": { c: 500, w: 0 } }, daily: {}, stock: [] };
  const before = JSON.stringify(p), h = harness();
  h.view.renderHomePreview(h.container(), p);
  assert.deepEqual(nextStep(p), [["map"]]);
  assert.equal(JSON.stringify(p), before);
  assert.equal(Object.hasOwn(p, "adventure"), false);
});

test("finale focus is explicit and consumed before internal map redraws", () => {
  const p = profile(), before = JSON.stringify(p), h = harness(), container = h.container();
  const finaleFocuses = () => h.document.focusCalls.filter(call => call.target.getAttribute("id") === "av-finale-details");
  h.view.renderMap(container, p);
  assert.equal(finaleFocuses().length, 0);
  assert.equal(h.document.scrollCalls.length, 0);
  h.view.renderMap(container, p, { focusFinale: true });
  assert.equal(finaleFocuses().length, 1);
  assert.equal(h.document.scrollCalls.length, 1);
  assert.equal(h.document.scrollCalls[0].target.getAttribute("id"), "av-finale-details");
  assert.equal(h.document.scrollCalls[0].options.behavior, "auto");
  click(container, '[data-scope="france"]');
  click(container, '[data-region="provence"]');
  assert.equal(finaleFocuses().length, 1, "changing the map does not steal focus back to the finale");
  assert.equal(h.document.scrollCalls.length, 1);
  click(container, "[data-finale-details]");
  assert.equal(finaleFocuses().length, 2, "an explicit local details click can focus the card");
  assert.equal(h.document.scrollCalls.length, 2);
  assert.equal(JSON.stringify(p), before);
});

test("an explicit map details callback takes precedence over local focus and does not start the finale", () => {
  const p = readyForFinale(), before = JSON.stringify(p), h = harness(), container = h.container(), calls = [];
  h.view.renderMap(container, p, { onFinaleDetails: () => calls.push("details"), onFinale: () => calls.push("start") });
  assert.deepEqual(calls, []);
  click(container, "[data-finale-details]");
  assert.deepEqual(calls, ["details"]);
  assert.equal(h.document.scrollCalls.length, 0);
  assert.equal(JSON.stringify(p), before);
});

test("the bicycle uses a basket passenger on the shared vehicle canvas for all four reactions", () => {
  const p = profile(), h = harness(), container = h.container();
  correct(p, 3);
  Adventure.setVehicle(p, "bicycle");
  p.words["bonjour::こんにちは"] = { c: 2, w: 1 };
  p.daily["2026-10-06"] = { q: 3, c: 2 };
  p.stock.push("bonjour::こんにちは");
  const before = JSON.stringify(p);
  for (const reaction of ["idle", "correct", "wrong", "arrival"]) {
    h.view.renderScene(container, p, { reaction });
    const poses = container.querySelectorAll(".av-bicycle-rider");
    assert.equal(poses.length, 1, "one basket passenger replaces the upright companion");
    assert.equal(container.querySelector(".av-rider"), null);
    assert.equal(container.querySelector(".av-companion"), null);
    const pose = poses[0], vehicle = container.querySelector(".av-vehicle-art");
    const [posePath, poseVersion] = pose.getAttribute("src").split("?");
    const [vehiclePath, vehicleVersion] = vehicle.getAttribute("src").split("?");
    assert.equal(posePath, "img/adventure/rider-bicycle-" + reaction + ".svg");
    assert.equal(vehiclePath, WorldData.getVehicle("bicycle").asset);
    assert.ok(poseVersion, "the new pose has a cache version");
    assert.equal(poseVersion, vehicleVersion, "the basket passenger and vehicle refresh together");
    for (const [element, asset] of [[pose, posePath], [vehicle, vehiclePath]]) {
      assert.equal(element.getAttribute("width"), "320");
      assert.equal(element.getAttribute("height"), "220");
      const svg = readFileSync(join(__dirname, "..", asset), "utf8").match(/<svg\b[^>]*>/)?.[0];
      assert.ok(svg, asset + " exists and has an SVG root");
      assert.match(svg, /\bviewBox="0 0 320 220"/, "both layers share the same coordinate system");
    }
    assert.equal(JSON.stringify(p), before, "posing never changes learning or the selected vehicle");
  }
});

test("switching from the bicycle removes its basket passenger from every shared journey view", () => {
  const p = profile(), h = harness();
  correct(p, 120);
  const screens = [
    { render: container => h.view.renderScene(container, p, { reaction: "idle" }) },
    { render: container => h.view.renderHomePreview(container, p) },
    { render: container => h.view.renderMap(container, p) },
    { render: container => h.view.renderResult(container, p, { earned: 0, arrivals: [] }) }
  ].map(screen => ({ ...screen, container: h.container() }));
  for (const destination of ["car", "balloon", "dragon", "walk"]) {
    for (const vehicleId of ["bicycle", destination]) {
      assert.equal(Adventure.setVehicle(p, vehicleId).changed, true);
      const before = JSON.stringify(p);
      for (const { render, container } of screens) {
        render(container);
        if (vehicleId === "bicycle") {
          assert.ok(container.querySelector(".av-bicycle-rider"));
        } else {
          assert.equal(container.querySelector(".av-bicycle-rider"), null, "the previous pose is removed");
          assert.ok(container.querySelector(".av-companion"), "ordinary companions remain available");
          if (vehicleId === "walk") assert.equal(container.querySelector(".av-mounted"), null);
          else assert.ok(container.querySelector(".av-vehicle-" + vehicleId));
        }
        assert.equal(JSON.stringify(p), before, "redrawing does not change the saved profile");
      }
    }
  }
});

const newParisPlaceIds = ['arc-de-triomphe', 'louvre', 'notre-dame'];

function postcard(container, placeId) {
  const card = container.querySelectorAll('.av-postcard').find(item => item.querySelector('[data-open-place="' + placeId + '"]'));
  assert.ok(card, 'the journal contains a postcard for ' + placeId);
  return card;
}

test('each added Paris landmark is selectable before earning progress and exposes its real route and recommendations', () => {
  const p = profile(), h = harness(), container = h.container(), calls = [];
  p.words['bonjour::こんにちは'] = { c: 2, w: 1 };
  p.stock.push('bonjour::こんにちは');
  const before = JSON.stringify(p);
  h.view.renderMap(container, p, {
    onChoose: edgeId => calls.push(['choose', edgeId]),
    onRecommend: recommendationId => calls.push(['recommend', recommendationId])
  });
  const parisIds = WorldData.nodes.filter(place => place.regionId === 'paris').map(place => place.id);
  assert.deepEqual(new Set(container.querySelectorAll('[data-place]').map(button => button.dataset.place)), new Set(parisIds));
  for (const id of newParisPlaceIds) {
    const place = WorldData.getNode(id);
    assert.ok(place, id + ' is present in the actual catalog');
    const edge = Adventure.edges.find(item => item.from === 'trocadero' && item.to === id);
    assert.ok(edge, 'the new destination has a route from the initial location');
    calls.length = 0;
    click(container, '[data-place="' + id + '"]');
    assert.deepEqual(calls, [], 'looking at a landmark neither chooses its route nor starts learning');
    const markers = container.querySelectorAll('[data-place]');
    assert.deepEqual(markers.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.place), [id]);
    const detail = container.querySelector('.av-place-detail');
    assert.equal(detail.querySelector('h3').textContent, place.name);
    assert.equal(detail.querySelector('img').getAttribute('src').split('?')[0], place.illustration);
    assert.match(detail.querySelector('.av-discovery-status').textContent, /予告/);
    const choose = detail.querySelector('[data-action="choose"]');
    assert.ok(choose, 'an unvisited landmark remains available without level or vehicle requirements');
    assert.equal(choose.getAttribute('disabled'), null);
    assert.equal(choose.dataset.edge, edge.id);
    click(container, '[data-edge="' + edge.id + '"]');
    assert.deepEqual(calls, [['choose', edge.id]]);
    assert.ok(place.recommendations.length > 0);
    assert.deepEqual(detail.querySelectorAll('[data-recommendation]').map(button => button.dataset.recommendation), place.recommendations.map(item => item.id));
    for (const recommendation of place.recommendations) click(container, '[data-recommendation="' + recommendation.id + '"]');
    assert.deepEqual(calls, [['choose', edge.id], ...place.recommendations.map(item => ['recommend', item.id])]);
    assert.equal(JSON.stringify(p), before, 'view callbacks leave route selection and learning changes to the app');
  }
  click(container, '[data-scope="france"]');
  assert.equal(container.querySelectorAll('[data-region]').length, WorldData.regions.length);
  click(container, '[data-scope="paris"]');
  assert.deepEqual(new Set(container.querySelectorAll('[data-place]').map(button => button.dataset.place)), new Set(parisIds));
  assert.equal(JSON.stringify(p), before);
});

test('unvisited journal cards include every catalog place and repeatedly open the requested Paris detail', () => {
  const p = profile(), h = harness(), journal = h.container(), map = h.container(), calls = [];
  const before = JSON.stringify(p);
  h.view.renderJournal(journal, p, { tab: 'places', onMap: id => calls.push(id) });
  assert.equal(journal.querySelectorAll('.av-postcard').length, WorldData.nodes.length);
  assert.match(journal.querySelector('[data-tab="places"]').textContent, new RegExp('1 / ' + WorldData.nodes.length + '$'));
  for (const id of newParisPlaceIds) {
    const place = WorldData.getNode(id), card = postcard(journal, id);
    assert.ok(card.matches('.is-unfound'));
    assert.ok(card.querySelector('.av-landmark-silhouette'));
    assert.equal(card.querySelector('img'), null, 'the visited illustration is not awarded ahead of arrival');
    assert.match(card.textContent, /未訪問/);
    click(journal, '[data-open-place="' + id + '"]');
    assert.equal(calls.at(-1), id);
    h.view.renderMap(map, p, { focusPlaceId: id });
    assert.equal(map.querySelector('.av-place-detail').querySelector('h3').textContent, place.name);
    click(map, '[data-place="seine"]');
    h.view.renderMap(map, p, { focusPlaceId: id });
    assert.equal(map.querySelector('.av-place-detail').querySelector('h3').textContent, place.name, 'opening the same journal link again consumes the new explicit focus');
    assert.equal(map.querySelector('[data-place="' + id + '"]').getAttribute('aria-pressed'), 'true');
    assert.equal(JSON.stringify(p), before);
  }
});

test('travel to each new landmark previews its own scene and awards its postcard only after arrival', () => {
  for (const id of newParisPlaceIds) {
    const p = profile(), h = harness(), scene = h.container(), journal = h.container(), result = h.container();
    const place = WorldData.getNode(id), start = WorldData.getNode(p.adventure.currentNodeId);
    const edge = Adventure.edges.find(item => item.from === start.id && item.to === id);
    h.view.renderScene(scene, p, { reaction: 'idle' });
    assert.equal(Adventure.selectPath(p, edge.id, NOW).changed, true);
    let before = JSON.stringify(p);
    h.view.renderScene(scene, p, { reaction: 'correct' });
    assert.equal(scene.querySelector('.av-scene-art').getAttribute('src').split('?')[0], start.illustration, 'answer feedback keeps the existing scenery until the next idle question');
    h.view.renderScene(scene, p, { reaction: 'idle' });
    assert.equal(scene.querySelector('.av-scene-art').getAttribute('src').split('?')[0], place.illustration);
    assert.match(scene.querySelector('.av-scene-location').textContent, /この先の景色/);
    h.view.renderScene(scene, p, { reaction: 'wrong' });
    assert.equal(scene.querySelector('.av-scene-art').getAttribute('src').split('?')[0], place.illustration);
    h.view.renderJournal(journal, p, { tab: 'places' });
    assert.ok(postcard(journal, id).matches('.is-unfound'));
    assert.equal(JSON.stringify(p), before);
    correct(p, edge.cost, id);
    assert.equal(p.adventure.currentNodeId, id);
    before = JSON.stringify(p);
    h.view.renderScene(scene, p, { reaction: 'arrival' });
    assert.equal(scene.querySelector('.av-scene-art').getAttribute('src').split('?')[0], place.illustration);
    assert.match(scene.querySelector('.av-scene-location').textContent, /現在地/);
    h.view.renderJournal(journal, p, { tab: 'places' });
    const card = postcard(journal, id);
    assert.ok(card.matches('.is-found'));
    assert.equal(card.querySelector('img').getAttribute('src').split('?')[0], place.illustration);
    assert.equal(card.querySelector('.av-landmark-silhouette'), null);
    assert.ok(card.querySelector('.av-learning-trail'), 'the place retains the learning footprint used to arrive');
    assert.match(journal.querySelector('[data-tab="places"]').textContent, new RegExp('2 / ' + WorldData.nodes.length + '$'));
    h.view.renderResult(result, p, { earned: edge.cost, arrivals: [id] });
    assert.equal(result.querySelector('.av-scene-art').getAttribute('src').split('?')[0], place.illustration);
    assert.ok(result.textContent.includes(place.name + 'に到着'));
    assert.match(readFileSync(join(__dirname, '..', place.illustration), 'utf8'), /<svg\b/, 'the new scene refers to an existing SVG asset');
    assert.equal(JSON.stringify(p), before, 'scene, journal and result rendering never modify the saved arrival');
  }
});

test('new Paris postcards do not expand the existing five-character and four-vehicle finale requirements', () => {
  const p = readyForFinale(), h = harness(), container = h.container(), calls = [];
  assert.deepEqual(WorldData.finale.requiredCharacterIds, ['lumie', 'mare', 'plume', 'sol', 'miro']);
  assert.equal(WorldData.finale.requiredVehicleIds.length, 4);
  assert.ok(newParisPlaceIds.every(id => !p.adventure.visited[id]));
  const before = JSON.stringify(p);
  h.view.renderMap(container, p, { onChoose: id => calls.push(id) });
  assert.match(container.querySelector('.av-goal-compact').textContent, /キャラ 5 \/ 5/);
  assert.match(container.querySelector('.av-goal-compact').textContent, /乗り物 4 \/ 4/);
  assert.ok(container.querySelector('[data-action="finale"]'), 'the castle stays ready without visiting the optional new landmarks');
  for (const id of newParisPlaceIds) {
    h.view.renderMap(container, p, { focusPlaceId: id, onChoose: edgeId => calls.push(edgeId) });
    const edge = Adventure.edges.find(item => item.from === p.adventure.currentNodeId && item.to === id);
    click(container, '[data-edge="' + edge.id + '"]');
    assert.equal(calls.at(-1), edge.id, 'ordinary travel stays available when the castle is ready');
  }
  assert.equal(JSON.stringify(p), before);
  assert.equal(Adventure.getFinaleStatus(p).unlocked, true);
});
