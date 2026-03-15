# Release Workflow

Bu doküman, proje geliştirmesinin `local -> staging -> production` akışında güvenli ve tekrar edilebilir şekilde yürütülmesi için standartları tanımlar.

## 1. Ortamlar

1. `local`: günlük geliştirme ve ilk doğrulama.
2. `staging`: üretime çıkmadan önce fonksiyonel test ve UAT.
3. `production`: canlı kullanıcıların kullandığı ortam.

## 2. Branch Stratejisi

1. `main`: production'a deploy edilen ana dal.
2. `codex/<feature-or-fix>`: her geliştirme için ayrı dal.

Kurallar:

1. Doğrudan `main` üzerinde geliştirme yapılmaz.
2. Her iş kalemi için yeni branch açılır.
3. Branch adı kısa, okunabilir ve tek bir amaca yönelik olur.

## 3. Geliştirme Akışı

1. Yeni branch aç:
   - `git checkout -b codex/<feature-or-fix>`
2. Local servisleri çalıştır:
   - `pnpm dev`
3. Kod değişikliklerini yap.
4. Tip kontrolü/derleme kontrolü çalıştır:
   - `pnpm --filter web exec tsc --noEmit`
   - `pnpm --filter api exec tsc --noEmit`
5. Feature davranışını localde manuel test et.
6. Commit at:
   - `git add .`
   - `git commit -m "<kısa ve açıklayıcı mesaj>"`
7. Branch'i uzak repoya gönder:
   - `git push -u origin codex/<feature-or-fix>`

## 4. Pull Request ve Staging

1. Branch'ten `main`e PR aç.
2. PR açıldıktan sonra staging deploy tetiklenir.
3. Staging ortamında aşağıdaki iş akışları test edilir:
   - Login/logout
   - Request oluşturma/revizyon
   - Dosya upload/download
   - Quote oluşturma
   - Manager onay/red
   - Role göre görünürlük kuralları
4. Hata varsa aynı branch'te düzeltip tekrar push edilir.

## 5. Production Release

1. Staging onayı alındıktan sonra PR `main`e merge edilir.
2. `main` merge sonrası production deploy otomatik başlar.
3. Deploy sonrası production smoke test yapılır:
   - `/login` erişimi
   - `/requests` listeleme
   - örnek bir RFQ detay sayfası
   - dosya indirme bağlantısı

## 6. Veritabanı ve Migration Kuralları

1. Şema değişiklikleri migration dosyası ile commit edilmelidir.
2. Production'da `prisma migrate dev` kullanılmaz.
3. Production başlangıcında yalnızca:
   - `prisma migrate deploy`
4. Mümkün olduğunca backward-compatible migration yazılır.

## 7. Rollback Planı

1. Hatalı sürüm tespit edilirse son stabil commit'e `revert` yapılır.
2. Revert commit `main`e merge edilerek yeni production deploy tetiklenir.
3. Gerekirse problemli feature flag/endpoint geçici kapatılır.
4. Incident notu açılır ve kök neden analizi (RCA) kayıt altına alınır.

## 8. Konfigürasyon ve Güvenlik

1. Production secret'ları sadece platform secret manager'da tutulur.
2. `.env` dosyaları repo'ya commit edilmez.
3. `AUTH_JWT_SECRET` güçlü ve ortam bazlı olmalıdır.
4. `ALLOW_LEGACY_PASSWORD_UPGRADE=false` production'da zorunlu kabul edilir.

## 9. Operasyon Checklist

Her release öncesi:

1. Staging testleri tamamlandı mı?
2. Migration güvenli mi?
3. Yeni env değişkeni var mı?
4. Rollback adımı net mi?
5. Production smoke test planı hazır mı?
