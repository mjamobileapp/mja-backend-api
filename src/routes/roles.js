const express = require("express");

const RoleController = require("../controller/roles");
const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { requireBackofficeMenuAccess } = require("../middleware/authorization");

const requireRoleAccess = requireBackofficeMenuAccess("/settings/role");

// Create Role ==========
router.post("/", authenticate, requireRoleAccess, RoleController.createNewRole);
// Get All Roles ==========
router.get("/", authenticate, requireRoleAccess, RoleController.getAllRoles);
// Get Role By Id ==========
router.get("/:idRole", authenticate, requireRoleAccess, RoleController.getRoleById);
// Update Role ==========
router.put("/:idRole", authenticate, requireRoleAccess, RoleController.updateRole);
// Delete Role ==========
router.delete("/:idRole", authenticate, requireRoleAccess, RoleController.deleteRole);

module.exports = router;
