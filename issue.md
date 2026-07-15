# Rencana Audit dan Refactoring Menyeluruh Backend API

## Ringkasan

Lakukan review terhadap seluruh source code proyek, dokumentasikan hasil review secara terstruktur, kemudian refactor secara bertahap agar code lebih efektif, efisien, bersih, konsisten, mudah diuji, dan mengikuti prinsip DRY (Don't Repeat Yourself).

Pekerjaan ini **bukan** satu perubahan besar sekaligus. Audit harus diselesaikan dan perilaku API saat ini harus dicatat terlebih dahulu. Refactoring kemudian dikerjakan melalui beberapa perubahan kecil per area/modul agar mudah direview dan aman untuk di-rollback.

## Tujuan

- Memahami arsitektur dan alur data seluruh proyek.
- Menemukan bug, risiko keamanan, duplikasi, inkonsistensi, dan code smell.
- Menyusun daftar hasil review yang memiliki bukti, lokasi file, dampak, dan saran perbaikan.
- Mengurangi pengulangan validasi, response, error handling, query helper, audit field, logging, dan autentikasi.
- Memecah fungsi/file besar menjadi unit yang memiliki satu tanggung jawab.
- Menjaga route, payload, status code, response, query, dan business rule yang sudah dipakai client.
- Menambahkan quality gate agar refactoring berikutnya lebih aman.
- Memperbarui dokumentasi supaya programmer baru dapat memahami dan menjalankan proyek.

## Prinsip Utama

1. **Preserve behavior terlebih dahulu.** Refactoring tidak boleh diam-diam mengubah kontrak API atau aturan bisnis.
2. **Jangan melakukan big-bang refactor.** Kerjakan per fondasi atau per modul dalam perubahan kecil.
3. **Test before refactor.** Tambahkan characterization test untuk perilaku penting sebelum memindahkan logic.
4. **Satu commit/PR untuk satu tujuan.** Jangan mencampur formatting seluruh repo dengan perubahan logic.
5. **Gunakan pola proyek yang sudah ada.** Pertahankan alur `route -> middleware -> controller -> model` kecuali audit membuktikan pola tersebut perlu diubah.
6. **DRY bukan berarti semua code harus digeneralisasi.** Extract hanya logic yang benar-benar sama dan memiliki alasan perubahan yang sama.
7. **Security dan data integrity lebih penting daripada pengurangan jumlah baris.**
8. **Semua temuan harus dapat ditelusuri.** Cantumkan file, fungsi/baris, bukti, dampak, rekomendasi, dan hasil verifikasi.

## Ruang Lingkup Audit

### Wajib direview

- `src/index.js`: bootstrap aplikasi, middleware global, route mount, static files, CORS, error handler, dan startup MQTT.
- `src/routes/*.js`: urutan route, HTTP method, auth middleware, parameter, dan controller yang dipanggil.
- `src/controller/*.js`: validasi input, sumber identitas user, response, status code, error handling, dan business flow.
- `src/models/*.js`: SQL, transaction, filter tenant/cabang, soft delete, mapping data, duplikasi query, dan performa.
- `src/middleware/*.js`: autentikasi, autorisasi role/tenant/cabang, upload, logging, dan bentuk `req.user`.
- `src/utils/*.js`: JWT, password, tanggal/timezone, email, MQTT client, dan MQTT status listener.
- `src/config/*.js`: database pool dan penggunaan environment variable.
- File operasional di root, misalnya `generateRefreshToken.js`.
- `arduino.txt` dan `Arduino Existing.txt`: hanya untuk kontrak integrasi backend-MQTT-firmware, bukan refactor firmware tanpa task terpisah.
- `package.json`, lockfile, `.gitignore`, `README.md`, `docs/API_LIST.md`, dan Postman collection.
- Kesesuaian dokumentasi endpoint dengan route yang benar-benar terpasang di `src/index.js`.

### Tidak perlu direview baris per baris

- `node_modules/` karena merupakan dependency hasil instalasi.
- File binary/static di `public/images/`, kecuali nama/path-nya tidak sesuai dengan code.
- `.git/` dan metadata editor.
- Isi secret di `.env`. Audit hanya nama variable yang diperlukan, cara validasi config, dan apakah `.env` tidak ter-track.

### Definition of “seluruh code sudah direview”

Audit baru dianggap lengkap apabila setiap file dalam ruang lingkup tercatat pada checklist inventaris dengan salah satu status berikut:

- `REVIEWED - NO FINDING`
- `REVIEWED - HAS FINDING`
- `DEFERRED - <alasan dan task lanjutan>`

Tidak boleh menyimpulkan audit selesai hanya karena beberapa file terbesar sudah diperiksa.

## Gambaran Arsitektur Saat Ini

Alur utama aplikasi yang harus dipertahankan selama refactor:

```text
HTTP request
  -> route di src/routes
  -> middleware auth/authorization
  -> controller (validasi dan response)
  -> model (query MySQL dan transaction)
  -> JSON response

MQTT command
  -> controller transaksi
  -> model/business rule transaksi
  -> utils/mqttClient
  -> broker -> ESP8266
  -> ACK/status
  -> utils/mqttStatusListener
  -> update database
```

Kelompok domain yang terlihat saat penyusunan issue:

- Backoffice: users, roles, menus, akses, mitra, cabang, mesin, master item, user owner, dashboard.
- Mobile owner/kasir: login/mobile, kasir, absensi, stok mitra, cashflow, history, harga cabang.
- Transaksi dan mesin: transaksi, start/stop mesin, MQTT ACK, dan status READY.
- Cross-cutting: authentication, authorization, date/timezone, password/JWT, email, logging, database, error handling.

## Output yang Harus Dihasilkan

Implementer wajib menghasilkan artefak berikut:

1. `docs/code-review/inventory.md`
   - Daftar semua file yang direview.
   - Tanggung jawab file.
   - Dependency masuk/keluar.
   - Status review dan link ke finding terkait.

2. `docs/code-review/findings.md`
   - Daftar lengkap temuan menggunakan format baku di bawah.
   - Diurutkan berdasarkan prioritas dan domain.

3. `docs/code-review/refactor-roadmap.md`
   - Urutan implementasi final setelah audit.
   - Estimasi ukuran: `S`, `M`, atau `L`.
   - Dependency antar-task dan risiko compatibility.

4. Test otomatis dan script quality gate yang disepakati.

5. Perubahan refactor bertahap beserta update dokumentasi API apabila kontrak memang sengaja diubah.

## Format Wajib Setiap Temuan

Gunakan template ini agar junior programmer tidak hanya menulis komentar umum seperti “code kurang clean”:

```md
### REV-001 - Judul singkat

- Status: Open | In Progress | Fixed | Accepted Risk | Deferred
- Prioritas: P0 | P1 | P2 | P3
- Kategori: Bug | Security | Data Integrity | Performance | DRY | Clean Code | Test | Documentation
- Lokasi: src/path/file.js, nama fungsi, dan nomor baris
- Bukti: potongan perilaku/pola yang ditemukan tanpa menyalin secret
- Dampak: akibat terhadap user, data, keamanan, operasi, atau maintenance
- Perilaku saat ini: apa yang terjadi sekarang
- Perilaku yang diharapkan: hasil yang seharusnya
- Rekomendasi: perubahan terkecil yang aman
- Risiko perubahan: route/client/table/topic yang dapat terdampak
- Test yang diperlukan: unit/integration/manual test
- Dependency: finding/task lain yang harus selesai dahulu
- Hasil verifikasi: command dan hasil setelah diperbaiki
```

## Skala Prioritas

- **P0 - Critical:** kebocoran secret/data, bypass autentikasi/otorisasi, korupsi data, transaksi tidak atomic, atau outage. Hentikan refactor kosmetik dan tangani lebih dahulu.
- **P1 - High:** bug kontrak API, cross-tenant access, error status salah, race condition mesin, query salah, atau endpoint sensitif tanpa guard yang seharusnya.
- **P2 - Medium:** duplikasi besar, file/fungsi terlalu kompleks, response tidak konsisten, logging berisik, query kurang efisien, atau test coverage rendah.
- **P3 - Low:** naming, formatting, dead comment, dokumentasi, dan cleanup dependency yang tidak mengubah runtime.

## Temuan Awal yang Wajib Diverifikasi Saat Audit

Daftar ini adalah hasil pemeriksaan awal untuk mengarahkan audit, **bukan hasil final seluruh review**. Implementer harus membuktikan dampak dan memperbarui statusnya sebelum mengubah code.

| ID awal | Prioritas awal | Area | Indikasi | Aksi verifikasi |
|---|---:|---|---|---|
| PRE-001 | P1 | Error handling | Middleware menggunakan `error.statusCode`, sedangkan global error handler di `src/index.js` membaca `err.status`. Error dari `authenticateMobile` berpotensi menjadi HTTP 500. | Buat test token hilang/invalid/expired pada route mobile dan catat status aktual. |
| PRE-002 | P1 | Authorization | Route di `src/routes/settingStokMitra.js` tidak terlihat menggunakan middleware autentikasi. | Cocokkan dengan kontrak produk. Jika bukan public API, buktikan akses tanpa token lalu tambahkan guard yang sesuai. |
| PRE-003 | P1 | Audit/data integrity | Sejumlah create/update menerima `createdBy` atau `updatedBy` dari body, sementara endpoint sudah memiliki `req.user`. Nilai audit berpotensi dipalsukan. | Petakan semua audit field dan tentukan sumber identitas berdasarkan tipe token. Jangan ubah payload sebelum mengecek client. |
| PRE-004 | P1 | Security/logging | `src/utils/jwt.js` mencetak object user; beberapa controller/model mencetak body/request/data. | Pastikan password, token, device ID, data user, atau payload sensitif tidak masuk log. |
| PRE-005 | P1 | API/security | Banyak response 500 mengirim `serverMessage: error.message` ke client. | Inventaris error yang dapat mengekspos SQL, struktur tabel, broker, filesystem, atau informasi internal. |
| PRE-006 | P2 | Test/tooling | `package.json` hanya memiliki script `dev` dan `start`; belum ada test, lint, atau format gate. | Tentukan framework minimal dan tambahkan baseline test sebelum refactor logic. |
| PRE-007 | P2 | DRY/error | Controller mengulang response `Server Error`, mapping string `data not found`, dan blok `try/catch`. Model banyak memakai `catch (error) { throw error; }`. | Hitung pola, rancang custom error + async handler, lalu migrasikan satu modul pilot. |
| PRE-008 | P2 | DRY/validation | Validasi `requiredFields` berulang dan beberapa memakai `!body[field]`, yang juga menolak nilai valid seperti `0` atau `false`. | Catat schema tiap endpoint dan gunakan validasi `undefined/null/empty` sesuai tipe data. |
| PRE-009 | P2 | Maintainability | Beberapa file sangat besar, termasuk `models/mesin.js`, `models/transaksi.js`, `models/cashflow.js`, dan controller pasangannya. | Ukur tanggung jawab/fungsi, dependency, dan kompleksitas; pecah berdasarkan use case, bukan sekadar jumlah baris. |
| PRE-010 | P2 | API consistency | Format response sukses/error, penamaan ID (`cabangId`, `cabang_id`, `idMitra`), serta bentuk user token berbeda antar-flow. | Buat contract snapshot endpoint dan matriks bentuk `req.user` sebelum normalisasi. |
| PRE-011 | P2 | Date/timezone | Timestamp database dibuat berulang dengan `new Date().toISOString()...`, sementara util tanggal memakai local `Date` dan nama `WIB`. | Tetapkan kebijakan penyimpanan UTC atau Asia/Jakarta dan uji boundary tengah malam. |
| PRE-012 | P2 | SQL/data exposure | Terdapat banyak `SELECT *`. | Catat field yang benar-benar diperlukan, khususnya table user; ganti bertahap tanpa mengubah response publik tanpa persetujuan. |
| PRE-013 | P2 | Route duplication | Start/stop mesin tersedia melalui `/api/transaksi` dan `/api/kasir/transaksi`. | Pastikan apakah salah satunya legacy alias. Jangan hapus route sebelum usage client dan Postman diverifikasi. |
| PRE-014 | P2 | Config | Allowed origin CORS ditulis langsung di `src/index.js`; startup juga mengandung log/debug dan import yang perlu dicek penggunaannya. | Pisahkan config tervalidasi dan uji origin production/development. |
| PRE-015 | P2 | Dependency | Ada dua lockfile (`package-lock.json` dan `yarn.lock`) dan dependency frontend `@vuepic/vue-datepicker` di backend. | Tentukan package manager resmi dan buktikan dependency yang tidak digunakan sebelum menghapus. |
| PRE-016 | P2 | MQTT | Lifecycle connection, timeout, listener global, request correlation, cleanup, dan logging MQTT perlu diuji bersama kontrak firmware. | Gunakan fake/mock MQTT untuk test; jangan menyalakan mesin fisik dalam test otomatis. |
| PRE-017 | P3 | Documentation | README masih sangat singkat dan encoding beberapa karakter tampak rusak; setup environment, migration/schema, test, dan arsitektur belum lengkap. | Perbarui setelah perilaku aktual dan command telah diverifikasi. |
| PRE-018 | P3 | Dead code/comment | Terdapat komentar debug/rencana dan console statement yang tidak semuanya diperlukan. | Hapus hanya setelah memastikan bukan logging operasional yang dibutuhkan. |

## Tahapan Implementasi

### Tahap 0 - Persiapan dan Pengamanan Baseline

Tujuan tahap ini adalah memastikan refactor dapat dibandingkan dengan perilaku yang sedang berjalan.

- [ ] Pastikan working tree bersih atau pisahkan perubahan user yang sudah ada.
- [ ] Catat branch, commit baseline, versi Node.js, npm, MySQL, dan environment runtime.
- [ ] Jalankan instalasi menggunakan package manager yang saat ini dipakai proyek tanpa memperbarui dependency terlebih dahulu.
- [ ] Jalankan server dan lakukan smoke test terhadap endpoint root.
- [ ] Catat seluruh environment variable berdasarkan pemakaian code tanpa menyalin nilainya.
- [ ] Buat `.env.example` berisi nama variable dan placeholder aman jika belum tersedia.
- [ ] Pastikan `.env`, token, credential database/email/MQTT, dan file upload tidak ter-track.
- [ ] Export/backup schema atau siapkan database test yang terisolasi. Jangan menjalankan test write ke database produksi.
- [ ] Tentukan cara mock email, MQTT, dan external API.
- [ ] Simpan baseline Postman/API response untuk endpoint penting.
- [ ] Jangan melakukan refactor logic pada tahap ini.

Hasil tahap:

- Baseline dapat dijalankan ulang.
- Secret tidak masuk commit atau output test.
- Ada database/test double yang aman.
- Perilaku utama sebelum refactor sudah tercatat.

### Tahap 1 - Inventaris Seluruh File dan Dependency

- [ ] Buat daftar file sesuai ruang lingkup di `docs/code-review/inventory.md`.
- [ ] Untuk setiap route, catat mount dari `src/index.js`, full URL, method, auth middleware, controller, model, dan tabel/topic eksternal.
- [ ] Untuk setiap controller, catat input dari params/query/body/token dan bentuk response.
- [ ] Untuk setiap model, catat tabel yang dibaca/ditulis, penggunaan transaction, dan filter `idMitra`, `cabangId`, serta `statusAktif`.
- [ ] Untuk middleware auth, dokumentasikan field hasil pada `req.user` untuk backoffice, owner, dan kasir.
- [ ] Untuk MQTT, dokumentasikan topic command, ACK, status, payload, timeout, dan perubahan database.
- [ ] Untuk email/Google API/Puppeteer/upload, catat resource eksternal, timeout, failure mode, dan cleanup.
- [ ] Tandai exported function yang tidak dipakai, import tidak dipakai, route tidak ter-mount, dan dependency tidak dipakai. Jangan langsung hapus.
- [ ] Cocokkan route aktual dengan `docs/API_LIST.md` dan Postman collection.

Gunakan matriks route berikut:

| Method + full path | Auth | Role/scope | Controller | Model | Table/topic | Input | Response | Test |
|---|---|---|---|---|---|---|---|---|
| `GET /contoh` | middleware | backoffice/owner/kasir | fungsi | fungsi | tabel | params/query/body/token | status + schema | test ID |

### Tahap 2 - Characterization Test dan Quality Gate

Tambahkan test sebelum memindahkan logic. Pilih tool yang ringan dan kompatibel dengan CommonJS. Contoh yang dapat dipertimbangkan: test runner Node.js bawaan atau Jest/Vitest, ditambah Supertest untuk HTTP. Jangan menambah dependency tanpa alasan yang dicatat.

- [x] Tambahkan script `test`, `test:watch` (bila perlu), `lint`, dan `check` pada `package.json`.
- [x] Tambahkan lint rule dasar untuk undefined variable, unreachable code, duplicate import, dan promise misuse.
- [x] Tambahkan test helper untuk membuat app tanpa selalu memanggil `listen()`.
- [x] Pisahkan pembuatan `app` dari startup server agar integration test dapat menjalankan Express in-process.
- [x] Mock database pada unit test dan gunakan database test untuk integration test query penting.
- [ ] Mock email, MQTT, Google API, Puppeteer, dan filesystem side effect.
- [ ] Buat characterization test response sebelum menstandarkan response.
- [ ] Tetapkan coverage baseline. Jangan menetapkan target tinggi secara asal; naikkan bertahap pada code yang disentuh.

Minimal test baseline:

- [ ] Public route hanya dapat mengakses endpoint yang memang public.
- [ ] Backoffice token valid, hilang, invalid, expired, user nonaktif.
- [ ] Owner token valid, mitra lain, mitra nonaktif.
- [ ] Kasir token valid, cabang lain, cabang nonaktif, user nonaktif.
- [x] CRUD sukses, validation error, duplicate, not found, soft delete, dan restore pada satu modul pilot.
- [x] SQL error menghasilkan 500 yang aman dan tidak membocorkan detail internal.
- [x] Transaction melakukan rollback jika langkah tengah gagal.
- [x] MQTT success ACK, wrong request ID, negative ACK, timeout, connection close, dan READY update.

### Tahap 3 - Review Mendalam per Lapisan

#### 3A. Bootstrap, config, dan middleware global

- [x] Pisahkan `createApp()` dan `startServer()`.
- [x] Validasi environment variable saat startup dengan pesan yang jelas tetapi tanpa nilai secret.
- [x] Pindahkan allowed CORS origin ke config/environment yang tervalidasi.
- [x] Tambahkan handler 404 yang konsisten setelah seluruh route.
- [x] Samakan property status error (`status` atau `statusCode`) dari sumber sampai global handler.
- [x] Pastikan error response production tidak mengirim stack/SQL/internal message.
- [x] Tinjau JSON body limit, static path, upload path, dan shutdown database/MQTT secara graceful.

#### 3B. Route dan authorization

- [ ] Periksa semua route memiliki auth yang sesuai.
- [ ] Bedakan authentication dari authorization role/tenant/cabang.
- [ ] Verifikasi route spesifik dideklarasikan sebelum route dinamis apabila jumlah segment dapat bertabrakan.
- [ ] Cari method/path duplikat dan route legacy.
- [ ] Jangan menghapus alias route sampai mobile/backoffice client sudah dimigrasikan.
- [ ] Pastikan owner hanya dapat mengakses `idMitra` sendiri dan kasir hanya cabangnya sendiri.
- [ ] Buat middleware reusable hanya untuk rule yang identik; pertahankan branch owner/kasir secara eksplisit.

#### 3C. Controller dan validation

- [ ] Pisahkan validasi input dari orchestration bila bloknya berulang.
- [ ] Gunakan schema/validator konsisten untuk params, query, dan body.
- [ ] Bedakan missing, empty, invalid type, invalid enum, dan out-of-range.
- [ ] Ambil `createdBy`, `updatedBy`, `idMitra`, `cabangId`, dan user ID dari identity terverifikasi jika business rule mengharuskan.
- [x] Migrasikan `try/catch` HTTP-only ke async handler setelah test error siap; catch recovery/transaction/fallback tetap dipertahankan.
- [ ] Jangan mengubah response contract seluruh modul sekaligus.
- [ ] Pastikan setiap `return res...` menghentikan eksekusi dan tidak mengirim response dua kali.

#### 3D. Model, SQL, dan transaction

- [ ] Hilangkan `try/catch` yang hanya melempar ulang error tanpa konteks.
- [ ] Gunakan error class/code, bukan membandingkan teks error tersebar di controller.
- [ ] Ganti `SELECT *` dengan kolom eksplisit, terutama data user dan auth.
- [ ] Pastikan semua nilai user tetap memakai parameter binding; jangan interpolasi input ke SQL.
- [ ] Audit helper yang menghasilkan fragment SQL agar hanya menerima nama kolom dari code, bukan request mentah.
- [ ] Pastikan query tenant selalu membawa filter `idMitra` dan query kasir membawa scope `cabangId`.
- [ ] Pastikan read default menghormati `statusAktif` dan restore/delete konsisten.
- [ ] Gunakan transaction untuk operasi multi-table; selalu `commit`, `rollback`, dan `release` pada jalur yang benar.
- [ ] Cari pola N+1 query dan query berulang dalam loop.
- [ ] Gunakan `affectedRows`, unique constraint, foreign key, dan index yang sesuai. Perubahan schema harus menjadi task/migration terpisah.
- [x] Kebijakan timestamp database UTC sudah disetujui, `CURRENT_TIMESTAMP` pada model yang diaudit sudah diganti dengan `UTC_TIMESTAMP()`, dan quality gate mencegah `NOW()`, `CURDATE()`, atau `CURRENT_TIMESTAMP` kembali dipakai.

#### 3E. Integrasi eksternal dan utilitas

- [ ] Centralize date/time helper setelah kebijakan timezone ditetapkan.
- [x] Hilangkan log object user/token/password/payload sensitif.
- [ ] Terapkan structured logger dengan level dan redaction jika disepakati.
- [ ] Tambahkan timeout serta error normalization untuk email, Google API, Puppeteer, dan MQTT.
- [ ] Pastikan MQTT client/listener tidak membuat listener ganda dan selalu cleanup setelah ACK/timeout.
- [ ] Pertahankan kontrak topic firmware yang sedang digunakan; perubahan topic membutuhkan koordinasi firmware dan backend.

#### 3F. Dokumentasi dan dependency

- [x] Tentukan npm atau Yarn sebagai package manager tunggal, lalu hapus lockfile lain melalui task terpisah.
- [x] Jalankan audit dependency dan cek penggunaan aktual sebelum upgrade/remove.
- [ ] Pisahkan security update dari refactor behavior bila risikonya besar.
- [x] Perbaiki encoding README.
- [x] Dokumentasikan prerequisites, setup, environment variable, start, test, lint, struktur proyek, dan troubleshooting.
- [x] Refresh seluruh contoh legacy pada Postman collection setelah route stabil. Folder `Backoffice route catalog` berisi 76 request yang disinkronkan terhadap route aktif, memakai variable auth/ID, dan body JSON valid; folder `Verified core API contract` mempertahankan 13 request yang memiliki bukti test, termasuk tiga reset-password publik generic HTTP 202.

### Tahap 4 - Susun Roadmap Refactor

Setelah audit selesai, kelompokkan finding menjadi batch berikut. Nomor batch adalah urutan dependency, bukan kewajiban memasukkan semua perubahan ke satu PR.

1. **Batch A - Safety net:** app factory, test harness, lint, config validation, dan secret hygiene.
2. **Batch B - P0/P1:** auth/authorization, error status, data isolation, transaction, dan sensitive logging.
3. **Batch C - Error foundation:** custom error, async handler, 404/global error, safe error response.
4. **Batch D - Validation/audit identity:** schema validation dan token-derived audit fields.
5. **Batch E - Shared utilities:** date policy, response helper yang benar-benar diperlukan, query/filter helper, logging.
6. **Batch F - Modul pilot:** refactor satu CRUD sederhana seperti master item sampai pola terbukti.
7. **Batch G - CRUD backoffice lain:** roles, menus, akses, mitra, cabang, users, user owner, dashboard.
8. **Batch H - Owner/kasir:** mobile, kasir, stok, cashflow, history, harga cabang.
9. **Batch I - High-risk transaction/MQTT:** transaksi, mesin, ACK/status, transaction multi-table.
10. **Batch J - Dependency dan dokumentasi final.**

Setiap batch hanya boleh dimulai apabila dependency test batch sebelumnya sudah hijau.

### Tahap 5 - Modul Pilot: Master Item

Gunakan modul `masterItem` sebagai kandidat pilot karena route, controller, dan model relatif terisolasi. Tetap verifikasi penggunaan client sebelum implementasi.

- [x] Catat contract semua endpoint `/api/backoffice/item`.
- [x] Tambahkan test create, list status, get by ID, get by tipe, update, delete, restore, duplicate, dan not found.
- [x] Tambahkan test bahwa metadata audit tidak dapat dipalsukan jika diputuskan berasal dari token.
- [x] Terapkan validator reusable untuk schema modul ini.
- [x] Ganti text-based error mapping dengan error code/class.
- [x] Hapus rethrow-only `try/catch` pada model.
- [x] Gunakan timestamp helper/kebijakan waktu yang sudah disetujui.
- [ ] Pilih kolom SQL eksplisit jika response contract mengizinkan.
- [x] Pertahankan default list aktif dan behavior `status=all|inactive`.
- [ ] Bandingkan response sebelum/sesudah.
- [ ] Dokumentasikan pola final sebagai contoh untuk modul berikutnya.

Jangan menerapkan pola pilot ke semua modul jika test menunjukkan pola tersebut tidak cocok dengan owner/kasir atau transaksi.

### Tahap 6 - Refactor Bertahap per Modul

Untuk setiap modul, ikuti urutan yang sama:

1. Baca route mount sampai query/model terakhir.
2. Catat kontrak dan business rule.
3. Tambahkan/rapikan characterization test.
4. Ambil satu finding dengan scope kecil.
5. Refactor tanpa mengubah behavior.
6. Jalankan test unit dan integration modul.
7. Jalankan seluruh regression test.
8. Review diff untuk memastikan tidak ada unrelated formatting.
9. Update inventory, finding, roadmap, API docs, dan Postman bila diperlukan.
10. Commit dengan pesan yang menjelaskan satu tujuan.

Urutan modul yang disarankan dari risiko lebih rendah ke lebih tinggi:

```text
masterItem / roles / dashboard
  -> menus / akses / mitra / cabang
  -> users / userOwner / mobile / kasir
  -> settingStokMitra / hargaCabang / history / cashflow
  -> mesin / transaksi / MQTT / firmware contract
```

### Tahap 7 - Verifikasi Akhir

- [x] Semua file dalam inventory memiliki status review per-file. `docs/code-review/inventory.md` sekarang mencatat setiap file scope secara individual, termasuk dependency utama, status, finding terkait, dan alasan `DEFERRED` bila review membutuhkan verifikasi eksternal.
- [x] Semua finding P0/P1 berstatus fixed, accepted risk dengan alasan, atau memiliki blocker eksplisit.
- [x] Semua test dan lint lulus dari clean install. `npm.cmd ci` diikuti `npm.cmd run check` lulus dengan 117 pass dan 1 skip MQTT.
- [x] Server dapat start dan shutdown dengan benar.
- [x] Endpoint utama diuji dengan token backoffice, owner, dan kasir.
- [x] Scope mitra/cabang tidak bocor antar-user; negative authorization dan tenant/cabang integration tests lulus.
- [x] Soft delete dan restore tetap konsisten.
- [x] Transaction rollback telah diuji dengan failure injection.
- [x] MQTT diuji menggunakan mock/fake broker sebelum test perangkat nyata.
- [x] Tidak ditemukan `.env`, `.pem`, `.key`, atau secret file yang ter-track pada audit akhir.
- [x] Dokumentasi route sesuai dengan code aktual.
- [x] Perbandingan baseline menyatakan perubahan kontrak yang disengaja dan disetujui; lihat tabel baseline sebelum/sesudah di `docs/REFACTOR_PHASE_0_BASELINE.md`. Angka gate aktual checkout saat ini adalah 117 pass dan 1 skip MQTT.

## Panduan Detail untuk Junior Programmer / AI Model

### Sebelum mengedit file

1. Buka `src/index.js` dan cari mount route-nya.
2. Buka file route dan catat middleware serta controller.
3. Buka controller dan catat semua input dari `req`.
4. Buka model dan catat query/tabel serta efek samping.
5. Cari pemanggil lain menggunakan `rg "namaFungsi" src`.
6. Cari dokumentasi dan Postman request terkait.
7. Tulis test yang menggambarkan perilaku saat ini.
8. Baru lakukan perubahan terkecil.

### Saat menemukan duplikasi

Jangan langsung membuat helper. Jawab dahulu:

- Apakah kedua blok benar-benar memiliki input/output dan business rule yang sama?
- Apakah keduanya berubah karena alasan yang sama?
- Apakah helper membuat call site lebih mudah dibaca?
- Apakah helper dapat diuji tanpa database/network?
- Apakah abstraction akan menyembunyikan perbedaan owner dan kasir?

Jika jawabannya tidak jelas, catat finding terlebih dahulu dan jangan extract.

### Saat mengubah error handling

- Jangan membandingkan hanya `error.message` jika error dapat memiliki code.
- Gunakan status HTTP yang tepat: 400 input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, dan 500 unexpected error.
- Jangan kirim raw SQL error atau stack ke client.
- Log internal harus memiliki context/request ID, tetapi tidak boleh berisi secret.
- Pastikan error async mencapai handler yang benar.

### Saat mengubah auth atau query tenant

- Jangan percaya `idMitra`, `cabangId`, username, `createdBy`, atau `updatedBy` dari body jika sudah tersedia dari identity terverifikasi.
- Owner harus dibatasi ke mitranya.
- Kasir harus dibatasi ke cabangnya.
- Backoffice dan mobile memiliki bentuk `req.user` berbeda; dokumentasikan mapping-nya.
- Uji negative case akses mitra/cabang lain, bukan hanya happy path.

### Saat mengubah transaksi atau MQTT

- Jangan test otomatis dengan menyalakan mesin fisik.
- Gunakan fake broker/client untuk ACK, timeout, dan request ID.
- Jangan mengubah topic atau payload tanpa membaca backend dan firmware sekaligus.
- Untuk operasi database multi-table, paksa salah satu langkah gagal dan pastikan rollback.
- Pastikan listener dan timer dibersihkan agar tidak terjadi memory leak atau response ganda.

## Larangan

- Jangan refactor seluruh repository dalam satu commit/PR.
- Jangan mengubah route/payload/response hanya agar terlihat lebih rapi tanpa rencana migrasi client.
- Jangan menghapus endpoint duplikat sebelum memastikan apakah endpoint tersebut legacy alias.
- Jangan mengganti semua `SELECT *` tanpa mencatat field response yang digunakan client.
- Jangan menghapus log operasional MQTT tanpa menyediakan logging pengganti yang cukup.
- Jangan menambah framework besar untuk masalah yang dapat diselesaikan helper kecil.
- Jangan menjalankan migration, delete, reset, atau integration test write pada database produksi.
- Jangan menyimpan token, `.env`, dump database, email credential, broker credential, atau data pribadi di dokumentasi/test fixture.
- Jangan mencampur dependency major upgrade dengan clean-code refactor.
- Jangan menandai finding selesai tanpa test atau bukti manual yang dapat diulang.

## Acceptance Criteria

- [x] Seluruh file dalam scope tercantum dan berstatus review per-file di inventory. Setiap file source, quality-gate script, file operasional, dokumentasi API, Postman collection, dan kontrak firmware memiliki baris status individual; `.env` dicatat sebagai pengecualian karena isi secret tidak direview.
- [x] Daftar finding memakai format baku, memiliki bukti/lokasi, dan sudah diprioritaskan.
- [x] Roadmap menjelaskan urutan, dependency, risiko, ukuran, dan test setiap refactor.
- [x] Temuan awal PRE-001 sampai PRE-018 sudah diverifikasi dan diubah menjadi finding final, ditolak dengan bukti, atau di-defer dengan alasan.
- [x] Ada test baseline untuk auth backoffice/mobile, satu CRUD, transaction, serta MQTT flow.
- [x] Ada command tunggal `npm run check` atau ekuivalen yang menjalankan quality gate.
- [x] Refactor tidak menyebabkan regression pada contract yang diuji; characterization, controller, authorization, dan integration tests tetap lulus (117 pass, 1 skip MQTT). Klaim ini terbatas pada endpoint dan fixture yang memiliki regression test.
- [x] Error response tidak membocorkan detail internal.
- [x] Authorization tenant/cabang memiliki negative test.
- [x] Tidak ada `.env`, `.pem`, `.key`, atau secret file baru yang ter-track; audit akhir tidak menemukan credential file pada repository.
- [x] Dokumentasi setup, architecture, environment, test, dan API untuk scope aktif sudah sinkron. Postman membedakan route catalog tersinkron dari request verified agar contract route tidak disamakan dengan smoke test runtime.
- [x] Perubahan high-risk dipisah dari cleanup kosmetik dan dapat di-rollback melalui commit delivery ini.

## Definition of Done per Refactor Task

Satu task refactor baru dianggap selesai jika:

- Finding dan scope-nya jelas.
- Test sebelum perubahan tersedia atau alasan test manual terdokumentasi.
- Perubahan kecil dan hanya menyentuh file yang relevan.
- Lint/syntax/test modul lulus.
- Regression suite lulus.
- Tidak ada perubahan kontrak tersembunyi.
- Security/tenant boundary telah diuji jika relevan.
- Dokumentasi/finding/inventory diperbarui.
- Reviewer dapat memahami alasan perubahan dari diff dan commit message.

## Contoh Pembagian Task/PR

- PR 1: Pisahkan Express app dari server startup dan tambahkan test harness.
- PR 2: Samakan error status dan tambahkan safe global error handler.
- PR 3: Audit serta perbaiki auth route stok mitra setelah requirement dikonfirmasi.
- PR 4: Tambahkan validation helper dan refactor modul master item sebagai pilot.
- PR 5: Pindahkan audit identity dari body ke token dengan compatibility plan.
- PR 6: Konsolidasikan date/time helper dan test boundary Asia/Jakarta.
- PR 7: Refactor CRUD backoffice per domain.
- PR 8: Refactor owner/kasir dengan tenant/cabang authorization tests.
- PR 9: Refactor transaction boundaries.
- PR 10: Refactor MQTT lifecycle menggunakan fake broker dan verifikasi firmware contract.
- PR 11: Bersihkan dependency/lockfile dan selesaikan dokumentasi.

## Checklist Handoff Reviewer

- [ ] Apakah implementer membuktikan masalah sebelum mengubah code?
- [ ] Apakah perubahan mempertahankan existing behavior?
- [ ] Apakah extraction memang mengurangi duplikasi nyata?
- [ ] Apakah nama fungsi menjelaskan business intent?
- [ ] Apakah controller tetap tipis dan model tidak menangani HTTP response?
- [ ] Apakah input validation mencakup tipe dan batas nilai?
- [ ] Apakah error aman untuk client dan berguna di log internal?
- [ ] Apakah query aman, scoped, dan menggunakan transaction bila perlu?
- [ ] Apakah owner/kasir/backoffice diuji terpisah?
- [ ] Apakah perubahan MQTT diuji tanpa bergantung pada mesin fisik?
- [x] Apakah documentation dan Postman ikut diperbarui untuk perubahan yang dikirim?
- [ ] Apakah task cukup kecil untuk di-review dan di-rollback?
