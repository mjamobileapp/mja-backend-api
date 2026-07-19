const express = require("express");
const UserOwnerController = require("../controller/userOwner");
const { authenticate } = require("../middleware/auth");
const { publicPasswordResetRateLimiter } = require("../middleware/publicAuthRateLimit");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// Endpoint untuk membuat user owner baru
router.post("/", authenticate, catchAsync(UserOwnerController.createNewUserOwner));
router.get("/", authenticate, catchAsync(UserOwnerController.getAllUserOwner));
router.get("/:id", authenticate, catchAsync(UserOwnerController.getUserOwnerById));
router.put("/:id", authenticate, catchAsync(UserOwnerController.updateUserOwner));
router.put("/:id/resetdeviceid", authenticate, catchAsync(UserOwnerController.resetDeviceId));
router.post("/:id/changepassword", authenticate, catchAsync(UserOwnerController.changePassword));
router.post("/:email/resetpassword", publicPasswordResetRateLimiter, catchAsync(UserOwnerController.resetPassword));
router.delete("/:id", authenticate, catchAsync(UserOwnerController.deleteUserOwner));
router.post("/:id/restore", authenticate, catchAsync(UserOwnerController.restoreUserOwner));

module.exports = router;
