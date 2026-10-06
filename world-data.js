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
    paris: { west: 2.275, east: 2.363, north: 48.88, south: 48.848 },
    france: { west: -5.2, east: 10, north: 51.5, south: 40.8 }
  });

  const sources = {
    trocadero: "https://www.paris.fr/lieux/jardins-du-trocadero-1789",
    seine: "https://www.paris.fr/pages/lifting-reussi-pour-les-cavaliers-du-pont-d-iena-27479",
    eiffel: "https://www.toureiffel.paris/en/access-map",
    champ: "https://www.paris.fr/lieux/parc-du-champ-de-mars-1807",
    mont: "https://www.abbaye-mont-saint-michel.fr/visiter/informations-pratiques",
    chambord: "https://www.chambord.org/fr/histoire/le-chateau/architecture/",
    marseille: "https://www.marseille-tourisme.com/decouvrez-marseille/culture-et-patrimoine/sites-et-monuments/le-vieux-port/",
    versailles: "https://www.chateauversailles.fr/decouvrir/domaine/chateau/galerie-glaces",
    versaillesCoordinates: "https://www.versailles-tourisme.com/chateau-de-versailles.html",
    arc: "https://www.paris-arc-de-triomphe.fr/decouvrir/histoire-de-l-arc-de-triomphe",
    louvre: "https://www.louvre.fr/en/explore/the-palace/a-pyramid-for-a-symbol",
    notreDame: "https://parisjetaime.com/article/balade-decouverte-autour-de-la-cathedrale-notre-dame-de-paris-a1798"
  };

  // Regions are visitor-facing groupings, not claims about administrative boundaries.
  const regions = freeze([
    { id: "paris", name: "パリ", reading: "パリ", markerName: "パリ", markerReading: "パリ", lat: 48.8584, lon: 2.2945, status: "ready",
      description: "セーヌ川のそばから、パリを歩こう。", descriptionReading: "セーヌがわのそばから、パリをあるこう。", source: sources.eiffel },
    { id: "normandy", name: "ノルマンディー", reading: "ノルマンディー", markerName: "モン・サン・ミシェル", markerReading: "モン・サン・ミシェル", lat: 48.6361, lon: -1.5115, status: "ready",
      description: "岩山の上の修道院へ。", descriptionReading: "いわやまのうえのしゅうどういんへ。", source: sources.mont },
    { id: "loire", name: "ロワール地方", reading: "ロワールちほう", markerName: "シャンボール城", markerReading: "シャンボールじょう", lat: 47.6161, lon: 1.5163, status: "ready",
      description: "ロワール地方の城を訪ねよう。", descriptionReading: "ロワールちほうのしろをたずねよう。", source: sources.chambord },
    { id: "provence", name: "プロヴァンス", reading: "プロヴァンス", markerName: "マルセイユ", markerReading: "マルセイユ", lat: 43.2965, lon: 5.3698, status: "ready",
      description: "船の並ぶマルセイユの旧港へ。", descriptionReading: "ふねのならぶマルセイユのきゅうこうへ。", source: sources.marseille },
    { id: "versailles", name: "ヴェルサイユ", reading: "ヴェルサイユ", markerName: "ヴェルサイユ宮殿", markerReading: "ヴェルサイユきゅうでん", lat: 48.804328, lon: 2.120936, status: "ready",
      description: "庭園と鏡の回廊のある宮殿へ。", descriptionReading: "ていえんとかがみのかいろうのあるきゅうでんへ。", source: sources.versailles, coordinateSource: sources.versaillesCoordinates }
  ]);

  function recommendation(placeId, slug, label, reading, lv, cat) {
    // lv and cat match the existing words.js data exactly; no new questions or level gates.
    return { id: placeId + "-" + slug, label: label, labelReading: reading, lv: lv, cat: cat };
  }

  const nodes = freeze([
    {
      id: "trocadero", name: "トロカデロ", reading: "トロカデロ", french: "Trocadéro", regionId: "paris",
      lat: 48.86297, lon: 2.287, x: 13.64, y: 53.22, scene: "city", illustration: "img/adventure/trocadero.svg",
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
      lat: 48.8609, lon: 2.2934, x: 20.91, y: 59.69, scene: "riverside", illustration: "img/adventure/seine.svg",
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
      lat: 48.8584, lon: 2.2945, x: 22.16, y: 67.5, scene: "city", illustration: "img/adventure/eiffel.svg",
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
      lat: 48.8555, lon: 2.2985, x: 26.7, y: 76.56, scene: "park", illustration: "img/adventure/champ-de-mars.svg",
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
    },
    {
      id: "marseille", name: "マルセイユ旧港", reading: "マルセイユきゅうこう", french: "Le Vieux-Port de Marseille", regionId: "provence",
      // Keep the existing regional marker: this is an approximate Old Port location, not an entrance or a walking waypoint.
      lat: 43.2965, lon: 5.3698, x: 50, y: 50, scene: "riverside", illustration: "img/adventure/marseille.svg",
      description: "地中海につながる港。水辺に船が並び、入口を2つの砦が見守ります。",
      descriptionReading: "ちちゅうかいにつながるみなと。みずべにふねがならび、いりぐちをふたつのとりでがみまもります。", source: sources.marseille,
      recommendations: [
        recommendation("marseille", "transport", "乗り物の言葉", "のりもののことば", "A1", "のりもの"),
        recommendation("marseille", "town", "街の言葉", "まちのことば", "A2", "まち"),
        recommendation("marseille", "restaurant", "レストランの会話", "レストランのかいわ", "はなし3", "レストラン")
      ]
    },
    {
      id: "versailles", name: "ヴェルサイユ宮殿", reading: "ヴェルサイユきゅうでん", french: "Le château de Versailles", regionId: "versailles",
      lat: 48.804328, lon: 2.120936, x: 50, y: 50, scene: "park", illustration: "img/adventure/versailles.svg",
      description: "庭園と「鏡の回廊」がある宮殿。回廊では窓の向かいに鏡が並びます。",
      descriptionReading: "ていえんと「かがみのかいろう」があるきゅうでん。かいろうではまどのむかいにかがみがならびます。", source: sources.versailles,
      coordinateSource: sources.versaillesCoordinates,
      recommendations: [
        recommendation("versailles", "colors", "色の言葉", "いろのことば", "A1", "いろ"),
        recommendation("versailles", "home", "家や部屋の言葉", "いえやへやのことば", "A1", "いえ"),
        recommendation("versailles", "comparison", "比べて話す文法", "くらべてはなすぶんぽう", "ぶんぽう2", "ひかく")
      ]
    },
    {
      id: "arc-de-triomphe", name: "凱旋門", reading: "がいせんもん", french: "L’Arc de triomphe", regionId: "paris",
      lat: 48.8738, lon: 2.295, x: 22.73, y: 19.38, scene: "city", illustration: "img/adventure/arc-de-triomphe.svg",
      description: "エトワール広場に立つ大きな門。1836年に完成し、パリの歴史を伝えています。",
      descriptionReading: "エトワールひろばにたつおおきなもん。1836ねんにかんせいし、パリのれきしをつたえています。", source: sources.arc,
      recommendations: [
        recommendation("arc-de-triomphe", "town", "街の言葉", "まちのことば", "A1", "まち"),
        recommendation("arc-de-triomphe", "directions", "道案内の会話", "みちあんないのかいわ", "はなし3", "みち"),
        recommendation("arc-de-triomphe", "past", "過去のことを話す文法", "かこのことをはなすぶんぽう", "ぶんぽう2", "ふくごうかこ")
      ]
    },
    {
      id: "louvre", name: "ルーヴル美術館", reading: "ルーヴルびじゅつかん", french: "Le musée du Louvre", regionId: "paris",
      lat: 48.8606, lon: 2.3376, x: 71.14, y: 60.63, scene: "city", illustration: "img/adventure/louvre.svg",
      description: "かつての宮殿を使った美術館。中庭にはガラスのピラミッドがあります。",
      descriptionReading: "かつてのきゅうでんをつかったびじゅつかん。なかにわにはガラスのピラミッドがあります。", source: sources.louvre,
      recommendations: [
        recommendation("louvre", "colors", "色の言葉", "いろのことば", "A1", "いろ"),
        recommendation("louvre", "stories", "物語の言葉", "ものがたりのことば", "B1", "ものがたり"),
        recommendation("louvre", "adjectives", "形容詞の性・数", "けいようしのせい・すう", "ぶんぽう1", "けいようし")
      ]
    },
    {
      id: "notre-dame", name: "ノートルダム大聖堂", reading: "ノートルダムだいせいどう", french: "La cathédrale Notre-Dame de Paris", regionId: "paris",
      lat: 48.853, lon: 2.3499, x: 85.11, y: 84.38, scene: "riverside", illustration: "img/adventure/notre-dame.svg",
      description: "セーヌ川に浮かぶシテ島の大聖堂。2つの塔と、丸いステンドグラスの窓が目印です。",
      descriptionReading: "セーヌがわにうかぶシテとうのだいせいどう。ふたつのとうと、まるいステンドグラスのまどがめじるしです。", source: sources.notreDame,
      recommendations: [
        recommendation("notre-dame", "colors", "色の言葉", "いろのことば", "A1", "いろ"),
        recommendation("notre-dame", "town", "街の言葉", "まちのことば", "A2", "まち"),
        recommendation("notre-dame", "comparison", "比べて話す文法", "くらべてはなすぶんぽう", "ぶんぽう2", "ひかく")
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
      descriptionReading: "はねペンのぼうしをかぶった、たびのきろくがかり。はっけんをてちょうにかくのがすきな、くうそうのオリジナルキャラクター。" },
    { id: "sol", name: "ソル", reading: "ソル", placeId: "marseille", fictional: true, asset: "img/adventure/char-sol.svg",
      description: "帆の飾りの帽子をかぶった、港の旅仲間。風の向きや船の帆を見つけるのが好きな、空想のオリジナルキャラクター。",
      descriptionReading: "ほのかざりのぼうしをかぶった、みなとのたびなかま。かぜのむきやふねのほをみつけるのがすきな、くうそうのオリジナルキャラクター。" },
    { id: "miro", name: "ミロ", reading: "ミロ", placeId: "versailles", fictional: true, asset: "img/adventure/char-miro.svg",
      description: "小さな手帳を持った、庭園の旅仲間。鏡の光や庭の形を観察するのが好きな、空想のオリジナルキャラクター。",
      descriptionReading: "ちいさなてちょうをもった、ていえんのたびなかま。かがみのひかりやにわのかたちをかんさつするのがすきな、くうそうのオリジナルキャラクター。" }
  ]);

  // Prototype thresholds use cumulative learning units, not level, speed, or currency.
  // Artwork is 320 × 220 with no rider. rider is a percentage anchor for the companion's bottom center.
  const vehicles = freeze([
    { id: "bicycle", name: "自転車", reading: "じてんしゃ", requiredUnits: 3, asset: "img/adventure/vehicle-bicycle.svg", rider: { x: 42, y: 69 } },
    { id: "car", name: "車", reading: "くるま", requiredUnits: 24, asset: "img/adventure/vehicle-car.svg", rider: { x: 52, y: 56 } },
    { id: "balloon", name: "気球", reading: "ききゅう", requiredUnits: 72, asset: "img/adventure/vehicle-balloon.svg", rider: { x: 50, y: 81 } },
    { id: "dragon", name: "ドラゴン", reading: "ドラゴン", requiredUnits: 120, asset: "img/adventure/vehicle-dragon.svg", fictional: true, rider: { x: 50, y: 61 } }
  ]);

  // An imaginary closing adventure, separate from every real place and geographic coordinate.
  // Its ten new correct answers are counted by the finale engine, never paid from travel carryover.
  const finale = freeze({
    id: "sky-castle", name: "星あかりの城", reading: "ほしあかりのしろ", fictional: true, scene: "sky",
    illustration: "img/adventure/sky-castle.svg",
    description: "旅で出会った仲間たちと向かう、空想の城。星あかりの下で、ことばの王冠を探そう。",
    descriptionReading: "たびでであったなかまたちとむかう、くうそうのしろ。ほしあかりのしたで、ことばのおうかんをさがそう。",
    requiredCharacterIds: ["lumie", "mare", "plume", "sol", "miro"],
    requiredVehicleIds: ["bicycle", "car", "balloon", "dragon"],
    requiredCorrect: 10, treasureName: "ことばの王冠", treasureReading: "ことばのおうかん",
    treasureAsset: "img/adventure/treasure-crown.svg"
  });

  function getNode(id) { return nodes.find(function (node) { return node.id === id; }) || null; }
  function getCharacter(id) { return characters.find(function (character) { return character.id === id; }) || null; }
  function getVehicle(id) { return vehicles.find(function (vehicle) { return vehicle.id === id; }) || null; }
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

  return freeze({ nodes: nodes, regions: regions, characters: characters, vehicles: vehicles, finale: finale, mapBounds: mapBounds,
    getNode: getNode, getCharacter: getCharacter, getVehicle: getVehicle, recommendationsFor: recommendationsFor, getRecommendation: getRecommendation });
});
