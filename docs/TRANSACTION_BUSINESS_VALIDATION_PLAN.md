# Rencana Pemisahan Validasi dan Business Logic `createTransaksi`

## Ringkasan

Refactor `POST /api/kasir/transaksi` agar controller tidak lagi berisi seluruh validasi payload dan perhitungan total secara manual. Pisahkan tanggung jawab menjadi:

```text
route
  -> authentication dan authorization
  -> middleware validasi kontrak HTTP
  -> controller tipis
  -> service/domain transaksi
  -> model dan database transaction
```

Selain memindahkan code, implementasi harus menutup masalah integritas harga. Saat ini server hanya memastikan `totalBayar` sama dengan jumlah `subtotal` yang keduanya dikirim client. Client dapat mengirim total dan subtotal yang konsisten tetapi lebih murah daripada harga resmi cabang.

Dokumen ini merupakan handoff implementation-ready untuk junior programmer atau model AI dengan konteks terbatas. Ikuti urutan fase dan jangan langsung mengubah payload mobile serta sumber harga dalam satu commit besar.

## Kondisi Saat Dokumen Dibuat

### Controller

`src/controller/transaksi.js:createTransaksi` saat ini menangani:

- identitas `idMitra`, `cabangId`, dan `idUserMobile`;
- validasi `totalBayar`;
- validasi `metodePembayaran`;
- validasi array `items`;
- validasi `jenisLayanan`, `jumlah`, `subtotal`, dan `itemId`;
- perhitungan jumlah subtotal;
- perbandingan total menggunakan floating-point tolerance;
- mapping error model menjadi HTTP response;
- response sukses.

### Model

`src/models/transaksi.js:createTransaksi` saat ini menangani:

- database transaction;
- validasi mitra, cabang, dan mobile user;
- pembuatan invoice dengan `FOR UPDATE`;
- insert order dan detail;
- validasi addon item;
- lock dan pengurangan stok;
- notifikasi stok minimum;
- pembentukan response.

### Harga

Harga resmi tersedia pada `tbl_harga_cabang`, tetapi `createTransaksi` belum mengambil harga tersebut. Nilai `subtotal` dan `totalBayar` dari request langsung disimpan setelah hanya dibandingkan satu sama lain.

### Test

Integration test yang ada hanya mencakup happy path dasar dengan total dan subtotal yang sama. Belum ada test yang membuktikan:

- total dimanipulasi tetapi konsisten;
- harga client berbeda dari harga database;
- harga cabang tidak tersedia;
- angka kosong, `null`, decimal, atau unsafe integer;
- perubahan harga antara tampilan mobile dan submit transaksi.

## Masalah Utama

Payload berikut dapat lolos validasi lama walaupun harga resmi cuci lebih tinggi:

```json
{
  "totalBayar": 100,
  "metodePembayaran": "CASH",
  "items": [
    {
      "jenisLayanan": "cuci",
      "jumlah": 1,
      "subtotal": 100
    }
  ]
}
```

Validasi lama hanya membuktikan:

```text
100 dari client = 100 dari client
```

Validasi yang benar harus membuktikan:

```text
subtotal server = harga resmi cabang x jumlah
total server = jumlah seluruh subtotal server
nilai konfirmasi client = total server
```

## Keputusan Arsitektur

### 1. Middleware: validasi kontrak HTTP

Middleware bertanggung jawab atas:

- required field;
- tipe dan bentuk JSON;
- enum request;
- struktur array;
- conditional field seperti `itemId` untuk addon;
- normalisasi input ke DTO yang konsisten.

Middleware tidak boleh:

- query database;
- membaca harga cabang;
- mengurangi stok;
- membuat invoice;
- membuka database transaction;
- mempercayai tenant/cabang dari body.

### 2. Service/domain: aturan bisnis murni

Service/domain bertanggung jawab atas:

- perhitungan nilai uang;
- cross-field invariant;
- pembuatan command transaksi dari identity token dan payload tervalidasi;
- pemilihan error code bisnis;
- orkestrasi model.

Business logic murni harus dapat diuji tanpa Express dan tanpa database.

### 3. Model: aturan yang membutuhkan database

Model bertanggung jawab atas:

- validasi tenant/cabang/user aktif;
- membaca harga resmi cabang;
- memvalidasi item aktif dan tipe stok;
- lock serta pemeriksaan stok;
- invoice lock;
- atomic insert order, detail, stok, dan notifikasi.

Model boleh memanggil pure domain function untuk menghitung subtotal dari harga yang diperoleh database. Jangan menduplikasi rumus pada controller dan model.

## Target Struktur File

Tambahkan file berikut secara bertahap:

```text
src/
  domain/
    transaksi.js
  middleware/
    validateTransaksi.js
  services/
    transaksi.js
```

File yang akan diubah:

```text
src/routes/transaksi.js
src/controller/transaksi.js
src/models/transaksi.js
src/utils/httpError.js              # hanya bila typed error belum konsisten
test/transaksi.validation.test.js
test/transaksi.service.test.js
test/coreDomains.integration.test.js
docs/API_LIST.md
docs/api-MJAProject.postman_collection.json
```

Jika folder `domain` dan `services` belum ada, buat hanya untuk transaksi dahulu. Jangan memindahkan seluruh aplikasi ke arsitektur baru dalam pekerjaan ini.

## Kontrak Internal yang Disarankan

### DTO hasil middleware

```js
{
  metodePembayaran: "CASH",
  totalBayar: 20000,
  items: [
    {
      jenisLayanan: "cuci",
      itemId: null,
      jumlah: 1,
      subtotal: 20000
    }
  ]
}
```

Pada fase kompatibilitas, `subtotal` dan `totalBayar` tetap diterima. Pada fase server-authoritative, nilai tersebut hanya menjadi nilai konfirmasi dan tidak menjadi sumber nilai yang disimpan.

### Command service

```js
{
  idMitra: 10,
  cabangId: 20,
  idUserMobile: 30,
  metodePembayaran: "CASH",
  declaredTotal: 20000,
  items: [...]
}
```

Identity selalu berasal dari `req.user`, bukan body.

### Error target

Gunakan typed error:

```js
throw createHttpError(
  409,
  "Harga transaksi telah berubah. Muat ulang harga dan coba kembali.",
  "TRANSACTION_PRICE_CHANGED"
);
```

Code minimum yang disarankan:

| Kondisi | Status awal | Code |
|---|---:|---|
| Payload tidak valid | 400 | `TRANSACTION_VALIDATION_ERROR` |
| Total deklarasi tidak sama dengan subtotal deklarasi | 400 | `TRANSACTION_TOTAL_MISMATCH` |
| Harga resmi tidak tersedia | 409 | `TRANSACTION_PRICE_NOT_CONFIGURED` |
| Harga client sudah tidak sesuai | 409 | `TRANSACTION_PRICE_CHANGED` |
| Item tidak ditemukan | 404 | `TRANSACTION_ITEM_NOT_FOUND` |
| Item bukan stok | 400 | `TRANSACTION_ITEM_TYPE_INVALID` |
| Stok tidak ditemukan | 409 | `TRANSACTION_STOCK_NOT_CONFIGURED` |
| Stok tidak cukup | 409 | `TRANSACTION_STOCK_INSUFFICIENT` |

Pertahankan status lama pada fase pertama jika frontend belum siap. Perubahan status harus dicatat sebagai perubahan kontrak.

## Tahap 0 — Audit Kontrak Uang dan Database

Jangan mengubah perhitungan sebelum tipe kolom dan aturan mata uang diketahui.

### Pekerjaan

1. Periksa tipe kolom:

   - `tbl_order_laundry.totalBayar`;
   - `tbl_detail_order.subtotal`;
   - `tbl_harga_cabang.harga`;
   - `tbl_detail_order.jumlah`.

2. Tentukan apakah aplikasi hanya mendukung Rupiah integer.
3. Periksa apakah mobile mengirim JSON number atau numeric string.
4. Periksa apakah `totalBayar` berarti total invoice atau uang yang diserahkan pelanggan.
5. Periksa apakah diskon, pajak, pembulatan, atau biaya tambahan sudah ada atau direncanakan.
6. Pastikan kombinasi harga cabang tidak memiliki row ambigu/duplikat untuk:

   ```text
   idMitra + cabangId + jenisLayanan + itemId
   ```

7. Pastikan seluruh cabang aktif mempunyai harga untuk layanan yang dapat dijual.

### Keputusan default

Jika nilai selalu Rupiah tanpa pecahan:

- gunakan integer;
- wajib `Number.isSafeInteger`;
- bandingkan exact;
- jangan menggunakan epsilon `0.01`.

Jika decimal memang didukung:

- gunakan unit terkecil atau library decimal yang disetujui;
- jangan memakai arithmetic floating-point JavaScript;
- dokumentasikan aturan pembulatan.

### Acceptance criteria

- Tipe uang dan aturan pembulatan tertulis.
- Implementer mengetahui apakah numeric string masih perlu diterima.
- Tidak ada perubahan contract berdasarkan asumsi yang belum diverifikasi.

## Tahap 1 — Tambahkan Characterization Test

Sebelum memindahkan code, dokumentasikan perilaku endpoint lama.

### Test request minimum

1. Payload valid menghasilkan 201.
2. Token tidak mempunyai mitra/cabang menghasilkan status lama.
3. `totalBayar` kosong, nol, negatif, `null`, dan non-number ditolak.
4. `metodePembayaran` kosong ditolak.
5. `items` bukan array atau kosong ditolak.
6. Item bukan object ditolak.
7. `jenisLayanan` tidak valid ditolak.
8. `jumlah` nol, negatif, decimal, dan unsafe integer ditolak.
9. `subtotal` negatif atau non-number ditolak.
10. Addon tanpa `itemId` ditolak.
11. Total tidak sama dengan jumlah subtotal ditolak.

### Test keamanan yang harus ditambahkan

Buat test yang mengirim total dan subtotal konsisten tetapi lebih murah daripada `tbl_harga_cabang`. Tandai test ini sebagai target perilaku baru: setelah fase server-authoritative selesai, request wajib ditolak.

Jangan membiarkan test yang mengharapkan transaksi harga manipulatif berhasil menjadi kontrak permanen.

### Acceptance criteria

- Semua cabang validasi controller lama tercatat dalam test.
- Happy path dan tenant scope tetap ditutup integration test.
- Ada test eksplisit untuk manipulasi harga.

## Tahap 2 — Buat Pure Domain Function untuk Uang

### File baru

```text
src/domain/transaksi.js
test/transaksi.domain.test.js
```

### Function minimum

```js
const normalizeMoney = (value, fieldName) => { ... };
const calculateLineSubtotal = ({ unitPrice, quantity }) => { ... };
const calculateTransactionTotal = (items) => { ... };
const assertDeclaredTotalMatchesItems = ({ declaredTotal, items }) => { ... };
```

### Aturan function

- Tidak menerima `req`, `res`, atau `next`.
- Tidak query database.
- Tidak membaca environment variable.
- Tidak memodifikasi array/object input.
- Mengembalikan angka/DTO baru atau melempar typed error.
- Memeriksa overflow dengan `Number.isSafeInteger` jika memakai integer.

### Contoh integer Rupiah

```js
const normalizeMoney = (value, fieldName) => {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw createHttpError(
      400,
      `${fieldName} harus berupa integer Rupiah yang valid`,
      "TRANSACTION_VALIDATION_ERROR"
    );
  }

  return normalized;
};
```

### Test domain minimum

- perhitungan satu item;
- beberapa item;
- quantity lebih dari satu;
- nol bila memang diizinkan;
- nilai negatif;
- decimal;
- `null`, empty string, boolean, array, dan object;
- `NaN` dan `Infinity`;
- nilai melebihi safe integer;
- input tidak dimutasi;
- total exact match dan mismatch.

### Catatan kompatibilitas numeric string

Code lama menerima beberapa numeric string karena memakai `Number(value)`. Jika mobile masih mengirim string, terima sementara dan normalisasi menjadi number. Tambahkan test dan catat sebagai compatibility behavior. Jangan menerima empty string, whitespace-only, `null`, atau boolean sebagai nol.

### Acceptance criteria

- Seluruh arithmetic money hanya berada pada pure domain module.
- Tidak ada lagi penggunaan `Math.abs(... ) > 0.01` untuk Rupiah integer.
- Unit test tidak membutuhkan database.

## Tahap 3 — Buat Middleware Validasi Payload

### File baru

```text
src/middleware/validateTransaksi.js
test/transaksi.validation.test.js
```

### Tanggung jawab middleware

Validasi dan normalisasi:

- `metodePembayaran`;
- `totalBayar` pada fase kompatibilitas;
- `items`;
- `jenisLayanan`;
- `jumlah`;
- `subtotal` pada fase kompatibilitas;
- conditional `itemId`.

Simpan hasil sebagai object baru:

```js
req.validatedBody = normalizedPayload;
```

Jangan overwrite `req.body` agar source input tetap dapat diperiksa saat debugging.

### Enum

Tentukan enum eksplisit:

```js
const PAYMENT_METHODS = new Set(["CASH", "QRIS"]);
const SERVICE_TYPES = new Set(["cuci", "kering", "addon_barang"]);
```

Normalisasi case hanya jika kontrak mobile memang membutuhkannya. Jangan diam-diam menerima value baru.

### Route target

```js
router.post(
  "/",
  authenticateMobile,
  requireMobileKasir,
  validateCreateTransaksi,
  catchAsync(TransaksiController.createTransaksi)
);
```

Jika `catchAsync` belum diimplementasikan, middleware synchronous dapat meneruskan error melalui `next(error)`. Jangan membuat middleware mengirim response 500.

### Acceptance criteria

- Invalid payload berhenti sebelum controller/model dipanggil.
- Identity tetap berasal dari middleware autentikasi.
- Middleware tidak membuka database connection.
- Error payload mengikuti global error contract yang telah disepakati.

## Tahap 4 — Buat `TransaksiService` dan Tipiskan Controller

### File baru

```text
src/services/transaksi.js
test/transaksi.service.test.js
```

### Kontrak service awal

```js
const createTransaksi = async ({
  idMitra,
  cabangId,
  idUserMobile,
  payload,
}) => {
  assertDeclaredTotalMatchesItems({
    declaredTotal: payload.totalBayar,
    items: payload.items,
  });

  return TransaksiModel.createTransaksi({
    idMitra,
    cabangId,
    idUserMobile,
    ...payload,
  });
};
```

### Controller target

```js
const createTransaksi = async (req, res) => {
  const data = await TransaksiService.createTransaksi({
    idMitra: req.user.idMitra,
    cabangId: req.user.cabang_id || req.user.cabangId,
    idUserMobile: req.user.id,
    payload: req.validatedBody,
  });

  return res.status(201).json({
    success: "Create Data Transaksi Success",
    data,
  });
};
```

### Aturan

- Controller tidak menghitung uang.
- Controller tidak loop item untuk validasi.
- Controller tidak mengambil identity dari body.
- Service tidak menerima `req` atau `res`.
- Service tidak membuat HTTP response.
- Model tetap satu-satunya layer yang menulis database.

### Acceptance criteria

- Success response tidak berubah.
- Seluruh validasi payload dipindahkan dari controller.
- Controller hanya menyusun identity, memanggil service, dan mengirim response.
- Test service menggunakan mock model, bukan database asli.

## Tahap 5 — Pertahankan Kontrak Lama Sebelum Mengubah Sumber Harga

Ini adalah checkpoint refactor-only.

Pada akhir tahap ini:

- payload lama masih diterima;
- `totalBayar` dan `subtotal` masih dikirim mobile;
- total deklarasi masih dibandingkan dengan subtotal deklarasi;
- response sukses tidak berubah;
- code sudah terpisah dan mempunyai test.

Jalankan seluruh regression test. Jangan lanjut ke harga server-authoritative dalam commit yang sama.

### Acceptance criteria

- Refactor dapat dibuktikan tidak mengubah behavior endpoint.
- Seluruh test karakterisasi lulus.
- Commit ini dapat di-rollback tanpa membawa perubahan harga.

## Tahap 6 — Audit Kesiapan Harga Server

Sebelum enforcement, pastikan konfigurasi harga lengkap.

### Pemeriksaan data

Untuk setiap mitra dan cabang aktif:

- terdapat harga `cuci`;
- terdapat harga `kering`;
- terdapat harga setiap addon stok yang dapat dijual;
- harga tidak negatif;
- tidak ada kombinasi harga duplikat;
- harga nol hanya ada jika memang diperbolehkan bisnis.

### Keputusan data

Jika ada harga yang belum dikonfigurasi, jangan fallback ke subtotal client. Tolak transaksi dengan `TRANSACTION_PRICE_NOT_CONFIGURED` setelah enforcement aktif.

### Constraint yang disarankan

Evaluasi unique constraint untuk kombinasi logical price key. Perhatikan bahwa MySQL memperlakukan `NULL` secara khusus pada unique index. Bila `itemId` nullable untuk cuci/kering, constraint mungkin memerlukan generated key atau desain kolom yang lebih eksplisit. Buat migrasi database terpisah jika diperlukan.

### Acceptance criteria

- Tidak ada cabang aktif yang akan berhenti bertransaksi karena harga kosong tanpa diketahui.
- Strategi duplicate price telah diputuskan.
- Backup dan rollback migrasi data tersedia bila ada perubahan schema.

## Tahap 7 — Implementasi Harga Server-Authoritative

### Target perilaku

Server membaca harga aktif berdasarkan:

```text
idMitra + cabangId + jenisLayanan + itemId
```

Kemudian server menghitung:

```text
lineSubtotal = unitPrice x quantity
serverTotal = sum(lineSubtotal)
```

Nilai yang disimpan ke order/detail harus berasal dari perhitungan server.

### Lokasi query

Harga harus dibaca menggunakan transaction connection yang sama dengan insert order/detail. Jangan membaca harga melalui pool sebelum transaction lalu menggunakannya tanpa verifikasi, karena harga dapat berubah sebelum commit.

### Helper model yang disarankan

```js
const getActivePrices = async (connection, { idMitra, cabangId, items }) => {
  // query harga cabang yang diperlukan
  // return map key -> unitPrice
};
```

Gunakan key yang tidak ambigu, misalnya:

```text
cuci:null
kering:null
addon_barang:12
```

### Penyusunan priced items

```js
const pricedItems = items.map((item) => {
  const unitPrice = priceMap.get(toPriceKey(item));

  if (unitPrice === undefined) {
    throw createHttpError(
      409,
      "Harga layanan belum dikonfigurasi",
      "TRANSACTION_PRICE_NOT_CONFIGURED"
    );
  }

  return {
    ...item,
    unitPrice,
    subtotal: calculateLineSubtotal({
      unitPrice,
      quantity: item.jumlah,
    }),
  };
});
```

### Verifikasi nilai client

Selama mobile masih mengirim total/subtotal:

1. Hitung total server.
2. Bandingkan `declaredTotal` dengan total server.
3. Jika berbeda, rollback dan lempar 409 `TRANSACTION_PRICE_CHANGED`.
4. Abaikan subtotal client saat melakukan insert; simpan subtotal hasil server.

Jangan mengoreksi harga diam-diam dan tetap membuat transaksi, karena kasir perlu mengetahui total yang berubah sebelum pembayaran dikonfirmasi.

### Snapshot harga

Saat ini detail menyimpan `subtotal`. Evaluasi apakah perlu menyimpan `hargaSatuan` untuk audit. Jika ya, perubahan kolom harus menjadi migrasi terpisah dengan update model, response, dan dokumentasi. Jangan menambahkan kolom diam-diam dalam refactor controller.

### Acceptance criteria

- Transaksi harga manipulatif ditolak.
- Harga yang tersimpan berasal dari database.
- Harga dibaca dalam transaction yang sama.
- Missing price menghasilkan typed conflict, bukan fallback ke client.
- Tidak ada partial order/stok ketika harga invalid.

## Tahap 8 — Perbarui Kontrak Mobile Secara Bertahap

### Fase kompatibilitas

Mobile masih mengirim:

```json
{
  "totalBayar": 20000,
  "items": [
    {
      "jenisLayanan": "cuci",
      "jumlah": 1,
      "subtotal": 20000
    }
  ]
}
```

Server menghitung ulang dan membandingkan.

### Fase target

Setelah seluruh client diperbarui, payload dapat disederhanakan menjadi:

```json
{
  "metodePembayaran": "CASH",
  "items": [
    {
      "jenisLayanan": "cuci",
      "jumlah": 1
    },
    {
      "jenisLayanan": "addon_barang",
      "itemId": 12,
      "jumlah": 2
    }
  ]
}
```

Server menjadi satu-satunya sumber subtotal dan total.

### Keputusan deployment

- Jangan menghapus field lama sebelum versi mobile aktif terverifikasi.
- Jika backend dan mobile tidak dapat dirilis bersamaan, pertahankan field lama sebagai confirmation-only.
- Dokumentasikan respons 409 `TRANSACTION_PRICE_CHANGED` dan `TRANSACTION_PRICE_NOT_CONFIGURED`. Untuk `TRANSACTION_PRICE_CHANGED`, mobile wajib membatalkan payload lama, memuat ulang harga, menampilkan total terbaru, lalu meminta konfirmasi sebelum submit ulang; `TRANSACTION_PRICE_NOT_CONFIGURED` harus menghentikan submit tanpa fallback ke subtotal client.
- Source mobile tidak berada di repository backend ini. Bukti bahwa mobile menjalankan refresh harga harus berasal dari repository mobile atau QA dan menjadi dependency deployment sebelum enforcement pricing dirilis ke production.

## Tahap 9 — Integrasi dengan `withTransaction`

Rencana `docs/DATABASE_TRANSACTION_HELPER_PLAN.md` memindahkan `createTransaksi` ke helper transaksi standar. Koordinasikan urutan:

1. Boleh mengimplementasikan pure validation dan middleware tanpa menunggu `withTransaction`.
2. Jangan sekaligus mengubah business pricing dan lifecycle transaction dalam commit yang sama.
3. Setelah helper transaction stabil, gunakan connection callback yang sama untuk harga, invoice, order, detail, stok, dan notifikasi.
4. Test rollback pricing harus membuktikan connection release dan tidak ada data parsial.

## Tahap 10 — Integrasi dengan `catchAsync`

Rencana `docs/ASYNC_ERROR_HANDLING_PLAN.md` menstandarkan error handling.

Urutan yang disarankan:

1. typed error dan global error contract tersedia;
2. middleware melempar/meneruskan typed validation error;
3. service/model melempar typed business error;
4. route dibungkus `catchAsync`;
5. controller tidak lagi mapping string `error.message`.

Jangan membuat validator mengirim response 500 sendiri.

## Test Matrix Wajib

### Transport validation

- body kosong;
- field wajib hilang;
- payment method invalid;
- items bukan array;
- item null/non-object;
- service type invalid;
- addon tanpa item ID;
- jumlah invalid;
- subtotal/total invalid pada fase kompatibilitas.

### Money calculation

- satu dan beberapa item;
- quantity lebih dari satu;
- exact total;
- mismatch;
- overflow safe integer;
- decimal sesuai keputusan bisnis;
- numeric string sesuai compatibility decision.

### Server pricing

- harga cuci benar;
- harga kering benar;
- harga addon berdasarkan item ID;
- harga tidak tersedia;
- harga duplikat;
- total client konsisten tetapi di bawah harga server;
- harga berubah sejak mobile memuat layar;
- subtotal yang disimpan adalah hasil server.

### Database dan authorization

- tenant/cabang berasal dari token;
- cabang tidak sesuai mitra ditolak;
- user tidak aktif ditolak;
- item tidak aktif ditolak;
- stok tidak cukup rollback seluruh transaksi;
- invoice tetap unik;
- notifikasi stok minimum tetap dibuat;
- failure tidak meninggalkan order/detail parsial.

### Regression

- success response dan invoice format tetap sesuai kontrak;
- pending transaction dan history tetap membaca data baru;
- cashflow menggunakan total server yang tersimpan;
- owner/kasir role boundary tidak berubah.

## Quality Gate yang Disarankan

Setelah migrasi selesai, tambahkan review/check untuk mencegah regresi:

```powershell
rg -n "Math\.abs\(Number\(totalBayar\)|totalSubtotal" src/controller
rg -n "req\.body.*idMitra|req\.body.*cabangId" src/controller/transaksi.js src/services/transaksi.js
```

Hasil yang diharapkan:

- controller tidak melakukan arithmetic transaksi;
- identity tidak berasal dari body;
- subtotal insert berasal dari priced items server;
- tidak ada fallback ke harga client bila konfigurasi harga kosong.

Jangan membuat quality gate yang melarang semua penggunaan `Number`, karena parsing non-money masih mungkin valid.

## Urutan Commit/PR yang Disarankan

1. `test(transaksi): characterize create transaction validation contract`
2. `refactor(transaksi): extract pure money and transaction domain rules`
3. `refactor(transaksi): add request validation middleware`
4. `refactor(transaksi): add service and slim create controller`
5. `test(transaksi): add price tampering and missing-price coverage`
6. `fix(transaksi): calculate prices from active branch configuration`
7. `fix(transaksi): persist server-calculated totals and reject stale prices`
8. `docs(transaksi): update mobile payload and price conflict contract`
9. `chore(transaksi): add business-validation regression gate`

Jangan mencampur refactor tanpa behavior change dengan enforcement harga pada commit yang sama.

## Validasi Setiap Batch

```powershell
node --check <file-js-yang-diubah>
npm.cmd run lint
node --test <test-fokus>
npm.cmd test
npm.cmd run check
git diff --check
```

Untuk perubahan server pricing, jalankan integration test dengan database test yang memiliki harga cabang eksplisit.

## Kesalahan Umum yang Harus Dihindari

1. Memindahkan seluruh validasi ke middleware termasuk query database.
2. Memindahkan business rule ke model tanpa membuatnya dapat diuji secara pure.
3. Tetap mempercayai subtotal client setelah refactor file.
4. Membaca harga di luar transaction lalu tidak memverifikasi ulang.
5. Menggunakan floating-point tolerance untuk Rupiah integer.
6. Menganggap `Number(null)` dan `Number("")` sebagai input uang valid.
7. Mengambil tenant/cabang dari body.
8. Mengubah status error tanpa memperbarui mobile dan test.
9. Fallback ke harga client saat harga database tidak tersedia.
10. Membuat transaksi dengan harga baru tanpa memberi tahu kasir bahwa total berubah.
11. Mengubah transaction lifecycle, pricing, dan error handler sekaligus.
12. Tidak menguji manipulasi harga yang total dan subtotanya tetap konsisten.
13. Menambahkan service layer lalu tetap menyimpan seluruh business logic di controller.

## Definition of Done

Pekerjaan dianggap selesai jika:

- controller `createTransaksi` tidak lagi loop item atau menghitung total;
- middleware hanya menangani kontrak HTTP dan normalisasi;
- pure domain logic mempunyai unit test tanpa database;
- service mengorkestrasi use case tanpa menerima object Express;
- identity selalu berasal dari token;
- harga resmi dibaca dari `tbl_harga_cabang` dalam transaction;
- subtotal dan total tersimpan berasal dari perhitungan server;
- manipulasi harga client ditolak;
- missing price tidak fallback ke client;
- nilai uang memakai integer aman atau decimal strategy yang terdokumentasi;
- order, detail, stok, dan notifikasi tetap atomic;
- response sukses, invoice, history, dan cashflow tetap kompatibel;
- mobile menangani `TRANSACTION_PRICE_CHANGED` dan `TRANSACTION_PRICE_NOT_CONFIGURED`; bukti kompatibilitas berasal dari repository mobile/QA sebagai dependency deployment;
- Postman dan `API_LIST.md` diperbarui;
- seluruh unit/integration test dan `npm.cmd run check` lulus;
- perubahan dibagi dalam commit kecil yang dapat di-review dan di-rollback.

## Checklist Handoff untuk Implementer

- [ ] Baca dokumen sampai selesai.
- [ ] Jalankan baseline test.
- [ ] Verifikasi tipe kolom money dan aturan pembulatan.
- [ ] Audit kelengkapan harga seluruh cabang aktif.
- [ ] Tambahkan characterization test payload lama.
- [ ] Tambahkan test manipulasi harga.
- [ ] Buat pure domain function dan unit test.
- [ ] Buat middleware validator tanpa query database.
- [ ] Buat service transaksi dan tipiskan controller.
- [ ] Pastikan refactor-only lulus sebelum enforcement harga.
- [ ] Ambil harga resmi dalam database transaction.
- [ ] Simpan subtotal/total hasil server.
- [ ] Tolak stale/manipulated price dengan typed conflict.
- [ ] Pertahankan payload lama sementara bila mobile belum diperbarui.
- [ ] Koordinasikan dengan rencana `withTransaction` dan `catchAsync`.
- [ ] Perbarui Postman dan dokumentasi.
- [ ] Jalankan test fokus, suite penuh, dan diff check setiap batch.
- [ ] Jangan mencampur perubahan yang tidak berkaitan.
