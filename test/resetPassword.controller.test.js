const assert = require("node:assert/strict");
const test = require("node:test");
const EmailService = require("../src/utils/email");
const UsersModel = require("../src/models/users");
const UserOwnerModel = require("../src/models/userOwner");
const KasirModel = require("../src/models/kasir");
const UserController = require("../src/controller/users");
const UserOwnerController = require("../src/controller/userOwner");
const KasirController = require("../src/controller/kasir");
const { RESET_PASSWORD_ACCEPTED_MESSAGE } = require("../src/utils/publicAuth");

const createResponse = () => ({
  statusCode: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("reset password returns the same accepted response for existing and unknown accounts", async () => {
  const original = {
    sendResetPasswordEmail: EmailService.sendResetPasswordEmail,
    resetBackoffice: UsersModel.resetPassword,
    resetOwner: UserOwnerModel.resetPassword,
    resetKasir: KasirModel.resetPassword,
  };
  const deliveryError = new Error("invalid_grant");

  EmailService.sendResetPasswordEmail = async () => {
    throw deliveryError;
  };
  UsersModel.resetPassword = async () => ({ username: "backoffice@example.test", email: "backoffice@example.test" });
  UserOwnerModel.resetPassword = async () => ({ username: "owner@example.test", email: "owner@example.test", role: "owner" });
  KasirModel.resetPassword = async () => ({ username: "kasir@example.test", email: "kasir@example.test" });

  try {
    const controllers = [
      { controller: UserController, model: UsersModel, notFoundMessage: "Email tidak ditemukan" },
      { controller: UserOwnerController, model: UserOwnerModel, notFoundMessage: "data not found" },
      { controller: KasirController, model: KasirModel, notFoundMessage: "data not found" },
    ];

    for (const { controller, model, notFoundMessage } of controllers) {
      const existingAccountResponse = createResponse();
      await controller.resetPassword({ params: { email: "user@example.test" } }, existingAccountResponse);

      assert.equal(existingAccountResponse.statusCode, 202);
      assert.deepEqual(existingAccountResponse.body, { message: RESET_PASSWORD_ACCEPTED_MESSAGE });

      const originalResetPassword = model.resetPassword;
      model.resetPassword = async () => {
        throw new Error(notFoundMessage);
      };

      const unknownAccountResponse = createResponse();
      await controller.resetPassword({ params: { email: "unknown@example.test" } }, unknownAccountResponse);

      assert.equal(unknownAccountResponse.statusCode, 202);
      assert.deepEqual(unknownAccountResponse.body, existingAccountResponse.body);
      model.resetPassword = originalResetPassword;
    }
  } finally {
    EmailService.sendResetPasswordEmail = original.sendResetPasswordEmail;
    UsersModel.resetPassword = original.resetBackoffice;
    UserOwnerModel.resetPassword = original.resetOwner;
    KasirModel.resetPassword = original.resetKasir;
  }
});
