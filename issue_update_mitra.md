# Issue: Implementasi API Update Data Mitra

## Deskripsi
Membuat endpoint baru untuk memperbarui data mitra yang sudah ada di database. Endpoint ini memungkinkan admin atau pengguna terautentikasi untuk mengubah informasi mitra tertentu berdasarkan ID-nya.

## Spesifikasi API

### Endpoint Details
```
Endpoint  : PUT /mitra/{id}
Method    : PUT
Auth      : Bearer Token (Required)
```

### Request Parameters
- `id` (URL parameter, required): ID mitra yang akan diupdate

**Note:** Endpoint ini tidak memerlukan request body. Hanya parameter ID yang diperlukan.

### Response Body (Success - 200 OK)
```json
{
    "message": "UPDATE Mitra success",
    "data": {
        "id": "9",
        "kodeMitra": "M260603001",
        "namaMitra": "Sakinah Laundry",
        "updatedBy": "admin",
        "updatedDate": "2026-06-03 14:30:00"
    }
}
```

### Response Body (Error Cases)

**404 Not Found** (Data doesn't exist):
```json
{
    "error": "data not found"
}
```

**401 Unauthorized** (Invalid token):
```json
{
    "message": "Akses ditolak, token tidak ditemukan"
}
```

**500 Internal Server Error**:
```json
{
    "message": "Server Error",
    "serverMessage": "error detail message"
}
```

---

## Panduan Tahapan Implementasi

### ✅ Tahap 1: Tambah Fungsi di Model (src/models/mitra.js)

**File:** `src/models/mitra.js`

Tambahkan fungsi baru `updateMitra` ke dalam file ini. Fungsi ini bertanggung jawab untuk:
- Menerima parameter `id` saja (hanya ID yang diperlukan)
- Melakukan query SELECT terlebih dahulu untuk mengambil data mitra yang ada
- Memvalidasi apakah mitra dengan ID tersebut ada di database
- Jika ada, lakukan UPDATE dengan set `updatedDate` ke waktu sekarang
- Throw error jika data tidak ditemukan
- Return data mitra yang telah diupdate

**Pseudocode:**
```javascript
const updateMitra = async (id) => {
  // 1. Check if mitra exists
  // 2. If not found, throw error "Mitra tidak ditemukan"
  // 3. If found, execute UPDATE query (update only updatedDate)
  // 4. Fetch and return the updated mitra data
}
```

---

### ✅ Tahap 2: Tambah Controller Function (src/controller/mitra.js)

**File:** `src/controller/mitra.js`

Tambahkan fungsi baru `updateMitra` ke dalam module exports. Fungsi ini bertanggung jawab untuk:
- Ekstrak `id` dari `req.params`
- Panggil `MitraModel.updateMitra(id)` tanpa perlu validasi request body
- Handle error response:
  - 404 untuk "Mitra tidak ditemukan"
  - 500 untuk server error
- Return 200 success response dengan format sesuai spesifikasi di atas

**Pseudocode:**
```javascript
const updateMitra = async (req, res) => {
  // 1. Get id from req.params
  // 2. Try-catch to call MitraModel.updateMitra(id)
  // 3. Handle error (404 if not found, 500 if server error)
  // 4. Return 200 success response with updated data
}
```

---

### ✅ Tahap 3: Tambah Route (src/routes/mitra.js)

**File:** `src/routes/mitra.js`

Tambahkan route handler untuk PUT /mitra/:id:
- Import fungsi `updateMitra` dari controller
- Gunakan middleware `authenticate` seperti pada endpoint POST
- Route definition: `router.put("/:id", authenticate, MitraController.updateMitra);`
- Pastikan route ini ditempatkan setelah route POST

**Struktur file setelah edit:**
```javascript
const express = require("express");
const MitraController = require("../controller/mitra");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, MitraController.createNewMitra);
router.put("/:id", authenticate, MitraController.updateMitra);

module.exports = router;
```

---

## Testing Instructions

### Test 1: Update tanpa Token (Expect 401)
```bash
curl -X PUT http://localhost:8000/mitra/1

# Expected Response: 401 Unauthorized
```

### Test 2: Update dengan Token Invalid (Expect 401)
```bash
curl -X PUT http://localhost:8000/mitra/1 \
  -H "Authorization: Bearer invalid_token"

# Expected Response: 401 Unauthorized
```

### Test 3: Update dengan ID yang tidak ada (Expect 404)
```bash
curl -X PUT http://localhost:8000/mitra/99999 \
  -H "Authorization: Bearer <valid_token>"

# Expected Response: 404 Not Found - "data not found"
```

### Test 4: Update dengan ID yang valid dan token valid (Expect 200)
```bash
curl -X PUT http://localhost:8000/mitra/1 \
  -H "Authorization: Bearer <valid_token>"

# Expected Response: 200 OK dengan data mitra yang telah diupdate
```

---

## Catatan Implementasi

1. **No Body Validation:** Endpoint ini tidak memerlukan validasi request body
2. **Database Field:** Gunakan field `updatedDate` di database untuk mencatat waktu update
3. **Error Handling:** Konsisten dengan error handling yang sudah ada di endpoint POST /mitra
4. **Authentication:** Wajib menggunakan middleware `authenticate` seperti pada POST endpoint
5. **Database Query:** Gunakan parameterized query untuk mencegah SQL injection (gunakan `?` placeholder)
6. **ID Parameter:** ID harus berupa integer dari URL parameter, dapat ditambahkan validasi sederhana

---

## Referensi File

File-file yang perlu diedit:
- `src/models/mitra.js` - Tambah fungsi `updateMitra`
- `src/controller/mitra.js` - Tambah fungsi `updateMitra`
- `src/routes/mitra.js` - Tambah route PUT

File yang tidak perlu diedit:
- `src/middleware/auth.js` - Sudah ada middleware `authenticate`
- `src/config/database.js` - Koneksi database sudah siap digunakan
