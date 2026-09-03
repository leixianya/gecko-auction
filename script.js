(function () {
  'use strict';

  /*
   * The page is intentionally self-contained.  Prices, deposits and bids are
   * held in the browser only so the whole auction flow can be experienced without
   * a payment service or an account backend.
   */
  var STORAGE_KEY = 'gecko-auction-state-v7';
  var moneyFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  var nowAtLoad = Date.now();
  var toastTimer;
  var countdownTimer;
  var configuredAssetBase = String(window.__GECKO_ASSET_BASE__ || '');
  var assetBase = configuredAssetBase && configuredAssetBase.charAt(configuredAssetBase.length - 1) !== '/' ? configuredAssetBase + '/' : configuredAssetBase;

  var $ = function (id) { return document.getElementById(id); };
  var queryAll = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var clamp = function (value, min, max) { return Math.min(Math.max(value, min), max); };
  var money = function (value) { return '¥ ' + moneyFormatter.format(Math.max(0, Math.round(Number(value) || 0))); };
  var esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  };
  function assetUrl(file) {
    var value = String(file || '');
    if (/^(?:https?:|data:|blob:|\/)/i.test(value)) return value;
    if (value.indexOf('assets/') === 0) value = value.slice(7);
    return assetBase + 'assets/' + value;
  }

  var imagePool = [
    'commons-orange.png', 'commons-tete.png', 'commons-crusted.jpg',
    'commons-geneve.jpg', 'commons-dalmatien.jpg', 'commons-eveha.jpg',
    'commons-face.jpg', 'commons-crested.jpg', 'commons-back.jpg',
    'commons-little.jpg', 'commons-juvenile.jpg', 'commons-mating.jpg',
    'commons-rhacodactylus.jpg', 'commons-newborn.jpg', 'commons-babies.jpg',
    'commons-lilb.jpg', 'commons-eye.jpg', 'commons-greco.jpg',
    'commons-baby.jpg', 'commons-mars.jpg', 'commons-pinstripe.jpg',
    'commons-yellow.jpg', 'commons-cropped.jpg', 'commons-harlequin.jpg',
    'commons-aquarium.jpg', 'commons-self.jpg', 'commons-gecko-pl.jpg',
    'commons-mg5452.jpg', 'commons-mg5440.jpg', 'commons-n01.jpg'
  ];

  var geneProfiles = {
    CHW: {
      label: 'CHW 紫曜系',
      subtitle: 'CHW Purple · 全新紫色系、薰衣草紫底、深紫侧纹与奶白冠线',
      description: 'CHW 紫曜系是全新紫色系方向，以低饱和薰衣草紫为视觉基底，沿背部延展深紫色纹理，冠线与侧身留有奶白层次。观察重点是紫色在不同状态下的稳定度、背线连续性、冠缘整洁度与体态比例。',
      tags: ['全新紫色系', '深紫侧纹', '奶白冠线']
    },
    Sable: {
      label: 'Sable',
      subtitle: 'Sable · 深色素沉淀与低饱和烟棕',
      description: 'Sable 系以深色素沉淀和烟棕层次见长。观察重点在于底色是否稳定、背部明暗过渡是否干净，以及侧身在不同状态下的色阶回弹。',
      tags: ['深色素', '烟棕层次', '状态稳定']
    },
    'Sable Lily White': {
      label: 'Sable Lily White',
      subtitle: 'Sable Lily White · 深底与乳白覆色的秩序感',
      description: 'Sable 与 Lily White 的组合，核心看点是深色基底与乳白覆色之间的边界质量。覆色走向、覆盖密度和头冠对比共同决定整体观感。',
      tags: ['Sable 组合', '覆色边界', '高对比']
    },
    'Lily White': {
      label: 'Lily White',
      subtitle: 'Lily White · 乳白覆色与背部留白',
      description: 'Lily White 的表现不止于白色面积，更在于覆色的走向、边缘的完整度和底色对比。档案以背部、侧身与头冠三个观察面拆解视觉结构。',
      tags: ['乳白覆色', '边缘完整', '结构感']
    },
    Axanthic: {
      label: 'Axanthic',
      subtitle: 'Axanthic · 冷灰底色与红色素收束',
      description: 'Axanthic 方向着重冷灰基调、红色素收束和纹理对比。高规格观察会同时记录火焰线的清晰度、侧身灰阶和干湿状态下的色相变化。',
      tags: ['冷灰基调', '红色素收束', '纹理对比']
    },
    Harlequin: {
      label: 'Harlequin',
      subtitle: 'Harlequin · 侧身纹理与火焰背线',
      description: 'Harlequin 的视觉价值来自侧身纹理、背线连续性和底色之间的比例关系。档案更强调纹理分布与整体轮廓，而不是单一色块的浓淡。',
      tags: ['侧身纹理', '火焰背线', '比例均衡']
    }
  };

  /*
   * Price bands are deliberately broad, page-local reference bands rather
   * than promises about an animal's value.  They keep the generated lots in
   * believable relative positions: Lily White / Axanthic combinations sit
   * above entry-level Harlequin and Sable lots, while quality and archive
   * notes move an individual within its band.
   */
  var marketBands = {
    CHW: { low: 1980, high: 8800, center: 4800, pressure: 0.78 },
    Sable: { low: 800, high: 3200, center: 1650, pressure: 0.58 },
    'Sable Lily White': { low: 1800, high: 6200, center: 3500, pressure: 0.66 },
    'Lily White': { low: 1400, high: 5800, center: 3000, pressure: 0.64 },
    Axanthic: { low: 1800, high: 7200, center: 3900, pressure: 0.61 },
    Harlequin: { low: 700, high: 3000, center: 1550, pressure: 0.55 }
  };
  var aiStyles = ['稳健型', '节奏型', '收藏型', '观察型'];
  var aiBidderNames = ['紫曜策略·A', '紫曜策略·B', '紫曜策略·C'];

  function hashNumber(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hashUnit(value) {
    return hashNumber(value) / 4294967295;
  }

  function roundToStep(value, step) {
    var size = Math.max(1, Number(step) || 1);
    return Math.max(size, Math.round((Number(value) || 0) / size) * size);
  }

  function marketBandFor(morph) {
    return marketBands[morph] || { low: 700, high: 3000, center: 1500, pressure: 0.55 };
  }

  function qualityScoreFor(seed, index) {
    if (seed && seed[1] === 'CHW') return 0.91;
    var focus = String(seed[3] || '');
    var lexicalBonus = (focus.indexOf('完整') >= 0 ? 0.08 : 0)
      + (focus.indexOf('连续') >= 0 ? 0.06 : 0)
      + (focus.indexOf('高对比') >= 0 ? 0.05 : 0)
      + (focus.indexOf('稳定') >= 0 ? 0.04 : 0);
    var base = 0.52 + (index % 7) * 0.055 + hashUnit(seed[0]) * 0.08;
    return clamp(base + lexicalBonus, 0.5, 0.96);
  }

  function marketSnapshot(seed, index, increment) {
    var band = marketBandFor(seed[1]);
    var quality = qualityScoreFor(seed, index);
    var estimate = roundToStep(band.low + (band.high - band.low) * quality, increment);
    var minimumBudget = Number(seed[2]) + increment * (4 + (index % 3));
    var targetBudget = Math.max(minimumBudget, estimate * (0.78 + quality * 0.12));
    var aiBudget = Math.min(band.high, roundToStep(targetBudget, increment));
    if (seed[1] === 'CHW') {
      /* The launch lot has a wider premium band than the general catalogue:
         its visible price starts at ¥3,680 while the strategy ceiling sits
         near ¥6,800, leaving room for several believable responses. */
      estimate = roundToStep(5200, increment);
      aiBudget = roundToStep(6800, increment);
    }
    if (aiBudget <= Number(seed[2])) aiBudget = Number(seed[2]) + increment * (4 + (index % 3));
    return {
      low: band.low,
      high: band.high,
      estimate: estimate,
      quality: quality,
      pressure: band.pressure,
      aiBudget: aiBudget,
      aiStyle: aiStyles[hashNumber(seed[0]) % aiStyles.length]
    };
  }

  function incrementFor(seed, index) {
    var price = Number(seed && seed[2]) || 0;
    /* CHW is positioned as a higher-ticket purple-line drop: ¥200 steps at
       the opening band, then ¥300 once the visible price crosses ¥5,000. */
    if (seed && seed[1] === 'CHW') return price >= 5000 ? 300 : 200;
    if (price < 1000) return 50;
    if (price < 5000) return 100;
    if (price < 10000) return 200;
    return 500;
  }

  function incrementForLot(lot) {
    if (!lot) return 100;
    if (lot.morph === 'CHW') return Number(lot.price) >= 5000 ? 300 : 200;
    var price = Number(lot.price) || 0;
    if (price < 1000) return 50;
    if (price < 5000) return 100;
    if (price < 10000) return 200;
    return 500;
  }

  var lotSeeds = [
    ['CHW · 紫曜首发', 'CHW', 3680, '薰衣草紫底与深紫侧纹', '公', '2025', '紫曜实验室'],
    ['墨线 Sable', 'Sable', 980, '背线收束与烟棕侧身', '母', '2023', '雨林档案室'],
    ['乳白潮汐', 'Lily White', 1680, '乳白覆色的边缘完整度', '公', '2024', '海岛育种局'],
    ['冷月 Ax', 'Axanthic', 2380, '冷灰底色与火焰线对比', '母', '2023', '灰阶研究所'],
    ['雾岭 Harlequin', 'Harlequin', 860, '侧身纹理与头冠轮廓', '公', '2024', '山海爬舍'],
    ['岩盐 Sable', 'Sable', 1120, '低饱和底色与鳞片秩序', '母', '2024', '南岛爬舍'],
    ['白昼 Lily', 'Lily White', 1960, '背部覆色与留白比例', '公', '2023', '潮汐基因库'],
    ['蓝灰 Axanthic', 'Axanthic', 2780, '蓝灰层次与尾基完整度', '母', '2024', '灰阶研究所'],
    ['铜杉火焰', 'Harlequin', 1420, '铜色底与连续火焰线', '公', '2023', '林下实验室'],
    ['夜航 Sable', 'Sable', 1320, '深色素密度与侧身回弹', '母', '2024', '雨林档案室'],
    ['月白 Lily', 'Lily White', 2240, '头冠覆色与侧身边界', '公', '2023', '海岛育种局'],
    ['霜影 Ax', 'Axanthic', 3180, '冷灰底与暗纹层次', '母', '2024', '雾岛基因社'],
    ['珊瑚线', 'Harlequin', 1040, '暖红底色与纹理密度', '公', '2024', '南岛爬舍'],
    ['黑曜 Sable', 'Sable', 1880, '黑棕基底与背部纵深', '母', '2023', '雨林档案室'],
    ['云冠 Lily', 'Lily White', 2520, '冠部覆色与肩线连续', '公', '2024', '潮汐基因库'],
    ['冷杉 Ax', 'Axanthic', 3460, '灰阶过渡与火焰边缘', '母', '2023', '灰阶研究所'],
    ['海盐侧纹', 'Harlequin', 1260, '侧纹开幅与尾基比例', '公', '2024', '山海爬舍'],
    ['乌木 Sable', 'Sable', 2140, '深色素与鳞片反光', '母', '2024', '雾岛基因社'],
    ['晨雾 Lily', 'Lily White', 2860, '柔白覆色与背线留白', '公', '2023', '海岛育种局'],
    ['冰川 Ax', 'Axanthic', 3980, '银灰底色与冷调稳定性', '母', '2024', '灰阶研究所'],
    ['赤陶火焰', 'Harlequin', 1540, '赤陶底与背线连贯性', '公', '2023', '林下实验室'],
    ['深林 Sable', 'Sable', 2360, '森林棕与高密度侧纹', '母', '2024', '雨林档案室'],
    ['象牙 Lily', 'Lily White', 3120, '象牙覆色与边界纯度', '公', '2024', '潮汐基因库'],
    ['银砾 Ax', 'Axanthic', 4280, '银灰颗粒感与火焰线', '母', '2023', '雾岛基因社'],
    ['苔痕 Harlequin', 'Harlequin', 1180, '橄榄底色与侧身纹理', '公', '2024', '山海爬舍'],
    ['沉香 Sable', 'Sable', 2680, '深棕层次与尾基状态', '母', '2023', '南岛爬舍'],
    ['雪幕 Lily', 'Lily White', 3360, '大面积覆色与肩部留白', '公', '2024', '海岛育种局'],
    ['霁灰 Ax', 'Axanthic', 4620, '灰阶纯度与红色素抑制', '母', '2024', '灰阶研究所'],
    ['琥珀侧线', 'Harlequin', 1760, '琥珀底色与侧线节奏', '公', '2023', '林下实验室'],
    ['玄岩 Sable', 'Sable', 2940, '玄色基底与背脊纵深', '母', '2024', '雾岛基因社']
  ];

  var bidderNames = ['雨林观察员', '海盐玩家', 'WNN·Kai', '岛屿收藏家', 'Luma', '南风', '灰阶档案', '椰林来客'];
  var proxyNames = ['雨林观察员', '海盐玩家', 'WNN·Kai', '岛屿收藏家'];
  var profileFallback = '睫角守宫拍品';

  function scheduleFor(index) {
    if (index === 0) return { start: -7200, end: 28800 };
    if (index < 12) return { start: -((index + 2) * 1670), end: 10400 + index * 2380 };
    if (index < 20) {
      var soonStart = (index - 11) * 1800 + 600;
      return { start: soonStart, end: soonStart + 12600 + (index - 12) * 1200 };
    }
    return { start: -((index - 14) * 86400 + 7200), end: -((index - 19) * 5300 + 1100) };
  }

  function makeInitialBids(price, increment, index) {
    var count = 5 + (index % 5);
    var rows = [];
    for (var i = count - 1; i >= 0; i -= 1) {
      var amount = Math.max(increment, price - i * increment);
      rows.push({
        bidder: bidderNames[(index + i) % bidderNames.length],
        amount: amount,
        at: nowAtLoad - ((count - i) * 7 + index) * 60000,
        proxy: i % 3 === 0
      });
    }
    return rows;
  }

  function createLots() {
    return lotSeeds.map(function (seed, index) {
      var schedule = scheduleFor(index);
      var increment = incrementFor(seed, index);
      var profile = geneProfiles[seed[1]];
      var snapshot = marketSnapshot(seed, index, increment);
      /* CHW is reserved for the launch lot. Keeping it out of the rotating
         archive pool prevents another lot's gallery from showing the purple
         launch image or inheriting its source label. */
      var image = index === 0 ? 'chw.jpeg' : imagePool[(index - 1) % imagePool.length];
      var gallery = index === 0
        ? ['chw.jpeg', 'commons-face.jpg', 'commons-back.jpg']
        : [image, imagePool[(index + 6) % imagePool.length], imagePool[(index + 14) % imagePool.length]];
      return {
        id: 'GX-' + String(101 + index),
        displayId: seed[1] === 'CHW' ? 'CHW-001' : 'GX-' + String(101 + index),
        title: seed[0],
        morph: seed[1],
        image: image,
        gallery: gallery,
        price: seed[2],
        increment: increment,
        deposit: 50,
        focus: seed[3],
        gender: seed[4],
        year: seed[5],
        seller: seed[6],
        sellerScore: (4.8 - (index % 4) * 0.1).toFixed(1),
        startsAt: nowAtLoad + schedule.start * 1000,
        endsAt: nowAtLoad + schedule.end * 1000,
        description: profile.description + ' 本场档案聚焦“' + seed[3] + '”，以正面、背部和侧身三个视角记录外观表现，便于竞买人在出价前建立完整判断。',
        tags: profile.tags.concat(index % 2 ? ['单只档案'] : ['繁育记录']),
        bids: makeInitialBids(seed[2], increment, index),
        marketLow: snapshot.low,
        marketHigh: snapshot.high,
        marketEstimate: snapshot.estimate,
        qualityScore: snapshot.quality,
        aiPressure: snapshot.pressure,
        aiStyle: snapshot.aiStyle,
        aiBudget: snapshot.aiBudget,
        aiResponses: 0,
        aiLastResponseAt: 0,
        aiTimer: null,
        botMax: snapshot.aiBudget,
        proxyMax: null,
        favorite: false
      };
    });
  }

  var lots = createLots();
  var appState = {
    balance: 2000,
    frozen: 0,
    deposits: {},
    depositStatuses: {},
    favorites: [],
    activity: [],
    orders: [],
    settled: {},
    version: 7
  };
  var activeLotId = 'GX-101';
  var pendingDepositLotId = null;
  var pendingBid = null;
  var activeView = 'all';
  var activeMorph = 'all';
  var searchQuery = '';
  var sortMode = 'ending';
  var visibleCount = 16;
  var activityExpanded = false;

  function readState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.version !== 7) return;
      appState.balance = Number(saved.balance) >= 0 ? Number(saved.balance) : 2000;
      appState.frozen = Number(saved.frozen) >= 0 ? Number(saved.frozen) : 0;
      appState.deposits = saved.deposits && typeof saved.deposits === 'object' ? saved.deposits : {};
      appState.depositStatuses = saved.depositStatuses && typeof saved.depositStatuses === 'object' ? saved.depositStatuses : {};
      /* Deposit policy is uniform across the market. Older saved sessions are
         normalized so a previous freeze can never leak into the new CHW drop.
         A missing status means the old flow treated the deposit as frozen, so
         resolve that default before correcting the available balance. */
      Object.keys(appState.deposits).forEach(function (lotId) {
        var previous = Number(appState.deposits[lotId]) || 50;
        var status = appState.depositStatuses[lotId] || 'frozen';
        appState.depositStatuses[lotId] = status;
        if (previous !== 50 && status === 'frozen') appState.balance += previous - 50;
        appState.deposits[lotId] = 50;
      });
      appState.balance = Math.max(0, appState.balance);
      appState.favorites = Array.isArray(saved.favorites) ? saved.favorites : [];
      if (Array.isArray(saved.activity)) appState.activity = saved.activity.slice(0, 50);
      appState.orders = Array.isArray(saved.orders) ? saved.orders.map(function (order) {
        var normalized = Object.assign({}, order);
        normalized.deposit = 50;
        return normalized;
      }) : [];
      appState.settled = saved.settled && typeof saved.settled === 'object' ? saved.settled : {};
      appState.frozen = Object.keys(appState.deposits).reduce(function (total, lotId) {
        return total + (appState.depositStatuses[lotId] === 'frozen' ? 50 : 0);
      }, 0);
      if (saved.lots && typeof saved.lots === 'object') {
        lots.forEach(function (lot) {
          var savedLot = saved.lots[lot.id];
          if (!savedLot) return;
          if (Number(savedLot.price) > 0) lot.price = Number(savedLot.price);
          /* Recompute the step from the restored price. CHW changes from
             ¥200 to ¥300 after ¥5,000; otherwise a refresh can show and
             accept the wrong next bid. */
          lot.increment = incrementForLot(lot);
          if (Array.isArray(savedLot.bids) && savedLot.bids.length) lot.bids = savedLot.bids;
          if (Number(savedLot.proxyMax) > 0) lot.proxyMax = Number(savedLot.proxyMax);
          if (savedLot.botMax) lot.botMax = Number(savedLot.botMax);
          if (Number(savedLot.aiBudget) > 0) lot.aiBudget = Number(savedLot.aiBudget);
          if (Number(savedLot.aiResponses) >= 0) lot.aiResponses = Number(savedLot.aiResponses);
          if (Number(savedLot.aiLastResponseAt) > 0) lot.aiLastResponseAt = Number(savedLot.aiLastResponseAt);
          if (Number(savedLot.startsAt) > 0) lot.startsAt = Number(savedLot.startsAt);
          if (Number(savedLot.endsAt) > 0) lot.endsAt = Number(savedLot.endsAt);
        });
      }
    } catch (error) {
      /* Private browsing and file:// pages can disable localStorage. */
    }
  }

  function writeState() {
    try {
      var lotState = {};
      lots.forEach(function (lot) {
        lotState[lot.id] = {
          price: lot.price,
          bids: lot.bids,
          proxyMax: lot.proxyMax,
          botMax: lot.botMax,
          aiBudget: lot.aiBudget,
          aiResponses: lot.aiResponses,
          aiLastResponseAt: lot.aiLastResponseAt,
          startsAt: lot.startsAt,
          endsAt: lot.endsAt
        };
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 7,
        balance: appState.balance,
        frozen: appState.frozen,
        deposits: appState.deposits,
        depositStatuses: appState.depositStatuses,
        favorites: appState.favorites,
        activity: appState.activity.slice(0, 50),
        orders: appState.orders,
        settled: appState.settled,
        lots: lotState
      }));
    } catch (error) {
      /* Keep the interaction usable even when persistence is unavailable. */
    }
  }

  function statusOf(lot, at) {
    var time = at || Date.now();
    if (time < lot.startsAt) return 'soon';
    if (time >= lot.endsAt) return 'ended';
    return 'live';
  }

  function statusLabel(status) {
    return status === 'live' ? '正在竞拍' : (status === 'soon' ? '即将开始' : '已结束');
  }

  function remainingText(lot, compact) {
    var status = statusOf(lot);
    var ms = status === 'soon' ? lot.startsAt - Date.now() : lot.endsAt - Date.now();
    if (status === 'ended') return '已截拍';
    var total = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    if (days > 0) return days + '天 ' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    var value = [hours, minutes, seconds].map(function (part) { return String(part).padStart(2, '0'); }).join(':');
    return compact ? value : (status === 'soon' ? '距开场 ' + value : '距结束 ' + value);
  }

  function addActivity(lot, bid, label) {
    appState.activity.unshift({
      lotId: lot.id,
      title: lot.title,
      bidder: bid.bidder,
      amount: bid.amount,
      at: bid.at || Date.now(),
      ai: !!bid.ai,
      label: label || (bid.proxy ? '自动代理' : '现场出价')
    });
    appState.activity = appState.activity.slice(0, 50);
  }

  function getLot(id) {
    return lots.find(function (lot) { return lot.id === id; }) || null;
  }

  function showToast(message) {
    var toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 4200);
  }

  /*
   * Local assets are always attempted first.  If a static host serves the
   * HTML but drops one image request, the same Commons file is retried through
   * several mainland-friendly mirrors before the styled text fallback appears.
   * The mirror list is deliberately bounded: a broken image can never create
   * an endless network loop.
   */
  /* Pin mirrors to the published source revision for deterministic cache
     behavior; the revision contains both the CHW launch image and archive. */
  var imageMirrorBases = [
    'https://cdn.jsdelivr.net/gh/leixianya/gecko-auction@f6d64b66e02629d14d79af84958b4ae879467545/assets/',
    'https://testingcf.jsdelivr.net/gh/leixianya/gecko-auction@f6d64b66e02629d14d79af84958b4ae879467545/assets/',
    'https://fastly.jsdelivr.net/gh/leixianya/gecko-auction@f6d64b66e02629d14d79af84958b4ae879467545/assets/',
    'https://gcore.jsdelivr.net/gh/leixianya/gecko-auction@f6d64b66e02629d14d79af84958b4ae879467545/assets/',
    'https://quantil.jsdelivr.net/gh/leixianya/gecko-auction@f6d64b66e02629d14d79af84958b4ae879467545/assets/',
    'https://raw.githubusercontent.com/leixianya/gecko-auction/f6d64b66e02629d14d79af84958b4ae879467545/assets/'
  ];
  var imageCandidates = typeof WeakMap === 'function' ? new WeakMap() : null;

  function imageFileName(src) {
    var clean = String(src || '').split('?')[0].split('#')[0];
    var marker = clean.lastIndexOf('/assets/');
    if (marker >= 0) clean = clean.slice(marker + 8);
    else clean = clean.split('/').pop();
    try { return decodeURIComponent(clean); } catch (error) { return clean; }
  }

  function candidatesFor(src) {
    var original = String(src || '');
    var file = imageFileName(original);
    var values = [original];
    if (file && /^(?:commons-[\w.-]+|chw[\w.-]*)$/i.test(file)) {
      imageMirrorBases.forEach(function (base) { values.push(base + encodeURIComponent(file)); });
    }
    return values.filter(function (value, index, all) { return value && all.indexOf(value) === index; });
  }

  function markImageFailed(image) {
    var frame = image && image.closest('[data-image-frame]');
    if (frame) {
      frame.setAttribute('data-fallback', image.alt || profileFallback);
      frame.classList.add('image-failed');
    }
    if (image) {
      image.dataset.imageState = 'error';
      /* Thumbnails do not have a full image frame; hide their broken glyph so
         a single unavailable angle never makes the gallery look damaged. */
      if (!frame) image.style.opacity = '0';
      else image.style.opacity = '';
    }
  }

  function tryNextImage(image) {
    if (!image) return;
    var state = imageCandidates && imageCandidates.get(image);
    if (!state) {
      state = { list: candidatesFor(image.getAttribute('src')), index: 0, exhausted: false };
      if (imageCandidates) imageCandidates.set(image, state);
    }
    state.index += 1;
    if (state.index >= state.list.length) {
      state.exhausted = true;
      markImageFailed(image);
      return;
    }
    image.dataset.imageState = 'recovering';
    image.style.opacity = '0';
    /* Cache-bust only mirror requests; this also prevents a stale 404 from a
       previous deploy being reused by an over-aggressive intermediary. */
    var next = state.list[state.index];
    image.src = next + (next.indexOf('?') >= 0 ? '&' : '?') + 'v=4';
  }

  function setImage(image, src, alt, fallback) {
    if (!image) return;
    wireImage(image);
    var frame = image.closest('[data-image-frame]');
    if (frame) {
      frame.classList.remove('image-failed');
      frame.setAttribute('data-fallback', fallback || profileFallback);
    }
    image.alt = alt || fallback || profileFallback;
    image.dataset.imageState = 'loading';
    image.style.opacity = '0';
    var state = { list: candidatesFor(src), index: 0, exhausted: false };
    if (imageCandidates) imageCandidates.set(image, state);
    image.src = state.list[0] || src;
  }

  function wireImage(image) {
    if (!image || image.dataset.fallbackWired === '1') return;
    image.dataset.fallbackWired = '1';
    image.addEventListener('load', function () {
      image.dataset.imageState = 'loaded';
      image.style.opacity = '';
      var frame = image.closest('[data-image-frame]');
      if (frame) frame.classList.remove('image-failed');
    });
    image.addEventListener('error', function () { tryNextImage(image); });
    if (image.complete && image.naturalWidth === 0) window.setTimeout(function () { tryNextImage(image); }, 0);
  }

  function statusCounts() {
    return lots.reduce(function (counts, lot) {
      counts[statusOf(lot)] += 1;
      return counts;
    }, { live: 0, soon: 0, ended: 0 });
  }

  function updateCounts() {
    var counts = statusCounts();
    var all = lots.length;
    var mapping = { all: all, live: counts.live, soon: counts.soon, ended: counts.ended };
    Object.keys(mapping).forEach(function (key) {
      var node = $('count-' + key);
      if (node) node.textContent = mapping[key];
    });
    queryAll('#status-tabs button').forEach(function (button) {
      var value = button.dataset.status;
      var span = button.querySelector('span');
      if (span) span.textContent = mapping[value] == null ? 0 : mapping[value];
    });
    queryAll('.morph-filter').forEach(function (button) {
      var morph = button.dataset.morph;
      var span = button.querySelector('span');
      if (!span) return;
      span.textContent = morph === 'all' ? all : lots.filter(function (lot) { return lot.morph === morph; }).length;
    });
  }

  function filteredLots() {
    var query = searchQuery.trim().toLowerCase();
    var result = lots.filter(function (lot) {
      var status = statusOf(lot);
      if (activeView !== 'all' && status !== activeView) return false;
      if (activeMorph !== 'all' && lot.morph !== activeMorph) return false;
      if (!query) return true;
      var haystack = [lot.id, lot.title, lot.morph, lot.seller, lot.focus, lot.description, lot.tags.join(' ')].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
    result.sort(function (a, b) {
      /* The launch lot leads the default ending view. Explicit price/newness
         sorts keep their literal ordering so the controls remain trustworthy. */
      if (sortMode === 'ending') {
        if (a.morph === 'CHW' && b.morph !== 'CHW') return -1;
        if (b.morph === 'CHW' && a.morph !== 'CHW') return 1;
      }
      if (sortMode === 'newest') return b.startsAt - a.startsAt;
      if (sortMode === 'price-low') return a.price - b.price;
      if (sortMode === 'price-high') return b.price - a.price;
      var aStatus = statusOf(a);
      var bStatus = statusOf(b);
      var statusRank = { live: 0, soon: 1, ended: 2 };
      if (statusRank[aStatus] !== statusRank[bStatus]) return statusRank[aStatus] - statusRank[bStatus];
      var aTime = aStatus === 'soon' ? a.startsAt : a.endsAt;
      var bTime = bStatus === 'soon' ? b.startsAt : b.endsAt;
      return aTime - bTime;
    });
    return result;
  }

  function cardMarkup(lot) {
    var status = statusOf(lot);
    var favorite = appState.favorites.indexOf(lot.id) !== -1;
    var source = assetUrl(lot.image);
    var isChw = lot.morph === 'CHW';
    return '<article class="lot-card' + (isChw ? ' lot-card-chw' : '') + '" data-lot-id="' + esc(lot.id) + '">' +
      '<div class="lot-card-image" data-image-frame data-fallback="' + esc(lot.title) + '">' +
        '<img src="' + esc(source) + '" alt="' + esc(lot.title + ' 睫角守宫') + '" loading="lazy" decoding="async" />' +
        '<div class="card-top"><span>' + esc(lot.displayId || (isChw ? 'CHW-001' : lot.id)) + '</span><span>' + esc(lot.morph) + '</span></div>' +
        '<div class="card-bottom"><span class="card-status ' + status + '">' + statusLabel(status) + '</span><button class="card-heart' + (favorite ? ' is-saved' : '') + '" type="button" data-favorite="' + esc(lot.id) + '" aria-label="' + (favorite ? '取消收藏' : '收藏拍品') + '">' + (favorite ? '♥' : '♡') + '</button></div>' +
      '</div>' +
      '<div class="lot-card-body"><h3>' + esc(lot.title) + '</h3><p class="lot-card-subtitle">' + esc(lot.focus) + '</p>' +
      '<div class="lot-tags">' + lot.tags.slice(0, 3).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + (isChw ? '<span class="ai-card-tag">AI 竞价</span>' : '') + '</div>' +
      '<div class="card-price-row"><div><small>当前价</small><strong>' + money(lot.price) + '</strong></div><div class="card-time"><small>' + (status === 'soon' ? '开场倒计时' : (status === 'ended' ? '成交状态' : '距结束')) + '</small><strong class="' + status + '" data-countdown="' + esc(lot.id) + '">' + remainingText(lot, true) + '</strong></div></div>' +
      '<button class="card-open" type="button" data-open-lot="' + esc(lot.id) + '"><span>查看拍品档案</span><span>↗</span></button></div></article>';
  }

  function renderLots() {
    var grid = $('lot-grid');
    if (!grid) return;
    var result = filteredLots();
    var visible = result.slice(0, visibleCount);
    grid.innerHTML = visible.length ? visible.map(cardMarkup).join('') : '<div class="empty-state">没有找到匹配的拍品。换一个关键词，或清除筛选后再看。</div>';
    queryAll('#lot-grid img').forEach(wireImage);
    var count = $('result-count');
    if (count) count.textContent = result.length + ' 件拍品';
    var loadMore = $('load-more');
    if (loadMore) {
      loadMore.hidden = visible.length >= result.length || result.length === 0;
      loadMore.textContent = visible.length >= result.length ? '已显示全部拍品' : '载入更多拍品 ↓';
    }
    updateCounts();
  }

  function renderFeatured() {
    /* CHW is the house drop and remains the hero even after its timer rolls
       over, so visitors can still inspect the complete archive and result. */
    var liveLot = getLot('GX-101') || lots.find(function (lot) { return statusOf(lot) === 'live'; }) || lots[0];
    if (!liveLot) return;
    var profile = geneProfiles[liveLot.morph];
    var image = $('featured-image');
    setImage(image, assetUrl(liveLot.image), liveLot.title + ' 睫角守宫', liveLot.title);
    wireImage(image);
    if ($('featured-lot-id')) $('featured-lot-id').textContent = liveLot.displayId || liveLot.id;
    if ($('featured-title')) $('featured-title').textContent = liveLot.title;
    if ($('featured-subtitle')) $('featured-subtitle').textContent = profile.label + ' · ' + liveLot.focus;
    if ($('featured-price')) $('featured-price').textContent = money(liveLot.price);
    if ($('featured-next')) $('featured-next').textContent = statusOf(liveLot) === 'live' ? '下一手 ' + money(liveLot.price + liveLot.increment) + ' 起' : '等待开场';
    if ($('featured-countdown')) $('featured-countdown').textContent = remainingText(liveLot, true);
    if ($('featured-timer-label')) $('featured-timer-label').textContent = statusOf(liveLot) === 'soon' ? '距开场' : (statusOf(liveLot) === 'ended' ? '状态' : '距结束');
    if ($('featured-increment')) $('featured-increment').textContent = '阶梯加价 ' + money(liveLot.increment);
    if ($('featured-bids')) $('featured-bids').textContent = liveLot.bids.length + ' 次出价';
    if ($('featured-deposit')) $('featured-deposit').textContent = money(liveLot.deposit);
    if ($('featured-chip')) {
      $('featured-chip').textContent = statusLabel(statusOf(liveLot));
      $('featured-chip').className = 'lot-chip ' + statusOf(liveLot);
    }
    if ($('featured-tags')) $('featured-tags').innerHTML = liveLot.tags.slice(0, 4).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '<span>' + esc(liveLot.gender) + '</span><span>' + esc(liveLot.year) + ' 年生</span>';
    var feature = $('featured-lot');
    if (feature) feature.dataset.lotId = liveLot.id;
    var featuredWatch = $('featured-watch');
    if (featuredWatch) {
      var saved = appState.favorites.indexOf(liveLot.id) !== -1;
      featuredWatch.classList.toggle('is-saved', saved);
      featuredWatch.textContent = saved ? '♥' : '♡';
      featuredWatch.setAttribute('aria-label', saved ? '取消收藏拍品' : '收藏拍品');
    }
    renderAiIndicators(liveLot);
  }

  function renderAiIndicators(lot) {
    if (!lot) return;
    var seats = lot.morph === 'CHW' ? 3 : 2;
    var featuredCount = $('featured-ai-count');
    if (featuredCount) featuredCount.textContent = seats + ' SEATS';
    var dockTitle = $('dock-title');
    var dockPrice = $('dock-price');
    var dockCountdown = $('dock-countdown');
    if (dockTitle) dockTitle.textContent = lot.title;
    if (dockPrice) dockPrice.textContent = money(lot.price);
    if (dockCountdown) dockCountdown.textContent = remainingText(lot, true);
  }

  /* The modal has its own AI console. It is intentionally separate from the
     hero/dock indicators because the hero keeps ticking while another lot's
     archive is open. */
  function renderModalAiIndicators(lot) {
    if (!lot) return;
    var budget = aiBudgetFor(lot);
    var low = Number(lot.marketLow || lot.price || 1);
    var high = Math.max(low, Number(lot.marketHigh || budget || low));
    var progress = clamp(((Number(lot.price || low) - low) / Math.max(1, high - low)) * 100, 7, 100);
    var seats = lot.morph === 'CHW' ? 3 : 2;
    var seatCount = $('ai-seat-count');
    if (seatCount) seatCount.textContent = String(seats);
    var meter = $('ai-progress-bar');
    if (meter) meter.style.width = progress + '%';
    var status = $('ai-status');
    if (status) {
      var responseCount = Number(lot.aiResponses || 0);
      status.textContent = lot.proxyMax
        ? '你的心理上限 ' + money(lot.proxyMax) + ' 已接入；AI 会在需要时逐手跟价。'
        : (responseCount ? '已完成 ' + responseCount + ' 次策略应价 · 当前预算上限 ' + money(budget) : '开启后，系统会以最小加价跟进，不超过你设定的心理上限。');
    }
  }

  function renderActivity() {
    var list = $('activity-list');
    if (!list) return;
    var entries = appState.activity.slice();
    if (!entries.length) {
      lots.forEach(function (lot) {
        lot.bids.slice(-2).forEach(function (bid) {
          entries.push({ lotId: lot.id, title: lot.title, bidder: bid.bidder, amount: bid.amount, at: bid.at, ai: !!bid.ai, label: bid.ai ? '策略应价' : (bid.proxy ? '自动代理' : '现场出价') });
        });
      });
      entries.sort(function (a, b) { return b.at - a.at; });
    }
    var limit = activityExpanded ? 12 : 6;
    list.innerHTML = entries.slice(0, limit).map(function (entry) {
      var initials = String(entry.bidder || '竞').slice(0, 2);
      var ago = Math.max(1, Math.floor((Date.now() - Number(entry.at || Date.now())) / 60000));
      var aiMark = entry.ai || entry.label === '策略应价' ? '<i class="ai-badge">AI</i>' : '';
      return '<div class="activity-item' + (aiMark ? ' is-ai' : '') + '"><span class="activity-avatar">' + esc(initials) + '</span><div class="activity-main"><strong>' + esc(entry.bidder) + ' ' + aiMark + '</strong><span>' + esc(entry.title) + ' · ' + esc(entry.label || '现场出价') + '</span></div><b class="activity-price">' + money(entry.amount) + '</b><small class="activity-time">' + (ago < 60 ? ago + ' 分钟前' : Math.floor(ago / 60) + ' 小时前') + '</small></div>';
    }).join('');
    var more = $('activity-more');
    if (more) more.textContent = activityExpanded ? '收起出价记录 ↑' : '查看全部出价记录 ↗';
  }

  function updateWallet() {
    var amount = money(appState.balance);
    var wallet = $('wallet-amount');
    var mobileWallet = $('mobile-wallet-amount');
    var modalAmount = $('wallet-modal-amount');
    var frozen = $('wallet-frozen');
    var depositBalance = $('deposit-balance');
    if (wallet) wallet.textContent = amount;
    if (mobileWallet) mobileWallet.textContent = amount;
    if (modalAmount) modalAmount.textContent = amount;
    if (frozen) frozen.textContent = money(appState.frozen);
    if (depositBalance) depositBalance.textContent = amount;
    var pendingRelease = Object.keys(appState.deposits).reduce(function (total, lotId) {
      return total + (appState.depositStatuses[lotId] === 'frozen' ? Number(appState.deposits[lotId]) || 0 : 0);
    }, 0);
    var orderCount = appState.orders.filter(function (order) { return order.status === '待付款'; }).length;
    var walletLines = queryAll('.wallet-lines b');
    if (walletLines[0]) walletLines[0].textContent = money(pendingRelease);
    if (walletLines[1]) walletLines[1].textContent = orderCount + ' 笔';
    renderWalletOrders();
  }

  function topBidFor(lot) {
    if (!lot || !lot.bids || !lot.bids.length) return null;
    return lot.bids.slice().sort(function (a, b) {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return Number(a.at || 0) - Number(b.at || 0);
    })[0];
  }

  function isCurrentUserBid(bid) {
    return !!bid && (bid.bidder === '你' || bid.bidder === '你（代理）');
  }

  function settleEndedLots() {
    var notices = [];
    lots.forEach(function (lot) {
      if (statusOf(lot) !== 'ended' || appState.settled[lot.id]) return;
      var deposit = Number(appState.deposits[lot.id]) || 0;
      var status = appState.depositStatuses[lot.id] || (deposit ? 'frozen' : 'none');
      var winner = topBidFor(lot);
      if (deposit && status === 'frozen') {
        appState.frozen = Math.max(0, appState.frozen - deposit);
        if (isCurrentUserBid(winner)) {
          appState.depositStatuses[lot.id] = 'order';
          if (!appState.orders.some(function (order) { return order.lotId === lot.id; })) {
            appState.orders.push({
              id: 'ORD-' + lot.id,
              lotId: lot.id,
              title: lot.title,
              amount: lot.price,
              deposit: deposit,
              status: '待付款',
              createdAt: Date.now()
            });
          }
          notices.push(lot.title + ' 已中拍，保证金转入待付款订单。');
        } else {
          appState.depositStatuses[lot.id] = 'released';
          appState.balance += deposit;
          notices.push(lot.title + ' 未中拍，保证金已释放回余额。');
        }
      }
      appState.settled[lot.id] = { status: appState.depositStatuses[lot.id] || 'none', at: Date.now() };
    });
    if (notices.length) {
      writeState();
      updateWallet();
      showToast(notices.length === 1 ? notices[0] : '有 ' + notices.length + ' 场拍品完成截拍结算，钱包状态已更新。');
    }
    return notices.length;
  }

  function renderWalletOrders() {
    var dialog = document.querySelector('.wallet-dialog');
    if (!dialog) return;
    var existing = dialog.querySelector('.wallet-order-list');
    var orders = appState.orders.filter(function (order) { return order.status === '待付款'; });
    if (!orders.length) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'wallet-order-list';
      var lines = dialog.querySelector('.wallet-lines');
      if (lines) lines.parentNode.insertBefore(existing, lines.nextSibling);
    }
    existing.innerHTML = '<p>待付款订单</p>' + orders.map(function (order) {
      return '<div><span>' + esc(order.id) + ' · ' + esc(order.title) + '</span><b>' + money(order.amount) + '</b><small>保证金 ' + money(order.deposit) + ' · 请在 24 小时内确认</small></div>';
    }).join('');
  }

  function openModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!queryAll('.modal-backdrop.is-open').length) document.body.classList.remove('modal-open');
  }

  function closeAllModals() {
    queryAll('.modal-backdrop.is-open').forEach(closeModal);
  }

  function updateModalBidControls(lot) {
    if (!lot) return;
    var status = statusOf(lot);
    var input = $('bid-input');
    var min = lot.price + lot.increment;
    if (input) {
      input.min = String(min);
      input.step = String(lot.increment);
      if (!input.value || Number(input.value) < min) input.value = String(min);
      input.disabled = status !== 'live';
    }
    var hint = $('bid-hint');
    if (hint) {
      var strategyHint = ' · 对手策略：' + (lot.aiStyle || '分层预算') + ' / 上限 ' + money(aiBudgetFor(lot));
      hint.textContent = status === 'live' ? '最低出价 ' + money(min) + ' · 每手加价 ' + money(lot.increment) + strategyHint : (status === 'soon' ? '拍品尚未开场，请在倒计时结束后出价' : '本场已截拍，等待订单结算');
    }
    var place = $('place-bid-button');
    if (place) {
      place.disabled = status !== 'live';
      place.innerHTML = status === 'live' ? '确认出价 <span>↗</span>' : statusLabel(status);
    }
    var depositButton = $('modal-deposit-button');
    if (depositButton) {
      var deposited = !!appState.deposits[lot.id];
      depositButton.textContent = deposited ? '保证金已冻结' : (status === 'live' ? '先冻结保证金' : (status === 'soon' ? '开场后冻结保证金' : '本场已截拍'));
      depositButton.disabled = deposited || status !== 'live';
      depositButton.style.opacity = depositButton.disabled ? '.62' : '';
    }
    var proxy = $('proxy-bid');
    if (proxy) proxy.checked = !!lot.proxyMax;
  }

  function renderHistory(lot) {
    var list = $('history-list');
    if (!list || !lot) return;
    var byBidder = {};
    lot.bids.forEach(function (bid) {
      if (!byBidder[bid.bidder] || bid.amount > byBidder[bid.bidder].amount) byBidder[bid.bidder] = bid;
    });
    var ranked = Object.keys(byBidder).map(function (name) { return byBidder[name]; }).sort(function (a, b) { return b.amount - a.amount || b.at - a.at; });
    list.innerHTML = ranked.slice(0, 10).map(function (bid, index) {
      var isMe = bid.bidder === '你' || bid.bidder === '你（代理）';
      var flag = bid.ai ? '策略应价' : (bid.proxy ? '代理' : (index === 0 ? '领先' : '出价'));
      var aiMark = bid.ai ? '<i class="ai-badge">AI</i>' : '';
      return '<div class="history-row' + (bid.ai ? ' is-ai' : '') + '"><span class="history-rank">' + String(index + 1).padStart(2, '0') + '</span><span class="history-name">' + esc(bid.bidder) + ' ' + aiMark + '<small>' + (isMe ? '当前账户' : (bid.ai ? '策略席位 · 信用 100' : '竞买人')) + '</small></span><span class="history-flag">' + esc(flag) + '</span><b class="history-amount">' + money(bid.amount) + '</b></div>';
    }).join('');
  }

  function renderModalSource(lot, file) {
    if (!lot) return;
    var currentFile = imageFileName(file || lot.image);
    var isChw = currentFile.toLowerCase() === 'chw.jpeg';
    var isPrimary = currentFile === imageFileName(lot.image);
    if ($('modal-image-label')) $('modal-image-label').textContent = isChw ? 'CHW / PURPLE LINE' : 'ARCHIVE ANGLE / COMMONS';
    if ($('modal-source')) $('modal-source').innerHTML = isChw
      ? '拍品主图：AI 生成视觉素材 · <a href="' + esc(assetUrl('ATTRIBUTIONS.md')) + '" target="_blank" rel="noreferrer">查看素材说明 ↗</a>'
      : (isPrimary ? '拍品图片档案：Wikimedia Commons · <a href="' + esc(assetUrl('ATTRIBUTIONS.md')) + '" target="_blank" rel="noreferrer">查看作者与许可信息 ↗</a>' : '角度资料图：Wikimedia Commons · <a href="' + esc(assetUrl('ATTRIBUTIONS.md')) + '" target="_blank" rel="noreferrer">查看作者与许可信息 ↗</a>');
  }

  /*
   * A small deterministic rival strategy makes a local auction feel alive
   * while keeping every decision traceable inside the page.  The
   * strategy uses the lot's page-local market band, quality score and a seeded
   * roll.  Every trigger is bounded by both a response budget and a cooldown,
   * so prices cannot run away or oscillate when a user double-clicks.
   */
  var aiConfig = {
    maxRoundsPerTrigger: 2,
    maxResponsesPerLot: 12,
    cooldownMs: 760,
    minDelayMs: 480,
    delayJitterMs: 560
  };

  function aiBudgetFor(lot) {
    var candidate = Number(lot.aiBudget || lot.botMax || 0);
    var ceiling = Number(lot.marketHigh || 0);
    if (ceiling > 0) candidate = Math.min(candidate || ceiling, ceiling);
    return candidate || ceiling || (lot.price + lot.increment);
  }

  function aiBidderFor(lot) {
    if (lot && lot.morph === 'CHW') return aiBidderNames[Number(lot.aiResponses || 0) % aiBidderNames.length];
    return proxyNames[hashNumber(lot.id + '|rival|' + Number(lot.aiResponses || 0)) % proxyNames.length];
  }

  function aiCanRespond(lot, triggerAmount, round) {
    if (!lot || statusOf(lot) !== 'live') return false;
    if (Number(lot.aiResponses || 0) >= aiConfig.maxResponsesPerLot) return false;
    var budget = aiBudgetFor(lot);
    if (lot.price >= budget) return false;
    /* The first reply is intentionally reliable so the interaction is
       discoverable during a live click-through; later replies use the seeded
       pressure curve below and may stop naturally. */
    if (Number(lot.aiResponses || 0) === 0 && Number(lot.price) + lot.increment <= budget) return true;
    var bandSpan = Math.max(1, Number(lot.marketHigh || budget) - Number(lot.marketLow || 0));
    var relativePrice = clamp((lot.price - Number(lot.marketLow || 0)) / bandSpan, 0, 1);
    var pressure = clamp(Number(lot.aiPressure || 0.56) + (Date.now() > lot.endsAt - 180000 ? 0.1 : 0), 0.18, 0.9);
    /* As the visible price approaches the top of its band, the rival becomes
       less willing to chase.  A quality score adds a modest premium rather
       than multiplying the price without a ceiling. */
    pressure -= Math.max(0, relativePrice - 0.62) * 0.42;
    pressure += (Number(lot.qualityScore || 0.7) - 0.7) * 0.16;
    var seed = lot.id + '|' + Math.round(Number(triggerAmount || lot.price)) + '|' + Number(lot.aiResponses || 0) + '|' + Number(round || 0);
    return hashUnit(seed) < clamp(pressure, 0.12, 0.88);
  }

  function refreshAfterAiBid(lot) {
    writeState();
    renderLots();
    renderFeatured();
    renderActivity();
    if ($('lot-modal') && $('lot-modal').classList.contains('is-open') && activeLotId === lot.id) {
      if ($('modal-price')) $('modal-price').textContent = money(lot.price);
      if ($('modal-bid-count')) $('modal-bid-count').textContent = lot.bids.length + ' 次出价';
      updateModalBidControls(lot);
      renderModalAiIndicators(lot);
      renderHistory(lot);
    }
  }

  function runAiResponse(lot, triggerAmount) {
    if (!lot || statusOf(lot) !== 'live') return;
    lot.aiTimer = null;
    var rounds = 0;
    var acted = false;
    var userProxyLimit = Number(lot.proxyMax || 0);
    while (rounds < aiConfig.maxRoundsPerTrigger && statusOf(lot) === 'live') {
      var top = topBidFor(lot);
      if (top && isCurrentUserBid(top)) {
        if (!aiCanRespond(lot, triggerAmount, rounds)) break;
        var budget = aiBudgetFor(lot);
        var amount = Math.min(budget, lot.price + lot.increment);
        if (amount <= lot.price) break;
        pushBid(lot, aiBidderFor(lot), amount, true, { ai: true, aiStyle: lot.aiStyle });
        acted = true;
        rounds += 1;
      } else if (top && top.bidder && userProxyLimit > lot.price) {
        /* A user's stored proxy ceiling answers one rival step at a time. */
        var userAmount = Math.min(userProxyLimit, lot.price + lot.increment);
        if (userAmount <= lot.price) break;
        pushBid(lot, '你（代理）', userAmount, true, { userProxy: true });
        acted = true;
        rounds += 1;
      } else {
        break;
      }
    }
    if (acted) {
      var topAfter = topBidFor(lot);
      var leadText = topAfter && isCurrentUserBid(topAfter) ? '你暂时领先' : '对手策略已应价';
      showToast(lot.aiStyle + '对手策略：' + leadText + ' · 当前价 ' + money(lot.price));
      refreshAfterAiBid(lot);
    }
  }

  function queueAiResponse(lot, triggerAmount) {
    if (!lot || statusOf(lot) !== 'live') return;
    if (lot.aiTimer) window.clearTimeout(lot.aiTimer);
    var sinceLast = Date.now() - Number(lot.aiLastResponseAt || 0);
    var wait = Math.max(0, aiConfig.cooldownMs - sinceLast);
    wait += aiConfig.minDelayMs + Math.floor(hashUnit(lot.id + '|' + lot.bids.length) * aiConfig.delayJitterMs);
    lot.aiTimer = window.setTimeout(function () { runAiResponse(lot, triggerAmount); }, wait);
  }

  function openLot(id) {
    var lot = getLot(id);
    if (!lot) return;
    activeLotId = id;
    var profile = geneProfiles[lot.morph];
    var modalImage = $('modal-image');
    setImage(modalImage, assetUrl(lot.image), lot.title + ' 睫角守宫', lot.title);
    wireImage(modalImage);
    if ($('modal-id')) $('modal-id').textContent = lot.displayId || lot.id;
    if ($('modal-title')) $('modal-title').textContent = lot.title;
    if ($('modal-subtitle')) $('modal-subtitle').textContent = profile.subtitle + ' · ' + lot.focus;
    if ($('modal-description')) {
      $('modal-description').textContent = lot.description + ' 页面价带：' + money(lot.marketLow) + '–' + money(lot.marketHigh) + '；档案评分 ' + Math.round(Number(lot.qualityScore || 0.7) * 100) + ' / 100。';
    }
    if ($('modal-price')) $('modal-price').textContent = money(lot.price);
    if ($('modal-bid-count')) $('modal-bid-count').textContent = lot.bids.length + ' 次出价';
    if ($('modal-status')) {
      $('modal-status').textContent = statusLabel(statusOf(lot));
      $('modal-status').className = 'status-badge ' + statusOf(lot);
    }
    renderModalSource(lot, lot.image);
    if ($('modal-attributes')) {
      $('modal-attributes').innerHTML = [
        ['基因方向', profile.label], ['性别', lot.gender], ['出生年份', lot.year],
        ['卖家', lot.seller], ['卖家评分', lot.sellerScore + ' / 5.0'], ['加价幅度', money(lot.increment)],
        ['保证金', money(lot.deposit)], ['运输方式', '专线冷暖箱'], ['档案编号', lot.id],
        ['同类价带', money(lot.marketLow) + '–' + money(lot.marketHigh)],
        ['页面估值', money(lot.marketEstimate)], ['档案评分', Math.round(Number(lot.qualityScore || 0.7) * 100) + ' / 100'],
        ['应价风格', lot.aiStyle + ' · 上限 ' + money(lot.aiBudget)]
      ].map(function (pair) { return '<div class="attribute-cell"><small>' + esc(pair[0]) + '</small><strong>' + esc(pair[1]) + '</strong></div>'; }).join('');
    }
    var thumbs = $('modal-thumbs');
    if (thumbs) {
      thumbs.innerHTML = lot.gallery.map(function (file, index) {
        return '<button class="modal-thumb' + (index === 0 ? ' is-active' : '') + '" type="button" data-thumb="' + esc(assetUrl(file)) + '" data-alt="' + esc(lot.title + ' 角度 ' + (index + 1)) + '"><img src="' + esc(assetUrl(file)) + '" alt="' + esc(lot.title + ' 角度 ' + (index + 1)) + '" loading="lazy" /></button>';
      }).join('');
      queryAll('.modal-thumb img', thumbs).forEach(wireImage);
    }
    updateModalBidControls(lot);
    renderModalAiIndicators(lot);
    renderHistory(lot);
    openModal('lot-modal');
    window.setTimeout(function () { if ($('bid-input') && statusOf(lot) === 'live') $('bid-input').focus(); }, 260);
  }

  function openDeposit(id) {
    var lot = getLot(id || activeLotId);
    if (!lot) return;
    if (statusOf(lot) !== 'live') {
      showToast(statusOf(lot) === 'soon' ? '本场尚未开场，开场后即可冻结保证金。' : '本场已经截拍，保证金入口已关闭。');
      return;
    }
    if (appState.deposits[lot.id]) {
      showToast('本场保证金已冻结，可以直接出价。');
      return;
    }
    if (appState.balance < lot.deposit) {
      showToast('可用余额不足，请先在钱包中补充账户额度。');
      return;
    }
    pendingDepositLotId = lot.id;
    if ($('deposit-amount')) $('deposit-amount').textContent = money(lot.deposit);
    if ($('deposit-balance')) $('deposit-balance').textContent = money(appState.balance);
    if ($('deposit-consent')) $('deposit-consent').checked = false;
    openModal('deposit-modal');
  }

  function confirmDeposit() {
    var lot = getLot(pendingDepositLotId || activeLotId);
    var consent = $('deposit-consent');
    if (!lot) return;
    if (statusOf(lot) !== 'live') {
      closeModal($('deposit-modal'));
      showToast(statusOf(lot) === 'soon' ? '本场尚未开场，保证金暂未冻结。' : '本场已经截拍，保证金暂未冻结。');
      pendingBid = null;
      return;
    }
    if (!consent || !consent.checked) {
      showToast('请先阅读并勾选竞拍须知。');
      return;
    }
    if (appState.deposits[lot.id]) {
      closeModal($('deposit-modal'));
      return;
    }
    if (appState.balance < lot.deposit) {
      showToast('可用余额不足。');
      return;
    }
    appState.balance -= lot.deposit;
    appState.frozen += lot.deposit;
    appState.deposits[lot.id] = lot.deposit;
    appState.depositStatuses[lot.id] = 'frozen';
    writeState();
    updateWallet();
    closeModal($('deposit-modal'));
    updateModalBidControls(lot);
    var queuedBid = pendingBid && pendingBid.lotId === lot.id ? pendingBid : null;
    pendingBid = null;
    if (queuedBid) {
      var queuedInput = $('bid-input');
      if (queuedInput) queuedInput.value = String(queuedBid.amount);
      var queuedProxy = $('proxy-bid');
      if (queuedProxy) queuedProxy.checked = !!queuedBid.proxy;
      showToast(lot.id + ' 保证金已冻结，正在提交你的出价…');
      window.setTimeout(function () {
        if (statusOf(lot) === 'live') placeBid();
      }, 90);
    } else {
      showToast(lot.id + ' 保证金 ' + money(lot.deposit) + ' 已冻结，下一步可以确认出价。');
    }
  }

  function pushBid(lot, bidder, amount, proxy, meta) {
    var bid = { bidder: bidder, amount: amount, at: Date.now(), proxy: !!proxy };
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach(function (key) { bid[key] = meta[key]; });
    }
    lot.bids.push(bid);
    lot.price = amount;
    lot.increment = incrementForLot(lot);
    if (statusOf(lot) === 'live' && lot.endsAt - bid.at <= 120000) {
      lot.endsAt += 120000;
      lot.auctionExtensions = Number(lot.auctionExtensions || 0) + 1;
      bid.extended = true;
    }
    if (bid.ai) {
      lot.aiResponses = Number(lot.aiResponses || 0) + 1;
      lot.aiLastResponseAt = bid.at;
    }
    addActivity(lot, bid, bid.ai ? '策略应价' : (proxy ? '自动代理' : '现场出价'));
    return bid;
  }

  function placeProxyBid(lot, maximum) {
    var minimum = lot.price + lot.increment;
    lot.proxyMax = maximum;
    var botLimit = lot.botMax || (maximum + lot.increment);
    var visible = minimum;
    var userBid = pushBid(lot, '你（代理）', visible, true);
    if (botLimit >= maximum + lot.increment) {
      var counter = Math.min(maximum + lot.increment, botLimit);
      if (counter > maximum) counter = maximum + lot.increment;
      pushBid(lot, aiBidderFor(lot), counter, true, { ai: true, aiStyle: lot.aiStyle });
      showToast('代理上限已设为 ' + money(maximum) + '，对手代理暂时领先。');
      return userBid;
    }
    if (botLimit > visible) {
      var botBid = Math.min(botLimit, maximum - lot.increment);
      if (botBid > visible) {
        pushBid(lot, aiBidderFor(lot), botBid, true, { ai: true, aiStyle: lot.aiStyle });
        visible = botBid;
      }
      if (maximum > visible) pushBid(lot, '你（代理）', Math.min(maximum, visible + lot.increment), true);
    }
    showToast('代理上限已设为 ' + money(maximum) + '，系统会按最小加价自动跟进。');
    return userBid;
  }

  function placeBid() {
    var lot = getLot(activeLotId);
    if (!lot) return;
    var status = statusOf(lot);
    if (status !== 'live') {
      showToast(status === 'soon' ? '本场尚未开场，请稍后再来。' : '本场已经截拍，无法继续出价。');
      return;
    }
    var input = $('bid-input');
    var minimum = lot.price + lot.increment;
    var amount = Math.round(Number(input && input.value) || minimum);
    if (amount < minimum) {
      amount = minimum;
      if (input) input.value = String(amount);
      showToast('出价已调整为最低加价 ' + money(amount) + '。');
      return;
    }
    if ((amount - lot.price) % lot.increment !== 0) {
      amount = lot.price + Math.ceil((amount - lot.price) / lot.increment) * lot.increment;
      if (input) input.value = String(amount);
    }
    var proxy = $('proxy-bid') && $('proxy-bid').checked;
    if (!appState.deposits[lot.id]) {
      pendingBid = { lotId: lot.id, amount: amount, proxy: !!proxy };
      openDeposit(lot.id);
      return;
    }
    if (proxy) placeProxyBid(lot, amount);
    else {
      lot.proxyMax = null;
      var placedBid = pushBid(lot, '你', amount, false);
      showToast('出价成功，你以 ' + money(amount) + ' 暂时领先。' + (placedBid.extended ? ' 截拍顺延 2 分钟。' : ''));
    }
    writeState();
    renderLots();
    renderFeatured();
    renderActivity();
    updateModalBidControls(lot);
    renderHistory(lot);
    if ($('modal-price')) $('modal-price').textContent = money(lot.price);
    if ($('modal-bid-count')) $('modal-bid-count').textContent = lot.bids.length + ' 次出价';
    queueAiResponse(lot, amount);
  }

  function toggleFavorite(id) {
    var index = appState.favorites.indexOf(id);
    if (index === -1) {
      appState.favorites.push(id);
      showToast('已收藏这只拍品。');
    } else {
      appState.favorites.splice(index, 1);
      showToast('已取消收藏。');
    }
    writeState();
    renderLots();
    var featured = $('featured-lot');
    if (featured && featured.dataset.lotId === id && $('featured-watch')) {
      var saved = appState.favorites.indexOf(id) !== -1;
      $('featured-watch').classList.toggle('is-saved', saved);
      $('featured-watch').textContent = saved ? '♥' : '♡';
    }
  }

  function syncFilterButtons() {
    queryAll('.side-filter').forEach(function (button) { button.classList.toggle('is-active', button.dataset.view === activeView); });
    queryAll('.morph-filter').forEach(function (button) { button.classList.toggle('is-active', button.dataset.morph === activeMorph); });
    queryAll('#status-tabs button').forEach(function (button) {
      var active = button.dataset.status === activeView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function refreshMarket() {
    visibleCount = 16;
    renderLots();
    renderFeatured();
    renderActivity();
    showToast('市场数据已刷新，倒计时与出价记录已同步。');
  }

  /* On a narrow screen the fixed shortcut rail should not cover the CHW
     title, price or primary action while the first card is being read. The
     hero button remains available; the rail fades in once the list is near
     the viewport and then stays available for quick bidding. */
  function bindDockVisibility() {
    var dock = $('auction-dock');
    if (!dock || !window.matchMedia) return;
    var media = window.matchMedia('(max-width: 620px)');
    var ticking = false;
    var sync = function () {
      var mobile = media.matches;
      var hero = $('featured-lot');
      var heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : 0;
      var revealAt = heroBottom ? Math.max(420, heroBottom - window.innerHeight * 0.35) : 420;
      var hidden = mobile && window.scrollY < revealAt;
      dock.classList.toggle('is-collapsed', hidden);
      dock.setAttribute('aria-hidden', String(hidden));
      var dockBid = $('dock-bid');
      if (dockBid) dockBid.tabIndex = hidden ? -1 : 0;
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; sync(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sync);
    if (media.addEventListener) media.addEventListener('change', sync);
    else if (media.addListener) media.addListener(sync);
    sync();
  }

  function bindEvents() {
    var search = $('search-input');
    if (search) search.addEventListener('input', function () { searchQuery = search.value; visibleCount = 16; renderLots(); });
    var sort = $('sort-select');
    if (sort) sort.addEventListener('change', function () { sortMode = sort.value; visibleCount = 16; renderLots(); });
    queryAll('.side-filter').forEach(function (button) { button.addEventListener('click', function () { activeView = button.dataset.view; syncFilterButtons(); visibleCount = 16; renderLots(); }); });
    queryAll('.morph-filter').forEach(function (button) { button.addEventListener('click', function () { activeMorph = button.dataset.morph; syncFilterButtons(); visibleCount = 16; renderLots(); }); });
    queryAll('#status-tabs button').forEach(function (button) { button.addEventListener('click', function () { activeView = button.dataset.status; syncFilterButtons(); visibleCount = 16; renderLots(); }); });
    var loadMore = $('load-more');
    if (loadMore) loadMore.addEventListener('click', function () { visibleCount += 16; renderLots(); });
    var refresh = $('refresh-button');
    if (refresh) refresh.addEventListener('click', refreshMarket);
    var featuredBid = $('featured-bid');
    if (featuredBid) featuredBid.addEventListener('click', function () { openLot(($('featured-lot') && $('featured-lot').dataset.lotId) || 'GX-101'); });
    var featuredDetail = $('featured-detail-button');
    if (featuredDetail) featuredDetail.addEventListener('click', function () { openLot(($('featured-lot') && $('featured-lot').dataset.lotId) || 'GX-101'); });
    var featuredRule = $('featured-rule-button');
    if (featuredRule) featuredRule.addEventListener('click', function () { openModal('rules-modal'); });
    var featuredWatch = $('featured-watch');
    if (featuredWatch) featuredWatch.addEventListener('click', function () { toggleFavorite(($('featured-lot') && $('featured-lot').dataset.lotId) || 'GX-101'); });
    var depositButton = $('modal-deposit-button');
    if (depositButton) depositButton.addEventListener('click', function () { openDeposit(activeLotId); });
    var confirm = $('confirm-deposit');
    if (confirm) confirm.addEventListener('click', confirmDeposit);
    var place = $('place-bid-button');
    if (place) place.addEventListener('click', placeBid);
    var dockBid = $('dock-bid');
    if (dockBid) dockBid.addEventListener('click', function () { openLot(($('featured-lot') && $('featured-lot').dataset.lotId) || 'GX-101'); });
    var bottomRules = $('bottom-rules');
    if (bottomRules) bottomRules.addEventListener('click', function () { openModal('rules-modal'); });
    var bottomWallet = $('bottom-wallet');
    if (bottomWallet) bottomWallet.addEventListener('click', function () { updateWallet(); openModal('wallet-modal'); });
    var bidInput = $('bid-input');
    var adjustBid = function (delta) {
      var lot = getLot(activeLotId);
      if (!lot || !bidInput) return;
      var minimum = lot.price + lot.increment;
      var current = Number(bidInput.value) || minimum;
      bidInput.value = String(Math.max(minimum, current + delta * lot.increment));
    };
    var minus = $('bid-minus');
    var plus = $('bid-plus');
    if (minus) minus.addEventListener('click', function () { adjustBid(-1); });
    if (plus) plus.addEventListener('click', function () { adjustBid(1); });
    if (bidInput) bidInput.addEventListener('keydown', function (event) { if (event.key === 'Enter') placeBid(); });
    var proxyHelp = $('proxy-help');
    if (proxyHelp) proxyHelp.addEventListener('click', function () { showToast('自动代理会把你输入的金额作为心理最高价，只在需要时按最小加价跟进。'); });
    var seller = $('seller-button');
    if (seller) seller.addEventListener('click', function () { var lot = getLot(activeLotId); if (lot) showToast(lot.seller + ' · 综合评分 ' + lot.sellerScore + ' / 5.0 · 资料已收录'); });
    var share = $('share-button');
    if (share) share.addEventListener('click', function () {
      var lot = getLot(activeLotId);
      var text = lot ? '来看看「' + lot.title + '」· ' + lot.id : '睫角守宫竞拍档案';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(window.location.href.split('#')[0] + '#' + (lot ? lot.id : 'lots')).then(function () { showToast(text + '链接已复制。'); }).catch(function () { showToast(text + '已准备分享。'); });
      else showToast(text + '已准备分享。');
    });
    var activityMore = $('activity-more');
    if (activityMore) activityMore.addEventListener('click', function () { activityExpanded = !activityExpanded; renderActivity(); });
    $('open-rules') && $('open-rules').addEventListener('click', function () { openModal('rules-modal'); });
    $('side-rules') && $('side-rules').addEventListener('click', function () { openModal('rules-modal'); });
    $('guide-rules') && $('guide-rules').addEventListener('click', function () { openModal('rules-modal'); });
    $('wallet-button') && $('wallet-button').addEventListener('click', function () { updateWallet(); openModal('wallet-modal'); });
    $('profile-button') && $('profile-button').addEventListener('click', function () { updateWallet(); openModal('wallet-modal'); });
    queryAll('.modal-backdrop').forEach(function (backdrop) {
      backdrop.addEventListener('click', function (event) { if (event.target === backdrop) closeModal(backdrop); });
    });
    queryAll('[data-close-modal]').forEach(function (button) { button.addEventListener('click', function () { closeModal(button.closest('.modal-backdrop')); }); });
    var menu = $('mobile-menu');
    var mobilePanel = $('mobile-panel');
    function toggleMobileMenu() {
      if (!menu || !mobilePanel) return;
      var open = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
      mobilePanel.classList.toggle('is-open', !open);
      mobilePanel.setAttribute('aria-hidden', String(open));
      document.body.classList.toggle('menu-open', !open);
    }
    if (menu) menu.addEventListener('click', toggleMobileMenu);
    if (mobilePanel) mobilePanel.addEventListener('click', function (event) {
      var action = event.target.closest('[data-mobile-action]');
      if (action) { toggleMobileMenu(); if (action.dataset.mobileAction === 'rules') openModal('rules-modal'); else openModal('wallet-modal'); }
      if (event.target.closest('a')) toggleMobileMenu();
    });
    document.addEventListener('click', function (event) {
      var openButton = event.target.closest('[data-open-lot]');
      if (openButton) { event.preventDefault(); openLot(openButton.dataset.openLot); return; }
      var favorite = event.target.closest('[data-favorite]');
      if (favorite) { event.preventDefault(); event.stopPropagation(); toggleFavorite(favorite.dataset.favorite); return; }
      var thumb = event.target.closest('[data-thumb]');
      if (thumb) {
        var modalImage = $('modal-image');
        setImage(modalImage, thumb.dataset.thumb, thumb.dataset.alt, thumb.dataset.alt);
        queryAll('.modal-thumb').forEach(function (item) { item.classList.toggle('is-active', item === thumb); });
        renderModalSource(getLot(activeLotId), thumb.dataset.thumb);
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeAllModals(); if (menu && menu.getAttribute('aria-expanded') === 'true') toggleMobileMenu(); }
      if (event.key === '/' && document.activeElement !== search && !event.metaKey && !event.ctrlKey) { event.preventDefault(); if (search) search.focus(); }
    });
  }

  function updateCountdowns() {
    settleEndedLots();
    queryAll('[data-countdown]').forEach(function (node) {
      var lot = getLot(node.dataset.countdown);
      if (lot) node.textContent = remainingText(lot, true);
    });
    var featuredId = $('featured-lot') && $('featured-lot').dataset.lotId;
    var featuredLot = getLot(featuredId);
    if (featuredLot && $('featured-countdown')) $('featured-countdown').textContent = remainingText(featuredLot, true);
    if (featuredLot) {
      renderAiIndicators(featuredLot);
      if ($('dock-countdown')) $('dock-countdown').textContent = remainingText(featuredLot, true);
      if ($('dock-price')) $('dock-price').textContent = money(featuredLot.price);
    }
    var modalLot = getLot(activeLotId);
    if (modalLot && $('lot-modal') && $('lot-modal').classList.contains('is-open')) {
      if ($('modal-status')) { $('modal-status').textContent = statusLabel(statusOf(modalLot)); $('modal-status').className = 'status-badge ' + statusOf(modalLot); }
      updateModalBidControls(modalLot);
      renderModalAiIndicators(modalLot);
    }
    var previousState = window.__auctionLastStatus || '';
    var stateSignature = lots.map(function (lot) { return lot.id + ':' + statusOf(lot); }).join('|');
    if (previousState && previousState !== stateSignature) { renderLots(); renderFeatured(); updateCounts(); }
    window.__auctionLastStatus = stateSignature;
  }

  function init() {
    /* Guard against a host injecting the bundle twice (or a test harness
       dispatching DOMContentLoaded manually).  Duplicate listeners would make
       a single click appear to toggle twice. */
    if (window.__geckoAuctionInitialized) return;
    window.__geckoAuctionInitialized = true;
    readState();
    /* Resolve already-finished lots before the first wallet render. */
    settleEndedLots();
    bindEvents();
    syncFilterButtons();
    renderLots();
    renderFeatured();
    renderActivity();
    bindDockVisibility();
    updateWallet();
    updateCountdowns();
    countdownTimer = window.setInterval(updateCountdowns, 1000);
    window.addEventListener('beforeunload', writeState);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
