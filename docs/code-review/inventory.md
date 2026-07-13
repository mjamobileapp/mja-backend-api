# Code Review Inventory

Status pada dokumen ini menyatakan kedalaman review saat implementasi awal. `INVENTORIED` berarti file sudah masuk cakupan dan tanggung jawabnya dipetakan, tetapi belum boleh dianggap review detail selesai.

| Area | File/kelompok | Tanggung jawab | Status |
|---|---|---|---|
| Bootstrap | `src/app.js`, `src/server.js`, `src/index.js` | Express factory, startup, CORS, route mount, error flow, MQTT startup/shutdown | REVIEWED - HAS FINDING (REV-001, REV-002, REV-006, REV-019) |
| Config | `src/config/database.js`, `src/config/environment.js` | MySQL pool dan validasi/config environment | REVIEWED - HAS FINDING (REV-006, REV-022) |
| Middleware | `auth.js`, `authMobile.js`, `authCombined.js`, `authorization.js` | Token verification dan owner/kasir scope | REVIEWED - HAS FINDING (REV-001, REV-021, REV-026) |
| Middleware | `logs.js`, `errorHandler.js`, `responseSanitizer.js`, `publicAuthRateLimit.js`, `multer.js` | Logging, HTTP errors, error response, public auth throttling, upload | REVIEWED - HAS FINDING (REV-002, REV-003, REV-022) |
| Utilities | `jwt.js`, `date.js`, `validation.js`, `httpError.js` | Token, timestamp, input validation, error domain | REVIEWED - HAS FINDING (REV-003, REV-004, REV-024) |
| Utilities | `email.js`, `publicAuth.js`, `mqttClient.js`, `mqttStatusListener.js`, `password.js` | External integration, credentials, public reset response, ACK/status lifecycle, and listener cleanup | REVIEWED - HAS FINDING (REV-003, REV-015, REV-019, REV-022, REV-025) |
| Routes | seluruh `src/routes/*.js` | HTTP path, auth middleware, controller binding | REVIEWED - HAS FINDING (REV-009, REV-012) |
| Controllers | `masterItem.js` | Pilot CRUD backoffice | REVIEWED - HAS FINDING (REV-004, REV-005) |
| Models | `masterItem.js` | Pilot query CRUD dan soft delete | REVIEWED - HAS FINDING (REV-005) |
| Controllers/models | users, userOwner | Backoffice user and owner audit identity | REVIEWED - HAS FINDING (REV-008) |
| Controllers/models | mobile, kasir, settingStokMitra | Mobile user, owner/kasir flow, absensi, and tenant scope | REVIEWED - HAS FINDING (REV-009, REV-016, REV-020) |
| Controllers/models | mitra, cabang, roles, menus | Backoffice master data, audit identity, and menu mutation | REVIEWED - HAS FINDING (REV-011, REV-023) |
| Controllers/models | kasir | Owner-managed cashier account, absensi, and tenant scope | REVIEWED - HAS FINDING (REV-012, REV-020) |
| Controllers/models | mesin, dashboard, akses | Backoffice machine data, dashboard, and access control | REVIEWED - HAS FINDING (REV-012) |
| Controllers/models | cashflow, history, hargaCabang, transaksi | Business-critical mobile data, role scope, and transaction flow | REVIEWED - HAS FINDING (REV-014, REV-015, REV-017, REV-021, REV-026); database-backed transaction, history, and cashflow flows covered, broker/device flow remains deferred |
| Firmware/integration | `arduino.txt`, `Arduino Existing.txt`, MQTT utilities | MQTT topic/payload, ACK, READY lifecycle | REVIEWED - HAS FINDING (REV-015); firmware physical-device parity remains operational verification |
| Root/docs | `package.json`, `.gitignore`, `.env`, README, API docs, Postman collection | Setup, package scripts, lint, documentation, 63 route catalog request, and 13 verified core API examples | REVIEWED - FINDINGS CLOSED (REV-006, REV-007, REV-013, REV-018) |

## Review completion rule

Before an area changes to `REVIEWED - NO FINDING` or `REVIEWED - HAS FINDING`, reviewer must trace route/middleware/controller/model dependencies, inspect query scope, and record the evidence in `findings.md`.
