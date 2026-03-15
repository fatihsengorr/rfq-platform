# Mimari Tasarım

## 1. Neden Bu Mimari?

Sistem, önce iç kullanımda teklif operasyonunu çözecek; sonrasında CRM ve lead takibi gibi modüller eklenebilecek. Bu yüzden **modüler monolith** yaklaşımı seçildi.

Avantajlar:

- Tek deploy, düşük operasyon maliyeti
- Modül bazında net ayrım (RFQ, teklif, onay, dosya, kullanıcı, CRM)
- İleride istenirse servis ayrıştırmasına uygun domain sınırları

## 2. Bounded Context / Modüller

- `identity-access`: kullanıcı, rol, yetki
- `rfq`: talep açma, deadline, durum akışı
- `quotation`: teklif oluşturma, revizyon, versiyonlama
- `approval`: İstanbul Müdürü onay süreci
- `attachments`: dosya metadatası, storage bağlantıları
- `audit`: işlem geçmişi
- `crm` (gelecek): firma, kontak, lead, fırsat

## 3. Süreç Akışı (özet)

1. Londra RFQ açar: proje adı, deadline, proje bilgisi, talep eden kişi + dosyalar
2. İstanbul fiyatlama inceleme/fiyatlama yapar
3. Teklif versiyonu oluşturulur (`V1`)
4. Müdür onayı gerekiyorsa onaya gönderilir
5. Onay sonrası Londra tarafı "gönderildi" durumunu görür
6. Revizyon talebi gelirse `V2`, `V3` olarak ilerler

## 4. Durum Modeli

RFQ durumları:

- `NEW`
- `IN_REVIEW`
- `PRICING_IN_PROGRESS`
- `PENDING_MANAGER_APPROVAL`
- `QUOTED`
- `REVISION_REQUESTED`
- `CLOSED`

## 5. Veri Modeli İlkeleri

- Tüm iş adımları `audit_log` ile izlenir
- Dosyalar storage'da, DB'de sadece metadata + URL/key tutulur
- Teklif revizyonları immutable tutulur (eski versiyon değişmez)
- Onay kayıtları ayrı tabloda saklanır
- Gelecekteki CRM için `customer_company`, `contact`, `lead` tabloları önceden eklendi

## 6. Mobil Stratejisi

İlk sürüm web + PWA:

- responsive ekranlar
- manifest + service worker (ilerleyen adım)
- aynı API ile React Native (Expo) uygulaması kolayca bağlanabilir
