# Issue: Implementasi API Login User Mobile

## Deskripsi
Membuat endpoint baru `/api/mobile/login` untuk menangani autentikasi user mobile (owner/kasir) dengan validasi device ID, serta mencatat absensi dan notifikasi untuk role kasir.

## Spesifikasi API

### Endpoint Details
```
Endpoint  : /api/mobile/login
Method    : POST
Auth      : No (Public - untuk login)
```

### Request Body
```json
{
  "username": "Hamdan",
  "password": "adminmja123",
  "deviceId": "xyz-123",
  "deviceName": "Samsung A14"
}
```

### Response Body (Success - 200)
```json
{
  "message": "Login successful",
  "data": {
    "id": 5,
    "username": "andika123",
    "role": "owner",
    "idMitra": "11",
    "namaLengkap": "Andika Tri Saputra",
    "noTelp": "085776320145",
    "email": "andika@gmail.com",
    "statusAktif": true,
    "deviceId": "xyz-123",
    "deviceName": "Samsung A14",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Response Body (Error Cases)

**401 Unauthorized (Wrong credentials):**
```json
{
  "message": "Invalid username or password"
}
```

**403 Forbidden (Wrong device):**
```json
{
  "message": "Error 403: Akun ini tidak dapat digunakan di perangkat ini"
}
```

---

## Flow Logika Login

```
1. Validasi input: username, password, deviceId, deviceName
2. Cari user di tbl_users_mobile berdasarkan username
3. Jika tidak ditemukan -> 401 Invalid username or password
4. Jika ditemukan, verifikasi password dengan bcrypt
5. Jika password salah -> 401 Invalid username or password
6. Jika password benar:
   a. Cek apakah deviceId user masih NULL?
      - Ya: Update deviceId dan deviceName ke database, lanjut login sukses
      - Tidak: Bandingkan deviceId yang dikirim dengan deviceId di DB
        - Cocok: Login sukses
        - Tidak cocok: 403 Akun ini tidak dapat digunakan di perangkat ini
7. Generate JWT token
8. Jika role = "kasir":
   a. INSERT ke tbl_absensi (idUserMobile, cabangId, waktuLogin)
   b. INSERT ke tbl_notifikasi (idMitra, cabangId, tipe="ABSENSI", judul, pesan)
   c. Kirim Push Notification ke Firebase (FCM) untuk owner (opsional)
9. Return response sukses
```

---

## Panduan Tahapan Implementasi

### ✅ Tahap 1: Buat Model Baru

**File Baru:** `src/models/userMobile.js`

Buat fungsi-fungsi berikut:

1.  `getUserByUsername(username)`
    - Query: `SELECT * FROM tbl_users_mobile WHERE username = ? and statusAktif = true`
    - Return: row user atau null

2.  `updateDeviceId(id, deviceId, deviceName)`
    - Query: `UPDATE tbl_users_mobile SET deviceId = ?, deviceName = ? WHERE id = ?`
    - Tidak perlu return value spesifik

3.  `createAbsensi(idUserMobile, cabangId)`
    - Query: `INSERT INTO tbl_absensi (idUserMobile, cabangId, waktuLogin) VALUES (?, ?, NOW())`
    - Return: hasil insert

4.  `createNotifikasi(idMitra, cabangId, tipe, judul, pesan)`
    - Query: `INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)`
    - Return: hasil insert

**Tips untuk Model:**
- Gunakan `dbPool.execute()` dengan parameterized query (placeholder `?`)
- Contoh: `const [rows] = await dbPool.execute("SELECT * FROM tbl_users_mobile WHERE username = ?", [username])`

---

### ✅ Tahap 2: Buat Controller Baru

**File Baru:** `src/controller/mobile.js`

Fungsi `loginUser`:

1.  **Validasi Input:**
    - Cek apakah body request memiliki `username`, `password`, `deviceId`, `deviceName`
    - Jika ada yang kurang, return 400 dengan `missingFields`

2.  **Cari User:**
    - Panggil `UserMobileModel.getUserByUsername(username)`
    - Jika tidak ditemukan, return 401

3.  **Verifikasi Password:**
    - Gunakan `bcrypt.compare(password, user.password)`
    - Jika salah, return 401

4.  **Validasi Device ID:**
    - Jika `user.deviceId === null`:
      - Panggil `UserMobileModel.updateDeviceId(id, deviceId, deviceName)`
    - Jika tidak:
      - Bandingkan `deviceId` dari request dengan `user.deviceId`
      - Jika tidak cocok, return 403

5.  **Generate Token:**
    - Import `generateToken` dari `utils/jwt.js`
    - Buat payload: `{ id: user.id, username: user.username, role: user.role }`
    - Generate token dengan payload tersebut

6.  **Proses Role Kasir:**
    - Jika `user.role === "kasir"`:
      - Insert absensi dengan `createAbsensi(id, user.cabangId)`
      - Insert notifikasi:
        - `tipe`: "ABSENSI"
        - `judul`: "Kasir Mulai Shift"
        - `pesan`: "Kasir {namaLengkap} telah login dan memulai shift di cabang."

7.  **Return Response:**
    - Format response sesuai spesifikasi di atas

---

### ✅ Tahap 3: Buat Route Baru

**File Baru:** `src/routes/mobile.js`

```javascript
const express = require("express");
const MobileController = require("../controller/mobile");

const router = express.Router();

// Public route (tanpa authenticate middleware)
router.post("/login", MobileController.loginUser);

module.exports = router;
```

---

### ✅ Tahap 4: Daftarkan Route di Index

**File:** `src/index.js`

1.  Import route: `const mobileRoutes = require("./routes/mobile");`
2.  Daftarkan di bagian routes:
    ```javascript
    app.use("/api/mobile", mobileRoutes);
    ```

---

### ✅ Tahap 5: Setup JWT untuk Payload yang Spesifik

**File:** `src/utils/jwt.js`

Pastikan fungsi `generateToken` sudah bisa menerima payload kustom. Jika belum, buat fungsi baru:

1.  Buat fungsi `generateCustomToken(payload)`
2.  Gunakan `jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" })`
3.  Export fungsi tersebut

---

## Testing Instructions

### Test Case 1: Login dengan kredensial salah (Expect 401)

Request:
```
POST /api/mobile/login
Body: {
  "username": "wronguser",
  "password": "wrongpass",
  "deviceId": "test-device",
  "deviceName": "Test Phone"
}
```
Expected Response: 401 - Invalid username or password

### Test Case 2: Login dengan device berbeda (First time - Bind Device)
Request:
```
POST /api/mobile/login
Body: {
  "username": "kasir123",
  "password": "password123",
  "deviceId": "perangkat-baru-001",
  "deviceName": "Xiaomi Redmi Note 12"
}
```
Expected Response: 200 - Login successful + Device ID tersimpan di DB

### Test Case 3: Login dari device berbeda (Expect 403)
Request:
```
POST /api/mobile/login
Body: {
  "username": "kasir123",
  "password": "password123",
  "deviceId": "perangkat-lain-999",
  "deviceName": "iPhone 15"
}
```
Expected Response: 403 - Error 403: Akun ini tidak dapat digunakan di perangkat ini

### Test Case 4: Login dari device yang sama (Expect 200)
Request:
```
POST /api/mobile/login
Body: {
  "username": "kasir123",
  "password": "password123",
  "deviceId": "perangkat-baru-001",
  "deviceName": "Xiaomi Redmi Note 12"
}
```
Expected Response: 200 - Login successful

### Test Case 5: Login sebagai owner (Expect 200 - No absensi)
Request:
```
POST /api/mobile/login
Body: {
  "username": "owner123",
  "password": "password123",
  "deviceId": "device-owner-001",
  "deviceName": "Samsung Galaxy S24"
}
```
Expected Response: 200 - Login successful (tidak ada insert ke absensi)

---

## Referensi File

| Tipe | File | Status |
|------|------|--------|
| Model | `src/models/userMobile.js` | ✅ BUAT BARU |
| Controller | `src/controller/mobile.js` | ✅ BUAT BARU |
| Route | `src/routes/mobile.js` | ✅ BUAT BARU |
| Index | `src/index.js` | ✏️ EDIT (tambah route) |
| JWT Utils | `src/utils/jwt.js` | ✏️ CEK (pastikan bisa generate token custom) |
| Middleware | `src/middleware/auth.js` | ❌ Tidak perlu diubah |

---

## Catatan Penting

1.  **Password:** Gunakan `bcrypt.compare()` untuk verifikasi password
2.  **Device Binding:** Pastikan logic "Jika NULL -> simpan device" berjalan dengan benar
3.  **Role Kasir:** Hanya role "kasir" yang melakukan insert absensi dan notifikasi
4.  **Token JWT:** Gunakan secret key dari `.env` yaitu `JWT_SECRET`
5.  **Error Handling:** Konsisten dengan error handling di controller lain (`data not found` -> 404, lainnya -> 500)
