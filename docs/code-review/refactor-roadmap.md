# Refactor Roadmap

Status di bawah adalah disposition final berbasis bukti pada checkout ini. Ukuran menggunakan S/M/L dan risiko menyatakan dampak bila perubahan salah.

| Batch | Status | Scope | Ukuran | Risiko | Bukti/test | Sisa sebelum complete |
|---|---|---|---|---|---|---|
| A — Safety net | Completed | App factory, config validation, syntax, lint, dan test command | M | Sedang | `test/app.test.js`, `npm run check` | — |
| B — P0/P1 | Completed | Status auth, safe 5xx response, tenant scope, audit identity, dependency audit | L | Tinggi | auth/audit/cashflow tests, `npm audit --omit=dev` | — |
| C — Error foundation | Accepted | Error helper, validation, response sanitizer, pilot master item | M | Sedang | `test/app.test.js`, `test/masterItem.controller.test.js`, REV-002 | Safe 5xx transport telah berlaku global. Migrasi error class/async handler repository-wide diterima sebagai debt terpisah agar tidak mengubah contract controller tanpa characterization test per modul. |
| D — Shared utilities | Deferred | Date helper, logging opt-in, CORS config, graceful shutdown | M | Sedang | `test/serverShutdown.test.js`, REV-019 | Ditunda sampai kebijakan storage UTC/Asia-Jakarta disetujui oleh pemilik business rule dan ada test batas tengah malam. Structured logger serta timeout email/Google/Puppeteer memerlukan keputusan observability dan contract failure eksternal. |
| E — Modul pilot | Completed | CRUD master item dan characterization test | M | Rendah | `test/masterItem.controller.test.js` | — |
| F — CRUD backoffice | Deferred | Akses, dashboard, mesin, users/owner, menu | L | Sedang | `test/coreDomains.integration.test.js`, audit tests | Explicit-column migration ditunda hingga response contract setiap endpoint dicapture. Tidak ada penggantian `SELECT *` massal tanpa snapshot agar tidak memutus client yang bergantung pada field lama. |
| G — Owner/kasir | Accepted | Mobile auth, kasir, stok, cashflow, history, harga, dan absensi | L | Tinggi | `mobileAuth.integration.test.js`, `authorization.middleware.test.js`, `test/coreDomains.integration.test.js`, REV-020, REV-021 | Matrix negative authorization dan scope absensi lintas cabang/mitra telah tertutup. Alias machine-control legacy bukan scope authorization owner/kasir; tindak lanjutnya dicatat pada H. |
| H — Transaksi/MQTT | Accepted | Transaction database flow, ACK utility, READY listener lifecycle | L | Tinggi | `test/mesin.model.test.js`, `test/coreDomains.integration.test.js`, `test/serverShutdown.test.js`, `test/mqttFakeBroker.test.js`, REV-015, REV-019 | Fake MQTT mencakup ACK sukses, request ID salah, negative ACK, timeout, connection close, dan READY update. Paritas firmware fisik tetap verifikasi operasional terpisah. |
| I — Dependency & docs | Deferred | npm lockfile, audit, README, API map, Postman verified core requests | M | Sedang | `npm audit --omit=dev`, Postman JSON parse, REV-018 | Ditunda sampai audit penggunaan dependency frontend selesai dan seluruh request Postman legacy direfresh serta smoke-verified terhadap contract yang aktif. |

## Formal disposition register

`Accepted` berarti scope batch memiliki mitigasi dan bukti yang memadai untuk checkout ini; pekerjaan tersisa dipisahkan agar tidak menjadi completion claim tersembunyi. `Deferred` berarti tidak boleh dikerjakan secara opportunistic: keputusan atau bukti pembuka di bawah wajib tersedia sebelum statusnya dapat berubah menjadi `Completed`.

| Batch | Disposition | Reason and scope boundary | Reopen trigger | Required closure evidence |
|---|---|---|---|---|
| C | Accepted | REV-002 menjamin response 5xx aman pada transport global. Standardisasi error class/async handler seluruh controller adalah perubahan contract per modul, bukan syarat keamanan transport yang tersisa. | Ada modul yang akan diubah atau ditemukan 4xx/5xx tidak konsisten. | Characterization 4xx/5xx untuk modul yang dimigrasi dan regression suite hijau. |
| D | Deferred | Tidak ada keputusan business tentang UTC versus Asia/Jakarta untuk storage/timestamp. Structured logging dan timeout eksternal juga belum memiliki policy redaction, level, dan failure contract. | Pemilik business menyetujui kebijakan waktu atau layanan eksternal akan diubah. | Test batas tengah malam, redaction test, dan timeout test untuk setiap adapter yang diubah. |
| F | Deferred | `SELECT *` masih dipakai oleh beberapa CRUD. Mengganti kolom tanpa inventory field response berisiko memutus backoffice/client lama. | Contract endpoint telah dicapture per domain. | Snapshot response dan test regresi per endpoint yang query-nya diubah. |
| G | Accepted | REV-020 dan REV-021 serta test integrasi menutup scope owner/kasir saat ini, termasuk penolakan role/scope dan cabang/mitra lintas batas. | Ada route owner/kasir baru atau perubahan scope token. | Negative authorization test untuk route family yang berubah. |
| H | Accepted | Database flow, ACK utility, lifecycle listener, dan rangkaian ACK start/stop telah diuji dengan fake MQTT. Firmware fisik tidak boleh dianggap test repository. | Contract topic/payload berubah atau hasil verifikasi perangkat fisik menemukan perbedaan. | Regression fake MQTT hijau; catatan verifikasi perangkat fisik tetap terpisah. |
| I | Deferred | Core Postman request telah diverifikasi, tetapi request legacy dan audit dependency frontend belum selesai. | Client legacy akan dipakai atau dependency frontend akan diperbarui. | Collection import/parse, smoke request legacy terhadap API aktif, dan audit penggunaan dependency frontend. |

Physical-device firmware parity remains an operational deployment verification, not an automated repository test.
