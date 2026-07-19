const express = require("express");

const UserController = require("../controller/users.js");
const { publicPasswordResetRateLimiter } = require("../middleware/publicAuthRateLimit");

const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { requireBackofficeMenuAccess } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const requireUserBackofficeAccess = requireBackofficeMenuAccess("/settings/user-backoffice");

// CREATE - POST
router.post("/", authenticate, requireUserBackofficeAccess, catchAsync(UserController.createNewUser));
// Get By ID
router.get("/:id", authenticate, requireUserBackofficeAccess, catchAsync(UserController.getUserById));

// READ - GET
router.get("/", authenticate, requireUserBackofficeAccess, catchAsync(UserController.getAllUsers));

// UPDATE - PUT
router.put("/:id", authenticate, requireUserBackofficeAccess, catchAsync(UserController.updateUser));

// DELETE - DELETE
router.delete("/:id", authenticate, requireUserBackofficeAccess, catchAsync(UserController.deleteUser));

// RESTORE - POST
router.post("/:id/restore", authenticate, requireUserBackofficeAccess, catchAsync(UserController.restoreUser));

// CHANGE PASSWORD - POST
router.post("/:id/changepassword", authenticate, requireUserBackofficeAccess, catchAsync(UserController.changePassword));

// RESET PASSWORD - POST (Public/Tanpa Token)
router.post("/:email/resetpassword", publicPasswordResetRateLimiter, catchAsync(UserController.resetPassword));

module.exports = router;
