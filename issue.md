# Issue: Ubah API Update Mesin (Sinkronisasi Dual Relay Washer & Dryer)

## Deskripsi
Ubah fungsi API `updateMesin` pada modul Mesin agar mendukung perubahan data 2 mesin sekaligus (Washer dan Dryer) yang berada dalam satu modul ESP. Pembaruan ini akan menggunakan **Database Transaction** untuk melakukan operasi sinkronisasi (Upsert / Delete) berdasarkan status *washer* dan *dryer* yang dikirim dari Frontend (nilai `1` atau `0`).

## Endpoint
- **URL**: `/api/backoffice/mesin/:espId` (Param diubah dari `id` ke `espId` karena update dilakukan per-modul IoT, bukan per-baris tabel)
- **Method**: `PUT`
- **Auth**: Bearer Token (menggunakan middleware `authenticate`)

## Request Body
```json
{
  "idMitra": 9,
  "cabangId": 3,
  "espId": "A5:CF:12:3A:5B:7C",
  "washer": 1, 
  "dryer": 1
}
```

**Penjelasan field:**
- `idMitra`, `cabangId`, `espId` (required)
- `washer` & `dryer` (required): Bernilai `1` (Aktif/Ada) atau `0` (Tidak Aktif/Dihapus)

## Response
### Success (200 OK):
```json
{
  "message": "UPDATE Mesin success",
  "data": {
    "idMitra": 9,
    "cabangId": 4,
    "espId": "A10:CF:12:3A:5B:7C",
    "washer": {
      "id": 8,
      "namaMesin": "Mesin Laundry 2",
      "status": "Ready"
    },
    "dryer": {
      "id": 9,
      "namaMesin": "Mesin Laundry 2",
      "status": "Ready"
    }
  }
}
```
*(Catatan: Field `washer` atau `dryer` bernilai `null` jika dikirim sebagai `0` / dihapus).*

### Error (400 / 404 / 500):
```json
{
  "error": "Modul mesin tidak ditemukan di sistem."
}
```

---

## Tahapan Implementasi

### Tahap 1: Ubah File Model (`src/models/mesin.js`)

Ubah fungsi `updateMesin` untuk menggunakan **Database Transaction** (`connection.beginTransaction()`).

**Pola dan Catatan Kode:**
1. Gunakan `const connection = await dbPool.getConnection();`.
2. Lakukan validasi awal: cek apakah `espId` dan `idMitra` ada di sistem. Jika tidak, throw error `"Modul mesin tidak ditemukan di sistem."`.
3. Ambil `namaMesin` aslinya agar namanya tidak berubah saat diupdate.
4. Buat fungsi sinkronisasi internal (cek apakah WASHER / DRYER di-set ke `1` atau `0`).
5. Jika `1`:
   - Jika data sudah ada di DB -> Lakukan **UPDATE** (`cabangId`, `updatedBy`, `updatedDate` = CURRENT_TIMESTAMP).
   - Jika data belum ada di DB -> Lakukan **INSERT** data baru (dengan `namaMesin` dari yang sudah ada di database).
6. Jika `0`:
   - Lakukan **DELETE** dari DB.
7. Jika transaksi sukses, `await connection.commit()`. Jika error, `await connection.rollback()`.
8. Ambil data terbaru (id dari washer dan dryer yang tersisa) dan petakan menjadi response `data` (seperti contoh).

**Referensi Kode di Model:**
```javascript
const updateMesin = async (espIdParam, body, updatedBy) => {
  const { idMitra, cabangId, espId, washer, dryer } = body;
  
  const connection = await dbPool.getConnection();
  await connection.beginTransaction();
  
  try {
    // 1. Dapatkan namaMesin bawaan dari database
    const [existingData] = await connection.execute(
      `SELECT namaMesin FROM tbl_mesin WHERE espId = ? AND idMitra = ? LIMIT 1`,
      [espIdParam, idMitra]
    );

    if (existingData.length === 0) {
      throw new Error("Modul mesin tidak ditemukan di sistem.");
    }
    
    const namaMesinAsli = existingData[0].namaMesin;

    // 2. Fungsi Internal untuk Sinkronisasi (Upsert / Delete)
    const syncMesin = async (jenis, isAktif, channelPin) => {
      let currentId = null;

      if (isAktif === 1) {
        const [cekMesin] = await connection.execute(
          `SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = ? AND idMitra = ?`,
          [espId, jenis, idMitra]
        );

        if (cekMesin.length > 0) {
          // UPDATE
          currentId = cekMesin[0].id;
          await connection.execute(
            `UPDATE tbl_mesin SET cabangId = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE id = ?`,
            [cabangId, updatedBy, currentId]
          );
        } else {
          // INSERT
          const [result] = await connection.execute(
            `INSERT INTO tbl_mesin (idMitra, cabangId, espId, channelRelay, namaMesin, tipeMesin, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [idMitra, cabangId, espId, channelPin, namaMesinAsli, jenis, updatedBy]
          );
          currentId = result.insertId;
        }
      } else {
        // DELETE
        await connection.execute(
          `DELETE FROM tbl_mesin WHERE espId = ? AND tipeMesin = ? AND idMitra = ?`,
          [espId, jenis, idMitra]
        );
      }
      return currentId;
    };

    // 3. Eksekusi Sinkronisasi
    const idWasher = await syncMesin('WASHER', washer, 5);
    const idDryer = await syncMesin('DRYER', dryer, 4);

    await connection.commit();

    return {
      idMitra,
      cabangId,
      espId,
      washer: washer === 1 ? { id: idWasher, namaMesin: namaMesinAsli, status: "Ready" } : null,
      dryer: dryer === 1 ? { id: idDryer, namaMesin: namaMesinAsli, status: "Ready" } : null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
```

### Tahap 2: Ubah File Controller (`src/controller/mesin.js`)

Ubah fungsi `updateMesin`.

1. Ambil `espId` dari parameter: `const { id: espId } = req.params;` (karena route kita `/:id`, kita treat `id` sebagai `espId`).
2. Validasi fields required: `['idMitra', 'cabangId', 'espId']`.
3. Validasi nilai `washer` dan `dryer` (harus `0` atau `1`).
4. Jika `washer === 0 && dryer === 0`, validasi keamanan (atau perbolehkan hapus dua-duanya, namun berikan feedback yang sesuai).
5. Panggil `MesinModel.updateMesin(espId, body, req.user.username || req.user.id)`.
6. Tangkap spesifik error `"Modul mesin tidak ditemukan di sistem."` (return 404).

### Tahap 3: Ubah File Route (`src/routes/mesin.js`)

Route `PUT /:id` tetap ada, namun secara logis parameter `id` tersebut sekarang berfungsi sebagai `espId`. Jika dirasa membingungkan, dapat diubah menjadi `router.put("/esp/:espId", ...)`. Namun, untuk konsistensi, bisa dipertahankan `/:id` dan ditangani di Controller.

### Tahap 4: Testing

**Cara testing menggunakan Postman/curl:**

1. Coba update status salah satu mesin menjadi tidak aktif:
```json
PUT http://localhost:7001/api/backoffice/mesin/A4:CF:12:3A:5B:7C
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A4:CF:12:3A:5B:7C",
  "washer": 1,
  "dryer": 0
}
```
2. Coba tambahkan ulang mesin yang dihapus (dryer):
```json
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A4:CF:12:3A:5B:7C",
  "washer": 1,
  "dryer": 1
}
```
Pastikan `dryer` ter-insert dan `washer` ter-update.

---

## Ringkasan File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/mesin.js` | Ubah fungsi `updateMesin` (Gunakan Database Transaction) |
| 2 | **MODIFY** | `src/controller/mesin.js` | Sesuaikan parameter dan validasi di fungsi `updateMesin` |

---

## Checklist Implementasi

- [ ] Tahap 1: `src/models/mesin.js` - Ubah `updateMesin` menggunakan transaksi, query `Upsert/Delete`
- [ ] Tahap 2: `src/controller/mesin.js` - Tambahkan validasi `washer`/`dryer` (0/1), teruskan `updatedBy`
- [ ] Tahap 3: Testing POST/PUT untuk memastikan Sinkronisasi ESP berhasil
- [ ] Validasi nilai `idMitra` dan `espId` (Pastikan mesin tidak bisa diedit jika `idMitra` salah)
- [ ] Pastikan ketika `washer` dan `dryer` dikirim `0`, kedua record mesin terhapus dari database

---

## Catatan Tambahan untuk Developer / AI Model Murah

1. **Transaction Wajib**: Karena operasi ini melibatkan potensi `UPDATE`, `INSERT`, dan `DELETE` sekaligus pada dua record mesin, jika salah satu gagal, semuanya harus di-*rollback*.
2. **Koneksi Database**: Gunakan `const connection = await dbPool.getConnection()` untuk mendapatkan koneksi single-session yang bisa menjalankan `.beginTransaction()`. Jangan lupa `connection.release()` di blok `finally`.
3. **tipeMesin**: Di kolom tabel bernama `tipeMesin` dengan nilai ENUM `WASHER` dan `DRYER`.
4. **updatedBy & updatedDate**: Pastikan kolom ini terisi otomatis saat `UPDATE`. Jika `INSERT`, gunakan kolom `createdBy`.