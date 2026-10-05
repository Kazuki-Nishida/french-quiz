(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Adventure = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const nodes = Object.freeze([
    Object.freeze({ id: "paris-start", name: "パリの広場", reading: "パリのひろば", scene: "city", x: 49, y: 71 }),
    Object.freeze({ id: "riverside", name: "川沿い", reading: "かわぞい", scene: "riverside", x: 79, y: 35 }),
    Object.freeze({ id: "park", name: "公園", reading: "こうえん", scene: "park", x: 22, y: 28 })
  ]);
  const edges = Object.freeze([
    Object.freeze({ id: "paris-riverside", from: "paris-start", to: "riverside", cost: 3 }),
    Object.freeze({ id: "paris-park", from: "paris-start", to: "park", cost: 3 })
  ]);
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isRecord = value => Object.prototype.toString.call(value) === "[object Object]";
  const isCount = value => Number.isSafeInteger(value) && value >= 0;
  const isEventId = value => typeof value === "string" && value.trim().length > 0;
  const valid = () => ({ ok: true, reason: null });
  const invalid = reason => ({ ok: false, reason });

  function timestamp(now) {
    if (typeof now !== "number" || !Number.isFinite(now)) return null;
    const date = new Date(now);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  // Validation never repairs, replaces, or discards an existing saved value.
  // A legacy profile with no adventure field is valid and can be initialized.
  function status(profile) {
    if (!isRecord(profile)) return invalid("プロフィールを読み取れません。");
    if (!owns(profile, "adventure")) return valid();
    const state = profile.adventure;
    if (!isRecord(state)) return invalid("旅の保存情報を読み取れません。");
    if (state.schemaVersion !== 1) return invalid("この旅の保存形式には対応していません。");
    if (state.effectsMode !== "rich" && state.effectsMode !== "calm") return invalid("旅の演出設定を確認できません。");
    if (typeof state.introCompleted !== "boolean") return invalid("導入の記録を確認できません。");
    if (!nodeById.has(state.currentNodeId)) return invalid("現在地に対応する場所がありません。");
    if (!isRecord(state.visited)) return invalid("訪問した場所の記録を読み取れません。");
    for (const id of Object.keys(state.visited)) {
      const visit = state.visited[id];
      if (!nodeById.has(id)) return invalid("訪問記録に対応していない場所があります。");
      if (!isRecord(visit) || typeof visit.firstVisitedAt !== "string" || !Number.isFinite(Date.parse(visit.firstVisitedAt))) {
        return invalid("訪問した日時の記録を確認できません。");
      }
    }
    if (!owns(state.visited, "paris-start") || !owns(state.visited, state.currentNodeId)) {
      return invalid("出発地点または現在地の訪問記録がありません。");
    }
    if (![state.earnedUnits, state.spentUnits, state.pendingUnits].every(isCount)) {
      return invalid("旅の進みの数値を確認できません。");
    }
    if (state.lastProgressEventId !== null && !isEventId(state.lastProgressEventId)) {
      return invalid("旅の正解記録を確認できません。");
    }
    let progress = 0;
    if (state.activeLeg !== null) {
      const leg = state.activeLeg;
      if (!isRecord(leg)) return invalid("移動中の道を読み取れません。");
      const edge = edgeById.get(leg.edgeId);
      if (!edge || edge.from !== leg.from || edge.to !== leg.to || edge.cost !== leg.requiredUnits) {
        return invalid("移動中の道の情報に対応していません。");
      }
      if (leg.from !== state.currentNodeId || owns(state.visited, leg.to)) {
        return invalid("現在地と移動中の道が一致しません。");
      }
      if (!isCount(leg.progressUnits) || leg.progressUnits >= edge.cost || state.pendingUnits !== 0) {
        return invalid("移動中の道の進みを確認できません。");
      }
      progress = leg.progressUnits;
    }
    const accounted = state.spentUnits + state.pendingUnits + progress;
    if (!Number.isSafeInteger(accounted) || state.earnedUnits !== accounted) {
      return invalid("旅の正解数と使った進みが一致しません。");
    }
    return valid();
  }

  function ensure(profile, now = Date.now()) {
    if (!status(profile).ok) return null;
    if (owns(profile, "adventure")) return profile.adventure;
    const at = timestamp(now);
    if (at === null) return null;
    profile.adventure = {
      schemaVersion: 1,
      effectsMode: "rich",
      currentNodeId: "paris-start",
      activeLeg: null,
      earnedUnits: 0,
      spentUnits: 0,
      pendingUnits: 0,
      visited: { "paris-start": { firstVisitedAt: at } },
      lastProgressEventId: null,
      introCompleted: false
    };
    return profile.adventure;
  }

  // Consume only the explicitly selected edge. Excess remains unassigned.
  function allocatePending(state, at) {
    const leg = state.activeLeg;
    if (!leg) return null;
    const amount = Math.min(state.pendingUnits, leg.requiredUnits - leg.progressUnits);
    leg.progressUnits += amount;
    state.pendingUnits -= amount;
    if (leg.progressUnits < leg.requiredUnits) return null;
    state.spentUnits += leg.requiredUnits;
    state.currentNodeId = leg.to;
    if (!owns(state.visited, leg.to)) state.visited[leg.to] = { firstVisitedAt: at };
    state.activeLeg = null;
    return leg.to;
  }

  function releaseActiveLeg(state) {
    if (!state.activeLeg) return;
    state.pendingUnits += state.activeLeg.progressUnits;
    state.activeLeg = null;
  }

  // The quiz owner must reject events from stale rounds and answered questions.
  // This persisted receipt also prevents repeating the latest event after reload.
  function addCorrect(profile, eventId, now = Date.now()) {
    const unchanged = { added: false, arrived: null };
    const at = timestamp(now);
    if (!isEventId(eventId) || at === null) return unchanged;
    const state = ensure(profile, now);
    if (!state || eventId === state.lastProgressEventId || state.earnedUnits === Number.MAX_SAFE_INTEGER) return unchanged;
    state.earnedUnits += 1;
    state.pendingUnits += 1;
    const arrived = allocatePending(state, at);
    state.lastProgressEventId = eventId;
    return { added: true, arrived };
  }

  function selectPath(profile, edgeId, now = Date.now()) {
    const unchanged = { changed: false, arrived: null };
    const edge = edgeById.get(edgeId);
    const at = timestamp(now);
    if (!edge || at === null) return unchanged;
    const state = ensure(profile, now);
    if (!state || state.currentNodeId !== edge.from || owns(state.visited, edge.to)) return unchanged;
    if (state.activeLeg && state.activeLeg.edgeId === edge.id) return unchanged;
    releaseActiveLeg(state);
    state.activeLeg = {
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
      requiredUnits: edge.cost,
      progressUnits: 0
    };
    return { changed: true, arrived: allocatePending(state, at) };
  }

  function returnTo(profile, nodeId) {
    if (!nodeById.has(nodeId)) return { changed: false };
    const state = ensure(profile);
    if (!state || !owns(state.visited, nodeId) || state.currentNodeId === nodeId) return { changed: false };
    releaseActiveLeg(state);
    state.currentNodeId = nodeId;
    return { changed: true };
  }

  return Object.freeze({ nodes, edges, ensure, status, addCorrect, selectPath, returnTo });
});
