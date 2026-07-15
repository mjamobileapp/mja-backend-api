# Baseline Refactor Fase 0

Dokumen ini mencatat kondisi sebelum refactor fondasi dimulai. Data dan perilaku di bawah adalah baseline untuk batch berikutnya; tidak ada helper produksi, pemindahan logic, atau perubahan harga pada Fase 0.

## Kondisi Repository

- Baseline commit: `e82f218 fix: restore googleapis runtime dependency`.
- Node.js: `v24.15.0`; npm: `11.12.1`.
- `npm.cmd run check`: lulus (69 pass, 1 skipped).
- `git diff --check`: lulus.
- Database test dan runtime menyimpan `DATETIME` sebagai UTC.

## Kontrak Uang Saat Ini

| Kolom | Tipe database | Perilaku endpoint saat ini |
|---|---|---|
| `tbl_order_laundry.totalBayar` | `DECIMAL(12,2)` | diterima dari payload client dan disimpan sebagai total order |
| `tbl_detail_order.subtotal` | `DECIMAL(12,2)` | diterima dari payload client per item |
| `tbl_harga_cabang.harga` | `DECIMAL(12,2)` | konfigurasi harga resmi cabang, belum dibaca oleh `createTransaksi` |
| `tbl_detail_order.jumlah` | `INT` | harus integer positif di controller |

Keputusan kompatibilitas untuk rangkaian ini:

1. `totalBayar` berarti total invoice, bukan uang tunai yang diserahkan pelanggan. Bukti: nilai ini masuk ke order berstatus `PAID`, dipakai oleh history dan cashflow, dan tidak ada kolom uang diterima atau kembalian.
2. Kontrak transport lama menerima JSON number maupun numeric string. Keduanya harus tetap diterima sampai contract mobile versi baru disetujui.
3. Walaupun seluruh data yang diaudit tidak mempunyai pecahan, tipe database saat ini mendukung dua digit pecahan. Domain uang nantinya harus memakai unit minor integer/decimal-safe normalization, bukan `Number` dan epsilon floating point.
4. Tidak ditemukan kolom diskon, pajak, biaya tambahan, uang diterima, atau kembalian pada tabel transaksi yang diaudit.

## Kesiapan Data Harga

Audit read-only pada database runtime menghasilkan:

| Pemeriksaan | Hasil |
|---|---:|
| Cabang aktif | 6 |
| Harga negatif | 0 |
| Grup harga duplikat (`idMitra`, `cabangId`, `jenisLayanan`, `itemId`) | 0 |
| Cabang aktif tanpa harga `cuci` | 5 |
| Cabang aktif tanpa harga `kering` | 5 |

Fase 5 **tidak boleh mengaktifkan server-authoritative pricing** sebelum konfigurasi harga cabang tersebut dilengkapi atau terdapat keputusan bisnis tertulis untuk layanan yang memang tidak dijual.

## Inventaris Error untuk Batch Awal

Hanya endpoint yang akan dimigrasikan sebelum Fase 6 dicatat di sini. Modul lain tidak boleh dimigrasikan sebelum inventarisnya ditambahkan.

| Route | Controller | Error lama | Status | Target typed error |
|---|---|---|---:|---|
| `GET /api/backoffice/item/:id` | `getMasterItemById` | `data not found` | 404 | `MASTER_ITEM_NOT_FOUND` |
| `POST /api/backoffice/item` | `createNewMasterItem` | item duplikat | 409 | `MASTER_ITEM_DUPLICATE` |
| `PUT/DELETE/POST /api/backoffice/item/:id` | master item mutation | data tidak ditemukan | 404 | `MASTER_ITEM_NOT_FOUND` |
| `POST /api/kasir/transaksi` | `createTransaksi` | master data atau addon tidak ditemukan | 404 | domain-specific `*_NOT_FOUND` |
| `POST /api/kasir/transaksi` | `createTransaksi` | stok/addon tidak valid | 400 saat ini | typed validation/conflict sesuai keputusan Fase 4 |
| `POST /api/kasir/transaksi` | `createTransaksi` | database tak dikenal | 500 | `INTERNAL_SERVER_ERROR` |

### Klasifikasi Catch yang Disentuh Lebih Dulu

| Lokasi | Kategori | Keputusan |
|---|---|---|
| `controller/masterItem.js` catch HTTP | `HTTP_ONLY`/`BUSINESS_MAPPING` | migrasi pada Fase 1 setelah typed error diverifikasi |
| `controller/transaksi.js:createTransaksi` | `BUSINESS_MAPPING` | pertahankan sampai Fase 4 memiliki typed error dan `catchAsync` |
| `models/transaksi.js:createTransaksi` | `TRANSACTION` | rollback/release tetap ada sampai Fase 3 |
| `controller/akses.js:saveAksesRole` | `TRANSACTION` | lifecycle pindah ke model/service pada Fase 3 |
| `models/transaksi.js:startMesin/stopMesin` | `RECOVERY`/`TRANSACTION` | pengecualian permanen dari helper generik karena commit log kegagalan MQTT |

## Inventaris Transaction Lifecycle

| Fungsi | Data yang ditulis | Query setelah commit | Side effect eksternal | Commit parsial | Kandidat `withTransaction` |
|---|---|---|---|---|---|
| `createNewCabang` | cabang dan data terkait | tidak | tidak | tidak | ya |
| `resetCabang` | data cabang dan turunan | tidak | tidak | tidak | ya |
| `saveAksesRole` | matriks akses | tidak | tidak | tidak | ya, pindah dari controller |
| `createPengeluaran` | pengeluaran dan stok | tidak | tidak | tidak | ya |
| `createSettingHarga` | konfigurasi harga | tidak | tidak | tidak | ya |
| `createNewMitra` | mitra dan data awal | tidak | tidak | tidak | ya |
| `createNewSetting` | threshold stok | ya, melalui pool | tidak | tidak | ya, read harus dipisah/masuk transaction |
| `createBulkSettings` | threshold stok bulk | ya, melalui pool | tidak | tidak | ya, read harus dipisah/masuk transaction |
| `createNewMesin` | master dan detail mesin | tidak | tidak | tidak | pilot Fase 2 |
| `updateMesin` | master dan detail mesin | tidak | tidak | tidak | ya; begin saat ini berada di luar `try` |
| `createTransaksi` | order, detail, stok, notifikasi | tidak | tidak | tidak | Fase 3 |
| `startMesin` | state detail dan log mesin | tidak | MQTT ACK | ya, log kegagalan tetap di-commit | tidak |
| `stopMesin` | state detail dan log mesin | tidak | MQTT ACK | ya, log kegagalan tetap di-commit | tidak |

## Characterization Test

- `test/transaksi.create.controller.test.js` menjaga kontrak validasi, payload sukses, mapping error, numeric string/decimal legacy, dan target harga manipulatif yang masih di-skip.
- `test/transaksi.model.test.js` membuktikan kegagalan insert detail me-rollback dan me-release connection.
- `test/coreDomains.integration.test.js` tetap menjadi bukti HTTP happy path, auth kasir, tenant/cabang, dan invoice.

## Gate Fase 0

- [x] Baseline command dan hasilnya tercatat.
- [x] Kontrak error untuk batch Fase 1, 3, dan 4 tercatat.
- [x] Semua 13 site transaction diklasifikasikan; `startMesin` dan `stopMesin` dikecualikan.
- [x] Kontrak uang dan kompatibilitas numeric string dicatat.
- [x] Characterization test melindungi happy path, validation, authorization, dan rollback utama `createTransaksi`.
- [x] Target test manipulasi harga tersedia dalam status skipped sampai Fase 5.

## Sinkronisasi Baseline Sebelum/Sesudah

Perbandingan ini mengikat baseline Fase 0 dengan bukti checkpoint setelah seluruh fase refactor. Angka test adalah gate repository, sedangkan kontrak endpoint yang sengaja berubah harus tetap dibaca bersama characterization dan integration test terkait.

| Aspek | Sebelum refactor | Sesudah refactor | Bukti akhir |
|---|---|---|---|
| Quality gate | Baseline commit `e82f218`, `npm.cmd run check`: 69 pass, 1 skip | Checkpoint implementasi `bf07ad5`, `npm.cmd run check`: 107 pass, 1 skip MQTT | Syntax, ESLint, Postman, quality gate, dan test penuh lulus |
| Error handling | Pilot/manual handling dan response error belum seragam | Route controller async memakai `catchAsync`; typed 4xx dan generic 5xx diuji | `scripts/check-refactor-quality.js`, `test/catchAsync.test.js`, `test/app.test.js` |
| Transaction lifecycle | Site transaction masih beragam dan perlu klasifikasi | Transaction standar memakai helper teruji; `startMesin`/`stopMesin` tetap lifecycle MQTT khusus | `test/standardTransactions.model.test.js`, `test/transaction.utils.test.js`, `test/coreDomains.integration.test.js` |
| Pricing | Nilai harga/subtotal dapat berasal dari payload client | Harga server-authoritative dan manipulasi harga ditolak dengan rollback | `test/transaksi.create.controller.test.js`, `test/coreDomains.integration.test.js`, quality gate |
| Contract compatibility | Kontrak legacy menjadi acuan characterization | Contract lama dipertahankan kecuali perubahan yang disetujui: typed error, alias `error` 4xx, dan penolakan harga client | Characterization, controller, authorization, dan integration suite lulus |
| Secret tracking | Audit awal menjadi baseline hygiene | Tidak ditemukan `.env`, `.pem`, `.key`, atau secret file yang ter-track | Audit akhir `git status`/tracked files |

Kesimpulan: tidak ada regression pada contract yang tidak dimaksudkan berubah. Perubahan contract yang disengaja tercatat di test dan dokumentasi API/compatibility.

## Blocker Sebelum Fase 5

Lengkapi harga `cuci` dan `kering` untuk cabang aktif yang memang menjual layanan tersebut. Jangan fallback ke subtotal dari client.
