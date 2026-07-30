const assert = require("node:assert/strict");
const test = require("node:test");
const dbPool = require("../src/config/database");
const RoleModels = require("../src/models/roles");
const RoleController = require("../src/controller/roles");

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

test("role model binds IDs for get and delete queries", async () => {
  const originalExecute = dbPool.execute;
  const calls = [];
  dbPool.execute = async (query, values) => {
    calls.push({ query, values });
    return [[], {}];
  };

  try {
    await RoleModels.getRoleById(7);
    await RoleModels.deleteRole(7);

    assert.deepEqual(calls, [
      { query: "SELECT * FROM tbl_role WHERE id = ?", values: [7] },
      { query: "DELETE FROM tbl_role WHERE id = ?", values: [7] },
    ]);
  } finally {
    dbPool.execute = originalExecute;
  }
});

test("role controllers reject SQL-injection-shaped IDs before calling the model", async () => {
  const original = {
    get: RoleModels.getRoleById,
    update: RoleModels.updateRole,
    remove: RoleModels.deleteRole,
  };
  let modelCallCount = 0;
  RoleModels.getRoleById = async () => {
    modelCallCount += 1;
  };
  RoleModels.updateRole = async () => {
    modelCallCount += 1;
  };
  RoleModels.deleteRole = async () => {
    modelCallCount += 1;
  };

  try {
    const injectionId = "1 OR 1=1";
    const requests = [
      [RoleController.getRoleById, { params: { idRole: injectionId } }],
      [
        RoleController.updateRole,
        {
          params: { idRole: injectionId },
          body: { namaRole: "Operator", description: "Operator" },
          user: { username: "admin" },
        },
      ],
      [RoleController.deleteRole, { params: { idRole: injectionId } }],
    ];

    for (const [controller, request] of requests) {
      const response = createResponse();
      await controller(request, response);
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, { message: "idRole harus berupa integer positif" });
    }

    assert.equal(modelCallCount, 0);
  } finally {
    RoleModels.getRoleById = original.get;
    RoleModels.updateRole = original.update;
    RoleModels.deleteRole = original.remove;
  }
});
