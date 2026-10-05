/* Real places and optional curriculum suggestions. Travel rules live in adventure.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WorldData = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function freeze(value) {
    if (value && typeof value === "object") {
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }

  // These are display bounds, not walking routes, distances, or administrative borders.
  // x/y are percentages of the north-up local Paris map; the national map uses lat/lon.
  const mapBounds = freeze({
    paris: { west: 2.280, east: 2.305, north: 48.866, south: 48.852 },
    france: { west: -5.2, east: 10, north: 51.5, south: 40.8 }
  });

  const sources = {
    trocadero: "https://www.paris.fr/lieux/jardins-du-trocadero-1789",
    seine: "https://www.paris.fr/pages/lifting-reussi-pour-les-cavaliers-du-pont-d-iena-27479",
    eiffel: "https://www.toureiffel.paris/en/access-map",
    champ: "https://www.paris.fr/lieux/parc-du-champ-de-mars-1807",
    mont: "https://www.abbaye-mont-saint-michel.fr/visiter/informations-pratiques",
    chambord: "https://www.chambord.org/fr/histoire/le-chateau/architecture/",
    marseille: "https://www.marseille-tourisme.com/decouvrez-marseille/autour-de-marseille/la-provence/"
  };

  // Regions are visitor-facing groupings. In particular "Loire" is not an administrative region.
  const regions = freeze([
    { id: "paris", name: "パリ", reading: "パリ", markerName: "パリ", markerReading: "パリ", lat: 48.8584, lon: 2.2945, status: "ready",
      description: "セーヌ川のそばから、パリを歩こう。", descriptionReading: "セーヌがわのそばから、パリをあるこう。", source: sources.eiffel },
    { id: "normandy", name: "ノルマンディー", reading: "ノルマンディー", markerName: "モン・サン・ミシェル", markerReading: "モン・サン・ミシェル", lat: 48.6361, lon: -1.5115, status: "ready",
      description: "岩山の上の修道院へ。", descriptionReading: "いわやまのうえのしゅうどういんへ。", source: sources.mont },
    { id: "loire", name: "ロワール地方", reading: "ロワールちほう", markerName: "シャンボール城", markerReading: "シャンボールじょう", lat: 47.6161, lon: 1.5163, status: "ready",
      description: "ロワール地方の城を訪ねよう。", descriptionReading: "ロワールちほうのしろをたずねよう。", source: sources.chambord },
    { id: "provence", name: "プロヴァンス", reading: "プロヴァンス", markerName: "マルセイユ", markerReading: "マルセイユ", lat: 43.2965, lon: 5.3698, status: "planned",
      description: "マルセイユの街は制作中です。", descriptionReading: "マルセイユのまちはせいさくちゅうです。", source: sources.marseille }
  ]);

  function recommendation(placeId, slug, label, reading, lv, cat) {
    // lv and cat match the existing words.js data exactly; no new questions or level gates.
    return { id: placeId + "-" + slug, label: label, labelReading: reading, lv: lv, cat: cat };
  }

  const nodes = freeze([
    {
      id: "trocadero", name: "トロカデロ", reading: "トロカデロ", french: "Trocadéro", regionId: "paris",
      lat: 48.86297, lon: 2.287, x: 28, y: 21.64, scene: "city", illustration: "img/adventure/trocadero.svg",
      description: "エッフェル塔を見渡せる庭園のある、パリの出発地点。",
      descriptionReading: "エッフェルとうをみわたせるていえんのある、パリのしゅっぱつちてん。", source: sources.trocadero,
      recommendations: [
        recommendation("trocadero", "greetings", "あいさつ", "あいさつ", "A1", "あいさつ"),
        recommendation("trocadero", "directions", "道案内の会話", "みちあんないのかいわ", "はなし3", "みち"),
        recommendation("trocadero", "aller", "allerと行き先", "アレといきさき", "ぶんぽう1", "アレ")
      ]
    },
    {
      id: "seine", name: "セーヌ川（イエナ橋）", reading: "セーヌがわ（イエナばし）", french: "La Seine, près du pont d’Iéna", regionId: "paris",
      lat: 48.8609, lon: 2.2934, x: 53.6, y: 36.43, scene: "riverside", illustration: "img/adventure/seine.svg",
      description: "トロカデロとエッフェル塔をつなぐイエナ橋の近くで、セーヌ川を眺める場所。",
      descriptionReading: "トロカデロとエッフェルとうをつなぐイエナばしのちかくで、セーヌがわをながめるばしょ。", source: sources.seine,
      recommendations: [
        recommendation("seine", "nature", "自然の言葉", "しぜんのことば", "A1", "しぜん"),
        recommendation("seine", "transport", "乗り物の言葉", "のりもののことば", "A1", "のりもの"),
        recommendation("seine", "directions", "道案内の会話", "みちあんないのかいわ", "はなし3", "みち")
      ]
    },
    {
      id: "eiffel", name: "エッフェル塔", reading: "エッフェルとう", french: "La tour Eiffel", regionId: "paris",
      lat: 48.8584, lon: 2.2945, x: 58, y: 54.29, scene: "city", illustration: "img/adventure/eiffel.svg",
      description: "パリのシャン・ド・マルスに立つ塔。近くをセーヌ川が流れています。",
      descriptionReading: "パリのシャン・ド・マルスにたつとう。ちかくをセーヌがわがながれています。", source: sources.eiffel,
      recommendations: [
        recommendation("eiffel", "numbers", "数の言葉", "かずのことば", "A1", "かず"),
        recommendation("eiffel", "town", "街の言葉", "まちのことば", "A2", "まち"),
        recommendation("eiffel", "adjectives", "形容詞の性・数", "けいようしのせい・すう", "ぶんぽう1", "けいようし")
      ]
    },
    {
      id: "champ-de-mars", name: "シャン・ド・マルス公園", reading: "シャン・ド・マルスこうえん", french: "Le Champ-de-Mars", regionId: "paris",
      lat: 48.8555, lon: 2.2985, x: 74, y: 75, scene: "park", illustration: "img/adventure/champ-de-mars.svg",
      description: "エッフェル塔のそばに広がる公園。中央には大きな芝生があります。",
      descriptionReading: "エッフェルとうのそばにひろがるこうえん。ちゅうおうにはおおきなしばふがあります。", source: sources.champ,
      recommendations: [
        recommendation("champ-de-mars", "food", "食べ物の言葉", "たべもののことば", "A1", "たべもの"),
        recommendation("champ-de-mars", "play", "遊びの会話", "あそびのかいわ", "はなし", "あそび"),
        recommendation("champ-de-mars", "nature", "自然の言葉", "しぜんのことば", "A1", "しぜん")
      ]
    },
    {
      id: "mont-saint-michel", name: "モン・サン・ミシェル", reading: "モン・サン・ミシェル", french: "Le Mont-Saint-Michel", regionId: "normandy",
      lat: 48.6361, lon: -1.5115, x: 50, y: 50, scene: "riverside", illustration: "img/adventure/mont-saint-michel.svg",
      description: "岩山の村の頂上に、修道院がそびえています。",
      descriptionReading: "いわやまのむらのちょうじょうに、しゅうどういんがそびえています。", source: sources.mont,
      recommendations: [
        recommendation("mont-saint-michel", "nature", "自然の言葉", "しぜんのことば", "A1", "しぜん"),
        recommendation("mont-saint-michel", "weather", "天気の会話", "てんきのかいわ", "はなし", "てんき"),
        recommendation("mont-saint-michel", "future", "これからのことを話す文法", "これからのことをはなすぶんぽう", "ぶんぽう2", "みらい")
      ]
    },
    {
      id: "chambord", name: "シャンボール城", reading: "シャンボールじょう", french: "Le château de Chambord", regionId: "loire",
      lat: 47.6161, lon: 1.5163, x: 50, y: 50, scene: "park", illustration: "img/adventure/chambord.svg",
      description: "ルネサンス時代の城。中心には、2つのらせんが重なる階段があります。",
      descriptionReading: "ルネサンスじだいのしろ。ちゅうしんには、ふたつのらせんがかさなるかいだんがあります。", source: sources.chambord,
      recommendations: [
        recommendation("chambord", "town", "街の言葉", "まちのことば", "A1", "まち"),
        recommendation("chambord", "stories", "物語の言葉", "ものがたりのことば", "B1", "ものがたり"),
        recommendation("chambord", "past", "過去のことを話す文法", "かこのことをはなすぶんぽう", "ぶんぽう2", "ふくごうかこ")
      ]
    }
  ]);

  // Fictional original characters. Their roles and appearance are not historical claims.
  const characters = freeze([
    { id: "lumie", name: "ルミエ", reading: "ルミエ", placeId: "eiffel", fictional: true, asset: "img/adventure/char-lumie.svg",
      description: "星の飾りをつけた、旅の案内役。新しい景色を見つけるのが好きな、空想のオリジナルキャラクター。",
      descriptionReading: "ほしのかざりをつけた、たびのあんないやく。あたらしいけしきをみつけるのがすきな、くうそうのオリジナルキャラクター。" },
    { id: "mare", name: "マレ", reading: "マレ", placeId: "mont-saint-michel", fictional: true, asset: "img/adventure/char-mare.svg",
      description: "青いケープをまとった、潮を眺める仲間。水面の変化を見つけるのが好きな、空想のオリジナルキャラクター。",
      descriptionReading: "あおいケープをまとった、しおをながめるなかま。すいめんのへんかをみつけるのがすきな、くうそうのオリジナルキャラクター。" },
    { id: "plume", name: "プリュム", reading: "プリュム", placeId: "chambord", fictional: true, asset: "img/adventure/char-plume.svg",
      description: "羽ペンの帽子をかぶった、旅の記録係。発見を手帳に書くのが好きな、空想のオリジナルキャラクター。",
      descriptionReading: "はねペンのぼうしをかぶった、たびのきろくがかり。はっけんをてちょうにかくのがすきな、くうそうのオリジナルキャラクター。" }
  ]);

  function getNode(id) { return nodes.find(function (node) { return node.id === id; }) || null; }
  function getCharacter(id) { return characters.find(function (character) { return character.id === id; }) || null; }
  function recommendationsFor(id) {
    const node = getNode(id);
    return node ? node.recommendations : [];
  }
  function getRecommendation(id) {
    for (const node of nodes) {
      const match = node.recommendations.find(function (item) { return item.id === id; });
      if (match) return match;
    }
    return null;
  }

  return freeze({ nodes: nodes, regions: regions, characters: characters, mapBounds: mapBounds,
    getNode: getNode, getCharacter: getCharacter, recommendationsFor: recommendationsFor, getRecommendation: getRecommendation });
});
