// Comments: stored in Supabase (table "comments"). Visitors can only read approved rows and insert unapproved ones (RLS).
// The publishable key is meant to be public; never put the secret key here. ?onizleme shows DEMO data for design checks.
(function () {
  const SUPABASE_URL = 'https://lyjgwzatxasvwopmsect.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_eQTR4QVW4xhK3sdECmB62w_kHBnLwkH';
  const PAGE_ID = document.body.dataset.month; // örn. "2026-10": her ayın yorumları ayrı
  const DEMO = [
    { name: 'Deniz', body: 'Neil Young’ın versiyonunu babamdan dinlerdim. LP’nin sesinde bambaşka bir sıcaklık var.', created_at: '2026-10-18T20:40:00+03:00' },
    { name: 'Ece', body: 'Akşam yürüyüşünde açtım, ay da tam karşımdaydı.\nTesadüf mü?', created_at: '2026-10-18T21:12:00+03:00' }
  ];

  const dialog = document.getElementById('yorumlar');
  if (!dialog || !PAGE_ID) return;
  const opener = document.getElementById('open-comments');
  const ocCount = document.getElementById('oc-count');
  const form = document.getElementById('comment-form');
  const list = document.getElementById('comment-list');
  const count = document.getElementById('comments-count');
  const status = document.getElementById('form-status');
  const nameEl = document.getElementById('c-name');
  const bodyEl = document.getElementById('c-body');
  const left = document.getElementById('c-left');
  const send = form.querySelector('.send');
  const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  function render(comments) {
    list.replaceChildren();
    count.textContent = comments.length ? comments.length + ' yorum' : '';
    ocCount.textContent = comments.length || '';
    opener.setAttribute('aria-label', comments.length ? 'Yorumlar (' + comments.length + ')' : 'Yorumlar');
    if (!comments.length) {
      const empty = document.createElement('li');
      empty.className = 'comments-empty';
      empty.textContent = 'İlk yorumu sen yaz.';
      list.append(empty);
      return;
    }
    for (const c of comments) {
      const li = document.createElement('li');
      li.className = 'comment';
      const meta = document.createElement('div');
      meta.className = 'comment-meta';
      const name = document.createElement('span');
      name.className = 'comment-name';
      name.textContent = c.name;
      const time = document.createElement('time');
      time.className = 'comment-date';
      time.dateTime = c.created_at;
      time.textContent = fmt.format(new Date(c.created_at));
      meta.append(name, time);
      const body = document.createElement('p');
      body.className = 'comment-body';
      body.textContent = c.body;
      li.append(meta, body);
      list.append(li);
    }
  }

  function update() {
    const remaining = bodyEl.maxLength - bodyEl.value.length;
    left.textContent = bodyEl.value ? remaining + ' karakter kaldı' : '';
    left.classList.toggle('near', remaining < 60);
    send.disabled = !nameEl.value.trim() || !bodyEl.value.trim();
  }
  form.addEventListener('input', update);

  const api = path => SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const preview = new URLSearchParams(location.search).has('onizleme');

  function message(text) {
    list.replaceChildren();
    const li = document.createElement('li');
    li.className = 'comments-empty';
    li.textContent = text;
    list.append(li);
  }

  async function load() {
    if (preview || !SUPABASE_URL) { render(preview ? DEMO : []); return; }
    try {
      const res = await fetch(api('comments?select=name,body,created_at&page_id=eq.' + PAGE_ID + '&approved=is.true&order=created_at.asc'), { headers: { apikey: SUPABASE_KEY } });
      if (!res.ok) throw new Error(res.status);
      render(await res.json());
    } catch (err) {
      message('Yorumlar şu an yüklenemedi.');
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (send.disabled) return;
    // Honeypot filled → most likely a bot; pretend success.
    const bot = form.website.value !== '';
    send.disabled = true;
    status.textContent = '';
    try {
      if (!bot && SUPABASE_URL && !preview) {
        const res = await fetch(api('comments'), {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ page_id: PAGE_ID, name: nameEl.value.trim(), body: bodyEl.value.trim() })
        });
        if (!res.ok) throw new Error(res.status);
      }
      form.reset();
      status.textContent = 'Teşekkürler! Yorumun onaylanınca burada görünecek.';
    } catch (err) {
      status.textContent = 'Gönderilemedi, birazdan tekrar dener misin?';
    }
    update();
  });

  function open() {
    if (dialog.open) return;
    status.textContent = '';
    dialog.showModal();
    if (location.hash !== '#yorumlar') history.replaceState(null, '', '#yorumlar');
  }
  function close() { dialog.close(); }
  opener.addEventListener('click', open);
  dialog.querySelector('.close-dialog').addEventListener('click', close);
  // Click on the backdrop (outside the panel) closes it.
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    if (location.hash === '#yorumlar') history.replaceState(null, '', location.pathname + location.search);
    opener.focus();
  });

  load();
  update();
  if (location.hash === '#yorumlar') open();
})();
  
