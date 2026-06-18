"# Issue: Ubah API Create New Mesin (Single ESP, Dual Relay - Washer + Dryer)

## Deskripsi
Melakukan perubahan pada API `createNewMesin` di modul Mesin untuk mendukung pendaftaran 2 mesin sekaligus (Washer dan Dryer) dalam satu request, karena secara fisika satu modul ESP memiliki 2 relay yang mengontrol 2 mesin (1 Washer + 1 Dryer).

## Latar Belakang
Schema table `tbl_mesin` telah diubah menjadi:
```sql
`tbl_mesin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `idMitra` INT NOT NULL COMMENT 'FK ke tbl_mitra untuk keamanan SaaS (Tenant Isolation)',
  `cabangId` INT NOT NULL COMMENT 'Lokasi mesin ini berada',
  -- Identitas Fisik IoT
  `espId` VARCHAR(50) NOT NULL COMMENT 'MAC Address / ID Unik dari Modul ESP32/8266',
  `channelRelay` INT NOT NULL COMMENT 'Nomor pin/relay di ESP. Contoh: 5 untuk Washer, 4 untuk Dryer',
  -- Identitas Logis (Tampilan di Aplikasi)
  `namaMesin` VARCHAR(50) NOT NULL COMMENT 'Contoh: Mesin Cuci 01, Pengering 01',
  `tipeMesin` ENUM('WASHER', 'DRYER') NOT NULL COMMENT 'Penting untuk penentuan harga dan ikon UI',
  -- Pemantauan Status
  `status` ENUM('READY', 'IN_USE', 'OFFLINE', 'ERROR') DEFAULT 'READY',
  `waktuSelesai` DATETIME DEFAULT NULL COMMENT 'Kapan timer mesin ini akan habis',
  `waktuPingTerakhir` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`idMitra`) REFERENCES `tbl_mitra`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cabangId`) REFERENCES `tbl_cabang`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Perubahan utama dari schema lama ke baru:**
- `ipAddressEsp` → dihapus (diganti `espId` untuk MAC Address)
- `macAddress` → dihapus (diganti `espId`)
- `kapasitas` → dihapus
- `tipeMesin` → tetap ada tapi valuenya `ENUM('WASHER', 'DRYER')` bukan `VARCHAR`
- `channelRelay` → **BARU**: nomor relay (5=Washer, 4=Dryer)
- `espId` → **BARU**: MAC Address / ID Unik ESP
- `waktuSelesai` → **BARU**: kapan timer mesin habis
- `waktuPingTerakhir` → **BARU**: timestamp ping terakhir

## Endpoint
- **URL**: `/api/backoffice/mesin`
- **Method**: `POST`
- **Auth**: Bearer Token (menggunakan middleware `authenticate`)
- **Body**: JSON

## Request Body
```json
{
  "idMitra": 12,
  "cabangId": 3,
  "espId": "A4:CF:12:3A:5B:7C",
  "washer": {
    "namaMesin": "Mesin Cuci 01"
  },
  "dryer": null
}
```

**Penjelasan field:**
- `idMitra` (required) - ID Mitra
- `cabangId` (required) - ID Cabang tempat mesin berada
- `espId` (required) - MAC Address / ID Unik dari Modul ESP
- `washer` (opsional, jika diisi minimal harus ada `namaMesin`) - Data mesin cuci
- `dryer` (opsional, jika diisi minimal harus ada `namaMesin`) - Data mesin pengering

> **Catatan**: Minimal salah satu dari `washer` atau `dryer` harus diisi.

## Response
### Success (201 Created):
```json
{
  "message": "CREATE new Mesin success",
  "data": {
    "idMitra": 12,
    "cabangId": 3,
    "espId": "A4:CF:12:3A:5B:7C",
    "washer": {
      "id": 105,
      "namaMesin": "Mesin Cuci 01",
      "status": "Ready"
    },
    "dryer": {
      "id": 106,
      "namaMesin": "Mesin Pengering 01"
    }
  }
}
```

### Error (400 Bad Request):
```json
{
  "error": "Mitra tidak ditemukan atau tidak aktif"
}
```
atau
```json
{
  "message": "Bad request, missing required fields",
  "missingFields": ["idMitra"]
}
```

### Error (500 Internal Server Error):
```json
{
  "message": "Server Error",
  "serverMessage": "..."
}
```

---

## Tahapan Implementasi

### Tahap 1: Ubah File Model (`src/models/mesin.js`)

Ubah fungsi `createNewMesin` di file `src/models/mesin.js`.

**Yang harus diubah:**
1. Hapus validasi field lama (`namaMesin`, `tipeMesin`, `kapasitas`, `ipAddressEsp`, `macAddress`, `status`, `createdBy`).
2. Ambil field baru: `const { idMitra, cabangId, espId, washer, dryer } = body;`.
3. Validasi Mitra (sama seperti sebelumnya).
4. Validasi Cabang (sama seperti sebelumnya).
5. Validasi duplikasi: Cek apakah sudah ada mesin dengan `espId` dan `tipeMesin` yang sama.
6. Buat array `values` untuk menampung data yang akan di-insert.
7. Jika `washer` ada dan memiliki `namaMesin`, push ke array: `[idMitra, cabangId, espId, 5, washer.namaMesin, 'WASHER']`.
8. Jika `dryer` ada dan memiliki `namaMesin`, push ke array: `[idMitra, cabangId, espId, 4, dryer.namaMesin, 'DRYER']`.
9. Jika `values.length === 0`, throw error "Minimal harus mengisi satu data mesin (Washer atau Dryer)".
10. Gunakan `INSERT INTO tbl_mesin (idMitra, cabangId, espId, channelRelay, namaMesin, tipeMesin) VALUES ?` dengan `dbPool.query(query, [values])`.
11. Kembalikan data response sesuai format yang diminta (dengan `insertId` dari hasil insert).

**Contoh kode (struktur dasar):**
```javascript
const createNewMesin = async (body) => {
  try {
    const { idMitra, cabangId, espId, washer, dryer } = body;

    // 1. Validasi Mitra Exist
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

    // 3. Buat array untuk menampung data
    const values = [];
    let insertedIds = {};

    // 4. Cek Washer
    if (washer && washer.namaMesin) {
      // Validasi duplikasi espId + tipeMesin
      const [existingWasher] = await dbPool.execute(
        "SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = 'WASHER'",
        [espId]
      );
      if (existingWasher.length > 0) {
        throw new Error("Mesin dengan espId dan tipe WASHER yang sama sudah terdaftar");
      }
      values.push([idMitra, cabangId, espId, 5, washer.namaMesin, 'WASHER']);
    }

    // 5. Cek Dryer
    if (dryer && dryer.namaMesin) {
      // Validasi duplikasi espId + tipeMesin
      const [existingDryer] = await dbPool.execute(
        "SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = 'DRYER'",
        [espId]
      );
      if (existingDryer.length > 0) {
        throw new Error("Mesin dengan espId dan tipe DRYER yang sama sudah terdaftar");
      }
      values.push([idMitra, cabangId, espId, 4, dryer.namaMesin, 'DRYER']);
    }

    // 6. Validasi minimal satu data
    if (values.length === 0) {
      throw new Error("Minimal harus mengisi satu data mesin (Washer atau Dryer)");
    }

    // 7. Insert ke database
    const query = `INSERT INTO tbl_mesin 
      (idMitra, cabangId, espId, channelRelay, namaMesin, tipeMesin) 
      VALUES ?`;
    
    const [result] = await dbPool.query(query, [values]);

    // 8. Map hasil insertId untuk response
    let washerResult = null;
    let dryerResult = null;
    
    if (washer && washer.namaMesin) {
      washerResult = {
        id: result.insertId, // insertId pertama = Washer
        namaMesin: washer.namaMesin,
        status: "Ready",
      };
    }
    
    if (dryer && dryer.namaMesin) {
      const dryerInsertId = washer && washer.namaMesin ? result.insertId + 1 : result.insertId;
      dryerResult = {
        id: dryerInsertId,
        namaMesin: dryer.namaMesin,
        status: "Ready",
      };
    }

    return {
      idMitra,
      cabangId,
      espId,
      washer: washerResult,
      dryer: dryerResult,
    };
  } catch (error) {
    throw error;
  }
};
```

### Tahap 2: Ubah File Controller (`src/controller/mesin.js`)

Ubah fungsi `createNewMesin` di file `src/controller/mesin.js`.

**Yang harus diubah:**
1. Hapus validasi field lama (`namaMesin`, `tipeMesin`, `kapasitas`, `ipAddressEsp`, `macAddress`, `status`, `createdBy`).
2. Tambahkan validasi field baru: `idMitra`, `cabangId`, `espId` (required).
3. `washer` dan `dryer` bersifat opsional (tidak perlu divalidasi di sini, cukup di model).
4. Jaga error handling untuk error baru: "Minimal harus mengisi satu data mesin (Washer atau Dryer)" dan "Mesin dengan espId dan tipe ... yang sama sudah terdaftar".

### Tahap 3: Testing

Setelah semua selesai, jalankan server:
```bash
npm run dev
```

**Cara testing menggunakan Postman/curl:**
1. Login backoffice terlebih dahulu untuk mendapatkan token menggunakan user:"hamdanfresh@gmail.com" dan password:"mja12345"
2. Panggil endpoint dengan token yang didapat:

**Test Case 1: Create Washer + Dryer**
```
POST http://localhost:7001/api/backoffice/mesin
Authorization: Bearer <token>
Content-Type: application/json

{
  "idMitra": 12,
  "cabangId": 3,
  "espId": "A4:CF:12:3A:5B:7C",
  "washer": {
    "namaMesin": "Mesin Cuci 01"
  },
  "dryer": {
    "namaMesin": "Mesin Pengering 01"
  }
}
```

**Test Case 2: Create Washer Only**
```
POST http://localhost:7001/api/backoffice/mesin
Authorization: Bearer <token>
Content-Type: application/json

{
  "idMitra": 12,
  "cabangId": 3,
  "espId": "A4:CF:12:3A:5B:7D",
  "washer": {
    "namaMesin": "Mesin Cuci 02"
  },
  "dryer": null
}
```

**Test Case 3: Error - Tidak ada washer atau dryer**
```
POST http://localhost:7001/api/backoffice/mesin
Authorization: Bearer <token>
Content-Type: application/json

{
  "idMitra": 12,
  "cabangId": 3,
  "espId": "A4:CF:12:3A:5B:7E"
}
```
Response: `400 - Minimal harus mengisi satu data mesin (Washer atau Dryer)`

**Test Case 4: Error - Duplikasi espId + tipeMesin**
```
POST http://localhost:7001/api/backoffice/mesin
Authorization: Bearer <token>
Content-Type: application/json

{
  "idMitra": 12,
  "cabangId": 3,
  "espId": "A4:CF:12:3A:5B:7C",
  "washer": {
    "namaMesin": "Mesin Cuci 01"
  }
}
```
Response: `400 - Mesin dengan espId dan tipe WASHER yang sama sudah terdaftar`

---

## Ringkasan File yang Akan Dimodifikasi

| No | Action | File Path | Keterangan |
|----|--------|-----------|------------|
| 1 | **MODIFY** | `src/models/mesin.js` | Ubah fungsi `createNewMesin` untuk mendukung dual relay insert |
| 2 | **MODIFY** | `src/controller/mesin.js` | Ubah validasi field request body |

> **Tidak ada file baru yang dibuat.** Semua perubahan dilakukan pada file yang sudah ada (module mesin).

---

## Checklist Implementasi

- [ ] Tahap 1: Ubah `src/models/mesin.js` - Fungsi `createNewMesin`
  - [ ] Ambil field baru: `idMitra, cabangId, espId, washer, dryer`
  - [ ] Validasi Mitra (pertahankan)
  - [ ] Validasi Cabang (pertahankan)
  - [ ] Validasi duplikasi `espId` + `tipeMesin` (BARU)
  - [ ] Insert array values dengan `dbPool.query(query, [values])`
  - [ ] Return response dengan format washer/dryer
- [ ] Tahap 2: Ubah `src/controller/mesin.js` - Fungsi `createNewMesin`
  - [ ] Validasi field required: `idMitra, cabangId, espId`
  - [ ] Error handling untuk error baru
- [ ] Tahap 3: Testing dengan Postman/curl
  - [ ] Test Case 1: Create Washer + Dryer (Success 201)
  - [ ] Test Case 2: Create Washer Only (Success 201)
  - [ ] Test Case 3: Error tanpa washer/dryer (400)
  - [ ] Test Case 4: Error duplikasi (400)
  - [ ] Test Case 5: Error Mitra tidak ditemukan (400)
  - [ ] Test Case 6: Error Cabang tidak ditemukan (400)

---

## Catatan Tambahan untuk Developer / AI Model Murah

1. **Jangan buat file baru.** Semua perubahan hanya pada `src/models/mesin.js` dan `src/controller/mesin.js`.
2. **Ikuti pola yang sudah ada.** Gunakan struktur yang sama dengan fungsi-fungsi lain di file tersebut.
3. **PENTING: Gunakan `dbPool.query()`** bukan `dbPool.execute()` untuk INSERT dengan multi values (`VALUES ?`). Method `query` mendukung placeholder `?` untuk array of arrays, sedangkan `execute` tidak.
4. **channelRelay**: 5 untuk WASHER, 4 untuk DRYER (hardcoded).
5. **Middleware auth**: Gunakan `authenticate` (bukan `authenticateMobile`) karena ini untuk backoffice.
6. **Error handling**: Pastikan semua error yang sudah ada (Mitra, Cabang, duplikasi) tetap dipertahankan.
7. **Response format**: Perhatikan bahwa response `data` memiliki struktur `washer` dan `dryer` sebagai objek terpisah, bukan array."