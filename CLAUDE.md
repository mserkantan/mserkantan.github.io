# serkantan.org — proje notları

Bu repo (`mserkantan/mserkantan.github.io`) serkantan.org’u GitHub Pages üzerinden yayınlıyor.
Kullanıcı Türkçe konuşuyor; yanıtları Türkçe ver.

## Barındırma ve alan adı
- Hosting: GitHub Pages, `master` dalı, kök klasör (`/`). Push edilen her şey 1–2 dakikada yayına girer.
- Repo eskiden karpathy/karpathy.github.io’nun fork’u olan bir Jekyll blogu idi; eski blog dosyaları 19 Ekim 2026’da silindi (git geçmişinde duruyor). Repoda sadece bu siteye ait dosyalar var.
- Proje yapısı:
  ```
  index.html            ana sayfa = en yeni ayın kopyası (Jekyll include_relative, tek satır)
  2026/10/index.html    Ekim 2026 sayfası (kalıcı adres: /2026/10/)
  assets/css/site.css   ortak stiller
  assets/js/player.js   “Şarkıyı çal” (video kimliği <body data-video>)
  assets/js/comments.js Supabase yorumları (ay kimliği <body data-month>)
  assets/js/shelf.js    arşiv rafı, data/months.json’dan; en az 2 ay olunca görünür
  assets/js/analytics.js GoatCounter “aktif/<platform>” event’i (8 sn görünürlük)
  data/months.json      arşiv listesi (eskiden yeniye)
  404.html              bulunamadı sayfası
  supabase/             SQL kurulum dosyaları (yayına alınmaz)
  _config.yml           Jekyll ayarı: sadece exclude listesi
  ```
- Ay sayfalarında Jekyll front matter (`---`) YOK; düz HTML olarak kopyalanıyor. Ama ana sayfa onları include ettiği için içlerine `{{` veya `{%` yazma (Liquid olarak işlenir).
- Asset yolları mutlak olmalı (`/assets/...`), çünkü aynı HTML hem `/` hem `/YYYY/MM/` altında çalışıyor.
- Custom domain: `www.serkantan.org` (repo kökündeki `CNAME` dosyası). Silme.
- DNS, Squarespace Domains’te yönetiliyor:
  - `@` için 4 A kaydı: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
  - `www` için CNAME → `mserkantan.github.io`
  - “Email Security” ve “Domain Connect” preset’lerine dokunma.
- HTTPS: Let’s Encrypt sertifikası 18 Ekim 2026’da geldi (`serkantan.org` + `www`), “Enforce HTTPS” açık. GitHub sertifikayı kendisi yeniliyor.
  - Sertifika bir gün “1 of 3 — Certificate Requested”ta takılırsa: Pages’te custom domain’i `serkantan.org` ↔ `www.serkantan.org` arasında iki tur değiştirip `www`’da bırakmak işe yaradı. Aynı alanı silip eklemek yaramadı; sık deneme Let’s Encrypt limitlerine takılır.
  - Pages’te domain değişince GitHub `CNAME` dosyasına commit atar; sonrasında yerel repoyu güncelle.
- Ziyaretçi sayacı: GoatCounter (çerezsiz), ay sayfasının sonundaki script, panel `mserkantan.goatcounter.com`.
  - `assets/js/analytics.js`: sayfa 8 sn görünür kalınca `aktif/android|ios|windows|mac|linux|diger` event’i gider. Meta’nın link tarayıcı botları (2000px ekran; IE/US-OR/SE/US-NE konumları) ham görüntülenmeleri şişiriyor; “gerçek ziyaretçi / platform / saat” soruları için bu event’lere bak.
  - GoatCounter aynı ziyaretçinin (IP + tarayıcı) aynı yolunu 8 saat içinde bir kez sayar. Bu yüzden tekrar gelişler için her gelişe ayrı yol gider: `donus/ilk|2|3…` ve `ziyaretci/<rastgele id>/<n>` (22 Ekim 2026 akşamından önceki kayıtlar `ziyaretci/<id>`, `donus/4+`). Son hareketten 1 dk geçmeden açılış (yenileme, ikinci sekme) aynı geliş sayılır. `/istatistik/` paneli bunları kimlik başına toplar. `ziyaretci/…/<n>` event başlığı `Ziyaretçi · <id> · <n>. geliş · <platform> · <genişlik>×<yükseklik> · <tarayıcı>`; panelin ziyaretçi tablosundaki “Cihaz” sütunu buradan okunur (en son gelişinki), “Son geliş” gün + saat (Türkiye).
  - Export’lar UTC; Türkiye saati için +3. Kendi ziyaretlerini hariç tutmak için cihaz başına `/#toggle-goatcounter`.
- Yorumlar: Supabase, proje “mserkantan's Project” (ref `lyjgwzatxasvwopmsect`, eu-west-1), tablo `public.comments`. Kurulum SQL’i `supabase/comments.sql` (Jekyll’de exclude).
  - Ziyaretçi (anon) sadece onaylı yorumları okur ve onaysız yorum ekler; güncelleyemez, silemez, kendini onaylayamaz (RLS + kolon yetkileri, test edildi).
  - `index.html`’de sadece publishable key var (herkese açık olması normal). Secret/service_role key’i asla sayfaya koyma.
  - Onaylama: Supabase → Table Editor → `comments` → `approved` kutusunu işaretle. Silmek de oradan.
  - E-posta bildirimi: yeni yorumda `comments_notify` tetikleyicisi Resend ile kullanıcının Gmail’ine mail atar (`supabase/notify.sql`, repoda adres yer tutucu). Resend anahtarı Supabase Vault’ta `resend_api_key`; anahtarı kullanıcı girer, sen girme/görme. Gönderim sonucu: `select * from net._http_response order by created desc`. Bildirim hatası yorum kaydını engellemez.
  - Ücretsiz Supabase projeleri uzun süre istek almazsa duraklatılabilir; her sayfa açılışı yorumları okuduğu için normalde aktif kalır. Yorumlar “yüklenemedi” derse önce projenin durumuna bak.
  - Tasarım kontrolü için `?onizleme` örnek yorumlarla açar (gerçek veriye dokunmaz).

## Bekleyen işler
Şu an yok.

## Site: “Bir ay, bir şarkı”
Ana sayfa her ay tek bir şarkıyı öne çıkaran bir sayfa. Şu anki: **Ekim 2026 — LP, “Harvest Moon”** (Neil Young cover’ı, 16 Ekim 2026 single’ı).

Tasarım (kullanıcının kendi tasarımı, koru):
- Kâğıt dokulu açık zemin `#ede9e0`, mürekkep `#292c27`, bakır vurgu `#965332`
- Fontlar: Cormorant Garamond (başlık, şiir) + Manrope (metin)
- Sağda SVG ile çizilmiş bakır tonlu ay; mobilde başlığın altına iniyor
- “Şarkıyı çal” butonu YouTube IFrame API ile butonun altında küçük bir oynatıcı açıp şarkıyı başlatıyor (video ID `UqCx2vvcuOo`). YouTube kuralları gereği oynatıcı gizlenmemeli.
- Altında Spotify ve Apple Music linkleri
- Kullanıcının kendi yazdığı dizeler (son hâli, değiştirmeden önce sor):

  > Aynı şarkıyı dinlediğimizi hayal ediyorum
  > Aynı duygularla ve heyecanla
  > Farklı ortamda, belki de farklı bir insana
  > Gönlümüzü vermişken…
  > *Hâlâ ortak şeylerimizin olabilmesi ne güzel değil mi?*

- Sağ kenarda yarısı ekran dışında duran küçük bir “top” (`.comments-fab`, onaylı yorum sayısı rozetli; hover’da biraz dışarı kayar, mobilde altta ve kenar boşluğu kadar görünür); yorumlar ve yorum formu `<dialog>` içinde açılır (masaüstünde ortada kart, mobilde alttan panel). `#yorumlar` linki pencereyi doğrudan açar.
- Altta “Şarkı” ve “Sanatçı” bölümleri (kısa, kaynakla doğrulanmış bilgiler)

Ayrıca outputs’ta bir de `template.html` vardı: Serkan’ın kişisel sayfası için ileride kullanılabilecek tam bir şablon (hakkında / projeler / iletişim). Şu an yayında değil.

## Her ay şarkı değiştirirken
1. Son ayın klasörünü kopyala: `2026/10/` → `YYYY/MM/` (örn. `2026/11/`).
2. Yeni `YYYY/MM/index.html` içinde değiştir:
   - `<body data-month="YYYY-MM" data-video="YOUTUBE_ID">` (yorumlar ve oynatıcı buradan okur)
   - `<link rel="canonical">` adresi
   - `<title>`, `<meta name="description">`, `.eyebrow` (`11 / 26`), `.caption` (“KASIM 2026 — …”)
   - `h1` (şarkı adı), `.artist`, Spotify ve Apple Music linkleri (doğrudan şarkı linki; Spotify’daki `?si=` parametresini at)
   - Ay çizimi renkleri (`#moon-color` gradient) istenirse o aya göre
   - Şiir: dizeler kullanıcıdan gelir; kendin yazma.
   - “Şarkı” / “Sanatçı” metinleri (güncel kaynaklardan doğrula) ve footer’daki “Orijinal” satırı (cover değilse kaldır)
   - Footer’daki paylaşım tarihi `<time class="posted" datetime="YYYY-MM-DD">`
3. `data/months.json` sonuna yeni ayı ekle (`id`, `url`, `label`, `title`, `artist`, `moon` renkleri). 2. ay eklenince arşiv rafı kendiliğinden görünür.
4. Kök `index.html`’deki `include_relative` yolunu yeni aya çevir.
5. Eski ayların sayfalarına dokunma; kalıcı adresleri bozulmasın.

Kurallar: şarkı sözü veya albüm kapağı koyma (telif); linkleri eklemeden önce dene; commit mesajları Türkçe.
