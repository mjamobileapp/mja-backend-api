const express = require("express");

const UserController = require("../controller/users.js");
const { publicPasswordResetRateLimiter } = require("../middleware/publicAuthRateLimit");

const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { requireBackofficeMenuAccess } = require("../middleware/authorization");

const requireUserBackofficeAccess = requireBackofficeMenuAccess("/settings/user-backoffice");

// CREATE - POST
router.post("/", authenticate, requireUserBackofficeAccess, UserController.createNewUser);
// Get By ID
router.get("/:id", authenticate, requireUserBackofficeAccess, UserController.getUserById);

// READ - GET
router.get("/", authenticate, requireUserBackofficeAccess, UserController.getAllUsers);

// UPDATE - PUT
router.put("/:id", authenticate, requireUserBackofficeAccess, UserController.updateUser);

// DELETE - DELETE
router.delete("/:id", authenticate, requireUserBackofficeAccess, UserController.deleteUser);

// RESTORE - POST
router.post("/:id/restore", authenticate, requireUserBackofficeAccess, UserController.restoreUser);

// CHANGE PASSWORD - POST
router.post("/:id/changepassword", authenticate, requireUserBackofficeAccess, UserController.changePassword);

// RESET PASSWORD - POST (Public/Tanpa Token)
router.post("/:email/resetpassword", publicPasswordResetRateLimiter, UserController.resetPassword);

module.exports = router;
