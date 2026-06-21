"# Issue: Implementasi API Get Data Notifikasi (Notifikasi Module)

## Deskripsi

Buat API endpoint baru untuk menampilkan data notifikasi yang akan digunakan oleh aplikasi mobile (owner & kasir). Data diambil dari tabel `tbl_notifikasi` dan difilter berdasarkan role user (owner/kasir) serta cabangId.

## Endpoint

- **URL**: `/api/mobile/notifications`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params (opsional)**: `filterCabangId` — digunakan oleh owner untuk filter notifikasi per cabang tertentu

## Flow / Alur Program

1. Request masuk ke route `/api/mobile/notifications`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk mengambil data dari database
4. Model melakukan query ke `tbl_notifikasi` dengan filter `idMitra` dari token
5. Logika filter tambahan berdasarkan role:
   - **Kasir**: Hanya melihat notifikasi untuk cabangnya sendiri (`cabangId = userCabangId`) + notifikasi global (`cabangId IS NULL`)
   - **Owner**: Melihat semua notifikasi semua cabang, atau bisa filter per cabang jika `filterCabangId` dikirim
6. Hitung `unreadCount` dari data yang belum dibaca
7. Response dikembalikan ke client dengan format `{ success, meta, data }`

## Request Body & Parameter

- Method: `GET`
- URL Parameter (opsional): `?filterCabangId=3`
- Header: `Authorization: Bearer <token_mobile>`
- Token mobile didapat dari login endpoint `/api/mobile/login`

## Response

### Success (200 OK):
```json
{
  "success": true,
  "meta": {
    "unreadCount": 2,
    "totalData": 3
  },
  "data": [
    {
      "idNotif": 105,
      "cabangId": 3,
      "tipe": "TRANSAKSI",
      "referenceId": 8802,
      "judul": "Pembayaran QRIS Berhasil",
      "pesan": "Order sejumlah Rp 30.000 di Mesin Laundry 1 telah lunas dan mesin otomatis menyala.",
      "isRead": false,
      "waktu": "2026-06-21T10:45:00.000Z"
    },
    {
      "idNotif": 104,
      "cabangId": 3,
      "tipe": "ABSENSI",
      "referenceId": 550,
      "judul": "Kasir Login",
      "pesan": "Rangga telah memulai shift pagi pada 08:00 WIB.",
      "isRead": false,
      "waktu": "2026-06-21T08:00:00.000Z"
    },
    {
      "idNotif": 103,
      "cabangId": null,
      "tipe": "SISTEM",
      "referenceId": null,
      "judul": "Update Sistem v1.2",
      "pesan": "Fitur laporan bulanan kini sudah tersedia di dashboard web Anda.",
      "isRead": true,
      "waktu": "2026-06-19T15:00:00.000Z"
    }
  ]
}
```

### Error (400 / 401 / 500):
```json
{
  "error": "Token tidak valid"
}
```
atau:
```json
{
  "success": false,
  "message": "Server Error"
}
```

## Database / Query

### Tabel yang Digunakan:
- `tbl_notifikasi` - tabel utama berisi data notifikasi

### Kolom Penting di `tbl_notifikasi`:
- `id` - ID notifikasi (INT, PK, AUTO_INCREMENT)
- `cabangId` - ID cabang (INT, nullable) — null berarti notifikasi global
- `tipe` - Tipe notifikasi (VARCHAR/ENUM: 'TRANSAKSI', 'ABSENSI', 'SISTEM', dll)
- `referenceId` - ID referensi (INT, nullable) — misal ID transaksi, ID absensi
- `judul` - Judul notifikasi (VARCHAR)
- `pesan` - Isi pesan notifikasi (TEXT/VARCHAR)
- `isRead` - Status sudah dibaca (TINYINT/BOOLEAN: 0/1)
- `idMitra` - ID mitra (INT, FK)
- `createdDate` - Waktu notifikasi dibuat (DATETIME)

### Query Utama:
```sql
SELECT 
  id, cabangId, tipe, referenceId, judul, pesan, isRead, createdDate 
FROM tbl_notifikasi 
WHERE idMitra = ?
  -- Kondisi tambahan untuk filter role akan ditambahkan di JavaScript
ORDER BY createdDate DESC 
LIMIT 50;
```

## Struktur File yang Akan Dibuat / Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **CREATE** | `src/models/notifikasi.js` | Buat file baru untuk model notifikasi |
| 2 | **CREATE** | `src/controller/notifikasi.js` | Buat file baru untuk controller notifikasi |
| 3 | **MODIFY** | `src/routes/mobile.js` | Tambahkan route baru `GET /notifications` |

> **Catatan**: File route `mobile.js` sudah ada. Kita hanya perlu **menambahkan route baru** ke file yang sudah ada, **TIDAK PERLU** mengubah `src/index.js`.

---

## Tahapan Implementasi

### Tahap 1: Cek Token Mobile untuk Field `cabang_id`

Sebelum implementasi, cek apakah token mobile memiliki field `cabang_id`. Buka file middleware `src/middleware/authMobile.js` dan lihat payload token yang didecode. 

Jika token hanya memiliki `idMitra` dan tidak memiliki `cabang_id`, maka untuk role kasir, kita perlu sesuaikan. Alternatifnya:
- Jika `req.user.cabangId` atau `req.user.cabang_id` tersedia, gunakan itu
- Jika tidak, bisa fallback dengan menghapus filter cabang untuk kasir (atau menggunakan query tanpa filter cabang)

> **Tips**: Coba login sebagai kasir, lalu print `req.user` untuk melihat field apa saja yang tersedia.

### Tahap 2: Buat File Model (`src/models/notifikasi.js`)

Buat file baru `src/models/notifikasi.js` dengan struktur berikut:

```javascript
const dbPool = require("../config/database");

const getNotifikasi = async (idMitra, cabangId, filterCabangId) => {
  try {
    // Siapkan kerangka dasar Query SQL
    let sqlQuery = `
      SELECT 
        id, cabangId, tipe, referenceId, judul, pesan, isRead, createdDate 
      FROM tbl_notifikasi 
      WHERE idMitra = ?
    `;
    let queryParams = [idMitra];

    // INJEKSI LOGIKA FILTER BERDASARKAN cabangId
    if (cabangId) {
      // KASIR: Filter menggunakan cabang_id dari token
      // Tambahkan kondisi "OR cabangId IS NULL" untuk notif broadcast global
      sqlQuery += ` AND (cabangId = ? OR cabangId IS NULL)`;
      queryParams.push(cabangId);
    } else if (filterCabangId) {
      // OWNER: Filter per cabang jika diminta dari query params
      sqlQuery += ` AND cabangId = ?`;
      queryParams.push(filterCabangId);
    }
    // Jika owner dan tidak ada filterCabangId, tampilkan semua notif

    // Urutkan dari yang terbaru
    sqlQuery += ` ORDER BY createdDate DESC LIMIT 50`;

    const [rows] = await dbPool.execute(sqlQuery, queryParams);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getNotifikasi,
};
```

**Penjelasan kode:**
- Parameter `idMitra` (required) — dari token
- Parameter `cabangId` (opsional) — dari token, untuk role kasir
- Parameter `filterCabangId` (opsional) — dari query params, untuk owner yang ingin filter
- Logika filter:
  - Jika `cabangId` ada (kasir): filter `cabangId = ? OR cabangId IS NULL`
  - Jika `filterCabangId` ada (owner): filter `cabangId = ?`
  - Jika tidak ada filter: tampilkan semua notifikasi untuk mitra tersebut

### Tahap 3: Buat File Controller (`src/controller/notifikasi.js`)

Buat file baru `src/controller/notifikasi.js` dengan struktur berikut:

```javascript
const NotifikasiModel = require("../models/notifikasi");

const getNotifikasi = async (req, res) => {
  try {
    // 1. Ekstrak data dari Token Auth (Middleware)
    const userRole = req.user.role; // 'owner' atau 'kasir'
    const idMitra = req.user.idMitra || req.user.mitra_id;
    const userCabangId = req.user.cabang_id || req.user.cabangId;

    // Parameter opsional dari aplikasi (jika owner ingin filter cabang tertentu)
    const { filterCabangId } = req.query;

    console.log("GET NOTIFIKASI REQUEST:", { userRole, idMitra, userCabangId, filterCabangId });

    if (!idMitra) {
      return res.status(400).json({
        error: "idMitra tidak ditemukan di token",
      });
    }

    // 2. Tentukan cabangId untuk filter berdasarkan role
    let cabangId = null;
    if (userRole === 'kasir') {
      // KASIR: Paksa filter menggunakan cabang_id dari token
      cabangId = userCabangId;
    }
    // OWNER: cabangId tetap null, filterCabangId akan dikirim ke model jika ada

    // 3. Panggil Model
    const rows = await NotifikasiModel.getNotifikasi(idMitra, cabangId, filterCabangId);

    // 4. Mapping dan Hitung Unread Count
    let unreadCount = 0;
    const listNotifikasi = rows.map(row => {
      if (!row.isRead) unreadCount++;
      return {
        idNotif: row.id,
        cabangId: row.cabangId,
        tipe: row.tipe,
        referenceId: row.referenceId,
        judul: row.judul,
        pesan: row.pesan,
        isRead: Boolean(row.isRead),
        waktu: new Date(row.createdDate).toISOString(),
      };
    });

    // 5. Kirim JSON ke Mobile App
    res.json({
      success: true,
      meta: {
        unreadCount,
        totalData: listNotifikasi.length,
      },
      data: listNotifikasi,
    });
  } catch (error) {
    console.error("Notifikasi Controller Error (getNotifikasi):", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNotifikasi,
};
```

**Penjelasan kode (potongan penting):**

```javascript
// Mapping data mentah ke format response
const listNotifikasi = rows.map(row => {
  if (!row.isRead) unreadCount++;         // Hitung notif yang belum dibaca
  return {
    idNotif: row.id,                      // Ganti nama field id -> idNotif
    cabangId: row.cabangId,
    tipe: row.tipe,
    referenceId: row.referenceId,
    judul: row.judul,
    pesan: row.pesan,
    isRead: Boolean(row.isRead),          // Konversi 0/1 ke true/false
    waktu: new Date(row.createdDate).toISOString(),  // Format ISO string
  };
});
```

### Tahap 4: Tambahkan Route (`src/routes/mobile.js`)

Buka file `src/routes/mobile.js` dan tambahkan route baru **setelah route yang sudah ada** dan **sebelum `module.exports`**.

Pertama, **import controller** di bagian atas file:
```javascript
const NotifikasiController = require("../controller/notifikasi");
```

Kemudian, **tambahkan route**:
```javascript
// GET - Get Notifikasi Mobile
router.get("/notifications", authenticateMobile, NotifikasiController.getNotifikasi);
```

> **Catatan**: Route ini akan otomatis terdaftar dengan prefix `/api/mobile` yang sudah ada di `index.js`.

### Tahap 5: Testing

**Cara testing menggunakan PowerShell:**

1. Login Mobile sebagai **Owner** terlebih dahulu:
```powershell
$body = @{
  username = "rangga"
  password = "password123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/login' -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.token
Write-Output $token
```

2. Cek field `req.user` untuk debugging (tambahkan console.log di controller jika perlu):
   - Cek apakah ada `req.user.role`
   - Cek apakah ada `req.user.idMitra`
   - Cek apakah ada `req.user.cabang_id` atau `req.user.cabangId`

3. Panggil endpoint notifikasi (tanpa filter):
```powershell
$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/notifications' -Method Get -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json -Depth 10
```

4. Panggil endpoint notifikasi (dengan filter cabang):
```powershell
$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/notifications?filterCabangId=3' -Method Get -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json -Depth 10
```

5. Jika ada error, cek console log server untuk melihat detail error.

**Test Case:**

| No | Skenario | Expected Response |
|----|----------|-------------------|
| 1 | Token valid (owner), tanpa filter | 200 - `{ success: true, meta: { ... }, data: [...] }` |
| 2 | Token valid (owner), dengan filterCabangId | 200 - Data terfilter per cabang |
| 3 | Token valid (kasir) | 200 - Data terfilter cabang_id dari token + notif global |
| 4 | Token tidak valid / expired | 401 - `{ error: "Token tidak valid" }` |
| 5 | Token tanpa field idMitra | 400 - `{ error: "idMitra tidak ditemukan di token" }` |

---

## Checklist Implementasi

- [ ] Tahap 1: Cek field token (`req.user.role`, `req.user.idMitra`, `req.user.cabang_id`)
- [ ] Tahap 2: Model (`src/models/notifikasi.js`)
  - [ ] Buat file baru
  - [ ] Fungsi `getNotifikasi(idMitra, cabangId, filterCabangId)`
  - [ ] Query dengan dynamic WHERE clause
  - [ ] Logika filter:
    - [ ] Kasir: `AND (cabangId = ? OR cabangId IS NULL)`
    - [ ] Owner + filterCabangId: `AND cabangId = ?`
    - [ ] Owner tanpa filter: tampilkan semua
  - [ ] `ORDER BY createdDate DESC LIMIT 50`
  - [ ] Export fungsi

- [ ] Tahap 3: Controller (`src/controller/notifikasi.js`)
  - [ ] Buat file baru
  - [ ] Ekstrak `userRole`, `idMitra`, `userCabangId` dari `req.user`
  - [ ] Validasi `idMitra`
  - [ ] Logika role:
    - [ ] Kasir: set `cabangId = userCabangId`
    - [ ] Owner: `cabangId = null`, kirim `filterCabangId` ke model
  - [ ] Mapping data:
    - [ ] `idNotif` dari `row.id`
    - [ ] `isRead` dari `Boolean(row.isRead)`
    - [ ] `waktu` dari `new Date(row.createdDate).toISOString()`
  - [ ] Hitung `unreadCount`
  - [ ] Response format `{ success, meta: { unreadCount, totalData }, data }`
  - [ ] Error handling
  - [ ] Export fungsi

- [ ] Tahap 4: Route (`src/routes/mobile.js`)
  - [ ] Import `NotifikasiController`
  - [ ] Route `GET /notifications` dengan `authenticateMobile`

- [ ] Tahap 5: Testing
  - [ ] Test Case 1: Owner tanpa filter
  - [ ] Test Case 2: Owner dengan filterCabangId
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Buat file baru** untuk model dan controller (`src/models/notifikasi.js`, `src/controller/notifikasi.js`).
2. **Route sudah ada** — jangan buat file route baru. Tambahkan route ke `src/routes/mobile.js` yang sudah ada.
3. **Cek field token** — sebelum implementasi, pastikan field `role`, `idMitra`, `cabang_id` atau `cabangId` ada di `req.user`. Jika tidak ada, sesuaikan dengan nama field yang ada.
4. **Fallback nama field** — gunakan: `req.user.idMitra || req.user.mitra_id` dan `req.user.cabang_id || req.user.cabangId`.
5. **`isRead`** di database mungkin TINYINT(0/1). Gunakan `Boolean(row.isRead)` untuk konversi ke true/false.
6. **`createdDate`** di database mungkin DATETIME. Gunakan `new Date(row.createdDate).toISOString()` untuk format ISO 8601.
7. **Middleware** yang digunakan adalah `authenticateMobile` (bukan `authenticate`).
8. **Limit 50** — gunakan `LIMIT 50` di query untuk mencegah overload data.
9. **Ikuti pola yang sudah ada** dari module lain (cashflow, history).
10. **Gunakan `console.log`** untuk debugging, terutama untuk melihat isi `req.user`."