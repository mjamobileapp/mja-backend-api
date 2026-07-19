const express = require("express");
const MasterItemController = require("../controller/masterItem");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// Daftarkan rute POST untuk master item expense
router.post("/", authenticate, catchAsync(MasterItemController.createNewMasterItem));
router.get("/", authenticate, catchAsync(MasterItemController.getAllMasterItem));
router.get("/:id", authenticate, catchAsync(MasterItemController.getMasterItemById));
router.get("/tipe/:tipeItem", authenticate, catchAsync(MasterItemController.getMasterItemByTipe));
router.put("/:id", authenticate, catchAsync(MasterItemController.updateMasterItem));
router.delete("/:id", authenticate, catchAsync(MasterItemController.deleteMasterItem));
router.post("/:id/restore", authenticate, catchAsync(MasterItemController.restoreMasterItem));

module.exports = router;
