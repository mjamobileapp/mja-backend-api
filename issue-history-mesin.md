"# Issue: Implementasi API Get Data History Mesin Per Cabang (History Module)

## Deskripsi

Buat API endpoint baru untuk menampilkan data history penggunaan mesin per cabang yang akan digunakan oleh aplikasi owner/mobile. Data diambil dari tabel `tbl_log_mesin` dengan JOIN ke `tbl_mesin_detail`, `tbl_mesin_master`, dan `tbl_users_mobile`. Hasilnya berupa daftar log mesin yang berhasil menyala (`statusPerintah = 'success'`), diurutkan dari yang terbaru.

## Endpoint

- **URL**: `/api/owner/history/mesin?cabangId=:cabangId`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params**: `cabangId` (required) - ID cabang yang ingin dilihat history mesinnya

## Flow / Alur Program

1. Request masuk ke route `/api/owner/history/mesin`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk mengambil data dari database
4. Model melakukan query ke `tbl_log_mesin` dengan JOIN ke `tbl_mesin_detail`, `tbl_mesin_master`, dan `tbl_users_mobile`
5. Data hasil query diformat menggunakan fungsi `formatJamWIB` untuk mengubah timestamp ke format "HH:mm WIB"
6. Response dikembalikan ke client (hanya array, tanpa grouping per tanggal)

> **Catatan**: Berbeda dengan history transaksi yang di-group per tanggal, history mesin ini langsung return array flat (tidak ada grouping).

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
      "idLog": 502,
      "namaMesin": "Mesin 4",
      "namaOperator": "Rangga",
      "jenisMesin": "DRYER",
      "waktuAktifTampilan": "19:00 WIB",
      "waktuLengkap": "2026-05-21T12:00:00.000Z"
    },
    {
      "idLog": 501,
      "namaMesin": "Mesin 5",
      "namaOperator": "Owner",
      "jenisMesin": "WASHER",
      "waktuAktifTampilan": "18:00 WIB",
      "waktuLengkap": "2026-05-21T11:00:00.000Z"
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
  l.id AS idLog,
  m.namaGroupMesin AS namaMesin,
  d.jenisMesin,
  u.namaLengkap AS namaOperator,
  l.waktuLog AS waktuLengkap
FROM tbl_log_mesin l
JOIN tbl_mesin_detail d ON l.mesinId = d.id
JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
LEFT JOIN tbl_users_mobile u ON l.kasirId = u.id
WHERE m.cabangId = ? 
  AND m.idMitra = ?
  AND l.statusPerintah = 'success'  -- Hanya tampilkan yang mesinnya berhasil menyala
ORDER BY l.waktuLog DESC;
```

### Tabel yang Digunakan:
- `tbl_log_mesin` - tabel utama berisi log penggunaan mesin
- `tbl_mesin_detail` - tabel detail mesin (WASHER/DRYER)
- `tbl_mesin_master` - tabel master mesin (namaGroupMesin, cabangId, idMitra)
- `tbl_users_mobile` - tabel untuk mendapatkan nama operator/kasir

### Kolom Penting di `tbl_log_mesin`:
- `id` - ID log (INT, PK)
- `mesinId` - ID mesin detail (FK ke tbl_mesin_detail.id)
- `kasirId` - ID kasir/operator (FK ke tbl_users_mobile.id)
- `waktuLog` - Waktu log (DATETIME)
- `statusPerintah` - Status perintah ('success', 'failed', dll)

### Kolom Penting di `tbl_mesin_detail`:
- `id` - ID detail mesin (INT, PK)
- `idMesinMaster` - ID master mesin (FK ke tbl_mesin_master.id)
- `jenisMesin` - Jenis mesin ('WASHER' atau 'DRYER')

### Kolom Penting di `tbl_mesin_master`:
- `id` - ID master mesin (INT, PK)
- `namaGroupMesin` - Nama grup mesin (VARCHAR, contoh: "Mesin Laundry 1")
- `cabangId` - ID cabang (FK)
- `idMitra` - ID mitra (FK)

## Struktur File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/history.js` | Tambahkan fungsi `getHistoryMesin` dengan query dan format jam WIB |
| 2 | **MODIFY** | `src/controller/history.js` | Tambahkan fungsi `getHistoryMesin` |
| 3 | **MODIFY** | `src/routes/history.js` | Tambahkan route baru `GET /mesin` |
| 4 | **TIDAK PERLU** | `src/index.js` | Route sudah terdaftar dengan prefix `/api/owner/history` |

> **Catatan**: File model, controller, dan route history sudah ada dari implementasi sebelumnya (history transaksi). Kita hanya perlu **menambahkan fungsi baru** ke file yang sudah ada, **TIDAK PERLU** membuat file baru atau mengubah `index.js`.

---

## Tahapan Implementasi

### Tahap 1: Tambahkan Fungsi di Model (`src/models/history.js`)

Buka file `src/models/history.js` dan tambahkan fungsi `getHistoryMesin` **setelah fungsi `getHistoryTransaksi`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const getHistoryMesin = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        l.id AS idLog,
        m.namaGroupMesin AS namaMesin,
        d.jenisMesin,
        u.namaLengkap AS namaOperator,
        l.waktuLog AS waktuLengkap
      FROM tbl_log_mesin l
      JOIN tbl_mesin_detail d ON l.mesinId = d.id
      JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
      LEFT JOIN tbl_users_mobile u ON l.kasirId = u.id
      WHERE m.cabangId = ? 
        AND m.idMitra = ?
        AND l.statusPerintah = 'success'
      ORDER BY l.waktuLog DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Format jam ke format "HH:mm WIB"
    const formatJamWIB = (dateString) => {
      const date = new Date(dateString);
      const jam = String(date.getHours()).padStart(2, '0');
      const menit = String(date.getMinutes()).padStart(2, '0');
      return `${jam}:${menit} WIB`;
    };

    // Mapping data mentah dari SQL ke format JSON UI
    const finalResponse = rows.map(row => {
      return {
        idLog: row.idLog,
        namaMesin: row.namaMesin,
        namaOperator: row.namaOperator || 'Sistem',
        jenisMesin: row.jenisMesin,
        waktuAktifTampilan: formatJamWIB(row.waktuLengkap),
        waktuLengkap: row.waktuLengkap,
      };
    });

    return finalResponse;
  } catch (error) {
    throw error;
  }
};
```

**Update `module.exports`** di bagian akhir file untuk menambahkan `getHistoryMesin`:

```javascript
module.exports = {
  getHistoryTransaksi,
  getHistoryMesin,
};
```

**Penjelasan kode:**
- Query menggunakan 3 JOIN: `tbl_log_mesin` ➡️ `tbl_mesin_detail` ➡️ `tbl_mesin_master` ➡️ `tbl_users_mobile`
- Filter `statusPerintah = 'success'` untuk hanya menampilkan log yang berhasil
- Fungsi `formatJamWIB` mengubah DATETIME menjadi format "HH:mm WIB" (contoh: `2026-05-21T12:00:00.000Z` ➡️ `"19:00 WIB"`)
- `padStart(2, '0')` memastikan jam dan menit selalu 2 digit (contoh: `09:05`, bukan `9:5`)
- Jika `namaOperator` null, default ke `'Sistem'`
- Hasil langsung return array (tidak ada grouping)

### Tahap 2: Tambahkan Fungsi di Controller (`src/controller/history.js`)

Buka file `src/controller/history.js` dan tambahkan fungsi `getHistoryMesin` **setelah fungsi `getHistoryTransaksi`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const getHistoryMesin = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET HISTORY MESIN REQUEST:", { cabangId, idMitra });

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
    const data = await HistoryModel.getHistoryMesin(cabangId, idMitra);
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
```

**Update `module.exports`** di bagian akhir file:

```javascript
module.exports = {
  getHistoryTransaksi,
  getHistoryMesin,
};
```

### Tahap 3: Tambahkan Route (`src/routes/history.js`)

Buka file `src/routes/history.js` dan tambahkan route baru **setelah route `getHistoryTransaksi`** dan **sebelum `module.exports`**.

```javascript
// GET - Get History Mesin per Cabang
router.get("/mesin", authenticateMobile, HistoryController.getHistoryMesin);
```

> **Catatan**: Route ini akan otomatis terdaftar dengan prefix `/api/owner/history` yang sudah ada di `index.js`, sehingga endpoint lengkapnya menjadi `GET /api/owner/history/mesin?cabangId=:cabangId`.

### Tahap 4: Testing

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

2. Panggil endpoint history mesin:
```powershell
$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/owner/history/mesin?cabangId=3' -Method Get -Headers @{Authorization="Bearer $token"}
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
  - [ ] Fungsi `getHistoryMesin(cabangId, idMitra)` **setelah** `getHistoryTransaksi`
  - [ ] Query dengan JOIN ke 3 tabel (`tbl_log_mesin`, `tbl_mesin_detail`, `tbl_mesin_master`, `tbl_users_mobile`)
  - [ ] Filter `statusPerintah = 'success'`
  - [ ] Filter `cabangId` dan `idMitra`
  - [ ] Fungsi `formatJamWIB` untuk format jam "HH:mm WIB"
  - [ ] Mapping array dengan properti: `idLog`, `namaMesin`, `namaOperator`, `jenisMesin`, `waktuAktifTampilan`, `waktuLengkap`
  - [ ] Jika `namaOperator` null, default ke `'Sistem'`
  - [ ] Tambahkan `getHistoryMesin` di `module.exports`

- [ ] Tahap 2: Controller (`src/controller/history.js`)
  - [ ] Fungsi `getHistoryMesin` **setelah** `getHistoryTransaksi`
  - [ ] Validasi `cabangId` dan `idMitra`
  - [ ] Response format `{ success: true, data }`
  - [ ] Error handling untuk data tidak ditemukan
  - [ ] Tambahkan `getHistoryMesin` di `module.exports`

- [ ] Tahap 3: Route (`src/routes/history.js`)
  - [ ] Route `GET /mesin` dengan middleware `authenticateMobile`
  - [ ] Tambahkan **setelah** route `getHistoryTransaksi`

- [ ] Tahap 4: Testing
  - [ ] Test Case 1: Data ditemukan
  - [ ] Test Case 2: Data tidak ditemukan
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Jangan buat file baru.** Semua perubahan hanya pada file yang sudah ada: `src/models/history.js`, `src/controller/history.js`, dan `src/routes/history.js`.
2. **Tidak perlu mengubah `src/index.js`** karena route history sudah terdaftar dengan prefix `/api/owner/history` dari implementasi sebelumnya.
3. **Tidak ada grouping** — hasil query langsung di-map dan return sebagai array flat.
4. **Format jam WIB** menggunakan fungsi `formatJamWIB` yang mengkonversi DATETIME ke "HH:mm WIB".
5. **`padStart(2, '0')`** penting untuk memastikan format jam 2 digit (contoh: `09:05`, bukan `9:5`).
6. **Fallback `namaOperator`** ke `'Sistem'` jika null (misal: operator dihapus dari database).
7. **Middleware** yang digunakan adalah `authenticateMobile` (bukan `authenticate`).
8. **Ikuti pola yang sudah ada** dari fungsi `getHistoryTransaksi` — struktur kode, validasi, dan response harus konsisten.
9. **Response `success`** menggunakan `true` (boolean), sama seperti `getHistoryTransaksi`.
10. **Cek nama tabel** `tbl_log_mesin`, `tbl_mesin_detail`, `tbl_mesin_master` — pastikan tabel-tabel ini ada di database."