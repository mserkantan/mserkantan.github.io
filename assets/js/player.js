// “Şarkıyı çal”: butonun altında YouTube oynatıcısını açar ve şarkıyı başlatır.
// Video kimliği sayfadaki <body data-video="…"> özelliğinden okunur.
(function () {
  const btn = document.getElementById('listen');
  const wrap = document.getElementById('player-wrap');
  const VIDEO_ID = document.body.dataset.video;
  if (!btn || !wrap || !VIDEO_ID) return;
  const label = btn.querySelector('.listen-label');
  let player = null, apiLoading = false, wantPlay = false;

  function setPlaying(on) {
    btn.classList.toggle('playing', on);
    btn.setAttribute('aria-pressed', on);
    btn.setAttribute('aria-label', on ? 'Harvest Moon’u duraklat' : 'Harvest Moon’u çal');
    label.textContent = on ? 'Duraklat' : 'Şarkıyı çal';
  }

  function createPlayer() {
    player = new YT.Player('yt', {
      videoId: VIDEO_ID,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: e => { if (wantPlay) e.target.playVideo(); },
        onStateChange: e => {
          if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
          if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
        }
      }
    });
  }

  btn.addEventListener('click', () => {
    if (player && player.getPlayerState) {
      player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
      return;
    }
    wantPlay = true;
    wrap.hidden = false;
    label.textContent = 'Yükleniyor…';
    if (window.YT && YT.Player) { createPlayer(); return; }
    if (apiLoading) return;
    apiLoading = true;
    window.onYouTubeIframeAPIReady = createPlayer;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { label.textContent = 'Oynatıcı açılamadı'; };
    document.head.appendChild(s);
  });
})();
  
