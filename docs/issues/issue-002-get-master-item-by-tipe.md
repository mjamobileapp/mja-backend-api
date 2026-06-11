# Issue: GET Master Item by TipeItem

## Deskripsi
Buat API endpoint untuk mengambil data Master Item berdasarkan `tipeItem` (`stok` atau `non_stok`).

## Spesifikasi

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/backoffice/item/tipe/stok` | Bearer Token (Required) |

Parameter `tipeItem` bisa `stok` atau `non_stok` (di URL path, bukan query).

### Response Sukses (200)

```json
{
  "message": "Get by Tipe Item Success",
  "data": [
    {
      "id": 1,
      "namaItem": "Hamdan",
      "tipeItem": "stok",
      "statusAktif": 1,
      "createdDate": "2026-06-05T07:49:40.000Z",
      "createdBy": "system",
      "updatedBy": "hamdanfresh@gmail.com",
      "updatedDate": "2026-06-06T02:12:04.000Z"
    }
  ]
}
```

### Response Error (404)

```json
{
  "error": "data not found"
}
```

### Response Error Lain (500)

```json
{
  "message": "Server Error",
  "serverMessage": "..."
}
```

---

## Tahapan Implementasi

### Tahap 1: Pahami Struktur Kode yang Ada

Sebelum coding, pelajari struktur file berikut (sudah ada di repository):

1. **`src/models/masterItem.js`**
   - Lihat fungsi `getMasterItemById` sebagai referensi cara query SELECT dengan parameter.
   - Lihat fungsi `getAllMasterItem` sebagai referensi cara query SELECT dengan filter.

2. **`src/controller/masterItem.js`**
   - Lihat fungsi `getMasterItemById` sebagai referensi pola controller (try-catch, response format).
   - Lihat bagaimana error `"data not found"` di-handle (return 404).

3. **`src/routes/masterItem.js`**
   - Lihat bagaimana route GET dengan parameter id didaftarkan.
   - Route baru nanti akan mirip: `router.get("/tipe/:tipeItem", authenticate, ...)`.

4. **`src/index.js`**
   - Cari baris: `app.use("/api/backoffice/item", masterItemRoutes);`
   - Route baru akan otomatis ter-register karena path dimulai dari `/api/backoffice/item`.

### Tahap 2: Tambahkan Fungsi di Model (`src/models/masterItem.js`)

Buka file `src/models/masterItem.js`, tambahkan fungsi baru SETELAH fungsi `getMasterItemById` (sebelum `deleteMasterItem`) dengan nama `getMasterItemByTipe`.

```javascript
const getMasterItemByTipe = async (tipeItem) => {
  try {
    // Query SELECT dengan filter tipeItem dan hanya data aktif
    const [items] = await dbPool.execute(
      "SELECT * FROM tbl_master_item_expense WHERE tipeItem = ? AND statusAktif = 1",
      [tipeItem]
    );

    // Jika tidak ada data, throw error "data not found"
    if (items.length === 0) throw new Error("data not found");

    return items;
  } catch (error) {
    throw error;
  }
};
```

**Penjelasan Kode:**
- `dbPool.execute` menjalankan query SQL dengan parameter `?` untuk mencegah SQL injection.
- Filter `statusAktif = 1` memastikan hanya data aktif yang dikembalikan.
- Jika tidak ada data, throw `Error("data not found")` yang akan ditangkap oleh controller.
- Gunakan try-catch agar error bisa dilempar ke controller.

**Jangan lupa tambahkan `getMasterItemByTipe` ke module.exports di bagian paling bawah file.**

Cari `module.exports = {` lalu tambahkan:

```javascript
  getMasterItemByTipe,
```

### Tahap 3: Tambahkan Fungsi di Controller (`src/controller/masterItem.js`)

Buka file `src/controller/masterItem.js`, tambahkan fungsi BARU SETELAH `getMasterItemById` (sebelum `updateMasterItem`) dengan nama `getMasterItemByTipe`.

```javascript
const getMasterItemByTipe = async (req, res) => {
  const { tipeItem } = req.params;  // Ambil parameter dari URL path

  try {
    const data = await MasterItemModel.getMasterItemByTipe(tipeItem);

    res.status(200).json({
      message: "Get by Tipe Item Success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ 
      message: "Server Error", 
      serverMessage: error.message 
    });
  }
};
```

**Penjelasan Kode:**
- `req.params.tipeItem` mengambil nilai dari URL, misal `/api/backoffice/item/tipe/stok` maka `tipeItem = "stok"`.
- Jika error `"data not found"` dari model, return 404.
- Error lain return 500.

**Jangan lupa tambahkan `getMasterItemByTipe` ke module.exports di bagian paling bawah file.**

### Tahap 4: Tambahkan Route Baru (`src/routes/masterItem.js`)

Buka file `src/routes/masterItem.js`, tambahkan route BARU SETELAH route `getMasterItemById`:

```javascript
router.get("/tipe/:tipeItem", authenticate, MasterItemController.getMasterItemByTipe);
```

**Penjelasan Kode:**
- Path `/tipe/:tipeItem` akan menghasilkan URL: `/api/backoffice/item/tipe/stok`
- `:tipeItem` adalah parameter dinamis yang bisa diakses via `req.params.tipeItem`
- `authenticate` middleware memvalidasi token Bearer
- `MasterItemController.getMasterItemByTipe` adalah controller yang baru dibuat

### Tahap 5: Testing

Jalankan server:
```bash
npm start
```

Test dengan curl atau Postman:

**Test Kasus 1: Sukses (tipe stok ada data)**
```bash
curl -X GET "http://localhost:7001/api/backoffice/item/tipe/stok" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Test Kasus 2: Sukses (tipe non_stok ada data)**
```bash
curl -X GET "http://localhost:7001/api/backoffice/item/tipe/non_stok" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Test Kasus 3: Data tidak ditemukan**
```bash
curl -X GET "http://localhost:7001/api/backoffice/item/tipe/tidakada" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Test Kasus 4: Tanpa token**
```bash
curl -X GET "http://localhost:7001/api/backoffice/item/tipe/stok"
```

### Tahap 6: Commit & Push

```bash
git add .
git commit -m "feat: add getMasterItemByTipe API endpoint"
git push origin dev
```

---

## Checklist Implementasi

- [ ] Model: Fungsi `getMasterItemByTipe` sudah ditambahkan di `src/models/masterItem.js`
- [ ] Model: Fungsi baru sudah ditambahkan ke `module.exports`
- [ ] Controller: Fungsi `getMasterItemByTipe` sudah ditambahkan di `src/controller/masterItem.js`
- [ ] Controller: Fungsi baru sudah ditambahkan ke `module.exports`
- [ ] Route: Route baru sudah ditambahkan di `src/routes/masterItem.js`
- [ ] Testing: Test kasus 1-4 berhasil
- [ ] Commit & Push ke branch dev

---

## Catatan untuk Developer

1. Jangan mengubah kode yang sudah ada. Hanya MENAMBAH fungsi baru.
2. Ikuti struktur dan gaya penulisan kode yang sudah ada (camelCase, try-catch, error handling).
3. Nama tabel adalah `tbl_master_item_expense`.
4. Jika bingung, lihat fungsi `getMasterItemById` sebagai referensi karena pola nya mirip.
5. Middleware `authenticate` (bukan `authenticateMobile`) digunakan untuk endpoint backoffice.
6. Path route adalah `/tipe/:tipeItem` — jadi URL lengkapnya: `/api/backoffice/item/tipe/stok`.
