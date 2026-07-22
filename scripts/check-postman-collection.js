const fs = require("fs");
const path = require("path");

const collectionPath = path.join(__dirname, "..", "docs", "api-MJAProject.postman_collection.json");
const appPath = path.join(__dirname, "..", "src", "app.js");
const routesDirectory = path.join(__dirname, "..", "src", "routes");
const isWriteMode = process.argv.includes("--write");
const catalogName = "Backoffice route catalog";
const verifiedName = "Verified core API contract";
const sourceCoverageName = "Route source coverage";

const catalogDescription = [
  "Katalog route backoffice dibandingkan dua arah dengan mount dan file route aktif.",
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
  ["mesinDetailId", ""],
  ["tipeItem", ""],
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
const publicCatalogRouteKeys = new Set([
  "POST /api/backoffice/login",
  "GET /",
  "POST /api/backoffice/userowner/:param/resetpassword",
  "POST /api/backoffice/users/:param/resetpassword",
  "GET /api/backoffice/appversion",
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

const httpMethods = ["get", "post", "put", "patch", "delete"];

const normalizeRoutePath = (routePath) => {
  const withoutQuery = routePath.split("?")[0];
  const normalized = withoutQuery.replace(/\{\{[^}]+\}\}/g, ":param").replace(/:[A-Za-z0-9_]+/g, ":param");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
};

const routeKey = (method, routePath) => `${method.toUpperCase()} ${normalizeRoutePath(routePath)}`;

const getCatalogSourceRoutes = () => {
  const appSource = fs.readFileSync(appPath, "utf8");
  const importedRouteFiles = new Map(
    [...appSource.matchAll(/const\s+(\w+)\s*=\s*require\(["']\.\/routes\/(\w+)["']\);/g)].map((match) => [match[1], match[2]])
  );
  const sourceRoutes = [];

  for (const match of appSource.matchAll(/app\.use\(\s*["'](\/api\/(?:backoffice\/[^"']+|report(?:\/[^"']*)?))["']\s*,\s*(\w+)\s*\);/g)) {
    const [, mountPath, routeVariable] = match;
    const routeFile = importedRouteFiles.get(routeVariable);
    assert(routeFile, `Route source untuk mount ${mountPath} tidak dapat ditemukan.`);

    const routerSource = fs.readFileSync(path.join(routesDirectory, `${routeFile}.js`), "utf8");
    const routePattern = new RegExp(`router\\.(${httpMethods.join("|")})\\(\\s*["']([^"']*)["']`, "g");
    for (const routeMatch of routerSource.matchAll(routePattern)) {
      const [, method, routePath] = routeMatch;
      sourceRoutes.push({
        method: method.toUpperCase(),
        path: `${mountPath}${routePath === "/" ? "" : routePath}`,
      });
    }
  }

  const directRoutePattern = new RegExp(`app\\.(${httpMethods.join("|")})\\(\\s*["'](\/[^"']*)["']`, "g");
  for (const routeMatch of appSource.matchAll(directRoutePattern)) {
    const [, method, routePath] = routeMatch;
    if (routePath === "/" || routePath.startsWith("/api/backoffice/")) {
      sourceRoutes.push({ method: method.toUpperCase(), path: routePath });
    }
  }

  return sourceRoutes;
};

const toPostmanUrl = (routePath) => {
  const replacements = [
    [/^\/api\/backoffice\/users\/:id/, "/api/backoffice/users/{{backofficeUserId}}"],
    [/^\/api\/backoffice\/users\/:email/, "/api/backoffice/users/{{resetEmail}}"],
    [/^\/api\/backoffice\/cabang\/:id/, "/api/backoffice/cabang/{{cabangId}}"],
    [/^\/api\/backoffice\/mesin\/list\/cabang\/:cabangId/, "/api/backoffice/mesin/list/cabang/{{cabangId}}"],
    [/^\/api\/backoffice\/mesin\/esp\/:espId/, "/api/backoffice/mesin/esp/{{espId}}"],
    [/^\/api\/backoffice\/mesin\/maintenance\/:idMesinDetail/, "/api/backoffice/mesin/maintenance/{{mesinDetailId}}"],
    [/^\/api\/backoffice\/mesin\/ready\/:idMesinDetail/, "/api/backoffice/mesin/ready/{{mesinDetailId}}"],
    [/^\/api\/backoffice\/item\/tipe\/:tipeItem/, "/api/backoffice/item/tipe/{{tipeItem}}"],
  ];

  let normalized = routePath;
  for (const [pattern, replacement] of replacements) normalized = normalized.replace(pattern, replacement);
  return `{{baseUrl}}${normalized.replace(/:([A-Za-z0-9_]+)/g, "{{$1}}")}`;
};

const createSourceCoverageRequest = ({ method, path: routePath }) => ({
  name: `${method} ${routePath}`,
  request: {
    method,
    header: [],
    url: toPostmanUrl(routePath),
  },
  response: [],
});

const syncSourceCoverage = (catalog) => {
  const sourceRoutes = getCatalogSourceRoutes();
  const documentedRouteKeys = new Set(
    getLeafRequests(catalog.item).map(({ item }) => routeKey(item.request.method, getRequestUrl(item.request).replace(/^\{\{baseUrl\}\}/, "")))
  );
  const missingSourceRoutes = sourceRoutes.filter((route) => !documentedRouteKeys.has(routeKey(route.method, route.path)));
  if (missingSourceRoutes.length === 0) return;

  let coverageFolder = catalog.item.find((item) => item.name === sourceCoverageName);
  if (!coverageFolder) {
    coverageFolder = { name: sourceCoverageName, description: "Request yang ditambahkan untuk menjaga cakupan route source.", item: [] };
    catalog.item.push(coverageFolder);
  }
  coverageFolder.item.push(...missingSourceRoutes.map(createSourceCoverageRequest));
};

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
    const isPublicRequest = publicCatalogRequests.has(key) || publicCatalogRouteKeys.has(routeKey(item.request.method, item.request.url.replace(/^\{\{baseUrl\}\}/, "")));
    item.request.auth = isPublicRequest ? noAuth() : undefined;
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
  syncSourceCoverage(catalog);
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
  assert(getLeafRequests(verified.item).length === 13, "Verified core API contract harus berisi tepat 13 request.");

  const pricingRequest = getLeafRequests(verified.item).find(({ item }) => item.name === "Kasir - Create transaksi");
  assert(pricingRequest, "Request pricing transaksi belum ada di Verified core API contract.");
  const pricingResponses = new Set((pricingRequest.item.response || []).map((response) => response.name));
  assert(pricingResponses.has("409 - TRANSACTION_PRICE_CHANGED"), "Response pricing TRANSACTION_PRICE_CHANGED belum terdokumentasi di Postman.");
  assert(pricingResponses.has("409 - TRANSACTION_PRICE_NOT_CONFIGURED"), "Response pricing TRANSACTION_PRICE_NOT_CONFIGURED belum terdokumentasi di Postman.");

  const variableKeys = new Set((collection.variable || []).map((entry) => entry.key));
  for (const [key] of requiredVariables) assert(variableKeys.has(key), `Variable ${key} belum ada.`);

  const catalogRequests = getLeafRequests(catalog.item, [catalog.name]);
  for (const { item, parents } of catalogRequests) {
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

  const sourceRouteKeys = new Set(getCatalogSourceRoutes().map((route) => routeKey(route.method, route.path)));
  const documentedRouteKeys = new Set(
    catalogRequests.map(({ item }) => routeKey(item.request.method, getRequestUrl(item.request).replace(/^\{\{baseUrl\}\}/, "")))
  );
  const undocumentedRoutes = [...sourceRouteKeys].filter((key) => !documentedRouteKeys.has(key));
  const staleRequests = [...documentedRouteKeys].filter((key) => !sourceRouteKeys.has(key));
  assert(undocumentedRoutes.length === 0, `Route source belum ada di Postman catalog: ${undocumentedRoutes.join(", ")}`);
  assert(staleRequests.length === 0, `Request Postman tidak ditemukan di route source: ${staleRequests.join(", ")}`);

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
console.log(
  `Postman collection valid: ${getLeafRequests(collection.item.find((item) => item.name === catalogName).item).length} route catalog request, ` +
    `${getCatalogSourceRoutes().length} source route, 13 verified request${isWriteMode ? " (refreshed)" : ""}.`
);
