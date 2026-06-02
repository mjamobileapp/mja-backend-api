const express = require("express");

const RoleController = require("../controller/roles");
const router = express.Router();

const { authenticate } = require("../middleware/auth");

// Create Role ==========
router.post("/", authenticate, RoleController.createNewRole);
// Get All Roles ==========
router.get("/", authenticate, RoleController.getAllRoles);
// Get Role By Id ==========
router.get("/:idRole", authenticate, RoleController.getRoleById);
// Update Role ==========
router.put("/:idRole", authenticate, RoleController.updateRole);
// Delete Role ==========
router.delete("/:idRole", authenticate, RoleController.deleteRole);

module.exports = router;
