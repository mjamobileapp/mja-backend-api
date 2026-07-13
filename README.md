# MJA Smart Laundry Backend API

Backend Express.js dan MySQL untuk backoffice, aplikasi mobile owner/kasir, transaksi laundry, serta integrasi MQTT mesin.

## Prasyarat

- Node.js 20 atau lebih baru.
- npm.
- MySQL yang dapat diakses oleh konfigurasi aplikasi.
- Broker MQTT hanya diperlukan untuk fitur kontrol mesin.

## Setup lokal

1. Isi `.env` lokal dengan nilai database dan `JWT_SECRET` yang aman.
2. Jalankan `npm install`.
3. Jalankan `npm start` untuk server biasa atau `npm run dev` untuk mode nodemon.

Server default berjalan pada port `9090` dan menyediakan health check di `GET /`.

## Konfigurasi environment

Nilai wajib saat server dijalankan:

- `JWT_SECRET`
- `DB_HOST`
- `DB_USERNAME`
- `DB_NAME`

Konfigurasi runtime dibaca dari `.env`. Jangan commit `.env`, token, atau credential.

Konfigurasi opsional untuk endpoint autentikasi publik:

- `PUBLIC_AUTH_RATE_LIMIT_MAX` — maksimum percobaan per alamat IP dan jenis flow (default `5`).
- `PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS` — durasi window limiter dalam milidetik (default `900000` atau 15 menit).
- `TRUST_PROXY=true` — aktifkan hanya bila aplikasi berada di balik reverse proxy tepercaya.

Saat `TRUST_PROXY=true`, Express menggunakan alamat klien yang diteruskan oleh reverse proxy untuk limiter. Endpoint login, aktivasi akun, dan reset password akan mengembalikan HTTP `429` saat batas ini terlampaui. Reset password selalu mengembalikan HTTP `202` dengan respons generik agar email yang terdaftar tidak dapat dienumerasi.

## Quality check

```bash
npm test
npm run check:syntax
npm run lint
npm run check
```

`npm run check` menjalankan pemeriksaan syntax seluruh JavaScript aplikasi serta test bawaan Node.js. Unit test tidak membutuhkan database atau broker MQTT; suite juga mencakup integration test mobile dan domain inti pada schema test terisolasi.

Integration test mobile memakai schema kosong `${DB_NAME}_refactor_test`. Buat schema tersebut dari struktur database aplikasi tanpa menyalin data produksi sebelum menjalankan seluruh suite test.

## Struktur singkat

```text
src/app.js          membuat Express app tanpa membuka port
src/server.js       memvalidasi environment, membuka port, dan memulai MQTT listener
src/routes/         definisi endpoint dan middleware
src/controller/     validasi request serta response HTTP
src/models/         query MySQL dan transaction
src/middleware/     authentication, error handling, dan response protection
src/utils/          JWT, date, validation, email, dan MQTT
test/               baseline automated tests
```

Dokumentasi audit dan roadmap refactor berada di `docs/code-review/`.
