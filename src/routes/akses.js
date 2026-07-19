const express = require("express");
const router = express.Router();
const aksesController = require("../controller/akses");
const { authenticate } = require("../middleware/auth");
const {
  requireBackofficeMenuAccess,
  requireBackofficeSelfOrMenuAccess,
} = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const requireRoleAccess = requireBackofficeMenuAccess("/settings/role");
const requireOwnAccessOrRoleAccess = requireBackofficeSelfOrMenuAccess("/settings/role");

router.get("/role/:idRole", authenticate, requireRoleAccess, catchAsync(aksesController.getAksesRole));
router.post("/role/:idRole", authenticate, requireRoleAccess, catchAsync(aksesController.saveAksesRole));
router.get("/user/:email", authenticate, requireOwnAccessOrRoleAccess, catchAsync(aksesController.getAksesByUser));

module.exports = router;
