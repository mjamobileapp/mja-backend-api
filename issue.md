# Issue: API Get Data Absensi Kasir per Cabang

## Deskripsi
Buat endpoint API baru untuk mengambil data absensi kasir per cabang. Endpoint ini akan diakses oleh **Owner** melalui mobile app.

## Endpoint
- **URL**: `/api/owner/absensikasir?cabangId=2`
- **Method**: `GET`
- **Auth**: Bearer Token Mobile (menggunakan middleware `authenticateMobile`)
- **Query Params**: `cabangId` (required) - ID cabang yang ingin diambil data absensinya
## Response
### Success (200 OK):
