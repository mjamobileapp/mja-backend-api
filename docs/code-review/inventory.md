# Code Review Inventory

Inventory ini sengaja mencatat **satu file per baris**. Status menunjukkan kedalaman review pada checkout saat ini; `REVIEWED - HAS FINDING` tetap dipakai bila finding sudah diperbaiki tetapi buktinya masih menjadi bagian dari audit. `DEFERRED` hanya dipakai bila review memang ditunda dengan alasan yang eksplisit.

| File | Tanggung jawab/dependency utama | Status dan finding |
|---|---|---|
| `src/app.js` | Express factory, middleware global, route mount, error flow | REVIEWED - HAS FINDING (REV-001, REV-002, REV-006, REV-019) |
| `src/server.js` | HTTP startup/shutdown dan graceful lifecycle | REVIEWED - HAS FINDING (REV-019) |
| `src/index.js` | Bootstrap aplikasi, static files, CORS, MQTT startup | REVIEWED - HAS FINDING (REV-001, REV-002, REV-006, REV-019) |
| `src/config/database.js` | MySQL pool dan koneksi database | REVIEWED - HAS FINDING (REV-006, REV-022) |
| `src/config/environment.js` | Validasi environment dan default konfigurasi | REVIEWED - HAS FINDING (REV-006, REV-022) |
| `src/middleware/auth.js` | Verifikasi token backoffice | REVIEWED - HAS FINDING (REV-001, REV-021, REV-026) |
| `src/middleware/authMobile.js` | Verifikasi token mobile dan identitas owner/kasir | REVIEWED - HAS FINDING (REV-001, REV-021, REV-026) |
| `src/middleware/authCombined.js` | Kombinasi autentikasi backoffice/mobile | REVIEWED - HAS FINDING (REV-001, REV-021, REV-026) |
| `src/middleware/authorization.js` | Role/menu authorization | REVIEWED - HAS FINDING (REV-001, REV-021, REV-026) |
| `src/middleware/errorHandler.js` | Typed error dan payload global 4xx/5xx | REVIEWED - HAS FINDING (REV-002, REV-003, REV-022) |
| `src/middleware/logs.js` | Request logging dan observability | REVIEWED - HAS FINDING (REV-002, REV-003, REV-022) |
| `src/middleware/multer.js` | Upload multipart | REVIEWED - HAS FINDING (REV-022) |
| `src/middleware/publicAuthRateLimit.js` | Rate limit endpoint autentikasi publik | REVIEWED - HAS FINDING (REV-022) |
| `src/middleware/responseSanitizer.js` | Sanitasi detail response 5xx | REVIEWED - FINDINGS CLOSED (REV-003) |
| `src/middleware/validateTransaksi.js` | DTO dan validasi payload transaksi | REVIEWED - FINDINGS CLOSED (TRANSACTION_BUSINESS_VALIDATION_PLAN) |
| `src/controller/akses.js` | Controller akses role/user | REVIEWED - HAS FINDING (REV-012) |
| `src/controller/cabang.js` | CRUD cabang dan scope mitra | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/controller/cashflow.js` | Cashflow owner/kasir | REVIEWED - HAS FINDING (REV-014, REV-015, REV-021) |
| `src/controller/dashboard.js` | Dashboard backoffice | REVIEWED - HAS FINDING (REV-012) |
| `src/controller/hargaCabang.js` | Konfigurasi harga per cabang | REVIEWED - HAS FINDING (REV-017, REV-021) |
| `src/controller/history.js` | History transaksi dan mesin | REVIEWED - HAS FINDING (REV-014, REV-015, REV-021) |
| `src/controller/kasir.js` | Manajemen kasir, absensi, scope tenant | REVIEWED - HAS FINDING (REV-009, REV-012, REV-020) |
| `src/controller/masterItem.js` | CRUD master item | REVIEWED - HAS FINDING (REV-004, REV-005) |
| `src/controller/menus.js` | CRUD menu backoffice | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/controller/mesin.js` | CRUD mesin dan status detail | REVIEWED - HAS FINDING (REV-012, REV-015) |
| `src/controller/mitra.js` | CRUD mitra | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/controller/mobile.js` | Login, aktivasi, dan mobile account flow | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| `src/controller/notifikasi.js` | Daftar dan read notification | REVIEWED - HAS FINDING (REV-016, REV-020) |
| `src/controller/roles.js` | CRUD role | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/controller/settingStokMitra.js` | Setting stok tenant | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| `src/controller/transaksi.js` | Validasi/use-case transaksi dan machine-control | REVIEWED - HAS FINDING (REV-014, REV-015, REV-017, REV-021, REV-026) |
| `src/controller/userOwner.js` | CRUD owner mobile | REVIEWED - HAS FINDING (REV-008, REV-009) |
| `src/controller/users.js` | CRUD user backoffice | REVIEWED - HAS FINDING (REV-008) |
| `src/models/akses.js` | Query akses role/user | REVIEWED - HAS FINDING (REV-012) |
| `src/models/cabang.js` | Query dan transaction cabang | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/models/cashflow.js` | Query dan transaction cashflow | REVIEWED - HAS FINDING (REV-014, REV-015, REV-021) |
| `src/models/dashboard.js` | Query agregasi dashboard | REVIEWED - HAS FINDING (REV-012) |
| `src/models/emailTemplate.js` | Template email | REVIEWED - FINDINGS CLOSED (async error cleanup) |
| `src/models/hargaCabang.js` | Query harga per cabang | REVIEWED - HAS FINDING (REV-017, REV-021) |
| `src/models/history.js` | Query history transaksi/mesin | REVIEWED - HAS FINDING (REV-014, REV-015, REV-021) |
| `src/models/kasir.js` | Query kasir dan absensi | REVIEWED - HAS FINDING (REV-009, REV-012, REV-020) |
| `src/models/masterItem.js` | Query master item dan soft delete | REVIEWED - HAS FINDING (REV-005) |
| `src/models/menus.js` | Query menu | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/models/mesin.js` | Query mesin/detail dan maintenance | REVIEWED - HAS FINDING (REV-012, REV-015) |
| `src/models/mitra.js` | Query dan transaction mitra | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/models/notifikasi.js` | Query notification | REVIEWED - FINDINGS CLOSED (async error cleanup) |
| `src/models/roles.js` | Query role | REVIEWED - HAS FINDING (REV-011, REV-023) |
| `src/models/settingStokMitra.js` | Query setting stok tenant | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| `src/models/transaksi.js` | Transaction lifecycle dan MQTT log/rollback | REVIEWED - HAS FINDING (REV-014, REV-015, REV-017, REV-021, REV-026) |
| `src/models/userMobile.js` | Query mobile user dan aktivasi | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| `src/models/userOwner.js` | Query owner mobile | REVIEWED - HAS FINDING (REV-008, REV-009) |
| `src/models/users.js` | Query user backoffice | REVIEWED - HAS FINDING (REV-008) |
| `src/routes/absensiKasir.js` | Route absensi kasir | REVIEWED - HAS FINDING (REV-009, REV-012, REV-020) |
| `src/routes/akses.js` | Route akses | REVIEWED - HAS FINDING (REV-009, REV-012) |
| `src/routes/cabang.js` | Route cabang | REVIEWED - HAS FINDING (REV-009, REV-011, REV-012) |
| `src/routes/cashflow.js` | Route cashflow | REVIEWED - HAS FINDING (REV-009, REV-014, REV-021) |
| `src/routes/dashboard.js` | Route dashboard | REVIEWED - HAS FINDING (REV-009, REV-012) |
| `src/routes/hargaCabang.js` | Route harga cabang | REVIEWED - HAS FINDING (REV-009, REV-017, REV-021) |
| `src/routes/history.js` | Route history owner | REVIEWED - HAS FINDING (REV-009, REV-014, REV-021) |
| `src/routes/historyKasir.js` | Route history kasir | REVIEWED - HAS FINDING (REV-009, REV-014, REV-021) |
| `src/routes/kasir.js` | Route manajemen kasir | REVIEWED - HAS FINDING (REV-009, REV-012, REV-020) |
| `src/routes/login.js` | Route login publik | REVIEWED - HAS FINDING (REV-001, REV-003, REV-022) |
| `src/routes/masterItem.js` | Route master item | REVIEWED - HAS FINDING (REV-004, REV-005, REV-009) |
| `src/routes/menus.js` | Route menu | REVIEWED - HAS FINDING (REV-009, REV-011, REV-023) |
| `src/routes/mesin.js` | Route mesin | REVIEWED - HAS FINDING (REV-009, REV-012, REV-015) |
| `src/routes/mitra.js` | Route mitra | REVIEWED - HAS FINDING (REV-009, REV-011, REV-023) |
| `src/routes/mobile.js` | Route mobile auth/account | REVIEWED - HAS FINDING (REV-001, REV-009, REV-016, REV-020) |
| `src/routes/roles.js` | Route role | REVIEWED - HAS FINDING (REV-009, REV-011, REV-023) |
| `src/routes/settingStokMitra.js` | Route setting stok | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| `src/routes/transaksi.js` | Route transaksi kasir | REVIEWED - HAS FINDING (REV-009, REV-014, REV-017, REV-021, REV-026) |
| `src/routes/transaksiStartMesin.js` | Alias route machine-control | REVIEWED - HAS FINDING (REV-015, REV-026) |
| `src/routes/userOwner.js` | Route owner | REVIEWED - HAS FINDING (REV-008, REV-009) |
| `src/routes/users.js` | Route user backoffice | REVIEWED - HAS FINDING (REV-008, REV-009) |
| `src/domain/transaksi.js` | Normalisasi uang dan business validation murni | REVIEWED - FINDINGS CLOSED (TRANSACTION_BUSINESS_VALIDATION_PLAN) |
| `src/services/transaksi.js` | Orkestrasi use-case transaksi tanpa Express | REVIEWED - FINDINGS CLOSED (TRANSACTION_BUSINESS_VALIDATION_PLAN) |
| `src/utils/catchAsync.js` | Forward rejection async ke Express | REVIEWED - FINDINGS CLOSED (ASYNC_ERROR_HANDLING_PLAN) |
| `src/utils/date.js` | UTC storage dan tampilan Asia/Jakarta | REVIEWED - HAS FINDING (REV-004, REV-024) |
| `src/utils/email.js` | Pengiriman email dan timeout | REVIEWED - HAS FINDING (REV-003, REV-022) |
| `src/utils/httpError.js` | Factory typed HTTP error | REVIEWED - FINDINGS CLOSED (ASYNC_ERROR_HANDLING_PLAN) |
| `src/utils/jwt.js` | JWT signing/verification | REVIEWED - HAS FINDING (REV-003, REV-024) |
| `src/utils/mqttClient.js` | Publish dan ACK MQTT | REVIEWED - HAS FINDING (REV-015, REV-019, REV-025) |
| `src/utils/mqttStatusListener.js` | Listener status/READY dan cleanup | REVIEWED - HAS FINDING (REV-015, REV-019, REV-025) |
| `src/utils/password.js` | Generate/hash password | REVIEWED - HAS FINDING (REV-003) |
| `src/utils/publicAuth.js` | Generic response reset-password | REVIEWED - HAS FINDING (REV-003, REV-022) |
| `src/utils/transaction.js` | Standard commit/rollback/release helper | REVIEWED - FINDINGS CLOSED (DATABASE_TRANSACTION_HELPER_PLAN) |
| `src/utils/validation.js` | Required-field validation | REVIEWED - FINDINGS CLOSED (ASYNC_ERROR_HANDLING_PLAN) |
| `scripts/check-postman-collection.js` | Route catalog consistency gate | REVIEWED - FINDINGS CLOSED (REV-018) |
| `scripts/check-refactor-quality.js` | Async, 5xx, pricing, timestamp, rethrow quality gates | REVIEWED - FINDINGS CLOSED (REV-007, REV-018) |
| `scripts/check-syntax.js` | Repository syntax gate | REVIEWED - FINDINGS CLOSED (REV-007) |
| `scripts/migrate-machine-log-actor.js` | Schema migration `tbl_log_mesin` | REVIEWED - FINDINGS CLOSED (machine-log actor migration) |
| `scripts/refactor-quality-rules.js` | Reusable source quality-rule detectors | REVIEWED - FINDINGS CLOSED (REV-007, REV-018) |
| `generateRefreshToken.js` | Operational Google OAuth refresh-token helper | REVIEWED - FINDINGS CLOSED (REV-006) |
| `package.json` | Dependency dan quality-gate scripts | REVIEWED - FINDINGS CLOSED (REV-006, REV-007, REV-018) |
| `package-lock.json` | Dependency lockfile | REVIEWED - FINDINGS CLOSED (REV-006, REV-007) |
| `.gitignore` | Secret/build artifact exclusion | REVIEWED - FINDINGS CLOSED (REV-006, REV-013) |
| `README.md` | Setup dan operational documentation | REVIEWED - FINDINGS CLOSED (REV-013) |
| `docs/API_LIST.md` | API route catalog and contract notes | REVIEWED - FINDINGS CLOSED (REV-018) |
| `docs/api-MJAProject.postman_collection.json` | 76 route catalog requests, 13 verified requests | REVIEWED - FINDINGS CLOSED (REV-018) |
| `arduino.txt` | MQTT/firmware command and status contract | DEFERRED - physical-device parity requires hardware verification (REV-015) |
| `Arduino Existing.txt` | Legacy MQTT/firmware comparison contract | DEFERRED - physical-device parity requires hardware verification (REV-015) |
| `.env` | Runtime secret values (contents excluded by policy) | DEFERRED - only tracked-file absence and required variable names are audited |

## Review completion rule

Setiap baris di atas mewakili satu file. Sebelum status berubah menjadi `REVIEWED - NO FINDING` atau `REVIEWED - HAS FINDING`, reviewer harus menelusuri dependency route/middleware/controller/model yang relevan, memeriksa query scope, dan mencatat bukti di `findings.md`. Status `DEFERRED` harus memiliki alasan dan bukti pembuka yang jelas.
