# Issue: Implementasi API Setting Harga Layanan Per Cabang

## Deskripsi

Buat API endpoint untuk mengatur harga layanan (cuci, kering, addon_barang) per cabang. Data disimpan di tabel baru `tbl_harga_cabang`. Prosesnya menggunakan metode **delete all lama** lalu **insert data baru** (bukan update per item). Hal ini memudahkan frontend untuk mengirim semua data item dalam satu array.

## Endpoint

- **URL**: `/api/owner/settingharga`
- **Method**: `POST`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Request Body**: JSON dengan `cabangId` dan array `item`

## Database

### Tabel Baru

Jalankan SQL berikut di database sebelum implementasi:

```sql
CREATE TABLE `tbl_harga_cabang` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `idMitra` INT NOT NULL COMMENT 'FK ke tbl_mitra (Keamanan SaaS)',
  `cabangId` INT NOT NULL,
  `jenisLayanan` ENUM('cuci', 'kering', 'addon_barang') NOT NULL,
  `itemId` INT DEFAULT NULL COMMENT 'Terisi jika jenisLayanan = addon_barang',
  `harga` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `createdDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(100) NOT NULL,
  FOREIGN KEY (`idMitra`) REFERENCES `tbl_mitra`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cabangId`) REFERENCES `tbl_cabang`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`itemId`) REFERENCES `tbl_master_item_expense`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Kolom Penting:
- `id` - Primary Key auto increment
- `idMitra` - Foreign Key ke tbl_mitra (untuk keamanan multi-tenant)
- `cabangId` - Foreign Key ke tbl_cabang
- `jenisLayanan` - Enum: 'cuci', 'kering', 'addon_barang'
- `itemId` - ID item dari tbl_master_item_expense (hanya untuk addon_barang, NULL untuk cuci/kering)
- `harga` - Harga layanan (DECIMAL 12,2)
- `createdDate` - Timestamp otomatis
- `createdBy` - Username pembuat

## Request & Response

### Request:
```
POST /api/owner/settingharga
Authorization: Bearer <token_mobile>
Content-Type: application/json

{
  "cabangId": 9,
  "item": [
    {
      "jenisLayanan": "cuci",
      "itemId": null,
      "harga": 10000
    },
    {
      "jenisLayanan": "kering",
      "itemId": null,
      "harga": 15000
    },
    {
      "jenisLayanan": "addon_barang",
      "itemId": 1,
      "harga": 1000
    },
    {
      "jenisLayanan": "addon_barang",
      "itemId": 2,
      "harga": 1500
    }
  ]
}
```

### Success (201 Created):
```json
{
  "message": "Create Setting Harga Layanan successful",
  "data": [
    {
      "id": 1,
      "idMitra": 1,
      "cabangId": 9,
      "jenisLayanan": "cuci",
      "itemId": null,
      "harga": 10000,
      "createdBy": "system"
    },
    {
      "id": 2,
      "idMitra": 1,
      "cabangId": 9,
      "jenisLayanan": "kering",
      "itemId": null,
      "harga": 15000,
      "createdBy": "system"
    }
  ]
}
```

### Error (400 / 401 / 500):
```json
{
  "message": "Token invalid"
}
```
atau:
```json
{
  "message": "cabangId tidak ditemukan di request body"
}
```
atau:
```json
{
  "message": "Mitra tidak ditemukan"
}
```
atau:
```json
{
  "message": "Cabang tidak ditemukan"
}
```

## Flow / Alur Program

1. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
2. Controller memvalidasi `cabangId` dan `item` array
3. Controller memvalidasi `idMitra` dari token dan `cabangId` dari body
4. Model mengecek apakah `idMitra` dan `cabangId` valid di database
5. Model melakukan **DELETE** semua data lama untuk `idMitra` & `cabangId` tersebut
6. Model melakukan **INSERT** data baru dari array `item`
7. Response dikembalikan dengan data yang baru diinsert

## Struktur File yang Akan Dibuat / Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **CREATE** | `src/models/hargaCabang.js` | Buat file baru untuk model setting harga cabang |
| 2 | **CREATE** | `src/controller/hargaCabang.js` | Buat file baru untuk controller |
| 3 | **MODIFY** | `src/routes/owner.js` atau buat file baru `src/routes/hargaCabang.js` | Tambahkan route baru `POST /settingharga` |
| 4 | **MODIFY** | `src/index.js` | Daftarkan route jika menggunakan file route baru |

> **Catatan**: Cek dulu apakah sudah ada file `src/routes/owner.js`. Jika ada, gunakan file tersebut. Jika tidak ada, buat file route baru.

---

## Tahapan Implementasi

### Tahap 1: Buat File Model (`src/models/hargaCabang.js`)

Buat file baru `src/models/hargaCabang.js`:

```javascript
const dbPool = require("../config/database");

const createSettingHarga = async (idMitra, cabangId, items, createdBy) => {
  try {
    // 1. Validasi idMitra
    const [mitraCheck] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw new Error("Mitra tidak ditemukan");
    }

    // 2. Validasi cabangId
    const [cabangCheck] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw new Error("Cabang tidak ditemukan");
    }

    // 3. DELETE data lama untuk idMitra & cabangId ini
    await dbPool.execute(
      "DELETE FROM tbl_harga_cabang WHERE idMitra = ? AND cabangId = ?",
      [idMitra, cabangId]
    );

    // 4. INSERT data baru untuk setiap item
    const insertedData = [];
    for (const item of items) {
      const { jenisLayanan, itemId, harga } = item;

      const [result] = await dbPool.execute(
        `INSERT INTO tbl_harga_cabang (idMitra, cabangId, jenisLayanan, itemId, harga, createdBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idMitra, cabangId, jenisLayanan, itemId || null, harga, createdBy]
      );

      insertedData.push({
        id: result.insertId,
        idMitra: idMitra,
        cabangId: cabangId,
        jenisLayanan: jenisLayanan,
        itemId: itemId || null,
        harga: harga,
        createdBy: createdBy,
      });
    }

    return insertedData;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createSettingHarga,
};
```

**Penjelasan kode:**
- Validasi `idMitra` dan `cabangId` dilakukan dengan SELECT
- DELETE semua data lama dengan filter `idMitra` & `cabangId`
- Loop INSERT untuk setiap item dalam array
- Return array data yang sudah diinsert termasuk `id` dari `result.insertId`
- `itemId || null` memastikan jika itemId undefined/null, tetap jadi NULL di database

### Tahap 2: Buat File Controller (`src/controller/hargaCabang.js`)

Buat file baru `src/controller/hargaCabang.js`:

```javascript
const HargaCabangModel = require("../models/hargaCabang");

const createSettingHarga = async (req, res) => {
  const { cabangId, item } = req.body;
  const idMitra = req.user ? req.user.idMitra : null;
  const createdBy = req.user ? req.user.username || req.user.id : null;

  console.log("CREATE SETTING HARGA REQUEST:", { idMitra, cabangId, item });

  if (!idMitra) {
    return res.status(400).json({
      message: "idMitra tidak ditemukan di token",
    });
  }

  if (!cabangId) {
    return res.status(400).json({
      message: "cabangId tidak ditemukan di request body",
    });
  }

  if (!item || !Array.isArray(item) || item.length === 0) {
    return res.status(400).json({
      message: "item harus berupa array dan tidak boleh kosong",
    });
  }

  // Validasi setiap item
  for (let i = 0; i < item.length; i++) {
    const it = item[i];
    if (!it.jenisLayanan) {
      return res.status(400).json({
        message: `jenisLayanan wajib diisi untuk item ke-${i + 1}`,
      });
    }
    if (!['cuci', 'kering', 'addon_barang'].includes(it.jenisLayanan)) {
      return res.status(400).json({
        message: `jenisLayanan harus 'cuci', 'kering', atau 'addon_barang' untuk item ke-${i + 1}`,
      });
    }
    if (it.jenisLayanan === 'addon_barang' && !it.itemId) {
      return res.status(400).json({
        message: `itemId wajib diisi untuk jenisLayanan 'addon_barang' di item ke-${i + 1}`,
      });
    }
    if (!it.harga && it.harga !== 0) {
      return res.status(400).json({
        message: `harga wajib diisi untuk item ke-${i + 1}`,
      });
    }
  }

  try {
    const data = await HargaCabangModel.createSettingHarga(idMitra, cabangId, item, createdBy);
    res.status(201).json({
      message: "Create Setting Harga Layanan successful",
      data: data,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan" ||
      error.message === "Cabang tidak ditemukan"
    ) {
      return res.status(404).json({
        message: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  createSettingHarga,
};
```

**Penjelasan kode:**
- `cabangId` dan `item` dari `req.body`
- `idMitra` dari `req.user` (token)
- `createdBy` dari `req.user.username` atau `req.user.id`
- Validasi: `cabangId` harus ada, `item` harus array tidak kosong
- Validasi per item: `jenisLayanan` wajib, harus enum yang valid, `itemId` wajib untuk addon_barang, `harga` wajib
- Response status 201 (Created)

### Tahap 3: Buat File Route (`src/routes/hargaCabang.js`)

Buat file baru `src/routes/hargaCabang.js`:

```javascript
const express = require("express");
const HargaCabangController = require("../controller/hargaCabang");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// POST - Create / Update Setting Harga Layanan per Cabang
router.post("/", authenticateMobile, HargaCabangController.createSettingHarga);

module.exports = router;
```

### Tahap 4: Daftarkan Route di `src/index.js`

Buka file `src/index.js`. Cari bagian route registration (setelah route kasir/stokmitra atau di dekat route owner lainnya). Tambahkan:

```javascript
const hargaCabangRoutes = require("./routes/hargaCabang");
```

Dan di bagian `app.use`:

```javascript
app.use("/api/owner/settingharga", hargaCabangRoutes);
```

**Tips:** Cari baris `app.use("/api/owner", cashflowRoutes);` atau `app.use("/api/backoffice/dashboard", dashboardRoutes);` untuk menempatkan di dekat situ.

### Tahap 5: Testing

**Cara testing menggunakan PowerShell:**

1. Login Mobile terlebih dahulu:
```powershell
$body = @{
  username = "rangga"
  password = "password123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/login' -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.token
```

2. Panggil endpoint setting harga:
```powershell
$body = @{
  cabangId = 9
  item = @(
    @{ jenisLayanan = "cuci"; itemId = $null; harga = 10000 },
    @{ jenisLayanan = "kering"; itemId = $null; harga = 15000 },
    @{ jenisLayanan = "addon_barang"; itemId = 1; harga = 1000 },
    @{ jenisLayanan = "addon_barang"; itemId = 2; harga = 1500 }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/owner/settingharga' -Method Post -Body $body -ContentType 'application/json' -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json -Depth 10
```

**Test Case:**

| No | Skenario | Expected Response |
|----|----------|-------------------|
| 1 | Data valid, cabangId ada | 201 - `{ message, data: [...] }` |
| 2 | Token valid, cabangId tidak ada di body | 400 - `{ message: "cabangId tidak ditemukan di request body" }` |
| 3 | Token valid, array item kosong | 400 - `{ message: "item harus berupa array dan tidak boleh kosong" }` |
| 4 | Token valid, cabangId tidak ada di DB | 404 - `{ message: "Cabang tidak ditemukan" }` |
| 5 | Token tidak valid / expired | 401 - `{ message: "Token invalid" }` |

---

## Checklist Implementasi

- [ ] **Pra-Implementasi**: Jalankan SQL CREATE TABLE `tbl_harga_cabang` di database
- [ ] Tahap 1: Model (`src/models/hargaCabang.js`)
  - [ ] Buat file baru
  - [ ] Fungsi `createSettingHarga(idMitra, cabangId, items, createdBy)`
  - [ ] Validasi `idMitra` dengan SELECT
  - [ ] Validasi `cabangId` dengan SELECT
  - [ ] DELETE data lama `WHERE idMitra = ? AND cabangId = ?`
  - [ ] INSERT loop untuk setiap item
  - [ ] Return array data yang diinsert
  - [ ] Export fungsi

- [ ] Tahap 2: Controller (`src/controller/hargaCabang.js`)
  - [ ] Buat file baru
  - [ ] Validasi `idMitra` dari token
  - [ ] Validasi `cabangId` dari body
  - [ ] Validasi `item` adalah array tidak kosong
  - [ ] Validasi per item (jenisLayanan, itemId untuk addon_barang, harga)
  - [ ] Response status 201
  - [ ] Export fungsi

- [ ] Tahap 3: Route (`src/routes/hargaCabang.js`)
  - [ ] Buat file baru
  - [ ] Route `POST /` dengan `authenticateMobile`
  - [ ] Export router

- [ ] Tahap 4: Index (`src/index.js`)
  - [ ] `const hargaCabangRoutes = require("./routes/hargaCabang");`
  - [ ] `app.use("/api/owner/settingharga", hargaCabangRoutes);`

- [ ] Tahap 5: Testing
  - [ ] Test Case 1: Data valid
  - [ ] Test Case 2: cabangId tidak ada
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Buat file baru** untuk model, controller, dan route (`hargaCabang.js`).
2. **Jalankan SQL CREATE TABLE** di database sebelum coding.
3. **Metode DELETE + INSERT** — bukan UPDATE per item. Ini memudahkan frontend mengirim semua data sekaligus.
4. **Validasi idMitra & cabangId** — lakukan SELECT dulu sebelum DELETE/INSERT.
5. **`createdBy`** — ambil dari `req.user.username || req.user.id`.
6. **`itemId || null`** — pastikan itemId menjadi NULL di DB jika tidak diisi.
7. **Status response** — gunakan `201` untuk Created, bukan 200.
8. **Middleware** yang digunakan adalah `authenticateMobile`.
9. **Error handling** — bedakan error validasi (400), not found (404), dan server error (500).
10. **Ikuti pola yang sudah ada** dari module lain (cashflow, history, notifikasi).