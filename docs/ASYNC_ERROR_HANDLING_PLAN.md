# Rencana Implementasi `catchAsync` dan Error Handling Terpusat

## Ringkasan

Refactor controller agar rejection dari fungsi `async` diteruskan ke global `errorHandler` melalui wrapper `catchAsync`. Setelah migrasi, controller tidak lagi membuat respons 500 sendiri. Controller hanya menangani validasi request dan respons sukses, sedangkan error bisnis dilempar sebagai error bertipe melalui `createHttpError`.

Dokumen ini ditulis sebagai handoff untuk junior programmer atau model AI dengan konteks terbatas. Kerjakan sesuai urutan. Jangan menghapus seluruh `try-catch` sekaligus.

## Kondisi Saat Dokumen Dibuat

- Aplikasi memakai Express 4.18.2. Express versi ini tidak otomatis meneruskan rejected Promise dari controller ke error middleware.
- Global handler tersedia di `src/middleware/errorHandler.js` dan dipasang paling akhir di `src/app.js`.
- Helper `createHttpError` tersedia di `src/utils/httpError.js` dengan kontrak:

  ```js
  createHttpError(statusCode, message, code)
  ```

- Terdapat sekitar 103 blok `catch (error)` pada 17 file controller.
- Terdapat sekitar 107 deklarasi endpoint dalam `src/routes`.
- Banyak controller masih mengembalikan bentuk error lama seperti:

  ```json
  {
    "message": "Server Error",
    "serverMessage": "detail database"
  }
  ```

- Beberapa controller menentukan 400/404/409 dengan membandingkan `error.message`.
- Beberapa operasi memang membutuhkan `try-catch`, misalnya rollback transaction, fallback autentikasi, dan email best-effort.

Angka di atas adalah snapshot. Jalankan ulang pencarian sebelum implementasi:

```powershell
rg -n "catch \(error\)|catch \(err\)" src/controller
rg -n "res\.status\(5[0-9][0-9]\)" src/controller
rg -n "router\.(get|post|put|patch|delete)\(" src/routes
```

## Tujuan

1. Semua rejected Promise dari route handler diteruskan ke global `errorHandler`.
2. Controller tidak mengirim respons 500 secara manual.
3. Error bisnis memiliki `statusCode`, `code`, dan `message` yang stabil.
4. Detail internal database, MQTT, email, dan stack trace tidak bocor ke client.
5. Status HTTP dan aturan bisnis lama tidak berubah tanpa keputusan eksplisit.
6. `try-catch` hanya dipertahankan jika melakukan recovery, cleanup, rollback, fallback, atau menambah konteks sebelum melempar ulang error.
7. Migrasi dapat direview dan di-rollback per batch.

## Bukan Tujuan

- Tidak mengubah seluruh validasi request menjadi library schema validation dalam pekerjaan ini.
- Tidak memindahkan seluruh business logic controller ke service layer sekaligus.
- Tidak meng-upgrade Express ke versi 5 dalam pekerjaan ini.
- Tidak mengubah payload sukses endpoint.
- Tidak menghapus `try-catch` pada model yang bertanggung jawab atas rollback transaction.
- Tidak mencampur refactor ini dengan perubahan SQL atau business rule yang tidak berkaitan.

## Kontrak Akhir yang Diharapkan

### Alur request

```text
request
  -> middleware auth/authorization
  -> catchAsync(controller)
  -> controller
  -> model/service
  -> throw createHttpError(...) jika gagal
  -> catchAsync meneruskan error ke next(error)
  -> global errorHandler
  -> response error konsisten
```

### Bentuk respons error target

```json
{
  "success": false,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Data tidak ditemukan"
}
```

Untuk error 500 ke atas, global handler harus tetap mengganti pesan dengan `Internal Server Error`.

### Aturan kompatibilitas

- Status HTTP lama wajib dipertahankan, kecuali test membuktikan status lama salah.
- Pesan 4xx yang dipakai frontend harus tetap bermakna sama.
- Perubahan bentuk body error dari `{ error: "..." }` menjadi format global adalah perubahan kontrak. Catat dalam dokumentasi dan pastikan frontend membaca `message` atau `code`.
- Jika frontend belum siap, jangan menggabungkan batch yang mengubah bentuk respons tersebut. Tambahkan compatibility handling terlebih dahulu atau koordinasikan perubahan frontend.

## Tahap 0 — Inventaris Kontrak Error

### Pekerjaan

1. Buat tabel inventaris sementara untuk setiap endpoint yang akan dimigrasikan. Minimal berisi:

   | Route | Controller | Error lama | Status | Error target | Code |
   |---|---|---|---:|---|---|
   | `GET /api/.../:id` | `getById` | `data not found` | 404 | `Data tidak ditemukan` | `RESOURCE_NOT_FOUND` |

2. Cari semua pola berikut:

   ```powershell
   rg -n "error\.message ===|error\.statusCode|res\.status\(4|res\.status\(5" src/controller
   rg -n "throw new Error|createHttpError" src/models src/controller
   rg -n "serverMessage|details:.*error|error:.*error\.message" src/controller
   ```

3. Tandai setiap `try-catch` dengan salah satu kategori:

   - `HTTP_ONLY`: hanya membuat respons HTTP; harus dihapus.
   - `BUSINESS_MAPPING`: mengubah pesan menjadi 400/404/409; ubah sumber error menjadi typed error sebelum catch dihapus.
   - `RECOVERY`: kegagalan sengaja ditoleransi, misalnya email best-effort; pertahankan.
   - `TRANSACTION`: rollback/release connection; pertahankan, tetapi lempar ulang error.
   - `FALLBACK`: mencoba jalur alternatif seperti backoffice lalu mobile; pertahankan.
   - `OBSERVABILITY`: hanya logging; biasanya pindahkan logging ke global handler lalu hapus catch.

### Output

- Inventaris endpoint dan error bisnis yang akan dipertahankan.
- Daftar `try-catch` yang boleh tetap ada beserta alasannya.

### Acceptance criteria

- Tidak ada controller yang dimigrasikan sebelum mapping status 4xx-nya diketahui.
- Semua error yang saat ini dibandingkan melalui `error.message` sudah tercatat.

## Tahap 1 — Tambahkan Fondasi `catchAsync`

### File baru

- `src/utils/catchAsync.js`
- `test/catchAsync.test.js`

### Implementasi minimum

```js
const catchAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = { catchAsync };
```

Jangan membuat wrapper mengirim respons. Tugas wrapper hanya memanggil handler dan meneruskan error ke `next`.

### Test wajib

1. Handler async sukses tidak memanggil `next` dengan error.
2. Handler yang melempar error meneruskan object error yang sama ke `next`.
3. Handler yang mengembalikan rejected Promise diteruskan ke `next`.
4. Nilai `req`, `res`, dan `next` diteruskan tanpa perubahan.

Contoh inti test:

```js
test("catchAsync forwards rejected promises", async () => {
  const expectedError = new Error("boom");
  let receivedError;
  const wrapped = catchAsync(async () => {
    throw expectedError;
  });

  await wrapped({}, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError, expectedError);
});
```

### Test global error handler

Tambahkan atau lengkapi test untuk:

- typed 400 diteruskan sebagai 400 dan tidak disanitasi menjadi 500;
- typed 404 mempertahankan `code` dan `message`;
- error biasa menjadi 500 `INTERNAL_SERVER_ERROR`;
- detail internal tidak muncul pada response 500;
- `res.headersSent === true` memanggil `next(error)`.

### Acceptance criteria

- `catchAsync` tidak bergantung pada package baru.
- Seluruh test fondasi lulus.
- Belum ada controller yang diubah pada commit fondasi ini.

## Tahap 2 — Standarkan Typed Error

Tahap ini harus selesai sebelum catch HTTP dihapus.

### Aturan

Gunakan urutan argument yang benar:

```js
throw createHttpError(404, "Mesin tidak ditemukan", "MACHINE_NOT_FOUND");
```

Jangan gunakan:

```js
throw createHttpError("Mesin tidak ditemukan", 404);
```

### Lokasi yang wajib diperiksa lebih dahulu

`src/models/transaksi.js` memiliki beberapa pemanggilan dengan argument terbalik di area validasi mesin, transaksi pending, dryer, dan MQTT. Cari semuanya:

```powershell
rg -n "createHttpError\(" src/models/transaksi.js
```

Perbaiki seluruh pemanggilan agar konsisten dengan `src/utils/httpError.js`.

### Mapping minimum yang disarankan

| Kondisi | Status | Contoh code |
|---|---:|---|
| request tidak valid | 400 | `VALIDATION_ERROR` |
| token/identitas tidak valid | 401 | `UNAUTHORIZED` |
| scope tenant/role salah | 403 | `FORBIDDEN` |
| data tidak ditemukan | 404 | `<DOMAIN>_NOT_FOUND` |
| duplikat atau state conflict | 409 | `<DOMAIN>_CONFLICT` |
| email provider gagal yang memang diekspos sebagai HTTP error | 503 | `EMAIL_DELIVERY_FAILED` |
| MQTT upstream gagal yang memang diekspos sebagai HTTP error | 502/504 | `MQTT_COMMAND_FAILED` / `MQTT_ACK_TIMEOUT` |

Gunakan code yang spesifik jika client perlu membedakan penyebab. Jangan memakai pesan manusia sebagai identifier programatik.

### Tempat melempar error

- Error yang berasal dari hasil query/model sebaiknya dilempar dari model atau service.
- Validasi bentuk request sederhana boleh tetap dilakukan di controller dan langsung mengembalikan 400 untuk tahap awal.
- Jika helper controller menemukan kegagalan, helper boleh melempar typed error agar happy path controller tidak memeriksa `{ error, statusCode }`.

Contoh refactor helper:

```js
if (!cabangValid) {
  throw createHttpError(403, "Cabang tidak sesuai dengan mitra atau tidak aktif", "BRANCH_SCOPE_FORBIDDEN");
}
```

### Acceptance criteria

- Tidak ada pemanggilan `createHttpError` dengan urutan argument salah.
- Error 400/401/403/404/409 yang sebelumnya ditangani berdasarkan pesan sudah mempunyai `statusCode` dan `code`.
- Unit/integration test membuktikan status lama tetap sama.

## Tahap 3 — Pilot pada `masterItem`

Pilih `masterItem` sebagai pilot karena modelnya sudah memakai `createHttpError` dan controller memiliki unit test.

### File target

- `src/routes/masterItem.js`
- `src/controller/masterItem.js`
- `test/masterItem.controller.test.js`
- `test/catchAsync.test.js`

### Langkah

1. Import `catchAsync` pada route.
2. Bungkus setiap controller async:

   ```js
   router.get("/", authenticate, catchAsync(MasterItemController.getAllMasterItem));
   ```

3. Hapus `sendServerError`, `sendKnownError`, dan `try-catch` yang hanya membuat respons HTTP.
4. Biarkan validasi request dan response sukses tetap sama.
5. Ubah test controller error: controller sekarang menghasilkan rejected Promise, sedangkan test route/integration membuktikan global handler membentuk response.
6. Pastikan 404 dan 409 dari model sampai ke global handler tanpa berubah menjadi 500.

### Acceptance criteria

- Tidak ada `res.status(500)` di `src/controller/masterItem.js`.
- Seluruh route master item memakai `catchAsync`.
- Success response tidak berubah.
- 404 dan 409 tetap benar.
- Error database tak dikenal menghasilkan 500 generik tanpa `serverMessage`.

Jangan melanjutkan ke batch lain sebelum pilot stabil.

## Tahap 4 — Migrasi Controller Sederhana

Migrasikan satu modul per commit atau satu kelompok kecil yang memiliki test serupa.

### Batch 4A: read-only dan transformasi sederhana

- `src/controller/dashboard.js`
- `src/controller/history.js`
- `src/controller/hargaCabang.js`
- `src/controller/notifikasi.js`

Route terkait:

- `src/routes/dashboard.js`
- `src/routes/history.js`
- `src/routes/hargaCabang.js`
- `src/routes/mobile.js` untuk notifikasi

### Langkah per controller

1. Catat response sukses dan semua status error.
2. Pastikan model melempar typed 404 bila data memang wajib ada.
3. Tambahkan `catchAsync` di route.
4. Hapus catch yang hanya mengirim 500/404.
5. Pertahankan validasi request langsung untuk sementara.
6. Tambahkan test satu happy path, satu known error, dan satu unknown error.

### Acceptance criteria batch

- Tidak ada direct 500 response pada controller yang selesai dimigrasikan.
- Tidak ada `serverMessage`, `details: error.message`, atau raw SQL error pada response.
- Endpoint history dan notifikasi tetap menjaga scope tenant/cabang.

## Tahap 5 — Migrasi CRUD Backoffice

### Batch 5A

- `mitra.js`
- `cabang.js`
- `menus.js`
- `roles.js`

### Batch 5B

- `users.js`
- `userOwner.js`
- `mesin.js`

### Perhatian khusus

- Pertahankan penggunaan username hasil autentikasi untuk `createdBy` dan `updatedBy`.
- Jangan menerima kembali audit field dari body request.
- Error duplicate harus menjadi 409 jika memang conflict, bukan 500.
- Error data tidak ditemukan harus 404.
- Error permission harus tetap 403 dan ditangani middleware authorization.
- Kegagalan pengiriman email reset-password boleh dipertahankan sebagai fallback internal/response generik yang sudah ada; tidak wajib dipaksakan menjadi typed HTTP 503.
- Jika provider email atau MQTT memang dipetakan ke HTTP response, gunakan typed error dan sanitasi detail provider. Jika tidak, pertahankan fallback/recovery internal tanpa membocorkan detail.

### Test minimum per modul

- create sukses;
- validation 400;
- duplicate/conflict 409 bila relevan;
- get/update/delete ID tidak ditemukan 404;
- database error tak dikenal 500 generik;
- audit username berasal dari token;
- permission middleware tetap bekerja.

## Tahap 6 — Migrasi Owner dan Kasir

### File target

- `src/controller/kasir.js`
- `src/controller/cashflow.js`
- `src/controller/settingStokMitra.js`
- `src/controller/mobile.js`

### Aturan scope

- Jangan mengambil `idMitra`, `cabangId`, role, atau actor dari body jika sudah tersedia dari `req.user`.
- Owner harus tetap dibatasi ke mitranya.
- Kasir harus tetap dibatasi ke cabangnya.
- Refactor error handling tidak boleh melemahkan middleware auth/authorization.

### Catch yang mungkin tetap diperlukan

Email credential pada pembuatan kasir saat ini bersifat best-effort. Jika business rule tetap menyatakan pembuatan user berhasil walaupun email gagal, catch lokal boleh tetap ada:

```js
try {
  await sendCredentialEmail(...);
} catch (error) {
  console.error("Gagal mengirim email credential", { message: error.message });
}
```

Catch tersebut bukan HTTP error handler dan tidak boleh dihapus tanpa keputusan business.

### Acceptance criteria

- Semua endpoint owner/kasir mempertahankan tenant dan branch scope.
- Login, activation, logout, dan reset-password mempertahankan status/code keamanan yang sudah ada.
- Tidak ada data provider/email mentah dalam response 5xx.

## Tahap 7 — Migrasi Transaksi, MQTT, dan Akses

Kerjakan terakhir karena area ini memiliki transaction, rollback, MQTT, dan state mesin.

### File target

- `src/controller/transaksi.js`
- `src/controller/akses.js`
- `src/routes/transaksi.js`
- `src/routes/transaksiStartMesin.js`
- `src/routes/akses.js`
- model/helper terkait bila typed error belum tersedia

### Transaksi dan MQTT

1. Ubah helper context agar melempar typed error, bukan mengembalikan `{ statusCode, error }`.
2. Pastikan semua error model transaksi menggunakan urutan `createHttpError` yang benar.
3. Bedakan error berikut:

   - mesin/order tidak ditemukan: 404;
   - mesin tidak tersedia atau state tidak cocok: 409;
   - scope mitra/cabang salah: 403;
   - payload mesin/invoice salah: 400;
   - broker/ACK gagal: 502 atau 504 sesuai kontrak yang dipilih.

4. Bungkus controller route dengan `catchAsync`.
5. Hapus catch controller yang hanya meneruskan `error.statusCode` atau mengirim 500.
6. Jangan menghapus rollback/release di model transaksi.

### Akses dan transaction di controller

`saveAksesRole` saat ini membuka transaction di controller. Pilihan yang disarankan:

1. Pindahkan transaction ke model/service dalam perubahan terpisah; atau
2. Pertahankan cleanup lokal sementara:

   ```js
   try {
     // begin, query, commit
   } catch (error) {
     if (connection) await connection.rollback();
     throw error;
   } finally {
     if (connection) connection.release();
   }
   ```

Catch di atas tetap dibutuhkan karena melakukan rollback. Yang dihapus hanya `res.status(500)` dari catch tersebut.

### Acceptance criteria

- Rollback terjadi bila query transaction gagal.
- Connection selalu dilepas.
- MQTT failure tercatat sebagai failed log dan tidak mengubah state mesin secara keliru.
- Owner/backoffice/kasir actor dan tenant scope tetap benar.
- Semua error sampai ke global handler melalui `catchAsync`.

## `try-catch` yang Tidak Boleh Dihapus Secara Mekanis

Pertahankan bila memenuhi salah satu kondisi:

1. Melakukan `rollback()` atau `release()`.
2. Menjalankan compensation setelah side effect gagal.
3. Menoleransi kegagalan best-effort yang memang tidak membatalkan operasi utama.
4. Mencoba autentikasi/fallback alternatif.
5. Mengonversi error provider menjadi typed domain error lalu melempar ulang.

Contoh file yang perlu perhatian:

- `src/middleware/authCombined.js`: fallback backoffice/mobile.
- `src/controller/akses.js`: transaction masih berada di controller.
- `src/controller/kasir.js`: email credential best-effort.
- `src/controller/users.js`, `userOwner.js`, dan `kasir.js`: reset-password email memiliki fallback internal; typed 503 hanya diperlukan bila kontrak endpoint memang mengekspos kegagalan provider.
- `src/models/transaksi.js`: rollback, MQTT failure logging, dan state transition.

## Quality Gate Setelah Migrasi

### Script baru yang disarankan

Tambahkan `scripts/check-controller-error-handling.js` untuk menggagalkan build bila controller kembali membuat respons 5xx langsung.

Pola minimum yang dilarang di `src/controller`:

- `res.status(500)`;
- `res.status(502)` dan status 5xx manual lain;
- property `serverMessage`;
- property `details` yang mengambil `error.message`;
- catch yang hanya berisi logging lalu respons 500.

Jangan melarang semua kata `catch`, karena catch recovery/rollback masih valid.

Tambahkan script package:

```json
{
  "scripts": {
    "check:error-handling": "node scripts/check-controller-error-handling.js"
  }
}
```

Masukkan ke `npm run check` setelah lint dan sebelum test.

### Validasi wajib setiap batch

```powershell
node --check <setiap-file-js-yang-diubah>
npm.cmd run lint
npm.cmd test
npm.cmd run check
git diff --check
```

Untuk batch kecil, jalankan test fokus dahulu lalu suite penuh.

## Strategi Test

### Characterization test sebelum refactor

Sebelum mengubah suatu endpoint, test harus mencatat:

- status sukses;
- bentuk payload sukses;
- 400 validation;
- 401/403 auth dan scope;
- 404 not found;
- 409 conflict bila relevan;
- unknown error menjadi 500 tanpa detail internal.

### Pembagian tanggung jawab test

- Unit test `catchAsync`: memastikan Promise rejection diteruskan.
- Unit test model/service: memastikan typed error memiliki status/code yang tepat.
- Unit test controller: memastikan validasi dan happy path.
- Integration test HTTP: memastikan route wrapper dan global error handler bekerja bersama.

Jangan hanya menguji controller secara langsung untuk fitur ini, karena tujuan utama refactor berada pada integrasi route -> `catchAsync` -> global handler.

## Urutan Commit/PR yang Disarankan

1. `refactor(error): add catchAsync and global handler tests`
2. `fix(transaksi): normalize createHttpError argument order and codes`
3. `refactor(master-item): route errors through global handler`
4. `refactor(read-controllers): centralize dashboard history price and notification errors`
5. `refactor(backoffice-crud): centralize mitra cabang menu and role errors`
6. `refactor(user-management): centralize users owner and machine errors`
7. `refactor(mobile): centralize kasir cashflow stock and auth errors`
8. `refactor(transaksi): centralize transaction MQTT and access errors`
9. `chore(error): add controller error-handling quality gate and update docs`

Setiap commit harus lulus test dan dapat di-rollback sendiri. Jangan menggabungkan semua controller dalam satu commit.

## Kesalahan Umum yang Harus Dihindari

1. Menghapus catch sebelum error bisnis mempunyai `statusCode`.
2. Membalik argument `createHttpError`.
3. Membungkus controller tetapi lupa mengembalikan hasil wrapper dari route.
4. Memasang `errorHandler` sebelum route atau sebelum `notFoundHandler`.
5. Mengirim response lalu tetap melempar error sehingga terjadi `headers already sent`.
6. Menghapus catch rollback/recovery karena dianggap duplikasi.
7. Mengubah success payload saat hanya mengerjakan error handling.
8. Menampilkan `error.message` untuk 5xx ke client.
9. Mengandalkan string message sebagai code programatik.
10. Menyelesaikan seluruh migrasi tanpa integration test HTTP.

## Definition of Done

Pekerjaan dianggap selesai hanya jika:

- seluruh async controller route telah dibungkus `catchAsync`;
- tidak ada direct 5xx response di `src/controller`;
- seluruh known HTTP error yang mencapai request boundary menggunakan typed error dengan status dan code; error provider/internal seperti email, MQTT, dan fallback reset-password boleh tetap plain selama tidak dipetakan sebagai kontrak HTTP dan tidak membocorkan detail internal;
- seluruh pemanggilan `createHttpError` memakai urutan argument yang benar;
- catch tersisa memiliki alasan recovery/rollback/fallback yang jelas;
- success response endpoint tidak berubah;
- kontrak error baru terdokumentasi dan frontend telah dinyatakan kompatibel;
- test mencakup wrapper, global handler, known error, unknown error, dan endpoint berisiko;
- quality gate mencegah pola manual 500 kembali;
- `npm.cmd run check` dan `git diff --check` lulus;
- perubahan dipecah ke commit yang dapat direview dan di-rollback.

## Checklist Handoff untuk Implementer

- [ ] Baca dokumen ini sampai selesai.
- [ ] Jalankan baseline `npm.cmd run check` sebelum mengubah code.
- [ ] Buat inventaris status/code error untuk batch yang dipilih.
- [ ] Tambahkan test sebelum menghapus catch.
- [ ] Tambahkan `catchAsync` dan test fondasi.
- [ ] Standarkan typed error di model/service.
- [ ] Migrasikan satu batch kecil.
- [ ] Periksa catch yang harus tetap ada.
- [ ] Jalankan test fokus dan suite penuh.
- [ ] Periksa bahwa response 5xx tidak membocorkan detail.
- [ ] Perbarui dokumentasi kontrak bila bentuk error berubah.
- [ ] Commit hanya perubahan batch tersebut.
- [ ] Ulangi untuk batch berikutnya.
