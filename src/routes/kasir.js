const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");
const { publicPasswordResetRateLimiter } = require("../middleware/publicAuthRateLimit");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.get("/absensi", authenticateMobile, requireMobileOwner, catchAsync(KasirController.getAbsensiKasir));
router.post("/", authenticateMobile, requireMobileOwner, catchAsync(KasirController.createNewUserKasir));
router.get("/", authenticateMobile, requireMobileOwner, catchAsync(KasirController.getAllUserKasir));
router.get("/:id", authenticateMobile, requireMobileOwner, catchAsync(KasirController.getUserKasirById));
router.put("/:id", authenticateMobile, requireMobileOwner, catchAsync(KasirController.updateUserKasir));
router.put("/:id/resetdeviceid", authenticateMobile, requireMobileOwner, catchAsync(KasirController.resetDeviceId));
router.post("/:id/changepassword", authenticateMobile, requireMobileOwner, catchAsync(KasirController.changePassword));
router.post("/:email/resetpassword", publicPasswordResetRateLimiter, catchAsync(KasirController.resetPassword));
router.delete("/:id", authenticateMobile, requireMobileOwner, catchAsync(KasirController.deleteUserKasir));
router.post("/:id/restore", authenticateMobile, requireMobileOwner, catchAsync(KasirController.restoreUserKasir));

module.exports = router;

