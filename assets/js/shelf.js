// Arşiv rafı: /data/months.json'daki ayları yatay kaydırılan kartlar olarak gösterir.
// En az 2 ay olana kadar raf gizli kalır.
(function () {
  const shelf = document.getElementById('shelf');
  if (!shelf) return;
  const track = shelf.querySelector('.shelf-track');
  const current = document.body.dataset.month;
  const ns = 'http://www.w3.org/2000/svg';

  function moon(colors, id) {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('shelf-moon');
    const defs = document.createElementNS(ns, 'defs');
    const g = document.createElementNS(ns, 'radialGradient');
    g.id = 'shelf-moon-' + id;
    g.setAttribute('cx', '32%'); g.setAttribute('cy', '27%'); g.setAttribute('r', '82%');
    const stops = colors && colors.length ? colors : ['#edc18b', '#d59b65', '#b67347', '#8b4c32'];
    stops.forEach((c, i) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', String(i / (stops.length - 1)));
      s.setAttribute('stop-color', c);
      g.append(s);
    });
    defs.append(g);
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', '50'); ring.setAttribute('cy', '50'); ring.setAttribute('r', '47');
    ring.setAttribute('class', 'shelf-orbit');
    const disc = document.createElementNS(ns, 'circle');
    disc.setAttribute('cx', '50'); disc.setAttribute('cy', '50'); disc.setAttribute('r', '38');
    disc.setAttribute('fill', 'url(#' + g.id + ')');
    svg.append(defs, ring, disc);
    return svg;
  }

  function card(m) {
    const a = document.createElement('a');
    a.className = 'shelf-card';
    a.href = m.url;
    if (m.id === current) a.setAttribute('aria-current', 'page');
    const label = document.createElement('span');
    label.className = 'shelf-month';
    label.textContent = m.label;
    const title = document.createElement('span');
    title.className = 'shelf-title';
    title.textContent = m.title;
    const artist = document.createElement('span');
    artist.className = 'shelf-artist';
    artist.textContent = m.artist;
    a.append(moon(m.moon, m.id), label, title, artist);
    return a;
  }

  function updateArrows() {
    const max = track.scrollWidth - track.clientWidth - 2;
    shelf.querySelector('.shelf-prev').disabled = track.scrollLeft <= 2;
    shelf.querySelector('.shelf-next').disabled = track.scrollLeft >= max;
  }

  fetch('/data/months.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : []))
    .then(months => {
      if (!Array.isArray(months) || months.length < 2) return; // tek ayken raf gizli
      months.slice().reverse().forEach(m => track.append(card(m))); // en yeni solda
      shelf.hidden = false;
      const step = () => track.clientWidth * 0.8;
      shelf.querySelector('.shelf-prev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      shelf.querySelector('.shelf-next').addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
      track.addEventListener('scroll', updateArrows, { passive: true });
      window.addEventListener('resize', updateArrows);
      const active = track.querySelector('[aria-current="page"]');
      if (active) track.scrollLeft = Math.max(0, active.offsetLeft - track.offsetLeft - 8);
      updateArrows();
    })
    .catch(() => {});
})();
