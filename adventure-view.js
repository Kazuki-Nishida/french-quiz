(function () {
  'use strict';

  const ASSETS = 'img/adventure/';
  const fallbackNodes = [
    { id: 'paris-start', name: 'パリの広場', reading: 'パリのひろば', scene: 'city', x: 49, y: 71 },
    { id: 'riverside', name: '川沿い', reading: 'かわぞい', scene: 'riverside', x: 79, y: 35 },
    { id: 'park', name: '公園', reading: 'こうえん', scene: 'park', x: 22, y: 28 }
  ];
  const fallbackEdges = [
    { id: 'paris-riverside', from: 'paris-start', to: 'riverside', cost: 3 },
    { id: 'paris-park', from: 'paris-start', to: 'park', cost: 3 }
  ];
  const readings = {
    '教材': 'きょうざい', '選': 'えら', '学習': 'がくしゅう', '正解': 'せいかい',
    '到着': 'とうちゃく', '出発': 'しゅっぱつ', '出発地': 'しゅっぱつち', '現在地': 'げんざいち', '広場': 'ひろば',
    '川沿い': 'かわぞい', '公園': 'こうえん', '訪問済み': 'ほうもんずみ', '移動中': 'いどうちゅう',
    '方向': 'ほうこう', '景色': 'けしき', '応援': 'おうえん', '多': 'おお', '少': 'すく',
    '旅': 'たび', '道': 'みち', '問': 'もん', '次': 'つぎ', '持': 'も', '越': 'こ',
    '分': 'ぶん', '進': 'すす', '戻': 'もど', '途中': 'とちゅう', '続': 'つづ', '今': 'いま',
    '今回': 'こんかい', '答': 'こた', '見': 'み', '半分': 'はんぶん', '疲': 'つか',
    '場所': 'ばしょ', '一歩': 'いっぽ', '旅先': 'たびさき', '記録': 'きろく', '確': 'たし',
    '自分': 'じぶん', '解説': 'かいせつ', '調子': 'ちょうし', '来': 'き', '大丈夫': 'だいじょうぶ', '考': 'かんが',
    '文法': 'ぶんぽう', '単語': 'たんご', '会話': 'かいわ', '初級': 'しょきゅう',
    '中級': 'ちゅうきゅう', '上級': 'じょうきゅう', '復習': 'ふくしゅう'
  };
  const readingPattern = new RegExp(Object.keys(readings).sort((a, b) => b.length - a.length).join('|'), 'g');
  const sceneMemory = new WeakMap();
  function escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function ruby(text, reading) {
    return '<ruby>' + escape(text) + '<rp>（</rp><rt>' + escape(reading) + '</rt><rp>）</rp></ruby>';
  }
  function ja(text) {
    return escape(text).replace(readingPattern, word => ruby(word, readings[word]));
  }
  function count(value) { return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0); }
  function nodes() { return window.Adventure && Array.isArray(window.Adventure.nodes) ? window.Adventure.nodes : fallbackNodes; }
  function edges() { return window.Adventure && Array.isArray(window.Adventure.edges) ? window.Adventure.edges : fallbackEdges; }
  function node(id) { return nodes().find(item => item.id === id) || fallbackNodes[0]; }
  function nodeName(id) { return node(id).name || 'パリ'; }
  function nodeLabel(item) { return item.reading ? ruby(item.name, item.reading) : ja(item.name); }
  function stateOf(profile) { return profile && profile.adventure || null; }
  function health(profile) {
    if (window.Adventure && typeof window.Adventure.status === 'function') return window.Adventure.status(profile);
    return { ok: !!stateOf(profile), reason: null };
  }
  function modeOf(state) { return state && state.effectsMode === 'calm' ? 'calm' : 'rich'; }
  function sceneOf(state) {
    if (!state) return 'city';
    const leg = state.activeLeg;
    const place = leg && count(leg.progressUnits) > 0 ? node(leg.to) : node(state.currentNodeId);
    return ['city', 'riverside', 'park'].includes(place.scene) ? place.scene : 'city';
  }
  function companion(reaction, extraClass) {
    const variant = ['idle', 'correct', 'wrong', 'arrival'].includes(reaction) ? reaction : 'idle';
    return '<img class="av-companion ' + (extraClass || '') + '" src="' + ASSETS + 'companion-' + variant + '.svg" alt="" width="128" height="144" draggable="false">';
  }
  function remainingText(state) {
    if (state && state.activeLeg) {
      const leg = state.activeLeg;
      return 'あと' + Math.max(0, count(leg.requiredUnits) - count(leg.progressUnits)) + '問正解で到着';
    }
    return '次に進む方向を選ぼう';
  }
  function icon(kind) {
    const drawings = {
      city: '<path d="M7 24V12h8v12m2 0V7h9v17M4 26h26"/><path d="m5 12 6-5 6 5M15 7l7-4 6 4M10 17h2m9-5h2m-2 5h2"/>',
      riverside: '<path d="M3 22q4-4 8 0t8 0t8 0M3 28q4-4 8 0t8 0t8 0M5 17h24M7 17V9m20 8V9M7 9q10 9 20 0"/>',
      park: '<path d="M16 29V14M10 20H7a5 5 0 0 1-1-10 7 7 0 0 1 13-5 6 6 0 1 1 5 11h-4M10 29h12M16 20l-5-4m5 1 5-5"/>'
    };
    return '<svg viewBox="0 0 34 34" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (drawings[kind] || drawings.city) + '</g></svg>';
  }
  function routeLines(state) {
    return edges().map(edge => {
      const a = node(edge.from), b = node(edge.to);
      const active = state && state.activeLeg && state.activeLeg.edgeId === edge.id;
      const complete = state && state.visited && state.visited[edge.to];
      const curve = edge.to === 'park' ? 'M49 71 C40 66 39 39 22 28' : 'M49 71 C69 72 71 50 79 35';
      const path = a.id === 'paris-start' && ['park', 'riverside'].includes(b.id) ? curve : 'M' + count(a.x) + ' ' + count(a.y) + ' L' + count(b.x) + ' ' + count(b.y);
      return '<path class="av-path-shadow" d="' + path + '"/><path class="av-path' + (active ? ' is-selected' : '') + (complete ? ' is-visited' : '') + '" d="' + path + '"/>';
    }).join('');
  }
  function traveler(state) {
    if (!state || !state.activeLeg) return '';
    const leg = state.activeLeg, start = node(leg.from), end = node(leg.to);
    const t = Math.min(1, Math.max(0, count(leg.progressUnits) / Math.max(1, count(leg.requiredUnits))));
    const points = start.id === 'paris-start' && end.id === 'park'
      ? [[49, 71], [40, 66], [39, 39], [22, 28]]
      : start.id === 'paris-start' && end.id === 'riverside'
        ? [[49, 71], [69, 72], [71, 50], [79, 35]]
        : [[count(start.x), count(start.y)], [count(start.x), count(start.y)], [count(end.x), count(end.y)], [count(end.x), count(end.y)]];
    const cubic = axis => Math.pow(1 - t, 3) * points[0][axis] + 3 * Math.pow(1 - t, 2) * t * points[1][axis] + 3 * (1 - t) * t * t * points[2][axis] + t * t * t * points[3][axis];
    return '<div class="av-traveler" style="left:' + cubic(0).toFixed(3) + '%;top:' + cubic(1).toFixed(3) + '%" role="img" aria-label="' + escape('現在地：' + nodeName(leg.from) + 'から' + nodeName(leg.to) + 'への道、' + count(leg.progressUnits) + ' / ' + count(leg.requiredUnits)) + '"><img src="' + ASSETS + 'companion-idle.svg" width="34" height="39" alt=""><span class="av-traveler-dot"></span><span class="av-traveler-label">' + ja('現在地') + '</span></div>';
  }
  function paint(container, html) {
    if (!container) return;
    const focused = container.contains(document.activeElement) && document.activeElement.getAttribute('data-av-focus');
    container.innerHTML = html;
    if (focused) {
      const replacement = Array.from(container.querySelectorAll('[data-av-focus]')).find(el => el.getAttribute('data-av-focus') === focused);
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }
  function connect(container, selector, callback) {
    container.querySelectorAll(selector).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      if (typeof callback === 'function') callback(button.dataset);
    }));
  }

  function renderMap(container, profile, handlers) {
    if (!container) return;
    handlers = handlers || {};
    const state = stateOf(profile), status = health(profile), mode = modeOf(state);
    const current = state && state.currentNodeId || 'paris-start';
    const leg = state && state.activeLeg;
    const markerHTML = nodes().map(place => {
      const visited = !!(state && state.visited && state.visited[place.id]);
      const here = place.id === current;
      const selected = !!(leg && leg.to === place.id);
      const edge = edges().find(item => item.from === current && item.to === place.id);
      const action = visited && !here ? 'return' : edge ? 'choose' : '';
      const enabled = status.ok && !here && !!action;
      const label = here ? (leg ? '出発地' : '現在地') : selected ? '移動中' : visited ? '訪問済み' : 'こちらへ';
      return '<button type="button" class="av-map-node' + (here ? (leg ? ' is-origin' : ' is-current') : '') + (selected ? ' is-selected' : '') + (visited ? ' is-visited' : '') + '" style="--node-x:' + count(place.x) + '%;--node-y:' + count(place.y) + '%" data-av-focus="node-' + escape(place.id) + '" data-action="' + action + '" data-node="' + escape(place.id) + '" data-edge="' + escape(edge && edge.id || '') + '"' + (enabled ? '' : ' disabled') + (here && !leg ? ' aria-current="location"' : '') + (edge && !here ? ' aria-pressed="' + selected + '"' : '') + ' aria-label="' + escape(place.name + '、' + label) + '"><span class="av-node-icon">' + icon(place.scene) + '</span><span class="av-node-label">' + nodeLabel(place) + '</span><span class="av-node-state">' + ja(label) + '</span></button>';
    }).join('');
    const progress = leg ? '<div class="av-route-progress" aria-label="' + count(leg.progressUnits) + ' / ' + count(leg.requiredUnits) + '">' + Array.from({ length: Math.min(12, count(leg.requiredUnits)) }, (_, i) => '<span class="' + (i < count(leg.progressUnits) ? 'filled' : '') + '"></span>').join('') + '</div>' : '';
    const pending = state && count(state.pendingUnits) > 0 ? '<p class="av-pending">' + ja('次の道へ ' + count(state.pendingUnits) + ' 正解分を持ち越し') + '</p>' : '';
    const modeButtons = ['rich', 'calm'].map(value => '<button type="button" class="av-effect-button" data-mode="' + value + '" data-av-focus="effects-' + value + '" aria-pressed="' + (mode === value) + '">' + (value === 'rich' ? 'たっぷり' : 'ひかえめ') + '</button>').join('');
    paint(container, '<div class="av-map-panel av-mode-' + mode + '">' +
      '<header class="av-map-heading"><div><p class="av-eyebrow">BON VOYAGE · PARIS</p><h2>' + ja('次の景色を選ぼう') + '</h2><p>' + ja('道でつながる場所へ、一歩ずつ。') + '</p></div><div class="av-france-inset"><img src="' + ASSETS + 'france.svg" alt="フランス本土の中のパリの位置" width="100" height="112"></div></header>' +
      '<div class="av-map-canvas"><img class="av-map-art" src="' + ASSETS + 'paris-map.svg" alt="" width="800" height="520"><svg class="av-map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + routeLines(state) + '</svg>' + markerHTML + traveler(state) + '<span class="av-map-caption">PARIS · CARNET DE VOYAGE</span></div>' +
      '<div class="av-map-legend"><span><i class="av-legend-dot current"></i>' + ja('現在地') + '</span><span><i class="av-legend-dot selected"></i>' + ja('移動中') + '</span><span><i class="av-legend-dot visited"></i>' + ja('訪問済み') + '</span></div>' +
      '<div class="av-route-card">' + companion('idle', 'av-map-buddy') + '<div class="av-route-copy"><p class="av-route-caption">' + ja(leg ? '現在地：' + nodeName(leg.from) + 'からの道' : '現在地') + '</p><h3>' + ja(leg ? nodeName(leg.to) + 'へ' : nodeName(current)) + '</h3><p class="av-route-next">' + ja(remainingText(state)) + '</p>' + progress + pending + '</div></div>' +
      (!status.ok ? '<p class="av-unavailable" role="status">' + escape(status.reason || '旅の記録を確認してください。教材は引き続き使えます。') + '</p>' : '') +
      '<button type="button" class="av-study-button" data-av-focus="study">' + ja('教材を選んで学習する') + '<span aria-hidden="true">→</span></button>' +
      '<fieldset class="av-effects"><legend>' + ja('応援の多さ') + '</legend><div>' + modeButtons + '</div></fieldset>' +
      '</div>');
    connect(container, '.av-map-node:not(:disabled)', data => {
      if (data.action === 'return' && handlers.onReturn) handlers.onReturn(data.node);
      if (data.action === 'choose' && handlers.onChoose) handlers.onChoose(data.edge);
    });
    connect(container, '.av-study-button', () => { if (handlers.onStudy) handlers.onStudy(); });
    connect(container, '.av-effect-button', data => { if (handlers.onEffects) handlers.onEffects(data.mode); });
  }

  function renderScene(container, profile, options) {
    if (!container) return;
    options = options || {};
    const state = stateOf(profile), mode = modeOf(state);
    const reaction = ['correct', 'wrong', 'arrival'].includes(options.reaction) ? options.reaction : 'idle';
    const previous = sceneMemory.get(container);
    const scene = reaction === 'idle' || !previous ? sceneOf(state) : previous.scene;
    const changed = !!(previous && previous.scene !== scene);
    sceneMemory.set(container, { scene: scene });
    const place = state && state.activeLeg ? nodeName(state.activeLeg.to) + 'へ' : nodeName(state && state.currentNodeId);
    const message = options.message || (reaction === 'correct' ? 'いいね！' : reaction === 'wrong' ? '答えを見てみよう' : reaction === 'arrival' ? '到着！' : '一歩ずつ、旅をしよう');
    const index = count(options.questionIndex), total = count(options.questionCount);
    paint(container, '<div class="av-scene-panel av-mode-' + mode + ' av-reaction-' + reaction + (options.animate === false ? ' av-static-render' : '') + '">' +
      (options.showHeading ? '<div class="av-study-heading"><span class="av-subject">' + ja(options.subject || 'フランス語') + '</span>' + (total ? '<span class="av-question-count"><b>' + index + '</b><span> / ' + total + '</span></span>' : '') + '</div>' : '') +
      '<div class="av-scene av-scene-' + scene + (changed ? ' av-scenery-change' : '') + '"><img class="av-scene-art" src="' + ASSETS + 'scene-' + scene + '.svg" alt="" width="960" height="240"><span class="av-scene-location">' + ja(place) + '</span><div class="av-speech" role="status" aria-live="polite">' + ja(message) + '</div>' + companion(reaction) + '<span class="av-spark av-spark-one" aria-hidden="true">✦</span><span class="av-spark av-spark-two" aria-hidden="true">✧</span></div>' +
      '<div class="av-scene-footer"><span>' + ja(remainingText(state)) + '</span>' + (state && count(state.pendingUnits) > 0 ? '<span>' + ja('持ち越し ' + count(state.pendingUnits)) + '</span>' : '') + '</div></div>');
  }

  function renderResult(container, profile, options) {
    if (!container) return;
    options = options || {};
    const state = stateOf(profile), mode = modeOf(state), earned = count(options.earned);
    const arrivals = Array.isArray(options.arrivals) ? Array.from(new Set(options.arrivals)) : [];
    const arrived = arrivals.length > 0;
    const scene = arrived ? node(arrivals[arrivals.length - 1]).scene : sceneOf(state);
    const safeScene = ['city', 'riverside', 'park'].includes(scene) ? scene : 'city';
    const subtitle = arrived ? arrivals.map(nodeName).join('・') : earned > 0 ? '旅の進みを記録したよ' : '答えを確かめて、また次へ';
    paint(container, '<section class="av-result av-mode-' + mode + (arrived ? ' av-reaction-arrival' : '') + '" aria-label="旅の記録"><div class="av-result-landscape"><img class="av-scene-art" src="' + ASSETS + 'scene-' + safeScene + '.svg" alt="" width="960" height="240">' + companion(arrived ? 'arrival' : 'idle') + '<span class="av-result-tag">' + (arrived ? 'NOUVELLE ESCALE' : 'CARNET DE VOYAGE') + '</span></div><div class="av-result-copy"><p class="av-eyebrow">' + ja('今回の旅') + '</p><h3>' + ja(arrived ? '旅先に到着！' : '一歩ずつ、続いていく') + '</h3><p>' + ja(subtitle) + '</p><div class="av-earned"><strong>+' + earned + '</strong><span>' + ja('正解分の進み') + '</span></div><p class="av-result-next">' + ja(remainingText(state)) + '</p>' + (state && count(state.pendingUnits) > 0 ? '<p class="av-pending">' + ja('次の道へ ' + count(state.pendingUnits) + ' 正解分を持ち越し') + '</p>' : '') + '</div></section>');
  }

  window.AdventureView = Object.freeze({ renderMap: renderMap, renderScene: renderScene, renderResult: renderResult });
}());
