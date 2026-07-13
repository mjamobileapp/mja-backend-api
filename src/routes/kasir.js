const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");

const router = express.Router();

router.get("/absensi", authenticateMobile, KasirController.getAbsensiKasir);
router.post("/", authenticateMobile, requireMobileOwner, KasirController.createNewUserKasir);
router.get("/", authenticateMobile, requireMobileOwner, KasirController.getAllUserKasir);
router.get("/:id", authenticateMobile, requireMobileOwner, KasirController.getUserKasirById);
router.put("/:id", authenticateMobile, requireMobileOwner, KasirController.updateUserKasir);
router.put("/:id/resetdeviceid", authenticateMobile, requireMobileOwner, KasirController.resetDeviceId);
router.post("/:id/changepassword", authenticateMobile, requireMobileOwner, KasirController.changePassword);
router.post("/:email/resetpassword", KasirController.resetPassword);
router.delete("/:id", authenticateMobile, requireMobileOwner, KasirController.deleteUserKasir);
router.post("/:id/restore", authenticateMobile, requireMobileOwner, KasirController.restoreUserKasir);

module.exports = router;

