# serkantan.org — proje notları

Bu repo (`mserkantan/mserkantan.github.io`) serkantan.org’u GitHub Pages üzerinden yayınlıyor.
Kullanıcı Türkçe konuşuyor; yanıtları Türkçe ver.

## Barındırma ve alan adı
- Hosting: GitHub Pages, `master` dalı, kök klasör (`/`). Push edilen her şey 1–2 dakikada yayına girer.
- Repo eskiden karpathy/karpathy.github.io’nun fork’u olan bir Jekyll blogu. Eski dosyalar (`_posts`, `_layouts` vb.) hâlâ duruyor; ana sayfa artık düz HTML olan `index.html`.
  - `index.html` başında Jekyll front matter (`---`) YOK, böyle kalsın; Jekyll onu olduğu gibi kopyalıyor.
- Custom domain: `www.serkantan.org` (repo kökündeki `CNAME` dosyası). Silme.
- DNS, Squarespace Domains’te yönetiliyor:
  - `@` için 4 A kaydı: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
  - `www` için CNAME → `mserkantan.github.io`
  - “Email Security” ve “Domain Connect” preset’lerine dokunma.
- HTTPS: Let’s Encrypt sertifikası 18 Ekim 2026’da geldi (`serkantan.org` + `www`), “Enforce HTTPS” açık. GitHub sertifikayı kendisi yeniliyor.
  - Sertifika bir gün “1 of 3 — Certificate Requested”ta takılırsa: Pages’te custom domain’i `serkantan.org` ↔ `www.serkantan.org` arasında iki tur değiştirip `www`’da bırakmak işe yaradı. Aynı alanı silip eklemek yaramadı; sık deneme Let’s Encrypt limitlerine takılır.
  - Pages’te domain değişince GitHub `CNAME` dosyasına commit atar; sonrasında yerel repoyu güncelle.
- Ziyaretçi sayacı: GoatCounter (çerezsiz), `index.html` sonundaki script, panel `mserkantan.goatcounter.com`.
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
Değişecek yerler (`index.html`):
- `<title>`, `<meta name="description">`, `.eyebrow` içindeki ay (`10 / 26`), `.caption` (“EKİM 2026 — …”)
- `h1` (şarkı adı), `.artist`
- `VIDEO_ID` (resmi YouTube klibi), Spotify ve Apple Music linkleri (doğrudan şarkı linki; Spotify’daki `?si=` takip parametresini at)
- “Şarkı” / “Sanatçı” metinleri ve footer’daki “Orijinal” satırı (cover değilse kaldır)
- Footer’daki paylaşım tarihi: `<time class="posted" datetime="YYYY-MM-DD">` (hem `datetime` hem görünen metin)
- Yorum script’indeki `PAGE_ID` (örn. `2026-11`): her ayın yorumları ayrı tutulur, eski ayınkiler veritabanında kalır
- Dizeler kullanıcıdan gelir; kendin yazma.

Kurallar:
- Şarkı sözü veya albüm kapağı koyma (telif).
- Şarkı/sanatçı bilgilerini güncel kaynaklardan doğrula; tahmin etme.
- Linkleri eklemeden önce çalıştıklarını kontrol et.
- Commit mesajları Türkçe ve açıklayıcı olsun (örn. “Kasım 2026 ayın müziği: …”).
- Push etmeden önce kullanıcıya ne değiştiğini kısaca söyle.
