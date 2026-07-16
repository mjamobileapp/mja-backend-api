# Rencana Penghilangan Magic Strings Role dan Status Mesin

## Ringkasan

Dokumen ini adalah handoff implementation-ready untuk mengurangi magic strings yang mewakili vocabulary bisnis, terutama:

- role mobile `owner` dan `kasir`;
- jenis akun `backoffice`, `owner`, dan `kasir` yang dipakai untuk pemilihan template atau alur akun;
- actor audit kontrol mesin `backoffice`, `owner`, dan `kasir`;
- status mesin `READY`, `IN_USE`, dan `OFFLINE`.

Implementasi harus memindahkan vocabulary tersebut ke module domain yang sesuai. Jangan membuat satu file global `src/utils/constants.js` yang menampung semua string aplikasi. Konstanta role, actor, dan status mesin adalah kontrak domain, bukan utility generik.

Refactor ini wajib behavior-preserving. Nilai string yang tersimpan di database, dikirim melalui JWT, diterima melalui MQTT, ditulis pada log mesin, dan dikembalikan oleh API tidak boleh berubah pada pekerjaan ini.

Dokumen ini ditulis untuk junior programmer atau model AI dengan konteks terbatas. Ikuti fase secara berurutan, selesaikan exit gate setiap fase, dan jangan melakukan rename nilai persisted/wire contract dalam commit refactor yang sama.

## Posisi terhadap Dokumen Refactor Lain

`docs/REFACTOR_IMPLEMENTATION_SEQUENCE_PLAN.md` tetap menjadi sumber riwayat dan urutan refactor besar yang sudah ada. Pekerjaan magic strings ini adalah follow-up mandiri setelah baseline refactor tersebut stabil.

Dokumen ini tidak memberi izin untuk membuka kembali atau mencampur pekerjaan berikut:

- perubahan harga transaksi;
- migrasi transaction helper;
- migrasi error handling massal;
- perubahan topic atau payload MQTT;
- perubahan firmware;
- perubahan schema database;
- rename endpoint atau payload API.

Jika implementer menemukan kebutuhan terhadap salah satu pekerjaan tersebut, catat sebagai follow-up dan hentikan perluasan scope.

## Tujuan

1. Menetapkan satu sumber nilai canonical untuk setiap vocabulary domain yang masuk scope.
2. Mengurangi risiko typo seperti `in_use`, `IN-USE`, `Owner`, atau `cashier` pada business logic.
3. Membuat perbandingan role dan status menggunakan helper normalisasi yang konsisten.
4. Memisahkan konsep mobile role, token type, account type, dan actor audit.
5. Mengganti literal role/status di query SQL dengan bind parameter.
6. Mempertahankan seluruh kontrak HTTP, database, JWT, MQTT, dan audit yang sudah berjalan.
7. Menambahkan quality gate agar magic strings yang sudah dimigrasikan tidak muncul kembali pada production logic.

## Bukan Tujuan

Pekerjaan ini tidak boleh:

- mengubah `owner` menjadi nama lain;
- mengubah `kasir` menjadi `cashier`;
- mengubah `READY`, `IN_USE`, atau `OFFLINE`;
- menambahkan role atau status mesin baru;
- membuat status `MAINTENANCE`; route maintenance saat ini menggunakan status `OFFLINE`;
- mengubah role backoffice menjadi string; role backoffice tetap menggunakan ID role numerik;
- mengganti `TOKEN_TYPES` yang sudah terpusat tanpa alasan kompatibilitas yang terverifikasi;
- memindahkan seluruh string, pesan error, route path, nama kolom SQL, error code, atau nama template ke file constants;
- mengubah response body, status HTTP, authorization scope, atau tenant/cabang scope;
- menambahkan dependency baru;
- melakukan database migration atau firmware deployment.

## Terminologi yang Wajib Dipahami

### Mobile role

`owner` dan `kasir` adalah nilai kolom `tbl_users_mobile.role` dan muncul pada `req.user.role` setelah autentikasi mobile.

### Backoffice role

Backoffice tidak menggunakan string `backoffice` sebagai role authorization. Backoffice menggunakan ID role numerik dari `tbl_users.roleId`. String `backoffice` dipakai sebagai token type, account type, atau actor audit tergantung konteks.

Jangan membuat struktur berikut:

```js
const ROLES = {
  BACKOFFICE: "backoffice",
  OWNER: "owner",
  KASIR: "kasir",
};
```

Nama `ROLES` di atas menyesatkan karena tiga nilai tersebut tidak mempunyai semantics authorization yang sama.

### Token type

`backoffice` dan `mobile` pada JWT adalah token type. Sumber canonical yang sudah ada adalah `TOKEN_TYPES` di `src/utils/jwt.js`. Jangan menduplikasi token type di module baru.

### Account type

Account type digunakan ketika code perlu memilih alur berdasarkan keluarga akun, misalnya template email reset password. Account type boleh berisi `backoffice`, `owner`, dan `kasir`, tetapi tidak boleh dipakai untuk menggantikan pengecekan role ID backoffice.

### Machine-control actor type

Actor type adalah identitas pelaku yang disimpan pada audit/log kontrol mesin. Nilainya saat ini dapat berupa `backoffice`, `owner`, atau `kasir`. Actor type bukan token type dan bukan mobile role, walaupun sebagian nilainya sama.

### Machine status

Status mesin adalah state persisted dan wire contract. Nilai saat ini:

- `READY`;
- `IN_USE`;
- `OFFLINE`.

Nilai tersebut digunakan oleh database, model, API, dan listener MQTT. Perubahan namanya membutuhkan migration/deployment plan terpisah.

## Kondisi Saat Dokumen Dibuat

### Fondasi yang sudah ada

- `src/utils/jwt.js` sudah mengekspor `TOKEN_TYPES` menggunakan `Object.freeze`.
- `src/domain/transaksi.js` menunjukkan bahwa business vocabulary dan pure validation dapat ditempatkan di folder `src/domain`.
- `scripts/check-refactor-quality.js` sudah menjadi quality gate repository dan dapat diperluas secara terarah.
- Test authorization, transaksi machine-control, model mesin, MQTT fake broker, dan core-domain integration sudah tersedia sebagai regression coverage awal.

### Magic strings role yang terlihat pada production logic

File prioritas tinggi:

```text
src/middleware/authorization.js
src/middleware/authCombined.js
src/controller/cashflow.js
src/controller/kasir.js
src/controller/mobile.js
src/controller/notifikasi.js
src/controller/settingStokMitra.js
src/models/kasir.js
src/models/userOwner.js
src/utils/email.js
```

File yang memakai nilai serupa sebagai actor, bukan role:

```text
src/middleware/authCombined.js
src/controller/transaksi.js
src/models/transaksi.js
```

File yang memakai `backoffice` sebagai token type:

```text
src/utils/jwt.js
src/middleware/auth.js
src/middleware/authMobile.js
```

Kelompok terakhir sudah mempunyai source of truth `TOKEN_TYPES` dan tidak boleh dicampur dengan `MOBILE_ROLES`.

### Magic strings status mesin yang terlihat pada production logic

```text
src/models/mesin.js
src/models/transaksi.js
src/utils/mqttStatusListener.js
```

Pemakaiannya mencakup:

- nilai default ketika detail mesin dibuat;
- pengecekan mesin boleh start hanya ketika `READY`;
- pengecekan mesin boleh stop hanya ketika `IN_USE`;
- update menjadi `IN_USE` setelah start berhasil;
- update menjadi `READY` setelah stop atau status firmware diterima;
- update menjadi `OFFLINE` melalui workflow maintenance;
- response model yang mengembalikan status;
- query yang menentukan apakah waktu selesai perlu ditampilkan.

### Test yang menjadi compatibility gate

Minimum test yang harus diperiksa dan dipertahankan:

```text
test/authorization.middleware.test.js
test/auth.middleware.test.js
test/cashflow.controller.test.js
test/notifikasi.controller.test.js
test/resetPassword.controller.test.js
test/transaksi.machineControl.controller.test.js
test/transaksi.model.test.js
test/mesin.model.test.js
test/mqttFakeBroker.test.js
test/mobileAuth.integration.test.js
test/coreDomains.integration.test.js
```

Jangan mengganti seluruh literal pada test dengan import constant. Beberapa literal harus tetap ada untuk membuktikan bahwa contract eksternal tetap benar. Contoh paling penting adalah payload MQTT literal `{"status":"READY"}` dan row database dengan nilai canonical.

## Keputusan Arsitektur

### 1. Gunakan module per domain

Target file:

```text
src/domain/auth.js
src/domain/mesin.js
src/domain/machineControl.js
```

Jangan membuat:

```text
src/utils/constants.js
src/constants.js
```

File constants global akan menjadi tempat campuran role, status, error code, route, template email, dan topic MQTT yang tidak mempunyai lifecycle sama.

### 2. `src/domain/auth.js`

Kontrak awal yang disarankan:

```js
const MOBILE_ROLES = Object.freeze({
  OWNER: "owner",
  KASIR: "kasir",
});

const ACCOUNT_TYPES = Object.freeze({
  BACKOFFICE: "backoffice",
  OWNER: MOBILE_ROLES.OWNER,
  KASIR: MOBILE_ROLES.KASIR,
});

const normalizeMobileRole = (value) =>
  String(value || "").trim().toLowerCase();

const isMobileRole = (value) =>
  Object.values(MOBILE_ROLES).includes(normalizeMobileRole(value));

module.exports = {
  ACCOUNT_TYPES,
  MOBILE_ROLES,
  isMobileRole,
  normalizeMobileRole,
};
```

Aturan:

- `MOBILE_ROLES` hanya berisi role yang valid pada `tbl_users_mobile.role`.
- `ACCOUNT_TYPES.BACKOFFICE` tidak berarti role backoffice string.
- Jangan menambahkan fallback role diam-diam.
- Normalisasi hanya mengubah case/whitespace untuk comparison; jangan menulis hasil normalisasi ke database tanpa validasi.
- Unknown role harus tetap ditolak oleh authorization.

### 3. `src/domain/mesin.js`

Kontrak awal yang disarankan:

```js
const MACHINE_STATUSES = Object.freeze({
  READY: "READY",
  IN_USE: "IN_USE",
  OFFLINE: "OFFLINE",
});

const normalizeMachineStatus = (value) =>
  String(value || "").trim().toUpperCase();

const isMachineStatus = (value) =>
  Object.values(MACHINE_STATUSES).includes(normalizeMachineStatus(value));

module.exports = {
  MACHINE_STATUSES,
  isMachineStatus,
  normalizeMachineStatus,
};
```

Aturan:

- Jangan menambahkan `MAINTENANCE` hanya karena nama route memakai kata maintenance.
- Jangan mengubah nilai menjadi lowercase.
- Jangan menerima unknown status sebagai valid.
- Jangan memasukkan status order, status notifikasi, atau status perintah MQTT ke file ini.
- State transition map bukan bagian wajib refactor ini. Tambahkan hanya melalui plan terpisah setelah aturan transisinya diaudit.

### 4. `src/domain/machineControl.js`

Kontrak awal yang disarankan:

```js
const { ACCOUNT_TYPES } = require("./auth");

const MACHINE_CONTROL_ACTOR_TYPES = Object.freeze({
  BACKOFFICE: ACCOUNT_TYPES.BACKOFFICE,
  OWNER: ACCOUNT_TYPES.OWNER,
  KASIR: ACCOUNT_TYPES.KASIR,
});

module.exports = { MACHINE_CONTROL_ACTOR_TYPES };
```

Aturan:

- Gunakan actor constant hanya pada audit/command context.
- Jangan gunakan actor constant untuk authorization mobile.
- Jangan gunakan `TOKEN_TYPES.BACKOFFICE` sebagai actor type walaupun nilai string sama.
- Penambahan actor `SYSTEM` atau actor lain bukan bagian pekerjaan ini.

### 5. SQL harus menggunakan bind parameter

Jangan mengganti SQL literal dengan template interpolation:

```js
// Dilarang
`UPDATE tbl_mesin_detail SET status = '${MACHINE_STATUSES.READY}' WHERE id = ?`;
```

Gunakan placeholder:

```js
await connection.execute(
  "UPDATE tbl_mesin_detail SET status = ? WHERE id = ?",
  [MACHINE_STATUSES.READY, mesinId]
);
```

Setiap perubahan jumlah placeholder wajib diikuti pemeriksaan urutan bind values.

## Matriks Kontrak yang Tidak Boleh Berubah

| Area | Kontrak sebelum dan sesudah refactor |
|---|---|
| Mobile DB role | Tetap `owner` atau `kasir` |
| Backoffice authorization | Tetap memakai role ID numerik |
| JWT token type | Tetap `backoffice` atau `mobile` melalui `TOKEN_TYPES` |
| Machine actor audit | Tetap `backoffice`, `owner`, atau `kasir` |
| Machine DB status | Tetap `READY`, `IN_USE`, atau `OFFLINE` |
| MQTT READY payload | Tetap menerima `status: "READY"` |
| HTTP route | Tidak berubah |
| HTTP status/body | Tidak berubah |
| Error code/message | Tidak berubah |
| Tenant/cabang scope | Tidak berubah |
| Email template selection | Tidak berubah |

Jika satu baris pada matriks berubah, batch bukan lagi refactor-only dan harus dihentikan untuk review.

## Urutan Implementasi Wajib

```text
Tahap 0: baseline + inventaris semantic literal
  -> Tahap 1: characterization test
    -> Tahap 2: domain constants + unit test
      -> Tahap 3: mobile-role authorization dan scope
        -> Tahap 4: account type, persistence, dan email
          -> Tahap 5: machine-control actor type
            -> Tahap 6: machine status JavaScript dan SQL
              -> Tahap 7: quality gate + final regression
```

Jangan mengerjakan Tahap 6 sebelum authorization pada Tahap 3 stabil. Perubahan role authorization mempunyai risiko security lebih tinggi dan harus mempunyai checkpoint sendiri.

## Tahap 0 — Baseline dan Inventaris Semantic Literal

### Tujuan

Membedakan string yang benar-benar enum domain dari string yang hanya kebetulan mempunyai teks sama.

### Pekerjaan

1. Jalankan:

   ```powershell
   git status --short --branch
   npm.cmd run check
   git diff --check
   ```

2. Catat jumlah pass/skip aktual. Baseline dokumentasi terakhir mencatat 127 pass dan 1 MQTT skip, tetapi implementer wajib memakai hasil live karena jumlah test dapat bertambah.
3. Inventaris seluruh occurrence:

   ```powershell
   rg -n 'owner|kasir|backoffice|READY|IN_USE|OFFLINE' src test
   ```

4. Klasifikasikan setiap hasil menjadi:

   - mobile role decision;
   - account type/template selection;
   - JWT token type;
   - machine-control actor type;
   - machine status decision;
   - SQL persisted value;
   - external contract test;
   - route path;
   - user-facing message/comment;
   - unrelated identifier.

5. Simpan checklist file yang benar-benar akan diubah pada deskripsi PR atau catatan batch.
6. Periksa bentuk kolom database bila akses tersedia:

   - `tbl_users_mobile.role`;
   - `tbl_mesin_detail.status`;
   - `tbl_log_mesin.actorType`.

7. Jangan mengubah schema atau existing row.

### Stop condition

Hentikan dan minta keputusan bila ditemukan nilai production lain selain:

- mobile role: `owner`, `kasir`;
- machine status: `READY`, `IN_USE`, `OFFLINE`;
- actor type: `backoffice`, `owner`, `kasir`.

Unknown historical value tidak boleh dimasukkan ke constant secara otomatis.

### Exit gate

- Baseline test lulus atau kegagalan existing sudah didokumentasikan.
- Setiap occurrence sudah mempunyai klasifikasi semantics.
- Tidak ada asumsi bahwa semua string `backoffice` adalah role.
- Scope file batch pertama sudah jelas.

## Tahap 1 — Tambahkan Characterization Test

### Tujuan

Mengunci behavior lama sebelum import constant mengganti comparison dan SQL literal.

### Test role minimum

Pastikan test membuktikan:

1. owner diterima oleh owner-only middleware;
2. kasir ditolak oleh owner-only middleware;
3. kasir diterima oleh kasir-only middleware;
4. owner ditolak oleh kasir-only middleware;
5. role dengan case berbeda mengikuti behavior normalisasi saat ini;
6. role kosong, `null`, dan unknown ditolak;
7. kasir hanya dapat mengakses cabang sendiri;
8. owner hanya dapat mengakses mitra sendiri pada combined auth;
9. token backoffice tetap dikenali melalui `TOKEN_TYPES`, bukan mobile role;
10. role ID backoffice tetap numerik dan tidak dibandingkan dengan `ACCOUNT_TYPES.BACKOFFICE`.

### Test actor minimum

Pastikan test membuktikan:

1. request kasir membentuk actor `kasir`;
2. alias owner membentuk actor `owner`;
3. alias backoffice membentuk actor `backoffice`;
4. actor ID dan username tidak berubah;
5. `kasirId` hanya terisi untuk actor kasir;
6. actor type yang ditulis pada log tetap string lama.

### Test status mesin minimum

Pastikan test membuktikan:

1. mesin baru dibuat dengan status `READY`;
2. start hanya menerima mesin `READY`;
3. start sukses mengubah status menjadi `IN_USE`;
4. stop hanya menerima mesin `IN_USE`;
5. stop sukses mengubah status menjadi `READY`;
6. maintenance mengubah status menjadi `OFFLINE`;
7. ready action mengubah `OFFLINE` menjadi `READY` sesuai behavior lama;
8. listener MQTT hanya memproses payload `READY` yang valid;
9. payload status lain seperti `IN_USE` pada status topic tidak diproses sebagai READY;
10. response model tetap mengembalikan status lama.

### Aturan test literal

Gunakan dua jenis test:

- unit/internal test boleh import constant untuk menyusun expected internal value;
- contract/integration test harus mempertahankan beberapa literal eksplisit untuk memastikan nilai eksternal tidak berubah bersama constant.

Jangan membuat semua expected value berasal dari constant. Jika constant salah diubah menjadi `AVAILABLE` dan seluruh test mengimpor constant yang sama, test dapat lulus walaupun contract database/MQTT rusak.

### Exit gate

- Seluruh behavior authorization penting tertutup test.
- Seluruh transisi status yang sudah ada tertutup test.
- Ada literal contract test untuk database/JWT/MQTT.
- Belum ada production logic yang dimigrasikan.

## Tahap 2 — Buat Domain Constants dan Unit Test

### File baru

```text
src/domain/auth.js
src/domain/mesin.js
src/domain/machineControl.js
test/auth.domain.test.js
test/mesin.domain.test.js
test/machineControl.domain.test.js
```

### Langkah

1. Implementasikan API minimum sesuai bagian Keputusan Arsitektur.
2. Gunakan CommonJS `require`/`module.exports` seperti file existing.
3. Jangan mengubah production consumer pada langkah pertama.
4. Tambahkan unit test untuk:

   - object constant dalam keadaan frozen;
   - exact canonical values;
   - normalisasi case dan whitespace;
   - `null`, `undefined`, empty string, dan unknown value;
   - mobile role hanya menerima owner/kasir;
   - machine status hanya menerima tiga status existing;
   - actor values tetap sesuai persisted contract.

5. Jalankan syntax check dan unit test baru.

### Larangan

- Jangan membuat class enum atau dependency enum baru.
- Jangan membuat constant untuk seluruh pesan/error code.
- Jangan mengubah `TOKEN_TYPES`.
- Jangan menambahkan value berdasarkan dugaan roadmap.
- Jangan membuat helper yang membaca `req`, database, atau environment variable.

### Exit gate

- Domain module tidak mempunyai dependency ke Express/database/MQTT.
- Unit test baru lulus.
- Existing test tetap lulus.
- Belum ada perubahan behavior consumer.

## Tahap 3 — Migrasi Mobile Role Authorization dan Scope

### Risiko

Ini adalah batch paling sensitif karena kesalahan comparison dapat membuka akses lintas role, mitra, atau cabang.

### File target utama

```text
src/middleware/authorization.js
src/middleware/authCombined.js
src/controller/cashflow.js
src/controller/kasir.js
src/controller/notifikasi.js
src/controller/settingStokMitra.js
```

`src/controller/mobile.js` hanya boleh disentuh pada occurrence yang benar-benar memakai mobile role. Branch account type/activation dipindahkan pada Tahap 4.

### Langkah per file

1. Import `MOBILE_ROLES` dan `normalizeMobileRole` dari `src/domain/auth.js`.
2. Ganti normalisasi lokal seperti:

   ```js
   String(user?.role || "").toLowerCase()
   ```

   dengan:

   ```js
   normalizeMobileRole(user?.role)
   ```

3. Ganti comparison:

   ```js
   role === "owner"
   role === "kasir"
   ```

   menjadi:

   ```js
   role === MOBILE_ROLES.OWNER
   role === MOBILE_ROLES.KASIR
   ```

4. Jangan mengganti string pada route path, message, atau log hanya karena teksnya sama.
5. Jangan menyederhanakan branch owner/kasir yang mempunyai scope berbeda.
6. Pastikan validation terhadap `idMitra` dan `cabangId` tetap berada pada urutan yang sama.
7. Jalankan test authorization setelah setiap file atau kelompok kecil.

### Compatibility checkpoint

Verifikasi manual/code review bahwa:

- owner tidak memperoleh cabang scope kasir;
- kasir tidak memperoleh owner-wide scope;
- combined backoffice path tetap bekerja;
- unknown role tetap 403;
- response status, code, message, dan body tidak berubah.

### Exit gate

- Semua test authorization dan scope lulus.
- `test/coreDomains.integration.test.js` role-family coverage lulus bila database tersedia.
- Tidak ada perubahan pada model persistence atau status mesin dalam commit ini.
- Diff hanya berisi import, helper normalisasi, comparison, dan test terkait.

## Tahap 4 — Migrasi Account Type, Persistence Role, dan Email

### File target

```text
src/controller/mobile.js
src/controller/users.js
src/controller/userOwner.js
src/controller/kasir.js
src/models/users.js              # audit occurrence; backoffice role tetap numerik
src/models/userOwner.js
src/models/kasir.js
src/utils/email.js
test/resetPassword.controller.test.js
test/mobile.activation.controller.test.js
test/mobileAuth.integration.test.js
test/coreDomains.integration.test.js
```

### Langkah persistence

1. Gunakan `MOBILE_ROLES` untuk value yang ditulis/dibaca dari `tbl_users_mobile.role`.
2. Ubah SQL literal menjadi placeholder.
3. Contoh:

   ```js
   const [rows] = await dbPool.execute(
     "SELECT * FROM tbl_users_mobile WHERE role = ? AND idMitra = ?",
     [MOBILE_ROLES.KASIR, idMitra]
   );
   ```

4. Periksa ulang jumlah dan urutan bind values pada setiap query.
5. Jangan mengubah kondisi `statusAktif`, `idMitra`, atau `cabangId` saat memindahkan role literal.
6. Jangan mengubah data existing.

### Langkah account type/email

1. Gunakan `ACCOUNT_TYPES` untuk pemilihan alur/template yang menerima tiga keluarga akun.
2. Pertahankan signature public/internal function pada batch pertama bila rename parameter memperbesar diff.
3. Ganti branch template secara eksplisit untuk ketiga value.
4. Jangan mempertahankan fallback diam-diam ke owner untuk unknown account type.
5. Jika menghapus fallback akan mengubah behavior, lakukan salah satu:

   - pertahankan fallback sementara dan tambahkan characterization test; atau
   - hentikan batch dan buat perubahan behavior terpisah dengan typed error serta approval.

6. Untuk refactor-only ini, pilihan default adalah mempertahankan behavior lama sambil mencatat fallback sebagai technical debt.

### Catatan security reset password

Endpoint reset password mengembalikan response generik untuk menghindari account enumeration. Jangan mengubah not-found account menjadi response 404 yang terlihat client hanya karena role/account constant sedang dimigrasikan.

### Exit gate

- Query role menggunakan bind parameter dan bind order benar.
- Nilai row baru tetap `owner`/`kasir`.
- Template email yang dipilih tidak berubah.
- Account activation/reset behavior tidak berubah.
- Integration test membuktikan row database tetap menggunakan literal contract lama.

## Tahap 5 — Migrasi Machine-Control Actor Type

### File target

```text
src/middleware/authCombined.js
src/controller/transaksi.js
src/models/transaksi.js
test/transaksi.machineControl.controller.test.js
test/transaksi.model.test.js
test/coreDomains.integration.test.js
```

### Langkah

1. Import `MACHINE_CONTROL_ACTOR_TYPES` hanya pada code machine-control/audit.
2. Ganti object actor:

   ```js
   { type: "owner", ... }
   { type: "backoffice", ... }
   { type: "kasir", ... }
   ```

   dengan constant yang sesuai.

3. Ganti comparison actor type dengan constant actor, bukan `MOBILE_ROLES`.
4. Pertahankan default actor kasir pada model untuk compatibility.
5. Jangan mengubah mapping `actorId`, `actorUsername`, dan `kasirId`.
6. Jangan mengubah schema atau historical row `tbl_log_mesin`.
7. Pertahankan literal pada setidaknya satu integration assertion yang membaca actor type dari database.

### Exit gate

- Owner, kasir, dan backoffice menghasilkan audit actor yang sama seperti baseline.
- Authorization tidak memakai actor constant.
- JWT verification tidak memakai actor constant.
- Machine-control controller/model tests lulus.

## Tahap 6 — Migrasi Machine Status

Tahap ini dibagi dua agar kesalahan JavaScript comparison tidak bercampur dengan perubahan bind SQL.

### Batch 6A — Comparison dan response JavaScript

File target:

```text
src/models/mesin.js
src/models/transaksi.js
src/utils/mqttStatusListener.js
```

Langkah:

1. Import `MACHINE_STATUSES` dan `normalizeMachineStatus`.
2. Ganti comparison status dengan constant.
3. Gunakan normalizer pada input database/MQTT yang sebelumnya memakai `String(...).toUpperCase()`.
4. Ganti response property seperti `status: "READY"` dengan constant.
5. Jangan mengubah status pada SQL di batch ini.
6. Jalankan model dan MQTT test.

Exit gate Batch 6A:

- Behavior comparison sama.
- MQTT listener masih hanya menerima READY.
- SQL diff belum berubah.
- Test model/MQTT lulus.

### Batch 6B — SQL persisted status

File target tetap:

```text
src/models/mesin.js
src/models/transaksi.js
src/utils/mqttStatusListener.js
```

Langkah:

1. Ubah setiap SQL literal status menjadi placeholder.
2. Contoh conversion:

   ```js
   // Sebelum
   "UPDATE tbl_mesin_detail SET status = 'OFFLINE' WHERE id = ?"

   // Sesudah
   "UPDATE tbl_mesin_detail SET status = ? WHERE id = ?"
   ```

   Bind values:

   ```js
   [MACHINE_STATUSES.OFFLINE, id]
   ```

3. Untuk query `UPPER(d.status) = 'IN_USE'`, gunakan:

   ```sql
   UPPER(d.status) = ?
   ```

   dengan bind `MACHINE_STATUSES.IN_USE`.
4. Untuk insert dengan machine type dan status, hitung ulang urutan seluruh placeholder sebelum menjalankan test.
5. Jangan memakai string interpolation.
6. Jangan mengubah `waktuSelesai`, transaction boundary, MQTT ACK, atau log insertion.

### Compatibility checkpoint machine status

Verifikasi bahwa:

- create mesin menyimpan `READY`;
- maintenance menyimpan `OFFLINE`;
- ready action menyimpan `READY` dan membersihkan `waktuSelesai` seperti sebelumnya;
- start menyimpan `IN_USE` hanya setelah ACK sukses;
- stop menyimpan `READY` hanya setelah ACK sukses;
- MQTT READY update tetap scoped berdasarkan ESP/machine type;
- failure/rollback behavior tidak berubah.

### Exit gate Tahap 6

- Seluruh model query mempunyai bind count yang benar.
- Unit/model/MQTT tests lulus.
- Integration test membaca exact persisted values lama.
- Tidak ada database migration.
- Tidak ada perubahan topic/payload firmware.

## Tahap 7 — Quality Gate dan Final Regression

### Tujuan

Mencegah magic strings yang sudah dimigrasikan kembali muncul pada production decision logic tanpa memblokir route path, pesan, comment, atau contract test.

### File target

```text
scripts/refactor-quality-rules.js
scripts/check-refactor-quality.js
test/refactor-quality-rules.test.js
```

Jika `test/refactor-quality-rules.test.js` belum ada, buat file khusus atau gunakan test quality-rule existing yang paling dekat. Jangan menambahkan regex tanpa unit test false-positive dan false-negative.

### Rule minimum yang disarankan

Quality rule production harus mendeteksi pola seperti:

- comparison role langsung terhadap `"owner"`/`"kasir"`;
- object business field `role: "owner"`/`role: "kasir"`;
- actor `type: "owner"`, `type: "kasir"`, atau `type: "backoffice"` pada file machine-control;
- comparison status terhadap `"READY"`, `"IN_USE"`, atau `"OFFLINE"`;
- SQL `role = 'kasir'`, `role = 'owner'`, atau status literal pada production file yang sudah dimigrasikan.

Rule tidak boleh menolak:

- canonical declaration pada `src/domain/*.js`;
- `TOKEN_TYPES` pada `src/utils/jwt.js`;
- route path seperti `/api/owner/...`;
- user-facing message;
- error code seperti `MACHINE_NOT_READY`;
- comments;
- test literal yang mengunci external contract.

### Implementasi gate yang aman

1. Buat helper rule murni di `scripts/refactor-quality-rules.js`.
2. Beri input source string dan file path.
3. Test minimal:

   - menemukan comparison role hardcoded;
   - menemukan SQL status hardcoded;
   - mengizinkan import/use constant;
   - mengizinkan route path;
   - mengizinkan message;
   - mengizinkan canonical declaration;
   - melaporkan line number yang benar.

4. Hubungkan rule ke `scripts/check-refactor-quality.js` hanya setelah unit test rule lulus.
5. Jalankan seluruh `npm.cmd run check`.

### Final search manual

Jalankan:

```powershell
rg -n 'owner|kasir|backoffice|READY|IN_USE|OFFLINE' src
```

Review setiap hasil tersisa. Hasil yang valid antara lain:

- declaration canonical;
- `TOKEN_TYPES`;
- route path;
- message/log/comment;
- error code;
- identifier atau filename.

Jangan menargetkan angka occurrence menjadi nol. Targetnya adalah tidak ada raw domain literal pada decision logic/persistence yang sudah masuk scope.

### Exit gate final

- `npm.cmd run check` lulus.
- Test count tidak turun dari baseline; test baru menambah coverage.
- `git diff --check` lulus.
- Search manual tidak menemukan raw role/status pada business comparison atau SQL target.
- Contract database/JWT/MQTT/API tidak berubah.
- Diff dapat dijelaskan per fase dan tidak mengandung refactor unrelated.

## Test Matrix Wajib

| Area | Test minimum | Risiko yang ditutup |
|---|---|---|
| Domain auth | exact values, freeze, normalize, unknown | constant/helper salah |
| Domain mesin | exact values, freeze, normalize, unknown | status baru diterima diam-diam |
| Authorization | owner/kasir allow-deny | privilege escalation |
| Tenant scope | owner mitra sendiri, kasir cabang sendiri | cross-tenant access |
| Token type | mobile vs backoffice | token confusion |
| Account type/email | template ketiga account type | email salah template |
| Persistence role | insert/select owner/kasir | bind order atau nilai DB salah |
| Actor audit | owner/kasir/backoffice mapping | audit identity salah |
| Machine create | status awal READY | default state berubah |
| Machine start | READY -> IN_USE | state transition rusak |
| Machine stop | IN_USE -> READY | state transition rusak |
| Maintenance | status OFFLINE | route behavior berubah |
| MQTT listener | literal READY diterima | wire contract rusak |
| SQL failure paths | rollback/commit lama | transaction behavior berubah |
| Quality rule | positive/negative fixtures | false positive gate |

## Validasi Wajib Setiap Batch

Untuk file JavaScript yang disentuh:

```powershell
node --check src/domain/auth.js
node --check src/domain/mesin.js
node --check src/domain/machineControl.js
```

Sesuaikan daftar dengan file aktual batch. Kemudian jalankan test terfokus, misalnya:

```powershell
node --test test/auth.domain.test.js test/authorization.middleware.test.js
node --test test/transaksi.machineControl.controller.test.js test/transaksi.model.test.js
node --test test/mesin.model.test.js test/mqttFakeBroker.test.js
```

Sebelum menyelesaikan setiap commit:

```powershell
npm.cmd run check
git diff --check
git status --short
```

Jika integration test membutuhkan database/MQTT yang tidak tersedia, catat test yang skip dan alasannya. Jangan menyatakan contract integration terverifikasi bila test tersebut tidak dijalankan.

## Urutan Commit/PR yang Disarankan

Gunakan commit kecil dan rollbackable:

1. `test: characterize role and machine status contracts`
2. `refactor: add auth and machine domain constants`
3. `refactor: centralize mobile role authorization checks`
4. `refactor: centralize account and persisted mobile roles`
5. `refactor: centralize machine control actor types`
6. `refactor: centralize machine status comparisons`
7. `refactor: parameterize machine status SQL values`
8. `chore: guard domain magic strings in quality checks`
9. `docs: sync magic string refactor status` bila dokumentasi hasil implementasi perlu diperbarui.

Jangan squash seluruh pekerjaan menjadi satu commit sebelum review. Authorization, actor audit, dan machine status harus dapat di-rollback secara terpisah.

## Stop/Go Criteria

### GO

Lanjut ke fase berikutnya hanya jika:

- test fase aktif lulus;
- full check tetap lulus;
- tidak ada contract change;
- diff hanya menyentuh scope fase;
- reviewer dapat menjelaskan semantics setiap constant yang dipakai.

### STOP

Hentikan implementasi dan minta keputusan bila:

- database berisi role/status lain;
- firmware mengirim status lain yang ternyata valid;
- frontend bergantung pada case/value berbeda;
- perubahan placeholder menyebabkan query behavior berbeda;
- unknown role sebelumnya diterima dan penolakannya akan mengubah contract;
- email unknown role fallback perlu dihapus;
- implementer ingin menambahkan `MAINTENANCE`, `SYSTEM`, atau role baru;
- test authorization, tenant scope, MQTT, atau transaction rollback gagal;
- nilai canonical ingin di-rename.

## Kesalahan Umum yang Harus Dihindari

1. Membuat satu `utils/constants.js` besar.
2. Menganggap `backoffice` adalah mobile role.
3. Menggunakan `MOBILE_ROLES.OWNER` sebagai actor audit tanpa semantics actor.
4. Menggunakan `TOKEN_TYPES.BACKOFFICE` sebagai account type atau actor type.
5. Mengganti string dalam route path, message, dan comments secara mekanis.
6. Mengganti semua literal test dengan constant yang sama dengan implementation.
7. Menginterpolasi constant ke SQL.
8. Mengubah urutan bind parameter tanpa test query.
9. Menambahkan status/role baru karena terlihat lebih lengkap.
10. Mengubah case persisted value.
11. Menganggap penggunaan constant membuat rename database/MQTT otomatis aman.
12. Mencampur refactor magic strings dengan cleanup error handling atau transaction.
13. Mengubah authorization branch saat hanya diminta mengganti literal.
14. Menurunkan test coverage atau menghapus test yang gagal.
15. Menandai integration contract verified ketika test sebenarnya skip.

## Definition of Done

Pekerjaan dianggap selesai hanya jika:

- `src/domain/auth.js`, `src/domain/mesin.js`, dan `src/domain/machineControl.js` menjadi source of truth sesuai semantics;
- `TOKEN_TYPES` tetap menjadi source of truth token type;
- production authorization tidak membandingkan raw mobile role string;
- production machine-control tidak membuat/membandingkan raw actor type string;
- production machine logic tidak membandingkan atau menulis raw machine status string;
- query role/status target menggunakan bind parameter;
- route path, response contract, error contract, dan scope authorization tidak berubah;
- database tetap menyimpan exact values lama;
- MQTT tetap menerima/menghasilkan contract lama;
- unit, model, middleware, controller, dan integration tests relevan lulus;
- quality gate mencegah raw literal kembali pada decision logic yang sudah dimigrasikan;
- `npm.cmd run check` dan `git diff --check` lulus;
- tidak ada dependency atau migration baru;
- setiap commit fokus dan dapat di-rollback.

## Checklist Handoff untuk Implementer

Sebelum mulai:

- [ ] Baca dokumen ini sampai selesai.
- [ ] Pastikan working tree dan branch diketahui.
- [ ] Jalankan baseline test.
- [ ] Catat pass/skip aktual.
- [ ] Inventaris dan klasifikasikan setiap occurrence.
- [ ] Pastikan tidak menyamakan mobile role, token type, account type, dan actor type.

Saat implementasi:

- [ ] Kerjakan satu fase pada satu waktu.
- [ ] Tambahkan characterization test sebelum production migration.
- [ ] Gunakan module domain, bukan global constants file.
- [ ] Gunakan bind parameter untuk SQL.
- [ ] Pertahankan literal pada external contract test terpilih.
- [ ] Jalankan test terfokus setelah setiap kelompok file.
- [ ] Jalankan full check sebelum commit.
- [ ] Jangan memperbaiki hal unrelated dalam commit yang sama.

Sebelum handoff:

- [ ] Seluruh exit gate terpenuhi.
- [ ] Search manual sudah direview.
- [ ] Test count tidak turun.
- [ ] Integration skip dicatat jujur.
- [ ] Contract matrix telah diverifikasi.
- [ ] `git diff --check` lulus.
- [ ] Commit history mengikuti batch responsibility.

## Format Laporan Handoff

Gunakan format berikut setelah setiap fase:

```text
Fase:
File diubah:
Semantic literal yang dimigrasikan:
Perilaku sebelum:
Perilaku sesudah:
Contract yang diverifikasi:
Test terfokus:
Full check:
Skip/keterbatasan environment:
Hasil search manual:
Exit gate: GO / STOP
Catatan follow-up:
```

Jangan menulis `GO` bila test wajib gagal, integration contract belum diverifikasi, atau ditemukan perubahan persisted/wire value.
