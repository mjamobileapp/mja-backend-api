const express = require("express");
const MasterItemController = require("../controller/masterItem");
const { authenticate } = require("../middleware/auth");
const { authenticateBackofficeOrOwnerKasir } = require("../middleware/authCombined");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// Daftarkan rute POST untuk master item expense
router.post("/", authenticate, catchAsync(MasterItemController.createNewMasterItem));
router.get("/", authenticateBackofficeOrOwnerKasir(), catchAsync(MasterItemController.getAllMasterItem));
router.get("/tipe/:tipeItem", authenticateBackofficeOrOwnerKasir(), catchAsync(MasterItemController.getMasterItemByTipe));
router.get("/:id", authenticateBackofficeOrOwnerKasir(), catchAsync(MasterItemController.getMasterItemById));
router.put("/:id", authenticate, catchAsync(MasterItemController.updateMasterItem));
router.delete("/:id", authenticate, catchAsync(MasterItemController.deleteMasterItem));
router.post("/:id/restore", authenticate, catchAsync(MasterItemController.restoreMasterItem));

module.exports = router;
