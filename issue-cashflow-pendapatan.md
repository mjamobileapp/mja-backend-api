# Issue: Implementasi API Get Data Pendapatan Per Cabang (Cashflow Module)

## Deskripsi

Buat API endpoint baru untuk menampilkan data pendapatan per cabang yang akan digunakan oleh aplikasi owner/mobile. Data diambil dari tabel `tbl_order_laundry` dan dikelompokkan per tanggal, kemudian di dalam setiap tanggal terdapat rincian transaksi.

## Endpoint

- **URL**: `/api/owner/cashflow/pendapatan?cabangId=:cabangId`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params**: `cabangId` (required) - ID cabang yang ingin dilihat pendapatannya

## Flow / Alur Program

1. Request masuk ke route `/api/owner/cashflow/pendapatan`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk mengambil data dari database
4. Model melakukan query ke `tbl_order_laundry` dengan LEFT JOIN ke `tbl_users_mobile`
5. Data hasil query dikelompokkan per tanggal di dalam model
6. Response dikembalikan ke client

## Request Body & Parameter

- Method: `GET`
- URL Parameter: `?cabangId=3`
- Header: `Authorization: Bearer <token_mobile>`
- Token mobile didapat dari login endpoint `/api/mobile/login`

## Response

### Success (200 OK):
```json
{
  "success": "Get Data Pendapatan Success",
  "data": [
    {
      "tanggalTampilan": "2026-05-21",
      "totalPendapatanHariIni": 90000,
      "rincian": [
        {
          "idTransaksi": 105,
          "waktuLengkap": "2026-05-21T14:30:00.000Z",
          "namaKasir": "Rangga",
          "nominalRupiah": "Rp 30.000",
          "nominalAngka": 30000
        },
        {
          "idTransaksi": 104,
          "waktuLengkap": "2026-05-21T10:15:00.000Z",
          "namaKasir": "Rangga",
          "nominalRupiah": "Rp 30.000",
          "nominalAngka": 30000
        }
      ]
    }
  ]
}
```

### Error (400 / 404 / 500):
```json
{
  "error": "cabangId tidak ditemukan"
}
```
atau:
```json
{
  "error": "Token tidak valid"
}
```

## Database / Query

### Query Utama:
```sql
SELECT 
  o.id AS idTransaksi,
  DATE(o.waktuOrder) AS tanggalGroup,
  o.waktuOrder AS waktuDetail,
  o.totalBayar AS nominal,
  k.namaLengkap AS namaKasir
FROM tbl_order_laundry o
LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
WHERE o.cabangId = ? 
  AND o.idMitra = ?
  AND o.statusPembayaran = 'LUNAS'
ORDER BY o.waktuOrder DESC;
```

### Tabel yang Digunakan:
- `tbl_order_laundry` - tabel utama berisi data transaksi laundry
- `tbl_users_mobile` - tabel untuk mendapatkan nama kasir

### Kolom Penting di `tbl_order_laundry`:
- `id` - ID transaksi
- `waktuOrder` - Waktu transaksi (DATETIME)
- `totalBayar` - Nominal pembayaran (INT/DECIMAL)
- `cabangId` - ID cabang (FK)
- `idMitra` - ID mitra (FK)
- `idUserMobile` - ID kasir yang menangani (FK ke tbl_users_mobile)
- `statusPembayaran` - Status pembayaran ('LUNAS', 'BELUM_LUNAS', dll)

### Kolom Penting di `tbl_users_mobile`:
- `id` - ID user mobile
- `namaLengkap` - Nama lengkap kasir

## Struktur File yang Akan Dibuat / Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/controller/cashflow.js` | Tambahkan fungsi `getPendapatan` |
| 2 | **MODIFY** | `src/models/cashflow.js` | Tambahkan fungsi `getPendapatan` dengan query dan grouping |
| 3 | **MODIFY** | `src/routes/owner.js` atau buat file baru `src/routes/cashflow.js` | Tambahkan route baru `GET /pendapatan` |

> **Catatan**: Cek dulu apakah sudah ada file `src/routes/owner.js` atau file route untuk owner. Jika sudah ada, gunakan file yang sudah ada. Jika belum, buat file route baru.

---

## Tahapan Implementasi

### Tahap 1: Cek Struktur File yang Ada

1. Cek apakah file `src/models/cashflow.js` sudah ada. Jika belum, buat file baru.
2. Cek apakah file `src/controller/cashflow.js` sudah ada. Jika belum, buat file baru.
3. Cek apakah file `src/routes/owner.js` sudah ada. Jika belum, buat file baru.
4. Cek apakah route sudah didaftarkan di `src/index.js`. Biasanya ada baris seperti:
   ```javascript
   const ownerRoutes = require("./routes/owner");
   app.use("/api/owner", ownerRoutes);
   ```

### Tahap 2: Buat Fungsi di Model (`src/models/cashflow.js`)

Jika file belum ada, buat file baru dengan struktur:

```javascript
const dbPool = require("../config/database");

const getPendapatan = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        o.id AS idTransaksi,
        DATE(o.waktuOrder) AS tanggalGroup,
        o.waktuOrder AS waktuDetail,
        o.totalBayar AS nominal,
        k.namaLengkap AS namaKasir
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
      WHERE o.cabangId = ? 
        AND o.idMitra = ?
        AND o.statusPembayaran = 'LUNAS'
      ORDER BY o.waktuOrder DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // 1. Siapkan wadah untuk Grouping per tanggal
    const groupedData = {};

    // 2. Looping dan kelompokkan berdasarkan tanggalGroup
    rows.forEach((row) => {
      const tanggal = row.tanggalGroup; // Format: '2026-05-21'

      // Jika tanggal ini belum ada di wadah, buat grup baru
      if (!groupedData[tanggal]) {
        groupedData[tanggal] = {
          tanggalTampilan: tanggal,
          totalPendapatanHariIni: 0,
          rincian: [],
        };
      }

      // Tambahkan nominal ke total harian
      groupedData[tanggal].totalPendapatanHariIni += row.nominal;

      // Format nominal ke rupiah (contoh: "Rp 30.000")
      const nominalRupiah = `Rp ${row.nominal.toLocaleString('id-ID')}`;

      // Tambahkan rincian transaksi
      groupedData[tanggal].rincian.push({
        idTransaksi: row.idTransaksi,
        waktuLengkap: row.waktuDetail,
        namaKasir: row.namaKasir,
        nominalRupiah: nominalRupiah,
        nominalAngka: row.nominal,
      });
    });

    // 3. Ubah objek (dictionary) kembali menjadi Array dan urutkan DESC berdasarkan tanggal
    const result = Object.values(groupedData).sort((a, b) => {
      return b.tanggalTampilan.localeCompare(a.tanggalTampilan);
    });

    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getPendapatan,
};
```

**Penjelasan kode:**
- Gunakan `dbPool.execute()` dengan parameter `[cabangId, idMitra]`
- Filter hanya transaksi dengan `statusPembayaran = 'LUNAS'`
- Grouping dilakukan di JavaScript (bukan SQL GROUP BY) agar lebih mudah di-handle
- `toLocaleString('id-ID')` digunakan untuk memformat angka ke format Indonesia (contoh: 30000 -> "30.000")
- Hasil akhir di-sort DESC berdasarkan tanggal

### Tahap 3: Buat Fungsi di Controller (`src/controller/cashflow.js`)

Jika file belum ada, buat file baru dengan struktur:

```javascript
const CashflowModel = require("../models/cashflow");

const getPendapatan = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET PENDAPATAN REQUEST:", { cabangId, idMitra });

  // Validasi cabangId
  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan",
    });
  }

  // Validasi idMitra dari token
  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await CashflowModel.getPendapatan(cabangId, idMitra);
    res.status(200).json({
      success: "Get Data Pendapatan Success",
      data: data,
    });
  } catch (error) {
    if (error.message === "Data tidak ditemukan") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  getPendapatan,
};
```

**Penjelasan kode:**
- `cabangId` diambil dari `req.query.cabangId` (bukan `req.params`)
- `idMitra` diambil dari `req.user.idMitra` yang disediakan oleh middleware `authenticateMobile`
- Validasi dilakukan di controller sebelum memanggil model

### Tahap 4: Buat atau Modifikasi File Route

Buat file `src/routes/owner.js` jika belum ada:

```javascript
const express = require("express");
const CashflowController = require("../controller/cashflow");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// Route untuk cashflow
router.get("/cashflow/pendapatan", authenticateMobile, CashflowController.getPendapatan);

module.exports = router;
```

### Tahap 5: Daftarkan Route di `src/index.js`

Cek di `src/index.js`, cari bagian route registration. Tambahkan baris berikut jika belum ada:

```javascript
const ownerRoutes = require("./routes/owner");
app.use("/api/owner", ownerRoutes);
```

Biasanya letakkan di bagian bawah bersama route lainnya (setelah route `authenticate` dan sebelum `app.listen`).

### Tahap 6: Testing

**Cara testing menggunakan Postman/curl:**

1. Login Mobile terlebih dahulu untuk mendapatkan token:
```
POST http://localhost:7001/api/mobile/login
Content-Type: application/json

{
  "username": "rangga",
  "password": "password123"
}
```

2. Panggil endpoint pendapatan:
```
GET http://localhost:7001/api/owner/cashflow/pendapatan?cabangId=3
Authorization: Bearer <token_mobile>
```

3. Jika tidak ada data, response:
```json
{
  "error": "Data tidak ditemukan"
}
```

**Test Case:**

| No | Skenario | Expected Response |
|----|----------|-------------------|
| 1 | Token valid, cabangId ada, data ada | 200 - `{ success, data }` |
| 2 | Token valid, cabangId ada, data kosong | 404 - `{ error: "Data tidak ditemukan" }` |
| 3 | Token valid, cabangId tidak dikirim | 400 - `{ error: "cabangId tidak ditemukan" }` |
| 4 | Token tidak valid / expired | 401 - `{ error: "Token tidak valid" }` |
| 5 | Token tanpa field idMitra | 400 - `{ error: "idMitra tidak ditemukan di token" }` |

---

## Checklist Implementasi

- [ ] Tahap 1: Cek struktur file yang sudah ada
- [ ] Tahap 2: Model (`src/models/cashflow.js`)
  - [ ] Fungsi `getPendapatan(cabangId, idMitra)`
  - [ ] Query dengan filter `cabangId`, `idMitra`, `statusPembayaran = 'LUNAS'`
  - [ ] Grouping per tanggal dengan JavaScript
  - [ ] Format nominal ke Rupiah (`Rp 30.000`)
  - [ ] Sort DESC berdasarkan tanggal
- [ ] Tahap 3: Controller (`src/controller/cashflow.js`)
  - [ ] Validasi `cabangId` dan `idMitra`
  - [ ] Response format `{ success, data }`
  - [ ] Error handling untuk data tidak ditemukan
- [ ] Tahap 4: Route (`src/routes/owner.js`)
  - [ ] Route `GET /cashflow/pendapatan`
  - [ ] Middleware `authenticateMobile`
- [ ] Tahap 5: Daftarkan route di `src/index.js`
  - [ ] `const ownerRoutes = require("./routes/owner");`
  - [ ] `app.use("/api/owner", ownerRoutes);`
- [ ] Tahap 6: Testing
  - [ ] Test Case 1: Data ditemukan
  - [ ] Test Case 2: Data tidak ditemukan
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Jangan gunakan SQL GROUP BY** untuk grouping per tanggal. Lakukan grouping di JavaScript agar lebih mudah dibaca dan di-maintenance.
2. **Gunakan `authenticateMobile`** (bukan `authenticate`) karena endpoint ini untuk aplikasi mobile/owner.
3. **`idMitra` diambil dari token** yang sudah diverifikasi oleh middleware `authenticateMobile`. Cek field `idMitra` di payload token.
4. **Format Rupiah** menggunakan `toLocaleString('id-ID')` JavaScript, bukan format dari database.
5. **Pastikan token mobile** memiliki field `idMitra`. Jika tidak, sesuaikan dengan struktur token yang ada.
6. **Ikuti pola yang sudah ada** di module lain (misal: module `users`, `mesin`, `transaksi`).
7. **Gunakan `console.log`** untuk debugging seperti yang dilakukan di fungsi-fungsi lain.
8. **Jangan lupa export** fungsi dari model dan controller agar bisa di-require oleh file lain.