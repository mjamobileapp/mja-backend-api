const express = require("express");
const CabangController = require("../controller/cabang");
const { authenticate } = require("../middleware/auth");
const { authenticateBackofficeOrOwner } = require("../middleware/authCombined");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.post("/", authenticate, catchAsync(CabangController.createNewCabang));
router.get("/", authenticate, catchAsync(CabangController.getAllCabang));
router.get("/mitra/:idMitra", authenticateBackofficeOrOwner(), catchAsync(CabangController.getCabangByIdMitra));
router.get("/:id", authenticate, catchAsync(CabangController.getCabangById));
router.put("/:id", authenticate, catchAsync(CabangController.updateCabang));
router.delete("/:id", authenticate, catchAsync(CabangController.deleteCabang));
router.post("/:id", authenticate, catchAsync(CabangController.resetCabang));
router.post("/:id/restore", authenticate, catchAsync(CabangController.restoreCabang));

module.exports = router;
