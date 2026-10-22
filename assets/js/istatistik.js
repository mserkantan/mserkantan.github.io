// İstatistik paneli (/istatistik/): GoatCounter API'den canlı veri çeker.
// API anahtarı sadece bu tarayıcıda durur (localStorage/sessionStorage "gc-anahtar"); repoya girmez.
// Event'ler assets/js/analytics.js'ten gelir: aktif/<platform>, donus/<ilk|2|3|4+>, ziyaretci/<id>.
(function () {
  'use strict';

  var BASE = 'https://mserkantan.goatcounter.com/api/v0';
  var KEY_NAME = 'gc-anahtar', RANGE_NAME = 'gc-aralik', FILTER_NAME = 'gc-filtre';
  var TR_ZONE = 'Europe/Istanbul', SITE_START = '2026-10-01';
  var PLATFORMS = [['android', 'Android telefon/tablet'], ['ios', 'iPhone / iPad'], ['windows', 'Windows bilgisayar'], ['mac', 'Mac'], ['linux', 'Linux'], ['diger', 'Diğer']];
  var PLATFORM_SHORT = { android: 'Android', ios: 'iPhone/iPad', windows: 'Windows', mac: 'Mac', linux: 'Linux', diger: 'diğer cihazlar' };
  var RETURNS = [['ilk', 'İlk geliş'], ['2', '2. geliş'], ['3', '3. geliş'], ['4+', '4 ve üstü']];
  var WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  var WD_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  var SIZES = {
    'phones': 'Telefon', 'large phones, small tablets': 'Büyük telefon / küçük tablet',
    'tablets and small laptops': 'Tablet / küçük dizüstü', 'computer monitors': 'Bilgisayar ekranı',
    'computer monitors larger than hd': 'Büyük (HD üstü) ekran', '(unknown)': 'Bilinmiyor'
  };
  var BREAKDOWNS = [
    { page: 'locations', box: 'bLocations', detail: true },
    { page: 'toprefs', box: 'bRefs', detail: true },
    { page: 'browsers', box: 'bBrowsers', detail: true },
    { page: 'systems', box: 'bSystems', detail: true },
    { page: 'sizes', box: 'bSizes', detail: true },
    { page: 'languages', box: 'bLanguages', detail: false },
    { page: 'campaigns', box: 'bCampaigns', detail: true }
  ];
  var VISITOR_ROWS = 25, STRIP_DAYS = 30, AUTO_MS = 5 * 60 * 1000;

  var $ = function (id) { return document.getElementById(id); };
  var key = '', range = '7', custom = null, filter = 'real', shift = null;
  var loading = false, lastLoad = 0, loadId = 0, allVisitors = false, data = null;

  // --- Depolama ---
  function storeGet(name) {
    try { return localStorage.getItem(name) || sessionStorage.getItem(name) || ''; } catch (e) { return ''; }
  }
  function storeSet(name, value, remember) {
    try { (remember === false ? sessionStorage : localStorage).setItem(name, value); } catch (e) {}
  }
  function forgetKey() {
    try { localStorage.removeItem(KEY_NAME); sessionStorage.removeItem(KEY_NAME); } catch (e) {}
  }

  // --- API ---
  var lastCall = 0;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fail(code, status) { var e = new Error(code); e.code = code; e.status = status; return e; }

  async function api(path, params) {
    var url = new URL(BASE + path);
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== '') url.searchParams.set(k, params[k]);
    });
    for (var attempt = 0; attempt < 4; attempt++) {
      var gap = 300 - (Date.now() - lastCall);
      if (gap > 0) await wait(gap);
      lastCall = Date.now();
      var res;
      try {
        res = await fetch(url, { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
      } catch (e) {
        throw fail('network');
      }
      if (res.status === 429) { await wait(1200 * (attempt + 1)); continue; }
      if (res.status === 401 || res.status === 403) throw fail('auth', res.status);
      if (!res.ok) throw fail('http', res.status);
      return res.json();
    }
    throw fail('rate');
  }

  // --- Zaman ---
  function offsetMin(zone, date) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
      var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
      return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
    } catch (e) {
      return 0;
    }
  }
  function trDay(date) { return new Date(date.getTime() + offsetMin(TR_ZONE, date) * 60000).toISOString().slice(0, 10); }
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function dayList(first, last) {
    var out = [];
    for (var d = first; d <= last; d = addDays(d, 1)) out.push(d);
    return out;
  }
  function weekday(day) { return (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; } // 0 = Pazartesi
  var fmtShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var fmtLong = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  var fmtTime = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
  var fmtNum = new Intl.NumberFormat('tr-TR');
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['tr'], { type: 'region' }); } catch (e) {}
  var langNames = null;
  try { langNames = new Intl.DisplayNames(['tr'], { type: 'language' }); } catch (e) {}
  function dayShort(d) { return fmtShort.format(new Date(d + 'T12:00:00Z')); }
  function dayLong(d) { return fmtLong.format(new Date(d + 'T12:00:00Z')); }
  function num(n) { return fmtNum.format(n || 0); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function hh(h) { return String(h).padStart(2, '0'); }
  // "%66’sı", "%25’i", "%34’ü": yüzdeyi okunuşuna göre iyelik ekiyle yazar
  function pctPoss(n) {
    var ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
    var tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
    var word = n === 0 ? 'sıfır' : n === 100 ? 'yüz' : (ones[n % 10] || tens[Math.floor(n / 10) % 10]);
    var vowels = word.match(/[aeıioöuü]/g), last = vowels[vowels.length - 1];
    var v = { a: 'ı', 'ı': 'ı', e: 'i', i: 'i', o: 'u', u: 'u', 'ö': 'ü', 'ü': 'ü' }[last];
    return '%' + n + '’' + (/[aeıioöuü]$/.test(word) ? 's' : '') + v;
  }
  function iso(ms) { return new Date(ms).toISOString().replace('.000Z', 'Z'); }

  function period() {
    var now = new Date(), today = trDay(now), first, last = today;
    if (range === 'custom' && custom) {
      first = custom.first;
      last = custom.last > today ? today : custom.last;
    } else if (range === 'all') first = SITE_START;
    else if (range === 'month') first = today.slice(0, 8) + '01';
    else first = addDays(today, -(+range - 1));
    if (first < SITE_START) first = SITE_START;
    if (first > last) first = last;
    var off = offsetMin(TR_ZONE, now) * 60000;
    var startMs = Date.parse(first + 'T00:00:00Z') - off;
    var endMs = Math.min(Math.ceil(now.getTime() / 3600000) * 3600000, Date.parse(addDays(last, 1) + 'T00:00:00Z') - off);
    var days = dayList(first, last), span = days.length * 864e5;
    return {
      first: first, last: last, days: days, start: iso(startMs), end: iso(endMs),
      prevStart: iso(startMs - span), prevEnd: iso(endMs - span),
      hasPrev: range !== 'all' && startMs - span >= Date.parse(SITE_START + 'T00:00:00Z') - off
    };
  }
  function rangeText(p) {
    if (range === '1') return 'Bugün';
    if (range === '7') return 'Son 7 günde';
    if (range === '30') return 'Son 30 günde';
    if (range === 'month') return 'Bu ay';
    if (range === 'all') return 'Site açıldığından beri';
    return p.first === p.last ? dayShort(p.first) + ' günü' : dayShort(p.first) + ' – ' + dayShort(p.last) + ' arasında';
  }
  function prevText(p) {
    if (range === '1') return 'dünün aynı saatine göre';
    return 'önceki ' + p.days.length + ' güne göre';
  }

  // GoatCounter saatlik veriyi hesap ayarındaki saat diliminde verir; Türkiye saatine kaydırmak için fark.
  async function loadShift() {
    var zone = 'UTC';
    try {
      var me = await api('/me');
      var tz = me && me.user && me.user.settings && me.user.settings.timezone;
      var z = typeof tz === 'string' ? tz : (tz && tz.Zone) || '';
      var dot = z.indexOf('.'), slash = z.indexOf('/');
      if (dot > -1 && slash > dot) z = z.slice(dot + 1);
      if (z) zone = z;
    } catch (e) {}
    var now = new Date();
    shift = Math.round((offsetMin(TR_ZONE, now) - offsetMin(zone, now)) / 60);
  }

  // stats: [{day, hourly[24], daily}] → Türkiye saatine göre [{day, hour, n}]
  function hourList(stats) {
    var out = [];
    (stats || []).forEach(function (s) {
      var base = Date.parse(s.day + 'T00:00:00Z');
      if (!s.hourly || !s.hourly.length) {
        if (s.daily) out.push({ day: s.day, hour: -1, n: s.daily });
        return;
      }
      s.hourly.forEach(function (n, h) {
        if (!n) return;
        var t = new Date(base + (h + shift) * 3600000);
        out.push({ day: t.toISOString().slice(0, 10), hour: t.getUTCHours(), n: n });
      });
    });
    return out;
  }
  function buckets(stats, days) {
    var inRange = {}, byDay = {}, byHour = [], heat = [];
    (days || []).forEach(function (d) { inRange[d] = 1; });
    for (var h = 0; h < 24; h++) byHour.push(0);
    for (var w = 0; w < 7; w++) { heat.push([]); for (h = 0; h < 24; h++) heat[w].push(0); }
    hourList(stats).forEach(function (x) {
      if (days && !inRange[x.day]) return;
      byDay[x.day] = (byDay[x.day] || 0) + x.n;
      if (x.hour < 0) return;
      byHour[x.hour] += x.n;
      heat[weekday(x.day)][x.hour] += x.n;
    });
    return { byDay: byDay, byHour: byHour, heat: heat };
  }

  async function allHits(start, end) {
    var out = [], seen = {}, partial = false;
    for (var i = 0; i < 40; i++) {
      var r;
      try {
        r = await api('/stats/hits', { start: start, end: end, limit: 100, exclude_paths: Object.keys(seen).join(',') });
      } catch (e) {
        if (i === 0 || e.code === 'auth') throw e;
        partial = true;
        break;
      }
      var fresh = (r.hits || []).filter(function (h) { return !seen[h.path_id]; });
      fresh.forEach(function (h) { seen[h.path_id] = 1; out.push(h); });
      if (!r.more) break;
      if (!fresh.length) { partial = true; break; }
    }
    return { hits: out, partial: partial };
  }

  function classify(path) {
    var m = /^\/?(aktif|donus|ziyaretci)\/(.+)$/.exec(path || '');
    return m ? { group: m[1], name: m[2] } : null;
  }

  // hits listesini anlamlı gruplara ayırır
  // ziyaretci/<id>/<n>: her geliş ayrı yol (22 Ekim 2026 akşamından önceki kayıtlar ziyaretci/<id>); kimlik başına toplanır.
  function digest(hits, days) {
    var d = { realTotal: 0, realBy: {}, realStats: [], realIds: [], retBy: {}, retTotal: 0, rawTotal: 0, rawStats: [], pages: [], events: [], visitors: [] };
    var byId = {};
    hits.forEach(function (h) {
      var c = classify(h.path);
      if (!h.event && !c) {
        d.rawTotal += h.count;
        d.rawStats = d.rawStats.concat(h.stats || []);
        d.pages.push(h);
        return;
      }
      if (!c) { d.events.push(h); return; }
      if (c.group === 'aktif') {
        d.realTotal += h.count;
        d.realBy[c.name] = (d.realBy[c.name] || 0) + h.count;
        d.realStats = d.realStats.concat(h.stats || []);
        d.realIds.push(h.path_id);
        d.events.push(h);
      } else if (c.group === 'donus') {
        var ret = /^\d+$/.test(c.name) && +c.name >= 4 ? '4+' : c.name;
        d.retBy[ret] = (d.retBy[ret] || 0) + h.count;
        d.retTotal += h.count;
        d.events.push(h);
      } else if (c.group === 'ziyaretci' && h.count > 0 && days) {
        var id = c.name.split('/')[0];
        var v = byId[id] || (byId[id] = { id: id, count: 0, stats: [] });
        v.count += h.count;
        v.stats = v.stats.concat(h.stats || []);
      }
    });
    Object.keys(byId).forEach(function (id) {
      var v = byId[id], vd = Object.keys(buckets(v.stats, days).byDay).sort();
      v.days = vd;
      v.first = vd[0] || '';
      v.last = vd[vd.length - 1] || '';
      d.visitors.push(v);
    });
    d.pages.sort(function (a, b) { return b.count - a.count; });
    d.events.sort(function (a, b) { return b.count - a.count; });
    d.visitors.sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : b.count - a.count; });
    return d;
  }

  // --- Çizim yardımcıları ---
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function caret() {
    var s = svgEl('svg', { viewBox: '0 0 10 10', class: 'caret', 'aria-hidden': 'true' });
    s.appendChild(svgEl('path', { d: 'M3 1.5 7 5l-4 3.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }
  function spark(values) {
    var s = svgEl('svg', { viewBox: '0 0 100 24', preserveAspectRatio: 'none', class: 'spark', 'aria-hidden': 'true' });
    var max = Math.max.apply(null, values.concat([1])), n = values.length;
    var pts = values.map(function (v, i) {
      return (n === 1 ? 50 : i / (n - 1) * 100).toFixed(2) + ',' + (22 - v / max * 20).toFixed(2);
    });
    if (n === 1) pts = ['0,' + pts[0].split(',')[1], '100,' + pts[0].split(',')[1]];
    s.appendChild(svgEl('polygon', { points: '0,24 ' + pts.join(' ') + ' 100,24', fill: 'currentColor', opacity: '.12' }));
    s.appendChild(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
    return s;
  }
  function niceMax(v) {
    if (v <= 4) return Math.max(1, v);
    var mag = Math.pow(10, Math.floor(Math.log10(v))), steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= v) return steps[i] * mag;
    return v;
  }
  function setDelta(elm, cur, prev, p) {
    elm.className = 'delta';
    elm.textContent = '';
    if (prev === null || prev === undefined) return;
    var cls, text;
    if (!prev && !cur) { cls = 'flat'; text = 'değişiklik yok'; }
    else if (!prev) { cls = 'up'; text = 'yeni (önceki dönem 0)'; }
    else {
      var ch = Math.round((cur - prev) / prev * 100);
      cls = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat';
      text = (ch > 0 ? '↑ %' + ch : ch < 0 ? '↓ %' + (-ch) : 'aynı');
    }
    elm.classList.add(cls);
    elm.appendChild(document.createTextNode(text + ' '));
    elm.appendChild(el('small', '', prevText(p) + (prev ? ' (' + num(prev) + ')' : '')));
  }

  // Sütun grafiği: items = [{tick, real, raw?}]
  function drawCols(box, ticksBox, readout, items, describe, defaultIndex) {
    box.textContent = '';
    ticksBox.textContent = '';
    var top = niceMax(Math.max.apply(null, items.map(function (it) { return Math.max(it.real, it.raw || 0); }).concat([0])));
    var line = el('div', 'gridline');
    line.style.top = '0';
    line.appendChild(el('span', '', num(top)));
    box.appendChild(line);
    var cols = [];
    function show(i) {
      cols.forEach(function (c, j) { c.classList.toggle('on', j === i); });
      readout.textContent = '';
      describe(items[i]).forEach(function (part, j) {
        readout.appendChild(j % 2 ? el('b', '', part) : document.createTextNode(part));
      });
    }
    items.forEach(function (it, i) {
      var col = el('button', 'col');
      col.type = 'button';
      col.setAttribute('aria-label', describe(it).join(''));
      if (it.raw !== undefined) {
        var r = el('span', 'bar raw');
        r.style.height = (it.raw / top * 100) + '%';
        col.appendChild(r);
      }
      var g = el('span', 'bar real');
      g.style.height = (it.real / top * 100) + '%';
      col.appendChild(g);
      ['mouseenter', 'focus', 'click'].forEach(function (ev) { col.addEventListener(ev, function () { show(i); }); });
      box.appendChild(col);
      cols.push(col);
      ticksBox.appendChild(el('span', '', it.tick || ''));
    });
    if (items.length) show(defaultIndex === undefined || defaultIndex < 0 ? items.length - 1 : defaultIndex);
  }

  // Yatay çubuk listesi. opt: {empty, total, expand(item) → Promise<items>, spark: true}
  function drawRows(list, items, opt) {
    opt = opt || {};
    list.textContent = '';
    if (!items) { list.appendChild(el('li', 'empty', opt.error || 'Alınamadı; Yenile’ye bas.')); return; }
    if (!items.length) { list.appendChild(el('li', 'empty', opt.empty || 'Bu dönemde veri yok.')); return; }
    var max = Math.max.apply(null, items.map(function (it) { return it.count; })) || 1;
    var total = opt.total || items.reduce(function (s, it) { return s + it.count; }, 0) || 1;
    items.forEach(function (it) {
      var li = el('li');
      var canExpand = !!opt.expand && it.expandable !== false;
      var row = el(canExpand ? 'button' : 'div', 'row');
      var name = el('span', 'name');
      if (canExpand) {
        row.type = 'button';
        row.setAttribute('aria-expanded', 'false');
        name.appendChild(caret());
      }
      var label = el('span', '', it.name);
      name.title = it.name;
      name.appendChild(label);
      var mid;
      if (it.series) {
        mid = spark(it.series);
      } else {
        mid = el('span', 'track');
        var fill = el('span', 'fill');
        fill.style.width = (it.count / max * 100) + '%';
        mid.appendChild(fill);
      }
      var val = el('span', 'val', num(it.count));
      if (opt.share !== false) val.appendChild(el('small', '', '%' + pct(it.count, total)));
      row.append(name, mid, val);
      li.appendChild(row);
      if (canExpand) {
        var sub = el('ul', 'rows sub');
        sub.hidden = true;
        li.appendChild(sub);
        row.addEventListener('click', async function () {
          var open = row.getAttribute('aria-expanded') === 'true';
          row.setAttribute('aria-expanded', String(!open));
          sub.hidden = open;
          if (open || sub.dataset.loaded) return;
          sub.dataset.loaded = '1';
          sub.textContent = '';
          sub.appendChild(el('li', 'empty', 'Yükleniyor…'));
          try {
            var kids = await opt.expand(it);
            drawRows(sub, kids.items, { empty: kids.empty || 'Ayrıntı yok.', total: it.count, title: kids.title });
          } catch (e) {
            sub.dataset.loaded = '';
            drawRows(sub, null);
          }
        });
      }
      list.appendChild(li);
    });
    if (opt.title) list.insertBefore(el('li', 'sub-title', opt.title), list.firstChild);
  }

  // --- İsimleri anlaşılır yap ---
  function niceName(page, x, parent) {
    var name = (x.name || '').trim();
    if (page === 'locations' || (page === 'locations-detail')) {
      if (/^[A-Z]{2}$/.test(x.id || '') && regionNames && page === 'locations') {
        try { return regionNames.of(x.id) || name || 'Bilinmiyor'; } catch (e) {}
      }
      return name && name !== '(unknown)' ? name : 'Bilinmiyor';
    }
    if (page === 'sizes') return SIZES[name.toLowerCase()] || name || 'Bilinmiyor';
    if (page === 'toprefs' || page === 'refs') return !name || name === '(no data)' ? 'Doğrudan / bilinmiyor' : name;
    if (page === 'languages') {
      if (langNames && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(x.id || name)) {
        try { var n = langNames.of(x.id || name); if (n) return n.charAt(0).toLocaleUpperCase('tr') + n.slice(1); } catch (e) {}
      }
      return name || 'Bilinmiyor';
    }
    return name || '(bilinmiyor)';
  }

  // --- Ana çizim ---
  function renderMain(d) {
    var p = d.p, cur = d.cur, prev = d.prev;
    var realB = buckets(cur.realStats, p.days), rawB = buckets(cur.rawStats, p.days);
    d.realB = realB;

    // sayılar
    $('tReal').textContent = num(cur.realTotal);
    $('tRaw').textContent = num(cur.rawTotal);
    setDelta($('dReal'), cur.realTotal, prev ? prev.realTotal : null, p);
    setDelta($('dRaw'), cur.rawTotal, prev ? prev.rawTotal : null, p);
    var bot = cur.rawTotal ? Math.max(0, cur.rawTotal - cur.realTotal) : 0;
    $('tBot').textContent = cur.rawTotal ? '%' + pct(bot, cur.rawTotal) : '–';
    $('tBotSub').textContent = cur.rawTotal ? num(bot) + ' görüntülenme 8 saniyeyi bulmadı' : 'ham görüntülenmelerin içinde';
    $('tUniq').textContent = num(cur.visitors.length);
    var multi = cur.visitors.filter(function (v) { return v.count > 1; }).length;
    $('tUniqSub').textContent = cur.visitors.length ? num(multi) + ' tanesi birden fazla kez geldi' : 'kimlikler 22 Ekim 2026’dan beri';
    var first = cur.retBy.ilk || 0, again = cur.retTotal - first;
    $('tRet').textContent = cur.retTotal ? '%' + pct(again, cur.retTotal) : '–';
    $('tRetSub').textContent = cur.retTotal ? num(again) + ' tekrar, ' + num(first) + ' ilk geliş' : 'henüz veri yok';
    var peakH = realB.byHour.indexOf(Math.max.apply(null, realB.byHour));
    var hasHours = realB.byHour.some(function (n) { return n > 0; });
    $('tPeak').textContent = hasHours ? hh(peakH) + ':00' : '–';
    $('tPeakSub').textContent = hasHours ? hh(peakH) + ':00–' + hh(peakH) + ':59 arası, Türkiye saati' : 'Türkiye saati';

    renderSummary(d, realB, peakH, hasHours);

    // gün gün
    var step = p.days.length <= 10 ? 1 : p.days.length <= 31 ? 5 : 10;
    drawCols($('daily'), $('dailyTicks'), $('dailyReadout'), p.days.map(function (day, i) {
      var tick = p.days.length === 1 ? dayShort(day) : (i % step === 0 || i === p.days.length - 1 ? dayShort(day) : '');
      return { tick: tick, day: day, real: realB.byDay[day] || 0, raw: rawB.byDay[day] || 0 };
    }), function (it) {
      return [dayLong(it.day) + ': ', num(it.real) + ' gerçek ziyaret', ', ' + num(it.raw) + ' ham görüntülenme'];
    });

    // saatler
    drawCols($('hours'), $('hourTicks'), $('hourReadout'), realB.byHour.map(function (n, h) {
      return { tick: h % 6 === 0 ? hh(h) : '', hour: h, real: n };
    }), function (it) {
      return [hh(it.hour) + ':00–' + hh(it.hour) + ':59 arası: ', num(it.real) + ' gerçek ziyaret'];
    }, hasHours ? peakH : 0);

    // haftanın günleri
    var wd = [0, 0, 0, 0, 0, 0, 0];
    Object.keys(realB.byDay).forEach(function (day) { wd[weekday(day)] += realB.byDay[day]; });
    drawRows($('weekdays'), WEEKDAYS.map(function (n, i) { return { name: n, count: wd[i] }; }), { empty: 'Bu dönemde gerçek ziyaret yok.' });
    if (!cur.realTotal) drawRows($('weekdays'), [], { empty: 'Bu dönemde gerçek ziyaret yok.' });

    renderHeat(realB.heat);

    // kim
    drawRows($('platforms'), PLATFORMS.map(function (x) { return { name: x[1], count: cur.realBy[x[0]] || 0 }; })
      .filter(function (x) { return x.count > 0; }), { empty: 'Bu dönemde gerçek ziyaret yok.' });
    drawRows($('returns'), RETURNS.map(function (x) { return { name: x[1], count: cur.retBy[x[0]] || 0 }; })
      .filter(function (x) { return x.count > 0; }), { empty: 'Bu dönemde veri yok (22 Ekim 2026’dan beri ölçülüyor).' });

    renderPages(d);
    renderVisitors(d);

    var warn = $('warn');
    warn.hidden = !d.partial;
    warn.textContent = d.partial ? 'GoatCounter’dan listenin bir kısmı alınamadı; ziyaretçi ve sayfa listeleri eksik olabilir.' : '';
  }

  function renderSummary(d, realB, peakH, hasHours) {
    var p = d.p, cur = d.cur, prev = d.prev, box = $('summary');
    var parts = [];
    function t(s) { parts.push([s, false]); }
    function b(s) { parts.push([s, true]); }
    if (!cur.realTotal && !cur.rawTotal) {
      t(rangeText(p) + ' henüz kimse gelmedi.');
    } else {
      t(rangeText(p) + ' ');
      b(num(cur.realTotal) + ' gerçek ziyaret');
      t(' oldu');
      if (prev) {
        if (!prev.realTotal) t(' (önceki dönemde hiç yoktu)');
        else {
          var ch = Math.round((cur.realTotal - prev.realTotal) / prev.realTotal * 100);
          t(' — ' + prevText(p) + ' ');
          if (ch === 0) t('aynı');
          else b('%' + Math.abs(ch) + (ch > 0 ? ' daha fazla' : ' daha az'));
        }
      }
      t('. Sayfa toplam ' + num(cur.rawTotal) + ' kez açıldı; bunların ');
      b(pctPoss(pct(Math.max(0, cur.rawTotal - cur.realTotal), cur.rawTotal)));
      t(' 8 saniyeyi bulmadı ya da bot. ');
      if (cur.visitors.length) {
        t('Gerçek ziyaretler ');
        b(num(cur.visitors.length) + ' farklı tarayıcıdan');
        t(' geldi. ');
      }
      if (hasHours && cur.realTotal) {
        var wd = [0, 0, 0, 0, 0, 0, 0];
        Object.keys(realB.byDay).forEach(function (day) { wd[weekday(day)] += realB.byDay[day]; });
        var topWd = wd.indexOf(Math.max.apply(null, wd));
        t('En yoğun saat ');
        b(hh(peakH) + ':00 civarı');
        if (p.days.length >= 7) { t(', en yoğun gün '); b(WEEKDAYS[topWd]); }
        t('. ');
      }
      var plats = Object.keys(cur.realBy).sort(function (a, c) { return cur.realBy[c] - cur.realBy[a]; });
      if (plats.length && cur.realTotal) {
        t('Ziyaretlerin ');
        b(pctPoss(pct(cur.realBy[plats[0]], cur.realTotal)));
        t(' ' + (PLATFORM_SHORT[plats[0]] || plats[0]) + ' cihazlardan. ');
      }
      if (cur.retTotal) {
        var again = cur.retTotal - (cur.retBy.ilk || 0);
        t('Gelişlerin ');
        b(pctPoss(pct(again, cur.retTotal)));
        t(' daha önce gelmiş bir tarayıcıdan.');
      }
    }
    box.textContent = '';
    parts.forEach(function (x) { box.appendChild(x[1] ? el('b', '', x[0]) : document.createTextNode(x[0])); });
  }

  function renderHeat(heat) {
    var box = $('heat'), scale = $('heatScale');
    box.textContent = '';
    scale.textContent = '';
    var max = 0;
    heat.forEach(function (row) { row.forEach(function (n) { if (n > max) max = n; }); });
    box.appendChild(el('span'));
    for (var h = 0; h < 24; h++) box.appendChild(el('span', 'hl', h % 3 === 0 ? hh(h) : ''));
    heat.forEach(function (row, w) {
      box.appendChild(el('span', 'rl', WD_SHORT[w]));
      row.forEach(function (n, h) {
        var c = el('span', 'c' + (n ? ' has' : ''));
        if (n) c.style.background = 'rgba(150,83,50,' + (0.18 + 0.82 * n / max).toFixed(2) + ')';
        c.title = WEEKDAYS[w] + ' ' + hh(h) + ':00–' + hh(h) + ':59 · ' + num(n) + ' gerçek ziyaret';
        box.appendChild(c);
      });
    });
    scale.appendChild(document.createTextNode('az'));
    [0.18, 0.45, 0.72, 1].forEach(function (a) {
      var i = el('i');
      i.style.background = 'rgba(150,83,50,' + a + ')';
      scale.appendChild(i);
    });
    scale.appendChild(document.createTextNode('çok' + (max ? ' (en koyu kare: ' + num(max) + ' ziyaret)' : '')));
  }

  function renderPages(d) {
    var p = d.p, cur = d.cur;
    function series(h) {
      var by = buckets(h.stats, p.days).byDay;
      return p.days.map(function (day) { return by[day] || 0; });
    }
    function eventName(path) {
      var c = classify(path);
      if (!c) return path;
      if (c.group === 'aktif') return 'aktif/' + c.name + ' · gerçek ziyaret (' + (PLATFORM_SHORT[c.name] || c.name) + ')';
      if (c.group === 'donus') return 'donus/' + c.name + ' · ' + (c.name === 'ilk' ? 'ilk geliş' : c.name + '. geliş');
      return path;
    }
    function expand(it) {
      return api('/stats/hits/' + it.pathId, { start: p.start, end: p.end, limit: 15 }).then(function (r) {
        return {
          title: 'Bu sayfaya hangi linkten gelindi',
          items: (r.refs || []).map(function (x) { return { name: niceName('refs', x), count: x.count }; }),
          empty: 'Kaynak bilgisi yok.'
        };
      });
    }
    var items = cur.pages.map(function (h) {
      return { name: h.path + (h.title && h.title !== h.path ? ' — ' + h.title : ''), count: h.count, series: series(h), pathId: h.path_id };
    });
    items = items.concat(cur.events.map(function (h) {
      return { name: eventName(h.path), count: h.count, series: series(h), pathId: h.path_id };
    }));
    var zCount = cur.visitors.length;
    if (zCount) items.push({ name: 'ziyaretci/… · ' + num(zCount) + ' farklı tarayıcı kimliği (aşağıda tek tek)', count: cur.visitors.reduce(function (s, v) { return s + v.count; }, 0), series: p.days.map(function (day) { return cur.visitors.filter(function (v) { return v.days.indexOf(day) > -1; }).length; }), expandable: false });
    drawRows($('pages'), items, { expand: expand, share: false, empty: 'Bu dönemde görüntülenme yok.' });
  }

  function renderVisitors(d) {
    var body = $('visitors');
    body.textContent = '';
    var only = $('onlyReturning').checked;
    var list = d.cur.visitors.filter(function (v) { return !only || v.days.length > 1 || v.count > 1; });
    var rows = allVisitors ? list : list.slice(0, VISITOR_ROWS);
    var stripDays = d.p.days.slice(-STRIP_DAYS);
    $('visitorsLabel').textContent = d.cur.visitors.length
      ? num(list.length) + ' tarayıcı' + (only ? ' (birden fazla gelen)' : '') : '';
    if (!rows.length) {
      var tr0 = el('tr'), td0 = el('td', 'empty', only ? 'Bu dönemde birden fazla gelen tarayıcı yok.' : 'Bu dönemde kimlikli ziyaret yok. (Kimlikler 22 Ekim 2026 akşamından beri gönderiliyor.)');
      td0.colSpan = 6;
      tr0.appendChild(td0);
      body.appendChild(tr0);
    }
    rows.forEach(function (v) {
      var tr = el('tr', 'v');
      tr.tabIndex = 0;
      tr.setAttribute('aria-expanded', 'false');
      var idCell = el('td', 'id');
      idCell.appendChild(caret());
      idCell.appendChild(document.createTextNode(v.id));
      tr.appendChild(idCell);
      tr.appendChild(el('td', 'n', num(v.count)));
      tr.appendChild(el('td', 'n', num(v.days.length)));
      tr.appendChild(el('td', '', v.first ? dayShort(v.first) : '–'));
      tr.appendChild(el('td', '', v.last ? dayShort(v.last) : '–'));
      var strip = el('div', 'strip'), set = {};
      v.days.forEach(function (x) { set[x] = 1; });
      stripDays.forEach(function (x) {
        var dot = el('i', set[x] ? 'on' : '');
        dot.title = dayShort(x) + (set[x] ? ': geldi' : '');
        strip.appendChild(dot);
      });
      var td = el('td');
      td.appendChild(strip);
      tr.appendChild(td);
      body.appendChild(tr);

      var detail = el('tr', 'detail');
      detail.hidden = true;
      var dtd = el('td');
      dtd.colSpan = 6;
      var visits = el('div', 'visits');
      var inRange = {};
      d.p.days.forEach(function (x) { inRange[x] = 1; });
      // aynı saate düşen gelişler (farklı geliş yollarından) tek satırda toplanır
      var slots = [], slotOf = {};
      hourList(v.stats).filter(function (x) { return inRange[x.day]; }).forEach(function (x) {
        var k = x.day + ' ' + hh(x.hour);
        if (slotOf[k]) slotOf[k].n += x.n;
        else slots.push(slotOf[k] = { day: x.day, hour: x.hour, n: x.n });
      });
      slots.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.hour - b.hour; });
      slots.forEach(function (x) {
        visits.appendChild(el('span', '', dayShort(x.day) + (x.hour >= 0 ? ' · ' + hh(x.hour) + ':00–' + hh(x.hour) + ':59' : '') + (x.n > 1 ? ' · ' + x.n + ' kez' : '')));
      });
      dtd.appendChild(visits);
      detail.appendChild(dtd);
      body.appendChild(detail);
      function toggle() {
        var open = tr.getAttribute('aria-expanded') === 'true';
        tr.setAttribute('aria-expanded', String(!open));
        detail.hidden = open;
      }
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
    });
    var more = $('moreVisitors');
    more.hidden = allVisitors || list.length <= VISITOR_ROWS;
    more.textContent = 'Tümünü göster (' + num(list.length) + ')';
  }

  // --- Ayrıntılar (tarayıcı, ülke…) ---
  function filterHint(d) {
    var h = $('filterHint');
    if (filter === 'real') h.textContent = 'Şu an sadece gerçek ziyaretler (8 sn+) gösteriliyor. Botları da görmek için “Tüm görüntülenmeler”e geç.';
    else h.textContent = 'Şu an tüm görüntülenmeler gösteriliyor; Meta’nın link önizleme botları da dahil.';
    if (d && filter === 'real' && !d.cur.realIds.length) h.textContent += ' Bu dönemde gerçek ziyaret olmadığı için listeler boş.';
  }

  async function loadBreakdowns(d, id) {
    var p = d.p;
    var inc = filter === 'real' ? d.cur.realIds.join(',') : '';
    filterHint(d);
    BREAKDOWNS.forEach(function (b) {
      var list = $(b.box);
      list.textContent = '';
      list.appendChild(el('li', 'empty', 'Yükleniyor…'));
    });
    for (var i = 0; i < BREAKDOWNS.length; i++) {
      var b = BREAKDOWNS[i];
      if (id !== loadId) return;
      if (filter === 'real' && !inc) {
        drawRows($(b.box), [], { empty: 'Bu dönemde gerçek ziyaret yok.' });
        if (b.page === 'campaigns') $('campaignBlock').hidden = true;
        continue;
      }
      var items = null;
      try {
        var r = await api('/stats/' + b.page, { start: p.start, end: p.end, limit: 10, include_paths: inc });
        items = (r.stats || []).map(function (x) { return { name: niceName(b.page, x), count: x.count, id: x.id }; });
      } catch (e) {
        if (e.code === 'auth') throw e;
      }
      if (id !== loadId) return;
      if (b.page === 'campaigns') $('campaignBlock').hidden = !(items && items.length);
      drawRows($(b.box), items, {
        empty: filter === 'real' ? 'Gerçek ziyaretlerde bu bilgi yok; “Tüm görüntülenmeler”e geçip bak.' : 'Bu dönemde veri yok.',
        expand: b.detail ? makeDetail(b.page, p, inc) : null
      });
    }
  }

  function makeDetail(page, p, inc) {
    return function (it) {
      if (it.id === undefined || it.id === null || it.id === '') return Promise.resolve({ items: [], empty: 'Ayrıntı yok.' });
      return api('/stats/' + page + '/' + encodeURIComponent(it.id), { start: p.start, end: p.end, limit: 15, include_paths: inc }).then(function (r) {
        return {
          items: (r.stats || []).map(function (x) {
            return { name: page === 'locations' ? niceName('locations-detail', x) : (x.name || '(bilinmiyor)'), count: x.count };
          }),
          empty: 'Ayrıntı yok.'
        };
      });
    };
  }

  // --- Akış ---
  function setStatus(t) { $('status').textContent = t; }

  function showKeyPanel(message) {
    $('dash').hidden = true;
    $('keyPanel').hidden = false;
    var err = $('keyError');
    err.hidden = !message;
    err.textContent = message || '';
    $('keyInput').value = '';
    $('keyInput').focus();
  }

  function handleError(e) {
    if (e.code === 'auth') {
      forgetKey();
      key = '';
      showKeyPanel('GoatCounter anahtarı kabul etmedi. Anahtarın doğru olduğundan ve “Read statistics” izni olduğundan emin ol.');
    } else if (e.code === 'network') {
      setStatus('GoatCounter’a ulaşılamadı; bağlantını kontrol edip Yenile’ye bas.');
    } else if (e.code === 'rate') {
      setStatus('GoatCounter çok sık istek dedi; biraz sonra Yenile’ye bas.');
    } else {
      setStatus('Veri alınamadı (' + (e.status || e.message) + '). Yenile’ye bas.');
    }
  }

  async function refresh() {
    if (!key) return;
    var id = ++loadId;
    loading = true;
    setStatus('Yükleniyor…');
    try {
      var p = period();
      if (shift === null) await loadShift();
      var res = await allHits(p.start, p.end);
      if (id !== loadId) return;
      var d = { p: p, cur: digest(res.hits, p.days), prev: null, partial: res.partial };
      if (p.hasPrev) {
        try {
          var pr = await allHits(p.prevStart, p.prevEnd);
          d.prev = digest(pr.hits, null);
        } catch (e) { if (e.code === 'auth') throw e; }
      }
      if (id !== loadId) return;
      data = d;
      allVisitors = false;
      renderMain(d);
      setStatus('Ayrıntılar yükleniyor…');
      await loadBreakdowns(d, id);
      if (id !== loadId) return;
      lastLoad = Date.now();
      setStatus('Güncellendi ' + fmtTime.format(new Date()));
    } catch (e) {
      if (id === loadId) handleError(e);
    } finally {
      if (id === loadId) loading = false;
    }
  }

  async function refreshBreakdowns() {
    if (!data || !key) return;
    var id = ++loadId;
    setStatus('Ayrıntılar yükleniyor…');
    try {
      await loadBreakdowns(data, id);
      if (id === loadId) setStatus('Güncellendi ' + fmtTime.format(new Date()));
    } catch (e) {
      if (id === loadId) handleError(e);
    }
  }

  function setRange(r) {
    range = r;
    if (r !== 'custom') storeSet(RANGE_NAME, r);
    document.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.range === r));
    });
    var p = period();
    $('fromDate').value = p.first;
    $('toDate').value = p.last;
  }
  function setFilter(f) {
    filter = f;
    storeSet(FILTER_NAME, f);
    document.querySelectorAll('.switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.filter === f));
    });
  }

  function start() {
    $('keyPanel').hidden = true;
    $('dash').hidden = false;
    refresh();
  }

  $('keyForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $('keyInput').value.trim();
    if (v.length < 10) {
      $('keyError').hidden = false;
      $('keyError').textContent = 'Bu bir API anahtarına benzemiyor; GoatCounter’daki anahtarın tamamını yapıştır.';
      return;
    }
    key = v;
    storeSet(KEY_NAME, v, $('rememberKey').checked);
    $('keyInput').value = '';
    start();
  });

  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      if (range === c.dataset.range) return;
      setRange(c.dataset.range);
      refresh();
    });
  });
  $('dateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var a = $('fromDate').value, b = $('toDate').value;
    if (!a || !b) return;
    if (a > b) { var t = a; a = b; b = t; }
    custom = { first: a, last: b };
    setRange('custom');
    refresh();
  });
  document.querySelectorAll('.switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (filter === b.dataset.filter) return;
      setFilter(b.dataset.filter);
      refreshBreakdowns();
    });
  });
  $('refreshBtn').addEventListener('click', refresh);
  $('forgetBtn').addEventListener('click', function () {
    loadId++;
    forgetKey();
    key = '';
    data = null;
    showKeyPanel('');
  });
  $('moreVisitors').addEventListener('click', function () {
    allVisitors = true;
    if (data) renderVisitors(data);
  });
  $('onlyReturning').addEventListener('change', function () {
    allVisitors = false;
    if (data) renderVisitors(data);
  });

  function maybeAuto() {
    if (key && !loading && document.visibilityState === 'visible' && Date.now() - lastLoad > AUTO_MS && range !== 'custom') refresh();
  }
  setInterval(maybeAuto, 30000);
  document.addEventListener('visibilitychange', maybeAuto);

  var today = trDay(new Date());
  $('fromDate').max = today;
  $('toDate').max = today;
  var savedRange = storeGet(RANGE_NAME);
  setRange(['1', '7', '30', 'month', 'all'].indexOf(savedRange) > -1 ? savedRange : '7');
  setFilter(storeGet(FILTER_NAME) === 'all' ? 'all' : 'real');
  key = storeGet(KEY_NAME);
  if (key) start(); else showKeyPanel('');
})();
