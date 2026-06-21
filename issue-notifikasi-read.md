# Issue: Implementasi API Mark as Read Notifikasi

## Deskripsi

Buat API endpoint untuk mengubah status `isRead` menjadi `1` (sudah dibaca) pada tabel `tbl_notifikasi`. Endpoint ini digunakan ketika user menekan/tap sebuah notifikasi di aplikasi mobile.

## Endpoint

- **URL**: `/api/mobile/notifications/{id}/read`
- **Method**: `PUT`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Path Params**: `id` (required) - ID notifikasi yang ingin ditandai sudah dibaca

## Flow / Alur Program

1. Request masuk ke route `/api/mobile/notifications/{id}/read`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk update status `isRead` menjadi 1
4. Model melakukan UPDATE query ke `tbl_notifikasi` berdasarkan id
5. Response dikembalikan ke client

## Request & Response

### Request:
```
PUT /api/mobile/notifications/8/read
Authorization: Bearer <token_mobile>
```

### Success (200 OK):
```json
{
  "success": "Mark as Read Success",
  "data": {
    "id": "8",
    "isRead": true
  }
}
```

### Error (404 / 500):
```json
{
  "error": "Id tidak ditemukan"
}
```

## Database

### Tabel:
- `tbl_notifikasi` - tabel notifikasi

### Kolom yang Diupdate:
- `isRead` — diubah dari 0 menjadi 1 (TINYINT/BOOLEAN)

### Query:
```sql
UPDATE tbl_notifikasi SET isRead = 1 WHERE id = ?;
```

Sebelum update, lakukan SELECT untuk memastikan data ada:
```sql
SELECT id, isRead FROM tbl_notifikasi WHERE id = ?;
```

## Struktur File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/notifikasi.js` | Tambahkan fungsi `markAsRead(id)` |
| 2 | **MODIFY** | `src/controller/notifikasi.js` | Tambahkan fungsi `markAsRead` |
| 3 | **MODIFY** | `src/routes/mobile.js` | Tambahkan route baru `PUT /notifications/:id/read` |

> **Catatan**: File model, controller, dan route sudah ada dari implementasi sebelumnya (get notifikasi). Kita hanya perlu **menambahkan fungsi baru** ke file yang sudah ada.

---

## Tahapan Implementasi

### Tahap 1: Tambahkan Fungsi di Model (`src/models/notifikasi.js`)

Buka file `src/models/notifikasi.js` dan tambahkan fungsi `markAsRead` **setelah fungsi `getNotifikasi`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const markAsRead = async (id) => {
  try {
    // 1. Cek apakah notifikasi dengan id tersebut ada
    const [existing] = await dbPool.execute(
      "SELECT id, isRead FROM tbl_notifikasi WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      throw new Error("Id tidak ditemukan");
    }

    // 2. Update isRead menjadi 1 (true)
    await dbPool.execute(
      "UPDATE tbl_notifikasi SET isRead = 1 WHERE id = ?",
      [id]
    );

    return {
      id: String(id),
      isRead: true,
    };
  } catch (error) {
    throw error;
  }
};
```

**Update `module.exports`** di bagian akhir file:

```javascript
module.exports = {
  getNotifikasi,
  markAsRead,
};
```

### Tahap 2: Tambahkan Fungsi di Controller (`src/controller/notifikasi.js`)

Buka file `src/controller/notifikasi.js` dan tambahkan fungsi `markAsRead` **setelah fungsi `getNotifikasi`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const markAsRead = async (req, res) => {
  const { id } = req.params;

  console.log("MARK AS READ REQUEST:", { id });

  try {
    const data = await NotifikasiModel.markAsRead(id);
    res.status(200).json({
      success: "Mark as Read Success",
      data: data,
    });
  } catch (error) {
    if (error.message === "Id tidak ditemukan") {
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
  getNotifikasi,
  markAsRead,
};
```

### Tahap 3: Tambahkan Route (`src/routes/mobile.js`)

Buka file `src/routes/mobile.js` dan tambahkan route baru **setelah route `getNotifikasi`** dan **sebelum `module.exports`**.

```javascript
// PUT - Mark as Read Notifikasi
router.put("/notifications/:id/read", authenticateMobile, NotifikasiController.markAsRead);
```

> **Catatan**: Route ini akan otomatis terdaftar dengan prefix `/api/mobile` yang sudah ada di `index.js`.

### Tahap 4: Testing

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

2. Panggil endpoint mark as read:
```powershell
$response = Invoke-RestMethod -Uri 'http://localhost:7001/api/mobile/notifications/8/read' -Method Put -Headers @{Authorization="Bearer $token"}
$response | ConvertTo-Json
```

3. Jika id tidak ditemukan:
```json
{
  "error": "Id tidak ditemukan"
}
```

**Test Case:**

| No | Skenario | Expected Response |
|----|----------|-------------------|
| 1 | Token valid, id ada | 200 - `{ success: "Mark as Read Success", data: { id: "8", isRead: true } }` |
| 2 | Token valid, id tidak ada | 404 - `{ error: "Id tidak ditemukan" }` |
| 3 | Token tidak valid / expired | 401 - `{ error: "Token tidak valid" }` |

---

## Checklist Implementasi

- [ ] Tahap 1: Model (`src/models/notifikasi.js`)
  - [ ] Fungsi `markAsRead(id)` **setelah** `getNotifikasi`
  - [ ] SELECT untuk cek data ada
  - [ ] UPDATE `isRead = 1`
  - [ ] Return `{ id: String(id), isRead: true }`
  - [ ] Error `"Id tidak ditemukan"` jika data tidak ada
  - [ ] Tambahkan `markAsRead` di `module.exports`

- [ ] Tahap 2: Controller (`src/controller/notifikasi.js`)
  - [ ] Fungsi `markAsRead` **setelah** `getNotifikasi`
  - [ ] Ambil `id` dari `req.params`
  - [ ] Response format `{ success, data }`
  - [ ] Error handling untuk id tidak ditemukan
  - [ ] Tambahkan `markAsRead` di `module.exports`

- [ ] Tahap 3: Route (`src/routes/mobile.js`)
  - [ ] Route `PUT /notifications/:id/read` dengan `authenticateMobile`
  - [ ] Tambahkan **setelah** route `getNotifikasi`

- [ ] Tahap 4: Testing
  - [ ] Test Case 1: Id ditemukan
  - [ ] Test Case 2: Id tidak ditemukan
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Jangan buat file baru.** Semua perubahan hanya pada file yang sudah ada: `src/models/notifikasi.js`, `src/controller/notifikasi.js`, dan `src/routes/mobile.js`.
2. **Method PUT** — gunakan `router.put()`, bukan `router.post()` atau `router.get()`.
3. **Path parameter** menggunakan `:id` — akses dengan `req.params.id`.
4. **Validasi data** — lakukan SELECT terlebih dahulu sebelum UPDATE untuk memastikan data ada.
5. **Error message** — gunakan `"Id tidak ditemukan"` (tanpa "data") sesuai response yang diminta.
6. **Response `data.id`** — gunakan `String(id)` untuk konsistensi format string.
7. **Response `data.isRead`** — return `true` (boolean), bukan `1` (number).
8. **Middleware** yang digunakan adalah `authenticateMobile` (bukan `authenticate`).
9. **Ikuti pola yang sudah ada** dari fungsi `getNotifikasi` — struktur kode, validasi, dan response harus konsisten.
10. **Gunakan `console.log`** untuk debugging.