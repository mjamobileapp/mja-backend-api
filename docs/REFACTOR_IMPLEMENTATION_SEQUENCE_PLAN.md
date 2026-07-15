# Urutan Implementasi Terpadu Refactor Backend

## Tujuan Dokumen

Dokumen ini menentukan **urutan wajib** untuk mengimplementasikan tiga rencana berikut:

1. [`ASYNC_ERROR_HANDLING_PLAN.md`](./ASYNC_ERROR_HANDLING_PLAN.md)
2. [`DATABASE_TRANSACTION_HELPER_PLAN.md`](./DATABASE_TRANSACTION_HELPER_PLAN.md)
3. [`TRANSACTION_BUSINESS_VALIDATION_PLAN.md`](./TRANSACTION_BUSINESS_VALIDATION_PLAN.md)

Dokumen ini ditujukan sebagai handoff untuk junior programmer atau model AI dengan konteks terbatas. Gunakan dokumen ini untuk menentukan **pekerjaan mana yang dikerjakan lebih dahulu**. Gunakan ketiga dokumen di atas untuk detail implementasi masing-masing pekerjaan.

Jangan mengimplementasikan satu dokumen sampai selesai lalu berpindah ke dokumen berikutnya. Ketiganya mempunyai dependensi silang dan harus dikerjakan dalam batch terkontrol seperti yang ditetapkan di bawah.

## Aturan Otoritas Dokumen

Jika terdapat kebingungan atau perbedaan interpretasi:

- dokumen ini menjadi sumber kebenaran untuk **urutan, dependensi, batas batch, dan checkpoint**;
- `ASYNC_ERROR_HANDLING_PLAN.md` menjadi sumber kebenaran untuk detail `catchAsync`, typed error, global error handler, dan migrasi controller;
- `DATABASE_TRANSACTION_HELPER_PLAN.md` menjadi sumber kebenaran untuk detail `withTransaction`, lifecycle connection, rollback, commit, dan release;
- `TRANSACTION_BUSINESS_VALIDATION_PLAN.md` menjadi sumber kebenaran untuk validasi payload, domain money, service transaksi, dan server-authoritative pricing;
- perilaku aplikasi dan test yang sudah disepakati tidak boleh diubah hanya untuk mempermudah refactor.

## Ringkasan Urutan Wajib

```text
Fase 0  Baseline, audit, dan characterization test
   ↓
Fase 1  Fondasi catchAsync dan typed error
   ↓
Fase 2  Fondasi withTransaction dan pilot non-transaksi penjualan
   ↓
Fase 3  Migrasi lifecycle database createTransaksi dan akses
   ↓
Fase 4  Pisahkan validasi bisnis createTransaksi tanpa mengubah harga
   ↓
Fase 5  Terapkan server-authoritative pricing
   ↓
Fase 6  Migrasikan controller lain ke catchAsync secara bertahap
   ↓
Fase 7  Tambahkan quality gate, sinkronkan dokumentasi, dan final regression
```

Alasan utama urutan ini:

- business validation membutuhkan typed error yang stabil;
- server-authoritative pricing membutuhkan transaction helper yang sudah teruji agar pembacaan harga, insert order, detail, stok, dan notifikasi tetap atomic;
- `createTransaksi` harus dipisahkan menjadi dua perubahan: lifecycle transaction terlebih dahulu, lalu business rule;
- migrasi massal controller ditaruh setelah struktur transaksi dan akses stabil agar file yang sama tidak berulang kali dirombak dalam batch yang saling tumpang tindih.

## Peta Dependensi

| Komponen | Bergantung pada | Alasan |
|---|---|---|
| `catchAsync` | global `errorHandler` | Promise rejection harus berakhir pada response error yang konsisten |
| middleware validasi transaksi | typed error | validator harus meneruskan error 4xx yang mempunyai `statusCode` dan `code` |
| `TransaksiService` | domain function dan typed error | service mengorkestrasi aturan bisnis tanpa mapping string error |
| server-authoritative pricing | `withTransaction` | harga dan seluruh write transaksi harus memakai connection yang sama |
| controller transaksi tanpa `try-catch` HTTP | `catchAsync` dan typed model/service errors | error tidak boleh berubah menjadi unhandled rejection atau 500 yang salah |
| controller akses tanpa transaction lokal | transaction sudah dipindah ke model/service | controller baru boleh dibuat sebagai happy path setelah rollback tidak lagi menjadi tanggung jawabnya |
| quality gate final | seluruh migrasi selesai | gate tidak boleh memblokir pola lama yang memang belum mendapat giliran migrasi |

## Aturan Kerja untuk Setiap Fase

1. Kerjakan hanya satu batch pada satu waktu.
2. Jangan mengubah business rule dalam batch berlabel refactor-only.
3. Tambahkan atau perbarui test sebelum menghapus implementasi lama.
4. Jalankan test fokus sebelum suite penuh.
5. Jangan lanjut ke fase berikutnya jika exit gate belum terpenuhi.
6. Satu commit harus mewakili satu tujuan yang dapat di-review dan di-rollback sendiri.
7. Jangan memperbaiki masalah di luar scope batch kecuali perbaikan tersebut menjadi blocker. Catat blocker dan pisahkan commit-nya.
8. Jangan menghapus `try-catch` yang melakukan rollback, release, recovery, compensation, fallback, atau best-effort side effect.
9. Jangan mengubah payload sukses, status HTTP, atau response code tanpa test dan keputusan kontrak yang eksplisit.
10. Jangan memigrasikan `startMesin` dan `stopMesin` ke `withTransaction` generik.

## Fase 0 — Baseline, Audit, dan Characterization Test

### Tujuan

Merekam perilaku saat ini sebelum refactor. Fase ini mencegah implementer menganggap perubahan perilaku yang tidak disengaja sebagai hasil yang benar.

### Pekerjaan berurutan

1. Baca ketiga dokumen rencana sampai selesai.
2. Catat kondisi awal repository:

   ```powershell
   git status --short --branch
   npm.cmd run check
   git diff --check
   ```

3. Kerjakan `ASYNC_ERROR_HANDLING_PLAN.md` Tahap 0:

   - inventaris response error per endpoint;
   - kategorikan `try-catch` sebagai `HTTP_ONLY`, `BUSINESS_MAPPING`, `RECOVERY`, `TRANSACTION`, `FALLBACK`, atau `OBSERVABILITY`;
   - tandai error yang masih bergantung pada perbandingan `error.message`.

4. Kerjakan `DATABASE_TRANSACTION_HELPER_PLAN.md` Tahap 0:

   - inventaris seluruh `beginTransaction`, `commit`, `rollback`, dan `release`;
   - tandai transaksi standar dan transaksi dengan partial commit/side effect eksternal;
   - dokumentasikan lifecycle `createTransaksi`, `saveAksesRole`, `startMesin`, dan `stopMesin`.

5. Kerjakan `TRANSACTION_BUSINESS_VALIDATION_PLAN.md` Tahap 0 dan Tahap 1:

   - verifikasi tipe kolom uang dan aturan pembulatan;
   - pastikan arti `totalBayar` disepakati;
   - tambahkan characterization test payload transaksi lama;
   - tambahkan target test manipulasi harga yang akan dibuat lulus pada Fase 5.

### Batas fase

- Jangan menambahkan helper produksi pada fase ini.
- Jangan memindahkan logic controller/model.
- Test target harga baru boleh dibuat sebagai test pending/skipped dengan alasan yang jelas. Jangan membiarkan suite utama merah.

### Exit gate

- [x] Baseline test tercatat dan kegagalan lama dibedakan dari regresi baru.
- [x] Status dan bentuk error endpoint yang akan disentuh sudah diketahui.
- [x] Semua transaction site sudah dikategorikan.
- [x] Kontrak uang, numeric string, pembulatan, dan arti `totalBayar` sudah diputuskan.
- [x] Characterization test `createTransaksi` melindungi happy path, validation, authorization, dan rollback utama.
- [x] Test manipulasi harga sudah tersedia sebagai target perilaku baru.

## Fase 1 — Fondasi `catchAsync` dan Typed Error

### Referensi

Kerjakan `ASYNC_ERROR_HANDLING_PLAN.md` Tahap 1, Tahap 2, dan Tahap 3 saja.

### Pekerjaan berurutan

1. Tambahkan `src/utils/catchAsync.js` dan unit test-nya.
2. Lengkapi test global `errorHandler`, termasuk sanitasi 5xx dan `headersSent`.
3. Standarkan kontrak `createHttpError(statusCode, message, code)`.
4. Perbaiki pemanggilan typed error yang argument-nya terbalik, terutama di model transaksi.
5. Ganti mapping berdasarkan string untuk error yang akan disentuh pada fase berikutnya.
6. Lakukan pilot `catchAsync` hanya pada modul `masterItem`.
7. Jalankan integration test route untuk membuktikan alur route → wrapper → controller → global handler.

### Batas fase

- Jangan mulai migrasi semua controller.
- Jangan menyentuh lifecycle database transaction.
- Jangan memindahkan validasi bisnis `createTransaksi`.

### Exit gate

- [x] Unit test `catchAsync` lulus.
- [x] Unknown error menjadi 500 generik tanpa detail internal.
- [x] Typed 4xx mempertahankan status, `code`, dan pesan yang disepakati.
- [x] Tidak ada pemanggilan `createHttpError` dengan urutan argument yang salah pada area yang akan dimigrasikan.
- [x] Pilot `masterItem` lulus unit dan integration test.
- [x] Tidak ada perubahan response sukses.

## Fase 2 — Fondasi `withTransaction` dan Pilot Non-Transaksi Penjualan

### Referensi

Kerjakan `DATABASE_TRANSACTION_HELPER_PLAN.md` Tahap 1 sampai Tahap 4.

### Pekerjaan berurutan

1. Tambahkan `src/utils/transaction.js` dengan factory yang dapat diuji.
2. Tambahkan unit test helper untuk:

   - success dan commit;
   - callback gagal;
   - `beginTransaction` gagal;
   - `commit` gagal;
   - rollback gagal tanpa menutupi error utama;
   - perolehan connection gagal;
   - release selalu dipanggil jika connection berhasil diperoleh.

3. Migrasikan `createNewMesin` sebagai pilot.
4. Migrasikan transaksi standar sederhana sesuai Batch 3A, 3B, dan 3C pada dokumen helper.
5. Refactor setting stok dan pisahkan operasi di dalam transaction dari read setelah commit.
6. Jalankan test rollback/release untuk setiap fungsi yang dimigrasikan.

### Batas fase

- Jangan memigrasikan `createTransaksi` sebelum seluruh test helper dan pilot stabil.
- Jangan memigrasikan `startMesin` atau `stopMesin`.
- Jangan memasukkan MQTT, email, atau network call ke callback `withTransaction` baru.
- Jangan mengubah query atau business rule jika tidak diperlukan oleh lifecycle helper.

### Exit gate

- [x] Semua cabang lifecycle helper mempunyai unit test.
- [x] `createNewMesin` membuktikan commit, rollback, dan release yang benar.
- [x] Transaksi standar yang dimigrasikan tetap memakai connection callback, bukan pool global.
- [x] Read setelah commit tidak lagi dianggap bagian dari transaction secara keliru.
- [x] Test fokus dan suite penuh lulus.

## Fase 3 — Migrasi Lifecycle `createTransaksi` dan Akses

### Referensi

Kerjakan `DATABASE_TRANSACTION_HELPER_PLAN.md` Tahap 5 dan Tahap 6. Catat keputusan Tahap 7 sebagai pengecualian permanen untuk pekerjaan ini.

### Batch 3A — `createTransaksi` refactor-only

1. Tambahkan atau pastikan test model untuk success, kegagalan detail, kegagalan stok, dan kegagalan notifikasi.
2. Ganti blok manual connection/transaction dengan `withTransaction`.
3. Pastikan semua query berikut menggunakan connection yang sama:

   - validasi database yang harus konsisten;
   - lock/generasi invoice;
   - insert order;
   - insert detail;
   - update stok;
   - insert notifikasi stok.

4. Pertahankan input, perhitungan, harga, response, dan business rule lama.

### Batch 3B — pindahkan transaction akses

1. Pindahkan lifecycle transaction `saveAksesRole` dari controller ke model/service.
2. Controller hanya mengumpulkan input terverifikasi, memanggil model/service, dan mengirim response sukses.
3. Pastikan error dilempar kembali sebagai typed error atau unknown error untuk global handler.
4. Tambahkan test atomicity untuk delete/insert matriks akses.

### Pengecualian wajib

`startMesin` dan `stopMesin` tidak boleh dimigrasikan ke helper generik karena alurnya melibatkan MQTT, failed log, state mesin, dan kemungkinan commit yang sengaja dilakukan walaupun command gagal. Buat rencana state machine/outbox terpisah jika area tersebut akan diperbaiki.

### Exit gate

- [x] `createTransaksi` memakai `withTransaction` tanpa perubahan behavior.
- [x] Failure pada salah satu detail/stok/notifikasi me-rollback seluruh write sebelumnya.
- [x] Connection selalu dilepas.
- [x] `saveAksesRole` tidak lagi membuka transaction di controller.
- [x] Access matrix tetap atomic.
- [x] `startMesin` dan `stopMesin` tetap menggunakan lifecycle khususnya.

## Fase 4 — Pemisahan Validasi Bisnis Transaksi Tanpa Perubahan Harga

### Referensi

Kerjakan `TRANSACTION_BUSINESS_VALIDATION_PLAN.md` Tahap 2 sampai Tahap 5. Tahap ini wajib menjadi refactor-only.

### Pekerjaan berurutan

1. Buat pure domain function untuk normalisasi dan arithmetic uang.
2. Tambahkan unit test edge case uang, termasuk `null`, string kosong, boolean, decimal, overflow, dan input tidak termutasi.
3. Buat middleware validasi payload transaksi.
4. Simpan hasil normalisasi pada `req.validatedBody`; jangan overwrite `req.body`.
5. Buat `TransaksiService` yang tidak menerima `req` atau `res`.
6. Tipiskan controller menjadi:

   - mengambil identity dari `req.user`;
   - mengambil payload dari `req.validatedBody`;
   - memanggil service;
   - mengirim response sukses.

7. Bungkus route `createTransaksi` dengan `catchAsync`.
8. Hapus `try-catch` controller yang hanya melakukan mapping HTTP setelah typed errors terbukti benar.
9. Jalankan checkpoint kompatibilitas sebelum menerapkan harga server.

### Batas fase

- Mobile masih boleh mengirim `totalBayar` dan `subtotal`.
- Perilaku harga lama belum diubah.
- Jangan membaca `tbl_harga_cabang` pada fase ini.
- Jangan mengubah success payload atau invoice format.
- Jangan menggabungkan fase ini dengan enforcement harga dalam commit yang sama.

### Exit gate

- [x] Controller tidak melakukan loop validasi item atau arithmetic uang.
- [x] Middleware hanya memvalidasi kontrak HTTP dan tidak query database.
- [x] Domain function dapat diuji tanpa Express dan database.
- [x] Service tidak menerima object Express.
- [x] Identity mitra, cabang, dan user hanya berasal dari token.
- [x] Semua characterization test lama tetap lulus.
- [x] Refactor-only mempunyai commit terpisah yang dapat di-rollback.

## Fase 5 — Server-Authoritative Pricing

### Referensi

Kerjakan `TRANSACTION_BUSINESS_VALIDATION_PLAN.md` Tahap 6 sampai Tahap 10.

### Batch 5A — audit dan kesiapan data

1. Audit kelengkapan harga seluruh cabang aktif.
2. Cari harga negatif, harga ambigu/duplikat, dan harga layanan yang hilang.
3. Putuskan unique key dan migrasi schema secara terpisah jika diperlukan.
4. Jangan mengaktifkan enforcement sebelum data siap.

### Batch 5B — pricing di dalam transaction

1. Baca harga resmi berdasarkan mitra, cabang, jenis layanan, dan item menggunakan connection transaction yang sama.
2. Hitung `lineSubtotal` dan total melalui pure domain function.
3. Simpan subtotal dan total hasil server.
4. Selama fase kompatibilitas, bandingkan declared total dari client dengan total server.
5. Jika berbeda, rollback dan lempar `409 TRANSACTION_PRICE_CHANGED`.
6. Jika harga tidak tersedia, rollback dan lempar typed error; jangan fallback ke harga client.

### Batch 5C — kompatibilitas mobile dan dokumentasi kontrak

1. Pertahankan field lama sebagai confirmation-only sampai seluruh client siap.
2. Dokumentasikan cara mobile menangani `TRANSACTION_PRICE_CHANGED`.
3. Perbarui Postman dan `API_LIST.md`.
4. Hapus kewajiban field subtotal/total client hanya dalam versi kontrak terpisah setelah client aktif terverifikasi.

### Exit gate

- [x] Test manipulasi harga yang dibuat di Fase 0 sekarang lulus.
- [x] Harga, order, detail, stok, dan notifikasi memakai transaction connection yang sama.
- [x] Missing atau stale price tidak membuat data parsial.
- [x] Nilai yang tersimpan berasal dari perhitungan server.
- [x] Mobile tetap kompatibel atau perubahan kontraknya sudah dikoordinasikan.
- [x] History dan cashflow membaca total server yang benar.

## Fase 6 — Migrasi Controller Lain ke `catchAsync`

### Referensi

Lanjutkan `ASYNC_ERROR_HANDLING_PLAN.md` Tahap 4 sampai Tahap 7.

### Urutan batch wajib

1. Controller read-only/sederhana:

   - dashboard;
   - history;
   - harga cabang;
   - notifikasi.

2. CRUD backoffice dasar:

   - mitra;
   - cabang;
   - menus;
   - roles.

3. User management dan mesin:

   - users;
   - user owner;
   - mesin.

4. Owner dan kasir:

   - kasir;
   - cashflow;
   - setting stok mitra;
   - mobile/auth flow.

5. Area kompleks terakhir:

   - transaksi selain `createTransaksi`;
   - MQTT route/controller;
   - akses.

### Langkah wajib per modul

1. Baca inventaris kontrak error dari Fase 0.
2. Tambahkan characterization test yang belum ada.
3. Pastikan known error sudah bertipe.
4. Bungkus route async dengan `catchAsync`.
5. Hapus hanya catch kategori `HTTP_ONLY` atau `OBSERVABILITY` yang sudah dialihkan.
6. Pertahankan catch kategori `RECOVERY`, `TRANSACTION`, dan `FALLBACK`.
7. Jalankan test fokus dan regression scope/authorization.
8. Commit modul atau kelompok kecil tersebut sebelum lanjut.

### Exit gate

- [x] Seluruh async route controller memakai `catchAsync` atau mempunyai alasan tertulis jika dikecualikan.
- [x] Tidak ada direct response 5xx di controller.
- [x] Known errors mempertahankan status dan `code` yang disepakati.
- [x] Catch yang tersisa mempunyai fungsi recovery/cleanup/fallback yang nyata.
- [x] Tenant, cabang, role, dan actor scope tetap terlindungi oleh test.
- [x] MQTT failure tidak menyebabkan state mesin keliru.

## Fase 7 — Quality Gate dan Final Regression

### Pekerjaan berurutan

1. Tambahkan quality gate error handling setelah migrasi controller selesai.
2. Tambahkan pemeriksaan regresi penggunaan transaction manual hanya untuk lokasi yang sudah dimigrasikan. Jangan melarang lifecycle khusus MQTT.
3. Tambahkan pemeriksaan agar arithmetic transaksi tidak kembali ke controller.
4. Perbarui dokumentasi API, Postman collection, dan catatan compatibility mobile.
5. Jalankan validasi akhir:

   ```powershell
   npm.cmd run lint
   npm.cmd test
   npm.cmd run check
   git diff --check
   git status --short --branch
   ```

6. Review manual seluruh catch yang tersisa dan beri alasan singkat di inventaris bila diperlukan.
7. Review manual seluruh pemakaian `dbPool.getConnection()` dan pastikan lifecycle-nya disengaja.

### Exit gate final

- [x] Semua Definition of Done pada ketiga dokumen sumber terpenuhi.
- [x] Seluruh unit dan integration test lulus.
- [x] Quality gate baru masuk ke `npm.cmd run check`.
- [x] Tidak ada raw database, MQTT, email, atau stack error pada response 5xx.
- [x] Tidak ada connection leak pada jalur yang dimigrasikan.
- [x] Manipulasi harga client ditolak.
- [x] Dokumentasi dan Postman sesuai route serta kontrak terbaru.
- [x] Perubahan terbagi menjadi commit yang kecil dan dapat di-rollback.

### Status audit implementasi Fase 7

Quality gate `scripts/check-refactor-quality.js` sekarang menjadi bagian dari `npm.cmd run check`. Gate ini memverifikasi bahwa seluruh route yang memanggil controller async dibungkus `catchAsync` dan arithmetic pricing transaksi tetap berada di domain/service/model, bukan di controller.

Audit akhir juga memastikan controller tidak lagi mengirim detail error internal melalui response 5xx. Error internal transaksi, machine-control, dan aktivasi akun diteruskan sebagai typed 500 dan disanitasi oleh global error handler. Lifecycle `startMesin`/`stopMesin` tetap menjadi pengecualian workflow MQTT yang eksplisit; helper transaksi generik tidak digunakan untuknya.

Validasi terakhir: quality gate lulus, `npm.cmd run check` lulus (107 test pass, 1 test MQTT skip), dan `git diff --check` lulus.

Perbandingan baseline sebelum/sesudah dicatat di `docs/REFACTOR_PHASE_0_BASELINE.md`: baseline Fase 0 mencatat 69 pass/1 skip, sedangkan checkpoint implementasi mencatat 107 pass/1 skip MQTT. Characterization dan integration suite membuktikan contract yang tidak dimaksudkan berubah tetap kompatibel; perubahan yang disengaja (typed error, alias `error` 4xx, dan penolakan manipulasi harga) dicatat di test serta dokumentasi API.

## Urutan Commit yang Disarankan

Nama commit dapat disesuaikan, tetapi urutan tanggung jawabnya jangan diacak:

1. `test(refactor): capture error transaction and pricing baselines`
2. `refactor(error): add catchAsync and global handler tests`
3. `fix(error): standardize typed domain errors`
4. `refactor(master-item): pilot centralized async errors`
5. `refactor(db): add tested withTransaction helper`
6. `refactor(mesin): pilot transaction helper`
7. `refactor(db): migrate standard database transactions`
8. `refactor(stock): clarify commit and post-commit reads`
9. `refactor(transaksi): migrate create lifecycle to withTransaction`
10. `refactor(akses): move transaction boundary out of controller`
11. `refactor(transaksi): extract money domain rules`
12. `refactor(transaksi): add payload validation middleware`
13. `refactor(transaksi): add service and slim create controller`
14. `test(transaksi): cover authoritative prices and stale totals`
15. `fix(transaksi): calculate and persist server prices atomically`
16. `docs(transaksi): document pricing and mobile compatibility`
17. `refactor(error): migrate simple and CRUD controllers`
18. `refactor(error): migrate owner kasir and complex controllers`
19. `chore(refactor): add regression quality gates`

## Format Status Handoff

Setelah menyelesaikan satu batch, implementer wajib mencatat status berikut di PR description, issue, atau catatan kerja:

```markdown
### Batch yang dikerjakan
- Fase: <nomor dan nama fase>
- Scope: <file/modul yang diubah>
- Dokumen acuan: <dokumen dan tahap>

### Perilaku
- Perubahan behavior yang disengaja: <tidak ada / jelaskan>
- Kontrak yang dipertahankan: <status, payload, scope>
- Pengecualian: <catch/lifecycle yang sengaja dipertahankan>

### Validasi
- Test fokus: <command dan hasil>
- Full test/check: <command dan hasil>
- Diff check: <hasil>

### Gate
- Exit gate fase terpenuhi: <ya/tidak>
- Blocker sebelum batch berikutnya: <tidak ada / jelaskan>
```

Jika `Exit gate fase terpenuhi` bernilai `tidak`, implementer tidak boleh mengambil fase berikutnya.

## Larangan Utama

1. Jangan mengerjakan server-authoritative pricing sebelum `withTransaction` stabil.
2. Jangan menghapus catch controller sebelum known error mempunyai `statusCode` dan `code`.
3. Jangan mengubah transaction lifecycle dan business pricing dalam commit yang sama.
4. Jangan memindahkan query database ke middleware validasi.
5. Jangan mengambil `idMitra`, `cabangId`, role, atau actor dari body jika sudah tersedia di token.
6. Jangan mempercayai `subtotal` atau `totalBayar` client sebagai nilai yang disimpan setelah Fase 5.
7. Jangan fallback ke harga client saat konfigurasi harga tidak tersedia.
8. Jangan memasukkan MQTT/network wait ke helper transaction generik.
9. Jangan menghapus field payload lama sebelum versi mobile yang baru terverifikasi aktif.
10. Jangan menjalankan migrasi massal seluruh controller dalam satu commit.

## Checklist Mulai untuk Junior Programmer atau AI

- [ ] Saya sudah membaca dokumen urutan ini sampai selesai.
- [ ] Saya sudah membaca bagian yang relevan pada dokumen sumber.
- [ ] Saya mengetahui fase dan batch yang sedang aktif.
- [ ] Exit gate fase sebelumnya sudah terpenuhi.
- [ ] Saya sudah memeriksa perubahan lokal yang bukan milik batch ini.
- [ ] Saya sudah menambahkan atau menemukan characterization test yang melindungi behavior lama.
- [ ] Saya tidak mengubah file di luar scope tanpa mencatat alasannya.
- [ ] Saya akan berhenti setelah scope batch selesai dan melaporkan hasil gate.

## Definition of Done Dokumen Orkestrasi

Seluruh rangkaian dianggap selesai hanya jika Fase 0 sampai Fase 7 telah selesai secara berurutan, semua exit gate terpenuhi, dan Definition of Done pada ketiga dokumen sumber juga terpenuhi. Selesainya satu dokumen sumber saja tidak berarti rangkaian refactor ini selesai.
