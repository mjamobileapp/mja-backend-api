"# Issue: Implementasi API Get Data History Transaksi Per Cabang (History Module)

## Deskripsi

Buat API endpoint baru untuk menampilkan data history transaksi per cabang yang akan digunakan oleh aplikasi owner/mobile. Data diambil dari tabel `tbl_order_laundry` dan dikelompokkan per tanggal, kemudian di dalam setiap tanggal terdapat rincian rekapan per kasir (total transaksi, total cash, total qris).

## Endpoint

- **URL**: `/api/owner/history/transaksi?cabangId=:cabangId`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params**: `cabangId` (required) - ID cabang yang ingin dilihat history transaksinya

## Flow / Alur Program

1. Request masuk ke route `/api/owner/history/transaksi`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk mengambil data dari database
4. Model melakukan query ke `tbl_order_laundry` dengan LEFT JOIN ke `tbl_users_mobile`, menggunakan GROUP BY per tanggal dan per kasir
5. Data hasil query dikelompokkan per tanggal di dalam model (menggunakan sample code yang sudah diberikan)
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
  "success": true,
  "data": [
    {
      "tanggalTampilan": "2026-05-21",
      "totalTransaksiHariIni": 79,
      "rincianKasir": [
        {
          "idKasir": 105,
          "namaKasir": "Rara",
          "totalCash": 25,
          "totalQris": 10,
          "totalTransaksiKasir": 35
        },
        {
          "idKasir": 102,
          "namaKasir": "Gilang",
          "totalCash": 18,
          "totalQris": 5,
          "totalTransaksiKasir": 23
        },
        {
          "idKasir": 101,
          "namaKasir": "Rangga",
          "totalCash": 20,
          "totalQris": 1,
          "totalTransaksiKasir": 21
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
  DATE_FORMAT(o.waktuOrder, '%Y-%m-%d') AS tanggalGroup,
  o.idUserMobile AS idKasir,
  k.namaLengkap AS namaKasir,
  -- Menghitung total keseluruhan transaksi per kasir di hari tersebut
  COUNT(o.id) AS totalTransaksiKasir,
  -- Menghitung spesifik transaksi CASH
  SUM(CASE WHEN o.metodePembayaran = 'CASH' THEN 1 ELSE 0 END) AS totalCash,
  -- Menghitung spesifik transaksi QRIS (Sesuaikan string 'QRIS' dengan enum di database Anda)
  SUM(CASE WHEN o.metodePembayaran = 'QRIS' THEN 1 ELSE 0 END) AS totalQris
FROM tbl_order_laundry o
LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
WHERE o.cabangId = ? 
  AND o.idMitra = ?
  -- Opsional: Hanya hitung yang status pembayarannya PAID/Lunas
  AND (o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL) 
GROUP BY 
  DATE_FORMAT(o.waktuOrder, '%Y-%m-%d'), 
  o.idUserMobile, 
  k.namaLengkap
ORDER BY 
  tanggalGroup DESC, 
  totalTransaksiKasir DESC;
```

### Tabel yang Digunakan:
- `tbl_order_laundry` - tabel utama berisi data transaksi laundry
- `tbl_users_mobile` - tabel untuk mendapatkan nama kasir

### Kolom Penting di `tbl_order_laundry`:
- `id` - ID transaksi (INT, PK)
- `waktuOrder` - Waktu transaksi (DATETIME)
- `metodePembayaran` - Metode pembayaran ('CASH', 'QRIS', dll) — bisa VARCHAR atau ENUM
- `statusPembayaran` - Status pembayaran ('PAID', 'LUNAS', 'BELUM_LUNAS', NULL, dll)
- `cabangId` - ID cabang (FK)
- `idMitra` - ID mitra (FK)
- `idUserMobile` - ID kasir yang menangani (FK ke tbl_users_mobile)

### Kolom Penting di `tbl_users_mobile`:
- `id` - ID user mobile (INT, PK)
- `namaLengkap` - Nama lengkap kasir (VARCHAR)

## Struktur File yang Akan Dibuat / Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **CREATE** | `src/models/history.js` | Buat file baru untuk model history |
| 2 | **CREATE** | `src/controller/history.js` | Buat file baru untuk controller history |
| 3 | **CREATE** | `src/routes/history.js` | Buat file baru untuk route history |
| 4 | **MODIFY** | `src/index.js` | Daftarkan route history dengan prefix `/api/owner` |

---

## Tahapan Implementasi

### Tahap 1: Buat File Model (`src/models/history.js`)

Buat file baru `src/models/history.js` dengan struktur berikut:

```javascript
const dbPool = require("../config/database");

const getHistoryTransaksi = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        DATE_FORMAT(o.waktuOrder, '%Y-%m-%d') AS tanggalGroup,
        o.idUserMobile AS idKasir,
        k.namaLengkap AS namaKasir,
        COUNT(o.id) AS totalTransaksiKasir,
        SUM(CASE WHEN o.metodePembayaran = 'CASH' THEN 1 ELSE 0 END) AS totalCash,
        SUM(CASE WHEN o.metodePembayaran = 'QRIS' THEN 1 ELSE 0 END) AS totalQris
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
      WHERE o.cabangId = ? 
        AND o.idMitra = ?
        AND (o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL)
      GROUP BY 
        DATE_FORMAT(o.waktuOrder, '%Y-%m-%d'), 
        o.idUserMobile, 
        k.namaLengkap
      ORDER BY 
        tanggalGroup DESC, 
        totalTransaksiKasir DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Grouping per tanggal
    const groupedData = {};

    rows.forEach(row => {
      const tglKey = row.tanggalGroup;

      if (!groupedData[tglKey]) {
        groupedData[tglKey] = {
          tanggalTampilan: tglKey,
          totalTransaksiHariIni: 0,
          rincianKasir: []
        };
      }

      groupedData[tglKey].rincianKasir.push({
        idKasir: row.idKasir,
        namaKasir: row.namaKasir || 'Sistem',
        totalCash: Number(row.totalCash),
        totalQris: Number(row.totalQris),
        totalTransaksiKasir: Number(row.totalTransaksiKasir)
      });

      groupedData[tglKey].totalTransaksiHariIni += Number(row.totalTransaksiKasir);
    });

    // Ubah Object menjadi Array
    const finalResponse = Object.values(groupedData);

    return finalResponse;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getHistoryTransaksi,
};
```

**Penjelasan kode:**
- Query menggunakan `DATE_FORMAT` untuk memformat tanggal (lebih efisien daripada `DATE()` untuk GROUP BY)
- Menggunakan `SUM(CASE WHEN ...)` untuk menghitung jumlah transaksi CASH dan QRIS
- `COUNT(o.id)` menghitung total transaksi per kasir per hari
- Grouping per tanggal dilakukan di JavaScript (sesuai sample code yang diberikan)
- `Number()` digunakan untuk mengkonversi string hasil MySQL ke number
- Jika `namaKasir` null, default ke `'Sistem'`

### Tahap 2: Buat File Controller (`src/controller/history.js`)

Buat file baru `src/controller/history.js` dengan struktur berikut:

```javascript
const HistoryModel = require("../models/history");

const getHistoryTransaksi = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET HISTORY TRANSAKSI REQUEST:", { cabangId, idMitra });

  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan",
    });
  }

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await HistoryModel.getHistoryTransaksi(cabangId, idMitra);
    res.status(200).json({
      success: true,
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
  getHistoryTransaksi,
};
```

**Penjelasan kode:**
- `cabangId` diambil dari `req.query.cabangId`
- `idMitra` diambil dari `req.user.idMitra` dari middleware `authenticateMobile`
- Validasi dilakukan sebelum memanggil model
- Response format: `{ success: true, data: [...] }`

### Tahap 3: Buat File Route (`src/routes/history.js`)

Buat file baru `src/routes/history.js` dengan struktur berikut:

```javascript
const express = require("express");
const HistoryController = require("../controller/history");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get History Transaksi per Cabang
router.get("/transaksi", authenticateMobile, HistoryController.getHistoryTransaksi);

module.exports = router;
```

**Catatan:** Route ini akan didaftarkan dengan prefix `/api/owner/history` di `index.js`, sehingga endpoint lengkapnya menjadi `/api/owner/history/transaksi`.

### Tahap 4: Daftarkan Route di `src/index.js`

Buka file `src/index.js` dan cari bagian route registration. Tambahkan baris berikut:

```javascript
const historyRoutes = require("./routes/history");
```

Kemudian di bagian `app.use`, tambahkan:

```javascript
app.use("/api/owner/history", historyRoutes);
```

**Tips mencari lokasi yang tepat:**
- Cari baris yang berisi `app.use("/api/owner", cashflowRoutes);` — letakkan di dekat situ
- Atau cari baris terakhir `app.use(...)` sebelum `// ================= rencana ==================`

### Tahap 5: Testing

**Cara testing menggunakan PowerShell:**

1. Login Mobile terlebih dahulu untuk mendapatkan token:
```powershell
$body = @{
  username = "rangga"
  password = "password123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/login' -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.token
Write-Output $token
```

2. Panggil endpoint history transaksi:
```powershell
$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/owner/history/transaksi?cabangId=3' -Method Get -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json -Depth 10
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
| 1 | Token valid, cabangId ada, data ada | 200 - `{ success: true, data: [...] }` |
| 2 | Token valid, cabangId ada, data kosong | 404 - `{ error: "Data tidak ditemukan" }` |
| 3 | Token valid, cabangId tidak dikirim | 400 - `{ error: "cabangId tidak ditemukan" }` |
| 4 | Token tidak valid / expired | 401 - `{ error: "Token tidak valid" }` |
| 5 | Token tanpa field idMitra | 400 - `{ error: "idMitra tidak ditemukan di token" }` |

---

## Checklist Implementasi

- [ ] Tahap 1: Model (`src/models/history.js`)
  - [ ] Buat file baru
  - [ ] Fungsi `getHistoryTransaksi(cabangId, idMitra)`
  - [ ] Query dengan `DATE_FORMAT`, `COUNT`, `SUM(CASE WHEN ...)`
  - [ ] Filter `cabangId`, `idMitra`, `statusPembayaran`
  - [ ] Grouping per tanggal di JavaScript
  - [ ] Format: `{ tanggalTampilan, totalTransaksiHariIni, rincianKasir: [...] }`
  - [ ] `idKasir`, `namaKasir`, `totalCash`, `totalQris`, `totalTransaksiKasir`
  - [ ] Export fungsi

- [ ] Tahap 2: Controller (`src/controller/history.js`)
  - [ ] Buat file baru
  - [ ] Validasi `cabangId` dan `idMitra`
  - [ ] Response format `{ success: true, data }`
  - [ ] Error handling untuk data tidak ditemukan
  - [ ] Export fungsi

- [ ] Tahap 3: Route (`src/routes/history.js`)
  - [ ] Buat file baru
  - [ ] Route `GET /transaksi` dengan middleware `authenticateMobile`
  - [ ] Export router

- [ ] Tahap 4: Index (`src/index.js`)
  - [ ] `const historyRoutes = require(\"./routes/history\");`
  - [ ] `app.use(\"/api/owner/history\", historyRoutes);`

- [ ] Tahap 5: Testing
  - [ ] Test Case 1: Data ditemukan
  - [ ] Test Case 2: Data tidak ditemukan
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Buat file baru**: Model, controller, dan route untuk history adalah file baru — TIDAK menggabungkan dengan cashflow.
2. **Ikuti pola yang sudah ada** dari module cashflow (`getPendapatan`, `getPengeluaran`). Struktur kode, validasi, dan response harus konsisten.
3. **Gunakan `DATE_FORMAT` bukan `DATE`** di query SQL karena kita perlu GROUP BY berdasarkan format string 'YYYY-MM-DD'.
4. **Enum `metodePembayaran`**: Cek database apakah menggunakan string 'CASH'/'QRIS' atau enum. Sesuaikan query jika berbeda.
5. **Status pembayaran**: Query menggunakan `(o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL)`. Sesuaikan dengan nilai yang ada di database (mungkin 'LUNAS' atau lainnya).
6. **`totalTransaksiHariIni`** dihitung dengan menjumlahkan semua `totalTransaksiKasir` dalam satu tanggal (bukan hasil query langsung).
7. **Middleware** yang digunakan adalah `authenticateMobile` (bukan `authenticate`).
8. **Prefix route**: Route didaftarkan di `index.js` dengan prefix `/api/owner/history`, sehingga endpoint lengkap: `GET /api/owner/history/transaksi`.
9. **Response format**: Gunakan `success: true` (boolean), bukan `success: "..."` (string) seperti pada cashflow. Ikuti format yang diminta di issue.
10. **Jangan lupa `Number()`** untuk konversi string MySQL ke number JavaScript."