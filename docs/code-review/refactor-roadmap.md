# Refactor Roadmap

Status di bawah adalah status berbasis bukti pada checkout ini; `Partial` bukan completion claim. Ukuran menggunakan S/M/L dan risiko menyatakan dampak bila perubahan salah.

| Batch | Status | Scope | Ukuran | Risiko | Bukti/test | Sisa sebelum complete |
|---|---|---|---|---|---|---|
| A — Safety net | Completed | App factory, config validation, syntax, lint, dan test command | M | Sedang | `test/app.test.js`, `npm run check` | — |
| B — P0/P1 | Completed | Status auth, safe 5xx response, tenant scope, audit identity, dependency audit | L | Tinggi | auth/audit/cashflow tests, `npm audit --omit=dev` | — |
| C — Error foundation | Partial | Error helper, validation, response sanitizer, pilot master item | M | Sedang | `test/app.test.js`, `test/masterItem.controller.test.js` | Migrasi error class/async handler di seluruh controller |
| D — Shared utilities | Partial | Date helper, logging opt-in, CORS config, graceful shutdown | M | Sedang | `test/serverShutdown.test.js` | Kebijakan timezone, structured logger, timeout external service |
| E — Modul pilot | Completed | CRUD master item dan characterization test | M | Rendah | `test/masterItem.controller.test.js` | — |
| F — CRUD backoffice | Partial | Akses, dashboard, mesin, users/owner, menu | L | Sedang | `test/coreDomains.integration.test.js`, audit tests | Kontrak seluruh CRUD dan explicit-column migration |
| G — Owner/kasir | Partial | Mobile auth, kasir, stok, cashflow, history, harga | L | Tinggi | `mobileAuth.integration.test.js`, core-domain integration | Negative authorization untuk setiap owner/kasir route |
| H — Transaksi/MQTT | Partial | Transaction database flow, ACK utility, READY listener lifecycle | L | Tinggi | `test/mesin.model.test.js`, `test/coreDomains.integration.test.js`, `test/serverShutdown.test.js` | Success/failure start-stop dengan fake broker dan device parity |
| I — Dependency & docs | Partial | npm lockfile, audit, README, API map, Postman verified core requests | M | Sedang | `npm audit --omit=dev`, docs review | Audit dependency frontend, full Postman legacy-request refresh |

## Remaining implementation tasks

| Task | Batch | Ukuran | Risiko | Required test/evidence |
|---|---|---:|---|---|
| Migrate controller error mapping to shared error codes | C | L | Contract regression | 4xx/5xx characterization per migrated module |
| Establish UTC/Asia-Jakarta storage policy | D | M | Financial/date boundary | Midnight and DST-independent date tests |
| Add structured logger plus external-service timeouts | D | M | Operational visibility | Redaction and timeout unit tests |
| Replace remaining `SELECT *` only after contract capture | F | L | Response regression | Response snapshot for each changed endpoint |
| Expand owner/kasir negative authorization matrix | G | L | Tenant leak | Cross-mitra/cabang integration tests per route family |
| Test start/stop machine with fake broker and device parity | H | L | Physical machine control | ACK success, wrong ID, negative ACK, timeout, READY update |
| Refresh remaining legacy Postman examples | I | M | Client misuse | Postman collection import and request smoke verification |

Physical-device firmware parity remains an operational deployment verification, not an automated repository test.
