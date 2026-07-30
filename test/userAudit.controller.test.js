const assert = require("node:assert/strict");
const test = require("node:test");
const UsersModel = require("../src/models/users");
const UserOwnerModel = require("../src/models/userOwner");
const UserController = require("../src/controller/users");
const UserOwnerController = require("../src/controller/userOwner");

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

test("backoffice user create uses authenticated audit identity", async () => {
  const originalCreate = UsersModel.createNewUser;
  let receivedPayload;
  UsersModel.createNewUser = async (payload) => {
    receivedPayload = payload;
    return payload;
  };

  try {
    const res = createResponse();
    await UserController.createNewUser(
      {
        body: { nama: "Admin", username: "adminbaru", password: "secret", roleId: 1, createdBy: "spoofed" },
        user: { username: "authenticated-admin" },
      },
      res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(receivedPayload.createdBy, "authenticated-admin");
  } finally {
    UsersModel.createNewUser = originalCreate;
  }
});

test("backoffice user update uses authenticated audit identity", async () => {
  const originalUpdate = UsersModel.updateUser;
  let receivedPayload;
  UsersModel.updateUser = async (payload) => {
    receivedPayload = payload;
  };

  try {
    const res = createResponse();
    await UserController.updateUser(
      {
        params: { id: "8" },
        body: { nama: "Admin", username: "adminbaru", roleId: 1, updatedBy: "spoofed" },
        user: { username: "authenticated-admin" },
      },
      res
    );

    assert.equal(res.body.message, "UPDATE Users success");
    assert.equal(receivedPayload.updatedBy, "authenticated-admin");
  } finally {
    UsersModel.updateUser = originalUpdate;
  }
});

test("user owner update uses authenticated audit identity", async () => {
  const originalUpdate = UserOwnerModel.updateUserOwner;
  let receivedPayload;
  UserOwnerModel.updateUserOwner = async (id, payload) => {
    receivedPayload = { id, ...payload };
    return receivedPayload;
  };

  try {
    const res = createResponse();
    await UserOwnerController.updateUserOwner(
      {
        params: { id: "11" },
        body: {
          namaLengkap: "Owner Baru",
          noTelp: "08123456789",
          email: "owner@example.test",
          updatedBy: "spoofed",
        },
        user: { username: "authenticated-admin" },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(receivedPayload.updatedBy, "authenticated-admin");
  } finally {
    UserOwnerModel.updateUserOwner = originalUpdate;
  }
});
