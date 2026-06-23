# Issue: Implementasi API Create Pengeluaran (Cashflow Module) untuk Kasir

## Deskripsi

Buat API endpoint untuk mencatat pengeluaran baru per cabang yang diinput oleh user **Kasir**. Data disimpan ke tabel `tbl_pengeluaran`. `idMitra`, `cabangId`, dan `idUserMobile` diambil dari **token** (data user yang login), bukan dari request body.

## Endpoint

- **URL**: `/api/owner/cashflow/pengeluaran`
- **Method**: `POST`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Request Body**: JSON dengan `itemId`, `jumlahBarang`, `nominal`

## Flow / Alur Program

1. Request masuk ke route `POST /api/owner/cashflow/pengeluaran`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller mengambil `itemId`, `jumlahBarang`, `nominal` dari request body
4. Controller mengambil `idMitra`, `cabangId`, `idUserMobile` dari `req.user` (token)
5. Validasi input:
   - `itemId` wajib ada
   - `nominal` wajib ada dan > 0
   - `cabangId` dari token wajib ada (untuk kasir, sudah ada di token dari implementasi sebelumnya)
6. Model melakukan validasi:
   - Cek `idMitra` exist di `tbl_mitra`
   - Cek `cabangId` exist di `tbl_cabang`
   - Cek `itemId` exist di `tbl_master_item_expense`
   - Cek `idUserMobile` exist di `tbl_users_mobile`
7. Model melakukan INSERT ke `tbl_pengeluaran`
8. Response dikembalikan dengan data yang baru diinsert

## Request & Response

### Request:
```
POST /api/owner/cashflow/pengeluaran
Authorization: Bearer <token_mobile_kasir>
Content-Type: application/json

{
  "itemId": 9,
  "jumlahBarang": 5,
  "nominal": 20000
}
```

### Success (201 Created):
```json
{
  "success": "Create Data List Expense Success",
  "data": {
    "id": 108,
    "idMitra": "9",
    "cabangId": "3",
    "idUserMobile": "1",
    "itemId": 9,
    "jumlahBarang": 5,
    "nominal": 20000,
    "waktuPengeluaran": "2026-06-21T10:45:00.000Z",
    "createdDate": "2026-06-21T10:45:00.000Z"
  }
}
```

### Error (400 / 401 / 404 / 500):
```json
{
  "error": "Token tidak valid"
}
```
atau:
```json
{
  "error": "cabangId tidak ditemukan di token"
}
```
atau:
```json
{
  "error": "itemId wajib diisi"
}
```
atau:
```json
{
  "error": "nominal wajib diisi dan harus lebih dari 0"
}
```
atau:
```json
{
  "error": "Item tidak ditemukan"
}
```

## Database

### Tabel:
- `tbl_pengeluaran` - tabel utama pengeluaran
- `tbl_mitra` - untuk validasi mitra
- `tbl_cabang` - untuk validasi cabang
- `tbl_master_item_expense` - untuk validasi item
- `tbl_users_mobile` - untuk validasi user

### Query INSERT:
```sql
INSERT INTO tbl_pengeluaran (idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran)
VALUES (?, ?, ?, ?, ?, ?, NOW());
```

### Query Validasi:
```sql
-- Cek mitra
SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1;

-- Cek cabang
SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1;

-- Cek user
SELECT id FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1;

-- Cek item
SELECT id FROM tbl_master_item_expense WHERE id = ?;
```

## Struktur File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/cashflow.js` | Tambahkan fungsi `createPengeluaran(data)` |
| 2 | **MODIFY** | `src/controller/cashflow.js` | Tambahkan fungsi `createPengeluaran` |
| 3 | **MODIFY** | `src/routes/cashflow.js` | Tambahkan route baru `POST /cashflow/pengeluaran` |

> **Catatan**: File model, controller, dan route `cashflow` sudah ada. Kita hanya perlu **menambahkan fungsi baru** ke file yang sudah ada.

---

## Tahapan Implementasi

### Tahap 1: Tambahkan Fungsi di Model (`src/models/cashflow.js`)

Buka file `src/models/cashflow.js` dan tambahkan fungsi `createPengeluaran` **setelah fungsi `getListPengeluaran`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const createPengeluaran = async (data) => {
  const { idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal } = data;

  try {
    // 1. Validasi idMitra
    const [mitraCheck] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw new Error("Mitra tidak ditemukan");
    }

    // 2. Validasi cabangId (cek juga milik mitra yang sama)
    const [cabangCheck] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw new Error("Cabang tidak ditemukan");
    }

    // 3. Validasi idUserMobile
    const [userCheck] = await dbPool.execute(
      "SELECT id FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
      [idUserMobile]
    );
    if (userCheck.length === 0) {
      throw new Error("User tidak ditemukan");
    }

    // 4. Validasi itemId
    const [itemCheck] = await dbPool.execute(
      "SELECT id FROM tbl_master_item_expense WHERE id = ?",
      [itemId]
    );
    if (itemCheck.length === 0) {
      throw new Error("Item tidak ditemukan");
    }

    // 5. INSERT pengeluaran
    const [result] = await dbPool.execute(
      `INSERT INTO tbl_pengeluaran (idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [idMitra, cabangId, idUserMobile, itemId, jumlahBarang || 0, nominal]
    );

    // 6. Ambil data yang baru diinsert untuk response
    const [newData] = await dbPool.execute(
      `SELECT id, idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran, createdDate
       FROM tbl_pengeluaran WHERE id = ?`,
      [result.insertId]
    );

    if (newData.length === 0) {
      throw new Error("Gagal mengambil data pengeluaran");
    }

    const row = newData[0];

    return {
      id: row.id,
      idMitra: String(row.idMitra),
      cabangId: String(row.cabangId),
      idUserMobile: String(row.idUserMobile),
      itemId: row.itemId,
      jumlahBarang: row.jumlahBarang,
      nominal: row.nominal,
      waktuPengeluaran: row.waktuPengeluaran ? new Date(row.waktuPengeluaran).toISOString() : "",
      createdDate: row.createdDate ? new Date(row.createdDate).toISOString() : "",
    };
  } catch (error) {
    throw error;
  }
};
```

**Update `module.exports`** di bagian akhir file:

```javascript
module.exports = {
  getCashflow,
  getPendapatan,
  getPengeluaran,
  getListPengeluaran,
  createPengeluaran,
};
```

### Tahap 2: Tambahkan Fungsi di Controller (`src/controller/cashflow.js`)

Buka file `src/controller/cashflow.js` dan tambahkan fungsi `createPengeluaran` **setelah fungsi `getListPengeluaran`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const createPengeluaran = async (req, res) => {
  const { itemId, jumlahBarang, nominal } = req.body;

  // Ambil data dari token
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;
  const idUserMobile = req.user ? req.user.id : null;

  console.log("CREATE PENGELUARAN REQUEST:", { idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal });

  // Validasi idMitra dari token
  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  // Validasi cabangId dari token
  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan di token",
    });
  }

  // Validasi idUserMobile dari token
  if (!idUserMobile) {
    return res.status(400).json({
      error: "idUserMobile tidak ditemukan di token",
    });
  }

  // Validasi itemId
  if (!itemId) {
    return res.status(400).json({
      error: "itemId wajib diisi",
    });
  }

  // Validasi nominal
  if (!nominal || nominal <= 0) {
    return res.status(400).json({
      error: "nominal wajib diisi dan harus lebih dari 0",
    });
  }

  try {
    const data = await CashflowModel.createPengeluaran({
      idMitra,
      cabangId,
      idUserMobile,
      itemId,
      jumlahBarang: jumlahBarang || 0,
      nominal,
    });

    res.status(201).json({
      success: "Create Data List Expense Success",
      data: data,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan" ||
      error.message === "Cabang tidak ditemukan" ||
      error.message === "User tidak ditemukan" ||
      error.message === "Item tidak ditemukan"
    ) {
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
  getCashflow,
  getPendapatan,
  getPengeluaran,
  getListPengeluaran,
  createPengeluaran,
};
```

### Tahap 3: Tambahkan Route (`src/routes/cashflow.js`)

Buka file `src/routes/cashflow.js` dan tambahkan route baru **setelah route `GET /cashflow/pengeluaran`** dan **sebelum `module.exports`**.

```javascript
// POST - Create Pengeluaran (Kasir)
router.post("/cashflow/pengeluaran", authenticateMobile, CashflowController.createPengeluaran);
```

### Tahap 4: Testing

**Cara testing menggunakan PowerShell:**

1. Login sebagai Kasir terlebih dahulu (pastikan akun kasir memiliki `cabangId` di database):
```powershell
$body = @{
  username = "rara"
  password = "password123"
  deviceId = "test123"
  deviceName = "PowerShell"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/login' -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.token
```

2. Panggil endpoint create pengeluaran:
```powershell
$body = @{
  itemId = 9
  jumlahBarang = 5
  nominal = 20000
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/owner/cashflow/pengeluaran' -Method Post -Body $body -ContentType 'application/json' -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json -Depth 10
```

**Test Case:**

| No | Skenario | Expected Response |
|----|----------|-------------------|
| 1 | Data valid, semua field terisi | 201 - `{ success, data }` |
| 2 | Token valid, itemId tidak dikirim | 400 - `{ error: "itemId wajib diisi" }` |
| 3 | Token valid, nominal <= 0 | 400 - `{ error: "nominal wajib diisi dan harus lebih dari 0" }` |
| 4 | Token valid, itemId tidak ada di DB | 404 - `{ error: "Item tidak ditemukan" }` |
| 5 | Token tidak valid / expired | 401 - `{ error: "Token tidak valid" }` |
| 6 | Token valid, cabangId tidak ada di token | 400 - `{ error: "cabangId tidak ditemukan di token" }` |

---

## Checklist Implementasi

- [ ] Tahap 1: Model (`src/models/cashflow.js`)
  - [ ] Fungsi `createPengeluaran(data)` **setelah** `getListPengeluaran`
  - [ ] Validasi `idMitra` dengan SELECT
  - [ ] Validasi `cabangId` dengan SELECT (plus cek milik mitra yg sama)
  - [ ] Validasi `idUserMobile` dengan SELECT
  - [ ] Validasi `itemId` dengan SELECT
  - [ ] INSERT ke `tbl_pengeluaran` dengan `waktuPengeluaran = NOW()`
  - [ ] SELECT data yang baru diinsert untuk response
  - [ ] Return object dengan field: `id`, `idMitra`, `cabangId`, `idUserMobile`, `itemId`, `jumlahBarang`, `nominal`, `waktuPengeluaran`, `createdDate`
  - [ ] Tambahkan `createPengeluaran` di `module.exports`

- [ ] Tahap 2: Controller (`src/controller/cashflow.js`)
  - [ ] Fungsi `createPengeluaran` **setelah** `getListPengeluaran`
  - [ ] Ambil `itemId`, `jumlahBarang`, `nominal` dari `req.body`
  - [ ] Ambil `idMitra`, `cabangId`, `idUserMobile` dari `req.user`
  - [ ] Validasi `idMitra` dari token
  - [ ] Validasi `cabangId` dari token (pastikan ada untuk kasir)
  - [ ] Validasi `idUserMobile` dari token
  - [ ] Validasi `itemId` wajib diisi
  - [ ] Validasi `nominal` wajib > 0
  - [ ] Response status 201
  - [ ] Export fungsi

- [ ] Tahap 3: Route (`src/routes/cashflow.js`)
  - [ ] Import sudah ada
  - [ ] Route `POST /cashflow/pengeluaran` dengan `authenticateMobile`
  - [ ] Tambahkan **setelah** route GET pengeluaran

- [ ] Tahap 4: Testing
  - [ ] Test Case 1: Data valid
  - [ ] Test Case 2: itemId tidak dikirim
  - [ ] Test Case 3: nominal <= 0
  - [ ] Test Case 4: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Jangan buat file baru.** Semua perubahan hanya pada file yang sudah ada: `src/models/cashflow.js`, `src/controller/cashflow.js`, dan `src/routes/cashflow.js`.
2. **Data dari token** — `idMitra`, `cabangId`, dan `idUserMobile` diambil dari `req.user` (hasil decode token), bukan dari request body.
3. **`cabangId` di token** — Sudah ditambahkan di implementasi sebelumnya (issue sebelumnya). Untuk kasir, `cabangId` sudah ada di token. Untuk owner, `cabangId` mungkin null — endpoint ini khusus untuk kasir.
4. **`idUserMobile`** — Gunakan `req.user.id` (ID user yang login).
5. **Validasi semua foreign key** — lakukan SELECT dulu sebelum INSERT untuk memastikan data exist.
6. **`jumlahBarang`** — boleh 0 (default). Gunakan `jumlahBarang || 0`.
7. **`waktuPengeluaran`** — gunakan `NOW()` di SQL agar konsisten dengan server.
8. **Format response** — `idMitra`, `cabangId`, `idUserMobile` di-convert ke String.
9. **Middleware** yang digunakan adalah `authenticateMobile`.
10. **Ikuti pola yang sudah ada** dari fungsi lain di cashflow.