# API Route Map

Base URL: `http://localhost:9090`. Semua endpoint selain yang ditandai **public** memerlukan `Authorization: Bearer <token>`.

## Backoffice

| Resource | Base path | Method dan path tambahan |
|---|---|---|
| Login | `/api/backoffice/login` | `POST /` **public** |
| Users | `/api/backoffice/users` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `POST /:id/changepassword`, `POST /:email/resetpassword` **public** |
| Roles | `/api/backoffice/roles` | `GET /`, `POST /`, `GET /:idRole`, `PUT /:idRole`, `DELETE /:idRole` |
| Menus | `/api/backoffice/menus` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Menu header | `/api/backoffice/getMenuHeader` | `GET /` |
| Akses | `/api/backoffice/akses` | `GET /role/:idRole`, `POST /role/:idRole`, `GET /user/:email` |
| Mitra | `/api/backoffice/mitra` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore` |
| Cabang | `/api/backoffice/cabang` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `GET /mitra/:idMitra` (backoffice/owner sesuai mitra) |
| Mesin | `/api/backoffice/mesin` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `GET /master`, `GET /esp/:espId`, `GET /mitra/:idMitra`, `GET /cabang/:cabangId`, `PUT /maintenance/:idMesinDetail`, `PUT /ready/:idMesinDetail`, `GET /list/cabang/:cabangId` (backoffice/owner/kasir sesuai scope) |
| Item | `/api/backoffice/item` | `GET /`, `POST /`, `GET /:id`, `GET /tipe/:tipeItem`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore` |
| User owner | `/api/backoffice/userowner` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `PUT /:id/resetdeviceid`, `POST /:id/changepassword`, `POST /:email/resetpassword` **public** |
| Dashboard | `/api/backoffice/dashboard` | `GET /getmitra`, `GET /getcabang`, `GET /getmesin` |

## Mobile, owner, dan kasir

| Resource | Base path | Method dan path tambahan |
|---|---|---|
| Mobile auth | `/api/mobile` | `POST /login` **public**, `POST /activateaccount` **public**, `POST /logout`, `GET /notifications`, `PUT /notifications/:id/read` |
| Transaksi kasir | `/api/kasir/transaksi` | `GET /`, `GET /pending`, `POST /`, `POST /startmesin`, `POST /stopmesin` |
| Mesin legacy | `/api/transaksi` | `POST /startmesin`, `POST /stopmesin` |
| Manajemen kasir owner | `/api/owner/kasir` | `GET /absensi`, `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore`, `PUT /:id/resetdeviceid`, `POST /:id/changepassword`; seluruh operasi manajemen memerlukan role owner; `POST /:email/resetpassword` **public** |
| Absensi kasir | `/api/kasir/absensi` | `GET /` |
| Stok minimum owner | `/api/owner/stokmitra` | `GET /`, `POST /`, `PUT /:id`, `GET /mitra/:idMitra` |
| Cashflow | `/api/owner` | `GET /cashflow`, `GET /cashflow/pendapatan`, `GET /cashflow/pengeluaran`, `GET /cashflow/pengeluaran/:id`, `POST /cashflow/pengeluaran`, `PUT /cashflow/pengeluaran/:id`, `DELETE /cashflow/pengeluaran/:id` |
| History owner | `/api/owner/history` | `GET /transaksi`, `GET /mesin` |
| History kasir | `/api/kasir/history` | `GET /transaksi` |
| Harga cabang owner | `/api/owner/settingharga` | `GET /`, `POST /` |

Payload dan response detail harus mengikuti controller masing-masing. Folder `Verified core API contract` pada Postman collection memuat request yang diverifikasi oleh integration test; contoh lama di folder lain perlu direfresh sebelum dijadikan acuan contract baru.
