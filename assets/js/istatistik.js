// İstatistik paneli (/istatistik/): GoatCounter API'den canlı veri çeker.
// API anahtarı sadece bu tarayıcıda durur (localStorage/sessionStorage "gc-anahtar"); repoya girmez.
// Event'ler assets/js/analytics.js'ten gelir: aktif/<platform>, donus/<ilk|2|3|4+>, ziyaretci/<id>.
(function () {
  'use strict';

  var BASE = 'https://mserkantan.goatcounter.com/api/v0';
  var KEY_NAME = 'gc-anahtar', RANGE_NAME = 'gc-aralik';
  var TR_ZONE = 'Europe/Istanbul', SITE_START = '2026-10-01';
  var PLATFORMS = [['android', 'Android'], ['ios', 'iPhone / iPad'], ['windows', 'Windows'], ['mac', 'Mac'], ['linux', 'Linux'], ['diger', 'Diğer']];
  var RETURNS = [['ilk', 'İlk geliş'], ['2', '2. geliş'], ['3', '3. geliş'], ['4+', '4 ve üstü']];
  var VISITOR_ROWS = 25, STRIP_DAYS = 30, AUTO_MS = 5 * 60 * 1000;

  var $ = function (id) { return document.getElementById(id); };
  var key = '', range = '7', shift = null, loading = false, lastLoad = 0, allVisitors = false, lastData = null;

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
  var fmtShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var fmtLong = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  var fmtTime = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
  var fmtNum = new Intl.NumberFormat('tr-TR');
  function dayShort(d) { return fmtShort.format(new Date(d + 'T12:00:00Z')); }
  function dayLong(d) { return fmtLong.format(new Date(d + 'T12:00:00Z')); }
  function num(n) { return fmtNum.format(n || 0); }
  function iso(ms) { return new Date(ms).toISOString().replace('.000Z', 'Z'); }

  function period() {
    var now = new Date(), today = trDay(now), first;
    if (range === 'all') first = SITE_START;
    else if (range === 'month') first = today.slice(0, 8) + '01';
    else first = addDays(today, -(+range - 1));
    if (first < SITE_START) first = SITE_START;
    var startMs = Date.parse(first + 'T00:00:00Z') - offsetMin(TR_ZONE, now) * 60000;
    var endMs = Math.ceil(now.getTime() / 3600000) * 3600000;
    return { first: first, last: today, days: dayList(first, today), start: iso(startMs), end: iso(endMs) };
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

  // stats: [{day, hourly[24], daily}] → Türkiye saatine göre gün ve saat toplamları
  function buckets(stats) {
    var byDay = {}, byHour = [];
    for (var i = 0; i < 24; i++) byHour.push(0);
    (stats || []).forEach(function (s) {
      var base = Date.parse(s.day + 'T00:00:00Z');
      if (!s.hourly || !s.hourly.length) {
        if (s.daily) byDay[s.day] = (byDay[s.day] || 0) + s.daily;
        return;
      }
      s.hourly.forEach(function (n, h) {
        if (!n) return;
        var t = new Date(base + (h + shift) * 3600000);
        var d = t.toISOString().slice(0, 10);
        byDay[d] = (byDay[d] || 0) + n;
        byHour[t.getUTCHours()] += n;
      });
    });
    return { byDay: byDay, byHour: byHour };
  }

  async function allHits(p) {
    var out = [], seen = {}, partial = false;
    for (var i = 0; i < 40; i++) {
      var r;
      try {
        r = await api('/stats/hits', { start: p.start, end: p.end, limit: 100, exclude_paths: Object.keys(seen).join(',') });
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

  async function load() {
    var p = period();
    if (shift === null) await loadShift();
    var res = await allHits(p);
    var real = { total: 0, by: {}, stats: [], ids: [] };
    var ret = { by: {}, total: 0 };
    var pages = [], rawStats = [], rawTotal = 0, visitors = [];

    res.hits.forEach(function (h) {
      var c = classify(h.path);
      if (!h.event && !c) {
        pages.push({ name: h.path, count: h.count });
        rawTotal += h.count;
        rawStats = rawStats.concat(h.stats || []);
        return;
      }
      if (!c) return;
      if (c.group === 'aktif') {
        real.total += h.count;
        real.by[c.name] = (real.by[c.name] || 0) + h.count;
        real.stats = real.stats.concat(h.stats || []);
        real.ids.push(h.path_id);
      } else if (c.group === 'donus') {
        ret.by[c.name] = (ret.by[c.name] || 0) + h.count;
        ret.total += h.count;
      } else if (c.group === 'ziyaretci' && h.count > 0) {
        var days = Object.keys(buckets(h.stats).byDay).sort();
        visitors.push({ id: c.name, count: h.count, days: days, first: days[0] || '', last: days[days.length - 1] || '' });
      }
    });

    var locations = null, refs = null;
    if (real.ids.length) {
      try {
        locations = (await api('/stats/locations', { start: p.start, end: p.end, limit: 8, include_paths: real.ids.join(',') })).stats || [];
      } catch (e) { if (e.code === 'auth') throw e; }
    } else {
      locations = [];
    }
    try {
      refs = (await api('/stats/toprefs', { start: p.start, end: p.end, limit: 8 })).stats || [];
    } catch (e) { if (e.code === 'auth') throw e; }

    visitors.sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : b.count - a.count; });
    pages.sort(function (a, b) { return b.count - a.count; });

    return {
      p: p, partial: res.partial,
      real: real, realB: buckets(real.stats), rawB: buckets(rawStats), rawTotal: rawTotal,
      ret: ret, pages: pages, visitors: visitors, locations: locations, refs: refs
    };
  }

  // --- Çizim ---
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function niceMax(v) {
    if (v <= 4) return Math.max(1, v);
    var mag = Math.pow(10, Math.floor(Math.log10(v))), steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= v) return steps[i] * mag;
    return v;
  }

  // Sütun grafiği: items = [{tick, label, real, raw?}]
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
      col.addEventListener('mouseenter', function () { show(i); });
      col.addEventListener('focus', function () { show(i); });
      col.addEventListener('click', function () { show(i); });
      box.appendChild(col);
      cols.push(col);
      ticksBox.appendChild(el('span', '', it.tick || ''));
    });
    if (items.length) show(defaultIndex === undefined ? items.length - 1 : defaultIndex);
  }

  function drawRows(list, items, emptyText) {
    list.textContent = '';
    if (!items) { list.appendChild(el('li', 'empty', 'Alınamadı.')); return; }
    if (!items.length) { list.appendChild(el('li', 'empty', emptyText)); return; }
    var max = Math.max.apply(null, items.map(function (it) { return it.count; })) || 1;
    var total = items.reduce(function (s, it) { return s + it.count; }, 0) || 1;
    items.forEach(function (it) {
      var row = el('li', 'row');
      var name = el('span', 'name', it.name);
      name.title = it.name;
      var track = el('span', 'track'), fill = el('span', 'fill');
      fill.style.width = (it.count / max * 100) + '%';
      track.appendChild(fill);
      var val = el('span', 'val', num(it.count));
      if (it.share !== false) val.appendChild(el('small', '', '%' + Math.round(it.count / total * 100)));
      row.append(name, track, val);
      list.appendChild(row);
    });
  }

  function drawVisitors(d) {
    var body = $('visitors');
    body.textContent = '';
    var rows = allVisitors ? d.visitors : d.visitors.slice(0, VISITOR_ROWS);
    var stripDays = d.p.days.slice(-STRIP_DAYS);
    $('visitorsLabel').textContent = d.visitors.length
      ? num(d.visitors.length) + ' tarayıcı · tarayıcı başına rastgele kimlik'
      : 'tarayıcı başına rastgele kimlik';
    if (!rows.length) {
      var tr = el('tr'), td = el('td', 'empty', 'Bu aralıkta kimlikli ziyaret yok. (Kimlikler 22 Ekim 2026 akşamından beri gönderiliyor.)');
      td.colSpan = 5;
      tr.appendChild(td);
      body.appendChild(tr);
    }
    rows.forEach(function (v) {
      var tr = el('tr');
      tr.appendChild(el('td', 'id', v.id));
      tr.appendChild(el('td', 'n', num(v.count)));
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
    });
    var more = $('moreVisitors');
    more.hidden = allVisitors || d.visitors.length <= VISITOR_ROWS;
    more.textContent = 'Tümünü göster (' + num(d.visitors.length) + ')';
  }

  function render(d) {
    lastData = d;
    $('tReal').textContent = num(d.real.total);
    $('tRaw').textContent = num(d.rawTotal);
    $('tRawSub').textContent = d.rawTotal
      ? 'botlar dahil · %' + Math.max(0, Math.round((1 - d.real.total / d.rawTotal) * 100)) + '’i kısa ya da bot'
      : 'botlar dahil';
    $('tUniq').textContent = num(d.visitors.length);
    var first = d.ret.by.ilk || 0, again = d.ret.total - first;
    $('tRet').textContent = d.ret.total ? '%' + Math.round(again / d.ret.total * 100) : '–';
    $('tRetSub').textContent = d.ret.total ? num(first) + ' ilk · ' + num(again) + ' tekrar' : 'henüz veri yok';

    var step = d.p.days.length <= 10 ? 1 : d.p.days.length <= 31 ? 5 : 10;
    drawCols($('daily'), $('dailyTicks'), $('dailyReadout'), d.p.days.map(function (day, i) {
      var label = d.p.days.length === 1 ? 'bugün' : (i % step === 0 || i === d.p.days.length - 1 ? dayShort(day) : '');
      return { tick: label, day: day, real: d.realB.byDay[day] || 0, raw: d.rawB.byDay[day] || 0 };
    }), function (it) {
      return [dayLong(it.day) + ': ', num(it.real) + ' gerçek ziyaret', ', ' + num(it.raw) + ' ham görüntülenme'];
    });

    drawCols($('hours'), $('hourTicks'), $('hourReadout'), d.realB.byHour.map(function (n, h) {
      return { tick: h % 6 === 0 ? String(h).padStart(2, '0') : '', hour: h, real: n };
    }), function (it) {
      var h = String(it.hour).padStart(2, '0');
      return [h + ':00–' + h + ':59 arası: ', num(it.real) + ' gerçek ziyaret'];
    }, d.realB.byHour.indexOf(Math.max.apply(null, d.realB.byHour)));

    drawRows($('platforms'), PLATFORMS.map(function (x) { return { name: x[1], count: d.real.by[x[0]] || 0 }; })
      .filter(function (x) { return x.count > 0; }), 'Bu aralıkta gerçek ziyaret yok.');
    drawRows($('returns'), RETURNS.map(function (x) { return { name: x[1], count: d.ret.by[x[0]] || 0 }; })
      .filter(function (x) { return x.count > 0; }), 'Bu aralıkta veri yok. (22 Ekim 2026’dan beri ölçülüyor.)');
    drawRows($('locations'), d.locations && d.locations.map(function (x) { return { name: x.name || 'Bilinmiyor', count: x.count }; }),
      'Bu aralıkta veri yok.');
    drawRows($('pages'), d.pages.slice(0, 8), 'Bu aralıkta görüntülenme yok.');
    drawRows($('refs'), d.refs && d.refs.map(function (x) { return { name: x.name || 'Doğrudan / bilinmiyor', count: x.count }; }),
      'Bu aralıkta veri yok.');
    drawVisitors(d);

    var warn = $('warn');
    warn.hidden = !d.partial;
    warn.textContent = d.partial ? 'Bazı sayfalar alınamadı; ziyaretçi listesi eksik olabilir.' : '';
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

  async function refresh() {
    if (loading || !key) return;
    loading = true;
    setStatus('Yükleniyor…');
    try {
      render(await load());
      lastLoad = Date.now();
      setStatus('Güncellendi ' + fmtTime.format(new Date()));
    } catch (e) {
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
    loading = false;
  }

  function setRange(r) {
    range = r;
    storeSet(RANGE_NAME, r);
    document.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.range === r));
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
      allVisitors = false;
      refresh();
    });
  });
  $('refreshBtn').addEventListener('click', refresh);
  $('forgetBtn').addEventListener('click', function () {
    forgetKey();
    key = '';
    lastData = null;
    showKeyPanel('');
  });
  $('moreVisitors').addEventListener('click', function () {
    allVisitors = true;
    if (lastData) drawVisitors(lastData);
  });

  setInterval(function () {
    if (key && document.visibilityState === 'visible' && Date.now() - lastLoad > AUTO_MS) refresh();
  }, 30000);
  document.addEventListener('visibilitychange', function () {
    if (key && document.visibilityState === 'visible' && Date.now() - lastLoad > AUTO_MS) refresh();
  });

  var savedRange = storeGet(RANGE_NAME);
  setRange(['1', '7', '30', 'month', 'all'].indexOf(savedRange) > -1 ? savedRange : '7');
  key = storeGet(KEY_NAME);
  if (key) start(); else showKeyPanel('');
})();
