// Gerçek ziyaretçi sinyali: sayfa en az 8 saniye ekranda görünür kalırsa
// GoatCounter'a platformla birlikte bir event gönderir (ör. "aktif/android").
// Link tarayıcı botlar sayfayı açıp hemen kapattığı için bu sayıya girmez.
//
// Ayrıca kaçıncı ziyaret olduğunu sayar ("donus/ilk", "donus/2", "donus/3", "donus/4+") ve
// tarayıcıya bir kez üretilen rastgele bir kimlikle "ziyaretci/<id>" event'i gönderir.
// localStorage'da sadece sayı ("ziyaret-sayisi") ve rastgele kimlik ("ziyaretci-id") tutulur.
(function () {
  var NEEDED_MS = 8000, visibleMs = 0, last = null, sent = false;

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

    var n = visitNumber();
    if (n) {
      var label = n === 1 ? 'ilk' : (n >= 4 ? '4+' : String(n));
      window.goatcounter.count({ path: 'donus/' + label, title: 'Kaçıncı ziyaret · ' + label, event: true });
    }

    var id = visitorId();
    if (id) {
      window.goatcounter.count({ path: 'ziyaretci/' + id, title: 'Ziyaretçi · ' + id, event: true });
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

  // Bu tarayıcının kaçıncı (en az 8 sn süren) ziyareti; depolama kapalıysa 0 döner ve hiçbir şey gönderilmez.
  function visitNumber() {
    try {
      var n = (parseInt(localStorage.getItem('ziyaret-sayisi'), 10) || 0) + 1;
      localStorage.setItem('ziyaret-sayisi', String(n));
      return n;
    } catch (e) {
      return 0;
    }
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

  document.addEventListener('visibilitychange', function () { last = null; });
  tick();
})();
  
