const assert = require("node:assert/strict");
const test = require("node:test");
const { createMasterItemController } = require("../src/controller/masterItem");
const { getMissingRequiredFields } = require("../src/utils/validation");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("master item create uses the authenticated username instead of spoofed body audit data", async () => {
  let receivedPayload;
  const controller = createMasterItemController({
    createNewMasterItem: async (payload) => {
      receivedPayload = payload;
      return payload;
    },
  });
  const res = createResponse();

  await controller.createNewMasterItem(
    {
      body: { namaItem: "Deterjen", tipeItem: "stok", createdBy: "spoofed-user" },
      user: { username: "authenticated-user" },
    },
    res
  );

  assert.equal(receivedPayload.createdBy, "authenticated-user");
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.createdBy, "authenticated-user");
});

test("master item update uses the authenticated username instead of spoofed body audit data", async () => {
  let receivedPayload;
  const controller = createMasterItemController({
    updateMasterItem: async (id, payload) => {
      receivedPayload = { id, ...payload };
      return receivedPayload;
    },
  });
  const res = createResponse();

  await controller.updateMasterItem(
    {
      params: { id: "12" },
      body: { namaItem: "Pewangi", tipeItem: "stok", updatedBy: "spoofed-user" },
      user: { username: "authenticated-user" },
    },
    res
  );

  assert.equal(receivedPayload.updatedBy, "authenticated-user");
  assert.equal(res.statusCode, 200);
});

test("master item duplicate error is propagated to the global error handler", async () => {
  const controller = createMasterItemController({
    createNewMasterItem: async () => {
      throw createHttpError(409, "Master Item sudah terdaftar", "MASTER_ITEM_DUPLICATE");
    },
  });
  const res = createResponse();

  await assert.rejects(
    controller.createNewMasterItem(
      {
        body: { namaItem: "Deterjen", tipeItem: "stok" },
        user: { username: "authenticated-user" },
      },
      res
    ),
    (error) => error.statusCode === 409 && error.code === "MASTER_ITEM_DUPLICATE"
  );

  assert.equal(res.statusCode, null);
});

test("master item list forwards each supported status filter", async () => {
  const receivedStatuses = [];
  const controller = createMasterItemController({
    getAllMasterItem: async (status) => {
      receivedStatuses.push(status);
      return [{ id: receivedStatuses.length, status }];
    },
  });

  for (const status of [undefined, "all", "inactive"]) {
    const res = createResponse();
    await controller.getAllMasterItem({ query: { status } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Get All Master Item success");
    assert.equal(res.body.data[0].status, status);
  }

  assert.deepEqual(receivedStatuses, [undefined, "all", "inactive"]);
});

test("master item get by ID returns the model result", async () => {
  let receivedId;
  const controller = createMasterItemController({
    getMasterItemById: async (id) => {
      receivedId = id;
      return { id, namaItem: "Deterjen" };
    },
  });
  const res = createResponse();

  await controller.getMasterItemById({ params: { id: "12" } }, res);

  assert.equal(receivedId, "12");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, { id: "12", namaItem: "Deterjen" });
});

test("master item get by tipe returns active item data and rejects an invalid type", async () => {
  let receivedType;
  const controller = createMasterItemController({
    getMasterItemByTipe: async (tipeItem) => {
      receivedType = tipeItem;
      return [{ id: 5, tipeItem }];
    },
  });
  const validResponse = createResponse();
  const invalidResponse = createResponse();

  await controller.getMasterItemByTipe({ params: { tipeItem: "stok" } }, validResponse);
  await controller.getMasterItemByTipe({ params: { tipeItem: "invalid" } }, invalidResponse);

  assert.equal(receivedType, "stok");
  assert.equal(validResponse.statusCode, 200);
  assert.deepEqual(validResponse.body.data, [{ id: 5, tipeItem: "stok" }]);
  assert.equal(invalidResponse.statusCode, 400);
  assert.deepEqual(invalidResponse.body, { error: "Tipe item tidak valid. Gunakan 'stok' atau 'non_stok'." });
});

test("master item delete and restore use the authenticated username", async () => {
  const calls = [];
  const controller = createMasterItemController({
    deleteMasterItem: async (id, username) => calls.push({ action: "delete", id, username }),
    restoreMasterItem: async (id, username) => calls.push({ action: "restore", id, username }),
  });
  const deleteResponse = createResponse();
  const restoreResponse = createResponse();
  const req = { params: { id: "12" }, user: { username: "authenticated-user" } };

  await controller.deleteMasterItem(req, deleteResponse);
  await controller.restoreMasterItem(req, restoreResponse);

  assert.deepEqual(calls, [
    { action: "delete", id: "12", username: "authenticated-user" },
    { action: "restore", id: "12", username: "authenticated-user" },
  ]);
  assert.deepEqual(deleteResponse.body, { message: "Delete Master Item success", data: null });
  assert.deepEqual(restoreResponse.body, { message: "Restore Master Item success", data: null });
});

test("master item not-found error is propagated to the global error handler", async () => {
  const controller = createMasterItemController({
    getMasterItemById: async () => {
      throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
    },
  });
  const res = createResponse();

  await assert.rejects(
    controller.getMasterItemById({ params: { id: "404" } }, res),
    (error) => error.statusCode === 404 && error.code === "MASTER_ITEM_NOT_FOUND"
  );

  assert.equal(res.statusCode, null);
});

test("shared required-field validation accepts zero and false values", () => {
  assert.deepEqual(getMissingRequiredFields({ quantity: 0, isActive: false, name: "item" }, ["quantity", "isActive", "name"]), []);
  assert.deepEqual(getMissingRequiredFields({ quantity: null, name: "   " }, ["quantity", "name"]), ["quantity", "name"]);
});
