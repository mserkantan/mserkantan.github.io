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

## Bekleyen işler
1. **HTTPS:** GitHub → Settings → Pages’te “DNS Check in Progress” bitince sertifika gelecek. Gelince “Enforce HTTPS” kutusu işaretlenmeli (bu adım GitHub arayüzünden yapılır, kullanıcıya hatırlat).
2. **Spotify linki:** Şu an `https://open.spotify.com/search/LP%20Harvest%20Moon` arama linki. Kullanıcı doğrudan şarkı linkini verirse `index.html` içindeki `.alt-links` bölümünde değiştir.

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

- Altta “Şarkı” ve “Sanatçı” bölümleri (kısa, kaynakla doğrulanmış bilgiler)

Ayrıca outputs’ta bir de `template.html` vardı: Serkan’ın kişisel sayfası için ileride kullanılabilecek tam bir şablon (hakkında / projeler / iletişim). Şu an yayında değil.

## Her ay şarkı değiştirirken
Değişecek yerler (`index.html`):
- `<title>`, `<meta name="description">`, `.eyebrow` içindeki ay (`10 / 26`), `.caption` (“EKİM 2026 — …”)
- `h1` (şarkı adı), `.artist`
- `VIDEO_ID` (resmi YouTube klibi), Spotify ve Apple Music linkleri
- “Şarkı” / “Sanatçı” metinleri ve footer’daki “Orijinal” satırı (cover değilse kaldır)
- Footer’daki paylaşım tarihi: `<time class="posted" datetime="YYYY-MM-DD">` (hem `datetime` hem görünen metin)
- Dizeler kullanıcıdan gelir; kendin yazma.

Kurallar:
- Şarkı sözü veya albüm kapağı koyma (telif).
- Şarkı/sanatçı bilgilerini güncel kaynaklardan doğrula; tahmin etme.
- Linkleri eklemeden önce çalıştıklarını kontrol et.
- Commit mesajları Türkçe ve açıklayıcı olsun (örn. “Kasım 2026 ayın müziği: …”).
- Push etmeden önce kullanıcıya ne değiştiğini kısaca söyle.
