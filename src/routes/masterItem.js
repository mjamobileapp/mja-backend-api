const express = require("express");
const MasterItemController = require("../controller/masterItem");
const { authenticate } = require("../middleware/auth");
const { authenticateBackofficeOrOwnerKasirCabang } = require("../middleware/authCombined");

const router = express.Router();

// Daftarkan rute POST untuk master item expense
router.post("/", authenticate, MasterItemController.createNewMasterItem);
router.get("/", authenticate, MasterItemController.getAllMasterItem);
router.get("/:id", authenticate, MasterItemController.getMasterItemById);
router.get("/tipe/:tipeItem", authenticateBackofficeOrOwnerKasirCabang, MasterItemController.getMasterItemByTipe);
router.put("/:id", authenticate, MasterItemController.updateMasterItem);
router.delete("/:id", authenticate, MasterItemController.deleteMasterItem);
router.post("/:id/restore", authenticate, MasterItemController.restoreMasterItem);

module.exports = router;