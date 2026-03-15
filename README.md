# RFQ & Teklif Takip Platformu

Bu repo, Londra satış ekibi ile İstanbul fiyatlama ekibinin teklif sürecini tek sistemde takip edebilmesi için hazırlanmış genişlemeye açık bir monorepo başlangıcıdır.

## Hedef

- RFQ (teklif talebi) açma, takip etme
- Dosya ekleri (resim, çizim, PDF) ile süreç yönetimi
- Teklif versiyonlama (V1, V2, V3...)
- İstanbul Müdürü onay akışı
- İç kullanım odaklı ilk sürüm
- Gelecekte CRM/lead/firma-kontak modülleri eklenebilecek mimari

## Mimari Karar

- `apps/api`: Modüler backend API (TypeScript)
- `apps/web`: Next.js tabanlı web + PWA kabuğu
- `packages/shared`: Ortak tipler ve domain sabitleri
- Veritabanı: PostgreSQL (Prisma şeması dahil)

Detaylar: `/Users/fatihsengor/Codex/CRM/docs/architecture.md`
Release süreci: `/Users/fatihsengor/Codex/CRM/docs/release-workflow.md`
AWS Lightsail deploy: `/Users/fatihsengor/Codex/CRM/docs/aws-lightsail-runbook.md`

## Rollerin Kapsamı

- `LONDON_SALES`: RFQ açar, talep detayını revize eder, talep dosyası yükler
- `ISTANBUL_PRICING`: Sadece kendine atanmış RFQ’lar için teklif sürümü oluşturur ve teklif dosyası yükler
- `ISTANBUL_MANAGER`: RFQ’yu pricing kullanıcılarına atar, teklif onaylar / reddeder
- `ADMIN`: Sistem yönetimi

Not:
- London kullanıcıları yalnızca onaylanmış (`APPROVED`) teklifleri ve dosyalarını görebilir.
- Müdür onayı olmayan teklifler London tarafında görünmez.
- Admin paneli: `/admin/users` üzerinden kullanıcı oluşturma, rol, aktif/pasif ve şifre yönetimi yapılır.
- Kullanıcılar `/account` ekranından kendi şifresini değiştirebilir.
- Şifresini unutan kullanıcılar `/forgot-password` ve `/reset-password` akışını kullanabilir.

## Hızlı Başlangıç (iskelet)

1. Monorepo bağımlılıklarını kurun:
   - `pnpm install`
2. Altyapıyı ayağa kaldırın:
   - `docker compose up -d`
3. Veritabanı bağlantısını ayarlayın (`apps/api/.env`):
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:55432/rfq_platform`
4. MinIO bağlantısını ayarlayın (`apps/api/.env`):
   - `STORAGE_ENDPOINT=localhost`
   - `STORAGE_PORT=9000`
   - `STORAGE_ACCESS_KEY=minio`
   - `STORAGE_SECRET_KEY=minio123`
   - `STORAGE_BUCKET=rfq-attachments`
   - `PUBLIC_API_BASE_URL=http://localhost:4000`
5. Web API bağlantısını ayarlayın (`apps/web/.env`):
   - `API_BASE_URL=http://localhost:4000`
6. Opsiyonel başlangıç admin kullanıcısı (`apps/api/.env`):
   - `BOOTSTRAP_ADMIN_EMAIL=admin@company.local`
   - `BOOTSTRAP_ADMIN_PASSWORD=<strong-password>`
   - `BOOTSTRAP_ADMIN_NAME=Platform Admin`
7. Auth güvenlik ayarları (`apps/api/.env`):
   - `AUTH_JWT_SECRET=<strong-random-secret>`
   - `ALLOW_LEGACY_PASSWORD_UPGRADE=true|false` (production için `false`)
   - `APP_WEB_BASE_URL=http://localhost:3000` (reset link üretimi için)
8. Prisma migration:
   - `pnpm --filter api prisma migrate dev`
9. Uygulamaları çalıştırın:
   - `pnpm dev`

## Geliştirme Ortamı Sorun Giderme

- Eğer web tarafında `Unhandled Runtime Error: TypeError: NetworkError when attempting to fetch resource` görüyorsanız, önce web geliştirme sunucusunu temiz başlatın:
  - `pnpm --filter web dev:clean`
- Eğer 3000 portu doluysa çalışan süreci bulun ve kapatın:
  - `lsof -nP -iTCP:3000 -sTCP:LISTEN`
  - `kill -9 <PID>`
- API için benzer kontrol:
  - `lsof -nP -iTCP:4000 -sTCP:LISTEN`
  - `pnpm --filter api dev`

## Güvenlik Notları

- Şifreler `scrypt` ile hashlenir, plaintext saklanmaz.
- Şifre politikası: en az 12 karakter + büyük harf + küçük harf + sayı + özel karakter.
- Yetki kontrolü, her API isteğinde token + veritabanındaki güncel kullanıcı rolü/aktiflik bilgisi ile yapılır.
- Forgot password tokenları hashlenerek saklanır, tek kullanımlıktır ve süreli geçerlidir.

## Reasoning Ayarı (Codex kullanımı)

- Mimari/veri modeli/iş akışı: `High`
- Rutin CRUD ekran/endpoint: `Medium`
- Küçük bugfix/refactor: `Low` veya `Medium`
