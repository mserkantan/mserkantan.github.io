// Gerçek ziyaretçi sinyali: sayfa en az 8 saniye ekranda görünür kalırsa
// GoatCounter'a platformla birlikte bir event gönderir (ör. "aktif/android").
// Link tarayıcı botlar sayfayı açıp hemen kapattığı için bu sayıya girmez.
//
// Ayrıca her yeni gelişte kaçıncı geliş olduğunu ("donus/ilk", "donus/2", "donus/3"…) ve
// tarayıcıya bir kez üretilen rastgele kimlikle "ziyaretci/<id>/<n>" event'ini gönderir.
// GoatCounter aynı ziyaretçinin aynı yolunu 8 saat içinde bir kez saydığı için her gelişin yolu farklı.
// Son hareketten 1 dk geçmeden yapılan açılışlar (yenileme, ikinci sekme) aynı geliş sayılır.
// localStorage'da sadece sayı ("ziyaret-sayisi"), son hareket zamanı ("son-ziyaret") ve rastgele kimlik ("ziyaretci-id") tutulur.
(function () {
  var NEEDED_MS = 8000, VISIT_GAP_MS = 60 * 1000, visibleMs = 0, last = null, sent = false;

  function platform() {
    var uad = navigator.userAgentData && navigator.userAgentData.platform;
    var ua = navigator.userAgent || '';
    if (/android/i.test(uad || ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/windows/i.test(uad || ua)) return 'windows';
    if (/mac/i.test(uad || ua)) return 'mac';
    if (/linux|cros/i.test(uad || ua)) return 'linux';
    return 'diger';
  }

  function send() {
    if (sent) return;
    if (!(window.goatcounter && window.goatcounter.count)) { setTimeout(send, 500); return; }
    sent = true;
    var p = platform();
    window.goatcounter.count({ path: 'aktif/' + p, title: 'Aktif ziyaretçi · ' + p, event: true });

    var n = newVisitNumber();
    if (!n) return; // aynı gelişin devamı ya da depolama kapalı

    var label = n === 1 ? 'ilk' : String(n);
    window.goatcounter.count({ path: 'donus/' + label, title: 'Kaçıncı ziyaret · ' + label, event: true });

    var id = visitorId();
    if (id) {
      window.goatcounter.count({ path: 'ziyaretci/' + id + '/' + n, title: 'Ziyaretçi · ' + id + ' · ' + n + '. geliş', event: true });
    }
  }

  // Bu tarayıcıya ait 8 karakterlik rastgele kimlik; ilk seferde üretilir. Depolama kapalıysa '' döner.
  function visitorId() {
    try {
      var id = localStorage.getItem('ziyaretci-id');
      if (!/^[a-z0-9]{8}$/.test(id || '')) {
        var bytes = new Uint8Array(8), chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        crypto.getRandomValues(bytes);
        id = '';
        for (var i = 0; i < bytes.length; i++) id += chars[bytes[i] % chars.length];
        localStorage.setItem('ziyaretci-id', id);
      }
      return id;
    } catch (e) {
      return '';
    }
  }

  // Yeni bir gelişse kaçıncı (en az 8 sn süren) geliş olduğunu döner; son hareketten 1 dk geçmediyse
  // ya da depolama kapalıysa 0 döner ve hiçbir şey gönderilmez.
  function newVisitNumber() {
    try {
      var now = Date.now(), prev = parseInt(localStorage.getItem('son-ziyaret'), 10) || 0;
      localStorage.setItem('son-ziyaret', String(now));
      if (prev && now - prev < VISIT_GAP_MS) return 0;
      var n = (parseInt(localStorage.getItem('ziyaret-sayisi'), 10) || 0) + 1;
      localStorage.setItem('ziyaret-sayisi', String(n));
      return n;
    } catch (e) {
      return 0;
    }
  }

  // Sayfadan ayrılırken son hareket zamanını güncelle; uzun kalıp kısa süre sonra dönen aynı gelişte sayılsın.
  function touch() {
    if (!sent) return;
    try { localStorage.setItem('son-ziyaret', String(Date.now())); } catch (e) {}
  }

  function tick() {
    if (sent) return;
    var now = Date.now();
    if (document.visibilityState === 'visible') {
      if (last !== null) visibleMs += now - last;
      last = now;
      if (visibleMs >= NEEDED_MS) { send(); return; }
    } else {
      last = null;
    }
    setTimeout(tick, 1000);
  }

  document.addEventListener('visibilitychange', function () {
    last = null;
    if (document.visibilityState === 'hidden') touch();
  });
  window.addEventListener('pagehide', touch);
  tick();
})();
  
