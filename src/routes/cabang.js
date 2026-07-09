const express = require("express");
const CabangController = require("../controller/cabang");
const { authenticate } = require("../middleware/auth");
const { authenticateBackofficeOrOwner } = require("../middleware/authCombined");

const router = express.Router();

router.post("/", authenticate, CabangController.createNewCabang);
router.get("/", authenticate, CabangController.getAllCabang);
router.get("/mitra/:idMitra", authenticateBackofficeOrOwner(), CabangController.getCabangByIdMitra);
router.get("/:id", authenticate, CabangController.getCabangById);
router.put("/:id", authenticate, CabangController.updateCabang);
router.delete("/:id", authenticate, CabangController.deleteCabang);
router.post("/:id", authenticate, CabangController.resetCabang);
router.post("/:id/restore", authenticate, CabangController.restoreCabang);

module.exports = router;
