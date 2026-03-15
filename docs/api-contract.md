# API Kontratı (MVP)

Base URL: `http://localhost:4000`

Header (auth):

- `Authorization: Bearer <accessToken>`

## Endpointler

1. `GET /health`
2. `POST /api/auth/login`
3. `GET /api/auth/me`
4. `POST /api/auth/forgot-password`
5. `POST /api/auth/reset-password`
6. `PATCH /api/auth/change-password` (Authenticated user)
7. `GET /api/rfqs`
8. `GET /api/rfqs/:id`
9. `POST /api/rfqs`
10. `PATCH /api/rfqs/:id/request` (London request revision)
11. `GET /api/rfqs/pricing-users` (Manager)
12. `POST /api/rfqs/:id/assignment` (Manager)
13. `POST /api/rfqs/:id/quotes` (Assigned Istanbul pricing)
14. `POST /api/rfqs/:id/approval` (Manager)
15. `PATCH /api/rfqs/:id/status` (Manager/Admin)
16. `POST /api/rfqs/:id/attachments`
17. `GET /api/rfqs/attachments/:attachmentId/download`
18. `GET /api/users` (Admin)
19. `POST /api/users` (Admin - create user)
20. `PATCH /api/users/:id/role` (Admin)
21. `PATCH /api/users/:id/active` (Admin)
22. `PATCH /api/users/:id/password` (Admin - set/reset password)

## Rol Kuralları (özet)

- `LONDON_SALES`: RFQ oluşturur, request revize eder, sadece request seviyesinde dosya yükler.
- `ISTANBUL_PRICING`: Sadece kendisine atanmış RFQ’ları görür, teklif girer, teklife dosya yükler.
- `ISTANBUL_MANAGER`: RFQ ataması yapar, teklif onay/red verir.
- `ADMIN`: Tüm işlemler.

## Görünürlük Kuralı

- London kullanıcıları sadece **APPROVED** teklif revizyonlarını görür.
- Onaylanmamış teklif ve teklif dosyaları London tarafında görünmez.

## Örnek Payloadlar

### RFQ oluşturma

```json
{
  "projectName": "Canary Wharf Facade Lighting",
  "deadline": "2026-02-25T15:00:00.000Z",
  "projectDetails": "Panel kalınlığı, kaplama tipi ve montaj detayları ekte.",
  "requestedBy": "James W."
}
```

### Teklif revizyonu ekleme

```json
{
  "currency": "GBP",
  "totalAmount": 145000,
  "notes": "EXW Istanbul, teslim 5 hafta",
  "autoSubmitForApproval": true
}
```

### Müdür onayı

```json
{
  "quoteRevisionId": "uuid",
  "decision": "APPROVED",
  "comment": "Marj uygun"
}
```

### Dosya yükleme (RFQ veya revizyon)

```json
{
  "fileName": "facade_drawing_v3.pdf",
  "mimeType": "application/pdf",
  "base64Data": "<base64-encoded-file-bytes>",
  "quoteRevisionId": "optional-uuid"
}
```

### Kullanıcı oluşturma (Admin)

```json
{
  "email": "new.user@crm.local",
  "fullName": "New User",
  "role": "LONDON_SALES",
  "password": "Str0ng!Pass123",
  "isActive": true
}
```
