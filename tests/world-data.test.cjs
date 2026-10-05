"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const World = require("../world-data.js");
const { WORDS } = require("../words.js");

const expectedPlaces = ["trocadero", "seine", "eiffel", "champ-de-mars", "mont-saint-michel", "chambord", "marseille", "versailles"];
const hosts = new Set(["www.paris.fr", "www.toureiffel.paris", "www.abbaye-mont-saint-michel.fr", "www.chambord.org", "www.marseille-tourisme.com", "www.chateauversailles.fr", "www.versailles-tourisme.com"]);

test("eight real places have unique stable identities and complete display metadata", () => {
  assert.deepEqual(World.nodes.map(node => node.id), expectedPlaces);
  assert.equal(new Set(World.nodes.map(node => node.id)).size, World.nodes.length);
  for (const node of World.nodes) {
    assert.equal(World.getNode(node.id), node);
    assert.ok(World.regions.some(region => region.id === node.regionId && region.status === "ready"));
    for (const field of ["name", "reading", "french", "description", "descriptionReading"]) assert.ok(node[field], node.id + " missing " + field);
    assert.ok(["city", "riverside", "park"].includes(node.scene));
    assert.equal(node.illustration, "img/adventure/" + node.id + ".svg");
    assert.equal(Object.hasOwn(node, "locked"), false);
    assert.equal(Object.hasOwn(node, "requiredLevel"), false);
  }
});

test("recommendations refer to real curriculum themes with at least ten questions", () => {
  const original = JSON.stringify(WORDS);
  const ids = new Set();
  for (const node of World.nodes) {
    assert.equal(World.recommendationsFor(node.id), node.recommendations);
    assert.ok(node.recommendations.length >= 2 && node.recommendations.length <= 3);
    const themes = new Set();
    for (const item of node.recommendations) {
      assert.ok(item.id.startsWith(node.id + "-"));
      assert.equal(ids.has(item.id), false, "ambiguous recommendation id " + item.id);
      ids.add(item.id);
      assert.equal(World.getRecommendation(item.id), item);
      assert.ok(item.label && item.labelReading);
      const theme = item.lv + "::" + item.cat;
      assert.equal(themes.has(theme), false, "duplicate recommendation within " + node.id);
      themes.add(theme);
      const matches = WORDS.filter(word => word.lv === item.lv && word.cat === item.cat);
      assert.ok(matches.length >= 10, item.id + " cannot supply a normal ten-question round");
      assert.equal(Object.hasOwn(item, "locked"), false);
      assert.equal(Object.hasOwn(item, "requiredScore"), false);
    }
  }
  assert.equal(ids.size, 24);
  assert.equal(JSON.stringify(WORDS), original, "recommendation lookup must leave curriculum text and keys unchanged");
});

test("map positions preserve approximate geography and the shared projection", () => {
  for (const node of World.nodes) {
    assert.ok(Number.isFinite(node.lat) && node.lat > 41 && node.lat < 52);
    assert.ok(Number.isFinite(node.lon) && node.lon > -6 && node.lon < 10);
    assert.ok(Number.isFinite(node.x) && node.x >= 0 && node.x <= 100);
    assert.ok(Number.isFinite(node.y) && node.y >= 0 && node.y <= 100);
    if (node.regionId === "paris") {
      const bounds = World.mapBounds.paris;
      const x = 100 * (node.lon - bounds.west) / (bounds.east - bounds.west);
      const y = 100 * (bounds.north - node.lat) / (bounds.north - bounds.south);
      assert.ok(Math.abs(x - node.x) < 0.01, node.id + " longitude disagrees with the local map");
      assert.ok(Math.abs(y - node.y) < 0.01, node.id + " latitude disagrees with the local map");
    }
  }
  const trocadero = World.getNode("trocadero");
  const eiffel = World.getNode("eiffel");
  const champ = World.getNode("champ-de-mars");
  assert.ok(trocadero.lat > eiffel.lat && trocadero.lon < eiffel.lon);
  assert.ok(champ.lat < eiffel.lat && champ.lon > eiffel.lon);
  assert.ok(World.getNode("mont-saint-michel").lon < World.getNode("chambord").lon);
  assert.ok(World.getNode("chambord").lat < eiffel.lat);
  for (const region of World.regions) {
    const bounds = World.mapBounds.france;
    assert.ok(region.lon > bounds.west && region.lon < bounds.east);
    assert.ok(region.lat > bounds.south && region.lat < bounds.north);
  }
});

test("real-place descriptions have official references and every region has a visitable place", () => {
  for (const entry of [...World.nodes, ...World.regions]) {
    const url = new URL(entry.source);
    assert.equal(url.protocol, "https:");
    assert.ok(hosts.has(url.hostname), entry.id + " must cite an official place source");
    assert.ok(url.pathname.length > 1);
    if (entry.coordinateSource) assert.ok(hosts.has(new URL(entry.coordinateSource).hostname));
  }
  assert.equal(new Set(World.regions.map(region => region.id)).size, World.regions.length);
  assert.equal(World.regions.length, 5);
  for (const region of World.regions) {
    assert.equal(region.status, "ready");
    assert.ok(World.nodes.some(node => node.regionId === region.id));
  }
  assert.equal(World.getNode("marseille").regionId, "provence");
  assert.equal(World.getNode("versailles").regionId, "versailles");
});

test("five fictional characters are tied to existing places and unique assets", () => {
  assert.deepEqual(World.characters.map(character => [character.id, character.placeId]), [
    ["lumie", "eiffel"], ["mare", "mont-saint-michel"], ["plume", "chambord"], ["sol", "marseille"], ["miro", "versailles"]
  ]);
  assert.equal(new Set(World.characters.map(character => character.id)).size, 5);
  for (const character of World.characters) {
    assert.equal(World.getCharacter(character.id), character);
    assert.ok(World.getNode(character.placeId));
    assert.equal(character.fictional, true);
    assert.match(character.description, /空想のオリジナルキャラクター/);
    assert.ok(character.name && character.reading && character.descriptionReading);
    assert.equal(character.asset, "img/adventure/char-" + character.id + ".svg");
  }
});

test("unknown identifiers cannot select another place or curriculum implicitly", () => {
  for (const id of [undefined, null, "", "missing", "__proto__", "constructor"]) {
    assert.equal(World.getNode(id), null);
    assert.equal(World.getCharacter(id), null);
    assert.equal(World.getRecommendation(id), null);
    assert.deepEqual(World.recommendationsFor(id), []);
  }
});

test("catalog and nested recommendations remain immutable across lookups", () => {
  assert.ok(Object.isFrozen(World));
  for (const list of [World.nodes, World.regions, World.characters]) {
    assert.ok(Object.isFrozen(list));
    assert.ok(list.every(Object.isFrozen));
  }
  assert.ok(Object.isFrozen(World.nodes[0].recommendations));
  assert.ok(Object.isFrozen(World.nodes[0].recommendations[0]));
  assert.throws(() => { World.nodes[0].lat = 0; }, TypeError);
  assert.throws(() => { World.nodes[0].recommendations[0].lv = "C2"; }, TypeError);
  assert.throws(() => { World.mapBounds.paris.north = 0; }, TypeError);
});

test("plain browser script exposes the same catalog without a module loader", () => {
  const browser = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "world-data.js"), "utf8"), browser, { filename: "world-data.js" });
  assert.ok(browser.WorldData);
  assert.equal(browser.WorldData.nodes.length, 8);
  assert.equal(browser.WorldData.getCharacter("lumie").placeId, "eiffel");
  assert.equal(browser.WorldData.getRecommendation("trocadero-aller").cat, "アレ");
});

test("the extension preserves the old map coordinates and keeps Versailles outside the Paris close-up", () => {
  const oldPositions = [
    ["trocadero", 48.86297, 2.287, 28, 21.64],
    ["seine", 48.8609, 2.2934, 53.6, 36.43],
    ["eiffel", 48.8584, 2.2945, 58, 54.29],
    ["champ-de-mars", 48.8555, 2.2985, 74, 75],
    ["mont-saint-michel", 48.6361, -1.5115, 50, 50],
    ["chambord", 47.6161, 1.5163, 50, 50]
  ];
  for (const [id, lat, lon, x, y] of oldPositions) {
    const node = World.getNode(id);
    assert.deepEqual([node.lat, node.lon, node.x, node.y], [lat, lon, x, y], id);
  }
  assert.deepEqual(World.mapBounds.paris, { west: 2.280, east: 2.305, north: 48.866, south: 48.852 });
  const paris = World.getNode("eiffel");
  const versailles = World.getNode("versailles");
  assert.equal(versailles.lat, 48.804328);
  assert.equal(versailles.lon, 2.120936);
  assert.ok(versailles.lat < paris.lat && versailles.lon < paris.lon);
  assert.ok(versailles.lon < World.mapBounds.paris.west);
  assert.notEqual(versailles.regionId, "paris");
  const provence = World.regions.find(region => region.id === "provence");
  assert.deepEqual([provence.lat, provence.lon], [43.2965, 5.3698]);
  assert.ok(World.getNode("marseille").lat < World.getNode("chambord").lat);
});
