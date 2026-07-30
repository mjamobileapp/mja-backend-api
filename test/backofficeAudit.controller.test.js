const assert = require("node:assert/strict");
const test = require("node:test");
const RoleModels = require("../src/models/roles");
const MitraModel = require("../src/models/mitra");
const CabangModel = require("../src/models/cabang");
const RoleController = require("../src/controller/roles");
const MitraController = require("../src/controller/mitra");
const CabangController = require("../src/controller/cabang");

const createResponse = () => ({
  statusCode: 200,
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

test("role, mitra, and cabang use the authenticated username for audit columns", async () => {
  const original = {
    createRole: RoleModels.createNewRole,
    createMitra: MitraModel.createNewMitra,
    updateCabang: CabangModel.updateCabang,
  };
  const received = {};

  RoleModels.createNewRole = async (payload) => {
    received.role = payload;
  };
  MitraModel.createNewMitra = async (payload) => {
    received.mitra = payload;
    return payload;
  };
  CabangModel.updateCabang = async (id, payload) => {
    received.cabang = { id, ...payload };
    return received.cabang;
  };

  try {
    const user = { username: "authenticated-admin" };
    await RoleController.createNewRole(
      { body: { namaRole: "Operator", description: "Operator", createdBy: "spoofed" }, user },
      createResponse()
    );
    await MitraController.createNewMitra(
      { body: { namaMitra: "Mitra A", alamatMitra: "Jakarta", createdBy: "spoofed" }, user },
      createResponse()
    );
    await CabangController.updateCabang(
      { params: { id: "3" }, body: { namaCabang: "Cabang A", alamatCabang: "Jakarta", updatedBy: "spoofed" }, user },
      createResponse()
    );

    assert.equal(received.role.createdBy, "authenticated-admin");
    assert.equal(received.mitra.createdBy, "authenticated-admin");
    assert.equal(received.cabang.updatedBy, "authenticated-admin");
  } finally {
    RoleModels.createNewRole = original.createRole;
    MitraModel.createNewMitra = original.createMitra;
    CabangModel.updateCabang = original.updateCabang;
  }
});
