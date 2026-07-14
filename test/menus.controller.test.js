const assert = require("node:assert/strict");
const test = require("node:test");
const MasterMenuModel = require("../src/models/menus");
const MenuController = require("../src/controller/menus");
const { createHttpError } = require("../src/utils/httpError");

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

test("menu controller forwards model errors for catchAsync", async () => {
  const originalGetAll = MasterMenuModel.getAll;
  const expectedError = createHttpError(503, "database unavailable", "MENU_STORAGE_UNAVAILABLE");
  MasterMenuModel.getAll = async () => { throw expectedError; };
  try {
    await assert.rejects(MenuController.getAll({}, createResponse()), (error) => error === expectedError);
  } finally {
    MasterMenuModel.getAll = originalGetAll;
  }
});

test("menu create and update use authenticated audit identity", async () => {
  const originalCreate = MasterMenuModel.createNewMenu;
  const originalUpdate = MasterMenuModel.updateMenu;
  const received = {};
  MasterMenuModel.createNewMenu = async (payload) => {
    received.create = payload;
  };
  MasterMenuModel.updateMenu = async (payload, id) => {
    received.update = { id, ...payload };
  };

  try {
    const user = { username: "authenticated-admin" };
    await MenuController.createNewMenu(
      { body: { namaMenu: "Dashboard", url: "/dashboard", createdBy: "spoofed" }, user },
      createResponse()
    );
    await MenuController.updateMenu(
      { params: { id: "5" }, body: { namaMenu: "Dashboard", url: "/dashboard", modifiedBy: "spoofed" }, user },
      createResponse()
    );

    assert.equal(received.create.createdBy, "authenticated-admin");
    assert.equal(received.update.modifiedBy, "authenticated-admin");
  } finally {
    MasterMenuModel.createNewMenu = originalCreate;
    MasterMenuModel.updateMenu = originalUpdate;
  }
});
