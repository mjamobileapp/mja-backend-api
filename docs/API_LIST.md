# API Route Map

Base URL: `http://localhost:9090`. Semua endpoint selain yang ditandai **public** memerlukan `Authorization: Bearer <token>`.

## Backoffice

| Resource | Base path | Method dan path tambahan |
|---|---|---|
| Login | `/api/backoffice/login` | `POST /` **public, rate limited** |
| Users | `/api/backoffice/users` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `POST /:id/changepassword`, `POST /:email/resetpassword` **public, rate limited, generic HTTP 202** |
| Roles | `/api/backoffice/roles` | `GET /`, `POST /`, `GET /:idRole`, `PUT /:idRole`, `DELETE /:idRole` |
| Menus | `/api/backoffice/menus` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Menu header | `/api/backoffice/getMenuHeader` | `GET /` |
| Akses | `/api/backoffice/akses` | `GET /role/:idRole`, `POST /role/:idRole`, `GET /user/:email` |
| Mitra | `/api/backoffice/mitra` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore` |
| Cabang | `/api/backoffice/cabang` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `GET /mitra/:idMitra` (backoffice/owner sesuai mitra) |
| Mesin | `/api/backoffice/mesin` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `GET /master`, `GET /esp/:espId`, `GET /mitra/:idMitra`, `GET /cabang/:cabangId`, `PUT /maintenance/:idMesinDetail`, `PUT /ready/:idMesinDetail`, `GET /list/cabang/:cabangId` (backoffice/owner/kasir sesuai scope) |
| Item | `/api/backoffice/item` | `GET /`, `POST /`, `GET /:id`, `GET /tipe/:tipeItem`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore` |
| User owner | `/api/backoffice/userowner` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `PUT /:id/resetdeviceid`, `POST /:id/changepassword`, `POST /:email/resetpassword` **public, rate limited, generic HTTP 202** |
| Dashboard | `/api/backoffice/dashboard` | `GET /getmitra`, `GET /getcabang`, `GET /getmesin` |

## Mobile, owner, dan kasir

| Resource | Base path | Method dan path tambahan |
|---|---|---|
| Mobile auth | `/api/mobile` | `POST /login` **public, rate limited**, `POST /activateaccount` **public, rate limited**, `POST /logout`, `GET /notifications`, `PUT /notifications/:id/read` |
| Transaksi kasir | `/api/kasir/transaksi` | `GET /`, `GET /pending`, `POST /`, `POST /startmesin`, `POST /stopmesin` (kasir) |
| Mesin mitigasi | `/api/transaksi` | `POST /startmesin`, `POST /stopmesin` (owner mengirim `cabangId` untuk mitra tokennya; backoffice mengirim `idMitra` dan `cabangId`; kasir ditolak) |
| Manajemen kasir owner | `/api/owner/kasir` | `GET /absensi`, `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `PUT /:id/resetdeviceid`, `POST /:id/changepassword`; seluruh operasi manajemen memerlukan role owner; `POST /:email/resetpassword` **public, rate limited, generic HTTP 202** |
| Absensi kasir | `/api/kasir/absensi` | `GET /` (kasir, cabang token) |
| Stok minimum owner | `/api/owner/stokmitra` | `GET /`, `POST /`, `PUT /:id`, `GET /mitra/:idMitra` |
| Cashflow | `/api/owner` | `GET /cashflow`, `GET /cashflow/pendapatan` (owner); `GET /cashflow/pengeluaran`, `GET /cashflow/pengeluaran/:id`, `POST /cashflow/pengeluaran`, `PUT /cashflow/pengeluaran/:id`, `DELETE /cashflow/pengeluaran/:id` (owner atau kasir; kasir dibatasi ke cabang token) |
| History owner | `/api/owner/history` | `GET /transaksi`, `GET /mesin` (owner) |
| History kasir | `/api/kasir/history` | `GET /transaksi` (kasir, cabang token) |
| Harga cabang owner | `/api/owner/settingharga` | `GET /`, `POST /` (owner) |

Payload dan response detail harus mengikuti controller masing-masing. Koleksi Postman memiliki `Backoffice route catalog` berisi 76 request yang disinkronkan terhadap route aktif, variable auth/ID, dan body JSON valid. Folder `Verified core API contract` memuat 13 request dengan bukti integration atau controller test, termasuk reset password publik yang selalu merespons HTTP 202 secara generik. Route catalog tidak menyatakan bahwa setiap request telah smoke-tested satu per satu.

## Kontrak harga resmi transaksi

`POST /api/kasir/transaksi` memakai harga resmi cabang dari server. Jika request ditolak dengan HTTP 409, client harus membaca `code` (bukan mencocokkan `message`):

| Code | Makna | Tindakan mobile |
|---|---|---|
| `TRANSACTION_PRICE_CHANGED` | Harga resmi berubah setelah layar transaksi dibuka atau harga pada payload tidak lagi sama dengan server. | Batalkan submit lama, muat ulang harga cabang, tampilkan total terbaru, lalu minta kasir mengonfirmasi dan mengirim ulang transaksi baru. Jangan retry otomatis dengan payload lama. |
| `TRANSACTION_PRICE_NOT_CONFIGURED` | Harga resmi untuk layanan/cabang belum tersedia atau tidak valid. | Jangan fallback ke subtotal client dan jangan retry otomatis. Tampilkan konfigurasi harga belum tersedia; operasional harus melengkapi harga cabang terlebih dahulu. |

Bentuk payload 409 kompatibel dengan client lama dan baru:

```json
{
  "success": false,
  "code": "TRANSACTION_PRICE_CHANGED",
  "message": "Harga transaksi telah berubah. Muat ulang harga dan coba kembali.",
  "error": "Harga transaksi telah berubah. Muat ulang harga dan coba kembali."
}
```

Backend memiliki regression test HTTP untuk kedua code dan contoh response tersebut tercatat pada request `Kasir - Create transaksi` di koleksi Postman. Source mobile tidak berada di repository ini; implementasi refresh harga harus diverifikasi pada repository mobile/QA sebelum deployment. Dengan demikian kompatibilitas client merupakan dependency deployment: rilis backend yang mengaktifkan enforcement harga wajib dipasangkan dengan bukti bahwa mobile menangani kedua response 409 sesuai tabel di atas.
