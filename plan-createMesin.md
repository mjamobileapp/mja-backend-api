# Plan: Ubah API Create New Mesin (Split Master-Detail)

## Deskripsi
Melakukan perubahan pada API `createNewMesin` di modul Mesin untuk mendukung skema database baru yang telah dipecah menjadi 2 tabel: `tbl_mesin_master` (1 baris per modul ESP) dan `tbl_mesin_detail` (2 baris per modul ESP: 1 untuk Washer, 1 untuk Dryer).

## Latar Belakang Perubahan Schema

Schema lama `tbl_mesin` (single table) dipecah menjadi 2 tabel:

### Tabel `tbl_mesin_master` (1 baris per ESP)
```sql
CREATE TABLE `tbl_mesin_master` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `idMitra` INT NOT NULL,
  `cabangId` INT NOT NULL,
  `espId` VARCHAR(50) NOT NULL,
  `namaGroupMesin` VARCHAR(50) NOT NULL,
  `createdBy` INT DEFAULT NULL,
  `createdDate` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedBy` INT DEFAULT NULL,
  `updatedDate` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_espid_cabang` (`espId`, `cabangId`),
  FOREIGN KEY (`idMitra`) REFERENCES `tbl_mitra`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cabangId`) REFERENCES `tbl_cabang`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Tabel `tbl_mesin_detail` (2 baris per ESP)
```sql
CREATE TABLE `tbl_mesin_detail` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `idMesinMaster` INT NOT NULL,
  `jenisMesin` ENUM('WASHER', 'DRYER') NOT NULL,
  `channelRelay` INT NOT NULL,
  `status` ENUM('READY', 'IN_USE', 'OFFLINE', 'ERROR') DEFAULT 'READY',
  `waktuSelesai` DATETIME DEFAULT NULL,
  `waktuPingTerakhir` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_master_jenis` (`idMesinMaster`, `jenisMesin`),
  FOREIGN KEY (`idMesinMaster`) REFERENCES `tbl_mesin_master`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Endpoint
- **URL**: `/api/backoffice/mesin`
- **Method**: `POST`
- **Auth**: Bearer Token (menggunakan middleware `authenticate`)
- **Body**: JSON

## Request Body
```json
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A10:CF:12:3A:5B:7C",
  "namaGroupMesin": "Mesin Laundry 1",
  "washer": 1,
  "dryer": 1
}
```

**Penjelasan field:**
- `idMitra` (required) - ID Mitra
- `cabangId` (required) - ID Cabang
- `espId` (required) - MAC Address / ID Unik dari Modul ESP
- `namaGroupMesin` (required) - Nama grup mesin (contoh: "Mesin Laundry 1")
- `washer` (required) - `1` jika ada mesin cuci, `0` jika tidak
- `dryer` (required) - `1` jika ada mesin pengering, `0` jika tidak

## Response
### Success (201 Created):
```json
{
  "message": "CREATE new Mesin success",
  "data": {
    "idMitra": 9,
    "cabangId": 4,
    "espId": "A10:CF:12:3A:5B:7C",
    "namaGroupMesin": "Mesin Laundry 1",
    "washer": {
      "id": 8,
      "status": "Ready"
    },
    "dryer": {
      "id": 9,
      "status": "Ready"
    }
  }
}
```
*(Catatan: Jika `washer: 0` maka `washer: null`. Jika `dryer: 0` maka `dryer: null`)*

### Error (400 Bad Request):
```json
{
  "error": "idMitra tidak ditemukan"
}
```
atau jika espId + cabangId sudah terdaftar:
```json
{
  "error": "Modul ESP ini sudah terdaftar di cabang yang sama"
}
```

---

## Tahapan Implementasi

### Tahap 1: Ubah File Model (`src/models/mesin.js`)

Ubah fungsi `createNewMesin` untuk melakukan INSERT ke 2 tabel secara berurutan (tidak perlu transaction karena operasi sederhana).

**Langkah-langkah:**

1. **Ambil parameter dari body:**
```javascript
const { idMitra, cabangId, espId, namaGroupMesin, washer, dryer } = body;
```

2. **Validasi Mitra** (sama seperti sebelumnya):
```javascript
const [existingMitra] = await dbPool.execute(
  "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
  [idMitra]
);
if (existingMitra.length === 0) {
  throw new Error("Mitra tidak ditemukan atau tidak aktif");
}
```

3. **Validasi Cabang** (sama seperti sebelumnya):
```javascript
const [existingCabang] = await dbPool.execute(
  "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
  [cabangId, idMitra]
);
if (existingCabang.length === 0) {
  throw new Error("Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra");
}
```

4. **Validasi duplikasi espId + cabangId** (BARU - untuk tabel master):
```javascript
const [existingMaster] = await dbPool.execute(
  "SELECT id FROM tbl_mesin_master WHERE espId = ? AND cabangId = ?",
  [espId, cabangId]
);
if (existingMaster.length > 0) {
  throw new Error("Modul ESP ini sudah terdaftar di cabang yang sama");
}
```

5. **Validasi minimal washer atau dryer:**
```javascript
if (washer !== 1 && dryer !== 1) {
  throw new Error("Minimal salah satu washer atau dryer harus bernilai 1");
}
```

6. **INSERT ke tbl_mesin_master:**
```javascript
const [masterResult] = await dbPool.execute(
  `INSERT INTO tbl_mesin_master (idMitra, cabangId, espId, namaGroupMesin, createdBy) 
   VALUES (?, ?, ?, ?, ?)`,
  [idMitra, cabangId, espId, namaGroupMesin, createdBy]
);
const idMesinMaster = masterResult.insertId;
```

7. **INSERT ke tbl_mesin_detail** (jika washer = 1):
```javascript
let washerResult = null;
if (washer === 1) {
  const [detailWasher] = await dbPool.execute(
    `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
     VALUES (?, 'WASHER', 5, 'READY')`,
    [idMesinMaster]
  );
  washerResult = { id: detailWasher.insertId, status: "Ready" };
}
```

8. **INSERT ke tbl_mesin_detail** (jika dryer = 1):
```javascript
let dryerResult = null;
if (dryer === 1) {
  const [detailDryer] = await dbPool.execute(
    `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
     VALUES (?, 'DRYER', 4, 'READY')`,
    [idMesinMaster]
  );
  dryerResult = { id: detailDryer.insertId, status: "Ready" };
}
```

9. **Return response:**
```javascript
return {
  idMitra,
  cabangId,
  espId,
  namaGroupMesin,
  washer: washerResult,
  dryer: dryerResult,
};
```

**Fungsi lengkap:**
```javascript
const createNewMesin = async (body, createdBy = null) => {
  try {
    const { idMitra, cabangId, espId, namaGroupMesin, washer, dryer } = body;

    // 1. Validasi Mitra
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Validasi Cabang
    const [existingCabang] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
      [cabangId, idMitra]
    );
    if (existingCabang.length === 0) {
      throw new Error("Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra");
    }

    // 3. Validasi duplikasi espId + cabangId
    const [existingMaster] = await dbPool.execute(
      "SELECT id FROM tbl_mesin_master WHERE espId = ? AND cabangId = ?",
      [espId, cabangId]
    );
    if (existingMaster.length > 0) {
      throw new Error("Modul ESP ini sudah terdaftar di cabang yang sama");
    }

    // 4. Validasi minimal washer atau dryer
    if (washer !== 1 && dryer !== 1) {
      throw new Error("Minimal salah satu washer atau dryer harus bernilai 1");
    }

    // 5. INSERT ke tbl_mesin_master
    const [masterResult] = await dbPool.execute(
      `INSERT INTO tbl_mesin_master (idMitra, cabangId, espId, namaGroupMesin, createdBy) 
       VALUES (?, ?, ?, ?, ?)`,
      [idMitra, cabangId, espId, namaGroupMesin, createdBy]
    );
    const idMesinMaster = masterResult.insertId;

    // 6. Insert Washer jika ada
    let washerResult = null;
    if (washer === 1) {
      const [detailWasher] = await dbPool.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
         VALUES (?, 'WASHER', 5, 'READY')`,
        [idMesinMaster]
      );
      washerResult = { id: detailWasher.insertId, status: "Ready" };
    }

    // 7. Insert Dryer jika ada
    let dryerResult = null;
    if (dryer === 1) {
      const [detailDryer] = await dbPool.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
         VALUES (?, 'DRYER', 4, 'READY')`,
        [idMesinMaster]
      );
      dryerResult = { id: detailDryer.insertId, status: "Ready" };
    }

    return {
      idMitra,
      cabangId,
      espId,
      namaGroupMesin,
      washer: washerResult,
      dryer: dryerResult,
    };
  } catch (error) {
    throw error;
  }
};
```

### Tahap 2: Ubah File Controller (`src/controller/mesin.js`)

Ubah fungsi `createNewMesin`.

1. **Validasi fields required:** `['idMitra', 'cabangId', 'espId', 'namaGroupMesin']`
2. **Validasi nilai `washer` dan `dryer`** (harus `0` atau `1`).
3. **Tambahkan `namaGroupMesin`** ke daftar requiredFields.
4. **Panggil model** dengan parameter `createdBy`:
```javascript
const createdBy = req.user ? req.user.username || req.user.id : null;
const result = await MesinModel.createNewMesin(body, createdBy);
```
5. **Error handling** untuk error baru:
   - `"Modul ESP ini sudah terdaftar di cabang yang sama"` (400)

**Perubahan pada validasi:**
```javascript
const requiredFields = ['idMitra', 'cabangId', 'espId', 'namaGroupMesin'];
```

### Tahap 3: Testing

**Cara testing menggunakan Postman/curl:**

1. Login untuk mendapatkan token.
2. Panggil endpoint:

**Test Case 1: Create Washer + Dryer**
```json
POST http://localhost:7001/api/backoffice/mesin
Authorization: Bearer <token>
Content-Type: application/json

{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A10:CF:12:3A:5B:7C",
  "namaGroupMesin": "Mesin Laundry 1",
  "washer": 1,
  "dryer": 1
}
```
Response: `201 - CREATE new Mesin success`

**Test Case 2: Create Washer Only**
```json
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A10:CF:12:3A:5B:7D",
  "namaGroupMesin": "Mesin Laundry 2",
  "washer": 1,
  "dryer": 0
}
```
Response: `washer: { id: ..., status: "Ready" }`, `dryer: null`

**Test Case 3: Error - Duplikasi espId + cabang**
```json
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A10:CF:12:3A:5B:7C",
  "namaGroupMesin": "Mesin Laundry 1 Duplikat",
  "washer": 1,
  "dryer": 1
}
```
Response: `400 - Modul ESP ini sudah terdaftar di cabang yang sama`

**Test Case 4: Error - Tidak ada washer dan dryer**
```json
{
  "idMitra": 9,
  "cabangId": 4,
  "espId": "A10:CF:12:3A:5B:7E",
  "namaGroupMesin": "Mesin Laundry 3",
  "washer": 0,
  "dryer": 0
}
```
Response: `400 - Minimal salah satu washer atau dryer harus bernilai 1`

---

## Ringkasan File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/mesin.js` | Ubah fungsi `createNewMesin` untuk INSERT ke 2 tabel (`tbl_mesin_master` + `tbl_mesin_detail`) |
| 2 | **MODIFY** | `src/controller/mesin.js` | Tambahkan validasi `namaGroupMesin`, sesuaikan error handling |

---

## Checklist Implementasi

- [ ] Tahap 1: `src/models/mesin.js` - Ubah `createNewMesin`
  - [ ] Validasi Mitra (pertahankan)
  - [ ] Validasi Cabang (pertahankan)
  - [ ] Validasi duplikasi `espId` + `cabangId` di `tbl_mesin_master` (BARU)
  - [ ] Validasi minimal washer/dryer (pertahankan)
  - [ ] INSERT ke `tbl_mesin_master` dengan kolom: `idMitra, cabangId, espId, namaGroupMesin, createdBy`
  - [ ] INSERT ke `tbl_mesin_detail` (1 baris untuk WASHER, 1 baris untuk DRYER)
  - [ ] Return response dengan format baru (washer/dryer sebagai objek dengan id dan status)
- [ ] Tahap 2: `src/controller/mesin.js` - Validasi `namaGroupMesin` required
  - [ ] Tambahkan `'namaGroupMesin'` ke array requiredFields
  - [ ] Error handling untuk `"Modul ESP ini sudah terdaftar di cabang yang sama"`
- [ ] Tahap 3: Testing
  - [ ] Test Case 1: Create Washer + Dryer (Success 201)
  - [ ] Test Case 2: Create Washer Only (Success 201)
  - [ ] Test Case 3: Error Duplikasi espId + cabang (400)
  - [ ] Test Case 4: Error Tidak ada washer/dryer (400)

---

## Catatan Tambahan untuk Developer / AI Model Murah

1. **Jangan buat file baru.** Semua perubahan hanya pada `src/models/mesin.js` dan `src/controller/mesin.js`.
2. **Ikuti pola yang sudah ada.** Gunakan struktur yang sama dengan fungsi-fungsi lain (misal: `updateMesin` dengan transaksi).
3. **Gunakan `dbPool.execute()`** untuk semua query (bukan `dbPool.query()` karena tidak perlu bulk insert).
4. **channelRelay**: `5` untuk WASHER, `4` untuk DRYER (hardcoded).
5. **Middleware auth**: Gunakan `authenticate` (bukan `authenticateMobile`) karena ini untuk backoffice.
6. **Nama tabel baru**: `tbl_mesin_master` dan `tbl_mesin_detail` — pastikan nama tabel sesuai dengan yang sudah dibuat di database.
7. **Response format**: `washer` dan `dryer` adalah objek dengan struktur `{ id, status }`, bukan array. Jika tidak ada, bernilai `null`.