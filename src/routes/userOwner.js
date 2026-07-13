const express = require("express");
const UserOwnerController = require("../controller/userOwner");
const { authenticate } = require("../middleware/auth");
const { publicPasswordResetRateLimiter } = require("../middleware/publicAuthRateLimit");

const router = express.Router();

// Endpoint untuk membuat user owner baru
router.post("/", authenticate, UserOwnerController.createNewUserOwner);
router.get("/", authenticate, UserOwnerController.getAllUserOwner);
router.get("/:id", authenticate, UserOwnerController.getUserOwnerById);
router.put("/:id", authenticate, UserOwnerController.updateUserOwner);
router.put("/:id/resetdeviceid", authenticate, UserOwnerController.resetDeviceId);
router.post("/:id/changepassword", authenticate, UserOwnerController.changePassword);
router.post("/:email/resetpassword", publicPasswordResetRateLimiter, UserOwnerController.resetPassword);
router.delete("/:id", authenticate, UserOwnerController.deleteUserOwner);
router.post("/:id/restore", authenticate, UserOwnerController.restoreUserOwner);

module.exports = router;
