"use strict";
const APP_VER = "v49 · More places to discover in Paris";
/* ================= データほぞん ================= */
const LS_KEY = "frquiz-v1";
const AVATARS = ["🦊","🐰","🐻","🐼","🐸","🦁","🐱","🐶","🦄","🐧","🐹","🐨"];
let storageProblem = null, storageLocked = false, unreadableBackup = null;
let storageBaseline = null;
const effectTimers = new Set();
let effectEpoch = 0;
let DB = loadDB();
function loadDB(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    storageBaseline = raw;
    if(raw === null) return ProfileStore.empty();
    unreadableBackup = raw;
    const data = ProfileStore.prepare(JSON.parse(raw), Adventure);
    unreadableBackup = null;
    return data;
  }catch(e){
    storageProblem = unreadableBackup === null
      ? "保存先の記録を確認できないため、上書きを止めています。この画面で続ける学習は未保存です。画面を閉じる前に、この画面の記録を書き出してください。"
      : "保存された記録を読み込めないため、上書きを止めています。この画面で続ける学習は未保存です。画面を閉じる前に、この画面の記録と保護した原本をそれぞれ書き出してください。";
    storageLocked = true;
    return ProfileStore.empty();
  }
}
function protectStorage(raw){
  unreadableBackup = raw;
  storageLocked = true;
  storageProblem = raw === null
    ? "保存先の記録が別の画面で削除されたため、上書きを止めています。この画面の記録と、ここで続ける学習は未保存です。画面を閉じる前に、この画面の記録を書き出してください。"
    : "保存先の記録が別の画面で変わったため、上書きを止めています。この画面の記録と、ここで続ける学習は未保存です。画面を閉じる前に、この画面の記録と保護した原本をそれぞれ書き出してください。";
  showSaveState();
}
function save(){
  try{
    if(storageLocked) throw new Error('protected source');
    const text = JSON.stringify(DB);
    const raw = localStorage.getItem(LS_KEY);
    // Compare with the last successful read/write before replacing the whole
    // DB. This avoids stale-tab writes; localStorage is not a transaction.
    if(raw !== storageBaseline && raw !== text){ protectStorage(raw); return false; }
    if(raw !== text) localStorage.setItem(LS_KEY, text);
    storageBaseline = text;
    storageProblem = null; showSaveState(); return true;
  }catch(e){
    if(!storageLocked) storageProblem = "まだ保存できていません。画面を閉じずに、保存を試すか記録を書き出してください。";
    showSaveState(); return false;
  }
}
function showSaveState(){
  const box = document.getElementById('save-warning');
  if(!box) return;
  box.hidden = !storageProblem;
  document.getElementById('save-warning-text').textContent = storageProblem || '';
  document.getElementById('retry-save').hidden = storageLocked;
  const original = document.getElementById('recover-original-export');
  if(original) original.hidden = unreadableBackup === null;
}
window.addEventListener('storage', ev => {
  if(storageLocked || (ev.key !== LS_KEY && ev.key !== null)) return;
  try{
    if(ev.storageArea && ev.storageArea !== localStorage) return;
    // Read the current value: an event may be older than our own latest save.
    const raw = localStorage.getItem(LS_KEY);
    if(raw === storageBaseline) return;
    if(raw === JSON.stringify(DB)){
      storageBaseline = raw; storageProblem = null; showSaveState();
    }else protectStorage(raw);
  }catch(e){
    storageProblem = "保存先の記録を確認できません。まだ保存できていない学習がある場合は、画面を閉じる前にこの画面の記録を書き出してください。";
    showSaveState();
  }
});
function scheduleEffect(fn, delay){
  const epoch = effectEpoch;
  const timer = setTimeout(() => { effectTimers.delete(timer); if(epoch === effectEpoch) fn(); }, delay);
  effectTimers.add(timer); return timer;
}
function clearTransientEffects(){
  effectEpoch++;
  effectTimers.forEach(clearTimeout); effectTimers.clear();
  pendingSpeak = null;
  stopCorrectSound();
  try { if('speechSynthesis' in window) speechSynthesis.cancel(); } catch(e) {}
  document.querySelectorAll('.confetti').forEach(el => el.remove());
  clearCorrectCelebration();
  document.getElementById('bigmark').style.display = 'none';
  document.getElementById('badgepop').style.display = 'none';
}
function richEffects(){
  return !!prof() && Adventure.status(prof()).ok && prof().adventure?.effectsMode !== 'calm' &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
let correctCelebrationTimer = null;
function clearCorrectCelebration(){
  if(correctCelebrationTimer !== null){
    clearTimeout(correctCelebrationTimer); effectTimers.delete(correctCelebrationTimer);
    correctCelebrationTimer = null;
  }
  const panel = document.getElementById('correct-celebration');
  if(panel){ panel.hidden = true; panel.innerHTML = ''; }
}
// Pure selection from this round's correct total. Special milestones do not
// consume a normal pose, and incorrect answers never reset the rotation.
function correctCelebrationVariant(correct, treasure=false){
  if(treasure) return 'treasure';
  const total = Number.isFinite(correct) ? Math.max(0, Math.floor(correct)) : 0;
  if(total > 0 && total % 3 === 0) return total / 3 % 2 === 1 ? 'stars' : 'balloons';
  return ['peek','clap','hop'][Math.max(0, total - 1 - Math.floor(total / 3)) % 3];
}
function celebrateCorrect(treasure=false){
  clearCorrectCelebration();
  if(!richEffects()) return;
  const panel = document.getElementById('correct-celebration');
  if(!panel) return;
  const variant = correctCelebrationVariant(quiz ? quiz.correct : 0, treasure);
  const special = variant === 'stars' || variant === 'balloons';
  const pictures = {
    peek:['companion-arrival',128,144], clap:['cheer-clap',128,144],
    hop:['companion-correct',128,144], stars:['cheer-star',180,180],
    balloons:['cheer-balloon',180,260], treasure:['companion-correct',128,144]
  };
  const picture = pictures[variant];
  const buddy = '<img class="correct-buddy" src="img/adventure/'+picture[0]+'.svg?v=46-final" width="'+picture[1]+'" height="'+picture[2]+'" alt="" draggable="false">';
  if(special){
    const tones = ['#eaa33e','#66b6ab','#db8075','#a597cc','#e8c968'];
    const art = variant === 'stars'
      ? Array.from({length:7},(_,i)=>'<i class="correct-comet" style="--slot:'+i+'"></i>').join('')
      : tones.map((tone,i)=>'<i class="correct-balloon" style="--slot:'+i+';--tone:'+tone+'"><b></b><span></span></i>').join('');
    const label = variant === 'stars' ? 'MAGNIFIQUE !' : 'EN AVANT !';
    const message = variant === 'stars' ? 'すごい！' : 'いい'+UIJa.ruby('調子','ちょうし')+'！';
    panel.innerHTML='<div class="correct-cheer correct-special correct-special-'+variant+' correct-cheer-'+variant+'" data-variant="'+variant+'"><div class="correct-special-art" aria-hidden="true">'+art+'</div><div class="correct-cheer-character">'+buddy+'</div><div class="correct-cheer-copy"><strong>'+label+'</strong><small>'+message+'</small></div></div>';
  }else if(variant === 'treasure'){
    const sparks = Array.from({length:16},(_,i)=>'<i style="--angle:'+(i*22.5)+'deg;--reach:'+(i%2 ? 134 : 104)+'px;--tone:'+(i%3 ? '#ffcc5f' : '#73c9ba')+'">'+(i%2 ? '✦' : '●')+'</i>').join('');
    panel.innerHTML='<div class="correct-burst correct-cheer-treasure" data-variant="treasure"><span class="correct-ring"></span><span class="correct-ring second"></span>'+sparks+'<div class="correct-word">'+buddy+'<span class="correct-crown">👑</span><strong>TRÉSOR !</strong><small>'+UIJa.ruby('宝','たから')+'を'+UIJa.ruby('発見','はっけん')+'！</small></div></div>';
    confetti();
  }else{
    const accent = variant === 'peek' ? '<span class="correct-peek-edge">✦</span>'
      : variant === 'clap' ? '<span class="correct-clap-lines"></span>'
      : '<span class="correct-hop-ground"></span><span class="correct-hop-spark first">✦</span><span class="correct-hop-spark second">✦</span>';
    panel.innerHTML='<div class="correct-cheer correct-cheer-'+variant+'" data-variant="'+variant+'"><div class="correct-cheer-character">'+buddy+accent+'</div><div class="correct-cheer-copy"><strong>BRAVO !</strong><small>'+UIJa.ruby('正解','せいかい')+'！</small></div></div>';
    confetti();
  }
  panel.hidden=false;
  correctCelebrationTimer=scheduleEffect(()=>{ panel.hidden=true; panel.innerHTML=''; correctCelebrationTimer=null; },special ? 1350 : 1100);
}
function prof(){ return DB.profiles.find(p => p.id === DB.active) || null; }
function todayKey(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function wkey(w){ return w.fr + "::" + w.ja; }
function findWord(key){ return WORDS.find(w => wkey(w) === key); }

/* ================= ことばのヘルパー ================= */
function frDisplay(w){ // 名詞は冠詞つき、文法問題は完成した文
  if(w.pos === "n"){
    return w.art === "l'" ? "l'" + w.fr : w.art + " " + w.fr;
  }
  if(w.pos === "gram" && w.full) return w.full;
  return w.fr;
}
/* フランス語の声を確実に選ぶ (声リストは非同期で届くのでキャッシュ+待機) */
let FRVOICE = null, voicesReady = false, warnedNoFr = false, pendingSpeak = null;
const VOICE_F = /am[ée]lie|audrey|aur[ée]lie|marie|c[ée]line|chantal|virginie|julie|juliette|hortense|denise|[ée]loise|sylvie|charline|ariane|vivienne|coralie|brigitte|jacqueline|l[ée]a|manon|google fran/;
const VOICE_M = /thomas|jacques|nicolas|henri|alain|claude|antoine|fabrice|guillaume|olivier|bruno|didier|paul|jean|guy/;
function isFrenchVoice(v){ return /^fr(?:-|$)/.test((v.lang || "").toLowerCase().replace(/_/g,"-")); }
function scoreVoice(v){
  const n = (v.name || "").toLowerCase();
  const q = n + " " + ((v.voiceURI || "") + "").toLowerCase(); // URIにcompact等の品質情報が入っていることが多い
  const l = (v.lang || "").toLowerCase().replace(/_/g,"-");
  if(!isFrenchVoice(v)) return -1;
  let s = 0;
  const want = (DB.settings && DB.settings.voiceGender) || "f";
  const isF = VOICE_F.test(n), isM = VOICE_M.test(n);
  // Web Speech has no gender field. Recognized voice names take precedence
  // over locale/quality, so a fr-FR male voice cannot outrank Amélie fr-CA.
  if(want === "f"){ if(isF) s += 1000; else if(!isM) s += 100; }
  else            { if(isM) s += 1000; else if(!isF) s += 100; }
  // Prefer Audrey (Premium > Enhanced > ordinary), then local Amélie.
  // Never force an absent voice: getVoices() supplies all selectable objects.
  if(v.localService && /am[ée]lie/.test(n)) s += 200;
  if(l === "fr-fr") s += 40;
  if(/siri|premium|enhanced|natural|neural/.test(q)) s += 18;
  if(/audrey/.test(n)) s += 300;
  if(/premium/.test(q)) s += 12; // OSのdefault/local加点より品質差を優先
  if(v.localService) s += 6;
  if(/eloquence|albert|bad news|bells|whisper|zarvox|trinoids|jester|organ|cellos|superstar|grandma|grandpa|rocko|shelley|sandy|flo|eddy|reed/.test(n)) s -= 2000;
  if(v.default) s += 2;
  return s;
}
function refreshVoices(){
  try{
    const all = speechSynthesis.getVoices() || [];
    voicesReady = all.length > 0;
    // Auto preference must not hide a French voice that was chosen manually.
    const frs = all.filter(isFrenchVoice).sort((a,b) => scoreVoice(b) - scoreVoice(a));
    // 手でえらんだ声があれば最優先、なければ自動でいちばん良い声
    const manual = DB.settings.voiceName ? frs.find(v => v.name === DB.settings.voiceName) : null;
    FRVOICE = manual || frs[0] || null;
    populateVoiceSelect(frs, manual);
    const vi = document.getElementById("voiceinfo");
    if(vi) vi.textContent = (FRVOICE ? "🗣️ フランスごの こえ: " + FRVOICE.name + (manual ? " (えらんだ こえ)" : " (じどう)")
      : (voicesReady ? "⚠️ フランスごの こえが みつからないよ (READMEを みてね)" : "🗣️ こえを じゅんびちゅう…")) + " ・" + APP_VER;
    if(voicesReady && !FRVOICE && !warnedNoFr){
      warnedNoFr = true;
      toast("⚠️ フランスごの こえが みつからないよ。READMEを みてね");
    }
    if(voicesReady && pendingSpeak){ const t = pendingSpeak; pendingSpeak = null; speakText(t); }
  }catch(e){}
}
let lastVoiceListKey = "";
function populateVoiceSelect(frs, manual){
  const sel = document.getElementById("voicesel");
  if(!sel) return;
  const key = frs.map(v => v.name).join("|") + "::" + (DB.settings.voiceName || "");
  if(key === lastVoiceListKey) return; // 変化がないときは さわらない
  lastVoiceListKey = key;
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = ""; auto.textContent = "🗣️ こえを えらぶ (じどう)";
  sel.appendChild(auto);
  frs.forEach(v => {
    const o = document.createElement("option");
    o.value = v.name;
    const hq = /premium|enhanced|siri|natural|neural/i.test(v.name + " " + (v.voiceURI || ""));
    o.textContent = (hq ? "★ " : "") + v.name + " (" + v.lang + ")";
    sel.appendChild(o);
  });
  sel.value = manual ? manual.name : "";
}
function speakText(text){
  try{
    stopCorrectSound(); // 手動の発音ボタンでも祝い音と声を重ねない
    speechSynthesis.cancel();
    if(!voicesReady){ // 声リストがまだ → 届いてから読む
      pendingSpeak = text;
      refreshVoices();
      scheduleEffect(refreshVoices, 300);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = FRVOICE ? FRVOICE.lang : "fr-FR";
    if(FRVOICE) u.voice = FRVOICE;
    u.rate = 0.85; u.pitch = 1.05;
    speechSynthesis.speak(u);
  }catch(e){}
}
function speak(w){ speakText(typeof w === "string" ? w : frDisplay(w)); }
if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged = refreshVoices;
  refreshVoices();
  setTimeout(refreshVoices, 250); setTimeout(refreshVoices, 1200); // Chrome対策: 遅れて届くことがある
}
let toastTimer = null;
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = "none"; }, 4000);
}

/* ================= こうかおん ================= */
let AC = null;
const activeCorrectTones = new Set();
function stopCorrectSound(){
  activeCorrectTones.forEach(node => {
    try { node.oscillator.stop(); } catch(e) {}
    try { node.gain.disconnect(); node.oscillator.disconnect(); } catch(e) {}
  });
  activeCorrectTones.clear();
}
function tone(freq, t0, dur, type, vol, trackCorrect=false){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + t0 + dur);
  o.connect(g); g.connect(AC.destination);
  if(trackCorrect){
    const node = {oscillator:o, gain:g};
    activeCorrectTones.add(node);
    o.onended = () => { activeCorrectTones.delete(node); o.disconnect(); g.disconnect(); };
  }
  o.start(AC.currentTime + t0); o.stop(AC.currentTime + t0 + dur);
}
function sndOK(variant='normal'){
  if(!DB.settings.sound) return;
  try{
    stopCorrectSound();
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume().catch(() => {});
    // Short, original cues: finish before the answer's pronunciation at 650ms.
    // The milestone sounds gain a melody/chord, rather than a loud volume jump.
    const notes = variant === 'stars' ? [
      [1047,0,.12,'sine',.19], [1319,.08,.14,'sine',.18],
      [1568,.16,.16,'sine',.16], [2093,.25,.23,'sine',.09],
      [784,.25,.29,'sine',.14], [1047,.25,.29,'sine',.16]
    ] : variant === 'balloons' ? [
      [523,0,.12,'triangle',.28], [659,.10,.12,'triangle',.28],
      [784,.20,.12,'triangle',.28], [1047,.32,.24,'triangle',.30],
      [523,.32,.24,'sine',.12], [659,.32,.24,'sine',.13]
    ] : [
      [784,0,.18,'sine',.25], [1175,.13,.35,'sine',.25]
    ];
    notes.forEach(note => tone(...note, true));
  }catch(e){ stopCorrectSound(); }
}
function sndNG(){ // ブブー
  if(!DB.settings.sound) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    tone(140, 0, .22, "square", .12); tone(110, .24, .32, "square", .12);
  }catch(e){}
}
function sndTada(){
  if(!DB.settings.sound) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1047].forEach((f,i)=>tone(f, i*.12, .3, "sine", .2));
  }catch(e){}
}

/* ================= がめん いどう ================= */
const SCREENS = ["scr-profile","scr-home","scr-map","scr-journal","scr-setup","scr-quiz","scr-result","scr-stock","scr-stats","scr-tutorial","scr-grammar"];
let current = "scr-profile";
function go(id){
  clearTransientEffects();
  if(id !== 'scr-quiz' && id !== 'scr-result') quiz = null;
  if(id === 'scr-setup') renderSetup();
  SCREENS.forEach(s => document.getElementById(s).classList.toggle("on", s === id));
  current = id;
  const back = document.getElementById("btnback");
  const who = document.getElementById("whochip");
  back.style.visibility = (id === "scr-profile" || id === "scr-home") ? "hidden" : "visible";
  who.style.visibility = (id === "scr-profile") ? "hidden" : "visible";
  const p = prof();
  if(p){ document.getElementById("whoav").textContent = p.avatar; document.getElementById("whoname").textContent = p.name; }
  UIJa.apply(document.getElementById(id));
  UIJa.apply(document.getElementById('topbar'));
  window.scrollTo(0,0);
}
document.getElementById("btnback").addEventListener("click", () => {
  if(current === "scr-quiz" && !confirm("クイズを やめて ホームに もどる?")) return;
  renderHome(); go("scr-home");
});
document.getElementById("whochip").addEventListener("click", () => {
  if(current === "scr-quiz") return;
  renderProfiles(); go("scr-profile");
});

/* ================= プロフィール ================= */
function newProfile(name, avatar){
  const p = { id: Date.now(), name, avatar, daily:{}, words:{}, stock:[], studyGuide:{schemaVersion:1,lastGrammarUnitId:null} };
  Adventure.ensure(p); return p;
}
function activeLevels(){ return LEVELS.filter(lv => WORDS.some(w => w.lv === lv)); }
function lvName(lv){ return /^[ABC][12]$/.test(lv) ? "たんご" + lv : lv; } // A1→たんごA1 (ひょうじ用)
/* おぼえた = 1かい せいかい。ぜんぶ おぼえたら 2しゅうめ(101%〜200%)にすすむ */
function lvlStats(p, lv){
  const words = WORDS.filter(w => w.lv === lv);
  const total = words.length;
  if(!total) return { pct:0, lap:1, cur:0, total:0, fill:0 };
  const cs = words.map(w => (p.words[wkey(w)] || {c:0}).c || 0);
  const K = Math.min(Math.min(...cs), 8); // なんしゅう かんそうしたか (ぜんたんごの さいていせいかいかいすう)
  const cur = cs.filter(c => c >= K + 1).length; // いまの しゅうで おぼえた かず
  let part = Math.floor(100 * cur / total);
  if(cur > 0 && part === 0) part = 1; // 1つでも おぼえたら 1%は みせる
  const pct = 100 * K + part;
  return { pct, lap: K + 1, cur, total, fill: pct % 100 };
}
function lvlProgress(p, lv){ return lvlStats(p, lv).pct; }
function currentLevelText(p){
  for(const lv of activeLevels()){
    const s = lvlStats(p, lv);
    if(s.pct < 100) return { lv, pct: s.pct, text: "いま " + lvName(lv) + " (" + LEVEL_LABEL[lv] + ") の " + s.pct + "% まで きたよ!" };
  }
  return { lv:"C2", pct:100, text: "ぜんぶの レベルを おぼえた! 2しゅうめに ちょうせんちゅう! 🎓" };
}
let dragId = null;
function renderProfiles(){
  const g = document.getElementById("pgrid");
  g.innerHTML = "";
  DB.profiles.forEach((p, idx) => {
    const cur = currentLevelText(p);
    const el = document.createElement("div");
    el.className = "pslot";
    el.innerHTML = '<div class="pav">' + p.avatar + '</div><div class="pname">' + esc(p.name) + '</div>' +
      '<div class="plvl">レベル: ' + lvName(cur.lv) + " " + cur.pct + "%<br>こたえたかず: " + totalAnswered(p) + '</div>' +
      '<button class="pedit" title="なまえと アイコンを かえる">✏️</button>' +
      '<button class="pdel" title="けす">❌</button>' +
      (idx > 0 ? '<button class="pmove ml" title="まえへ">◀</button>' : '') +
      (idx < DB.profiles.length - 1 ? '<button class="pmove mr" title="うしろへ">▶</button>' : '');
    // ならびかえ: ◀▶ボタン
    const swap = (i, j) => {
      [DB.profiles[i], DB.profiles[j]] = [DB.profiles[j], DB.profiles[i]];
      save(); renderProfiles();
    };
    const ml = el.querySelector(".ml"), mr = el.querySelector(".mr");
    if(ml) ml.addEventListener("click", ev => { ev.stopPropagation(); swap(idx, idx - 1); });
    if(mr) mr.addEventListener("click", ev => { ev.stopPropagation(); swap(idx, idx + 1); });
    // ならびかえ: ドラッグ&ドロップ
    el.draggable = true;
    el.addEventListener("dragstart", ev => {
      dragId = p.id;
      if(ev.dataTransfer){ ev.dataTransfer.effectAllowed = "move"; }
    });
    el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("dragover"); });
    el.addEventListener("dragleave", () => el.classList.remove("dragover"));
    el.addEventListener("drop", ev => {
      ev.preventDefault();
      el.classList.remove("dragover");
      if(dragId == null || dragId === p.id) return;
      const from = DB.profiles.findIndex(x => x.id === dragId);
      const to = DB.profiles.findIndex(x => x.id === p.id);
      const [moved] = DB.profiles.splice(from, 1);
      DB.profiles.splice(to, 0, moved);
      dragId = null; save(); renderProfiles();
    });
    el.querySelector(".pdel").addEventListener("click", ev => {
      ev.stopPropagation();
      if(confirm(p.name + " の きろくを ぜんぶ けしても いい?")){
        DB.profiles = DB.profiles.filter(x => x.id !== p.id);
        if(DB.active === p.id) DB.active = null;
        save(); renderProfiles();
      }
    });
    el.querySelector(".pedit").addEventListener("click", ev => {
      ev.stopPropagation();
      editingId = p.id;
      selAv = p.avatar;
      document.getElementById("pformtitle").textContent = "なまえと アイコンを かえる";
      document.getElementById("btnpcreate").textContent = "ほぞんする!";
      document.getElementById("newpform").style.display = "block";
      buildAvpick();
      document.getElementById("nameinput").value = p.name;
      document.getElementById("nameinput").focus();
      UIJa.apply(document.getElementById("newpform"));
    });
    el.addEventListener("click", () => {
      DB.active = p.id; save();
      resetSetupForProfile(p);
      if(!p.tut) showTutorial();
      else { renderHome(); go("scr-home"); }
    });
    g.appendChild(el);
  });
  if(DB.profiles.length < 4){
    const add = document.createElement("div");
    add.className = "pslot empty";
    add.innerHTML = '<div class="pav">➕</div><div class="pname">あたらしく つくる</div>';
    add.addEventListener("click", () => {
      editingId = null;
      document.getElementById("pformtitle").textContent = "あたらしい おともだち";
      document.getElementById("btnpcreate").textContent = "とうろく!";
      document.getElementById("newpform").style.display = "block";
      buildAvpick();
      document.getElementById("nameinput").value = "";
      UIJa.apply(document.getElementById('newpform'));
    });
    g.appendChild(add);
  }
}
let selAv = AVATARS[0];
let editingId = null; // へんしゅうちゅうの プロフィールID (null = しんき)
function buildAvpick(){
  const w = document.getElementById("avpick");
  w.innerHTML = "";
  AVATARS.forEach(a => {
    const b = document.createElement("button");
    b.textContent = a;
    if(a === selAv) b.classList.add("sel");
    b.addEventListener("click", () => { selAv = a; buildAvpick(); });
    w.appendChild(b);
  });
}
document.getElementById("btnpcancel").addEventListener("click", () => {
  document.getElementById("newpform").style.display = "none";
});
document.getElementById("btnpcreate").addEventListener("click", () => {
  const name = document.getElementById("nameinput").value.trim() || "なまえなし";
  if(editingId){ // へんしゅう: なまえとアイコンだけ かえる (きろくは そのまま)
    const p = DB.profiles.find(x => x.id === editingId);
    if(p){ p.name = name; p.avatar = selAv; }
    editingId = null;
    save();
    document.getElementById("newpform").style.display = "none";
    renderProfiles();
    return;
  }
  const p = newProfile(name, selAv);
  DB.profiles.push(p); DB.active = p.id; save();
  resetSetupForProfile(p);
  document.getElementById("newpform").style.display = "none";
  showTutorial(); // はじめての おともだちには おはなしを みせる
});
function totalAnswered(p){
  return Object.values(p.daily).reduce((a,d) => a + d.q, 0);
}
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
// かいせつ用の表 (w.tbl: {t,h,r,f,hi}) を HTML に (おとな向けなので漢字OK)
function tblHTML(tb){
  let s = "";
  if(tb.t) s += '<div class="ntbl-t">📊 ' + esc(tb.t) + '</div>';
  s += '<table class="ntbl"><thead><tr>' + tb.h.map(c => "<th>" + esc(c) + "</th>").join("") + '</tr></thead><tbody>';
  tb.r.forEach((row, i) => {
    s += '<tr' + (i === tb.hi ? ' class="hirow"' : '') + '>' + row.map(c => "<td>" + esc(c) + "</td>").join("") + '</tr>';
  });
  s += '</tbody></table>';
  if(tb.f) s += '<div class="ntbl-f">💡 ' + esc(tb.f) + '</div>';
  return s;
}

/* ================= ホーム ================= */
function renderHome(){
  const p = prof(); if(!p) return;
  const a = Adventure.ensure(p);
  AdventureView.renderHomePreview(document.getElementById('home-journey-visual'), p, {
    onFinaleDetails:showFinaleDetails,
    onJournal:tab=>showJournal(tab),
    onMap:id=>showMap(id)
  });
  document.getElementById('home-journey-status').innerHTML = a ? journeyText(p) : '旅の記録はそのまま保管中です。教材は引き続き使えます。';
  const places=a ? WorldData.nodes.filter(n=>a.visited[n.id]).length : 0;
  const characters=a ? WorldData.characters.filter(c=>a.characters?.[c.id]).length : 0;
  document.getElementById('journal-count').innerHTML=UIJa.ruby('名所','めいしょ')+' '+places+'/'+WorldData.nodes.length+' · キャラ '+characters+'/'+WorldData.characters.length+' · '+UIJa.ruby('乗り物','のりもの')+' '+Adventure.getVehicles(p).filter(v=>v.unlocked).length+'/'+WorldData.vehicles.length;
  document.getElementById('journey-migration').hidden=!(a?.legacyJourney && !a.migrationAcknowledged);
  if(a?.legacyJourney && !a.migrationAcknowledged){
    const r=UIJa.ruby;
    document.getElementById('journey-migration-text').innerHTML='フランスの'+r('名所','めいしょ')+'を'+r('巡','めぐ')+'る'+r('旅','たび')+'が'+r('始','はじ')+'まりました。'+r('練習','れんしゅう')+'マップの <b>'+a.legacyJourney.earnedUnits+r('正解分','せいかいぶん')+'</b>を、'+r('新','あたら')+'しい'+r('道','みち')+'へ'+r('引','ひ')+'き'+r('継','つ')+'いでいます。'+r('以前','いぜん')+'の'+r('学習','がくしゅう')+'と'+r('旅','たび')+'の'+r('記録','きろく')+'も'+r('保管','ほかん')+'しています。';
  }
  const wrap = document.getElementById("homelvls");
  wrap.innerHTML = "";
  activeLevels().forEach(lv => {
    const s = lvlStats(p, lv);
    const row = document.createElement("div");
    row.className = "hlrow";
    row.innerHTML = '<span class="hll">' + UIJa.level(lv) + '</span>' +
      '<div class="lvlbar"><div style="width:' + s.fill + '%"></div></div>' +
      '<span class="hlp">' + s.pct + '%</span>' +
      (s.pct >= 100 ? '<span class="hbadge">' + BADGE[lv] + (s.pct >= 200 ? "✨" : "") + '</span>' : '') +
      (s.lap >= 2 ? '<span class="lapchip">' + s.lap + 'しゅうめ</span>' : '');
    wrap.appendChild(row);
  });
  document.getElementById("homelvlsub").textContent = "10%ごとに バッジを ゲット! 1かい せいかいで「おぼえた」になるよ";
  document.getElementById("homebadges").textContent = "🏅 " + badgeCount(p) + "こ";
  document.getElementById("stockbadge").textContent = p.stock.length;
  refreshTogs();
  refreshVoices();
  UIJa.apply(document.getElementById("scr-home"));
}
function refreshTogs(){
  document.getElementById("togsound").className = "tog" + (DB.settings.sound ? " on" : "");
  document.getElementById("togsound").textContent = DB.settings.sound ? "🔊 おと ON" : "🔇 おと OFF";
  document.getElementById("togkana").className = "tog" + (DB.settings.kana ? " on" : "");
  document.getElementById("togkana").textContent = DB.settings.kana ? "🔤 よみがな ON" : "🔤 よみがな OFF";
  document.querySelectorAll(".segbtn").forEach(b => b.classList.toggle("sel", b.dataset.mode === DB.settings.quizMode));
  UIJa.apply(document.querySelector('.settings'));
}
document.querySelectorAll(".segbtn").forEach(b => {
  b.addEventListener("click", () => {
    DB.settings.quizMode = b.dataset.mode;
    save(); refreshTogs();
  });
});
document.getElementById("voicesel").addEventListener("change", ev => {
  DB.settings.voiceName = ev.target.value || null;
  lastVoiceListKey = "";
  save(); refreshVoices();
  speak("bonjour, merci"); // えらんだ こえで ためす
});
document.getElementById("togsound").addEventListener("click", () => { DB.settings.sound = !DB.settings.sound; save(); refreshTogs(); if(DB.settings.sound) sndOK(); });
document.getElementById("togkana").addEventListener("click", () => { DB.settings.kana = !DB.settings.kana; save(); refreshTogs(); });
document.getElementById("btnquiz").addEventListener("click", () => go("scr-setup"));
document.getElementById("btntut").addEventListener("click", () => showTutorial());
document.getElementById("btngrammar").addEventListener("click", () => go("scr-grammar"));

/* ================= チュートリアル (おはなし) ================= */
const BADGE = { "はなし":"💬", "はなし2":"🍼", "はなし3":"🧳", A1:"🥐", A2:"🗼", B1:"🏰", B2:"⛰️", C1:"🎨", C2:"👑", "ぶんぽう1":"✏️", "ぶんぽう2":"🖋️", "ぶんぽう3":"📜" };

/* ================= 10%ごとの バッジ ================= */
function milestoneSnapshot(){
  const p = prof(); if(!p) return {};
  const snap = {};
  activeLevels().forEach(lv => snap[lv] = Math.floor(lvlStats(p, lv).pct / 10));
  return snap;
}
function badgeCount(p){
  let n = 0;
  activeLevels().forEach(lv => n += Math.floor(lvlStats(p, lv).pct / 10));
  return n;
}
let badgeQueue = [];
let tutPage = 0;
function showTutorial(){
  const p = prof();
  if(p && !p.tut){ p.tut = 1; save(); }
  tutPage = 0; renderTut();
  go("scr-tutorial");
}
function renderTut(){
  document.getElementById("tutpage0").classList.toggle("on", tutPage === 0);
  document.getElementById("tutpage1").classList.toggle("on", tutPage === 1);
  document.getElementById("tutdot0").className = "tdot" + (tutPage === 0 ? " on" : "");
  document.getElementById("tutdot1").className = "tdot" + (tutPage === 1 ? " on" : "");
  document.getElementById("btntutnext").textContent = tutPage === 0 ? "つぎへ ▶" : "🚀 ぼうけんスタート!";
  window.scrollTo(0,0);
}
document.getElementById("btntutnext").addEventListener("click", () => {
  if(tutPage === 0){ tutPage = 1; renderTut(); }
  else { renderHome(); go("scr-home"); }
});
document.getElementById("btntutclose").addEventListener("click", () => { renderHome(); go("scr-home"); });
document.getElementById("btnstock").addEventListener("click", () => { renderStock(); go("scr-stock"); });
document.getElementById("btnstats").addEventListener("click", () => { renderStats(); go("scr-stats"); });

/* ================= クイズせってい ================= */
let setup = { dir:"jf", lv:"A1", unitId:null, recommendationId:null };
document.querySelectorAll("#dirchoices .choice").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#dirchoices .choice").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel"); setup.dir = b.dataset.dir;
  });
});
document.querySelectorAll("#lvchoices .choice").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#lvchoices .choice").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel"); setup.lv = b.dataset.lv;
    setup.unitId = null;
    setup.recommendationId = null;
    renderSetup();
  });
});
document.getElementById("btnstart").addEventListener("click", () => startQuiz(false));
/* ================= クイズ エンジン ================= */
let quiz = null;
function shuffle(a){
  a = a.slice();
  for(let i = a.length-1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function pickQuestions(pool, n){
  const p = prof();
  if(DB.settings.quizMode === "random"){
    return shuffle(pool).slice(0, n); // 🎲 かんぜんランダム
  }
  // 🎯 いまの しゅうで まだ「おぼえてない」ことば だけ
  const lapOf = {};
  activeLevels().forEach(lv => lapOf[lv] = lvlStats(p, lv).lap);
  const isFresh = w => (((p.words[wkey(w)] || {c:0}).c) || 0) < lapOf[w.lv];
  const fresh = pool.filter(isFresh);
  const rest = pool.filter(w => !isFresh(w));
  if(fresh.length === 0) toast("ぜんぶ おぼえてるよ! ランダムで だすね 🎲");
  let words = shuffle(fresh).slice(0, n);
  if(words.length < n) words = words.concat(shuffle(rest).slice(0, n - words.length));
  return words;
}
/* かいわ文の なまえ (Kai/Koto/Yo) が こたえの ヒントに ならないようにする */
const CONV_JA = { Kai:"カイ", Koto:"コト", Yo:"ようくん" };
const CONV_KANA = { Kai:"カイ", Koto:"コト", Yo:"ヨ" };
function convName(w){
  if(/\bKai\b/.test(w.fr)) return "Kai";
  if(/\bKoto\b/.test(w.fr)) return "Koto";
  if(/\bYo\b/.test(w.fr)) return "Yo";
  return null;
}
function convAlign(w, name){ // せんたくしの なまえを もんだいと そろえた コピーを つくる
  if(!name || w.pos !== "conv") return w;
  const cur = convName(w);
  if(!cur || cur === name) return w;
  if(/Kai est|Koto est|Yo est|Yo a dit/.test(w.fr)) return w; // いれかえ できない文は そのまま
  return Object.assign({}, w, {
    fr: w.fr.split(cur).join(name),
    ja: w.ja.split(CONV_JA[cur]).join(CONV_JA[name]),
    kana: w.kana.split(CONV_KANA[cur]).join(CONV_KANA[name])
  });
}
function distractorsFor(word, pool){
  const used = new Set([word.fr + "|" + word.ja]);
  const usedJa = new Set([word.ja]);
  const usedE = new Set([firstEmoji(word.e)]);
  const out = [];
  const tryAdd = w => {
    if(out.length >= 3) return;
    const idk = w.fr + "|" + w.ja;
    if(used.has(idk) || usedJa.has(w.ja) || usedE.has(firstEmoji(w.e))) return;
    used.add(idk); usedJa.add(w.ja); usedE.add(firstEmoji(w.e));
    out.push(w);
  };
  // 0) かいわ文: なまえの ありなしが おなじ 文を ゆうせん (ヒントに ならないように)
  if(word.pos === "conv"){
    const hasName = convName(word) !== null;
    shuffle(pool.filter(w => w.pos === "conv" && (convName(w) !== null) === hasName)).forEach(tryAdd);
  }
  // 1) おなじレベル・おなじ品詞・おなじカテゴリ
  shuffle(pool.filter(w => w.pos === word.pos && w.cat === word.cat)).forEach(tryAdd);
  // 2) おなじ品詞
  if(out.length < 3) shuffle(pool.filter(w => w.pos === word.pos)).forEach(tryAdd);
  // 3) ぜんたいから おなじ品詞
  if(out.length < 3) shuffle(WORDS.filter(w => w.pos === word.pos)).forEach(tryAdd);
  // 4) さいご: なんでも
  if(out.length < 3) shuffle(WORDS).forEach(tryAdd);
  return out;
}
function firstEmoji(e){ return Array.from(e)[0] || e; }

function startQuiz(review){
  const p = prof(); if(!p) return;
  clearTransientEffects();
  const adventure = Adventure.ensure(p);
  const intro = !review && !!adventure && !adventure.introCompleted && !Adventure.getFinaleStatus(p).active;
  const unit = !review && StudyGuide.getUnit(setup.unitId);
  const recommendation = !review && WorldData.getRecommendation(setup.recommendationId);
  let pool;
  if(review){
    pool = p.stock.map(findWord).filter(Boolean);
    if(pool.length === 0){ alert("ふくしゅうボックスは からっぽだよ! すごい!"); return; }
  }else{
    pool = setup.lv === "all" ? WORDS.slice()
      : setup.lv === "abc" ? WORDS.filter(w => ["A1","A2","B1"].includes(w.lv))
      : WORDS.filter(w => w.lv === setup.lv);
    if(unit && unit.lv === setup.lv) pool = pool.filter(w => w.cat === unit.cat);
    if(recommendation && recommendation.lv === setup.lv) pool = pool.filter(w => w.cat === recommendation.cat);
  }
  if(!pool.length){ toast('この教材には問題がありません。別の教材を選んでください。'); return; }
  const questionLimit = intro ? 3 : 10;
  const n = Math.min(questionLimit, pool.length);
  const words = review ? shuffle(pool).slice(0, n) : pickQuestions(pool, n);
  const dirOf = () => {
    const d = review ? "mix" : setup.dir;
    return d === "mix" ? (Math.random() < .5 ? "jf" : "fj") : d;
  };
  quiz = {
    review, intro, questionLimit, profileId:p.id,
    roundId:typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random(),
    settings:{...setup}, earned:0, arrivals:[], vehicleUnlocks:[], finaleCompleted:false, resultEffectsPlayed:false, finished:false,
    qs: words.map(w => {
      if(w.pos === "gram"){ // ぶんぽう: あなうめ4たく (せんたくしは もんだいに ついてくる)
        const opts = shuffle([w, ...w.d.map(t => ({ fr: t, pos: "gram", e: w.e, ja: "" }))]);
        return { w, dir: "gram", opts, ansIdx: opts.indexOf(w) };
      }
      const dir = dirOf();
      let ds = distractorsFor(w, pool);
      if(w.pos === "conv") ds = ds.map(d => convAlign(d, convName(w))); // なまえを そろえる
      const opts = shuffle([w, ...ds]);
      return { w, dir, opts, ansIdx: opts.indexOf(w) };
    }),
    i: 0, correct: 0, results: [], answered: false,
    preM: milestoneSnapshot() // バッジ判定用: クイズ前の 10%だんかい
  };
  go("scr-quiz");
  renderQ();
}

function renderQ(){
  if(!quiz || quiz.profileId !== DB.active || quiz.finished) return;
  clearTransientEffects();
  const q = quiz.qs[quiz.i];
  quiz.answered = false;
  renderQuizContext();
  renderJourneyScene('idle', quiz.intro ? 'まずは3問。ゆっくり考えよう。' : '自分のペースで進もう。');
  window.scrollTo(0,0); // つぎの もんだいは いつも いちばん うえから
  // すすみぐあい
  const prog = document.getElementById("qprog");
  prog.innerHTML = "";
  quiz.qs.forEach((_, i) => {
    const s = document.createElement("span");
    if(i < quiz.results.length) s.textContent = quiz.results[i].ok ? "⭐" : "❌";
    else if(i === quiz.i){ s.textContent = "🐣"; s.classList.add("cur"); }
    prog.appendChild(s);
  });
  // もんだい
  const qa = document.getElementById("qarea");
  if(q.dir === "gram"){
    qa.innerHTML = '<div class="qfr small">' + esc(q.w.q) + '</div>' +
      '<div class="qja" style="font-size:19px;color:var(--sub)">' + esc(q.w.ja) + '</div>' +
      '<div class="qhint">___ に はいるのは どれかな?</div>';
  } else if(q.dir === "jf"){
    qa.innerHTML = '<div class="qemoji">' + q.w.e + '</div><div class="qja">' + esc(q.w.ja) + '</div>' +
      '<div class="qhint">フランスごは どれかな?</div>';
  }else{
    const gchip = q.w.pos === "n" ? '<div class="qgender">' + gdot(q.w) + '</div>' : "";
    qa.innerHTML = gchip + '<div class="qfr' + (q.w.pos === "conv" ? " small" : "") + '">' + esc(frDisplay(q.w)) + '</div>' +
      (DB.settings.kana ? '<div class="qkana">' + esc(q.w.kana) + '</div>' : '') +
      '<button class="speakbtn" id="qspeak">🔊 きく</button>' +
      '<div class="qhint">どういう いみかな?</div>';
    document.getElementById("qspeak").addEventListener("click", () => speak(q.w));
    speak(q.w);
  }
  // せんたくし
  const opts = document.getElementById("opts");
  opts.innerHTML = "";
  q.opts.forEach((w, idx) => {
    const wrap = document.createElement('div'); wrap.className = 'option-wrap';
    const b = document.createElement("button");
    b.className = "opt";
    if(q.dir === "gram"){
      b.innerHTML = '<span class="ofr">' + esc(w.fr) + '</span>';
    } else if(q.dir === "jf"){
      b.innerHTML = (w.pos === "n" ? gdot(w) : "") +
        '<span class="ofr' + (w.pos === "conv" ? " small" : "") + '">' + esc(frDisplay(w)) + '</span>' +
        (DB.settings.kana ? '<span class="okana">' + esc(w.kana) + '</span>' : '');
    }else{
      b.innerHTML = '<span class="oemoji">' + w.e + '</span><span class="oja">' + esc(w.ja) + '</span>';
    }
    b.addEventListener("click", () => answer(idx));
    wrap.appendChild(b);
    if(q.dir === 'jf'){
      const speaker = document.createElement('button'); speaker.type = 'button'; speaker.className = 'ospeak';
      speaker.textContent = '🔊'; speaker.setAttribute('aria-label',frDisplay(w)+'の発音を聞く');
      speaker.addEventListener('click',ev=>{ev.stopPropagation();speak(w);});
      wrap.appendChild(speaker);
    }
    opts.appendChild(wrap);
  });
  // 名詞がある「えらぶ」もんだいなら le/la の せつめいを だす
  const hasNoun = q.opts.some(w => w.pos === "n");
  document.getElementById("gnote").style.display = (q.dir === "jf" && hasNoun) ? "block" : "none";
  document.getElementById("expl").style.display = "none"; // かいせつは こたえてから
  document.getElementById("nextwrap").style.display = "none";
  const bn = document.getElementById("btnnext");
  bn.textContent = (quiz.i === quiz.qs.length-1) ? "けっか 🎉" : "つぎへ ▶";
  UIJa.apply(document.getElementById('nextwrap'));
}
function gdot(w){
  return '<span class="gdot ' + w.g + '">' + (w.g === "m" ? "🔵 le" : "🔴 la") + '</span>';
}

let answeredAt = 0;
function answer(idx){
  if(current !== 'scr-quiz' || !quiz || quiz.finished || quiz.profileId !== DB.active || quiz.answered) return;
  if(!Number.isInteger(idx) || idx < 0 || idx >= quiz.qs[quiz.i].opts.length) return;
  quiz.answered = true;
  answeredAt = Date.now();
  // はじめの2かいだけ タップで すすめることを おしえる
  if((DB.settings.tapHint || 0) < 2){
    DB.settings.tapHint = (DB.settings.tapHint || 0) + 1;
    toast("💡 がめんの あいている ところを タップしても つぎへ いけるよ");
  }
  const q = quiz.qs[quiz.i];
  const ok = idx === q.ansIdx;
  const p = prof();
  // きろく
  const key = wkey(q.w);
  const s = p.words[key] || (p.words[key] = {c:0,w:0});
  ok ? s.c++ : s.w++;
  const d = p.daily[todayKey()] || (p.daily[todayKey()] = {q:0,c:0});
  d.q++; if(ok) d.c++;
  let stocked = false, unstocked = false;
  if(!ok && !p.stock.includes(key)){ p.stock.push(key); stocked = true; }
  if(ok){ // せいかいしたら ボックスから じどうで だす
    const ix = p.stock.indexOf(key);
    if(ix >= 0){ p.stock.splice(ix, 1); unstocked = true; }
  }
  quiz.results.push({ w:q.w, ok, stocked, unstocked });
  if(ok) quiz.correct++;
  const vehiclesBefore = new Set(Adventure.getVehicles(p).filter(v=>v.unlocked).map(v=>v.id));
  const move = ok ? Adventure.addCorrect(p, quiz.roundId+':'+quiz.i, Date.now(), {level:q.w.lv,wordKey:key,review:quiz.review}) : {added:false,arrived:null};
  if(move.added) quiz.earned++;
  if(move.arrived) quiz.arrivals.push(move.arrived);
  if(move.finaleCompleted) quiz.finaleCompleted = true;
  if(ok) Adventure.getVehicles(p).filter(v=>v.unlocked&&!vehiclesBefore.has(v.id)).forEach(v=>quiz.vehicleUnlocks.push(v.id));
  if(quiz.intro && quiz.results.length === quiz.qs.length){
    const a = Adventure.ensure(p); if(a) a.introCompleted = true;
  }
  save();
  // ひょうじ
  const optEls = document.querySelectorAll("#opts .opt");
  q.opts.forEach((w, i) => {
    const el = optEls[i];
    el.disabled = true;
    if(i === q.ansIdx){ el.classList.add("good"); el.insertAdjacentHTML("beforeend", '<span class="mark" style="color:#FF5A5A">⭕</span>'); }
    else if(i === idx){ el.classList.add("bad"); el.insertAdjacentHTML("beforeend", '<span class="mark" style="color:#4D7CFE">❌</span>'); }
    else el.classList.add("dim");
    // ほかのことばの いみも みせる (ぶんぽうもんだいは のぞく)
    if(q.dir === "gram"){
      // なにも たさない
    }else if(q.dir === "jf"){
      el.insertAdjacentHTML("beforeend", '<span class="reveal">' + w.e + " " + esc(w.ja) + '</span>');
    }else{
      el.insertAdjacentHTML("beforeend", '<span class="reveal">' + (w.pos === "n" ? gdot(w) + " " : "") + esc(frDisplay(w)) +
        (DB.settings.kana ? '<br>' + esc(w.kana) : '') + '</span>');
      const sp = document.createElement("button");
      sp.className = "ospeak"; sp.textContent = "🔊"; sp.title = "きく";
      sp.addEventListener("click", ev => { ev.stopPropagation(); speak(w); });
      sp.setAttribute('aria-label',frDisplay(w)+'の発音を聞く');
      el.parentNode.appendChild(sp);
    }
  });
  if(q.dir === "fj") document.getElementById("gnote").style.display =
    q.opts.some(w => w.pos === "n") ? "block" : "none";
  // どのレベルの ことばか みせる
  document.getElementById("qarea").insertAdjacentHTML("beforeend",
    '<div class="qlv"><span class="lvchip ' + q.w.lv + '">' + lvName(q.w.lv) + " (" + LEVEL_LABEL[q.w.lv] + ") の ことば</span></div>");
  // ぶんぽう: こたえの ぶんを ぜんぶ みせる
  if(q.dir === "gram"){
    document.getElementById("qarea").insertAdjacentHTML("beforeend",
      '<div class="gramfull">✅ ' + esc(q.w.full) +
      (DB.settings.kana ? '<div class="qkana">' + esc(q.w.kana) + '</div>' : '') + '</div>');
  }
  // おとな向けかいせつ (かいわ文など note があるとき)
  if(q.w.note){
    document.getElementById("expltext").textContent = q.w.note;
    document.getElementById("expltbl").innerHTML = q.w.tbl ? tblHTML(q.w.tbl) : "";
    document.getElementById("expl").style.display = "block";
  }
  const n = quiz.qs.length, answered = quiz.results.length;
  let message = ok ? ['すごい！','いいね！','その調子！'][quiz.i % 3] : '答えと解説を見てみよう。';
  if(move.finaleCompleted) message = '宝を発見！ ことばの王冠を手に入れた！';
  else if(ok && move.arrived) message = '到着！ 続きも自分のペースで。';
  else if(ok && n === 10 && answered === 5) message = 'すごい！ 半分まで来たよ。';
  else if(ok && n > 1 && answered === n-1) message = 'あと1問！ ゆっくりで大丈夫。';
  renderJourneyScene(move.arrived || move.finaleCompleted ? 'arrival' : ok ? 'correct' : 'wrong', message);
  if(ok) celebrateCorrect(!!move.finaleCompleted);
  renderQuizContext();
  ok ? sndOK(richEffects() ? correctCelebrationVariant(quiz.correct, !!move.finaleCompleted) : 'normal') : sndNG();
  scheduleEffect(() => speak(q.w), 650);
  document.getElementById("nextwrap").style.display = "block";
  const prog = document.getElementById("qprog").children[quiz.i];
  prog.textContent = ok ? "⭐" : "❌"; prog.classList.remove("cur");
}
function nextQ(){
  if(current !== 'scr-quiz' || !quiz || quiz.profileId !== DB.active || quiz.finished || !quiz.answered) return;
  if(quiz.i < quiz.qs.length - 1){ quiz.i++; renderQ(); }
  else showResult();
}
document.getElementById("btnnext").addEventListener("click", ev => { ev.stopPropagation(); nextQ(); });
// こたえたあとは がめんの どこを タップしても つぎへ (かいせつ・🔊は のぞく)
document.getElementById("scr-quiz").addEventListener("click", ev => {
  if(!quiz || !quiz.answered) return;
  if(Date.now() - answeredAt < 600) return; // こたえた ちょくごの ごタップは むし
  if(ev.target.closest('button,select,input,label,a,[role="button"],[data-no-next]')) return;
  if(ev.target.closest("#nextwrap") || ev.target.closest(".expl") || ev.target.closest(".ospeak") ||
     ev.target.closest(".speakbtn") || ev.target.closest(".gnote")) return;
  nextQ();
});
// キーボード: Enter か スペースでも つぎへ
document.addEventListener("keydown", ev => {
  if(!document.getElementById("scr-quiz").classList.contains("on")) return;
  if(!quiz || !quiz.answered) return;
  if(ev.repeat || ev.target.closest('button,select,input,textarea,a,[role="button"]')) return;
  if(ev.key === "Enter" || ev.key === " "){
    ev.preventDefault();
    if(Date.now() - answeredAt >= 300) nextQ();
  }
});

/* ================= けっか ================= */
function showResult(){
  if(!quiz || quiz.profileId !== DB.active || quiz.results.length !== quiz.qs.length) return;
  const firstShow = !quiz.resultEffectsPlayed;
  quiz.finished = true;
  go('scr-result');
  const n = quiz.qs.length, c = quiz.correct;
  const pct = Math.round(100 * c / n);
  document.getElementById("rscore").innerHTML = c + ' <small>/ ' + n + ' もん せいかい (' + pct + '%)</small>';
  let stars, msg;
  if(pct === 100){ stars = "🌟🌟🌟"; msg = "パーフェクト!! てんさい!!"; }
  else if(pct >= 80){ stars = "🌟🌟🌟"; msg = "すごーい!! そのちょうし!"; }
  else if(pct >= 60){ stars = "🌟🌟"; msg = "いいかんじ! もうすこしで マスター!"; }
  else if(pct >= 40){ stars = "🌟"; msg = "がんばったね! つぎは もっと できるよ!"; }
  else { stars = "🐣"; msg = "はじめは みんな こうだよ! もういちど やってみよう!"; }
  document.getElementById("rstars").textContent = stars;
  document.getElementById("rmsg").textContent = msg;
  const nStocked = quiz.results.filter(r => r.stocked).length;
  const nUnstocked = quiz.results.filter(r => r.unstocked).length;
  const info = document.getElementById("rstockinfo");
  const lines = [];
  if(nUnstocked > 0) lines.push("🎉 せいかいした " + nUnstocked + " この ことばが ボックスから でたよ!");
  if(nStocked > 0) lines.push("📦 まちがえた " + nStocked + " この ことばを ふくしゅうボックスに いれたよ");
  if(lines.length){ info.style.display = "block"; info.innerHTML = lines.join("<br>"); }
  else info.style.display = "none";
  const list = document.getElementById("rlist");
  list.innerHTML = "";
  quiz.results.forEach(r => {
    const row = document.createElement("div");
    row.className = "rrow";
    row.innerHTML = '<span class="re">' + r.w.e + '</span>' +
      '<div class="rt"><div class="fr">' + esc(frDisplay(r.w)) +
      ' <span class="lvchip ' + r.w.lv + '" style="font-size:10.5px;padding:2px 8px">' + r.w.lv + '</span>' +
      (DB.settings.kana ? ' <span style="color:var(--sub);font-size:12.5px">' + esc(r.w.kana) + '</span>' : '') +
      '</div><div class="ja">' + esc(r.w.ja) + '</div></div>' +
      '<button class="rspeak">🔊</button>' +
      '<span class="rmark ' + (r.ok ? "ok\">⭕" : "ng\">❌") + '</span>';
    row.querySelector(".rspeak").addEventListener("click", () => speak(r.w));
    list.appendChild(row);
  });
  // つぎのバッジまでのヒント (レベルをしぼった通常クイズのとき)
  const hint = document.getElementById("rnext");
  const lvReal = (!quiz.review && setup.lv !== "all" && setup.lv !== "abc") ? setup.lv : null;
  if(lvReal){
    const s = lvlStats(prof(), lvReal);
    const nextPct = (Math.floor(s.pct / 10) + 1) * 10;
    const need = Math.max(1, Math.ceil(s.total * (nextPct - s.pct) / 100));
    hint.style.display = "block";
    hint.textContent = "🏅 つぎの バッジ (" + lvName(lvReal) + " " + nextPct + "%) まで あと " + need + "もん!";
  } else hint.style.display = "none";
  // バッジ到達チェック → 演出キュー (ミックスで2レベル同時でも順番に出る)
  const post = milestoneSnapshot();
  badgeQueue = [];
  activeLevels().forEach(lv => {
    if(quiz.preM && post[lv] > (quiz.preM[lv] || 0)) badgeQueue.push({ lv, m: post[lv] });
  });
  // けっかがめんにも ゲットしたバッジを のこしておく (えんしゅつを みのがしても わかる)
  const rb = document.getElementById("rbadges");
  if(badgeQueue.length){
    rb.style.display = "block";
    rb.innerHTML = "🏅 <b>バッジ ゲット!</b> " +
      badgeQueue.map(b => BADGE[b.lv] + (b.m > 10 ? "✨" : "") + " " + b.lv + " " + (b.m * 10) + "%").join(" ／ ");
  } else rb.style.display = "none";
  AdventureView.renderResult(document.getElementById('adventure-result'), prof(), {earned:quiz.earned,arrivals:quiz.arrivals,vehicleUnlocks:quiz.vehicleUnlocks,finaleCompleted:quiz.finaleCompleted,onMap:id=>showMap(id),onJournal:tab=>showJournal(tab || 'characters')});
  AdventureView.renderNextStep(document.getElementById('result-next-step'), prof(), {
    arrivals:quiz.arrivals, finaleCompleted:quiz.finaleCompleted, earned:quiz.earned,
    onStudy:()=>go('scr-setup'), onMap:()=>showMap(),
    onJournal:tab=>showJournal(tab || 'characters'), onFinaleDetails:showFinaleDetails
  });
  renderResultGuide();
  document.getElementById('btnresultreview').hidden = prof().stock.length === 0;
  if(firstShow && (pct >= 80 || badgeQueue.length || quiz.finaleCompleted || quiz.vehicleUnlocks.length)){ sndTada(); if(richEffects()) confetti(); }
  quiz.resultEffectsPlayed = true;
  UIJa.apply(document.getElementById('scr-result'));
}
function confetti(){
  if(!richEffects()) return;
  const em = ["🎉","⭐","🌸","💛","🎊","✨","🩵","🧡"];
  for(let i = 0; i < 18; i++){
    const s = document.createElement("div");
    s.className = "confetti";
    s.textContent = em[Math.floor(Math.random()*em.length)];
    s.style.left = Math.random()*100 + "vw";
    s.style.animationDuration = (0.6 + Math.random()*0.5) + "s";
    s.style.animationDelay = Math.random()*0.1 + "s";
    s.style.fontSize = (16 + Math.random()*18) + "px";
    document.body.appendChild(s);
    scheduleEffect(() => s.remove(), 1300);
  }
}
document.getElementById("btnhome2").addEventListener("click", () => { renderHome(); go("scr-home"); });
document.getElementById("btnagain").addEventListener("click", () => startQuiz(quiz.review));
/* ================= ふくしゅうボックス ================= */
function renderStock(){
  const p = prof();
  const list = document.getElementById("stocklist");
  list.innerHTML = "";
  document.getElementById("btnreview").style.display = p.stock.length ? "block" : "none";
  if(p.stock.length === 0){
    list.innerHTML = '<div class="card stockempty">はこは からっぽ! 🎉<br>まちがえた ことばが ここに たまるよ</div>';
    return;
  }
  p.stock.map(findWord).filter(Boolean).forEach(w => {
    const row = document.createElement("div");
    row.className = "srow";
    row.innerHTML = '<span class="se">' + w.e + '</span>' +
      '<div class="st"><div class="fr">' + (w.pos === "n" ? gdot(w) + " " : "") + esc(frDisplay(w)) +
      (DB.settings.kana ? ' <span style="color:var(--sub);font-size:12px">' + esc(w.kana) + '</span>' : "") +
      '</div><div class="ja">' + esc(w.ja) + '</div></div>' +
      '<button class="sspeak">🔊</button><button class="sbtn">おぼえた!<br>はこから だす</button>';
    row.querySelector(".sspeak").addEventListener("click", () => speak(w));
    row.querySelector(".sbtn").addEventListener("click", () => {
      const p2 = prof();
      p2.stock = p2.stock.filter(k => k !== wkey(w));
      save(); sndOK(); renderStock();
    });
    list.appendChild(row);
  });
}
document.getElementById("btnreview").addEventListener("click", () => startQuiz(true));

/* ================= きろく ================= */
function renderStats(){
  const p = prof();
  document.getElementById("statmsg").textContent = "⭐ " + currentLevelText(p).text;
  // レベルバー
  const bars = document.getElementById("lvlbars");
  bars.innerHTML = "";
  LEVELS.forEach(lv => {
    const active = activeLevels().includes(lv);
    const s = active ? lvlStats(p, lv) : null;
    const div = document.createElement("div");
    div.className = "statrow" + (active ? "" : " locked");
    div.innerHTML = '<div class="lab"><span>' + lvName(lv) + " (" + LEVEL_LABEL[lv] + ")" +
      (active ? "" : " 🔒") + '</span><span class="pct">' +
      (active ? s.cur + "/" + s.total + "こ おぼえた (" + s.pct + "%)" + (s.pct >= 100 ? " " + BADGE[lv] + (s.pct >= 200 ? "✨" : "") : "") + (s.lap >= 2 ? " ⭐" + s.lap + "しゅうめ" : "") : "じゅんびちゅう") +
      '</span></div><div class="statbar"><div style="width:' + (active ? s.fill : 0) + '%"></div></div>';
    bars.appendChild(div);
  });
  // バッジコレクション (10%ごとに 1こ)
  const col = document.getElementById("badgecol");
  col.innerHTML = "";
  let totalB = 0;
  activeLevels().forEach(lv => {
    const s = lvlStats(p, lv);
    const m = Math.floor(s.pct / 10);
    totalB += m;
    let slots = "";
    for(let i = 1; i <= 10; i++){
      slots += '<span class="bslot' + (m >= i ? " got" : "") + '">' + (m >= i ? BADGE[lv] : "") + '</span>';
    }
    const gold = m > 10 ? ' <span class="bgold">✨×' + (m - 10) + '</span>' : "";
    col.insertAdjacentHTML("beforeend",
      '<div class="bcolrow"><span class="bcollv">' + lv + '</span><span class="bslots">' + slots + '</span>' + gold + '</div>');
  });
  document.getElementById("badgetotal").textContent = "(" + totalB + "こ)";
  // まいにちのグラフ (14にちぶん)
  const days = [];
  for(let i = 13; i >= 0; i--){
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");
    days.push({ label: (dt.getMonth()+1)+"/"+dt.getDate(), d: p.daily[key] || {q:0,c:0} });
  }
  const maxQ = Math.max(10, ...days.map(x => x.d.q));
  const W = 620, H = 190, bw = 30, gap = 14, x0 = 10, y0 = 150;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="min-width:520px">';
  days.forEach((day, i) => {
    const x = x0 + i * (bw + gap);
    const hq = Math.round(day.d.q / maxQ * 120);
    const hc = day.d.q ? Math.round(hq * day.d.c / day.d.q) : 0;
    svg += '<rect x="' + x + '" y="' + (y0-hq) + '" width="' + bw + '" height="' + hq + '" rx="6" fill="#E3DAF5"/>';
    svg += '<rect x="' + x + '" y="' + (y0-hc) + '" width="' + bw + '" height="' + hc + '" rx="6" fill="#16C7B2"/>';
    if(day.d.q > 0){
      svg += '<text x="' + (x+bw/2) + '" y="' + (y0-hq-8) + '" font-size="12" font-weight="bold" fill="#7B5BFF" text-anchor="middle">' + day.d.c + "/" + day.d.q + '</text>';
    }
    svg += '<text x="' + (x+bw/2) + '" y="' + (y0+18) + '" font-size="11" fill="#8B87A0" text-anchor="middle">' + day.label + '</text>';
  });
  svg += '<text x="' + x0 + '" y="' + (H-4) + '" font-size="11.5" fill="#8B87A0">みどり = せいかいした かず / むらさき = こたえた かず</text>';
  svg += '</svg>';
  document.getElementById("chartwrap").innerHTML = svg;
  // ごうけい
  const tq = totalAnswered(p);
  const tc = Object.values(p.daily).reduce((a,d) => a + d.c, 0);
  document.getElementById("totq").textContent = tq;
  document.getElementById("totc").textContent = tc;
  document.getElementById("totp").textContent = tq ? Math.round(100*tc/tq) + "%" : "-";
  // みんなのきろく
  const tbl = document.getElementById("ptable");
  const lvs = activeLevels();
  tbl.innerHTML = '<tr style="color:var(--sub);font-size:12px"><td>なまえ</td>' +
    lvs.map(lv => '<td>' + lv + '</td>').join('') + '<td>こたえた</td></tr>';
  DB.profiles.forEach(pp => {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td>' + pp.avatar + " " + esc(pp.name) + '</td>' +
      lvs.map(lv => '<td class="pc">' + lvlProgress(pp, lv) + '%</td>').join('') +
      '<td>' + totalAnswered(pp) + '</td>';
    tbl.appendChild(tr);
  });
}

/* ================= ほぞん / よみこみ ================= */
document.getElementById("btnexport").addEventListener("click", () => {
  exportRecords();
});
document.getElementById("btnimport").addEventListener("click", () => document.getElementById("importfile").click());
document.getElementById("importfile").addEventListener("change", ev => {
  const f = ev.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const candidate = ProfileStore.importData(r.result, localStorage, LS_KEY, Adventure);
      clearTransientEffects(); quiz = null;
      DB = candidate; storageLocked = false; storageProblem = null; unreadableBackup = null;
      storageBaseline = JSON.stringify(candidate);
      lastVoiceListKey = ''; refreshVoices(); showSaveState();
      renderProfiles(); go("scr-profile");
      toast("記録を読み込みました。");
    }catch(e){ alert("記録を読み込めませんでした。今の記録は変更していません。\n" + (e.message || '')); }
  };
  r.readAsText(f);
  ev.target.value = "";
});

/* ================= パリの旅と教材案内 ================= */
function exportRecords(){
  downloadRecords(JSON.stringify(DB, null, 1), 'furansugo-quiz-kiroku.json');
}
function exportOriginalRecords(){
  if(unreadableBackup !== null) downloadRecords(unreadableBackup, 'furansugo-quiz-original.json');
}
function downloadRecords(text, filename){
  const blob = new Blob([text], {type:'application/json'});
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.getElementById('retry-save').addEventListener('click', save);
document.getElementById('recover-export').addEventListener('click', exportRecords);
document.getElementById('recover-original-export')?.addEventListener('click', exportOriginalRecords);
function resetSetupForProfile(p){
  setup = {dir:'jf',lv:'A1',unitId:null,recommendationId:null};
  if(ProfileStore.guideAvailable(p)){
    const unit = StudyGuide.getUnit(p.studyGuide.lastGrammarUnitId);
    if(unit) setup = {dir:'jf',lv:unit.lv,unitId:unit.id,recommendationId:null};
  }
}
function journeyText(p){
  const a = Adventure.ensure(p);
  if(!a) return '旅の記録を保管しています。教材は自由に選べます。';
  const finale = Adventure.getFinaleStatus(p);
  if(finale.active) return UIJa.ruby('最後','さいご')+'の'+UIJa.ruby('宝探し','たからさがし')+' · あと '+(finale.requiredCorrect-finale.progress)+UIJa.ruby('問','もん')+UIJa.ruby('正解','せいかい');
  const node = Adventure.nodes.find(n => n.id === a.currentNodeId);
  const label = n => UIJa.ruby(n.name,n.reading);
  if(a.activeLeg){
    const destination = Adventure.nodes.find(n => n.id === a.activeLeg.to);
    return label(destination)+'へ · あと <b>'+(a.activeLeg.requiredUnits-a.activeLeg.progressUnits)+'</b> '+UIJa.ruby('問','もん')+UIJa.ruby('正解','せいかい');
  }
  return label(node)+' · '+(a.pendingUnits ? UIJa.ruby('次','つぎ')+'の'+UIJa.ruby('道','みち')+'へ '+a.pendingUnits+UIJa.ruby('正解分','せいかいぶん') : UIJa.ruby('行','い')+'きたい'+UIJa.ruby('道','みち')+'を'+UIJa.ruby('選','えら')+'ぼう');
}
let journalTab = 'places';
let mapFocusPlaceId = null;
function showMap(placeId){
  if(!prof()) return;
  mapFocusPlaceId = typeof placeId === 'string' && WorldData.getNode(placeId) ? placeId : null;
  renderMap(); go('scr-map');
}
function showFinaleDetails(){
  if(!prof()) return;
  mapFocusPlaceId = null;
  go('scr-map');
  renderMap(true);
}
function renderMap(focusFinale=false){
  const p = prof(); if(!p) return;
  AdventureView.renderMap(document.getElementById('adventure-map'), p, {
    focusPlaceId:mapFocusPlaceId,
    focusFinale,
    onFinaleDetails:showFinaleDetails,
    onChoose(edgeId){
      const move=Adventure.selectPath(p,edgeId); save(); renderMap();
      if(move.arrived) toast(WorldData.getNode(move.arrived).name+'に到着！ 図鑑に記録したよ。');
    },
    onReturn(nodeId){ Adventure.returnTo(p,nodeId); save(); renderMap(); },
    onStudy(){ go('scr-setup'); },
    onJournal(tab){ showJournal(tab); },
    onVehicle(id){ Adventure.setVehicle(p,id); save(); renderMap(); },
    onFinale(){ const change=Adventure.startFinale(p); if(change.changed || Adventure.getFinaleStatus(p).active){ save(); go('scr-setup'); } },
    onPauseFinale(){ Adventure.pauseFinale(p); save(); renderMap(); },
    onRecommend(id){ selectRecommendation(id); },
    onEffects(mode){ setEffects(mode); renderMap(); }
  });
  mapFocusPlaceId = null;
}
function showJournal(tab='places'){
  if(!prof()) return;
  journalTab=['places','characters','vehicles'].includes(tab) ? tab : 'places';
  renderJournal(); go('scr-journal');
}
function renderJournal(){
  const p=prof(); if(!p) return;
  AdventureView.renderJournal(document.getElementById('adventure-journal'),p,{
    tab:journalTab,
    onTab(tab){ journalTab=tab; renderJournal(); },
    onMap(placeId){ showMap(placeId); },
    onVehicle(id){ Adventure.setVehicle(p,id); save(); renderJournal(); },
    wordLabel(key){ const w=findWord(key); return w ? frDisplay(w)+' — '+w.ja : ''; }
  });
}
function selectRecommendation(id){
  const item=WorldData.getRecommendation(id); if(!item || !prof()) return;
  setup={...setup,lv:item.lv,unitId:null,recommendationId:item.id};
  go('scr-setup');
}
function renderRecommendations(p){
  const panel=document.getElementById('place-recommendations');
  const state=Adventure.status(p).ok && p.adventure;
  const place=state && WorldData.getNode(state.activeLeg?.to || state.currentNodeId);
  panel.innerHTML=''; panel.hidden=!place;
  if(!place) return;
  const h=document.createElement('h2');
  h.innerHTML=UIJa.ruby(place.name,place.reading)+'で'+UIJa.ruby('学','まな')+'ぶなら'; panel.appendChild(h);
  const caption=document.createElement('p'); caption.className='study-context';
  caption.innerHTML='おすすめの'+UIJa.ruby('教材','きょうざい')+'です。'+UIJa.ruby('下','した')+'から'+UIJa.ruby('別','べつ')+'の'+UIJa.ruby('教材','きょうざい')+'も'+UIJa.ruby('自由','じゆう')+'に'+UIJa.ruby('選','えら')+'べます。'; panel.appendChild(caption);
  for(const item of WorldData.recommendationsFor(place.id)){
    const b=document.createElement('button'); b.type='button';
    b.className='recommendation-choice'+(setup.recommendationId===item.id?' selected':'');
    b.dataset.recommendation=item.id;
    b.setAttribute('aria-pressed',String(setup.recommendationId===item.id));
    b.innerHTML='<span>'+UIJa.ruby(item.label,item.labelReading)+'</span><small>'+UIJa.level(item.lv)+'</small>';
    b.addEventListener('click',()=>selectRecommendation(item.id)); panel.appendChild(b);
  }
  const chosen=WorldData.getRecommendation(setup.recommendationId);
  if(chosen){
    const note=document.createElement('p'); note.className='recommendation-active';
    note.innerHTML=UIJa.ruby('選択中','せんたくちゅう')+'：'+UIJa.ruby(chosen.label,chosen.labelReading)+'（'+UIJa.level(chosen.lv)+'）'; panel.appendChild(note);
    const clear=document.createElement('button'); clear.type='button'; clear.className='btn ghost small';
    clear.textContent='テーマを外して、この教材全体から選ぶ';
    clear.addEventListener('click',()=>{setup.recommendationId=null;renderSetup();}); panel.appendChild(clear);
  }
}
function setEffects(mode){
  if(!['rich','calm'].includes(mode)) return;
  const a = prof() && Adventure.ensure(prof()); if(!a) return;
  a.effectsMode = mode; save();
  if(current === 'scr-quiz'){
    // Presentation changes do not redraw a question or score an answer.
    document.querySelectorAll('.confetti').forEach(el => el.remove());
    clearCorrectCelebration();
    renderQuizContext();
    renderJourneyScene(quiz.answered ? (quiz.results.at(-1).ok ? 'correct' : 'wrong') : 'idle', quiz.sceneMessage || '自分のペースで進もう。', false);
  }
}
document.getElementById('btnmap').addEventListener('click', showMap);
document.getElementById('btnresultmap').addEventListener('click', showMap);
document.getElementById('btnjournal').addEventListener('click',()=>showJournal());
document.getElementById('btnresultjournal').addEventListener('click',()=>showJournal());
document.getElementById('dismiss-migration').addEventListener('click',()=>{
  const state=prof() && Adventure.ensure(prof()); if(!state) return;
  state.migrationAcknowledged=true;save();renderHome();
});
document.getElementById('btnresultstudy').addEventListener('click', () => go('scr-setup'));
document.getElementById('btnresultreview').addEventListener('click', () => startQuiz(true));
document.getElementById('quiz-effects').addEventListener('change', ev => setEffects(ev.target.value));
function selectUnit(unit){
  const p = prof(); if(!unit || !p) return;
  setup.lv = unit.lv; setup.unitId = unit.id; setup.recommendationId=null;
  if(ProfileStore.guideAvailable(p)){ p.studyGuide.lastGrammarUnitId = unit.id; save(); }
  renderSetup();
}
function renderSetup(){
  const p = prof(); if(!p) return;
  const a = Adventure.ensure(p);
  document.querySelectorAll('#lvchoices .choice').forEach(b => b.classList.toggle('sel',b.dataset.lv === setup.lv));
  document.querySelectorAll('#dirchoices .choice').forEach(b => b.classList.toggle('sel',b.dataset.dir === setup.dir));
  document.getElementById('setup-journey').innerHTML = journeyText(p);
  renderRecommendations(p);
  const unitLabel = StudyGuide.getUnit(setup.unitId);
  const recLabel = WorldData.getRecommendation(setup.recommendationId);
  document.getElementById('setup-selection').innerHTML = UIJa.level(setup.lv)+(unitLabel?' · '+UIJa.ruby(unitLabel.title,unitLabel.reading):recLabel?' · '+UIJa.ruby(recLabel.label,recLabel.labelReading):'');
  document.getElementById('question-limit-note').innerHTML = a && !a.introCompleted && !Adventure.getFinaleStatus(p).active
    ? 'はじめの'+UIJa.ruby('旅','たび')+'は <b>3'+UIJa.ruby('問','もん')+'</b>。'+UIJa.ruby('次','つぎ')+'からは10'+UIJa.ruby('問','もん')+'です。'
    : UIJa.ruby('今回','こんかい')+'は <b>10'+UIJa.ruby('問','もん')+'</b>。'+UIJa.ruby('時間制限','じかんせいげん')+'はありません。';
  const panel = document.getElementById('grammar-guide');
  const units = StudyGuide.forLevel(setup.lv);
  panel.hidden = units.length === 0;
  panel.innerHTML = '';
  if(units.length){
    const heading = document.createElement('h2');
    heading.innerHTML = UIJa.ruby('文法','ぶんぽう')+'の'+UIJa.ruby('道筋','みちすじ'); panel.appendChild(heading);
    const hint = document.createElement('p'); hint.className='study-context';
    hint.innerHTML='おすすめの'+UIJa.ruby('順番','じゅんばん')+'です。どの'+UIJa.ruby('単元','たんげん')+'からでも'+UIJa.ruby('挑戦','ちょうせん')+'できます。'; panel.appendChild(hint);
    const all = document.createElement('button'); all.className='unit-choice'+(!setup.unitId&&!setup.recommendationId?' selected':'');
    all.innerHTML='この'+UIJa.ruby('段階','だんかい')+'を'+UIJa.ruby('混','ま')+'ぜて'+UIJa.ruby('練習','れんしゅう');
    all.addEventListener('click',()=>{ setup.unitId=null; setup.recommendationId=null; renderSetup(); }); panel.appendChild(all);
    const next = StudyGuide.recommended(p,WORDS);
    units.forEach((unit,i)=>{
      const progress = StudyGuide.progress(p,unit,WORDS);
      const b=document.createElement('button'); b.className='unit-choice'+(unit.id===setup.unitId?' selected':'');
      b.setAttribute('aria-pressed',String(unit.id===setup.unitId)); b.dataset.unit=unit.id;
      b.innerHTML='<span class="unit-number">'+(i+1)+'</span><span>'+UIJa.ruby(unit.title,unit.reading)+(next?.id===unit.id?' <small>おすすめ</small>':'')+'</span><span class="unit-progress">'+progress.attempted+'/'+progress.total+' '+UIJa.ruby('問','もん')+(progress.complete?' ✓':'')+'</span>';
      b.addEventListener('click',()=>selectUnit(unit)); panel.appendChild(b);
    });
    const foot=document.createElement('p'); foot.className='study-context';
    foot.innerHTML='✓ は、すべての'+UIJa.ruby('問題','もんだい')+'に'+UIJa.ruby('一度','いちど')+UIJa.ruby('答','こた')+'えた'+UIJa.ruby('印','しるし')+'です。'; panel.appendChild(foot);
  }
  UIJa.apply(document.getElementById('scr-setup'));
}
document.getElementById('btnrecommended').addEventListener('click',()=>{
  const unit = StudyGuide.recommended(prof(),WORDS);
  if(unit) selectUnit(unit);
  else { setup.lv='ぶんぽう1'; setup.unitId=null; setup.recommendationId=null; renderSetup(); toast('一通り取り組みました。好きな単元や復習を選ぼう。'); }
  document.getElementById('grammar-guide').scrollIntoView({block:'start'});
});
function renderQuizContext(){
  if(!quiz) return;
  const q=quiz.qs[quiz.i];
  const unit=!quiz.review && StudyGuide.getUnit(quiz.settings.unitId);
  const recommendation=!quiz.review && WorldData.getRecommendation(quiz.settings.recommendationId);
  document.getElementById('quiz-subject').innerHTML=(Adventure.getFinaleStatus(prof()).active ? '👑 '+UIJa.ruby('宝探し','たからさがし')+' · ' : '')+(quiz.review?UIJa.ruby('復習','ふくしゅう')+' · ':'')+UIJa.level(q.w.lv)+(unit?' · '+UIJa.ruby(unit.title,unit.reading):'')+(recommendation?' · '+UIJa.ruby(recommendation.label,recommendation.labelReading):'')+' <span>'+(quiz.i+1)+' / '+quiz.qs.length+'</span>';
  document.getElementById('quiz-effects').value=Adventure.status(prof()).ok ? (prof().adventure?.effectsMode || 'rich') : 'calm';
  document.getElementById('scr-quiz').dataset.effects=richEffects() ? 'rich' : 'calm';
  document.getElementById('quiz-effects').disabled=!Adventure.status(prof()).ok;
}
function renderJourneyScene(reaction,message,animate=true){
  if(!quiz) return;
  quiz.sceneMessage=message;
  AdventureView.renderScene(document.getElementById('adventure-scene'),prof(),{reaction,message,animate,finaleCompleted:quiz.finaleCompleted,subject:'',questionIndex:quiz.i+1,questionCount:quiz.qs.length});
}
function renderResultGuide(){
  const panel=document.getElementById('result-guide'); panel.innerHTML='';
  if(!quiz.results.some(r=>r.w.pos==='gram')) return;
  const next=StudyGuide.recommended(prof(),WORDS); if(!next) return;
  const b=document.createElement('button'); b.className='btn ghost';
  b.innerHTML=UIJa.ruby('文法','ぶんぽう')+'のおすすめ：'+UIJa.ruby(next.title,next.reading);
  b.addEventListener('click',()=>{ selectUnit(next); go('scr-setup'); }); panel.appendChild(b);
}

/* ================= スタート ================= */
(function init(){
  const vi = document.getElementById("verinfo");
  if(vi) vi.textContent = APP_VER;
  // ひらいたときは いつも「だれが あそぶ?」から
  renderProfiles(); go("scr-profile");
  showSaveState();
})();
