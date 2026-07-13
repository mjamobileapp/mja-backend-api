const fs = require("fs");
const path = require("path");

const collectionPath = path.join(__dirname, "..", "docs", "api-MJAProject.postman_collection.json");
const isWriteMode = process.argv.includes("--write");
const catalogName = "Backoffice route catalog";
const verifiedName = "Verified core API contract";

const catalogDescription = [
  "Katalog route backoffice yang telah disinkronkan dengan mount dan file route aktif.",
  "Isi variable koleksi sebelum mengirim request. Request katalog tervalidasi terhadap contract path/method dan payload JSON, tetapi tidak diklaim sebagai smoke test runtime satu per satu.",
  "Gunakan folder Verified core API contract untuk request yang memiliki bukti controller atau integration test.",
].join(" ");

const verifiedDescription = [
  "Request di folder ini memiliki bukti controller atau integration test.",
  "Gunakan token sesuai domain dan ganti placeholder ID sebelum mengirim request.",
].join(" ");

const requiredVariables = [
  ["baseUrl", "http://localhost:9090"],
  ["backofficeToken", ""],
  ["ownerToken", ""],
  ["kasirToken", ""],
  ["username", ""],
  ["password", ""],
  ["roleId", ""],
  ["mitraId", ""],
  ["cabangId", ""],
  ["mesinId", ""],
  ["espId", ""],
  ["itemId", ""],
  ["ownerId", ""],
  ["ownerEmail", "owner@example.test"],
  ["backofficeUserId", ""],
  ["backofficeUsername", ""],
  ["menuId", ""],
  ["resetEmail", "user@example.test"],
];

const publicCatalogRequests = new Set([
  "Auth / Login",
  "Utility / Root",
  "Master Data / User Owner / Reset Password User Owner",
]);

const catalogUrlReplacements = [
  [/\/api\/backoffice\/akses\/role\/\d+$/, "/api/backoffice/akses/role/{{roleId}}"],
  [/\/api\/backoffice\/akses\/user\/[^/?]+$/, "/api/backoffice/akses/user/{{backofficeUsername}}"],
  [/\/api\/backoffice\/mitra\/\d+(\/restore)?$/, "/api/backoffice/mitra/{{mitraId}}$1"],
  [/\/api\/backoffice\/cabang\/mitra\/\d+$/, "/api/backoffice/cabang/mitra/{{mitraId}}"],
  [/\/api\/backoffice\/cabang\/\d+(\/restore)?$/, "/api/backoffice/cabang/{{cabangId}}$1"],
  [/\/api\/backoffice\/mesin\/mitra\/\d+$/, "/api/backoffice/mesin/mitra/{{mitraId}}"],
  [/\/api\/backoffice\/mesin\/cabang\/\d+$/, "/api/backoffice/mesin/cabang/{{cabangId}}"],
  [/\/api\/backoffice\/mesin\/\d+(\/restore)?$/, "/api/backoffice/mesin/{{mesinId}}$1"],
  [/\/api\/backoffice\/item\/\d+(\/restore)?$/, "/api/backoffice/item/{{itemId}}$1"],
  [/\/api\/backoffice\/userowner\/\d+\/(changepassword|resetdeviceid)$/, "/api/backoffice/userowner/{{ownerId}}/$1"],
  [/\/api\/backoffice\/userowner\/\d+(\/restore)?$/, "/api/backoffice/userowner/{{ownerId}}$1"],
  [/\/api\/backoffice\/users\/\d+(\/restore)?$/, "/api/backoffice/users/{{backofficeUserId}}$1"],
  [/\/api\/backoffice\/roles\/\d+$/, "/api/backoffice/roles/{{roleId}}"],
  [/\/api\/backoffice\/menus\/\d+$/, "/api/backoffice/menus/{{menuId}}"],
];

const specialCatalogBodies = {
  "Master Data / Mesin / Create Mesin": {
    idMitra: "{{mitraId}}",
    cabangId: "{{cabangId}}",
    espId: "{{espId}}",
    washer: 1,
    dryer: 0,
  },
  "Master Data / Mesin / Update Mesin": {
    idMitra: "{{mitraId}}",
    cabangId: "{{cabangId}}",
    espId: "{{espId}}",
    washer: 1,
    dryer: 1,
  },
  "Master Data / User Owner / Reset Password User Owner": null,
  "Setting / Users Backoffice / Restore User": null,
};

const getRequestUrl = (request) => (typeof request.url === "string" ? request.url : request.url.raw);

const getLeafRequests = (items, parents = []) =>
  items.flatMap((item) => {
    if (item.item) return getLeafRequests(item.item, [...parents, item.name]);
    return [{ item, parents: [...parents, item.name] }];
  });

const getCatalogKey = (parents) => parents.slice(1).join(" / ");

const bearerAuth = (variable) => ({
  type: "bearer",
  bearer: [{ key: "token", value: `{{${variable}}}`, type: "string" }],
});

const noAuth = () => ({ type: "noauth" });

const normalizeUrl = (url, key) => {
  if (key === "Master Data / User Owner / Reset Password User Owner") {
    return "{{baseUrl}}/api/backoffice/userowner/{{ownerEmail}}/resetpassword";
  }

  let normalized = url;
  for (const [pattern, replacement] of catalogUrlReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
};

const parseLegacyJson = (raw) => JSON.parse(raw.replace(/\s*\/\/[^\n]*/g, ""));

const normalizeBody = (request, key) => {
  if (Object.prototype.hasOwnProperty.call(specialCatalogBodies, key)) {
    const body = specialCatalogBodies[key];
    if (body === null) {
      delete request.body;
      return;
    }
    request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
    return;
  }

  if (!request.body || request.body.mode !== "raw" || !request.body.raw.trim()) return;

  const body = parseLegacyJson(request.body.raw);
  if (!Array.isArray(body)) {
    delete body.createdBy;
    delete body.updatedBy;
    if (Object.prototype.hasOwnProperty.call(body, "idMitra")) body.idMitra = "{{mitraId}}";
    if (Object.prototype.hasOwnProperty.call(body, "cabangId")) body.cabangId = "{{cabangId}}";
    if (Object.prototype.hasOwnProperty.call(body, "roleId")) body.roleId = "{{roleId}}";
  }
  request.body.raw = JSON.stringify(body, null, 2);
};

const normalizeCatalog = (catalog) => {
  catalog.name = catalogName;
  catalog.description = catalogDescription;
  catalog.auth = bearerAuth("backofficeToken");

  for (const { item, parents } of getLeafRequests(catalog.item, [catalog.name])) {
    const key = getCatalogKey(parents);
    item.request.url = normalizeUrl(getRequestUrl(item.request), key);
    normalizeBody(item.request, key);
    item.request.auth = publicCatalogRequests.has(key) ? noAuth() : undefined;
    if (item.request.auth === undefined) delete item.request.auth;
  }
};

const normalizeVerified = (verified) => {
  verified.description = verifiedDescription;
  for (const { item } of getLeafRequests(verified.item)) {
    if (item.name.startsWith("Public -")) {
      item.request.auth = noAuth();
    } else if (item.name.startsWith("Backoffice -")) {
      item.request.auth = bearerAuth("backofficeToken");
    } else if (item.name.startsWith("Owner -")) {
      item.request.auth = bearerAuth("ownerToken");
    } else {
      item.request.auth = bearerAuth("kasirToken");
    }
  }
};

const normalizeCollection = (collection) => {
  const catalog = collection.item.find((item) => item.name === "Backoffice" || item.name === catalogName);
  const verified = collection.item.find((item) => item.name === verifiedName);
  if (!catalog || !verified) throw new Error("Folder katalog atau verified core tidak ditemukan.");

  collection.info.description = "Koleksi API MJA Project. Folder route catalog tersinkron dengan route aktif; folder verified memiliki bukti test.";
  collection.auth = noAuth();
  const existingVariables = new Map((collection.variable || []).map((entry) => [entry.key, entry]));
  collection.variable = requiredVariables.map(([key, value]) => ({
    ...(existingVariables.get(key) || {}),
    key,
    value,
  }));
  normalizeCatalog(catalog);
  normalizeVerified(verified);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertPostmanCollection = (collection) => {
  const catalog = collection.item.find((item) => item.name === catalogName);
  const verified = collection.item.find((item) => item.name === verifiedName);
  assert(catalog, `Folder ${catalogName} tidak ditemukan.`);
  assert(verified, `Folder ${verifiedName} tidak ditemukan.`);
  assert(getLeafRequests(catalog.item).length === 63, "Route catalog harus berisi tepat 63 request.");
  assert(getLeafRequests(verified.item).length === 13, "Verified core API contract harus berisi tepat 13 request.");

  const variableKeys = new Set((collection.variable || []).map((entry) => entry.key));
  for (const [key] of requiredVariables) assert(variableKeys.has(key), `Variable ${key} belum ada.`);

  for (const { item, parents } of getLeafRequests(catalog.item, [catalog.name])) {
    const key = getCatalogKey(parents);
    const url = getRequestUrl(item.request);
    assert(url.startsWith("{{baseUrl}}/"), `Base URL tidak valid pada ${key}.`);
    assert(!/\/\d+(?:\/|$|\?)/.test(url), `ID hard-coded masih ada pada ${key}.`);
    if (publicCatalogRequests.has(key)) {
      assert(item.request.auth?.type === "noauth", `Request public ${key} harus noauth.`);
    }
    if (item.request.body?.mode === "raw" && item.request.body.raw.trim()) {
      JSON.parse(item.request.body.raw);
    }
  }

  for (const { item } of getLeafRequests(verified.item)) {
    const url = getRequestUrl(item.request);
    assert(url.startsWith("{{baseUrl}}/"), `Base URL verified tidak valid pada ${item.name}.`);
  }
};

const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));
if (isWriteMode) {
  normalizeCollection(collection);
  fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
}
assertPostmanCollection(collection);
console.log(`Postman collection valid: 63 route catalog request, 13 verified request${isWriteMode ? " (refreshed)" : ""}.`);
