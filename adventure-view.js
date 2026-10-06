(function () {
  'use strict';

  const ASSETS = 'img/adventure/';
  const REGION_LABEL_POSITIONS = { paris: [70, 14], normandy: [20, 18], versailles: [72, 35], loire: [23, 53], provence: [70, 80] };
  const fallbackNodes = [
    { id: 'trocadero', name: 'トロカデロ広場', reading: 'トロカデロひろば', regionId: 'paris', x: 28, y: 21.64, lat: 48.86297, lon: 2.287, illustration: ASSETS + 'trocadero.svg' }
  ];
  const fallbackEdges = [];
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
    '全国': 'ぜんこく', '周辺': 'しゅうへん', '地図': 'ちず', '図鑑': 'ずかん', '名所': 'めいしょ',
    '発見': 'はっけん', '出会': 'であ', '足跡': 'あしあと', '準備中': 'じゅんびちゅう', '制作中': 'せいさくちゅう',
    '未訪問': 'みほうもん', '予告': 'よこく', '景色': 'けしき', '同行': 'どうこう', '案内': 'あんない',
    '空想': 'くうそう', '物語': 'ものがたり', '登録': 'とうろく', '紹介': 'しょうかい', '歴史': 'れきし',
    '修道院': 'しゅうどういん', '世界遺産': 'せかいいさん', '古城': 'こじょう', '建物': 'たてもの',
    '広': 'ひろ', '橋': 'はし', '付近': 'ふきん', '川': 'かわ', '庭園': 'ていえん', '庭': 'にわ',
    '公園': 'こうえん', '地方': 'ちほう', '地域': 'ちいき', '海': 'うみ', '城': 'しろ', '島': 'しま',
    '北西': 'ほくせい', '南東': 'なんとう', '反対側': 'はんたいがわ', '前': 'まえ', '訪': 'おとず',
    '使': 'つか', '言葉': 'ことば', '名前': 'なまえ', '港町': 'みなとまち', '記録係': 'きろくがかり',
    '各地': 'かくち', '集': 'あつ', '訪ね': 'たずね', '読': 'よ', '性・数': 'せい・すう',
    '星': 'ほし', '飾': 'かざ', '役': 'やく', '青': 'あお', '潮': 'しお', '仲間': 'なかま',
    '水面': 'すいめん', '変化': 'へんか', '羽ペン': 'はねペン', '帽子': 'ぼうし', '手帳': 'てちょう', '書': 'か',
    '以前': 'いぜん', '区分': 'くぶん', '不明': 'ふめい', '地点': 'ちてん', '新': 'あたら',
    '自然': 'しぜん', '乗り物': 'のりもの', '数': 'かず', '街': 'まち', '形容詞': 'けいようし',
    '性': 'せい', '食べ物': 'たべもの', '遊': 'あそ', '天気': 'てんき', '過去': 'かこ', '話': 'はな',
    '岩山': 'いわやま', '頂上': 'ちょうじょう', '村': 'むら', '中央': 'ちゅうおう', '芝生': 'しばふ',
    '時代': 'じだい', '中心': 'ちゅうしん', '階段': 'かいだん', '重': 'かさ', '近': 'ちか', '眺': 'なが',
    'エッフェル塔': 'エッフェルとう', 'セーヌ川': 'セーヌがわ', 'イエナ橋': 'イエナばし',
    '立': 'た', '流': 'なが', '歩': 'ある', '増': 'ふ', '開': 'ひら', '好': 'す', '行き先': 'いきさき',
    '文法': 'ぶんぽう', '単語': 'たんご', '会話': 'かいわ', '初級': 'しょきゅう',
    '中級': 'ちゅうきゅう', '上級': 'じょうきゅう', '復習': 'ふくしゅう',
    '宮殿': 'きゅうでん', '西': 'にし', '市内': 'しない', '旧港': 'きゅうこう', '地中海': 'ちちゅうかい',
    '船': 'ふね', '並': 'なら', '水辺': 'みずべ', '入口': 'いりぐち', '砦': 'とりで', '見守': 'みまも',
    '鏡': 'かがみ', '回廊': 'かいろう', '窓': 'まど', '向': 'む', '帆': 'ほ', '港': 'みなと',
    '旅仲間': 'たびなかま', '風': 'かぜ', '小': 'ちい', '光': 'ひかり', '形': 'かたち', '観察': 'かんさつ',
    '最後': 'さいご', '宝探し': 'たからさがし', '宝箱': 'たからばこ', '王冠': 'おうかん', '達成': 'たっせい',
    '自転車': 'じてんしゃ', '車': 'くるま', '気球': 'ききゅう', '徒歩': 'とほ', '乗': 'の',
    '手に入': 'てにい', '準備': 'じゅんび', '全部': 'ぜんぶ', '必要': 'ひつよう', '中断': 'ちゅうだん',
    '再開': 'さいかい', '始': 'はじ', '開け': 'あけ', '空': 'そら', '集め': 'あつめ', '選択中': 'せんたくちゅう',
    '積み上げ': 'つみあげ', '残': 'のこ', '楽': 'たの', '一緒': 'いっしょ',
    '確認中': 'かくにんちゅう', '自由': 'じゆう', '同じ': 'おなじ', '別': 'べつ', '紹介': 'しょうかい',
    '宝物': 'たからもの', '条件': 'じょうけん', '行き': 'いき'
  };
  const readingPattern = new RegExp(Object.keys(readings).sort((a, b) => b.length - a.length).join('|'), 'g');
  const sceneMemory = new WeakMap();
  const mapMemory = new WeakMap();
  function escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function ruby(text, reading) {
    return window.UIJa && typeof window.UIJa.ruby === 'function' ? window.UIJa.ruby(text, reading) : escape(text);
  }
  function ja(text) {
    return escape(text).replace(readingPattern, word => ruby(word, readings[word]));
  }
  function count(value) { return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0); }
  function catalog() { return window.WorldData || {}; }
  function nodes() { return catalog().nodes || window.Adventure && window.Adventure.nodes || fallbackNodes; }
  function edges() { return window.Adventure && window.Adventure.edges || fallbackEdges; }
  function regions() { return catalog().regions || []; }
  function characters() { return catalog().characters || []; }
  function node(id) { return nodes().find(item => item.id === id) || (catalog().finale && catalog().finale.id === id ? catalog().finale : null) || nodes()[0] || fallbackNodes[0]; }
  function nodeName(id) { return node(id).name; }
  function nodeLabel(item) { return item.reading ? ruby(item.name, item.reading) : ja(item.name); }
  function region(id) { return regions().find(item => item.id === id) || { id: 'paris', name: 'パリ', status: 'ready' }; }
  function stateOf(profile) { return profile && profile.adventure || null; }
  function health(profile) { return window.Adventure && typeof window.Adventure.status === 'function' ? window.Adventure.status(profile) : { ok: !!stateOf(profile), reason: null }; }
  function modeOf(state) { return state && state.effectsMode === 'calm' ? 'calm' : 'rich'; }
  function visited(state, id) { return !!(state && state.visited && state.visited[id]); }
  function art(place) { return place.illustration || ASSETS + place.id + '.svg'; }
  function safePlace(state) { return node(state && state.activeLeg ? state.activeLeg.to : state && state.currentNodeId); }
  function vehicleList(profile) { return window.Adventure && typeof window.Adventure.getVehicles === 'function' ? window.Adventure.getVehicles(profile) : []; }
  function selectedVehicle(profile) { return vehicleList(profile).find(vehicle => vehicle.selected && vehicle.unlocked) || null; }
  function finaleStatus(profile) {
    return window.Adventure && typeof window.Adventure.getFinaleStatus === 'function' ? window.Adventure.getFinaleStatus(profile) : { unlocked: false, active: false, completed: false, progress: 0, requiredCorrect: 10, missingCharacters: [], missingVehicles: [] };
  }
  function companion(reaction, extraClass) {
    const variant = ['idle', 'correct', 'wrong', 'arrival'].includes(reaction) ? reaction : 'idle';
    return '<img class="av-companion ' + (extraClass || '') + '" src="' + ASSETS + 'companion-' + variant + '.svg?v=44-art" alt="" width="128" height="144" draggable="false">';
  }
  function ride(profile, reaction, extraClass) {
    const vehicle = selectedVehicle(profile);
    if (!vehicle) return companion(reaction, extraClass);
    const definition = (catalog().vehicles || []).find(item => item.id === vehicle.id) || vehicle;
    const rider = vehicle.rider || definition.rider || { x: 50, y: 65 };
    return '<span class="av-mounted av-vehicle-' + escape(vehicle.id) + ' ' + (extraClass || '') + '" role="img" aria-label="' + escape(vehicle.name + 'に乗った相棒') + '"><span class="av-rider" style="left:' + count(rider.x) + '%;top:' + count(rider.y) + '%">' + companion(reaction) + '</span><img class="av-vehicle-art" src="' + escape((vehicle.asset || definition.asset) + '?v=44-art') + '" alt="" width="320" height="220" draggable="false"></span>';
  }
  function remainingText(state) {
    if (state && state.activeLeg) return 'あと' + Math.max(0, count(state.activeLeg.requiredUnits) - count(state.activeLeg.progressUnits)) + '問正解で到着';
    return '次に進む方向を選ぼう';
  }
  function progressBar(state) {
    if (!state || !state.activeLeg) return '';
    const leg = state.activeLeg, done = count(leg.progressUnits), total = Math.max(1, count(leg.requiredUnits));
    return '<div class="av-progress-line"><div class="av-progress-track" role="progressbar" aria-label="旅の進み" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + Math.min(done, total) + '"><span style="width:' + Math.min(100, done / total * 100).toFixed(3) + '%"></span></div><span>' + done + ' / ' + total + '</span></div>';
  }
  function journeyRemaining(profile) {
    const finale = finaleStatus(profile);
    return finale.active ? 'あと' + Math.max(0, finale.requiredCorrect - finale.progress) + '問正解で宝箱へ' : remainingText(stateOf(profile));
  }
  function journeyProgress(profile) {
    const finale = finaleStatus(profile);
    return progressBar(finale.active ? { activeLeg: { progressUnits: finale.progress, requiredUnits: finale.requiredCorrect } } : stateOf(profile));
  }
  function pendingText(state) { return state && count(state.pendingUnits) ? '<p class="av-pending">' + ja('次の道へ ' + count(state.pendingUnits) + ' 正解分を持ち越し') + '</p>' : ''; }
  function goalSummary(profile) {
    const definition = catalog().finale;
    if (!definition || !health(profile).ok) return '';
    const status = finaleStatus(profile), totalCharacters = (definition.requiredCharacterIds || []).length, totalVehicles = (definition.requiredVehicleIds || []).length;
    const foundCharacters = Math.max(0, totalCharacters - (status.missingCharacters || []).length), foundVehicles = Math.max(0, totalVehicles - (status.missingVehicles || []).length);
    const title = status.completed ? 'ことばの王冠を発見！' : status.active ? '宝箱まであと' + Math.max(0, status.requiredCorrect - status.progress) + '問正解' : status.unlocked ? '城への準備がそろった！' : '城への準備';
    const action = status.completed ? '宝物を見る' : status.active ? '宝探しの続きを見る' : status.unlocked ? '宝探しの紹介を見る' : '宝探しの条件を見る';
    return '<div class="av-goal-compact"><div><span class="av-eyebrow">' + ja('最後の宝探し') + '</span><strong>' + ja(title) + '</strong><p><span>キャラ ' + foundCharacters + ' / ' + totalCharacters + '</span><span>' + ja('乗り物') + ' ' + foundVehicles + ' / ' + totalVehicles + '</span></p></div><button type="button" class="av-inline-button" data-finale-details data-av-focus="finale-details-link">' + ja(action) + ' →</button></div>';
  }
  function focusFinaleDetails(container) {
    const card = container && container.querySelector('#av-finale-details');
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function renderHomePreview(container, profile, handlers) {
    if (!container) return;
    handlers = handlers || {};
    if (!health(profile).ok) {
      paint(container, '<div class="av-home-safe"><p>' + ja('旅の記録を確認中です。教材は自由に選べます。') + '</p></div>');
      return;
    }
    const state = stateOf(profile), finale = finaleStatus(profile), place = finale.active && catalog().finale ? catalog().finale : safePlace(state);
    const vehicles = vehicleList(profile), next = vehicles.find(vehicle => !vehicle.unlocked), transport = selectedVehicle(profile);
    const placeCaption = finale.active ? '空想の物語 · ' : state && state.activeLeg ? 'この先の景色 · ' : '現在地 · ';
    const nextText = next ? '次は' + next.name + ' · あと' + count(next.remainingUnits) + '問正解' : '乗り物が全部そろった！';
    const nextVehicle = '<div class="av-home-vehicle">' + (next ? '<img src="' + escape(next.asset + '?v=44-art') + '" width="320" height="220" alt="">' : '') + '<div><span class="av-eyebrow">' + ja('旅の乗り物') + '</span><p>' + ja(nextText) + '</p></div><button type="button" class="av-inline-button" data-home-vehicles>' + ja(next ? '乗り物を見る' : '乗りかえる') + ' →</button></div>';
    paint(container, '<div class="av-home-preview av-mode-' + modeOf(state) + '"><div class="av-home-landscape"><img class="av-scene-art" src="' + escape(art(place)) + '" alt="' + escape(place.name + 'のイラスト') + '" width="960" height="300"><span class="av-home-location">' + ja(placeCaption) + nodeLabel(place) + '</span>' + ride(profile, 'idle') + '<span class="av-home-transport">' + (transport ? ruby(transport.name, transport.reading) : ja('徒歩の旅')) + '</span></div>' + nextVehicle + goalSummary(profile) + '</div>');
    connect(container, '[data-home-vehicles]', () => { if (handlers.onJournal) handlers.onJournal('vehicles'); });
    connect(container, '[data-finale-details]', () => { if (handlers.onFinaleDetails) handlers.onFinaleDetails(); });
  }
  function renderNextStep(container, profile, options) {
    if (!container) return;
    options = options || {};
    let heading, message, label, action;
    if (!health(profile).ok) {
      heading = '学習を続けよう'; message = '教材は自由に選べます。'; label = '教材を選んで学習する'; action = 'study';
    } else {
      const state = stateOf(profile), finale = finaleStatus(profile), arrived = Array.isArray(options.arrivals) && options.arrivals.length > 0;
      if (options.finaleCompleted && finale.completed) {
        heading = '宝探し、達成！'; message = '出会った仲間と乗り物を、図鑑で見てみよう。'; label = '旅の図鑑を見る'; action = 'journal';
      } else if (finale.active) {
        heading = '宝箱まで、あと' + Math.max(0, finale.requiredCorrect - finale.progress) + '問正解'; message = '選んだ教材で、宝探しの続きを進めよう。'; label = '教材を選んで宝探しを続ける'; action = 'study';
      } else if (finale.unlocked && !finale.completed) {
        heading = '最後の宝探しに出発できるよ'; message = '仲間と乗り物がそろった。城への旅を見てみよう。'; label = '宝探しの紹介を見る'; action = 'finale-details';
      } else if (arrived || !state || !state.activeLeg) {
        heading = '次の行き先を選ぼう'; message = state && state.pendingUnits ? '持ち越し' + count(state.pendingUnits) + '正解分を、次の道で使えるよ。' : 'フランスの地図から、行きたい場所を選べるよ。'; label = '地図で行き先を選ぶ'; action = 'map';
      } else {
        heading = nodeName(state.activeLeg.to) + 'まで、あと' + Math.max(0, state.activeLeg.requiredUnits - state.activeLeg.progressUnits) + '問正解'; message = '同じ教材でも、別の教材でも旅は進むよ。'; label = '教材を選んで旅を続ける'; action = 'study';
      }
    }
    paint(container, '<section class="av-next-step" aria-label="次の一歩"><p class="av-eyebrow">' + ja('次の一歩') + '</p><h2>' + ja(heading) + '</h2><p class="av-next-message">' + ja(message) + '</p><button type="button" class="av-next-action" data-next-action="' + action + '" data-av-focus="next-step">' + ja(label) + ' <span aria-hidden="true">→</span></button></section>');
    connect(container, '[data-next-action]', data => {
      if (data.nextAction === 'study' && options.onStudy) options.onStudy();
      else if (data.nextAction === 'map' && options.onMap) options.onMap();
      else if (data.nextAction === 'journal' && options.onJournal) options.onJournal('characters');
      else if (data.nextAction === 'finale-details' && options.onFinaleDetails) options.onFinaleDetails();
    });
  }
  function glyph(id) {
    const shapes = {
      eiffel: '<path d="M24 4h2l3 19 5 17H16l5-17Z M17 34h16M21 22h9M22 13h6 M20 40q5-11 10 0"/>',
      'mont-saint-michel': '<path d="m4 40 8-12 7-4 1-9h5V5l3 10h5v10l6 3 7 12ZM17 30h20M11 35h29M23 23h6"/>',
      chambord: '<path d="M8 40V23h8V13h6v11h7V12h7v12h8v16ZM6 23l6-9 6 9M28 12l5-8 5 8M21 40V29h8v11M36 25v15M15 25v15"/>',
      marseille: '<path d="M5 40q5-4 10 0t10 0t10 0t10 0M8 29h34l-5 7H14ZM25 8v21m-3-16L11 26h11m6-14 10 14H28M5 24V13h8v8m29 3V13h-7v8"/>',
      versailles: '<path d="M5 37V21h12V13h16v8h12v16ZM15 13l10-7 10 7M21 37V25h8v12M10 26v6m5-6v6m20-6v6m5-6v6M4 42h42M20 17h10"/>',
      seine: '<path d="M5 33q5-4 10 0t10 0t10 0t10 0M5 41q5-4 10 0t10 0t10 0t10 0M6 24h38M8 24V13m34 11V13M8 13q17 17 34 0"/>',
      'champ-de-mars': '<path d="M25 43V26M16 32H9a7 7 0 0 1 0-14 9 9 0 0 1 16-8 8 8 0 1 1 12 13 8 8 0 0 1-6 9M18 44h14M25 28l-6-5"/>',
      trocadero: '<path d="M5 40h40M8 38V22h12V12h10v10h12v16M5 22h17M28 22h17M12 26v10m5-10v10m16-10v10m5-10v10M20 12l5-7 5 7"/>'
    };
    return '<svg viewBox="0 0 50 50" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + (shapes[id] || shapes.trocadero) + '</g></svg>';
  }
  function project(place) {
    const bounds = catalog().mapBounds && catalog().mapBounds.france || { west: -5.2, east: 10, north: 51.5, south: 40.8 };
    return [(Number(place.lon) - bounds.west) / (bounds.east - bounds.west) * 100, (bounds.north - Number(place.lat)) / (bounds.north - bounds.south) * 100];
  }
  function pointsFor(edge, scope) {
    const from = node(edge.from), to = node(edge.to);
    const a = scope === 'france' ? project(from) : [count(from.x), count(from.y)];
    const b = scope === 'france' ? project(to) : [count(to.x), count(to.y)];
    const lift = scope === 'france' ? -6 : 0;
    return [a, [a[0] + (b[0] - a[0]) * .32, a[1] + (b[1] - a[1]) * .32 + lift], [a[0] + (b[0] - a[0]) * .68, a[1] + (b[1] - a[1]) * .68 + lift], b];
  }
  function routeMatches(edge, scope) { return scope === 'paris' ? node(edge.from).regionId === 'paris' && node(edge.to).regionId === 'paris' : node(edge.from).regionId !== node(edge.to).regionId; }
  function pathData(points) { return 'M' + points[0].join(' ') + ' C' + points[1].join(' ') + ' ' + points[2].join(' ') + ' ' + points[3].join(' '); }
  function routeLines(state, scope) {
    const unique = new Map();
    const priority = edge => state && state.activeLeg && state.activeLeg.edgeId === edge.id ? 3 : state && state.currentNodeId === edge.from ? 2 : 1;
    edges().filter(edge => routeMatches(edge, scope)).forEach(edge => {
      const pair = scope === 'france' ? [node(edge.from).regionId, node(edge.to).regionId] : [edge.from, edge.to];
      const key = pair.sort().join('::'), previous = unique.get(key);
      if (!previous || priority(edge) > priority(previous)) unique.set(key, edge);
    });
    return Array.from(unique.values()).sort((a, b) => priority(a) - priority(b)).map(edge => {
      const active = state && state.activeLeg && state.activeLeg.edgeId === edge.id;
      return '<path class="av-path-shadow" d="' + pathData(pointsFor(edge, scope)) + '"/><path class="av-path' + (active ? ' is-selected' : '') + (visited(state, edge.to) ? ' is-visited' : '') + '" d="' + pathData(pointsFor(edge, scope)) + '"/>';
    }).join('');
  }
  function traveler(profile, scope) {
    const state = stateOf(profile);
    if (!state || !state.activeLeg || finaleStatus(profile).active) return '';
    const leg = state.activeLeg, edge = edges().find(item => item.id === leg.edgeId);
    if (!edge || !routeMatches(edge, scope)) return '';
    const t = Math.min(1, count(leg.progressUnits) / Math.max(1, count(leg.requiredUnits))), points = pointsFor(edge, scope);
    const cubic = axis => Math.pow(1 - t, 3) * points[0][axis] + 3 * Math.pow(1 - t, 2) * t * points[1][axis] + 3 * (1 - t) * t * t * points[2][axis] + t * t * t * points[3][axis];
    return '<div class="av-traveler" style="left:' + cubic(0).toFixed(3) + '%;top:' + cubic(1).toFixed(3) + '%" role="img" aria-label="' + escape('現在地：' + nodeName(leg.from) + 'から' + nodeName(leg.to) + 'への道、' + count(leg.progressUnits) + ' / ' + count(leg.requiredUnits)) + '">' + ride(profile, 'idle', 'av-marker-ride') + '<span class="av-traveler-dot"></span><span class="av-traveler-label">' + ja('現在地') + '</span></div>';
  }
  function learningCard(learning, wordLabel) {
    if (!learning || !window.Adventure || !window.Adventure.summarizeLearning) return '';
    const summary = window.Adventure.summarizeLearning(learning);
    if (!summary || !summary.total) return '';
    const labels = { 'ぶんぽう1': '文法 初級', 'ぶんぽう2': '文法 中級', 'ぶんぽう3': '文法 上級', 'はなし': '会話 KotoとKai', 'はなし2': '会話 Yoとママ', 'はなし3': '会話 おでかけ', unknown: '以前の記録・区分不明' };
    const rows = Object.entries(summary.countsByLevel || {}).filter(([, value]) => value > 0).map(([level, value]) => '<span>' + ja(labels[level] || '単語 ' + level) + ' <b>' + count(value) + '</b></span>').join('');
    const samples = (summary.sampleKeys || []).slice(0, 3).map(key => typeof wordLabel === 'function' ? wordLabel(key) : String(key).split('::')[0]).filter(Boolean).map(label => '<span>' + escape(label) + '</span>').join('');
    return '<div class="av-learning-trail"><h4>' + ja('この場所につながった学習') + '</h4><div class="av-learning-chips">' + rows + '</div>' + (summary.reviewCount ? '<p>' + ja('うち復習 ' + summary.reviewCount + ' 正解') + '</p>' : '') + (samples ? '<div class="av-word-samples">' + samples + '</div>' : '') + '</div>';
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

  function mapNodes(state, scope, selected) {
    if (scope === 'france') {
      return regions().map(item => {
        const target = project(item), label = REGION_LABEL_POSITIONS[item.id] || target;
        const mainName = item.id === 'provence' ? item.markerName || 'マルセイユ' : item.name;
        const mainReading = item.id === 'provence' ? item.markerReading : item.reading;
        const caption = item.status === 'planned' ? '制作中' : item.id === 'provence' ? item.name : item.markerName || '';
        return '<button type="button" class="av-region-marker' + (item.status === 'planned' ? ' is-planned' : '') + (selected === item.id ? ' is-selected' : '') + '" style="left:' + label[0] + '%;top:' + label[1] + '%" data-region="' + escape(item.id) + '" data-av-focus="region-' + escape(item.id) + '" aria-pressed="' + (selected === item.id) + '"><span>' + (mainReading ? ruby(mainName, mainReading) : ja(mainName)) + '</span><small>' + ja(caption) + '</small></button>';
      }).join('');
    }
    const shortNames = { trocadero: 'トロカデロ広場', seine: 'セーヌ川', eiffel: 'エッフェル塔', 'champ-de-mars': 'シャン・ド・マルス' };
    return nodes().filter(place => place.regionId === 'paris').map(place => {
      const here = state && state.currentNodeId === place.id, inTransit = state && state.activeLeg, chosen = inTransit && state.activeLeg.to === place.id;
      const label = here ? (inTransit ? '出発地' : '現在地') : chosen ? '移動中' : visited(state, place.id) ? '訪問済み' : '未訪問';
      return '<button type="button" class="av-place-marker' + (here && !inTransit ? ' is-current' : '') + (chosen ? ' is-traveling' : '') + (selected === place.id ? ' is-selected' : '') + (visited(state, place.id) ? ' is-visited' : '') + '" style="left:' + count(place.x) + '%;top:' + count(place.y) + '%" data-place="' + escape(place.id) + '" data-av-focus="place-' + escape(place.id) + '" aria-pressed="' + (selected === place.id) + '" aria-label="' + escape(place.name + '、' + label) + '"><span class="av-place-pin"></span><span class="av-place-name">' + ja(shortNames[place.id] || place.name) + '</span><small>' + ja(label) + '</small></button>';
    }).join('');
  }
  function regionLeaders() {
    return regions().map(item => {
      const p = project(item), label = REGION_LABEL_POSITIONS[item.id] || p;
      return '<path d="M' + p.join(' ') + ' L' + label.join(' ') + '" stroke="#74937d" stroke-width=".25" fill="none"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r=".85" fill="' + (item.status === 'planned' ? '#afa58b' : '#a75c43') + '" stroke="#fff9e9" stroke-width=".45"/>';
    }).join('');
  }
  function sourceLink(source) {
    return typeof source === 'string' && /^https:\/\//.test(source) ? '<a class="av-source-link" href="' + escape(source) + '" target="_blank" rel="noopener noreferrer">' + ja('場所の紹介を読む') + ' ↗</a>' : '';
  }
  function vehicleCard(vehicle, profile, reward) {
    const unlocked = !!vehicle.unlocked, selected = !!vehicle.selected;
    return '<article class="av-vehicle-card' + (unlocked ? ' is-owned' : ' is-unowned') + (selected ? ' is-selected' : '') + '"><div class="av-vehicle-picture"><img class="' + (unlocked ? '' : 'av-silhouette') + '" src="' + escape(vehicle.asset + '?v=44-art') + '" width="320" height="220" alt="' + escape(vehicle.name) + '"></div><div class="av-vehicle-copy"><p class="av-eyebrow">' + ja(reward ? '新しい乗り物' : unlocked ? '手に入れた乗り物' : 'これからの乗り物') + '</p><h3>' + ruby(vehicle.name, vehicle.reading) + '</h3><p>' + ja(unlocked ? vehicle.description || 'この乗り物で旅をしよう。' : 'あと' + count(vehicle.remainingUnits) + '問正解で手に入る') + '</p>' + (reward ? '' : '<button type="button" class="av-vehicle-select" data-vehicle="' + escape(vehicle.id) + '" data-av-focus="vehicle-' + escape(vehicle.id) + '" aria-pressed="' + selected + '"' + (unlocked && health(profile).ok ? '' : ' disabled') + '>' + ja(selected ? 'この乗り物で旅をしているよ' : unlocked ? 'この乗り物に乗る' : '正解を積み上げよう') + '</button>') + '</div></article>';
  }
  function finaleCard(profile) {
    const definition = catalog().finale;
    if (!definition) return '';
    const status = finaleStatus(profile), progress = Math.min(count(status.progress), count(status.requiredCorrect));
    const progressState = { activeLeg: { progressUnits: progress, requiredUnits: status.requiredCorrect } };
    const missingCharacters = (status.missingCharacters || []).map(person => '<li><button type="button" data-finale-place="' + escape(person.placeId) + '" data-av-focus="finale-place-' + escape(person.placeId) + '">' + nodeLabel(node(person.placeId)) + '<span>' + escape(person.name) + ja('に出会う') + ' →</span></button></li>').join('');
    const missingVehicles = (status.missingVehicles || []).map(vehicle => '<li><span>' + ruby(vehicle.name, vehicle.reading) + '</span><small>' + ja('あと' + count(vehicle.remainingUnits) + '問正解') + '</small></li>').join('');
    let body;
    if (status.completed) {
      body = '<div class="av-treasure-display"><img src="' + escape(definition.treasureAsset || ASSETS + 'treasure-crown.svg') + '" alt="' + escape(definition.treasureName || 'ことばの王冠') + '" width="320" height="220"><div><p class="av-eyebrow">' + ja('宝探しを達成！') + '</p><h4>' + ruby(definition.treasureName || 'ことばの王冠', definition.treasureReading) + '</h4><p>' + ja('集めた言葉が、宝箱を開けたよ。これからも好きな場所へ旅をしよう。') + '</p></div></div>';
    } else if (!status.unlocked) {
      body = '<p class="av-finale-intro">' + ja('旅で出会うキャラと乗り物を集めて、空の城へ。') + '</p><div class="av-finale-requirements">' + (missingCharacters ? '<div><h4>' + ja('次に出会うキャラ') + '</h4><ul>' + missingCharacters + '</ul></div>' : '') + (missingVehicles ? '<div><h4>' + ja('これから手に入れる乗り物') + '</h4><ul>' + missingVehicles + '</ul></div>' : '') + '</div><button type="button" class="av-inline-button" data-journal="vehicles">' + ja('乗り物の図鑑を見る') + ' →</button>';
    } else {
      body = '<p class="av-finale-intro">' + ja(status.active ? '宝箱へ向かって、言葉をひとつずつ。' : progress ? '前の続きから、宝箱へ向かおう。' : '準備がそろった！ここから' + status.requiredCorrect + '問正解で、宝箱を開けよう。') + '</p>' + (status.active || progress ? progressBar(progressState) : '') + '<div class="av-finale-actions"><button type="button" class="av-detail-primary" data-action="' + (status.active ? 'study' : 'finale') + '">' + ja(status.active ? '宝探しの続きを学習する' : progress ? '宝探しを再開する' : '宝探しに出発する') + ' →</button>' + (status.active ? '<button type="button" class="av-inline-button" data-action="pause-finale">' + ja('宝探しをいったん中断する') + '</button>' : '') + '</div>';
    }
    return '<section id="av-finale-details" tabindex="-1" class="av-finale-card' + (status.completed ? ' is-complete' : status.active ? ' is-active' : '') + '" aria-label="最後の宝探し"><div class="av-finale-landscape"><img src="' + escape(definition.illustration) + '" alt="' + escape(definition.name + 'のイラスト') + '" width="960" height="300"><span>' + ja('空想の物語') + '</span></div><div class="av-finale-copy"><p class="av-eyebrow">' + ja('最後の宝探し') + '</p><h3>' + ruby(definition.name, definition.reading) + '</h3>' + body + '</div></section>';
  }
  function detailCard(place, profile) {
    const state = stateOf(profile), status = health(profile), isVisited = visited(state, place.id), here = state && state.currentNodeId === place.id;
    const active = state && state.activeLeg && state.activeLeg.to === place.id;
    const edge = edges().find(item => item.from === (state && state.currentNodeId) && item.to === place.id);
    const person = characters().find(item => item.placeId === place.id);
    const met = person && state && state.characters && state.characters[person.id];
    let action = '';
    if (here && !state.activeLeg || active) action = '<button type="button" class="av-detail-primary" data-action="study">' + ja('この旅で学習する') + ' <span aria-hidden="true">→</span></button>';
    else if (isVisited) action = '<button type="button" class="av-detail-primary" data-action="return" data-node="' + escape(place.id) + '"' + (status.ok ? '' : ' disabled') + '>' + ja('この場所へ戻る') + '</button>';
    else if (edge) action = '<button type="button" class="av-detail-primary" data-action="choose" data-edge="' + escape(edge.id) + '"' + (status.ok ? '' : ' disabled') + '>' + ja('この道へ進む') + '<span>' + count(edge.cost) + ja(' 正解分') + '</span></button>';
    else action = '<p class="av-connected-note">' + ja('地図でつながる場所から、この道へ進めます。') + '</p>';
    const recommendations = (place.recommendations || []).map(item => '<button type="button" class="av-recommendation" data-recommendation="' + escape(item.id) + '">' + (item.labelReading ? ruby(item.label, item.labelReading) : ja(item.label)) + ' <span aria-hidden="true">↗</span></button>').join('');
    return '<article class="av-place-detail"><div class="av-detail-picture"><img src="' + escape(art(place)) + '" width="960" height="300" alt="' + escape(place.name + 'を描いたイラスト') + '"><span class="av-discovery-status">' + ja(isVisited ? '訪問済み' : 'この先の景色 · 予告') + '</span></div><div class="av-detail-copy"><p class="av-eyebrow">' + escape(place.french || '') + '</p><h3>' + nodeLabel(place) + '</h3><p class="av-geography">' + ja(place.description || '') + '</p>' + sourceLink(place.source) + action + (person ? '<div class="av-meeting-teaser"><img class="' + (met ? '' : 'av-silhouette') + '" src="' + escape(person.asset) + '" alt="" width="70" height="82"><div><small>' + ja(met ? '出会ったキャラ' : 'ここで出会うキャラ') + '</small><strong>' + (met ? escape(person.name) : '？？？') + '</strong><p>' + ja('旅先で出会う、空想の旅キャラ。') + '</p></div></div>' : '') + (recommendations ? '<div class="av-recommendations"><h4>' + ja('旅のおともに、おすすめの教材') + '</h4><p>' + ja('どの教材でも、この旅を進められます。') + '</p>' + recommendations + '</div>' : '') + (isVisited ? learningCard(state.visited[place.id].learning) : '') + '</div></article>';
  }
  function renderMap(container, profile, handlers) {
    if (!container) return;
    handlers = handlers || {};
    const state = stateOf(profile), status = health(profile), mode = modeOf(state), current = node(state && state.currentNodeId);
    let ui = mapMemory.get(container);
    if (!ui || ui.profileId !== (profile && profile.id)) {
      const initialPlace = safePlace(state);
      ui = { profileId: profile && profile.id, scope: initialPlace.regionId === 'paris' ? 'paris' : 'france', placeId: initialPlace.id, regionId: initialPlace.regionId };
    }
    if (handlers.focusPlaceId) {
      const focus = node(handlers.focusPlaceId); ui.placeId = focus.id; ui.regionId = focus.regionId; ui.scope = focus.regionId === 'paris' ? 'paris' : 'france';
    }
    mapMemory.set(container, ui);
    const selected = node(ui.placeId), selectedRegion = region(ui.regionId), planned = ui.scope === 'france' && selectedRegion.status === 'planned';
    const regionDescription = ui.scope === 'france' ? '<div class="av-region-summary"><p class="av-eyebrow">FRANCE · ' + escape(selectedRegion.id || '').toUpperCase() + '</p><h3>' + nodeLabel(selectedRegion) + '</h3><p>' + ja(selectedRegion.description || '') + '</p>' + (selectedRegion.id === 'paris' ? '<button type="button" class="av-inline-button" data-scope="paris">' + ja('パリ周辺の地図を見る') + ' →</button>' : '') + '</div>' : '';
    const header = '<header class="av-map-heading"><div><p class="av-eyebrow">LES CHEMINS DES MOTS</p><h2>' + ja('言葉と旅するフランス') + '</h2><p>' + ja('名所を訪ね、旅のキャラに出会おう。') + '</p></div><button type="button" class="av-journal-shortcut" data-journal data-av-focus="journal">' + glyph('chambord') + '<span>' + ja('旅の図鑑') + '</span></button></header>';
    const tabs = '<div class="av-map-switch" role="group" aria-label="地図の範囲"><button type="button" data-scope="france" data-av-focus="scope-france" aria-pressed="' + (ui.scope === 'france') + '">' + ja('フランス全国') + '</button><button type="button" data-scope="paris" data-av-focus="scope-paris" aria-pressed="' + (ui.scope === 'paris') + '">' + ja('パリ周辺') + '</button></div>';
    const canvas = '<div class="av-map-canvas av-geographic-map av-map-' + ui.scope + '"><img class="av-map-art" src="' + ASSETS + (ui.scope === 'france' ? 'france-map.svg?v=39' : 'paris-landmarks-map.svg?v=39') + '" alt="' + (ui.scope === 'france' ? 'フランス本土とコルシカ島。北が上の略図' : 'トロカデロとエッフェル塔の間をセーヌ川が流れる、北が上のパリ周辺の略図') + '" width="800" height="650"><svg class="av-map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + routeLines(state, ui.scope) + (ui.scope === 'france' ? regionLeaders() : '') + '</svg>' + mapNodes(state, ui.scope, ui.scope === 'france' ? ui.regionId : ui.placeId) + traveler(profile, ui.scope) + '<span class="av-map-caption">' + (ui.scope === 'france' ? 'FRANCE · N ↑' : 'PARIS · N ↑') + '</span></div>';
    const outskirts = ui.scope === 'paris' && nodes().some(place => place.id === 'versailles') ? '<button type="button" class="av-map-outskirts" data-outside-place="versailles" data-av-focus="outside-versailles"><span aria-hidden="true">←</span><span><strong>' + ja('西へ：ヴェルサイユ宮殿') + '</strong><small>' + ja('パリ市内の外へ。全国の地図で場所を見る') + '</small></span></button>' : '';
    const finale = finaleStatus(profile), transport = selectedVehicle(profile);
    const travel = '<div class="av-travel-summary"><div><span class="av-small-label">' + ja(finale.active ? '最後の宝探し' : state && state.activeLeg ? '移動中' : '現在地') + '</span><strong>' + ja(finale.active ? catalog().finale.name + 'へ' : state && state.activeLeg ? nodeName(state.activeLeg.from) + ' → ' + nodeName(state.activeLeg.to) : current.name) + '</strong><p>' + ja(journeyRemaining(profile)) + '</p>' + journeyProgress(profile) + (finale.active ? '' : pendingText(state)) + '</div>' + ride(profile, 'idle', 'av-summary-buddy') + '</div>';
    const transportSummary = '<div class="av-transport-summary"><div><span>' + ja('旅の乗り物') + '</span><strong>' + (transport ? ruby(transport.name, transport.reading) : ja('徒歩')) + '</strong></div><button type="button" class="av-inline-button" data-journal="vehicles" data-av-focus="change-vehicle">' + ja('乗りかえる') + ' →</button></div>';
    const startButton = '<button type="button" class="av-study-button av-map-start" data-action="study" data-av-focus="study-top">' + ja('学習して旅を進める') + '<span aria-hidden="true">→</span></button>';
    const modes = ['rich', 'calm'].map(value => '<button type="button" class="av-effect-button" data-mode="' + value + '" data-av-focus="effects-' + value + '" aria-pressed="' + (mode === value) + '">' + (value === 'rich' ? 'たっぷり' : 'ひかえめ') + '</button>').join('');
    paint(container, '<div class="av-map-panel av-mode-' + mode + '">' + header + startButton + goalSummary(profile) + tabs + canvas + outskirts + '<p class="av-map-instruction">' + ja(ui.scope === 'france' ? '地域の名前を選ぶと、旅先の紹介が開きます。' : '地点を選ぶと、名所の紹介と進む道が見られます。') + '</p>' + travel + transportSummary + (!status.ok ? '<p class="av-unavailable" role="status">' + escape(status.reason || '旅の記録を確認してください。') + '</p>' : '') + regionDescription + (planned ? '<div class="av-planned-card"><span>À BIENTÔT</span><h3>' + ja('この旅先は制作中') + '</h3><p>' + ja('次に訪ねる場所を、少しずつ増やしていきます。') + '</p></div>' : detailCard(selected, profile)) + finaleCard(profile) + '<button type="button" class="av-study-button" data-action="study" data-av-focus="study">' + ja('好きな教材で学習する') + '<span aria-hidden="true">→</span></button><fieldset class="av-effects"><legend>' + ja('応援の多さ') + '</legend><div>' + modes + '</div></fieldset></div>');
    const redraw = () => renderMap(container, profile, Object.assign({}, handlers, { focusPlaceId: null, focusFinale: false }));
    connect(container, '[data-scope]', data => { ui.scope = data.scope; if (data.scope === 'paris') { ui.regionId = 'paris'; if (node(ui.placeId).regionId !== 'paris') ui.placeId = 'eiffel'; } redraw(); });
    connect(container, '[data-region]', data => { ui.regionId = data.region; const first = nodes().find(item => item.regionId === data.region); if (first) ui.placeId = first.id; redraw(); });
    connect(container, '[data-place]', data => { ui.placeId = data.place; redraw(); });
    connect(container, '[data-outside-place]', data => {
      const destination = nodes().find(place => place.id === data.outsidePlace);
      if (!destination) return;
      ui.scope = 'france'; ui.regionId = destination.regionId; ui.placeId = destination.id;
      redraw();
      const regionButton = container.querySelector('[data-region="' + destination.regionId + '"]');
      if (regionButton) regionButton.focus({ preventScroll: true });
    });
    connect(container, '[data-action]', data => { if (data.action === 'choose' && handlers.onChoose) handlers.onChoose(data.edge); else if (data.action === 'return' && handlers.onReturn) handlers.onReturn(data.node); else if (data.action === 'study' && handlers.onStudy) handlers.onStudy(); else if (data.action === 'finale' && handlers.onFinale) handlers.onFinale(); else if (data.action === 'pause-finale' && handlers.onPauseFinale) handlers.onPauseFinale(); });
    connect(container, '[data-mode]', data => { if (handlers.onEffects) handlers.onEffects(data.mode); });
    connect(container, '[data-journal]', data => { if (handlers.onJournal) handlers.onJournal(data.journal || 'places'); });
    connect(container, '[data-recommendation]', data => { if (handlers.onRecommend) handlers.onRecommend(data.recommendation); });
    connect(container, '[data-finale-place]', data => { const place = node(data.finalePlace); ui.placeId = place.id; ui.regionId = place.regionId; ui.scope = place.regionId === 'paris' ? 'paris' : 'france'; redraw(); });
    connect(container, '[data-finale-details]', () => { if (handlers.onFinaleDetails) handlers.onFinaleDetails(); else focusFinaleDetails(container); });
    if (handlers.focusFinale) focusFinaleDetails(container);
  }
  function renderScene(container, profile, options) {
    if (!container) return;
    options = options || {};
    const state = stateOf(profile), mode = modeOf(state), reaction = ['correct', 'wrong', 'arrival'].includes(options.reaction) ? options.reaction : 'idle';
    const finale = finaleStatus(profile), definition = catalog().finale;
    const previous = sceneMemory.get(container), desired = definition && (finale.active || options.finaleCompleted) ? definition : safePlace(state);
    const place = reaction === 'idle' || !previous ? desired : node(previous.placeId);
    const changed = !!(previous && previous.placeId !== place.id);
    sceneMemory.set(container, { placeId: place.id });
    const inStory = !!(definition && place.id === definition.id), preview = !!(state && state.activeLeg);
    const label = (inStory ? '空想の物語 · ' : preview ? 'この先の景色 · ' : '現在地 · ') + place.name;
    const message = options.message || (reaction === 'correct' ? 'いいね！' : reaction === 'wrong' ? '答えを見てみよう' : reaction === 'arrival' ? '到着！' : '一歩ずつ、旅をしよう');
    paint(container, '<div class="av-scene-panel av-mode-' + mode + ' av-reaction-' + reaction + (options.animate === false ? ' av-static-render' : '') + '">' + (options.showHeading ? '<div class="av-study-heading"><span class="av-subject">' + ja(options.subject || 'フランス語') + '</span><span class="av-question-count"><b>' + count(options.questionIndex) + '</b> / ' + count(options.questionCount) + '</span></div>' : '') + '<div class="av-scene av-landmark-scene' + (selectedVehicle(profile) ? ' av-mounted-scene' : '') + (changed ? ' av-scenery-change' : '') + '"><img class="av-scene-art" src="' + escape(art(place)) + '" alt="" width="960" height="300"><span class="av-scene-location">' + ja(label) + '</span><div class="av-speech" role="status" aria-live="polite">' + ja(message) + '</div>' + ride(profile, reaction) + '<span class="av-spark av-spark-one" aria-hidden="true">✦</span><span class="av-spark av-spark-two" aria-hidden="true">✧</span></div><div class="av-scene-footer"><span>' + ja(inStory && finale.completed ? '宝箱を開けたよ！' : journeyRemaining(profile)) + '</span>' + (!finale.active && state && count(state.pendingUnits) ? '<span>' + ja('持ち越し ' + count(state.pendingUnits)) + '</span>' : '') + '</div></div>');
  }
  function characterCard(person, state, result, wordLabel) {
    const registration = state && state.characters && state.characters[person.id], met = !!registration, place = node(person.placeId);
    return '<article class="av-character-card' + (met ? ' is-met' : ' is-unmet') + '"><div class="av-character-art"><img class="' + (met ? '' : 'av-silhouette') + '" src="' + escape(person.asset) + '" alt="' + escape(met ? person.name + 'のイラスト' : 'まだ出会っていないキャラのシルエット') + '" width="230" height="270"><span class="av-character-seal">' + (met ? 'RENCONTRE' : 'À RENCONTRER') + '</span></div><div class="av-character-copy"><p class="av-eyebrow">' + ja(result ? '新しい出会い' : met ? '旅で出会ったキャラ' : 'これから出会うキャラ') + '</p><h3>' + (met ? escape(person.name) : '？？？') + '</h3><p>' + (met ? ja(person.description || '') : ja('この場所で、どんな出会いがあるだろう。')) + '</p><p class="av-character-place">' + ja('出会う場所：') + nodeLabel(place) + '</p>' + (met && state.visited && state.visited[place.id] ? learningCard(state.visited[place.id].learning, wordLabel) : '') + '<button type="button" class="av-inline-button" data-open-place="' + escape(place.id) + '">' + ja('地図で場所を見る') + ' →</button></div></article>';
  }
  function renderJournal(container, profile, handlers) {
    if (!container) return;
    handlers = handlers || {};
    const state = stateOf(profile), tabsOrder = ['places', 'characters', 'vehicles'], tab = tabsOrder.includes(handlers.tab) ? handlers.tab : 'places';
    const vehicles = vehicleList(profile);
    const placeCount = nodes().filter(item => visited(state, item.id)).length;
    const charCount = characters().filter(item => state && state.characters && state.characters[item.id]).length;
    const tabDefinitions = [{ id: 'places', name: '名所', count: placeCount, total: nodes().length }, { id: 'characters', name: 'キャラ', count: charCount, total: characters().length }, { id: 'vehicles', name: '乗り物', count: vehicles.filter(item => item.unlocked).length, total: vehicles.length }];
    const tabs = '<div class="av-journal-tabs" role="tablist" aria-label="図鑑の種類">' + tabDefinitions.map(item => '<button type="button" role="tab" id="av-tab-' + item.id + '" aria-controls="av-journal-content" aria-selected="' + (tab === item.id) + '" tabindex="' + (tab === item.id ? 0 : -1) + '" data-tab="' + item.id + '" data-av-focus="tab-' + item.id + '">' + ja(item.name) + '<span>' + item.count + ' / ' + item.total + '</span></button>').join('') + '</div>';
    const walking = '<article class="av-walking-card">' + companion('idle') + '<div><h3>' + ja('徒歩の旅') + '</h3><p>' + ja('歩いて、景色を楽しもう。') + '</p></div><button type="button" class="av-vehicle-select" data-vehicle="walk" data-av-focus="vehicle-walk" aria-pressed="' + !selectedVehicle(profile) + '">' + ja(selectedVehicle(profile) ? '歩いて旅をする' : '選択中') + '</button></article>';
    const cards = tab === 'vehicles' ? walking + vehicles.map(vehicle => vehicleCard(vehicle, profile, false)).join('') : tab === 'characters' ? characters().map(person => characterCard(person, state, false, handlers.wordLabel)).join('') : nodes().map(place => {
      const found = visited(state, place.id), record = found && state.visited[place.id];
      return '<article class="av-postcard' + (found ? ' is-found' : ' is-unfound') + '"><div class="av-postcard-art">' + (found ? '<img src="' + escape(art(place)) + '" width="960" height="300" alt="' + escape(place.name) + '">' : '<div class="av-landmark-silhouette">' + glyph(place.id) + '</div>') + '<span>' + ja(found ? '訪問済み' : '未訪問') + '</span></div><div class="av-postcard-copy"><p class="av-eyebrow">' + escape(place.french || '') + '</p><h3>' + nodeLabel(place) + '</h3><p>' + ja(found ? place.description || '' : region(place.regionId).name + 'で出会う景色。') + '</p>' + (found ? learningCard(record.learning, handlers.wordLabel) + sourceLink(place.source) : '') + '<button type="button" class="av-inline-button" data-open-place="' + escape(place.id) + '">' + ja('地図で場所を見る') + ' →</button></div></article>';
    }).join('');
    paint(container, '<section class="av-journal av-mode-' + modeOf(state) + '"><header><p class="av-eyebrow">CARNET DE VOYAGE</p><h2>' + ja('わたしの旅の図鑑') + '</h2><p>' + ja(tab === 'vehicles' ? '手に入れた乗り物を選んで、次の景色へ。' : tab === 'characters' ? '各地で出会ったキャラが、この図鑑に集まります。' : '訪ねた景色と、ここまでの学習の足跡。') + '</p></header>' + tabs + '<div class="av-journal-cards" id="av-journal-content" role="tabpanel" aria-labelledby="av-tab-' + tab + '">' + cards + '</div></section>');
    const changeTab = next => { if (handlers.onTab) handlers.onTab(next); else renderJournal(container, profile, Object.assign({}, handlers, { tab: next })); };
    connect(container, '[data-tab]', data => changeTab(data.tab));
    container.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? tabsOrder[0] : event.key === 'End' ? tabsOrder[tabsOrder.length - 1] : tabsOrder[(tabsOrder.indexOf(button.dataset.tab) + (event.key === 'ArrowLeft' ? -1 : 1) + tabsOrder.length) % tabsOrder.length]; changeTab(next); const target = container.querySelector('[data-tab="' + next + '"]'); if (target) target.focus(); }));
    connect(container, '[data-open-place]', data => { if (handlers.onMap) handlers.onMap(data.openPlace); });
    connect(container, '[data-vehicle]', data => { if (handlers.onVehicle) handlers.onVehicle(data.vehicle); });
  }
  function renderResult(container, profile, options) {
    if (!container) return;
    options = options || {};
    const state = stateOf(profile), mode = modeOf(state), earned = count(options.earned), arrivals = Array.isArray(options.arrivals) ? Array.from(new Set(options.arrivals)) : [];
    const finale = finaleStatus(profile), definition = catalog().finale, finaleCompleted = !!(options.finaleCompleted && definition);
    const arrived = arrivals.length > 0, place = (finaleCompleted || finale.active) && definition ? definition : arrived ? node(arrivals[arrivals.length - 1]) : safePlace(state);
    const encounters = characters().filter(person => arrivals.includes(person.placeId) && state && state.characters && state.characters[person.id]);
    const newVehicles = vehicleList(profile).filter(vehicle => vehicle.unlocked && Array.isArray(options.vehicleUnlocks) && options.vehicleUnlocks.includes(vehicle.id));
    const heading = finaleCompleted ? '宝箱を開けた！' : arrived ? nodeName(place.id) + 'に到着！' : finale.active ? '空の城へ、一歩ずつ' : '一歩ずつ、続いていく';
    const treasure = finaleCompleted ? '<div class="av-treasure-display av-result-treasure"><img src="' + escape(definition.treasureAsset || ASSETS + 'treasure-crown.svg') + '" alt="' + escape(definition.treasureName || 'ことばの王冠') + '" width="320" height="220"><div><p class="av-eyebrow">' + ja('最後の宝探しを達成') + '</p><h3>' + ruby(definition.treasureName || 'ことばの王冠', definition.treasureReading) + '</h3><p>' + ja('出会った仲間、乗り物、集めた言葉。全部がこの宝箱につながったよ。') + '</p></div></div>' : '';
    const vehicleRewards = newVehicles.length ? '<section class="av-vehicle-rewards"><h3>' + ja('新しい乗り物を手に入れた！') + '</h3><div>' + newVehicles.map(vehicle => vehicleCard(vehicle, profile, true)).join('') + '</div><button type="button" class="av-detail-primary" data-result-vehicles>' + ja('乗り物を選ぶ') + ' →</button></section>' : '';
    const summary = finaleCompleted ? '宝探しの記録は、地図にいつでも残っているよ。' : arrived ? place.description || '' : earned > 0 ? '旅の進みを記録したよ' : '答えを確かめて、また次へ';
    paint(container, '<section class="av-result av-mode-' + mode + (arrived || finaleCompleted ? ' av-reaction-arrival' : '') + '" aria-label="旅の記録"><div class="av-result-landscape"><img class="av-scene-art" src="' + escape(art(place)) + '" alt="' + escape(place.name) + '" width="960" height="300">' + ride(profile, arrived || finaleCompleted ? 'arrival' : 'idle') + '<span class="av-result-tag">' + (finaleCompleted ? 'TRÉSOR DÉCOUVERT' : finale.active ? 'LE DERNIER TRÉSOR' : arrived ? 'NOUVELLE ESCALE' : 'EN CHEMIN') + '</span></div><div class="av-result-copy"><p class="av-eyebrow">' + ja(finaleCompleted ? '空想の物語' : '今回の旅') + '</p><h3>' + ja(heading) + '</h3><p>' + ja(summary) + '</p>' + treasure + '<div class="av-earned"><strong>+' + earned + '</strong><span>' + ja('正解分の進み') + '</span></div>' + (finaleCompleted ? '' : '<p class="av-result-next">' + ja(journeyRemaining(profile)) + '</p>' + journeyProgress(profile)) + (finale.active ? '' : pendingText(state)) + (arrived && !finaleCompleted && state && state.visited[place.id] ? learningCard(state.visited[place.id].learning) : '') + '</div></section>' + (encounters.length ? '<section class="av-result-encounters"><h3>' + ja('旅先で、新しい出会い') + '</h3>' + encounters.map(person => characterCard(person, state, true)).join('') + '</section>' : '') + vehicleRewards);
    connect(container, '[data-open-place]', data => { if (options.onMap) options.onMap(data.openPlace); });
    connect(container, '[data-result-vehicles]', () => { if (options.onJournal) options.onJournal('vehicles'); });
  }
  window.AdventureView = Object.freeze({ renderMap: renderMap, renderScene: renderScene, renderResult: renderResult, renderJournal: renderJournal, renderHomePreview: renderHomePreview, renderNextStep: renderNextStep });
}());
