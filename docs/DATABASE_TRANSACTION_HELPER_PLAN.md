# Rencana Implementasi `withTransaction` untuk Transaksi Database

## Ringkasan

Buat Higher-Order Function `withTransaction` untuk menangani lifecycle transaksi MySQL standar:

```text
get connection
  -> begin transaction
  -> jalankan callback
  -> commit jika sukses
  -> rollback jika gagal
  -> release connection dalam semua kondisi
```

Helper ini dipakai hanya untuk transaksi database yang mengikuti pola commit/rollback standar. Workflow machine-control yang menunggu MQTT ACK, melakukan commit log kegagalan, kemudian melempar error tidak boleh dimigrasikan secara mekanis ke helper ini.

Dokumen ini adalah handoff implementation-ready untuk junior programmer atau model AI dengan konteks terbatas. Kerjakan secara bertahap dan jangan mengganti seluruh transaksi dalam satu perubahan besar.

## Kondisi Saat Dokumen Dibuat

Terdapat 13 pemanggilan `beginTransaction()` pada source aktif:

| Lokasi | Jumlah | Klasifikasi awal |
|---|---:|---|
| `src/controller/akses.js` | 1 | Standar, tetapi harus dipindahkan ke model/service |
| `src/models/cabang.js` | 2 | Standar |
| `src/models/cashflow.js` | 1 | Standar |
| `src/models/hargaCabang.js` | 1 | Standar |
| `src/models/mesin.js` | 2 | Standar |
| `src/models/mitra.js` | 1 | Standar |
| `src/models/settingStokMitra.js` | 2 | Standar, memiliki query setelah commit |
| `src/models/transaksi.js` | 3 | Satu standar, dua workflow MQTT khusus |

Jalankan ulang inventaris sebelum mulai karena angka dapat berubah:

```powershell
rg -n "getConnection\(|beginTransaction\(|commit\(|rollback\(|release\(" src --glob "*.js"
```

### Masalah yang sudah terlihat

1. Lifecycle transaksi ditulis berulang di banyak model.
2. Kesalahan baru dapat lupa melakukan rollback atau release.
3. `updateMesin` memanggil `beginTransaction()` sebelum masuk blok `try`; jika proses begin gagal, connection berpotensi tidak mencapai `finally`.
4. `settingStokMitra` melakukan commit, kemudian query response melalui pool, tetapi query tersebut masih berada dalam catch yang mencoba rollback. Jika query response gagal, write sebenarnya sudah commit dan tidak dapat di-rollback.
5. `startMesin` dan `stopMesin` memiliki commit parsial yang disengaja untuk menyimpan log kegagalan MQTT.
6. `saveAksesRole` membuka transaction langsung di controller, sehingga HTTP concern dan persistence concern bercampur.

## Keputusan Desain

### Lokasi helper

Buat file:

```text
src/utils/transaction.js
```

Jangan mengubah bentuk export `src/config/database.js`. File config saat ini mengekspor promise pool secara langsung dan dipakai oleh banyak modul. Mengubahnya menjadi object seperti `{ dbPool, withTransaction }` akan memaksa perubahan semua import dan memperbesar risiko regresi.

### API helper

Helper menerima callback yang memperoleh satu dedicated connection:

```js
const result = await withTransaction(async (connection) => {
  await connection.execute(...);
  return value;
});
```

Callback hanya boleh melakukan query transaction dan mengembalikan hasil. Callback tidak boleh memanggil:

- `getConnection()`;
- `beginTransaction()`;
- `commit()`;
- `rollback()`;
- `release()`.

### Batas abstraksi

Versi pertama tidak mendukung:

- nested transaction;
- savepoint;
- manual commit;
- `skipRollback`;
- `commitAndThrow`;
- side effect eksternal seperti MQTT, email, atau HTTP;
- callback yang mengirim response Express.

Jika implementer merasa perlu menambah opsi di atas untuk satu workflow, jangan memperumit helper. Pertahankan workflow tersebut secara eksplisit atau buat desain terpisah.

## Implementasi Helper yang Disarankan

### File `src/utils/transaction.js`

```js
const dbPool = require("../config/database");

const createWithTransaction = (pool) => async (work) => {
  if (typeof work !== "function") {
    throw new TypeError("Transaction work must be a function");
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const result = await work(connection);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Database rollback failed", {
          message: rollbackError.message,
          originalError: error.message,
        });
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

const withTransaction = createWithTransaction(dbPool);

module.exports = {
  createWithTransaction,
  withTransaction,
};
```

### Alasan memakai factory

`createWithTransaction(pool)` memungkinkan unit test menggunakan fake pool dan fake connection tanpa MySQL. Jangan membuka database asli pada unit test helper.

### Perilaku error yang wajib

- Jika callback gagal, helper melempar object error asli.
- Jika rollback juga gagal, helper mencatat rollback failure tetapi tetap melempar error asli.
- Jika `beginTransaction()` gagal, helper tidak mencoba rollback karena transaksi belum aktif.
- Jika `commit()` gagal, transaction masih dianggap aktif sehingga helper mencoba rollback.
- Connection selalu dilepas setelah berhasil diperoleh.
- Error dari `getConnection()` langsung diteruskan; tidak ada connection yang perlu dilepas jika acquisition gagal.

## Tahap 0 — Baseline dan Inventaris

### Langkah

1. Jalankan quality gate sebelum perubahan:

   ```powershell
   npm.cmd run check
   git diff --check
   ```

2. Catat semua fungsi pemilik transaksi, bukan hanya nama file.
3. Untuk setiap fungsi, catat:

   | Fungsi | Data yang ditulis | Query setelah commit | Side effect eksternal | Commit parsial | Kandidat helper |
   |---|---|---|---|---|---|
   | `createTransaksi` | order, detail, stok, notifikasi | tidak | tidak | tidak | ya |
   | `startMesin` | state dan log | tidak | MQTT | ya | tidak |

4. Pastikan semua query yang seharusnya transactional memakai `connection.execute/query`, bukan `dbPool.execute/query`.
5. Catat test yang sudah menutup commit, rollback, dan release.

### Acceptance criteria

- Seluruh 13 transaction site sudah diklasifikasikan.
- `startMesin` dan `stopMesin` ditandai eksplisit sebagai pengecualian.
- Tidak ada transaction site yang dimigrasikan sebelum test perilakunya tersedia.

## Tahap 1 — Buat dan Uji Fondasi

### File baru

- `src/utils/transaction.js`
- `test/transaction.utils.test.js`

### Test wajib

#### 1. Success lifecycle

Urutan harus:

```text
getConnection -> beginTransaction -> callback -> commit -> release
```

Verifikasi nilai return callback diteruskan ke caller.

#### 2. Callback gagal

Urutan harus:

```text
getConnection -> beginTransaction -> callback error -> rollback -> release
```

Verifikasi error yang dilempar adalah object error asli.

#### 3. Begin gagal

Urutan harus:

```text
getConnection -> beginTransaction error -> release
```

Rollback tidak boleh dipanggil.

#### 4. Commit gagal

Urutan harus:

```text
getConnection -> beginTransaction -> callback -> commit error -> rollback -> release
```

#### 5. Rollback gagal

- `release()` tetap dipanggil.
- Error callback/commit asli tetap dilempar.
- Rollback error hanya dicatat sebagai diagnostic server-side.

#### 6. Input callback salah

`withTransaction(null)` atau value non-function harus menghasilkan `TypeError` tanpa membuka connection jika validasi dilakukan sebelum `getConnection`.

#### 7. Connection acquisition gagal

- Error diteruskan.
- `beginTransaction`, rollback, dan release tidak dipanggil.

### Larangan pada test

- Jangan memakai database development.
- Jangan mengandalkan urutan test file.
- Jangan menyimpan fake pool ke global state.

### Acceptance criteria

- Semua lifecycle di atas mempunyai unit test.
- Helper tidak bergantung pada Express atau layer controller.
- Helper tidak menambah dependency npm baru.
- `node --check`, lint, dan test helper lulus.

## Tahap 2 — Pilot pada `createNewMesin`

Pilih `src/models/mesin.js:createNewMesin` sebagai pilot karena test commit dan rollback sudah tersedia di `test/mesin.model.test.js`.

### Sebelum refactor

Pastikan test lama membuktikan:

- success memanggil `beginTransaction`, `commit`, dan `release`;
- kegagalan insert detail memanggil `rollback` dan `release`;
- master dan detail memakai connection yang sama;
- response sukses tidak berubah.

### Langkah refactor

1. Import `withTransaction`.
2. Hapus `getConnection`, `try-catch-finally`, commit, rollback, dan release dari fungsi.
3. Bungkus seluruh query dengan callback:

   ```js
   const createNewMesin = async (body, createdBy = null) =>
     withTransaction(async (connection) => {
       // validasi dan insert yang sudah ada
       return result;
     });
   ```

4. Jangan mengubah SQL, urutan validasi, bentuk response, atau aturan washer/dryer.
5. Sesuaikan `test/mesin.model.test.js` agar dependency transaction helper dapat dimock dengan deterministik.

### Catatan mocking module

Helper baru mengimpor `src/config/database.js`. Test yang mengganti `require.cache` database harus memastikan module `src/utils/transaction.js` tidak tertinggal dengan pool lama. Pilih salah satu pola dan konsisten:

- mock export module transaction melalui `require.cache`; atau
- hapus cache transaction dan model sebelum setiap load; atau
- buat factory model dengan dependency `withTransaction` yang diinjeksi.

Untuk perubahan paling kecil, mock module transaction pada test model. Jangan mengubah arsitektur seluruh model hanya untuk pilot.

### Acceptance criteria

- Test lama tetap lulus dengan ekspektasi lifecycle yang setara.
- Tidak ada manual transaction lifecycle pada `createNewMesin`.
- Tidak ada perubahan pada response atau SQL.
- `updateMesin` belum wajib dimigrasikan dalam commit pilot.

## Tahap 3 — Migrasi Transaksi Standar Sederhana

Migrasikan satu atau dua domain per commit.

### Batch 3A

- `src/models/mitra.js:createNewMitra`
- `src/models/cabang.js:createNewCabang`
- `src/models/cabang.js:resetCabang`

### Batch 3B

- `src/models/hargaCabang.js:createSettingHarga`
- `src/models/cashflow.js:createPengeluaran`

### Batch 3C

- `src/models/mesin.js:updateMesin`

`updateMesin` harus mendapat perhatian khusus karena `beginTransaction()` saat ini berada sebelum `try`. Setelah memakai helper, kegagalan begin harus tetap mencapai `release()` melalui helper.

### Langkah per fungsi

1. Tambahkan characterization test bila belum ada.
2. Pastikan semua query transactional memakai callback `connection`.
3. Pindahkan nilai yang harus dikembalikan ke `return` callback.
4. Hapus manual begin/commit/rollback/release.
5. Jangan memindahkan query ke luar transaction tanpa alasan yang terdokumentasi.
6. Jalankan test fokus dan suite penuh.

### Acceptance criteria per fungsi

- Success: seluruh write commit bersama.
- Failure di query mana pun: seluruh write rollback.
- Connection selalu release.
- Error asli diteruskan.
- Bentuk response model tidak berubah.

## Tahap 4 — Migrasi Setting Stok dan Perjelas Batas Commit

### File target

- `src/models/settingStokMitra.js:createNewSetting`
- `src/models/settingStokMitra.js:createBulkSettings`

### Masalah khusus

Kedua fungsi melakukan commit kemudian membaca response menggunakan `dbPool`. Jika read gagal, catch lama mencoba rollback walaupun commit sudah selesai.

### Bentuk refactor

```js
const createNewSetting = async (body) => {
  const insertId = await withTransaction(async (connection) => {
    // validate, delete, insert
    return result.insertId;
  });

  const [rows] = await dbPool.execute(/* post-commit read */);
  return rows[0];
};
```

Untuk bulk:

```js
await withTransaction(async (connection) => {
  // validate, delete, insert all items
});

return getSettingsByMitra(idMitra);
```

### Keputusan kontrak yang harus dipahami

Jika post-commit read gagal:

- write tetap tersimpan;
- endpoint dapat menghasilkan error karena gagal membentuk response;
- jangan menyatakan write berhasil di-rollback;
- retry request harus mempertimbangkan bahwa data mungkin sudah berubah.

Jika perilaku tersebut tidak dapat diterima, lakukan SELECT response menggunakan connection yang sama sebelum callback selesai sehingga SELECT juga terjadi sebelum commit. Pilih satu pendekatan dan test secara eksplisit.

Rekomendasi awal: lakukan read response melalui connection yang sama sebelum commit jika query hanya membaca row yang baru ditulis dan tidak membutuhkan visibilitas post-commit dari connection lain.

### Test wajib

- insert sukses dan response benar;
- salah satu insert bulk gagal sehingga seluruh batch rollback;
- item tidak valid tidak meninggalkan data parsial;
- read response gagal sesuai keputusan kontrak yang dipilih;
- release tetap terjadi.

## Tahap 5 — Migrasi `createTransaksi`

### File target

- `src/models/transaksi.js:createTransaksi`
- test transaksi terkait

### Scope transaction yang wajib dipertahankan

Semua operasi berikut harus berada pada connection yang sama:

1. validasi mitra, cabang, dan user;
2. pembuatan invoice dengan lock `FOR UPDATE`;
3. insert `tbl_order_laundry`;
4. insert seluruh `tbl_detail_order`;
5. validasi addon;
6. pengurangan stok;
7. insert notifikasi stok minimum;
8. SELECT order/detail untuk response jika tetap dilakukan sebelum commit.

### Langkah

1. Tambahkan test rollback pada kegagalan detail atau pengurangan stok jika belum ada.
2. Pastikan generator invoice menerima connection callback, bukan pool.
3. Bungkus workflow database dengan `withTransaction`.
4. Jangan memindahkan invoice lock keluar transaction.
5. Jangan mengubah aturan stok/notifikasi.
6. Kembalikan data raw dari callback, lalu lakukan mapping JavaScript setelah `withTransaction` selesai bila mapping tidak melakukan query.

Contoh:

```js
const rawData = await withTransaction(async (connection) => {
  // seluruh query
  return { order, details };
});

return mapTransactionResponse(rawData);
```

### Acceptance criteria

- Tidak ada order tanpa detail akibat kegagalan parsial.
- Stok dan notifikasi konsisten dengan order.
- Invoice sequence tetap aman terhadap concurrent request.
- Return payload tidak berubah.
- Seluruh error melepaskan connection.

## Tahap 6 — Pindahkan Transaction Akses dari Controller

### Kondisi saat ini

`src/controller/akses.js:saveAksesRole` melakukan query, transaction, rollback, dan release secara langsung.

### Target struktur

```text
route
  -> authorization middleware
  -> controller: validasi HTTP dan response
  -> model/service: transaction delete + insert akses
```

### File target

- buat `src/models/akses.js` bila belum tersedia;
- ubah `src/controller/akses.js`;
- pertahankan `src/routes/akses.js`;
- perluas `test/akses.controller.test.js`;
- tambahkan test model akses.

### Contoh kontrak model

```js
const saveAksesRole = (idRole, menuTree) =>
  withTransaction(async (connection) => {
    await connection.execute("DELETE ...", [idRole]);

    for (const parent of menuTree) {
      // insert parent dan children
    }
  });
```

Controller tetap bertanggung jawab memastikan payload berupa array. Model bertanggung jawab atas atomic persistence.

### Test wajib

- payload non-array ditolak sebelum model dipanggil;
- delete dan seluruh insert commit bersama;
- kegagalan child insert me-rollback delete dan insert sebelumnya;
- controller mengembalikan response sukses lama;
- authorization route tidak berubah.

## Tahap 7 — Jangan Migrasikan `startMesin` dan `stopMesin`

### Alasan

Workflow saat ini memiliki pola khusus:

```text
begin transaction
  -> validasi dan lock data
  -> publish MQTT + tunggu ACK
  -> jika MQTT gagal:
       insert failed log
       commit failed log
       tandai tidak perlu rollback
       throw HTTP/upstream error
  -> jika MQTT sukses:
       update state
       insert success log
       commit
```

Error setelah commit tidak berarti transaksi harus rollback. `withTransaction` standar tidak dapat mengekspresikan pola ini tanpa opsi berbahaya seperti `skipRollback`, `manualCommit`, atau `commitAndThrow`.

### Keputusan implementasi

- Biarkan lifecycle eksplisit pada kedua fungsi dalam refactor helper ini.
- Tambahkan komentar singkat bahwa fungsi sengaja dikecualikan karena commit parsial untuk audit MQTT.
- Jangan memasukkan MQTT ke callback `withTransaction`.
- Jangan menghapus `shouldRollback` sebelum desain machine-control baru selesai.

### Follow-up yang disarankan

Buat pekerjaan terpisah untuk workflow dua fase:

```text
Transaction 1:
  validate + reserve machine + insert command PENDING
  commit

MQTT outside transaction:
  publish + wait ACK

Transaction 2:
  success -> update state + SUCCESS log
  failure -> restore/resolution state + FAILED log
  commit
```

Alternatif yang lebih matang adalah transactional outbox dan background worker, tetapi jangan mengimplementasikannya sebagai bagian dari helper dasar.

## Aturan Penggunaan `withTransaction`

### Boleh

- Beberapa query MySQL yang harus atomic.
- SELECT validasi dan write yang harus melihat snapshot/lock yang sama.
- Loop insert yang seluruhnya harus berhasil atau gagal bersama.
- Mengembalikan data JavaScript dari callback.

### Tidak boleh

- MQTT publish atau menunggu ACK.
- Mengirim email.
- Memanggil API eksternal.
- Mengirim response Express.
- Memanggil pool untuk query transactional dari dalam callback.
- Memanggil `withTransaction` dari callback `withTransaction` lain.
- Menelan error agar helper melakukan commit terhadap kondisi gagal.
- Melakukan manual commit/rollback/release.

## Quality Gate yang Disarankan

Setelah seluruh transaksi standar dimigrasikan, tambahkan pemeriksaan ringan melalui script atau review rule:

```powershell
rg -n "beginTransaction\(" src
```

Hasil yang diharapkan hanya:

- implementasi `src/utils/transaction.js`;
- `startMesin` dan `stopMesin` sebagai pengecualian terdokumentasi.

Jika masih ada transaction lifecycle lain, implementer harus menjelaskan mengapa tidak memakai helper.

Jangan membuat gate yang melarang semua `getConnection()`, karena fitur streaming, lock khusus, atau workflow eksplisit di masa depan mungkin memerlukan dedicated connection tanpa transaction helper.

## Strategi Test Keseluruhan

### Unit test helper

Menutup seluruh lifecycle begin, commit, rollback, release, dan error sekunder.

### Unit test model

Menutup business flow dan memastikan callback memakai connection yang diberikan.

### Integration test database

Untuk domain berisiko tinggi, gunakan schema integration test:

- insert sukses terlihat setelah commit;
- error di tengah workflow tidak meninggalkan row parsial;
- concurrent invoice tetap unik;
- bulk setting rollback seluruhnya;
- reset cabang tidak menghapus sebagian data saja.

### Regression test

Success payload, status HTTP, tenant scope, audit username, dan soft-delete behavior tidak boleh berubah akibat refactor lifecycle.

## Urutan Commit/PR yang Disarankan

1. `refactor(db): add tested withTransaction helper`
2. `refactor(mesin): migrate createNewMesin transaction lifecycle`
3. `refactor(master-data): migrate mitra and cabang transactions`
4. `refactor(finance): migrate price and cashflow transactions`
5. `refactor(mesin): migrate updateMesin transaction lifecycle`
6. `refactor(stock): migrate stock-setting transactions and clarify post-commit reads`
7. `refactor(transaksi): migrate cashier create transaction lifecycle`
8. `refactor(akses): move access persistence transaction into model`
9. `chore(db): add transaction usage quality gate and documentation`

Jangan memasukkan redesign MQTT ke commit di atas. Buat issue/PR terpisah.

## Validasi Setiap Batch

```powershell
node --check <file-js-yang-diubah>
npm.cmd run lint
npm.cmd test
npm.cmd run check
git diff --check
```

Untuk perubahan model, jalankan test fokus lebih dahulu lalu suite penuh.

## Kesalahan Umum yang Harus Dihindari

1. Mengganti lifecycle tetapi tidak memindahkan semua query ke connection callback.
2. Menjalankan query transactional melalui `dbPool` dari dalam callback.
3. Melakukan query setelah commit lalu menganggap rollback masih mungkin.
4. Membuat helper menelan error callback.
5. Membiarkan rollback error menggantikan original business/database error.
6. Lupa bahwa commit juga dapat gagal.
7. Mengubah SQL atau business rule bersamaan dengan refactor helper.
8. Memakai helper untuk MQTT atau email.
9. Mendukung nested transaction tanpa savepoint dan kontrak yang jelas.
10. Menghapus `shouldRollback` pada machine-control secara mekanis.
11. Mengubah export `src/config/database.js` dan merusak semua import lama.
12. Mengandalkan database development pada unit test.

## Definition of Done

Pekerjaan dianggap selesai jika:

- `src/utils/transaction.js` tersedia dan memiliki unit test lengkap;
- helper selalu release connection setelah acquisition berhasil;
- rollback failure tidak menutupi original error;
- seluruh transaksi standar telah memakai `withTransaction`;
- `saveAksesRole` tidak lagi membuka transaction di controller;
- `startMesin` dan `stopMesin` tetap eksplisit dan terdokumentasi sebagai pengecualian;
- tidak ada query eksternal seperti MQTT/email di callback helper;
- tidak ada manual commit/rollback dari callback;
- response dan business rule domain tidak berubah;
- test commit, rollback, commit failure, rollback failure, dan release lulus;
- integration test domain kritis tidak menemukan data parsial;
- `npm.cmd run check` dan `git diff --check` lulus;
- perubahan dibagi menjadi commit kecil yang dapat di-review dan di-rollback.

## Checklist Handoff untuk Implementer

- [ ] Baca dokumen sampai selesai.
- [ ] Jalankan baseline test sebelum mengubah code.
- [ ] Inventaris ulang seluruh `beginTransaction()`.
- [ ] Klasifikasikan standard transaction vs workflow khusus.
- [ ] Implementasikan factory dan singleton `withTransaction`.
- [ ] Buat seluruh unit test lifecycle helper.
- [ ] Migrasikan `createNewMesin` sebagai pilot.
- [ ] Pastikan test mocking tidak memakai pool lama dari module cache.
- [ ] Migrasikan domain standar per batch kecil.
- [ ] Perbaiki batas commit/read pada setting stok.
- [ ] Pindahkan transaction akses ke model/service.
- [ ] Jangan migrasikan MQTT machine-control ke helper standar.
- [ ] Jalankan test fokus dan suite penuh setiap batch.
- [ ] Periksa perubahan SQL dan response; keduanya harus tetap sama.
- [ ] Tambahkan quality gate setelah migrasi selesai.
- [ ] Buat follow-up terpisah untuk state machine/outbox MQTT.
