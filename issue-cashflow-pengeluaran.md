# Issue: Implementasi API Get Data Pengeluaran Per Cabang (Cashflow Module)

## Deskripsi

Buat API endpoint baru untuk menampilkan data pengeluaran per cabang yang akan digunakan oleh aplikasi owner/mobile. Data diambil dari tabel `tbl_pengeluaran` dan dikelompokkan per tanggal, kemudian di dalam setiap tanggal terdapat rincian transaksi pengeluaran.

## Endpoint

- **URL**: `/api/owner/cashflow/pengeluaran?cabangId=:cabangId`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params**: `cabangId` (required) - ID cabang yang ingin dilihat pengeluarannya

## Flow / Alur Program

1. Request masuk ke route `/api/owner/cashflow/pengeluaran`
2. Middleware `authenticateMobile` memverifikasi token dan menambahkan `req.user`
3. Controller memanggil model untuk mengambil data dari database
4. Model melakukan query ke `tbl_pengeluaran` dengan JOIN ke `tbl_users_mobile` dan `tbl_master_item_expense`
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
  "success": "Get Data Pengeluaran Success",
  "data": [
    {
      "tanggalTampilan": "2026-06-01",
      "totalPengeluaranHariIni": 150000,
      "rincian": [
        {
          "idPengeluaran": 105,
          "waktuLengkap": "2026-06-01T11:00:00.000Z",
          "deskripsi": "Gas (x2)",
          "namaKasir": "Rangga",
          "nominalRupiah": "Rp 50.000",
          "nominalAngka": 50000
        },
        {
          "idPengeluaran": 104,
          "waktuLengkap": "2026-06-01T11:00:00.000Z",
          "deskripsi": "Gas (x2)",
          "namaKasir": "Rangga",
          "nominalRupiah": "Rp 50.000",
          "nominalAngka": 50000
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
  p.id AS idPengeluaran,
  DATE(p.waktuPengeluaran) AS tanggalGroup,
  p.waktuPengeluaran AS waktuDetail,
  -- Menggabungkan nama item dan jumlahnya menjadi format: "Gas (x2)"
  CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')') AS deskripsi,
  p.nominal,
  u.namaLengkap AS namaKasir
FROM tbl_pengeluaran p
LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
LEFT JOIN tbl_master_item_expense i ON p.itemId = i.id
WHERE p.cabangId = ? 
  AND p.idMitra = ? 
ORDER BY p.waktuPengeluaran DESC;
```

### Tabel yang Digunakan:
- `tbl_pengeluaran` - tabel utama berisi data pengeluaran
- `tbl_users_mobile` - tabel untuk mendapatkan nama kasir
- `tbl_master_item_expense` - tabel untuk mendapatkan nama item pengeluaran

### Kolom Penting di `tbl_pengeluaran`:
- `id` - ID pengeluaran (INT, PK)
- `waktuPengeluaran` - Waktu transaksi (DATETIME)
- `nominal` - Nominal pengeluaran (INT/DECIMAL)
- `jumlahBarang` - Jumlah barang yang dibeli (INT)
- `cabangId` - ID cabang (FK)
- `idMitra` - ID mitra (FK)
- `idUserMobile` - ID kasir yang menangani (FK ke tbl_users_mobile)
- `itemId` - ID item pengeluaran (FK ke tbl_master_item_expense)

### Kolom Penting di `tbl_master_item_expense`:
- `id` - ID item (INT, PK)
- `namaItem` - Nama item pengeluaran (VARCHAR)

### Kolom Penting di `tbl_users_mobile`:
- `id` - ID user mobile (INT, PK)
- `namaLengkap` - Nama lengkap kasir (VARCHAR)

## Struktur File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/cashflow.js` | Tambahkan fungsi `getPengeluaran` dengan query dan grouping |
| 2 | **MODIFY** | `src/controller/cashflow.js` | Tambahkan fungsi `getPengeluaran` |
| 3 | **MODIFY** | `src/routes/cashflow.js` | Tambahkan route baru `GET /cashflow/pengeluaran` |

> **Catatan**: File-file ini sudah ada karena sebelumnya sudah dibuat `getPendapatan`. Jadi kita hanya perlu menambahkan fungsi baru ke file yang sudah ada, TIDAK perlu membuat file baru.

---

## Tahapan Implementasi

### Tahap 1: Tambahkan Fungsi di Model (`src/models/cashflow.js`)

Buka file `src/models/cashflow.js` dan tambahkan fungsi `getPengeluaran` **setelah fungsi `getPendapatan`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const getPengeluaran = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        p.id AS idPengeluaran,
        DATE(p.waktuPengeluaran) AS tanggalGroup,
        p.waktuPengeluaran AS waktuDetail,
        CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')') AS deskripsi,
        p.nominal,
        u.namaLengkap AS namaKasir
      FROM tbl_pengeluaran p
      LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
      LEFT JOIN tbl_master_item_expense i ON p.itemId = i.id
      WHERE p.cabangId = ? 
        AND p.idMitra = ? 
      ORDER BY p.waktuPengeluaran DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // 1. Siapkan wadah untuk Grouping per tanggal
    const groupedData = {};

    // 2. Looping dan kelompokkan berdasarkan tanggalGroup
    rows.forEach((row) => {
      const tanggal = row.tanggalGroup; // Format: '2026-06-01'

      // Jika tanggal ini belum ada di wadah, buat grup baru
      if (!groupedData[tanggal]) {
        groupedData[tanggal] = {
          tanggalTampilan: tanggal,
          totalPengeluaranHariIni: 0,
          rincian: [],
        };
      }

      // Tambahkan nominal ke total harian
      groupedData[tanggal].totalPengeluaranHariIni += row.nominal;

      // Format nominal ke rupiah (contoh: "Rp 50.000")
      const nominalRupiah = `Rp ${row.nominal.toLocaleString('id-ID')}`;

      // Tambahkan rincian transaksi
      groupedData[tanggal].rincian.push({
        idPengeluaran: row.idPengeluaran,
        waktuLengkap: row.waktuDetail,
        deskripsi: row.deskripsi,
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
```

**Update `module.exports`** di bagian akhir file untuk menambahkan `getPengeluaran`:

```javascript
module.exports = {
  getCashflow,
  getPendapatan,
  getPengeluaran,
};
```

### Tahap 2: Tambahkan Fungsi di Controller (`src/controller/cashflow.js`)

Buka file `src/controller/cashflow.js` dan tambahkan fungsi `getPengeluaran` **setelah fungsi `getPendapatan`** dan **sebelum `module.exports`**.

**Kode yang ditambahkan:**

```javascript
const getPengeluaran = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET PENGELUARAN REQUEST:", { cabangId, idMitra });

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
    const data = await CashflowModel.getPengeluaran(cabangId, idMitra);
    res.status(200).json({
      success: "Get Data Pengeluaran Success",
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
  getCashflow,
  getPendapatan,
  getPengeluaran,
};
```

### Tahap 3: Tambahkan Route (`src/routes/cashflow.js`)

Buka file `src/routes/cashflow.js` dan tambahkan route baru **setelah route `getPendapatan`** dan **sebelum `module.exports`**.

```javascript
// GET - Get Pengeluaran per Cabang
router.get("/cashflow/pengeluaran", authenticateMobile, CashflowController.getPengeluaran);
```

### Tahap 4: Testing

**Cara testing menggunakan PowerShell atau Postman:**

1. Login Mobile terlebih dahulu untuk mendapatkan token:
```
POST http://localhost:7001/api/mobile/login
Content-Type: application/json

{
  "username": "rangga",
  "password": "password123"
}
```

2. Panggil endpoint pengeluaran:
```
GET http://localhost:7001/api/owner/cashflow/pengeluaran?cabangId=3
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

- [ ] Tahap 1: Model (`src/models/cashflow.js`)
  - [ ] Fungsi `getPengeluaran(cabangId, idMitra)`
  - [ ] Query dengan JOIN ke `tbl_users_mobile` dan `tbl_master_item_expense`
  - [ ] Format deskripsi `CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')')`
  - [ ] Filter `cabangId` dan `idMitra`
  - [ ] Grouping per tanggal dengan JavaScript
  - [ ] Format nominal ke Rupiah (`Rp 50.000`)
  - [ ] Sort DESC berdasarkan tanggal
  - [ ] Tambahkan `getPengeluaran` di `module.exports`
- [ ] Tahap 2: Controller (`src/controller/cashflow.js`)
  - [ ] Validasi `cabangId` dan `idMitra`
  - [ ] Response format `{ success, data }`
  - [ ] Error handling untuk data tidak ditemukan
  - [ ] Tambahkan `getPengeluaran` di `module.exports`
- [ ] Tahap 3: Route (`src/routes/cashflow.js`)
  - [ ] Route `GET /cashflow/pengeluaran`
  - [ ] Middleware `authenticateMobile`
- [ ] Tahap 4: Testing
  - [ ] Test Case 1: Data ditemukan
  - [ ] Test Case 2: Data tidak ditemukan
  - [ ] Test Case 3: Token tidak valid

---

## Catatan Penting untuk Developer

1. **Ikuti pola yang sudah ada** dari fungsi `getPendapatan` yang sudah dibuat sebelumnya. Struktur kode, validasi, dan response harus konsisten.
2. **Jangan buat file baru.** Semua perubahan hanya pada file yang sudah ada: `src/models/cashflow.js`, `src/controller/cashflow.js`, dan `src/routes/cashflow.js`.
3. **Gunakan `console.log`** untuk debugging seperti yang dilakukan di fungsi `getPendapatan`.
4. **Deskripsi** dihasilkan dari query `CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')')`. Contoh output: `"Gas (x2)"`.
5. **Grouping** dilakukan di JavaScript, bukan SQL GROUP BY.
6. **Format Rupiah** menggunakan `toLocaleString('id-ID')` JavaScript.
7. **Middleware** yang digunakan adalah `authenticateMobile` (bukan `authenticate`).
8. **Perhatikan spasi dan koma** dalam query `CONCAT`. Formatnya: `CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')')` - ada spasi sebelum `(x`.
9. **Cek nama tabel** `tbl_master_item_expense` — pastikan tabel ini ada di database. Jika tidak ada, sesuaikan dengan nama tabel yang sebenarnya.