/* Display-only Japanese labels. Never rewrite curriculum or stored profile data. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UIJa = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function escape(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  const han = /[\u3400-\u9fff々〆〇]/;
  const kana = /[\u3040-\u30ff]/;
  const foreignReadings = { "être": "エートル", "avoir": "アヴォワール", "aller": "アレ", "-er": "エーアール", "si": "シ", "y": "イ", "en": "アン" };
  const foreignPattern = /être|avoir|aller|-er|\b(?:si|y|en)\b/g;
  // Repeated kana can belong either to a kanji reading or the following
  // particle. These reviewed labels explicitly assign each kanji span.
  const readingSegments = new Map([
    ["乗り物の言葉", ["の", "もの", "ことば"]],
    ["食べ物の言葉", ["た", "もの", "ことば"]],
    ["物語の言葉", ["ものがたり", "ことば"]],
    ["庭園と「鏡の回廊」がある宮殿。回廊では窓の向かいに鏡が並びます。", ["ていえん", "かがみ", "かいろう", "きゅうでん", "かいろう", "まど", "む", "かがみ", "なら"]]
  ]);
  function normalizeKana(value) {
    return String(value).replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
  }
  function annotate(text, reading) {
    return "<ruby>" + escape(text) + "<rp>（</rp><rt>" + escape(reading) + "</rt><rp>）</rp></ruby>";
  }
  function plainSegment(text) {
    // French grammar names retain their pronunciation aid; Japanese kana do not.
    let html = "", from = 0;
    for (const match of text.matchAll(foreignPattern)) {
      html += escape(text.slice(from, match.index)) + annotate(match[0], foreignReadings[match[0]]);
      from = match.index + match[0].length;
    }
    return html + escape(text.slice(from));
  }
  function ruby(text, reading) {
    const base = String(text == null ? "" : text);
    if (!reading) return escape(base);
    if (!han.test(base)) return kana.test(base) ? plainSegment(base) : annotate(base, reading);
    // Match unchanged kana/punctuation against the supplied reading. Only the
    // intervening kanji get ruby: エッフェル + 塔(とう), not the whole name.
    const parts = base.match(/[\u3400-\u9fff々〆〇]+|[^\u3400-\u9fff々〆〇]+/g);
    const literal = part => normalizeKana(part.replace(foreignPattern, word => foreignReadings[word])).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const segments = readingSegments.get(base);
    let segmentIndex = 0;
    const pattern = parts.map(part => han.test(part) ? (segments ? "(" + literal(segments[segmentIndex++]) + ")" : "(.+?)") : literal(part)).join("");
    const normalized = normalizeKana(reading);
    const match = new RegExp("^" + pattern + "$", "u").exec(normalized);
    // An inconsistent future label must never invent or misplace a reading.
    if (!match) return escape(base);
    if (!segments) {
      const otherPattern = parts.map(part => han.test(part) ? "(.+)" : literal(part)).join("");
      const other = new RegExp("^" + otherPattern + "$", "u").exec(normalized);
      // Neither shortest nor longest matching is linguistically reliable.
      // If they disagree, leave a new ambiguous label unannotated until its
      // reading segments are supplied explicitly above.
      if (!other || match.some((value, index) => value !== other[index])) return escape(base);
    }
    let index = 0;
    return parts.map(part => han.test(part) ? annotate(part, match[++index]) : plainSegment(part)).join("");
  }

  function level(lv) {
    if (/^[ABC][12]$/.test(lv)) return ruby("単語", "たんご") + " " + escape(lv);
    const grammar = { "ぶんぽう1": ["初級", "しょきゅう"], "ぶんぽう2": ["中級", "ちゅうきゅう"], "ぶんぽう3": ["上級", "じょうきゅう"] };
    if (Object.prototype.hasOwnProperty.call(grammar, lv)) {
      return ruby("文法", "ぶんぽう") + " " + ruby(grammar[lv][0], grammar[lv][1]);
    }
    const conversation = { "はなし": "Koto と Kai", "はなし2": "Yo と ママ", "はなし3": "おでかけ" };
    if (Object.prototype.hasOwnProperty.call(conversation, lv)) return ruby("会話", "かいわ") + " " + conversation[lv];
    if (lv === "abc") return ruby("単語", "たんご") + " A1〜B1 ミックス";
    if (lv === "all") return "すべての" + ruby("教材", "きょうざい");
    return escape(lv);
  }

  // Each source is a complete UI text node, never a substring of a question or name.
  const labels = new Map();
  function add(source, html) { labels.set(source, html); }
  add("ことばと歩く、フランス。", "ことばと" + ruby("歩", "ある") + "く、フランス。");
  add("地図から出発", ruby("地図", "ちず") + "から" + ruby("出発", "しゅっぱつ"));
  add("旅の図鑑を見る", ruby("旅", "たび") + "の" + ruby("図鑑", "ずかん") + "を" + ruby("見", "み") + "る");
  add("テーマを外して、この教材全体から選ぶ", "テーマを" + ruby("外", "はず") + "して、この" + ruby("教材全体", "きょうざいぜんたい") + "から" + ruby("選", "えら") + "ぶ");
  add("地図で行き先を選ぶ", ruby("地図", "ちず") + "で" + ruby("行", "い") + "き" + ruby("先", "さき") + "を" + ruby("選", "えら") + "ぶ");
  add("教材を選び直す", ruby("教材", "きょうざい") + "を" + ruby("選", "えら") + "び" + ruby("直", "なお") + "す");
  add("間違えた言葉を復習", ruby("間違", "まちが") + "えた" + ruby("言葉", "ことば") + "を" + ruby("復習", "ふくしゅう"));
  add("文法のおすすめから", ruby("文法", "ぶんぽう") + "のおすすめから");
  add("どの教材も、初めから自由に選べます。", "どの" + ruby("教材", "きょうざい") + "も、" + ruby("初", "はじ") + "めから" + ruby("自由", "じゆう") + "に" + ruby("選", "えら") + "べます。");
  add("すべての教材", level("all"));
  add("単語・会話・文法", ruby("単語", "たんご") + "・" + ruby("会話", "かいわ") + "・" + ruby("文法", "ぶんぽう"));
  add("保存を試す", ruby("保存", "ほぞん") + "を" + ruby("試", "ため") + "す");
  add("記録を書き出す", ruby("記録", "きろく") + "を" + ruby("書", "か") + "き" + ruby("出", "だ") + "す");
  add("気球でパリへ到着。ここから、好きな道を歩いていこう。", ruby("気球", "ききゅう") + "でパリへ" + ruby("到着", "とうちゃく") + "。ここから、" + ruby("好", "す") + "きな" + ruby("道", "みち") + "を" + ruby("歩", "ある") + "いていこう。");
  add("🎈 ことばあつめの だいぼうけん!", "🎈 ことば" + ruby("集", "あつ") + "めの" + ruby("大冒険", "だいぼうけん") + "！");
  add("フランスごの ことばに せいかいすると ⭐", "フランス" + ruby("語", "ご") + "の" + ruby("言葉", "ことば") + "に" + ruby("正解", "せいかい") + "すると ⭐");
  add("🔊を おして、ほんものの フランスごも きいてみよう!", "🔊を" + ruby("押", "お") + "して、" + ruby("本物", "ほんもの") + "のフランス" + ruby("語", "ご") + "も" + ruby("聞", "き") + "いてみよう！");
  add("自分のペースで進もう。", ruby("自分", "じぶん") + "のペースで" + ruby("進", "すす") + "もう。");
  add("まずは3問。ゆっくり考えよう。", "まずは3" + ruby("問", "もん") + "。ゆっくり" + ruby("考", "かんが") + "えよう。");
  add("到着！ 続きも自分のペースで。", ruby("到着", "とうちゃく") + "！ " + ruby("続", "つづ") + "きも" + ruby("自分", "じぶん") + "のペースで。");
  add("◀ もどる", "◀ " + ruby("戻", "もど") + "る");
  add("🇫🇷 フランスごクイズ 🥐", "🇫🇷 フランス" + ruby("語", "ご") + "クイズ 🥐");
  add("だれが あそぶ? (4にんまで とうろくできるよ)", ruby("誰", "だれ") + "が" + ruby("遊", "あそ") + "ぶ？（4" + ruby("人", "にん") + "まで" + ruby("登録", "とうろく") + "できるよ）");
  add("あたらしい おともだち", ruby("新", "あたら") + "しいお" + ruby("友達", "ともだち"));
  add("あたらしく つくる", ruby("新", "あたら") + "しく" + ruby("作", "つく") + "る");
  add("なまえと アイコンを かえる", ruby("名前", "なまえ") + "とアイコンを" + ruby("変", "か") + "える");
  add("とうろく!", ruby("登録", "とうろく") + "！");
  add("ほぞんする!", ruby("保存", "ほぞん") + "する！");
  add("やめる", "やめる");
  add("🎮 クイズで あそぶ", "🎮 クイズで" + ruby("遊", "あそ") + "ぶ");
  add("📦 ふくしゅうボックス", "📦 " + ruby("復習", "ふくしゅう") + "ボックス");
  add("📈 きろくを みる", "📈 " + ruby("記録", "きろく") + "を" + ruby("見", "み") + "る");
  add("📈 きろく", "📈 " + ruby("記録", "きろく"));
  add("▶️ おはなしを みる (あそびかた)", "▶️ おはなしを" + ruby("見", "み") + "る（" + ruby("遊", "あそ") + "び" + ruby("方", "かた") + "）");
  add("📖 ぶんぽうの よみもの (おとなむけ)", "📖 " + ruby("文法", "ぶんぽう") + "の" + ruby("読", "よ") + "み" + ruby("物", "もの") + "（" + ruby("大人向", "おとなむ") + "け）");
  add("🔊 おと", "🔊 " + ruby("音", "おと"));
  add("🔊 おと ON", "🔊 " + ruby("音", "おと") + " ON");
  add("🔇 おと OFF", "🔇 " + ruby("音", "おと") + " OFF");
  add("🔤 よみがな", "🔤 " + ruby("読", "よ") + "みがな");
  add("🔤 よみがな ON", "🔤 " + ruby("読", "よ") + "みがな ON");
  add("🔤 よみがな OFF", "🔤 " + ruby("読", "よ") + "みがな OFF");
  add("💾 ほぞん", "💾 " + ruby("保存", "ほぞん"));
  add("📂 よみこみ", "📂 " + ruby("読", "よ") + "み" + ruby("込", "こ") + "み");
  add("もんだいの でかた:", ruby("問題", "もんだい") + "の" + ruby("出", "で") + "かた：");
  add("🎯 おぼえてない ことばだけ", "🎯 " + ruby("覚", "おぼ") + "えていない" + ruby("言葉", "ことば") + "だけ");
  add("🎲 ぜんぶから ランダム", "🎲 " + ruby("全部", "ぜんぶ") + "からランダム");
  add("どんな クイズに する?", "どんなクイズにする？");
  add("🇫🇷➡️🖼️ フランスごを みて いみを えらぶ", "🇫🇷➡️🖼️ フランス" + ruby("語", "ご") + "を" + ruby("見", "み") + "て" + ruby("意味", "いみ") + "を" + ruby("選", "えら") + "ぶ");
  add("🖼️➡️🇫🇷 えを みて フランスごを えらぶ", "🖼️➡️🇫🇷 " + ruby("絵", "え") + "を" + ruby("見", "み") + "てフランス" + ruby("語", "ご") + "を" + ruby("選", "えら") + "ぶ");
  add("どっちも でるよ", "どちらも" + ruby("出", "で") + "るよ");
  add("レベルを えらんでね", "レベルを" + ruby("選", "えら") + "んでね");
  add("Koto と Kai の かいわ", "Koto と Kai の" + ruby("会話", "かいわ"));
  add("Yo と ママ の かいわ 100", "Yo と ママ の" + ruby("会話", "かいわ") + " 100");
  add("おでかけの かいわ 100 (おみせ・でんしゃ・レストラン)", "おでかけの" + ruby("会話", "かいわ") + " 100（お" + ruby("店", "みせ") + "・" + ruby("電車", "でんしゃ") + "・レストラン）");
  add("ぶんの あなうめ 100", ruby("文", "ぶん") + "の" + ruby("穴埋", "あなう") + "め 100");
  add("かこけい・みらいけい・だいめいし など 100", ruby("過去形", "かこけい") + "・" + ruby("未来形", "みらいけい") + "・" + ruby("代名詞", "だいめいし") + "など 100");
  add("せつぞくほう・じょうけんほう・かんけいし など 100", ruby("接続法", "せつぞくほう") + "・" + ruby("条件法", "じょうけんほう") + "・" + ruby("関係詞", "かんけいし") + "など 100");
  add("はじめて", ruby("初", "はじ") + "めて");
  add("なれてきた", ruby("慣", "な") + "れてきた");
  add("じょうず", ruby("上手", "じょうず"));
  add("たつじん", ruby("達人", "たつじん"));
  add("たんごA1〜B1", ruby("単語", "たんご") + " A1〜B1");
  add("まぜまぜ", "ミックス");
  add("ぜんぶまぜまぜ", level("all"));
  add("つぎへ ▶", ruby("次", "つぎ") + "へ ▶");
  add("けっか 🎉", ruby("結果", "けっか") + " 🎉");
  add("もういちど!", "もう" + ruby("一度", "いちど") + "！");
  add("🚀 ぼうけんスタート!", "🚀 " + ruby("冒険", "ぼうけん") + "スタート！");
  add("📖 かいせつ (おとなの ひと むけ)", "📖 " + ruby("解説", "かいせつ") + "（" + ruby("大人向", "おとなむ") + "け）");
  add("📦 ふくしゅうクイズを する", "📦 " + ruby("復習", "ふくしゅう") + "クイズをする");
  add("まちがえた ことばが はいるよ。クイズで せいかいすると じどうで でていくよ!", ruby("間違", "まちが") + "えた" + ruby("言葉", "ことば") + "が" + ruby("入", "はい") + "るよ。クイズで" + ruby("正解", "せいかい") + "すると" + ruby("自動", "じどう") + "で" + ruby("出", "で") + "ていくよ！");
  add("おぼえた!", ruby("覚", "おぼ") + "えた！");
  add("はこから だす", ruby("箱", "はこ") + "から" + ruby("出", "だ") + "す");
  add("はこは からっぽ! 🎉", ruby("箱", "はこ") + "はからっぽ！ 🎉");
  add("まちがえた ことばが ここに たまるよ", ruby("間違", "まちが") + "えた" + ruby("言葉", "ことば") + "がここにたまるよ");
  add("まいにちの きろく", ruby("毎日", "まいにち") + "の" + ruby("記録", "きろく"));
  add("みんなの きろく", "みんなの" + ruby("記録", "きろく"));
  add("こたえた かず", ruby("答", "こた") + "えた" + ruby("数", "かず"));
  add("せいかいした かず", ruby("正解", "せいかい") + "した" + ruby("数", "かず"));
  add("せいかいりつ", ruby("正解率", "せいかいりつ"));
  add("なまえ", ruby("名前", "なまえ"));
  add("こたえた", ruby("答", "こた") + "えた");
  add("しょきゅう", ruby("初級", "しょきゅう"));
  add("ちゅうきゅう", ruby("中級", "ちゅうきゅう"));
  add("じょうきゅう", ruby("上級", "じょうきゅう"));
  ["A1", "A2", "B1", "B2", "C1", "C2"].forEach(function (lv) { add("たんご" + lv, level(lv)); });
  ["はなし", "はなし2", "はなし3", "ぶんぽう1", "ぶんぽう2", "ぶんぽう3"].forEach(function (lv) { add(lv, level(lv)); });
  add("💬 はなし", "💬 " + level("はなし"));
  add("🍼 はなし2", "🍼 " + level("はなし2"));
  add("🧳 はなし3", "🧳 " + level("はなし3"));
  add("✏️ ぶんぽう しょきゅう", "✏️ " + level("ぶんぽう1"));
  add("🖋️ ぶんぽう ちゅうきゅう", "🖋️ " + level("ぶんぽう2"));
  add("📜 ぶんぽう じょうきゅう", "📜 " + level("ぶんぽう3"));

  const excludedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "RUBY", "RT", "RP", "SVG", "MATH", "CODE", "PRE"]);
  const excludedIds = new Set(["qarea", "opts", "expltext", "expltbl", "scr-grammar", "whoname", "voiceinfo", "gnote"]);
  const excludedClasses = new Set(["qja", "qfr", "qkana", "ofr", "oja", "okana", "reveal", "gramfull", "st", "fr", "ja", "rfr", "rja"]);

  function isProtected(node) {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (excludedTags.has(String(element.tagName).toUpperCase()) || excludedIds.has(element.id)) return true;
      if (element.hasAttribute("data-ui-ja-skip") || element.hasAttribute("data-ui-ja-rendered") || element.isContentEditable) return true;
      if (element.classList) {
        for (const name of excludedClasses) if (element.classList.contains(name)) return true;
        // Existing profile names are user data, while the empty add-profile tile is UI.
        if (element.classList.contains("pname") && !(element.parentElement && element.parentElement.classList.contains("empty"))) return true;
      }
      // In the comparison table, only the first (heading) row contains UI labels.
      if (element.tagName === "TR" && element.closest && element.closest("#ptable") && element.rowIndex !== 0) return true;
    }
    return false;
  }

  function apply(root) {
    const doc = root && (root.ownerDocument || (root.nodeType === 9 ? root : null));
    if (!doc || !doc.createTreeWalker) return 0;
    const nodes = [];
    if (root.nodeType === 3) nodes.push(root);
    else {
      const walker = doc.createTreeWalker(root, 4); // NodeFilter.SHOW_TEXT, without a window dependency.
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
    }
    let changed = 0;
    nodes.forEach(function (node) {
      if (!node.parentNode || isProtected(node)) return;
      const source = node.nodeValue;
      const trimmed = source.trim();
      if (!labels.has(trimmed)) return;
      const holder = doc.createElement("span");
      holder.setAttribute("data-ui-ja-rendered", "");
      // Dictionary values consist only of escaped text and our own ruby elements.
      holder.innerHTML = labels.get(trimmed);
      const fragment = doc.createDocumentFragment();
      const leading = source.slice(0, source.length - source.trimStart().length);
      const trailing = source.slice(source.trimEnd().length);
      if (leading) fragment.appendChild(doc.createTextNode(leading));
      fragment.appendChild(holder);
      if (trailing) fragment.appendChild(doc.createTextNode(trailing));
      node.parentNode.replaceChild(fragment, node);
      changed++;
    });
    return changed;
  }

  return Object.freeze({ ruby: ruby, level: level, apply: apply });
});
