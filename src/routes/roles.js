const express = require("express");

const RoleController = require("../controller/roles");
const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { requireBackofficeMenuAccess } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const requireRoleAccess = requireBackofficeMenuAccess("/settings/role");

// Create Role ==========
router.post("/", authenticate, requireRoleAccess, catchAsync(RoleController.createNewRole));
// Get All Roles ==========
router.get("/", authenticate, requireRoleAccess, catchAsync(RoleController.getAllRoles));
// Get Role By Id ==========
router.get("/:idRole", authenticate, requireRoleAccess, catchAsync(RoleController.getRoleById));
// Update Role ==========
router.put("/:idRole", authenticate, requireRoleAccess, catchAsync(RoleController.updateRole));
// Delete Role ==========
router.delete("/:idRole", authenticate, requireRoleAccess, catchAsync(RoleController.deleteRole));

module.exports = router;
