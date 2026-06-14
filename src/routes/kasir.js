const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// Endpoint untuk membuat user kasir baru
router.post("/", authenticateMobile, KasirController.createNewUserKasir);
router.get("/", authenticateMobile, KasirController.getAllUserKasir);
router.get("/:id", authenticateMobile, KasirController.getUserKasirById);
router.put("/:id", authenticateMobile, KasirController.updateUserKasir);
router.put("/:id/resetdeviceid", authenticateMobile, KasirController.resetDeviceId);
router.post("/:id/changepassword", authenticateMobile, KasirController.changePassword);
router.post("/:email/resetpassword", KasirController.resetPassword);
router.delete("/:id", authenticateMobile, KasirController.deleteUserKasir);
router.post("/:id/restore", authenticateMobile, KasirController.restoreUserKasir);

module.exports = router;
