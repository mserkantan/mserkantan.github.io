// Gerçek ziyaretçi sinyali: sayfa en az 8 saniye ekranda görünür kalırsa
// GoatCounter'a platformla birlikte bir event gönderir (ör. "aktif/android").
// Link tarayıcı botlar sayfayı açıp hemen kapattığı için bu sayıya girmez.
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
  
