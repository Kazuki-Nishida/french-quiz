(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./world-data.js"));
  else root.Adventure = factory(root.WorldData);
})(typeof globalThis !== "undefined" ? globalThis : this, function (WorldData) {
  "use strict";

  const nodes = WorldData.nodes;
  const pairs = [
    ["trocadero", "seine", 3], ["trocadero", "eiffel", 8], ["seine", "eiffel", 8],
    ["eiffel", "champ-de-mars", 8], ["seine", "champ-de-mars", 8]
  ];
  for (const from of ["trocadero", "seine", "eiffel", "champ-de-mars"]) {
    pairs.push([from, "mont-saint-michel", 48], [from, "chambord", 24]);
  }
  pairs.push(["mont-saint-michel", "chambord", 48]);
  // Pure catalog/route additions keep every version-two journey valid. Costs
  // are prototype learning units, not conversions of geographic distance.
  for (const from of ["trocadero", "seine", "eiffel", "champ-de-mars"]) {
    pairs.push([from, "versailles", 16]);
  }
  pairs.push(["versailles", "chambord", 24], ["versailles", "mont-saint-michel", 48]);
  for (const from of ["trocadero", "seine", "eiffel", "champ-de-mars", "mont-saint-michel", "chambord", "versailles"]) {
    pairs.push([from, "marseille", 48]);
  }
  // Append the new Paris destinations without changing any of the old 54
  // directed routes, including journeys saved partway along those routes.
  const connectedPlaces = ["trocadero", "seine", "eiffel", "champ-de-mars", "mont-saint-michel", "chambord", "marseille", "versailles"];
  for (const to of ["arc-de-triomphe", "louvre", "notre-dame"]) {
    for (const from of connectedPlaces) {
      const cost = from === "versailles" ? 16 : from === "chambord" ? 24 : from === "mont-saint-michel" || from === "marseille" ? 48 : 8;
      pairs.push([from, to, cost]);
    }
    connectedPlaces.push(to);
  }
  const edges = Object.freeze(pairs.flatMap(([from, to, cost]) => [
    Object.freeze({ id: from + "--" + to, from, to, cost }),
    Object.freeze({ id: to + "--" + from, from: to, to: from, cost })
  ]));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const vehicleById = new Map(WorldData.vehicles.map(vehicle => [vehicle.id, vehicle]));
  const legacyNodeIds = new Set(["paris-start", "riverside", "park"]);
  const legacyEdges = new Map([
    ["paris-riverside", { from: "paris-start", to: "riverside", cost: 3 }],
    ["paris-park", { from: "paris-start", to: "park", cost: 3 }]
  ]);
  const levels = ["はなし", "はなし2", "はなし3", "A1", "A2", "B1", "B2", "C1", "C2", "ぶんぽう1", "ぶんぽう2", "ぶんぽう3"];
  // Allocation is an aggregate, not an answer timeline: fixed level order,
  // regular before review, then unknown historical attribution. Within each
  // bucket, tracked sample quantities move before untracked quantities.
  const bucketOrder = levels.flatMap(level => [level + "|regular", level + "|review"]).concat("unknown");
  const bucketIds = new Set(bucketOrder);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isRecord = value => Object.prototype.toString.call(value) === "[object Object]";
  const isCount = value => Number.isSafeInteger(value) && value >= 0;
  const isText = value => typeof value === "string" && value.trim().length > 0;
  const isDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const valid = () => ({ ok: true, reason: null });
  const invalid = reason => ({ ok: false, reason });
  const emptyLearning = () => ({ buckets: {}, samples: [] });

  function timestamp(now) {
    if (typeof now !== "number" || !Number.isFinite(now)) return null;
    const date = new Date(now);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function learningTotal(learning) {
    if (!isRecord(learning) || !isRecord(learning.buckets) || !Array.isArray(learning.samples) || learning.samples.length > 6) return null;
    let total = 0;
    for (const bucket of Object.keys(learning.buckets)) {
      if (!bucketIds.has(bucket) || !isCount(learning.buckets[bucket])) return null;
      total += learning.buckets[bucket];
      if (!Number.isSafeInteger(total)) return null;
    }
    const sampled = {};
    const identities = new Set();
    for (const sample of learning.samples) {
      if (!isRecord(sample) || !isText(sample.wordKey) || !bucketIds.has(sample.bucket) || sample.bucket === "unknown" || !isCount(sample.count) || sample.count === 0) return null;
      const identity = JSON.stringify([sample.bucket, sample.wordKey]);
      if (identities.has(identity)) return null;
      identities.add(identity);
      sampled[sample.bucket] = (sampled[sample.bucket] || 0) + sample.count;
      if (!Number.isSafeInteger(sampled[sample.bucket]) || sampled[sample.bucket] > (learning.buckets[sample.bucket] || 0)) return null;
    }
    return total;
  }

  function summarizeLearning(learning) {
    const total = learningTotal(learning);
    const result = { countsByLevel: {}, reviewCount: 0, sampleKeys: [], total: total === null ? 0 : total };
    if (total === null) return result;
    for (const bucket of bucketOrder) {
      const count = learning.buckets[bucket] || 0;
      if (!count) continue;
      const level = bucket === "unknown" ? "unknown" : bucket.split("|")[0];
      result.countsByLevel[level] = (result.countsByLevel[level] || 0) + count;
      if (bucket.endsWith("|review")) result.reviewCount += count;
    }
    result.sampleKeys = [...new Set(learning.samples.map(sample => sample.wordKey))];
    return result;
  }

  // The bounded samples are subsets of bucket counts, never extra units.
  // Dropping a sample at the six-record limit drops only its label, not counts.
  function recordSample(learning, sample, count) {
    const existing = learning.samples.find(item => item.bucket === sample.bucket && item.wordKey === sample.wordKey);
    if (existing) existing.count += count;
    else if (learning.samples.length < 6) learning.samples.push({ wordKey: sample.wordKey, bucket: sample.bucket, count });
  }

  function moveLearning(source, destination, amount) {
    let remaining = amount;
    for (const bucket of bucketOrder) {
      const moved = Math.min(source.buckets[bucket] || 0, remaining);
      if (!moved) continue;
      let sampleRoom = moved;
      for (const sample of source.samples) {
        if (sample.bucket !== bucket || !sampleRoom) continue;
        const count = Math.min(sample.count, sampleRoom);
        recordSample(destination, sample, count);
        sample.count -= count;
        sampleRoom -= count;
      }
      source.samples = source.samples.filter(sample => sample.count > 0);
      source.buckets[bucket] -= moved;
      if (!source.buckets[bucket]) delete source.buckets[bucket];
      destination.buckets[bucket] = (destination.buckets[bucket] || 0) + moved;
      remaining -= moved;
      if (!remaining) break;
    }
  }

  function addLearning(learning, context) {
    const known = isRecord(context) && levels.includes(context.level) && typeof context.review === "boolean";
    const bucket = known ? context.level + (context.review ? "|review" : "|regular") : "unknown";
    learning.buckets[bucket] = (learning.buckets[bucket] || 0) + 1;
    if (known && isText(context.wordKey)) recordSample(learning, { wordKey: context.wordKey, bucket }, 1);
  }

  // Common validation exactly retains the original version-one topology rules.
  // It never repairs malformed values or interprets unknown saved versions.
  function baseStatus(state, nodeIds, routeById, startId) {
    if (state.effectsMode !== "rich" && state.effectsMode !== "calm") return invalid("旅の演出設定を確認できません。");
    if (typeof state.introCompleted !== "boolean") return invalid("導入の記録を確認できません。");
    if (!nodeIds.has(state.currentNodeId)) return invalid("現在地に対応する場所がありません。");
    if (!isRecord(state.visited)) return invalid("訪問した場所の記録を読み取れません。");
    for (const id of Object.keys(state.visited)) {
      if (!nodeIds.has(id)) return invalid("訪問記録に対応していない場所があります。");
      if (!isRecord(state.visited[id]) || !isDate(state.visited[id].firstVisitedAt)) return invalid("訪問した日時の記録を確認できません。");
    }
    if (!owns(state.visited, startId) || !owns(state.visited, state.currentNodeId)) return invalid("出発地点または現在地の訪問記録がありません。");
    if (![state.earnedUnits, state.spentUnits, state.pendingUnits].every(isCount)) return invalid("旅の進みの数値を確認できません。");
    if (state.lastProgressEventId !== null && !isText(state.lastProgressEventId)) return invalid("旅の正解記録を確認できません。");
    let progress = 0;
    if (state.activeLeg !== null) {
      const leg = state.activeLeg;
      if (!isRecord(leg)) return invalid("移動中の道を読み取れません。");
      const edge = routeById.get(leg.edgeId);
      if (!edge || edge.from !== leg.from || edge.to !== leg.to || edge.cost !== leg.requiredUnits) return invalid("移動中の道の情報に対応していません。");
      if (leg.from !== state.currentNodeId || owns(state.visited, leg.to)) return invalid("現在地と移動中の道が一致しません。");
      if (!isCount(leg.progressUnits) || leg.progressUnits >= edge.cost || state.pendingUnits !== 0) return invalid("移動中の道の進みを確認できません。");
      progress = leg.progressUnits;
    }
    const accounted = state.spentUnits + state.pendingUnits + progress;
    if (!Number.isSafeInteger(accounted) || state.earnedUnits !== accounted) return invalid("旅の正解数と使った進みが一致しません。");
    return valid();
  }

  function legacyStatus(state) {
    if (!isRecord(state) || state.schemaVersion !== 1) return invalid("以前の旅の保存情報を読み取れません。");
    return baseStatus(state, legacyNodeIds, legacyEdges, "paris-start");
  }

  function vehicleUnlocked(state, id) {
    const vehicle = vehicleById.get(id);
    return !!(state && vehicle && state.earnedUnits >= vehicle.requiredUnits);
  }

  function finaleUnlocked(state) {
    return !!(state && WorldData.finale.requiredCharacterIds.every(id => owns(state.characters, id)) &&
      WorldData.finale.requiredVehicleIds.every(id => vehicleUnlocked(state, id)));
  }

  function status(profile) {
    if (!isRecord(profile)) return invalid("プロフィールを読み取れません。");
    if (!owns(profile, "adventure")) return valid();
    const state = profile.adventure;
    if (!isRecord(state)) return invalid("旅の保存情報を読み取れません。");
    if (state.schemaVersion === 1) return legacyStatus(state);
    if (state.schemaVersion !== 2) return invalid("この旅の保存形式には対応していません。");
    const common = baseStatus(state, nodeById, edgeById, "trocadero");
    if (!common.ok) return common;
    if (learningTotal(state.pendingLearning) !== state.pendingUnits || (state.activeLeg && learningTotal(state.activeLeg.learning) !== state.activeLeg.progressUnits)) return invalid("移動に含まれる学習の記録が一致しません。");
    let visitedUnits = 0;
    for (const [id, visit] of Object.entries(state.visited)) {
      const total = learningTotal(visit.learning);
      if (total === null || (id === "trocadero" ? total !== 0 : !edges.some(edge => edge.to === id && edge.cost === total))) return invalid("訪問に含まれる学習の記録を確認できません。");
      visitedUnits += total;
    }
    if (!Number.isSafeInteger(visitedUnits) || visitedUnits !== state.spentUnits) return invalid("訪問に使った進みと学習の記録が一致しません。");
    if (!isRecord(state.characters)) return invalid("出会った仲間の記録を読み取れません。");
    for (const [id, met] of Object.entries(state.characters)) {
      const character = WorldData.characters.find(item => item.id === id);
      if (!character || !isRecord(met) || met.placeId !== character.placeId || !isDate(met.metAt) || !owns(state.visited, met.placeId) || met.metAt !== state.visited[met.placeId].firstVisitedAt) return invalid("仲間と出会った場所の記録を確認できません。");
    }
    for (const character of WorldData.characters) {
      if (owns(state.visited, character.placeId) && !owns(state.characters, character.id)) return invalid("訪問した場所の仲間の記録がありません。");
    }
    if (owns(state, "vehicleId") && state.vehicleId !== "walk" && !vehicleUnlocked(state, state.vehicleId)) return invalid("選んだ乗り物の記録を確認できません。");
    if (owns(state, "finale")) {
      const finale = state.finale, required = WorldData.finale.requiredCorrect;
      if (!isRecord(finale) || typeof finale.active !== "boolean" || !isCount(finale.correctCount) || finale.correctCount > required ||
          !isDate(finale.startedAt) || (finale.completedAt !== null && !isDate(finale.completedAt))) return invalid("最後の宝探しの記録を確認できません。");
      if (!finaleUnlocked(state) || (finale.completedAt !== null) !== (finale.correctCount === required) ||
          (finale.active && (finale.completedAt !== null || state.activeLeg !== null))) return invalid("最後の宝探しの進みが一致しません。");
    }
    if (owns(state, "legacyJourney") && !legacyStatus(state.legacyJourney).ok) return invalid("以前の旅の保管記録を確認できません。");
    return valid();
  }

  function initialState(at) {
    return {
      schemaVersion: 2, effectsMode: "rich", currentNodeId: "trocadero", activeLeg: null,
      earnedUnits: 0, spentUnits: 0, pendingUnits: 0, pendingLearning: emptyLearning(),
      visited: { trocadero: { firstVisitedAt: at, learning: emptyLearning() } },
      characters: {}, lastProgressEventId: null, introCompleted: false
    };
  }

  function ensure(profile, now = Date.now()) {
    if (!status(profile).ok) return null;
    if (owns(profile, "adventure") && profile.adventure.schemaVersion === 2) return profile.adventure;
    const at = timestamp(now);
    if (at === null) return null;
    if (!owns(profile, "adventure")) profile.adventure = initialState(at);
    else {
      const legacy = profile.adventure;
      const migrated = { ...legacy, ...initialState(at),
        effectsMode: legacy.effectsMode, introCompleted: legacy.introCompleted,
        lastProgressEventId: legacy.lastProgressEventId,
        earnedUnits: legacy.earnedUnits, pendingUnits: legacy.earnedUnits,
        legacyJourney: legacy
      };
      if (legacy.earnedUnits) migrated.pendingLearning.buckets.unknown = legacy.earnedUnits;
      // These names had no meaning in schema one. Keep any old values in the
      // complete legacy archive, without treating them as new game progress.
      delete migrated.vehicleId;
      delete migrated.finale;
      profile.adventure = migrated;
    }
    return profile.adventure;
  }

  // Consume only the explicitly selected edge. Excess remains unassigned.
  function allocatePending(state, at) {
    const leg = state.activeLeg;
    if (!leg) return null;
    const amount = Math.min(state.pendingUnits, leg.requiredUnits - leg.progressUnits);
    moveLearning(state.pendingLearning, leg.learning, amount);
    leg.progressUnits += amount;
    state.pendingUnits -= amount;
    if (leg.progressUnits < leg.requiredUnits) return null;
    state.spentUnits += leg.requiredUnits;
    state.currentNodeId = leg.to;
    state.visited[leg.to] = { firstVisitedAt: at, learning: leg.learning };
    for (const character of WorldData.characters) {
      if (character.placeId === leg.to && !owns(state.characters, character.id)) state.characters[character.id] = { metAt: at, placeId: leg.to };
    }
    state.activeLeg = null;
    return leg.to;
  }

  function releaseActiveLeg(state) {
    if (!state.activeLeg) return;
    moveLearning(state.activeLeg.learning, state.pendingLearning, state.activeLeg.progressUnits);
    state.pendingUnits += state.activeLeg.progressUnits;
    state.activeLeg = null;
  }

  // The quiz owner must reject stale rounds and answered questions. This one
  // persisted receipt additionally rejects the latest event after a reload;
  // there is deliberately no ever-growing history of individual answer IDs.
  function addCorrect(profile, eventId, now = Date.now(), context) {
    const unchanged = { added: false, arrived: null };
    const at = timestamp(now);
    if (!isText(eventId) || at === null) return unchanged;
    const state = ensure(profile, now);
    if (!state || eventId === state.lastProgressEventId || state.earnedUnits === Number.MAX_SAFE_INTEGER) return unchanged;
    state.earnedUnits += 1;
    state.pendingUnits += 1;
    addLearning(state.pendingLearning, context);
    const arrived = allocatePending(state, at);
    let finaleCompleted = false;
    if (state.finale && state.finale.active) {
      state.finale.correctCount += 1;
      if (state.finale.correctCount === WorldData.finale.requiredCorrect) {
        state.finale.completedAt = at;
        state.finale.active = false;
        finaleCompleted = true;
      }
    }
    state.lastProgressEventId = eventId;
    return finaleCompleted ? { added: true, arrived, finaleCompleted: true } : { added: true, arrived };
  }

  function selectPath(profile, edgeId, now = Date.now()) {
    const unchanged = { changed: false, arrived: null };
    const edge = edgeById.get(edgeId);
    const at = timestamp(now);
    if (!edge || at === null) return unchanged;
    const state = ensure(profile, now);
    if (!state || state.currentNodeId !== edge.from || owns(state.visited, edge.to)) return unchanged;
    if (state.activeLeg && state.activeLeg.edgeId === edge.id) return unchanged;
    if (state.finale) state.finale.active = false;
    releaseActiveLeg(state);
    state.activeLeg = { edgeId: edge.id, from: edge.from, to: edge.to, requiredUnits: edge.cost, progressUnits: 0, learning: emptyLearning() };
    return { changed: true, arrived: allocatePending(state, at) };
  }

  function returnTo(profile, nodeId) {
    if (!nodeById.has(nodeId)) return { changed: false };
    const state = ensure(profile);
    if (!state || !owns(state.visited, nodeId) || state.currentNodeId === nodeId) return { changed: false };
    if (state.finale) state.finale.active = false;
    releaseActiveLeg(state);
    state.currentNodeId = nodeId;
    return { changed: true };
  }

  // Availability is derived, never awarded again or saved as another counter.
  // Reading these views leaves old schema-two records byte-for-byte intact.
  function readableState(profile) {
    return profile && profile.adventure && profile.adventure.schemaVersion === 2 && status(profile).ok ? profile.adventure : null;
  }

  function getVehicles(profile) {
    const state = readableState(profile);
    return WorldData.vehicles.map(vehicle => ({ ...vehicle,
      unlocked: vehicleUnlocked(state, vehicle.id),
      remainingUnits: Math.max(0, vehicle.requiredUnits - (state ? state.earnedUnits : 0)),
      selected: !!(state && state.vehicleId === vehicle.id)
    }));
  }

  function setVehicle(profile, id) {
    const state = readableState(profile);
    if (!state || (id !== "walk" && !vehicleUnlocked(state, id))) return { changed: false };
    if (id === "walk") {
      if (!owns(state, "vehicleId")) return { changed: false };
      delete state.vehicleId;
    } else {
      if (state.vehicleId === id) return { changed: false };
      state.vehicleId = id;
    }
    return { changed: true };
  }

  function getFinaleStatus(profile) {
    const state = readableState(profile), finale = state && state.finale;
    return {
      unlocked: finaleUnlocked(state), active: !!(finale && finale.active),
      completed: !!(finale && finale.completedAt !== null), progress: finale ? finale.correctCount : 0,
      requiredCorrect: WorldData.finale.requiredCorrect,
      missingCharacters: WorldData.finale.requiredCharacterIds.filter(id => !state || !owns(state.characters, id)).map(id => WorldData.characters.find(character => character.id === id)),
      missingVehicles: getVehicles(profile).filter(vehicle => WorldData.finale.requiredVehicleIds.includes(vehicle.id) && !vehicle.unlocked)
    };
  }

  function startFinale(profile, now = Date.now()) {
    const state = readableState(profile), at = timestamp(now);
    if (!state || at === null || !finaleUnlocked(state) || (state.finale && (state.finale.active || state.finale.completedAt !== null))) return { changed: false };
    releaseActiveLeg(state);
    if (!state.finale) state.finale = { active: true, correctCount: 0, startedAt: at, completedAt: null };
    else state.finale.active = true;
    return { changed: true };
  }

  function pauseFinale(profile) {
    const state = readableState(profile);
    if (!state || !state.finale || !state.finale.active) return { changed: false };
    state.finale.active = false;
    return { changed: true };
  }

  return Object.freeze({ nodes, edges, ensure, status, addCorrect, selectPath, returnTo, summarizeLearning,
    getVehicles, setVehicle, getFinaleStatus, startFinale, pauseFinale });
});
