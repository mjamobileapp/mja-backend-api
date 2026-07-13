# Code Review Findings

## REV-001 - Mobile authentication error lost its intended status code

- Status: Fixed
- Prioritas: P1
- Kategori: Bug, API consistency
- Lokasi: `src/middleware/authMobile.js`, global handler previously in `src/index.js`; fixed in `src/middleware/errorHandler.js`.
- Bukti: mobile middleware calls `next(err)` with `error.statusCode`, while the old global handler read only `err.status` and defaulted to 500.
- Dampak: client could receive server error for missing/invalid mobile authentication instead of an authentication response.
- Perbaikan: global handler now reads `statusCode` and `status`, with fallback code `UNAUTHORIZED` for 401.
- Test: `test/app.test.js` verifies missing mobile token returns HTTP 401 and the expected payload.

## REV-002 - Internal error detail was exposed by controller responses

- Status: Fixed for response transport; controller cleanup remains planned
- Prioritas: P1
- Kategori: Security, API consistency
- Lokasi: controller responses containing `serverMessage` or `details`; protection in `src/middleware/responseSanitizer.js`.
- Bukti: many controller 500 responses sent `error.message` to the client.
- Dampak: SQL, implementation, and infrastructure details could be exposed.
- Perbaikan: all payloads sent with status >= 500 have `serverMessage`, `details`, and `error` removed; `message` is normalized to `Internal Server Error`. Existing success and 4xx payloads are unchanged.
- Test: sanitizer unit tests are in `test/app.test.js`.
- Follow-up: migrate controllers incrementally to shared error handling so deprecated unsafe fields can be removed from source.

## REV-003 - Request and user objects were logged without redaction

- Status: Fixed for confirmed sensitive logs
- Prioritas: P1
- Kategori: Security, Logging
- Lokasi: `src/utils/jwt.js`, `src/controller/menus.js`, `src/middleware/logs.js`.
- Bukti: JWT helper logged the full user object and menu creation logged the complete Express request object.
- Dampak: credentials, token-related data, and request internals could reach application logs.
- Perbaikan: full-object logs were removed. Path logging is now explicit opt-in with `REQUEST_LOG=true`.
- Follow-up: audit all remaining domain logs and define a redaction policy before enabling structured logging.

## REV-004 - Master item audit identity accepted client-controlled values

- Status: Fixed with compatibility fallback
- Prioritas: P1
- Kategori: Data Integrity, Authorization
- Lokasi: `src/controller/masterItem.js`.
- Bukti: create/update body required `createdBy`/`updatedBy` even though authenticated backoffice request includes `req.user.username`.
- Dampak: an authenticated client could claim another audit username.
- Perbaikan: token username is preferred and body value is only used as a fallback for non-route callers. Route middleware requires backoffice authentication.
- Test: `test/masterItem.controller.test.js` verifies spoofed body values are ignored.

## REV-005 - Master item repeated validation and redundant error propagation

- Status: Fixed for pilot module
- Prioritas: P2
- Kategori: DRY, Clean Code, Test
- Lokasi: `src/controller/masterItem.js`, `src/models/masterItem.js`, `src/utils/validation.js`, `src/utils/httpError.js`, `src/utils/date.js`.
- Bukti: repeated `requiredFields.filter(field => !body[field])` and model `catch/rethrow` blocks obscured behavior; `!value` rejects valid `0` and `false`.
- Perbaikan: reusable missing-value helper, domain HTTP errors, dependency-injected controller factory for tests, and a shared database timestamp helper.
- Test: controller and validator tests cover audit identity, duplicate conflict, and valid falsy values.

## REV-006 - App could not be exercised by automated tests without starting runtime side effects

- Status: Fixed
- Prioritas: P2
- Kategori: Test, Maintainability
- Lokasi: old `src/index.js`; fixed with `src/app.js` and `src/server.js`.
- Bukti: importing the old bootstrap immediately opened a port and started the MQTT status listener.
- Perbaikan: `createApp()` creates only Express. `startServer()` validates server environment, opens the port, then starts MQTT.
- Test: app tests run HTTP checks in-process without database or MQTT.

## REV-007 - Project lacked a repeatable quality command and safe environment template

- Status: Fixed baseline
- Prioritas: P2
- Kategori: Test, Documentation
- Lokasi: `package.json`, `.env.example`, `scripts/check-syntax.js`, README.
- Perbaikan: add `npm test`, `npm run check:syntax`, `npm run lint`, and `npm run check`; add a redacted environment template and setup documentation. ESLint now gates undefined variables, unreachable code, duplicate imports, and Promise misuse.
- Test: `npm run check` runs syntax, lint, and test.

## REV-008 - Backoffice user and owner audit identity accepted client-controlled values

- Status: Fixed with compatibility fallback
- Prioritas: P1
- Kategori: Data Integrity, Authorization
- Lokasi: `src/controller/users.js`, `src/controller/userOwner.js`, `src/utils/validation.js`.
- Bukti: create/update handlers required `createdBy` or `updatedBy` from request body, while both routes already require backoffice authentication and expose `req.user.username`.
- Dampak: an authenticated caller could record another username in audit columns.
- Perbaikan: `withAuthenticatedAuditUsername()` prefers the token username and only uses the body value as a fallback for non-route callers.
- Test: `test/userAudit.controller.test.js` verifies user create/update and owner update reject spoofed audit identity.

## REV-009 - Protected endpoint contract was not characterized across user/mobile domains

- Status: Fixed baseline
- Prioritas: P2
- Kategori: Test, Authorization
- Lokasi: `test/app.test.js` for users, user owner, kasir, mobile logout, and stok mitra routes.
- Bukti: different auth middleware styles were used across these routes, but their no-token behavior had not been asserted together.
- Perbaikan: characterization test now verifies each protected route returns 401 before entering database-dependent controller logic.
- Follow-up: add valid-token, inactive user, cross-mitra, and cross-cabang integration tests with an isolated database.

## REV-010 - Environment template was redundant with the requested local configuration flow

- Status: Fixed
- Prioritas: P3
- Kategori: Documentation
- Lokasi: deleted `.env.example`, updated `README.md`.
- Perbaikan: runtime documentation now refers directly to `.env`; the application continues to load it through `dotenv` in `src/server.js`.

## REV-011 - Menu update overwrote creation audit fields and delete interpolated input into SQL

- Status: Fixed
- Prioritas: P1
- Kategori: Security, Data Integrity, SQL
- Lokasi: `src/models/menus.js`, `src/controller/menus.js`.
- Bukti: delete built `WHERE id=${id}` directly; update wrote `createdBy` and `createdDate` although table exposes `modifiedBy` and `modifiedDate`.
- Perbaikan: delete now uses parameter binding; update writes the correct modified fields; create/update audit identity comes from the authenticated backoffice user.
- Test: `test/menus.controller.test.js` verifies authenticated audit identity.

## REV-012 - Cashier management accepted any mobile role and did not constrain every query by tenant

- Status: Fixed
- Prioritas: P1
- Kategori: Authorization, Data Isolation
- Lokasi: `src/routes/kasir.js`, `src/middleware/authorization.js`, `src/controller/kasir.js`, `src/models/kasir.js`.
- Bukti: `/api/owner/kasir` CRUD routes used mobile authentication only; several model reads/writes queried cashier IDs without an `idMitra` constraint.
- Perbaikan: cashier-management routes now require the owner role. List, read, update, delete, restore, device reset, and password change pass and enforce the authenticated owner tenant ID.
- Test: `test/authorization.middleware.test.js` verifies owner-only middleware behavior.

## REV-013 - Production dependency audit reports unresolved high-severity vulnerabilities

- Status: Fixed
- Prioritas: P1
- Kategori: Dependency, Security
- Lokasi: `package-lock.json` dependency tree.
- Bukti awal: audit menemukan dependency `bcrypt`/`tar` dan `nodemailer` rentan.
- Perbaikan: upgrade `bcrypt` ke 6.0.0 dan `nodemailer` ke 9.0.3 setelah regression test.
- Verifikasi: `npm audit --omit=dev --json` sekarang melaporkan 0 vulnerability.

## REV-014 - Cashier expense list was scoped only by branch

- Status: Fixed
- Prioritas: P1
- Kategori: Data Isolation
- Lokasi: `src/controller/cashflow.js`, `src/models/cashflow.js`.
- Bukti: kasir branch passed only `cabangId` to the expense list query, while the query did not constrain `p.idMitra`.
- Perbaikan: controller now forwards token `idMitra`; model filters by both branch and tenant.
- Test: `test/cashflow.controller.test.js` verifies both scope values are forwarded.

## REV-015 - Transaction test database and MQTT ACK verification

- Status: Fixed
- Prioritas: P2
- Kategori: Test, MQTT
- Evidence: isolated test schema rollback was verified. `test/mqttFakeBroker.test.js` uses an in-process fake MQTT client for success ACK, wrong request ID, negative ACK, timeout, connection close, and READY updates. `test/mqttAck.integration.test.js` remains an opt-in simulated device test against the approved broker on a unique `refactor-test/...` topic.
- Verification: `publishAndWaitAck` resolves only after a matching ACK request ID; no production device topic is used. The fake test runs by default while the remote broker test remains opt-in.

## REV-016 - Mobile authentication and tenant boundary lacked database-backed regression coverage

- Status: Fixed
- Prioritas: P1
- Kategori: Test, Authorization, Data Isolation
- Lokasi: `test/mobileAuth.integration.test.js`, schema `${DB_NAME}_refactor_test`.
- Perbaikan: integration fixture creates an active owner and inactive owner on the isolated schema, then verifies own-tenant access, cross-tenant rejection, and inactive-account rejection through HTTP.
- Verification: the fixture is deleted after test; the suite has since expanded beyond this original baseline.

## REV-017 - Core domain integration coverage was incomplete

- Status: Fixed for database-backed core flows; MQTT broker/device success flow remains deferred.
- Prioritas: P2
- Kategori: Test, Transaction
- Lokasi: `test/coreDomains.integration.test.js`, `test/mesin.model.test.js`.
- Perbaikan: isolated-schema HTTP tests now cover mesin CRUD, dashboard, akses, transaksi create/count/pending, owner/kasir history, and every cashflow endpoint. Mesin creation also has commit and rollback failure-injection tests.
- Test: `npm run check` executes the suite against `${DB_NAME}_refactor_test`.

## REV-018 - Quality gate lacked lint and documentation was not synchronized

- Status: Fixed baseline; legacy Postman examples remain an explicit follow-up.
- Prioritas: P2
- Kategori: Tooling, Documentation
- Lokasi: `eslint.config.js`, `package.json`, `README.md`, `docs/API_LIST.md`, Postman collection.
- Perbaikan: ESLint is part of `npm run check`; roadmap/inventory/findings now distinguish completed work from deferred broker/device and contract-refresh work; verified core requests are added to Postman.
- Test: `npm run check` and Postman JSON parse validation.

## REV-019 - MQTT and server lifecycle had no graceful cleanup

- Status: Fixed
- Prioritas: P2
- Kategori: Lifecycle, MQTT
- Lokasi: `src/utils/mqttStatusListener.js`, `src/server.js`, `test/serverShutdown.test.js`.
- Perbaikan: status listener has idempotent stop cleanup; `SIGTERM` and `SIGINT` close HTTP, MQTT, and database resources.
- Test: shutdown unit tests cover stop/restart, resource order, and signal registration.

## REV-020 - Absensi kasir accepted an arbitrary branch query without tenant scope

- Status: Fixed
- Prioritas: P1
- Kategori: Authorization, Data Isolation
- Lokasi: `src/routes/absensiKasir.js`, `src/routes/kasir.js`, `src/controller/kasir.js`, `src/models/kasir.js`.
- Bukti: seluruh mobile role dapat mengirim `cabangId` melalui query, sementara query absensi sebelumnya hanya memfilter `a.cabangId`.
- Dampak: kasir dapat meminta absensi cabang lain, termasuk cabang milik mitra berbeda.
- Perbaikan: kasir selalu dibatasi ke `cabangId` pada token; owner wajib memilih cabang yang diverifikasi terhadap `idMitra` token; query kini memfilter cabang dan tenant serta memastikan pengguna absensi berada pada tenant cabang yang sama.
- Test: `test/coreDomains.integration.test.js` membuktikan akses cabang sendiri berhasil, kasir lintas cabang ditolak, dan owner lintas mitra ditolak dengan HTTP 403.

## REV-021 - Owner/kasir route families lacked an explicit authorization matrix

- Status: Fixed for current owner/kasir route families; legacy machine-control alias remains a separate contract follow-up.
- Prioritas: P1
- Kategori: Authorization, Data Isolation
- Lokasi: `src/routes/{kasir,absensiKasir,history,historyKasir,hargaCabang,transaksi,cashflow}.js`, `src/middleware/authorization.js`, `src/controller/cashflow.js`, `src/models/cashflow.js`.
- Bukti: beberapa route berprefix owner/kasir hanya menjalankan autentikasi mobile. Kasir dapat meminta daftar pengeluaran cabang lain dalam mitra yang sama, dan owner/kasir belum secara konsisten ditolak pada route keluarga lawan.
- Perbaikan: tambahkan guard reusable `requireMobileKasir`; owner-only route memakai `requireMobileOwner`; kasir hanya dapat mengakses pengeluaran cabangnya sendiri sampai level list, detail, update, dan delete. Owner tetap dapat mengakses cabang lain dalam tenantnya.
- Test: `test/coreDomains.integration.test.js` memverifikasi 12 penolakan role/scope dan isolasi pengeluaran lintas cabang; `test/authorization.middleware.test.js` memverifikasi kedua guard role.

## REV-022 - Public authentication and password reset flow lacked abuse controls

- Status: Fixed
- Prioritas: P1
- Kategori: Authentication, Secret Management
- Lokasi: `src/config/environment.js`, `src/middleware/publicAuthRateLimit.js`, `src/utils/{email,publicAuth}.js`, `src/controller/{mobile,users,userOwner,kasir}.js`, dan route publik terkait.
- Bukti: login, activation, dan reset password publik tidak memiliki pembatas percobaan; reset mengembalikan 404 untuk akun yang tidak ada; pembuatan/verifikasi token email memakai fallback secret yang dapat diprediksi.
- Perbaikan: JWT secret kini wajib tersedia saat email token dibuat atau diverifikasi. Limiter in-memory per alamat IP membatasi login, activation, dan seluruh reset password bersama-sama. Reset password selalu menjawab HTTP 202 dengan pesan generik, baik akun tidak ada maupun email gagal terkirim.
- Test: `test/environment.config.test.js`, `test/publicAuthRateLimit.middleware.test.js`, dan `test/resetPassword.controller.test.js` membuktikan kegagalan secret eksplisit, window limiter, dan respons reset yang identik.

## PRE verification matrix

| PRE | Final status | Evidence |
|---|---|---|
| PRE-001 | Fixed | REV-001 |
| PRE-002 | Rejected | Stok mitra verification below |
| PRE-003 | Fixed for reviewed audit routes | REV-004, REV-008 |
| PRE-004 | Fixed for confirmed sensitive logs | REV-003; structured logging deferred |
| PRE-005 | Fixed | REV-002 |
| PRE-006 | Fixed | REV-007, REV-018 |
| PRE-007 | Fixed for pilot; deferred repository-wide | REV-005 |
| PRE-008 | Fixed for pilot; deferred repository-wide | REV-005 |
| PRE-009 | Deferred | Large-model decomposition needs contract capture |
| PRE-010 | Deferred | Response/token contract normalization is not repository-wide |
| PRE-011 | Deferred | Timezone storage policy remains undecided |
| PRE-012 | Deferred | Explicit-column migration needs response snapshots |
| PRE-013 | Deferred | Both machine-control paths remain supported aliases |
| PRE-014 | Fixed | Configured CORS and startup validation in REV-006 |
| PRE-015 | Deferred | npm is standardized; frontend dependency usage still needs audit |
| PRE-016 | Fixed baseline; device parity deferred | REV-015, REV-019 |
| PRE-017 | Fixed baseline | README and quality instructions updated |
| PRE-018 | Deferred | Operational logs/comments require domain-by-domain review |

## PRE-002 verification - Stok mitra route authentication

- Status: Rejected as current bug
- Evidence: `src/routes/settingStokMitra.js` applies `router.use(authenticateMobile)` and controller checks owner role plus `idMitra` ownership.
- Decision: do not change this route without a separate contract review.

## Formal batch disposition

- Status: Accepted/Deferred register recorded
- Lokasi: `docs/code-review/refactor-roadmap.md`.
- Keputusan: Batch C, G, dan H diterima untuk checkout ini karena mitigasi yang menjadi tujuan scope telah dibuktikan oleh REV-002, REV-020, REV-021, serta fake MQTT coverage pada REV-015. Batch D, F, dan I didefer secara eksplisit karena memerlukan keputusan business/operasional atau contract capture sebelum perubahan aman dilakukan.
- Batasan: status `Accepted` bukan `Completed`; ia tidak menghapus technical debt yang dipisahkan ke task berikutnya. Status `Deferred` memiliki trigger pembukaan dan bukti penutupan yang wajib dipenuhi.
- Bukti: formal disposition register memuat alasan, trigger pembukaan, dan required closure evidence untuk seluruh batch terkait.
